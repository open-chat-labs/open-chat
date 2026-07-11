package com.ocplugin.app.commands

import android.app.Activity
import app.tauri.plugin.Invoke
import com.ocplugin.app.NotificationsManager

import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// Clears every displayed notification (per-chat + summary) and releases the
// local notification store. Used on sign-out, so nothing belonging to the
// previous account lingers in the tray or routes taps into the wrong session.
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
            }
            invoke.resolve(null)
        }
    }
}
