package com.ocplugin.app.commands

import android.app.Activity
import android.content.Intent
import android.util.Log
import androidx.browser.customtabs.CustomTabsClient
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.net.toUri
import app.tauri.annotation.InvokeArg
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import com.ocplugin.app.LOG_TAG

@InvokeArg
class OpenUrlArgs {
    var url: String? = null
}

@Suppress("UNUSED")
class OpenUrl(private val activity: Activity) {

    fun handler(invoke: Invoke) {
        val args = invoke.parseArgs(OpenUrlArgs::class.java)
        val uri = args.url?.toUri()

        if (uri == null) {
            Log.e(LOG_TAG, "Invalid or insecure URI: $uri")
            invoke.reject("Invalid or insecure URL")
            return
        }

        try {
            // TODO use AuthTabIntent once the androidx.browser AIP is stabilised to ver 1.9
            val customTabsIntent = CustomTabsIntent.Builder().build()

            // TODO fallback to Intent.ACTION_VIEW if error, or browserPackage is null
            val browserPackage = CustomTabsClient.getPackageName(activity, null)
            Log.d(LOG_TAG, "Found browser: $browserPackage")

            customTabsIntent.intent.setPackage(browserPackage)
            customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            customTabsIntent.intent.putExtra(CustomTabsIntent.EXTRA_DISABLE_BOOKMARKS_BUTTON, true)
            customTabsIntent.intent.putExtra(CustomTabsIntent.EXTRA_DISABLE_DOWNLOAD_BUTTON, true)
            customTabsIntent.launchUrl(activity.applicationContext, uri)

            // TODO do we need to send any response?
            val tauriResponse = JSObject().put("value", "ok")
            invoke.resolve(tauriResponse)
        } catch (e: Exception) {
            Log.e(LOG_TAG, e.toString())
            invoke.reject(e.toString())
        }
    }
}
