package com.ocplugin.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Parcelable
import android.provider.OpenableColumns
import android.util.Log
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import java.io.File

object ShareIntentManager {

    private const val SHARE_EVENT = "share-target"
    private const val CACHE_SUBDIR = "shares"
    // Cached shared files live until either (a) they are consumed by the
    // composer and uploaded, or (b) the user abandons the share. We keep
    // them around for a day so users who get distracted mid-share can come
    // back, but no longer — otherwise the directory grows unboundedly.
    private const val MAX_CACHED_SHARE_AGE_MS = 24L * 60 * 60 * 1000

    // Returns true if the intent was a share intent (handled), false otherwise.
    fun handle(context: Context, intent: Intent): Boolean {
        val action = intent.action ?: return false
        if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) {
            return false
        }

        val mimeType = intent.type ?: "*/*"
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)
        // Prefer our custom extra (set explicitly on the shortcut's intent
        // template). Fall back to Android's auto-populated EXTRA_SHORTCUT_ID,
        // which arrives as the shortcut's full id ("share_<chatId>"), so we
        // strip our known prefix to recover the bare chat id.
        val shortcutId = intent.getStringExtra(EXTRA_CHAT_ID)
            ?: intent.getStringExtra(Intent.EXTRA_SHORTCUT_ID)?.let { sid ->
                if (sid.startsWith(SHARE_SHORTCUT_ID_PREFIX))
                    sid.removePrefix(SHARE_SHORTCUT_ID_PREFIX)
                else null
            }

        val uris: List<Uri> = when (action) {
            Intent.ACTION_SEND -> {
                val uri = getParcelableExtraCompat(intent, Intent.EXTRA_STREAM, Uri::class.java)
                if (uri != null) listOf(uri) else emptyList()
            }
            Intent.ACTION_SEND_MULTIPLE -> {
                getParcelableArrayListExtraCompat(intent, Intent.EXTRA_STREAM, Uri::class.java)
                    ?: emptyList()
            }
            else -> emptyList()
        }

        // Copy each URI to app cache so the temporary read grant (tied to the
        // source activity) can't expire while the user is composing.
        val files = uris.mapNotNull { copyToCache(context, it) }

        val payload = JSObject()
            .put("mimeType", mimeType)
            .put("text", text)
            .put("shortcutId", shortcutId)
            .put("files", JSArray().apply { files.forEach { put(it.toJSObject()) } })

        Log.d(LOG_TAG, "Share intent received: $payload")
        OCPluginCompanion.triggerRef(SHARE_EVENT, payload)
        return true
    }

    // Sweep stale files out of the shares cache directory. Safe to call on
    // any thread; runs the actual I/O in a background thread so the caller
    // (typically the plugin's load() callback) doesn't block.
    fun cleanupStaleShares(context: Context) {
        Thread {
            try {
                val cacheRoot = File(context.cacheDir, CACHE_SUBDIR)
                if (!cacheRoot.isDirectory) return@Thread
                val threshold = System.currentTimeMillis() - MAX_CACHED_SHARE_AGE_MS
                cacheRoot.listFiles()?.forEach { file ->
                    if (file.isFile && file.lastModified() < threshold) {
                        if (!file.delete()) {
                            Log.w(LOG_TAG, "Could not delete stale shared file: ${file.name}")
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(LOG_TAG, "Failed to clean stale shared files", e)
            }
        }.start()
    }

    private data class CachedFile(
        val path: String,
        val name: String,
        val mimeType: String?,
        val size: Long,
    ) {
        fun toJSObject(): JSObject = JSObject()
            .put("path", path)
            .put("name", name)
            .put("mimeType", mimeType)
            .put("size", size)
    }

    private fun copyToCache(context: Context, uri: Uri): CachedFile? {
        return try {
            val resolver = context.contentResolver
            val mimeType = resolver.getType(uri)

            val (displayName, sizeFromQuery) = queryDisplayNameAndSize(context, uri)
            val safeName = sanitiseName(displayName ?: defaultNameForMime(mimeType))

            val cacheRoot = File(context.cacheDir, CACHE_SUBDIR).apply { mkdirs() }
            val target = uniqueChildFile(cacheRoot, safeName)

            val bytesCopied = resolver.openInputStream(uri)?.use { input ->
                target.outputStream().use { output -> input.copyTo(output) }
            } ?: 0L

            CachedFile(
                path = target.absolutePath,
                name = safeName,
                mimeType = mimeType,
                size = if (sizeFromQuery > 0L) sizeFromQuery else bytesCopied,
            )
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to copy shared URI to cache: $uri", e)
            null
        }
    }

    private fun queryDisplayNameAndSize(context: Context, uri: Uri): Pair<String?, Long> {
        var name: String? = null
        var size: Long = 0
        try {
            context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (nameIdx >= 0 && !cursor.isNull(nameIdx)) {
                        name = cursor.getString(nameIdx)
                    }
                    val sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE)
                    if (sizeIdx >= 0 && !cursor.isNull(sizeIdx)) {
                        size = cursor.getLong(sizeIdx)
                    }
                }
            }
        } catch (_: Exception) {
            // Some providers don't support OpenableColumns; that's fine.
        }
        return name to size
    }

    private fun sanitiseName(name: String): String {
        val cleaned = name.replace(Regex("[\\\\/:*?\"<>|]"), "_").trim()
        return cleaned.ifEmpty { "shared" }
    }

    private fun defaultNameForMime(mimeType: String?): String {
        val ext = when {
            mimeType == null -> "bin"
            mimeType.startsWith("image/") -> mimeType.substringAfter("/")
            mimeType.startsWith("video/") -> mimeType.substringAfter("/")
            mimeType.startsWith("audio/") -> mimeType.substringAfter("/")
            mimeType == "application/pdf" -> "pdf"
            else -> "bin"
        }
        return "shared_${System.currentTimeMillis()}.$ext"
    }

    private fun uniqueChildFile(dir: File, name: String): File {
        val base = File(dir, name)
        if (!base.exists()) return base
        val dot = name.lastIndexOf('.')
        val stem = if (dot > 0) name.substring(0, dot) else name
        val ext = if (dot > 0) name.substring(dot) else ""
        var i = 1
        while (true) {
            val candidate = File(dir, "${stem}_$i$ext")
            if (!candidate.exists()) return candidate
            i++
        }
    }

    private fun <T : Parcelable> getParcelableExtraCompat(
        intent: Intent,
        key: String,
        clazz: Class<T>,
    ): T? {
        @Suppress("DEPRECATION")
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(key, clazz)
        } else {
            intent.getParcelableExtra(key)
        }
    }

    private fun <T : Parcelable> getParcelableArrayListExtraCompat(
        intent: Intent,
        key: String,
        clazz: Class<T>,
    ): ArrayList<T>? {
        @Suppress("DEPRECATION")
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableArrayListExtra(key, clazz)
        } else {
            intent.getParcelableArrayListExtra(key)
        }
    }
}
