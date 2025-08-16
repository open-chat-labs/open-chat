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
import androidx.annotation.DrawableRes
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
import coil3.BitmapImage
import coil3.ImageLoader
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.bitmapConfig
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import com.ocplugin.app.data.AppDb
import com.ocplugin.app.data.Notification
import com.ocplugin.app.data.NotificationDao
import com.ocplugin.app.data.toDbNotification
import com.ocplugin.app.models.ReceivedNotification
import com.ocplugin.app.models.decodeNotificationData

fun JSONObject.toMap(): Map<String, String> =
    keys().asSequence().associateWith { this.get(it).toString() }

// All functions are used, though outside the plugin codebase
@Suppress("UNUSED")
object NotificationsHelper {
    private const val MESSAGES_CHANNEL_ID = "oc_messages"
    private const val MESSAGES_GROUP_ID = "oc_messages_group"

    fun processNewNotification(context: Context, data: Map<String, String>) {
        val receivedNotification = decodeNotificationData(data)
        if (receivedNotification == null) {
            Log.e(LOG_TAG, "Notification data failed decoding: $data")
            return
        }

        // Get db instance and convert notification
        val dao = AppDb.get(context).notificationDao()
        val dbNotification = toDbNotification(receivedNotification)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Save new notification to local db
                val id = dao.insert(dbNotification)

                // For debugging!
                // val check = dao.getById(id)
                // Log.d(LOG_TAG, "Check inserted: $check")

                // Load all notifications! We will use the list to construct a new notification, and
                // since it will use the same id as the previous one, the old one will be replaced
                // with new content. This is why we first saved the new notification to local db.
                val notifications = loadNotificationsForData(dao, receivedNotification)
                if (notifications.isEmpty()) {
                    Log.e(LOG_TAG, "No notifications found after insert of a new notification")
                    return@launch
                }

                // TODO replace with actual default
                // val userAvatarUrl =
                //    if (data["senderId"] != null) "https://${data["senderId"]}.raw.icp0.io/avatar"
                //    else "https://oc.app/icon.png"

                // Coil will cache the images in memory and using disk LRU cache.
                // TODO add support for loading circular avatars / or make circular bitmap once image is loaded
                // val avatarBitmap = loadBitmapFromUrl(context, userAvatarUrl)

                withContext(Dispatchers.Main) {
                    showNotificationWithAvatar(
                        context,
                        notifications,
                        receivedNotification,
                        // Build pending intent with the notification data that we will read once
                        // the user taps on the notification.
                        buildPendingIntentForData(context, data)
                    )
                }
            } catch(e: Exception) {
                Log.e(LOG_TAG, "Error processing notification", e)
            }
        }
    }

    fun showNotificationWithAvatar(context: Context, notifications: List<Notification>, receivedNotification: ReceivedNotification, pendingIntent: PendingIntent) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Build "yourself" as the base persona to initialise the messagingStyle!
        val you = Person.Builder().setName("You").build()
        val messagingStyle = NotificationCompat.MessagingStyle(you)

        // Add notifications to the bunch!
        notifications.forEach { notification ->
            val person = Person.Builder().setName(notification.name).build()
            messagingStyle.addMessage(notification.message, notification.receivedAt, person)
        }

        val conversationTitle = receivedNotification.getConversationTitle()
        when (receivedNotification) {
            is ReceivedNotification.Direct -> {}
            else -> messagingStyle.setConversationTitle(conversationTitle)
        }

        val latestNotification = notifications.last()
        val notification = NotificationCompat.Builder(context, MESSAGES_CHANNEL_ID)
            .setSmallIcon(OpenChatPlugin.icNotificationSmall)
            .setContentTitle(conversationTitle)
            .setContentText(latestNotification.message)
            .setStyle(messagingStyle)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        manager.notify(receivedNotification.getNotificationId(), notification)
    }

    suspend fun loadNotificationsForData(dao: NotificationDao, rn: ReceivedNotification): List<Notification> {
        val threadId = rn.notificationThreadId

        if (threadId != null) {
            return dao.getNotificationsForThread(threadId)
        }

        return when (rn) {
            is ReceivedNotification.Direct -> dao.getNotificationsForDm(rn.senderId)
            is ReceivedNotification.Group -> dao.getNotificationsForGroup(rn.groupId)
            is ReceivedNotification.Channel -> dao.getNotificationsForChannel(rn.channelId)
        }
    }

    // It's a bit funny this function gets json string data, but this is how it's encoded into
    // a pending intent, and retrieved once the user taps on the notification.
    // TODO look into making this more robust, i.e. not using a json string
    fun releaseNotificationsAfterTap(context: Context, jsonString: String) {
        val data = JSONObject(jsonString).toMap()
        val dao = AppDb.get(context).notificationDao()

        val notification = decodeNotificationData(data)
        if (notification == null) {
            Log.e(LOG_TAG, "Reconstructed notification data failed decoding: $data")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val threadId = notification.notificationThreadId
                if (threadId != null) {
                    dao.markThreadNotificationAsReleased(threadId)
                }

                when (notification) {
                    is ReceivedNotification.Direct -> dao.markDmAsReleased(notification.senderId)
                    is ReceivedNotification.Group -> dao.markGroupNotificationAsReleased(notification.groupId)
                    is ReceivedNotification.Channel -> dao.markChannelNotificationAsReleased(notification.channelId)
                }

                // Cleanup!
                dao.cleanup()
            } catch (e: Exception) {
                Log.e(LOG_TAG, "Error releasing notifications", e)
            }
        }
    }

    fun buildPendingIntentForData(context: Context, data: Map<String, String>): PendingIntent {
        val notificationPayload =
            JSONObject().apply { data.forEach { (key, value) -> put(key, value) } }

        // Build pending intent with the notification data that we will read once the user taps on
        // the notification.
        val packageName = context.packageName
        val mainActivityClass = Class.forName("$packageName.MainActivity")
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

                putExtra("notificationPayload", notificationPayload.toString())
            }

        val pendingIntentFlags =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

        return PendingIntent.getActivity(context, 0, intent, pendingIntentFlags)
    }


    // From Android 8+ having notification channels is required. This function creates the
    // notifications
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

    // Status bar notification icon
    //
    // Sets the drawable resource for the notification icon that appears in the status bar!
    fun setNotificationIconSmall(@DrawableRes smallIconRes: Int) {
        OpenChatPlugin.icNotificationSmall = smallIconRes
    }

    // A coroutine based function for loading avatars off main thread, uses lightweight Coil
    // library.
    suspend fun loadBitmapFromUrl(context: Context, url: String): Bitmap? {
        return withContext(Dispatchers.IO) {
            try {
                // TODO for global caching reuse image loader
                val loader = ImageLoader(context)
                val request =
                        ImageRequest.Builder(context)
                                .data(url)
                                .bitmapConfig(
                                        Bitmap.Config.ARGB_8888
                                ) // Needed to convert to Bitmap
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
