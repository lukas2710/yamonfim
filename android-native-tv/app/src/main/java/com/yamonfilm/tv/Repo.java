package com.yamonfilm.tv;

import android.content.Context;
import android.content.SharedPreferences;

import com.yamonfilm.tv.Api.Q;
import com.yamonfilm.tv.Models.Channel;
import com.yamonfilm.tv.Models.Collection;
import com.yamonfilm.tv.Models.History;
import com.yamonfilm.tv.Models.Media;
import com.yamonfilm.tv.Models.Profile;
import com.yamonfilm.tv.Models.Request;
import com.yamonfilm.tv.Models.Subscription;
import com.yamonfilm.tv.Models.TmdbResult;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Toutes les opérations de données, exécutées hors du fil d'interface. */
public final class Repo {
    public final Api api;
    private final SharedPreferences prefs;
    private final File cacheFile;
    private volatile List<Media> catalogue = Collections.emptyList();
    private volatile Map<String, Media> byId = Collections.emptyMap();
    private volatile Profile profile;

    public Repo(Context context) {
        api = new Api(context);
        prefs = context.getSharedPreferences("app", Context.MODE_PRIVATE);
        cacheFile = new File(context.getFilesDir(), "catalogue.json");
        String stored = prefs.getString("profile", null);
        if (stored != null) { JSONObject o = Api.parseObject(stored); if (o != null) profile = Profile.from(o); }
    }

    // ------------------------------------------------------------ Session / profil

    public String userId() { Api.Session s = api.session(); return s == null ? null : s.userId; }
    public String email() { Api.Session s = api.session(); return s == null ? "" : s.email; }
    public boolean isAdmin() { Api.Session s = api.session(); return s != null && s.isAdmin(); }
    public Profile profile() { return profile; }
    public String profileId() { Profile p = profile; return p == null ? null : p.id; }

    public void setProfile(Profile p) {
        profile = p;
        if (p == null) prefs.edit().remove("profile").apply();
        else prefs.edit().putString("profile", p.toJson().toString()).apply();
    }

    public void signOut() { setProfile(null); api.signOut(); }

    public boolean flag(String key) { return prefs.getBoolean(key, false); }
    public void setFlag(String key) { prefs.edit().putBoolean(key, true).apply(); }

    // ------------------------------------------------------------ Catalogue (lib/catalogue.ts)

    public static final String CARD_COLUMNS = "id,title,type,poster,backdrop,description,genres,tmdb_id";

    public List<Media> catalogue() { return catalogue; }
    public Media cached(String id) { return byId.get(id); }

    /** Catalogue enregistré lors de la dernière ouverture : affichage immédiat. */
    public boolean loadCachedCatalogue() {
        if (!cacheFile.exists()) return false;
        try (FileInputStream in = new FileInputStream(cacheFile)) {
            JSONArray rows = Api.parseArray(Api.readAll(in));
            publish(parse(rows));
            return !catalogue.isEmpty();
        } catch (Exception e) { return false; }
    }

    public List<Media> refreshCatalogue() throws IOException {
        List<Media> rows = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int total = Integer.MAX_VALUE, offset = 0;
        while (offset < total) {
            Q q = new Q().select(CARD_COLUMNS).order("created_at.desc,id.desc").offset(offset).limit(250);
            Api.Result r = offset == 0 ? api.selectCounted("media", q) : null;
            JSONArray data = r != null ? Api.parseArray(r.body) : api.select("media", q);
            if (r != null && r.total() >= 0) total = r.total();
            if (data.length() == 0) {
                if (total != Integer.MAX_VALUE && offset < total) throw new IOException("Le chargement du catalogue est incomplet. Réessaie.");
                break;
            }
            offset += data.length();
            for (Media m : parse(data)) if (seen.add(m.id)) rows.add(m);
            if (total == Integer.MAX_VALUE && data.length() < 250) break;
        }
        publish(rows);
        JSONArray out = new JSONArray();
        for (Media m : rows) out.put(m.toCardJson());
        try (FileOutputStream f = new FileOutputStream(cacheFile)) { f.write(out.toString().getBytes(StandardCharsets.UTF_8)); } catch (IOException ignored) { }
        return rows;
    }

    private static List<Media> parse(JSONArray rows) {
        List<Media> list = new ArrayList<>(rows.length());
        for (int i = 0; i < rows.length(); i++) { JSONObject o = rows.optJSONObject(i); if (o != null) list.add(Media.from(o)); }
        return list;
    }

    private void publish(List<Media> rows) {
        Map<String, Media> index = new HashMap<>(rows.size() * 2);
        for (Media m : rows) index.put(m.id, m);
        catalogue = Collections.unmodifiableList(rows);
        byId = index;
    }

    public Media media(String id) throws IOException {
        JSONArray rows = api.select("media", new Q().select("*").eq("id", id));
        if (rows.length() == 0) throw new IOException("Ce contenu n'existe pas ou n'est plus disponible.");
        return Media.from(rows.optJSONObject(0));
    }

    // ------------------------------------------------------------ Abonnement / quota (lib/subscription.ts)

    public Subscription subscription() throws IOException {
        String uid = requireUser();
        JSONObject row = null; boolean verified = false;
        try {
            Object result = api.rpc("get_my_subscription_status", null);
            if (result instanceof JSONObject) { row = (JSONObject) result; verified = true; }
        } catch (Api.ApiException e) {
            if (e instanceof Api.AuthExpired) throw e;
            if (!"PGRST202".equals(e.code) && !"42883".equals(e.code)) throw new IOException("Impossible de vérifier ton accès. Réessaie dans un instant.");
        }
        if (row == null) {
            JSONArray rows = api.select("profiles", new Q().select("*").eq("id", uid));
            row = rows.optJSONObject(0);
            if (row == null) throw new IOException("Impossible de vérifier ton accès. Réessaie dans un instant.");
        }
        Subscription s = new Subscription();
        Object vip = row.opt("is_vip");
        s.vip = Boolean.TRUE.equals(vip) || "true".equals(String.valueOf(vip));
        s.count = Math.max(0, row.optInt("watch_count", 0));
        long stored = Logic.parseTime(Models.str(row, "watch_reset_at"));
        s.resetVerified = verified && stored > 0;
        s.resetAt = s.resetVerified ? stored : Logic.nextSundayReset(System.currentTimeMillis());
        s.vipEnd = Logic.vipExpiration(Models.str(row, "vip_started_at"), Models.str(row, "vip_duration"));
        return s;
    }

    /** true si le quota gratuit est atteint (le site affiche alors la promotion VIP). */
    public boolean quotaReached() throws IOException {
        if (isAdmin()) return false;
        Subscription s = subscription();
        return !s.vip && s.count >= Logic.FREE_WATCH_LIMIT;
    }

    /** Réserve une vision avant chaque lecture (reserveAccountViewing). */
    public Logic.WatchAccess reserveViewing() throws IOException {
        if (isAdmin()) return new Logic.WatchAccess(true, true, -1);
        final String uid = requireUser();
        try {
            return Logic.reserveViewing(() -> {
                Subscription s = subscription();
                return new int[]{s.vip ? 1 : 0, s.count};
            }, expected -> {
                JSONObject values = new JSONObject();
                values.put("watch_count", expected + 1);
                Q q = new Q().eq("id", uid).not("is_vip", "is", "true");
                q = expected == 0 ? q.or("watch_count.eq.0,watch_count.is.null") : q.eq("watch_count", expected);
                return api.update("profiles", q.select("id"), values).length() > 0;
            });
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException(e.getMessage() == null ? "Le visionnage n'a pas pu être enregistré. Réessaie." : e.getMessage());
        }
    }

    private String requireUser() throws IOException {
        Api.Session s = api.requireSession();
        return s.userId;
    }

    // ------------------------------------------------------------ Profils

    public List<Profile> profiles() throws IOException {
        JSONArray rows = api.select("user_profiles", new Q().select("*").eq("user_id", requireUser()).order("created_at.asc"));
        List<Profile> list = new ArrayList<>();
        for (int i = 0; i < rows.length(); i++) list.add(Profile.from(rows.optJSONObject(i)));
        return list;
    }

    public void saveProfile(String id, String name, String avatar) throws IOException {
        String uid = requireUser();
        JSONObject values = new JSONObject();
        try { values.put("name", name.trim()); values.put("avatar_url", avatar); } catch (Exception ignored) { }
        if (id == null) {
            try { values.put("user_id", uid); } catch (Exception ignored) { }
            api.insert("user_profiles", new JSONArray().put(values), null, false);
        } else {
            api.update("user_profiles", new Q().eq("id", id).eq("user_id", uid), values);
            Profile p = profile;
            if (p != null && id.equals(p.id)) { Profile n = new Profile(); n.id = id; n.name = name.trim(); n.avatar = avatar; setProfile(n); }
        }
    }

    public void deleteProfile(String id) throws IOException {
        api.delete("user_profiles", new Q().eq("id", id).eq("user_id", requireUser()));
        Profile p = profile;
        if (p != null && id.equals(p.id)) setProfile(null);
    }

    // ------------------------------------------------------------ File d'écriture

    /** Écritures d'historique et d'épisodes vus, dans l'ordre, sur un fil dédié. */
    private final java.util.concurrent.ExecutorService writer = java.util.concurrent.Executors.newSingleThreadExecutor(r -> new Thread(r, "yamonfilm-write"));

    public interface Write { void run() throws Exception; }

    /** Enregistre en arrière-plan, avec deux nouvelles tentatives si le réseau coupe. */
    public void enqueue(Write w) {
        writer.execute(() -> {
            for (int attempt = 0; attempt < 3; attempt++) {
                try { w.run(); return; }
                catch (Api.AuthExpired e) { return; }
                catch (Exception e) { try { Thread.sleep(1500L * (attempt + 1)); } catch (InterruptedException ie) { return; } }
            }
        });
    }

    /** Attend la fin des écritures en cours, pour relire un état à jour (max. `timeoutMs`). */
    public void flushWrites(long timeoutMs) {
        java.util.concurrent.Future<?> f = writer.submit(() -> { });
        try { f.get(timeoutMs, java.util.concurrent.TimeUnit.MILLISECONDS); } catch (Exception ignored) { }
    }

    // ------------------------------------------------------------ Historique et épisodes vus

    private Q mine(Q q) throws IOException {
        q.eq("user_id", requireUser());
        String pid = profileId();
        if (pid != null) q.eq("profile_id", pid);
        return q;
    }

    public List<History> history() throws IOException {
        JSONArray rows = api.select("watch_history", mine(new Q().select("*")).order("updated_at.desc"));
        List<History> list = new ArrayList<>();
        for (int i = 0; i < rows.length(); i++) { JSONObject o = rows.optJSONObject(i); if (o != null) list.add(History.from(o)); }
        return list;
    }

    public History history(String mediaId) throws IOException {
        JSONArray rows = api.select("watch_history", mine(new Q().select("*")).eq("media_id", mediaId).limit(1));
        JSONObject o = rows.optJSONObject(0);
        return o == null ? null : History.from(o);
    }

    public void saveHistory(Media media, int s, int e, long currentTime, long duration) throws IOException {
        Models.Season season = s >= 0 && s < media.seasons.size() ? media.seasons.get(s) : null;
        Models.Episode ep = media.episode(s, e);
        int runtime = ep != null && ep.runtime > 0 ? ep.runtime : media.runtime;
        long total = duration > 0 ? duration : runtime * 60L;
        long time = Math.max(0, total > 0 ? Math.min(currentTime, total) : currentTime);
        JSONObject row = new JSONObject();
        try {
            row.put("user_id", requireUser());
            row.put("profile_id", profileId() == null ? JSONObject.NULL : profileId());
            row.put("media_id", media.id);
            row.put("type", media.type);
            row.put("season_idx", s);
            row.put("episode_idx", e);
            row.put("season_number", season != null && season.number > 0 ? season.number : 1);
            row.put("episode_number", ep != null && ep.number > 0 ? ep.number : 1);
            row.put("current_time", time);
            row.put("duration", total);
            row.put("updated_at", Instant.now().toString());
        } catch (Exception ignored) { }
        api.insert("watch_history", new JSONArray().put(row), "user_id,profile_id,media_id", false);
    }

    /** Épisodes vus d'un titre, pour le profil actif uniquement. */
    public Set<String> watchedKeys(String mediaId) throws IOException {
        JSONArray rows = api.select("user_watched", mine(new Q().select("ep_key")).eq("media_id", mediaId));
        Set<String> keys = new HashSet<>();
        for (int i = 0; i < rows.length(); i++) { JSONObject o = rows.optJSONObject(i); if (o != null) keys.add(o.optString("ep_key")); }
        return keys;
    }

    public Map<String, Set<String>> allWatched() throws IOException {
        JSONArray rows = api.select("user_watched", mine(new Q().select("media_id,ep_key")));
        Map<String, Set<String>> map = new HashMap<>();
        for (int i = 0; i < rows.length(); i++) {
            JSONObject o = rows.optJSONObject(i);
            if (o == null) continue;
            String id = Models.str(o, "media_id");
            Set<String> set = map.get(id);
            if (set == null) map.put(id, set = new HashSet<>());
            set.add(o.optString("ep_key"));
        }
        return map;
    }

    public void setWatched(String mediaId, List<String> keys, boolean value) throws IOException {
        if (keys.isEmpty()) return;
        if (value) {
            String now = Instant.now().toString();
            JSONArray rows = new JSONArray();
            for (String k : keys) {
                JSONObject row = new JSONObject();
                try {
                    row.put("user_id", requireUser());
                    row.put("profile_id", profileId() == null ? JSONObject.NULL : profileId());
                    row.put("media_id", mediaId); row.put("ep_key", k); row.put("watched_at", now);
                } catch (Exception ignored) { }
                rows.put(row);
            }
            api.insert("user_watched", rows, "user_id,profile_id,media_id,ep_key", false);
        } else {
            api.delete("user_watched", mine(new Q()).eq("media_id", mediaId).in("ep_key", keys));
        }
    }

    /** Retire un titre de l'historique du profil (page Historique du site). */
    public void removeFromHistory(String mediaId) throws IOException {
        api.delete("user_watched", mine(new Q()).eq("media_id", mediaId));
        api.delete("watch_history", mine(new Q()).eq("media_id", mediaId));
    }

    public void clearHistory() throws IOException {
        api.delete("user_watched", mine(new Q()));
        api.delete("watch_history", mine(new Q()));
    }

    // ------------------------------------------------------------ Collections

    public List<Collection> collections() throws IOException {
        JSONArray rows = api.select("media_collections", new Q().select("*").eq("active", "true").order("position.asc,created_at.asc"));
        List<Collection> list = new ArrayList<>();
        for (int i = 0; i < rows.length(); i++) { JSONObject o = rows.optJSONObject(i); if (o != null) list.add(Collection.from(o)); }
        return list;
    }

    public List<Media> collectionItems(Collection c) {
        List<Media> items = new ArrayList<>();
        Map<String, Media> index = byId;
        for (String id : c.mediaIds) { Media m = index.get(id); if (m != null) items.add(m); }
        return items;
    }

    // ------------------------------------------------------------ Présence (components/PresenceTracker.tsx)

    private String recordedDay = "";

    public void presence(String action, String mediaId) {
        Api.Session s = api.session();
        if (s == null) return;
        try {
            JSONObject row = new JSONObject();
            row.put("user_id", s.userId);
            row.put("email", s.email);
            row.put("current_action", action);
            row.put("current_media_id", mediaId == null ? JSONObject.NULL : mediaId);
            row.put("last_seen", Instant.now().toString());
            api.insert("user_presence", new JSONArray().put(row), "", false);
            String key = s.userId + ":" + Logic.parisDay(System.currentTimeMillis());
            if (!key.equals(recordedDay)) {
                api.rpc("record_daily_presence", null);
                recordedDay = key;
            }
        } catch (Exception ignored) {
            // La présence est un suivi statistique : elle ne doit jamais gêner la lecture.
        }
    }

    // ------------------------------------------------------------ Demandes

    public List<Request> requests() throws IOException {
        JSONArray rows = api.select("requests", new Q().select("*").order("created_at.desc").limit(200));
        List<Request> list = new ArrayList<>();
        for (int i = 0; i < rows.length(); i++) { JSONObject o = rows.optJSONObject(i); if (o != null) list.add(Request.from(o)); }
        return list;
    }

    private List<JSONObject> identities(String table) throws IOException {
        List<JSONObject> rows = new ArrayList<>();
        int total = Integer.MAX_VALUE;
        String columns = "requests".equals(table) ? "id,title,type,tmdb_id,status" : "id,title,type,tmdb_id";
        while (rows.size() < total) {
            Api.Result r = api.selectCounted(table, new Q().select(columns).order("id.asc").offset(rows.size()).limit(500));
            JSONArray data = Api.parseArray(r.body);
            if (r.total() >= 0) total = r.total();
            if (data.length() == 0) { if (total != Integer.MAX_VALUE && rows.size() < total) throw new IOException("Vérification incomplète. Réessaie."); break; }
            for (int i = 0; i < data.length(); i++) rows.add(data.optJSONObject(i));
        }
        return rows;
    }

    /** Ajoute une demande après la même vérification de doublons que le site. */
    public void addRequest(TmdbResult item, String type) throws IOException {
        for (JSONObject row : identities("media"))
            if (Logic.sameContent(type, item.id, item.title, Models.str(row, "type"), Models.str(row, "tmdb_id"), Models.str(row, "title")))
                throw new IOException("Ce titre est déjà disponible dans le catalogue. Aucune demande ajoutée.");
        for (JSONObject row : identities("requests"))
            if (!"refuse".equals(Models.str(row, "status")) && Logic.sameContent(type, item.id, item.title, Models.str(row, "type"), Models.str(row, "tmdb_id"), Models.str(row, "title")))
                throw new IOException("Ce titre a déjà été demandé. Aucune demande en double ajoutée.");
        Api.Session s = api.requireSession();
        JSONObject row = new JSONObject();
        try {
            row.put("user_id", s.userId);
            row.put("user_email", s.email.isEmpty() ? "Visiteur" : s.email);
            row.put("title", item.title);
            row.put("type", type);
            row.put("tmdb_id", item.id);
            row.put("poster", item.poster.isEmpty() ? JSONObject.NULL : item.poster);
            row.put("note", JSONObject.NULL);
            row.put("status", "en_attente");
        } catch (Exception ignored) { }
        try {
            api.insert("requests", new JSONArray().put(row), null, false);
        } catch (Api.ApiException e) {
            if ("23505".equals(e.code) || String.valueOf(e.getMessage()).contains("YF_DUPLICATE"))
                throw new IOException("Ce film ou cette série est déjà disponible ou déjà enregistré. Aucun doublon n'a été ajouté.");
            throw e;
        }
    }

    public List<TmdbResult> searchTmdb(String query, String type) throws IOException {
        String endpoint = "movie".equals(type) ? "movie" : "tv";
        for (String variant : Logic.searchQueryVariants(query)) {
            Api.Result r = Api.http("GET", "https://api.themoviedb.org/3/search/" + endpoint + "?api_key=" + Api.TMDB_KEY + "&language=fr-FR&query=" + Api.enc(variant), null, null, 15000);
            if (r.status >= 400) throw new IOException("Recherche indisponible. Réessaie.");
            JSONObject json = Api.parseObject(r.body);
            JSONArray results = json == null ? null : json.optJSONArray("results");
            if (results == null || results.length() == 0) continue;
            List<TmdbResult> list = new ArrayList<>();
            for (int i = 0; i < results.length() && list.size() < 12; i++) {
                JSONObject o = results.optJSONObject(i);
                if (o == null) continue;
                TmdbResult t = new TmdbResult();
                t.id = Models.str(o, "id");
                t.title = Models.str(o, "movie".equals(type) ? "title" : "name");
                String date = Models.str(o, "movie".equals(type) ? "release_date" : "first_air_date");
                t.year = date.length() >= 4 ? date.substring(0, 4) : "";
                String poster = Models.str(o, "poster_path");
                t.poster = poster.isEmpty() ? "" : "https://image.tmdb.org/t/p/w500" + poster;
                t.overview = Models.str(o, "overview");
                list.add(t);
            }
            return list;
        }
        return new ArrayList<>();
    }

    // ------------------------------------------------------------ TV en direct (app/api/m3u)

    public static final String M3U = "https://raw.githubusercontent.com/ZeroxarZ/iptv-fr/main/playlist_fr.m3u8";

    public List<Channel> channels() throws IOException {
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Accept", "*/*");
        Api.Result r = Api.http("GET", M3U, null, headers, 15000);
        if (r.status >= 400) throw new IOException("La liste des chaînes est temporairement indisponible.");
        return parseM3u(r.body);
    }

    public static List<Channel> parseM3u(String text) {
        List<Channel> list = new ArrayList<>();
        Channel current = null;
        for (String raw : text.split("\n")) {
            String line = raw.trim();
            if (line.startsWith("#EXTINF:")) {
                current = new Channel();
                int comma = line.lastIndexOf(',');
                String name = comma >= 0 ? line.substring(comma + 1).trim() : "Chaîne inconnue";
                current.name = name.replaceAll("[ⒼⓎⒹ]", "").trim();
                current.logo = attribute(line, "tvg-logo");
                String group = attribute(line, "group-title");
                current.category = group.isEmpty() ? "France" : group;
            } else if ((line.startsWith("http://") || line.startsWith("https://")) && current != null) {
                current.url = line;
                if (!current.name.isEmpty()) list.add(current);
                current = null;
            }
        }
        return list;
    }

    private static String attribute(String line, String name) {
        int start = line.indexOf(name + "=\"");
        if (start < 0) return "";
        start += name.length() + 2;
        int end = line.indexOf('"', start);
        return end < 0 ? "" : line.substring(start, end);
    }
}
