<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CRM para WhatsApp</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.7/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.7/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore-compat.js"></script>
    <style>
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #e5e7eb; }
        ::-webkit-scrollbar-thumb { background: #9ca3af; border-radius: 4px; }
        .contact-item.active { background-color: #d1d5db; }
    </style>
</head>
<body class="bg-gray-100 font-sans">
    <!-- El HTML de login-screen y crm-app se mantiene igual -->
    <div id="login-screen">...</div>
    <div id="crm-app" class="hidden">...</div>

    <script>
        // --- Las configuraciones, inicialización y lógica de autenticación se mantienen igual ---
        const BACKEND_URL = '...';
        const firebaseConfig = { /* ... */ };
        firebase.initializeApp(firebaseConfig);
        const db = firebase.firestore();
        const auth = firebase.auth();
        // ...

        // --- Lógica del CRM (con funciones actualizadas) ---

        function getStatusIcon(status) {
            const blue = '#34B7F1';
            const gray = '#a1a1aa';
            switch (status) {
                case 'sending':
                    return `<svg class="w-4 h-4 inline-block" fill="${gray}" viewBox="0 0 16 16"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg>`;
                case 'sent':
                    return `<svg class="w-4 h-4 inline-block" fill="${gray}" viewBox="0 0 16 16"><path d="M12.354 4.354a.5.5 0 0 0-.708-.708L7 8.293 4.854 6.146a.5.5 0 1 0-.708.708l2.5 2.5a.5.5 0 0 0 .708 0l5-5z"/></svg>`;
                case 'delivered':
                    return `<svg class="w-4 h-4 inline-block" fill="${gray}" viewBox="0 0 16 16"><path d="M12.354 4.354a.5.5 0 0 0-.708-.708L7 8.293 4.854 6.146a.5.5 0 1 0-.708.708l2.5 2.5a.5.5 0 0 0 .708 0l5-5z"/><path d="m5.354 7.146.853-.854-.708-.708-.853.854a.5.5 0 0 0 0 .708l.707.708a.5.5 0 0 0 .708 0L6.5 7.5l-.707-.707L5.354 7.146z"/></svg>`;
                case 'read':
                    return `<svg class="w-4 h-4 inline-block" fill="${blue}" viewBox="0 0 16 16"><path d="M12.354 4.354a.5.5 0 0 0-.708-.708L7 8.293 4.854 6.146a.5.5 0 1 0-.708.708l2.5 2.5a.5.5 0 0 0 .708 0l5-5z"/><path d="m5.354 7.146.853-.854-.708-.708-.853.854a.5.5 0 0 0 0 .708l.707.708a.5.5 0 0 0 .708 0L6.5 7.5l-.707-.707L5.354 7.146z"/></svg>`;
                default:
                    return ''; // No mostrar icono para mensajes recibidos
            }
        }
        
        function appendMessage(message, isOptimistic = false) {
            const messageEl = document.createElement('div');
            const isSent = message.status !== 'received';
            messageEl.className = `flex my-2 ${isSent ? 'justify-end' : 'justify-start'}`;
            const bgColor = isSent ? 'bg-blue-500 text-white' : 'bg-white text-gray-800';
            
            let time;
            if (message.timestamp && message.timestamp.toDate) {
                time = message.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            } else if (isOptimistic && message.timestamp) {
                time = new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            } else { time = '' }

            const statusIcon = isSent ? getStatusIcon(message.status) : '';

            messageEl.innerHTML = `
                <div class="rounded-lg p-3 max-w-sm shadow ${bgColor}">
                    <p class="text-sm">${message.text}</p>
                    <div class="text-xs mt-1 ${isSent ? 'text-blue-200' : 'text-gray-400'} text-right flex items-center justify-end gap-1">
                        <span>${time}</span>
                        ${statusIcon}
                    </div>
                </div>
            `;
            if (isOptimistic) messageEl.id = 'optimistic-message';
            
            const existingOptimistic = document.getElementById('optimistic-message');
            if (existingOptimistic) {
                existingOptimistic.remove();
            }

            chatMessagesEl.appendChild(messageEl);
            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
            return messageEl;
        }

        async function handleSendMessage(event) {
            event.preventDefault();
            const text = messageInputEl.value.trim();
            if (!text || !currentContactId) return;

            const originalInputText = text;
            messageInputEl.value = '';
            
            appendMessage({ text: originalInputText, status: 'sending', timestamp: new Date() }, true);

            try {
                await fetch(`${BACKEND_URL}/api/contacts/${currentContactId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: originalInputText })
                });
                console.log('Solicitud de envío enviada al backend.');
                // Ya no necesitamos la UI optimista, el listener de Firebase se encargará de todo
                // fetchContacts(); // Ya no es necesario
            } catch(error) {
                console.error('Error al enviar el mensaje:', error);
                alert('Error: No se pudo enviar el mensaje.');
                // Quitar el mensaje optimista si falla
                const optimisticMessageEl = document.getElementById('optimistic-message');
                if (optimisticMessageEl) optimisticMessageEl.remove();
                messageInputEl.value = originalInputText;
            }
        }
        
        // El resto de las funciones (initCRM, fetchContacts, displayContacts, loadChat, displayMessages) se mantienen igual.
    </script>
</body>
</html>
