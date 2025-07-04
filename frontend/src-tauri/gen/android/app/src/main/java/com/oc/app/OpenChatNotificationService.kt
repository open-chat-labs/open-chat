package com.oc.app

import android.util.Log
import app.tauri.plugin.JSObject
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.ocplugin.app.NotificationsHelper
import com.ocplugin.app.OpenChatPlugin
import kotlin.collections.component1
import kotlin.collections.component2

class OpenChatNotificationService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        Log.d("TEST_OC", "FCM token refreshed: $token")

        // Re-cache new token
        OpenChatPlugin.fcmToken = token

        // Report token refresh to the UI, which will then send it to the backend
        OpenChatPlugin.triggerRef("fcm-token-refresh", JSObject().apply { put("fcmToken", token) })
    }

    // Handle new notification!
    //
    // This function will run if the app is in foreground, background or closed.
    // If the app is in the background or closed, we simply show the notification.
    // If the app is in foreground, we send it to the UI! UI will then decide
    // if the app should be displayed, or not, depending on what the user is
    // viewing.
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        remoteMessage.data.let {
            if (MyApplication.isAppInForeground) {
                val notificationPayload = JSObject().apply {
                    it.forEach { (key, value) -> put(key, value) }
                }

                // Push notification to the UI if the app is in foreground!
                OpenChatPlugin.triggerRef("push-notification", notificationPayload)
            } else {
                // If the app is in the background, or closed, show the notification
                NotificationsHelper.showNotification(this, it)
            }
        }
    }
}
