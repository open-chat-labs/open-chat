package com.oc.app

import android.content.Intent
import android.util.Log
import android.os.Bundle
import com.ocplugin.app.NotificationsHelper

class MainActivity : TauriActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        try {
            // Cache FCM token, and create notification channel
            NotificationsHelper.cacheFCMToken()
            NotificationsHelper.createNotificationChannel(this)
        } catch (e: Exception) {
            Log.e("TEST_OC", "Error occurred $e")
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        
        Log.d("TEST_OC", "NotificationClick: Received intent with extras ${intent.extras}}")

        intent.extras?.getString("notification_payload")?.let { payload ->
            Log.d("TEST_OC", "NotificationClick: Received payload: $payload")

            // TODO Emit to Tauri frontend
        }
    }
}
