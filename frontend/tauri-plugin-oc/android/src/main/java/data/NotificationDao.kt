package com.ocplugin.app.data

import androidx.room.*
import com.ocplugin.app.models.SenderId
import com.ocplugin.app.models.GroupId
import com.ocplugin.app.models.ChannelId
import com.ocplugin.app.models.ThreadId


@Dao
interface NotificationDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(notification: Notification): Long

    @Query("SELECT * FROM notifications WHERE id = :id")
    suspend fun getById(id: Long): Notification?

    // For direct conversations
    @Query("""
        SELECT * FROM notifications
        WHERE type = 'DM'
        AND senderId = :senderId
        AND threadId IS NULL
        ORDER BY receivedAt ASC
    """)
    suspend fun getNotificationsForDm(senderId: SenderId): List<Notification>

    // For group conversations
    @Query("""
        SELECT * FROM notifications
        WHERE type = 'GROUP'
        AND groupId = :groupId
        AND threadId IS NULL
        ORDER BY receivedAt ASC
    """)
    suspend fun getNotificationsForGroup(groupId: GroupId): List<Notification>

    // For channel conversations
    @Query("""
        SELECT * FROM notifications
        WHERE type = 'CHANNEL'
        AND channelId = :channelId
        AND threadId IS NULL
        ORDER BY receivedAt ASC
    """)
    suspend fun getNotificationsForChannel(channelId: ChannelId): List<Notification>

    // For thread conversations
    @Query("""
        SELECT * FROM notifications
        WHERE threadId = :threadId
        ORDER BY receivedAt ASC
    """)
    suspend fun getNotificationsForThread(threadId: ThreadId): List<Notification>


    @Query("UPDATE notifications SET isReleased = 1 WHERE type = 'DM' AND senderId = :senderId AND threadId IS NULL")
    suspend fun markDmAsReleased(senderId: SenderId)

    @Query("UPDATE notifications SET isReleased = 1 WHERE type = 'GROUP' AND groupId = :groupId AND threadId IS NULL")
    suspend fun markGroupNotificationAsReleased(groupId: GroupId)

    @Query("UPDATE notifications SET isReleased = 1 WHERE type = 'CHANNEL' AND channelId = :channelId AND threadId IS NULL")
    suspend fun markChannelNotificationAsReleased(channelId: ChannelId)

    // TODO Do we want to mark threads as released when the user views the parent conversation?
    @Query("UPDATE notifications SET isReleased = 1 WHERE threadId = :threadId")
    suspend fun markThreadNotificationAsReleased(threadId: ThreadId)


    @Query("SELECT COUNT(*) FROM notifications WHERE isReleased = 0")
    suspend fun activeCount(): Int

    @Query("DELETE FROM notifications WHERE isReleased = 1")
    suspend fun cleanup()

}