package com.ocplugin.app

import android.content.Intent
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class ShareOutTest {
    @get:Rule
    val tmp = TemporaryFolder()

    // the app's cache directory, with its private files beside it
    private fun cache(): File = File(tmp.root, "cache")

    private fun root(): File = ShareOut.root(cache())

    @Test
    fun `a file staged in chunks is shared whole, under its own name`() {
        val root = root()
        val file = ShareOut.stage(root, null, "photo.jpg", byteArrayOf(1, 2))!!
        assertEquals(file, ShareOut.stage(root, file, "photo.jpg", byteArrayOf(3)))

        val staged = ShareOut.resolve(root, file)!!
        assertEquals("photo.jpg", staged.name)
        assertArrayEquals(byteArrayOf(1, 2, 3), staged.readBytes())
    }

    // Invariant: only a file staged in the outbound share directory can be shared, so the web layer
    // can't hand another app the app's own private files
    @Test
    fun `nothing outside the staged files can be shared`() {
        val root = root()
        val private = File(tmp.root, "databases/app.db").apply { parentFile!!.mkdirs(); writeText("x") }
        File(cache().apply { mkdirs() }, "top.txt").writeText("x")
        val staged = ShareOut.stage(root, null, "../../top.txt", byteArrayOf(1))!!

        assertTrue(ShareOut.resolve(root, staged)!!.canonicalPath.startsWith(root.canonicalPath))
        assertNull(ShareOut.resolve(root, "../top.txt"))
        assertNull(ShareOut.resolve(root, "../../databases/app.db"))
        assertNull(ShareOut.resolve(root, private.absolutePath))
        assertNull(ShareOut.stage(root, "../top.txt", null, byteArrayOf(9)))
        assertEquals("x", File(cache(), "top.txt").readText())
    }

    // Invariant: a shared file is only exposed through a content:// URI the receiving app is granted
    // read on, never a file:// path
    @Test
    fun `files go out as content URIs with a read grant`() {
        val photo = File(root(), "a/photo.jpg")
        val video = File(root(), "b/clip.mp4")
        val content = { f: File -> "content://com.oclabs.openchat.fileprovider/my_cache_images/${f.name}" }

        val one = ShareOut.send(listOf(photo to "image/jpeg"), emptyList(), content)
        assertEquals(Intent.ACTION_SEND, one.action)
        assertEquals("image/jpeg", one.type)
        assertNotEquals(0, one.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION)

        val two = ShareOut.send(listOf(photo to "image/jpeg", video to "video/mp4"), emptyList(), content)
        assertEquals(Intent.ACTION_SEND_MULTIPLE, two.action)
        assertEquals("*/*", two.type)
        assertEquals(2, two.streams.size)
        assertNotEquals(0, two.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION)

        assertThrows(IllegalArgumentException::class.java) {
            ShareOut.send(listOf(photo to "image/jpeg"), emptyList()) { "file://${it.absolutePath}" }
        }
    }

    // Invariant: the share sheet leaves OpenChat itself out (its share-in, and so its Direct Share
    // chat tiles, which open the same activity): share-in refuses streams from OpenChat's own
    // FileProvider, so media shared there would arrive as its caption alone
    @Test
    fun `the share sheet leaves OpenChat itself out`() {
        val ownTargets = listOf("com.oclabs.openchat/com.oclabs.openchat.MainActivity")
        val send = ShareOut.send(listOf(File(root(), "a/photo.jpg") to "image/jpeg"), ownTargets) {
            "content://com.oclabs.openchat.fileprovider/my_cache_images/${it.name}"
        }
        assertEquals(ownTargets, send.exclude)
    }

    @Test
    fun `staged files are swept after a day`() {
        val root = root()
        val old = ShareOut.resolve(root, ShareOut.stage(root, null, "old.jpg", byteArrayOf(1))!!)!!.parentFile!!
        val fresh = ShareOut.resolve(root, ShareOut.stage(root, null, "new.jpg", byteArrayOf(1))!!)!!.parentFile!!
        val now = System.currentTimeMillis()
        old.setLastModified(now - 25L * 60 * 60 * 1000)

        ShareOut.prune(root, now)

        assertFalse(old.exists())
        assertTrue(fresh.exists())
    }
}
