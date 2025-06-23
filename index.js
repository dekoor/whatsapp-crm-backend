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


// Ruta para RECIBIR los mensajes y ACTUALIZACIONES DE ESTADO
app.post('/webhook', async (req, res) => {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (value) {
        if (value.messages) {
            const message = value.messages[0];
            const contactInfo = value.contacts[0];
            const from = message.from;
            const timestamp = admin.firestore.FieldValue.serverTimestamp();
            const contactRef = db.collection('contacts_whatsapp').doc(from);
            
            let messageData = {
                timestamp: timestamp,
                from: from,
                status: 'received' // Mensaje recibido del usuario
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
                        
                        const mediaUrlResponse = await axios.get(`https://graph.facebook.com/v19.0/${mediaInfo.id}`, { headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` } });
                        const mediaUrl = mediaUrlResponse.data.url;
                        const fileResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer', headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` } });

                        const fileName = `received/${from}_${Date.now()}`;
                        const file = bucket.file(fileName);
                        await file.save(fileResponse.data, { metadata: { contentType: mediaInfo.mime_type } });
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
                    wa_id: contactInfo.wa_id,
                    unreadCount: admin.firestore.FieldValue.increment(1)
                }, { merge: true });

                console.log(`Mensaje (${message.type}) de ${from} guardado y contador de no leídos incrementado.`);

            } catch (error) {
                console.error("Error procesando webhook de mensaje:", error.response ? error.response.data : error.message);
            }
        }
        
        else if (value.statuses) {
            const statusInfo = value.statuses[0];
            const { status: newStatus, id: wamid, recipient_id: from } = statusInfo;
            if (wamid && from) {
                try {
                    const messagesRef = db.collection('contacts_whatsapp').doc(from).collection('messages');
                    const q = messagesRef.where('wamid', '==', wamid).limit(1);
                    const querySnapshot = await q.get();

                    if (!querySnapshot.empty) {
                        const messageDocRef = querySnapshot.docs[0].ref;
                        const currentStatus = querySnapshot.docs[0].data().status;
                        if (currentStatus === 'read') {} 
                        else if (currentStatus === 'delivered' && newStatus === 'sent') {}
                        else { await messageDocRef.update({ status: newStatus }); }
                    }
                } catch (error) { console.error("Error procesando actualización de estado:", error.message); }
            }
        }
    }
    res.sendStatus(200);
});

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

// --- Endpoint de envío de mensajes con validación de 24 horas ---
app.post('/api/contacts/:contactId/messages', async (req, res) => {
    const { contactId } = req.params;
    const { text, fileUrl, fileType } = req.body;
    if (!text && !fileUrl) { 
        return res.status(400).json({ success: false, message: 'Se requiere texto o un archivo.' });
    }

    try {
        // Validación de la ventana de 24 horas
        const messagesRef = db.collection('contacts_whatsapp').doc(contactId).collection('messages');
        const lastReceivedQuery = messagesRef.where('status', '==', 'received').orderBy('timestamp', 'desc').limit(1);
        const lastReceivedSnapshot = await lastReceivedQuery.get();

        if (lastReceivedSnapshot.empty) {
            return res.status(403).json({
                success: false,
                message: 'No puedes iniciar una conversación. Responde a un mensaje del usuario primero.'
            });
        }

        const lastReceivedMessage = lastReceivedSnapshot.docs[0].data();
        const lastMessageTimestamp = lastReceivedMessage.timestamp;

        if (lastMessageTimestamp) {
            const lastMessageDate = lastMessageTimestamp.toDate();
            const now = new Date();
            const twentyFourHoursInMillis = 24 * 60 * 60 * 1000;
            const timeDifference = now.getTime() - lastMessageDate.getTime();

            if (timeDifference > twentyFourHoursInMillis) {
                // --- MODIFICACIÓN CLAVE: Mensaje de error actualizado ---
                return res.status(403).json({
                    success: false,
                    message: 'No se puede enviar el mensaje. Han pasado más de 24 horas'
                });
            }
        }
        // Fin de la validación

        let messagePayload = { messaging_product: 'whatsapp', to: contactId, };
        let firestoreMessage = { timestamp: admin.firestore.FieldValue.serverTimestamp(), status: 'sent' };
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
                return res.status(400).json({ success: false, message: 'Tipo de archivo no soportado.' });
            }
        }

        const metaApiResponse = await axios.post(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, messagePayload, { headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } });
        const wamid = metaApiResponse.data.messages[0].id;
        firestoreMessage.wamid = wamid; 
        
        const contactRef = db.collection('contacts_whatsapp').doc(contactId);
        await contactRef.collection('messages').add(firestoreMessage);
        await contactRef.update({ lastMessage: lastMessageText, lastMessageTimestamp: firestoreMessage.timestamp });
        
        console.log(`Mensaje enviado (wamid: ${wamid}) guardado en Firestore para ${contactId}.`);
        res.status(200).send({ success: true, wamid: wamid });

    } catch (error) {
        console.error('Error al enviar el mensaje:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Error al procesar el envío del mensaje.' });
    }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
