require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const axios = require('axios');

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

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// --- RUTAS DE LA API ---

app.get('/', (req, res) => {
  res.send('¡El backend del CRM de WhatsApp está vivo!');
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

app.post('/webhook', async (req, res) => {
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
        text,
        timestamp,
        from,
        status: 'received'
      });

      console.log(`Mensaje de ${from} guardado.`);
    } catch (error) {
      console.error("Error al guardar en Firestore:", error);
    }
  }

  res.sendStatus(200);
});

app.get('/api/contacts', async (req, res) => {
  try {
    const snapshot = await db.collection('contacts_whatsapp')
      .orderBy('lastMessageTimestamp', 'desc')
      .get();

    const contacts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json(contacts);
  } catch (error) {
    console.error('Error al obtener contactos:', error);
    res.status(500).send('Error al obtener la lista de contactos.');
  }
});

app.get('/api/contacts/:contactId/messages', async (req, res) => {
  try {
    const contactId = req.params.contactId;

    const snapshot = await db.collection('contacts_whatsapp')
      .doc(contactId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get();

    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json(messages);
  } catch (error) {
    console.error(`Error al obtener mensajes para ${req.params.contactId}:`, error);
    res.status(500).send('Error al obtener los mensajes.');
  }
});

app.post('/api/contacts/:contactId/messages', async (req, res) => {
  const { contactId } = req.params;
  const { text } = req.body;

  if (!text) {
    return res.status(400).send('El texto del mensaje es requerido.');
  }

  try {
    // Enviar mensaje vía API de WhatsApp
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

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const contactRef = db.collection('contacts_whatsapp').doc(contactId);

    await contactRef.collection('messages').add({
      text,
      timestamp,
      status: 'sent'
    });

    await contactRef.update({
      lastMessage: text,
      lastMessageTimestamp: timestamp
    });

    console.log(`Mensaje enviado a ${contactId}`);
    res.status(200).send({ success: true });

  } catch (error) {
    // 🔍 Aquí mejoramos el log para ver el error exacto
    console.error('ERROR AL ENVIAR MENSAJE:',
      error.response?.data?.error || error.message
    );

    res.status(500).send({
      success: false,
      error: error.response?.data?.error || 'Error desconocido al enviar el mensaje.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
