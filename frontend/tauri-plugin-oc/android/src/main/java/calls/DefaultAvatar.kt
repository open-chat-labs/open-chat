package com.ocplugin.app.calls

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface

// A round initial-letter avatar for a caller or group with no picture, and the
// placeholder while a real one loads.
object DefaultAvatar {
    private val colours = intArrayOf(0xFF4E7BEF.toInt(), 0xFF26D985.toInt(), 0xFFEF6C4E.toInt(), 0xFFB04EEF.toInt(), 0xFFEFB84E.toInt())

    fun forName(name: String, sizePx: Int = 256): Bitmap {
        val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colours[Math.floorMod(name.hashCode(), colours.size)] }
        canvas.drawCircle(sizePx / 2f, sizePx / 2f, sizePx / 2f, fill)
        val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = sizePx * 0.5f
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
        }
        val initial = name.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?"
        val baseline = sizePx / 2f - (text.descent() + text.ascent()) / 2f
        canvas.drawText(initial, sizePx / 2f, baseline, text)
        return bitmap
    }
}
