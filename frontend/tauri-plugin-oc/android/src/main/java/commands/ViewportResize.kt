package com.ocplugin.app.commands

import android.app.Activity
import android.util.Log
import app.tauri.plugin.Invoke
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.OCPluginCompanion

@Suppress("UNUSED")
class ViewportResize(private val activity: Activity) {

    fun enable(invoke: Invoke) {
        Log.d(LOG_TAG, ">>>> ENABLE VIEWPORT RESIZE")
        OCPluginCompanion.viewportResizeEnabled = true
        invoke.resolve()
    }

    fun disable(invoke: Invoke) {
        Log.d(LOG_TAG, "<<<< DISABLE VIEWPORT RESIZE")
        OCPluginCompanion.viewportResizeEnabled = false;
        invoke.resolve()
    }
}