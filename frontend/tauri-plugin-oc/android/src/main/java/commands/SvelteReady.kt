package com.ocplugin.app.commands

import android.app.Activity
import app.tauri.plugin.Invoke
import com.ocplugin.app.OpenChatPlugin

@Suppress("UNUSED")
class SvelteReady(private val activity: Activity) {

    fun handler(invoke: Invoke) {
        OpenChatPlugin.svelteReady = true
    }
}
