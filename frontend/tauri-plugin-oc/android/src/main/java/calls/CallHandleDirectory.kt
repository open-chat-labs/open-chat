package com.ocplugin.app.calls

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom

// Opaque handles for the phone's call log.
//
// Telecom writes a row per self-managed call whose address any app with READ_CALL_LOG can
// read, and chat ids are canister ids on a public ledger. So the address is a random token
// minted per chat and kept only on this device. Digits only, because the dialler rewrites
// letters in a "number" to keypad digits before handing a redial back to us.
//
// `resolve` and `mint` are pure so the rules run under JUnit.
object CallHandleDirectory {
    private const val PREFS = "oc_call_handles"
    private const val KEY_MAP = "map_v1"
    private const val KEY_ORDER = "order_v1"
    private const val TOKEN_DIGITS = 12
    const val DEFAULT_LIMIT = 500

    private val random = SecureRandom()

    // The token for a chat, minting one if the chat has none. Most recently used last.
    @Synchronized
    fun token(context: Context, chat: CallChat): String {
        val (map, order) = load(context)
        val key = chatKey(chat)
        val existing = map.entries.firstOrNull { it.value == key }?.key
        val token = existing ?: mint(map.keys)
        map[token] = key
        order.remove(token)
        order.add(token)
        while (order.size > DEFAULT_LIMIT) map.remove(order.removeAt(0))
        save(context, map, order)
        return token
    }

    @Synchronized
    fun chat(context: Context, address: String?): CallChat? {
        val (map, _) = load(context)
        return resolve(map, address)?.let { chatFromKey(it) }
    }

    @Synchronized
    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }

    // Pure. The address as the dialler hands it back: digits, possibly with punctuation or
    // spacing, possibly inside a `tel:` or `sip:` URI. Anything the directory never minted
    // resolves to nothing.
    fun resolve(map: Map<String, String>, address: String?): String? {
        val digits = address?.substringAfter(':')?.filter { it.isDigit() } ?: return null
        if (digits.isEmpty()) return null
        return map[digits]
    }

    fun mint(existing: Set<String>): String {
        while (true) {
            val token = buildString { repeat(TOKEN_DIGITS) { append(random.nextInt(10)) } }
            if (token !in existing) return token
        }
    }

    // Applies the same bound as `token` to an in-memory directory. Pure.
    fun evictOldest(map: MutableMap<String, String>, order: MutableList<String>, limit: Int) {
        while (order.size > limit) map.remove(order.removeAt(0))
    }

    fun chatKey(chat: CallChat): String =
        listOfNotNull(chat.chatType, chat.chatId, chat.communityId).joinToString("|")

    fun chatFromKey(key: String): CallChat? {
        val parts = key.split('|')
        if (parts.size < 2) return null
        return CallChat(parts[0], parts[1], parts.getOrNull(2))
    }

    private fun load(context: Context): Pair<MutableMap<String, String>, MutableList<String>> {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val map = mutableMapOf<String, String>()
        val order = mutableListOf<String>()
        try {
            val json = JSONObject(prefs.getString(KEY_MAP, "{}") ?: "{}")
            json.keys().forEach { map[it] = json.getString(it) }
            val arr = JSONArray(prefs.getString(KEY_ORDER, "[]") ?: "[]")
            for (i in 0 until arr.length()) order.add(arr.getString(i))
        } catch (_: Exception) {
            map.clear()
            order.clear()
        }
        return map to order
    }

    private fun save(context: Context, map: Map<String, String>, order: List<String>) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_MAP, JSONObject(map).toString())
            .putString(KEY_ORDER, JSONArray(order).toString())
            .apply()
    }
}
