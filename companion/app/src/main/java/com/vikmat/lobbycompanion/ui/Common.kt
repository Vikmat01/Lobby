package com.vikmat.lobbycompanion.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.vikmat.lobbycompanion.Client
import com.vikmat.lobbycompanion.DEFAULT_ACCENT

// ---------- colours and type, the same black look as Lobby on the PC ----------
object C {
    val bg = Color(0xFF000000)
    val card = Color(0xFF141414)
    val card2 = Color(0xFF1E1E1E)
    val line = Color(0xFF2A2A2A)
    val text = Color(0xFFF2F2F2)
    val text2 = Color(0xFFB4B4B4)
    val text3 = Color(0xFF7A7A7A)
    val online = Color(0xFF57CBDE)
    val ingame = Color(0xFFA9D35A)
    val warn = Color(0xFFFFB25B)
}

val LocalAccent = staticCompositionLocalOf { Color(DEFAULT_ACCENT) }
/** Special accents from the PC (Закат, Хром, Аврора) are gradients; plain ones are a solid brush. */
val LocalAccentBrush = staticCompositionLocalOf<Brush> { SolidColor(Color(DEFAULT_ACCENT)) }
val LocalClient = staticCompositionLocalOf<Client?> { null }

@Composable
fun LobbyTheme(accent: Color, client: Client?, grad: List<Color> = emptyList(), content: @Composable () -> Unit) {
    val scheme: ColorScheme = darkColorScheme(
        primary = accent, onPrimary = Color.Black, background = C.bg, surface = C.bg, surfaceVariant = C.card,
        onBackground = C.text, onSurface = C.text, onSurfaceVariant = C.text2, secondary = accent,
        surfaceContainer = C.card, surfaceContainerHigh = C.card2, outline = C.line,
    )
    val base = TextStyle(color = C.text)
    val type = Typography(
        headlineLarge = base.copy(fontSize = 30.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 34.sp),
        headlineMedium = base.copy(fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 28.sp),
        titleLarge = base.copy(fontSize = 20.sp, fontWeight = FontWeight.Bold),
        titleMedium = base.copy(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
        bodyLarge = base.copy(fontSize = 16.sp),
        bodyMedium = base.copy(fontSize = 14.sp, color = C.text2),
        labelMedium = base.copy(fontSize = 12.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.2.sp),
    )
    val brush = if (grad.size >= 2) Brush.linearGradient(grad) else SolidColor(accent)
    // narrow or zoomed-in screens: lay out as if the phone were 400 dp wide, so everything fits
    val conf = LocalConfiguration.current
    val d = LocalDensity.current
    val k = if (conf.screenWidthDp in 1..399) conf.screenWidthDp / 400f else 1f
    val density = Density(d.density * k, d.fontScale.coerceAtMost(1.15f))
    CompositionLocalProvider(LocalAccent provides accent, LocalAccentBrush provides brush, LocalClient provides client, LocalDensity provides density) {
        MaterialTheme(colorScheme = scheme, typography = type, content = content)
    }
}

/** Small uppercase accent label, like the eyebrows in Lobby. */
@Composable
fun Eyebrow(text: String, color: Color = LocalAccent.current, modifier: Modifier = Modifier) {
    Text(text.uppercase(), style = MaterialTheme.typography.labelMedium, color = color, modifier = modifier)
}

@Composable
fun Bar(fraction: Float, modifier: Modifier = Modifier, height: Dp = 6.dp, color: Color? = null) {
    val f by animateFloatAsState(fraction.coerceIn(0f, 1f), tween(600), label = "bar")
    Box(modifier.height(height).clip(RoundedCornerShape(height)).background(Color(0x22FFFFFF))) {
        val fill = if (color != null) Modifier.background(color) else Modifier.background(LocalAccentBrush.current)
        Box(Modifier.fillMaxHeight().fillMaxWidth(f).clip(RoundedCornerShape(height)).then(fill))
    }
}

private val PALETTE = listOf(
    0xFF2B3A67, 0xFF5B2A86, 0xFF1F6F5C, 0xFF8A3B2E, 0xFF2E5E8A, 0xFF6B4E16, 0xFF3D3D6B, 0xFF7A2E55,
).map { Color(it) }
fun colorFor(name: String) = PALETTE[(name.hashCode() and 0x7fffffff) % PALETTE.size]

/**
 * Game art: tries each candidate URL in turn (local art comes from the PC with the token),
 * and falls back to a coloured card with the name.
 */
@Composable
fun Art(urls: List<String>, name: String, modifier: Modifier = Modifier, showName: Boolean = true, contentScale: ContentScale = ContentScale.Crop) {
    val client = LocalClient.current
    val list = remember(urls, client) { urls.mapNotNull { client?.url(it) } }
    var idx by remember(list) { mutableIntStateOf(0) }
    val ctx = LocalContext.current
    Box(modifier.background(Brush.linearGradient(listOf(colorFor(name), Color(0xFF0E0E0E))))) {
        if (idx >= list.size || list.isEmpty()) {
            if (showName) Text(
                name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold,
                maxLines = 4, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.align(Alignment.BottomStart).padding(10.dp),
            )
        } else {
            val url = list[idx]
            val req = remember(url) {
                ImageRequest.Builder(ctx).data(url).crossfade(250).apply {
                    if (client != null && client.needsAuth(url)) addHeader("Authorization", "Bearer ${client.pc.token}")
                }.build()
            }
            AsyncImage(model = req, contentDescription = null, contentScale = contentScale, modifier = Modifier.fillMaxSize(), onError = { idx++ })
        }
    }
}

@Composable
fun Avatar(url: String?, name: String, size: Dp, ring: Color? = null, modifier: Modifier = Modifier) {
    val client = LocalClient.current
    val ctx = LocalContext.current
    val full = client?.url(url) ?: url
    var failed by remember(full) { androidx.compose.runtime.mutableStateOf(false) }
    val m = modifier.size(size).let { if (ring != null) it.border(3.dp, ring, CircleShape).padding(5.dp) else it }.clip(CircleShape).background(colorFor(name))
    Box(m, contentAlignment = Alignment.Center) {
        if (full != null && !failed) {
            val req = remember(full) {
                ImageRequest.Builder(ctx).data(full).crossfade(200).apply {
                    if (client != null && client.needsAuth(full)) addHeader("Authorization", "Bearer ${client.pc.token}")
                }.build()
            }
            AsyncImage(req, null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize(), onError = { failed = true })
        } else {
            Text(name.take(1).uppercase(), fontWeight = FontWeight.ExtraBold, fontSize = (size.value * 0.4f).sp, textAlign = TextAlign.Center)
        }
    }
}

/** Main action button, filled with the PC's accent (gradient for special accents). */
@Composable
fun AccentButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, icon: androidx.compose.ui.graphics.vector.ImageVector? = null, big: Boolean = false) {
    androidx.compose.foundation.layout.Row(
        modifier.clip(RoundedCornerShape(if (big) 14.dp else 12.dp)).background(LocalAccentBrush.current)
            .clickable(onClick = onClick).padding(horizontal = 18.dp, vertical = if (big) 15.dp else 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = androidx.compose.foundation.layout.Arrangement.Center,
    ) {
        if (icon != null) { androidx.compose.material3.Icon(icon, null, tint = Color.Black, modifier = Modifier.size(20.dp)); androidx.compose.foundation.layout.Spacer(Modifier.size(8.dp)) }
        Text(text, color = Color.Black, fontWeight = FontWeight.Bold, fontSize = if (big) 17.sp else 15.sp)
    }
}
