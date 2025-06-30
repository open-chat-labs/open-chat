package com.ocplugin.app

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import app.tauri.plugin.JSObject

class OpenChatNotificationService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        Log.d("TEST_OC", "FCM token refreshed: $token")

        // Re-cache new token
        OpenChatPlugin.fcmToken = token;

        // Report token refresh to the UI, which will then send it to the backend
        OpenChatPlugin.triggerRef("fcm-token-refresh", JSObject().apply { put("fcmToken", token) })
    }

    // Handle new notification!
    //
    // NOTE: This function only runs if the app is in the foreground!!! If the app is
    // closed or in the background, the notification will be handled on the OS level by the
    // notification manager, and displayed according to the channel settings for which the
    // notification was pushed.
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d("TEST_OC", "REMOTE MESSAGE RECEIVED: $remoteMessage")

        remoteMessage.data.let {
            // If the app is in the background, or closed, show the notification
            NotificationsHelper.showNotification(this, it)

            // TODO if the app is in the foreground, send to UI code
            // Push the new notification to the UI by raising an event!
            // This is less relevant at the moment, since the UI service worker can handle web push
            // notification, but will be important if we decide to switch over to pure Firebase
            // solution.es!
            // OpenChatPlugin.triggerRef("push-notification", JSObject().apply {
            //   put("title", it.title ?: "Title")
            //   put("body", it.body ?: "Body")
            // })
        }
    }
}
