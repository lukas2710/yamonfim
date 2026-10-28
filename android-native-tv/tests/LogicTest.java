import com.yamonfilm.tv.Logic;

import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicInteger;

/** Mêmes cas que les tests du site (lib/*.test.mjs), appliqués au portage Java. */
public final class LogicTest {
    private static int passed;

    static void check(boolean condition, String name) {
        if (!condition) throw new AssertionError("ÉCHEC : " + name);
        passed++;
    }

    public static void main(String[] args) throws Exception {
        // lib/search.test.mjs
        check(new Logic.SearchMatcher("  le seigneur DES anneaux ").matches("Le Seigneur des Anneaux : Les Deux Tours"), "accents et casse");
        check(new Logic.SearchMatcher("l ete").matches("L’été"), "apostrophe");
        check(new Logic.SearchMatcher("oeuvre").matches("L’Œuvre"), "ligature oe");
        check(new Logic.SearchMatcher("strangers things").matches("Stranger Things"), "pluriel");
        check(new Logic.SearchMatcher("harrys poter").matches("Harry Potter"), "faute de frappe");
        check(new Logic.SearchMatcher("etoiles").matches("Étoile"), "pluriel accentué");
        check(new Logic.SearchMatcher("potter harry").matches("Harry Potter et la Coupe de feu"), "ordre des mots");
        check(!new Logic.SearchMatcher("harry dune").matches("Harry Potter"), "mot manquant");
        check(!new Logic.SearchMatcher("saw 2").matches("Saw 3"), "nombres exacts");
        check(!new Logic.SearchMatcher("dune").matches("Dame"), "mots courts");
        check(new Logic.SearchMatcher("").matches("Tout"), "recherche vide");
        check(Logic.searchQueryVariants("Étoiles").equals(Arrays.asList("Étoiles", "etoiles", "etoile")), "variantes Étoiles");
        check(Logic.searchQueryVariants("Dune").equals(Arrays.asList("Dune", "dune")), "variantes Dune");

        // lib/watch-quota.test.mjs
        AtomicInteger updates = new AtomicInteger();
        for (int i = 0; i < 20; i++) {
            Logic.WatchAccess a = Logic.reserveViewing(() -> new int[]{1, 100}, expected -> { updates.incrementAndGet(); return true; });
            check(a.allowed && a.vip && a.remaining == -1, "VIP illimité");
        }
        check(updates.get() == 0, "VIP sans décompte");
        final int[] count = {0};
        for (int i = 0; i < 5; i++) {
            Logic.WatchAccess a = Logic.reserveViewing(() -> new int[]{0, count[0]}, expected -> { if (count[0] != expected) return false; count[0]++; return true; });
            check(a.allowed && a.remaining == 4 - i, "vision gratuite " + (i + 1));
        }
        check(!Logic.reserveViewing(() -> new int[]{0, count[0]}, expected -> { count[0]++; return true; }).allowed, "sixième vision refusée");
        check(count[0] == 5, "quota à 5");
        final boolean[] vip = {false};
        Logic.WatchAccess upgraded = Logic.reserveViewing(() -> new int[]{vip[0] ? 1 : 0, 4}, expected -> { vip[0] = true; return false; });
        check(upgraded.allowed && upgraded.vip, "passage VIP pendant un conflit");
        boolean threw = false;
        try { Logic.reserveViewing(() -> { throw new Exception("offline"); }, expected -> true); } catch (Exception e) { threw = true; }
        check(threw, "hors ligne : pas de vision gratuite");
        threw = false;
        try { Logic.reserveViewing(() -> new int[]{0, 0}, expected -> false); } catch (Exception e) { threw = true; }
        check(threw, "conflit permanent refusé");

        // lib/content-identity.test.mjs
        check(Logic.normalizeContentTitle("  L’ÉTÉ : Retrouvailles (2026) ").equals("l ete retrouvailles"), "titre normalisé");
        check(Logic.normalizeContentTitle("Le Cœur").equals("le coeur"), "cœur");
        check(Logic.normalizeContentTitle("進撃の巨人").equals("進撃の巨人"), "titre japonais");
        check(Logic.sameContent("movie", "123", "Le Retour", "movie", "00123", "The Return (2026)"), "même TMDB");
        check(Logic.normalizeTmdbId(" 000123 ").equals("123"), "TMDB normalisé");
        for (String v : new String[]{"", null, "invalid", "0"}) check(Logic.normalizeTmdbId(v).isEmpty(), "TMDB invalide " + v);
        check(!Logic.sameContent("movie", "123", "Example", "series", "123", "Example"), "film et série distincts");
        check(!Logic.sameContent("movie", "10", "Dune", "movie", "20", "Dune"), "remakes autorisés");
        check(Logic.sameContent("series", "", "Une SÉRIE !", "series", "30", "Une série (2026)"), "titre sans identifiant");
        check(!Logic.sameContent("movie", "", "?!", "movie", "", ""), "titres vides");

        // lib/watch-progress.test.mjs
        String prepared = Logic.preparePlayerUrl("https://api.moviez.ac/serie/123/1/2?next=1&lang=vf");
        check(prepared.contains("next=0") && !prepared.contains("next=1") && prepared.contains("lang=vf") && prepared.contains("/serie/123/1/2"), "lecteur Moviez");
        check(prepared.contains("autoplay=1") && prepared.contains("color=e8213f"), "options du lecteur");
        check(Logic.preparePlayerUrl("javascript:alert(1)").isEmpty(), "javascript refusé");
        for (String path : new String[]{"movie.mp4", "movie.webm", "master.m3u8"}) {
            String url = "https://media.test/" + path + "?signature=exact";
            check(Logic.isDirectVideo(url), "vidéo directe " + path);
            check(Logic.preparePlayerUrl(url).equals(url), "vidéo directe inchangée " + path);
        }
        check(!Logic.isDirectVideo("https://api.moviez.ac/123"), "Moviez non direct");
        check(Logic.cleanEmbed("<iframe src=\"https://api.moviez.ac/serie/1/1/1?a=1&amp;b=2\" width=\"100%\"></iframe>").equals("https://api.moviez.ac/serie/1/1/1?a=1&b=2"), "code iframe");
        check(Logic.isCompleted(96, 100) && !Logic.isCompleted(90, 100) && !Logic.isCompleted(10, 0), "fin de lecture à 95 %");

        // Remise à zéro : dimanche suivant à minuit, heure de Paris (changements d'heure inclus).
        long wednesday = ZonedDateTime.parse("2026-10-21T15:00:00+02:00[Europe/Paris]").toInstant().toEpochMilli();
        check(Logic.nextSundayReset(wednesday) == ZonedDateTime.parse("2026-10-25T00:00:00+02:00[Europe/Paris]").toInstant().toEpochMilli(), "dimanche suivant");
        long sunday = ZonedDateTime.parse("2026-10-25T10:00:00+01:00[Europe/Paris]").toInstant().toEpochMilli();
        check(Logic.nextSundayReset(sunday) == ZonedDateTime.parse("2026-11-01T00:00:00+01:00[Europe/Paris]").toInstant().toEpochMilli(), "dimanche → semaine suivante");
        check(Logic.parseTime("2026-10-25T22:00:00+00:00") == Instant.parse("2026-10-25T22:00:00Z").toEpochMilli(), "date Supabase");
        check(Logic.vipExpiration("2026-01-31T10:00:00+00:00", "3m") > 0 && Logic.vipExpiration("x", "3m") == -1, "fin VIP");
        check(Logic.tmdbSize("https://image.tmdb.org/t/p/original/a.jpg", "w342").equals("https://image.tmdb.org/t/p/w342/a.jpg"), "taille TMDB");

        check(Logic.isMoviezPlayer("https://api.moviez.ac/serie/2004/1/1"), "Moviez utilise le nouveau résolveur HLS");
        check(!Logic.isMoviezPlayer("https://api.moviez.ac.evil.test/1"), "hôte Moviez exact");
        Logic.AutoNext next = new Logic.AutoNext();
        check(!next.update(2964000, 3000000, true, true) && next.remaining == -1, "avant le décompte");
        for (int n=5;n>=1;n--) check(!next.update(3000000-n*1000, 3000000, true, true) && next.remaining == n, "décompte " + n);
        check(!next.update(2970000, 3000000, true, true), "ne coupe pas les trente dernières secondes");
        check(next.update(3000000, 3000000, true, true), "suite à la fin");
        next.reset(); next.marker(2800000,3000000);
        check(!next.update(2800000,3000000,true,true) && next.remaining == 5, "décompte au générique");
        check(next.update(2805000,3000000,true,true), "suite après le décompte du générique");
        check(!next.update(2805000,3020000,true,true), "autre version vidéo rejetée");
        check(!next.update(3000000,3000000,false,true), "pause respectée");
        next.cancel(); check(!next.update(3000000,3000000,true,true), "annulation respectée");
        next.reset(); check(!next.update(3000000,3000000,true,false), "dernier épisode");
        check(Logic.isResolvedPlayer("/api/catalogue-player?tmdb=1396&type=tv&season=1&episode=2"), "catalogue résolu sans page 404");
        check(!Logic.isResolvedPlayer("https://yamonfi.netlify.app.evil.test/api/catalogue-player?tmdb=1396&type=movie"), "hôte catalogue exact");
        check(Logic.seekTarget(5000, -10000, 60000) == 0, "retour limité au début");
        check(Logic.seekTarget(55000, 30000, 60000) == 59000, "avance limitée à la fin");
        check(Logic.seekTarget(0, 10000, 500) == 0, "durée très courte");
        check(Logic.seekTarget(10000, 10000, 0) == 20000, "durée encore inconnue");
        check(Logic.seekStep(0) == 10000 && Logic.seekStep(5) == 10000, "appui court précis");
        check(Logic.seekStep(6) == 30000 && Logic.seekStep(16) == 60000, "appui prolongé accéléré");
        check(Logic.canWatch("kids", "kids"), "Kids autorise Kids");
        check(!Logic.canWatch("junior", "kids"), "Kids exclut Junior");
        check(Logic.canWatch("kids", "junior") && Logic.canWatch("junior", "junior"), "Junior inclut les deux publics");
        check(!Logic.canWatch("standard", "junior"), "Junior exclut Standard");
        check(Logic.releaseYear("Un film (2024)") == 2024 && Logic.releaseYear("2001 : odyssée") == 0, "année de sortie sans confusion avec le titre");
        next.reset(); next.ended(true); check(next.active(), "fin même sur épisode court");
        com.yamonfilm.tv.Models.Media series = new com.yamonfilm.tv.Models.Media();
        com.yamonfilm.tv.Models.Season first = new com.yamonfilm.tv.Models.Season(), empty = new com.yamonfilm.tv.Models.Season(), second = new com.yamonfilm.tv.Models.Season();
        first.episodes.add(new com.yamonfilm.tv.Models.Episode()); second.episodes.add(new com.yamonfilm.tv.Models.Episode());
        series.seasons = java.util.Arrays.asList(first, empty, second);
        int[] continuation = series.next(0,0);
        check(continuation[0] == 2 && continuation[1] == 0, "saison suivante en ignorant une saison vide");
        check(series.next(2,0) == null, "arrêt au dernier épisode de la série");
        System.out.println(passed + " vérifications réussies.");
    }
}
