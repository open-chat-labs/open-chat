package com.ocplugin.app.models

import android.util.Log
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.data.Notification
import com.ocplugin.app.data.NotificationType
import com.ocplugin.app.data.BodyType
import kotlin.String

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



// Representation of a received notification!
//
// DB notifications are relatively flat, therefore we use this type to represent the notification
// and manage it within the app.
//
// TODO look into using kotlinx.serialization library for data decoding
// TODO return result in the decoding function
// TODO perhaps make some decoding a bit more robust by normalizing values? e.g. str to lower and trim for notification type
// TODO can we have the parent message content to show in the title when it's a thread reply?
sealed class ReceivedNotification(
    val notificationThreadIndex: ThreadIndex?,
    val contextId: Int,
) {
    abstract fun toTitle(): String
    abstract fun toSubtitle(): String?
    abstract fun toMessage(): String

    // Convert to db notification type!
    fun toDbNotification(): Notification {
        return when (this) {
            is Direct -> {
                Notification(
                    type = NotificationType.DM,
                    senderId = this.senderId,
                    senderName = this.senderName,
                    senderAvatarId = this.senderAvatarId,
                    threadIndex = this.threadIndex,
                    body = this.body,
                    bodyType = this.bodyType,
                    image = this.image,
                )
            }
            is Group -> {
                Notification(
                    type = NotificationType.GROUP,
                    senderId = this.senderId,
                    senderName = this.senderName,
                    senderAvatarId = this.senderAvatarId,
                    groupId = this.groupId,
                    groupName = this.groupName,
                    groupAvatarId = this.groupAvatarId,
                    threadIndex = this.threadIndex,
                    body = this.body,
                    bodyType = this.bodyType,
                    image = this.image,
                )
            }
            is Channel -> {
                Notification(
                    type = NotificationType.CHANNEL,
                    senderId = this.senderId,
                    senderName = this.senderName,
                    senderAvatarId = this.senderAvatarId,
                    communityId = this.communityId,
                    communityName = this.communityName,
                    communityAvatarId = this.communityAvatarId,
                    channelId = this.channelId,
                    channelName = this.channelName,
                    channelAvatarId = this.channelAvatarId,
                    threadIndex = this.threadIndex,
                    body = this.body,
                    bodyType = this.bodyType,
                    image = this.image,
                )
            }
        }
    }

    // Akin to static methods! Saves us a few import statements.
    companion object {
        fun fromDbNotification(notification: Notification): ReceivedNotification {
            return when (notification.type) {
                NotificationType.DM -> {
                    Direct(
                        senderId = notification.senderId,
                        senderName = notification.senderName,
                        senderAvatarId = notification.senderAvatarId,
                        threadIndex = notification.threadIndex,
                        body = notification.body,
                        bodyType = notification.bodyType,
                        image = notification.image,
                    )
                }

                NotificationType.GROUP -> {
                    Group(
                        // Double bang is the non-null assertion operator! If groupId is null, this
                        // would throw an exception; but in this case it should NEVER be null!
                        // If there was a possibility it could be null, we'd not use it.
                        groupId = notification.groupId!!,
                        groupName = notification.groupName!!,
                        groupAvatarId = notification.groupAvatarId,
                        senderId = notification.senderId,
                        senderName = notification.senderName,
                        senderAvatarId = notification.senderAvatarId,
                        threadIndex = notification.threadIndex,
                        body = notification.body,
                        bodyType = notification.bodyType,
                        image = notification.image,
                    )
                }

                NotificationType.CHANNEL -> {
                    Channel(
                        // Same as in the group's case!
                        communityId = notification.communityId!!,
                        communityName = notification.communityName!!,
                        communityAvatarId = notification.communityAvatarId,
                        channelId = notification.channelId!!,
                        channelName = notification.channelName!!,
                        channelAvatarId = notification.channelAvatarId,
                        senderId = notification.senderId,
                        senderName = notification.senderName,
                        senderAvatarId = notification.senderAvatarId,
                        threadIndex = notification.threadIndex,
                        body = notification.body,
                        bodyType = notification.bodyType,
                        image = notification.image,
                    )
                }
            }
        }

        // TODO i18n
        fun toMessage(body: String, bodyType: BodyType): String {
            return when (bodyType) {
                BodyType.REACTION -> "Reacted with $body"
                BodyType.TIP -> "Sent a tip of $body"
                BodyType.INVITE -> "Invited you to $body"
                else -> body
            }
        }

        // Context ID for our notifications!
        //
        // In this case context refers to the type of notification, dm / group / channel, and the
        // particular entities that the notification is for.
        //
        // Primary use for the context id is to release notifications programmatically. Eventually,
        // we should look into using this ID to release notifications cross-platform!
        fun toDmContextId(senderId: SenderId, threadIndex: ThreadIndex?): Int {
            return "${senderId.value}_${threadIndex?.value ?: ""}_dm".hashCode()
        }

        fun toGroupContextId(groupId: GroupId, threadIndex: ThreadIndex?): Int {
            return "${groupId.value}_${threadIndex?.value ?: ""})_group".hashCode()
        }

        fun toChannelContextId(communityId: CommunityId, channelId: ChannelId, threadIndex: ThreadIndex?): Int {
            return "${communityId.value}_${channelId.value}_${threadIndex?.value ?: ""}_channel".hashCode()
        }
    }

    data class Direct(
        val senderId: SenderId,
        val senderName: String,
        val senderAvatarId: String?,
        val body: String,
        val bodyType: BodyType,
        val image: String?,
        val threadIndex: ThreadIndex?,
    ) : ReceivedNotification(
        threadIndex,
        toDmContextId(senderId, threadIndex),
    ) {
        override fun toTitle(): String {
            return senderName
        }

        override fun toSubtitle(): String? {
            return null
        }

        override fun toMessage(): String {
            return toMessage(body, bodyType)
        }
    }

    data class Group(
        val groupId: GroupId,
        val groupName: String,
        val groupAvatarId: String?,
        val senderId: SenderId,
        val senderName: String,
        val senderAvatarId: String?,
        val threadIndex: ThreadIndex?,
        val body: String,
        val bodyType: BodyType,
        val image: String?
    ) : ReceivedNotification(
        threadIndex,
        toGroupContextId(groupId, threadIndex),
    ) {
        override fun toTitle(): String {
            return "$groupName${if (threadIndex != null) " // Thread" else ""}"
        }

        override fun toSubtitle(): String? {
            return null
        }

        override fun toMessage(): String {
            return toMessage(body, bodyType)
        }
    }

    data class Channel(
        val communityId: CommunityId,
        val communityName: String,
        val communityAvatarId: String?,
        val channelId: ChannelId,
        val channelName: String,
        val channelAvatarId: String?,
        val senderId: SenderId,
        val senderName: String,
        val senderAvatarId: String?,
        val threadIndex: ThreadIndex?,
        val body: String,
        val bodyType: BodyType,
        val image: String?,
    ) : ReceivedNotification(
        threadIndex,
        toChannelContextId(communityId, channelId, threadIndex),
    ) {
        override fun toTitle(): String {
            return "#$channelName${if (threadIndex != null) " // Thread" else ""}"
        }

        override fun toSubtitle(): String? {
            return communityName
        }

        override fun toMessage(): String {
            return toMessage(body, bodyType)
        }
    }
}

// Basic decoding!
//
// We are simply validating that the data has some expected values, and then ignore or use defaults
// for other values that are less relevant. It is important that we can identify the sender and the
// context of the notification. Any issues with the data will be clearly visible, and we can act
// upon it.
fun decodeNotificationData(data: Map<String, String>): ReceivedNotification? {
    return when (data["type"]) {
        "group" -> decodeGroupData(data)
        "channel" -> decodeChannelData(data)
        else -> decodeDirectData(data)
    }
}

fun decodeDirectData(data: Map<String, String>): ReceivedNotification.Direct? {
    val senderId = data["senderId"]
    if (senderId == null) {
        Log.e(LOG_TAG, "Invalid DM notification data!")
        return null
    }

    return ReceivedNotification.Direct(
        senderId = SenderId(senderId),
        senderName = data["senderName"] ?: "",
        senderAvatarId = data["senderAvatarId"],
        threadIndex = decodeThreadIndex(data),
        body = data["body"] ?: "",
        bodyType = decodeBodyType(data["bodyType"]),
        image = data["image"],
    )
}

fun decodeGroupData(data: Map<String, String>): ReceivedNotification.Group? {
    val senderId = data["senderId"]
    val groupId = data["groupId"]
    val isValid = groupId != null && senderId != null

    if (!isValid) {
        Log.e(LOG_TAG, "Invalid group notification data!")
        return null
    }

    return ReceivedNotification.Group(
        groupId = GroupId(groupId),
        groupName = data["groupName"] ?: "",
        groupAvatarId = data["groupAvatarId"],
        senderId = SenderId(senderId),
        senderName = data["senderName"] ?: "",
        senderAvatarId = data["senderAvatarId"],
        threadIndex = decodeThreadIndex(data),
        body = data["body"] ?: "",
        bodyType = decodeBodyType(data["bodyType"]),
        image = data["image"],
    )
}

fun decodeChannelData(data: Map<String, String>): ReceivedNotification.Channel? {
    val communityId = data["communityId"]
    val channelId = data["channelId"]
    val senderId = data["senderId"]
    val isValid = communityId != null && channelId != null && senderId != null

    if (!isValid) {
        Log.e(LOG_TAG, "Invalid channel notification data!")
        return null
    }

    val channelIdDecoded = decodeUInt(channelId)
    if (channelIdDecoded == null) {
        Log.e(LOG_TAG, "Invalid channelId: $channelId")
        return null
    }

    return ReceivedNotification.Channel(
        communityId = CommunityId(communityId),
        communityName = data["communityName"] ?: "",
        communityAvatarId = data["communityAvatarId"],
        channelId = ChannelId(channelIdDecoded),
        channelName = data["channelName"] ?: "",
        channelAvatarId = data["channelAvatarId"],
        senderId = SenderId(senderId),
        senderName = data["senderName"] ?: "",
        senderAvatarId = data["senderAvatarId"],
        threadIndex = decodeThreadIndex(data),
        body = data["body"] ?: "",
        bodyType = decodeBodyType(data["bodyType"]),
        image = data["image"],
    )
}

fun decodeThreadIndex(data: Map<String, String>): ThreadIndex? {
    val threadIndex = data["threadIndex"]
    if (threadIndex != null) {
        val threadIndexDecoded = decodeUInt(threadIndex)
        if (threadIndexDecoded != null) return ThreadIndex(threadIndexDecoded)
    }

    return null
}

fun decodeUInt(value: String): UInt? {
    try {
        return value.toUInt()
    } catch (e: NumberFormatException) {
        Log.e(LOG_TAG, "Invalid value: $value, number expected!", e)
        return null
    }
}

fun decodeBodyType(bodyType: String?): BodyType {
    return when (bodyType) {
        "reaction" -> BodyType.REACTION
        "tip" -> BodyType.TIP
        "invite" -> BodyType.INVITE
        else -> BodyType.MESSAGE
    }
}
