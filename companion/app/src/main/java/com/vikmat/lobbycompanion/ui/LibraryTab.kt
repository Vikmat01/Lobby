package com.vikmat.lobbycompanion.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vikmat.lobbycompanion.Achievement
import com.vikmat.lobbycompanion.Friend
import com.vikmat.lobbycompanion.Game
import com.vikmat.lobbycompanion.LobbyVm
import com.vikmat.lobbycompanion.fmtAgo
import com.vikmat.lobbycompanion.fmtDate
import com.vikmat.lobbycompanion.fmtMinutes
import com.vikmat.lobbycompanion.friendStatus

// ---------------------------------------------------------------- library
private val FILTERS = listOf("Все", "Установленные", "Steam", "Epic", "Свои")

@Composable
fun LibraryTab(vm: LobbyVm, open: (String) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf(0) }
    val accent = LocalAccent.current
    val list = vm.games.filter { g ->
        (query.isBlank() || g.name.contains(query.trim(), ignoreCase = true)) && when (filter) {
            1 -> g.installed
            2 -> g.source == "steam"
            3 -> g.source == "epic"
            4 -> g.source == "custom"
            else -> true
        }
    }.sortedWith(compareByDescending<Game> { it.installed }.thenByDescending { it.lastPlayed }.thenBy { it.name.lowercase() })

    Column(Modifier.fillMaxSize()) {
        TextField(
            query, { query = it }, singleLine = true, placeholder = { Text("Поиск по библиотеке", color = C.text3) },
            leadingIcon = { Icon(Icons.Filled.Search, null, tint = C.text3) },
            trailingIcon = { if (query.isNotEmpty()) IconButton({ query = "" }) { Icon(Icons.Filled.Close, "Очистить", tint = C.text3) } },
            shape = RoundedCornerShape(14.dp),
            colors = TextFieldDefaults.colors(focusedContainerColor = C.card, unfocusedContainerColor = C.card, focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent, cursorColor = accent),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 6.dp),
        )
        LazyRow(contentPadding = PaddingValues(horizontal = 18.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(FILTERS.size) { i ->
                val on = filter == i
                Text(FILTERS[i], color = if (on) Color.Black else C.text2, fontWeight = FontWeight.SemiBold, fontSize = 14.sp,
                    modifier = Modifier.clip(RoundedCornerShape(50)).background(if (on) accent else C.card).clickable { filter = i }.padding(horizontal = 14.dp, vertical = 8.dp))
            }
        }
        Text("${list.size} " + com.vikmat.lobbycompanion.plural(list.size, "игра", "игры", "игр"), style = MaterialTheme.typography.bodyMedium, color = C.text3,
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 4.dp))
        LazyVerticalGrid(GridCells.Adaptive(104.dp), contentPadding = PaddingValues(18.dp), horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.fillMaxSize()) {
            items(list, key = { it.id }) { g -> CoverTile(g) { open(g.id) } }
        }
    }
}

// ---------------------------------------------------------------- one game
@Composable
fun GameScreen(vm: LobbyVm, g: Game, close: () -> Unit) {
    val accent = LocalAccent.current
    var ach by remember(g.id) { mutableStateOf<List<Achievement>?>(null) }
    var achError by remember(g.id) { mutableStateOf<String?>(null) }
    LaunchedEffect(g.id) {
        if (g.source == "steam") { val (list, err) = vm.achievements(g); ach = list; achError = err }
    }
    val running = vm.state?.session?.gameId == g.id
    val dl = vm.state?.downloads?.firstOrNull { it.gid == g.id }

    LazyColumn(Modifier.fillMaxSize().background(C.bg)) {
        item {
            Box(Modifier.fillMaxWidth().aspectRatio(16f / 11f)) {
                Art(g.hero.ifEmpty { g.wide }, g.name, Modifier.fillMaxSize(), showName = false)
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0x66000000), Color(0x00000000), Color(0xFF000000)))))
                IconButton(close, Modifier.statusBarsPadding().padding(8.dp).background(Color(0x88000000), CircleShape)) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Назад", tint = C.text)
                }
            }
        }
        item {
            Column(Modifier.padding(horizontal = 20.dp)) {
                Eyebrow(g.sourceName)
                Spacer(Modifier.height(4.dp))
                Text(g.name, style = MaterialTheme.typography.headlineLarge)
                Spacer(Modifier.height(14.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(26.dp)) {
                    Stat(fmtMinutes(g.minutes), "сыграно")
                    Stat(if (g.lastPlayed > 0) fmtAgo(g.lastPlayed) else "—", "последний запуск")
                    Stat(if (running) "Запущена" else if (g.installed) "Установлена" else "Нет", "статус")
                }
                Spacer(Modifier.height(18.dp))
                when {
                    running -> Text("Игра запущена на ПК", color = C.ingame, fontWeight = FontWeight.SemiBold)
                    dl != null -> Text("На ПК идёт установка: ${(dl.pct * 100).toInt()}%", color = accent, fontWeight = FontWeight.SemiBold)
                    g.installed -> Button({ vm.launch(g) }, colors = ButtonDefaults.buttonColors(containerColor = accent, contentColor = Color.Black),
                        shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().height(54.dp)) {
                        Icon(Icons.Filled.PlayArrow, null); Spacer(Modifier.width(8.dp)); Text("Играть на ПК", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    }
                    g.source != "custom" && g.owned -> Button({ vm.install(g) }, colors = ButtonDefaults.buttonColors(containerColor = accent, contentColor = Color.Black),
                        shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().height(54.dp)) {
                        Icon(Icons.Filled.KeyboardArrowDown, null); Spacer(Modifier.width(8.dp)); Text("Установить на ПК", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    }
                }
            }
        }
        if (g.source == "steam") {
            item { Section("Достижения", ach?.takeIf { it.isNotEmpty() }?.let { l -> "${l.count { it.unlocked }} из ${l.size}" }) }
            val a = ach
            when {
                achError != null -> item { Text(achError!!, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(horizontal = 20.dp)) }
                a == null -> item { Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = accent, strokeWidth = 3.dp) } }
                a.isEmpty() -> item { Text("У этой игры нет достижений", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(horizontal = 20.dp)) }
                else -> {
                    item { Bar(a.count { it.unlocked }.toFloat() / a.size, Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp)) }
                    val sorted = a.sortedWith(compareByDescending<Achievement> { it.unlocked }.thenByDescending { it.time })
                    items(sorted, key = { it.id }) { AchRow(it) }
                }
            }
        }
        item { Spacer(Modifier.navigationBarsPadding().height(24.dp)) }
    }
}

@Composable
private fun Stat(value: String, label: String) {
    Column {
        Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
        Text(label.uppercase(), style = MaterialTheme.typography.labelMedium, color = C.text3, fontSize = 10.sp)
    }
}

@Composable
private fun AchRow(a: Achievement) {
    Row(Modifier.padding(horizontal = 20.dp, vertical = 5.dp).fillMaxWidth().background(C.card, RoundedCornerShape(14.dp)).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(52.dp).clip(RoundedCornerShape(10.dp)).background(C.card2)) {
            if (a.icon != null) Art(listOf(a.icon), "", Modifier.fillMaxSize(), showName = false)
            if (!a.unlocked) Box(Modifier.fillMaxSize().background(Color(0x99000000)))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(if (a.hidden) "Скрытое достижение" else a.name, style = MaterialTheme.typography.titleMedium, color = if (a.unlocked) C.text else C.text3,
                maxLines = 1, overflow = TextOverflow.Ellipsis)
            val d = if (a.hidden) "Подробности откроются после получения" else a.desc
            if (d.isNotEmpty()) Text(d, style = MaterialTheme.typography.bodyMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        Column(horizontalAlignment = Alignment.End) {
            a.pct?.let { Text("${if (it < 10) String.format(java.util.Locale("ru"), "%.1f", it) else it.toInt().toString()}%", fontSize = 12.sp, color = if (it < 5) Color(0xFFFFC145) else C.text3) }
            if (a.unlocked && a.time > 0) Text(fmtDate(a.time).substringBeforeLast(' '), fontSize = 11.sp, color = C.text3)
        }
    }
}

// ---------------------------------------------------------------- friends
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FriendsTab(vm: LobbyVm) {
    LaunchedEffect(Unit) { vm.loadFriends() }
    var refreshing by remember { mutableStateOf(false) }
    LaunchedEffect(vm.friends, vm.friendsError) { refreshing = false }
    val list = vm.friends.sortedWith(compareByDescending<Friend> { it.kind }.thenByDescending { it.lastOff }.thenBy { it.name.lowercase() })
    PullToRefreshBox(refreshing, { refreshing = true; vm.loadFriends(true) }, Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
            val playing = list.filter { it.kind == 2 }
            val online = list.filter { it.kind == 1 }
            val offline = list.filter { it.kind == 0 }
            if (!vm.friendsLoaded) item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = LocalAccent.current) } }
            else if (list.isEmpty()) item {
                Text(vm.friendsError ?: "В Steam пока нет друзей", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(24.dp))
            }
            if (playing.isNotEmpty()) { item { Section("Играют сейчас", "${playing.size}") }; items(playing, key = { it.id }) { FriendRow(it) } }
            if (online.isNotEmpty()) { item { Section("В сети", "${online.size}") }; items(online, key = { it.id }) { FriendRow(it) } }
            if (offline.isNotEmpty()) { item { Section("Не в сети", "${offline.size}") }; items(offline, key = { it.id }) { FriendRow(it) } }
        }
    }
}

@Composable
private fun FriendRow(f: Friend) {
    val ring = when (f.kind) { 2 -> C.ingame; 1 -> C.online; else -> C.line }
    Row(Modifier.padding(horizontal = 18.dp, vertical = 4.dp).fillMaxWidth().background(C.card, RoundedCornerShape(14.dp)).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Avatar(f.avatar, f.name, 48.dp, ring = ring)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(f.name, style = MaterialTheme.typography.titleMedium, color = if (f.kind == 0) C.text2 else C.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(friendStatus(f), fontSize = 13.sp, color = when (f.kind) { 2 -> C.ingame; 1 -> C.online; else -> C.text3 }, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}
