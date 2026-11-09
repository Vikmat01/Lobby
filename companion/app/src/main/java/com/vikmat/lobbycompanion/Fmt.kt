package com.vikmat.lobbycompanion

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

fun plural(n: Int, one: String, few: String, many: String): String {
    val a = n % 100
    val b = n % 10
    return when {
        a in 11..14 -> many
        b == 1 -> one
        b in 2..4 -> few
        else -> many
    }
}

fun fmtMinutes(m: Int): String = when {
    m <= 0 -> "не запускалась"
    m < 60 -> "$m мин"
    else -> "${m / 60} ч"
}

fun fmtAgo(ts: Long): String {
    if (ts <= 0) return ""
    val d = (System.currentTimeMillis() - ts) / 1000
    return when {
        d < 90 -> "только что"
        d < 3600 -> "${d / 60} мин назад"
        d < 86400 -> "${d / 3600} ч назад"
        d < 2 * 86400 -> "вчера"
        d < 30 * 86400 -> { val n = (d / 86400).toInt(); "$n ${plural(n, "день", "дня", "дней")} назад" }
        else -> SimpleDateFormat("d MMMM", Locale("ru")).format(Date(ts))
    }
}

fun fmtDate(ts: Long): String = if (ts <= 0) "—" else SimpleDateFormat("d MMMM yyyy", Locale("ru")).format(Date(ts))

fun fmtBytes(b: Long): String {
    if (b <= 0) return "0 Б"
    val units = listOf("Б", "КБ", "МБ", "ГБ", "ТБ")
    var v = b.toDouble()
    var i = 0
    while (v >= 1024 && i < units.lastIndex) { v /= 1024; i++ }
    return if (i >= 3) String.format(Locale("ru"), "%.1f %s", v, units[i]) else "${v.toInt()} ${units[i]}"
}

fun broText(c: Challenge): String = when (c.kind) {
    "week" -> "Неделя: наиграй ${fmtMinutes(c.target)} в любые игры"
    "first" -> "Запусти ${c.name} впервые и сыграй ${c.target} мин"
    "return" -> "Вернись в ${c.name}: ${c.target} мин"
    "ach" -> "Получи достижение в ${c.name}"
    else -> "Сыграй в ${c.name} ${c.target} мин"
}

fun broProgress(c: Challenge): String = when (c.kind) {
    "ach" -> if (c.done) "выполнено" else "нужно 1 достижение"
    else -> "${c.progress} / ${c.target} мин"
}

fun downloadState(d: Download): String = when (d.state) {
    "paused" -> "Пауза"
    "downloading" -> "Загрузка"
    "updating" -> "Обновление"
    "installing" -> "Установка"
    "validating" -> "Проверка файлов"
    "uninstalling" -> "Удаление"
    "confirm" -> "Подтверди установку в Steam на ПК"
    "epic", "epicConfirm" -> "Установка через Epic Games Launcher"
    else -> "В очереди"
}

fun friendStatus(f: Friend): String {
    val states = listOf("Не в сети", "В сети", "Занят", "Отошёл", "Спит", "Хочет обменяться", "Хочет поиграть")
    return when {
        f.game != null -> "Играет в ${f.game}"
        f.state > 0 -> states.getOrElse(f.state) { "В сети" }
        f.lastOff > 0 -> "Был ${fmtAgo(f.lastOff)}"
        else -> "Не в сети"
    }
}
