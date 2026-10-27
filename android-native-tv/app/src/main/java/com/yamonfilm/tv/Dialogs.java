package com.yamonfilm.tv;

import android.content.Context;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.yamonfilm.tv.Models.Subscription;

import static com.yamonfilm.tv.Ui.dp;

/** Fenêtres de l'application (confirmation, options, VIP). */
public final class Dialogs {
    private Dialogs() { }

    public interface Choice { void chosen(int index); }

    static LinearLayout panel(Context c, int widthDp) {
        LinearLayout p = Ui.column(c);
        p.setBackground(Ui.stroked(0xFA12141B, 0x1FFFFFFF, 1, 28));
        p.setPadding(dp(44), dp(38), dp(44), dp(34));
        p.setElevation(dp(24));
        p.setMinimumWidth(dp(widthDp));
        Ui.noClip(p);
        return p;
    }

    public static void confirm(MainActivity main, String title, String message, String ok, Runnable onOk) {
        LinearLayout p = panel(main, 520);
        p.addView(Ui.label(main, title, 26, Ui.TEXT, Ui.W_BOLD));
        if (message != null) {
            TextView m = Ui.label(main, message, 16, Ui.MUTED, false);
            m.setLineSpacing(0, 1.3f);
            p.addView(m, Ui.lp(dp(520), Ui.WRAP, 0, dp(12), 0, 0));
        }
        LinearLayout buttons = Ui.row(main);
        Ui.noClip(buttons);
        TextView yes = Ui.button(main, ok, 0, Ui.STYLE_PRIMARY);
        TextView no = Ui.button(main, "Annuler", 0, Ui.STYLE_NORMAL);
        buttons.addView(yes);
        buttons.addView(no, Ui.lp(Ui.WRAP, Ui.WRAP, dp(14), 0, 0, 0));
        p.addView(buttons, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(28), 0, 0));
        yes.setOnClickListener(v -> { main.closeDialog(); onOk.run(); });
        no.setOnClickListener(v -> main.closeDialog());
        main.showDialog(p, no, null);
    }

    /** Liste d'actions (appui long sur OK). */
    public static void actions(MainActivity main, String title, String[] labels, int[] icons, Choice choice) {
        LinearLayout p = panel(main, 420);
        TextView t = Ui.lines(Ui.label(main, title, 22, Ui.TEXT, true), 2);
        p.addView(t, Ui.lp(dp(440), Ui.WRAP, 0, 0, 0, dp(20)));
        View first = null;
        for (int i = 0; i < labels.length; i++) {
            final int index = i;
            TextView b = Ui.button(main, labels[i], icons == null ? 0 : icons[i], Ui.STYLE_NORMAL);
            b.setOnClickListener(v -> { main.closeDialog(); choice.chosen(index); });
            p.addView(b, Ui.lp(Ui.MATCH, Ui.WRAP, 0, 0, 0, dp(10)));
            if (first == null) first = b;
        }
        main.showDialog(p, first, null);
    }

    public static void message(MainActivity main, String title, String message) {
        LinearLayout p = panel(main, 520);
        p.addView(Ui.label(main, title, 24, Ui.TEXT, true));
        TextView m = Ui.label(main, message, 16, Ui.MUTED, false);
        m.setLineSpacing(0, 1.3f);
        p.addView(m, Ui.lp(dp(520), Ui.WRAP, 0, dp(12), 0, 0));
        TextView ok = Ui.button(main, "OK", 0, Ui.STYLE_NORMAL);
        ok.setOnClickListener(v -> main.closeDialog());
        p.addView(ok, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(26), 0, 0));
        main.showDialog(p, ok, null);
    }

    /** Promotion VIP quand les 5 visions gratuites sont utilisées (VipQuotaModal). */
    public static void vip(MainActivity main) {
        LinearLayout p = panel(main, 600);
        p.setGravity(Gravity.CENTER_HORIZONTAL);
        p.addView(Ui.icon(main, R.drawable.ic_crown, Ui.GOLD, 46));
        TextView kicker = Ui.label(main, "CONTINUE TA SÉANCE", 12, Ui.GOLD, true);
        kicker.setLetterSpacing(0.2f);
        p.addView(kicker, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(14), 0, 0));
        p.addView(Ui.label(main, "Tes visions gratuites sont épuisées", 26, Ui.TEXT, true), Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(10), 0, 0));
        p.addView(Ui.label(main, "Tu as utilisé tes 5 visions gratuites.", 16, Ui.MUTED, false), Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(8), 0, 0));
        Countdown countdown = new Countdown(main, true);
        p.addView(countdown, Ui.lp(dp(560), Ui.WRAP, 0, dp(18), 0, dp(14)));
        TextView pitch = Ui.label(main, "Tu ne veux pas de restriction ? Passe au VIP pour regarder sans limite.\nL'abonnement se prend sur ton téléphone ou ton ordinateur, sur yamonfim.vercel.app.", 15, Ui.TEXT, false);
        pitch.setGravity(Gravity.CENTER);
        p.addView(pitch, Ui.lp(dp(540), Ui.WRAP));
        TextView benefits = Ui.label(main, "✓ Visionnage illimité     ✓ Tous les films et séries     ✓ Continue tes épisodes sans quota", 13, Ui.MUTED, false);
        p.addView(benefits, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(12), 0, 0));
        LinearLayout buttons = Ui.row(main);
        Ui.noClip(buttons);
        TextView offers = Ui.button(main, "Découvrir le VIP", R.drawable.ic_crown, Ui.STYLE_GOLD);
        TextView later = Ui.button(main, "Plus tard", 0, Ui.STYLE_NORMAL);
        buttons.addView(offers);
        buttons.addView(later, Ui.lp(Ui.WRAP, Ui.WRAP, dp(14), 0, 0, 0));
        p.addView(buttons, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(24), 0, 0));
        offers.setOnClickListener(v -> { main.closeDialog(); main.push(new com.yamonfilm.tv.screens.VipScreen(main)); });
        later.setOnClickListener(v -> main.closeDialog());
        main.showDialog(p, offers, null);
    }

    /**
     * Compte à rebours avant la remise à zéro du quota (QuotaWaitNotice),
     * relu automatiquement à l'échéance.
     */
    public static final class Countdown extends LinearLayout implements App.Alive {
        private final TextView status, timer, detail, refresh;
        private Subscription sub;
        private boolean failed, checkedDeadline, attached;
        private final boolean withRefresh;
        private final Runnable tick = new Runnable() { @Override public void run() { render(); if (attached) postDelayed(this, 1000); } };

        public Countdown(Context c, boolean withRefresh) {
            super(c);
            this.withRefresh = withRefresh;
            setOrientation(VERTICAL);
            setGravity(Gravity.CENTER_HORIZONTAL);
            setBackground(Ui.stroked(0x0FFFFFFF, 0x1AFFFFFF, 1, 18));
            setPadding(dp(20), dp(16), dp(20), dp(16));
            status = Ui.label(c, "Vérification de ton prochain accès…", 15, Ui.TEXT, true);
            timer = Ui.label(c, "", 30, Ui.GOLD, Ui.W_BOLD);
            detail = Ui.label(c, "", 13, Ui.DIM, false);
            detail.setGravity(Gravity.CENTER);
            addView(status);
            addView(timer, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(8), 0, 0));
            addView(detail, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(6), 0, 0));
            refresh = Ui.button(c, "Actualiser mon accès", R.drawable.ic_refresh, Ui.STYLE_GHOST);
            refresh.setOnClickListener(v -> load());
            refresh.setVisibility(GONE);
            addView(refresh, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(12), 0, 0));
            Ui.noClip(this);
        }

        public Subscription subscription() { return sub; }
        @Override public boolean alive() { return attached; }

        @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); attached = true; load(); post(tick); }
        @Override protected void onDetachedFromWindow() { attached = false; removeCallbacks(tick); super.onDetachedFromWindow(); }

        public void load() {
            App.io(this, () -> App.repo().subscription(), (value, error) -> {
                failed = error != null;
                if (value != null) { sub = value; checkedDeadline = false; }
                if (listener != null && value != null) listener.run();
                render();
            });
        }

        private Runnable listener;
        public void onLoaded(Runnable r) { listener = r; }

        private void render() {
            long now = System.currentTimeMillis();
            boolean admin = App.repo().isAdmin();
            boolean available = sub != null && (sub.vip || admin || sub.count < Logic.FREE_WATCH_LIMIT);
            long remaining = sub == null ? 0 : sub.resetAt - now;
            timer.setVisibility(GONE);
            detail.setVisibility(GONE);
            if (failed && sub == null) {
                status.setText("Ton prochain accès gratuit");
                detail.setText("Le délai est momentanément indisponible. Actualise ton accès pour le vérifier.");
                detail.setVisibility(VISIBLE);
            } else if (sub == null) {
                status.setText("Vérification de ton prochain accès…");
            } else if (sub.vip || admin) {
                status.setText("Ton accès VIP est actif : aucune limite.");
            } else if (available && remaining > 0) {
                // Compte gratuit avec des visions restantes : on montre quand le compteur revient à 5.
                int left = Logic.FREE_WATCH_LIMIT - sub.count;
                status.setText("Il te reste " + left + " vision" + (left > 1 ? "s" : "") + " sur " + Logic.FREE_WATCH_LIMIT + " · retour à " + Logic.FREE_WATCH_LIMIT + " dans");
                timer.setText(Logic.countdown(remaining));
                timer.setVisibility(VISIBLE);
                detail.setText((sub.resetVerified ? "Remise à zéro le " : "Remise à zéro prévue le ") + Logic.parisDate(sub.resetAt) + " (heure de Paris).");
                detail.setVisibility(VISIBLE);
            } else if (available) {
                status.setText("Tes visions gratuites sont de nouveau disponibles.");
            } else if (remaining > 0) {
                status.setText(sub.resetVerified ? "Tu pourras regarder à nouveau dans" : "Prochaine remise à zéro prévue dans");
                timer.setText(Logic.countdown(remaining));
                timer.setVisibility(VISIBLE);
                detail.setText((sub.resetVerified ? "Remise à zéro le " : "Remise à zéro prévue le ") + Logic.parisDate(sub.resetAt) + " (heure de Paris).");
                detail.setVisibility(VISIBLE);
            } else {
                status.setText("L'échéance est atteinte.");
                detail.setText("Actualise ton accès pour vérifier tes visions disponibles.");
                detail.setVisibility(VISIBLE);
                if (!checkedDeadline) { checkedDeadline = true; load(); }
            }
            refresh.setVisibility(withRefresh && (available || failed || (sub != null && remaining <= 0)) ? VISIBLE : GONE);
        }
    }
}
