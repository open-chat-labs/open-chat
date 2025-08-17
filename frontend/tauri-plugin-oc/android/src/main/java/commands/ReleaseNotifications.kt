package com.ocplugin.app.commands

import android.app.Activity
import android.util.Log
import app.tauri.annotation.InvokeArg
import app.tauri.plugin.Invoke
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.data.AppDb
import com.ocplugin.app.models.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@InvokeArg
class ReleaseNotificationsArgs {
    var senderId: String? = null
    var groupId: String? = null
    var communityId: String? = null
    var channelId: Int? = null
    var threadIndex: Int? = null
}

@Suppress("UNUSED")
class ReleaseNotifications(private val activity: Activity) {

    fun handler(invoke: Invoke) {
        val args = invoke.parseArgs(ReleaseNotificationsArgs::class.java)
        val dao = AppDb.get(activity).notificationDao()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val senderId = args.senderId
                val groupId = args.groupId
                val communityId = args.communityId
                val channelId = args.channelId
                val threadIndex = args.threadIndex

//                val (marked, requiresCleanup) = when {
//                    senderIdArg != null -> true to (dao.markDmAsReleased(SenderId(senderIdArg)) > 0)
//                    groupIdArg != null -> true to (dao.markGroupNotificationAsReleased(GroupId(groupIdArg)) > 0)
//                    channelIdArg != null -> true to (dao.markChannelNotificationAsReleased(ChannelId(channelIdArg)) > 0)
//                    threadIdArg != null -> true to (dao.markThreadNotificationAsReleased(ThreadId(threadIdArg)) > 0)
//                    else -> {
//                        // None of the if conditions were met!
//                        Log.e(LOG_TAG, "ReleaseNotifications invalid args, no ids provided")
//                        invoke.reject("INVALID_ARGS")
//                        false to false
//                    }
//                }
//
//                if (marked) {
//                    if (requiresCleanup) dao.cleanup()
//                    invoke.resolve(null)
//                }
            } catch (e: Exception) {
                Log.e(LOG_TAG, "Error releasing notifications", e)
                invoke.reject("EXCEPTION")
            }
        }
    }
}