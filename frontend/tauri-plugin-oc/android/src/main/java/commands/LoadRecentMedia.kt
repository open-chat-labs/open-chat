package com.ocplugin.app.commands

import android.Manifest
import android.app.Activity
import android.content.ContentResolver
import android.content.ContentUris
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.util.Log
import android.util.Size
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import app.tauri.annotation.InvokeArg
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import com.ocplugin.app.LOG_TAG
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.launch

// Permissions request code for gallery access...
const val PERM_CODE_GALLERY = 1001

@InvokeArg
class LoadMediaArgs {
    var count: Int? = 50
    var offset: Int? = 0
}


data class MediaFile(
    val id: Long,
    val uri: String,
    val filename: String,
    val mimeType: String,
    val dateAdded: Long,
    val isVideo: Boolean,
    val filePath: String,
    val size: Int,
    val thumbnail: String? = null
)

@Suppress("UNUSED")
class LoadRecentMedia(private val activity: Activity) {

    fun handler(invoke: Invoke) {
        if (!checkPermissionGranted()) return

        val args = invoke.parseArgs(LoadMediaArgs::class.java)
        val count = args.count ?: 50
        val offset = args.offset ?: 0

        Log.d(LOG_TAG, "LOAD MEDIA, PERMISSION GRANTED ::: $count / $offset")

        // Use a background scope to load media and thumbnails in parallel
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val mediaMetadata = queryDeviceMedia(count, offset)

                // Process thumbnails in parallel for each media item
                val mediaWithThumbnails = mediaMetadata.map { item ->
                    async {
                        val thumbnail = loadThumbnailBase64(item.id, item.uri.toUri())
                        item.copy(thumbnail = thumbnail)
                    }
                }.awaitAll()

                val resultData = JSArray()
                mediaWithThumbnails.forEach { item ->
                    val obj = JSObject()
                    obj.put("uri", item.uri)
                    obj.put("filename", item.filename)
                    obj.put("mimeType", item.mimeType)
                    obj.put("dateAdded", item.dateAdded)
                    obj.put("isVideo", item.isVideo)
                    obj.put("filePath", item.filePath)
                    obj.put("size", item.size)
                    obj.put("thumbnail", item.thumbnail)
                    resultData.put(obj)
                }

                invoke.resolve(
                    JSObject()
                        .put("permission", "granted")
                        .put("media", resultData)
                )

            } catch (e: Exception) {
                Log.e(LOG_TAG, "LOAD MEDIA, ERROR", e)
                invoke.reject("LOAD_FAILED")
            }
        }
    }

    // Manage permissions required to access
    fun getRequiredPermissions(): Array<String> {
        // Android v21+ has slightly different permissions that are required
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return arrayOf(
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO
            )
        }

        // For older Android versions...
        return arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
    }

    fun askForPermission() {
        ActivityCompat.requestPermissions(activity, getRequiredPermissions(), PERM_CODE_GALLERY)
    }

    fun checkPermissionGranted(): Boolean {
        return getRequiredPermissions().all {
            ContextCompat.checkSelfPermission(activity, it) == PackageManager.PERMISSION_GRANTED
        }
    }


    // Private functions; image loading and thumbnail transformations

    private fun queryDeviceMedia(count: Int, offset: Int): List<MediaFile> {
        val mediaList = mutableListOf<MediaFile>()
        val queryUri = MediaStore.Files.getContentUri("external")

        // 1. Define what columns we want to retrieve
        val projection = arrayOf(
            MediaStore.Files.FileColumns._ID,
            MediaStore.Files.FileColumns.DISPLAY_NAME,
            MediaStore.Files.FileColumns.MIME_TYPE,
            MediaStore.Files.FileColumns.DATE_ADDED,
            MediaStore.Files.FileColumns.MEDIA_TYPE,
            MediaStore.Files.FileColumns.DATA,
            MediaStore.Files.FileColumns.SIZE,
        )

        val selection =
            ("${MediaStore.Files.FileColumns.MEDIA_TYPE}=${MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE} OR " +
                    "${MediaStore.Files.FileColumns.MEDIA_TYPE}=${MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO}")

        val cursor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Modern approach: Use a Bundle for arguments
            val queryArgs = Bundle().apply {
                putInt(ContentResolver.QUERY_ARG_LIMIT, count)
                putInt(ContentResolver.QUERY_ARG_OFFSET, offset)
                putString(ContentResolver.QUERY_ARG_SQL_SELECTION, selection)
                putStringArray(
                    ContentResolver.QUERY_ARG_SORT_COLUMNS,
                    arrayOf(MediaStore.Files.FileColumns.DATE_ADDED)
                )
                putInt(
                    ContentResolver.QUERY_ARG_SORT_DIRECTION,
                    ContentResolver.QUERY_SORT_DIRECTION_DESCENDING
                )
            }
            activity.contentResolver.query(queryUri, projection, queryArgs, null)
        } else {
            // Legacy fallback: Use the sortOrder string (risky, but usually works on older APIs)
            val sortOrder =
                "${MediaStore.Files.FileColumns.DATE_ADDED} DESC LIMIT $count OFFSET $offset"
            activity.contentResolver.query(queryUri, projection, selection, null, sortOrder)
        }

        cursor?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
            val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME)
            val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MIME_TYPE)
            val dateCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_ADDED)
            val typeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MEDIA_TYPE)
            val dataCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATA)
            val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.SIZE)


            while (cursor.moveToNext()) {
                val id = cursor.getLong(idCol)
                val name = cursor.getString(nameCol)
                val mime = cursor.getString(mimeCol)
                val date = cursor.getLong(dateCol)
                val type = cursor.getInt(typeCol)
                val isVideo = type == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO
                val size = cursor.getInt(sizeCol)
                val filePath = cursor.getString(dataCol)

                // 4. Construct the actual Content URI
                val baseUri = if (isVideo)
                    MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                else
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI

                val contentUri = ContentUris.withAppendedId(baseUri, id)

                mediaList.add(
                    MediaFile(
                        id,
                        contentUri.toString(),
                        name,
                        mime,
                        date,
                        isVideo,
                        filePath,
                        size
                    )
                )
            }
        }

        return mediaList
    }

    private fun loadThumbnailBase64(id: Long, contentUri: Uri): String? {
        val size = Size(256, 256)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Modern way of loading thumbnails...
            return try {
                val bitmap = activity.contentResolver.loadThumbnail(contentUri, size, null)
                bitmapToBase64(bitmap)
            } catch (e: Exception) {
                null
            }
        } else {
            // This is legacy api!
            @Suppress("DEPRECATION")
            val bitmap = MediaStore.Images.Thumbnails.getThumbnail(
                activity.contentResolver,
                id,
                MediaStore.Images.Thumbnails.MINI_KIND,
                null
            )

            return if (bitmap != null) bitmapToBase64(bitmap) else null
        }
    }

    private fun bitmapToBase64(bitmap: android.graphics.Bitmap): String {
        val outputStream = java.io.ByteArrayOutputStream()

        // 70-80 quality is the "sweet spot" for thumbnails
        bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 70, outputStream)
        val bytes = outputStream.toByteArray()
        val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
        return "data:image/jpeg;base64,$base64"
    }

}
