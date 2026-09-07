package com.ocplugin.app.data

import android.content.Context
import fixtures.Probe

data class Notification(val id: Long, val payload: String)

object NotificationCompanion {
    fun toJSObject(notification: Notification): Any = object {
        override fun toString() = notification.payload
    }
}

object AppDb {
    fun init(context: Context) {
        Probe.events.add("database")
        Probe.onDatabase?.invoke(context)
    }
}
