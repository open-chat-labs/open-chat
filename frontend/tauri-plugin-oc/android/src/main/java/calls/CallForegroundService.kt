package com.ocplugin.app.calls

import android.Manifest
import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.R

// Keeps the process and its WebView alive while a call is active (#9559). Without a
// microphone-typed service Android silence-fills this app's capture the moment the screen
// locks, so the type is chosen at runtime by ServiceTypes.tiers and every tier is tried.
// Shows the ongoing-call notification: CallStyle with a chronometer and a hang-up action,
// on a silent channel of its own.
class CallForegroundService : Service() {
    private val main = Handler(Looper.getMainLooper())

    @Volatile
    private var isForeground = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopNow()
                return START_NOT_STICKY
            }
            ACTION_START, ACTION_REFRESH -> {
                // A start redelivered to a fresh process after a crash names a call the
                // session no longer has: stop without posting (found on the device: the
                // system rejected that notification and killed the process again).
                val call = IncomingCall.fromBundle(intent.getBundleExtra(EXTRA_CALL))
                if (call == null || CallSession.state.active?.id != call.id) {
                    Log.w(LOG_TAG, "Call service started for a call that is not active; stopping")
                    stopNow()
                    return START_NOT_STICKY
                }
                val title = intent.getStringExtra(EXTRA_TITLE) ?: "Call in progress"
                val startedAt = intent.getLongExtra(EXTRA_STARTED_AT, System.currentTimeMillis())
                val sharing = intent.getBooleanExtra(EXTRA_SHARING, false)
                startForegroundCompat(title, startedAt, sharing, intent.getBundleExtra(EXTRA_CALL))
            }
            else -> {
                // A null intent: the system restarting the service after a crash.
                stopNow()
            }
        }
        return START_NOT_STICKY
    }

    private fun startForegroundCompat(title: String, startedAt: Long, sharing: Boolean, callBundle: android.os.Bundle?) {
        ensureChannel(this)
        val tiers = ServiceTypes.tiers(
            Build.VERSION.SDK_INT,
            microphoneGranted = held(Manifest.permission.RECORD_AUDIO),
            cameraGranted = held(Manifest.permission.CAMERA),
            sharing = sharing,
        )
        val notification = buildNotification(title, startedAt, callBundle)
        for (type in tiers) {
            try {
                ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
                isForeground = true
                Log.i(LOG_TAG, "Call service up, type=$type")
                return
            } catch (e: Exception) {
                Log.w(LOG_TAG, "startForeground refused type=$type", e)
            }
        }
        // A mid-call re-issue that the platform refused: the service is running with its
        // previous type, and tearing it down would drop a live call's service.
        if (isForeground) return
        Log.e(LOG_TAG, "Call service could not start with any type")
        stopSelf()
    }

    private fun held(permission: String) =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    private fun stopNow() {
        isForeground = false
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        isForeground = false
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    // The task was swiped away while a call ran. The WebView died with it, and nothing on
    // the web side will end the Telecom call or this service now. Only the call's own task
    // counts: a share or deep-link launch can host a second main activity in another task.
    // Re-checked on a short delay, since the removed task may still be listed when this runs.
    override fun onTaskRemoved(rootIntent: Intent?) {
        main.postDelayed({
            if (!CallSession.ownerTaskAlive(this)) {
                Log.i(LOG_TAG, "Call task removed; native teardown")
                CallSession.endAll(this)
            }
        }, TASK_REMOVED_RECHECK_MS)
        super.onTaskRemoved(rootIntent)
    }

    private fun buildNotification(title: String, startedAt: Long, callBundle: android.os.Bundle?): Notification {
        val person = Person.Builder().setName(title.ifBlank { "Ongoing call" }).setImportant(true).build()
        val hangUp = PendingIntent.getBroadcast(
            this,
            NOTIFICATION_ID,
            Intent(this, CallActionReceiver::class.java).apply {
                action = ACTION_HANG_UP
                callBundle?.let { putExtras(it) }
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setWhen(startedAt)
            .setUsesChronometer(true)
            .setShowWhen(true)
            .setSmallIcon(R.drawable.ic_notification_small)
            .setContentText("Call in progress")
            .setStyle(NotificationCompat.CallStyle.forOngoingCall(person, hangUp))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setSilent(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(returnToApp())
            .build()
    }

    private fun returnToApp(): PendingIntent? {
        val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return null
        launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        return PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    companion object {
        const val CHANNEL_ID = "oc_ongoing_call"
        const val NOTIFICATION_ID = 0x0C_CA11
        const val ACTION_START = "com.ocplugin.app.calls.SERVICE_START"
        const val ACTION_REFRESH = "com.ocplugin.app.calls.SERVICE_REFRESH"
        const val ACTION_STOP = "com.ocplugin.app.calls.SERVICE_STOP"
        const val ACTION_HANG_UP = "com.ocplugin.app.calls.HANG_UP"
        private const val EXTRA_TITLE = "oc_call_title"
        private const val EXTRA_STARTED_AT = "oc_call_started_at"
        private const val EXTRA_SHARING = "oc_call_sharing"
        private const val EXTRA_CALL = "oc_call"
        const val TASK_REMOVED_RECHECK_MS = 1_000L

        fun start(context: Context, call: IncomingCall, startedAt: Long, sharing: Boolean, refresh: Boolean = false) {
            val intent = Intent(context, CallForegroundService::class.java).apply {
                action = if (refresh) ACTION_REFRESH else ACTION_START
                putExtra(EXTRA_TITLE, call.title)
                putExtra(EXTRA_STARTED_AT, startedAt)
                putExtra(EXTRA_SHARING, sharing)
                putExtra(EXTRA_CALL, call.toBundle())
            }
            try {
                ContextCompat.startForegroundService(context, intent)
            } catch (e: Exception) {
                Log.e(LOG_TAG, "Could not start the call service", e)
            }
        }

        // stopService, not a start with a stop action: a start still pending when the
        // process dies is redelivered to a fresh process, which then has no call.
        fun stop(context: Context) {
            try {
                context.stopService(Intent(context, CallForegroundService::class.java))
            } catch (e: Exception) {
                // Not running, or the process is on its way out. Either way there is nothing to stop.
                Log.d(LOG_TAG, "Call service stop skipped: ${e.message}")
            }
        }

        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(CHANNEL_ID) != null) return
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Ongoing call", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "A call in progress"
                    setSound(null, null)
                    enableVibration(false)
                    setShowBadge(false)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                },
            )
        }

        fun taskAlive(context: Context, taskId: Int): Boolean {
            if (taskId < 0) return false
            val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            return am.appTasks.any { it.taskInfo.taskId == taskId }
        }
    }
}
