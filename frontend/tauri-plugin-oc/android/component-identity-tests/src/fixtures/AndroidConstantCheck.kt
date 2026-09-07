package fixtures

import android.app.PendingIntent
import android.content.Intent
import android.os.Build

// Compiled separately against the real android.jar, without the Android doubles.
// These constants are inlined by Kotlin and can then be checked on the host JVM.
object AndroidConstantCheck {
    @JvmStatic
    fun main(args: Array<String>) {
        check(PendingIntent.FLAG_UPDATE_CURRENT == 0x08000000)
        check(PendingIntent.FLAG_IMMUTABLE == 0x04000000)
        check(Intent.FLAG_ACTIVITY_NEW_TASK == 0x10000000)
        check(Intent.FLAG_ACTIVITY_CLEAR_TOP == 0x04000000)
        check(Intent.FLAG_ACTIVITY_SINGLE_TOP == 0x20000000)
        check(Intent.ACTION_VIEW == "android.intent.action.VIEW")
        check(Build.VERSION_CODES.M == 23)
        println("PASS: seven host-double constants match the real Android SDK")
    }
}
