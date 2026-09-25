package com.ocplugin.app.calls

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

// Decline from the notification action. Works over the lock screen with no unlock and
// with the app not running. The process is held only as long as the bounded report to
// the bridge takes.
class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val call = IncomingCall.fromBundle(intent.extras) ?: return
        if (intent.action == CallForegroundService.ACTION_HANG_UP) {
            CallSession.hangUp(context, call.id, "notification")
            return
        }
        if (intent.action != IncomingCallNotifications.ACTION_DECLINE) return
        val report = CallRinger.decline(context, call.id) ?: return
        val result = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                report.join()
            } finally {
                result.finish()
            }
        }
    }
}
