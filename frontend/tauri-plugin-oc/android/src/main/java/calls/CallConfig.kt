package com.ocplugin.app.calls

import android.content.Context

// What the shell needs from the web layer to act on a call without the app running.
// Written by the `set_call_config` command on every app start, read by the decline path.
object CallConfig {
    private const val PREFS = "oc_call_config"
    private const val KEY_VIDEO_BRIDGE_URL = "video_bridge_url"

    fun set(context: Context, videoBridgeUrl: String?) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_VIDEO_BRIDGE_URL, videoBridgeUrl?.trimEnd('/')?.ifBlank { null })
            .apply()
    }

    fun videoBridgeUrl(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_VIDEO_BRIDGE_URL, null)
}
