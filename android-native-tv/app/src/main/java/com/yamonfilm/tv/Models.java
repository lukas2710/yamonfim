package com.yamonfilm.tv;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Données lues dans Supabase (mêmes colonnes que le site). */
public final class Models {
    private Models() { }

    static String str(JSONObject o, String key) {
        if (o == null || o.isNull(key)) return "";
        Object v = o.opt(key);
        return v == null ? "" : String.valueOf(v);
    }

    public static final class Episode {
        public int number; public String title, embedUrl, still; public int runtime;
        static Episode from(JSONObject o, int index) {
            Episode e = new Episode();
            e.number = o.optInt("number", index + 1);
            e.title = str(o, "title");
            e.embedUrl = str(o, "embedUrl");
            e.still = str(o, "still_path");
            e.runtime = o.optInt("runtime", 0);
            return e;
        }
        public String label() { return title.isEmpty() ? "Épisode " + number : title; }
    }

    public static final class Season {
        public int number; public String poster; public final List<Episode> episodes = new ArrayList<>();
        static Season from(JSONObject o, int index) {
            Season s = new Season();
            s.number = o.optInt("seasonNumber", index + 1);
            s.poster = str(o, "poster_path");
            JSONArray eps = o.optJSONArray("episodes");
            if (eps != null) for (int i = 0; i < eps.length(); i++) { JSONObject e = eps.optJSONObject(i); if (e != null) s.episodes.add(Episode.from(e, i)); }
            return s;
        }
    }

    public static final class Media implements Discovery.Title {
        public String id, title, type, poster, backdrop, description, tmdbId, url, embedUrl;
        public List<String> genres = Collections.emptyList();
        public int runtime, year = -1;
        /** Public du titre : standard, kids ou junior (profils Kids et Junior). */
        public String audience = "standard";
        public List<Season> seasons = Collections.emptyList();
        public boolean full;
        private Logic.Indexed index;

        public static Media from(JSONObject o) {
            Media m = new Media();
            m.id = str(o, "id");
            m.title = str(o, "title");
            m.type = "series".equals(str(o, "type")) ? "series" : "movie";
            m.poster = str(o, "poster");
            m.backdrop = str(o, "backdrop");
            m.description = str(o, "description");
            m.tmdbId = str(o, "tmdb_id");
            m.url = str(o, "url");
            m.embedUrl = str(o, "embedUrl");
            m.runtime = o.optInt("runtime", 0);
            String audience = str(o, "audience");
            m.audience = audience.isEmpty() ? "standard" : audience;
            m.year = Logic.releaseYear(o.optInt("release_year", -1), m.title);
            JSONArray g = o.optJSONArray("genres");
            if (g != null) { m.genres = new ArrayList<>(); for (int i = 0; i < g.length(); i++) { String v = g.optString(i, "").trim(); if (!v.isEmpty()) m.genres.add(v); } }
            JSONArray s = o.optJSONArray("seasons");
            if (s != null) { m.seasons = new ArrayList<>(); for (int i = 0; i < s.length(); i++) { JSONObject so = s.optJSONObject(i); if (so != null) m.seasons.add(Season.from(so, i)); } }
            m.full = o.has("seasons") || o.has("url");
            return m;
        }

        public JSONObject toCardJson() {
            JSONObject o = new JSONObject();
            try {
                o.put("id", id); o.put("title", title); o.put("type", type); o.put("poster", poster);
                o.put("backdrop", backdrop); o.put("description", description); o.put("tmdb_id", tmdbId);
                o.put("genres", new JSONArray(genres));
                o.put("audience", audience);
                if (year > 0) o.put("release_year", year);
            } catch (Exception ignored) { }
            return o;
        }

        public boolean isSeries() { return "series".equals(type); }
        public String id() { return id; }
        public String title() { return title; }
        public String type() { return type; }
        public String tmdbId() { return tmdbId; }
        public String description() { return description; }
        public List<String> genres() { return genres; }
        public boolean in(String category) { return Logic.inCategory(type, genres, title, category); }
        public boolean hasEpisodes() { return isSeries() && !seasons.isEmpty(); }
        public String image() { return !backdrop.trim().isEmpty() ? backdrop : poster; }
        public Logic.Indexed index() {
            if (index == null) {
                String[] extra = new String[genres.size() + 1];
                extra[0] = description;
                for (int i = 0; i < genres.size(); i++) extra[i + 1] = genres.get(i);
                index = new Logic.Indexed(title, extra);
            }
            return index;
        }
        public Episode episode(int s, int e) {
            if (s < 0 || s >= seasons.size()) return null;
            List<Episode> eps = seasons.get(s).episodes;
            return e < 0 || e >= eps.size() ? null : eps.get(e);
        }
        public int totalEpisodes() { int n = 0; for (Season s : seasons) n += s.episodes.size(); return n; }

        /** Source brute (Moviez, catalogue-player, EmbedOrigin…) d'un épisode ou du film. */
        public String rawSource(int s, int e) {
            Episode ep = episode(s, e);
            String raw = ep != null && !ep.embedUrl.trim().isEmpty() ? ep.embedUrl : !embedUrl.trim().isEmpty() ? embedUrl : url;
            String clean = Logic.cleanEmbed(raw);
            if (clean.isEmpty() && !isSeries()) clean = "https://api.moviez.ac/" + id;
            return clean;
        }

        /** Adresse du lecteur pour un épisode (ou le film), comme getCleanEmbedUrl(). */
        public String playerUrl(int s, int e) {
            Episode ep = episode(s, e);
            String raw = ep != null && !ep.embedUrl.trim().isEmpty() ? ep.embedUrl : !embedUrl.trim().isEmpty() ? embedUrl : url;
            String clean = Logic.cleanEmbed(raw);
            if (clean.isEmpty() && !isSeries()) clean = "https://api.moviez.ac/" + id;
            return Logic.preparePlayerUrl(clean);
        }

        public int[] next(int s, int e) {
            if (s < 0 || s >= seasons.size()) return null;
            if (e < seasons.get(s).episodes.size() - 1) return new int[]{s, e + 1};
            for (int k = s + 1; k < seasons.size(); k++) if (!seasons.get(k).episodes.isEmpty()) return new int[]{k, 0};
            return null;
        }
        public int[] previous(int s, int e) {
            if (s < 0 || s >= seasons.size()) return null;
            if (e > 0) return new int[]{s, e - 1};
            for (int k = s - 1; k >= 0; k--) if (!seasons.get(k).episodes.isEmpty()) return new int[]{k, seasons.get(k).episodes.size() - 1};
            return null;
        }
    }

    public static final class History {
        public String mediaId, type; public int seasonIdx, episodeIdx, seasonNumber, episodeNumber; public long currentTime, duration; public String updatedAt;
        static History from(JSONObject o) {
            History h = new History();
            h.mediaId = str(o, "media_id");
            h.type = str(o, "type");
            h.seasonIdx = Math.max(0, o.optInt("season_idx", 0));
            h.episodeIdx = Math.max(0, o.optInt("episode_idx", 0));
            h.seasonNumber = o.optInt("season_number", h.seasonIdx + 1);
            h.episodeNumber = o.optInt("episode_number", h.episodeIdx + 1);
            h.currentTime = Math.max(0, o.optLong("current_time", 0));
            h.duration = Math.max(0, o.optLong("duration", 0));
            h.updatedAt = str(o, "updated_at");
            return h;
        }
        public float fraction() { return duration > 0 ? Math.min(1f, currentTime / (float) duration) : 0f; }
    }

    public static final class Profile {
        public String id, name, avatar, mode = "standard";
        static Profile from(JSONObject o) {
            Profile p = new Profile(); p.id = str(o, "id"); p.name = str(o, "name"); p.avatar = str(o, "avatar_url");
            String m = str(o, "profile_mode"); p.mode = m.isEmpty() ? "standard" : m;
            return p;
        }
        public JSONObject toJson() {
            JSONObject o = new JSONObject();
            try { o.put("id", id); o.put("name", name); o.put("avatar_url", avatar); o.put("profile_mode", mode); } catch (Exception ignored) { }
            return o;
        }
        public boolean isKids() { return mode != null && !mode.isEmpty() && !"standard".equals(mode); }
        public String modeLabel() { return "kids".equals(mode) ? "Kids" : "junior".equals(mode) ? "Junior" : ""; }
        public boolean imageAvatar() { return avatar != null && avatar.startsWith("http"); }
        public String initial() {
            if (avatar != null && !avatar.isEmpty() && !imageAvatar()) return avatar;
            return name == null || name.isEmpty() ? "?" : name.substring(0, 1).toUpperCase();
        }
    }

    public static final class Collection {
        public String id, title, description, cover; public final List<String> mediaIds = new ArrayList<>();
        static Collection from(JSONObject o) {
            Collection c = new Collection();
            c.id = str(o, "id"); c.title = str(o, "title"); c.description = str(o, "description"); c.cover = str(o, "cover_url");
            JSONArray ids = o.optJSONArray("media_ids");
            if (ids != null) for (int i = 0; i < ids.length(); i++) { String v = ids.optString(i, ""); if (!v.isEmpty() && !c.mediaIds.contains(v)) c.mediaIds.add(v); }
            return c;
        }
        /** Lien de couverture accepté seulement en http(s), comme safeCollectionImage(). */
        public String safeCover() { String v = cover == null ? "" : cover.trim(); return v.startsWith("https://") || v.startsWith("http://") ? v : ""; }
    }

    /** Bannière de l'accueil gérée dans l'admin : un titre par entrée « id » ou « id:sN » (saison). */
    public static final class Banner {
        public String id, title, subtitle, backdrop; public boolean ranked;
        public final List<String> entries = new ArrayList<>();
        static Banner from(JSONObject o) {
            Banner b = new Banner();
            b.id = str(o, "id"); b.title = str(o, "title"); b.subtitle = str(o, "subtitle"); b.backdrop = str(o, "backdrop");
            b.ranked = o.optBoolean("ranked", false);
            JSONArray ids = o.optJSONArray("media_ids");
            if (ids != null) for (int i = 0; i < ids.length(); i++) { String v = ids.optString(i, ""); if (!v.isEmpty()) b.entries.add(v); }
            return b;
        }
        /** « 156:s3 » → {"156", "3"} ; « 156 » → {"156", null}. */
        public static String[] parse(String entry) {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("^(.+):s(\\d+)$").matcher(entry);
            return m.find() ? new String[]{m.group(1), m.group(2)} : new String[]{entry, null};
        }
    }

    public static final class Channel {
        public String name, logo, category, url;
    }

    public static final class Request {
        public String id, title, type, tmdbId, poster, status, userId, createdAt;
        static Request from(JSONObject o) {
            Request r = new Request();
            r.id = str(o, "id"); r.title = str(o, "title"); r.type = str(o, "type"); r.tmdbId = str(o, "tmdb_id");
            r.poster = str(o, "poster"); r.status = str(o, "status"); r.userId = str(o, "user_id"); r.createdAt = str(o, "created_at");
            return r;
        }
        public String statusLabel() {
            switch (status == null ? "" : status) {
                case "en_cours": return "En cours de traitement";
                case "ajoute": return "Ajouté au catalogue";
                case "refuse": return "Non disponible";
                default: return "En attente";
            }
        }
    }

    public static final class TmdbResult {
        public String id, title, year, poster, overview;
    }

    public static final class Subscription {
        public boolean vip, resetVerified; public int count; public long resetAt = -1, vipEnd = -1;
    }
}
