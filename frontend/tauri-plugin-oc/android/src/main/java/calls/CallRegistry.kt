package com.ocplugin.app.calls

// The ring rules, keyed on chat plus call message id, with no Android in them.
//
// Telecom, the ring notification and the ring activity are adapters around this. It decides
// whether a push rings, which dismissal applies to which call, when a call is missed and
// how the call log should record the end. All methods are synchronised; callers arrive from
// the FCM service, Telecom callbacks, the notification actions and the web layer.
class CallRegistry(
    private val ringWindowMs: Long = RING_WINDOW_MS,
    private val rememberLimit: Int = 100,
) {
    // How a ring ended. Mapped to a Telecom disconnect cause by the adapter. Only a
    // missed call posts the missed call notification.
    enum class End(val postsMissedCall: Boolean) {
        // Ring window elapsed, or the caller hung up while it rang. A missed call.
        MISSED(true),
        // Declined on this device.
        REJECTED(false),
        // Answered on another of the user's devices.
        ANSWERED_ELSEWHERE(false),
        // Declined on another of the user's devices.
        DECLINED_ELSEWHERE(false),
        // Answered on this device, from the ring screen, Telecom, or inside the app.
        ANSWERED_HERE(false),
        // An active call ended, from either side (#9559). Never a ring's end.
        HUNG_UP(false),
    }

    sealed class Started {
        // Ring until the deadline, in the same clock as `now`.
        data class Ring(val call: IncomingCall, val deadline: Long) : Started()
        // Too late to ring, or the caller had already hung up. A missed call.
        data class Missed(val call: IncomingCall) : Started()
        // Already rung, answered or dismissed. Nothing.
        object Ignore : Started()
    }

    private val ringing = LinkedHashMap<CallId, IncomingCall>()

    // Calls this device has finished with, whatever the outcome, so a repeated `started`
    // push does nothing. Bounded, oldest evicted first.
    private val finished = LinkedHashSet<CallId>()

    // Dismissals that arrived before their `started`. FCM does not order pushes.
    private val earlyDismissals = LinkedHashMap<CallId, DismissalKind>()

    // Calls whose ring notification has been posted. It is posted at most once: an
    // update stops the insistent ringtone.
    private val notified = LinkedHashSet<CallId>()

    // The shell rings natively whether or not the app is on screen; the web layer never
    // rings in the Android shell.
    @Synchronized
    fun started(call: IncomingCall, now: Long): Started {
        if (call.id in ringing || call.id in finished) return Started.Ignore
        val early = earlyDismissals.remove(call.id)
        if (early != null) {
            remember(call.id)
            return if (early == DismissalKind.ENDED) Started.Missed(call) else Started.Ignore
        }
        // A start timestamp ahead of this clock rings for the full window.
        val startedAt = minOf(call.started, now)
        val deadline = startedAt + ringWindowMs
        if (deadline <= now) {
            remember(call.id)
            return Started.Missed(call)
        }
        ringing[call.id] = call
        return Started.Ring(call, deadline)
    }

    // Returns how the ring ended, or null when nothing was ringing for that exact call.
    @Synchronized
    fun dismissed(dismissal: CallDismissal): End? {
        val id = dismissal.id
        if (id !in ringing) {
            if (id !in finished) earlyDismissals[id] = dismissal.kind
            trimEarly()
            return null
        }
        return end(
            id,
            when (dismissal.kind) {
                DismissalKind.ENDED -> End.MISSED
                DismissalKind.ANSWERED_ELSEWHERE -> End.ANSWERED_ELSEWHERE
                DismissalKind.DECLINED_ELSEWHERE -> End.DECLINED_ELSEWHERE
            },
        )
    }

    // Each returns how the ring ended, or null when the call was not ringing here.
    @Synchronized
    fun accepted(id: CallId): End? = end(id, End.ANSWERED_HERE)

    @Synchronized
    fun declined(id: CallId): End? = end(id, End.REJECTED)

    @Synchronized
    fun timedOut(id: CallId): End? = end(id, End.MISSED)

    // True the first time only, and only while the call is ringing.
    @Synchronized
    fun shouldPostRing(id: CallId): Boolean {
        if (id !in ringing || id in notified) return false
        notified.add(id)
        while (notified.size > rememberLimit) notified.remove(notified.first())
        return true
    }

    // Joined from inside the app while ringing here: answered on this device.
    @Synchronized
    fun joinedInApp(messageId: String): CallId? {
        val id = ringing.keys.firstOrNull { it.messageId == messageId } ?: return null
        end(id, End.ANSWERED_HERE)
        return id
    }

    @Synchronized
    fun ringing(id: CallId): IncomingCall? = ringing[id]

    @Synchronized
    fun ringingCalls(): List<IncomingCall> = ringing.values.toList()

    private fun end(id: CallId, end: End): End? {
        ringing.remove(id) ?: return null
        remember(id)
        return end
    }

    private fun remember(id: CallId) {
        finished.add(id)
        while (finished.size > rememberLimit) finished.remove(finished.first())
    }

    private fun trimEarly() {
        while (earlyDismissals.size > rememberLimit) earlyDismissals.remove(earlyDismissals.keys.first())
    }

    companion object {
        const val RING_WINDOW_MS = 40_000L
    }
}
