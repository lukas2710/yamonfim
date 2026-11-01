package com.yamonfilm.tv.screens;

import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;

import com.yamonfilm.tv.App;
import com.yamonfilm.tv.Cards;
import com.yamonfilm.tv.Cards.Card;
import com.yamonfilm.tv.Logic;
import com.yamonfilm.tv.MainActivity;
import com.yamonfilm.tv.Models.Collection;
import com.yamonfilm.tv.Models.Media;
import com.yamonfilm.tv.Screen;
import com.yamonfilm.tv.Ui;

import java.util.ArrayList;
import java.util.List;

import static com.yamonfilm.tv.Ui.dp;

/** Collections publiées (table media_collections). */
public final class CollectionsScreen extends Screen {
    private Cards.VScroll scroll;
    private android.widget.LinearLayout list;
    private TextView status;

    public CollectionsScreen(MainActivity main) { super(main); }

    @Override protected String railId() { return "collections"; }

    @Override protected View create() {
        FrameLayout root = new FrameLayout(main);
        root.setBackgroundColor(Ui.BG);
        scroll = new Cards.VScroll(main, false);
        scroll.content.setPadding(dp(Ui.SIDE), dp(Ui.TOP), dp(Ui.SIDE), dp(40));
        scroll.content.addView(Ui.label(main, "Collections", 36, Ui.TEXT, Ui.W_BOLD));
        status = Ui.label(main, "Une saga. Un univers. Tous ses titres au même endroit.", 16, Ui.MUTED, false);
        scroll.content.addView(status, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(8), 0, dp(22)));
        list = Ui.column(main);
        Ui.noClip(list);
        scroll.content.addView(list);
        root.addView(scroll, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        return root;
    }

    @Override protected void onShow(boolean first) {
        io(() -> App.repo().collections(), (cols, e) -> {
            if (e != null) { status.setText("Les collections ne peuvent pas être chargées pour le moment."); fail(e); return; }
            List<View> cards = new ArrayList<>();
            for (Collection c : cols) {
                List<Media> items = App.repo().collectionItems(c);
                if (items.isEmpty()) continue;
                Card card = new Card(main, 300, 169, true, true);
                card.caption("COLLECTION · " + items.size() + " titre" + (items.size() > 1 ? "s" : ""), c.title);
                String cover = c.safeCover().isEmpty() ? items.get(0).image() : c.safeCover();
                card.bindImage(Logic.tmdbSize(cover, "w780"), c.title);
                card.setOnClickListener(v -> main.push(new BrowseScreen(main, c)));
                cards.add(card);
            }
            boolean hadFocus = MainActivity.isInside(main.getCurrentFocus(), list);
            Cards.wrap(list, cards, 3, 22);
            if (cards.isEmpty()) status.setText(App.repo().catalogue().isEmpty() ? "Le catalogue est en cours de chargement…" : "Aucune collection n'est publiée pour le moment.");
            if ((first || hadFocus) && !cards.isEmpty()) cards.get(0).requestFocus();
        });
    }

    @Override protected View defaultFocus() {
        if (list.getChildCount() == 0) return null;
        return ((android.widget.LinearLayout) list.getChildAt(0)).getChildAt(0);
    }
}
