package com.ocplugin.app.calls

import com.ocplugin.app.calls.CallSessionState.Ended
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// Pins the in-call rules of native calls M4 (#9559). Each test names its invariant.
class CallSessionTest {
    private val now = 1_000_000L
    private val alice = CallId(CallChat(CallChat.DIRECT, "alice"), "1")
    private val bob = CallId(CallChat(CallChat.DIRECT, "bob"), "2")

    @Test
    fun `invariant 3 the type tiers are phoneCall plus granted media, then without phoneCall, then projection alone`() {
        val t = ServiceTypes
        assertEquals(listOf(t.PHONE_CALL or t.MICROPHONE or t.CAMERA, t.MICROPHONE or t.CAMERA),
            t.tiers(34, microphoneGranted = true, cameraGranted = true, sharing = false))
        // a lapsed microphone grant never puts the microphone type in any tier
        assertEquals(listOf(t.PHONE_CALL), t.tiers(34, microphoneGranted = false, cameraGranted = false, sharing = false))
        assertEquals(listOf(t.PHONE_CALL or t.CAMERA, t.CAMERA), t.tiers(34, microphoneGranted = false, cameraGranted = true, sharing = false))
        // screen share adds mediaProjection to every tier and alone as the last resort
        assertEquals(
            listOf(t.PHONE_CALL or t.MICROPHONE or t.MEDIA_PROJECTION, t.MICROPHONE or t.MEDIA_PROJECTION, t.MEDIA_PROJECTION),
            t.tiers(34, microphoneGranted = true, cameraGranted = false, sharing = true),
        )
        // before Android 10 there are no types
        assertEquals(listOf(0), t.tiers(28, microphoneGranted = true, cameraGranted = true, sharing = true))
        for (tier in t.tiers(34, microphoneGranted = false, cameraGranted = false, sharing = true)) {
            assertEquals(0, tier and t.MICROPHONE)
            assertEquals(0, tier and t.CAMERA)
        }
    }

    @Test
    fun `invariant 3 every tier is tried and a refusal of all stops the service unless it is already up`() {
        val src = File("src/main/java/calls/CallForegroundService.kt").readText()
        val loop = src.substring(src.indexOf("for (type in tiers)"))
        assertTrue(loop.indexOf("catch (e: Exception)") in 1 until loop.indexOf("if (isForeground) return"))
        assertTrue(loop.indexOf("if (isForeground) return") < loop.indexOf("stopSelf()"))
    }

    @Test
    fun `invariant 4 the service runs only for an active call and stops after the grace unless a call started meanwhile`() {
        val s = CallSessionState(graceMs = 3_000)
        assertFalse(s.shouldStop(now))
        assertTrue(s.started(alice, video = false, title = "Alice", now = now))
        // the same call reported again does not restart the service
        assertFalse(s.started(alice, video = false, title = "Alice", now = now + 1))
        assertEquals(Ended.StopAfterGrace(alice, now + 10), s.ended(alice, now + 10))
        assertFalse(s.shouldStop(now + 10 + 2_999))
        assertTrue(s.shouldStop(now + 10 + 3_000))
        // a new call inside the grace keeps the service: the timer must not stop it
        s.ended(alice, now + 20)
        assertTrue(s.started(bob, video = true, title = "Bob", now = now + 1_000))
        assertFalse(s.shouldStop(now + 20 + 3_000))
        assertEquals(bob, s.active?.id)
    }

    @Test
    fun `invariant 2 an end for a call that is not the active one changes nothing`() {
        val s = CallSessionState()
        s.started(alice, video = false, title = "Alice", now = now)
        assertEquals(Ended.Ignore, s.ended(bob, now + 1))
        assertEquals(alice, s.active?.id)
        assertEquals(Ended.Ignore, CallSessionState().ended(alice, now))
    }

    @Test
    fun `invariant 2 endAll ends whatever is active and reports which`() {
        val s = CallSessionState()
        assertNull(s.endAll(now))
        s.started(alice, video = false, title = "Alice", now = now)
        assertEquals(alice, s.endAll(now + 1))
        assertNull(s.active)
        assertTrue(s.shouldStop(now + 1 + CallSessionState.STOP_GRACE_MS))
    }

    @Test
    fun `invariant 2 every native end path goes through the session and the session ends Telecom and the service`() {
        val session = File("src/main/java/calls/CallSession.kt").readText()
        val endAll = session.substring(session.indexOf("fun endAll("))
        assertTrue("CallTelecom.endAll(" in endAll.substring(0, endAll.indexOf("fun ownerTaskAlive")))
        assertTrue("CallForegroundService.stop(" in endAll.substring(0, endAll.indexOf("fun ownerTaskAlive")))
        val ended = session.substring(session.indexOf("fun ended("), session.indexOf("fun hangUp("))
        assertTrue("CallTelecom.end(id, CallRegistry.End.HUNG_UP)" in ended)
        // the notification's hang-up, Telecom's disconnect of an active call, a removed task
        // and a finishing main activity all land in the session
        val receiver = File("src/main/java/calls/CallActionReceiver.kt").readText()
        assertTrue("CallSession.hangUp(" in receiver.substring(receiver.indexOf("ACTION_HANG_UP")))
        val telecom = File("src/main/java/calls/CallTelecom.kt").readText()
        val disconnect = telecom.substring(telecom.indexOf("override fun onDisconnect()"))
        assertTrue("if (answered) CallSession.hangUp(" in disconnect.substring(0, disconnect.indexOf("override fun onAbort")))
        val service = File("src/main/java/calls/CallForegroundService.kt").readText()
        assertTrue("CallSession.endAll(" in service.substring(service.indexOf("override fun onTaskRemoved")))
        val mainActivity = File("../../src-tauri/gen/android/app/src/main/java/com/oclabs/openchat/MainActivity.kt").readText()
        assertTrue("CallSession.endAll(" in mainActivity.substring(mainActivity.indexOf("override fun onDestroy")))
    }

    @Test
    fun `invariant 1 an answered connection carries on into the call and is never logged as missed`() {
        // the registry's end for an answered ring maps to LOCAL, and the connection's answered
        // path activates rather than disconnects
        assertEquals(android.telecom.DisconnectCause.LOCAL, CallTelecom.disconnectCode(CallRegistry.End.ANSWERED_HERE))
        assertEquals(android.telecom.DisconnectCause.LOCAL, CallTelecom.disconnectCode(CallRegistry.End.HUNG_UP))
        assertFalse(CallRegistry.End.HUNG_UP.postsMissedCall)
        val telecom = File("src/main/java/calls/CallTelecom.kt").readText()
        val end = telecom.substring(telecom.indexOf("fun end(id: CallId, end: CallRegistry.End)"), telecom.indexOf("// The web layer claimed the call"))
        assertTrue("if (end == CallRegistry.End.ANSWERED_HERE)" in end)
        assertTrue("call.answered()" in end)
        // and an abort after the answer is a hang-up, not a miss
        val abort = telecom.substring(telecom.indexOf("override fun onAbort()"), telecom.indexOf("override fun answered()"))
        assertTrue("if (answered) CallRegistry.End.HUNG_UP else CallRegistry.End.MISSED" in abort)
    }

    @Test
    fun `the answered connection the web layer never claims ends itself`() {
        val telecom = File("src/main/java/calls/CallTelecom.kt").readText()
        assertNotNull(telecom.indexOf("claimBackstop"))
        val answered = telecom.substring(telecom.indexOf("override fun answered()"), telecom.indexOf("override fun activate()"))
        assertTrue("postDelayed(claimBackstop" in answered)
        val activate = telecom.substring(telecom.indexOf("override fun activate()"), telecom.indexOf("override fun finish("))
        assertTrue("removeCallbacks(claimBackstop)" in activate)
    }

    @Test
    fun `invariant 9 picture in picture is armed only for an active video call and the session drives it`() {
        assertTrue(PipRule.armed(active = true, video = true))
        assertFalse(PipRule.armed(active = true, video = false))
        assertFalse(PipRule.armed(active = false, video = true))
        val session = File("src/main/java/calls/CallSession.kt").readText()
        val active = session.substring(session.indexOf("fun active("), session.indexOf("fun setSpeaker("))
        assertTrue("CallPip.update(active = true, video = video, call = call)" in active)
        val ended = session.substring(session.indexOf("fun ended("), session.indexOf("fun hangUp("))
        assertTrue("CallPip.update(active = false" in ended)
        val endAll = session.substring(session.indexOf("fun endAll("), session.indexOf("fun ownerTaskAlive"))
        assertTrue("CallPip.update(active = false" in endAll)
        // entry and exit are reported, and a tile with no armed call is left
        val pip = File("src/main/java/calls/CallPip.kt").readText()
        val changed = pip.substring(pip.indexOf("fun changed("), pip.indexOf("private fun leaveTile"))
        assertTrue("\"pip-changed\"" in changed)
        assertTrue("moveTaskToBack(true)" in changed)
        // a call ending in the tile leaves it
        val update = pip.substring(pip.indexOf("fun update("), pip.indexOf("fun onUserLeaveHint"))
        assertTrue("if (!wanted && inPip) leaveTile()" in update)
    }

    @Test
    fun `invariant 10 the transactional account is used only from Android 16 QPR2 by release and both accounts opt in to the call log`() {
        assertEquals(36, CallTelecom.TRANSACTIONAL_FROM_API)
        assertEquals(3_600_001, CallTelecom.TRANSACTIONAL_FROM_RELEASE)
        val telecom = File("src/main/java/calls/CallTelecom.kt").readText()
        val gate = telecom.substring(telecom.indexOf("private fun transactionalSupported()"), telecom.indexOf("fun ensureRegistered"))
        assertTrue("Build.VERSION.SDK_INT >= TRANSACTIONAL_FROM_API" in gate)
        assertTrue("Build.VERSION.SDK_INT_FULL >= TRANSACTIONAL_FROM_RELEASE" in gate)
        // no probing: usesTransactional is the gate plus a successful registration
        assertTrue("fun usesTransactional(): Boolean = transactionalSupported() && transactionalReady" in telecom)
        // both accounts carry the call log extra
        val connectionAccount = telecom.substring(telecom.indexOf("fun ensureRegistered"), telecom.indexOf("private fun logExtras"))
        assertTrue("setExtras(logExtras())" in connectionAccount)
        val transactionalAccount = telecom.substring(telecom.indexOf("private fun registerTransactionalAccount"), telecom.indexOf("private fun unregisterStrayAccounts"))
        assertTrue(".setExtras(logExtras())" in transactionalAccount)
        assertTrue("CAPABILITY_SUPPORTS_TRANSACTIONAL_OPERATIONS" in transactionalAccount)
        // both incoming and outgoing calls take the transactional path when it applies, and
        // fall back to the connection service when addCall refuses
        for (fn in listOf("fun reportIncoming(", "fun placeOutgoing(")) {
            val body = telecom.substring(telecom.indexOf(fn))
            val pathChoice = body.indexOf("if (usesTransactional()")
            val fallback = body.indexOf("falling back to the connection service")
            assertTrue(fn, pathChoice in 1 until fallback)
        }
    }

    @Test
    fun `invariant 1 the transactional disconnect never logs an answered call as missed`() {
        for (end in CallRegistry.End.entries) {
            val code = CallTelecom.transactionalDisconnectCode(end, answered = true)
            assertTrue(end.name, code != android.telecom.DisconnectCause.MISSED)
            assertTrue(end.name, code in setOf(android.telecom.DisconnectCause.LOCAL, android.telecom.DisconnectCause.REJECTED))
        }
        assertEquals(android.telecom.DisconnectCause.MISSED, CallTelecom.transactionalDisconnectCode(CallRegistry.End.MISSED, answered = false))
        assertEquals(android.telecom.DisconnectCause.REJECTED, CallTelecom.transactionalDisconnectCode(CallRegistry.End.ANSWERED_ELSEWHERE, answered = false))
        assertEquals(android.telecom.DisconnectCause.REJECTED, CallTelecom.transactionalDisconnectCode(CallRegistry.End.REJECTED, answered = false))
    }

    @Test
    fun `invariant 11 a call-log redial that resolves to no chat starts no call`() {
        val telecom = File("src/main/java/calls/CallTelecom.kt").readText()
        val outgoing = telecom.substring(telecom.indexOf("override fun onCreateOutgoingConnection"))
        val body = outgoing.substring(0, outgoing.indexOf("class CallConnection("))
        assertTrue("?: return Connection.createFailedConnection(DisconnectCause(DisconnectCause.ERROR, \"unknown call\"))" in body)
        assertTrue(body.indexOf("CallRinger.redial(") > body.indexOf("\"unknown call\""))
        val callBack = File("src/main/java/calls/CallBackActivity.kt").readText()
        assertTrue("CallHandleDirectory.chat(" in callBack)
        assertTrue(callBack.indexOf("?: return") < callBack.indexOf("CallRinger.redial(") || callBack.indexOf("?.let") > 0)
    }

    @Test
    fun `invariant 14 the session silences the ringback on every end`() {
        val session = File("src/main/java/calls/CallSession.kt").readText()
        val ended = session.substring(session.indexOf("fun ended("), session.indexOf("fun hangUp("))
        assertTrue("CallRingback.stop()" in ended)
        val endAll = session.substring(session.indexOf("fun endAll("), session.indexOf("fun ownerTaskAlive"))
        assertTrue("CallRingback.stop()" in endAll)
        val ringback = File("src/main/java/calls/CallRingback.kt").readText()
        assertTrue("STREAM_VOICE_CALL" in ringback && "TONE_SUP_RINGTONE" in ringback)
    }

    @Test
    fun `invariant 6 the route Telecom settled before the web layer claimed the call is applied on the claim`() {
        val session = File("src/main/java/calls/CallSession.kt").readText()
        val active = session.substring(session.indexOf("fun active("), session.indexOf("// The route the call is on"))
        assertTrue("CallTelecom.route(call.id)?.let { routeReflected(context, call.id, it) }" in active)
        // and it is applied after the service start, once the session counts as active
        assertTrue(active.indexOf("CallForegroundService.start(") < active.indexOf("CallTelecom.route(call.id)"))
    }

    @Test
    fun `invariant 9 closing the tile with the app not coming back is a hang-up`() {
        val pip = File("src/main/java/calls/CallPip.kt").readText()
        val changed = pip.substring(pip.indexOf("fun changed("), pip.indexOf("private fun leaveTile"))
        assertTrue("if (!isInPip && armed)" in changed)
        assertTrue("CallSession.hangUp(activity, it.id, \"pip-dismissed\")" in changed)
        // only when the app did not come back on screen
        assertTrue(changed.indexOf("if (!onScreen)") < changed.indexOf("CallSession.hangUp("))
    }
}
