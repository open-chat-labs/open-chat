package com.oclabs.openchat

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import fixtures.Probe

// Only app-owned class identities are needed. The real MyApplication is compiled
// unchanged; no Tauri Activity, Firebase service or user data is started here.
class MainActivity : Activity() {
    init { Probe.activityConstructions++ }
}

class NotificationDismissReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {}
}
