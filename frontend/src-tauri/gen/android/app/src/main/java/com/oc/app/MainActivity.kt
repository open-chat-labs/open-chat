package com.oc.app

import android.content.Intent
import android.util.Log
import android.os.Bundle
import app.tauri.plugin.JSObject
import com.ocplugin.app.NotificationsHelper
import com.ocplugin.app.OpenChatPlugin

class MainActivity : TauriActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)        
        try {
            // Cache FCM token, and create notification channel
            NotificationsHelper.cacheFCMToken()
            NotificationsHelper.createNotificationChannel(this)
            handleNotificationIntent(intent)
        } catch (e: Exception) {
            Log.e("OC_APP", "Error occurred $e")
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        try {
            handleNotificationIntent(intent)
        } catch (e: Exception) {
            Log.e("OC_APP", "Error occurred $e")
        }
    }
    
    private fun handleNotificationIntent(intent: Intent) {
        val notificationPayload = intent.getStringExtra("notificationPayload")
        Log.d("TEST_OC", "NOTIFICATION CLICK: Received intent with extras ${notificationPayload}}")
        
        if (notificationPayload != null) {
            try {
                OpenChatPlugin.triggerRef(
                    "notification-tap",
                    JSObject(notificationPayload)
                )
            } catch (e: Exception) {
                Log.e("OC_APP", "Error occurred $e")
            }
        }
    }
}
