package com.ocplugin.app.calls

import android.media.AudioManager
import android.media.ToneGenerator
import android.util.Log
import com.ocplugin.app.LOG_TAG

// The caller's ringback while a direct call they started rings out (#9559 invariant 14).
// On the voice stream: a media-stream asset plays silently in communication mode.
object CallRingback {
    private var tone: ToneGenerator? = null

    @Synchronized
    fun set(on: Boolean) {
        if (on) {
            if (tone != null) return
            try {
                tone = ToneGenerator(AudioManager.STREAM_VOICE_CALL, VOLUME).also { it.startTone(ToneGenerator.TONE_SUP_RINGTONE) }
            } catch (e: Exception) {
                Log.w(LOG_TAG, "Ringback refused", e)
            }
        } else {
            stop()
        }
    }

    @Synchronized
    fun stop() {
        val current = tone ?: return
        tone = null
        try {
            current.stopTone()
            current.release()
        } catch (e: Exception) {
            Log.w(LOG_TAG, "Ringback stop failed", e)
        }
    }

    private const val VOLUME = 80
}
