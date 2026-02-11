package com.ocplugin.app.commands

import android.app.Activity
import android.content.Intent
import app.tauri.plugin.Invoke
import kotlin.system.exitProcess

class RestartApp(private val activity: Activity) {
    fun handler(invoke: Invoke) {
        val packageManager = activity.packageManager
        val intent = packageManager.getLaunchIntentForPackage(activity.packageName)
        val componentName = intent?.component
        val mainIntent = Intent.makeRestartActivityTask(componentName)
        activity.startActivity(mainIntent)
        exitProcess(0)
    }
}
