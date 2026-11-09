package com.vikmat.lobbycompanion.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.vikmat.lobbycompanion.LobbyVm
import com.vikmat.lobbycompanion.PairLink
import androidx.activity.compose.rememberLauncherForActivityResult

/** The Lobby mark: an L made of two bars with a play button in the corner. */
@Composable
fun LobbyMark(size: androidx.compose.ui.unit.Dp, accent: Color) {
    Canvas(Modifier.size(size)) {
        val s = this.size.width / 512f
        val r = CornerRadius(28 * s, 28 * s)
        drawRoundRect(accent, Offset(128 * s, 104 * s), Size(112 * s, 304 * s), r)
        drawRoundRect(accent, Offset(128 * s, 296 * s), Size(256 * s, 112 * s), r)
        drawRoundRect(Color(0xFF1E1E1E), Offset(272 * s, 104 * s), Size(112 * s, 160 * s), r)
        val p = Path().apply { moveTo(310 * s, 152 * s); lineTo(350 * s, 184 * s); lineTo(310 * s, 216 * s); close() }
        drawPath(p, Color(0xFFEDEDED))
    }
}

@Composable
fun ConnectScreen(vm: LobbyVm) {
    val accent = LocalAccent.current
    var manual by rememberSaveable { mutableStateOf(false) }
    var address by rememberSaveable { mutableStateOf("") }
    var code by rememberSaveable { mutableStateOf("") }
    var scanError by rememberSaveable { mutableStateOf<String?>(null) }

    val scan = rememberLauncherForActivityResult(ScanContract()) { r ->
        val text = r.contents ?: return@rememberLauncherForActivityResult
        val link = PairLink.parse(text)
        if (link == null) scanError = "Это не код Lobby. Открой на ПК: Настройки → Телефон → Подключить телефон"
        else { scanError = null; vm.pair(link) }
    }

    Column(
        Modifier.fillMaxSize().background(C.bg).statusBarsPadding().navigationBarsPadding().imePadding()
            .verticalScroll(rememberScrollState()).padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(64.dp))
        LobbyMark(120.dp, accent)
        Text("Lobby", fontSize = 40.sp, fontWeight = FontWeight.ExtraBold, color = C.text)
        Eyebrow("Companion")
        Spacer(Modifier.height(36.dp))
        Text(
            "Управляй Lobby на ПК с телефона: запускай игры, следи за загрузками, Game Bro и друзьями.",
            style = MaterialTheme.typography.bodyLarge, color = C.text2, textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(28.dp))

        Column(Modifier.fillMaxWidth().background(C.card, RoundedCornerShape(18.dp)).padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Step("1", "На ПК открой Lobby → Настройки → Телефон → «Подключить телефон»")
            Step("2", "Нажми кнопку ниже и наведи камеру на QR-код")
            Step("3", "Телефон и ПК должны быть в одной сети Wi-Fi")
        }
        Spacer(Modifier.height(24.dp))

        if (vm.busy) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(color = accent, strokeWidth = 3.dp, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(12.dp))
                Text("Подключаюсь к ПК…", color = C.text2)
            }
        } else {
            Button(
                onClick = {
                    scan.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("Наведи камеру на QR-код в Lobby")
                        .setBeepEnabled(false).setOrientationLocked(false))
                },
                colors = ButtonDefaults.buttonColors(containerColor = accent, contentColor = Color.Black),
                shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().height(56.dp),
            ) { Text("Подключить", fontWeight = FontWeight.Bold, fontSize = 17.sp) }
            TextButton(onClick = { manual = !manual }) { Text(if (manual) "Скрыть ручной ввод" else "Ввести адрес и код вручную", color = C.text2) }
        }

        if (manual && !vm.busy) {
            val fieldColors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = accent, unfocusedBorderColor = C.line, cursorColor = accent,
                focusedLabelColor = accent, unfocusedLabelColor = C.text3,
            )
            OutlinedTextField(address, { address = it }, label = { Text("Адрес ПК, например 192.168.1.5:47820") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri), colors = fieldColors, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(code, { if (it.length <= 6) code = it.filter(Char::isDigit) }, label = { Text("Код с экрана Lobby") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword), colors = fieldColors, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(12.dp))
            Button(onClick = { vm.pairManual(address, code) }, colors = ButtonDefaults.buttonColors(containerColor = C.card2, contentColor = C.text),
                shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Подключить по коду", fontWeight = FontWeight.SemiBold) }
        }

        val err = scanError ?: vm.pairError
        if (err != null) {
            Spacer(Modifier.height(16.dp))
            Text(err, color = C.warn, textAlign = TextAlign.Center, style = MaterialTheme.typography.bodyMedium.copy(color = C.warn))
        }
        Spacer(Modifier.height(40.dp))
    }
}

@Composable
private fun Step(n: String, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(28.dp).background(LocalAccent.current.copy(alpha = 0.18f), RoundedCornerShape(8.dp)), contentAlignment = Alignment.Center) {
            Text(n, color = LocalAccent.current, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.width(12.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium)
    }
}
