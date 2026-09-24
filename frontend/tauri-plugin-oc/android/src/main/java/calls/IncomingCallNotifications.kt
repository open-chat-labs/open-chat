package com.ocplugin.app.calls

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.media.AudioAttributes
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.OCPluginCompanion
import com.ocplugin.app.R

// The ring notification: CallStyle, full-screen intent to the ring activity, Accept and
// Decline actions. The channel carries the ringtone and vibration and the notification is
// insistent, so the system loops the ring until the notification is cancelled. The app
// cannot play the ringtone itself: Android 15+ refuses audio focus to a process that is
// not on screen ("Audio focus request blocked by hardening") and Telecom takes ringtone
// focus for the self-managed call, so an in-process player is silenced.
object IncomingCallNotifications {
    // Channel settings are fixed at creation, so a change means a new id.
    const val CHANNEL_ID = "oc_calls_ring"
    private const val TAG = "oc_call"

    const val ACTION_ACCEPT = "com.ocplugin.app.calls.ACCEPT"
    const val ACTION_DECLINE = "com.ocplugin.app.calls.DECLINE"
    const val ACTION_SHOW = "com.ocplugin.app.calls.SHOW"

    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = OCPluginCompanion.getNotificationsManager(context)
        nm.deleteNotificationChannel("oc_calls")
        val channel = NotificationChannel(CHANNEL_ID, "Calls", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Incoming calls"
            setSound(
                Settings.System.DEFAULT_RINGTONE_URI,
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 800, 800)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }
        nm.createNotificationChannel(channel)
    }

    fun notificationId(id: CallId): Int = "${id.chat.chatType}:${id.chat.chatId}:${id.messageId}".hashCode()

    // Posted exactly once. The full-screen intent grant depends on the post happening
    // synchronously inside onShowIncomingCallUi, and an update afterwards would stop the
    // insistent ringtone, so the avatar is fetched by the ringer before Telecom is asked
    // and handed in here.
    fun postRing(context: Context, call: IncomingCall, avatar: Bitmap?) {
        try {
            createChannel(context)
            val caller = Person.Builder()
                .setName(call.title)
                .setIcon(IconCompat.createWithBitmap(avatar ?: DefaultAvatar.forName(call.title)))
                .setImportant(true)
                .build()
            val remaining = (call.started + CallRegistry.RING_WINDOW_MS - System.currentTimeMillis())
                .coerceIn(1_000L, CallRegistry.RING_WINDOW_MS)
            val show = activityIntent(context, call, ACTION_SHOW)
            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification_small)
                .setContentTitle(call.title)
                .setContentText(subtitle(call))
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setOngoing(true)
                .setAutoCancel(false)
                // The system removes the notification at the window end even if the
                // process is gone. CallRinger's own timer produces the missed call.
                .setTimeoutAfter(remaining)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setStyle(
                    NotificationCompat.CallStyle.forIncomingCall(
                        caller,
                        receiverIntent(context, call),
                        activityIntent(context, call, ACTION_ACCEPT),
                    )
                )
                .setFullScreenIntent(show, true)
                .setContentIntent(show)
                .setLargeIcon(avatar)
                .build()
            // Loop the channel's ringtone until the notification is cancelled.
            notification.flags = notification.flags or Notification.FLAG_INSISTENT
            OCPluginCompanion.getNotificationsManager(context).notify(TAG, notificationId(call.id), notification)
        } catch (e: Exception) {
            // POST_NOTIFICATIONS revoked must not take the FCM service down.
            Log.e(LOG_TAG, "Failed to post the ring notification", e)
        }
    }

    fun cancelRing(context: Context, id: CallId) {
        OCPluginCompanion.getNotificationsManager(context).cancel(TAG, notificationId(id))
    }

    // TODO i18n
    fun subtitle(call: IncomingCall): String {
        val kind = when (call.kind) {
            CallKind.AUDIO -> "audio call"
            CallKind.VIDEO -> "video call"
            CallKind.BROADCAST -> "broadcast"
        }
        return if (call.callerName != null) "${call.callerName} is calling · $kind" else "Incoming $kind"
    }

    private fun activityIntent(context: Context, call: IncomingCall, action: String): PendingIntent {
        val intent = Intent(context, IncomingCallActivity::class.java).apply {
            this.action = action
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtras(call.toBundle())
        }
        return PendingIntent.getActivity(
            context,
            notificationId(call.id) + action.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun receiverIntent(context: Context, call: IncomingCall): PendingIntent {
        val intent = Intent(context, CallActionReceiver::class.java).apply {
            action = ACTION_DECLINE
            putExtras(call.toBundle())
        }
        return PendingIntent.getBroadcast(
            context,
            notificationId(call.id) + ACTION_DECLINE.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
