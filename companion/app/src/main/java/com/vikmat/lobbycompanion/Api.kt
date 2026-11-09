package com.vikmat.lobbycompanion

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import kotlin.coroutines.coroutineContext

class ApiError(message: String, val code: Int = 0) : Exception(message)

/** A PC we are paired with. Several addresses because a PC can have more than one network adapter. */
data class Pc(val name: String, val hosts: List<String>, val port: Int, val token: String)

/** The pairing link inside the QR code: lobby://pair?h=192.168.1.5,10.0.0.2&p=47820&c=123456&n=PC */
data class PairLink(val hosts: List<String>, val port: Int, val code: String, val name: String) {
    companion object {
        fun parse(text: String?): PairLink? {
            if (text == null) return null
            val u = try { Uri.parse(text.trim()) } catch (_: Exception) { return null }
            if (u.scheme != "lobby" || u.host != "pair") return null
            val hosts = (u.getQueryParameter("h") ?: "").split(',').map { it.trim() }.filter { it.isNotEmpty() }
            val port = u.getQueryParameter("p")?.toIntOrNull() ?: return null
            val code = u.getQueryParameter("c") ?: return null
            if (hosts.isEmpty()) return null
            return PairLink(hosts, port, code, u.getQueryParameter("n") ?: "ПК")
        }
    }
}

object Net {
    private fun open(url: String, method: String, token: String?, connect: Int, read: Int): HttpURLConnection {
        val c = URL(url).openConnection() as HttpURLConnection
        c.requestMethod = method
        c.connectTimeout = connect
        c.readTimeout = read
        c.useCaches = false
        c.setRequestProperty("Accept", "application/json")
        if (token != null) c.setRequestProperty("Authorization", "Bearer $token")
        return c
    }

    fun request(url: String, method: String = "GET", token: String? = null, body: JSONObject? = null, connect: Int = 4000, read: Int = 15000): JSONObject {
        val c = open(url, method, token, connect, read)
        try {
            if (body != null) {
                c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                c.outputStream.use { it.write(body.toString().toByteArray()) }
            }
            val code = c.responseCode
            val stream = if (code in 200..299) c.inputStream else c.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
            val json = try { JSONObject(text.ifEmpty { "{}" }) } catch (_: Exception) { JSONObject() }
            if (code !in 200..299) throw ApiError(json.optString("error").ifEmpty { "Ошибка $code" }, code)
            return json
        } finally {
            c.disconnect()
        }
    }

    /** First address of the PC that answers; addresses are tried at the same time. */
    suspend fun reach(hosts: List<String>, port: Int): String? = coroutineScope {
        hosts.map { h ->
            async(Dispatchers.IO) {
                try { request("http://$h:$port/api/hello", connect = 1800, read = 2500).optString("app") == "Lobby" } catch (_: Exception) { false }
            }
        }.awaitAll().let { ok -> hosts.indices.firstOrNull { ok[it] }?.let { hosts[it] } }
    }

    suspend fun pair(link: PairLink, device: String): Pc = withContext(Dispatchers.IO) {
        val host = reach(link.hosts, link.port)
            ?: throw ApiError("ПК не отвечает. Проверь, что телефон в той же сети Wi-Fi, и разреши Lobby в брандмауэре Windows")
        val r = request("http://$host:${link.port}/api/pair", "POST", body = JSONObject().put("code", link.code).put("device", device))
        val hosts = listOf(host) + link.hosts.filter { it != host }
        Pc(r.optString("pc", link.name), hosts, link.port, r.getString("token"))
    }
}

/** A live connection to one PC. */
class Client(val pc: Pc, val host: String) {
    val base = "http://$host:${pc.port}"

    suspend fun get(path: String): JSONObject = withContext(Dispatchers.IO) { Net.request(base + path, token = pc.token) }
    suspend fun post(path: String, body: JSONObject? = null): JSONObject =
        withContext(Dispatchers.IO) { Net.request(base + path, "POST", pc.token, body ?: JSONObject()) }

    /** Absolute URL for an image path from the PC (local art comes as /art/...). */
    fun url(u: String?): String? = when {
        u == null -> null
        u.startsWith("/") -> base + u
        else -> u
    }
    val needsAuth: (String) -> Boolean = { it.startsWith(base) }

    /** Server-sent events: calls [onEvent] for each one until the stream breaks. */
    suspend fun listen(onEvent: (String, JSONObject) -> Unit) = withContext(Dispatchers.IO) {
        val c = URL("$base/api/events").openConnection() as HttpURLConnection
        c.connectTimeout = 4000
        c.readTimeout = 70000 // the PC pings every 25 s
        c.setRequestProperty("Authorization", "Bearer ${pc.token}")
        c.setRequestProperty("Accept", "text/event-stream")
        try {
            if (c.responseCode != 200) throw ApiError("Нет потока событий", c.responseCode)
            BufferedReader(InputStreamReader(c.inputStream, Charsets.UTF_8)).use { r ->
                var event = "message"
                val data = StringBuilder()
                while (coroutineContext.isActive) {
                    val line = r.readLine() ?: break
                    when {
                        line.isEmpty() -> {
                            if (data.isNotEmpty()) {
                                val json = try { JSONObject(data.toString()) } catch (_: Exception) { JSONObject() }
                                withContext(Dispatchers.Main) { onEvent(event, json) }
                            }
                            event = "message"; data.setLength(0)
                        }
                        line.startsWith("event:") -> event = line.substring(6).trim()
                        line.startsWith("data:") -> data.append(line.substring(5).trim())
                    }
                }
            }
        } finally {
            c.disconnect()
        }
    }
}

/** Paired PC kept in preferences. One PC for now. */
class Store(ctx: Context) {
    private val prefs = ctx.getSharedPreferences("lobby", Context.MODE_PRIVATE)

    fun load(): Pc? {
        val raw = prefs.getString("pc", null) ?: return null
        return try {
            val o = JSONObject(raw)
            val hosts = o.getJSONArray("hosts").let { a -> (0 until a.length()).map { a.getString(it) } }
            Pc(o.getString("name"), hosts, o.getInt("port"), o.getString("token"))
        } catch (_: Exception) { null }
    }

    fun save(pc: Pc?) {
        if (pc == null) { prefs.edit().remove("pc").apply(); return }
        val o = JSONObject().put("name", pc.name).put("port", pc.port).put("token", pc.token)
            .put("hosts", org.json.JSONArray(pc.hosts))
        prefs.edit().putString("pc", o.toString()).apply()
    }
}
