package com.ocplugin.app.calls

import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.OutcomeReceiver
import android.telecom.CallAttributes
import android.telecom.CallControl
import android.telecom.CallControlCallback
import android.telecom.CallEndpoint
import android.telecom.CallEventCallback
import android.telecom.CallException
import android.telecom.DisconnectCause
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.util.Log
import androidx.annotation.RequiresApi
import com.ocplugin.app.LOG_TAG
import java.util.concurrent.Executor
import java.util.function.Consumer

// A call reported through Telecom's transactional API (TelecomManager.addCall) instead of
// a connection service Connection: the same contract towards CallTelecom and the session,
// over CallControl (#9559 decision 1). It exists for the call log: from Android 16 QPR2
// Telecom logs VoIP calls only when they are transactional and the package declares an
// ACTION_CALL_BACK activity. Ported from big-chat's TransactionalCall.
//
// What differs from CallConnection: creation is a callback, so ends and activations that
// beat it are parked in CallTelecom and applied on arrival; there is no onShowIncomingCallUi,
// so the ring is posted when the call is added; answer and setActive are asynchronous, so
// the route is re-applied when Telecom confirms; disconnect accepts only four causes.
@RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
class TransactionalCall(
    private val context: Context,
    override val call: IncomingCall,
    private val incoming: Boolean,
    private val video: Boolean,
) : TelecomCall {
    private val executor: Executor = context.mainExecutor

    @Volatile
    private var control: CallControl? = null

    @Volatile
    private var ended = false

    // answer/setActive asked for. Dropped again if Telecom refuses, so a later activate retries.
    @Volatile
    private var activeRequested = false

    // Answered as far as the call log is concerned. Sticky: set when the accept is asked
    // for, not when Telecom confirms it.
    @Volatile
    override var answered = false
        private set

    // Telecom confirmed the call active, or made it so itself from a headset's answer.
    @Volatile
    private var active = false

    @Volatile
    private var endpoint: CallEndpoint? = null

    @Volatile
    private var endpoints: List<CallEndpoint> = emptyList()

    @Volatile
    private var lastMuted: Boolean? = null

    private val routes = CallRoutePolicy(object : CallRoutePolicy.Port {
        override fun routeState(): CallRoutePolicy.RouteState? {
            val current = endpoint
            if (current == null && endpoints.isEmpty()) return null
            return CallRoutePolicy.RouteState(
                route = current?.let { routeOf(it) } ?: CallRoutePolicy.Route.OTHER,
                btDevices = endpoints.any { it.endpointType == CallEndpoint.TYPE_BLUETOOTH },
            )
        }
        override fun requestRoute(route: CallRoutePolicy.Route) = requestEndpoint(route)
        override fun isActive(): Boolean = active
        override fun reflect(route: CallRoutePolicy.Route) = CallSession.routeReflected(context, call.id, route)
    })

    // Report the call. Throws what addCall throws; the caller falls back to the connection service.
    fun add(tm: TelecomManager, account: PhoneAccountHandle, address: Uri) {
        val attributes = CallAttributes.Builder(
            account,
            if (incoming) CallAttributes.DIRECTION_INCOMING else CallAttributes.DIRECTION_OUTGOING,
            // What the call log shows. Never blank: a row with no name falls back to the
            // opaque address, which means nothing to anyone.
            call.title.ifBlank { "OpenChat" },
            address,
        )
            .setCallType(if (video) CallAttributes.VIDEO_CALL else CallAttributes.AUDIO_CALL)
            .setCallCapabilities(if (video) CallAttributes.SUPPORTS_VIDEO_CALLING else 0)
            .build()
        tm.addCall(
            attributes,
            executor,
            object : OutcomeReceiver<CallControl, CallException> {
                override fun onResult(result: CallControl) = onAdded(result)
                override fun onError(error: CallException) = onAddFailed(error)
            },
            handshakes,
            events,
        )
    }

    private fun onAdded(result: CallControl) {
        control = result
        CallTelecom.register(this)
        if (ended) return
        if (incoming) {
            // No onShowIncomingCallUi on this path: the ring is posted here.
            CallRinger.showRing(context, call)
        } else {
            activate()
        }
    }

    private fun onAddFailed(error: CallException) {
        Log.w(LOG_TAG, "Telecom refused the transactional call: ${error.code}")
        ended = true
        CallTelecom.unregister(call.id)
        if (incoming) CallRinger.telecomRefused(context, call)
    }

    override fun answered() {
        if (ended) return
        answered = true
        activate()
    }

    override fun activate() {
        val control = control ?: return
        if (ended) return
        answered = true
        if (activeRequested) {
            if (active) routes.reapply()
            return
        }
        activeRequested = true
        val done = object : OutcomeReceiver<Void, CallException> {
            override fun onResult(result: Void?) {
                active = true
                routes.reapply()
            }
            override fun onError(error: CallException) {
                Log.w(LOG_TAG, "Telecom refused to activate the call: ${error.code}")
                activeRequested = false
            }
        }
        try {
            if (incoming) {
                control.answer(if (video) CallAttributes.VIDEO_CALL else CallAttributes.AUDIO_CALL, executor, done)
            } else {
                control.setActive(executor, done)
            }
        } catch (e: Exception) {
            activeRequested = false
            Log.w(LOG_TAG, "Telecom activation failed", e)
        }
    }

    override fun setSpeaker(speaker: Boolean, isDefault: Boolean) {
        if (!isDefault) routes.resetStompBudget()
        routes.apply(speaker, isDefault)
    }

    override fun finish(end: CallRegistry.End) {
        if (!finishLocally()) return
        val code = CallTelecom.transactionalDisconnectCode(end, answered)
        try {
            control?.disconnect(
                DisconnectCause(code),
                executor,
                object : OutcomeReceiver<Void, CallException> {
                    override fun onResult(result: Void?) {}
                    override fun onError(error: CallException) {
                        Log.w(LOG_TAG, "Telecom refused the disconnect: ${error.code}")
                    }
                },
            )
        } catch (e: Exception) {
            Log.w(LOG_TAG, "Telecom disconnect failed", e)
        }
    }

    // Everything an end does on our side, once. False if already ended.
    @Synchronized
    private fun finishLocally(): Boolean {
        if (ended) return false
        ended = true
        CallTelecom.unregister(call.id)
        return true
    }

    private fun requestEndpoint(route: CallRoutePolicy.Route) {
        val control = control ?: return
        val wanted = when (route) {
            CallRoutePolicy.Route.SPEAKER -> CallEndpoint.TYPE_SPEAKER
            CallRoutePolicy.Route.EARPIECE -> CallEndpoint.TYPE_EARPIECE
            CallRoutePolicy.Route.BLUETOOTH -> CallEndpoint.TYPE_BLUETOOTH
            CallRoutePolicy.Route.OTHER -> return
        }
        // Not listed yet, or not on this device: dropped, and asked for again at activation
        // or when the platform next reports the other basic route.
        val target = endpoint?.takeIf { it.endpointType == wanted }
            ?: endpoints.firstOrNull { it.endpointType == wanted }
        if (target == null) {
            Log.w(LOG_TAG, "No $route endpoint among ${endpoints.map { it.endpointType }}")
            return
        }
        Log.i(LOG_TAG, "Asking Telecom for endpoint ${target.endpointName} ($route)")
        try {
            control.requestCallEndpointChange(
                target,
                executor,
                object : OutcomeReceiver<Void, CallException> {
                    override fun onResult(result: Void?) {}
                    override fun onError(error: CallException) {
                        Log.w(LOG_TAG, "Route $route refused: ${error.code}")
                    }
                },
            )
        } catch (e: Exception) {
            Log.w(LOG_TAG, "requestCallEndpointChange failed", e)
        }
    }

    private fun routeOf(endpoint: CallEndpoint): CallRoutePolicy.Route = when (endpoint.endpointType) {
        CallEndpoint.TYPE_SPEAKER -> CallRoutePolicy.Route.SPEAKER
        CallEndpoint.TYPE_EARPIECE -> CallRoutePolicy.Route.EARPIECE
        CallEndpoint.TYPE_BLUETOOTH -> CallRoutePolicy.Route.BLUETOOTH
        else -> CallRoutePolicy.Route.OTHER
    }

    private fun routeStateChanged() {
        if (ended) return
        val current = endpoint
        // The endpoints can be listed before the one in use is named; worth evaluating so a
        // headset shows to a speaker default, but only while nothing can be reflected.
        if (current == null && active) return
        routes.onRouteStateChanged(
            CallRoutePolicy.RouteState(
                route = current?.let { routeOf(it) } ?: CallRoutePolicy.Route.OTHER,
                btDevices = endpoints.any { it.endpointType == CallEndpoint.TYPE_BLUETOOTH },
            ),
        )
    }

    // Telecom asking us to change the call, from a surface that is not this app: a headset
    // button, a car, a cellular call taking over. Each must be answered through its
    // Consumer, or Telecom times the request out.
    private val handshakes = object : CallControlCallback {
        override fun onSetActive(wasCompleted: Consumer<Boolean>) {
            answered = true
            activeRequested = true
            active = true
            wasCompleted.accept(true)
            routes.reapply()
        }

        // Hold is not something an OpenChat call can do.
        override fun onSetInactive(wasCompleted: Consumer<Boolean>) = wasCompleted.accept(false)

        // As CallConnection.onAnswer: Telecom makes the call active, the web layer has to
        // actually join. Accepted first: refused, Telecom holds the call for its timeout and
        // then logs it as declined, which is not what the user did.
        override fun onAnswer(videoState: Int, wasCompleted: Consumer<Boolean>) {
            answered = true
            activeRequested = true
            active = true
            wasCompleted.accept(true)
            CallRinger.accept(context, call)
            routes.reapply()
        }

        // As CallConnection.onReject / onDisconnect, told apart by the cause. Telecom
        // disconnects the call itself once this is accepted; only our side is finished here.
        override fun onDisconnect(cause: DisconnectCause, wasCompleted: Consumer<Boolean>) {
            val wasAnswered = answered
            finishLocally()
            wasCompleted.accept(true)
            if (wasAnswered) {
                CallSession.hangUp(context, call.id, "telecom")
            } else {
                CallRinger.decline(context, call.id)
            }
        }

        override fun onCallStreamingStarted(wasCompleted: Consumer<Boolean>) = wasCompleted.accept(false)
    }

    private val events = object : CallEventCallback {
        override fun onCallEndpointChanged(newCallEndpoint: CallEndpoint) {
            endpoint = newCallEndpoint
            routeStateChanged()
        }

        override fun onAvailableCallEndpointsChanged(availableEndpoints: List<CallEndpoint>) {
            endpoints = availableEndpoints
            routeStateChanged()
        }

        override fun onMuteStateChanged(isMuted: Boolean) {
            if (answered && lastMuted != isMuted) {
                lastMuted = isMuted
                CallSession.muteReported(call.id, isMuted)
            }
        }

        override fun onCallStreamingFailed(reason: Int) {}
        override fun onEvent(event: String, extras: Bundle) {}
    }
}
