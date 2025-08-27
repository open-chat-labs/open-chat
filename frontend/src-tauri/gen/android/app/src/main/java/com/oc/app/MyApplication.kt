package com.oc.app

import android.app.Application
import android.util.Log
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import com.ocplugin.app.data.AppDb
import com.google.firebase.FirebaseApp

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
            Log.d("TEST_OC", "Firebase initialized: ${it.name}")
        } ?: Log.e("TEST_OC", "Firebase failed to initialize!")
        
        // Initialise app db.
        AppDb.init(this)

        ProcessLifecycleOwner.get().lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) {
                Log.d("OC_APP", "App is in the FOREGROUND")
                isAppInForeground = true
            }
            
            override fun onStop(owner: LifecycleOwner) {
                Log.d("OC_APP", "App is in the BACKGROUND")
                isAppInForeground = false
            }
        })
    }
}