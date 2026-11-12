package com.ocplugin.app.commands

import android.app.Activity
import android.util.Log
import androidx.core.content.pm.ShortcutManagerCompat
import app.tauri.plugin.Invoke
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.NotificationsManager
import com.ocplugin.app.calls.CallHandleDirectory

import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// Clears every displayed notification (per-chat + summary) and releases the
// local notification store. Used on sign-out, so nothing belonging to the
// previous account lingers in the tray or routes taps into the wrong session.
// It removes every chat shortcut too, the notifications' conversation shortcuts
// as well as the Direct Share targets: they carry the account's chat names and
// avatars into the launcher's long-press menu, the share sheet and the system's
// conversation settings.
@Suppress("UNUSED")
class ClearAllNotifications(private val activity: Activity) {

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.Main + job)

    fun handler(invoke: Invoke) {
        scope.launch {
            // Best-effort: releaseAllNotificationsAfterSummaryDismissed logs and
            // swallows its own failures, so there is no meaningful success/failure
            // to report back — clearing the tray must never block or fail sign-out.
            // Resolve once it has run.
            withContext(Dispatchers.IO) {
                NotificationsManager.releaseAllNotificationsAfterSummaryDismissed(activity)
                clearChatShortcuts()
                // Call log handles belong to the account too.
                CallHandleDirectory.clear(activity)
            }
            invoke.resolve(null)
        }
    }

    // The long-lived ones survive removeAllDynamicShortcuts in the system's cache
    // while a conversation references them, so they are removed by id as well.
    private fun clearChatShortcuts() {
        try {
            val ids = ShortcutManagerCompat.getShortcuts(
                activity,
                ShortcutManagerCompat.FLAG_MATCH_DYNAMIC or ShortcutManagerCompat.FLAG_MATCH_CACHED
            ).map { it.id }
            if (ids.isNotEmpty()) ShortcutManagerCompat.removeLongLivedShortcuts(activity, ids)
            ShortcutManagerCompat.removeAllDynamicShortcuts(activity)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to clear chat shortcuts", e)
        }
    }
}
