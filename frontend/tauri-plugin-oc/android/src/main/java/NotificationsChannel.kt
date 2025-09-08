package com.ocplugin.app

import android.app.NotificationChannel
import android.app.NotificationChannelGroup
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log

const val MESSAGES_CHANNEL_ID = "oc_messages"
const val MESSAGES_GROUP_ID = "oc_messages_group"
const val SUMMARY_CHANNEL_ID = "summary_notifications"

object NotificationsChannel {
    // Create notifications channel
    //
    // From Android 8+ having notification channels is required. This function creates the
    // notifications channel if it doesn't already exist. This method is called from the Tauri
    // app MainActivity on app start.
    fun createMainChannel(context: Context) {
        val notificationManager = OCPluginCompanion.getNotificationsManager(context)

        // Create the NotificationChannel, but only on API 26+ because
        // the NotificationChannel class is new and not in the support library
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelName = "Message Notifications" // Choose a user-visible name
            val channelDescription = "Message notifications channel for OC" // Optional description

            // Or IMPORTANCE_DEFAULT, IMPORTANCE_LOW, etc. HIGH enables banners!
            val importance = NotificationManager.IMPORTANCE_HIGH

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
            Log.d(LOG_TAG, "Main notification channel created: $MESSAGES_CHANNEL_ID")
        }
    }

    fun createSummaryChannel(context: Context) {
        val channelName = "Summary Notifications"
        val channelDescription = "Shows a summary of all notifications"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                SUMMARY_CHANNEL_ID,
                channelName, // User-visible name
                NotificationManager.IMPORTANCE_LOW // No sound, no vibration
            ).apply {
                description = channelDescription
                setSound(null, null) // Explicitly disable sound
                enableVibration(false) // Disable vibration
                enableLights(false)    // Optional
            }

            OCPluginCompanion
                .getNotificationsManager(context)
                .createNotificationChannel(channel)

            Log.d(LOG_TAG, "Summary notification channel created: $SUMMARY_CHANNEL_ID")
        }
    }
}