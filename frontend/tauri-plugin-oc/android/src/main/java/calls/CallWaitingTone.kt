package com.ocplugin.app.calls

import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.ocplugin.app.LOG_TAG

// The call waiting beep: a short tone every few seconds while a call waits and this device
// is in another one. A ToneGenerator on the voice call stream, not a notification sound:
// the call holds the audio in communication mode, where the voice call stream is the one
// that is audible and follows the call's route (earpiece, speaker or headset), and a tone
// generator plays without asking for audio focus, which Android 15+ refuses to a process
// that is not on screen. Telecom plays no call waiting tone for a self-managed call.
object CallWaitingTone {
    private const val BEAT_MS = 3_500L
    // Under the voice it plays over.
    private const val VOLUME = 70

    private val main = Handler(Looper.getMainLooper())
    private var tone: ToneGenerator? = null
    private var beating = false

    // Starts the beat when a call waits, stops it when none does. Any thread.
    fun update() {
        main.post {
            if (CallRinger.registry.anyWaiting()) {
                if (!beating) {
                    beating = true
                    main.post(beat)
                }
            } else {
                stop()
            }
        }
    }

    private val beat = object : Runnable {
        override fun run() {
            if (!CallRinger.registry.anyWaiting()) {
                stop()
                return
            }
            // A call that ends while another waits leaves nothing to beep over.
            if (CallSession.state.active != null) beep() else release()
            main.postDelayed(this, BEAT_MS)
        }
    }

    private fun beep() {
        val generator = tone ?: try {
            ToneGenerator(AudioManager.STREAM_VOICE_CALL, VOLUME).also { tone = it }
        } catch (e: RuntimeException) {
            // The platform's tone slots are taken; the next beat tries again.
            Log.w(LOG_TAG, "Call waiting tone unavailable", e)
            return
        }
        // Each start replaces the last, so only the pattern's first short beep is heard.
        if (!generator.startTone(ToneGenerator.TONE_SUP_CALL_WAITING)) Log.w(LOG_TAG, "Call waiting tone refused")
    }

    private fun stop() {
        main.removeCallbacks(beat)
        beating = false
        release()
    }

    private fun release() {
        val generator = tone ?: return
        tone = null
        try {
            generator.stopTone()
        } catch (_: RuntimeException) {
        } finally {
            // An unreleased generator holds its tone slot for good.
            try {
                generator.release()
            } catch (_: RuntimeException) {
            }
        }
    }
}
