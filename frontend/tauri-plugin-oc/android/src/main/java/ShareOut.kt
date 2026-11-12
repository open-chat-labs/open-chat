package com.ocplugin.app

import android.content.Intent
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

// Message media shared from OpenChat to another app (the message menu's Share). The web layer
// stages each file in the app cache, a chunk at a time (`stageShareFile`), and `share` hands the
// staged files to the system share sheet. Each file gets a directory of its own under shares_out,
// so it keeps its own name for the app receiving it, and whatever is left there is swept after a
// day, as the share-in cache is (ShareIntentManager).
object ShareOut {
    private const val CACHE_SUBDIR = "shares_out"
    private const val MAX_AGE_MS = 24L * 60 * 60 * 1000

    fun root(cacheDir: File): File = File(cacheDir, CACHE_SUBDIR)

    // Writes a chunk of a staged file: the first chunk (no `file`) starts a new one, the rest are
    // appended to the one `file` names. Returns the staged file's name under root, which the next
    // chunk and `share` pass back, or null when `file` isn't a file staged there.
    fun stage(root: File, file: String?, name: String?, bytes: ByteArray): String? {
        val target = if (file == null) {
            val dir = File(root, UUID.randomUUID().toString()).apply { mkdirs() }
            File(dir, safeName(name))
        } else {
            resolve(root, file) ?: return null
        }
        FileOutputStream(target, file != null).use { it.write(bytes) }
        return "${target.parentFile!!.name}/${target.name}"
    }

    // The staged file a name from the web layer stands for: only ever a file in one of root's own
    // directories, so the web layer can't share anything else of the app's (its databases, say).
    fun resolve(root: File, file: String): File? {
        val base = root.canonicalFile
        val target = File(base, file).canonicalFile
        return target.takeIf { it.isFile && it.parentFile?.parentFile == base }
    }

    data class Send(
        val action: String,
        val type: String,
        val streams: List<String>,
        val flags: Int,
        // components the share sheet leaves out (ComponentName.flattenToString)
        val exclude: List<String>,
    )

    // How the staged files go out: ACTION_SEND for one, ACTION_SEND_MULTIPLE for more, each as a
    // content:// URI (`uriFor`, the app's FileProvider) the receiving app is granted read on. Never a
    // file:// path, which another app can't read and Android refuses to send.
    //
    // The sheet leaves out OpenChat's own share targets (`ownTargets`), and with them its Direct
    // Share chat tiles, which open the same activity: share-in refuses streams from OpenChat's own
    // FileProvider, so the media wouldn't arrive. Forwarding is how a message goes to another chat.
    fun send(files: List<Pair<File, String?>>, ownTargets: List<String>, uriFor: (File) -> String): Send {
        val streams = files.map { (file, _) -> uriFor(file) }
        require(streams.all { it.startsWith("content://") }) { "A shared file must go out as a content:// URI" }
        val types = files.map { (_, type) -> type ?: "application/octet-stream" }.distinct()
        return Send(
            action = if (files.size > 1) Intent.ACTION_SEND_MULTIPLE else Intent.ACTION_SEND,
            type = types.singleOrNull() ?: "*/*",
            streams = streams,
            flags = Intent.FLAG_GRANT_READ_URI_PERMISSION,
            exclude = ownTargets,
        )
    }

    // Deletes the staged files older than a day. A file goes on being read by the app it was
    // shared to after the sheet closes, so it isn't deleted when the share is done.
    fun prune(root: File, now: Long) {
        root.listFiles()?.forEach { dir ->
            if (dir.lastModified() < now - MAX_AGE_MS) dir.deleteRecursively()
        }
    }

    private fun safeName(name: String?): String {
        val cleaned = ShareIntentManager.sanitiseName(name ?: "")
        return if (cleaned == "." || cleaned == "..") "shared" else cleaned
    }
}
