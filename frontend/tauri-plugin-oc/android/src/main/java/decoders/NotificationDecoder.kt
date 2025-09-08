package com.ocplugin.app.decoders

import android.util.Log
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.data.*
import com.ocplugin.app.data.Notification
import com.ocplugin.app.data.NotificationType
import com.ocplugin.app.models.Conversation
import kotlin.text.toUInt


// Basic decoding!
//
// We are simply validating that the data has some expected values, and then ignore or use defaults
// for other values that are less relevant. It is important that we can identify the sender and the
// context of the notification. Any issues with the data will be clearly visible, and we can act
// upon it.
//
// TODO look into using kotlinx.serialization library for data decoding
// TODO return result in the decoding function (?)
object NotificationDecoder {
    fun decode(data: Map<String, String>): Notification? {
        try {
            val senderAndConversation = decodeSenderAndConversation(data)

            if (senderAndConversation != null) {
                val (senderId, conversation) = senderAndConversation
                val notificationType = when (conversation) {
                    is Conversation.Direct -> NotificationType.DM
                    is Conversation.Group -> NotificationType.GROUP
                    is Conversation.Channel -> NotificationType.CHANNEL
                }

                return Notification(
                    contextId = conversation.toContextId(),
                    type = notificationType,
                    senderId = senderId,
                    senderName = data["senderName"] ?: "",
                    senderAvatarId = data["senderAvatarId"],
                    groupId = conversation.cGroupId,
                    groupName = data["groupName"] ?: "",
                    groupAvatarId = data["groupAvatarId"],
                    communityId = conversation.cCommunityId,
                    communityName = data["communityName"] ?: "",
                    communityAvatarId = data["communityAvatarId"],
                    channelId = conversation.cChannelId,
                    channelName = data["channelName"] ?: "",
                    channelAvatarId = data["channelAvatarId"],
                    threadIndex = decodeThreadIndex(data),
                    body = data["body"] ?: "",
                    bodyType = decodeBodyType(data),
                    image = data["image"],
                )
            } else {
                Log.e(LOG_TAG, "Unknown notification type: $data")
            }
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to decode notification: $data", e)
        }

        return null
    }

    fun decodeSenderAndConversation(data: Map<String, String>): Pair<SenderId, Conversation>? {
        val typeVal = data["type"]?.trim()?.lowercase()
        val threadIndex = decodeThreadIndex(data)

        return when (typeVal) {
            "channel" -> {
                NotificationValidator.isValidChannel(data)?.let { (senderId, communityId, channelId) ->
                    return senderId to Conversation.Channel(communityId, channelId, threadIndex)
                }

                return null
            }
            "group" -> {
                NotificationValidator.isValidGroup(data)?.let { (senderId, groupId) ->
                    return senderId to Conversation.Group(groupId, threadIndex)
                }

                return null
            }
            else -> {
                NotificationValidator.isValidDm(data)?.let{ senderId ->
                    return senderId to Conversation.Direct(senderId, threadIndex)
                }

                return null
            }
        }
    }

    fun decodeBodyType(data: Map<String, String>): BodyType {
        return when (data["bodyType"]?.trim()?.lowercase()) {
            "reaction" -> BodyType.REACTION
            "tip" -> BodyType.TIP
            "invite" -> BodyType.INVITE
            else -> BodyType.MESSAGE
        }
    }

    fun decodeThreadIndex(data: Map<String, String>): ThreadIndex? {
        val threadIndex = data["threadIndex"]
        try {
            if (threadIndex != null) {
                val threadIndexDecoded = threadIndex.toUInt()
                return ThreadIndex(threadIndexDecoded)
            }
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to decode thread index: $threadIndex", e)
        }

        return null
    }
}

object NotificationValidator {
    fun isValidDm(data: Map<String, String>): SenderId? {
        val senderId = data["senderId"]
        if (senderId == null) {
            Log.e(LOG_TAG, "Invalid DM notification data!")
            return null
        }

        return SenderId(senderId)
    }

    fun isValidGroup(data: Map<String, String>): Pair<SenderId, GroupId>? {
        val senderId = data["senderId"]
        val groupId = data["groupId"]
        val isValid = groupId != null && senderId != null
        if (!isValid) {
            Log.e(LOG_TAG, "Invalid group notification data!")
            return null
        }

        return SenderId(senderId) to GroupId(groupId)
    }

    fun isValidChannel(data: Map<String, String>): Triple<SenderId, CommunityId, ChannelId>? {
        val communityId = data["communityId"]
        val channelId = data["channelId"]
        val senderId = data["senderId"]
        val isValid = communityId != null && channelId != null && senderId != null
        if (!isValid) {
            Log.e(LOG_TAG, "Invalid channel notification data!")
            return null
        }

        return Triple(SenderId(senderId), CommunityId(communityId), ChannelId(channelId.toUInt()))
    }
}
