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
import coil3.BitmapImage
import coil3.ImageLoader
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.bitmapConfig
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.ocplugin.app.data.AppDb
import com.ocplugin.app.data.Notification
import com.ocplugin.app.data.NotificationDao
import com.ocplugin.app.data.notificationToJSObject
import com.ocplugin.app.models.ChannelId
import com.ocplugin.app.models.CommunityId
import com.ocplugin.app.models.GroupId
import com.ocplugin.app.models.ReceivedNotification
import com.ocplugin.app.models.SenderId
import com.ocplugin.app.models.ThreadIndex
import com.ocplugin.app.models.decodeNotificationData

// All functions are used, though outside the plugin codebase
@Suppress("UNUSED")
object NotificationsHelper {
    private const val MESSAGES_CHANNEL_ID = "oc_messages"
    private const val MESSAGES_GROUP_ID = "oc_messages_group"

    suspend fun processReceivedNotification(context: Context, data: Map<String, String>, appIsInForeground: Boolean) {
        // Decode received notification data!
        val receivedNotification = decodeNotificationData(data)
        if (receivedNotification == null) {
            Log.e(LOG_TAG, "Notification data failed decoding: $data")
            return
        }

        try {
            val dao = AppDb.get().notificationDao()
            val notificationData = receivedNotification.toDbNotification()
            val notificationId = dao.insert(notificationData)
            val notification = notificationData.copy(id = notificationId)

            if (appIsInForeground) {
                // Push notification to the UI if the app is in foreground! UI will decide
                // if the notification is relevant for it's current context, or not. If not
                // we'll receive it back to be displayed.
                OpenChatPlugin.triggerRef(
                    "push-notification",
                    notificationToJSObject(notification)
                )
            } else {
                // If the app is in the background, or closed, show the notification!
                notifyMessageStyleNotification(context, receivedNotification)
            }

        } catch(e: Exception) {
            Log.e(LOG_TAG, "Error processing notification", e)
        }
    }

    // Used when the notification was previously saved to local db and then processed by the UI,
    // and decided that it should be displayed.
    suspend fun processPreviouslySavedNotification(context: Context, notificationId: Long) {
        val dao = AppDb.get().notificationDao()
        val notification = dao.getById(notificationId)

        if (notification == null) {
            Log.e(LOG_TAG, "Failed to load existing notification with id: $notificationId")
            return
        }

        val receivedNotification = ReceivedNotification.fromDbNotification(notification)
        notifyMessageStyleNotification(context, receivedNotification)
    }

    suspend fun notifyMessageStyleNotification(context: Context, receivedNotification: ReceivedNotification) {
        val dao = AppDb.get().notificationDao()
        val notifications = loadNotificationsForData(dao, receivedNotification)
        val lastNotificationId = notifications.last().id
        val pendingIntent = buildPendingIntentForData(context, lastNotificationId)

        // TODO i18n
        // Build "yourself" as the base persona to initialise the messagingStyle!
        val you = Person.Builder().setName("You").build()
        val messagingStyle = NotificationCompat.MessagingStyle(you)

        // Add notifications to the bunch!
        notifications.forEach { notification ->
            val person = Person.Builder().setName(notification.senderName).build()
            messagingStyle.addMessage(
                ReceivedNotification.toMessage(notification.body, notification.bodyType),
                notification.receivedAt,
                person
            )
        }

        Log.d(LOG_TAG, "### Received notification: $receivedNotification")

        when (receivedNotification) {
            is ReceivedNotification.Direct -> {}
            else -> messagingStyle.setConversationTitle(receivedNotification.toTitle())
        }

        val notification = NotificationCompat.Builder(context, MESSAGES_CHANNEL_ID)
            .setSmallIcon(OpenChatPlugin.icNotificationSmall)
            .setContentTitle(receivedNotification.toTitle())
            .setContentText(receivedNotification.toMessage())
            .setSubText(receivedNotification.toSubtitle())
            .setStyle(messagingStyle)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(receivedNotification.contextId, notification)
    }

    // Load notifications for the given data.
    //
    // If thread index is available, it will load only thread notifications
    suspend fun loadNotificationsForData(dao: NotificationDao, rn: ReceivedNotification): List<Notification> {
        val threadIndex = rn.notificationThreadIndex

        return when (rn) {
            is ReceivedNotification.Direct -> dao.getNotificationsForDm(rn.senderId, threadIndex)
            is ReceivedNotification.Group -> dao.getNotificationsForGroup(rn.groupId, threadIndex)
            is ReceivedNotification.Channel -> dao.getNotificationsForChannel(rn.communityId, rn.channelId, threadIndex)
        }
    }

    // Mark notifications released and clean up!
    //
    // When the user taps on the notification, we will get the notification id from the intent.
    // This notification id is then used to load the notification from the local db and mark
    // it, and all related notifications, as released. Then the released notifications are
    // cleaned up.
    suspend fun releaseNotificationsAfterTap(notificationId: Long): Notification? {
        val dao = AppDb.get().notificationDao()
        val notification = dao.getById(notificationId);

        if (notification == null) {
            Log.e(LOG_TAG, "Failed to load tapped notification with id: $notificationId")
            return null
        }

        val receivedNotification = ReceivedNotification.fromDbNotification(notification)

        val marked = when (receivedNotification) {
            is ReceivedNotification.Direct -> {
                dao.markDmAsReleased(receivedNotification.senderId, receivedNotification.threadIndex)
            }
            is ReceivedNotification.Group -> {
                dao.markGroupNotificationAsReleased(
                    receivedNotification.groupId,
                    receivedNotification.threadIndex
                )
            }
            is ReceivedNotification.Channel -> {
                dao.markChannelNotificationAsReleased(
                    receivedNotification.communityId,
                    receivedNotification.channelId,
                    receivedNotification.threadIndex
                )
            }
        }

        // TODO | This might have to move to a service, since we will probably sync dismissed
        // TODO | notifications with the other clients a user might be using.
        // TODO | also consider potential analytics we could gather before cleaning up!
        // For now, keep this here for simplicity.
        if (marked > 0) dao.cleanup()

        return notification
    }

    // Release notifications for a specific UI context
    //
    // For example user opens up a chat that they have notifications for. This fn will release any
    // pending notifications when the chat is accessed via the UI.
    suspend fun releaseNotificationsAfterAccessedUiContext(
        context: Context,
        senderId: SenderId?,
        groupId: GroupId?,
        communityId: CommunityId?,
        channelId: ChannelId?,
        threadIndex: ThreadIndex?
    ): Boolean {
        val dao = AppDb.get().notificationDao()
        val (marked, notificationContextId) = when {
            communityId != null && channelId != null ->
                dao.markChannelNotificationAsReleased(communityId, channelId, threadIndex) to
                    ReceivedNotification.toChannelContextId(communityId, channelId, threadIndex)
            groupId != null ->
                dao.markGroupNotificationAsReleased(groupId, threadIndex) to
                    ReceivedNotification.toGroupContextId(groupId, threadIndex)
            senderId != null ->
                dao.markDmAsReleased(senderId, threadIndex) to
                    ReceivedNotification.toDmContextId(senderId, threadIndex)
            else -> {
                // None of the when conditions were met!
                Log.e(LOG_TAG, "ReleaseNotifications invalid args, no ids provided")
                return false
            }
        }

        Log.d(LOG_TAG, "Release notifications for context: $notificationContextId")

        if (marked > 0) {
            // TODO same as for the tap, move to a service
            dao.cleanup()

            // Cancel any notifications for this context
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.cancel(notificationContextId)
        }
        return true
    }

    fun buildPendingIntentForData(context: Context, newNotificationId: Long): PendingIntent {
        // Build pending intent with the notification data! Once the user taps on the notification
        // the data will become available to us again. In this case, notification id, which data
        // we can then load from the local db.
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

                putExtra("notificationPayload", newNotificationId.toString())
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
    // notifications channel if it doesn't already exist. This method is called from the Tauri
    // app MainActivity on app start.
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
                Log.e(LOG_TAG, "Fetching FCM registration token failed", task.exception)

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
