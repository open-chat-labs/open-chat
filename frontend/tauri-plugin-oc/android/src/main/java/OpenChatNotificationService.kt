package com.ocplugin.app

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import app.tauri.plugin.JSObject

class OpenChatNotificationService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        // TODO send to backend/tauri app!!!
        Log.d("TEST_OC", "FCM Token refreshed: $token")
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        println("TEST_OC: Remote message from: ${remoteMessage.from}")

        remoteMessage.notification?.let {
            Log.d("TEST_OC", "Message Notification Body: ${it.body}")
            // You would typically display a notification here
            // or pass this info back to your Tauri layers

            // Raise notification banner!!!
            //
            // NOTE 1: This function only runs if the app is in the foreground!!! If the app is
            // closed or in the background, the notification will be handled on the OS level by the
            // notification manager, and displayed according to the channel settings for which the
            // notification was pushed.
            // NOTE 2: Keeping this here for debugging purposes!
            // NotificationsHelper.showNotification(this, it.title ?: "Title", it.body ?: "Body")

            Log.d("TEST_OC", "Raise event /w notification")
            OpenChatPlugin.triggerRef("push-notification", JSObject().apply {
                put("title", it.title ?: "Title")
                put("body", it.body ?: "Body")
            })
        }

        // Handle data payload
        if (remoteMessage.data.isNotEmpty()) {
            println("TEST_OC: Message data payload: ${remoteMessage.data}")
            // Process the data payload, perhaps passing it back to your Tauri layers
        }

        // Handle message within 10 seconds
        if (remoteMessage.messageId != null) {
            // Process short duration work
        }
    }
}
