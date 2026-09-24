package com.ocplugin.app.calls

import com.ocplugin.app.calls.CallRegistry.End
import com.ocplugin.app.calls.CallRegistry.Started
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Pins the ring rules of native calls M2 (#9510). Each test names its invariant.
class CallRegistryTest {
    private val now = 1_000_000L
    private val alice = CallChat(CallChat.DIRECT, "alice")
    private val team = CallChat(CallChat.GROUP, "team")

    private fun call(chat: CallChat = alice, messageId: String = "1", started: Long = now) =
        IncomingCall(CallId(chat, messageId), CallKind.VIDEO, started, "Alice", null, null)

    private fun dismissal(chat: CallChat, messageId: String, kind: DismissalKind) =
        CallDismissal(CallId(chat, messageId), kind)

    @Test
    fun `invariant 2 the same call rings at most once however many started pushes arrive`() {
        val r = CallRegistry()
        assertTrue(r.started(call(), now) is Started.Ring)
        assertEquals(Started.Ignore, r.started(call(), now + 1))
        assertEquals(Started.Ignore, r.started(call(), now + 2))
        assertEquals(End.ANSWERED_HERE, r.accepted(call().id))
        assertEquals(Started.Ignore, r.started(call(), now + 3))
    }

    @Test
    fun `invariant 2 a different message id in the same chat is a new ring`() {
        val r = CallRegistry()
        assertTrue(r.started(call(messageId = "1"), now) is Started.Ring)
        assertTrue(r.started(call(messageId = "2"), now) is Started.Ring)
    }

    @Test
    fun `invariant 3 a dismissal for message A never ends a ring for message B`() {
        val r = CallRegistry()
        r.started(call(alice, "B"), now)
        assertNull(r.dismissed(dismissal(alice, "A", DismissalKind.ENDED)))
        assertNull(r.dismissed(dismissal(team, "B", DismissalKind.ENDED)))
        assertEquals(call(alice, "B"), r.ringing(CallId(alice, "B")))
        assertEquals(End.MISSED, r.dismissed(dismissal(alice, "B", DismissalKind.ENDED)))
    }

    @Test
    fun `invariant 4 an early ended dismissal prevents the ring and makes the call missed`() {
        val r = CallRegistry()
        assertNull(r.dismissed(dismissal(alice, "1", DismissalKind.ENDED)))
        assertEquals(Started.Missed(call()), r.started(call(), now))
        assertNull(r.ringing(call().id))
    }

    @Test
    fun `invariant 4 an early answered_elsewhere prevents the ring with no missed call`() {
        val r = CallRegistry()
        assertNull(r.dismissed(dismissal(alice, "1", DismissalKind.ANSWERED_ELSEWHERE)))
        assertEquals(Started.Ignore, r.started(call(), now))
    }

    @Test
    fun `invariant 4 a started push for a call this device answered does not ring`() {
        val r = CallRegistry()
        r.started(call(), now)
        r.accepted(call().id)
        assertEquals(Started.Ignore, r.started(call(), now + 5_000))
    }

    @Test
    fun `invariant 5 the registry has no notion of the app being on screen and always rings`() {
        // The shell rings natively whatever the app state; nothing in the decision
        // takes the app's visibility.
        val r = CallRegistry()
        assertTrue(r.started(call(), now) is Started.Ring)
        assertEquals(Started.Ignore, r.started(call(), now))
    }

    @Test
    fun `invariant 5 a join from inside the app ends the native ring as answered here`() {
        val r = CallRegistry()
        r.started(call(messageId = "9"), now)
        assertEquals(CallId(alice, "9"), r.joinedInApp("9"))
        assertNull(r.ringing(CallId(alice, "9")))
        assertNull(r.joinedInApp("9"))
        assertNull(r.timedOut(CallId(alice, "9")))
    }

    @Test
    fun `invariant 6 a started push older than the window is a missed call and never a ring`() {
        val r = CallRegistry()
        val old = call(started = now - CallRegistry.RING_WINDOW_MS - 1)
        assertEquals(Started.Missed(old), r.started(old, now))
        assertNull(r.ringing(old.id))
        // Exactly at the window edge is also too late.
        val edge = call(messageId = "2", started = now - CallRegistry.RING_WINDOW_MS)
        assertEquals(Started.Missed(edge), r.started(edge, now))
    }

    @Test
    fun `invariant 6 the deadline is the start plus the window and a future start rings the full window`() {
        val r = CallRegistry()
        val late = r.started(call(started = now - 10_000), now) as Started.Ring
        assertEquals(now + CallRegistry.RING_WINDOW_MS - 10_000, late.deadline)
        val future = r.started(call(messageId = "2", started = now + 60_000), now) as Started.Ring
        assertEquals(now + CallRegistry.RING_WINDOW_MS, future.deadline)
    }

    @Test
    fun `invariant 7 a timeout or an ended dismissal is a missed call`() {
        val r = CallRegistry()
        r.started(call(messageId = "1"), now)
        assertEquals(End.MISSED, r.timedOut(CallId(alice, "1")))
        // Only once: a second timeout has nothing to end.
        assertNull(r.timedOut(CallId(alice, "1")))

        r.started(call(messageId = "2"), now)
        assertEquals(End.MISSED, r.dismissed(dismissal(alice, "2", DismissalKind.ENDED)))
        assertNull(r.dismissed(dismissal(alice, "2", DismissalKind.ENDED)))
    }

    @Test
    fun `invariant 8 accept decline answered_elsewhere and in-app join are not missed calls`() {
        val r = CallRegistry()
        r.started(call(messageId = "1"), now)
        assertEquals(End.ANSWERED_HERE, r.accepted(CallId(alice, "1")))
        assertNull(r.timedOut(CallId(alice, "1")))

        r.started(call(messageId = "2"), now)
        assertEquals(End.REJECTED, r.declined(CallId(alice, "2")))
        assertNull(r.timedOut(CallId(alice, "2")))

        r.started(call(messageId = "3"), now)
        assertEquals(End.ANSWERED_ELSEWHERE, r.dismissed(dismissal(alice, "3", DismissalKind.ANSWERED_ELSEWHERE)))
        assertNull(r.timedOut(CallId(alice, "3")))

        r.started(call(messageId = "4"), now)
        assertEquals(CallId(alice, "4"), r.joinedInApp("4"))
        assertNull(r.timedOut(CallId(alice, "4")))
        assertNull(r.joinedInApp("4"))
    }

    @Test
    fun `invariant 8 the call log cause follows the end`() {
        assertEquals(android.telecom.DisconnectCause.MISSED, CallTelecom.disconnectCode(End.MISSED))
        assertEquals(android.telecom.DisconnectCause.REJECTED, CallTelecom.disconnectCode(End.REJECTED))
        assertEquals(android.telecom.DisconnectCause.ANSWERED_ELSEWHERE, CallTelecom.disconnectCode(End.ANSWERED_ELSEWHERE))
        assertEquals(android.telecom.DisconnectCause.LOCAL, CallTelecom.disconnectCode(End.ANSWERED_HERE))
    }

    @Test
    fun `invariant 7 and 8 the registry names how each ring ended and only a missed call posts a notification`() {
        val r = CallRegistry()
        r.started(call(messageId = "a"), now)
        assertEquals(End.ANSWERED_HERE, r.accepted(CallId(alice, "a")))
        r.started(call(messageId = "d"), now)
        assertEquals(End.REJECTED, r.declined(CallId(alice, "d")))
        r.started(call(messageId = "t"), now)
        assertEquals(End.MISSED, r.timedOut(CallId(alice, "t")))
        r.started(call(messageId = "j"), now)
        assertEquals(CallId(alice, "j"), r.joinedInApp("j"))
        assertEquals(listOf(End.MISSED), End.entries.filter { it.postsMissedCall })
    }

    @Test
    fun `invariant 17 the ring notification is posted at most once per call and only while ringing`() {
        val r = CallRegistry()
        assertFalse(r.shouldPostRing(call().id))
        r.started(call(), now)
        assertTrue(r.shouldPostRing(call().id))
        assertFalse(r.shouldPostRing(call().id))
        r.declined(call().id)
        assertFalse(r.shouldPostRing(call().id))
    }

    @Test
    fun `invariant 18 the avatar fetch can delay a ring by at most one and a half seconds`() {
        assertTrue(CallRinger.AVATAR_WAIT_MS <= 1_500L)
    }

    @Test
    fun `invariant 20 an in-app join for a message id that never rang changes nothing`() {
        val r = CallRegistry()
        r.started(call(messageId = "1"), now)
        assertNull(r.joinedInApp("never"))
        assertEquals(call(messageId = "1"), r.ringing(CallId(alice, "1")))
    }

    @Test
    fun `invariant 14 the registry accepts only a call that is ringing`() {
        val r = CallRegistry()
        assertNull(r.accepted(CallId(alice, "never-rang")))
        r.started(call(), now)
        r.declined(call().id)
        assertNull(r.accepted(call().id))
    }

    @Test
    fun `the finished set is bounded so memory does not grow with every call`() {
        val r = CallRegistry(rememberLimit = 3)
        for (i in 1..5) {
            r.started(call(messageId = "$i"), now)
            r.declined(CallId(alice, "$i"))
        }
        // The oldest two were evicted and may ring again; the newest three may not.
        assertTrue(r.started(call(messageId = "1"), now) is Started.Ring)
        assertEquals(Started.Ignore, r.started(call(messageId = "5"), now))
    }
}
