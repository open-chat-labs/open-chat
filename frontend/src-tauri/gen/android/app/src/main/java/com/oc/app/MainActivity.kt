package com.oc.app

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.addCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.lifecycle.lifecycleScope
import app.tauri.plugin.JSObject
import com.ocplugin.app.LOG_TAG
import com.ocplugin.app.NotificationsManager
import com.ocplugin.app.OCPluginCompanion
import kotlinx.coroutines.launch

class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        try {
            // Makes sure inputs are visible on soft keyboard toggle
            handleViewportSizeOnSoftKeyboardToggle()
            handleNotificationIntent(intent)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Error occurred $e")
        }

        onBackPressedDispatcher.addCallback(this) { interceptBack() }
    }
    
    private fun interceptBack() {
        Log.d(LOG_TAG, "Back pressed/swiped intercepted in MainActivity")

        // Raise back pressed, but send no data!
        OCPluginCompanion.triggerRef("back-pressed", JSObject())

        // If you want to allow default Android back afterwards:
        // this.remove()   // remove callback
        // onBackPressedDispatcher.onBackPressed() // dispatch again
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        try {
            handleNotificationIntent(intent)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Error occurred $e")
        }
    }

    private fun handleNotificationIntent(intent: Intent) {
        val notificationPayload = intent.getStringExtra("notificationPayload")

        // Payload should be json string
        if (notificationPayload != null) {
            ProcessLifecycleOwner.get().lifecycleScope.launch {
                NotificationsManager.releaseNotificationsAfterTapOrDismissed(
                        this@MainActivity,
                        notificationPayload,
                        true
                )
            }
        }
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)

        // Check if the device is set for gesture or button navigation!
        ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
            val navInsets = insets.getInsets(
                WindowInsetsCompat.Type.navigationBars()
            )

            val density = webView.resources.displayMetrics.density
            val bottomDp = navInsets.bottom / density

            // Detect if the app is using gesture navigation!
            val isGestureNavigation = bottomDp <= 36
            
            OCPluginCompanion.triggerRef(
                "gesture-navigation", 
                JSObject().put("isGestureNavigation", isGestureNavigation)
            )
            
            insets
        }
    }

    // Handle viewport resize when soft keyboard pops or hides
    //
    // Setting only `android:windowSoftInputMode="adjustResize"` in the AndroidManifest.xml does not
    // seem to work by itself, but adds to this and can improve resize behaviour for web/hybrid apps.
    private fun handleViewportSizeOnSoftKeyboardToggle() {

        WindowCompat.setDecorFitsSystemWindows(window, false)
        val rootView = findViewById<View>(android.R.id.content)

        ViewCompat.setOnApplyWindowInsetsListener(rootView) { _, insets ->
            val imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
            val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())
            val imeHeight = imeInsets.bottom

            if (imeVisible) {
                Log.d(LOG_TAG, "Keyboard OPEN, height = $imeHeight")
                rootView.updatePadding(bottom = imeHeight)
            } else {
                Log.d(LOG_TAG, "Keyboard CLOSED")
                rootView.updatePadding(bottom = 0)
            }

            // Important: return the insets unchanged
            insets
        }
    }
    
    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view

        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                val child = view.getChildAt(i)
                val result = findWebView(child)
                if (result != null) return result
            }
        }
        return null
    }
}
