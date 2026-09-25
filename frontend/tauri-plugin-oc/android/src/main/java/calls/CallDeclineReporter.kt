package com.ocplugin.app.calls

import android.util.Log
import com.ocplugin.app.LOG_TAG
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.withTimeoutOrNull
import java.net.HttpURLConnection
import java.net.URL

// Tells the video bridge that this user declined, with the token from the ring push. For a
// direct call the bridge ends the call for the caller; for a group call it stops the ring on
// this user's other devices. Bounded in time and never throws: the ring has already ended
// here, and the bridge's answer changes nothing on this device (#9534 invariant 12).
object CallDeclineReporter {
    const val TIMEOUT_MS = 8_000L
    private const val SOCKET_TIMEOUT_MS = 3_000

    // The HTTP call, replaceable under test. Returns the status code.
    @Volatile
    var post: (url: String, token: String, body: String?) -> Int = ::httpPost

    suspend fun report(videoBridgeUrl: String, token: String, timeoutMs: Long = TIMEOUT_MS): Boolean =
        send("$videoBridgeUrl/room/decline", token, timeoutMs)

    // A direct call the phone was in ended natively (task swiped away, activity destroyed):
    // the bridge ends it for the other side too, with the end token the web layer handed
    // over while the call ran. Only a direct call ever has one (#9559 invariant 2).
    suspend fun reportEnd(videoBridgeUrl: String, endToken: String, timeoutMs: Long = TIMEOUT_MS): Boolean =
        send("$videoBridgeUrl/room/end_meeting", endToken, timeoutMs)

    // A group call the phone was in ended natively: the bridge takes the phone out of the
    // room with the participant token the web layer handed over; the call carries on.
    suspend fun reportLeave(videoBridgeUrl: String, participantToken: String, sessionId: String?, timeoutMs: Long = TIMEOUT_MS): Boolean =
        send("$videoBridgeUrl/room/leave", participantToken, timeoutMs, leaveBody(sessionId))

    // The leave names this device's Daily session; without one the bridge ejects only
    // when the user has a single session in the room.
    fun leaveBody(sessionId: String?): String? =
        sessionId?.let { "{\"sessionId\":\"${it.replace("\\", "").replace("\"", "")}\"}" }

    private suspend fun send(url: String, token: String, timeoutMs: Long, body: String? = null): Boolean {
        val status = try {
            // The post runs detached: a cancelled `withContext` would still wait for the
            // blocking call, so the wait is on the deferred instead. The socket timeouts
            // end the lingering thread.
            withTimeoutOrNull(timeoutMs) {
                CoroutineScope(Dispatchers.IO).async { post(url, token, body) }.await()
            }
        } catch (e: Exception) {
            Log.w(LOG_TAG, "Decline report failed", e)
            null
        }
        if (status == null || status !in 200..299) {
            Log.w(LOG_TAG, "Decline report not accepted: $status")
            return false
        }
        return true
    }

    private fun httpPost(url: String, token: String, body: String?): Int {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = SOCKET_TIMEOUT_MS
            connection.readTimeout = SOCKET_TIMEOUT_MS
            connection.setRequestProperty("x-auth-jwt", token)
            val bytes = body?.toByteArray(Charsets.UTF_8) ?: ByteArray(0)
            if (body != null) connection.setRequestProperty("Content-Type", "application/json")
            connection.setFixedLengthStreamingMode(bytes.size)
            connection.doOutput = true
            connection.outputStream.use { it.write(bytes) }
            return connection.responseCode
        } finally {
            connection.disconnect()
        }
    }
}
