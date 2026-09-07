package fixtures

import android.content.Context
import androidx.lifecycle.DefaultLifecycleObserver

object Probe {
    var applicationId = "test.installed.application"
    var activityConstructions = 0
    val events = mutableListOf<String>()
    var observer: DefaultLifecycleObserver? = null
    var onFirebase: ((Context) -> Unit)? = null
    var onDatabase: ((Context) -> Unit)? = null
}
