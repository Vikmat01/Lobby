package com.vikmat.lobbycompanion

import org.json.JSONArray
import org.json.JSONObject

// Everything the PC sends, parsed from JSON. Field names follow Lobby's server (app/src/remote.js).

private fun JSONArray?.strings(): List<String> =
    if (this == null) emptyList() else (0 until length()).map { getString(it) }

private fun <T> JSONArray?.objects(f: (JSONObject) -> T): List<T> =
    if (this == null) emptyList() else (0 until length()).mapNotNull { optJSONObject(it)?.let(f) }

private fun JSONObject.str(k: String): String? = if (isNull(k)) null else optString(k, "").ifEmpty { null }

data class Game(
    val id: String,
    val source: String,
    val name: String,
    val installed: Boolean,
    val owned: Boolean,
    val minutes: Int,
    val lastPlayed: Long,
    val achTotal: Int,
    val achUnlocked: Int,
    val cover: List<String>,
    val hero: List<String>,
    val wide: List<String>,
) {
    val sourceName get() = when (source) { "steam" -> "Steam"; "epic" -> "Epic Games"; else -> "Своя игра" }

    companion object {
        fun from(o: JSONObject): Game {
            val art = o.optJSONObject("art") ?: JSONObject()
            val ach = o.optJSONObject("ach")
            return Game(
                id = o.getString("id"), source = o.optString("source"), name = o.optString("name"),
                installed = o.optBoolean("installed"), owned = o.optBoolean("owned", true),
                minutes = o.optInt("minutes"), lastPlayed = o.optLong("lastPlayed"),
                achTotal = ach?.optInt("t") ?: 0, achUnlocked = ach?.optInt("u") ?: 0,
                cover = art.optJSONArray("cover").strings(), hero = art.optJSONArray("hero").strings(),
                wide = art.optJSONArray("wide").strings(),
            )
        }
    }
}

data class Challenge(
    val id: String, val kind: String, val gameId: String?, val name: String,
    val target: Int, val progress: Int, val xp: Int, val done: Boolean,
) {
    companion object {
        fun from(o: JSONObject) = Challenge(
            id = o.optString("id"), kind = o.optString("kind"), gameId = o.str("gameId"), name = o.optString("name"),
            target = o.optInt("target"), progress = o.optInt("progress"), xp = o.optInt("xp"), done = o.optBoolean("done"),
        )
    }
}

data class Bro(
    val level: Int, val into: Int, val need: Int, val xp: Int, val done: Int, val rerolls: Int,
    val prestige: Int, val challenges: List<Challenge>, val week: Challenge?,
) {
    companion object {
        fun from(o: JSONObject) = Bro(
            level = o.optInt("level", 1), into = o.optInt("into"), need = o.optInt("need", 1), xp = o.optInt("xp"),
            done = o.optInt("done"), rerolls = o.optInt("rerolls"), prestige = o.optInt("prestige"),
            challenges = o.optJSONArray("challenges").objects(Challenge::from),
            week = o.optJSONObject("week")?.let(Challenge::from),
        )
    }
}

data class Session(val gameId: String, val name: String, val state: String, val since: Long)

data class Download(val gid: String, val name: String, val state: String, val pct: Double, val done: Long, val total: Long) {
    companion object {
        fun from(o: JSONObject) = Download(
            o.optString("gid"), o.optString("name"), o.optString("state"),
            o.optDouble("pct", 0.0), o.optLong("done"), o.optLong("total"),
        )
    }
}

data class PcState(
    val pc: String, val version: String, val accent: Int, val grad: List<Int>, val name: String, val avatar: String?,
    val session: Session?, val bro: Bro?, val downloads: List<Download>,
) {
    companion object {
        fun from(o: JSONObject): PcState {
            val p = o.optJSONObject("profile") ?: JSONObject()
            val s = o.optJSONObject("session")
            return PcState(
                pc = o.optString("pc"), version = o.optString("version"), accent = parseColor(o.optString("accent")),
                grad = parseGrad(o),
                name = p.optString("name", "Игрок"), avatar = p.str("avatar"),
                session = s?.let { Session(it.optString("gameId"), it.optString("name"), it.optString("state"), it.optLong("since")) },
                bro = o.optJSONObject("bro")?.let(Bro::from),
                downloads = o.optJSONArray("downloads").objects(Download::from),
            )
        }
    }
}

data class Friend(
    val id: String, val name: String, val avatar: String?, val state: Int, val game: String?,
    val gameId: String?, val lastOff: Long,
) {
    val kind get() = if (game != null) 2 else if (state > 0) 1 else 0
    companion object {
        fun from(o: JSONObject) = Friend(
            o.optString("id"), o.optString("name"), o.str("avatar"), o.optInt("state"), o.str("game"),
            o.str("gameId"), o.optLong("lastOff"),
        )
    }
}

data class Achievement(
    val id: String, val name: String, val desc: String, val icon: String?, val unlocked: Boolean,
    val time: Long, val pct: Double?, val hidden: Boolean,
) {
    companion object {
        fun from(o: JSONObject) = Achievement(
            o.optString("id"), o.optString("name"), o.optString("desc"), o.str("icon"), o.optBoolean("unlocked"),
            o.optLong("time"), if (o.isNull("pct") || !o.has("pct")) null else o.optDouble("pct"), o.optBoolean("hidden"),
        )
    }
}

fun parseGrad(o: JSONObject): List<Int> = o.optJSONArray("grad").strings().map(::parseColor)

fun parseColor(hex: String?): Int {
    val h = (hex ?: "").removePrefix("#")
    return try { if (h.length == 6) (0xFF000000 or h.toLong(16)).toInt() else DEFAULT_ACCENT } catch (_: Exception) { DEFAULT_ACCENT }
}
const val DEFAULT_ACCENT = 0xFF3FD1A9.toInt()

fun parseGames(o: JSONObject) = o.optJSONArray("games").objects(Game::from)
fun parseFriends(o: JSONObject) = o.optJSONArray("friends").objects(Friend::from)
fun parseAchievements(o: JSONObject) = o.optJSONArray("items").objects(Achievement::from)
fun parseDownloads(o: JSONObject) = o.optJSONArray("list").objects(Download::from)
