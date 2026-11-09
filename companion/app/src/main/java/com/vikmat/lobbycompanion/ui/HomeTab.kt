package com.vikmat.lobbycompanion.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vikmat.lobbycompanion.Challenge
import com.vikmat.lobbycompanion.Download
import com.vikmat.lobbycompanion.Game
import com.vikmat.lobbycompanion.LobbyVm
import com.vikmat.lobbycompanion.broProgress
import com.vikmat.lobbycompanion.broText
import com.vikmat.lobbycompanion.downloadState
import com.vikmat.lobbycompanion.fmtAgo
import com.vikmat.lobbycompanion.fmtBytes
import com.vikmat.lobbycompanion.fmtMinutes

private val shade = Brush.verticalGradient(listOf(Color(0x00000000), Color(0x66000000), Color(0xEE000000)))

@Composable
fun HomeTab(vm: LobbyVm, open: (String) -> Unit) {
    val s = vm.state
    val games = vm.games
    val session = s?.session
    val running = session?.let { ss -> games.firstOrNull { it.id == ss.gameId } }
    val recent = games.filter { it.lastPlayed > 0 }.sortedByDescending { it.lastPlayed }
    val hero = running ?: recent.firstOrNull { it.installed } ?: games.firstOrNull { it.installed }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
        if (hero != null) item { HeroCard(vm, hero, running != null, session?.state, open) }

        s?.downloads?.takeIf { it.isNotEmpty() }?.let { dls ->
            item { Section("Загрузки на ПК") }
            items(dls, key = { "dl" + it.gid }) { DownloadRow(it) }
        }

        val bro = s?.bro
        if (bro != null) {
            val all = listOfNotNull(bro.week) + bro.challenges
            item { Section("Game Bro", "замен на сегодня: ${bro.rerolls}") }
            item {
                LazyRow(contentPadding = PaddingValues(horizontal = 18.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(all, key = { it.id }) { c -> ChallengeCard(vm, c, games.firstOrNull { it.id == c.gameId }, open) }
                }
            }
        }

        if (recent.isNotEmpty()) {
            item { Section("Недавние") }
            item {
                LazyRow(contentPadding = PaddingValues(horizontal = 18.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(recent.take(12), key = { "r" + it.id }) { g -> CoverTile(g, Modifier.width(120.dp)) { open(g.id) } }
                }
            }
        }
        if (games.isEmpty() && s != null) item {
            Text("В Lobby на ПК пока нет игр", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(24.dp))
        }
    }
}

@Composable
fun Section(title: String, sub: String? = null) {
    Row(Modifier.fillMaxWidth().padding(start = 18.dp, end = 18.dp, top = 22.dp, bottom = 10.dp), verticalAlignment = Alignment.Bottom) {
        Text(title, style = MaterialTheme.typography.titleLarge)
        if (sub != null) { Spacer(Modifier.width(10.dp)); Text(sub, style = MaterialTheme.typography.bodyMedium, color = C.text3) }
    }
}

@Composable
private fun HeroCard(vm: LobbyVm, g: Game, running: Boolean, state: String?, open: (String) -> Unit) {
    val accent = LocalAccent.current
    Box(Modifier.padding(horizontal = 18.dp, vertical = 6.dp).fillMaxWidth().aspectRatio(16f / 10f).clip(RoundedCornerShape(20.dp)).clickable { open(g.id) }) {
        Art(g.hero.ifEmpty { g.wide }, g.name, Modifier.fillMaxSize(), showName = false)
        Box(Modifier.fillMaxSize().background(shade))
        Column(Modifier.align(Alignment.BottomStart).padding(18.dp)) {
            Eyebrow(if (running) (if (state == "running") "Сейчас играешь" else "Запускается на ПК") else "Продолжить игру",
                color = if (running) C.ingame else accent)
            Spacer(Modifier.height(4.dp))
            Text(g.name, style = MaterialTheme.typography.headlineMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text("${g.sourceName} · сыграно ${fmtMinutes(g.minutes)}" + if (g.lastPlayed > 0 && !running) " · ${fmtAgo(g.lastPlayed)}" else "",
                style = MaterialTheme.typography.bodyMedium, color = C.text2)
            if (!running) {
                Spacer(Modifier.height(12.dp))
                AccentButton("Играть на ПК", { vm.launch(g) }, icon = Icons.Filled.PlayArrow)
            }
        }
    }
}

@Composable
private fun DownloadRow(d: Download) {
    Column(Modifier.padding(horizontal = 18.dp, vertical = 5.dp).fillMaxWidth().background(C.card, RoundedCornerShape(14.dp)).padding(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(d.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            if (d.total > 0) Text("${(d.pct * 100).toInt()}%", style = MaterialTheme.typography.titleMedium, color = LocalAccent.current)
        }
        Spacer(Modifier.height(4.dp))
        Text(downloadState(d) + if (d.total > 0) " · ${fmtBytes(d.done)} из ${fmtBytes(d.total)}" else "", style = MaterialTheme.typography.bodyMedium)
        if (d.total > 0) { Spacer(Modifier.height(8.dp)); Bar(d.pct.toFloat(), Modifier.fillMaxWidth(), color = if (d.state == "paused") C.text3 else LocalAccent.current) }
    }
}

@Composable
private fun ChallengeCard(vm: LobbyVm, c: Challenge, g: Game?, open: (String) -> Unit) {
    val accent = LocalAccent.current
    val week = c.kind == "week"
    Box(Modifier.width(260.dp).height(150.dp).clip(RoundedCornerShape(16.dp))
        .then(if (week) Modifier.border(1.5.dp, accent.copy(alpha = 0.6f), RoundedCornerShape(16.dp)) else Modifier)
        .clickable(enabled = g != null) { g?.let { open(it.id) } }) {
        if (g != null) Art(g.wide.ifEmpty { g.hero }, g.name, Modifier.fillMaxSize(), showName = false)
        else Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(accent.copy(alpha = 0.45f), Color(0xFF111111)))))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0x55000000), Color(0xEE000000)))))
        Column(Modifier.fillMaxSize().padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(if (c.done) "✓ выполнено" else "+${c.xp} XP" + if (week) " · ×2" else "", color = if (c.done) C.text else Color.Black,
                    fontWeight = FontWeight.ExtraBold, fontSize = 12.sp,
                    modifier = Modifier.clip(RoundedCornerShape(6.dp)).then(if (c.done) Modifier.background(C.card2) else Modifier.background(LocalAccentBrush.current))
                        .padding(horizontal = 7.dp, vertical = 2.dp))
                Spacer(Modifier.weight(1f))
                if (!c.done && !week) IconButton(onClick = { vm.reroll(c) }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Filled.Refresh, "Заменить", tint = C.text2, modifier = Modifier.size(18.dp))
                }
            }
            Spacer(Modifier.weight(1f))
            Text(broText(c), style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Bar(if (c.target > 0) c.progress.toFloat() / c.target else 0f, Modifier.weight(1f), height = 4.dp)
                Spacer(Modifier.width(8.dp))
                Text(broProgress(c), fontSize = 12.sp, color = C.text2)
            }
        }
    }
}

@Composable
fun CoverTile(g: Game, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Column(modifier.clickable(onClick = onClick)) {
        Box(Modifier.fillMaxWidth().aspectRatio(2f / 3f).clip(RoundedCornerShape(12.dp))) {
            Art(g.cover.ifEmpty { g.hero }, g.name, Modifier.fillMaxSize())
            if (!g.installed) Text("не установлена", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = C.text,
                modifier = Modifier.align(Alignment.TopStart).padding(6.dp).background(Color(0xCC000000), RoundedCornerShape(5.dp)).padding(horizontal = 5.dp, vertical = 1.dp))
        }
        Spacer(Modifier.height(6.dp))
        Text(g.name, style = MaterialTheme.typography.bodyMedium.copy(color = C.text), maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(fmtMinutes(g.minutes), fontSize = 12.sp, color = C.text3)
    }
}
