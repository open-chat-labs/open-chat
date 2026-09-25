package com.ocplugin.app.calls

import android.app.Activity
import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.app.RemoteAction
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.util.Log
import android.os.Handler
import android.os.Looper
import android.util.Rational
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import app.tauri.plugin.JSObject
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.OCPluginCompanion
import com.ocplugin.app.R
import java.lang.ref.WeakReference

// Picture in picture for video calls (#9559 invariant 9). Armed only while a video call is
// active, from PipRule's answer: auto-enter on Android 12+, an explicit enter on leaving
// the app before that. Entry and exit are reported to the web layer, which switches the
// call view to a full-bleed layout. A voice call never enters; a call ending in the tile
// sends the task to the back, which closes it.
object CallPip {
    private var activity = WeakReference<Activity>(null)

    @Volatile
    private var armed = false

    @Volatile
    var inPip = false
        private set

    // The call the tile is for: its hang-up action names it.
    @Volatile
    private var call: IncomingCall? = null

    fun attach(activity: Activity) {
        this.activity = WeakReference(activity)
    }

    fun update(active: Boolean, video: Boolean, call: IncomingCall? = null) {
        if (call != null) this.call = call
        val wanted = PipRule.armed(active, video)
        if (wanted == armed) {
            if (!wanted && inPip) leaveTile()
            return
        }
        armed = wanted
        val activity = activity.get() ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                activity.setPictureInPictureParams(params(wanted))
            } catch (e: Exception) {
                Log.w(LOG_TAG, "PiP params refused", e)
            }
        }
        if (!wanted && inPip) leaveTile()
    }

    // Before Android 12 there is no auto-enter; the app entering the background is the cue.
    fun onUserLeaveHint(activity: Activity) {
        if (!armed || Build.VERSION.SDK_INT >= Build.VERSION_CODES.S || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        try {
            activity.enterPictureInPictureMode(params(true))
        } catch (e: Exception) {
            Log.w(LOG_TAG, "PiP enter refused", e)
        }
    }

    fun changed(activity: Activity, isInPip: Boolean) {
        inPip = isInPip
        OCPluginCompanion.triggerRef("pip-changed", JSObject().put("active", isInPip))
        // Entered with nothing to show: the tile would be an empty app. Leave it.
        if (isInPip && !armed) activity.moveTaskToBack(true)
        // Left the tile without the app coming back on screen: the user closed the tile,
        // which is a hang-up (found on the device: the call carried on behind it).
        if (!isInPip && armed) {
            Handler(Looper.getMainLooper()).postDelayed({
                val lifecycle = (activity as? LifecycleOwner)?.lifecycle
                val onScreen = lifecycle?.currentState?.isAtLeast(Lifecycle.State.STARTED) ?: !activity.isFinishing
                if (!onScreen) {
                    CallSession.state.active?.let { CallSession.hangUp(activity, it.id, "pip-dismissed") }
                }
            }, DISMISS_CHECK_MS)
        }
    }

    const val DISMISS_CHECK_MS = 700L

    private fun leaveTile() {
        val activity = activity.get() ?: return
        try {
            activity.moveTaskToBack(true)
        } catch (e: Exception) {
            Log.w(LOG_TAG, "PiP leave refused", e)
        }
    }

    private fun params(autoEnter: Boolean): PictureInPictureParams {
        val builder = PictureInPictureParams.Builder().setAspectRatio(Rational(3, 5))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setAutoEnterEnabled(autoEnter)
        // The tile's one control: hang up, through the same receiver as the notification.
        val activity = activity.get()
        val call = call
        if (autoEnter && activity != null && call != null) {
            val hangUp = PendingIntent.getBroadcast(
                activity,
                CallForegroundService.NOTIFICATION_ID + 1,
                Intent(activity, CallActionReceiver::class.java).apply {
                    action = CallForegroundService.ACTION_HANG_UP
                    putExtras(call.toBundle())
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            builder.setActions(
                listOf(RemoteAction(Icon.createWithResource(activity, R.drawable.ic_call_end), "Hang up", "Hang up", hangUp)),
            )
        }
        return builder.build()
    }
}
