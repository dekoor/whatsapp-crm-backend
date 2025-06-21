// Importamos los paquetes que instalamos
require('dotenv').config(); // Carga las variables de entorno desde el archivo .env
const express = require('express');
const admin = require('firebase-admin');

// --- CONFIGURACIÓN DE FIREBASE ---
// Usamos el archivo de clave de servicio que pusimos en la carpeta
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL 
});

// Obtenemos una instancia de la base de datos de Firestore
const db = admin.firestore();
console.log('Conexión con Firebase establecida.');

// --- CONFIGURACIÓN DEL SERVIDOR EXPRESS ---
const app = express();
app.use(express.json()); // Habilitamos que el servidor entienda JSON

// Leemos las variables de entorno que configuramos
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// --- RUTAS DE LA API ---

// Ruta de prueba para saber si el servidor está funcionando
app.get('/', (req, res) => {
  res.send('¡El backend del CRM de WhatsApp está vivo!');
});

// Ruta para la verificación del Webhook de Meta (WhatsApp)
// Esta ruta es necesaria para que Meta confirme que el servidor es tuyo
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Verificamos que el modo y el token son correctos
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      // Si el token no coincide, enviamos un error 'Prohibido'
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
  // Usamos JSON.stringify para ver el objeto completo que nos manda Meta
  console.log(JSON.stringify(req.body, null, 2)); 

  // Extraemos el mensaje del cuerpo de la petición
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (message) {
    const from = message.from; // Número de teléfono del cliente
    const text = message.text.body; // El texto del mensaje

    try {
        // Creamos una nueva colección 'contacts_whatsapp' si no existe
        // y un documento por cada número de teléfono
        const contactRef = db.collection('contacts_whatsapp').doc(from);
        
        // Guardamos el mensaje en una sub-colección llamada 'messages'
        await contactRef.collection('messages').add({
            text: text,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            from: from,
            status: 'received' // Marcamos que es un mensaje recibido
        });

        console.log(`Mensaje de ${from} guardado correctamente en Firestore.`);

    } catch (error) {
        console.error("Error al guardar en Firestore:", error);
    }
  }

  // Respondemos a Meta con un 200 para que sepa que recibimos el mensaje
  res.sendStatus(200);
});


// --- INICIAMOS EL SERVIDOR ---
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
