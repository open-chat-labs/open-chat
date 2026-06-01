package com.ocplugin.app.commands

import android.app.Activity
import android.content.Intent
import android.util.Log
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import app.tauri.annotation.InvokeArg
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import com.ocplugin.app.AvatarHelper
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.SHARE_SHORTCUT_ID_PREFIX
import com.ocplugin.app.SHARE_TARGET_CATEGORY
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.launch

@InvokeArg
class ChatShortcutArg {
    var id: String? = null
    var name: String? = null
    var avatarUrl: String? = null
}

@InvokeArg
class UpdateChatShortcutsArgs {
    var chats: List<ChatShortcutArg> = emptyList()
}

@Suppress("UNUSED")
class UpdateChatShortcuts(private val activity: Activity) {

    fun handler(invoke: Invoke) {
        val args = invoke.parseArgs(UpdateChatShortcutsArgs::class.java)
        val chats = args.chats.mapNotNull { c ->
            val id = c.id?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
            val name = c.name?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
            Triple(id, name, c.avatarUrl)
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Load avatars in parallel.
                val withIcons = chats.map { (id, name, avatarUrl) ->
                    async {
                        val icon = avatarUrl?.let { AvatarHelper.loadBitmap(activity, it) }
                            ?.let { IconCompat.createWithBitmap(it) }
                        ShortcutInfoCompat.Builder(activity, "$SHARE_SHORTCUT_ID_PREFIX$id")
                            .setShortLabel(name)
                            .setLongLabel(name)
                            .setLongLived(true)
                            .setCategories(setOf(SHARE_TARGET_CATEGORY))
                            .setIntent(buildShareIntent(id))
                            .apply { if (icon != null) setIcon(icon) }
                            .build()
                    }
                }.awaitAll()

                // Remove any stale share-target shortcuts that aren't in the
                // new top-N before pushing the new ones, so the share sheet
                // doesn't keep showing chats that have aged out.
                pruneStaleShareShortcuts(withIcons.map { it.id })

                withIcons.forEach { ShortcutManagerCompat.pushDynamicShortcut(activity, it) }

                Log.d(LOG_TAG, "Updated ${withIcons.size} share-target shortcuts")
                invoke.resolve(JSObject().put("count", withIcons.size))
            } catch (e: Exception) {
                Log.e(LOG_TAG, "Failed to update chat shortcuts", e)
                invoke.reject(e.message ?: "UPDATE_CHAT_SHORTCUTS_FAILED")
            }
        }
    }

    // Builds the Intent that fires when the user taps a chat shortcut from the
    // share sheet. EXTRA_SHORTCUT_ID is supplied by Android automatically when
    // launched via a shortcut, but we also set it explicitly so direct launches
    // from the launcher (long-press app icon) carry it too.
    private fun buildShareIntent(chatId: String): Intent {
        val packageName = activity.packageName
        val mainActivityClass = Class.forName("$packageName.MainActivity")
        return Intent(activity, mainActivityClass).apply {
            action = Intent.ACTION_SEND
            type = "*/*"
            putExtra(Intent.EXTRA_SHORTCUT_ID, chatId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
    }

    private fun pruneStaleShareShortcuts(keepIds: List<String>) {
        val keep = keepIds.toSet()
        val stale = ShortcutManagerCompat.getDynamicShortcuts(activity)
            .filter { it.id.startsWith(SHARE_SHORTCUT_ID_PREFIX) && it.id !in keep }
            .map { it.id }
        if (stale.isNotEmpty()) {
            ShortcutManagerCompat.removeDynamicShortcuts(activity, stale)
        }
    }
}
