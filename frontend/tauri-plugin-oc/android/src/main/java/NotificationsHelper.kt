package com.ocplugin.app

import android.app.NotificationChannel
import android.app.NotificationChannelGroup
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import app.tauri.plugin.JSObject
import com.google.firebase.messaging.FirebaseMessaging

object NotificationsHelper {
    private const val MESSAGES_CHANNEL_ID = "oc_messages"
    private const val MESSAGES_GROUP_ID = "oc_messages_group"

    fun showNotification(context: Context, title: String, content: String) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        Log.d("TEST_OC", "Notification received, proceed to show it")
        val notification =
                NotificationCompat.Builder(context, MESSAGES_CHANNEL_ID)
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setContentTitle(title)
                        .setContentText(content)
                        // Auto cancel removes the notification when the user taps it
                        .setAutoCancel(true)
                        .build()

        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    fun createNotificationChannel(context: Context) {
        val notificationManager: NotificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create the NotificationChannel, but only on API 26+ because
        // the NotificationChannel class is new and not in the support library
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelName = "Message Notifications" // Choose a user-visible name
            val channelDescription = "Message notifications channel for OC" // Optional description
            val importance =
                    NotificationManager
                            .IMPORTANCE_HIGH // Or IMPORTANCE_DEFAULT, IMPORTANCE_LOW, etc. HIGH
            // enables banners.

            // Create group!
            val messagesGroup = NotificationChannelGroup(MESSAGES_GROUP_ID, "Message Group")
            notificationManager.createNotificationChannelGroup(messagesGroup)

            // Create the channel!
            val channel =
                    NotificationChannel(MESSAGES_CHANNEL_ID, channelName, importance).apply {
                        description = channelDescription
                        enableLights(true)
                        enableVibration(true)
                        setShowBadge(true)
                        group = MESSAGES_GROUP_ID
                    }

            // Register the channel with the system
            notificationManager.createNotificationChannel(channel)
            Log.d(
                    "TEST_OC",
                    "Notification channel created (if not existed already): $MESSAGES_CHANNEL_ID"
            )
        }
    }

    fun getFCMToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                // Handle the error
                return@addOnCompleteListener
            }
            // Get new FCM registration token
            val token = task.result

            Log.d("TEST_OC", "FCM Token: $token")
            // Save token locally so that we can query it!
            OpenChatPlugin.fcmToken = token;
            // Also raise an event in case UI is already listening for it!
            OpenChatPlugin.triggerRef("fcm-token", JSObject().apply { put("token", token) })

            // TODO send to Backend!!!!
        }
    }
}
