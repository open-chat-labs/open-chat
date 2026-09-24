package com.ocplugin.app.calls

import com.ocplugin.app.data.Notification
import com.ocplugin.app.decoders.NotificationDecoder

// Where a push goes. Pure, so the rule that a call rings natively whether or not the app
// is on screen is a tested fact rather than a branch in the notification manager.
sealed class PushRoute {
    data class Dismissal(val dismissal: CallDismissal) : PushRoute()

    // A call to ring, on screen or not.
    data class Ring(val notification: Notification, val facts: CallFacts) : PushRoute()

    // An ordinary message: to the web layer when the app is on screen, else a notification.
    data class Message(val notification: Notification, val appOnScreen: Boolean) : PushRoute()

    object Drop : PushRoute()
}

object PushRouting {
    fun route(data: Map<String, String>, appOnScreen: Boolean): PushRoute {
        NotificationDecoder.decodeCallDismissal(data)?.let { return PushRoute.Dismissal(it) }
        val notification = NotificationDecoder.decode(data) ?: return PushRoute.Drop
        NotificationDecoder.decodeCallFacts(data)?.let { return PushRoute.Ring(notification, it) }
        return PushRoute.Message(notification, appOnScreen)
    }
}
