package com.ocplugin.app.commands

import android.app.Activity
import android.util.Log
import app.tauri.annotation.InvokeArg
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
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
            NotificationsHelper.showNotification(activity, args.data)
        } catch (e: Exception) {
            Log.e("OC_APP", e.toString())
        }
    }
}
