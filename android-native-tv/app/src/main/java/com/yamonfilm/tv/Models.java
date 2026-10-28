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

    public static final class Media {
        public String id, title, type, poster, backdrop, description, tmdbId, url, embedUrl;
        public List<String> genres = Collections.emptyList();
        public int runtime;
        public String audience = "standard"; public int releaseYear;
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
            m.audience = o.optString("audience", "standard"); m.releaseYear = o.optInt("release_year", Logic.releaseYear(m.title));
            m.runtime = o.optInt("runtime", 0);
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
                o.put("genres", new JSONArray(genres)); o.put("audience", audience); o.put("release_year", releaseYear);
            } catch (Exception ignored) { }
            return o;
        }

        public boolean isSeries() { return "series".equals(type); }
        public boolean hasEpisodes() { return isSeries() && !seasons.isEmpty(); }
        public String image() { return !backdrop.trim().isEmpty() ? backdrop : poster; }
        public Logic.Indexed index() {
            if (index == null) {
                String[] values = new String[genres.size() + 2];
                values[0] = title; values[1] = description;
                for (int i = 0; i < genres.size(); i++) values[i + 2] = genres.get(i);
                index = new Logic.Indexed(values);
            }
            return index;
        }
        public Episode episode(int s, int e) {
            if (s < 0 || s >= seasons.size()) return null;
            List<Episode> eps = seasons.get(s).episodes;
            return e < 0 || e >= eps.size() ? null : eps.get(e);
        }
        public int totalEpisodes() { int n = 0; for (Season s : seasons) n += s.episodes.size(); return n; }

        /** Adresse du lecteur pour un épisode (ou le film), comme getCleanEmbedUrl(). */
        public String playerUrl(int s, int e) {
            Episode ep = episode(s, e);
            String raw = ep != null && !ep.embedUrl.trim().isEmpty() ? ep.embedUrl : !embedUrl.trim().isEmpty() ? embedUrl : url;
            String clean = Logic.cleanEmbed(raw);
            if (clean.isEmpty() && !isSeries() && !Logic.normalizeTmdbId(tmdbId).isEmpty()) clean = "https://api.moviez.ac/" + Logic.normalizeTmdbId(tmdbId);
            if (clean.isEmpty() && isSeries() && ep != null && !Logic.normalizeTmdbId(tmdbId).isEmpty()) clean = "https://api.moviez.ac/serie/" + Logic.normalizeTmdbId(tmdbId) + "/" + seasons.get(s).number + "/" + ep.number;
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
        public String id, name, avatar; public String mode = "standard";
        static Profile from(JSONObject o) { Profile p = new Profile(); p.id = str(o, "id"); p.name = str(o, "name"); p.avatar = str(o, "avatar_url"); p.mode = o.optString("profile_mode", "standard"); return p; }
        public JSONObject toJson() {
            JSONObject o = new JSONObject();
            try { o.put("id", id); o.put("name", name); o.put("avatar_url", avatar); o.put("profile_mode", mode); } catch (Exception ignored) { }
            return o;
        }
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
