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
    private Logic() { }

    public static final int FREE_WATCH_LIMIT = 5;
    public static final long SEEN_DELAY_MS = 5000;
    public static final ZoneId PARIS = ZoneId.of("Europe/Paris");

    // ------------------------------------------------------------ Recherche (lib/search.ts)

    private static final Pattern COMBINING = Pattern.compile("[\\u0300-\\u036f]");
    private static final Pattern NON_WORD = Pattern.compile("[^\\p{L}\\p{N}]+");
    private static final Set<String> STOP = new HashSet<>(Arrays.asList("le", "la", "les", "l", "de", "des", "du", "un", "une", "the", "et", "and", "a", "of"));

    public static String normalizeSearch(String value) {
        if (value == null) return "";
        String s = Normalizer.normalize(value, Normalizer.Form.NFKD);
        s = COMBINING.matcher(s).replaceAll("").toLowerCase(Locale.ROOT).replace("œ", "oe").replace("æ", "ae");
        return NON_WORD.matcher(s).replaceAll(" ").trim();
    }

    static String singular(String word) { return word.length() > 3 && !word.endsWith("ss") && word.endsWith("s") ? word.substring(0, word.length() - 1) : word; }

    /** Distance d'édition (transpositions comprises), arrêtée dès qu'elle dépasse max. */
    static int editDistance(String a, String b, int max) {
        if (Math.abs(a.length() - b.length()) > max) return max + 1;
        int[] prev2 = new int[b.length() + 1], prev = new int[b.length() + 1], row = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) prev[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            row[0] = i; int best = i;
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                int d = Math.min(Math.min(prev[j] + 1, row[j - 1] + 1), prev[j - 1] + cost);
                if (i > 1 && j > 1 && a.charAt(i - 1) == b.charAt(j - 2) && a.charAt(i - 2) == b.charAt(j - 1)) d = Math.min(d, prev2[j - 2] + 1);
                row[j] = d; if (d < best) best = d;
            }
            if (best > max) return max + 1;
            int[] t = prev2; prev2 = prev; prev = row; row = t;
        }
        return prev[b.length()];
    }

    private static int allowedEdits(String needle) { return needle.length() >= 8 ? 2 : needle.length() >= 5 ? 1 : 0; }

    private static boolean isDigits(String value) {
        if (value.isEmpty()) return false;
        for (int i = 0; i < value.length(); i++) if (value.charAt(i) < '0' || value.charAt(i) > '9') return false;
        return true;
    }

    /** Qualité d'un mot, en demi-points : 8 identique, 6 début, 4 à l'intérieur, 3 ou 2 pour une ou deux fautes, 0 aucun. */
    static int wordMatch(String needle, String word, boolean loose) {
        if (word.equals(needle)) return 8;
        if (isDigits(needle)) return 0;
        if (word.startsWith(needle)) return 6;
        if (!loose) return 0;
        if (needle.length() >= 3 && word.contains(needle)) return 4;
        int edits = allowedEdits(needle);
        // Une faute touche rarement les deux premières lettres : on saute ces mots pour une saisie fluide.
        if (edits == 0 || (word.charAt(0) != needle.charAt(0) && (word.length() < 2 || needle.length() < 2 || word.charAt(1) != needle.charAt(1)))) return 0;
        // Mot en cours de saisie : on compare aussi avec le début d'un mot plus long.
        int d = editDistance(needle, word, edits);
        if (d > edits && word.length() > needle.length()) d = editDistance(needle, word.substring(0, needle.length()), edits);
        return d > edits ? 0 : d == 1 ? 3 : 2;
    }

    private static int bestMatch(String needle, String[] list, boolean loose) {
        int best = 0;
        for (String word : list) { int m = wordMatch(needle, word, loose); if (m > best) best = m; if (best == 8) break; }
        return best;
    }

    private static String[] words(String text) {
        String[] raw = text.isEmpty() ? new String[0] : text.split(" ");
        for (int k = 0; k < raw.length; k++) raw[k] = singular(raw[k]);
        return raw;
    }

    /** Texte pré-normalisé d'un titre (et de son résumé, ses genres), calculé une seule fois pour une recherche fluide. */
    public static final class Indexed {
        public final String title, base, compact; public final String[] titleWords, extraWords;
        public Indexed(String title, String... extra) {
            this.title = normalizeSearch(title);
            // « Dune (2021) » reste le titre exact « Dune ».
            base = this.title.replaceFirst(" (18|19|20)\\d\\d$", "");
            compact = this.title.replace(" ", "");
            titleWords = words(this.title);
            StringBuilder sb = new StringBuilder();
            for (String v : extra) if (v != null && !v.isEmpty()) { if (sb.length() > 0) sb.append(' '); sb.append(v); }
            extraWords = words(normalizeSearch(sb.toString()));
        }
    }

    /**
     * Note de pertinence (0 = absent). Le titre passe toujours avant le résumé : titre exact, début du titre,
     * expression entière, tous les mots dans le titre, puis seulement le résumé et les genres.
     */
    public static final class SearchMatcher {
        private final String normalized, compact; private final List<String> needles = new ArrayList<>();
        public SearchMatcher(String query) {
            normalized = normalizeSearch(query);
            compact = normalized.replace(" ", "");
            List<String> all = new ArrayList<>(), meaningful = new ArrayList<>();
            if (!normalized.isEmpty()) for (String w : normalized.split(" ")) if (!w.isEmpty()) { all.add(w); if (!STOP.contains(w)) meaningful.add(w); }
            for (String w : meaningful.isEmpty() ? all : meaningful) needles.add(singular(w));
        }
        public boolean isEmpty() { return normalized.isEmpty(); }
        public int score(Indexed item) {
            if (normalized.isEmpty()) return 1;
            String t = item.title; int longer = Math.min(t.length() - normalized.length(), 49);
            if (item.base.equals(normalized) || t.equals(normalized)) return 1000;
            if ((t + " ").startsWith(normalized + " ")) return 950 - longer;
            if ((" " + t + " ").contains(" " + normalized + " ")) return 900 - longer;
            if (t.startsWith(normalized)) return 850 - longer;
            if ((" " + t).contains(" " + normalized)) return 800 - longer;
            if (compact.length() >= 3 && item.compact.contains(compact)) return 700 - Math.min(item.compact.length() - compact.length(), 49);
            int inTitle = 0, everywhere = 0; boolean titleOnly = true;
            for (String needle : needles) {
                int m = bestMatch(needle, item.titleWords, true);
                if (m > 0) { inTitle += m; everywhere += m; continue; }
                titleOnly = false;
                // Le résumé est long : seuls les mots entiers ou leurs débuts comptent, jamais les fautes.
                int e = needle.length() >= 3 || isDigits(needle) ? bestMatch(needle, item.extraWords, false) : 0;
                if (e == 0) return 0;
                everywhere += e;
            }
            // Mêmes mots trouvés : le titre le plus court est le plus proche (« Breaking Bad » avant « El Camino : Un film Breaking Bad »).
            return titleOnly ? 300 + Math.round(inTitle * 45f / needles.size()) - Math.min(item.titleWords.length - needles.size(), 10) : 100 + Math.round(everywhere * 10f / needles.size());
        }
        public boolean matches(Indexed item) { return score(item) > 0; }
        public boolean matches(String... values) {
            StringBuilder sb = new StringBuilder();
            for (String v : values) if (v != null && !v.isEmpty()) { if (sb.length() > 0) sb.append(' '); sb.append(v); }
            return matches(new Indexed(sb.toString()));
        }
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

    // ------------------------------------------------------------ Profils Kids / Junior (lib/profile-audience.ts)

    /** Un profil Kids voit les titres « kids » ; Junior voit aussi les titres « junior ». */
    public static boolean canWatch(String audience, String mode) { return canWatch(audience, null, mode); }

    /** Genres jamais montrés aux profils Kids et Junior, quelle que soit la classification. */
    private static final java.util.Set<String> ADULT_GENRES = new java.util.HashSet<>(java.util.Arrays.asList(
            "Horreur", "Thriller", "Crime", "Guerre", "War & Politics", "Reality", "Téléréalité", "Talk", "News",
            "Documentaire", "Romance", "Soap", "Musique", "Western", "Histoire"));

    /**
     * Profils Kids et Junior : la classification du site (lib/profile-audience.ts) ne suffit pas, car le
     * classement automatique marque « Tout public » des films d'action ou des thrillers. Sur la TV, on ne
     * garde que les vrais titres pour enfants : genre Kids, Animation + Familial, ou Familial classé Kids ; Junior y ajoute les
     * titres familiaux. Un genre adulte (horreur, thriller, crime…) exclut toujours le titre.
     */
    public static boolean canWatch(String audience, List<String> genres, String mode) {
        if (mode == null || mode.isEmpty() || "standard".equals(mode)) return true;
        if (genres == null || genres.isEmpty()) return false;
        for (String g : genres) if (ADULT_GENRES.contains(g)) return false;
        boolean kidsGenre = genres.contains("Kids");
        boolean family = genres.contains("Familial");
        boolean animation = genres.contains("Animation");
        boolean manga = genres.contains(MANGA_GENRE);
        // Un titre familial classé Kids par l'admin (ex. un spectacle Bluey) reste visible.
        if (kidsGenre || (family && animation && !manga) || (family && "kids".equals(audience))) return true;
        // Junior : en plus, les titres familiaux, sauf drames et séries en langue étrangère.
        return "junior".equals(mode) && family && !manga && !genres.contains("Drame") && !genres.contains(FOREIGN_GENRE);
    }

    private static final Pattern TITLE_YEAR = Pattern.compile("\\((18\\d{2}|19\\d{2}|20\\d{2}|2100)\\)\\s*$");

    /** Année de sortie : colonne release_year, sinon l'année entre parenthèses à la fin du titre. */
    public static int releaseYear(int stored, String title) {
        if (stored >= 1888 && stored <= 2100) return stored;
        Matcher m = TITLE_YEAR.matcher(title == null ? "" : title);
        return m.find() ? Integer.parseInt(m.group(1)) : -1;
    }

    // ------------------------------------------------------------ Rubriques Mangas / VO (lib/catalogue-categories.ts)

    public static final String MANGA_GENRE = "Manga";
    public static final String FOREIGN_GENRE = "Langue étrangère";
    private static final Pattern FOREIGN_SCRIPT = Pattern.compile("[\\p{L}&&[^\\p{IsLatin}]]");

    /** Une lettre d'une autre écriture que la nôtre (kana, hangul, han, cyrillique, arabe…). */
    public static boolean hasForeignScript(String title) { return title != null && FOREIGN_SCRIPT.matcher(title).find(); }
    public static boolean isManga(List<String> genres) { return genres != null && genres.contains(MANGA_GENRE); }
    public static boolean isForeign(List<String> genres, String title) { return (genres != null && genres.contains(FOREIGN_GENRE)) || hasForeignScript(title); }
    /** Films et Séries gardent seulement les titres qui n'ont pas leur propre rubrique. */
    public static boolean isMainstream(List<String> genres, String title) { return !isManga(genres) && !isForeign(genres, title); }

    /** category : all, movie, series, manga, foreign. */
    public static boolean inCategory(String type, List<String> genres, String title, String category) {
        if ("manga".equals(category)) return isManga(genres);
        if ("foreign".equals(category)) return isForeign(genres, title);
        if ("movie".equals(category) || "series".equals(category)) return category.equals(type) && isMainstream(genres, title);
        return true;
    }

    // ------------------------------------------------------------ Reprise (lib/watch-progress.ts)

    /** Secondes rejouées à la reprise, pour retrouver le fil. */
    public static final int RESUME_REWIND = 5;
    public static long resumeStart(long time) { return time > 30 ? time - RESUME_REWIND : 0; }
    /** Un film quitte « Reprendre » à son générique (92 %). */
    public static boolean isMostlyWatched(double time, double duration) { return duration > 0 && time / duration >= 0.92; }
    /** Un épisode quitté dans ses deux dernières minutes (ou à 95 %) est considéré comme vu. */
    public static boolean episodeFinished(double time, double duration) { return duration > 0 && (time / duration >= .95 || (duration >= 600 && duration - time <= 120)); }
    /** Un film à peine commencé ou déjà au générique ne va pas dans « Reprendre ». */
    public static boolean showInContinue(boolean series, double time, double duration) { return series || (time >= 60 && !isMostlyWatched(time, duration)); }

    // ------------------------------------------------------------ Lecture native (lib/catalogue-source.ts)

    /** Sources que le site sait transformer en flux vidéo (Moviez, catalogue-player, EmbedOrigin, vidéo directe). */
    public static boolean isNativePlayback(String value) {
        if (value == null || value.isEmpty()) return false;
        if (isDirectVideo(value)) return true;
        try {
            URI url = URI.create(SITE_BASE).resolve(value.trim().replace(" ", "%20"));
            String host = url.getHost() == null ? "" : url.getHost().toLowerCase(Locale.ROOT);
            String path = url.getPath() == null ? "" : url.getPath();
            if (host.equals("api.moviez.ac")) return true;
            if (path.equals("/api/catalogue-player")) return true;
            return host.equals("embedorigin.cc") && path.matches("^/e/[a-z0-9]{12}/?$");
        } catch (Exception e) { return false; }
    }

    /** Langue normalisée d'une piste audio (fra → fr, eng → en…). */
    public static String audioLanguage(String value) {
        String l = value == null ? "" : value.trim().toLowerCase(Locale.ROOT).split("[-_]")[0];
        switch (l) {
            case "fra": case "fre": return "fr";
            case "eng": return "en";
            case "deu": case "ger": return "de";
            case "spa": return "es";
            case "ita": return "it";
            case "jpn": return "ja";
            default: return l;
        }
    }

    public static String audioLabel(String name, String lang, int index) {
        if (name != null && !name.isEmpty()) return name;
        switch (audioLanguage(lang)) {
            case "fr": return "Français";
            case "en": return "Anglais";
            case "ja": return "Japonais";
            case "es": return "Espagnol";
            case "de": return "Allemand";
            case "it": return "Italien";
            case "ko": return "Coréen";
            default: return "Piste " + (index + 1);
        }
    }

    // ------------------------------------------------------------ Avatars d'origine (lib/avatars.ts)

    public static final String[][][] DEFAULT_AVATARS = {
            {{"Disney & Princesses"},
                    {"Raiponce", "https://static.wikia.nocookie.net/heros/images/4/42/Raiponce_Infobox.jpg/revision/latest?cb=20200723185055&path-prefix=fr"},
                    {"Mickey", "https://avatarfiles.alphacoders.com/214/214614.jpg"},
                    {"Reine des Neiges", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRz5Y10-MulAuvwLsp9t3wrzWVcXY5o2vfv3gnwPB2sJkKn0hBlTWzAo0-9&s=10"},
                    {"Le Roi Lion", "https://journaldemickey.com/wp-content/uploads/2024/06/roi-lion-personnages.jpg"}},
            {{"Super-Héros & Comics"},
                    {"Spider-Man", "https://avatarfiles.alphacoders.com/375/thumb-350-375896.webp"},
                    {"Batman", "https://image.api.playstation.com/cdn/UP1018/CUSA00133_00/Dz5i57ktol8qBJsWEVdjNy8wj3Tc5fF0Y2MyX0Poi4lAniOaUpfjH5IU2vVejxey.png"},
                    {"Joker", "https://img.magnific.com/free-vector/scary-clown-head-with-blue-hair-vector_43623-1371.jpg?semt=ais_hybrid&w=740&q=80"},
                    {"Marvel", "https://avatarfiles.alphacoders.com/604/60402.jpg"}},
            {{"Gaming & Séries"},
                    {"Mario", "https://pbs.twimg.com/profile_images/1929549617441521664/dn4udfbC_400x400.jpg"},
                    {"Stranger Things", "https://cf-images.assettype.com/cinemaexpress%2F2026-01-01%2Fbr0w32gz%2FST5-1.jpg?w=480&auto=format%2Ccompress"},
                    {"Anime", "https://www.projectxparis.com/cdn/shop/articles/344_75d7d802-3d2c-42ca-b360-afcc41033d8d.jpg?v=1759397750"},
                    {"Gaming Neon", "https://cdn.dribbble.com/userupload/5333469/file/original-d913e65193d78f79999f30fce27114c8.png?resize=752x&vertical=center"}},
    };

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
