package com.ocplugin.app

import android.content.Context
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import app.tauri.plugin.JSObject
import com.ocplugin.app.data.*
import com.ocplugin.app.decoders.NotificationDecoder
import com.ocplugin.app.models.Conversation

// TODO Fix video call notification
// TODO Notification management improvements
//  - Reconstruct notifications on device restart!
//  - Manage media (i.e. shared photos)
//  - Notification actions (i.e. reply, mark as read, mute, forward, etc.)
@Suppress("UNUSED")
object NotificationsManager {
    private const val NOTIFICATIONS_GROUP_KEY = "notifications_group_key"
    private const val SUMMARY_NOTIFICATION_ID = 0

    // Process received notification
    //
    // This function decodes and saves the notification to local DB, and then checks if the app is
    // in the foreground. If it is, notification is sent to the UI to determine if it's relevant
    // for the current user context (i.e. if the user is currently in the conversation that the
    // notification is for). If the app is in the background, or closed, the notification is displayed.
    suspend fun processReceivedNotification(context: Context, data: Map<String, String>, appIsInForeground: Boolean) {
        try {
            Log.d(LOG_TAG, ">>>> Received notification: $data")

            val newNotification = NotificationDecoder.decode(data)
            if (newNotification == null) {
                Log.e(LOG_TAG, "!!!! Notification data failed decoding: $data")
                return
            }

            // Notification successfully decoded, save to local db!
            val dao = AppDb.get().notificationDao()
            val notificationId = dao.insert(newNotification)
            val notification = newNotification.copy(id = notificationId)

            if (appIsInForeground) {
                OCPluginCompanion.triggerRef(
                    "push-notification",
                    NotificationCompanion.toJSObject(notification)
                )
            } else {
                // If the app is in the background, or closed, show the notification!
                notifyMessageStyleNotification(context, notification)
            }

        } catch(e: Exception) {
            Log.e(LOG_TAG, "!!!! Error processing notification", e)
        }
    }

    // Process saved notification
    //
    // Used when the notification was previously saved to local db and then processed by the UI,
    // and decided that it should be displayed (i.e. it was not relevant for the current user
    // context).
    suspend fun processPreviouslySavedNotification(context: Context, notificationId: Long) {
        val dao = AppDb.get().notificationDao()
        val notification = dao.getById(notificationId)

        Log.d(LOG_TAG, ">>>> Process previously saved notification: $notification")

        if (notification == null) {
            Log.e(LOG_TAG, "!!!! Failed to load existing notification with id: $notificationId")
            return
        }

        notifyMessageStyleNotification(context, notification)
    }

    suspend fun notifyMessageStyleNotification(context: Context, notification: Notification) {
        // Load conversation for this notification
        // val notifications = DBManager.loadConversationForNotification(notification)
        val notifications = DBManager.loadConversationForContext(notification.contextId)
        if (notifications.isEmpty()) return

        // Main avatar for notification
        val mainAvatar = AvatarHelper.loadBitmapForNotification(context, notification)

        // TODO i18n
        // Build "yourself" as the base persona to initialise the messagingStyle!
        val you = Person.Builder().setName("You").build()
        val messagingStyle = NotificationCompat.MessagingStyle(you)

        // Build personas list
        val persons = mutableListOf<Person>()
        notifications.forEach { n ->
            val personBuilder = Person.Builder()
                .setName(n.senderName)
                .setImportant(true)

            if (mainAvatar != null) {
                personBuilder.setIcon(IconCompat.createWithBitmap(mainAvatar))
            }

            persons.add(personBuilder.build())
            messagingStyle.addMessage(
                NotificationCompanion.toMessage(n),
                n.receivedAt,
                persons.last()
            )
        }

        // Get the conversation context type for the new notification
        val title = NotificationCompanion.toTitle(notification)
        val message = NotificationCompanion.toMessage(notification)
        if (notification.type != NotificationType.DM) {
            messagingStyle.setConversationTitle(title)
        }

        val shortcutContext = "shortcut_${notification.contextId.value}"
        val shortcut = ShortcutInfoCompat.Builder(context, shortcutContext)
            .setShortLabel(title)
            .setLongLived(true)
            .setPersons(persons.toTypedArray())
            .setIntent(
                IntentsManager.buildNotificationShortcutIntent(context, notification)
            )
            .build()
        ShortcutManagerCompat.pushDynamicShortcut(context, shortcut)

        val notificationBuilder = NotificationCompat.Builder(context, MESSAGES_CHANNEL_ID)
            .setStyle(messagingStyle)
            .setShortcutId(shortcutContext)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setSmallIcon(R.drawable.ic_notification_small)
            .setLargeIcon(mainAvatar)
            .setContentTitle(title)
            .setContentText(message)
            .setGroup(NOTIFICATIONS_GROUP_KEY)
            .setAutoCancel(true)
            .setContentIntent(
                IntentsManager.buildPendingIntentForNotification(context, notification)
            )
            .setDeleteIntent(
                IntentsManager.buildDeleteIntentNotification(context, notification)
            )

        val nm = OCPluginCompanion.getNotificationsManager(context)
        nm.notify(notification.contextId.value, notificationBuilder.build())

        // TODO summary notification requires a bit more testing
        setSummaryNotification(context)
    }

    // Mark notifications released and clean up!
    //
    // When the user taps on the notification, we will get the notification id from the intent.
    // This notification id is then used to load the notification from the local db and mark
    // it, and all related notifications, as released. Then the released notifications are
    // cleaned up.
    // TODO perhaps the isTaped arg could be in the intent extras??!
    suspend fun releaseNotificationsAfterTapOrDismissed(context: Context, intentPayload: String, isTaped: Boolean) {
        try {
            val notificationJson = JSObject(intentPayload)
            Log.d(LOG_TAG, "#### Taped or dismissed notification JSON: $notificationJson")

            val contextId = ContextId(notificationJson.getInt("contextId"))
            val marked = DBManager.releaseNotificationsForContext(contextId)
            Log.d(LOG_TAG, "#### Release notifications for context: $contextId")
            Log.d(LOG_TAG, "#### Release count: $marked")

            // TODO | This might have to move to a service, since we will probably sync dismissed
            // TODO | notifications with the other clients a user might be using.
            // TODO | also consider potential analytics we could gather before cleaning up!
            // For now, keep this here for simplicity.
            if (marked > 0) {
                DBManager.cleanUpReleasedNotifications()

                // TODO summary notification requires a bit more testing
                // Notifications are already canceled via tap, but we want to update summary notification!
                setSummaryNotification(context)
            }

            // Send notification data to Svelte code, which will then determine where to navigate
            if (isTaped) {
                OCPluginCompanion.triggerRef("notification-tap", notificationJson)
            }
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Error processing notification tap", e)
        }
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
        val conversation = Conversation.fromParts(senderId, groupId, communityId, channelId, threadIndex)
        if (conversation == null) {
            Log.e(LOG_TAG, "Release notifications after UI context accessed, invalid conversation!")
            return false
        }

        val contextId = conversation.toContextId()
        val marked = DBManager.releaseNotificationsForContext(contextId)
        Log.d(LOG_TAG, "#### Release conversation: $conversation")
        Log.d(LOG_TAG, "#### Release count: $marked")

        if (marked > 0) {
            Log.d(LOG_TAG, "#### Notifications released!!!")

            // TODO same as for the tap, move to a service
            DBManager.cleanUpReleasedNotifications()

            // Cancel any notifications for this context
            OCPluginCompanion.getNotificationsManager(context).cancel(contextId.value)

            // TODO summary notification requires a bit more testing
            // Update summary notification
            setSummaryNotification(context)
        }

        return true
    }

    // TODO requires a bit more testing
    // Init summary notification!
    suspend fun setSummaryNotification(context: Context) {
        val notificationManager = OCPluginCompanion.getNotificationsManager(context)
        val (activeContexts, activeNotifications) = DBManager.getActiveContextsAndNotificationsCount()

        if (activeNotifications > 0) {
            // TODO i18n
            val title = "OpenChat"
            val messages = "$activeNotifications message${if (activeNotifications > 1) "s" else ""}"
            val summary = if (activeContexts > 1) "$messages, from $activeContexts chats" else messages

            val summaryNotification = NotificationCompat.Builder(context, SUMMARY_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification_small)
                .setContentTitle(title)
                .setContentText(summary)
                .setStyle(NotificationCompat
                    .InboxStyle()
                    .setSummaryText(summary)
                    .setBigContentTitle(title)
                )
                .setGroup(NOTIFICATIONS_GROUP_KEY)
                .setGroupSummary(true)
                .setAutoCancel(true)
                .setSilent(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .build()

            Log.d(LOG_TAG, "#### Set summary notification: $summary")
            notificationManager.notify(SUMMARY_NOTIFICATION_ID, summaryNotification)
        } else {
            Log.d(LOG_TAG, "#### Summary notification CANCELED!")
            notificationManager.cancel(SUMMARY_NOTIFICATION_ID)
        }
    }
}
