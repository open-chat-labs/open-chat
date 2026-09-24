package com.ocplugin.app.calls

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.telecom.TelecomManager
import android.util.Log
import com.ocplugin.app.LOG_TAG

// The call log's "call back" on Android 17 and later, where Telecom starts the activity
// the app registered for `TelecomManager.ACTION_CALL_BACK` instead of routing a redial
// through the phone account's outgoing connection. Both routes resolve the opaque handle
// to a chat and park a call start for the web layer. No UI.
//
// On those versions the log only holds calls made through the transactional Telecom
// API, which the in-call milestone adopts; registering this action is one of its
// conditions and is harmless now.
class CallBackActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val address = (intent.getParcelableExtra<Uri>(TelecomManager.EXTRA_HANDLE) ?: intent.data)?.toString()
            ?: intent.getStringExtra(EXTRA_CALL_BACK_NUMBER)
        val chat = CallHandleDirectory.chat(this, address)
        if (chat != null) {
            CallRinger.redial(this, chat)
        } else {
            // Nothing we can resolve (the transactional API sends a call UUID instead).
            // Open the app.
            Log.w(LOG_TAG, "Call back: no resolvable handle")
            startActivity(Intent(this, Class.forName("$packageName.MainActivity")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            })
        }
        finish()
    }

    companion object {
        // TelecomManager.ACTION_CALL_BACK and EXTRA_CALL_BACK_NUMBER, API 37. Spelled out
        // while compileSdk is 36.
        const val ACTION_CALL_BACK = "android.telecom.action.CALL_BACK"
        const val EXTRA_CALL_BACK_NUMBER = "android.telecom.extra.CALL_BACK_NUMBER"
        const val ACTION_CONFIGURE_CALL_LOG_INTEGRATION = "android.telecom.action.CONFIGURE_CALL_LOG_INTEGRATION"
    }
}
