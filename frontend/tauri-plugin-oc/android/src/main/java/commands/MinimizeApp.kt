package com.ocplugin.app.commands

import android.app.Activity
import app.tauri.plugin.Invoke

@Suppress("UNUSED")
class MinimizeApp(private val activity: Activity) {

    fun handler(invoke: Invoke) {
        activity.moveTaskToBack(true)
        invoke.resolve()
    }
}
