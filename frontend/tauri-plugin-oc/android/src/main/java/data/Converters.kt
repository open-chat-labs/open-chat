package com.ocplugin.app.data

import androidx.room.TypeConverter
import com.ocplugin.app.models.SenderId
import com.ocplugin.app.models.GroupId
import com.ocplugin.app.models.CommunityId
import com.ocplugin.app.models.ChannelId
import com.ocplugin.app.models.ThreadIndex

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
    fun fromCommunityId(communityId: CommunityId): String {
        return communityId.value
    }

    @TypeConverter
    fun toCommunityId(value: String): CommunityId {
        return CommunityId(value)
    }

    @TypeConverter
    fun fromChannelId(channelId: ChannelId): Long {
        return channelId.value.toLong()
    }

    @TypeConverter
    fun toChannelId(value: Long): ChannelId {
        return ChannelId(value.toUInt())
    }

    @TypeConverter
    fun fromThreadIndex(threadIndex: ThreadIndex): Long {
        return threadIndex.value.toLong()
    }

    @TypeConverter
    fun toThreadIndex(value: Long): ThreadIndex {
        return ThreadIndex(value.toUInt())
    }

    @TypeConverter
    fun fromBodyType(bodyType: BodyType): String {
        return bodyType.name
    }

    @TypeConverter
    fun toBodyType(value: String): BodyType {
        return BodyType.valueOf(value)
    }
}