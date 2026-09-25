package com.ocplugin.app.calls

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import app.tauri.plugin.JSObject
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.OCPluginCompanion

// The active call (#9559): drives Telecom, the foreground service and the web layer from
// CallSessionState's answers. The web layer says when a call is active and when it ended;
// the phone's surfaces (ongoing notification, headset, Telecom) say hang up, which is told
// to the web layer and applied here at once; and the paths where the web layer is already
// gone (task swiped away, activity destroyed) end everything natively.
object CallSession {
    val state = CallSessionState()

    private val main = Handler(Looper.getMainLooper())
    private var stopTimer: Runnable? = null

    // The task hosting the call's main activity. A second main activity can live in another
    // task (share target, deep link); only this one's removal ends the call.
    @Volatile
    var ownerTaskId: Int = -1
        private set

    // The web layer joined or started a call.
    fun active(context: Context, call: IncomingCall, video: Boolean, taskId: Int) {
        val now = System.currentTimeMillis()
        if (!state.started(call.id, video, call.title, now)) return
        ownerTaskId = taskId
        cancelStopTimer()
        if (!CallTelecom.activate(call.id)) {
            CallTelecom.placeOutgoing(context, call, video)
        }
        // Voice to the earpiece, video to the speaker, unless a headset is on.
        speaker = video
        CallTelecom.setSpeaker(call.id, speaker, isDefault = true)
        CallProximity.update(context, active = true, video = video, speaker = speaker)
        CallPip.update(active = true, video = video)
        CallForegroundService.start(context, call, now, sharing = false)
    }

    // The route the call is on, as the platform last reported it for an active call.
    @Volatile
    private var speaker = false

    // A tap on the in-app speaker control.
    fun setSpeaker(context: Context, speaker: Boolean) {
        val current = state.active ?: return
        CallTelecom.setSpeaker(current.id, speaker, isDefault = false)
    }

    // The platform put the call on this route.
    fun routeReflected(context: Context, id: CallId, speaker: Boolean) {
        val current = state.active ?: return
        if (current.id != id) return
        this.speaker = speaker
        CallProximity.update(context, active = true, video = current.video, speaker = speaker)
        OCPluginCompanion.triggerRef(
            "call-control",
            JSObject().put("kind", "route").put("messageId", id.messageId).put("speaker", speaker),
        )
    }

    // The system muted or unmuted the call (a headset button): the web layer applies it to
    // the Daily call. One way: Telecom has no call for an app to set its mute.
    fun muteReported(id: CallId, muted: Boolean) {
        OCPluginCompanion.triggerRef(
            "call-control",
            JSObject().put("kind", "mute").put("messageId", id.messageId).put("muted", muted),
        )
    }

    // The web layer left the call, for whatever reason.
    fun ended(context: Context, id: CallId) {
        when (val ended = state.ended(id, System.currentTimeMillis())) {
            is CallSessionState.Ended.StopAfterGrace -> {
                CallTelecom.end(id, CallRegistry.End.HUNG_UP)
                CallProximity.update(context, active = false, video = false, speaker = false)
                CallPip.update(active = false, video = false)
                armStopTimer(context)
            }
            CallSessionState.Ended.Ignore -> Unit
        }
    }

    // Hang-up from a native surface. The web layer is told so it leaves the Daily call; the
    // native side does not wait for it.
    fun hangUp(context: Context, id: CallId, source: String) {
        Log.i(LOG_TAG, "Hang-up from $source for ${id.messageId}")
        OCPluginCompanion.triggerRef(
            "call-control",
            JSObject().put("kind", "hangup").put("messageId", id.messageId).put("source", source),
        )
        ended(context, id)
    }

    // The web layer is gone: end whatever is live, now.
    fun endAll(context: Context) {
        state.endAll(System.currentTimeMillis())
        cancelStopTimer()
        CallProximity.update(context, active = false, video = false, speaker = false)
        CallPip.update(active = false, video = false)
        CallTelecom.endAll(CallRegistry.End.HUNG_UP)
        CallForegroundService.stop(context)
        ownerTaskId = -1
    }

    fun ownerTaskAlive(context: Context): Boolean = CallForegroundService.taskAlive(context, ownerTaskId)

    private fun armStopTimer(context: Context) {
        cancelStopTimer()
        val timer = Runnable {
            stopTimer = null
            if (state.shouldStop(System.currentTimeMillis())) {
                CallForegroundService.stop(context)
                ownerTaskId = -1
            }
        }
        stopTimer = timer
        main.postDelayed(timer, CallSessionState.STOP_GRACE_MS)
    }

    private fun cancelStopTimer() {
        stopTimer?.let { main.removeCallbacks(it) }
        stopTimer = null
    }
}
