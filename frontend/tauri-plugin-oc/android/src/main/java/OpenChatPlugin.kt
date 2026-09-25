package com.ocplugin.app

import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.firebase.messaging.FirebaseMessaging
import com.ocplugin.app.calls.CallChat
import com.ocplugin.app.calls.CallConfig
import com.ocplugin.app.calls.CallId
import com.ocplugin.app.calls.CallKind
import com.ocplugin.app.calls.CallPip
import com.ocplugin.app.calls.CallRingback
import com.ocplugin.app.calls.CallSession
import com.ocplugin.app.calls.IncomingCall
import com.ocplugin.app.calls.CallRinger
import com.ocplugin.app.calls.CallTelecom
import com.ocplugin.app.calls.IncomingCallNotifications
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
        NotificationsChannel.createSummaryChannel(activity)
        IncomingCallNotifications.createChannel(activity)
        CallTelecom.ensureRegistered(activity)
        CallPip.attach(activity)

        // Init the trigger fn!
        OCPluginCompanion.setTriggerRef(this)

        // Init FCM token cache, have it populated with a token!
        OCPluginCompanion.initFcmTokenCache()

        // Sweep shared files older than 24h out of the app cache. Runs on a
        // background thread, so this doesn't block the activity launch.
        ShareIntentManager.cleanupStaleShares(activity)
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

    @Command
    fun clearAllNotifications(invoke: Invoke) {
        ClearAllNotifications(activity).handler(invoke)
    }

    @Command
    fun deleteFcmToken(invoke: Invoke) {
        DeleteFcmToken().handler(invoke)
    }

    @Command
    fun minimizeApp(invoke: Invoke) {
        MinimizeApp(activity).handler(invoke)
    }

    @Command
    fun restartApp(invoke: Invoke) {
        RestartApp(activity).handler(invoke)
    }

    @Command
    fun loadRecentMedia(invoke: Invoke) {
        val media = LoadRecentMedia(activity)
        if (media.checkPermissionGranted()) {
            media.handler(invoke)
        } else {
            // Save the intent reference, so that we can use it once we get a response from the
            // permission request within the Main activity. At that point we call the
            // OCPluginCompanion.resolvePermissionsGranted function.
            OCPluginCompanion.pendingMediaInvoke = invoke
            media.askForPermission()
        }
    }

    @Command
    fun enableViewportResize(invoke: Invoke) {
        ViewportResize(activity).enable(invoke)
    }

    @Command
    fun disableViewportResize(invoke: Invoke) {
        ViewportResize(activity).disable(invoke)
    }

    @Command
    fun updateChatShortcuts(invoke: Invoke) {
        UpdateChatShortcuts(activity).handler(invoke)
    }

    @Command
    fun getPendingDeepLink(invoke: Invoke) {
        val url = OCPluginCompanion.pendingDeepLinkUrl
        OCPluginCompanion.pendingDeepLinkUrl = null
        if (url != null) {
            invoke.resolve(JSObject().put("url", url))
        } else {
            invoke.resolve(JSObject())
        }
    }

    @Command
    fun getPendingNotificationTap(invoke: Invoke) {
        val payload = OCPluginCompanion.pendingNotificationTap
        OCPluginCompanion.pendingNotificationTap = null
        if (payload != null) {
            invoke.resolve(JSObject().put("payload", payload))
        } else {
            invoke.resolve(JSObject())
        }
    }

    @Command
    fun getPendingCallAction(invoke: Invoke) {
        val payload = OCPluginCompanion.takePendingCallAction()
        if (payload != null) {
            invoke.resolve(JSObject().put("payload", payload))
        } else {
            invoke.resolve(JSObject())
        }
    }

    @Command
    fun callRingHandled(invoke: Invoke) {
        val args = invoke.parseArgs(CallRingHandledArgs::class.java)
        args.messageId?.let { CallRinger.ringHandled(activity, it) }
        invoke.resolve()
    }

    @Command
    fun setCallConfig(invoke: Invoke) {
        val args = invoke.parseArgs(SetCallConfigArgs::class.java)
        CallConfig.set(activity, args.videoBridgeUrl)
        invoke.resolve()
    }

    // The web layer is in a call (joined or started).
    @Command
    fun callActive(invoke: Invoke) {
        val args = invoke.parseArgs(CallActiveArgs::class.java)
        val chatType = args.chatType
        val chatId = args.chatId
        val messageId = args.messageId
        if (chatType == null || chatId == null || messageId == null) {
            invoke.reject("chatType, chatId and messageId are required")
            return
        }
        val call = IncomingCall(
            id = CallId(CallChat(chatType, chatId, args.communityId), messageId),
            kind = if (args.video) CallKind.VIDEO else CallKind.AUDIO,
            started = System.currentTimeMillis(),
            title = args.title ?: "",
            callerName = null,
            avatarUrl = null,
        )
        CallSession.active(activity, call, args.video, activity.taskId)
        invoke.resolve()
    }

    // The in-app speaker control.
    @Command
    fun setCallSpeaker(invoke: Invoke) {
        val args = invoke.parseArgs(SetCallSpeakerArgs::class.java)
        CallSession.setSpeaker(activity, args.speaker)
        invoke.resolve()
    }

    // The caller's ringback while a direct call rings out.
    @Command
    fun setCallRingback(invoke: Invoke) {
        val args = invoke.parseArgs(SetCallRingbackArgs::class.java)
        CallRingback.set(args.on)
        invoke.resolve()
    }

    // The web layer left the call.
    @Command
    fun callEnded(invoke: Invoke) {
        val args = invoke.parseArgs(CallEndedArgs::class.java)
        val chatType = args.chatType
        val chatId = args.chatId
        val messageId = args.messageId
        if (chatType == null || chatId == null || messageId == null) {
            invoke.reject("chatType, chatId and messageId are required")
            return
        }
        CallSession.ended(activity, CallId(CallChat(chatType, chatId, args.communityId), messageId))
        invoke.resolve()
    }
}

@InvokeArg
class CallRingHandledArgs {
    var messageId: String? = null
}

@InvokeArg
class SetCallConfigArgs {
    var videoBridgeUrl: String? = null
}

@InvokeArg
class CallActiveArgs {
    var chatType: String? = null
    var chatId: String? = null
    var communityId: String? = null
    var messageId: String? = null
    var video: Boolean = false
    var title: String? = null
}

@InvokeArg
class SetCallSpeakerArgs {
    var speaker: Boolean = false
}

@InvokeArg
class SetCallRingbackArgs {
    var on: Boolean = false
}

@InvokeArg
class CallEndedArgs {
    var chatType: String? = null
    var chatId: String? = null
    var communityId: String? = null
    var messageId: String? = null
}

object OCPluginCompanion {

    // Indicates that the UI is ready!
    //
    // @Volatile: written by the SvelteReady command and read from the
    // notification-tap handler (see NotificationsManager) on a different thread;
    // without it the store-vs-trigger decision could read a stale value.
    @Volatile
    var svelteReady: Boolean = false

    // Allows the viewport to resize when keyboard pops up
    var viewportResizeEnabled: Boolean = true

    // FCM token cache!
    //
    // Creates cache for the FCM token.
    var fcmToken: String? = null

    // Deep link URL received during cold start (before the WebView was ready).
    // JS pulls this via getPendingDeepLink() once mounted. @Volatile: written on
    // the intent-handling thread, read on the command-invoke thread.
    @Volatile
    var pendingDeepLinkUrl: String? = null

    // Notification tap payload received before the WebView was ready. Taps are
    // NOT sent through the event queue in that case: the queue flushes the
    // moment svelteReady fires, which can beat the async listener registration
    // and silently drop the event. JS pulls this via getPendingNotificationTap()
    // once its listener is in place. @Volatile: written on the tap-handling
    // thread, read on the command-invoke thread.
    @Volatile
    var pendingNotificationTap: String? = null

    // A call answered from the native ring, or a call log redial, received before the
    // WebView was ready. Same rule as the tap above. Written only by CallRinger, which
    // only writes for a call it was ringing or a handle it minted; a launch intent never
    // carries it, so nothing outside this process can put a call here.
    @Volatile
    var pendingCallAction: String? = null

    // Cleared on read, so an answer is delivered once.
    @Synchronized
    fun takePendingCallAction(): String? {
        val payload = pendingCallAction
        pendingCallAction = null
        return payload
    }

    fun initFcmTokenCache() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                // Log.e(LOG_TAG, "Fetching FCM registration token failed", task.exception)
                return@addOnCompleteListener
            }

            // Get FCM token
            val token = task.result
            // Log.d(LOG_TAG, "FCM Token: $token")

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
        // Log.d(LOG_TAG, "FCM token refreshed: $token")
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
            // Log.d(LOG_TAG, "Flushing queued events")
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
            notificationsManager =
                    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        }

        return notificationsManager!!
    }

    // Invoke for media permission request
    var pendingMediaInvoke: Invoke? = null

    // This function is called from MainActivity, and handles results of any permission requests.
    // Each permission request has a unique request code.
    fun resolvePermissionsGranted(activity: Activity, requestCode: Int, grantResults: IntArray) {
        when (requestCode) {
            PERM_CODE_GALLERY -> {
                if (pendingMediaInvoke != null) {
                    if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
                        LoadRecentMedia(activity).handler(pendingMediaInvoke!!)
                    } else {
                        Log.d(LOG_TAG, "@@@ WARNING: Media permission denied!")

                        // Basically tell the UI that the permission was denied!
                        pendingMediaInvoke!!.resolve(
                                JSObject().put("permission", "denied").put("media", JSArray())
                        )
                    }
                } else {
                    Log.d(LOG_TAG, "@@@ ERROR: Media invoke not available!")
                }
            }
        }
    }
}
