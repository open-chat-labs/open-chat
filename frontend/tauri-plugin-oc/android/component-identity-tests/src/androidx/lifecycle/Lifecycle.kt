package androidx.lifecycle

import fixtures.Probe

interface LifecycleOwner

interface DefaultLifecycleObserver {
    fun onStart(owner: LifecycleOwner) {}
    fun onStop(owner: LifecycleOwner) {}
}

class Lifecycle {
    fun addObserver(observer: DefaultLifecycleObserver) {
        Probe.events.add("lifecycle")
        Probe.observer = observer
    }
}

object ProcessLifecycleOwner : LifecycleOwner {
    val lifecycle = Lifecycle()
    fun get() = this
}
