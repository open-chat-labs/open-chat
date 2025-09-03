package com.ocplugin.app

import android.content.Context
import android.graphics.*
import android.util.Log
import coil3.BitmapImage
import coil3.ImageLoader
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.bitmapConfig
import com.ocplugin.app.models.ReceivedNotification
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.core.graphics.createBitmap
import com.ocplugin.app.models.SenderId

fun Bitmap.toCircularBitmap(): Bitmap {
    val size = minOf(width, height)

    // Create output bitmap
    val output = createBitmap(size, size)
    val canvas = Canvas(output)

    val paint = Paint().apply {
        isAntiAlias = true
        shader = BitmapShader(this@toCircularBitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
    }

    val rect = RectF(0f, 0f, size.toFloat(), size.toFloat())
    val radius = size / 2f

    canvas.drawRoundRect(rect, radius, radius, paint)
    return output
}

// All functions are used, though outside the plugin codebase
@Suppress("UNUSED")
object AvatarHelper {

    suspend fun loadBitmapForReceivedNotification(context: Context, notification: ReceivedNotification): Bitmap? {
        val toMainAvatarURL = { entityId: String, avatarId: String? ->
            if (avatarId != null) {
                "${String.format(BuildConfig.AVATAR_BASE_URL, entityId)}/avatar/$avatarId"
            } else {
                null
            }
        }

        val url = when (notification) {
            is ReceivedNotification.Direct ->
                toMainAvatarURL(notification.senderId.value, notification.senderAvatarId)
            is ReceivedNotification.Group ->
                toMainAvatarURL(notification.groupId.value, notification.groupAvatarId)
            is ReceivedNotification.Channel ->
                if (notification.channelAvatarId != null) {
                    "${
                        String.format(
                            BuildConfig.AVATAR_BASE_URL,
                            notification.communityId.value
                        )
                    }/channel/${notification.channelId.value}/avatar/${notification.channelAvatarId}}"
                } else {
                    toMainAvatarURL(notification.communityId.value, notification.communityAvatarId)
                }
        }

        return if (url != null) loadBitmap(context, url) else null
    }

    suspend fun loadBitmapForUser(context: Context, senderId: SenderId, avatarId: String): Bitmap? {
        val url = "${String.format(BuildConfig.AVATAR_BASE_URL, senderId.value)}/avatar/${avatarId}"

        return loadBitmap(context, url)
    }

    // A coroutine based function for loading avatars off main thread, uses lightweight Coil
    // library.
    suspend fun loadBitmap(context: Context, url: String): Bitmap? {
        Log.d(LOG_TAG, "Loading avatar for url: $url")
        return withContext(Dispatchers.IO) {
            try {
                // TODO for global caching reuse image loader
                val loader = ImageLoader(context)
                val request =
                    ImageRequest.Builder(context)
                        .data(url)
                        .bitmapConfig(
                            Bitmap.Config.ARGB_8888
                        ) // Needed to convert to Bitmap
                        .build()

                val result = loader.execute(request)
                if (result is SuccessResult) {
                    val image = result.image
                    if (image is BitmapImage) {
                        image.bitmap.toCircularBitmap()
                    } else {
                        null
                    }
                } else {
                    Log.e("TEST_OC", "Avatar result: $result")
                    null
                }
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }
}
