package com.ocplugin.app.data

import androidx.room.*
import com.ocplugin.app.data.ContextId
import com.ocplugin.app.data.Notification


@Dao
interface NotificationDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(notification: Notification): Long

    @Query("SELECT * FROM notifications WHERE id = :id")
    suspend fun getById(id: Long): Notification?

    @Query("""
        SELECT * FROM notifications
        WHERE contextId = :contextId
        AND isReleased = 0
        ORDER BY receivedAt ASC
    """)
    suspend fun getNotificationsForContext(contextId: ContextId): List<Notification>

    @Query("""
        UPDATE notifications
        SET isReleased = 1
        WHERE contextId = :contextId
        AND isReleased = 0
    """)
    suspend fun markAsReadForContext(contextId: ContextId): Int

    @Query("SELECT COUNT(*) FROM notifications WHERE isReleased = 0")
    suspend fun activeNotificationsCount(): Int

    @Query("SELECT COUNT(DISTINCT contextId) FROM notifications WHERE isReleased = 0")
    suspend fun activeContextsCount(): Int

    @Query("DELETE FROM notifications WHERE isReleased = 1")
    suspend fun cleanup(): Int
}