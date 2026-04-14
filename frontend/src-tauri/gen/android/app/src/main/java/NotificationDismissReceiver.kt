package com.oc.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.lifecycle.lifecycleScope
import com.ocplugin.app.NotificationsManager
import kotlinx.coroutines.launch

class NotificationDismissReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        
        // TODO This code is exactly the same as in the MainActivity!!!!
        val notificationPayload = intent.getStringExtra("notificationPayload")

        // Payload should be json string
        if (notificationPayload != null) {
            ProcessLifecycleOwner.get().lifecycleScope.launch {
                NotificationsManager.releaseNotificationsAfterTapOrDismissed(context, notificationPayload, false)
            }
        }
    }
}