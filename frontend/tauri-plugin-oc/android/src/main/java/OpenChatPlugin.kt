package com.ocplugin.app

import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.util.Log
import android.webkit.WebView
import androidx.annotation.DrawableRes
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.ocplugin.app.commands.*

@Suppress("UNUSED")
@TauriPlugin
class OpenChatPlugin(private val activity: Activity) : Plugin(activity) {
    private val passkeyAuth = PasskeyAuth(activity)

    companion object {
        // Fire Svelte handled event
        //
        // We can use this function anywhere in our codebase to fire a JS event, that will get
        // handled by our Svelte code, and pass any data as JSON payload!
        var triggerRef: (event: String, payload: JSObject) -> Unit = { event, payload ->
            eventQueue.add(Pair(event, payload.toString()))
        }

        // Flush any init event
        //
        // This is a queue for any event that might have fired while the UI was initialised. This
        // queue is flushed when the Svelte code reports that it's ready to process events.
        var eventQueue = mutableListOf<Pair<String, String>>()
        var flushQueuedEvents: () -> Unit = {
            Log.d("TEST_OC", "Flushing queued events")
            eventQueue.forEach { (event, payload) ->
                triggerRef(event, JSObject(payload))
            }
            eventQueue.clear()
        }

        // FCM token, identifies this device for any push notifications from the Firebase service
        var fcmToken: String? = null

        // Indicates that the UI is ready!
        var svelteReady: Boolean = false

        // Reference to the notification manager!
        //
        // Notifications manager is used to register new notifications, and cancel existing ones.
        // Initialised as singleton, to make it a bit more convenient to use.
        var notificationsManager: NotificationManager? = null
        val getNotificationsManager: (context: Context) -> NotificationManager = { context ->
            if (notificationsManager == null) {
                notificationsManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            }
            notificationsManager!!
        }

        // Small notification icon, passed in from the MainActivity! Main activity has a drawable
        // res resource handle to it. Used by NotificationsHelper when displaying notifications.
        @DrawableRes var icNotificationSmall: Int = android.R.drawable.ic_dialog_info
    }

    // Called when the plugin is loaded.
    //
    // Initialise any values that may be required while the app is running.
    override fun load(webView: WebView) {
        var self = this

        // Init the trigger fn!
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

    @Command
    fun releaseNotifications(invoke: Invoke) {
        ReleaseNotifications(activity).handler(invoke)
    }
}
