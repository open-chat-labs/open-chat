package com.ocplugin.app

import android.app.NotificationChannel
import android.app.NotificationChannelGroup
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
import coil3.BitmapImage
import com.google.firebase.messaging.FirebaseMessaging

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import coil3.ImageLoader
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.bitmapConfig
import kotlinx.coroutines.CoroutineScope
import org.json.JSONObject

// All functions are used, though outside the plugin codebase
@Suppress("UNUSED")
object NotificationsHelper {
    private const val MESSAGES_CHANNEL_ID = "oc_messages"
    private const val MESSAGES_GROUP_ID = "oc_messages_group"

    fun showNotification(context: Context, data: Map<String, String>) {
        // TODO replace with actual default
        val defaultAvatar = "https://oc.app/assets/ckbtc_nobackground.png"

        CoroutineScope(Dispatchers.Main).launch {
            // Coil will cache the images in memory and using disk LRU cache.
            // TODO add support for loading circular avatars / or make circular bitmap once image is loaded
            val avatarBitmap = loadBitmapFromUrl(context, data["sender_avatar_id"] ?: defaultAvatar)

            showNotificationWithAvatar(context, data, avatarBitmap)
        }
    }

    fun showNotificationWithAvatar(context: Context, data: Map<String, String>, avatar: Bitmap?) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notificationPayload = JSONObject().apply {
            data.forEach { (key, value) -> put(key, value) }
        }

        // Build pending intent with the notification data that we will read once the user taps on
        // the notification.
        val packageName = context.packageName
        val mainActivityClass = Class.forName("$packageName.MainActivity")
        val intent = Intent(context, mainActivityClass).apply {
            // Correct flags for bringing existing activity to front and delivering new intent
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or // Essential for launching from outside app (e.g., notification when app not running)
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or   // Clear all activities on top of the target activity
                    Intent.FLAG_ACTIVITY_SINGLE_TOP     // Deliver new intent to existing activity if it's top of stack

            putExtra("notificationPayload", notificationPayload.toString())

        }
        val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pendingIntent = PendingIntent.getActivity(context, 0, intent, pendingIntentFlags)

        // Build the user style notification specific for chat like apps!
        val sender = buildChatNotificationSender(data["senderName"], avatar)

        val style = NotificationCompat
            .MessagingStyle(sender)
            .addMessage(data["body"] ?: "", System.currentTimeMillis(), sender)

        val notification = NotificationCompat.Builder(context, MESSAGES_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setStyle(style)
            // Auto cancel removes the notification when the user taps it
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    fun buildChatNotificationSender(senderName: String?, avatar: Bitmap?): Person {
        val sender = Person.Builder()
            .setName(senderName ?: "OpenChat")

        if (avatar != null) {
            val avatarIcon = IconCompat.createWithBitmap(avatar)
            sender.setIcon(avatarIcon)
        }

        return sender.build()
    }

    // From Android 8+ having notification channels is required. This function creates the notifications
    // channel if it doesn't already exist. This method is called from the Tauri app MainActivity
    // on app start.
    fun createNotificationChannel(context: Context) {
        val notificationManager: NotificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

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
            val channel = NotificationChannel(MESSAGES_CHANNEL_ID, channelName, importance).apply {
                description = channelDescription
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
                group = MESSAGES_GROUP_ID
            }

            // Register the channel with the system
            notificationManager.createNotificationChannel(channel)
            Log.d("TEST_OC", "Notification channel created (if not existed already): $MESSAGES_CHANNEL_ID")
        }
    }

    // Cache the current FCM token into a singleton object, so that it can be queried. The UI
    // will query for the FCM token when the user logs in, or if the user is already logged in
    // when the app starts.
    fun cacheFCMToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                // Handle the error
                return@addOnCompleteListener
            }
            // Get FCM token
            val token = task.result

            Log.d("TEST_OC", "FCM Token: $token")
            // Cache token locally so that we can query it!
            OpenChatPlugin.fcmToken = token
        }
    }

    // A coroutine based function for loading avatars off main thread, uses lightweight Coil
    // library.
    suspend fun loadBitmapFromUrl(context: Context, url: String): Bitmap? {
        return withContext(Dispatchers.IO) {
            try {
                // TODO for global caching reuse image loader
                val loader = ImageLoader(context)
                val request = ImageRequest.Builder(context)
                    .data(url)
                    .bitmapConfig(Bitmap.Config.ARGB_8888) // Needed to convert to Bitmap
                    .build()

                val result = loader.execute(request)
                if (result is SuccessResult) {
                    val image = result.image
                    if (image is BitmapImage) {
                        image.bitmap
                    } else {
                        null
                    }
                } else {
                    Log.e("TEST_OC", "Avatar result: $result")
                    null
                }
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }
}
