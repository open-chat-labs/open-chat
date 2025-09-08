package com.oc.app

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.ocplugin.app.NotificationsManager
import com.ocplugin.app.OCPluginCompanion
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class OpenChatNotificationService : FirebaseMessagingService() {

    // A scope tied to this service
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onNewToken(token: String) {
        OCPluginCompanion.cacheNewFcmToken(token)
    }

    // Handle new notification!
    //
    // This function will run if the app is in foreground, background or closed.
    // Notification data is handed off to the NotificationsHelper, which will then process it.
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        remoteMessage.data.let { data ->
            serviceScope.launch {
                try {
                    NotificationsManager.processReceivedNotification(
                        this@OpenChatNotificationService, data, MyApplication.isAppInForeground
                    )
                } catch (e: Exception) {
                    Log.e("TEST_OC", "Error handling notification", e)
                }
            }
        }
    }
}
