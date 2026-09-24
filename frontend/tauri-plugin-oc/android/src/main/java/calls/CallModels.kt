package com.ocplugin.app.calls

import android.os.Bundle
import com.ocplugin.app.BlobLocation
import com.ocplugin.app.BuildConfig
import com.ocplugin.app.data.Notification
import com.ocplugin.app.data.NotificationType

// The chat a call belongs to, as the push names it. A direct chat is identified by the
// other user's id, which is the caller's id on a call start push and the `chatId` on a
// dismissal push.
data class CallChat(val chatType: String, val chatId: String, val communityId: String? = null) {
    companion object {
        const val DIRECT = "direct"
        const val GROUP = "group"
        const val CHANNEL = "channel"

        fun of(n: Notification): CallChat? = when (n.type) {
            NotificationType.DM -> CallChat(DIRECT, n.senderId.value)
            NotificationType.GROUP -> n.groupId?.let { CallChat(GROUP, it.value) }
            NotificationType.CHANNEL -> {
                val community = n.communityId ?: return null
                val channel = n.channelId ?: return null
                CallChat(CHANNEL, channel.value.toString(), community.value)
            }
        }
    }
}

// Chat plus call message id. Every ring, dismissal and answer is keyed on this.
data class CallId(val chat: CallChat, val messageId: String)

enum class CallKind(val wire: String) {
    VIDEO("video"),
    AUDIO("audio"),
    BROADCAST("broadcast");

    companion object {
        // The push carries the pair the canister stores: `callType` plus `callAudioOnly`.
        fun fromWire(callType: String?, audioOnly: String?): CallKind = when {
            callType == "broadcast" -> BROADCAST
            audioOnly == "true" -> AUDIO
            else -> VIDEO
        }
    }
}

// The call fields a ring push carries. Their presence is what makes a push a ring.
data class CallFacts(val messageId: String, val kind: CallKind, val started: Long)

enum class DismissalKind { ENDED, ANSWERED_ELSEWHERE }

data class CallDismissal(val id: CallId, val kind: DismissalKind)

// What the ring UI needs to show, and what an accept must carry to the web layer.
// Serialisable to intent extras so the notification actions still work if the
// process was reaped and recreated during the ring.
data class IncomingCall(
    val id: CallId,
    val kind: CallKind,
    val started: Long,
    // Caller for a direct call, group or channel name otherwise.
    val title: String,
    // Caller name for a group call, null for a direct call.
    val callerName: String?,
    // Caller's avatar for a direct call, the group's or community's otherwise.
    val avatarUrl: String?,
    // The decoded push, kept while the process lives so a missed call can post the
    // ordinary message notification for the chat.
    val notification: Notification? = null,
) {
    fun toBundle(): Bundle = Bundle().apply {
        putString(EXTRA_CHAT_TYPE, id.chat.chatType)
        putString(EXTRA_CHAT_ID, id.chat.chatId)
        putString(EXTRA_COMMUNITY_ID, id.chat.communityId)
        putString(EXTRA_MESSAGE_ID, id.messageId)
        putString(EXTRA_KIND, kind.wire)
        putLong(EXTRA_STARTED, started)
        putString(EXTRA_TITLE, title)
        putString(EXTRA_CALLER_NAME, callerName)
        putString(EXTRA_AVATAR_URL, avatarUrl)
    }

    companion object {
        private const val EXTRA_CHAT_TYPE = "oc_call_chat_type"
        private const val EXTRA_CHAT_ID = "oc_call_chat_id"
        private const val EXTRA_COMMUNITY_ID = "oc_call_community_id"
        private const val EXTRA_MESSAGE_ID = "oc_call_message_id"
        private const val EXTRA_KIND = "oc_call_kind"
        private const val EXTRA_STARTED = "oc_call_started"
        private const val EXTRA_TITLE = "oc_call_title"
        private const val EXTRA_CALLER_NAME = "oc_call_caller_name"
        private const val EXTRA_AVATAR_URL = "oc_call_avatar_url"

        fun of(n: Notification, facts: CallFacts): IncomingCall? {
            val chat = CallChat.of(n) ?: return null
            val direct = n.type == NotificationType.DM
            val title = when (n.type) {
                NotificationType.DM -> n.senderName
                NotificationType.GROUP -> n.groupName ?: ""
                NotificationType.CHANNEL -> "${n.communityName}#${n.channelName}"
            }
            return IncomingCall(
                id = CallId(chat, facts.messageId),
                kind = facts.kind,
                started = facts.started,
                title = title,
                callerName = if (direct) null else n.senderName,
                avatarUrl = if (direct) avatarUrl(n.senderId.value, n.senderAvatarId)
                    else avatarUrl(chat.communityId ?: chat.chatId, n.groupAvatarId ?: n.communityAvatarId),
                notification = n,
            )
        }

        private fun avatarUrl(entityId: String, avatarId: String?): String? =
            avatarId?.let {
                val location = BlobLocation.of(entityId, "avatar")
                "${String.format(BuildConfig.AVATAR_BASE_URL, location.canisterId)}/${location.path}/$it"
            }

        fun fromBundle(b: Bundle?): IncomingCall? {
            b ?: return null
            val chatType = b.getString(EXTRA_CHAT_TYPE) ?: return null
            val chatId = b.getString(EXTRA_CHAT_ID) ?: return null
            val messageId = b.getString(EXTRA_MESSAGE_ID) ?: return null
            return IncomingCall(
                id = CallId(CallChat(chatType, chatId, b.getString(EXTRA_COMMUNITY_ID)), messageId),
                kind = CallKind.entries.firstOrNull { it.wire == b.getString(EXTRA_KIND) } ?: CallKind.VIDEO,
                started = b.getLong(EXTRA_STARTED),
                title = b.getString(EXTRA_TITLE) ?: "",
                callerName = b.getString(EXTRA_CALLER_NAME),
                avatarUrl = b.getString(EXTRA_AVATAR_URL),
            )
        }
    }
}

// What the web layer is handed: an answer to join a ringing call, or a call to start
// from a call log redial.
sealed class CallAction(val chat: CallChat, val kind: CallKind) {
    class Accept(val id: CallId, kind: CallKind) : CallAction(id.chat, kind)
    class Start(chat: CallChat, kind: CallKind) : CallAction(chat, kind)
}
