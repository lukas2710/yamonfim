package com.yamonfilm.tv.screens;

import android.view.View;
import android.widget.AdapterView;
import android.widget.FrameLayout;
import android.widget.GridView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.yamonfilm.tv.App;
import com.yamonfilm.tv.Cards;
import com.yamonfilm.tv.Dialogs;
import com.yamonfilm.tv.MainActivity;
import com.yamonfilm.tv.Models.Collection;
import com.yamonfilm.tv.Models.Media;
import com.yamonfilm.tv.R;
import com.yamonfilm.tv.Screen;
import com.yamonfilm.tv.Ui;

import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;

import static com.yamonfilm.tv.Ui.dp;

/** Grille de titres : Films, Séries, un genre ou une collection. */
public final class BrowseScreen extends Screen {
    private final String rail, label, type;
    private String genre;
    private final Collection collection;
    private Cards.MediaAdapter adapter;
    private GridView grid;
    private TextView count, selected, empty;
    private Cards.Shelf chips;
    private int knownSize = -1;

    public BrowseScreen(MainActivity main, String rail, String label, String type) { this(main, rail, label, type, null); }

    public BrowseScreen(MainActivity main, String rail, String label, String type, String genre) {
        super(main); this.rail = rail; this.label = label; this.type = type; this.genre = genre; this.collection = null;
    }

    public BrowseScreen(MainActivity main, Collection collection) {
        super(main); rail = null; label = collection.title; type = "all"; genre = null; this.collection = collection;
    }

    @Override protected String railId() { return rail; }

    @Override protected View create() {
        FrameLayout root = new FrameLayout(main);
        root.setBackgroundColor(Ui.BG);
        LinearLayout col = Ui.column(main);
        col.setPadding(dp(Ui.SIDE), dp(rail != null ? Ui.TOP : 48), dp(Ui.SIDE - 10), 0);
        Ui.noClip(col);
        LinearLayout header = Ui.row(main);
        header.setGravity(android.view.Gravity.BOTTOM);
        TextView title = Ui.lines(Ui.label(main, label, 36, Ui.TEXT, Ui.W_BOLD), 1);
        header.addView(title);
        count = Ui.label(main, "", 16, Ui.MUTED, true);
        header.addView(count, Ui.lp(Ui.WRAP, Ui.WRAP, dp(16), 0, 0, dp(4)));
        selected = Ui.lines(Ui.label(main, "", 16, Ui.TEXT, true), 1);
        selected.setGravity(android.view.Gravity.END);
        header.addView(selected, new LinearLayout.LayoutParams(0, Ui.WRAP, 1f));
        col.addView(header);
        if (collection != null && !collection.description.isEmpty()) {
            TextView d = Ui.lines(Ui.label(main, collection.description, 15, Ui.MUTED, false), 2);
            col.addView(d, Ui.lp(dp(700), Ui.WRAP, 0, dp(8), 0, 0));
        }
        if (collection == null && genre == null) {
            chips = new Cards.Shelf(main, "");
            chips.title.setVisibility(View.GONE);
            chips.setPadding(0, 0, 0, 0);
            col.addView(chips, Ui.lp(Ui.MATCH, Ui.WRAP, 0, dp(10), 0, 0));
        }
        int widthDp = (int) (main.getResources().getDisplayMetrics().widthPixels / main.getResources().getDisplayMetrics().density);
        int columns = Math.max(3, (widthDp - 2 * Ui.SIDE) / (Cards.POSTER_W + 22));
        grid = Cards.grid(main, columns, false);
        adapter = new Cards.MediaAdapter(false);
        grid.setAdapter(adapter);
        grid.setOnItemClickListener((p, v, position, id) -> main.openMedia(adapter.getItem(position)));
        grid.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> p, View v, int position, long id) { describe(adapter.getItem(position)); }
            @Override public void onNothingSelected(AdapterView<?> p) { selected.setText(""); }
        });
        grid.setOnFocusChangeListener((v, has) -> {
            if (has) { Object m = grid.getSelectedItem(); if (m instanceof Media) describe((Media) m); }
            else selected.setText("");
        });
        empty = Ui.label(main, "Aucun titre pour le moment.", 17, Ui.MUTED, false);
        empty.setVisibility(View.GONE);
        col.addView(empty, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(30), 0, 0));
        col.addView(grid, new LinearLayout.LayoutParams(Ui.MATCH, 0, 1f));
        root.addView(col, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        return root;
    }

    private void describe(Media m) {
        StringBuilder sb = new StringBuilder(m.title);
        sb.append(m.isSeries() ? "  ·  Série" : "  ·  Film");
        if (!m.genres.isEmpty()) sb.append("  ·  ").append(m.genres.get(0));
        selected.setText(sb);
    }

    @Override protected void onShow(boolean first) {
        List<Media> all = App.repo().catalogue();
        if (first || all.size() != knownSize) {
            knownSize = all.size();
            buildChips(all);
            apply();
        }
    }

    private void buildChips(List<Media> all) {
        if (chips == null) return;
        TreeSet<String> genres = new TreeSet<>();
        for (Media m : all) if (type.equals("all") || m.type.equals(type)) genres.addAll(m.genres);
        chips.scroll.items.removeAllViews();
        List<String> values = new ArrayList<>();
        values.add(null);
        values.addAll(genres);
        for (String g : values) {
            TextView chip = Ui.chip(main, g == null ? "Tous" : g);
            chip.setActivated(g == null ? genre == null : g.equals(genre));
            chip.setOnClickListener(v -> {
                genre = g;
                for (int i = 0; i < chips.count(); i++) chips.item(i).setActivated(chips.item(i) == v);
                apply();
            });
            chip.setLayoutParams(new LinearLayout.LayoutParams(Ui.WRAP, Ui.WRAP));
            chips.add(chip, 10);
        }
    }

    private void apply() {
        List<Media> items;
        if (collection != null) items = App.repo().collectionItems(collection);
        else {
            items = new ArrayList<>();
            for (Media m : App.repo().catalogue())
                if ((type.equals("all") || m.type.equals(type)) && (genre == null || m.genres.contains(genre))) items.add(m);
        }
        adapter.set(items);
        grid.setSelection(0);
        count.setText(items.size() + " titre" + (items.size() > 1 ? "s" : ""));
        empty.setVisibility(items.isEmpty() ? View.VISIBLE : View.GONE);
        if (App.repo().catalogue().isEmpty()) empty.setText("Le catalogue est en cours de chargement. Reviens dans un instant.");
    }

    @Override protected boolean onLongPress(View focused) {
        if (focused != grid || !(grid.getSelectedItem() instanceof Media)) return false;
        Media m = (Media) grid.getSelectedItem();
        Dialogs.actions(main, m.title, new String[]{"Voir la fiche"}, new int[]{R.drawable.ic_info}, i -> main.openMedia(m));
        return true;
    }

    @Override protected View defaultFocus() { return adapter != null && adapter.getCount() > 0 ? grid : chips != null ? chips.item(0) : null; }
}
