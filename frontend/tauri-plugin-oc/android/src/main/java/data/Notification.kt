package com.ocplugin.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Index
import app.tauri.plugin.JSObject

@JvmInline
value class SenderId(val value: String)

@JvmInline
value class GroupId(val value: String)

@JvmInline
value class CommunityId(val value: String)

@JvmInline
value class ChannelId(val value: UInt)

@JvmInline
value class ThreadIndex(val value: UInt)

@JvmInline
value class ContextId(val value: Int)

enum class NotificationType {
    DM,
    GROUP,
    CHANNEL,
}

enum class BodyType {
    MESSAGE,
    REACTION,
    TIP,
    INVITE,
}

@Entity(
    tableName = "notifications",
    indices = [
        Index("type"),
        Index("senderId"),
        Index("groupId"),
        Index("communityId"),
        Index("channelId"),
        Index("threadIndex"),
        Index("isReleased")
    ]
)
data class Notification(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val type: NotificationType = NotificationType.DM,
    val contextId: ContextId,
    val senderId: SenderId,
    val senderName: String,
    val senderAvatarId: String? = null,
    val groupId: GroupId? = null,
    val groupName: String? = null,
    val groupAvatarId: String? = null,
    val communityId: CommunityId? = null,
    val communityName: String? = null,
    val communityAvatarId: String? = null,
    val channelId: ChannelId? = null,
    val channelName: String? = null,
    val channelAvatarId: String? = null,
    val threadIndex: ThreadIndex? = null,
    val body: String,
    val bodyType: BodyType,
    val image: String? = null,

    // Metadata for the notification.
    val isReleased: Boolean = false,
    val receivedAt: Long = System.currentTimeMillis(),
)

object NotificationCompanion {
    // TODO i18n
    // TODO would be cool if we could have a part of the parent message when dealing with threads
    fun toTitle(notification: Notification): String {
        return when (notification.type) {
            NotificationType.DM ->
                notification.senderName

            NotificationType.GROUP ->
                "${notification.groupName}${if (notification.threadIndex != null) " // Thread" else ""}"

            NotificationType.CHANNEL ->
                "${notification.communityName}#${notification.channelName}${if (notification.threadIndex != null) " // Thread" else ""}"
        }
    }

    // TODO i18n
    fun toMessage(notification: Notification): String {
        return when (notification.bodyType) {
            BodyType.REACTION -> "${notification.senderName} reacted with ${notification.body}"
            BodyType.TIP -> "${notification.senderName} sent a tip of ${notification.body}"
            BodyType.INVITE -> "${notification.senderName} invited you to ${notification.body}"
            else -> notification.body
        }
    }

    fun toJSObject(notification: Notification): JSObject {
        return JSObject()
            .put("id", notification.id)
            .put("contextId", notification.contextId.value)
            .put("type", notification.type.name)
            .put("senderId", notification.senderId.value)
            .put("senderName", notification.senderName)
            .put("senderAvatarId", notification.senderAvatarId)
            .put("groupId", notification.groupId?.value)
            .put("groupName", notification.groupName)
            .put("groupAvatarId", notification.groupAvatarId)
            .put("communityId", notification.communityId?.value)
            .put("communityName", notification.communityName)
            .put("communityAvatarId", notification.communityAvatarId)
            .put("channelId", notification.channelId?.value)
            .put("channelName", notification.channelName)
            .put("channelAvatarId", notification.channelAvatarId)
            .put("threadIndex", notification.threadIndex?.value)
            .put("body", notification.body)
            .put("bodyType", notification.bodyType.name)
            .put("image", notification.image)
            .put("receivedAt", notification.receivedAt)
    }
}
