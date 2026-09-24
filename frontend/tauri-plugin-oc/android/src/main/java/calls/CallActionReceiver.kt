package com.ocplugin.app.calls

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Decline from the notification action. Works over the lock screen with no unlock and
// with the app not running.
class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != IncomingCallNotifications.ACTION_DECLINE) return
        val call = IncomingCall.fromBundle(intent.extras) ?: return
        CallRinger.decline(context, call.id)
    }
}
