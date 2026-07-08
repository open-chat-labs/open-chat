package com.ocplugin.app.commands

import android.util.Log
import app.tauri.plugin.Invoke
import com.google.firebase.messaging.FirebaseMessaging
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.OCPluginCompanion

// Deletes the device's FCM token and clears the local cache. Used on
// sign-out: even if the server-side token removal fails or races, pushes
// aimed at the deleted token dead-end at FCM. Firebase mints a fresh token
// the next time one is requested, so the next login re-registers cleanly.
@Suppress("UNUSED")
class DeleteFcmToken {

    fun handler(invoke: Invoke) {
        FirebaseMessaging.getInstance().deleteToken().addOnCompleteListener { task ->
            // Clear the cache either way — a stale token must not be re-registered.
            OCPluginCompanion.fcmToken = null

            if (task.isSuccessful) {
                invoke.resolve(null)
            } else {
                Log.e(LOG_TAG, "Failed to delete FCM token", task.exception)
                invoke.reject("FAILED")
            }
        }
    }
}
