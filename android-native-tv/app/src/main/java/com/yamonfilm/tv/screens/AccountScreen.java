package com.yamonfilm.tv.screens;

import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.yamonfilm.tv.App;
import com.yamonfilm.tv.Cards;
import com.yamonfilm.tv.Dialogs;
import com.yamonfilm.tv.Logic;
import com.yamonfilm.tv.MainActivity;
import com.yamonfilm.tv.Models.Profile;
import com.yamonfilm.tv.Models.Subscription;
import com.yamonfilm.tv.R;
import com.yamonfilm.tv.Screen;
import com.yamonfilm.tv.Ui;

import static com.yamonfilm.tv.Ui.dp;

/**
 * Mon compte : statut VIP et quota gratuit.
 * Le paiement n'est pas possible sur la TV : il se fait uniquement sur le site, depuis un téléphone ou un ordinateur.
 */
public final class AccountScreen extends Screen {
    private TextView statusTitle, statusText;
    private Dialogs.Countdown countdown;
    private TextView refresh;
    private LinearLayout vipBox;
    private boolean wasVip;

    public AccountScreen(MainActivity main) { super(main); }

    @Override protected String railId() { return "account"; }
    @Override protected String presenceAction() { return "Consulte les abonnements"; }

    @Override protected View create() {
        FrameLayout root = new FrameLayout(main);
        root.setBackgroundColor(Ui.BG);
        Cards.VScroll scroll = new Cards.VScroll(main, false);
        LinearLayout row = Ui.row(main);
        row.setPadding(dp(Ui.SIDE), dp(Ui.TOP), dp(Ui.SIDE), dp(40));
        Ui.noClip(row);

        LinearLayout left = Ui.column(main);
        Ui.noClip(left);
        left.addView(Ui.label(main, "Mon compte", 36, Ui.TEXT, Ui.W_BOLD));
        Profile p = App.repo().profile();
        TextView who = Ui.lines(Ui.label(main, (p != null ? p.name + "  ·  " : "") + App.repo().email(), 16, Ui.MUTED, false), 1);
        left.addView(who, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(8), 0, dp(20)));
        LinearLayout status = Ui.column(main);
        status.setBackground(Ui.round(0xFF171A22, 18));
        status.setPadding(dp(24), dp(20), dp(24), dp(20));
        Ui.noClip(status);
        statusTitle = Ui.label(main, "Vérification de ton accès…", 22, Ui.TEXT, true);
        statusText = Ui.label(main, "", 15, Ui.MUTED, false);
        statusText.setLineSpacing(0, 1.3f);
        status.addView(statusTitle);
        status.addView(statusText, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(8), 0, 0));
        countdown = new Dialogs.Countdown(main, false);
        countdown.setVisibility(View.GONE);
        status.addView(countdown, Ui.lp(Ui.MATCH, Ui.WRAP, 0, dp(14), 0, 0));
        countdown.onLoaded(this::renderStatus);
        left.addView(status, Ui.lp(dp(440), Ui.WRAP));
        LinearLayout actions = Ui.column(main);
        Ui.noClip(actions);
        refresh = Ui.button(main, "Actualiser mon accès", R.drawable.ic_refresh, Ui.STYLE_NORMAL);
        refresh.setOnClickListener(v -> { statusTitle.setText("Vérification de ton accès…"); countdown.load(); });
        TextView switchProfile = Ui.button(main, "Changer de profil", R.drawable.ic_user, Ui.STYLE_NORMAL);
        switchProfile.setOnClickListener(v -> main.setRoot("profiles", new ProfilesScreen(main, false)));
        TextView logout = Ui.button(main, "Se déconnecter", R.drawable.ic_logout, Ui.STYLE_GHOST);
        logout.setOnClickListener(v -> Dialogs.confirm(main, "Se déconnecter ?", "Tu devras saisir à nouveau ton email et ton mot de passe sur cette TV.", "Se déconnecter", () -> {
            App.background(() -> App.repo().signOut());
            App.repo().setProfile(null);
            main.setRoot("login", new LoginScreen(main));
        }));
        actions.addView(refresh, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(18), 0, 0));
        actions.addView(switchProfile, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(10), 0, 0));
        actions.addView(logout, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(10), 0, 0));
        left.addView(actions);
        row.addView(left, Ui.lp(dp(460), Ui.WRAP));

        // Explication VIP, sans aucun moyen de paiement sur la TV.
        vipBox = Ui.column(main);
        vipBox.setBackground(Ui.round(0xFF1A160C, 20));
        vipBox.setPadding(dp(28), dp(24), dp(28), dp(24));
        vipBox.addView(Ui.icon(main, R.drawable.ic_crown, Ui.GOLD, 40));
        vipBox.addView(Ui.label(main, "Passer au VIP", 26, Ui.GOLD, true), Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(10), 0, 0));
        TextView perks = Ui.label(main, "✓ Visionnage illimité\n✓ Tous les films et séries\n✓ Continue tes épisodes sans quota", 16, Ui.TEXT, false);
        perks.setLineSpacing(0, 1.4f);
        vipBox.addView(perks, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(12), 0, 0));
        TextView how = Ui.label(main, "L'abonnement se prend uniquement sur ton téléphone ou ton ordinateur, pas sur la TV.", 16, Ui.TEXT, true);
        how.setLineSpacing(0, 1.3f);
        vipBox.addView(how, Ui.lp(dp(380), Ui.WRAP, 0, dp(20), 0, 0));
        TextView steps = Ui.label(main,
                "1. Sur ton téléphone ou ton ordinateur, va sur yamonfi.netlify.app\n"
                        + "2. Connecte-toi avec le même compte : " + App.repo().email() + "\n"
                        + "3. Ouvre « Abonnement » et choisis ton offre\n"
                        + "4. Une fois ton accès VIP activé, appuie sur « Actualiser mon accès » ici",
                14, Ui.MUTED, false);
        steps.setLineSpacing(0, 1.45f);
        vipBox.addView(steps, Ui.lp(dp(380), Ui.WRAP, 0, dp(12), 0, 0));
        TextView discover = Ui.button(main, "Découvrir le VIP", R.drawable.ic_crown, Ui.STYLE_GOLD);
        discover.setOnClickListener(v -> main.push(new VipScreen(main)));
        vipBox.addView(discover, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(18), 0, 0));
        row.addView(vipBox, Ui.lp(Ui.WRAP, Ui.WRAP, dp(26), 0, 0, 0));
        scroll.content.addView(row);
        root.addView(scroll, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        return root;
    }

    @Override protected void onShow(boolean first) { if (!first) countdown.load(); }

    /** Vérifie régulièrement : l'accès VIP activé après un paiement sur le site apparaît tout seul. */
    @Override protected void onRefresh() { countdown.load(); }

    private void renderStatus() {
        Subscription s = countdown.subscription();
        if (s == null) return;
        boolean admin = App.repo().isAdmin();
        boolean vip = admin || s.vip;
        vipBox.setVisibility(vip ? View.GONE : View.VISIBLE);
        if (vip && !wasVip && statusTitle.getText().length() > 0 && !statusTitle.getText().toString().startsWith("Vérification")) main.toast("Ton accès VIP est actif. Bon visionnage !");
        wasVip = vip;
        if (admin) {
            statusTitle.setText("Administrateur");
            statusTitle.setTextColor(Ui.TEXT);
            statusText.setText("Accès illimité à tout le catalogue.");
            countdown.setVisibility(View.GONE);
        } else if (s.vip) {
            statusTitle.setText("👑  VIP actif");
            statusTitle.setTextColor(Ui.GOLD);
            statusText.setText(s.vipEnd > 0 ? "Ton accès VIP est valable jusqu'au " + Logic.parisDate(s.vipEnd) + "." : "Visionnage illimité sur tous les films et séries.");
            countdown.setVisibility(View.GONE);
        } else {
            int left = Math.max(0, Logic.FREE_WATCH_LIMIT - s.count);
            statusTitle.setText("Offre gratuite · " + Math.min(s.count, Logic.FREE_WATCH_LIMIT) + " / " + Logic.FREE_WATCH_LIMIT + " visions utilisées");
            statusTitle.setTextColor(left > 0 ? Ui.TEXT : 0xFFFF8A8A);
            statusText.setText(left > 0
                    ? "Il te reste " + left + " vision" + (left > 1 ? "s" : "") + " gratuite" + (left > 1 ? "s" : "") + " cette semaine. Chaque film ou épisode lancé compte pour une vision."
                    : "Tu as utilisé tes " + Logic.FREE_WATCH_LIMIT + " visions gratuites : la lecture est bloquée jusqu'à la remise à zéro ou jusqu'à ton passage au VIP.");
            countdown.setVisibility(View.VISIBLE); // compte à rebours toujours visible pour un compte gratuit
        }
    }

    @Override protected View defaultFocus() { return refresh; }
}
