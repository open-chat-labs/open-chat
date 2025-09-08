package com.ocplugin.app

import com.ocplugin.app.data.*

object DBManager {
    suspend fun loadConversationForContext(contextId: ContextId): List<Notification> {
        return AppDb.get().notificationDao().getNotificationsForContext(contextId)
    }

    suspend fun releaseNotificationsForContext(contextId: ContextId): Int {
        return AppDb.get().notificationDao().markAsReadForContext(contextId)
    }

    suspend fun cleanUpReleasedNotifications(): Int {
        return AppDb.get().notificationDao().cleanup()
    }

    suspend fun getActiveContextsAndNotificationsCount(): Pair<Int, Int> {
        val dao = AppDb.get().notificationDao()
        val activeContexts = dao.activeContextsCount()
        val activeNotifications = dao.activeNotificationsCount()

        return activeContexts to activeNotifications
    }
}