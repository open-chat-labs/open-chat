package com.ocplugin.app.calls

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import app.tauri.plugin.JSObject
import com.ocplugin.app.AvatarHelper
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.NotificationsManager
import com.ocplugin.app.OCPluginCompanion
import com.ocplugin.app.data.AppDb
import com.ocplugin.app.data.BodyType
import com.ocplugin.app.data.Notification
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet

// Drives a ring from the registry's decisions: Telecom, the notification (which carries
// the ringtone), the window timer, the missed call, and the parked answer for the web layer.
object CallRinger {
    val registry = CallRegistry()

    private val main = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val timeouts = HashMap<CallId, Runnable>()
    private val avatars = ConcurrentHashMap<CallId, Bitmap>()
    const val AVATAR_WAIT_MS = 1_500L

    // The ring activity listens so a dismissal while it is on screen closes it.
    val listeners = CopyOnWriteArraySet<(CallId, CallRegistry.End) -> Unit>()

    // True when the push was consumed here: it rang, or it was a missed call. False hands
    // the push back to the ordinary notification path.
    suspend fun onStarted(context: Context, notification: Notification, facts: CallFacts): Boolean {
        val call = IncomingCall.of(notification, facts) ?: return false
        return when (val decision = registry.started(call, System.currentTimeMillis())) {
            is CallRegistry.Started.Ring -> {
                // The ring notification is posted once and never updated, so the avatar
                // is fetched first, briefly.
                call.avatarUrl?.let { url ->
                    withTimeoutOrNull(AVATAR_WAIT_MS) { AvatarHelper.loadBitmap(context, url) }
                }?.let { avatars[call.id] = it }
                ring(context, decision.call, decision.deadline)
                true
            }
            is CallRegistry.Started.Missed -> {
                postMissed(context, decision.call)
                true
            }
            CallRegistry.Started.Ignore -> true
        }
    }

    fun onDismissal(context: Context, dismissal: CallDismissal) {
        val call = registry.ringing(dismissal.id)
        val end = registry.dismissed(dismissal) ?: return
        finish(context, dismissal.id, end, call)
    }

    // The answer for the call in the notification's own extras is handed to the web
    // layer whether or not the call is still ringing here: a tap on a stale notification
    // (answered elsewhere, ended, or a fresh process after a reap) still means "open the
    // call", and the web layer finds out from the canister whether it is still on.
    fun accept(context: Context, call: IncomingCall) {
        val known = registry.ringing(call.id)
        val end = registry.accepted(call.id)
        if (end == null) {
            IncomingCallNotifications.cancelRing(context, call.id)
        } else {
            finish(context, call.id, end, known ?: call)
        }
        deliver(context, CallAction.Accept(call.id, call.kind))
    }

    fun decline(context: Context, id: CallId) {
        val call = registry.ringing(id)
        val end = registry.declined(id)
        if (end == null) {
            IncomingCallNotifications.cancelRing(context, id)
        } else {
            finish(context, id, end, call)
        }
    }

    // The web layer joined this call from inside the app while it rang here.
    fun ringHandled(context: Context, messageId: String) {
        val id = registry.joinedInApp(messageId) ?: return
        finish(context, id, CallRegistry.End.ANSWERED_HERE, null)
    }

    // The one way the ring notification gets posted. At most once per call.
    fun showRing(context: Context, call: IncomingCall) {
        if (registry.shouldPostRing(call.id)) IncomingCallNotifications.postRing(context, call, avatars[call.id])
    }

    // The ringing call for a Telecom address, for a connection request whose extras
    // did not survive the trip through Telecom.
    fun ringingFor(context: Context, address: String?): IncomingCall? {
        val chat = CallHandleDirectory.chat(context, address) ?: return null
        return registry.ringingCalls().firstOrNull { it.id.chat == chat }
    }

    fun telecomRefused(context: Context, call: IncomingCall) = showRing(context, call)

    fun redial(context: Context, chat: CallChat) {
        deliver(context, CallAction.Start(chat, CallKind.VIDEO))
    }

    private fun ring(context: Context, call: IncomingCall, deadline: Long) {
        main.post {
            val timeout = Runnable { onTimeout(context, call.id) }
            timeouts[call.id] = timeout
            main.postDelayed(timeout, (deadline - System.currentTimeMillis()).coerceAtLeast(0))
        }
        if (!CallTelecom.reportIncoming(context, call)) showRing(context, call)
    }

    private fun onTimeout(context: Context, id: CallId) {
        val call = registry.ringing(id)
        registry.timedOut(id)?.let { finish(context, id, it, call) }
    }

    private fun finish(context: Context, id: CallId, end: CallRegistry.End, call: IncomingCall?) {
        main.post { timeouts.remove(id)?.let { main.removeCallbacks(it) } }
        IncomingCallNotifications.cancelRing(context, id)
        avatars.remove(id)
        CallTelecom.end(id, end)
        listeners.forEach { it(id, end) }
        if (end.postsMissedCall && call != null) postMissed(context, call)
    }

    // The ordinary message notification for the chat, reading "Missed call", so the tap
    // opens the chat through the path every notification tap takes.
    // TODO i18n
    private fun postMissed(context: Context, call: IncomingCall) {
        val n = call.notification ?: return
        scope.launch {
            try {
                val missed = n.copy(
                    id = 0L,
                    body = if (call.callerName != null) "Missed call from ${call.callerName}" else "Missed call",
                    bodyType = BodyType.MESSAGE,
                    messageType = null,
                    image = null,
                    fileName = null,
                )
                val rowId = AppDb.get().notificationDao().insert(missed)
                NotificationsManager.notifyMessageStyleNotification(context, missed.copy(id = rowId))
            } catch (e: Exception) {
                Log.e(LOG_TAG, "Failed to post the missed call notification", e)
            }
        }
    }

    // Hands the action to the web layer: a live event when it is ready, else parked for
    // it to drain once it is. Then brings the main activity forward.
    private fun deliver(context: Context, action: CallAction) {
        val payload = JSObject().apply {
            put("kind", if (action is CallAction.Accept) "accept" else "start")
            put("chatType", action.chat.chatType)
            put("chatId", action.chat.chatId)
            action.chat.communityId?.let { put("communityId", it) }
            if (action is CallAction.Accept) put("messageId", action.id.messageId)
            put("callType", action.kind.wire)
        }
        if (OCPluginCompanion.svelteReady) {
            OCPluginCompanion.triggerRef("call-action", payload)
        } else {
            OCPluginCompanion.pendingCallAction = payload.toString()
        }
        try {
            val mainActivity = Class.forName("${context.packageName}.MainActivity")
            context.startActivity(Intent(context, mainActivity).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            })
        } catch (e: Exception) {
            // Background activity start refused. The action stays parked for the next
            // launch.
            Log.e(LOG_TAG, "Could not bring the main activity forward", e)
        }
    }
}
