package com.ocplugin.app.commands

import android.app.Activity
import android.util.Log
import app.tauri.annotation.InvokeArg
import app.tauri.plugin.Invoke
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.NotificationsHelper

@InvokeArg
class ShowNotificationsArgs {
    var data: Map<String, String> = mapOf<String, String>()
}

@Suppress("UNUSED")
class ShowNotification(private val activity: Activity) {

    fun handler(invoke: Invoke) {
        val args = invoke.parseArgs(ShowNotificationsArgs::class.java)

        try {
            NotificationsHelper.processNewNotification(activity, args.data)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Error processing notification", e)
        }
    }
}
