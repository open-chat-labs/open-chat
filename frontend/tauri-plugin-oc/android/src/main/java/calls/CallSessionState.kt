package com.ocplugin.app.calls

// The in-call rules with no Android in them (#9559): which call is active, when the
// foreground service runs, and which foreground service types to ask for. CallSession is
// the adapter that drives Telecom, the service and the web layer from these answers.
class CallSessionState(private val graceMs: Long = STOP_GRACE_MS) {
    // What a native teardown does through the bridge: end a direct call for both sides, or
    // leave a group call. The web layer refreshes the token while the call runs.
    enum class TeardownKind { END, LEAVE }
    data class Teardown(val kind: TeardownKind, val token: String)

    data class Active(val id: CallId, val video: Boolean, val title: String, val startedAt: Long, val teardown: Teardown? = null)

    sealed class Ended {
        // The call this state was tracking ended; stop the service once the grace elapses.
        data class StopAfterGrace(val id: CallId, val at: Long) : Ended()
        // Nothing was active, or another call is: nothing to do.
        object Ignore : Ended()
    }

    @Volatile
    var active: Active? = null
        private set

    // When the last call ended, while the service is still up for the grace period.
    @Volatile
    private var endedAt: Long? = null

    // True when the service must be started (or re-issued) for this call. A call starting
    // inside the grace period of the previous one keeps the running service.
    @Synchronized
    fun started(id: CallId, video: Boolean, title: String, now: Long): Boolean {
        val current = active
        if (current != null && current.id == id) return false
        active = Active(id, video, title, now)
        endedAt = null
        return true
    }

    @Synchronized
    fun ended(id: CallId, now: Long): Ended {
        val current = active ?: return Ended.Ignore
        if (current.id != id) return Ended.Ignore
        active = null
        endedAt = now
        return Ended.StopAfterGrace(id, now)
    }

    @Synchronized
    fun setTeardown(id: CallId, teardown: Teardown): Boolean {
        val current = active ?: return false
        if (current.id != id) return false
        active = current.copy(teardown = teardown)
        return true
    }

    // Everything ends, whatever was active. For the paths where the web layer is gone.
    @Synchronized
    fun endAll(now: Long): Active? {
        val current = active ?: return null
        active = null
        endedAt = now
        return current
    }

    // Called when a grace timer fires: true only if no call started in the meantime.
    @Synchronized
    fun shouldStop(now: Long): Boolean {
        val ended = endedAt ?: return false
        if (active != null) return false
        return now - ended >= graceMs
    }

    companion object {
        const val STOP_GRACE_MS = 3_000L
    }
}

// The foreground service types to try, best first (#9559 invariant 3). The phone-call type
// needs no runtime permission, so it keeps the type non-empty when a one-time microphone
// grant has lapsed; Android 14+ refuses a media type whose runtime permission is not held,
// so those ride only on a grant. phoneCall is refused unless the platform agrees the app
// owns a call, so the second tier drops it. Screen share adds mediaProjection, whose grant
// is bound to the service, and it alone is the last resort.
object ServiceTypes {
    // android.content.pm.ServiceInfo constants, inlined here so the rule has no Android in it.
    const val PHONE_CALL = 4
    const val MICROPHONE = 128
    const val CAMERA = 64
    const val MEDIA_PROJECTION = 32

    fun tiers(sdk: Int, microphoneGranted: Boolean, cameraGranted: Boolean, sharing: Boolean): List<Int> {
        if (sdk < 29) return listOf(0)
        var full = PHONE_CALL
        if (microphoneGranted) full = full or MICROPHONE
        if (cameraGranted) full = full or CAMERA
        if (sharing) full = full or MEDIA_PROJECTION
        val tiers = mutableListOf(full)
        val noPhoneCall = full and PHONE_CALL.inv()
        if (noPhoneCall != 0) tiers.add(noPhoneCall)
        val projectionOnly = full and MEDIA_PROJECTION
        if (projectionOnly != 0) tiers.add(projectionOnly)
        return tiers.distinct()
    }
}
