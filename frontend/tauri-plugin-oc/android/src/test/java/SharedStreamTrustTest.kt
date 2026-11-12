package com.ocplugin.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SharedStreamTrustTest {
    private val own = "com.oclabs.openchat"
    private val providers = mapOf(
        "$own.fileprovider" to own,
        "com.google.android.apps.photos.contentprovider" to "com.google.android.apps.photos",
    )

    private fun accepts(scheme: String?, authority: String?) =
        ShareIntentManager.acceptsSharedStream(scheme, authority, own) { providers[it] }

    @Test
    fun `a share never reads a file URI, which would open our private data directory`() {
        assertFalse(accepts("file", ""))
    }

    @Test
    fun `a share never reads a URI served by our own provider, with or without a user id`() {
        assertFalse(accepts("content", "$own.fileprovider"))
        assertFalse(accepts("content", "0@$own.fileprovider"))
    }

    @Test
    fun `a share reads a content URI served by another app`() {
        assertTrue(accepts("content", "com.google.android.apps.photos.contentprovider"))
    }
}
