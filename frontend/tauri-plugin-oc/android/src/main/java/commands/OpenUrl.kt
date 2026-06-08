package com.ocplugin.app.commands

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.browser.customtabs.CustomTabsClient
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.net.toUri
import app.tauri.annotation.InvokeArg
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import com.ocplugin.app.LOG_TAG
import kotlin.concurrent.thread

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
            invoke.reject("INVALID_OR_INSECURE_URI")
            return
        }

        thread(name = "OpenUrlThread") {
            // TODO remove response object, not necessary
            val successResponse = JSObject().put("value", "ok")

            try {
                val scheme = uri.scheme?.lowercase()
                if (scheme == "http" || scheme == "https") {
                    // Open web URLs in a Custom Tab, which explicitly targets a
                    // browser package. A plain ACTION_VIEW intent would resolve
                    // back to this app for verified app-link domains (e.g.
                    // oc.app), re-firing the deep-link event and causing a loop.
                    openWithCustomTabIntent(uri)
                } else {
                    // Non-web schemes (mailto:, tel:, other app deep links) -
                    // let the system resolve the appropriate handler.
                    val intent = Intent(Intent.ACTION_VIEW, uri)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    activity.startActivity(intent)
                }
                invoke.resolve(successResponse)

            } catch (e: ActivityNotFoundException) {
                // Open in custom tab browser as fallback
                openWithCustomTabIntent(uri)
                invoke.resolve(successResponse)
            } catch (e: Exception) {
                Log.e(LOG_TAG, e.toString())
                invoke.reject(e.toString())
            }
        }
    }

    fun openWithCustomTabIntent(uri: Uri) {
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
    }
}
