package com.oclabs.openchat

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.util.Log
import com.ocplugin.app.data.AppDb
import com.google.firebase.FirebaseApp
import com.ocplugin.app.LOG_TAG

class MyApplication: Application() {
    
    companion object {        
        // Volatile ensures boolean changes re immediately visible across threads
        @Volatile
        var isAppInForeground: Boolean = false
            private set
    }
    
    override fun onCreate() {
        super.onCreate()

        // Manually init Firebase, allows us to make sure init was fine!
        FirebaseApp.initializeApp(this)?.let {
            Log.d(LOG_TAG, "Firebase initialized: ${it.name}")
        } ?: Log.e(LOG_TAG, "Firebase failed to initialize!")
        
        // Initialise app db.
        AppDb.init(this)

        // "On screen" means the main activity, which hosts the app. The native incoming
        // call screen is an activity in this process too, and it must not count: while it
        // rings, the app may be dead behind it and a push forwarded to the web layer would
        // be lost.
        registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
            override fun onActivityStarted(activity: Activity) {
                if (activity is MainActivity) isAppInForeground = true
            }

            override fun onActivityStopped(activity: Activity) {
                if (activity is MainActivity) isAppInForeground = false
            }

            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
            override fun onActivityResumed(activity: Activity) = Unit
            override fun onActivityPaused(activity: Activity) = Unit
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
            override fun onActivityDestroyed(activity: Activity) = Unit
        })
    }
}