package com.ocplugin.app.data

import androidx.room.TypeConverter

class Converters {
    @TypeConverter
    fun fromNotificationType(value: NotificationType): String {
        return value.name  // store as String
    }

    @TypeConverter
    fun toNotificationType(value: String): NotificationType {
        return NotificationType.valueOf(value)
    }
}