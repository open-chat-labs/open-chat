package com.ocplugin.app.models

import android.util.Log
import com.ocplugin.app.LOG_TAG
import kotlin.String

enum class BodyType {
    Message,
    Reaction,
    Tip,
    Invite,
}

@JvmInline
value class SenderId(val value: String)

@JvmInline
value class GroupId(val value: String)

@JvmInline
value class ChannelId(val value: String)

@JvmInline
value class CommunityId(val value: String)

@JvmInline
value class ThreadId(val value: String)

// It's easier to repeat fields in Kotlin than to use base classes
// TODO look into using kotlinx.serialization library for data decoding
// TODO return result in the decoding function
// TODO perhaps make some decoding a bit more robust by normalizing values? e.g. str to lower and trim for notification type
// TODO could we use dedicated types for the various IDs we have to avoid incorrect assignments?
sealed class ReceivedNotification(
    val notificationThreadId: ThreadId?
) {
    abstract fun getConversationTitle(): String

    abstract fun getNotificationId(): Int

    data class Direct(
        val senderId: SenderId,
        val senderName: String,
        val senderAvatarId: String?,
        val body: String,
        val bodyType: BodyType,
        val image: String?,
        val threadId: ThreadId?,
    ) : ReceivedNotification(threadId) {
        override fun getConversationTitle(): String {
            return senderName
        }

        override fun getNotificationId(): Int {
            // This will return thread id if it's set, or default to sender id
            return (threadId ?: senderId).hashCode()
        }
    }

    data class Group(
        val groupId: GroupId,
        val groupName: String,
        val groupAvatarId: String?,

        // Same as direct
        val senderId: SenderId,
        val senderName: String,
        val senderAvatarId: String?,
        val threadId: ThreadId?,
        val body: String,
        val bodyType: BodyType,
        val image: String?
    ) : ReceivedNotification(threadId) {
        override fun getConversationTitle(): String {
            return groupName
        }

        override fun getNotificationId(): Int {
            return (threadId ?: groupId).hashCode()
        }
    }

    data class Channel(
        val channelId: ChannelId,
        val communityId: CommunityId,
        val channelName: String,
        val communityName: String,

        // Same as direct
        val senderId: SenderId,
        val senderName: String,
        val senderAvatarId: String?,
        val threadId: ThreadId?,
        val body: String,
        val bodyType: BodyType,
        val image: String?,
    ) : ReceivedNotification(threadId) {
        override fun getConversationTitle(): String {
            return "$channelName / $communityName"
        }

        override fun getNotificationId(): Int {
            return (threadId ?: channelId).hashCode()
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

    val bodyType = decodeBodyType(data["bodyType"])
    val body = decodeBody(data["body"], bodyType)
    return ReceivedNotification.Direct(
        senderId = SenderId(senderId),
        senderName = data["senderName"] ?: "###",
        senderAvatarId = data["senderAvatarId"],
        threadId = decodeThreadId(data),
        body = body,
        image = data["image"],
        bodyType = bodyType,
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

    val bodyType = decodeBodyType(data["bodyType"])
    val body = decodeBody(data["body"], bodyType)
    return ReceivedNotification.Group(
        groupId = GroupId(groupId),
        groupName = data["groupName"] ?: "///",
        groupAvatarId = data["groupAvatarId"],
        senderId = SenderId(senderId),
        senderName = data["senderName"] ?: "###",
        senderAvatarId = data["senderAvatarId"],
        threadId = decodeThreadId(data),
        body = body,
        image = data["image"],
        bodyType = decodeBodyType(data["bodyType"]),
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

    val bodyType = decodeBodyType(data["bodyType"])
    val body = decodeBody(data["body"], bodyType)
    return ReceivedNotification.Channel(
        channelId = ChannelId(channelId),
        communityId = CommunityId(communityId),
        channelName = data["channelName"] ?: "---",
        communityName = data["communityName"] ?: "+++",
        senderId = SenderId(senderId),
        senderName = data["senderName"] ?: "###",
        senderAvatarId = data["senderAvatarId"],
        threadId = decodeThreadId(data),
        body = body,
        image = data["image"],
        bodyType = decodeBodyType(data["bodyType"]),
    )
}

fun decodeThreadId(data: Map<String, String>): ThreadId? {
    val threadId = data["threadId"]
    return if (threadId != null) ThreadId(threadId) else null
}

fun decodeBodyType(bodyType: String?): BodyType {
    return when (bodyType) {
        "reaction" -> BodyType.Reaction
        "tip" -> BodyType.Tip
        "invite" -> BodyType.Invite
        else -> BodyType.Message
    }
}

// TODO i18n!!!!!!
fun decodeBody(body: String?, bodyType: BodyType): String {
    if (body == null) {
        Log.e(LOG_TAG, "Invalid notification body for body type: $bodyType!")
    }

    return when (bodyType) {
        BodyType.Reaction -> "Reacted with ${body ?: "?"}"
        BodyType.Tip -> "Sent a tip of ${body ?: "?"}"
        BodyType.Invite -> "Invited you to ${body ?: "?"}"
        else -> body ?: ""
    }
}
