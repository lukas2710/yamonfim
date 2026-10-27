package com.yamonfilm.tv.screens;

import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.yamonfilm.tv.App;
import com.yamonfilm.tv.Cards;
import com.yamonfilm.tv.Dialogs;
import com.yamonfilm.tv.Keyboard;
import com.yamonfilm.tv.MainActivity;
import com.yamonfilm.tv.Models.Request;
import com.yamonfilm.tv.Models.TmdbResult;
import com.yamonfilm.tv.Screen;
import com.yamonfilm.tv.Ui;

import java.util.List;

import static com.yamonfilm.tv.Ui.dp;

/** Demander un film ou une série absent du catalogue (table requests). */
public final class RequestsScreen extends Screen {
    private String type = "movie";
    private Keyboard keyboard;
    private TextView field, info, movieChip, seriesChip;
    private LinearLayout results;
    private int generation;
    private boolean submitting;
    private final Runnable runSearch = this::search;

    public RequestsScreen(MainActivity main) { super(main); }

    @Override protected String railId() { return "requests"; }

    @Override protected View create() {
        FrameLayout root = new FrameLayout(main);
        root.setBackgroundColor(Ui.BG);
        LinearLayout row = Ui.row(main);
        row.setPadding(dp(Ui.SIDE), dp(Ui.TOP), dp(Ui.SIDE - 10), 0);
        Ui.noClip(row);
        LinearLayout left = Ui.column(main);
        Ui.noClip(left);
        left.addView(Ui.label(main, "Demandes", 34, Ui.TEXT, Ui.W_BOLD));
        left.addView(Ui.lines(Ui.label(main, "Un titre manque ? Demande-le à l'équipe.", 15, Ui.MUTED, false), 2), Ui.lp(dp(330), Ui.WRAP, 0, dp(6), 0, dp(12)));
        LinearLayout types = Ui.row(main);
        Ui.noClip(types);
        movieChip = Ui.chip(main, "Film");
        seriesChip = Ui.chip(main, "Série");
        movieChip.setActivated(true);
        movieChip.setOnClickListener(v -> setType("movie"));
        seriesChip.setOnClickListener(v -> setType("series"));
        types.addView(movieChip);
        types.addView(seriesChip, Ui.lp(Ui.WRAP, Ui.WRAP, dp(10), 0, 0, 0));
        left.addView(types);
        field = Ui.lines(Ui.text(main, 20, Ui.TEXT, true), 1);
        field.setBackground(Ui.round(0xFF1C1F28, 14));
        field.setPadding(dp(18), dp(12), dp(18), dp(12));
        left.addView(field, Ui.lp(dp(330), Ui.WRAP, 0, dp(12), 0, dp(12)));
        keyboard = new Keyboard(main, text -> render());
        left.addView(keyboard);
        row.addView(left, Ui.lp(dp(350), Ui.MATCH));

        Cards.VScroll scroll = new Cards.VScroll(main, false);
        scroll.content.setPadding(dp(10), dp(8), dp(20), dp(40));
        info = Ui.lines(Ui.label(main, "Dernières demandes", 18, Ui.MUTED, true), 2);
        scroll.content.addView(info, Ui.lp(Ui.MATCH, Ui.WRAP, 0, 0, 0, dp(12)));
        results = Ui.column(main);
        Ui.noClip(results);
        scroll.content.addView(results);
        row.addView(scroll, new LinearLayout.LayoutParams(0, Ui.MATCH, 1f));
        root.addView(row, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        render();
        return root;
    }

    private void setType(String t) {
        type = t;
        movieChip.setActivated(t.equals("movie"));
        seriesChip.setActivated(t.equals("series"));
        render();
    }

    private void render() {
        String q = keyboard.text();
        field.setText(q.isEmpty() ? (type.equals("movie") ? "Titre du film…" : "Titre de la série…") : q + "▏");
        field.setTextColor(q.isEmpty() ? Ui.DIM : Ui.TEXT);
        App.MAIN.removeCallbacks(runSearch);
        App.MAIN.postDelayed(runSearch, q.trim().length() < 2 ? 0 : 350);
    }

    private void search() {
        final String q = keyboard.text().trim();
        final int gen = ++generation;
        final String t = type;
        if (q.length() < 2) {
            info.setText("Dernières demandes");
            io(() -> App.repo().requests(), (list, e) -> { if (gen == generation) showRequests(list, e); });
            return;
        }
        info.setText("Recherche de « " + q + " »…");
        io(() -> App.repo().searchTmdb(q, t), (list, e) -> {
            if (gen != generation) return;
            if (e != null) { info.setText(App.message(e)); results.removeAllViews(); return; }
            info.setText(list.isEmpty() ? "Aucun résultat pour « " + q + " »." : "Choisis le titre à demander");
            results.removeAllViews();
            for (TmdbResult r : list) {
                View item = item(r.poster, r.title + (r.year.isEmpty() ? "" : " (" + r.year + ")"), r.overview, null, 0);
                item.setOnClickListener(v -> confirm(r, t));
                results.addView(item, Ui.lp(Ui.MATCH, Ui.WRAP, 0, 0, 0, dp(10)));
            }
        });
    }

    private void showRequests(List<Request> list, Exception e) {
        results.removeAllViews();
        if (e != null) { info.setText("Les demandes ne peuvent pas être chargées."); return; }
        String me = App.repo().userId();
        int shown = 0;
        for (Request r : list) {
            if (shown++ >= 30) break;
            int color = "ajoute".equals(r.status) ? Ui.GREEN : "refuse".equals(r.status) ? 0xFFFF7A7A : "en_cours".equals(r.status) ? Ui.GOLD : Ui.MUTED;
            String who = r.userId.equals(me) ? " · ta demande" : "";
            View item = item(r.poster, r.title, ("series".equals(r.type) ? "Série" : "Film") + who, r.statusLabel(), color);
            results.addView(item, Ui.lp(Ui.MATCH, Ui.WRAP, 0, 0, 0, dp(10)));
        }
        if (list.isEmpty()) info.setText("Aucune demande pour le moment. Tape un titre pour en ajouter une.");
    }

    private View item(String poster, String title, String sub, String status, int statusColor) {
        LinearLayout item = Ui.row(main);
        item.setGravity(Gravity.CENTER_VERTICAL);
        item.setFocusable(true);
        item.setClickable(true);
        item.setPadding(dp(10), dp(10), dp(16), dp(10));
        android.graphics.drawable.StateListDrawable bg = new android.graphics.drawable.StateListDrawable();
        android.graphics.drawable.GradientDrawable on = Ui.round(0xFF262A35, 14);
        on.setStroke(dp(3), Ui.FOCUS);
        bg.addState(Ui.focusedState(), on);
        bg.addState(new int[]{}, Ui.round(0xFF15171E, 14));
        item.setBackground(bg);
        ImageView img = new ImageView(main);
        img.setScaleType(ImageView.ScaleType.CENTER_CROP);
        img.setBackground(Ui.round(0xFF22252F, 8));
        Ui.clipRound(img, 8);
        item.addView(img, Ui.lp(dp(54), dp(80)));
        App.images().load(img, com.yamonfilm.tv.Logic.tmdbSize(poster, "w185"), dp(54), dp(80));
        LinearLayout text = Ui.column(main);
        text.addView(Ui.lines(Ui.label(main, title, 17, Ui.TEXT, true), 1));
        if (sub != null && !sub.isEmpty()) text.addView(Ui.lines(Ui.label(main, sub, 13, Ui.MUTED, false), 2), Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(4), 0, 0));
        item.addView(text, new LinearLayout.LayoutParams(0, Ui.WRAP, 1f));
        ((LinearLayout.LayoutParams) text.getLayoutParams()).leftMargin = dp(14);
        if (status != null) item.addView(Ui.label(main, status, 14, statusColor, true), Ui.lp(Ui.WRAP, Ui.WRAP, dp(12), 0, 0, 0));
        Ui.onFocus(item, 1.02f, null);
        return item;
    }

    private void confirm(TmdbResult r, String t) {
        Dialogs.confirm(main, "Demander « " + r.title + " » ?", (t.equals("movie") ? "Film" : "Série") + (r.year.isEmpty() ? "" : " · " + r.year) + "\nL'équipe sera prévenue et tu pourras suivre son statut ici.", "Demander", () -> {
            if (submitting) return;
            submitting = true;
            main.toast("Vérification…");
            io(() -> { App.repo().addRequest(r, t); return true; }, (ok, e) -> {
                submitting = false;
                if (e != null) { fail(e); return; }
                main.toast("« " + r.title + " » a bien été demandé.");
                keyboard.clear();
                keyboard.firstKey().requestFocus();
            });
        });
    }

    @Override protected void onShow(boolean first) { if (!first) search(); }

    @Override protected boolean onKey(KeyEvent e) {
        if (e.getKeyCode() == KeyEvent.KEYCODE_DEL) { keyboard.erase(); return true; }
        int ch = e.getUnicodeChar();
        if (ch > 0 && (Character.isLetterOrDigit(ch) || ch == ' ')) { keyboard.type(String.valueOf((char) Character.toLowerCase(ch))); return true; }
        return false;
    }

    @Override protected View defaultFocus() { return keyboard.firstKey(); }
    @Override protected void onDestroy() { App.MAIN.removeCallbacks(runSearch); }
}
