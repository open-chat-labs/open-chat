package com.ocplugin.app.calls

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.telecom.CallAudioState
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.util.Log
import com.ocplugin.app.LOG_TAG
import java.util.concurrent.ConcurrentHashMap

// Self-managed Telecom integration: the phone account, incoming call reports, and the
// mapping from how a ring ended to the disconnect cause the call log records.
//
// A connection lives for the call (#9559): an answered ring goes active and stays until
// the web layer reports the call ended, and an outgoing call gets a connection of its own
// when the web layer reports it active. An answered connection that the web layer never
// claims is ended by a backstop, so nothing can leak.
object CallTelecom {
    private const val ACCOUNT_ID = "oc_self_managed"
    private const val ACCOUNT_LABEL = "OpenChat"

    @Volatile
    private var registered = false

    private val live = ConcurrentHashMap<CallId, CallConnection>()

    // Ends that arrived before Telecom created the connection. Applied on arrival.
    private val pendingEnd = ConcurrentHashMap<CallId, CallRegistry.End>()

    private fun handle(context: Context) = PhoneAccountHandle(
        ComponentName(context, CallConnectionService::class.java),
        ACCOUNT_ID,
    )

    fun ensureRegistered(context: Context) {
        if (registered || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        try {
            val tm = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            val account = PhoneAccount.builder(handle(context), ACCOUNT_LABEL)
                .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED)
                // The address is digits, so the dialler rebuilds a redial as tel:.
                .addSupportedUriScheme(PhoneAccount.SCHEME_TEL)
                .addSupportedUriScheme(PhoneAccount.SCHEME_SIP)
                .apply {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        // Telecom writes the call log rows itself, so no call log
                        // permission is needed and the user is never prompted.
                        setExtras(Bundle().apply {
                            putBoolean(PhoneAccount.EXTRA_LOG_SELF_MANAGED_CALLS, true)
                        })
                    }
                }
                .build()
            tm.registerPhoneAccount(account)
            registered = true
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Telecom phone account registration failed", e)
        }
    }

    // Asks Telecom to ring. True when it took the call, in which case the ring
    // notification is posted from the connection's onShowIncomingCallUi. False when
    // Telecom is unavailable or refused, and the caller posts the notification itself.
    fun reportIncoming(context: Context, call: IncomingCall): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
        ensureRegistered(context)
        if (!registered) return false
        return try {
            val tm = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            val extras = Bundle().apply {
                putBundle(TelecomManager.EXTRA_INCOMING_CALL_EXTRAS, call.toBundle())
                putParcelable(TelecomManager.EXTRA_INCOMING_CALL_ADDRESS, address(context, call.id.chat))
            }
            tm.addNewIncomingCall(handle(context), extras)
            true
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Telecom refused the incoming call", e)
            false
        }
    }

    // The address Telecom logs. An opaque handle and nothing else.
    private fun address(context: Context, chat: CallChat): Uri =
        Uri.fromParts(PhoneAccount.SCHEME_TEL, CallHandleDirectory.token(context, chat), null)

    fun end(id: CallId, end: CallRegistry.End) {
        if (end == CallRegistry.End.ANSWERED_HERE) {
            // The ring ended by an answer here: the connection carries on into the call.
            val connection = live[id]
            if (connection == null) pendingEnd[id] = end else connection.answered()
            return
        }
        val connection = live.remove(id)
        if (connection == null) {
            pendingEnd[id] = end
            return
        }
        connection.finish(end)
    }

    // The web layer claimed the call: the connection goes active. False when Telecom holds
    // no connection for it, which is the case for an outgoing call.
    fun activate(id: CallId): Boolean {
        val connection = live[id] ?: return false
        connection.activate()
        return true
    }

    // An outgoing call the web layer started. Telecom asks the connection service for the
    // connection, which is marked as ours through the extras; a request without that mark is
    // a dialler redial and is handled as one.
    fun placeOutgoing(context: Context, call: IncomingCall, video: Boolean) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        ensureRegistered(context)
        if (!registered) return
        try {
            val tm = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            if (!tm.isOutgoingCallPermitted(handle(context))) {
                Log.w(LOG_TAG, "Telecom does not permit an outgoing call now")
                return
            }
            val extras = Bundle().apply {
                putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, handle(context))
                putBundle(TelecomManager.EXTRA_OUTGOING_CALL_EXTRAS, call.toBundle().apply { putBoolean(EXTRA_OC_OUTGOING, true) })
                putInt(
                    TelecomManager.EXTRA_START_CALL_WITH_VIDEO_STATE,
                    if (video) android.telecom.VideoProfile.STATE_BIDIRECTIONAL else android.telecom.VideoProfile.STATE_AUDIO_ONLY,
                )
            }
            tm.placeCall(address(context, call.id.chat), extras)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Telecom refused the outgoing call", e)
        }
    }

    // The app's route request: the connect-time default, or a user's tap.
    fun setSpeaker(id: CallId, speaker: Boolean, isDefault: Boolean) {
        live[id]?.setSpeaker(speaker, isDefault)
    }

    fun endAll(end: CallRegistry.End) {
        val all = live.values.toList()
        live.clear()
        pendingEnd.clear()
        all.forEach { it.finish(end) }
    }

    const val EXTRA_OC_OUTGOING = "oc_outgoing_call"

    internal fun register(connection: CallConnection) {
        val id = connection.call.id
        val early = pendingEnd.remove(id)
        if (early != null) {
            connection.finish(early)
            return
        }
        live[id] = connection
    }

    internal fun unregister(id: CallId) {
        live.remove(id)
    }

    // What the call log records for each end.
    fun disconnectCode(end: CallRegistry.End): Int = when (end) {
        CallRegistry.End.MISSED -> DisconnectCause.MISSED
        CallRegistry.End.REJECTED -> DisconnectCause.REJECTED
        CallRegistry.End.ANSWERED_ELSEWHERE -> DisconnectCause.ANSWERED_ELSEWHERE
        CallRegistry.End.DECLINED_ELSEWHERE -> DisconnectCause.REJECTED
        CallRegistry.End.ANSWERED_HERE -> DisconnectCause.LOCAL
        CallRegistry.End.HUNG_UP -> DisconnectCause.LOCAL
    }
}

class CallConnectionService : ConnectionService() {
    override fun onCreateIncomingConnection(
        account: PhoneAccountHandle?,
        request: ConnectionRequest,
    ): Connection {
        // The extras reach here either flat or nested under EXTRA_INCOMING_CALL_EXTRAS,
        // depending on the Android version. Failing both, the registry still knows
        // which call is ringing for this address.
        val extras = request.extras
        val call = IncomingCall.fromBundle(extras)
            ?: IncomingCall.fromBundle(extras?.getBundle(TelecomManager.EXTRA_INCOMING_CALL_EXTRAS))
            ?: CallRinger.ringingFor(applicationContext, request.address?.toString())
        if (call == null) {
            Log.w(LOG_TAG, "Incoming connection without a call; extras keys=${extras?.keySet()}")
            return Connection.createFailedConnection(DisconnectCause(DisconnectCause.ERROR, "no call"))
        }
        val connection = CallConnection(applicationContext, call, request.address)
        connection.setRinging()
        CallTelecom.register(connection)
        return connection
    }

    override fun onCreateIncomingConnectionFailed(account: PhoneAccountHandle?, request: ConnectionRequest?) {
        // Telecom would not ring. Fall back to the plain notification, which Android 14
        // shows as a heads-up.
        IncomingCall.fromBundle(request?.extras)?.let { CallRinger.telecomRefused(applicationContext, it) }
    }

    // Either our own outgoing call (marked in the extras) or a call log redial. A redial
    // resolves the handle and hands the web layer a call to start; its bare connection is
    // cancelled and the real one placed once the web layer reports the call active.
    override fun onCreateOutgoingConnection(
        account: PhoneAccountHandle?,
        request: ConnectionRequest,
    ): Connection {
        val extras = request.extras
        if (extras?.getBoolean(CallTelecom.EXTRA_OC_OUTGOING) == true) {
            val call = IncomingCall.fromBundle(extras)
                ?: return Connection.createFailedConnection(DisconnectCause(DisconnectCause.ERROR, "no call"))
            val connection = CallConnection(applicationContext, call, request.address)
            connection.setDialing()
            CallTelecom.register(connection)
            // State changes made inside this callback are dropped; activate on the next loop.
            Handler(Looper.getMainLooper()).post { connection.activate() }
            return connection
        }
        val chat = CallHandleDirectory.chat(applicationContext, request.address?.toString())
            ?: return Connection.createFailedConnection(DisconnectCause(DisconnectCause.ERROR, "unknown call"))
        CallRinger.redial(applicationContext, chat)
        return Connection.createCanceledConnection()
    }
}

class CallConnection(private val context: Context, val call: IncomingCall, address: Uri?) : Connection() {
    @Volatile
    private var finished = false

    // The ring was answered here; the connection now belongs to the call.
    @Volatile
    private var answered = false

    private val main = Handler(Looper.getMainLooper())

    // Telecom owns the audio route; the policy decides what to ask it for.
    @Volatile
    private var lastAudioState: CallAudioState? = null

    @Volatile
    private var lastMuted: Boolean? = null

    private val routes = CallRoutePolicy(object : CallRoutePolicy.Port {
        override fun routeState(): CallRoutePolicy.RouteState? = lastAudioState?.let { routeStateOf(it) }
        override fun requestRoute(route: CallRoutePolicy.Route) {
            val code = when (route) {
                CallRoutePolicy.Route.SPEAKER -> CallAudioState.ROUTE_SPEAKER
                CallRoutePolicy.Route.EARPIECE -> CallAudioState.ROUTE_EARPIECE
                CallRoutePolicy.Route.BLUETOOTH -> CallAudioState.ROUTE_BLUETOOTH
                CallRoutePolicy.Route.OTHER -> return
            }
            try {
                setAudioRoute(code)
            } catch (e: Exception) {
                Log.w(LOG_TAG, "setAudioRoute refused", e)
            }
        }
        override fun isActive(): Boolean = state == STATE_ACTIVE
        override fun reflect(speaker: Boolean) {
            CallSession.routeReflected(context, call.id, speaker)
        }
    })

    // An answered connection the web layer never claims ends itself.
    private val claimBackstop = Runnable {
        if (!finished && answered && CallSession.state.active?.id != call.id) {
            Log.w(LOG_TAG, "Answered call never claimed by the web layer; ending")
            finish(CallRegistry.End.HUNG_UP)
        }
    }

    init {
        connectionProperties = PROPERTY_SELF_MANAGED
        audioModeIsVoip = true
        // The call log takes the address from the connection, not the request. Without
        // this the call has no handle and Telecom logs nothing.
        address?.let { setAddress(it, TelecomManager.PRESENTATION_ALLOWED) }
        setCallerDisplayName(call.title, TelecomManager.PRESENTATION_ALLOWED)
    }

    // The one point at which Android 14 and later grants a full-screen intent to an app
    // that is not the dialler, and only for a notification posted synchronously here.
    override fun onShowIncomingCallUi() {
        CallRinger.showRing(context, call)
    }

    // Answered from a system surface such as a headset. Same path as the ring activity's
    // Accept, minus the keyguard step: the main activity is behind the keyguard until
    // the user unlocks.
    override fun onAnswer() {
        CallRinger.accept(context, call)
    }

    override fun onAnswer(videoState: Int) = onAnswer()

    override fun onReject() {
        CallRinger.decline(context, call.id)
    }

    // A headset button, a car, or a cellular call taking over. While ringing it is a
    // decline; in the call it is a hang-up.
    override fun onDisconnect() {
        if (answered) CallSession.hangUp(context, call.id, "telecom") else CallRinger.decline(context, call.id)
    }

    override fun onAbort() {
        finish(if (answered) CallRegistry.End.HUNG_UP else CallRegistry.End.MISSED)
    }

    fun answered() {
        if (finished || answered) return
        answered = true
        setActive()
        main.postDelayed(claimBackstop, CLAIM_BACKSTOP_MS)
    }

    // The web layer is in the call.
    fun activate() {
        if (finished) return
        answered = true
        main.removeCallbacks(claimBackstop)
        if (state != STATE_ACTIVE) setActive()
        routes.reapply()
    }

    fun setSpeaker(speaker: Boolean, isDefault: Boolean) {
        if (!isDefault) routes.resetStompBudget()
        routes.apply(speaker, isDefault)
    }

    // The platform's view of the route and the system mute (a headset or car button).
    override fun onCallAudioStateChanged(state: CallAudioState?) {
        state ?: return
        lastAudioState = state
        routes.onRouteStateChanged(routeStateOf(state))
        if (answered && lastMuted != state.isMuted) {
            lastMuted = state.isMuted
            CallSession.muteReported(call.id, state.isMuted)
        }
    }

    private fun routeStateOf(state: CallAudioState): CallRoutePolicy.RouteState {
        val route = when (state.route) {
            CallAudioState.ROUTE_SPEAKER -> CallRoutePolicy.Route.SPEAKER
            CallAudioState.ROUTE_EARPIECE -> CallRoutePolicy.Route.EARPIECE
            CallAudioState.ROUTE_BLUETOOTH -> CallRoutePolicy.Route.BLUETOOTH
            else -> CallRoutePolicy.Route.OTHER
        }
        return CallRoutePolicy.RouteState(route, btDevices = state.supportedRouteMask and CallAudioState.ROUTE_BLUETOOTH != 0)
    }

    fun finish(end: CallRegistry.End) {
        if (finished) return
        finished = true
        main.removeCallbacks(claimBackstop)
        CallTelecom.unregister(call.id)
        setDisconnected(DisconnectCause(CallTelecom.disconnectCode(end)))
        destroy()
    }

    companion object {
        const val CLAIM_BACKSTOP_MS = 60_000L
    }
}
