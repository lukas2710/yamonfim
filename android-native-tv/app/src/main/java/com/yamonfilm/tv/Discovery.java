package com.yamonfilm.tv;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Native counterpart of lib/recommendations.ts and lib/home-rankings.ts.
 * Pure Java: all scoring runs on an IO worker, never during D-pad navigation. */
public final class Discovery {
    private Discovery() { }
    public interface Title {
        String id(); String title(); String type(); String tmdbId(); String description(); List<String> genres();
    }
    public static final class Viewing {
        public final String id; public final long seconds, duration, updated;
        public Viewing(String id, long seconds, long duration, long updated) { this.id = id; this.seconds = seconds; this.duration = duration; this.updated = updated; }
    }
    public static final class Rating {
        public final double average; public final int votes; public final boolean anime;
        public Rating(double average, int votes, boolean anime) { this.average = average; this.votes = votes; this.anime = anime; }
    }
    public static final class Rankings {
        public final long at; public final Map<String, Rating> ratings; public final List<String> movies, series;
        public Rankings(long at, Map<String, Rating> ratings, List<String> movies, List<String> series) {
            this.at = at; this.ratings = Collections.unmodifiableMap(new HashMap<>(ratings));
            this.movies = Collections.unmodifiableList(new ArrayList<>(movies)); this.series = Collections.unmodifiableList(new ArrayList<>(series));
        }
        public static Rankings empty() { return new Rankings(0, Collections.emptyMap(), Collections.emptyList(), Collections.emptyList()); }
        public Rating rating(Title item) { return ratings.get(("series".equals(item.type()) ? "tv:" : "movie:") + item.tmdbId()); }
    }
    public static final class Result<T extends Title> {
        public final List<T> home = new ArrayList<>(), recommended = new ArrayList<>(), rated = new ArrayList<>(), trendingMovies = new ArrayList<>(), trendingSeries = new ArrayList<>();
        public final Map<String, List<T>> genres = new LinkedHashMap<>();
        public final Set<String> allowed = new HashSet<>();
        public boolean manga, animation, foreign;
    }
    private static String text(String value) { return value == null ? "" : value; }
    private static final Pattern MARKS = Pattern.compile("\\p{M}+");
    private static String normalize(String value) { return MARKS.matcher(Normalizer.normalize(text(value), Normalizer.Form.NFD)).replaceAll("").toLowerCase(Locale.ROOT).trim(); }
    private static Set<String> genres(Title item) { Set<String> set = new LinkedHashSet<>(); for (String genre : item.genres()) { String g = normalize(genre); if (!g.isEmpty()) set.add(g); } return set; }
    private static boolean manga(Title item, Rankings rankings, Set<String> g) { Rating r = rankings.rating(item); return r != null && r.anime || g.contains("manga") || g.contains("anime") || g.contains("animes"); }
    private static final Set<String> STOP = new HashSet<>(java.util.Arrays.asList("cette", "leurs", "entre", "apres", "avant", "comme", "quand", "alors", "ainsi", "contre", "depuis", "toute", "monde", "jeune", "histoire", "serie", "saison", "film", "autres", "nouveau", "nouvelle", "decouvre", "trouve"));
    private static final Pattern WORD = Pattern.compile("[a-z]{5,}");
    private static Set<String> words(Title item) { Set<String> set = new HashSet<>(); Matcher m = WORD.matcher(normalize(item.description())); while (m.find()) if (!STOP.contains(m.group())) set.add(m.group()); return set; }
    private static final class Seed<T extends Title> {
        final T item; final double weight; final Set<String> genres, words; final boolean manga;
        Seed(T item, double weight, Rankings rankings) { this.item = item; this.weight = weight; genres = Discovery.genres(item); words = words(item); manga = manga(item, rankings, genres); }
    }
    private static final class Scored<T> { final T item; final double score; Scored(T item, double score) { this.item = item; this.score = score; } }

    public static <T extends Title> Result<T> build(List<T> catalogue, List<Viewing> history, Rankings rankings, boolean child, long now) {
        Result<T> out = new Result<>(); Map<String, T> byId = new HashMap<>();
        Map<String, Set<String>> genreCache = new HashMap<>(); Map<String, Boolean> animeCache = new HashMap<>();
        for (T item : catalogue) { byId.put(item.id(), item); Set<String> g = genres(item); genreCache.put(item.id(), g); animeCache.put(item.id(), manga(item, rankings, g)); }
        Set<String> seen = new HashSet<>(); Map<String, Seed<T>> seedMap = new LinkedHashMap<>();
        for (Viewing viewing : history) {
            seen.add(viewing.id); T item = byId.get(viewing.id); if (item == null) continue;
            Set<String> g = genreCache.get(item.id()); boolean anime = animeCache.get(item.id());
            if (viewing.seconds >= 600 && (viewing.duration <= 0 || viewing.seconds / (double) viewing.duration >= .2)) {
                out.manga |= anime; out.animation |= anime || g.contains("animation"); out.foreign |= g.contains("langue etrangere");
            }
            if (viewing.seconds < 120) continue;
            double completion = viewing.duration > 0 ? Math.min(1, viewing.seconds / (double) viewing.duration) : .25;
            double age = viewing.updated > 0 ? Math.max(0, now - viewing.updated) / 86400000.0 : 90;
            double weight = (.3 + completion) * (.25 + .75 * Math.pow(.5, age / 45));
            Seed<T> previous = seedMap.get(item.id());
            if (previous == null || weight > previous.weight) seedMap.put(item.id(), new Seed<>(item, weight, rankings));
        }
        Map<String, Integer> frequency = new HashMap<>();
        for (T item : catalogue) {
            Set<String> g = genreCache.get(item.id());
            for (String genre : g) frequency.put(genre, frequency.getOrDefault(genre, 0) + 1);
            if ((out.manga || !animeCache.get(item.id())) && (child || out.animation || !g.contains("animation"))) { out.home.add(item); out.allowed.add(item.id()); }
        }
        List<Seed<T>> seeds = new ArrayList<>(seedMap.values()); seeds.sort((a, b) -> Double.compare(b.weight, a.weight));
        if (seeds.size() > 40) seeds = seeds.subList(0, 40);
        List<Scored<T>> scored = new ArrayList<>();
        if (!seeds.isEmpty()) for (T item : catalogue) {
            if (seen.contains(item.id())) continue;
            Set<String> g = genreCache.get(item.id()); boolean anime = animeCache.get(item.id());
            if (anime && !out.manga || g.contains("animation") && !out.animation || g.contains("langue etrangere") && !out.foreign) continue;
            Set<String> candidateWords = words(item); double score = 0;
            for (Seed<T> seed : seeds) {
                if (anime != seed.manga) continue;
                double affinity = 0;
                for (String genre : g) if (seed.genres.contains(genre)) affinity += Math.log(1 + catalogue.size() / (double) frequency.getOrDefault(genre, 1));
                if (affinity == 0) continue;
                int shared = 0; for (String word : candidateWords) if (seed.words.contains(word)) shared++;
                double overlap = shared / (double) Math.max(1, Math.sqrt(candidateWords.size() * seed.words.size()));
                score += seed.weight * (affinity / Math.sqrt(Math.max(1, g.size() * seed.genres.size())) + overlap * 2) * (seed.item.type().equals(item.type()) ? 1.1 : 1);
            }
            if (score > 0) scored.add(new Scored<>(item, score));
        }
        scored.sort((a, b) -> { int score = Double.compare(b.score, a.score); return score != 0 ? score : a.item.id().compareTo(b.item.id()); });
        for (int i = 0; i < Math.min(20, scored.size()); i++) out.recommended.add(scored.get(i).item);
        out.rated.addAll(bestRated(out.home, rankings));
        for (T item : out.rated) for (String genre : new LinkedHashSet<>(item.genres())) {
            if (!Logic.isMainstream(item.genres(), item.title()) && !"Manga".equals(genre) && !"Langue étrangère".equals(genre)) continue;
            List<T> list = out.genres.get(genre); if (list == null) out.genres.put(genre, list = new ArrayList<>()); list.add(item);
        }
        if (now - rankings.at <= 48 * 3600000L) {
            out.trendingMovies.addAll(trending(out.home, rankings.movies, "movie"));
            out.trendingSeries.addAll(trending(out.home, rankings.series, "series"));
        }
        return out;
    }
    public static <T extends Title> List<T> bestRated(List<T> items, Rankings rankings) {
        List<T> out = new ArrayList<>();
        for (T item : items) { Rating r = rankings.rating(item); if (r != null && r.average > 0 && r.votes >= ("series".equals(item.type()) ? 150 : 300)) out.add(item); }
        out.sort((a, b) -> { Rating l = rankings.rating(a), r = rankings.rating(b); int rating = Double.compare(r.average, l.average); if (rating != 0) return rating; int votes = Integer.compare(r.votes, l.votes); return votes != 0 ? votes : a.id().compareTo(b.id()); });
        return out;
    }
    private static <T extends Title> List<T> trending(List<T> items, List<String> ids, String type) {
        Map<String, Integer> order = new HashMap<>(); for (int i = 0; i < ids.size(); i++) order.put(ids.get(i), i);
        List<T> out = new ArrayList<>(); for (T item : items) if (type.equals(item.type()) && order.containsKey(item.tmdbId()) && Logic.isMainstream(item.genres(), item.title())) out.add(item);
        out.sort(Comparator.comparingInt(item -> order.get(item.tmdbId()))); return out;
    }
}
