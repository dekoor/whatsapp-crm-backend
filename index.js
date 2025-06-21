// Importamos los paquetes que instalamos
require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors'); // Importamos cors

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
app.use(cors()); // Habilitamos CORS para todas las rutas
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// --- RUTAS DE LA API ---

app.get('/', (req, res) => {
  res.send('¡El backend del CRM de WhatsApp está vivo y listo para servir datos!');
});

// Ruta para la verificación del Webhook de Meta (WhatsApp)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      console.log('WEBHOOK_VERIFICATION_FAILED');
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(404);
  }
});

// Ruta para recibir los mensajes entrantes de WhatsApp
app.post('/webhook', async (req, res) => {
  console.log('Mensaje recibido de WhatsApp:');
  console.log(JSON.stringify(req.body, null, 2)); 

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

// --- NUEVA RUTA PARA EL FRONTEND ---
// Esta ruta entregará la lista de contactos a nuestra página HTML
app.get('/api/contacts', async (req, res) => {
    try {
        const contactsSnapshot = await db.collection('contacts_whatsapp')
            .orderBy('lastMessageTimestamp', 'desc') // Ordenamos por el mensaje más reciente
            .get();

        const contacts = [];
        contactsSnapshot.forEach(doc => {
            contacts.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.status(200).json(contacts);
        console.log('Se entregó la lista de contactos al frontend.');
    } catch (error) {
        console.error('Error al obtener contactos:', error);
        res.status(500).send('Error al obtener la lista de contactos.');
    }
});


// --- INICIAMOS EL SERVIDOR ---
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
