package com.yamonfilm.tv.screens;

import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.yamonfilm.tv.Actions;
import com.yamonfilm.tv.App;
import com.yamonfilm.tv.Cards;
import com.yamonfilm.tv.Cards.Card;
import com.yamonfilm.tv.Cards.Shelf;
import com.yamonfilm.tv.Dialogs;
import com.yamonfilm.tv.Discovery;
import com.yamonfilm.tv.Logic;
import com.yamonfilm.tv.MainActivity;
import com.yamonfilm.tv.Models.Collection;
import com.yamonfilm.tv.Models.History;
import com.yamonfilm.tv.Models.Media;
import com.yamonfilm.tv.R;
import com.yamonfilm.tv.Repo;
import com.yamonfilm.tv.Screen;
import com.yamonfilm.tv.Ui;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.yamonfilm.tv.Ui.dp;

/** Accueil TV : un titre « À la une » fixe en haut, puis les rangées sur fond uni. */
public final class HomeScreen extends Screen {
    private ImageView heroImage;
    private FrameLayout hero;
    private TextView kicker, title, description, heroPlay, heroInfo;
    private LinearLayout meta;
    private Media featured;
    /** Carrousel « À la une » (admin : site_settings home_hero) : jusqu'à 5 titres, parcourus avec gauche/droite. */
    private final List<Media> heroItems = new ArrayList<>();
    private final List<Integer> heroSeasons = new ArrayList<>();
    private int heroIndex;
    private LinearLayout heroDots;
    private List<String> heroIds = new ArrayList<>();
    private Map<String, org.json.JSONArray> heroSeasonsById = new HashMap<>();
    private List<com.yamonfilm.tv.Models.Banner> banners = new ArrayList<>();
    private Map<String, org.json.JSONArray> bannerSeasons = new HashMap<>();
    private List<Media> daily = new ArrayList<>();
    private Cards.VScroll rows;
    private LinearLayout loading;
    private TextView loadingText, retry;
    private View spinner;
    private final LinkedHashMap<String, Shelf> shelves = new LinkedHashMap<>();
    private String signature = "";
    private List<History> history = Collections.emptyList();
    private java.util.Map<String, List<String>> lists = Collections.emptyMap();
    private List<Discovery.Viewing> viewingHistory = Collections.emptyList();
    private int historyGeneration;
    private List<Collection> collections = Collections.emptyList();
    private int heroW, heroH;
    private boolean initialFocusDone;
    private Discovery.Result<Media> discovery;
    private Discovery.Rankings displayRankings = Discovery.Rankings.empty();
    private boolean discoveryBusy, discoveryPending, heroDirty;
    private boolean catalogueLoading = true;
    private long rankingsUpdated;

    public HomeScreen(MainActivity main) { super(main); }

    @Override protected String railId() { return "home"; }

    @Override protected View create() {
        FrameLayout root = new FrameLayout(main);
        root.setBackgroundColor(Ui.BG);
        int screenW = main.getResources().getDisplayMetrics().widthPixels, screenH = main.getResources().getDisplayMetrics().heightPixels;
        heroW = screenW; heroH = (int) (screenH * 0.74f);
        rows = new Cards.VScroll(main, true);
        rows.content.setPadding(0, 0, 0, dp(320));
        rows.setTopOffset(dp(92));

        // « À la une » : un seul titre mis en avant, fixe (aucun fond qui change à chaque déplacement).
        hero = new FrameLayout(main);
        heroImage = new ImageView(main);
        heroImage.setScaleType(ImageView.ScaleType.CENTER_CROP);
        hero.addView(heroImage, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        View left = new View(main);
        left.setBackground(Ui.gradient(GradientDrawable.Orientation.LEFT_RIGHT, 0xF7060A15, 0xCC060A15, 0x40060A15, 0x00060A15));
        hero.addView(left, Ui.flp((int) (screenW * 0.7f), Ui.MATCH, Gravity.START));
        View bottom = new View(main);
        bottom.setBackground(Ui.gradient(GradientDrawable.Orientation.TOP_BOTTOM, 0x00060A15, 0x99060A15, 0xFF060A15));
        hero.addView(bottom, Ui.flp(Ui.MATCH, heroH / 2, Gravity.BOTTOM));
        LinearLayout info = Ui.column(main);
        Ui.noClip(info);
        info.setPadding(dp(Ui.SIDE), 0, dp(Ui.SIDE), dp(26));
        kicker = Ui.kicker(main, "À LA UNE", Ui.ACCENT_TEXT);
        title = Ui.lines(Ui.text(main, 40, Ui.TEXT, Ui.W_BOLD), 1);
        title.setShadowLayer(dp(14), 0, dp(2), 0x99000000);
        meta = Ui.row(main);
        description = Ui.lines(Ui.text(main, 16, 0xFFD9DCE3, Ui.W_REGULAR), 2);
        description.setLineSpacing(0, 1.3f);
        LinearLayout buttons = Ui.row(main);
        Ui.noClip(buttons);
        heroPlay = Ui.button(main, "Regarder", R.drawable.ic_play, Ui.STYLE_PRIMARY);
        heroInfo = Ui.button(main, "Plus d'infos", R.drawable.ic_info, Ui.STYLE_NORMAL);
        heroPlay.setOnClickListener(v -> openHero());
        heroInfo.setOnClickListener(v -> openHero());
        buttons.addView(heroPlay);
        buttons.addView(heroInfo, Ui.lp(Ui.WRAP, Ui.WRAP, dp(14), 0, 0, 0));
        info.addView(kicker);
        info.addView(title, Ui.lp(dp(760), Ui.WRAP, 0, dp(10), 0, 0));
        info.addView(meta, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(12), 0, 0));
        info.addView(description, Ui.lp(dp(620), Ui.WRAP, 0, dp(12), 0, 0));
        info.addView(buttons, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(20), 0, 0));
        heroDots = Ui.row(main);
        heroDots.setGravity(Gravity.CENTER_VERTICAL);
        info.addView(heroDots, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(18), 0, 0));
        hero.addView(info, Ui.flp(Ui.MATCH, Ui.WRAP, Gravity.BOTTOM));
        hero.setVisibility(View.GONE);
        rows.content.addView(hero, new LinearLayout.LayoutParams(Ui.MATCH, heroH));
        root.addView(rows, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));

        loading = Ui.column(main);
        loading.setGravity(Gravity.CENTER);
        spinner = new MainActivity.Spinner(main);
        loading.addView(spinner, Ui.lp(dp(56), dp(56)));
        loadingText = Ui.label(main, "Chargement du catalogue…", 17, Ui.MUTED, false);
        loading.addView(loadingText, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(16), 0, 0));
        retry = Ui.button(main, "Réessayer", R.drawable.ic_refresh, Ui.STYLE_NORMAL);
        retry.setVisibility(View.GONE);
        retry.setOnClickListener(v -> { retry.setVisibility(View.GONE); spinner.setVisibility(View.VISIBLE); loadingText.setText("Chargement du catalogue…"); refreshCatalogue(); });
        loading.addView(retry, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(18), 0, 0));
        root.addView(loading, Ui.flp(Ui.MATCH, Ui.WRAP, Gravity.CENTER_VERTICAL));
        return root;
    }

    // ------------------------------------------------------------ Chargement

    @Override protected void onShow(boolean first) {
        if (first) {
            catalogueLoading = true;
            io(() -> App.repo().loadCachedCatalogue(), (cached, e) -> {
                if (Boolean.TRUE.equals(cached)) renderCatalogue();
                refreshCatalogue();
            });
            loadCollections();
            loadHomeExtras();
            loadRankings();
        }
        loadHistory();
        if (first && !App.repo().flag("help_home")) {
            App.repo().setFlag("help_home");
            App.MAIN.postDelayed(() -> { if (alive()) main.toast("Astuce : appui long sur OK (ou touche Menu) pour plus d'options."); }, 2500);
        }
    }

    private void refreshCatalogue() {
        final boolean firstCatalogue = App.repo().catalogue().isEmpty();
        catalogueLoading = true;
        io(() -> App.repo().refreshCatalogue(() -> App.MAIN.post(() -> {
            if (!alive()) return;
            catalogueLoading = false;
            renderCatalogue();
        })), (rows, e) -> {
            catalogueLoading = false;
            if (e != null) {
                if (App.repo().catalogue().isEmpty()) {
                    spinner.setVisibility(View.GONE);
                    loadingText.setText("Le catalogue ne peut pas être chargé. " + App.message(e));
                    retry.setVisibility(View.VISIBLE);
                    retry.requestFocus();
                }
                fail(e);
                return;
            }
            renderCatalogue();
            if (firstCatalogue) loadHistory();
        });
    }

    @Override protected void onRefresh() { loadHistory(); if (android.os.SystemClock.elapsedRealtime() - rankingsUpdated > 3600000) loadRankings(); }

    private void loadRankings() {
        rankingsUpdated = android.os.SystemClock.elapsedRealtime();
        io(() -> App.repo().refreshHomeRankings(), (rankings, error) -> { if (rankings != null) renderCatalogue(); });
    }

    private void loadHistory() {
        io(() -> App.repo().lists(), (rows, e) -> { if (rows != null) { lists = rows; renderLists(); } });
        final int generation = ++historyGeneration;
        final String profileId = App.repo().profileId();
        io(() -> { App.repo().flushWrites(4000); return App.repo().history(); }, (list, e) -> {
            if (generation != historyGeneration || !java.util.Objects.equals(profileId, App.repo().profileId())) return;
            if (e != null) { if (e instanceof com.yamonfilm.tv.Api.AuthExpired) fail(e); return; }
            history = list;
            viewingHistory = new ArrayList<>();
            for (History h : list) viewingHistory.add(new Discovery.Viewing(h.mediaId, h.currentTime, h.duration, Logic.parseTime(h.updatedAt)));
            renderContinue();
            renderCatalogue();
            io(() -> App.repo().recommendationHistory(list, profileId), (viewing, error) -> {
                if (viewing == null || generation != historyGeneration || !java.util.Objects.equals(profileId, App.repo().profileId())) return;
                viewingHistory = viewing; renderCatalogue();
            });
        });
    }

    /** Carrousel, bannières et ajouts du jour : facultatifs, ils ne bloquent jamais le catalogue. */
    private void loadHomeExtras() {
        io(() -> {
            List<String> ids = App.repo().heroEntries();
            java.util.Set<String> seriesIds = new java.util.HashSet<>();
            for (String id : ids) { String[] p = com.yamonfilm.tv.Models.Banner.parse(id); if (p[1] != null) seriesIds.add(p[0]); }
            heroSeasonsById = App.repo().seasonsOf(seriesIds);
            return ids;
        }, (ids, e) -> { if (ids != null) { heroIds = ids; heroDirty = true; renderCatalogue(); } });
        if (main.isKidsProfile()) return; // Bannières et ajouts du jour : profils Standard, comme sur le site.
        io(() -> {
            List<com.yamonfilm.tv.Models.Banner> list = App.repo().banners();
            java.util.Set<String> seriesIds = new java.util.HashSet<>();
            for (com.yamonfilm.tv.Models.Banner b : list) for (String entry : b.entries) { String[] p = com.yamonfilm.tv.Models.Banner.parse(entry); if (p[1] != null) seriesIds.add(p[0]); }
            bannerSeasons = App.repo().seasonsOf(seriesIds);
            return list;
        }, (list, e) -> { if (list != null) { banners = list; renderBanners(); } });
        io(() -> App.repo().dailyAdditions(), (list, e) -> { if (list != null) { daily = list; renderDaily(); } });
    }

    private void loadCollections() {
        io(() -> App.repo().collections(), (list, e) -> {
            if (e != null) return; // Collections non installées : la rangée n'est simplement pas affichée.
            collections = list;
            renderCollections();
        });
    }

    // ------------------------------------------------------------ Rangées

    private void renderCatalogue() {
        if (App.repo().catalogue().isEmpty() && catalogueLoading) return;
        if (discoveryBusy) { discoveryPending = true; return; }
        discoveryBusy = true;
        List<Media> catalogue = App.repo().visibleCatalogue();
        List<Discovery.Viewing> viewing = new ArrayList<>(viewingHistory);
        Discovery.Rankings rankings = App.repo().homeRankings();
        boolean child = main.isKidsProfile();
        String profileId = App.repo().profileId();
        io(() -> {
            return Discovery.build(catalogue, viewing, rankings, child, System.currentTimeMillis());
        }, (result, error) -> {
            discoveryBusy = false;
            if (!java.util.Objects.equals(profileId, App.repo().profileId())) return;
            if (discoveryPending) { discoveryPending = false; renderCatalogue(); return; }
            if (result == null) return;
            discovery = result; displayRankings = rankings;
            renderCatalogue(result);
        });
    }

    private void renderCatalogue(Discovery.Result<Media> data) {
        List<Media> all = data.home;
        StringBuilder sig = new StringBuilder().append(all.size());
        for (Media m : all) sig.append(m.id).append(m.title.hashCode()).append(m.poster.hashCode()).append(m.genres.hashCode());
        sig.append(displayRankings.at).append(heroIds.hashCode()).append(App.repo().completedRevision());
        for (Media m : data.recommended) sig.append(m.id);
        String next = Integer.toHexString(sig.toString().hashCode()) + all.size();
        if (next.equals(signature)) return;
        signature = next;
        if (all.isEmpty()) {
            loading.setVisibility(View.VISIBLE);
            spinner.setVisibility(View.GONE);
            loadingText.setText(catalogueLoading ? "Chargement du catalogue…" : "Aucun titre n'est encore disponible.");
            return;
        }
        loading.setVisibility(View.GONE);
        buildHero(all, heroDirty || featured != null && !data.allowed.contains(featured.id));
        heroDirty = false;
        List<Media> movies = new ArrayList<>(), series = new ArrayList<>(), mangas = new ArrayList<>(), foreign = new ArrayList<>();
        Map<String, List<Media>> genres = data.genres;
        for (Media m : all) {
            if (m.in("manga")) mangas.add(m);
            if (m.in("foreign")) foreign.add(m);
            if (m.in("movie")) movies.add(m);
            if (m.in("series")) series.add(m);
        }
        List<Map.Entry<String, List<Media>>> sorted = new ArrayList<>(genres.entrySet());
        sorted.sort((a, b) -> b.getValue().size() - a.getValue().size());

        discoveryShelf("recommended", "Recommandé pour vous", data.recommended);
        discoveryShelf("trend_movies", "Films en tendance cette semaine · TMDB", data.trendingMovies);
        discoveryShelf("trend_series", "Séries en tendance cette semaine · TMDB", data.trendingSeries);
        List<Media> topMovies = new ArrayList<>(), topSeries = new ArrayList<>();
        for (Media m : data.rated) if (Logic.isMainstream(m.genres, m.title)) { if (m.isSeries()) topSeries.add(m); else topMovies.add(m); }
        discoveryShelf("top_movies", "Les films les mieux notés · TMDB", topMovies);
        discoveryShelf("top_series", "Les séries les mieux notées · TMDB", topSeries);

        posterShelf("new", "Nouveautés", all.subList(0, Math.min(30, all.size())), null);
        posterShelf("movies", "Films récents", movies.subList(0, Math.min(40, movies.size())), movies.size() > 40 ? "movies" : null);
        posterShelf("series", "Séries récentes", series.subList(0, Math.min(40, series.size())), series.size() > 40 ? "series" : null);
        if (data.manga && mangas.size() >= 3) posterShelf("mangas", "Mangas", mangas.subList(0, Math.min(30, mangas.size())), mangas.size() > 30 ? "mangas" : null); else removeShelf("mangas");
        if (foreign.size() >= 3) posterShelf("foreign", "En langue étrangère", foreign.subList(0, Math.min(30, foreign.size())), foreign.size() > 30 ? "vo" : null); else removeShelf("foreign");
        List<String> genreKeys = new ArrayList<>();
        for (int i = 0; i < sorted.size() && i < 10; i++) {
            Map.Entry<String, List<Media>> g = sorted.get(i);
            if (g.getValue().isEmpty() || "Manga".equals(g.getKey()) || "Langue étrangère".equals(g.getKey())) continue;
            String key = "genre:" + g.getKey();
            genreKeys.add(key);
            List<Media> items = g.getValue();
            posterShelf(key, "Populaires en " + g.getKey(), items.subList(0, Math.min(30, items.size())), items.size() > 30 ? key : null);
        }
        for (String key : new ArrayList<>(shelves.keySet())) if (key.startsWith("genre:") && !genreKeys.contains(key)) removeShelf(key);
        renderContinue();
        renderCollections();
        renderBanners();
        renderDaily();
        List<Shelf> ordered = orderedShelves();
        for (int i = 0; i < ordered.size() && i < 4; i++) loadAround(ordered.get(i), ordered.get(i).lastIndex);
        // Premier affichage : la sélection va sur la première carte (sauf si l'utilisateur navigue déjà).
        View f = main.getCurrentFocus();
        if (!initialFocusDone || f == null || !f.isShown()) {
            if (f == null || !MainActivity.isInside(f, rows) || !f.isShown()) heroPlay.requestFocus();
            initialFocusDone = true;
        }
    }

    private void discoveryShelf(String key, String label, List<Media> items) {
        if (items.isEmpty()) removeShelf(key);
        else posterShelf(key, label, items.subList(0, Math.min(20, items.size())), null);
    }

    private boolean homeAllows(Media item) { return discovery != null && discovery.allowed.contains(item.id); }

    /** Titres du carrousel : choix de l'admin (lib/home-hero.ts), complétés par les derniers ajouts. */
    private void buildHero(List<Media> all, boolean force) {
        if (all.isEmpty() || (!heroItems.isEmpty() && !force)) return;
        Map<String, Media> byId = new HashMap<>();
        for (Media m : all) byId.put(m.id, m);
        heroItems.clear();
        heroSeasons.clear();
        java.util.Set<String> used = new java.util.HashSet<>();
        for (String entry : heroIds) {
            String[] p = com.yamonfilm.tv.Models.Banner.parse(entry);
            Media m = byId.get(p[0]);
            if (m == null || !used.add(p[0])) continue;
            heroItems.add(m);
            heroSeasons.add(seasonIndex(heroSeasonsById.get(p[0]), p[1]));
        }
        for (Media m : all) {
            if (heroItems.size() >= 5) break;
            if (m.backdrop.trim().isEmpty() || !used.add(m.id)) continue;
            heroItems.add(m);
            heroSeasons.add(-1);
        }
        if (heroItems.isEmpty()) { heroItems.add(all.get(0)); heroSeasons.add(-1); }
        heroIndex = 0;
        showHero(0, false);
        hero.setVisibility(View.VISIBLE);
        // Dès que l'accueil est prêt, « Regarder » est sélectionné : la télécommande répond au premier appui.
        hero.post(() -> {
            View f = main.getCurrentFocus();
            if (alive() && main.top() == this && !main.dialogOpen() && (f == null || !f.isShown() || !MainActivity.isInside(f, view))) heroPlay.requestFocus();
        });
    }

    /** Index de la saison mise en avant (« id:sN ») d'après son numéro, ou -1. */
    private static int seasonIndex(org.json.JSONArray seasons, String number) {
        if (seasons == null || number == null) return -1;
        int wanted = Integer.parseInt(number);
        for (int i = 0; i < seasons.length(); i++) {
            org.json.JSONObject o = seasons.optJSONObject(i);
            if (o != null && o.optInt("seasonNumber", i + 1) == wanted) return i;
        }
        return -1;
    }

    private void showHero(int index, boolean animate) {
        if (heroItems.isEmpty()) return;
        heroIndex = (index % heroItems.size() + heroItems.size()) % heroItems.size();
        featured = heroItems.get(heroIndex);
        int seasonIdx = heroSeasons.get(heroIndex);
        StringBuilder g = new StringBuilder();
        if (featured.year > 0) g.append(featured.year);
        for (int i = 0; i < featured.genres.size() && i < 3; i++) { if (g.length() > 0) g.append(" · "); g.append(featured.genres.get(i)); }
        String universe = main.isKidsProfile() ? ("kids".equals(App.repo().profileMode()) ? "UNIVERS KIDS · " : "UNIVERS JUNIOR · ") : "";
        String season = seasonIdx >= 0 && seasonIdx < featured.seasons.size() ? " · SAISON " + featured.seasons.get(seasonIdx).number + " · NOUVEAU" : "";
        kicker.setText(universe + "À LA UNE · " + (featured.isSeries() ? "SÉRIE" : "FILM") + season);
        showInfo(g.toString(), featured.title.replaceAll("\\s*\\(\\d{4}\\)\\s*$", ""), featured.description);
        if (animate) { heroImage.setAlpha(0.35f); heroImage.animate().alpha(1f).setDuration(260).start(); }
        App.images().load(heroImage, Logic.tmdbSize(featured.image(), "w1280"), heroW, heroH);
        heroDots.removeAllViews();
        if (heroItems.size() > 1) for (int i = 0; i < heroItems.size(); i++) {
            View dot = new View(main);
            dot.setBackground(Ui.round(i == heroIndex ? Ui.FOCUS : 0x59FFFFFF, 4));
            heroDots.addView(dot, Ui.lp(dp(i == heroIndex ? 26 : 8), dp(8), 0, 0, dp(8), 0));
        }
        // Image du titre suivant préparée à l'avance : le passage est instantané.
        Media nextItem = heroItems.get((heroIndex + 1) % heroItems.size());
        App.images().prefetch(Logic.tmdbSize(nextItem.image(), "w1280"), heroW, heroH);
    }

    private void openHero() {
        if (featured == null) return;
        int seasonIdx = heroItems.isEmpty() ? -1 : heroSeasons.get(heroIndex);
        if (seasonIdx >= 0) Actions.openMedia(main, featured, seasonIdx); else main.openMedia(featured);
    }

    // ------------------------------------------------------------ Bannières de l'admin et ajouts du jour

    private void renderBanners() {
        if (App.repo().catalogue().isEmpty() || main.isKidsProfile()) return;
        List<String> keys = new ArrayList<>();
        for (com.yamonfilm.tv.Models.Banner b : banners) {
            List<View> cards = new ArrayList<>();
            int rankNumber = 0;
            for (String entry : b.entries) {
                String[] p = com.yamonfilm.tv.Models.Banner.parse(entry);
                Media m = App.repo().cached(p[0]);
                if (m == null || !homeAllows(m)) continue;
                int seasonIdx = seasonIndex(bannerSeasons.get(p[0]), p[1]);
                String poster = m.poster;
                if (seasonIdx >= 0) {
                    org.json.JSONObject so = bannerSeasons.get(p[0]).optJSONObject(seasonIdx);
                    String sp = so == null ? "" : so.optString("poster_path", "");
                    if (!sp.isEmpty()) poster = sp;
                }
                rankNumber++;
                cards.add(b.ranked ? rankedCard(m, rankNumber, poster, seasonIdx, p[1]) : bannerCard(m, poster, seasonIdx, p[1]));
                if (cards.size() >= 30) break;
            }
            String key = "banner:" + b.id;
            if (cards.isEmpty()) { removeShelf(key); continue; }
            keys.add(key);
            setShelf(key, b.title.isEmpty() ? "À découvrir" : b.title, cards);
            Shelf shelf = shelves.get(key);
            if (shelf != null) {
                // Le sous-titre de la bannière s'affiche sous son titre.
                shelf.title.setText(b.subtitle.isEmpty() ? (b.title.isEmpty() ? "À découvrir" : b.title) : (b.title + "   ·   " + b.subtitle));
                loadAround(shelf, shelf.lastIndex);
            }
        }
        for (String key : new ArrayList<>(shelves.keySet())) if (key.startsWith("banner:") && !keys.contains(key)) removeShelf(key);
    }

    private Card bannerCard(Media m, String poster, int seasonIdx, String seasonNumber) {
        Card c = new Card(main, 130, 195, false, true);
        c.data = m;
        c.bound = true;
        c.bindImage(Logic.tmdbSize(poster, "w342"), m.title);
        if (seasonIdx >= 0) c.badge("SAISON " + seasonNumber + " · NOUVEAU", Ui.ACCENT);
        c.setOnClickListener(v -> { if (seasonIdx >= 0) Actions.openMedia(main, m, seasonIdx); else main.openMedia(m); });
        return c;
    }

    /** Top numéroté : un grand chiffre à gauche de l'affiche, comme sur le site. */
    private View rankedCard(Media m, int rankNumber, String poster, int seasonIdx, String seasonNumber) {
        FrameLayout box = new FrameLayout(main);
        int numberW = rankNumber >= 10 ? 118 : 74;
        box.setLayoutParams(new ViewGroup.MarginLayoutParams(dp(numberW + 118), dp(177)));
        box.setFocusable(true);
        box.setClickable(true);
        Ui.noClip(box);
        TextView number = new RankNumber(main, String.valueOf(rankNumber));
        box.addView(number, Ui.flp(dp(numberW + 30), dp(177), Gravity.START | Gravity.BOTTOM));
        Card c = new Card(main, 118, 177, false, false);
        c.data = m;
        c.bound = true;
        c.setDuplicateParentStateEnabled(true);
        c.bindImage(Logic.tmdbSize(poster, "w342"), m.title);
        if (seasonIdx >= 0) c.badge("SAISON " + seasonNumber, Ui.ACCENT);
        box.addView(c, Ui.flp(dp(118), dp(177), Gravity.END | Gravity.BOTTOM));
        box.setOnClickListener(v -> { if (seasonIdx >= 0) Actions.openMedia(main, m, seasonIdx); else main.openMedia(m); });
        Ui.onFocus(box, 1.07f, null);
        box.setTag(m);
        return box;
    }

    /** Grand chiffre au contour clair et au fond sombre (top numéroté). */
    static final class RankNumber extends TextView {
        RankNumber(android.content.Context c, String value) {
            super(c);
            setText(value);
            setTypeface(Ui.font(Ui.W_BLACK));
            setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 150);
            setIncludeFontPadding(false);
            setGravity(Gravity.BOTTOM | Gravity.START);
            setLetterSpacing(-0.08f);
            setTranslationY(dp(26));
        }
        @Override protected void onDraw(android.graphics.Canvas canvas) {
            android.text.TextPaint p = getPaint();
            p.setStyle(android.graphics.Paint.Style.FILL);
            setTextColor(0xFF060A15);
            super.onDraw(canvas);
            p.setStyle(android.graphics.Paint.Style.STROKE);
            p.setStrokeWidth(dp(3));
            setTextColor(0xCCFFFFFF);
            super.onDraw(canvas);
        }
    }

    private void renderDaily() {
        if (App.repo().catalogue().isEmpty() || main.isKidsProfile() || daily.isEmpty()) { removeShelf("daily"); return; }
        List<Media> visible = new ArrayList<>();
        for (Media d : daily) { Media m = App.repo().cached(d.id); if (m != null && homeAllows(m)) visible.add(m); }
        if (visible.isEmpty()) { removeShelf("daily"); return; }
        int films = 0, seriesCount = 0;
        for (Media m : visible) if (m.isSeries()) seriesCount++; else films++;
        String label = "Ajoutés aujourd'hui · " + (films > 0 ? films + " film" + (films > 1 ? "s" : "") : "") + (films > 0 && seriesCount > 0 ? " et " : "") + (seriesCount > 0 ? seriesCount + " série" + (seriesCount > 1 ? "s" : "") : "");
        posterShelf("daily", label, visible, null);
        Shelf shelf = shelves.get("daily");
        if (shelf != null) loadAround(shelf, shelf.lastIndex);
    }

    private boolean isShownFocus() { View f = main.getCurrentFocus(); return f != null && f.isShown() && f != retry; }

    private void focusFirst() {
        for (Shelf s : orderedShelves()) if (s.count() > 0) { s.focus(0); return; }
    }

    private void posterShelf(String key, String label, List<Media> items, String moreKey) {
        List<View> cards = new ArrayList<>();
        for (Media m : items) {
            Card c = new Card(main, 130, 195, false, true);
            c.data = m;
            c.fallback.setText(m.title);
            if (key.startsWith("genre:") || key.startsWith("top_") || key.startsWith("trend_")) {
                Discovery.Rating rating = displayRankings.rating(m);
                if (rating != null && rating.average > 0) c.badge(String.format(java.util.Locale.FRANCE, "★ %.1f / 10", rating.average), 0xDD9D2631);
            }
            if (App.repo().completed(m.id)) c.badge("✓ Vu", 0xE6168A45);
            else if (App.repo().progressing(m.id)) c.badge("Lecture en cours", 0xE62563A8);
            c.setOnClickListener(v -> main.openMedia(m));
            wrapFocus(c, () -> loadNear(c));
            cards.add(c);
        }
        if (moreKey != null) {
            Card more = new Card(main, 130, 195, false, true);
            more.fallback.setText("Tout voir →");
            more.fallback.setTextColor(Ui.TEXT);
            more.setOnClickListener(v -> openMore(moreKey, label));
            cards.add(more);
        }
        setShelf(key, label, cards);
    }

    /** Les affiches se chargent autour de la sélection et sur les deux rangées suivantes. */
    private void loadNear(View card) {
        List<Shelf> list = orderedShelves();
        for (int i = 0; i < list.size(); i++) {
            Shelf s = list.get(i);
            if (!MainActivity.isInside(card, s)) continue;
            loadAround(s, s.indexOf(card));
            for (int k = Math.max(0, i - 1); k <= Math.min(list.size() - 1, i + 2); k++) if (k != i) loadAround(list.get(k), list.get(k).lastIndex);
            return;
        }
    }

    private void loadAround(Shelf shelf, int index) {
        int from = Math.max(0, index - 3), to = Math.min(shelf.count() - 1, index + 9);
        for (int i = from; i <= to; i++) {
            View v = shelf.item(i);
            if (!(v instanceof Card)) continue;
            Card c = (Card) v;
            if (!c.bound && c.data instanceof Media) { c.bound = true; c.bindMedia((Media) c.data); }
        }
    }

    private void openMore(String key, String label) {
        if (key.equals("movies")) main.openRail("movies");
        else if (key.equals("series")) main.openRail("series");
        else if (key.equals("mangas")) main.openRail("mangas");
        else if (key.equals("vo")) main.openRail("vo");
        else if (key.startsWith("genre:")) main.push(new BrowseScreen(main, null, label, "all", key.substring(6)).ranked(discovery == null ? Collections.emptySet() : discovery.allowed));
    }

    private void renderContinue() {
        if (App.repo().catalogue().isEmpty()) return;
        List<View> cards = new ArrayList<>();
        Set<String> included = new HashSet<>();
        for (History h : history) {
            Media m = App.repo().cached(h.mediaId);
            // L'historique peut garder une ligne par épisode : la ligne la plus récente
            // représente la série entière dans « Reprendre ».
            if (m == null || cards.size() >= 20 || !included.add(m.id)) continue;
            // Un épisode terminé reste une reprise valide : la fiche avance alors au suivant.
            // Seule une série entièrement vue sort de cette rangée.
            if (m.isSeries() ? App.repo().completed(m.id) : App.repo().seenPosition(m.id, false, h.seasonIdx, h.episodeIdx)) continue;
            // Comme sur le site : un film à peine commencé ou déjà à son générique (92 %) ne va pas dans « Reprendre ».
            if (!Logic.showInContinue(m.isSeries(), h.currentTime, h.duration) || !m.isSeries() && Logic.episodeFinished(h.currentTime, h.duration)) continue;
            Card c = new Card(main, 260, 146, true, true);
            c.data = h;
            String sub = m.isSeries() ? "S" + h.seasonNumber + " · É" + h.episodeNumber : "FILM";
            c.caption(sub, m.title);
            c.bindImage(Logic.tmdbSize(m.image(), "w780"), "");
            c.progress(h.fraction());
            c.setOnClickListener(v -> main.openMedia(m));
            cards.add(c);
        }
        if (cards.isEmpty()) removeShelf("continue");
        else setShelf("continue", "Reprendre", cards);
        renderLists();
    }

    private void renderLists() {
        if (App.repo().catalogue().isEmpty()) return;
        listShelf("favorites", "Mes favoris", "favorite");
        listShelf("later", "À regarder plus tard", "later");
    }

    private void listShelf(String key, String label, String list) {
        List<Media> items = new ArrayList<>();
        List<String> ids = lists.get(list);
        if (ids != null) for (String id : ids) { Media m = App.repo().cached(id); if (m != null) items.add(m); }
        if (items.isEmpty()) removeShelf(key);
        else posterShelf(key, label, items, null);
    }

    private void renderCollections() {
        if (App.repo().catalogue().isEmpty()) return;
        List<View> cards = new ArrayList<>();
        for (Collection col : collections) {
            List<Media> items = new ArrayList<>();
            for (Media item : App.repo().collectionItems(col)) if (homeAllows(item)) items.add(item);
            if (items.isEmpty()) continue;
            Card c = new Card(main, 260, 146, true, true);
            c.data = col;
            c.caption("COLLECTION · " + items.size() + " titre" + (items.size() > 1 ? "s" : ""), col.title);
            String cover = col.safeCover();
            if (cover.isEmpty()) cover = items.get(0).image();
            c.bindImage(Logic.tmdbSize(cover, "w780"), "");
            c.setOnClickListener(v -> main.push(new BrowseScreen(main, col)));
            cards.add(c);
        }
        if (cards.isEmpty()) removeShelf("collections");
        else setShelf("collections", "Collections", cards);
    }

    private void resume(Media cachedMedia, History h) { Actions.resume(main, cachedMedia.id, h); }

    private static final String[] ORDER = {"continue", "favorites", "later", "recommended", "daily", "trend_movies", "trend_series", "top_movies", "top_series", "banner", "collections", "new", "movies", "series", "mangas", "foreign"};

    private int rank(String key) {
        String k = key.startsWith("banner:") ? "banner" : key;
        for (int i = 0; i < ORDER.length; i++) if (ORDER[i].equals(k)) return i;
        return ORDER.length;
    }

    private List<Shelf> orderedShelves() {
        List<Shelf> list = new ArrayList<>();
        for (int i = 0; i < rows.content.getChildCount(); i++) if (rows.content.getChildAt(i) instanceof Shelf) list.add((Shelf) rows.content.getChildAt(i));
        return list;
    }

    /** Remplace le contenu d'une rangée sans perdre la sélection en cours. */
    private void setShelf(String key, String label, List<View> cards) {
        Shelf shelf = shelves.get(key);
        View focus = main.getCurrentFocus();
        int focusedIndex = -1;
        if (shelf == null) {
            shelf = new Shelf(main, label);
            shelf.data = key;
            shelf.setPadding(dp(Ui.SIDE - 4), dp(6), 0, dp(10));
            int index = rows.content.getChildCount();
            int r = rank(key);
            for (int i = 0; i < rows.content.getChildCount(); i++) {
                if (!(rows.content.getChildAt(i) instanceof Shelf)) continue;
                String other = (String) ((Shelf) rows.content.getChildAt(i)).data;
                if (rank(other) > r) { index = i; break; }
            }
            rows.content.addView(shelf, index);
            shelves.put(key, shelf);
        } else {
            focusedIndex = focus != null && MainActivity.isInside(focus, shelf) ? shelf.indexOf(focus) : -1;
            shelf.scroll.items.removeAllViews();
        }
        shelf.title.setText(label);
        for (View c : cards) shelf.add(c, 18);
        if (focusedIndex >= 0) shelf.focus(Math.min(focusedIndex, shelf.count() - 1));
        if (shelf.lastIndex >= shelf.count()) shelf.lastIndex = Math.max(0, shelf.count() - 1);
    }

    private void removeShelf(String key) {
        Shelf s = shelves.remove(key);
        if (s == null) return;
        View focus = main.getCurrentFocus();
        boolean had = focus != null && MainActivity.isInside(focus, s);
        int index = rows.content.indexOfChild(s);
        rows.content.removeView(s);
        if (had) {
            List<Shelf> list = orderedShelves();
            if (!list.isEmpty()) list.get(Math.min(index, list.size() - 1)).focusLast();
        }
    }

    private void wrapFocus(View card, Runnable focused) {
        View.OnFocusChangeListener base = card.getOnFocusChangeListener();
        card.setOnFocusChangeListener((v, has) -> { if (base != null) base.onFocusChange(v, has); if (has) focused.run(); });
    }

    // ------------------------------------------------------------ Résumé et fond

    private void showInfo(String tags, String t, String d) {
        title.setText(t);
        meta.removeAllViews();
        if (tags != null && !tags.isEmpty()) for (String part : tags.split(" · ")) {
            if (part.trim().isEmpty()) continue;
            meta.addView(Ui.tag(main, part.trim()), Ui.lp(Ui.WRAP, Ui.WRAP, 0, 0, dp(8), 0));
        }
        meta.setVisibility(meta.getChildCount() == 0 ? View.GONE : View.VISIBLE);
        description.setText(d == null ? "" : d);
    }

    // ------------------------------------------------------------ Télécommande

    @Override protected boolean onKey(KeyEvent e) {
        int code = e.getKeyCode();
        View focus = main.getCurrentFocus();
        if (focus == null) return false;
        List<Shelf> list = orderedShelves();
        if (MainActivity.isInside(focus, hero)) {
            if (code == KeyEvent.KEYCODE_DPAD_DOWN) { if (!list.isEmpty()) list.get(0).focusLast(); return true; }
            if (code == KeyEvent.KEYCODE_DPAD_UP) { main.focusTopBar(); return true; }
            if (code == KeyEvent.KEYCODE_DPAD_RIGHT) { if (focus == heroPlay) heroInfo.requestFocus(); else if (heroItems.size() > 1) showHero(heroIndex + 1, true); return true; }
            if (code == KeyEvent.KEYCODE_DPAD_LEFT) { if (focus == heroInfo) heroPlay.requestFocus(); else if (heroItems.size() > 1) showHero(heroIndex - 1, true); return true; }
            return false;
        }
        int row = -1;
        for (int i = 0; i < list.size(); i++) if (MainActivity.isInside(focus, list.get(i))) { row = i; break; }
        if (row < 0) return false;
        Shelf shelf = list.get(row);
        if (code == KeyEvent.KEYCODE_DPAD_DOWN) { if (row + 1 < list.size()) list.get(row + 1).focusLast(); return true; }
        if (code == KeyEvent.KEYCODE_DPAD_UP) { if (row > 0) list.get(row - 1).focusLast(); else if (hero.getVisibility() == View.VISIBLE) heroPlay.requestFocus(); else main.focusTopBar(); return true; }
        int index = shelf.indexOf(focus);
        if (code == KeyEvent.KEYCODE_DPAD_RIGHT) { if (index + 1 < shelf.count()) shelf.focus(index + 1); return true; }
        if (code == KeyEvent.KEYCODE_DPAD_LEFT) { if (index > 0) shelf.focus(index - 1); return true; }
        return false;
    }

    @Override protected boolean onLongPress(View focused) {
        if (!(focused instanceof Card)) return false;
        Object data = ((Card) focused).data;
        if (data instanceof History) {
            History h = (History) data;
            Media m = App.repo().cached(h.mediaId);
            if (m == null) return false;
            Dialogs.actions(main, m.title, new String[]{"Reprendre la lecture", "Voir la fiche", "Retirer de « Reprendre »"}, new int[]{R.drawable.ic_play, R.drawable.ic_info, R.drawable.ic_trash}, i -> {
                if (i == 0) resume(m, h);
                else if (i == 1) main.openMedia(m);
                else io(() -> { App.repo().removeFromHistory(m.id); return true; }, (ok, e) -> { if (e != null) fail(e); else { main.toast("Retiré de ton historique"); loadHistory(); } });
            });
            return true;
        }
        if (data instanceof Media) {
            Media m = (Media) data;
            Dialogs.actions(main, m.title, new String[]{"Voir la fiche", "Rechercher des titres proches"}, new int[]{R.drawable.ic_info, R.drawable.ic_search}, i -> {
                if (i == 0) main.openMedia(m);
                else if (!m.genres.isEmpty()) main.push(new BrowseScreen(main, null, m.genres.get(0), "all", m.genres.get(0)));
                else main.openRail("search");
            });
            return true;
        }
        return false;
    }

    @Override protected boolean onBack() {
        View focus = main.getCurrentFocus();
        if (hero.getVisibility() == View.VISIBLE && focus != null && !MainActivity.isInside(focus, hero)) {
            rows.smoothScrollTo(0, 0);
            heroPlay.requestFocus();
            return true;
        }
        return false;
    }

    @Override protected View defaultFocus() {
        if (hero.getVisibility() == View.VISIBLE) return heroPlay;
        List<Shelf> list = orderedShelves();
        for (Shelf s : list) if (s.count() > 0) return s.item(s.lastIndex);
        return retry.getVisibility() == View.VISIBLE ? retry : null;
    }



}
