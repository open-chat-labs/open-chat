package com.ocplugin.app.commands

import android.app.Activity
import app.tauri.plugin.Invoke
import com.ocplugin.app.OCPluginCompanion

@Suppress("UNUSED")
class SvelteReady(private val activity: Activity) {

    fun handler(invoke: Invoke) {
        OCPluginCompanion.svelteReady = true
    }
}
