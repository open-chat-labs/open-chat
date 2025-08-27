package com.ocplugin.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Index
import app.tauri.plugin.JSObject
import com.ocplugin.app.models.SenderId
import com.ocplugin.app.models.GroupId
import com.ocplugin.app.models.CommunityId
import com.ocplugin.app.models.ChannelId
import com.ocplugin.app.models.ThreadIndex

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

fun notificationToJSObject(notification: Notification): JSObject {
    // This data will be passed to UI, we don't need much more than this.
    return JSObject()
        .put("id", notification.id)
        .put("type", notification.type.name)
        .put("senderId", notification.senderId.value)
        .put("groupId", notification.groupId?.value)
        .put("communityId", notification.communityId?.value)
        .put("channelId", notification.channelId?.value)
        .put("threadIndex", notification.threadIndex?.value)
}
