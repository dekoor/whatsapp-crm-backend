package com.dekoor.lifetracker.feature.reminders

import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import com.dekoor.lifetracker.R
import com.dekoor.lifetracker.REMINDERS_CHANNEL_ID
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class LifeTrackerMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title ?: getString(R.string.app_name)
        val body = message.notification?.body ?: return

        val notification = NotificationCompat.Builder(this, REMINDERS_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .build()

        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(System.currentTimeMillis().toInt(), notification)
    }

    override fun onNewToken(token: String) {
        // TODO: persist the token via repository (Firestore "users/{uid}/devices")
    }
}
