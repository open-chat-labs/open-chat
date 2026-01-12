package com.ocplugin.app.models

import com.ocplugin.app.data.ChannelId
import com.ocplugin.app.data.CommunityId
import com.ocplugin.app.data.GroupId
import com.ocplugin.app.data.Notification
import com.ocplugin.app.data.NotificationType
import com.ocplugin.app.data.SenderId
import com.ocplugin.app.data.ThreadIndex
import com.ocplugin.app.data.ContextId

sealed class Conversation(
    val cSenderId: SenderId? = null,
    val cGroupId: GroupId? = null,
    val cCommunityId: CommunityId? = null,
    val cChannelId: ChannelId? = null,
) {

    abstract fun toContextId(): ContextId

    data class Direct(
        val senderId: SenderId,
        val threadIndex: ThreadIndex?
    ) : Conversation(senderId) {

        override fun toContextId(): ContextId {
            return ContextId("${senderId.value}_${threadIndex?.value ?: ""}_dm".hashCode())
        }
    }

    data class Group(
        val groupId: GroupId,
        val threadIndex: ThreadIndex?
    ) : Conversation(null, groupId) {

        override fun toContextId(): ContextId {
            return ContextId("${groupId.value}_${threadIndex?.value ?: ""})_group".hashCode())
        }
    }

    data class Channel(
        val communityId: CommunityId,
        val channelId: ChannelId,
        val threadIndex: ThreadIndex?
    ) : Conversation(null, null, communityId, channelId) {

        override fun toContextId(): ContextId {
            return ContextId("${communityId.value}_${channelId.value}_${threadIndex?.value ?: ""}_channel".hashCode())
        }
    }

    companion object {
        fun fromNotification(n: Notification): Conversation? {
            return when (n.type) {
                NotificationType.DM -> Direct(n.senderId, n.threadIndex)
                NotificationType.GROUP -> {
                    n.groupId ?: return null
                    Group(n.groupId, n.threadIndex)
                }
                NotificationType.CHANNEL -> {
                    n.communityId ?: return null
                    n.channelId ?: return null
                    Channel(n.communityId, n.channelId, n.threadIndex)
                }
            }
        }

        fun fromParts(
            senderId: SenderId?,
            groupId: GroupId?,
            communityId: CommunityId?,
            channelId: ChannelId?,
            threadIndex: ThreadIndex?
        ): Conversation? {
            if (communityId != null && channelId != null) {
                return Channel(communityId, channelId, threadIndex)
            }

            if (groupId != null) {
                return Group(groupId, threadIndex)
            }

            if (senderId != null) {
                return Direct(senderId, threadIndex)
            }

            return null
        }
    }
}

