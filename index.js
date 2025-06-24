require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

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
const META_PIXEL_ID = process.env.META_PIXEL_ID;
const META_CAPI_ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;

// --- FUNCIÓN PARA HASHEAR DATOS ---
function sha256(data) {
    if (!data) return null;
    const normalizedData = typeof data === 'string' ? data.toLowerCase().replace(/\s/g, '') : data.toString();
    return crypto.createHash('sha256').update(normalizedData).digest('hex');
}

// --- FUNCIÓN GENÉRICA PARA ENVIAR EVENTOS DE CONVERSIÓN A META ---
const sendConversionEvent = async (eventName, contactInfo, referralInfo, customData = {}) => {
    if (!META_PIXEL_ID || !META_CAPI_ACCESS_TOKEN) {
        console.warn('Advertencia: Faltan credenciales de Meta. No se enviará el evento.');
        return;
    }

    const url = `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events`;
    const eventTime = Math.floor(Date.now() / 1000);
    const eventId = `${eventName}_${contactInfo.wa_id}_${eventTime}`; 

    const userData = { ph: [] };
    if (contactInfo.wa_id) {
        userData.ph.push(sha256(contactInfo.wa_id));
    }
    if (contactInfo.profile?.name) {
        userData.fn = sha256(contactInfo.profile.name);
    }
    
    if (userData.ph.length === 0) {
        console.error(`No se puede enviar el evento '${eventName}' porque falta el wa_id (número de teléfono).`);
        return;
    }

    const finalCustomData = {
        lead_source: referralInfo ? 'WhatsApp Ad' : 'WhatsApp Organic',
        ad_headline: referralInfo?.headline,
        ad_id: referralInfo?.source_id,
        ...customData
    };

    const payload = {
        data: [{
            event_name: eventName,
            event_time: eventTime,
            event_id: eventId,
            action_source: 'other', 
            user_data: userData,
            custom_data: finalCustomData
        }],
        // La siguiente línea se elimina para producción.
        // test_event_code: "TEST13491",
    };

    try {
        console.log(`Enviando evento de PRODUCCIÓN '${eventName}' para ${contactInfo.wa_id}.`);
        await axios.post(url, payload, { headers: { 'Authorization': `Bearer ${META_CAPI_ACCESS_TOKEN}`, 'Content-Type': 'application/json' } });
        console.log(`✅ Evento de PRODUCCIÓN '${eventName}' enviado a Meta.`);
    } catch (error) {
        console.error(`❌ Error al enviar evento de PRODUCCIÓN '${eventName}' a Meta.`, error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        throw new Error(`Falló el envío del evento de PRODUCCIÓN '${eventName}' a Meta.`);
    }
};

// --- WEBHOOK ---
app.post('/webhook', async (req, res) => {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (value && value.messages) {
        const message = value.messages[0];
        const contactInfo = value.contacts[0];
        const from = message.from;
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        const contactRef = db.collection('contacts_whatsapp').doc(from);
        
        let contactData = {
            lastMessageTimestamp: timestamp,
            name: contactInfo.profile.name,
            wa_id: contactInfo.wa_id,
            unreadCount: admin.firestore.FieldValue.increment(1)
        };
        
        let isNewAdContact = false;
        if (message.referral && message.referral.source_type === 'ad') {
            const contactDoc = await contactRef.get();
            if (!contactDoc.exists || !contactDoc.data().adReferral) {
                isNewAdContact = true;
            }
            contactData.adReferral = {
                source_id: message.referral.source_id,
                headline: message.referral.headline,
                source_type: message.referral.source_type,
                receivedAt: timestamp
            };
        }

        let messageData = { timestamp: timestamp, from: from, status: 'received' };
        let lastMessageText = '';
        try {
            switch (message.type) {
                case 'text':
                    messageData.text = message.text.body;
                    lastMessageText = message.text.body;
                    break;
                case 'image':
                case 'video':
                    lastMessageText = message.type === 'image' ? '📷 Imagen' : '🎥 Video';
                    messageData.text = lastMessageText;
                    break;
                default:
                    lastMessageText = `Mensaje no soportado: ${message.type}`;
                    messageData.text = lastMessageText;
                    break;
            }
        } catch (error) {
            console.error("Error procesando contenido del mensaje:", error.message);
        }

        await contactRef.collection('messages').add(messageData);
        contactData.lastMessage = lastMessageText;
        await contactRef.set(contactData, { merge: true });
        console.log(`Mensaje (${message.type}) de ${from} guardado.`);

        if (isNewAdContact) {
            try {
                await sendConversionEvent(
                    'ViewContent',
                    contactInfo,
                    contactData.adReferral
                );
                await contactRef.update({ viewContentSent: true });
            } catch (error) {
                console.error(`Fallo al enviar evento ViewContent para ${from}`);
            }
        }
    }
    res.sendStatus(200);
});

// --- ENDPOINTS PARA ACCIONES MANUALES ---

app.post('/api/contacts/:contactId/mark-as-registration', async (req, res) => {
    const { contactId } = req.params;
    const contactRef = db.collection('contacts_whatsapp').doc(contactId);
    try {
        const contactDoc = await contactRef.get();
        if (!contactDoc.exists) return res.status(404).json({ success: false, message: 'Contacto no encontrado.' });
        const contactData = contactDoc.data();
        if (contactData.registrationStatus === 'completed') return res.status(400).json({ success: false, message: 'Este contacto ya fue registrado.' });
        await sendConversionEvent('CompleteRegistration', { wa_id: contactData.wa_id, profile: { name: contactData.name } }, contactData.adReferral);
        await contactRef.update({ registrationStatus: 'completed', registrationSource: contactData.adReferral ? 'meta_ad' : 'manual_organic', registrationDate: admin.firestore.FieldValue.serverTimestamp() });
        res.status(200).json({ success: true, message: 'Contacto marcado como "Registro Completado".' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al procesar la solicitud.' });
    }
});

app.post('/api/contacts/:contactId/mark-as-purchase', async (req, res) => {
    const { contactId } = req.params;
    const { value } = req.body;
    const currency = 'MXN';
    if (!value || isNaN(parseFloat(value))) return res.status(400).json({ success: false, message: 'Se requiere un valor numérico válido.' });
    const contactRef = db.collection('contacts_whatsapp').doc(contactId);
    try {
        const contactDoc = await contactRef.get();
        if (!contactDoc.exists) return res.status(404).json({ success: false, message: 'Contacto no encontrado.' });
        const contactData = contactDoc.data();
        if (contactData.purchaseStatus === 'completed') return res.status(400).json({ success: false, message: 'Este contacto ya realizó una compra.' });
        await sendConversionEvent('Purchase', { wa_id: contactData.wa_id, profile: { name: contactData.name } }, contactData.adReferral, { value: parseFloat(value), currency });
        await contactRef.update({ purchaseStatus: 'completed', purchaseValue: parseFloat(value), purchaseCurrency: currency, purchaseDate: admin.firestore.FieldValue.serverTimestamp() });
        res.status(200).json({ success: true, message: 'Compra registrada y evento enviado a Meta.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al procesar la compra.' });
    }
});

app.post('/api/contacts/:contactId/send-view-content', async (req, res) => {
    const { contactId } = req.params;
    const contactRef = db.collection('contacts_whatsapp').doc(contactId);
    try {
        const contactDoc = await contactRef.get();
        if (!contactDoc.exists) return res.status(404).json({ success: false, message: 'Contacto no encontrado.' });
        const contactData = contactDoc.data();
        await sendConversionEvent('ViewContent', { wa_id: contactData.wa_id, profile: { name: contactData.name } }, contactData.adReferral);
        res.status(200).json({ success: true, message: 'Evento ViewContent enviado manualmente.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al procesar el envío de ViewContent.' });
    }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
