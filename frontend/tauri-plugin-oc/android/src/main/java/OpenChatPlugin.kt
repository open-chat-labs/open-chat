package com.ocplugin.app

import android.app.Activity
import android.util.Log
import android.webkit.WebView
import androidx.annotation.DrawableRes
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.ocplugin.app.commands.OpenUrl
import com.ocplugin.app.commands.PasskeyAuth
import com.ocplugin.app.commands.ShowNotification
import com.ocplugin.app.commands.SvelteReady

@Suppress("UNUSED")
@TauriPlugin
class OpenChatPlugin(private val activity: Activity) : Plugin(activity) {
    private val passkeyAuth = PasskeyAuth(activity)

    companion object {
        var triggerRef: (event: String, payload: JSObject) -> Unit = { event, payload ->
            eventQueue.add(Pair(event, payload.toString()))
        }

        var flushQueuedEvents: () -> Unit = {
            Log.d("TEST_OC", "Flushing queued events")
            eventQueue.forEach { (event, payload) ->
                triggerRef(event, JSObject(payload))
            }
            eventQueue.clear()
        }

        var eventQueue = mutableListOf<Pair<String, String>>()
        var fcmToken: String? = null
        var svelteReady: Boolean = false
        @DrawableRes var icNotificationSmall: Int = android.R.drawable.ic_dialog_info
    }

    override fun load(webView: WebView) {
        var self = this
        triggerRef = { event, payload ->
            if (svelteReady) {
                self.trigger(event, payload)
            } else {
                eventQueue.add(Pair(event, payload.toString()))
            }
        }
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

    @Command
    fun getFcmToken(invoke: Invoke) {
        invoke.resolve(JSObject().put("fcmToken", fcmToken))
    }

    @Command
    fun showNotification(invoke: Invoke) {
        ShowNotification(activity).handler(invoke)
    }

    @Command
    fun svelteReady(invoke: Invoke) {
        SvelteReady(activity).handler(invoke)
        flushQueuedEvents()
    }
}
