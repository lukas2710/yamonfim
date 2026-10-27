package com.yamonfilm.tv;

import java.net.URI;
import java.text.Normalizer;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Règles métier du site, portées à l'identique (sans dépendance Android pour les tests). */
public final class Logic {
    public static long seekStep(int repeat) { return repeat < 6 ? 10000L : repeat < 16 ? 30000L : 60000L; }
    public static long seekTarget(long base, long delta, long duration) {
        long target = base + delta;
        return Math.max(0, duration > 0 ? Math.min(Math.max(0, duration - 1000), target) : target);
    }
    private Logic() { }

    public static final int FREE_WATCH_LIMIT = 5;
    public static final long SEEN_DELAY_MS = 5000;
    public static final ZoneId PARIS = ZoneId.of("Europe/Paris");

    // ------------------------------------------------------------ Recherche (lib/search.ts)

    private static final Pattern COMBINING = Pattern.compile("[\\u0300-\\u036f]");
    private static final Pattern NON_WORD = Pattern.compile("[^\\p{L}\\p{N}]+");
    private static final Set<String> STOP = new HashSet<>(Arrays.asList("le", "la", "les", "l", "de", "des", "du", "un", "une", "the", "et", "and"));

    public static String normalizeSearch(String value) {
        if (value == null) return "";
        String s = Normalizer.normalize(value, Normalizer.Form.NFKD);
        s = COMBINING.matcher(s).replaceAll("").toLowerCase(Locale.ROOT).replace("œ", "oe").replace("æ", "ae");
        return NON_WORD.matcher(s).replaceAll(" ").trim();
    }

    static String singular(String word) { return word.length() > 3 && !word.endsWith("ss") && word.endsWith("s") ? word.substring(0, word.length() - 1) : word; }

    static boolean oneEdit(String a, String b) {
        if (Math.abs(a.length() - b.length()) > 1) return false;
        int i = 0, j = 0, edits = 0;
        while (i < a.length() && j < b.length()) {
            if (a.charAt(i) == b.charAt(j)) { i++; j++; continue; }
            if (++edits > 1) return false;
            if (a.length() >= b.length()) i++;
            if (b.length() >= a.length()) j++;
        }
        return edits + ((i < a.length() || j < b.length()) ? 1 : 0) <= 1;
    }

    /** Texte pré-normalisé d'un titre, calculé une seule fois pour une recherche fluide. */
    public static final class Indexed {
        public final String text; public final String[] words;
        public Indexed(String... values) {
            StringBuilder sb = new StringBuilder();
            for (String v : values) if (v != null && !v.isEmpty()) { if (sb.length() > 0) sb.append(' '); sb.append(v); }
            text = normalizeSearch(sb.toString());
            String[] raw = text.isEmpty() ? new String[0] : text.split(" ");
            words = new String[raw.length];
            for (int k = 0; k < raw.length; k++) words[k] = singular(raw[k]);
        }
    }

    public static final class SearchMatcher {
        private final String normalized; private final List<String> needles = new ArrayList<>();
        public SearchMatcher(String query) {
            normalized = normalizeSearch(query);
            List<String> all = new ArrayList<>(), meaningful = new ArrayList<>();
            if (!normalized.isEmpty()) for (String w : normalized.split(" ")) if (!w.isEmpty()) { all.add(w); if (!STOP.contains(w)) meaningful.add(w); }
            for (String w : meaningful.isEmpty() ? all : meaningful) needles.add(singular(w));
        }
        public boolean isEmpty() { return normalized.isEmpty(); }
        public boolean matches(Indexed item) {
            if (normalized.isEmpty()) return true;
            if (item.text.contains(normalized)) return true;
            for (String needle : needles) {
                boolean numeric = needle.matches("\\d+"), found = false;
                for (String word : item.words) {
                    if (word.equals(needle) || (!numeric && (word.contains(needle) || (needle.length() >= 5 && word.length() >= 5 && oneEdit(needle, word))))) { found = true; break; }
                }
                if (!found) return false;
            }
            return true;
        }
        public boolean matches(String... values) { return matches(new Indexed(values)); }
    }

    public static List<String> searchQueryVariants(String query) {
        String normalized = normalizeSearch(query);
        StringBuilder sing = new StringBuilder();
        if (!normalized.isEmpty()) for (String w : normalized.split(" ")) { if (sing.length() > 0) sing.append(' '); sing.append(singular(w)); }
        LinkedHashSet<String> set = new LinkedHashSet<>(Arrays.asList(query.trim(), normalized, sing.toString()));
        set.remove("");
        return new ArrayList<>(set);
    }

    // ------------------------------------------------------------ Quota (lib/watch-quota.ts)

    public static final class WatchAccess {
        public final boolean allowed, vip; public final int remaining;
        public WatchAccess(boolean allowed, boolean vip, int remaining) { this.allowed = allowed; this.vip = vip; this.remaining = remaining; }
    }
    public interface AccountReader { int[] read() throws Exception; } // {vip ? 1 : 0, count}
    public interface Incrementer { boolean increment(int expected) throws Exception; }

    /** Une mise à jour conditionnelle réserve une vision, même avec plusieurs appareils. */
    public static WatchAccess reserveViewing(AccountReader read, Incrementer increment) throws Exception {
        for (int attempt = 0; attempt < 4; attempt++) {
            int[] account = read.read();
            if (account[0] == 1) return new WatchAccess(true, true, -1);
            if (account[1] < 0) throw new IllegalStateException("Quota invalide");
            if (account[1] >= FREE_WATCH_LIMIT) return new WatchAccess(false, false, 0);
            if (increment.increment(account[1])) return new WatchAccess(true, false, FREE_WATCH_LIMIT - account[1] - 1);
        }
        throw new IllegalStateException("Le quota est en cours de modification. Réessaie.");
    }

    /** Dimanche suivant à 00 h, heure de Paris (app/abonnement/plans.ts). */
    public static long nextSundayReset(long nowMs) {
        LocalDate today = Instant.ofEpochMilli(nowMs).atZone(PARIS).toLocalDate();
        int dow = today.getDayOfWeek().getValue() % 7; // dimanche = 0
        return today.plusDays(7 - dow).atStartOfDay(PARIS).toInstant().toEpochMilli();
    }

    /** Fin d'un abonnement VIP selon les règles de l'admin VIP. -1 si inconnue. */
    public static long vipExpiration(String start, String duration) {
        if (start == null || start.isEmpty()) return -1;
        ZonedDateTime date;
        try { date = ZonedDateTime.parse(start.replace(" ", "T").replaceAll("\\+00$", "+00:00")); }
        catch (Exception e) { try { date = Instant.parse(start).atZone(PARIS); } catch (Exception e2) { return -1; } }
        if ("15d".equals(duration)) date = date.plusDays(15);
        else if ("3m".equals(duration)) date = date.plusMonths(3);
        else if ("1y".equals(duration)) date = date.plusYears(1);
        else return -1;
        return date.toInstant().toEpochMilli();
    }

    public static long parseTime(String iso) {
        if (iso == null || iso.isEmpty()) return -1;
        try { return ZonedDateTime.parse(iso.replace(" ", "T").replaceAll("\\+00$", "+00:00")).toInstant().toEpochMilli(); }
        catch (Exception e) { try { return Instant.parse(iso).toEpochMilli(); } catch (Exception e2) { return -1; } }
    }

    // ------------------------------------------------------------ Lecteur (lib/watch-progress.ts)

    private static final Pattern IFRAME_SRC = Pattern.compile("<iframe[^>]*?\\ssrc\\s*=\\s*([\"'])(.*?)\\1", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern DIRECT = Pattern.compile(".*\\.(mp4|webm|ogg|m4v|m3u8)$", Pattern.CASE_INSENSITIVE);

    /** Extrait la source d'un code iframe collé dans l'admin, sinon renvoie la valeur. */
    public static String cleanEmbed(String raw) {
        String clean = raw == null ? "" : raw.trim();
        if (clean.toLowerCase(Locale.ROOT).contains("<iframe")) {
            Matcher m = IFRAME_SRC.matcher(clean);
            clean = m.find() ? m.group(2).replace("&amp;", "&").trim() : "";
        }
        return clean;
    }

    public static boolean isDirectVideo(String value) {
        try {
            String path = URI.create(SITE_BASE).resolve(value.trim().replace(" ", "%20")).getPath();
            return path != null && DIRECT.matcher(path).matches();
        } catch (Exception e) { return false; }
    }

    static final String SITE_BASE = "https://yamonfi.netlify.app/";

    /** Prépare l'adresse du lecteur comme preparePlayerUrl(). Chaîne vide si invalide. */
    public static String preparePlayerUrl(String value) {
        if (value == null || value.trim().isEmpty()) return "";
        URI url;
        try { url = URI.create(SITE_BASE).resolve(value.trim().replace(" ", "%20")); } catch (Exception e) { return ""; }
        String scheme = url.getScheme() == null ? "" : url.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) return "";
        String href = url.toString();
        if (isDirectVideo(href)) return href;
        if ("api.moviez.ac".equalsIgnoreCase(url.getHost())) href = setParam(href, "next", "0");
        href = setParam(href, "autoplay", "1");
        href = setParam(href, "color", "e8213f");
        return href;
    }

    /** Équivalent de URLSearchParams.set : remplace la première occurrence, supprime les autres. */
    static String setParam(String href, String key, String value) {
        String fragment = "";
        int hash = href.indexOf('#');
        if (hash >= 0) { fragment = href.substring(hash); href = href.substring(0, hash); }
        int q = href.indexOf('?');
        String base = q >= 0 ? href.substring(0, q) : href, query = q >= 0 ? href.substring(q + 1) : "";
        List<String> parts = new ArrayList<>();
        boolean replaced = false;
        if (!query.isEmpty()) for (String part : query.split("&")) {
            if (part.isEmpty()) continue;
            String name = part.contains("=") ? part.substring(0, part.indexOf('=')) : part;
            if (name.equals(key)) { if (!replaced) { parts.add(key + "=" + value); replaced = true; } }
            else parts.add(part);
        }
        if (!replaced) parts.add(key + "=" + value);
        StringBuilder sb = new StringBuilder(base).append('?');
        for (int i = 0; i < parts.size(); i++) { if (i > 0) sb.append('&'); sb.append(parts.get(i)); }
        return sb.append(fragment).toString();
    }

    public static boolean isCompleted(double currentTime, double duration) { return duration > 0 && currentTime / duration >= .95; }

    public static boolean isMoviezPlayer(String value) {
        try { URI uri = URI.create(value); return "https".equals(uri.getScheme()) && "api.moviez.ac".equalsIgnoreCase(uri.getHost()); }
        catch (Exception ignored) { return false; }
    }

    public static final class PlayerSource {
        public final String id; public final int season, episode;
        PlayerSource(String id, int season, int episode) { this.id = id; this.season = season; this.episode = episode; }
    }

    /** New catalogue references are identities, not web pages to load. */
    public static PlayerSource playerSource(String value) {
        try {
            URI uri = URI.create(SITE_BASE).resolve(cleanEmbed(value));
            if (!"https".equals(uri.getScheme()) || uri.getUserInfo() != null || uri.getPort() != -1) return null;
            if ("api.moviez.ac".equalsIgnoreCase(uri.getHost())) {
                Matcher series = Pattern.compile("^/serie/([1-9][0-9]{0,9})/([1-9][0-9]{0,3})/([1-9][0-9]{0,4})/?$").matcher(uri.getPath());
                if (series.matches()) return new PlayerSource(series.group(1), Integer.parseInt(series.group(2)), Integer.parseInt(series.group(3)));
                Matcher movie = Pattern.compile("^/([1-9][0-9]{0,9})/?$").matcher(uri.getPath());
                if (movie.matches()) return new PlayerSource(movie.group(1), 0, 0);
            }
            if ("yamonfi.netlify.app".equalsIgnoreCase(uri.getHost()) && "/api/catalogue-player".equals(uri.getPath())) {
                java.util.Map<String,String> params = new java.util.HashMap<>();
                if (uri.getRawQuery() != null) for (String part : uri.getRawQuery().split("&")) { String[] pair = part.split("=", 2); if (pair.length == 2) params.put(pair[0], java.net.URLDecoder.decode(pair[1], "UTF-8")); }
                String id = params.get("tmdb"), type = params.get("type");
                if (id == null || !id.matches("[1-9][0-9]{0,9}")) return null;
                if ("movie".equals(type)) return new PlayerSource(id, 0, 0);
                if ("tv".equals(type)) {
                    int s = Integer.parseInt(params.containsKey("season") ? params.get("season") : "1"), e = Integer.parseInt(params.containsKey("episode") ? params.get("episode") : "1");
                    if (s > 0 && s <= 1000 && e > 0 && e <= 10000) return new PlayerSource(id, s, e);
                }
            }
        } catch (Exception ignored) { }
        return null;
    }

    public static boolean isResolvedPlayer(String value) {
        if (playerSource(value) != null) return true;
        try { URI uri = URI.create(value); return "https".equals(uri.getScheme()) && "embedorigin.cc".equalsIgnoreCase(uri.getHost()) && uri.getPort() == -1 && uri.getUserInfo() == null && uri.getPath().matches("/e/[a-z0-9]{12}/?"); }
        catch (Exception ignored) { return false; }
    }

    public static final class AutoNext {
        private boolean cancelled;
        private long creditsStart = -1, creditsDuration = -1;
        public int remaining = -1;
        public void reset() { cancelled = false; remaining = -1; creditsStart = creditsDuration = -1; }
        public boolean active() { return remaining >= 0; }
        public void marker(long startMs, long durationMs) { creditsStart = startMs; creditsDuration = durationMs; }
        public boolean update(long positionMs, long durationMs, boolean playing, boolean hasNext) {
            if (cancelled || !hasNext || durationMs < 60000 || positionMs < 0 || positionMs > durationMs) { remaining = -1; return false; }
            boolean validMarker = creditsStart >= 0 && creditsStart < durationMs && Math.abs(creditsDuration - durationMs) <= 2000;
            long target = validMarker ? Math.min(creditsStart + 5000, durationMs) : durationMs - 30000;
            long left = target - positionMs;
            remaining = left > 0 && left <= 5000 ? (int) ((left + 999) / 1000) : left <= 0 ? 0 : -1;
            return playing && left <= 0;
        }
        public void ended(boolean hasNext) { if (!cancelled && hasNext) remaining = 0; }
        public void cancel() { cancelled = true; remaining = -1; }
    }

    public static String epKey(int s, int e) { return "s" + s + "_e" + e; }

    private static final Pattern TMDB_SIZE = Pattern.compile("^(https://image\\.tmdb\\.org/t/p/)(?:original|w\\d+)/");
    /** Taille d'image TMDB adaptée à l'écran. */
    public static String tmdbSize(String url, String width) {
        if (url == null) return "";
        return TMDB_SIZE.matcher(url).replaceFirst("$1" + width + "/");
    }

    // ------------------------------------------------------------ Doublons (lib/content-identity.ts)

    private static final Pattern YEAR_SUFFIX = Pattern.compile("\\s*\\((?:18|19|20|21)\\d{2}\\)\\s*$");

    public static String normalizeContentTitle(String value) {
        String s = YEAR_SUFFIX.matcher(value == null ? "" : value.trim()).replaceAll("");
        s = Normalizer.normalize(s, Normalizer.Form.NFKD);
        s = COMBINING.matcher(s).replaceAll("").toLowerCase(Locale.ROOT).replace("œ", "oe").replace("æ", "ae");
        return NON_WORD.matcher(s).replaceAll(" ").trim();
    }

    public static String normalizeTmdbId(String value) {
        String text = value == null ? "" : value.trim();
        if (!text.matches("\\d+")) return "";
        String stripped = text.replaceFirst("^0+", "");
        return stripped.isEmpty() ? "" : stripped;
    }

    public static boolean sameContent(String typeA, String tmdbA, String titleA, String typeB, String tmdbB, String titleB) {
        if (typeA == null || typeA.isEmpty() || !typeA.equals(typeB)) return false;
        String a = normalizeTmdbId(tmdbA), b = normalizeTmdbId(tmdbB);
        if (!a.isEmpty() && !b.isEmpty()) return a.equals(b);
        String title = normalizeContentTitle(titleA);
        return !title.isEmpty() && title.equals(normalizeContentTitle(titleB));
    }

    // ------------------------------------------------------------ Divers

    public static String formatTime(long seconds) {
        if (seconds < 0) seconds = 0;
        long h = seconds / 3600, m = (seconds / 60) % 60, s = seconds % 60;
        return h > 0 ? String.format(Locale.ROOT, "%d:%02d:%02d", h, m, s) : String.format(Locale.ROOT, "%d:%02d", m, s);
    }

    public static String countdown(long ms) {
        long s = Math.max(0, (ms + 999) / 1000);
        long d = s / 86400, h = (s / 3600) % 24, m = (s / 60) % 60, sec = s % 60;
        return d > 0 ? String.format(Locale.ROOT, "%d j %02d h %02d min %02d s", d, h, m, sec)
                : String.format(Locale.ROOT, "%02d h %02d min %02d s", h, m, sec);
    }

    public static String parisDate(long ms) {
        ZonedDateTime z = Instant.ofEpochMilli(ms).atZone(PARIS);
        String[] days = {"lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"};
        String[] months = {"janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"};
        return String.format(Locale.FRANCE, "%s %d %s à %02d:%02d", days[z.getDayOfWeek().getValue() - 1], z.getDayOfMonth(), months[z.getMonthValue() - 1], z.getHour(), z.getMinute());
    }

    public static String parisDay(long ms) { return Instant.ofEpochMilli(ms).atZone(PARIS).toLocalDate().toString(); }

    public static boolean isSunday(DayOfWeek d) { return d == DayOfWeek.SUNDAY; }
}
