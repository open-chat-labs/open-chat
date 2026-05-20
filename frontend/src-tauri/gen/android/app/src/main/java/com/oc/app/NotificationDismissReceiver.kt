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
        
        // Summary (collapsed group) was swiped away: reconcile the whole DB, since
        // Android won't fire the children's individual delete intents in this case.
        if (intent.getBooleanExtra("summaryDismiss", false)) {
            ProcessLifecycleOwner.get().lifecycleScope.launch {
                NotificationsManager.releaseAllNotificationsAfterSummaryDismissed(context)
            }
            return
        }

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