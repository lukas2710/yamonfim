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
import com.yamonfilm.tv.Models.Episode;
import com.yamonfilm.tv.Models.History;
import com.yamonfilm.tv.Models.Media;
import com.yamonfilm.tv.Models.Season;
import com.yamonfilm.tv.R;
import com.yamonfilm.tv.Screen;
import com.yamonfilm.tv.Ui;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static com.yamonfilm.tv.Ui.dp;

/** Fiche d'un film ou d'une série : lecture, reprise, saisons, épisodes vus. */
public final class DetailScreen extends Screen {
    private Media media;
    private History history;
    private Set<String> watched = new HashSet<>();
    private int season, episode;
    private boolean loaded;

    private ImageView backdrop;
    private TextView kicker, title, progressText, description, episodeLabel;
    private LinearLayout meta;
    private LinearLayout buttons;
    private TextView play, restart, watchedButton;
    private Shelf seasons, episodes;
    private Cards.VScroll scroll;
    private LinearLayout loadingRow;
    private View loadingSpinner;
    private TextView loadingText;

    public DetailScreen(MainActivity main, Media card) { super(main); media = card; }

    @Override protected View create() {
        FrameLayout root = new FrameLayout(main);
        root.setBackgroundColor(Ui.BG);
        int w = main.getResources().getDisplayMetrics().widthPixels, h = main.getResources().getDisplayMetrics().heightPixels;
        backdrop = new ImageView(main);
        backdrop.setScaleType(ImageView.ScaleType.CENTER_CROP);
        root.addView(backdrop, Ui.flp(w, (int) (h * 0.85f), Gravity.TOP | Gravity.END));
        View left = new View(main);
        left.setBackground(Ui.gradient(GradientDrawable.Orientation.LEFT_RIGHT, 0xFA060A15, 0xE6060A15, 0x80060A15, 0x00060A15));
        root.addView(left, Ui.flp((int) (w * 0.78f), Ui.MATCH, Gravity.START));
        View bottom = new View(main);
        bottom.setBackground(Ui.gradient(GradientDrawable.Orientation.TOP_BOTTOM, 0x00060A15, 0xCC060A15, 0xFF060A15));
        FrameLayout.LayoutParams bp = Ui.flp(Ui.MATCH, (int) (h * 0.5f), Gravity.TOP);
        bp.topMargin = (int) (h * 0.38f);
        root.addView(bottom, bp);

        scroll = new Cards.VScroll(main, false);
        LinearLayout c = scroll.content;
        c.setPadding(dp(Ui.SIDE), dp(54), dp(Ui.SIDE), dp(70));
        kicker = Ui.kicker(main, "", Ui.ACCENT);
        title = Ui.lines(Ui.text(main, 40, Ui.TEXT, Ui.W_BOLD), 2);
        title.setShadowLayer(dp(14), 0, dp(2), 0x99000000);
        meta = Ui.row(main);
        progressText = Ui.lines(Ui.text(main, 14, Ui.GREEN, Ui.W_SEMIBOLD), 1);
        description = Ui.lines(Ui.text(main, 17, 0xFFD9DCE3, Ui.W_REGULAR), 3);
        description.setLineSpacing(0, 1.32f);
        episodeLabel = Ui.lines(Ui.text(main, 15, Ui.MUTED, Ui.W_MEDIUM), 1);
        c.addView(kicker);
        c.addView(title, Ui.lp(Math.min(dp(660), w - dp(Ui.SIDE * 2)), Ui.WRAP, 0, dp(10), 0, 0));
        LinearLayout metaRow = Ui.row(main);
        metaRow.setGravity(Gravity.CENTER_VERTICAL);
        metaRow.addView(meta);
        metaRow.addView(progressText, Ui.lp(Ui.WRAP, Ui.WRAP, dp(8), 0, 0, 0));
        c.addView(metaRow, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(16), 0, 0));
        c.addView(description, Ui.lp(Math.min(dp(580), w - dp(Ui.SIDE * 2)), Ui.WRAP, 0, dp(16), 0, 0));
        c.addView(episodeLabel, Ui.lp(Math.min(dp(580), w - dp(Ui.SIDE * 2)), Ui.WRAP, 0, dp(14), 0, 0));
        buttons = Ui.row(main);
        Ui.noClip(buttons);
        buttons.setPadding(0, dp(6), 0, dp(6));
        play = Ui.button(main, "Regarder", R.drawable.ic_play, Ui.STYLE_PRIMARY);
        play.setOnClickListener(v -> playSelected());
        restart = Ui.button(main, "Recommencer", R.drawable.ic_restart, Ui.STYLE_NORMAL);
        restart.setOnClickListener(v -> restart());
        watchedButton = Ui.button(main, "Marquer comme vu", R.drawable.ic_check, Ui.STYLE_NORMAL);
        watchedButton.setOnClickListener(v -> toggleWatched());
        buttons.addView(play);
        buttons.addView(restart, Ui.lp(Ui.WRAP, Ui.WRAP, dp(14), 0, 0, 0));
        buttons.addView(watchedButton, Ui.lp(Ui.WRAP, Ui.WRAP, dp(14), 0, 0, 0));
        c.addView(buttons, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(22), 0, 0));
        loadingRow = Ui.row(main);
        loadingRow.setGravity(android.view.Gravity.CENTER_VERTICAL);
        loadingRow.setBackground(Ui.stroked(0x991A1D26, 0x1FFFFFFF, 1, 18));
        loadingRow.setPadding(dp(16), dp(12), dp(22), dp(12));
        loadingSpinner = new MainActivity.Spinner(main);
        loadingRow.addView(loadingSpinner, Ui.lp(dp(32), dp(32)));
        loadingText = Ui.label(main, media.isSeries() ? "Chargement des saisons et épisodes…" : "Chargement de la fiche…", 16, Ui.TEXT, true);
        loadingRow.addView(loadingText, Ui.lp(Ui.WRAP, Ui.WRAP, dp(14), 0, 0, 0));
        c.addView(loadingRow, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(22), 0, 0));
        seasons = new Shelf(main, "Saisons");
        seasons.setVisibility(View.GONE);
        c.addView(seasons, Ui.lp(Ui.MATCH, Ui.WRAP, 0, dp(26), 0, 0));
        episodes = new Shelf(main, "Épisodes");
        episodes.setVisibility(View.GONE);
        c.addView(episodes, Ui.lp(Ui.MATCH, Ui.WRAP, 0, dp(4), 0, 0));
        root.addView(scroll, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));

        App.images().load(backdrop, Logic.tmdbSize(media.image(), "w1280"), w, (int) (h * 0.85f));
        renderHeader();
        return root;
    }

    @Override protected String presenceAction() { return "Regarde un média"; }

    @Override protected void onShow(boolean first) { load(first); }
    @Override protected void onRefresh() { if (loaded) load(false); }

    private void load(boolean first) {
        final String id = media.id;
        final boolean needFull = first || !media.full;
        if (!loaded) {
            loadingRow.setVisibility(View.VISIBLE);
            loadingSpinner.setVisibility(View.VISIBLE);
            loadingText.setText(media.isSeries() ? "Chargement des saisons et épisodes…" : "Chargement de la fiche…");
        }
        io(() -> {
            App.repo().flushWrites(4000); // la lecture qui vient de se terminer est d'abord enregistrée
            // Les trois lectures partent en même temps pour réduire l'attente.
            java.util.concurrent.FutureTask<History> h = new java.util.concurrent.FutureTask<>(() -> App.repo().history(id));
            java.util.concurrent.FutureTask<Set<String>> k = new java.util.concurrent.FutureTask<>(() -> App.repo().watchedKeys(id));
            new Thread(h, "detail-history").start();
            new Thread(k, "detail-watched").start();
            Media full = needFull ? App.repo().media(id) : media;
            try { return new Object[]{full, h.get(), k.get()}; }
            catch (java.util.concurrent.ExecutionException ex) { throw ex.getCause() instanceof Exception ? (Exception) ex.getCause() : ex; }
        }, (r, e) -> {
            if (e != null) {
                fail(e);
                if (!loaded) {
                    loadingSpinner.setVisibility(View.GONE);
                    loadingText.setText("Impossible de charger la fiche. Appuie sur OK pour réessayer.");
                    play.setText("Réessayer");
                }
                return;
            }
            loadingRow.setVisibility(View.GONE);
            Media full = (Media) r[0];
            History h = (History) r[1];
            @SuppressWarnings("unchecked") Set<String> keys = (Set<String>) r[2];
            boolean firstLoad = !loaded;
            History previous = history;
            media = full;
            history = h;
            watched = keys;
            loaded = true;
            // La sélection suit la reprise au premier affichage, ou si la reprise a changé
            // (épisode lu ici ou sur un autre appareil) et que l'on n'est pas en train de choisir un épisode.
            boolean moved = h != null && (previous == null || previous.seasonIdx != h.seasonIdx || previous.episodeIdx != h.episodeIdx);
            boolean browsing = MainActivity.isInside(main.getCurrentFocus(), episodes) || MainActivity.isInside(main.getCurrentFocus(), seasons);
            if (firstLoad || (moved && !browsing)) {
                if (h != null && media.hasEpisodes() && media.episode(h.seasonIdx, h.episodeIdx) != null) { season = h.seasonIdx; episode = h.episodeIdx; }
                else if (firstLoad) { season = 0; episode = 0; }
            }
            renderHeader();
            renderSeasons();
            renderEpisodes(firstLoad);
            if (firstLoad) {
                // Série : la sélection arrive directement sur l'épisode à regarder, à choisir avant la lecture.
                if (isSeries() && episodes.count() > 0) {
                    episodes.lastIndex = Math.min(episode, episodes.count() - 1);
                    episodes.post(() -> { if (alive() && main.top() == this && !main.dialogOpen()) episodes.focusLast(); });
                } else play.requestFocus();
            }
        });
    }

    // ------------------------------------------------------------ Affichage

    private boolean isSeries() { return media.hasEpisodes(); }

    private boolean resumeSelected() { return history != null && history.seasonIdx == season && history.episodeIdx == episode; }

    private void renderHeader() {
        boolean series = isSeries();
        StringBuilder k = new StringBuilder(media.isSeries() ? "SÉRIE" : "FILM");
        if (series) k.append(" · ").append(media.seasons.size()).append(media.seasons.size() > 1 ? " SAISONS" : " SAISON");
        else if (media.runtime > 0) k.append(" · ").append(media.runtime / 60 > 0 ? (media.runtime / 60) + " H " + String.format("%02d", media.runtime % 60) : media.runtime + " MIN");
        kicker.setText(k);
        title.setText(media.title);
        meta.removeAllViews();
        for (int i = 0; i < media.genres.size() && i < 4; i++) meta.addView(Ui.tag(main, media.genres.get(i)), Ui.lp(Ui.WRAP, Ui.WRAP, 0, 0, dp(8), 0));
        meta.setVisibility(meta.getChildCount() == 0 ? View.GONE : View.VISIBLE);
        description.setText(media.description.isEmpty() ? "Aucune description pour le moment." : media.description);
        if (!loaded) { play.setText("Chargement…"); restart.setVisibility(View.GONE); watchedButton.setVisibility(View.GONE); episodeLabel.setVisibility(View.GONE); progressText.setVisibility(View.GONE); return; }
        if (series) {
            int total = media.totalEpisodes(), seen = 0;
            for (int s = 0; s < media.seasons.size(); s++) for (int e = 0; e < media.seasons.get(s).episodes.size(); e++) if (watched.contains(Logic.epKey(s, e))) seen++;
            progressText.setText(total > 0 && seen == total ? "✓ Série terminée" : seen + " / " + total + " épisodes vus");
            progressText.setTextColor(seen == total && total > 0 ? Ui.GREEN : Ui.MUTED);
            progressText.setVisibility(View.VISIBLE);
            Season cs = media.seasons.get(Math.min(season, media.seasons.size() - 1));
            Episode ep = media.episode(season, episode);
            play.setText((resumeSelected() ? "Reprendre" : "Lecture") + " S" + cs.number + " · É" + (ep == null ? 1 : ep.number));
            episodeLabel.setText("Saison " + cs.number + " · Épisode " + (ep == null ? 1 : ep.number) + (ep != null && !ep.title.isEmpty() ? " — " + ep.title : ""));
            episodeLabel.setVisibility(View.VISIBLE);
            restart.setVisibility(history != null && (history.seasonIdx != 0 || history.episodeIdx != 0) ? View.VISIBLE : View.GONE);
            boolean seasonDone = seasonSeen(season) == cs.episodes.size() && !cs.episodes.isEmpty();
            watchedButton.setText(seasonDone ? "Saison " + cs.number + " vue" : "Marquer la saison " + cs.number + " vue");
            watchedButton.setVisibility(View.VISIBLE);
        } else {
            boolean seen = watched.contains("movie_main");
            progressText.setText("✓ Déjà vu");
            progressText.setTextColor(Ui.GREEN);
            progressText.setVisibility(seen ? View.VISIBLE : View.GONE);
            play.setText(history != null ? "Reprendre" : "Regarder");
            if (history != null && history.currentTime > 30) {
                episodeLabel.setText("Reprise à " + Logic.formatTime(history.currentTime) + (history.duration > 0 ? " sur " + Logic.formatTime(history.duration) : ""));
                episodeLabel.setVisibility(View.VISIBLE);
            } else episodeLabel.setVisibility(View.GONE);
            restart.setVisibility(history != null && history.currentTime > 30 ? View.VISIBLE : View.GONE);
            restart.setText("Depuis le début");
            watchedButton.setText(seen ? "Vu ✓" : "Marquer comme vu");
            watchedButton.setVisibility(View.VISIBLE);
        }
    }

    private int seasonSeen(int s) {
        if (s >= media.seasons.size()) return 0;
        int n = 0;
        for (int e = 0; e < media.seasons.get(s).episodes.size(); e++) if (watched.contains(Logic.epKey(s, e))) n++;
        return n;
    }

    private void renderSeasons() {
        if (!isSeries() || media.seasons.size() < 2) { seasons.setVisibility(View.GONE); return; }
        seasons.setVisibility(View.VISIBLE);
        int focused = MainActivity.isInside(main.getCurrentFocus(), seasons) ? seasons.indexOf(main.getCurrentFocus()) : -1;
        seasons.scroll.items.removeAllViews();
        for (int s = 0; s < media.seasons.size(); s++) {
            final int index = s;
            Season se = media.seasons.get(s);
            int seen = seasonSeen(s);
            boolean done = seen == se.episodes.size() && !se.episodes.isEmpty();
            TextView chip = Ui.chip(main, (done ? "✓ " : "") + "Saison " + se.number + (!done && seen > 0 ? "  " + seen + "/" + se.episodes.size() : ""));
            chip.setActivated(s == season);
            chip.setOnClickListener(v -> selectSeason(index));
            chip.setLayoutParams(new LinearLayout.LayoutParams(Ui.WRAP, Ui.WRAP));
            seasons.add(chip, 12);
        }
        seasons.lastIndex = season;
        if (focused >= 0) seasons.focus(focused);
    }

    private void selectSeason(int s) {
        if (s == season) { episodes.focus(episode < episodes.count() ? episode : 0); return; }
        season = s;
        episode = 0;
        renderHeader();
        for (int i = 0; i < seasons.count(); i++) seasons.item(i).setActivated(i == s);
        renderEpisodes(false);
    }

    private void renderEpisodes(boolean scrollToSelected) {
        if (!isSeries()) { episodes.setVisibility(View.GONE); return; }
        episodes.setVisibility(View.VISIBLE);
        Season se = media.seasons.get(Math.min(season, media.seasons.size() - 1));
        episodes.title.setText("Choisis ton épisode · Saison " + se.number + "   (" + seasonSeen(season) + " / " + se.episodes.size() + " vus)");
        int focused = MainActivity.isInside(main.getCurrentFocus(), episodes) ? episodes.indexOf(main.getCurrentFocus()) : -1;
        episodes.scroll.items.removeAllViews();
        for (int e = 0; e < se.episodes.size(); e++) {
            final int index = e;
            Episode ep = se.episodes.get(e);
            Card card = new Card(main, 250, 140, true, true);
            card.data = e;
            card.caption("ÉPISODE " + ep.number + (ep.runtime > 0 ? " · " + ep.runtime + " min" : ""), ep.label());
            String img = !ep.still.isEmpty() ? ep.still : !se.poster.isEmpty() ? se.poster : media.image();
            card.bindImage(Logic.tmdbSize(img, "w500"), "");
            boolean seen = watched.contains(Logic.epKey(season, e));
            boolean current = history != null && history.seasonIdx == season && history.episodeIdx == e;
            if (seen) { card.badge("✓ VU", 0xE6168A45); card.image.setColorFilter(0x80000000, android.graphics.PorterDuff.Mode.SRC_ATOP); }
            else if (current) card.badge("EN COURS", Ui.ACCENT);
            if (current && !seen) card.progress(history.fraction());
            card.setOnClickListener(v -> { episode = index; renderHeader(); Actions.play(main, media, season, index, resumeTime(season, index)); });
            episodes.add(card, 18);
        }
        episodes.lastIndex = Math.min(episode, Math.max(0, episodes.count() - 1));
        if (focused >= 0) episodes.focus(Math.min(focused, episodes.count() - 1));
        else if (scrollToSelected) {
            final View target = episodes.item(episodes.lastIndex);
            if (target != null) episodes.scroll.post(() -> episodes.scroll.reveal(target, false));
        }
    }

    private long resumeTime(int s, int e) {
        return history != null && history.seasonIdx == s && history.episodeIdx == e ? history.currentTime : 0;
    }

    // ------------------------------------------------------------ Actions

    private void playSelected() {
        if (!loaded) { load(true); return; }
        if (isSeries()) Actions.play(main, media, season, episode, resumeTime(season, episode));
        else Actions.play(main, media, 0, 0, history != null ? history.currentTime : 0);
    }

    private void restart() {
        if (!isSeries()) { Actions.play(main, media, 0, 0, 0); return; }
        season = 0; episode = 0;
        final Media m = media;
        io(() -> { App.repo().saveHistory(m, 0, 0, 0, 0); return App.repo().history(m.id); }, (h, e) -> {
            if (e != null) { fail(e); return; }
            history = h;
            renderHeader(); renderSeasons(); renderEpisodes(true);
            play.requestFocus();
            main.toast("Retour au premier épisode");
        });
    }

    private void toggleWatched() {
        if (!loaded) return;
        if (!isSeries()) { setWatched(Collections.singletonList("movie_main"), !watched.contains("movie_main")); return; }
        Season se = media.seasons.get(season);
        boolean done = seasonSeen(season) == se.episodes.size();
        List<String> keys = new ArrayList<>();
        for (int e = 0; e < se.episodes.size(); e++) keys.add(Logic.epKey(season, e));
        setWatched(keys, !done);
    }

    private void setWatched(List<String> keys, boolean value) {
        if (value) watched.addAll(keys); else watched.removeAll(keys);
        renderHeader(); renderSeasons(); renderEpisodes(false);
        final String id = media.id;
        io(() -> { App.repo().setWatched(id, keys, value); return true; }, (ok, e) -> { if (e != null) fail(e); });
    }

    @Override protected boolean onLongPress(View focused) {
        if (!loaded || !isSeries()) return false;
        if (MainActivity.isInside(focused, episodes) && focused instanceof Card) {
            final int e = (Integer) ((Card) focused).data;
            final String key = Logic.epKey(season, e);
            boolean seen = watched.contains(key);
            Episode ep = media.episode(season, e);
            Dialogs.actions(main, "Épisode " + (ep == null ? e + 1 : ep.number) + (ep != null && !ep.title.isEmpty() ? " — " + ep.title : ""),
                    new String[]{"Lire cet épisode", seen ? "Marquer comme non vu" : "Marquer comme vu", "Tout marquer vu jusqu'ici"},
                    new int[]{R.drawable.ic_play, R.drawable.ic_check, R.drawable.ic_check}, i -> {
                        if (i == 0) { episode = e; renderHeader(); Actions.play(main, media, season, e, resumeTime(season, e)); }
                        else if (i == 1) setWatched(Collections.singletonList(key), !seen);
                        else {
                            List<String> keys = new ArrayList<>();
                            for (int s = 0; s < media.seasons.size(); s++) for (int x = 0; x < media.seasons.get(s).episodes.size(); x++)
                                if (s < season || (s == season && x <= e)) keys.add(Logic.epKey(s, x));
                            setWatched(keys, true);
                        }
                    });
            return true;
        }
        if (MainActivity.isInside(focused, seasons)) {
            int s = seasons.indexOf(focused);
            if (s < 0) return false;
            Season se = media.seasons.get(s);
            boolean done = seasonSeen(s) == se.episodes.size();
            Dialogs.actions(main, "Saison " + se.number, new String[]{done ? "Marquer la saison comme non vue" : "Marquer la saison comme vue"}, new int[]{R.drawable.ic_check}, i -> {
                List<String> keys = new ArrayList<>();
                for (int e = 0; e < se.episodes.size(); e++) keys.add(Logic.epKey(s, e));
                setWatched(keys, !done);
            });
            return true;
        }
        return false;
    }

    // ------------------------------------------------------------ Télécommande

    @Override protected boolean onKey(KeyEvent e) {
        int code = e.getKeyCode();
        if (code != KeyEvent.KEYCODE_DPAD_UP && code != KeyEvent.KEYCODE_DPAD_DOWN && code != KeyEvent.KEYCODE_DPAD_LEFT && code != KeyEvent.KEYCODE_DPAD_RIGHT) return false;
        View f = main.getCurrentFocus();
        List<View> sections = new ArrayList<>();
        sections.add(buttons);
        if (seasons.getVisibility() == View.VISIBLE) sections.add(seasons);
        if (episodes.getVisibility() == View.VISIBLE && episodes.count() > 0) sections.add(episodes);
        int current = -1;
        for (int i = 0; i < sections.size(); i++) if (MainActivity.isInside(f, sections.get(i))) current = i;
        if (current < 0) return false;
        if (code == KeyEvent.KEYCODE_DPAD_DOWN || code == KeyEvent.KEYCODE_DPAD_UP) {
            int target = current + (code == KeyEvent.KEYCODE_DPAD_DOWN ? 1 : -1);
            if (target < 0 || target >= sections.size()) return true;
            View s = sections.get(target);
            if (s == buttons) { play.requestFocus(); scroll.smoothScrollTo(0, 0); }
            else ((Shelf) s).focusLast();
            return true;
        }
        View section = sections.get(current);
        if (section == buttons) {
            List<View> visible = new ArrayList<>();
            for (int i = 0; i < buttons.getChildCount(); i++) if (buttons.getChildAt(i).getVisibility() == View.VISIBLE) visible.add(buttons.getChildAt(i));
            int index = visible.indexOf(f);
            int next = index + (code == KeyEvent.KEYCODE_DPAD_RIGHT ? 1 : -1);
            if (index >= 0 && next >= 0 && next < visible.size()) visible.get(next).requestFocus();
            return true;
        }
        if (section instanceof Shelf) {
            Shelf shelf = (Shelf) section;
            int index = shelf.indexOf(f);
            if (code == KeyEvent.KEYCODE_DPAD_RIGHT && index + 1 < shelf.count()) shelf.focus(index + 1);
            if (code == KeyEvent.KEYCODE_DPAD_LEFT && index > 0) shelf.focus(index - 1);
            return true;
        }
        return false;
    }

    @Override protected View defaultFocus() { return play; }
}
