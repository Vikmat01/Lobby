package com.vikmat.lobbycompanion

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.animation.Crossfade
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import com.vikmat.lobbycompanion.ui.ConnectScreen
import com.vikmat.lobbycompanion.ui.LobbyTheme
import com.vikmat.lobbycompanion.ui.MainScreen

class MainActivity : ComponentActivity() {
    private val vm: LobbyVm by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.dark(0xFF000000.toInt()), navigationBarStyle = SystemBarStyle.dark(0xFF000000.toInt()))
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) handle(intent)
        setContent {
            LobbyTheme(Color(vm.accent), vm.client, vm.state?.grad.orEmpty().map { Color(it) }) {
                // back from the background: reconnect right away instead of waiting for the retry timer
                LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { if (vm.phase == Phase.Offline) vm.connect() }
                Crossfade(vm.phase == Phase.Pairing, label = "screen") { pairing ->
                    if (pairing) ConnectScreen(vm) else MainScreen(vm)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    /** lobby://pair links: scanning the PC's QR code with the regular camera app opens us here. */
    private fun handle(intent: Intent?) {
        val link = PairLink.parse(intent?.dataString) ?: return
        if (vm.phase == Phase.Pairing || vm.pc == null) vm.pair(link)
    }
}
