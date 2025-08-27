package com.oc.app

import android.util.Log
import app.tauri.plugin.JSObject
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.ocplugin.app.NotificationsHelper
import com.ocplugin.app.OpenChatPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class OpenChatNotificationService : FirebaseMessagingService() {

    // A scope tied to this service
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

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
    // Notification data is handed off to the NotificationsHelper, which will then process it.
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        remoteMessage.data.let { data ->
            NotificationsHelper.setNotificationIconSmall(R.drawable.ic_notification_small)
            
            serviceScope.launch {
                try {
                    NotificationsHelper.processReceivedNotification(
                        this@OpenChatNotificationService, data, MyApplication.isAppInForeground
                    )
                } catch (e: Exception) {
                    Log.e("TEST_OC", "Error handling notification", e)
                }
            }
        }
    }
}
