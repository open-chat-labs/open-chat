package com.ocplugin.app.data

import android.content.Context
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Index
import app.tauri.plugin.JSObject
import com.ocplugin.app.R

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
    // Message content type as sent by the backend ("Image", "Video", "Giphy", "File",
    // "Audio", "Text", ...). Drives how an attachment is presented in the notification.
    val messageType: String? = null,
    // Attached file's name, for "File" messages.
    val fileName: String? = null,

    // Metadata for the notification.
    val isReleased: Boolean = false,
    val receivedAt: Long = System.currentTimeMillis(),
)

object NotificationCompanion {
    // Message content types, matching the backend's MessageContentType Display strings.
    const val TYPE_IMAGE = "Image"
    const val TYPE_VIDEO = "Video"
    const val TYPE_GIPHY = "Giphy"
    const val TYPE_AUDIO = "Audio"
    const val TYPE_FILE = "File"

    // True when the attachment is a still image we render inline in the notification.
    // Videos, gifs, files, etc. are presented as a typed text label instead (see
    // attachmentLabel), so they should not be downloaded/rendered as a thumbnail.
    //
    // Pre-v2 rows predate messageType, so a null messageType with a populated image URL
    // is treated as a renderable image to preserve the original behavior.
    fun isRenderableImage(notification: Notification): Boolean =
        notification.messageType == TYPE_IMAGE ||
            (notification.messageType == null && !notification.image.isNullOrBlank())

    // TODO would be cool if we could have a part of the parent message when dealing with threads
    fun toTitle(context: Context, notification: Notification): String {
        fun inThread(name: String) =
            if (notification.threadIndex != null) context.getString(R.string.notification_thread, name) else name

        return when (notification.type) {
            NotificationType.DM ->
                notification.senderName

            NotificationType.GROUP ->
                inThread("${notification.groupName}")

            NotificationType.CHANNEL ->
                inThread("${notification.communityName}#${notification.channelName}")
        }
    }

    fun toMessage(context: Context, notification: Notification): String {
        return when (notification.bodyType) {
            BodyType.REACTION -> context.getString(R.string.notification_reacted, notification.senderName, notification.body)
            BodyType.TIP -> context.getString(R.string.notification_tipped, notification.senderName, notification.body)
            BodyType.INVITE -> context.getString(R.string.notification_invited, notification.senderName, notification.body)
            else -> attachmentLabel(context, notification)
        }
    }

    // Builds the text shown for a message, accounting for non-text attachments.
    //
    // Images are rendered inline (see NotificationsManager), so we show the caption if any
    // and otherwise a "📷 Photo" placeholder. Videos, gifs, audio and files are NOT rendered,
    // so we tag them with an emoji + a "shared a …" label (or the caption / file name when
    // available) to make the content type obvious at a glance.
    private fun attachmentLabel(context: Context, notification: Notification): String {
        val caption = notification.body.takeIf { it.isNotBlank() }
        val photo = "📷 " + context.getString(R.string.notification_photo)
        return when (notification.messageType) {
            TYPE_IMAGE -> caption ?: photo
            TYPE_VIDEO -> "🎥 " + (caption ?: context.getString(R.string.notification_shared_video))
            TYPE_GIPHY -> "🎞️ " + (caption ?: context.getString(R.string.notification_shared_gif))
            TYPE_AUDIO -> "🎙️ " + (caption ?: context.getString(R.string.notification_shared_audio))
            TYPE_FILE -> "📎 " + (notification.fileName?.takeIf { it.isNotBlank() } ?: caption
                ?: context.getString(R.string.notification_shared_file))
            // Pre-v2 rows have no messageType; an image-only row would otherwise render as
            // empty text, so fall back to the image placeholder when an image URL is present.
            else -> caption ?: if (!notification.image.isNullOrBlank()) photo else notification.body
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
            .put("messageType", notification.messageType)
            .put("fileName", notification.fileName)
            .put("receivedAt", notification.receivedAt)
    }
}
