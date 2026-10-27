package com.yamonfilm.tv;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

/** Client Supabase minimal (Auth + PostgREST), identique aux appels du site. */
public final class Api {
    public static final String SUPABASE_URL = "https://nftiussedwyjheqrmlbw.supabase.co";
    public static final String SUPABASE_KEY = "sb_publishable_a07rZpPFzuy0BgrmCsr_Kw_Mq-TQ8x5";
    public static final String ADMIN_EMAIL = "lukas.leclerc312@gmail.com";
    public static final String SITE = "https://yamonfi.netlify.app/";
    public static final String TMDB_KEY = "af281c5089038e174e83c576ff765be9";
    public static final String USER_AGENT = "Mozilla/5.0 (Linux; Android 12; Android TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    /** Erreur lisible, affichable directement à l'utilisateur. */
    public static class ApiException extends IOException {
        public final int status;
        public final String code;
        public ApiException(int status, String code, String message) { super(message); this.status = status; this.code = code == null ? "" : code; }
    }

    /** La session a expiré : l'application doit revenir à la connexion. */
    public static final class AuthExpired extends ApiException {
        public AuthExpired() { super(401, "auth", "Ta session a expiré. Reconnecte-toi."); }
    }

    public static final class Result {
        public final int status; public final String body; public final String contentRange;
        Result(int status, String body, String contentRange) { this.status = status; this.body = body; this.contentRange = contentRange; }
        public int total() {
            if (contentRange == null) return -1;
            int slash = contentRange.lastIndexOf('/');
            if (slash < 0) return -1;
            try { return Integer.parseInt(contentRange.substring(slash + 1).trim()); } catch (NumberFormatException e) { return -1; }
        }
    }

    public static final class Session {
        public final String accessToken, refreshToken, userId, email; public final long expiresAt;
        Session(String a, String r, long e, String id, String mail) { accessToken = a; refreshToken = r; expiresAt = e; userId = id; email = mail == null ? "" : mail; }
        public boolean isAdmin() { return ADMIN_EMAIL.equalsIgnoreCase(email); }
    }

    private final SharedPreferences prefs;
    private volatile Session session;
    private final Object refreshLock = new Object();

    public Api(Context context) {
        prefs = context.getSharedPreferences("auth", Context.MODE_PRIVATE);
        String a = prefs.getString("access", null), r = prefs.getString("refresh", null), id = prefs.getString("uid", null);
        if (a != null && r != null && id != null) session = new Session(a, r, prefs.getLong("exp", 0), id, prefs.getString("email", ""));
    }

    public Session session() { return session; }
    public boolean signedIn() { return session != null; }

    /** The site's authenticated, duration-validated HLS resolver. No new quota reservation. */
    private String cachedSource = "", cachedToken = "";
    private JSONObject cachedPlayback;
    private long cachedUntil;

    public JSONObject playback(String source) throws IOException {
        return playback(source, new java.util.HashSet<>());
    }

    public JSONObject playback(String source, java.util.Set<String> excluded) throws IOException {
        final String token = requireSession().accessToken;
        synchronized (this) {
            if (excluded.isEmpty() && cachedPlayback != null && source.equals(cachedSource) && token.equals(cachedToken) && android.os.SystemClock.elapsedRealtime() < cachedUntil) {
                try { return new JSONObject(cachedPlayback.toString()); } catch (Exception ignored) { }
            }
        }
        JSONObject body = new JSONObject();
        try { body.put("url", source); body.put("excluded", new JSONArray(excluded)); } catch (Exception ignored) { }
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Authorization", "Bearer " + requireSession().accessToken);
        Result result = http("POST", SITE + "api/playback", body.toString(), headers, 62000);
        if (result.status == 401) throw new AuthExpired();
        JSONObject data = parseObject(result.body);
        if (result.status != 200 || data == null) throw new IOException("Le flux vidéo est indisponible. Réessaie dans un instant.");
        try {
            java.net.URI resolved = java.net.URI.create(SITE).resolve(data.optString("url", ""));
            if (!"https".equals(resolved.getScheme()) || !"yamonfi.netlify.app".equals(resolved.getHost()) ||
                !"/api/proxy/stream.m3u8".equals(resolved.getPath()) || resolved.getUserInfo() != null || resolved.getPort() != -1)
                throw new IOException("Adresse du flux invalide.");
            data.put("url", Logic.setParam(resolved.toString(), "profile", "android-tv"));
            if (excluded.isEmpty()) synchronized (this) { cachedSource = source; cachedToken = token; cachedPlayback = new JSONObject(data.toString()); cachedUntil = android.os.SystemClock.elapsedRealtime() + 45000; }
            return data;
        } catch (Exception error) { throw new IOException("Adresse du flux invalide."); }
    }

    public JSONObject episodeCredits(String url, long durationMs) throws IOException {
        Logic.PlayerSource source = Logic.playerSource(url);
        if (source == null || source.season < 1 || source.episode < 1 || durationMs < 300000) return null;
        String query = "tmdb=" + enc(source.id) + "&season=" + source.season + "&episode=" + source.episode + "&duration=" + (durationMs / 1000.0);
        Result result = http("GET", SITE + "api/episode-credits?" + query, null, null, 12000);
        JSONObject body = parseObject(result.body);
        return result.status == 200 && body != null ? body.optJSONObject("marker") : null;
    }

    // ---------------------------------------------------------------- HTTP

    public static Result http(String method, String url, String body, Map<String, String> headers, int readTimeout) throws IOException {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setRequestMethod(method);
            c.setConnectTimeout(10000);
            c.setReadTimeout(readTimeout);
            c.setUseCaches(false);
            c.setRequestProperty("Accept", "application/json");
            c.setRequestProperty("User-Agent", USER_AGENT);
            if (headers != null) for (Map.Entry<String, String> h : headers.entrySet()) c.setRequestProperty(h.getKey(), h.getValue());
            if (body != null) {
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                c.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream out = c.getOutputStream()) { out.write(bytes); }
            }
            int status = c.getResponseCode();
            InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
            String text = in == null ? "" : readAll(in);
            return new Result(status, text, c.getHeaderField("Content-Range"));
        } catch (UnknownHostException e) {
            throw new IOException("Pas de connexion Internet. Vérifie le réseau de la TV.", e);
        } catch (SocketTimeoutException e) {
            throw new IOException("Le serveur met trop de temps à répondre. Réessaie.", e);
        } finally {
            if (c != null) c.disconnect();
        }
    }

    static String readAll(InputStream in) throws IOException {
        try (InputStream input = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[16384];
            int n;
            while ((n = input.read(buffer)) > 0) out.write(buffer, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    public static String enc(String value) {
        try { return URLEncoder.encode(value, "UTF-8").replace("+", "%20"); } catch (Exception e) { return value; }
    }

    /** Construit une requête PostgREST : new Q().select("*").eq("id", 3).order("created_at.desc"). */
    public static final class Q {
        private final StringBuilder sb = new StringBuilder();
        private Q add(String key, String value) { if (sb.length() > 0) sb.append('&'); sb.append(enc(key)).append('=').append(enc(value)); return this; }
        public Q select(String columns) { return add("select", columns); }
        public Q eq(String column, Object value) { return add(column, "eq." + value); }
        public Q is(String column, String value) { return add(column, "is." + value); }
        public Q not(String column, String op, String value) { return add(column, "not." + op + "." + value); }
        public Q or(String expression) { return add("or", "(" + expression + ")"); }
        public Q in(String column, Collection<String> values) {
            StringBuilder list = new StringBuilder();
            for (String v : values) { if (list.length() > 0) list.append(','); list.append('"').append(v.replace("\"", "")).append('"'); }
            return add(column, "in.(" + list + ")");
        }
        public Q order(String order) { return add("order", order); }
        public Q limit(int n) { return add("limit", String.valueOf(n)); }
        public Q offset(int n) { return add("offset", String.valueOf(n)); }
        public Q raw(String key, String value) { return add(key, value); }
        @Override public String toString() { return sb.toString(); }
    }

    // ---------------------------------------------------------------- Auth

    public Session signIn(String email, String password) throws IOException {
        JSONObject body = new JSONObject();
        try { body.put("email", email); body.put("password", password); } catch (Exception ignored) { }
        Result r = http("POST", SUPABASE_URL + "/auth/v1/token?grant_type=password", body.toString(), anonHeaders(), 20000);
        if (r.status >= 400) throw new ApiException(r.status, "auth", "Email ou mot de passe incorrect.");
        return storeSession(r.body);
    }

    /** Retourne true si une session est ouverte directement, false si l'email doit être confirmé. */
    public boolean signUp(String email, String password) throws IOException {
        JSONObject body = new JSONObject();
        try { body.put("email", email); body.put("password", password); } catch (Exception ignored) { }
        Result r = http("POST", SUPABASE_URL + "/auth/v1/signup", body.toString(), anonHeaders(), 20000);
        if (r.status >= 400) throw new ApiException(r.status, "auth", translateSignUpError(errorMessage(r.body)));
        JSONObject json = parseObject(r.body);
        if (json != null && json.optString("access_token", "").length() > 0) { storeSession(r.body); return true; }
        return false;
    }

    static String translateSignUpError(String message) {
        String m = message == null ? "" : message.toLowerCase();
        if (m.contains("already") || m.contains("registered")) return "Un compte existe déjà avec cet email. Connecte-toi.";
        if (m.contains("password")) return "Le mot de passe doit contenir au moins 6 caractères.";
        if (m.contains("email")) return "Adresse email invalide.";
        if (m.contains("rate")) return "Trop de tentatives. Patiente quelques minutes.";
        return "Impossible de créer le compte. Réessaie dans quelques instants.";
    }

    public void signOut() {
        Session s = session;
        clearSession();
        if (s != null) {
            Map<String, String> h = anonHeaders();
            h.put("Authorization", "Bearer " + s.accessToken);
            try { http("POST", SUPABASE_URL + "/auth/v1/logout?scope=local", "{}", h, 8000); } catch (IOException ignored) { }
        }
    }

    public void clearSession() {
        session = null;
        prefs.edit().clear().apply();
    }

    private Session storeSession(String body) throws IOException {
        JSONObject json = parseObject(body);
        if (json == null) throw new ApiException(500, "auth", "Réponse de connexion invalide.");
        JSONObject user = json.optJSONObject("user");
        long expiresAt = json.optLong("expires_at", 0);
        if (expiresAt <= 0) expiresAt = System.currentTimeMillis() / 1000 + json.optLong("expires_in", 3600);
        String id = user == null ? null : user.optString("id", null);
        String email = user == null ? "" : user.optString("email", "");
        if (id == null && session != null) { id = session.userId; email = session.email; }
        if (id == null) throw new ApiException(500, "auth", "Réponse de connexion invalide.");
        Session s = new Session(json.optString("access_token"), json.optString("refresh_token"), expiresAt, id, email);
        prefs.edit().putString("access", s.accessToken).putString("refresh", s.refreshToken).putLong("exp", s.expiresAt)
                .putString("uid", s.userId).putString("email", s.email).apply();
        session = s;
        return s;
    }

    /** Session valide, rafraîchie si elle expire dans moins de 2 minutes. */
    public Session requireSession() throws IOException {
        Session s = session;
        if (s == null) throw new AuthExpired();
        if (s.expiresAt - 120 > System.currentTimeMillis() / 1000) return s;
        synchronized (refreshLock) {
            s = session;
            if (s == null) throw new AuthExpired();
            if (s.expiresAt - 120 > System.currentTimeMillis() / 1000) return s;
            JSONObject body = new JSONObject();
            try { body.put("refresh_token", s.refreshToken); } catch (Exception ignored) { }
            Result r = http("POST", SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", body.toString(), anonHeaders(), 20000);
            if (r.status == 400 || r.status == 401 || r.status == 403) { clearSession(); throw new AuthExpired(); }
            if (r.status >= 400) throw new ApiException(r.status, "auth", "Connexion au serveur impossible. Réessaie.");
            return storeSession(r.body);
        }
    }

    private static Map<String, String> anonHeaders() {
        Map<String, String> h = new LinkedHashMap<>();
        h.put("apikey", SUPABASE_KEY);
        h.put("Authorization", "Bearer " + SUPABASE_KEY);
        return h;
    }

    private Map<String, String> authHeaders() throws IOException {
        Map<String, String> h = anonHeaders();
        h.put("Authorization", "Bearer " + requireSession().accessToken);
        return h;
    }

    // ---------------------------------------------------------------- REST

    private Result rest(String method, String path, String body, Map<String, String> extra) throws IOException {
        Map<String, String> h = authHeaders();
        if (extra != null) h.putAll(extra);
        Result r = http(method, SUPABASE_URL + "/rest/v1/" + path, body, h, 25000);
        if (isJwtError(r)) {
            // Jeton refusé : une seule tentative après rafraîchissement forcé.
            Session s = session;
            if (s != null) {
                synchronized (refreshLock) { if (session == s) session = new Session(s.accessToken, s.refreshToken, 0, s.userId, s.email); }
                h.put("Authorization", "Bearer " + requireSession().accessToken);
                r = http(method, SUPABASE_URL + "/rest/v1/" + path, body, h, 25000);
            }
            if (isJwtError(r)) { clearSession(); throw new AuthExpired(); }
        }
        if (r.status >= 400) {
            // Une erreur de permission (42501) ne déconnecte pas : elle est remontée telle quelle.
            JSONObject err = parseObject(r.body);
            String code = err == null ? "" : err.optString("code", "");
            String message = err == null ? "" : err.optString("message", "");
            throw new ApiException(r.status, code, message.isEmpty() ? "Le serveur a refusé la demande (" + r.status + ")." : message);
        }
        return r;
    }

    /** Jeton expiré ou invalide (PGRST301/302/303, « JWT … ») — distinct d'un refus de permission. */
    static boolean isJwtError(Result r) {
        if (r.status != 401) return false;
        JSONObject err = parseObject(r.body);
        String code = err == null ? "" : err.optString("code", "");
        String message = err == null ? "" : err.optString("message", "");
        return code.startsWith("PGRST3") || message.toLowerCase().contains("jwt") || err == null;
    }

    public JSONArray select(String table, Q query) throws IOException {
        return parseArray(rest("GET", table + "?" + query, null, null).body);
    }

    public Result selectCounted(String table, Q query) throws IOException {
        Map<String, String> h = new LinkedHashMap<>();
        h.put("Prefer", "count=exact");
        return rest("GET", table + "?" + query, null, h);
    }

    /** Insertion ; avec onConflict, se comporte comme upsert() de supabase-js. */
    public JSONArray insert(String table, Object rows, String onConflict, boolean returning) throws IOException {
        Map<String, String> h = new LinkedHashMap<>();
        String prefer = returning ? "return=representation" : "return=minimal";
        if (onConflict != null) prefer += ",resolution=merge-duplicates";
        h.put("Prefer", prefer);
        // onConflict "" : fusion sur la clé primaire, comme upsert() sans option.
        String path = table + (onConflict != null && !onConflict.isEmpty() ? "?on_conflict=" + enc(onConflict) : "");
        Result r = rest("POST", path, rows.toString(), h);
        return returning ? parseArray(r.body) : new JSONArray();
    }

    public JSONArray update(String table, Q query, JSONObject values) throws IOException {
        Map<String, String> h = new LinkedHashMap<>();
        h.put("Prefer", "return=representation");
        return parseArray(rest("PATCH", table + "?" + query, values.toString(), h).body);
    }

    public void delete(String table, Q query) throws IOException {
        rest("DELETE", table + "?" + query, null, null);
    }

    public Object rpc(String function, JSONObject args) throws IOException {
        Result r = rest("POST", "rpc/" + function, args == null ? "{}" : args.toString(), null);
        String body = r.body == null ? "" : r.body.trim();
        if (body.isEmpty()) return null;
        try { return new JSONTokener(body).nextValue(); } catch (Exception e) { return null; }
    }

    // ---------------------------------------------------------------- JSON

    public static JSONObject parseObject(String text) {
        try { Object v = new JSONTokener(text == null ? "" : text).nextValue(); return v instanceof JSONObject ? (JSONObject) v : null; } catch (Exception e) { return null; }
    }

    public static JSONArray parseArray(String text) throws IOException {
        try {
            Object v = new JSONTokener(text == null || text.isEmpty() ? "[]" : text).nextValue();
            if (v instanceof JSONArray) return (JSONArray) v;
            if (v instanceof JSONObject) { JSONArray a = new JSONArray(); a.put(v); return a; }
            return new JSONArray();
        } catch (Exception e) {
            throw new IOException("Réponse du serveur illisible.");
        }
    }

    static String errorMessage(String body) {
        JSONObject json = parseObject(body);
        if (json == null) return body;
        for (String key : new String[]{"msg", "message", "error_description", "error"}) {
            String v = json.optString(key, "");
            if (!v.isEmpty()) return v;
        }
        return body;
    }
}
