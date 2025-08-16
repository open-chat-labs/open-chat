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

// It's easier to repeat fields in Kotlin than to use base classes
// TODO look into using kotlinx.serialization library for data decoding
// TODO return result in the decoding function
// TODO perhaps make some decoding a bit more robust by normalizing values? e.g. str to lower and trim for notification type
// TODO could we use dedicated types for the various IDs we have to avoid incorrect assignments?
sealed class ReceivedNotification(
    val notificationThreadId: String?
) {
    abstract fun getConversationTitle(): String

    abstract fun getNotificationId(): Int

//    abstract fun getThreadId(): String?

    data class Direct(
        val senderId: String,
        val senderName: String,
        val senderAvatarId: String?,
        val body: String,
        val bodyType: BodyType,
        val image: String?,
        val threadId: String?,
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
        val groupId: String,
        val groupName: String,
        val groupAvatarId: String?,

        // Same as direct
        val senderId: String,
        val senderName: String,
        val senderAvatarId: String?,
        val threadId: String?,
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
        val channelId: String,
        val communityId: String,
        val channelName: String,
        val communityName: String,

        // Same as direct
        val senderId: String,
        val senderName: String,
        val senderAvatarId: String?,
        val threadId: String?,
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
    if (data["senderId"] == null) {
        Log.e(LOG_TAG, "Invalid DM notification data!")
        return null
    }

    val bodyType = decodeBodyType(data["bodyType"])
    return ReceivedNotification.Direct(
        senderId = data["senderId"] ?: "",
        senderName = data["senderName"] ?: "###",
        senderAvatarId = data["senderAvatarId"],
        threadId = data["threadId"],
        body = decodeBody(data["body"] ?: "", bodyType),
        image = data["image"],
        bodyType = bodyType,
    )
}

fun decodeGroupData(data: Map<String, String>): ReceivedNotification.Group? {
    val isValid = data["groupId"] != null
            && data["senderId"] != null

    if (!isValid) {
        Log.e(LOG_TAG, "Invalid group notification data!")
        return null
    }

    val bodyType = decodeBodyType(data["bodyType"])
    return ReceivedNotification.Group(
        groupId = data["groupId"] ?: "",
        groupName = data["groupName"] ?: "///",
        groupAvatarId = data["groupAvatarId"],
        senderId = data["senderId"] ?: "",
        senderName = data["senderName"] ?: "###",
        senderAvatarId = data["senderAvatarId"],
        threadId = data["threadId"],
        body = decodeBody(data["body"] ?: "", bodyType),
        image = data["image"],
        bodyType = decodeBodyType(data["bodyType"]),
    )
}

fun decodeChannelData(data: Map<String, String>): ReceivedNotification.Channel? {
    val isValid = data["communityId"] != null
            && data["channelId"] != null
            && data["senderId"] != null

    if (!isValid) {
        Log.e(LOG_TAG, "Invalid channel notification data!")
        return null
    }

    val bodyType = decodeBodyType(data["bodyType"])
    return ReceivedNotification.Channel(
        channelId = data["channelId"] ?: "",
        communityId = data["communityId"] ?: "",
        channelName = data["channelName"] ?: "---",
        communityName = data["communityName"] ?: "+++",
        senderId = data["senderId"] ?: "",
        senderName = data["senderName"] ?: "###",
        senderAvatarId = data["senderAvatarId"],
        threadId = data["threadId"],
        body = decodeBody(data["body"] ?: "", bodyType),
        image = data["image"],
        bodyType = decodeBodyType(data["bodyType"]),
    )
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
fun decodeBody(body: String, bodyType: BodyType): String {
    return when (bodyType) {
        BodyType.Reaction -> "Reacted with $body"
        BodyType.Tip -> "Sent a tip of $body"
        BodyType.Invite -> "Invited you to $body"
        else -> body
    }
}