require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
const cors = require('cors');
const axios = require('axios');

// --- CONFIGURACIÓN DE FIREBASE ---
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'pedidos-con-gemini.firebasestorage.app' 
});
const db = admin.firestore();
const bucket = getStorage().bucket();
console.log('Conexión con Firebase (Firestore y Storage) establecida.');


// --- CONFIGURACIÓN DEL SERVIDOR EXPRESS ---
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// --- RUTAS DE LA API ---

app.get('/', (req, res) => {
  res.send('¡El backend del CRM de WhatsApp está vivo y listo para servir y enviar datos!');
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(404);
  }
});


// Ruta para RECIBIR los mensajes y ACTUALIZACIONES DE ESTADO - MODIFICADA
app.post('/webhook', async (req, res) => {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (value) {
        // Caso 1: Se recibe un mensaje nuevo
        if (value.messages) {
            const message = value.messages[0];
            const contactInfo = value.contacts[0];
            const from = message.from;
            const timestamp = admin.firestore.FieldValue.serverTimestamp();
            const contactRef = db.collection('contacts_whatsapp').doc(from);
            
            let messageData = {
                timestamp: timestamp,
                from: from,
                status: 'received' // 'received' para mensajes entrantes
            };
            let lastMessageText = '';

            try {
                switch (message.type) {
                    case 'text':
                        messageData.text = message.text.body;
                        lastMessageText = message.text.body;
                        break;
                    case 'image':
                    case 'video':
                        const isImage = message.type === 'image';
                        const mediaInfo = isImage ? message.image : message.video;
                        messageData.fileType = message.type;
                        lastMessageText = isImage ? '📷 Imagen' : '🎥 Video';
                        
                        const mediaUrlResponse = await axios.get(`https://graph.facebook.com/v19.0/${mediaInfo.id}`, {
                            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
                        });
                        const mediaUrl = mediaUrlResponse.data.url;
                        
                        const fileResponse = await axios.get(mediaUrl, {
                            responseType: 'arraybuffer',
                            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
                        });

                        const fileName = `received/${from}_${Date.now()}`;
                        const file = bucket.file(fileName);
                        await file.save(fileResponse.data, {
                            metadata: { contentType: mediaInfo.mime_type }
                        });
                        await file.makePublic();
                        messageData.fileUrl = file.publicUrl();
                        break;
                    default:
                        lastMessageText = `Mensaje no soportado: ${message.type}`;
                        messageData.text = lastMessageText;
                        break;
                }

                await contactRef.collection('messages').add(messageData);
                await contactRef.set({
                    lastMessageTimestamp: timestamp,
                    name: contactInfo.profile.name,
                    lastMessage: lastMessageText,
                    wa_id: contactInfo.wa_id
                }, { merge: true });
                console.log(`Mensaje (${message.type}) de ${from} guardado y contacto actualizado.`);

            } catch (error) {
                console.error("Error procesando webhook de mensaje:", error.response ? error.response.data : error.message);
            }
        }
        
        // Caso 2: Se recibe una actualización de estado (sent, delivered, read)
        else if (value.statuses) {
            const statusInfo = value.statuses[0];
            const { status: newStatus, message_id: wamid, recipient_id: from } = statusInfo;
            
            try {
                const messagesRef = db.collection('contacts_whatsapp').doc(from).collection('messages');
                const q = messagesRef.where('wamid', '==', wamid).limit(1);
                const querySnapshot = await q.get();

                if (!querySnapshot.empty) {
                    const messageDocRef = querySnapshot.docs[0].ref;
                    await messageDocRef.update({ status: newStatus });
                    console.log(`Estado del mensaje ${wamid} actualizado a: ${newStatus} para ${from}`);
                }
            } catch (error) {
                console.error("Error procesando actualización de estado:", error.message);
            }
        }
    }
    res.sendStatus(200);
});

// Ruta para entregar la LISTA DE CONTACTOS al frontend
app.get('/api/contacts', async (req, res) => {
    try {
        const contactsSnapshot = await db.collection('contacts_whatsapp').orderBy('lastMessageTimestamp', 'desc').get();
        const contacts = [];
        contactsSnapshot.forEach(doc => {
            contacts.push({ id: doc.id, ...doc.data() });
        });
        res.status(200).json(contacts);
    } catch (error) {
        console.error('Error al obtener contactos:', error);
        res.status(500).send('Error al obtener la lista de contactos.');
    }
});

// Ruta para obtener los MENSAJES DE UN CHAT
app.get('/api/contacts/:contactId/messages', async (req, res) => {
    try {
        const contactId = req.params.contactId;
        const messagesSnapshot = await db.collection('contacts_whatsapp').doc(contactId).collection('messages').orderBy('timestamp', 'asc').get();
        const messages = [];
        messagesSnapshot.forEach(doc => {
            messages.push({ id: doc.id, ...doc.data() });
        });
        res.status(200).json(messages);
    } catch (error) {
        console.error(`Error al obtener mensajes para ${req.params.contactId}:`, error);
        res.status(500).send('Error al obtener los mensajes.');
    }
});


// Ruta para ENVIAR MENSAJES - MODIFICADA
app.post('/api/contacts/:contactId/messages', async (req, res) => {
    const { contactId } = req.params;
    const { text, fileUrl, fileType } = req.body;

    if (!text && !fileUrl) {
        return res.status(400).send('Se requiere texto o un archivo.');
    }

    try {
        let messagePayload = {
            messaging_product: 'whatsapp',
            to: contactId,
        };
        let firestoreMessage = {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            // El estado inicial siempre es 'sent' porque lo acabamos de enviar a Meta
            status: 'sent'
        };
        let lastMessageText = '';

        if (text) {
            messagePayload.type = 'text';
            messagePayload.text = { body: text };
            firestoreMessage.text = text;
            lastMessageText = text;
        } else if (fileUrl && fileType) {
            const type = fileType.split('/')[0];
            if (type === 'image' || type === 'video') {
                messagePayload.type = type;
                messagePayload[type] = { link: fileUrl };
                firestoreMessage.fileUrl = fileUrl;
                firestoreMessage.fileType = type;
                lastMessageText = type === 'image' ? '📷 Imagen' : '🎥 Video';
            } else {
                 return res.status(400).send('Tipo de archivo no soportado. Solo imágenes y videos.');
            }
        }

        // 1. Enviar el mensaje a través de la API de Meta
        const metaApiResponse = await axios.post(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, messagePayload, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        // **NUEVO**: Obtenemos el ID del mensaje de la respuesta de Meta
        const wamid = metaApiResponse.data.messages[0].id;
        firestoreMessage.wamid = wamid; // Y lo agregamos al objeto que guardaremos

        // 2. Guardar el mensaje enviado en nuestra base de datos
        const contactRef = db.collection('contacts_whatsapp').doc(contactId);
        await contactRef.collection('messages').add(firestoreMessage);

        // 3. Actualizar el último mensaje del contacto
        await contactRef.update({
            lastMessage: lastMessageText,
            lastMessageTimestamp: firestoreMessage.timestamp
        });

        console.log(`Mensaje enviado (wamid: ${wamid}) guardado en Firestore para ${contactId}.`);
        res.status(200).send({ success: true, wamid: wamid });

    } catch (error) {
        console.error('Error al enviar el mensaje:', error.response ? error.response.data : error.message);
        res.status(500).send('Error al procesar el envío del mensaje.');
    }
});


// --- INICIAMOS EL SERVIDOR ---
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
