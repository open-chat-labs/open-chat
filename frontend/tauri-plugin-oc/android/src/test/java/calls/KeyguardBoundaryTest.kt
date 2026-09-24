package com.ocplugin.app.calls

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory

// Pins invariants 12 and 14 of native calls M2 (#9510) against the sources and manifests,
// with no Android runtime. Gradle runs unit tests with the module directory as the
// working directory; the app module sits next to the plugin under src-tauri.
class KeyguardBoundaryTest {
    private val plugin = File("src/main")
    private val app = File("../../src-tauri/gen/android/app/src/main")

    private fun kotlinSources(root: File) =
        root.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()

    @Test
    fun `invariant 12 only the ring activity shows over the keyguard`() {
        assertTrue(app.isDirectory)
        val flagged = (kotlinSources(plugin) + kotlinSources(app)).filter {
            val text = it.readText()
            "setShowWhenLocked" in text || "FLAG_SHOW_WHEN_LOCKED" in text || "setTurnScreenOn" in text
        }
        assertEquals(listOf("IncomingCallActivity.kt"), flagged.map { it.name })
    }

    @Test
    fun `invariant 12 no manifest grants show-when-locked to any activity`() {
        for (manifest in listOf(File(plugin, "AndroidManifest.xml"), File(app, "AndroidManifest.xml"))) {
            val activities = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(manifest)
                .getElementsByTagName("activity")
            for (i in 0 until activities.length) {
                val attrs = activities.item(i).attributes
                assertTrue(manifest.path, attrs.getNamedItem("android:showWhenLocked") == null)
                assertTrue(manifest.path, attrs.getNamedItem("android:turnScreenOn") == null)
            }
        }
    }

    @Test
    fun `invariant 12 the ring activity hosts no WebView and is not exported`() {
        val source = File(plugin, "java/calls/IncomingCallActivity.kt").readText()
        assertFalse(source.contains("android.webkit"))
        val activities = DocumentBuilderFactory.newInstance().newDocumentBuilder()
            .parse(File(plugin, "AndroidManifest.xml")).getElementsByTagName("activity")
        val ring = (0 until activities.length).map { activities.item(it) }
            .single { it.attributes.getNamedItem("android:name").nodeValue.endsWith("IncomingCallActivity") }
        assertEquals("false", ring.attributes.getNamedItem("android:exported").nodeValue)
    }

    @Test
    fun `invariant 19 the app counts as on screen only while the main activity is started`() {
        val source = File(app, "java/com/oclabs/openchat/MyApplication.kt").readText()
        assertTrue(source.contains("activity is MainActivity"))
        assertFalse(source.contains("ProcessLifecycleOwner"))
        // The ring activity is an activity in this process and must never count.
        assertFalse(source.contains("IncomingCallActivity"))
    }

    @Test
    fun `invariant 10 the production handle path evicts through the tested rule`() {
        val source = File(plugin, "java/calls/CallHandleDirectory.kt").readText()
        val token = source.substring(source.indexOf("fun token("), source.indexOf("fun chat("))
        assertTrue(token.contains("evictOldest("))
        assertFalse(token.contains("removeAt(0)"))
    }

    // The registry decides; the adapters obey. Neither adapter loads under plain JUnit
    // (Handler, Looper, Context), so obedience is pinned in the source, as for the
    // handle directory above.
    @Test
    fun `invariant 5 the notification manager rings a call push without looking at the app state`() {
        val source = File(plugin, "java/NotificationsManager.kt").readText()
        val ring = source.substring(source.indexOf("is PushRoute.Ring ->"), source.indexOf("is PushRoute.Message ->"))
        assertFalse(ring.contains("appIsInForeground"))
        assertTrue(ring.contains("CallRinger.onStarted("))
    }

    @Test
    fun `invariants 7 and 8 the ringer passes the registry's end through and posts a missed call only when the end says so`() {
        val source = File(plugin, "java/calls/CallRinger.kt").readText()
        // Only the in-app join names an End itself; every other end comes back from the
        // registry and is passed on as returned.
        assertFalse(source.contains("End.MISSED"))
        assertFalse(source.contains("End.REJECTED"))
        assertFalse(source.contains("End.ANSWERED_ELSEWHERE"))
        val finish = source.substring(source.indexOf("private fun finish("), source.indexOf("private fun postMissed("))
        assertTrue(finish.contains("end.postsMissedCall"))
    }

    @Test
    fun `invariant 17 every ring notification is posted through the registry's once-only gate`() {
        val ringer = File(plugin, "java/calls/CallRinger.kt").readText()
        val showRing = ringer.substring(ringer.indexOf("fun showRing("), ringer.indexOf("fun redial("))
        assertTrue(showRing.contains("registry.shouldPostRing("))
        // postRing has exactly one caller: showRing.
        val callers = kotlinSources(plugin).filter { it.readText().contains("IncomingCallNotifications.postRing(") }
        assertEquals(listOf("CallRinger.kt"), callers.map { it.name })
        assertEquals(1, ringer.split("IncomingCallNotifications.postRing(").size - 1)
    }

    @Test
    fun `invariant 14 the parked answer is written only by the ringer and never read from an intent`() {
        val writers = (kotlinSources(plugin) + kotlinSources(app)).filter {
            Regex("""pendingCallAction\s*=(?!\s*null)""").containsMatchIn(it.readText())
        }
        assertEquals(listOf("CallRinger.kt"), writers.map { it.name })
        // MainActivity reads no call extra at all.
        val main = File(app, "java/com/oclabs/openchat/MainActivity.kt").readText()
        assertFalse(main.contains("callAction"))
        assertFalse(main.contains("oc_call_"))
    }
}
