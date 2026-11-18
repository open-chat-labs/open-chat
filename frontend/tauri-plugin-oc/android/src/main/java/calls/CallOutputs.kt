package com.ocplugin.app.calls

import com.ocplugin.app.calls.CallRoutePolicy.Route

// The outputs a call can be put on, as the in-app output menu lists them (N14, #10382): the
// speaker, the phone (the earpiece, or a wired headset in its place) and a Bluetooth device,
// in that order, each once. Pure, so the listing is unit-tested.
object CallOutputs {
    data class Output(val route: Route, val name: String?)

    fun of(routes: Collection<Route>, bluetoothName: String?): List<Output> {
        val outputs = mutableListOf<Output>()
        if (Route.SPEAKER in routes) outputs += Output(Route.SPEAKER, null)
        if (Route.WIRED in routes) {
            outputs += Output(Route.WIRED, null)
        } else if (Route.EARPIECE in routes) {
            outputs += Output(Route.EARPIECE, null)
        }
        if (Route.BLUETOOTH in routes) outputs += Output(Route.BLUETOOTH, bluetoothName?.ifBlank { null })
        return outputs
    }

    // How the web layer names a route.
    fun wireName(route: Route): String = route.name.lowercase()

    // What the web layer asks for, by that name; null for anything else.
    fun routeOf(name: String?): Route? = when (name) {
        "speaker" -> Route.SPEAKER
        "earpiece" -> Route.EARPIECE
        "wired" -> Route.WIRED
        "bluetooth" -> Route.BLUETOOTH
        else -> null
    }
}
