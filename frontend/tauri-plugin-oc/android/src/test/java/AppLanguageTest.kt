package com.ocplugin.app

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import android.content.res.Configuration
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test
import java.util.Locale

// The shell's own text follows the language chosen in the app (AppLanguage.kt), and the phone's
// until there is one.
class AppLanguageTest {

    // A context with in-memory preferences, whose configuration contexts are marked
    private class FakeContext : ContextWrapper(null) {
        val prefs = FakePrefs()
        val localizedContext = ContextWrapper(null)
        override fun getSharedPreferences(name: String?, mode: Int): SharedPreferences = prefs
        override fun createConfigurationContext(overrideConfiguration: Configuration): Context =
            localizedContext
    }

    @Test
    fun `invariant 1 with a saved app language the text resolves in it, not the phone's`() {
        val context = FakeContext()
        AppLanguage.set(context, "de")

        assertEquals(Locale.forLanguageTag("de"), AppLanguage.locale(context))
        assertSame(context.localizedContext, context.localized())

        // the app codes that aren't the platform's
        AppLanguage.set(context, "cn")
        assertEquals(Locale.forLanguageTag("zh-CN"), AppLanguage.locale(context))
        AppLanguage.set(context, "jp")
        assertEquals(Locale.forLanguageTag("ja"), AppLanguage.locale(context))
        AppLanguage.set(context, "iw")
        assertEquals(Locale.forLanguageTag("he"), AppLanguage.locale(context))
    }

    @Test
    fun `invariant 2 with nothing saved the text follows the phone`() {
        val context = FakeContext()

        assertNull(AppLanguage.locale(context))
        assertSame(context, context.localized())
    }

    @Test
    fun `invariant 2 an unknown code clears the saved language, so the text follows the phone`() {
        val context = FakeContext()
        AppLanguage.set(context, "de")
        AppLanguage.set(context, "sv")

        assertNull(AppLanguage.locale(context))
        assertSame(context, context.localized())
    }
}

private class FakePrefs : SharedPreferences {
    private val values = mutableMapOf<String, Any?>()

    override fun getAll(): Map<String, *> = values
    override fun getString(key: String, defValue: String?): String? = values[key] as String? ?: defValue
    override fun getStringSet(key: String, defValues: Set<String>?): Set<String>? = defValues
    override fun getInt(key: String, defValue: Int): Int = defValue
    override fun getLong(key: String, defValue: Long): Long = defValue
    override fun getFloat(key: String, defValue: Float): Float = defValue
    override fun getBoolean(key: String, defValue: Boolean): Boolean = defValue
    override fun contains(key: String): Boolean = values.containsKey(key)
    override fun edit(): SharedPreferences.Editor = Editor()
    override fun registerOnSharedPreferenceChangeListener(l: SharedPreferences.OnSharedPreferenceChangeListener) {}
    override fun unregisterOnSharedPreferenceChangeListener(l: SharedPreferences.OnSharedPreferenceChangeListener) {}

    private inner class Editor : SharedPreferences.Editor {
        private val changes = mutableMapOf<String, Any?>()
        private val removed = mutableSetOf<String>()

        override fun putString(key: String, value: String?) = apply { changes[key] = value }
        override fun putStringSet(key: String, values: Set<String>?) = apply { changes[key] = values }
        override fun putInt(key: String, value: Int) = apply { changes[key] = value }
        override fun putLong(key: String, value: Long) = apply { changes[key] = value }
        override fun putFloat(key: String, value: Float) = apply { changes[key] = value }
        override fun putBoolean(key: String, value: Boolean) = apply { changes[key] = value }
        override fun remove(key: String) = apply { removed.add(key) }
        override fun clear() = apply { removed.addAll(values.keys) }
        override fun commit(): Boolean {
            apply()
            return true
        }
        override fun apply() {
            removed.forEach { values.remove(it) }
            values.putAll(changes)
        }
    }
}
