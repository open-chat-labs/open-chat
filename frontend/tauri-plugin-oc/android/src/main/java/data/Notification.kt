package com.ocplugin.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Index
import com.ocplugin.app.models.ReceivedNotification

enum class NotificationType {
    DM,
    GROUP,
    CHANNEL,
}

@Entity(
    tableName = "notifications",
    indices = [
        Index("senderId"),
        Index("groupId"),
        Index("channelId"),
        Index("threadId")
    ]
)
data class Notification(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val type: NotificationType = NotificationType.DM,

    // This data is required to query exactly what we're looking for.
    val senderId: String,
    val groupId: String?,
    val channelId: String?,
    val threadId: String?,

    // Sender info required to reconstruct the notification
    val name: String,
    val message: String,
    val image: String?,
    val avatarId: String?,

    // Metadata for the notification.
    val isReleased: Boolean = false,
    val receivedAt: Long = System.currentTimeMillis(),
)

fun toDbNotification(receivedNotification: ReceivedNotification): Notification {
    return when (receivedNotification) {
        is ReceivedNotification.Direct -> fromDmData(receivedNotification)
        is ReceivedNotification.Group -> fromGroupData(receivedNotification)
        is ReceivedNotification.Channel -> fromChannelData(receivedNotification)
    }
}

fun fromDmData(data: ReceivedNotification.Direct): Notification {
    return Notification(
        type = NotificationType.DM,
        senderId = data.senderId,
        groupId = null,
        channelId = null,
        threadId = data.threadId,
        name = data.senderName,
        message = data.body,
        image = data.image,
        avatarId = data.senderAvatarId,
    )
}

fun fromGroupData(data: ReceivedNotification.Group): Notification {
    return Notification(
        type = NotificationType.GROUP,
        groupId = data.groupId,
        senderId = data.senderId,
        channelId = null,
        threadId = data.threadId,
        name = data.senderName,
        message = data.body,
        image = data.image,
        avatarId = data.senderAvatarId,
    )
}

fun fromChannelData(data: ReceivedNotification.Channel): Notification {
    return Notification(
        type = NotificationType.CHANNEL,
        groupId = null,
        senderId = data.senderId,
        channelId = data.channelId,
        threadId = data.threadId,
        name = data.senderName,
        message = data.body,
        image = data.image,
        avatarId = data.senderAvatarId,
    )
}