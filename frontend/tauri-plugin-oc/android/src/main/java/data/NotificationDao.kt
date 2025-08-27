package com.ocplugin.app.data

import androidx.room.*
import com.ocplugin.app.models.SenderId
import com.ocplugin.app.models.GroupId
import com.ocplugin.app.models.CommunityId
import com.ocplugin.app.models.ChannelId
import com.ocplugin.app.models.ThreadIndex


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
        AND (:threadIndex IS NULL OR threadIndex = :threadIndex)
        ORDER BY receivedAt ASC
    """)
    suspend fun getNotificationsForDm(senderId: SenderId, threadIndex: ThreadIndex?): List<Notification>

    // For group conversations
    @Query("""
        SELECT * FROM notifications
        WHERE type = 'GROUP'
        AND groupId = :groupId
        AND (:threadIndex IS NULL OR threadIndex = :threadIndex)
        ORDER BY receivedAt ASC
    """)
    suspend fun getNotificationsForGroup(groupId: GroupId, threadIndex: ThreadIndex?): List<Notification>

    // For channel conversations
    @Query("""
        SELECT * FROM notifications
        WHERE type = 'CHANNEL'
        AND communityId = :communityId
        AND channelId = :channelId
        AND (:threadIndex IS NULL OR threadIndex = :threadIndex)
        ORDER BY receivedAt ASC
    """)
    suspend fun getNotificationsForChannel(communityId: CommunityId, channelId: ChannelId, threadIndex: ThreadIndex?): List<Notification>


    @Query("""
        UPDATE notifications
        SET isReleased = 1
        WHERE type = 'DM'
        AND senderId = :senderId
        AND (:threadIndex IS NULL OR threadIndex = :threadIndex)
    """)
    suspend fun markDmAsReleased(senderId: SenderId, threadIndex: ThreadIndex?): Int

    @Query("""
        UPDATE notifications
        SET isReleased = 1
        WHERE type = 'GROUP'
        AND groupId = :groupId
        AND (:threadIndex IS NULL OR threadIndex = :threadIndex)
    """)
    suspend fun markGroupNotificationAsReleased(groupId: GroupId, threadIndex: ThreadIndex?): Int

    @Query("""
        UPDATE notifications
        SET isReleased = 1
        WHERE type = 'CHANNEL'
        AND communityId = :communityId
        AND channelId = :channelId
        AND (:threadIndex IS NULL OR threadIndex = :threadIndex)
    """)
    suspend fun markChannelNotificationAsReleased(communityId: CommunityId, channelId: ChannelId, threadIndex: ThreadIndex?): Int

    @Query("SELECT COUNT(*) FROM notifications WHERE isReleased = 0")
    suspend fun activeCount(): Int

    @Query("DELETE FROM notifications WHERE isReleased = 1")
    suspend fun cleanup(): Int
}