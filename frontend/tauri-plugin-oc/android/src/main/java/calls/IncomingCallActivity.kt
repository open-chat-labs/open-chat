package com.ocplugin.app.calls

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.ocplugin.app.AvatarHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

// The ring screen. No WebView, no chat data: caller name, avatar, call kind, Accept and
// Decline. This is the only activity that shows over the keyguard. Accept is unlock-first:
// the main activity, which is the whole app, is started only once the keyguard is gone.
class IncomingCallActivity : AppCompatActivity() {
    private lateinit var call: IncomingCall
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private val onEnd: (CallId, CallRegistry.End) -> Unit = { id, _ ->
        if (id == call.id) runOnUiThread { finishAndRemoveTask() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val incoming = IncomingCall.fromBundle(intent.extras)
        if (incoming == null) {
            finishAndRemoveTask()
            return
        }
        call = incoming
        showOverKeyguard()
        setContentView(buildView())
        CallRinger.listeners.add(onEnd)
        if (intent.action == IncomingCallNotifications.ACTION_ACCEPT) accept()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.action == IncomingCallNotifications.ACTION_ACCEPT) accept()
    }

    override fun onDestroy() {
        CallRinger.listeners.remove(onEnd)
        scope.cancel()
        super.onDestroy()
    }

    private fun showOverKeyguard() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
    }

    private fun accept() {
        val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && keyguard.isKeyguardLocked) {
            keyguard.requestDismissKeyguard(this, object : KeyguardManager.KeyguardDismissCallback() {
                override fun onDismissSucceeded() = answered()
                // Cancelled or failed: keep ringing.
                override fun onDismissCancelled() = Unit
                override fun onDismissError() = Unit
            })
        } else {
            answered()
        }
    }

    private fun answered() {
        CallRinger.accept(this, call)
        finishAndRemoveTask()
    }

    private fun decline() {
        CallRinger.decline(this, call.id)
        finishAndRemoveTask()
    }

    private fun buildView(): View {
        val dp = resources.displayMetrics.density
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#1B1B1F"))
            setPadding((32 * dp).toInt(), 0, (32 * dp).toInt(), 0)
        }
        val avatar = ImageView(this).apply {
            layoutParams = LinearLayout.LayoutParams((140 * dp).toInt(), (140 * dp).toInt()).apply {
                bottomMargin = (24 * dp).toInt()
            }
            setImageBitmap(DefaultAvatar.forName(call.title))
        }
        val title = TextView(this).apply {
            text = call.title
            textSize = 28f
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }
        val subtitle = TextView(this).apply {
            text = IncomingCallNotifications.subtitle(call)
            textSize = 16f
            setTextColor(Color.parseColor("#BBBBBB"))
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = (8 * dp).toInt(); bottomMargin = (64 * dp).toInt() }
        }
        val buttons = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        fun button(label: String, colour: String, onClick: () -> Unit) = Button(this).apply {
            text = label
            isAllCaps = false
            textSize = 18f
            setTextColor(Color.WHITE)
            // Same corner radius as the app's buttons (component-lib --rad-md, 8px).
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = 8 * dp
                setColor(Color.parseColor(colour))
            }
            stateListAnimator = null
            layoutParams = LinearLayout.LayoutParams(0, (56 * dp).toInt(), 1f).apply {
                marginStart = (12 * dp).toInt()
                marginEnd = (12 * dp).toInt()
            }
            setOnClickListener { onClick() }
        }
        // TODO i18n
        buttons.addView(button("Decline", "#D32F2F") { decline() })
        buttons.addView(button("Accept", "#2E7D32") { accept() })
        root.addView(avatar)
        root.addView(title)
        root.addView(subtitle)
        root.addView(buttons)

        call.avatarUrl?.let { url ->
            scope.launch {
                AvatarHelper.loadBitmap(this@IncomingCallActivity, url)?.let { avatar.setImageBitmap(it) }
            }
        }
        return root
    }
}
