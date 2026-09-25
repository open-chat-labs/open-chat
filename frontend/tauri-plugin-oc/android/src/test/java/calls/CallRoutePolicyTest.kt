package com.ocplugin.app.calls

import com.ocplugin.app.calls.CallRoutePolicy.Route
import com.ocplugin.app.calls.CallRoutePolicy.RouteState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// Pins invariants 5 and 6 of native calls M4 (#9559): where a call's audio goes.
class CallRoutePolicyTest {
    private class FakePort : CallRoutePolicy.Port {
        var state: RouteState? = null
        var active = false
        val requests = mutableListOf<Route>()
        val reflected = mutableListOf<Route>()
        override fun routeState() = state
        override fun requestRoute(route: Route) { requests.add(route) }
        override fun isActive() = active
        override fun reflect(route: Route) { reflected.add(route) }
    }

    @Test
    fun `invariant 5 voice defaults to the earpiece and video to the speaker`() {
        val port = FakePort()
        val policy = CallRoutePolicy(port)
        policy.apply(speaker = false, isDefault = true)
        assertEquals(listOf(Route.EARPIECE), port.requests)
        val video = FakePort()
        CallRoutePolicy(video).apply(speaker = true, isDefault = true)
        assertEquals(listOf(Route.SPEAKER), video.requests)
    }

    @Test
    fun `invariant 5 a default never displaces Bluetooth`() {
        val port = FakePort()
        port.state = RouteState(Route.BLUETOOTH, btDevices = true)
        val policy = CallRoutePolicy(port)
        policy.apply(speaker = true, isDefault = true)
        assertTrue(port.requests.isEmpty())
        // a default applied before the platform reported a headset yields the moment it shows
        val late = FakePort()
        val latePolicy = CallRoutePolicy(late)
        latePolicy.apply(speaker = true, isDefault = true)
        assertEquals(listOf(Route.SPEAKER), late.requests)
        latePolicy.onRouteStateChanged(RouteState(Route.EARPIECE, btDevices = true))
        assertEquals(listOf(Route.SPEAKER, Route.BLUETOOTH), late.requests)
    }

    @Test
    fun `invariant 5 a user's choice has absolute priority over a default and over Bluetooth`() {
        val port = FakePort()
        port.state = RouteState(Route.BLUETOOTH, btDevices = true)
        val policy = CallRoutePolicy(port)
        policy.apply(speaker = true, isDefault = false)
        assertEquals(listOf(Route.SPEAKER), port.requests)
        // the platform reports a different basic route: the choice is re-asserted
        port.active = true
        policy.onRouteStateChanged(RouteState(Route.EARPIECE, btDevices = false))
        assertEquals(listOf(Route.SPEAKER, Route.SPEAKER), port.requests)
    }

    @Test
    fun `invariant 5 Bluetooth leaving mid-call restores the video default`() {
        val port = FakePort()
        val policy = CallRoutePolicy(port)
        port.state = RouteState(Route.BLUETOOTH, btDevices = true)
        policy.apply(speaker = true, isDefault = true)
        assertTrue(port.requests.isEmpty())
        port.active = true
        policy.onRouteStateChanged(RouteState(Route.BLUETOOTH, btDevices = true))
        policy.onRouteStateChanged(RouteState(Route.EARPIECE, btDevices = false))
        assertEquals(listOf(Route.SPEAKER), port.requests)
    }

    @Test
    fun `invariant 5 the re-assertion budget is bounded and pre-active states are not reflected`() {
        val port = FakePort()
        val policy = CallRoutePolicy(port)
        policy.apply(speaker = true, isDefault = false)
        port.active = true
        repeat(CallRoutePolicy.MAX_ROUTE_REASSERTS + 3) {
            policy.onRouteStateChanged(RouteState(Route.EARPIECE, btDevices = false))
        }
        assertEquals(1 + CallRoutePolicy.MAX_ROUTE_REASSERTS, port.requests.size)
        // once the budget is spent the platform's route is reflected, not fought
        assertEquals(listOf(Route.EARPIECE, Route.EARPIECE, Route.EARPIECE), port.reflected)
        val inactive = FakePort()
        CallRoutePolicy(inactive).onRouteStateChanged(RouteState(Route.SPEAKER, btDevices = false))
        assertTrue(inactive.reflected.isEmpty())
    }

    @Test
    fun `invariant 5 the desired route is re-applied when the call goes active`() {
        val port = FakePort()
        val policy = CallRoutePolicy(port)
        policy.apply(speaker = false, isDefault = true)
        policy.reapply()
        assertEquals(listOf(Route.EARPIECE, Route.EARPIECE), port.requests)
    }

    @Test
    fun `invariant 6 the proximity lock is held only for an active voice call on the earpiece`() {
        assertTrue(ProximityRule.holdWakeLock(active = true, video = false, route = Route.EARPIECE))
        assertFalse(ProximityRule.holdWakeLock(active = true, video = false, route = Route.SPEAKER))
        // a headset is not the ear: the screen stays on (found on the device)
        assertFalse(ProximityRule.holdWakeLock(active = true, video = false, route = Route.BLUETOOTH))
        assertFalse(ProximityRule.holdWakeLock(active = true, video = false, route = Route.OTHER))
        assertFalse(ProximityRule.holdWakeLock(active = true, video = true, route = Route.EARPIECE))
        assertFalse(ProximityRule.holdWakeLock(active = false, video = false, route = Route.EARPIECE))
    }
}
