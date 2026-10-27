package com.yamonfilm.tv.screens;

import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.FrameLayout;
import android.widget.GridView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.yamonfilm.tv.Actions;
import com.yamonfilm.tv.App;
import com.yamonfilm.tv.Cards;
import com.yamonfilm.tv.MainActivity;
import com.yamonfilm.tv.Models.Channel;
import com.yamonfilm.tv.R;
import com.yamonfilm.tv.Screen;
import com.yamonfilm.tv.Ui;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

import static com.yamonfilm.tv.Ui.dp;

/** TV en direct : même liste de chaînes que la page /tv du site. */
public final class LiveScreen extends Screen {
    private List<Channel> channels = new ArrayList<>();
    private final List<Channel> shown = new ArrayList<>();
    private String category = "Toutes";
    private LinearLayout categories;
    private GridView grid;
    private TextView status, retry;
    private final ChannelAdapter adapter = new ChannelAdapter();

    public LiveScreen(MainActivity main) { super(main); }

    @Override protected String railId() { return "live"; }

    @Override protected View create() {
        FrameLayout root = new FrameLayout(main);
        root.setBackgroundColor(Ui.BG);
        LinearLayout col = Ui.column(main);
        col.setPadding(dp(Ui.SIDE), dp(Ui.TOP), dp(Ui.SIDE - 10), 0);
        Ui.noClip(col);
        col.addView(Ui.label(main, "TV en direct", 36, Ui.TEXT, Ui.W_BOLD));
        status = Ui.label(main, "Chargement des chaînes…", 16, Ui.MUTED, false);
        col.addView(status, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(8), 0, dp(14)));
        retry = Ui.button(main, "Réessayer", R.drawable.ic_refresh, Ui.STYLE_NORMAL);
        retry.setVisibility(View.GONE);
        retry.setOnClickListener(v -> load());
        col.addView(retry, Ui.lp(Ui.WRAP, Ui.WRAP, 0, 0, 0, dp(10)));
        LinearLayout body = Ui.row(main);
        Ui.noClip(body);
        ScrollView catScroll = new ScrollView(main);
        catScroll.setVerticalScrollBarEnabled(false);
        Ui.noClip(catScroll);
        categories = Ui.column(main);
        categories.setPadding(dp(4), dp(6), dp(10), dp(40));
        Ui.noClip(categories);
        catScroll.addView(categories);
        body.addView(catScroll, Ui.lp(dp(210), Ui.MATCH));
        int widthDp = (int) (main.getResources().getDisplayMetrics().widthPixels / main.getResources().getDisplayMetrics().density);
        int columns = Math.max(2, (widthDp - 2 * Ui.SIDE - 230) / 172);
        grid = Cards.grid(main, columns, false);
        grid.setColumnWidth(dp(152));
        grid.setAdapter(adapter);
        grid.setOnItemClickListener((p, v, position, id) -> Actions.playChannel(main, new ArrayList<>(shown), position));
        body.addView(grid, new LinearLayout.LayoutParams(0, Ui.MATCH, 1f));
        col.addView(body, new LinearLayout.LayoutParams(Ui.MATCH, 0, 1f));
        root.addView(col, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        return root;
    }

    @Override protected void onShow(boolean first) { if (first) load(); }

    private void load() {
        retry.setVisibility(View.GONE);
        status.setText("Chargement des chaînes…");
        io(() -> App.repo().channels(), (list, e) -> {
            if (e != null) {
                status.setText(App.message(e));
                retry.setVisibility(View.VISIBLE);
                retry.requestFocus();
                return;
            }
            channels = list;
            buildCategories();
            apply();
            if (!shown.isEmpty()) grid.requestFocus();
        });
    }

    private void buildCategories() {
        LinkedHashSet<String> set = new LinkedHashSet<>();
        set.add("Toutes");
        for (Channel c : channels) if (c.category != null && !c.category.isEmpty()) set.add(c.category);
        categories.removeAllViews();
        for (String cat : set) {
            TextView chip = Ui.chip(main, cat);
            chip.setGravity(Gravity.CENTER_VERTICAL);
            chip.setActivated(cat.equals(category));
            chip.setOnClickListener(v -> {
                category = cat;
                for (int i = 0; i < categories.getChildCount(); i++) categories.getChildAt(i).setActivated(categories.getChildAt(i) == v);
                apply();
            });
            categories.addView(chip, Ui.lp(Ui.MATCH, Ui.WRAP, 0, 0, 0, dp(8)));
        }
    }

    private void apply() {
        shown.clear();
        for (Channel c : channels) if (category.equals("Toutes") || category.equals(c.category)) shown.add(c);
        adapter.notifyDataSetChanged();
        grid.setSelection(0);
        status.setText(shown.size() + " chaîne" + (shown.size() > 1 ? "s" : "") + " · OK pour regarder · Haut/Bas pour zapper pendant la lecture");
    }

    private final class ChannelAdapter extends BaseAdapter {
        @Override public int getCount() { return shown.size(); }
        @Override public Channel getItem(int i) { return shown.get(i); }
        @Override public long getItemId(int i) { return i; }
        @Override public View getView(int position, View convert, ViewGroup parent) {
            Cards.Card card;
            if (convert instanceof Cards.Card) card = (Cards.Card) convert;
            else {
                card = new Cards.Card(main, 152, 112, true, false);
                card.image.setScaleType(ImageView.ScaleType.FIT_CENTER);
                card.image.setPadding(dp(22), dp(14), dp(22), dp(34));
                card.setBackground(Ui.round(0xFF1E222C, 10));
            }
            card.setLayoutParams(new GridView.LayoutParams(dp(152), dp(112)));
            Channel c = shown.get(position);
            card.caption("", c.name);
            card.bindImage(c.logo, "");
            return card;
        }
    }

    @Override protected View defaultFocus() { return shown.isEmpty() ? (retry.getVisibility() == View.VISIBLE ? retry : categories.getChildAt(0)) : grid; }
}
