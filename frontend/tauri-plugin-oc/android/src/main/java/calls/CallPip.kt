package com.ocplugin.app.calls

import android.app.Activity
import android.app.PictureInPictureParams
import android.os.Build
import android.util.Log
import android.util.Rational
import android.webkit.WebView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import app.tauri.plugin.JSObject
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.OCPluginCompanion
import java.lang.ref.WeakReference

// Picture in picture for a video call (N14, #10382), which #9559 left out while calls ran in
// Daily's prebuilt frame: the frame keeps the other person's video to itself, so a tile could
// only show the whole call scaled down. The new UI draws calls itself, and arms it: the shell
// never does so on its own, so the old UI's frame calls never shrink into a tile.
//
// Armed only while the web layer asks and the active call is video; a voice call leaving the
// app leaves only the ongoing-call notification. Android 12+ enters by itself when the user
// leaves the app; 8 to 11 enter from onUserLeaveHint. Entry and exit go to the web layer, which
// shows the call full bleed. Entered with no call (the call ended as the user left), or a call
// ending in the tile, the task goes to the back, which closes the tile. The end can be reported
// from anywhere (the notification's hang-up runs in a receiver), so the tile is closed through
// the activity the web layer armed, held here, never through the reporter's context.
object CallPip {
    // What picture in picture acts on: the app's activity (a fake in tests).
    interface Window {
        val inPip: Boolean
        fun arm(on: Boolean)
        fun close()
    }

    private class ActivityWindow(activity: Activity) : Window {
        private val ref = WeakReference(activity)

        override val inPip: Boolean
            get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && ref.get()?.isInPictureInPictureMode == true

        override fun arm(on: Boolean) {
            ref.get()?.setPictureInPictureParams(
                PictureInPictureParams.Builder()
                    .setAspectRatio(ASPECT)
                    .setAutoEnterEnabled(on)
                    .setSeamlessResizeEnabled(false)
                    .build(),
            )
        }

        override fun close() {
            ref.get()?.moveTaskToBack(true)
        }
    }

    @Volatile
    private var window: Window? = null

    fun attach(window: Window?) {
        this.window = window
    }

    // 3:5, a portrait tile for a phone's call
    private val ASPECT = Rational(3, 5)

    @Volatile
    private var requested = false

    // Pure: whether picture in picture is armed for this state.
    fun armed(requested: Boolean, active: CallSessionState.Active?): Boolean =
        requested && active != null && active.video

    // Pure: how it's entered on this release, if armed: by the platform (12+), from the leave
    // hint (8 to 11), or not at all (below 8, which has no picture in picture).
    enum class Entry { AUTO, LEAVE_HINT, NONE }

    fun entry(sdk: Int): Entry = when {
        sdk >= Build.VERSION_CODES.S -> Entry.AUTO
        sdk >= Build.VERSION_CODES.O -> Entry.LEAVE_HINT
        else -> Entry.NONE
    }

    private fun isArmed() = armed(requested, CallSession.state.active)

    // The web layer's ask: a video call it draws is up (true), or not (false).
    fun request(activity: Activity, on: Boolean) {
        window = ActivityWindow(activity)
        requested = on
        refresh()
    }

    // The call ended, reported from wherever: disarmed, and a tile showing it closes.
    fun callEnded() {
        requested = false
        refresh()
        val w = window ?: return
        if (w.inPip) w.close()
    }

    private fun refresh() {
        if (entry(Build.VERSION.SDK_INT) != Entry.AUTO) return
        try {
            window?.arm(isArmed())
        } catch (e: Exception) {
            Log.w(LOG_TAG, "Couldn't set picture in picture params", e)
        }
    }

    // MainActivity.onUserLeaveHint: Android 8 to 11 enter here.
    fun onUserLeaveHint(activity: Activity) {
        if (entry(Build.VERSION.SDK_INT) != Entry.LEAVE_HINT || !isArmed()) return
        try {
            activity.enterPictureInPictureMode(PictureInPictureParams.Builder().setAspectRatio(ASPECT).build())
        } catch (e: Exception) {
            Log.w(LOG_TAG, "Couldn't enter picture in picture", e)
        }
    }

    // Pure: whether the WebView keeps drawing through an activity pause. It is the tile in picture
    // in picture, which pauses the activity; wry pauses the WebView on every pause, freezing it.
    fun drawsWhilePaused(inPip: Boolean): Boolean = inPip

    // What the WebView does as the tile opens or closes: resumed when it opens (an automatic entry
    // on 12+ reports the mode after the pause, so onPaused alone misses it), paused when it closes
    // into the background, as wry would have.
    enum class Draw { RESUME, PAUSE, KEEP }

    fun drawOnModeChange(inPip: Boolean, resumed: Boolean): Draw = when {
        inPip -> Draw.RESUME
        !resumed -> Draw.PAUSE
        else -> Draw.KEEP
    }

    // MainActivity.onPause, after wry's: a pause that is already the tile (8 to 11) resumes the
    // WebView drawing it.
    fun onPaused(activity: Activity, webView: WebView?) {
        if (drawsWhilePaused(activity.isInPictureInPictureMode)) webView?.onResume()
    }

    // MainActivity.onPictureInPictureModeChanged.
    fun onModeChanged(activity: Activity, inPip: Boolean, webView: WebView?) {
        when (drawOnModeChange(inPip, (activity as? LifecycleOwner).isResumed())) {
            Draw.RESUME -> webView?.onResume()
            Draw.PAUSE -> webView?.onPause()
            Draw.KEEP -> Unit
        }
        val active = CallSession.state.active
        if (inPip && active == null) {
            activity.moveTaskToBack(true)
            return
        }
        active ?: return
        OCPluginCompanion.triggerRef(
            "call-control",
            JSObject().put("kind", "pip").put("messageId", active.id.messageId).put("on", inPip),
        )
    }
}

private fun LifecycleOwner?.isResumed(): Boolean =
    this?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.RESUMED) == true
