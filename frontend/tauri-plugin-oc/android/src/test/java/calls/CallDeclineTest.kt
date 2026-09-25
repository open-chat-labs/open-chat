package com.ocplugin.app.calls

import com.ocplugin.app.calls.CallRegistry.End
import com.ocplugin.app.calls.CallRegistry.Started
import com.ocplugin.app.decoders.NotificationDecoder
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// Pins the shell's part of declining a call (#9534): invariants 1, 10 and 12.
class CallDeclineTest {
    private val now = 1_000_000L
    private val alice = CallChat(CallChat.DIRECT, "alice")

    private fun call(messageId: String = "1", token: String? = "tok") =
        IncomingCall(CallId(alice, messageId), CallKind.VIDEO, now, "Alice", null, null, declineToken = token)

    private val ring = mapOf(
        "type" to "direct",
        "senderId" to "alice",
        "senderName" to "Alice",
        "body" to "Video call",
        "bodyType" to "message",
        "messageType" to "VideoCall",
        "callMessageId" to "77",
        "callType" to "default",
        "callAudioOnly" to "false",
        "callStarted" to "1700000000000",
    )

    @Test
    fun `invariant 10 declined_elsewhere ends a ring without a missed call`() {
        val r = CallRegistry()
        assertTrue(r.started(call(), now) is Started.Ring)
        val end = r.dismissed(CallDismissal(CallId(alice, "1"), DismissalKind.DECLINED_ELSEWHERE))
        assertEquals(End.DECLINED_ELSEWHERE, end)
        assertFalse(end!!.postsMissedCall)
        assertNull(r.ringing(CallId(alice, "1")))
        assertEquals(android.telecom.DisconnectCause.REJECTED, CallTelecom.disconnectCode(End.DECLINED_ELSEWHERE))
    }

    @Test
    fun `invariant 10 declined_elsewhere for another message id changes nothing`() {
        val r = CallRegistry()
        r.started(call(messageId = "1"), now)
        assertNull(r.dismissed(CallDismissal(CallId(alice, "2"), DismissalKind.DECLINED_ELSEWHERE)))
        assertNotNull(r.ringing(CallId(alice, "1")))
        // and arriving early for its own id, it prevents the ring with no missed call
        assertEquals(Started.Ignore, r.started(call(messageId = "2"), now))
    }

    @Test
    fun `invariant 10 the dismissal kind decodes and an unknown kind is ignored`() {
        val data = mapOf(
            "type" to "call_dismissed",
            "chatType" to "direct",
            "chatId" to "alice",
            "callMessageId" to "77",
            "dismissalKind" to "declined_elsewhere",
        )
        assertEquals(DismissalKind.DECLINED_ELSEWHERE, NotificationDecoder.decodeCallDismissal(data)!!.kind)
        assertNull(NotificationDecoder.decodeCallDismissal(data + ("dismissalKind" to "declined")))
    }

    @Test
    fun `invariant 1 the decline token rides only the ring push and survives the notification extras`() {
        assertNull(NotificationDecoder.decodeCallFacts(ring)!!.declineToken)
        val facts = NotificationDecoder.decodeCallFacts(ring + ("callDeclineToken" to "tok"))!!
        assertEquals("tok", facts.declineToken)
        val call = IncomingCall.of(NotificationDecoder.decode(ring)!!, facts)!!
        assertEquals("tok", call.declineToken)
        // The web layer is never handed the token: the accept payload has no such key.
        val ringer = File("src/main/java/calls/CallRinger.kt").readText()
        assertFalse(ringer.contains("declineToken\""))
    }

    @Test
    fun `invariant 12 the bridge report is bounded and its failure is swallowed`() = runBlocking {
        val previous = CallDeclineReporter.post
        try {
            CallDeclineReporter.post = { _, _ -> throw IllegalStateException("no network") }
            assertFalse(CallDeclineReporter.report("https://bridge", "tok"))

            CallDeclineReporter.post = { _, _ -> 500 }
            assertFalse(CallDeclineReporter.report("https://bridge", "tok"))

            var seen: Pair<String, String>? = null
            CallDeclineReporter.post = { url, token -> seen = url to token; 204 }
            assertTrue(CallDeclineReporter.report("https://bridge", "tok"))
            assertEquals("https://bridge/room/decline" to "tok", seen)

            CallDeclineReporter.post = { _, _ -> Thread.sleep(5_000); 204 }
            val startedAt = System.currentTimeMillis()
            assertFalse(CallDeclineReporter.report("https://bridge", "tok", timeoutMs = 50))
            assertTrue(System.currentTimeMillis() - startedAt < 2_000)
        } finally {
            CallDeclineReporter.post = previous
        }
    }

    @Test
    fun `invariant 12 the ring ends before the bridge is told and the receiver waits only for the report`() {
        val ringer = File("src/main/java/calls/CallRinger.kt").readText()
        val decline = ringer.substring(ringer.indexOf("fun decline("))
        val ended = decline.indexOf("finish(")
        val reported = decline.indexOf("CallDeclineReporter.report")
        assertTrue(ended in 1 until reported)
        // No token, or no bridge configured, and there is nothing to wait for.
        assertTrue(decline.indexOf("?: return null") in 1 until reported)
        val receiver = File("src/main/java/calls/CallActionReceiver.kt").readText()
        assertTrue(receiver.indexOf("goAsync()") > receiver.indexOf("CallRinger.decline("))
        assertTrue("finish()" in receiver.substring(receiver.indexOf("finally")))
    }
}
