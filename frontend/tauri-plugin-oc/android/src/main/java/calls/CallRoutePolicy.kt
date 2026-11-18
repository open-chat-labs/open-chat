package com.ocplugin.app.calls

// Which audio route a call asks for and when it fights for it (#9559 invariant 5), stated
// over a Port so the self-managed connection and a transactional call follow the same rule.
// Ported from big-chat's CallRoutePolicy. Pure: no Android types, so the orderings are
// unit-tested.
class CallRoutePolicy(private val port: Port) {
    // WIRED: a wired headset, which takes the earpiece's place while it's plugged in.
    enum class Route { SPEAKER, EARPIECE, WIRED, BLUETOOTH, OTHER }

    // What the platform last reported: the route in use, and whether any Bluetooth device
    // is usable.
    data class RouteState(val route: Route, val btDevices: Boolean)

    interface Port {
        // The latest platform state, or null before the platform has reported one.
        fun routeState(): RouteState?
        fun requestRoute(route: Route)
        fun isActive(): Boolean
        // Tell the session which route the call is on: the in-app speaker control and the
        // proximity lock follow it.
        fun reflect(route: Route)
    }

    // The route the app last asked for (true = speaker). The platform ignores a route until
    // the call is active, so it is cached and re-applied at activation.
    @Volatile
    private var desiredSpeaker: Boolean? = null

    // Whether desiredSpeaker is the connect-time default (speaker for video) rather than a
    // deliberate tap. Defaults yield to a Bluetooth headset; taps have absolute priority.
    @Volatile
    private var desiredIsDefault = false

    // What the connect-time default was, remembered after it yields to Bluetooth, so a
    // Bluetooth disconnect mid-call can restore it instead of stranding a video call on
    // the earpiece.
    @Volatile
    private var defaultRouteSpeaker: Boolean? = null

    // Whether the last state had any Bluetooth involvement, to see a mid-call disconnect.
    @Volatile
    private var hadBt = false

    // The user picked the phone (the earpiece, or a wired headset in its place) from the output
    // menu while a Bluetooth device could take the call: it stays on the phone, and is asked
    // back from Bluetooth if a device grabs it.
    @Volatile
    private var preferPhone = false

    // How many times the current route intent has been re-asserted over an external stomp.
    @Volatile
    private var routeReasserts = 0

    private fun btAvailable(): Boolean {
        val state = port.routeState() ?: return false
        return state.route == Route.BLUETOOTH || state.btDevices
    }

    // A route request from the app. isDefault: the connect-time default, not a user tap.
    fun apply(speaker: Boolean, isDefault: Boolean = false) {
        if (isDefault) defaultRouteSpeaker = speaker
        if (isDefault && btAvailable()) {
            desiredSpeaker = null
            desiredIsDefault = false
            return
        }
        desiredSpeaker = speaker
        desiredIsDefault = isDefault
        port.requestRoute(
            when {
                speaker -> Route.SPEAKER
                btAvailable() && !preferPhone -> Route.BLUETOOTH
                else -> Route.EARPIECE
            },
        )
    }

    // The user picked this output from the output menu (headphones connected): it has the
    // same absolute priority as a speaker tap. The phone is asked for as the earpiece, which
    // the platform gives to a wired headset when one is plugged in.
    fun choose(route: Route) {
        resetStompBudget()
        when (route) {
            Route.SPEAKER -> {
                preferPhone = false
                apply(speaker = true)
            }
            Route.BLUETOOTH -> {
                preferPhone = false
                desiredSpeaker = false
                desiredIsDefault = false
                port.requestRoute(Route.BLUETOOTH)
            }
            Route.EARPIECE, Route.WIRED -> {
                preferPhone = true
                desiredSpeaker = false
                desiredIsDefault = false
                port.requestRoute(Route.EARPIECE)
            }
            Route.OTHER -> Unit
        }
    }

    // The call went active: the platform honours routes now, so ask again.
    fun reapply() {
        desiredSpeaker?.let { apply(it, desiredIsDefault) }
    }

    // A new request from the app gets a full budget; the reassert path never resets its own.
    fun resetStompBudget() {
        routeReasserts = 0
    }

    // The platform's route state changed.
    fun onRouteStateChanged(state: RouteState) {
        val speakerNow = state.route == Route.SPEAKER
        val basicRoute = speakerNow || state.route == Route.EARPIECE
        // A default that got in before the state was known yields the moment a Bluetooth
        // device shows.
        if (desiredIsDefault && state.btDevices) {
            desiredIsDefault = false
            desiredSpeaker = null
            port.requestRoute(Route.BLUETOOTH)
            return
        }
        // Bluetooth vanished mid-call and the user never chose a route: restore the default.
        val btNow = state.route == Route.BLUETOOTH || state.btDevices
        if (hadBt && !btNow && desiredSpeaker == null && defaultRouteSpeaker == true) {
            hadBt = false
            port.requestRoute(Route.SPEAKER)
            return
        }
        hadBt = btNow
        val desired = desiredSpeaker
        // Bluetooth took the call from the phone the user picked: ask for the phone back.
        if (preferPhone && desired == false && state.route == Route.BLUETOOTH &&
            routeReasserts < MAX_ROUTE_REASSERTS && port.isActive()
        ) {
            routeReasserts++
            port.requestRoute(Route.EARPIECE)
            return
        }
        if (routeReasserts < MAX_ROUTE_REASSERTS && basicRoute && desired != null && desired != speakerNow) {
            routeReasserts++
            if (port.isActive()) apply(desired)
            return
        }
        // Pre-active states are baseline noise; reflect only what an active call routes.
        if (!port.isActive()) return
        port.reflect(state.route)
    }

    companion object {
        const val MAX_ROUTE_REASSERTS = 6
    }
}

// The proximity sensor darkens the screen only for a voice call held to the ear, which is
// the earpiece route and no other (#9559 invariant 6). Pure.
object ProximityRule {
    fun holdWakeLock(active: Boolean, video: Boolean, route: CallRoutePolicy.Route): Boolean =
        active && !video && route == CallRoutePolicy.Route.EARPIECE
}
