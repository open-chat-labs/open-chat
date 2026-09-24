package com.ocplugin.app.calls

import com.ocplugin.app.decoders.NotificationDecoder
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

// Pins invariant 1 of native calls M2 (#9510) on the decode side: a push without the call
// fields is an ordinary notification and produces no ring, whatever else it carries. The
// shell never infers ring scope from the chat.
class CallPushDecodeTest {
    private val direct = mapOf(
        "type" to "direct",
        "senderId" to "alice",
        "senderName" to "Alice",
        "body" to "Video call",
        "bodyType" to "message",
        "messageType" to "VideoCall",
    )

    private val ring = direct + mapOf(
        "callMessageId" to "77",
        "callType" to "default",
        "callAudioOnly" to "false",
        "callStarted" to "1700000000000",
    )

    @Test
    fun `invariant 1 a push without call fields decodes as a message and yields no call facts`() {
        assertNotNull(NotificationDecoder.decode(direct))
        assertNull(NotificationDecoder.decodeCallFacts(direct))
        assertNull(NotificationDecoder.decodeCallDismissal(direct))
        // A private group message push is the same: the chat kind says nothing.
        val group = mapOf("type" to "group", "groupId" to "g", "senderId" to "alice", "senderName" to "Alice")
        assertNotNull(NotificationDecoder.decode(group))
        assertNull(NotificationDecoder.decodeCallFacts(group))
    }

    @Test
    fun `invariant 1 a partial set of call fields is not a ring`() {
        assertNull(NotificationDecoder.decodeCallFacts(ring - "callStarted"))
        assertNull(NotificationDecoder.decodeCallFacts(ring - "callMessageId"))
        assertNull(NotificationDecoder.decodeCallFacts(ring + ("callStarted" to "not-a-number")))
    }

    @Test
    fun `a ring push decodes its facts and the message it still is`() {
        val facts = NotificationDecoder.decodeCallFacts(ring)!!
        assertEquals(CallFacts("77", CallKind.VIDEO, 1_700_000_000_000L), facts)
        assertEquals(CallKind.AUDIO, NotificationDecoder.decodeCallFacts(ring + ("callAudioOnly" to "true"))!!.kind)
        assertEquals(CallKind.BROADCAST, NotificationDecoder.decodeCallFacts(ring + ("callType" to "broadcast"))!!.kind)
        val n = NotificationDecoder.decode(ring)!!
        val call = IncomingCall.of(n, facts)!!
        assertEquals(CallId(CallChat(CallChat.DIRECT, "alice"), "77"), call.id)
        assertEquals("Alice", call.title)
        assertNull(call.callerName)
    }

    @Test
    fun `a dismissal push decodes and is not a message`() {
        val data = mapOf(
            "type" to "call_dismissed",
            "chatType" to "direct",
            "chatId" to "alice",
            "callMessageId" to "77",
            "dismissalKind" to "answered_elsewhere",
        )
        assertEquals(
            CallDismissal(CallId(CallChat(CallChat.DIRECT, "alice"), "77"), DismissalKind.ANSWERED_ELSEWHERE),
            NotificationDecoder.decodeCallDismissal(data),
        )
        assertNull(NotificationDecoder.decode(data))
        assertEquals(
            DismissalKind.ENDED,
            NotificationDecoder.decodeCallDismissal(data + ("dismissalKind" to "ended"))!!.kind,
        )
        assertNull(NotificationDecoder.decodeCallDismissal(data + ("dismissalKind" to "declined")))
    }

    @Test
    fun `a dismissal for a group call keys the same chat as its start push`() {
        val start = NotificationDecoder.decode(
            ring + mapOf("type" to "group", "groupId" to "team", "groupName" to "Team"),
        )!!
        val call = IncomingCall.of(start, NotificationDecoder.decodeCallFacts(ring)!!)!!
        val dismissal = NotificationDecoder.decodeCallDismissal(
            mapOf("type" to "call_dismissed", "chatType" to "group", "chatId" to "team", "callMessageId" to "77", "dismissalKind" to "ended"),
        )!!
        assertEquals(call.id, dismissal.id)
        assertEquals("Alice", call.callerName)
        assertEquals("Team", call.title)
    }
}
