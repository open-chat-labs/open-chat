package com.ocplugin.app

import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.util.Log
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.firebase.messaging.FirebaseMessaging
import com.ocplugin.app.commands.*

@Suppress("UNUSED")
@TauriPlugin
class OpenChatPlugin(private val activity: Activity) : Plugin(activity) {
    private val passkeyAuth = PasskeyAuth(activity)

    // Called when the plugin is loaded.
    //
    // Initialise any values that may be required while the app is running.
    override fun load(webView: WebView) {

        // Init notifications channel (if it's not been initialised before)
        NotificationsChannel.createMainChannel(activity)

        // TODO summary notification requires a bit more testing
        // NotificationsChannel.createSummaryChannel(activity)

        // Init the trigger fn!
        OCPluginCompanion.setTriggerRef(this)

        // Init FCM token cache, have it populated with a token!
        OCPluginCompanion.initFcmTokenCache()
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
        invoke.resolve(JSObject().put("fcmToken", OCPluginCompanion.fcmToken))
    }

    @Command
    fun showNotification(invoke: Invoke) {
        ShowNotification(activity).handler(invoke)
    }

    @Command
    fun svelteReady(invoke: Invoke) {
        SvelteReady(activity).handler(invoke)
        OCPluginCompanion.flushQueuedEvents()
    }

    @Command
    fun releaseNotifications(invoke: Invoke) {
        ReleaseNotifications(activity).handler(invoke)
    }
}

object OCPluginCompanion {

    // Indicates that the UI is ready!
    var svelteReady: Boolean = false

    // FCM token cache!
    //
    // Creates cache for the FCM token.
    var fcmToken: String? = null

    fun initFcmTokenCache() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                Log.e(LOG_TAG, "Fetching FCM registration token failed", task.exception)
                return@addOnCompleteListener
            }

            // Get FCM token
            val token = task.result
            Log.d(LOG_TAG, "FCM Token: $token")

            // Cache token locally so that we can query it!
            fcmToken = token
        }
    }

    // Cache new token
    //
    // Once the Firebase service reports a new token, we cache it, and send it to the UI.
    fun cacheNewFcmToken(token: String) {
        fcmToken = token
        triggerRef("fcm-token-refresh", JSObject().apply { put("fcmToken", token) })
        Log.d(LOG_TAG, "FCM token refreshed: $token")
    }

    // Fire Svelte handled event
    //
    // We can use this function anywhere in our codebase to fire a JS event, that will get
    // handled by our Svelte code, and pass any data as JSON payload!
    var triggerRef: (event: String, payload: JSObject) -> Unit = { event, payload ->
        eventQueue.add(Pair(event, payload.toString()))
    }

    fun setTriggerRef(plugin: OpenChatPlugin) {
        triggerRef = { event, payload ->
            if (svelteReady) {
                Log.d(LOG_TAG, "FIRE EVENT: $event, $payload")
                plugin.trigger(event, payload)
            } else {
                Log.d(LOG_TAG, "ADD EVENT TO QUEUE: $event, $payload")
                eventQueue.add(Pair(event, payload.toString()))
            }
        }
    }

    // Events queue!
    //
    // This is a queue for any event that might have fired while the UI was initialising. The
    // queue is flushed when the Svelte code reports that it's ready to process events.
    var eventQueue = mutableListOf<Pair<String, String>>()

    fun flushQueuedEvents() {
        if (svelteReady) {
            Log.d(LOG_TAG, "Flushing queued events")
            eventQueue.forEach { (event, payload) -> triggerRef(event, JSObject(payload)) }
            eventQueue.clear()
        } else {
            Log.e(LOG_TAG, "Svelte is not ready yet! Trying to flush queued events.")
        }
    }

    // Reference to the notification manager!
    //
    // Notifications manager is used to register new notifications, and cancel existing ones.
    // Initialised as singleton, to make it a bit more convenient to use.
    var notificationsManager: NotificationManager? = null

    fun getNotificationsManager(context: Context): NotificationManager {
        if (notificationsManager == null) {
            notificationsManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        }

        return notificationsManager!!
    }
}