package com.vikmat.lobbycompanion.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vikmat.lobbycompanion.LobbyVm
import com.vikmat.lobbycompanion.Phase

@Composable
fun MainScreen(vm: LobbyVm, startTab: Int = 0) {
    var tab by rememberSaveable { mutableStateOf(startTab) }
    var openId by rememberSaveable { mutableStateOf<String?>(null) }
    val snack = remember { SnackbarHostState() }
    val accent = LocalAccent.current

    LaunchedEffect(vm.message) {
        val m = vm.message ?: return@LaunchedEffect
        vm.message = null
        snack.showSnackbar(m)
    }

    Box(Modifier.fillMaxSize().background(C.bg)) {
        Scaffold(
            containerColor = C.bg,
            topBar = { TopBar(vm) },
            snackbarHost = {
                SnackbarHost(snack) { Snackbar(it, containerColor = C.card2, contentColor = C.text, shape = RoundedCornerShape(14.dp)) }
            },
            bottomBar = {
                NavigationBar(containerColor = Color(0xFF0A0A0A), tonalElevation = 0.dp) {
                    val colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color.Black, indicatorColor = accent, selectedTextColor = C.text,
                        unselectedIconColor = C.text3, unselectedTextColor = C.text3,
                    )
                    NavigationBarItem(tab == 0, { tab = 0 }, { Icon(Icons.Filled.Home, null) }, label = { Text("Главная") }, colors = colors)
                    NavigationBarItem(tab == 1, { tab = 1 }, { Icon(Icons.AutoMirrored.Filled.List, null) }, label = { Text("Библиотека") }, colors = colors)
                    NavigationBarItem(tab == 2, { tab = 2 }, { Icon(Icons.Filled.Person, null) }, label = { Text("Друзья") }, colors = colors)
                }
            },
        ) { pad ->
            Box(Modifier.fillMaxSize().padding(pad)) {
                when (tab) {
                    0 -> HomeTab(vm) { openId = it }
                    1 -> LibraryTab(vm) { openId = it }
                    else -> FriendsTab(vm)
                }
                OfflineBanner(vm)
            }
        }

        val game = vm.games.firstOrNull { it.id == openId }
        AnimatedVisibility(game != null, enter = fadeIn() + slideInVertically { it / 6 }, exit = fadeOut() + slideOutVertically { it / 6 }) {
            if (game != null) GameScreen(vm, game) { openId = null }
        }
        BackHandler(openId != null) { openId = null }
        BackHandler(openId == null && tab != 0) { tab = 0 }
    }
}

@Composable
private fun TopBar(vm: LobbyVm) {
    val s = vm.state
    val bro = s?.bro
    var menu by remember { mutableStateOf(false) }
    var confirm by remember { mutableStateOf(false) }
    val accent = LocalAccent.current
    Row(Modifier.fillMaxWidth().statusBarsPadding().padding(start = 18.dp, end = 6.dp, top = 10.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Avatar(s?.avatar, s?.name ?: "Игрок", 48.dp, ring = accent)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(s?.name ?: "…", style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                if (bro != null) {
                    Spacer(Modifier.width(8.dp))
                    Text("LV ${bro.level}", color = Color.Black, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.background(accent, RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 1.dp))
                    if (bro.prestige > 0) Text("  ★${if (bro.prestige > 1) bro.prestige else ""}", color = Color(0xFFFFD45A), fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(5.dp))
            if (bro != null) Row(verticalAlignment = Alignment.CenterVertically) {
                Bar(bro.into.toFloat() / bro.need.coerceAtLeast(1), Modifier.width(110.dp), height = 5.dp)
                Spacer(Modifier.width(8.dp))
                Text("${bro.into} / ${bro.need} XP", fontSize = 12.sp, color = C.text3, maxLines = 1, softWrap = false)
            }
            Spacer(Modifier.height(3.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                val online = vm.phase == Phase.Online
                Box(Modifier.size(7.dp).background(if (online) C.ingame else C.warn, CircleShape))
                Spacer(Modifier.width(6.dp))
                Text((vm.pc?.name ?: "ПК") + if (online) "" else " · нет связи", fontSize = 12.sp, color = C.text3, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        Box {
            IconButton(onClick = { menu = true }) { Icon(Icons.Filled.MoreVert, "Меню", tint = C.text2) }
            DropdownMenu(menu, { menu = false }, containerColor = C.card2) {
                DropdownMenuItem({ Text("Открыть Lobby на ПК") }, { menu = false; vm.summon() })
                DropdownMenuItem({ Text("Обновить") }, { menu = false; vm.refresh() })
                DropdownMenuItem({ Text("Отключить телефон", color = C.warn) }, { menu = false; confirm = true })
            }
        }
    }
    if (confirm) AlertDialog(
        onDismissRequest = { confirm = false }, containerColor = C.card2,
        title = { Text("Отключить телефон?") },
        text = { Text("Lobby на ПК забудет этот телефон. Подключить снова можно по QR-коду.") },
        confirmButton = { TextButton({ confirm = false; vm.forget() }) { Text("Отключить", color = C.warn) } },
        dismissButton = { TextButton({ confirm = false }) { Text("Отмена", color = C.text2) } },
    )
}

@Composable
private fun OfflineBanner(vm: LobbyVm) {
    val show = vm.phase == Phase.Offline || vm.phase == Phase.Connecting
    AnimatedVisibility(show, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(12.dp).background(C.card2, RoundedCornerShape(14.dp)).clickable { vm.connect() }.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(Modifier.size(8.dp).background(C.warn, CircleShape))
            Text(
                if (vm.phase == Phase.Connecting) "Подключаюсь к ${vm.pc?.name ?: "ПК"}…"
                else "ПК не отвечает. Lobby запущен и телефон в той же сети? Нажми, чтобы повторить",
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}
