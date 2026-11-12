package com.ocplugin.app

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.ocplugin.app.data.Notification
import com.ocplugin.app.data.NotificationCompanion

object IntentsManager {

    // Request code for the summary notification's delete intent. Per-notification delete
    // intents use the notification's DB row id (a positive, auto-incremented Long) as the
    // request code, so a negative constant here can never collide with them.
    private const val SUMMARY_DELETE_REQUEST_CODE = -1

    // Our own notification taps launch the main activity through this alias. It is not exported
    // (AndroidManifest.xml), so only this app can start it. The main activity is exported (launcher,
    // share target, deep links), so any app can start it with a forged notificationPayload; it
    // honours the payload only when the intent came through the alias.
    private const val NOTIFICATION_LAUNCH_ALIAS = "NotificationLaunch"

    fun isNotificationLaunch(componentClassName: String?, packageName: String): Boolean =
        componentClassName == "$packageName.$NOTIFICATION_LAUNCH_ALIAS"

    private fun notificationLaunchIntent(context: Context): Intent =
        Intent().setClassName(context, "${context.packageName}.$NOTIFICATION_LAUNCH_ALIAS")

    // Summary notification delete intent!
    //
    // When the user swipes away the collapsed notification group (which is the summary),
    // Android removes the children from the UI but does NOT fire their individual delete
    // intents. This intent lets the dismiss receiver reconcile the DB by releasing ALL
    // active notifications, so the summary can't reappear with stale counts.
    fun buildDeleteIntentForSummary(context: Context): PendingIntent {
        val packageName = context.packageName
        val dismissReceiverClass = Class.forName("$packageName.NotificationDismissReceiver")
        val intent = Intent(context, dismissReceiverClass).apply {
            putExtra("summaryDismiss", true)
        }

        val pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

        return PendingIntent.getBroadcast(
            context,
            SUMMARY_DELETE_REQUEST_CODE,
            intent,
            pendingIntentFlags,
        )
    }

    // Notification pending intent!
    //
    // Build pending intent with the notification data! Once the user taps on the notification
    // the data will become available to us again.
    fun buildPendingIntentForNotification(
        context: Context,
        notification: Notification
    ): PendingIntent {
        val payload = NotificationCompanion.toJSObject(notification).toString()
        val intent =
            notificationLaunchIntent(context).apply {
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

    fun buildDeleteIntentNotification(context: Context, notification: Notification): PendingIntent {
        val packageName = context.packageName
        val dismissReceiverClass = Class.forName("$packageName.NotificationDismissReceiver")
        val payload = NotificationCompanion.toJSObject(notification).toString()
        val intent = Intent(context, dismissReceiverClass).apply {
            putExtra("notificationPayload", payload)
        }

        val pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

        return PendingIntent.getBroadcast(
            context,
            notification.id.toInt(),
            intent,
            pendingIntentFlags,
        )
    }

    // Build notification shortcut intent
    //
    // Through the alias too: the launcher starts a shortcut's intent as the publishing app
    // (LauncherAppsService: "the target activity doesn't have to be exported").
    fun buildNotificationShortcutIntent(context: Context, notification: Notification): Intent {
        val payload = NotificationCompanion.toJSObject(notification).toString()

        return notificationLaunchIntent(context).apply {
            putExtra("notificationPayload", payload)
            action = Intent.ACTION_VIEW
        }
    }
}