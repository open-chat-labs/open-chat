package com.ocplugin.app

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.util.Log
import androidx.core.content.FileProvider
import coil3.BitmapImage
import coil3.ImageLoader
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.bitmapConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

// Loads remote message attachments (e.g. shared photos / video thumbnails) for
// rendering inline in a MessagingStyle notification.
//
// MessagingStyle.Message.setData() needs a Uri the system NotificationManager can
// read; a remote https URL won't do. So we download the bitmap, cache it as a JPEG,
// and hand back a content:// Uri via the app's FileProvider. The system grants
// itself temporary read access to URIs placed in a posted notification, so no extra
// permission grants are required.
//
// Everything is best-effort: any failure returns null so callers fall back to a
// plain text-only message.
@Suppress("UNUSED")
object NotificationImageHelper {
    // Subdir under cacheDir for downloaded attachment previews. Covered by the
    // FileProvider <cache-path> root, so getUriForFile resolves files written here.
    private const val CACHE_SUBDIR = "notification_images"

    // Cap the longest edge. Notification bitmaps are shipped to the system over a
    // Binder transaction (~1MB limit), so keep them small.
    private const val MAX_DIM = 1024

    private const val JPEG_QUALITY = 80

    // Delete cached previews older than this on each render. Files referenced by a
    // freshly-posted notification are well under this age, so they're never pruned
    // out from under the system before it reads them.
    private const val MAX_AGE_MS = 12 * 60 * 60 * 1000L

    // Download + cache a single attachment, returning a content:// Uri or null.
    suspend fun loadAttachmentUri(context: Context, url: String): Uri? {
        return withContext(Dispatchers.IO) {
            try {
                val bitmap = loadScaledBitmap(context, url) ?: return@withContext null
                cacheAsContentUri(context, bitmap)
            } catch (e: Exception) {
                Log.e(OC_TAG_NOT, "Failed to load notification image: $url", e)
                null
            }
        }
    }

    private suspend fun loadScaledBitmap(context: Context, url: String): Bitmap? {
        // TODO reuse a shared ImageLoader (see AvatarHelper TODO).
        val loader = ImageLoader(context)
        val request = ImageRequest.Builder(context)
            .data(url)
            .bitmapConfig(Bitmap.Config.ARGB_8888)
            .size(MAX_DIM)
            .build()

        val result = loader.execute(request)
        if (result !is SuccessResult) {
            Log.e(OC_TAG_NOT, "Notification image load failed: $result")
            return null
        }

        val image = result.image
        return if (image is BitmapImage) image.bitmap else null
    }

    private fun cacheAsContentUri(context: Context, bitmap: Bitmap): Uri {
        val dir = File(context.cacheDir, CACHE_SUBDIR).apply { mkdirs() }
        val file = File(dir, "notif_${System.currentTimeMillis()}_${bitmap.hashCode()}.jpg")
        file.outputStream().use { out ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
        }

        val authority = "${context.packageName}.fileprovider"
        return FileProvider.getUriForFile(context, authority, file)
    }

    // Best-effort cleanup of stale cached previews. Safe to call on every render.
    fun pruneOldImages(context: Context) {
        try {
            val dir = File(context.cacheDir, CACHE_SUBDIR)
            if (!dir.isDirectory) return

            val cutoff = System.currentTimeMillis() - MAX_AGE_MS
            dir.listFiles()?.forEach { file ->
                if (file.lastModified() < cutoff) file.delete()
            }
        } catch (e: Exception) {
            Log.e(OC_TAG_NOT, "Failed to prune notification images", e)
        }
    }
}
