require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const axios = require('axios'); // Asegúrate de que axios esté instalado

// --- CONFIGURACIÓN DE FIREBASE ---
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL
});
const db = admin.firestore();
console.log('Conexión con Firebase establecida.');

// --- CONFIGURACIÓN DEL SERVIDOR EXPRESS ---
const app = express();
app.use(cors());
app.use(express.json());

// Leemos las variables de entorno
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// --- RUTAS DE LA API ---

// ... (Las rutas GET / y GET /webhook se mantienen igual)
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


// Ruta para RECIBIR los mensajes entrantes de WhatsApp
app.post('/webhook', async (req, res) => {
    // ... (Esta ruta se mantiene igual que en la v4)
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const contactInfo = req.body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];

    if (message) {
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
            console.error("Error al guardar en Firestore:", error);
        }
    }
    res.sendStatus(200);
});

// Ruta para entregar la LISTA DE CONTACTOS al frontend
app.get('/api/contacts', async (req, res) => {
    // ... (Esta ruta se mantiene igual que en la v4)
    try {
        const contactsSnapshot = await db.collection('contacts_whatsapp').orderBy('lastMessageTimestamp', 'desc').get();
        const contacts = [];
        contactsSnapshot.forEach(doc => {
            contacts.push({ id: doc.id, ...doc.data() });
        });
        res.status(200).json(contacts);
        console.log('Se entregó la lista de contactos al frontend.');
    } catch (error) {
        console.error('Error al obtener contactos:', error);
        res.status(500).send('Error al obtener la lista de contactos.');
    }
});

// Ruta para obtener los MENSAJES DE UN CHAT
app.get('/api/contacts/:contactId/messages', async (req, res) => {
    // ... (Esta ruta se mantiene igual que en la v4)
    try {
        const contactId = req.params.contactId;
        const messagesSnapshot = await db.collection('contacts_whatsapp').doc(contactId).collection('messages').orderBy('timestamp', 'asc').get();
        const messages = [];
        messagesSnapshot.forEach(doc => {
            messages.push({ id: doc.id, ...doc.data() });
        });
        res.status(200).json(messages);
        console.log(`Se entregaron los mensajes para el contacto ${contactId}.`);
    } catch (error) {
        console.error(`Error al obtener mensajes para ${req.params.contactId}:`, error);
        res.status(500).send('Error al obtener los mensajes.');
    }
});


// --- NUEVA RUTA PARA ENVIAR MENSAJES ---
app.post('/api/contacts/:contactId/messages', async (req, res) => {
    const { contactId } = req.params;
    const { text } = req.body;

    if (!text) {
        return res.status(400).send('El texto del mensaje es requerido.');
    }

    try {
        // 1. Enviar el mensaje a través de la API de Meta
        await axios.post(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
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

        // 2. Guardar el mensaje enviado en nuestra base de datos
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        const contactRef = db.collection('contacts_whatsapp').doc(contactId);
        
        await contactRef.collection('messages').add({
            text: text,
            timestamp: timestamp,
            status: 'sent' // Marcamos el mensaje como 'enviado'
        });

        // 3. Actualizar el último mensaje del contacto
        await contactRef.update({
            lastMessage: text,
            lastMessageTimestamp: timestamp
        });

        console.log(`Mensaje enviado guardado en Firestore para ${contactId}.`);
        res.status(200).send({ success: true });

    } catch (error) {
        console.error('Error al enviar el mensaje:', error.response ? error.response.data : error.message);
        res.status(500).send('Error al procesar el envío del mensaje.');
    }
});


// --- INICIAMOS EL SERVIDOR ---
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
