package com.yamonfilm.tv.screens;

import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.yamonfilm.tv.Ui.dp;

/** Accueil TV : un titre « À la une » fixe en haut, puis les rangées sur fond uni. */
public final class HomeScreen extends Screen {
    private ImageView heroImage;
    private FrameLayout hero;
    private TextView kicker, title, description, heroPlay, heroInfo;
    private LinearLayout meta;
    private Media featured;
    private Cards.VScroll rows;
    private LinearLayout loading;
    private TextView loadingText, retry;
    private View spinner;
    private final LinkedHashMap<String, Shelf> shelves = new LinkedHashMap<>();
    private String signature = "";
    private List<History> history = Collections.emptyList();
    private List<Collection> collections = Collections.emptyList();
    private int heroW, heroH;
    private boolean initialFocusDone;
    private boolean catalogueBusy;
    private long catalogueUpdated;

    public HomeScreen(MainActivity main) { super(main); }

    @Override protected String railId() { return "home"; }

    @Override protected View create() {
        FrameLayout root = new FrameLayout(main);
        root.setBackgroundColor(Ui.BG);
        int screenW = main.getResources().getDisplayMetrics().widthPixels, screenH = main.getResources().getDisplayMetrics().heightPixels;
        heroW = screenW; heroH = (int) (screenH * 0.72f);
        rows = new Cards.VScroll(main, true);
        rows.content.setPadding(0, 0, 0, dp(90));
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
        kicker = Ui.kicker(main, "À LA UNE", Ui.ACCENT);
        title = Ui.lines(Ui.text(main, 36, Ui.TEXT, Ui.W_BOLD), 2);
        title.setShadowLayer(dp(14), 0, dp(2), 0x99000000);
        meta = Ui.row(main);
        description = Ui.lines(Ui.text(main, 16, 0xFFD9DCE3, Ui.W_REGULAR), 2);
        description.setLineSpacing(0, 1.3f);
        LinearLayout buttons = Ui.row(main);
        Ui.noClip(buttons);
        heroPlay = Ui.button(main, "Regarder", R.drawable.ic_play, Ui.STYLE_PRIMARY);
        heroInfo = Ui.button(main, "Plus d'infos", R.drawable.ic_info, Ui.STYLE_NORMAL);
        heroPlay.setOnClickListener(v -> { if (featured != null) main.openMedia(featured); });
        heroInfo.setOnClickListener(v -> { if (featured != null) main.openMedia(featured); });
        buttons.addView(heroPlay);
        buttons.addView(heroInfo, Ui.lp(Ui.WRAP, Ui.WRAP, dp(14), 0, 0, 0));
        info.addView(kicker);
        info.addView(title, Ui.lp(Math.min(dp(660), screenW - dp(Ui.SIDE * 2)), Ui.WRAP, 0, dp(10), 0, 0));
        info.addView(meta, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(12), 0, 0));
        info.addView(description, Ui.lp(Math.min(dp(560), screenW - dp(Ui.SIDE * 2)), Ui.WRAP, 0, dp(12), 0, 0));
        info.addView(buttons, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(20), 0, 0));
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
            io(() -> App.repo().loadCachedCatalogue(), (cached, e) -> {
                if (Boolean.TRUE.equals(cached)) renderCatalogue();
                refreshCatalogue();
            });
            loadCollections();
        }
        loadHistory();
        if (first && !App.repo().flag("help_home")) {
            App.repo().setFlag("help_home");
            App.MAIN.postDelayed(() -> { if (alive()) main.toast("Astuce : appui long sur OK (ou touche Menu) pour plus d'options."); }, 2500);
        }
    }

    private void refreshCatalogue() {
        if (catalogueBusy) return;
        catalogueBusy = true;
        io(() -> App.repo().refreshCatalogue(), (rows, e) -> {
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
        });
    }

    @Override protected void onRefresh() { loadHistory(); if (android.os.SystemClock.elapsedRealtime() - catalogueUpdated > 300000) { refreshCatalogue(); loadCollections(); } }

    private void loadHistory() {
        io(() -> { App.repo().flushWrites(4000); return App.repo().history(); }, (list, e) -> {
            if (e != null) { if (e instanceof com.yamonfilm.tv.Api.AuthExpired) fail(e); return; }
            history = list;
            renderContinue();
        });
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
        List<Media> all = App.repo().catalogue();
        StringBuilder sig = new StringBuilder().append(all.size());
        for (Media m : all) sig.append(m.id).append(m.title.hashCode()).append(m.poster.hashCode());
        String next = Integer.toHexString(sig.toString().hashCode()) + all.size();
        if (next.equals(signature)) return;
        signature = next;
        if (all.isEmpty()) {
            loading.setVisibility(View.VISIBLE);
            spinner.setVisibility(View.GONE);
            loadingText.setText("Aucun titre n'est encore disponible.");
            return;
        }
        loading.setVisibility(View.GONE);
        showFeatured(all);
        List<Media> movies = new ArrayList<>(), series = new ArrayList<>();
        Map<String, List<Media>> genres = new HashMap<>();
        for (Media m : all) {
            (m.isSeries() ? series : movies).add(m);
            for (String g : m.genres) { List<Media> l = genres.get(g); if (l == null) genres.put(g, l = new ArrayList<>()); l.add(m); }
        }
        List<Map.Entry<String, List<Media>>> sorted = new ArrayList<>(genres.entrySet());
        sorted.sort((a, b) -> b.getValue().size() - a.getValue().size());

        posterShelf("new", "Nouveautés", all.subList(0, Math.min(30, all.size())), null);
        posterShelf("movies", "Films récents", movies.subList(0, Math.min(40, movies.size())), movies.size() > 40 ? "movies" : null);
        posterShelf("series", "Séries récentes", series.subList(0, Math.min(40, series.size())), series.size() > 40 ? "series" : null);
        List<String> genreKeys = new ArrayList<>();
        for (int i = 0; i < sorted.size() && i < 10; i++) {
            Map.Entry<String, List<Media>> g = sorted.get(i);
            if (g.getValue().size() < 4) continue;
            String key = "genre:" + g.getKey();
            genreKeys.add(key);
            List<Media> items = g.getValue();
            posterShelf(key, g.getKey(), items.subList(0, Math.min(30, items.size())), items.size() > 30 ? key : null);
        }
        for (String key : new ArrayList<>(shelves.keySet())) if (key.startsWith("genre:") && !genreKeys.contains(key)) removeShelf(key);
        renderContinue();
        renderCollections();
        List<Shelf> ordered = orderedShelves();
        for (int i = 0; i < ordered.size() && i < 4; i++) loadAround(ordered.get(i), ordered.get(i).lastIndex);
        // Premier affichage : la sélection va sur la première carte (sauf si l'utilisateur navigue déjà).
        View f = main.getCurrentFocus();
        if (!initialFocusDone || f == null || !f.isShown()) {
            if (f == null || !MainActivity.isInside(f, rows) || !f.isShown()) heroPlay.requestFocus();
            initialFocusDone = true;
        }
    }

    /** Choisit le titre « À la une » une seule fois : un récent qui a une belle image. */
    private void showFeatured(List<Media> all) {
        if (featured != null) return;
        for (int i = 0; i < all.size() && i < 12; i++) {
            Media m = all.get(i);
            if (!m.backdrop.trim().isEmpty()) { featured = m; break; }
        }
        if (featured == null) featured = all.get(0);
        StringBuilder g = new StringBuilder();
        for (int i = 0; i < featured.genres.size() && i < 3; i++) { if (g.length() > 0) g.append(" · "); g.append(featured.genres.get(i)); }
        kicker.setText(featured.isSeries() ? "À LA UNE · SÉRIE" : "À LA UNE · FILM");
        showInfo(g.toString(), featured.title, featured.description);
        App.images().load(heroImage, Logic.tmdbSize(featured.image(), "w1280"), heroW, heroH);
        hero.setVisibility(View.VISIBLE);
        // Dès que l'accueil est prêt, « Regarder » est sélectionné : la télécommande répond au premier appui.
        hero.post(() -> {
            View f = main.getCurrentFocus();
            if (alive() && main.top() == this && !main.dialogOpen() && (f == null || !f.isShown() || !MainActivity.isInside(f, view))) heroPlay.requestFocus();
        });
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
        else if (key.startsWith("genre:")) main.push(new BrowseScreen(main, null, label, "all", key.substring(6)));
    }

    private void renderContinue() {
        if (App.repo().catalogue().isEmpty()) return;
        List<View> cards = new ArrayList<>();
        for (History h : history) {
            Media m = App.repo().cached(h.mediaId);
            if (m == null || cards.size() >= 20) continue;
            // Un film regardé à 70 % ou plus quitte « Reprendre » (même règle que le site).
            if (!m.isSeries() && h.fraction() >= 0.7f) continue;
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
        else setShelf("continue", "Reprendre la lecture", cards);
    }

    private void renderCollections() {
        if (App.repo().catalogue().isEmpty()) return;
        List<View> cards = new ArrayList<>();
        for (Collection col : collections) {
            List<Media> items = App.repo().collectionItems(col);
            if (items.isEmpty()) continue;
            Card c = new Card(main, 260, 146, true, true);
            c.data = col;
            c.caption("COLLECTION · " + items.size() + " titre" + (items.size() > 1 ? "s" : ""), col.title);
            String cover = App.repo().childProfile() ? "" : col.safeCover();
            if (cover.isEmpty()) cover = items.get(0).image();
            c.bindImage(Logic.tmdbSize(cover, "w780"), "");
            c.setOnClickListener(v -> main.push(new BrowseScreen(main, col)));
            cards.add(c);
        }
        if (cards.isEmpty()) removeShelf("collections");
        else setShelf("collections", "Tes univers à explorer", cards);
    }

    private void resume(Media cachedMedia, History h) { Actions.resume(main, cachedMedia.id, h); }

    private static final String[] ORDER = {"continue", "collections", "new", "movies", "series"};

    private int rank(String key) {
        for (int i = 0; i < ORDER.length; i++) if (ORDER[i].equals(key)) return i;
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
            if (code == KeyEvent.KEYCODE_DPAD_RIGHT) { if (focus == heroPlay) heroInfo.requestFocus(); return true; }
            if (code == KeyEvent.KEYCODE_DPAD_LEFT) { if (focus == heroInfo) heroPlay.requestFocus(); return true; }
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
