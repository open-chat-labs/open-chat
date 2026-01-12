package com.oc.app

import android.app.Application
import android.util.Log
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
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

        ProcessLifecycleOwner.get().lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) {
                isAppInForeground = true
            }
            
            override fun onStop(owner: LifecycleOwner) {
                isAppInForeground = false
            }
        })
    }
}