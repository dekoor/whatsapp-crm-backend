require('dotenv').config();
const express = 'express';
const admin = require('firebase-admin');
const cors = require('cors');
const axios = require('axios');

// ... (La configuración de Firebase y Express se mantiene igual)
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL
});
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// ... (GET /, GET /webhook se mantienen igual)
app.get('/', (req, res) => res.send('Backend del CRM v7.'));
app.get('/webhook', (req, res) => { /* ...código sin cambios... */ });

// --- RUTA WEBHOOK ACTUALIZADA PARA MANEJAR MENSAJES Y ESTADOS ---
app.post('/webhook', async (req, res) => {
    const change = req.body.entry?.[0]?.changes?.[0]?.value;

    // Si es un mensaje nuevo
    if (change?.messages) {
        const message = change.messages[0];
        const contactInfo = change.contacts[0];
        const from = message.from;
        const text = message.text.body;
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        try {
            const contactRef = db.collection('contacts_whatsapp').doc(from);
            await contactRef.set({ lastMessageTimestamp: timestamp, name: contactInfo.profile.name, lastMessage: text, wa_id: contactInfo.wa_id }, { merge: true });
            await contactRef.collection('messages').add({ text: text, timestamp: timestamp, from: from, status: 'received' });
            console.log(`Mensaje de ${from} guardado.`);
        } catch (error) { console.error("Error al guardar mensaje recibido:", error); }
    }
    // Si es una actualización de estado
    else if (change?.statuses) {
        const statusInfo = change.statuses[0];
        const messageId = statusInfo.id; // wamid del mensaje
        const newStatus = statusInfo.status; // sent, delivered, read

        try {
            // Buscamos el mensaje por su wamid en todas las subcolecciones 'messages'
            const querySnapshot = await db.collectionGroup('messages').where('wamid', '==', messageId).limit(1).get();
            if (!querySnapshot.empty) {
                const messageDoc = querySnapshot.docs[0];
                await messageDoc.ref.update({ status: newStatus });
                console.log(`Estado del mensaje ${messageId} actualizado a ${newStatus}.`);
            }
        } catch(error) {
            console.error(`Error actualizando estado para ${messageId}:`, error);
        }
    }

    res.sendStatus(200);
});


// --- RUTA DE ENVÍO ACTUALIZADA PARA GUARDAR EL ID DEL MENSAJE ---
app.post('/api/contacts/:contactId/messages', async (req, res) => {
    const { contactId } = req.params;
    const { text } = req.body;

    if (!text) return res.status(400).send('El texto es requerido.');
    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) return res.status(500).send('Error de configuración.');

    try {
        const response = await axios.post(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
            messaging_product: 'whatsapp',
            to: contactId,
            text: { body: text }
        }, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const messageId = response.data.messages[0].id; // ¡Obtenemos el ID!
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        const contactRef = db.collection('contacts_whatsapp').doc(contactId);
        
        // Guardamos el mensaje con su wamid y estado inicial 'sending'
        await contactRef.collection('messages').add({
            text: text,
            timestamp: timestamp,
            status: 'sending',
            wamid: messageId // ¡Guardamos el ID!
        });

        await contactRef.update({ lastMessage: text, lastMessageTimestamp: timestamp });
        res.status(200).send({ success: true, wamid: messageId });
    } catch (error) {
        console.error('ERROR AL ENVIAR MENSAJE:', error.response ? error.response.data.error : error.message);
        res.status(500).send({ success: false, error: 'Error al procesar el envío.' });
    }
});


// ... (Las rutas GET /api/contacts y GET /api/contacts/:contactId/messages se mantienen igual)
app.get('/api/contacts', async (req, res) => { /* ...código sin cambios... */ });
app.get('/api/contacts/:contactId/messages', async (req, res) => { /* ...código sin cambios... */ });


app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
