package com.ocplugin.app.calls

import android.content.Context
import android.os.PowerManager
import android.util.Log
import com.ocplugin.app.LOG_TAG

// Darkens the screen against the ear during a voice call (#9559 invariant 6). Held and
// released from ProximityRule's answer, never from an activity's lifecycle, so a call that
// moves to the background keeps the right state.
object CallProximity {
    private var lock: PowerManager.WakeLock? = null

    @Synchronized
    fun update(context: Context, active: Boolean, video: Boolean, speaker: Boolean) {
        val wanted = ProximityRule.holdWakeLock(active, video, speaker)
        val current = lock
        if (wanted && current == null) {
            try {
                val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                if (!pm.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) return
                lock = pm.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "oc:call_proximity").also { it.acquire() }
            } catch (e: Exception) {
                Log.w(LOG_TAG, "Proximity lock refused", e)
            }
        } else if (!wanted && current != null) {
            lock = null
            try {
                current.release(PowerManager.RELEASE_FLAG_WAIT_FOR_NO_PROXIMITY)
            } catch (e: Exception) {
                Log.w(LOG_TAG, "Proximity lock release failed", e)
            }
        }
    }
}
