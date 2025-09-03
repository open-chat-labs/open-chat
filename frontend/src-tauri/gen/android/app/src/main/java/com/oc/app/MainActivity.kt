package com.oc.app

import android.content.Intent
import android.util.Log
import android.os.Bundle
import com.ocplugin.app.NotificationsHelper
import com.ocplugin.app.OpenChatPlugin
import com.ocplugin.app.data.notificationToJSObject
import kotlinx.coroutines.launch
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.lifecycle.lifecycleScope
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.view.ViewTreeObserver

class MainActivity : TauriActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        try {
            // Makes sure inputs are visible on soft keyboard toggle
            handleViewportSizeOnSoftKeyboardToggle()
            
            // Cache FCM token, and create notification channel
            NotificationsHelper.cacheFCMToken()
            NotificationsHelper.createNotificationChannel(this)
            NotificationsHelper.setNotificationIconSmall(R.drawable.ic_notification_small)
            handleNotificationIntent(intent)
        } catch (e: Exception) {
            Log.e("OC_APP", "Error occurred $e")
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        try {
            handleNotificationIntent(intent)
        } catch (e: Exception) {
            Log.e("OC_APP", "Error occurred $e")
        }
    }
    
    private fun handleNotificationIntent(intent: Intent) {
        val notificationPayload = intent.getStringExtra("notificationPayload")
        val notificationId = notificationPayload?.toLongOrNull()
        
        if (notificationId != null) {
            ProcessLifecycleOwner.get().lifecycleScope.launch {
                // Release associated notifications from the local db.
                val notification = NotificationsHelper.releaseNotificationsAfterTap(this@MainActivity, notificationId)
                
                Log.d("TEST_OC", "Released notification $notification")
                
                if (notification != null) {
                    // Send notification data to Svelte code, which will then determine where to navigate
                    OpenChatPlugin.triggerRef(
                        "notification-tap",
                        notificationToJSObject(notification)
                    )
                }
            }
        }
    }
    
    // Handle viewport resize when soft keyboard pops or hides
    //
    // Setting `android:windowSoftInputMode="adjustResize"` in the AndroidManifest.xml does not
    // seem to work in this case. This is a workaround, that seem to work well for now, until
    // we start implementation of the new UI, and fix the issue.
    private fun handleViewportSizeOnSoftKeyboardToggle() {
        val root = findViewById<View>(android.R.id.content)
        
        // Difference between visible and full height, which is a sum of heights of status bar
        // and bottom navigation bar.
        var heightDelta: Int? = null

        root.viewTreeObserver.addOnGlobalLayoutListener(object : ViewTreeObserver.OnGlobalLayoutListener {
            override fun onGlobalLayout() {
                val webView = findWebView(root)
                
                if (webView != null) {
                    val rect = android.graphics.Rect()
                    root.getWindowVisibleDisplayFrame(rect)
                    
                    val visibleHeight = rect.height()
                    val fullHeight = root.rootView.height

                    if (heightDelta == null) {
                        heightDelta = fullHeight - visibleHeight
                        Log.d("TEST_OC", "Full vs visible height offset: $heightDelta")
                    }

                    val keyboardHeight = fullHeight - visibleHeight - heightDelta
                    // Assume keyboard is visible if the difference is greater than 200
                    val isKeyboardVisible = keyboardHeight > 200
                    
                    webView.post {
                        val newHeight = if (isKeyboardVisible) fullHeight - keyboardHeight else fullHeight
                        webView.layoutParams?.height = newHeight
                        webView.requestLayout()
                    }
                }
            }
        })
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
