package com.oc.app

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.addCallback
import androidx.activity.enableEdgeToEdge
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
        // Has to be called before super, and only for Android versions <= 14
        enableEdgeToEdgeForAndroid14AndLess()
        
        super.onCreate(savedInstanceState)
        
        try {
            handleWindowInsets()
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

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                // Grant camera & mic to the WebView
                request.grant(request.resources)
            }
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

    fun handleWindowInsets() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        
        val rootView = findViewById<View>(android.R.id.content)

        // Set a window insets change listener:
        // - Allows us to set the inset for the status bar,
        // - Allows us to set the bottom inset for the soft keyboard or device nav, depending if
        //   the keyboard is visible or not!
        //
        // Setting only `android:windowSoftInputMode="adjustResize"` in the AndroidManifest.xml does not
        // seem to work by itself, but adds to this and can improve resize behaviour for web/hybrid apps.
        ViewCompat.setOnApplyWindowInsetsListener(rootView) { _, insets ->            
            // Insets relevant for soft keyboard open/close
            val imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
            val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())
            val imeHeight = imeInsets.bottom
            
            // Insets for the status bar...
            val statusBarInsets = insets.getInsets(
                WindowInsetsCompat.Type.statusBars()
            )
            
            // Insets for the nav bar...
            val navInsets = insets.getInsets(
                WindowInsetsCompat.Type.navigationBars()
            )

            // Get the nav bar height in dp...
            val density = rootView.resources.displayMetrics.density
            val navHeightDp = navInsets.bottom / density

            // Detect if the app is using gesture navigation!
            val isGestureNavigation = navHeightDp <= 36
            
            if (imeVisible) {
                Log.d(LOG_TAG, "Keyboard OPEN - inset height = $imeHeight")
                rootView.updatePadding(bottom = imeHeight)
            } else {
                Log.d(LOG_TAG, "Inset changed, or soft keyboard CLOSED - inset height = $imeHeight")

                // If the device is using gesture navigation we let the Svelte part of the app
                // decide the bottom padding where required.
                rootView.updatePadding(bottom = if (isGestureNavigation) 0 else navInsets.bottom)
            }
            
            // Report inset changes to Svelte...
            OCPluginCompanion.triggerRef(
                "window-inset-change", 
                JSObject()
                    .put("isKeyboardOpen", imeVisible)
                    .put("isGestureNavigation", isGestureNavigation)
                    .put("navHeightDp", navHeightDp)
                    .put("statusBarHeightDp", statusBarInsets.top / density) 
                    .put("keyboardHeightDp", imeHeight / density)
                    .put("apiLevel", Build.VERSION.SDK_INT)
                    .put("osVersion", Build.VERSION.RELEASE)
            )

            // Important: return the insets unchanged
            insets
        }
    }

    // Enable edge-to-edge window mode for the app, since this is the default mode on Android 15+.
    // By making this the default way of rendering the app, makes support easier for developers, and
    // reduces the cases we need to handle.
    //
    // This is, or should be, supported on devices down to Android 10!
    fun enableEdgeToEdgeForAndroid14AndLess() {
        if (Build.VERSION.SDK_INT < 35) {
            enableEdgeToEdge()
            Log.d(LOG_TAG, "Edge-to-edge enabled for Android <= 14")

            // Set to FALSE for White icons (Dark backgrounds) 
            // Set to TRUE for Dark icons (Light backgrounds)
            val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
            windowInsetsController.isAppearanceLightStatusBars = false
            windowInsetsController.isAppearanceLightNavigationBars = false

            // TODO dynamically set the status bar and nav bar colours based on the app theme!
            // The code below is how to figure out if we're using a dark theme.
            // val isDarkMode = (resources.configuration.uiMode and 
            //     Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        }
    }
}
