package com.ocplugin.app.commands

import android.app.Activity
import android.util.Log
import app.tauri.annotation.InvokeArg
import app.tauri.plugin.Invoke
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.data.*
import com.ocplugin.app.NotificationsManager

import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@InvokeArg
class ReleaseNotificationsArgs {
    val senderId: String? = null
    val groupId: String? = null
    val communityId: String? = null
    val channelId: String? = null
    val threadIndex: String? = null
}

@Suppress("UNUSED")
class ReleaseNotifications(private val activity: Activity) {

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.Main + job)

    fun handler(invoke: Invoke) {
        val args = invoke.parseArgs(ReleaseNotificationsArgs::class.java)

        val senderId = args.senderId?.let(::SenderId)
        val groupId = args.groupId?.let(::GroupId)
        val communityId = args.communityId?.let(::CommunityId)
        val channelId = args.channelId?.let { ChannelId(it.toUInt()) }
        val threadIndex = args.threadIndex?.let { ThreadIndex(it.toUInt()) }

        scope.launch {
            val success = withContext(Dispatchers.IO) {
                runCatching {
                    NotificationsManager.releaseNotificationsAfterAccessedUiContext(
                        activity, senderId, groupId, communityId, channelId, threadIndex
                    )
                }.getOrElse {
                    Log.e(LOG_TAG, "Error releasing notifications", it)
                    null
                }
            }

            when (success) {
                true  -> invoke.resolve(null)
                false -> invoke.reject("FAILED")
                null  -> invoke.reject("EXCEPTION")
            }
        }
    }
}