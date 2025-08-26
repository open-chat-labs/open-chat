package com.oc.app

import android.app.Application
import android.util.Log
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner

class MyApplication: Application() {
    
    companion object {        
        // Volatile ensures boolean changes re immediately visible across threads
        @Volatile
        var isAppInForeground: Boolean = false
            private set
    }
    
    override fun onCreate() {
        super.onCreate()

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