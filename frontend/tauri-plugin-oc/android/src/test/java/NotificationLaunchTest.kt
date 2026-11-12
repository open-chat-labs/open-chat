package com.ocplugin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.w3c.dom.Element
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory

// Invariant: a notification payload is honoured only from OpenChat's own non-exported entry.
// MainActivity is exported, so any app can start it with a forged notificationPayload; our
// notifications launch it through the unexported NotificationLaunch alias instead.
class NotificationLaunchTest {
    private val own = "com.oclabs.openchat"

    @Test
    fun `only a launch through the alias is a notification launch`() {
        assertTrue(IntentsManager.isNotificationLaunch("$own.NotificationLaunch", own))
        assertFalse(IntentsManager.isNotificationLaunch("$own.MainActivity", own))
        assertFalse(IntentsManager.isNotificationLaunch(null, own))
    }

    // NotificationDismissReceiver reads the same extra (and has a TODO to share that code), so
    // a refactor could drop the gate without any other test noticing.
    @Test
    fun `MainActivity checks the alias before it reads the payload`() {
        val main = File("../../src-tauri/gen/android/app/src/main/java/com/oclabs/openchat/MainActivity.kt").readText()
        val read = "getStringExtra(\"notificationPayload\")"
        assertEquals(1, main.split(read).size - 1)
        val gate = main.indexOf("isNotificationLaunch(intent.component")
        assertTrue(gate >= 0 && gate < main.indexOf(read))
    }

    // Our taps must go through the alias, or MainActivity ignores their payload.
    @Test
    fun `notification intents never target MainActivity directly`() {
        assertFalse(File("src/main/java/IntentsManager.kt").readText().contains("MainActivity"))
    }

    @Test
    fun `the manifest alias is unexported and targets MainActivity`() {
        val manifest = DocumentBuilderFactory.newInstance()
            .apply { isNamespaceAware = true }
            .newDocumentBuilder()
            .parse(File("../../src-tauri/gen/android/app/src/main/AndroidManifest.xml"))
        val android = "http://schemas.android.com/apk/res/android"
        val aliases = manifest.getElementsByTagName("activity-alias")
        val alias = (0 until aliases.length)
            .map { aliases.item(it) as Element }
            .single { IntentsManager.isNotificationLaunch("$own${it.getAttributeNS(android, "name")}", own) }
        assertEquals("false", alias.getAttributeNS(android, "exported"))
        assertEquals(".MainActivity", alias.getAttributeNS(android, "targetActivity"))
        assertEquals(0, alias.getElementsByTagName("intent-filter").length)
    }
}
