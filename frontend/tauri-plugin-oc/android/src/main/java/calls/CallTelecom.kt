package com.ocplugin.app.calls

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
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
// A connection in this milestone never outlives the ring. An accepted call goes active
// and disconnects at once, so the log shows an answered call and nothing can leak; the
// in-call milestone keeps it alive for the call.
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
        val connection = live.remove(id)
        if (connection == null) {
            pendingEnd[id] = end
            return
        }
        connection.finish(end)
    }

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

    // A call log redial. The address is one of our handles; resolve it and hand the web
    // layer a call to start. No outgoing connection lives in this milestone.
    override fun onCreateOutgoingConnection(
        account: PhoneAccountHandle?,
        request: ConnectionRequest,
    ): Connection {
        val chat = CallHandleDirectory.chat(applicationContext, request.address?.toString())
            ?: return Connection.createFailedConnection(DisconnectCause(DisconnectCause.ERROR, "unknown call"))
        CallRinger.redial(applicationContext, chat)
        return Connection.createCanceledConnection()
    }
}

class CallConnection(private val context: Context, val call: IncomingCall, address: Uri?) : Connection() {
    @Volatile
    private var finished = false

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

    override fun onDisconnect() {
        CallRinger.decline(context, call.id)
    }

    override fun onAbort() {
        finish(CallRegistry.End.MISSED)
    }

    fun finish(end: CallRegistry.End) {
        if (finished) return
        finished = true
        CallTelecom.unregister(call.id)
        if (end == CallRegistry.End.ANSWERED_HERE) setActive()
        setDisconnected(DisconnectCause(CallTelecom.disconnectCode(end)))
        destroy()
    }
}
