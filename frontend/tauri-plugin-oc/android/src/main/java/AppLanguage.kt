package com.ocplugin.app

import android.content.Context
import android.content.res.Configuration
import java.util.Locale

// The shell's own text (notifications, the ring, missed calls) is part of OpenChat's UI, so it is
// in the language chosen in the app, not the phone's. The web layer sends it with
// `set_app_language` at every start and on every change. Until it has, or for a language the shell
// has no translations for, the text follows the phone's language.
object AppLanguage {
    private const val PREFS = "oc_app_language"
    private const val KEY_TAG = "tag"

    // The app's language codes (app/src/i18n) and the res/values-* each one reads. nativeStrings.spec.ts
    // checks every app language is here and has its folder.
    private val TAGS = mapOf(
        "ar" to "ar",
        "cn" to "zh-CN",
        "de" to "de",
        "en" to "en",
        "es" to "es",
        "fa" to "fa",
        "fr" to "fr",
        "hi" to "hi",
        "it" to "it",
        "iw" to "he",
        "jp" to "ja",
        "pl" to "pl",
        "ru" to "ru",
        "uk" to "uk",
        "vi" to "vi",
    )

    // The language tag for an app language code, or null for one the shell doesn't know
    fun tagFor(appCode: String?): String? = appCode?.let { TAGS[it] }

    fun set(context: Context, appCode: String?) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
        val tag = tagFor(appCode)
        if (tag == null) prefs.remove(KEY_TAG) else prefs.putString(KEY_TAG, tag)
        prefs.apply()
    }

    fun locale(context: Context): Locale? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TAG, null)
            ?.let { Locale.forLanguageTag(it) }
}

// What every getString / getQuantityString for the shell's own text goes through: this context's
// resources in the app's language, or this context itself when there isn't one.
fun Context.localized(): Context {
    val locale = AppLanguage.locale(this) ?: return this
    return createConfigurationContext(Configuration().apply { setLocale(locale) })
}
