package com.ocplugin.app

import android.util.Log
import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import com.ocplugin.app.commands.OpenUrl
import com.ocplugin.app.commands.PasskeyAuth
import android.webkit.WebView
import app.tauri.plugin.JSObject


@Suppress("UNUSED")
@TauriPlugin
class OpenChatPlugin(private val activity: Activity) : Plugin(activity) {
    private val passkeyAuth = PasskeyAuth(activity)

    companion object {
        var triggerRef: (event: String, payload: JSObject) -> Unit = {_, _ -> Log.d("TEST_OC", "No trigger")}
    }

    override fun load(webView: WebView) {
        Log.d("TEST_OC", "Plugin load")

         var self = this
         triggerRef = { event, payload ->
            Log.d("TEST_OC", "Running the trigger for event: $event, and payload: $payload")
            self.trigger(event, payload)
         };
    }

    @Command
    fun openUrl(invoke: Invoke) {
        OpenUrl(activity).handler(invoke)
    }

    @Command
    fun signUp(invoke: Invoke) {
        passkeyAuth.handleSignUp(invoke)
    }

    @Command
    fun signIn(invoke: Invoke) {
        passkeyAuth.handleSignIn(invoke)
    }
}
