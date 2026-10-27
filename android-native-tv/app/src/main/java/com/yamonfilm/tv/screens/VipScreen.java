package com.yamonfilm.tv.screens;

import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.yamonfilm.tv.App;
import com.yamonfilm.tv.Cards;
import com.yamonfilm.tv.Dialogs;
import com.yamonfilm.tv.MainActivity;
import com.yamonfilm.tv.R;
import com.yamonfilm.tv.Screen;
import com.yamonfilm.tv.Ui;

import static com.yamonfilm.tv.Ui.dp;

/**
 * Page de promotion VIP. Aucun paiement sur la TV : « Obtenir » explique
 * comment s'abonner depuis un téléphone ou un ordinateur, puis relancer l'application.
 */
public final class VipScreen extends Screen {
    /** Offres affichées par le site (app/abonnement/plans.ts) — à titre d'information uniquement. */
    private static final String[][] OFFERS = {
            {"2 semaines", "3,99 €", "Pour découvrir à votre rythme", ""},
            {"3 mois", "15,00 €", "Pour vos soirées et vos week-ends", "Notre recommandation"},
            {"1 an", "50,00 €", "Pour les passionnés de cinéma", "Meilleur tarif par jour"},
    };
    private View recommended;

    public VipScreen(MainActivity main) { super(main); }

    @Override protected String presenceAction() { return "Consulte les abonnements"; }

    @Override protected View create() {
        FrameLayout root = new FrameLayout(main);
        root.setBackground(Ui.gradient(GradientDrawable.Orientation.TL_BR, 0xFF2A1E05, 0xFF120E07, 0xFF0A0B0F));
        View glow = new View(main);
        glow.setBackground(Ui.gradient(GradientDrawable.Orientation.TOP_BOTTOM, 0x33FFB020, 0x00FFB020));
        root.addView(glow, Ui.flp(Ui.MATCH, dp(260), Gravity.TOP));

        Cards.VScroll scroll = new Cards.VScroll(main, false);
        LinearLayout col = scroll.content;
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        col.setPadding(dp(60), dp(36), dp(60), dp(50));

        col.addView(Ui.icon(main, R.drawable.ic_crown, Ui.GOLD, 56));
        TextView kicker = Ui.label(main, "YAMONFILM VIP", 14, Ui.GOLD, true);
        kicker.setLetterSpacing(0.3f);
        col.addView(kicker, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(12), 0, 0));
        TextView title = Ui.label(main, "Regarde sans aucune limite", 40, Ui.TEXT, true);
        title.setGravity(Gravity.CENTER);
        col.addView(title, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(10), 0, 0));
        TextView sub = Ui.label(main, "Films et séries en illimité, sur ta TV, ton téléphone et ton ordinateur.", 18, 0xFFD9CBA8, false);
        sub.setGravity(Gravity.CENTER);
        col.addView(sub, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(10), 0, dp(18)));
        // Rappel du compteur gratuit : visions restantes et date de la remise à zéro.
        Dialogs.Countdown countdown = new Dialogs.Countdown(main, false);
        col.addView(countdown, Ui.lp(dp(560), Ui.WRAP, 0, 0, 0, dp(26)));

        // Avantages
        LinearLayout perks = Ui.row(main);
        perks.addView(perk("∞", "Visionnage illimité", "Plus de limite de 5 visions par semaine."));
        perks.addView(perk("🎬", "Tout le catalogue", "Tous les films et toutes les séries."));
        perks.addView(perk("▶", "Épisodes à la suite", "L'épisode suivant démarre tout seul."));
        col.addView(perks, Ui.lp(Ui.WRAP, Ui.WRAP, 0, 0, 0, dp(30)));

        // Offres
        col.addView(Ui.label(main, "Choisis ton offre", 22, Ui.TEXT, true), Ui.lp(Ui.WRAP, Ui.WRAP, 0, 0, 0, dp(14)));
        LinearLayout offers = Ui.row(main);
        Ui.noClip(offers);
        for (String[] o : OFFERS) {
            View card = offer(o);
            offers.addView(card, Ui.lp(dp(250), Ui.WRAP, dp(10), 0, dp(10), 0));
            if (!o[3].isEmpty() && recommended == null) recommended = card;
        }
        col.addView(offers);
        TextView note = Ui.label(main, "Le paiement se fait uniquement sur ton téléphone ou ton ordinateur, jamais sur la TV.", 14, Ui.DIM, false);
        col.addView(note, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(22), 0, 0));
        root.addView(scroll, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        return root;
    }

    private View perk(String symbol, String title, String text) {
        LinearLayout p = Ui.column(main);
        p.setGravity(Gravity.CENTER_HORIZONTAL);
        p.setBackground(Ui.round(0x14FFFFFF, 18));
        p.setPadding(dp(18), dp(18), dp(18), dp(18));
        TextView s = Ui.label(main, symbol, 30, Ui.GOLD, true);
        p.addView(s);
        TextView t = Ui.label(main, title, 17, Ui.TEXT, true);
        p.addView(t, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(8), 0, 0));
        TextView d = Ui.label(main, text, 13, Ui.MUTED, false);
        d.setGravity(Gravity.CENTER);
        p.addView(d, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(4), 0, 0));
        p.setLayoutParams(Ui.lp(dp(220), Ui.WRAP, dp(10), 0, dp(10), 0));
        return p;
    }

    private View offer(String[] o) {
        LinearLayout card = Ui.column(main);
        card.setGravity(Gravity.CENTER_HORIZONTAL);
        card.setFocusable(true);
        card.setClickable(true);
        card.setPadding(dp(20), dp(18), dp(20), dp(18));
        boolean star = !o[3].isEmpty();
        StateListDrawable bg = new StateListDrawable();
        GradientDrawable on = Ui.round(0xFF3A2A08, 20);
        on.setStroke(dp(4), Ui.GOLD);
        GradientDrawable off = Ui.round(star ? 0xFF231B0A : 0xFF171A22, 20);
        if (star) off.setStroke(dp(2), 0x80FFB020);
        bg.addState(Ui.focusedState(), on);
        bg.addState(new int[]{}, off);
        card.setBackground(bg);
        TextView badge = Ui.label(main, star ? o[3].toUpperCase() : " ", 11, 0xFF16120A, true);
        if (star) { badge.setBackground(Ui.round(Ui.GOLD, 8)); badge.setPadding(dp(8), dp(3), dp(8), dp(3)); }
        card.addView(badge);
        card.addView(Ui.label(main, o[0], 20, Ui.TEXT, true), Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(10), 0, 0));
        card.addView(Ui.label(main, o[1], 32, Ui.GOLD, true), Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(4), 0, 0));
        TextView tag = Ui.label(main, o[2], 13, Ui.MUTED, false);
        tag.setGravity(Gravity.CENTER);
        card.addView(tag, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(6), 0, dp(14)));
        TextView get = Ui.label(main, "Obtenir", 16, 0xFF16120A, true);
        get.setGravity(Gravity.CENTER);
        get.setBackground(Ui.round(Ui.GOLD, 22));
        get.setPadding(dp(26), dp(10), dp(26), dp(10));
        card.addView(get);
        card.setOnClickListener(v -> howToPay(o[0], o[1]));
        Ui.onFocus(card, 1.06f, null);
        return card;
    }

    /** Explique comment payer hors de la TV, puis permet de vérifier l'accès. */
    private void howToPay(String plan, String price) {
        LinearLayout p = Ui.column(main);
        p.setGravity(Gravity.CENTER_HORIZONTAL);
        p.setBackground(Ui.round(0xFF171A22, 24));
        p.setPadding(dp(40), dp(30), dp(40), dp(28));
        Ui.noClip(p);
        p.addView(Ui.icon(main, R.drawable.ic_crown, Ui.GOLD, 40));
        p.addView(Ui.label(main, "Offre " + plan + " — " + price, 24, Ui.TEXT, true), Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(10), 0, 0));
        TextView intro = Ui.label(main, "Le paiement ne se fait pas sur la TV.", 16, Ui.GOLD, true);
        p.addView(intro, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(8), 0, dp(14)));
        TextView steps = Ui.label(main,
                "1.  Prends ton téléphone ou ton ordinateur\n"
                        + "2.  Va sur yamonfim.vercel.app\n"
                        + "3.  Connecte-toi avec le même compte : " + App.repo().email() + "\n"
                        + "4.  Ouvre « Abonnement » et choisis l'offre " + plan + "\n"
                        + "5.  Une fois ton accès VIP activé, relance l'application sur la TV",
                16, Ui.TEXT, false);
        steps.setLineSpacing(0, 1.5f);
        p.addView(steps, Ui.lp(dp(560), Ui.WRAP));
        LinearLayout buttons = Ui.row(main);
        Ui.noClip(buttons);
        TextView check = Ui.button(main, "J'ai payé : vérifier mon accès", R.drawable.ic_refresh, Ui.STYLE_GOLD);
        TextView ok = Ui.button(main, "Compris", 0, Ui.STYLE_NORMAL);
        buttons.addView(check);
        buttons.addView(ok, Ui.lp(Ui.WRAP, Ui.WRAP, dp(14), 0, 0, 0));
        p.addView(buttons, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(24), 0, 0));
        ok.setOnClickListener(v -> main.closeDialog());
        check.setOnClickListener(v -> {
            main.closeDialog();
            final int token = main.showLoading("Vérification de ton accès…");
            io(() -> App.repo().subscription(), (s, e) -> {
                if (!main.hideLoading(token)) return;
                if (e != null) { fail(e); return; }
                if (s.vip || App.repo().isAdmin()) {
                    Dialogs.message(main, "👑  Tu es VIP !", "Ton accès illimité est actif sur cette TV. Bon visionnage !");
                } else {
                    Dialogs.message(main, "Pas encore VIP", "Ton accès VIP n'est pas encore activé sur ce compte. Il est activé après vérification du paiement : réessaie dans quelques minutes, ou relance l'application.");
                }
            });
        });
        main.showDialog(p, check, null);
    }

    @Override protected View defaultFocus() { return recommended; }
}
