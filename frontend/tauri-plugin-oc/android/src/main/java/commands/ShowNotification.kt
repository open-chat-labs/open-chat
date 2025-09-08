package com.ocplugin.app.commands

import android.app.Activity
import android.util.Log
import app.tauri.annotation.InvokeArg
import app.tauri.plugin.Invoke
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.NotificationsManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@InvokeArg
class ShowNotificationsArgs {
    var notificationId: Long? = null
}

@Suppress("UNUSED")
class ShowNotification(private val activity: Activity) {

    fun handler(invoke: Invoke) {
        val args = invoke.parseArgs(ShowNotificationsArgs::class.java)
        val notificationId = args.notificationId

        Log.d(LOG_TAG, ".... Passed back by Svelte > Showing notification: $notificationId")

        if (notificationId == null) {
            Log.e(LOG_TAG, "!!!! Cannot display notification, missing notification id!")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            NotificationsManager.processPreviouslySavedNotification(activity, notificationId)
        }
    }
}
