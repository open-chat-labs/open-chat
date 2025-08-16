package com.ocplugin.app.data

import androidx.room.TypeConverter
import com.ocplugin.app.models.SenderId
import com.ocplugin.app.models.GroupId
import com.ocplugin.app.models.ChannelId
import com.ocplugin.app.models.ThreadId

class Converters {
    @TypeConverter
    fun fromNotificationType(value: NotificationType): String {
        return value.name  // store as String
    }

    @TypeConverter
    fun toNotificationType(value: String): NotificationType {
        return NotificationType.valueOf(value)
    }

    @TypeConverter
    fun fromSenderId(senderId: SenderId): String {
        return senderId.value
    }

    @TypeConverter
    fun toSenderId(value: String): SenderId {
        return SenderId(value)
    }

    @TypeConverter
    fun fromGroupId(groupId: GroupId): String {
        return groupId.value
    }

    @TypeConverter
    fun toGroupId(value: String): GroupId {
        return GroupId(value)
    }

    @TypeConverter
    fun fromChannelId(channelId: ChannelId): String {
        return channelId.value
    }

    @TypeConverter
    fun toChannelId(value: String): ChannelId {
        return ChannelId(value)
    }

    @TypeConverter
    fun fromThreadId(threadId: ThreadId): String {
        return threadId.value
    }

    @TypeConverter
    fun toThreadId(value: String): ThreadId {
        return ThreadId(value)
    }
}