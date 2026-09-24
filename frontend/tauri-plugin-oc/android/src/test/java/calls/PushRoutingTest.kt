package com.ocplugin.app.calls

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// Pins invariant 5 of native calls M2 (#9510) on the shell side: a call push rings
// natively whether or not the app is on screen. Only an ordinary message push looks at
// the app's state.
class PushRoutingTest {
    private val message = mapOf("type" to "direct", "senderId" to "alice", "senderName" to "Alice", "body" to "hi")
    private val ring = message + mapOf(
        "callMessageId" to "77",
        "callType" to "default",
        "callAudioOnly" to "true",
        "callStarted" to "1700000000000",
    )
    private val dismissal = mapOf(
        "type" to "call_dismissed",
        "chatType" to "direct",
        "chatId" to "alice",
        "callMessageId" to "77",
        "dismissalKind" to "ended",
    )

    @Test
    fun `invariant 5 a call push rings whether or not the app is on screen`() {
        for (onScreen in listOf(true, false)) {
            val route = PushRouting.route(ring, onScreen)
            assertTrue("onScreen=$onScreen", route is PushRoute.Ring)
            assertEquals("77", (route as PushRoute.Ring).facts.messageId)
        }
    }

    @Test
    fun `an ordinary message push carries the app state and a dismissal ignores it`() {
        assertEquals(true, (PushRouting.route(message, true) as PushRoute.Message).appOnScreen)
        assertEquals(false, (PushRouting.route(message, false) as PushRoute.Message).appOnScreen)
        assertTrue(PushRouting.route(dismissal, true) is PushRoute.Dismissal)
        assertEquals(PushRoute.Drop, PushRouting.route(mapOf("type" to "group"), false))
    }
}
