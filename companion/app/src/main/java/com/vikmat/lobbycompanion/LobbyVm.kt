package com.vikmat.lobbycompanion

import android.app.Application
import android.os.Build
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject

enum class Phase { Start, Pairing, Connecting, Offline, Online }

class LobbyVm(app: Application) : AndroidViewModel(app) {
    private val store = Store(app)

    var phase by mutableStateOf(Phase.Start); private set
    var pc by mutableStateOf<Pc?>(null); private set
    var client by mutableStateOf<Client?>(null); private set
    var state by mutableStateOf<PcState?>(null); private set
    var games by mutableStateOf<List<Game>>(emptyList()); private set
    var friends by mutableStateOf<List<Friend>>(emptyList()); private set
    var friendsError by mutableStateOf<String?>(null); private set
    var friendsLoaded by mutableStateOf(false); private set
    var pairError by mutableStateOf<String?>(null); private set
    var busy by mutableStateOf(false); private set

    /** One-off messages for the snackbar. */
    var message by mutableStateOf<String?>(null)

    private var live: Job? = null

    init {
        val saved = store.load()
        if (saved != null) { pc = saved; connect() } else phase = Phase.Pairing
    }

    val accent get() = state?.accent ?: DEFAULT_ACCENT

    // ---------- pairing ----------
    fun pair(link: PairLink) {
        if (busy) return
        busy = true
        pairError = null
        viewModelScope.launch {
            try {
                val device = listOfNotNull(Build.MANUFACTURER?.replaceFirstChar { it.uppercase() }, Build.MODEL).distinct().joinToString(" ")
                val p = Net.pair(link, device.ifBlank { "Телефон" })
                store.save(p)
                pc = p
                connect()
            } catch (e: Exception) {
                pairError = e.message ?: "Не получилось подключиться"
            } finally { busy = false }
        }
    }

    fun pairManual(address: String, code: String) {
        val a = address.trim().removePrefix("http://").trimEnd('/')
        val host = a.substringBefore(':')
        val port = a.substringAfter(':', "47820").toIntOrNull() ?: 47820
        if (host.isBlank() || code.trim().length != 6) { pairError = "Введи адрес ПК и шестизначный код с экрана Lobby"; return }
        pair(PairLink(listOf(host), port, code.trim(), "ПК"))
    }

    fun forget() {
        val c = client
        live?.cancel()
        viewModelScope.launch { try { c?.post("/api/unpair") } catch (_: Exception) { } }
        store.save(null)
        pc = null; client = null; state = null; games = emptyList(); friends = emptyList(); friendsLoaded = false
        phase = Phase.Pairing
    }

    // ---------- connection ----------
    fun connect() {
        val p = pc ?: return
        live?.cancel()
        phase = if (state == null) Phase.Connecting else phase
        live = viewModelScope.launch {
            var attempt = 0
            while (true) {
                val host = Net.reach(p.hosts, p.port)
                if (host == null) {
                    phase = Phase.Offline
                    delay(if (attempt++ < 3) 3000 else 10000)
                    continue
                }
                val c = Client(p, host)
                try {
                    client = c
                    refreshAll(c)
                    phase = Phase.Online
                    attempt = 0
                    c.listen(::onEvent) // returns when the stream breaks
                } catch (e: ApiError) {
                    if (e.code == 401) { // the PC forgot this phone
                        store.save(null); pc = null; client = null; state = null
                        pairError = "ПК отключил этот телефон. Подключись заново"
                        phase = Phase.Pairing
                        return@launch
                    }
                } catch (_: Exception) { }
                phase = Phase.Offline
                delay(2000)
            }
        }
    }

    private suspend fun refreshAll(c: Client) {
        state = PcState.from(c.get("/api/state"))
        games = parseGames(c.get("/api/games"))
    }

    fun refresh() {
        val c = client ?: return connect()
        viewModelScope.launch {
            try { refreshAll(c); loadFriends(true) } catch (e: Exception) { message = e.message }
        }
    }

    private fun onEvent(event: String, d: JSONObject) {
        val s = state ?: return
        when (event) {
            "session" -> {
                val st = d.optString("state")
                state = s.copy(session = if (st == "ended") null else Session(d.optString("gameId"), d.optString("name"), st, d.optLong("since")))
                if (st == "running") message = "На ПК запущена ${d.optString("name")}"
                if (st == "ended") {
                    val m = d.optInt("minutes")
                    message = "Игра закрыта" + if (m > 0) " · ${fmtMinutes(m)}" else ""
                    viewModelScope.launch { try { games = parseGames(client!!.get("/api/games")) } catch (_: Exception) { } }
                }
            }
            "downloads" -> {
                state = s.copy(downloads = parseDownloads(d))
                val ev = d.optJSONArray("events")
                if (ev != null) for (i in 0 until ev.length()) {
                    val e = ev.optJSONObject(i) ?: continue
                    if (e.optString("type") == "installed") message = "Установлена ${e.optString("name")}"
                }
                if (ev != null && ev.length() > 0) viewModelScope.launch { try { games = parseGames(client!!.get("/api/games")) } catch (_: Exception) { } }
            }
            "bro" -> {
                d.optJSONObject("state")?.let { state = s.copy(bro = Bro.from(it)) }
                val ev = d.optJSONArray("events")
                if (ev != null && ev.length() > 0) {
                    val e = ev.optJSONObject(ev.length() - 1)
                    val lv = e?.optInt("levelUp") ?: 0
                    val xp = e?.optJSONObject("challenge")?.optInt("xp") ?: 0
                    message = if (lv > 0) "Новый уровень: $lv! +$xp XP" else "Челлендж выполнен: +$xp XP"
                }
            }
            "ach-new" -> {
                val n = d.optJSONArray("items")?.length() ?: d.optJSONArray("fresh")?.length() ?: 0
                message = if (n > 0) "Новые достижения: $n" else "Новые достижения"
            }
        }
    }

    // ---------- actions ----------
    fun launch(g: Game) {
        val c = client ?: return
        viewModelScope.launch {
            try {
                val r = c.post("/api/games/${enc(g.id)}/launch")
                message = when {
                    r.has("error") && !r.optBoolean("ok") -> r.optString("error")
                    r.optBoolean("installing") -> "Установка ${g.name} началась на ПК"
                    r.optBoolean("untracked") -> "Запускаю ${g.name} на ПК"
                    else -> "Запускаю ${g.name} на ПК"
                }
            } catch (e: Exception) { message = e.message }
        }
    }

    fun install(g: Game) {
        val c = client ?: return
        viewModelScope.launch {
            try {
                val r = c.post("/api/games/${enc(g.id)}/install")
                message = if (r.optBoolean("ok")) {
                    if (r.optBoolean("epic")) "Установка открыта в Epic Games Launcher на ПК" else "Steam начал установку ${g.name}. Подтверди её на ПК, если Steam спросит"
                } else r.optString("error", "Не получилось начать установку")
            } catch (e: Exception) { message = e.message }
        }
    }

    fun reroll(ch: Challenge) {
        val c = client ?: return
        viewModelScope.launch {
            try {
                val r = c.post("/api/bro/reroll", JSONObject().put("id", ch.id))
                r.optJSONObject("state")?.let { st -> state = state?.copy(bro = Bro.from(st)) }
                message = if (r.has("error")) r.optString("error") else "Челлендж заменён"
            } catch (e: Exception) { message = e.message }
        }
    }

    fun summon() {
        val c = client ?: return
        viewModelScope.launch { try { c.post("/api/summon"); message = "Lobby открыт на ПК" } catch (e: Exception) { message = e.message } }
    }

    fun loadFriends(force: Boolean = false) {
        val c = client ?: return
        viewModelScope.launch {
            try {
                val r = c.get(if (force) "/api/friends?force=1" else "/api/friends")
                friends = parseFriends(r)
                friendsError = if (r.has("error")) r.optString("error") else null
            } catch (e: Exception) { friendsError = e.message }
            friendsLoaded = true
        }
    }

    suspend fun achievements(g: Game): Pair<List<Achievement>, String?> {
        val c = client ?: return emptyList<Achievement>() to "Нет связи с ПК"
        return try {
            val r = c.get("/api/games/${enc(g.id)}/ach")
            if (r.has("error")) emptyList<Achievement>() to r.optString("error") else parseAchievements(r) to null
        } catch (e: Exception) { emptyList<Achievement>() to (e.message ?: "Ошибка") }
    }

    /** Screenshots and previews only: show the screens with sample data, no network. */
    fun showDemo(pc: Pc, state: PcState, games: List<Game>, friends: List<Friend>) {
        live?.cancel()
        this.pc = pc; this.state = state; this.games = games; this.friends = friends
        friendsLoaded = true; phase = Phase.Online
    }

    private fun enc(s: String) = java.net.URLEncoder.encode(s, "UTF-8").replace("+", "%20")
}
