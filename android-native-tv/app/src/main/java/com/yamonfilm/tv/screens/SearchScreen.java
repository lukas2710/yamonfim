package com.yamonfilm.tv.screens;

import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.widget.AdapterView;
import android.widget.FrameLayout;
import android.widget.GridView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.yamonfilm.tv.App;
import com.yamonfilm.tv.Cards;
import com.yamonfilm.tv.Keyboard;
import com.yamonfilm.tv.Logic;
import com.yamonfilm.tv.MainActivity;
import com.yamonfilm.tv.Models.Media;
import com.yamonfilm.tv.R;
import com.yamonfilm.tv.Screen;
import com.yamonfilm.tv.Ui;

import java.util.ArrayList;
import java.util.List;

import static com.yamonfilm.tv.Ui.dp;

/**
 * Recherche dans le catalogue (même logique que lib/search.ts).
 * Navigation explicite : clavier ⇄ résultats avec gauche/droite, Haut vers la barre du haut.
 */
public final class SearchScreen extends Screen {
    private Keyboard keyboard;
    private TextView field, info, requestButton;
    private GridView grid;
    private Cards.MediaAdapter adapter;
    private int generation, columns;
    private int selectedYear;
    private final Runnable runSearch = this::search;

    public SearchScreen(MainActivity main) { super(main); }

    @Override protected String railId() { return "search"; }

    @Override protected View create() {
        FrameLayout root = new FrameLayout(main);
        root.setBackground(Ui.screenBackground());
        LinearLayout row = Ui.row(main);
        row.setPadding(dp(Ui.SIDE), dp(Ui.TOP), dp(Ui.SIDE - 10), 0);
        Ui.noClip(row);

        LinearLayout left = Ui.column(main);
        Ui.noClip(left);
        LinearLayout fieldBox = Ui.row(main);
        fieldBox.setGravity(Gravity.CENTER_VERTICAL);
        fieldBox.setBackground(Ui.stroked(0x14FFFFFF, 0x26FFFFFF, 1, 16));
        fieldBox.setPadding(dp(16), 0, dp(16), 0);
        fieldBox.addView(Ui.icon(main, R.drawable.ic_search, Ui.MUTED, 22));
        field = Ui.lines(Ui.text(main, 19, Ui.TEXT, Ui.W_MEDIUM), 1);
        fieldBox.addView(field, Ui.lp(Ui.MATCH, Ui.WRAP, dp(12), 0, 0, 0));
        left.addView(fieldBox, Ui.lp(dp(330), dp(58), 0, 0, 0, dp(18)));
        keyboard = new Keyboard(main, text -> render());
        left.addView(keyboard);
        TextView yearButton = Ui.button(main, "Année : toutes", 0, Ui.STYLE_NORMAL);
        yearButton.setOnClickListener(v -> {
            java.util.TreeSet<Integer> years = new java.util.TreeSet<>(java.util.Collections.reverseOrder());
            for (Media m : App.repo().catalogue()) if (m.releaseYear > 0) years.add(m.releaseYear);
            java.util.List<Integer> options = new ArrayList<>(); options.add(0); options.addAll(years);
            String[] labels = new String[options.size()]; for (int i=0; i<options.size(); i++) labels[i] = options.get(i) == 0 ? "Toutes les années" : String.valueOf(options.get(i));
            new android.app.AlertDialog.Builder(main).setTitle("Année de sortie").setItems(labels, (dialog, index) -> { selectedYear = options.get(index); yearButton.setText("Année : " + labels[index]); search(); }).show();
        });
        LinearLayout actions = Ui.row(main);
        Ui.noClip(actions);
        actions.addView(yearButton);
        boolean voice = main.voiceAvailable();
        if (voice) {
            TextView voiceButton = Ui.button(main, "Dicter", R.drawable.ic_mic, Ui.STYLE_NORMAL);
            voiceButton.setOnClickListener(v -> startVoice());
            actions.addView(voiceButton, Ui.lp(Ui.WRAP, Ui.WRAP, dp(10), 0, 0, 0));
        }
        left.addView(actions, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(12), 0, 0));
        TextView hint = Ui.lines(Ui.label(main, voice ? "Astuce : « Dicter » ou la touche micro de la télécommande, puis dis le titre. Les chiffres de la télécommande fonctionnent aussi." : "Les touches chiffres de la télécommande fonctionnent aussi.", 12, Ui.DIM, Ui.W_REGULAR), 3);
        left.addView(hint, Ui.lp(dp(330), Ui.WRAP, 0, dp(14), 0, 0));
        row.addView(left, Ui.lp(dp(350), Ui.MATCH));

        LinearLayout right = Ui.column(main);
        Ui.noClip(right);
        info = Ui.lines(Ui.label(main, "Suggestions", 20, Ui.TEXT, Ui.W_SEMIBOLD), 1);
        right.addView(info, Ui.lp(Ui.MATCH, Ui.WRAP, dp(10), dp(4), 0, dp(4)));
        // Rien trouvé : on propose de demander le titre, déjà rempli dans l'écran Demandes.
        requestButton = Ui.button(main, "Demander ce titre", R.drawable.ic_request, Ui.STYLE_PRIMARY);
        requestButton.setVisibility(View.GONE);
        requestButton.setOnClickListener(v -> {
            String q = keyboard.text().trim();
            main.openRail("requests");
            if (main.top() instanceof RequestsScreen) ((RequestsScreen) main.top()).prefill(q);
        });
        right.addView(requestButton, Ui.lp(Ui.WRAP, Ui.WRAP, dp(10), dp(14), 0, 0));
        int widthDp = (int) (main.getResources().getDisplayMetrics().widthPixels / main.getResources().getDisplayMetrics().density);
        columns = Math.max(2, (widthDp - Ui.SIDE - 350 - (Ui.SIDE - 10)) / (Cards.POSTER_W + 22));
        grid = Cards.grid(main, columns, false);
        adapter = new Cards.MediaAdapter(false);
        grid.setAdapter(adapter);
        grid.setOnItemClickListener((p, v, position, id) -> main.openMedia(adapter.getItem(position)));
        grid.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> p, View v, int position, long id) { describe(adapter.getItem(position)); }
            @Override public void onNothingSelected(AdapterView<?> p) { }
        });
        grid.setOnFocusChangeListener((v, has) -> {
            if (!has) updateInfo();
            else if (grid.getSelectedItem() instanceof Media) describe((Media) grid.getSelectedItem());
        });
        right.addView(grid, new LinearLayout.LayoutParams(Ui.MATCH, 0, 1f));
        row.addView(right, new LinearLayout.LayoutParams(0, Ui.MATCH, 1f));
        root.addView(row, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        render();
        return root;
    }

    private void describe(Media m) { info.setText(m.title + (m.isSeries() ? "  ·  Série" : "  ·  Film")); }

    private void render() {
        String q = keyboard.text();
        field.setText(q.isEmpty() ? "Titre, genre…" : q + "▏");
        field.setTextColor(q.isEmpty() ? Ui.DIM : Ui.TEXT);
        App.MAIN.removeCallbacks(runSearch);
        App.MAIN.postDelayed(runSearch, q.isEmpty() ? 0 : 140);
    }

    private void search() {
        final String q = keyboard.text();
        final int gen = ++generation;
        final List<Media> all = App.repo().catalogue();
        final int year = selectedYear;
        App.io(this, () -> {
            List<Media> out = new ArrayList<>();
            if (q.trim().isEmpty()) { for (int i = 0; i < all.size() && out.size() < 40; i++) if (year == 0 || all.get(i).releaseYear == year) out.add(all.get(i)); return out; }
            // Meilleurs résultats d'abord (titre exact, début du titre…) ; à égalité, l'ordre du catalogue.
            Logic.SearchMatcher matcher = new Logic.SearchMatcher(q);
            final java.util.Map<Media, Integer> scores = new java.util.IdentityHashMap<>();
            for (Media m : all) {
                if (year != 0 && m.releaseYear != year) continue;
                int score = matcher.score(m.index());
                if (score > 0) { scores.put(m, score); out.add(m); }
            }
            java.util.Collections.sort(out, (a, b) -> Integer.compare(scores.get(b), scores.get(a)));
            return out;
        }, (list, e) -> {
            if (gen != generation || list == null) return;
            boolean gridFocused = grid.hasFocus();
            adapter.set(list);
            if (list.isEmpty() && gridFocused) keyboard.firstKey().requestFocus();
            updateInfo();
        });
    }

    /** Dictée : le texte reconnu remplace la saisie et la recherche part tout de suite. */
    public void startVoice() {
        main.listen(heard -> {
            if (!alive()) return;
            keyboard.set(heard.toLowerCase(java.util.Locale.FRENCH));
            keyboard.firstKey().requestFocus();
        });
    }

    private void updateInfo() {
        String q = keyboard.text().trim();
        boolean nothing = !q.isEmpty() && adapter.getCount() == 0 && !App.repo().catalogue().isEmpty() && !App.repo().childProfile();
        if (requestButton.hasFocus() && !nothing) keyboard.firstKey().requestFocus();
        requestButton.setVisibility(nothing ? View.VISIBLE : View.GONE);
        if (App.repo().catalogue().isEmpty()) info.setText("Le catalogue est en cours de chargement…");
        else if (q.isEmpty()) info.setText("Suggestions");
        else if (adapter.getCount() == 0) info.setText("Aucun résultat pour « " + q + " »");
        else info.setText(adapter.getCount() + " résultat" + (adapter.getCount() > 1 ? "s" : "") + " pour « " + q + " »");
    }

    @Override protected void onShow(boolean first) { if (!first) search(); }

    @Override protected boolean onKey(KeyEvent e) {
        int code = e.getKeyCode();
        View f = main.getCurrentFocus();
        // Clavier → résultats (droite depuis la dernière colonne) et résultats → clavier (gauche depuis la première).
        if (code == KeyEvent.KEYCODE_DPAD_RIGHT && f != null && MainActivity.isInside(f, keyboard) && keyboard.isLastInRow(f)) {
            if (adapter.getCount() > 0) grid.requestFocus();
            else if (requestButton.getVisibility() == View.VISIBLE) requestButton.requestFocus();
            return true;
        }
        if (code == KeyEvent.KEYCODE_DPAD_LEFT && f == requestButton) { keyboard.focusRowEnd(0); return true; }
        if (code == KeyEvent.KEYCODE_DPAD_LEFT && f == grid && grid.getSelectedItemPosition() % columns == 0) {
            keyboard.focusRowEnd(0);
            return true;
        }
        if (code == KeyEvent.KEYCODE_DPAD_LEFT && f != null && MainActivity.isInside(f, keyboard) && keyboard.isFirstInRow(f)) return true;
        if (code == KeyEvent.KEYCODE_DPAD_UP && f != null && MainActivity.isInside(f, keyboard) && keyboard.isTopRow(f)) { main.focusTopBar(); return true; }
        if (code == KeyEvent.KEYCODE_DPAD_UP && f == grid && grid.getSelectedItemPosition() < columns) { main.focusTopBar(); return true; }
        // Saisie directe : chiffres de la télécommande ou clavier physique.
        if (code == KeyEvent.KEYCODE_DEL) { keyboard.erase(); return true; }
        if (code >= KeyEvent.KEYCODE_0 && code <= KeyEvent.KEYCODE_9) { keyboard.type(String.valueOf(code - KeyEvent.KEYCODE_0)); return true; }
        // Clavier physique ou télécommande à clavier : toutes les lettres, accents compris.
        int ch = e.getUnicodeChar();
        if (ch > 0 && (Character.isLetterOrDigit(ch) || ch == ' ' || ch == '\'')) { keyboard.type(String.valueOf((char) Character.toLowerCase(ch))); return true; }
        if (code == KeyEvent.KEYCODE_SPACE) { keyboard.type(" "); return true; }
        return false;
    }

    @Override protected View defaultFocus() { return keyboard.firstKey(); }

    @Override protected void onDestroy() { App.MAIN.removeCallbacks(runSearch); }
}
