package com.oc.app

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
}
