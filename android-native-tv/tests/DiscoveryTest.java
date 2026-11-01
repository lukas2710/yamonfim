import com.yamonfilm.tv.Discovery;
import com.yamonfilm.tv.Completion;
import java.util.*;

/** Same recommendation/rating invariants as the website, without Android mocks. */
public final class DiscoveryTest {
    private static int passed;
    private static final long NOW = 1793534400000L;
    private static final class Title implements Discovery.Title {
        final String id, type, tmdb; final List<String> genres;
        Title(String id, String type, String tmdb, String... genres) { this.id = id; this.type = type; this.tmdb = tmdb; this.genres = Arrays.asList(genres); }
        public String id() { return id; } public String title() { return id; } public String type() { return type; }
        public String tmdbId() { return tmdb; } public String description() { return ""; } public List<String> genres() { return genres; }
    }
    private static Title movie(String id, String... genres) { return new Title(id, "movie", id, genres); }
    private static Discovery.Viewing watched(String id) { return new Discovery.Viewing(id, 3000, 3600, NOW); }
    private static void check(boolean condition, String name) { if (!condition) throw new AssertionError(name); passed++; }
    private static List<String> ids(List<? extends Discovery.Title> titles) { List<String> ids = new ArrayList<>(); for (Discovery.Title title : titles) ids.add(title.id()); return ids; }
    public static void main(String[] args) {
        Title a = movie("a", "Action"), b = movie("b", "Action"), romance = movie("r", "Romance"), r2 = movie("r2", "Romance");
        Title manga = movie("m", "Manga", "Action"), anime = movie("n", "Action"), cartoon = movie("c", "Animation", "Action");
        List<Title> catalogue = Arrays.asList(a, b, romance, r2, manga, anime, cartoon);
        Map<String, Discovery.Rating> scores = new HashMap<>();
        scores.put("movie:n", new Discovery.Rating(9, 500, true));
        Discovery.Rankings rankings = new Discovery.Rankings(NOW, scores, Collections.emptyList(), Collections.emptyList());
        Discovery.Result<Title> action = Discovery.build(catalogue, Arrays.asList(watched("a")), rankings, false, NOW);
        check(ids(action.recommended).equals(Arrays.asList("b")), "action history excludes mangas, anime, animation and already viewed titles");
        check(!action.manga && !action.animation, "no invented animation taste");
        check(!action.allowed.contains("m") && !action.allowed.contains("n") && !action.allowed.contains("c"), "all home shelves use profile filtering");
        check(ids(Discovery.build(catalogue, Arrays.asList(watched("r")), rankings, false, NOW).recommended).equals(Arrays.asList("r2")), "another profile gets its own recommendations");
        check(Discovery.build(catalogue, Collections.emptyList(), rankings, false, NOW).recommended.isEmpty(), "no fake personalized row without history");
        check(Discovery.build(catalogue, Arrays.asList(new Discovery.Viewing("a", 10, 3600, NOW)), rankings, false, NOW).recommended.isEmpty(), "opening a video briefly gives no preference");
        List<Discovery.Viewing> accidental = Arrays.asList(watched("a"), new Discovery.Viewing("m", 120, 3600, NOW));
        check(!Discovery.build(catalogue, accidental, rankings, false, NOW).manga, "briefly opened manga does not enable mangas");
        Discovery.Result<Title> fan = Discovery.build(catalogue, Arrays.asList(watched("m")), rankings, false, NOW);
        check(fan.manga && fan.allowed.contains("m") && fan.allowed.contains("n"), "engaged manga viewing enables that category");
        check(ids(fan.recommended).equals(Arrays.asList("n")), "manga fan gets manga recommendations");
        Discovery.Result<Title> kids = Discovery.build(catalogue, Collections.emptyList(), rankings, true, NOW);
        check(kids.allowed.contains("c") && !kids.allowed.contains("n"), "kids keep cartoons without unrestricted anime suggestions");
        List<Discovery.Viewing> single = Arrays.asList(watched("a"), watched("r"));
        List<Discovery.Viewing> many = new ArrayList<>(single); for (int i = 0; i < 30; i++) many.add(watched("r"));
        check(ids(Discovery.build(catalogue, single, rankings, false, NOW).recommended).equals(ids(Discovery.build(catalogue, many, rankings, false, NOW).recommended)), "many episodes do not drown out another title");
        List<Discovery.Viewing> recent = Arrays.asList(watched("a"), new Discovery.Viewing("r", 3000, 3600, 1577836800000L));
        check(ids(Discovery.build(catalogue, recent, rankings, false, NOW).recommended).get(0).equals("b"), "recent engaged viewing outweighs old viewing");
        Title tv = new Title("tv", "series", "a", "Action"), high = movie("high", "Action"), tied = movie("tied", "Action");
        scores.put("movie:a", new Discovery.Rating(8, 1000, false)); scores.put("tv:a", new Discovery.Rating(8.5, 200, false));
        scores.put("movie:high", new Discovery.Rating(10, 2, false)); scores.put("movie:tied", new Discovery.Rating(8, 2000, false));
        rankings = new Discovery.Rankings(NOW, scores, Arrays.asList("tied", "a", "absent"), Arrays.asList("a"));
        List<Title> rated = Arrays.asList(a, tv, high, tied, b);
        check(ids(Discovery.bestRated(rated, rankings)).equals(Arrays.asList("tv", "tied", "a")), "ratings respect votes, ties and movie/TV identity");
        Discovery.Result<Title> top = Discovery.build(rated, Collections.emptyList(), rankings, false, NOW);
        check(ids(top.trendingMovies).equals(Arrays.asList("tied", "a")), "weekly movie order matches TMDB and excludes missing catalogue titles");
        check(ids(top.trendingSeries).equals(Arrays.asList("tv")), "TV trends have separate IDs");
        check(ids(top.genres.get("Action")).equals(Arrays.asList("tv", "tied", "a")), "genre rows follow real rating order");
        Discovery.Rankings stale = new Discovery.Rankings(NOW - 49 * 3600000L, scores, Arrays.asList("a"), Arrays.asList("a"));
        check(Discovery.build(rated, Collections.emptyList(), stale, false, NOW).trendingMovies.isEmpty(), "outdated trends are not called this week's trends");
        check(Discovery.bestRated(rated, Discovery.Rankings.empty()).isEmpty(), "no invented ratings during a provider outage");
        check(Discovery.build(Arrays.asList(movie("u", "Comédie"), movie("v", "comedie")), Arrays.asList(watched("u")), Discovery.Rankings.empty(), false, NOW).recommended.size() == 1, "genre accents normalized like the site");
        Map<String, Map<String, Long>> seen = new HashMap<>();
        check(!Completion.titles(catalogue, seen, Arrays.asList(new Discovery.Viewing("a", 5, 100, NOW)), Collections.emptyMap()).contains("a"), "brief movie playback gets no complete badge");
        Map<String, Long> marks = new HashMap<>(); marks.put("movie_main", NOW - 1000); seen.put("a", marks);
        check(Completion.titles(catalogue, seen, Arrays.asList(new Discovery.Viewing("a", 5, 100, NOW)), Collections.emptyMap()).contains("a"), "explicit movie seen flag gets green badge");
        check(Completion.titles(catalogue, seen, Arrays.asList(new Discovery.Viewing("a", 95, 100, NOW)), Collections.emptyMap()).contains("a"), "finished movie gets green badge");
        Map<String, List<String>> required = new HashMap<>(); required.put("tv", Arrays.asList("s0_e0", "s0_e1"));
        Map<String, Long> episodes = new HashMap<>(); episodes.put("s0_e0", NOW); seen.put("tv", episodes);
        check(!Completion.titles(rated, seen, Collections.emptyList(), required).contains("tv"), "partial series gets no complete badge");
        episodes.put("s0_e1", NOW);
        check(Completion.titles(rated, seen, Collections.emptyList(), required).contains("tv"), "all episodes give green series badge");
        check(Completion.titles(rated, seen, Arrays.asList(new Discovery.Viewing("tv", 5, 100, NOW + 1000)), required).contains("tv"), "saved resume cannot hide a series with every episode seen");
        Map<String, Map<String, Long>> legacy = new HashMap<>(); Map<String, Long> oldKeys = new HashMap<>(); oldKeys.put("s1_e4", NOW); oldKeys.put("s1_e5", NOW); legacy.put("tv", oldKeys);
        check(Completion.titles(rated, legacy, Collections.emptyList(), required).contains("tv"), "renumbered catalogue retains all-seen legacy badge");
        check(Completion.titles(rated, Collections.emptyMap(), Collections.emptyList(), required).isEmpty(), "complete badges stay profile scoped");
        System.out.println(passed + " vérifications découverte TV réussies.");
    }
}
