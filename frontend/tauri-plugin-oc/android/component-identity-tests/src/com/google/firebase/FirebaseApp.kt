package com.google.firebase

import android.content.Context
import fixtures.Probe

class FirebaseApp(val name: String) {
    companion object {
        fun initializeApp(context: Context): FirebaseApp? {
            Probe.events.add("firebase")
            Probe.onFirebase?.invoke(context)
            return FirebaseApp("test")
        }
    }
}
