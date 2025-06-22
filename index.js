require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const axios = require('axios');

// --- CONFIGURACIÓN DE FIREBASE ---
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
console.log('Conexión con Firebase establecida.');

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

// --- RUTA WEBHOOK MODIFICADA PARA RECIBIR MENSAJES Y ESTADOS ---
app.post('/webhook', async (req, res) => {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Bloque para procesar MENSAJES entrantes
    if (value?.messages?.[0]) {
        const message = value.messages[0];
        const contactInfo = value.contacts[0];
        const from = message.from;
        const text = message.text.body;
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        try {
            const contactRef = db.collection('contacts_whatsapp').doc(from);
            await contactRef.set({
                lastMessageTimestamp: timestamp,
                name: contactInfo.profile.name,
                lastMessage: text,
                wa_id: contactInfo.wa_id
            }, { merge: true });

            await contactRef.collection('messages').add({
                text: text,
                timestamp: timestamp,
                from: from,
                status: 'received'
            });
            console.log(`Mensaje de ${from} guardado y contacto actualizado.`);
        } catch (error) {
            console.error("Error al guardar mensaje recibido en Firestore:", error);
        }
    }

    // --- NUEVO BLOQUE ---
    // Bloque para procesar ACTUALIZACIONES DE ESTADO (sent, delivered, read)
    if (value?.statuses?.[0]) {
        const statusUpdate = value.statuses[0];
        const wamid = statusUpdate.id; // ID del mensaje que está cambiando de estado
        const newStatus = statusUpdate.status; // 'sent', 'delivered', o 'read'

        try {
            // Usamos una consulta de grupo de colecciones para encontrar el mensaje por su wamid
            const messagesQuery = db.collectionGroup('messages').where('wamid', '==', wamid);
            const querySnapshot = await messagesQuery.get();

            if (!querySnapshot.empty) {
                querySnapshot.forEach(doc => {
                    doc.ref.update({ status: newStatus });
                });
                console.log(`Estado del mensaje ${wamid} actualizado a: ${newStatus}`);
            }
        } catch (error) {
            console.error("Error al actualizar estado del mensaje en Firestore:", error);
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


// --- RUTA DE ENVÍO DE MENSAJES MODIFICADA ---
app.post('/api/contacts/:contactId/messages', async (req, res) => {
    const { contactId } = req.params;
    const { text } = req.body;

    if (!text) {
        return res.status(400).send('El texto del mensaje es requerido.');
    }

    try {
        // 1. Enviar el mensaje a través de la API de Meta y capturar la respuesta
        const response = await axios.post(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, { // <-- MODIFICADO
            messaging_product: 'whatsapp',
            to: contactId,
            text: { body: text }
        }, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`Mensaje enviado a ${contactId} a través de la API de Meta.`);

        // 2. Extraer el ID del mensaje de la respuesta de Meta
        const messageId = response.data?.messages?.[0]?.id; // <-- NUEVO
        if (!messageId) { // <-- NUEVO
            throw new Error("No se recibió messageId (wamid) de la API de Meta.");
        }

        // 3. Guardar el mensaje enviado en nuestra base de datos, incluyendo el wamid
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        const contactRef = db.collection('contacts_whatsapp').doc(contactId);

        await contactRef.collection('messages').add({
            wamid: messageId, // <-- NUEVO: Guardamos el ID para futuras actualizaciones de estado
            text: text,
            timestamp: timestamp,
            from: 'me',
            status: 'sent' // El estado inicial es 'sent'
        });

        // 4. Actualizar el último mensaje del contacto
        await contactRef.update({
            lastMessage: text,
            lastMessageTimestamp: timestamp
        });

        console.log(`Mensaje enviado (wamid: ${messageId}) guardado en Firestore para ${contactId}.`);
        res.status(200).send({ success: true, wamid: messageId });

    } catch (error) {
        console.error('Error al enviar el mensaje:', error.response ? error.response.data : error.message);
        res.status(500).send('Error al procesar el envío del mensaje.');
    }
});


app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
