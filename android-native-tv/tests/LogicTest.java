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
        // Profils Kids / Junior : seulement les vrais titres pour enfants.
        java.util.List<String> nobody = java.util.Arrays.asList("Action", "Thriller", "Crime");
        check(!Logic.canWatch("kids", nobody, "kids"), "kids : thriller classé kids refusé");
        check(!Logic.canWatch("kids", java.util.Arrays.asList("Science-Fiction", "Action", "Aventure"), "kids"), "kids : film d'action refusé");
        check(Logic.canWatch("kids", java.util.Arrays.asList("Animation", "Comédie", "Familial", "Kids"), "kids"), "kids : Bluey accepté");
        check(Logic.canWatch("kids", java.util.Arrays.asList("Familial"), "kids"), "kids : familial classé kids accepté");
        check(!Logic.canWatch("junior", java.util.Arrays.asList("Horreur", "Comédie"), "junior"), "junior : Chucky refusé");
        check(!Logic.canWatch("standard", java.util.Arrays.asList("Animation", "Familial", "Horreur"), "kids"), "kids : Scooby horreur refusé");
        check(Logic.canWatch("standard", java.util.Arrays.asList("Comédie", "Familial"), "junior"), "junior : familial accepté");
        check(!Logic.canWatch("standard", java.util.Arrays.asList("Comédie", "Familial"), "kids"), "kids : sitcom familiale refusée");
        check(Logic.canWatch("standard", nobody, "standard"), "standard : tout le catalogue");
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
        Logic.SearchMatcher avatar = new Logic.SearchMatcher("avatar");
        int exact = avatar.score(new Logic.Indexed("Avatar", "Sur Pandora."));
        int start = avatar.score(new Logic.Indexed("Avatar : La Voie de l’eau", "Jake Sully vit avec sa famille."));
        int synopsis = avatar.score(new Logic.Indexed("Le Dernier Maître de l’air", "Aang est le dernier avatar."));
        check(exact > start && start > synopsis && synopsis > 0, "classement titre avant résumé");
        check(avatar.score(new Logic.Indexed("La Planète des singes", "Un astronaute découvre une planète.")) == 0, "sans rapport");
        check(new Logic.SearchMatcher("lion").score(new Logic.Indexed("Titre sans rapport", "Un million de dollars.")) == 0, "pas dans un mot du résumé");
        check(new Logic.SearchMatcher("spiderman").matches("Spider-Man : No Way Home"), "mots collés");
        check(new Logic.SearchMatcher("spider man").matches("Spiderman"), "mots séparés");
        check(new Logic.SearchMatcher("intesrtellar").matches("Interstellar"), "lettres inversées");
        check(new Logic.SearchMatcher("interstelar").matches("Interstellar"), "lettre oubliée");
        check(new Logic.SearchMatcher("interstle").matches("Interstellar"), "mot en cours de saisie");
        check(new Logic.SearchMatcher("casa de papeel").matches("La Casa de Papel"), "faute en fin de saisie");
        check(!new Logic.SearchMatcher("aventure").matches("Avatar"), "mot différent");
        Logic.SearchMatcher dune = new Logic.SearchMatcher("dune");
        check(dune.score(new Logic.Indexed("Dune (2021)")) == 1000, "titre exact avec année");
        check(new Logic.SearchMatcher("interstelar").score(new Logic.Indexed("Interstellar (2014)")) > new Logic.SearchMatcher("interstelar").score(new Logic.Indexed("Interstella 5555 (2003)")), "une faute avant deux");
        check(new Logic.SearchMatcher("lion").score(new Logic.Indexed("Le Roi lion")) > new Logic.SearchMatcher("lion").score(new Logic.Indexed("Lioness (2023)")), "mot entier avant début de mot");
        check(new Logic.SearchMatcher("breking bad").score(new Logic.Indexed("Breaking Bad")) > new Logic.SearchMatcher("breking bad").score(new Logic.Indexed("El Camino : Un film \"Breaking Bad\" (2019)")), "titre le plus court");
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

        System.out.println(passed + " vérifications réussies.");
    }
}
