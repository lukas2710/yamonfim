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
    private final File rankingsFile;
    private final Context appContext;
    private volatile Discovery.Rankings rankings = Discovery.Rankings.empty();
    private volatile Set<String> completed = Collections.emptySet();
    private volatile Map<String, Set<String>> homeSeen = Collections.emptyMap();
    private volatile Set<String> progressing = Collections.emptySet();
    private volatile String completedProfile;
    public boolean completed(String id) { return java.util.Objects.equals(profileId(), completedProfile) && completed.contains(id); }
    public int completedRevision() { return 31 * (31 * completed.hashCode() + homeSeen.hashCode()) + progressing.hashCode(); }
    public boolean progressing(String id) { return java.util.Objects.equals(profileId(), completedProfile) && progressing.contains(id); }
    public boolean seenPosition(String id, boolean series, int season, int episode) { Set<String> keys = java.util.Objects.equals(profileId(), completedProfile) ? homeSeen.get(id) : null; return keys != null && keys.contains(series ? Logic.epKey(season, episode) : "movie_main"); }
    private volatile List<Media> catalogue = Collections.emptyList();
    private volatile Map<String, Media> byId = Collections.emptyMap();
    private volatile Profile profile;

    public Repo(Context context) {
        appContext = context.getApplicationContext();
        api = new Api(context);
        prefs = context.getSharedPreferences("app", Context.MODE_PRIVATE);
        cacheFile = new File(context.getFilesDir(), "catalogue.json");
        rankingsFile = new File(context.getFilesDir(), "home-rankings.json");
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
        completed = Collections.emptySet(); completedProfile = null; homeSeen = Collections.emptyMap(); progressing = Collections.emptySet();
        profile = p;
        if (p == null) prefs.edit().remove("profile").apply();
        else prefs.edit().putString("profile", p.toJson().toString()).apply();
    }

    public void signOut() { setProfile(null); api.signOut(); }

    public boolean flag(String key) { return prefs.getBoolean(key, false); }
    public void setFlag(String key) { prefs.edit().putBoolean(key, true).apply(); }

    // ------------------------------------------------------------ Catalogue (lib/catalogue.ts)

    public static final String CARD_COLUMNS = "id,title,type,poster,backdrop,description,genres,tmdb_id,audience,release_year";

    public List<Media> catalogue() { return catalogue; }
    public Media cached(String id) {
        Media m = byId.get(id);
        return m != null && Logic.canWatch(m.audience, m.genres, profileMode()) ? m : null;
    }

    /** Catalogue enregistré lors de la dernière ouverture : affichage immédiat. */
    public boolean loadCachedCatalogue() {
        loadCachedRankings();
        if (!cacheFile.exists()) return false;
        try (FileInputStream in = new FileInputStream(cacheFile)) {
            JSONArray rows = Api.parseArray(Api.readAll(in));
            publish(parse(rows));
            return !catalogue.isEmpty();
        } catch (Exception e) { return false; }
    }

    public List<Media> refreshCatalogue() throws IOException {
        // Same public card snapshot as the site: one cached download instead of
        // a hundred Supabase page requests. Existing pagination remains a fallback.
        try {
            Api.Result response = Api.http("GET", Api.SITE + "api/catalogue", null, null, 15000);
            if (response.status == 200 && response.body.trim().startsWith("[")) {
                List<Media> rows = parse(Api.parseArray(response.body));
                publish(rows); saveCatalogue(rows); return rows;
            }
        } catch (IOException ignored) { }
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
        saveCatalogue(rows);
        return rows;
    }

    private void saveCatalogue(List<Media> rows) {
        JSONArray out = new JSONArray();
        for (Media m : rows) out.put(m.toCardJson());
        try (FileOutputStream f = new FileOutputStream(cacheFile)) { f.write(out.toString().getBytes(StandardCharsets.UTF_8)); } catch (IOException ignored) { }
    }

    public Discovery.Rankings homeRankings() { return rankings; }

    private void loadCachedRankings() {
        try { useRankings(parseRankings(Api.parseObject(Api.readAll(appContext.getResources().openRawResource(R.raw.home_rankings))))); } catch (Exception ignored) { }
        if (rankingsFile.exists()) try (FileInputStream in = new FileInputStream(rankingsFile)) {
            Discovery.Rankings cached = parseRankings(Api.parseObject(Api.readAll(in)));
            useRankings(cached);
        } catch (Exception ignored) { }
    }

    public Discovery.Rankings refreshHomeRankings() throws IOException {
        Api.Result response = Api.http("GET", Api.SITE + "api/home-rankings", null, null, 12000);
        if (response.status != 200) throw new IOException("Classements temporairement indisponibles");
        Discovery.Rankings next = parseRankings(Api.parseObject(response.body));
        if (useRankings(next)) {
            try (FileOutputStream out = new FileOutputStream(rankingsFile)) { out.write(response.body.getBytes(StandardCharsets.UTF_8)); } catch (IOException ignored) { }
        }
        return rankings;
    }

    private synchronized boolean useRankings(Discovery.Rankings next) {
        if (next.at < rankings.at) return false;
        rankings = next; return true;
    }

    private static Discovery.Rankings parseRankings(JSONObject json) throws IOException {
        if (json == null || json.optJSONObject("ratings") == null || json.optJSONObject("trending") == null || json.optLong("at", 0) <= 0) throw new IOException("Classements invalides");
        Map<String, Discovery.Rating> scores = new HashMap<>(); JSONObject data = json.optJSONObject("ratings");
        java.util.Iterator<String> keys = data.keys();
        while (keys.hasNext()) {
            String key = keys.next(); JSONObject score = data.optJSONObject(key); if (score == null) continue;
            double rating = score.optDouble("rating", 0); int votes = score.optInt("votes", 0);
            if (Double.isNaN(rating) || Double.isInfinite(rating) || rating < 0 || rating > 10 || votes < 0) continue;
            scores.put(key, new Discovery.Rating(rating, votes, score.optBoolean("anime", false)));
        }
        JSONObject trending = json.optJSONObject("trending");
        return new Discovery.Rankings(json.optLong("at"), scores, rankingIds(trending.optJSONArray("movie")), rankingIds(trending.optJSONArray("series")));
    }

    private static List<String> rankingIds(JSONArray ids) {
        List<String> out = new ArrayList<>(); if (ids != null) for (int i = 0; i < ids.length(); i++) { String id = ids.optString(i, ""); if (!id.isEmpty()) out.add(id); } return out;
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
            }, expected -> incrementWatchCount(uid, expected));
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException(e.getMessage() == null ? "Le visionnage n'a pas pu être enregistré. Réessaie." : e.getMessage());
        }
    }

    /**
     * Compte une vision comme le site (lib/subscription.ts) : fonction serveur
     * increment_my_watch_count ; mise à jour directe seulement si la fonction n'existe pas.
     */
    public boolean incrementWatchCount(String uid, int expected) throws IOException {
        try {
            JSONObject args = new JSONObject();
            try { args.put("expected", expected); } catch (Exception ignored) { }
            Object result = api.rpc("increment_my_watch_count", args);
            return Boolean.TRUE.equals(result) || "true".equals(String.valueOf(result));
        } catch (Api.ApiException e) {
            if (e instanceof Api.AuthExpired) throw e;
            if (!"PGRST202".equals(e.code) && !"42883".equals(e.code)) throw new IOException("Le visionnage n'a pas pu être enregistré. Réessaie.");
        }
        JSONObject values = new JSONObject();
        try { values.put("watch_count", expected + 1); } catch (Exception ignored) { }
        Q q = new Q().eq("id", uid).not("is_vip", "is", "true");
        q = expected == 0 ? q.or("watch_count.eq.0,watch_count.is.null") : q.eq("watch_count", expected);
        return api.update("profiles", q.select("id"), values).length() > 0;
    }

    /** Vérification avant lancement : le quota gratuit est-il déjà atteint ? (null = VIP ou admin) */
    public Subscription accessBeforePlay() throws IOException {
        if (isAdmin()) return null;
        Subscription s = subscription();
        return s.vip ? null : s;
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

    public void saveProfile(String id, String name, String avatar) throws IOException { saveProfile(id, name, avatar, null); }

    public void saveProfile(String id, String name, String avatar, String mode) throws IOException {
        String uid = requireUser();
        JSONObject values = new JSONObject();
        try {
            values.put("name", name.trim()); values.put("avatar_url", avatar);
            if (mode != null) values.put("profile_mode", mode);
        } catch (Exception ignored) { }
        if (id == null) {
            try { values.put("user_id", uid); } catch (Exception ignored) { }
            api.insert("user_profiles", new JSONArray().put(values), null, false);
        } else {
            api.update("user_profiles", new Q().eq("id", id).eq("user_id", uid), values);
            Profile p = profile;
            if (p != null && id.equals(p.id)) { Profile n = new Profile(); n.id = id; n.name = name.trim(); n.avatar = avatar; n.mode = mode != null ? mode : p.mode; setProfile(n); }
        }
    }

    /** Relit le mode du profil actif (il peut être changé depuis le site). */
    public void refreshProfileMode() throws IOException {
        Profile p = profile;
        if (p == null) return;
        JSONArray rows = api.select("user_profiles", new Q().select("profile_mode").eq("id", p.id).eq("user_id", requireUser()));
        JSONObject o = rows.optJSONObject(0);
        if (o == null) return;
        String mode = Models.str(o, "profile_mode");
        if (!mode.isEmpty() && !mode.equals(p.mode)) { Profile n = new Profile(); n.id = p.id; n.name = p.name; n.avatar = p.avatar; n.mode = mode; setProfile(n); }
    }

    /** Mode du profil actif : standard, kids ou junior. */
    public String profileMode() { Profile p = profile; return p == null || p.mode == null || p.mode.isEmpty() ? "standard" : p.mode; }

    /** Catalogue visible pour le profil actif (lib/profile-audience.ts). */
    public List<Media> visibleCatalogue() {
        String mode = profileMode();
        if ("standard".equals(mode)) return catalogue;
        List<Media> list = new ArrayList<>();
        for (Media m : catalogue) if (Logic.canWatch(m.audience, m.genres, mode)) list.add(m);
        return list;
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

    /** Same legacy fallback as the site, isolated to the requested active profile. */
    public List<Discovery.Viewing> recommendationHistory(List<History> history, String profileId) throws IOException {
        List<Discovery.Viewing> out = new ArrayList<>(); Set<String> recorded = new HashSet<>();
        for (History h : history) { recorded.add(h.mediaId); out.add(new Discovery.Viewing(h.mediaId, h.currentTime, h.duration, Logic.parseTime(h.updatedAt))); }
        if (profileId == null) return out;
        JSONArray rows = new JSONArray();
        String userId = requireUser(); int rowOffset = 0, total = Integer.MAX_VALUE;
        while (rowOffset < total) {
            Q query = new Q().select("media_id,ep_key,watched_at").eq("user_id", userId).eq("profile_id", profileId).order("watched_at.desc,media_id.asc,ep_key.asc").offset(rowOffset).limit(1000);
            Api.Result first = rowOffset == 0 ? api.selectCounted("user_watched", query) : null;
            JSONArray page = first == null ? api.select("user_watched", query) : Api.parseArray(first.body);
            if (first != null && first.total() >= 0) total = first.total();
            if (page.length() == 0) { if (total != Integer.MAX_VALUE && rowOffset < total) throw new IOException("Liste des épisodes vus incomplète"); break; }
            rowOffset += page.length(); for (int i = 0; i < page.length(); i++) rows.put(page.optJSONObject(i));
            if (total == Integer.MAX_VALUE && page.length() < 1000) break;
        }
        Map<String, Map<String, Long>> seen = new HashMap<>();
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.optJSONObject(i); if (row == null) continue;
            String id = Models.str(row, "media_id");
            Map<String, Long> keys = seen.get(id); if (keys == null) seen.put(id, keys = new HashMap<>());
            keys.put(Models.str(row, "ep_key"), Logic.parseTime(Models.str(row, "watched_at")));
            if (recorded.add(id)) out.add(new Discovery.Viewing(id, 600, 0, Logic.parseTime(Models.str(row, "watched_at"))));
        }
        List<Media> titles = new ArrayList<>(); List<String> series = new ArrayList<>();
        for (String id : seen.keySet()) { Media item = cached(id); if (item != null) { titles.add(item); if (item.isSeries()) series.add(id); } }
        for (History h : history) if (!seen.containsKey(h.mediaId)) { Media item = cached(h.mediaId); if (item != null) titles.add(item); }
        Map<String, List<String>> required = new HashMap<>();
        for (int offset = 0; offset < series.size(); offset += 10) try {
            Api.Result response = Api.http("GET", Api.SITE + "api/catalogue-episodes?ids=" + Api.enc(String.join(",", series.subList(offset, Math.min(offset + 10, series.size())))), null, null, 10000);
            JSONObject metadata = response.status == 200 ? Api.parseObject(response.body) : null;
            if (metadata != null) { java.util.Iterator<String> ids = metadata.keys(); while (ids.hasNext()) { String id = ids.next(); required.put(id, rankingIds(metadata.optJSONArray(id))); } }
        } catch (IOException ignored) { }
        List<Discovery.Viewing> actual = new ArrayList<>(); for (History h : history) actual.add(new Discovery.Viewing(h.mediaId, h.currentTime, h.duration, Logic.parseTime(h.updatedAt)));
        if (java.util.Objects.equals(profileId, profileId())) {
            completed = Collections.unmodifiableSet(Completion.titles(titles, seen, actual, required));
            Map<String, Set<String>> flags = new HashMap<>(); for (Map.Entry<String, Map<String, Long>> entry : seen.entrySet()) flags.put(entry.getKey(), new HashSet<>(entry.getValue().keySet()));
            homeSeen = flags; Set<String> started = new HashSet<>(seen.keySet());
            for (History h : history) if (h.currentTime > 0) started.add(h.mediaId);
            started.removeAll(completed); progressing = started; completedProfile = profileId;
        }
        return out;
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
        String mode = profileMode();
        for (String id : c.mediaIds) { Media m = index.get(id); if (m != null && Logic.canWatch(m.audience, m.genres, mode)) items.add(m); }
        return items;
    }

    // ------------------------------------------------------------ Accueil : carrousel, bannières, ajouts du jour

    /** Titres du carrousel choisis dans l'admin (site_settings « home_hero »), comme lib/home-hero.ts. */
    public List<String> heroEntries() throws IOException {
        JSONArray rows = api.select("site_settings", new Q().select("value").eq("key", "home_hero").limit(1));
        JSONObject row = rows.optJSONObject(0);
        JSONObject value = row == null ? null : row.optJSONObject("value");
        if (value == null && row != null) value = Api.parseObject(row.optString("value", ""));
        String mode = value == null ? "latest" : value.optString("mode", "latest");
        List<String> ids = new ArrayList<>();
        if ("custom".equals(mode)) {
            JSONArray list = value.optJSONArray("media_ids");
            if (list != null) for (int i = 0; i < list.length() && ids.size() < 5; i++) { String v = list.optString(i, ""); if (!v.isEmpty()) ids.add(v); }
        } else if ("top".equals(mode)) {
            int days = value.optInt("days", 30);
            JSONObject args = new JSONObject();
            try { args.put("days", days); args.put("max_items", 5); } catch (Exception ignored) { }
            Object top = api.rpc("top_watched_media", args);
            if (top instanceof JSONArray) for (int i = 0; i < ((JSONArray) top).length(); i++) {
                JSONObject o = ((JSONArray) top).optJSONObject(i);
                if (o != null) ids.add(Models.str(o, "media_id"));
            }
        }
        return ids;
    }

    /** Bannières actives de l'admin (titre, sous-titre, titres, saisons mises en avant, top numéroté). */
    public List<Models.Banner> banners() throws IOException {
        JSONArray rows = api.select("banners", new Q().select("*").eq("active", "true").order("created_at.desc"));
        List<Models.Banner> list = new ArrayList<>();
        for (int i = 0; i < rows.length(); i++) { JSONObject o = rows.optJSONObject(i); if (o != null) list.add(Models.Banner.from(o)); }
        return list;
    }

    /** Saisons des séries mises en avant par saison (« id:sN »), pour leur affiche et leur ouverture. */
    public Map<String, JSONArray> seasonsOf(java.util.Collection<String> ids) throws IOException {
        Map<String, JSONArray> map = new HashMap<>();
        if (ids.isEmpty()) return map;
        JSONArray rows = api.select("media", new Q().select("id,seasons").in("id", ids));
        for (int i = 0; i < rows.length(); i++) {
            JSONObject o = rows.optJSONObject(i);
            if (o != null && o.optJSONArray("seasons") != null) map.put(Models.str(o, "id"), o.optJSONArray("seasons"));
        }
        return map;
    }

    /** Titres ajoutés aujourd'hui (minuit, heure de Paris), comme lib/daily-additions.ts. */
    public List<Media> dailyAdditions() throws IOException {
        String today = java.time.LocalDate.now(Logic.PARIS).atStartOfDay(Logic.PARIS).toInstant().toString();
        JSONArray rows = api.select("media", new Q().select(CARD_COLUMNS).raw("created_at", "gte." + today).order("created_at.desc,id.desc").limit(60));
        return parse(rows);
    }

    // ------------------------------------------------------------ Avatars (lib/avatars.ts)

    /** Avatars ajoutés par l'admin, regroupés par catégorie après ceux d'origine. */
    public Map<String, List<String[]>> avatarCategories() {
        Map<String, List<String[]>> groups = new java.util.LinkedHashMap<>();
        for (String[][] group : Logic.DEFAULT_AVATARS) {
            List<String[]> list = new ArrayList<>();
            for (int i = 1; i < group.length; i++) list.add(group[i]);
            groups.put(group[0][0], list);
        }
        try {
            JSONArray rows = api.select("profile_avatars", new Q().select("id,name,category,image_url").order("category.asc,name.asc"));
            for (int i = 0; i < rows.length(); i++) {
                JSONObject o = rows.optJSONObject(i);
                if (o == null) continue;
                String cat = Models.str(o, "category"), url = Models.str(o, "image_url");
                if (url.isEmpty()) continue;
                List<String[]> list = groups.get(cat);
                if (list == null) groups.put(cat, list = new ArrayList<>());
                list.add(new String[]{Models.str(o, "name"), url});
            }
        } catch (Exception ignored) {
            // Bibliothèque non installée : les avatars d'origine restent disponibles.
        }
        return groups;
    }

    // ------------------------------------------------------------ Lecture (app/api/playback, app/api/episode-credits)

    /** Réponse de /api/playback : flux HLS (via le proxy du site), pistes audio, sources possibles. */
    public static final class Stream {
        public String url, embed, provider; public int height;
        public final List<String[]> audioTracks = new ArrayList<>(); // {id, name, lang}
        public final List<String[]> alternatives = new ArrayList<>(); // {embed, provider, height}
        public final List<String> attempted = new ArrayList<>();
        public boolean hasMore;
        public String error;
    }

    /**
     * Demande au site un flux lisible pour une source (Moviez, catalogue-player, EmbedOrigin).
     * `excluded` : sources déjà essayées ; `selected` : source choisie à la main.
     */
    public Stream playback(String source, List<String> excluded, String selected) throws IOException {
        Api.Session s = api.requireSession();
        JSONObject body = new JSONObject();
        try {
            body.put("url", source);
            body.put("excluded", new JSONArray(excluded == null ? new ArrayList<String>() : excluded));
            if (selected != null && !selected.isEmpty()) body.put("selected", selected);
        } catch (Exception ignored) { }
        Map<String, String> h = new LinkedHashMap<>();
        h.put("Authorization", "Bearer " + s.accessToken);
        Api.Result r = Api.http("POST", Api.SITE + "api/playback", body.toString(), h, 35000);
        JSONObject data = Api.parseObject(r.body);
        Stream st = new Stream();
        if (data == null) { st.error = "Le flux vidéo est indisponible. Réessaie dans un instant."; return st; }
        if (r.status == 401) throw new Api.AuthExpired();
        JSONArray attempted = data.optJSONArray("attempted");
        if (attempted != null) for (int i = 0; i < attempted.length(); i++) { String v = attempted.optString(i, ""); if (!v.isEmpty()) st.attempted.add(v); }
        st.hasMore = data.optBoolean("hasMore", false);
        if (r.status >= 400 || data.optString("url", "").isEmpty()) {
            st.error = data.optString("error", "Le flux vidéo est indisponible ou ne correspond pas au contenu.");
            return st;
        }
        String url = data.optString("url");
        st.url = url.startsWith("http") ? url : Api.SITE + (url.startsWith("/") ? url.substring(1) : url);
        st.embed = data.optString("embed", "");
        st.provider = data.optString("provider", "");
        JSONObject q = data.optJSONObject("quality");
        st.height = q == null ? 0 : q.optInt("height", 0);
        JSONArray tracks = data.optJSONArray("audioTracks");
        if (tracks != null) for (int i = 0; i < tracks.length(); i++) {
            JSONObject t = tracks.optJSONObject(i);
            if (t != null) st.audioTracks.add(new String[]{String.valueOf(t.optInt("id", i)), t.optString("name", ""), t.optString("lang", "")});
        }
        JSONArray alts = data.optJSONArray("alternatives");
        if (alts != null) for (int i = 0; i < alts.length(); i++) {
            JSONObject a = alts.optJSONObject(i);
            if (a == null || a.optString("embed", "").isEmpty()) continue;
            JSONObject aq = a.optJSONObject("quality");
            st.alternatives.add(new String[]{a.optString("embed"), a.optString("provider", ""), String.valueOf(aq == null ? 0 : aq.optInt("height", 0))});
        }
        return st;
    }

    /** Début du générique de fin d'un épisode (secondes), ou -1. Ne bloque jamais la lecture. */
    public double creditsStart(Media media, int season, int episode, double duration) {
        try {
            Models.Season se = media.seasons.get(season);
            Models.Episode ep = se.episodes.get(episode);
            StringBuilder q = new StringBuilder("api/episode-credits?media=").append(Api.enc(media.id));
            String tmdb = Logic.normalizeTmdbId(media.tmdbId);
            if (!tmdb.isEmpty()) q.append("&tmdb=").append(tmdb);
            q.append("&season=").append(se.number > 0 ? se.number : season + 1).append("&episode=").append(ep.number > 0 ? ep.number : episode + 1)
                    .append("&duration=").append(Math.round(duration));
            Api.Result r = Api.http("GET", Api.SITE + q, null, null, 20000);
            JSONObject data = Api.parseObject(r.body);
            JSONObject marker = data == null ? null : data.optJSONObject("marker");
            if (marker == null) return -1;
            double start = marker.optDouble("start", -1);
            return start >= 0 && start < duration ? start : -1;
        } catch (Exception e) { return -1; }
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
