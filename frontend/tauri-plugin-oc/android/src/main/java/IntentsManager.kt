package com.ocplugin.app

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.ocplugin.app.data.Notification
import com.ocplugin.app.data.NotificationCompanion

object IntentsManager {

    // Notification pending intent!
    //
    // Build pending intent with the notification data! Once the user taps on the notification
    // the data will become available to us again.
    fun buildPendingIntentForNotification(
        context: Context,
        notification: Notification
    ): PendingIntent {
        val packageName = context.packageName
        val mainActivityClass = Class.forName("$packageName.MainActivity")
        val payload = NotificationCompanion.toJSObject(notification).toString()
        val intent =
            Intent(context, mainActivityClass).apply {
                // Correct flags for bringing existing activity to front and delivering new intent
                flags =
                    // Essential for launching from outside app (e.g., notification when app's not running)
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                    // Clear all activities on top of the target activity
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    // Deliver new intent to existing activity if it's top of stack
                    Intent.FLAG_ACTIVITY_SINGLE_TOP

                putExtra("notificationPayload", payload)
            }

        val pendingIntentFlags =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

        return PendingIntent.getActivity(
            context,
            notification.id.toInt(),
            intent,
            pendingIntentFlags)
    }

    // Build notification shortcut intent
    //
    //
    fun buildNotificationShortcutIntent(context: Context, notification: Notification): Intent {
        val packageName = context.packageName
        val mainActivityClass = Class.forName("$packageName.MainActivity")
        val payload = NotificationCompanion.toJSObject(notification).toString()

        return Intent(context, mainActivityClass).apply {
            putExtra("notificationPayload", payload)
            action = Intent.ACTION_VIEW
        }
    }
}