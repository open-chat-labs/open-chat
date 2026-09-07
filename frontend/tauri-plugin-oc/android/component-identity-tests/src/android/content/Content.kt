package android.content

import fixtures.Probe

// Host contract doubles, not an Android runtime or a PendingIntent implementation.
open class Context(open val packageName: String = Probe.applicationId)

abstract class BroadcastReceiver {
    abstract fun onReceive(context: Context, intent: Intent)
}

data class ComponentName(val packageName: String, val className: String)

class Intent(context: Context, target: Class<*>) {
    val component = ComponentName(context.packageName, target.name)
    var flags: Int = 0
    var action: String? = null
    val extras = linkedMapOf<String, Any>()

    fun putExtra(key: String, value: String): Intent = apply { extras[key] = value }
    fun putExtra(key: String, value: Boolean): Intent = apply { extras[key] = value }

    companion object {
        const val FLAG_ACTIVITY_NEW_TASK = 0x10000000
        const val FLAG_ACTIVITY_CLEAR_TOP = 0x04000000
        const val FLAG_ACTIVITY_SINGLE_TOP = 0x20000000
        const val ACTION_VIEW = "android.intent.action.VIEW"
    }
}
