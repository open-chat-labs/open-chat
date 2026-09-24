package com.ocplugin.app.calls

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Pins invariants 9 and 10 of native calls M2 (#9510): the Telecom address is an opaque
// handle, and a handle resolves only to the chat it was minted for.
class CallHandleDirectoryTest {
    private val alice = CallChat(CallChat.DIRECT, "alice-user-id")
    private val channel = CallChat(CallChat.CHANNEL, "42", "community-id")

    @Test
    fun `invariant 9 a minted handle is twelve digits and carries nothing of the chat`() {
        repeat(20) {
            val token = CallHandleDirectory.mint(emptySet())
            assertEquals(12, token.length)
            assertTrue(token.all { it.isDigit() })
            assertTrue(!token.contains("alice"))
        }
    }

    @Test
    fun `invariant 9 minting retries a handle already in use`() {
        // The digit source yields all ones, then all twos.
        val digits = (List(12) { 1 } + List(12) { 2 }).iterator()
        val fresh = CallHandleDirectory.mint(setOf("111111111111")) { digits.next() }
        assertEquals("222222222222", fresh)
    }

    @Test
    fun `invariant 10 a handle resolves to the chat it was minted for`() {
        val map = mapOf("123456789012" to CallHandleDirectory.chatKey(alice))
        assertEquals(alice, CallHandleDirectory.chatFromKey(CallHandleDirectory.resolve(map, "123456789012")!!))
        // As the dialler hands it back: inside a URI, with punctuation or spacing.
        assertEquals(CallHandleDirectory.chatKey(alice), CallHandleDirectory.resolve(map, "sip:123456789012"))
        assertEquals(CallHandleDirectory.chatKey(alice), CallHandleDirectory.resolve(map, "tel:1234-5678-9012"))
        assertEquals(CallHandleDirectory.chatKey(alice), CallHandleDirectory.resolve(map, "1234 5678 9012"))
    }

    @Test
    fun `invariant 10 a handle the directory never minted resolves to nothing`() {
        val map = mapOf("123456789012" to CallHandleDirectory.chatKey(alice))
        assertNull(CallHandleDirectory.resolve(map, "999999999999"))
        assertNull(CallHandleDirectory.resolve(map, "sip:alice-user-id"))
        assertNull(CallHandleDirectory.resolve(map, ""))
        assertNull(CallHandleDirectory.resolve(map, null))
    }

    @Test
    fun `invariant 10 an evicted handle resolves to nothing`() {
        val map = mutableMapOf("111111111111" to "a", "222222222222" to "b", "333333333333" to "c")
        val order = mutableListOf("111111111111", "222222222222", "333333333333")
        CallHandleDirectory.evictOldest(map, order, 2)
        assertNull(CallHandleDirectory.resolve(map, "111111111111"))
        assertEquals("b", CallHandleDirectory.resolve(map, "222222222222"))
    }

    @Test
    fun `a channel chat round trips through its key`() {
        assertEquals(channel, CallHandleDirectory.chatFromKey(CallHandleDirectory.chatKey(channel)))
        assertEquals(alice, CallHandleDirectory.chatFromKey(CallHandleDirectory.chatKey(alice)))
    }
}
