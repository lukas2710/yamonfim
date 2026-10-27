package com.yamonfilm.tv.screens;

import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.yamonfilm.tv.Actions;
import com.yamonfilm.tv.App;
import com.yamonfilm.tv.Cards;
import com.yamonfilm.tv.Cards.Card;
import com.yamonfilm.tv.Dialogs;
import com.yamonfilm.tv.Logic;
import com.yamonfilm.tv.MainActivity;
import com.yamonfilm.tv.Models.History;
import com.yamonfilm.tv.Models.Media;
import com.yamonfilm.tv.R;
import com.yamonfilm.tv.Screen;
import com.yamonfilm.tv.Ui;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.yamonfilm.tv.Ui.dp;

/** Historique du profil actif (watch_history + user_watched). */
public final class HistoryScreen extends Screen {
    private LinearLayout list;
    private TextView status, clear;

    public HistoryScreen(MainActivity main) { super(main); }

    @Override protected String railId() { return "history"; }

    @Override protected View create() {
        FrameLayout root = new FrameLayout(main);
        root.setBackgroundColor(Ui.BG);
        Cards.VScroll scroll = new Cards.VScroll(main, false);
        scroll.content.setPadding(dp(Ui.SIDE), dp(Ui.TOP), dp(Ui.SIDE), dp(40));
        LinearLayout header = Ui.row(main);
        header.setGravity(android.view.Gravity.CENTER_VERTICAL);
        Ui.noClip(header);
        header.addView(Ui.label(main, "Historique", 36, Ui.TEXT, Ui.W_BOLD), new LinearLayout.LayoutParams(0, Ui.WRAP, 1f));
        clear = Ui.button(main, "Effacer l'historique", R.drawable.ic_trash, Ui.STYLE_GHOST);
        clear.setVisibility(View.GONE);
        clear.setOnClickListener(v -> Dialogs.confirm(main, "Effacer tout l'historique ?", "Les progressions et épisodes vus de ce profil seront supprimés.", "Effacer", () ->
                io(() -> { App.repo().clearHistory(); return true; }, (ok, e) -> { if (e != null) fail(e); else { main.toast("Historique du profil effacé"); onShow(false); } })));
        header.addView(clear);
        scroll.content.addView(header);
        status = Ui.label(main, "Chargement…", 16, Ui.MUTED, false);
        scroll.content.addView(status, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(8), 0, dp(22)));
        list = Ui.column(main);
        Ui.noClip(list);
        scroll.content.addView(list);
        root.addView(scroll, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        return root;
    }

    @Override protected void onShow(boolean first) {
        io(() -> { App.repo().flushWrites(4000); return new Object[]{App.repo().history(), App.repo().allWatched()}; }, (r, e) -> {
            if (e != null) { status.setText("L'historique ne peut pas être chargé."); fail(e); return; }
            @SuppressWarnings("unchecked") List<History> rows = (List<History>) r[0];
            @SuppressWarnings("unchecked") Map<String, Set<String>> watched = (Map<String, Set<String>>) r[1];
            List<View> cards = new ArrayList<>();
            for (History h : rows) {
                Media m = App.repo().cached(h.mediaId);
                if (m == null) continue;
                Card card = new Card(main, 270, 152, true, true);
                card.data = h;
                Set<String> seen = watched.get(h.mediaId);
                String sub = m.isSeries() ? "S" + h.seasonNumber + " · É" + h.episodeNumber + (seen != null ? " · " + seen.size() + " vu" + (seen.size() > 1 ? "s" : "") : "") : "FILM";
                card.caption(sub, m.title);
                card.bindImage(Logic.tmdbSize(m.image(), "w780"), m.title);
                boolean done = !m.isSeries() && seen != null && seen.contains("movie_main");
                if (done) card.badge("✓ VU", 0xE6168A45); else card.progress(h.fraction());
                card.setOnClickListener(v -> main.openMedia(m));
                cards.add(card);
            }
            View focus = main.getCurrentFocus();
            boolean hadFocus = MainActivity.isInside(focus, list);
            int focusedIndex = -1;
            if (hadFocus) for (int i = 0, n = 0; i < list.getChildCount(); i++) {
                LinearLayout line = (LinearLayout) list.getChildAt(i);
                for (int j = 0; j < line.getChildCount(); j++, n++) if (MainActivity.isInside(focus, line.getChildAt(j))) focusedIndex = n;
            }
            Cards.wrap(list, cards, 3, 20);
            clear.setVisibility(cards.isEmpty() ? View.GONE : View.VISIBLE);
            status.setText(cards.isEmpty() ? "Rien pour le moment. Les titres que tu regardes apparaîtront ici." : "OK pour ouvrir la fiche · appui long pour reprendre directement");
            if (!cards.isEmpty() && (first || hadFocus)) cards.get(Math.max(0, Math.min(cards.size() - 1, focusedIndex))).requestFocus();
        });
    }

    @Override protected void onRefresh() { onShow(false); }

    private void resume(Media cached, History h) { Actions.resume(main, cached.id, h); }

    @Override protected boolean onLongPress(View focused) {
        if (!(focused instanceof Card) || !(((Card) focused).data instanceof History)) return false;
        History h = (History) ((Card) focused).data;
        Media m = App.repo().cached(h.mediaId);
        if (m == null) return false;
        Dialogs.actions(main, m.title, new String[]{"Reprendre la lecture", "Voir la fiche", "Retirer de l'historique"}, new int[]{R.drawable.ic_play, R.drawable.ic_info, R.drawable.ic_trash}, i -> {
            if (i == 0) resume(m, h);
            else if (i == 1) main.openMedia(m);
            else io(() -> { App.repo().removeFromHistory(m.id); return true; }, (ok, e) -> { if (e != null) fail(e); else { main.toast("Retiré de l'historique"); onShow(false); } });
        });
        return true;
    }

    @Override protected View defaultFocus() {
        if (list.getChildCount() == 0) return clear.getVisibility() == View.VISIBLE ? clear : null;
        return ((LinearLayout) list.getChildAt(0)).getChildAt(0);
    }
}
