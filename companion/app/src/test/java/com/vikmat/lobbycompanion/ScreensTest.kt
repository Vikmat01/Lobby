package com.vikmat.lobbycompanion

import android.app.Application
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.ui.graphics.Color
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.cash.paparazzi.detectEnvironment
import androidx.activity.compose.LocalActivityResultRegistryOwner
import androidx.activity.result.ActivityResultRegistry
import androidx.activity.result.ActivityResultRegistryOwner
import androidx.activity.result.contract.ActivityResultContract
import androidx.core.app.ActivityOptionsCompat
import androidx.compose.runtime.CompositionLocalProvider
import com.vikmat.lobbycompanion.ui.ConnectScreen
import com.vikmat.lobbycompanion.ui.GameScreen
import com.vikmat.lobbycompanion.ui.LobbyTheme
import com.vikmat.lobbycompanion.ui.MainScreen
import org.junit.Rule
import org.junit.Test

/** Renders the screens with sample data so they can be checked without a phone. */
class ScreensTest {
    @get:Rule
    val paparazzi = Paparazzi(
        // like the Honor: about 360 dp wide
        deviceConfig = DeviceConfig.PIXEL_6_PRO.copy(screenWidth = 1440, screenHeight = 3200, density = com.android.resources.Density.XXXHIGH), theme = "android:Theme.Material.NoActionBar",
        // layoutlib here is API 34; compose text calls an API 35 method otherwise
        environment = detectEnvironment().copy(compileSdkVersion = 34),
    )

    private val noResults = object : ActivityResultRegistryOwner {
        override val activityResultRegistry = object : ActivityResultRegistry() {
            override fun <I, O> onLaunch(requestCode: Int, contract: ActivityResultContract<I, O>, input: I, options: ActivityOptionsCompat?) {}
        }
    }

    private fun vm(demo: Boolean): LobbyVm {
        val app = Application()
        val m = ContextWrapper::class.java.getDeclaredMethod("attachBaseContext", Context::class.java)
        m.isAccessible = true
        m.invoke(app, paparazzi.context)
        val v = LobbyVm(app)
        if (demo) {
            val now = System.currentTimeMillis()
            fun g(i: Int, name: String, src: String, inst: Boolean, min: Int, last: Long, t: Int = 0, u: Int = 0) =
                Game("$src:$i", src, name, inst, true, min, last, t, u, emptyList(), emptyList(), emptyList())
            val games = listOf(
                g(1, "Glasshaven", "steam", true, 1100, now - 3600_000, 40, 31), g(2, "Northwind Rally", "steam", true, 640, now - 86400_000 * 2),
                g(3, "Neon Atlas", "epic", true, 300, now - 86400_000 * 5), g(4, "Hollow Tide", "steam", true, 4320, now - 86400_000 * 9),
                g(5, "Paper Knights", "custom", true, 0, 0), g(6, "Low Orbit", "steam", false, 90, now - 86400_000L * 40),
                g(7, "Ironroot", "steam", true, 220, now - 86400_000 * 3), g(8, "Saltlight", "epic", false, 0, 0),
            )
            val bro = Bro(12, 640, 1230, 9800, 23, 2, 0, listOf(
                Challenge("a", "play", "steam:1", "Glasshaven", 45, 20, 90, false),
                Challenge("b", "first", "custom:5", "Paper Knights", 15, 0, 80, false),
                Challenge("c", "ach", "steam:4", "Hollow Tide", 1, 1, 120, true),
            ), null)
            val state = PcState("GAMING-PC", "1.8.0", 0xFF5EE7C4.toInt(), listOf(0xFF43E97B, 0xFF38F9D7, 0xFF8B7CFF, 0xFFD77BF0).map { it.toInt() }, "Vikmat01", null, null, bro,
                listOf(Download("steam:6", "Low Orbit", "downloading", 0.42, 4_500_000_000, 10_700_000_000)))
            val friends = listOf(
                Friend("1", "Kirill_GG", null, 1, "Glasshaven", "900100", 0), Friend("2", "Mashka", null, 1, "Northwind Rally", "900102", 0),
                Friend("3", "dr0n", null, 6, null, null, 0), Friend("4", "Lena", null, 3, null, null, 0),
                Friend("5", "Arthur", null, 0, null, null, now - 86400_000 * 2), Friend("6", "NightOwl", null, 0, null, null, now - 86400_000L * 30),
            )
            v.showDemo(Pc("GAMING-PC", listOf("192.168.1.5"), 47820, "t"), state, games, friends)
        }
        return v
    }

    @Test fun connect() { val v = vm(false); paparazzi.snapshot { LobbyTheme(Color(v.accent), null, v.state?.grad.orEmpty().map { Color(it) }) { CompositionLocalProvider(LocalActivityResultRegistryOwner provides noResults) { ConnectScreen(v) } } } }
    @Test fun home() { val v = vm(true); paparazzi.snapshot { LobbyTheme(Color(v.accent), null, v.state?.grad.orEmpty().map { Color(it) }) { MainScreen(v) } } }
    @Test fun library() { val v = vm(true); paparazzi.snapshot { LobbyTheme(Color(v.accent), null, v.state?.grad.orEmpty().map { Color(it) }) { MainScreen(v, 1) } } }
    @Test fun friends() { val v = vm(true); paparazzi.snapshot { LobbyTheme(Color(v.accent), null, v.state?.grad.orEmpty().map { Color(it) }) { MainScreen(v, 2) } } }
    @Test fun game() { val v = vm(true); paparazzi.snapshot { LobbyTheme(Color(v.accent), null, v.state?.grad.orEmpty().map { Color(it) }) { GameScreen(v, v.games[0]) {} } } }
}
