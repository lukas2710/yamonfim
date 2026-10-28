package com.yamonfilm.tv;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.yamonfilm.tv.Models.Profile;
import com.yamonfilm.tv.screens.AccountScreen;
import com.yamonfilm.tv.screens.BrowseScreen;
import com.yamonfilm.tv.screens.CollectionsScreen;
import com.yamonfilm.tv.screens.HistoryScreen;
import com.yamonfilm.tv.screens.HomeScreen;
import com.yamonfilm.tv.screens.LiveScreen;
import com.yamonfilm.tv.screens.LoginScreen;
import com.yamonfilm.tv.screens.ProfilesScreen;
import com.yamonfilm.tv.screens.RequestsScreen;
import com.yamonfilm.tv.screens.SearchScreen;
import com.yamonfilm.tv.screens.VipScreen;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.yamonfilm.tv.Ui.dp;

/**
 * Activité principale : barre de navigation en haut (rubriques, recherche, VIP, profil),
 * pile d'écrans, fenêtres, chargement et gestion de la télécommande.
 */
public final class MainActivity extends Activity {
    private FrameLayout root, stage, layer, nav;
    private LinearLayout navRow;
    private TextView toast, vipBadge;
    private FrameLayout avatar;
    private ImageView avatarImage;
    private TextView avatarLetter;
    private final List<Screen> stack = new ArrayList<>();
    private final Map<String, Screen> roots = new HashMap<>();
    private final Map<String, View> navItems = new HashMap<>();
    private final List<View> navOrder = new ArrayList<>();
    private View dialog;
    private Runnable dialogClosed;
    private boolean resumed, pausedOnce;
    private int beats;
    private long lastRepeat;
    private boolean centerDown, longFired;
    private KeyEvent centerEvent;
    private final Runnable hideToast = () -> toast.animate().alpha(0f).translationY(dp(10)).setDuration(200).withEndAction(() -> toast.setVisibility(View.GONE)).start();
    private final Runnable heartbeat = new Runnable() {
        @Override public void run() {
            Screen top = top();
            final String action = top == null ? "Navigate sur le site" : top.presenceAction();
            if (App.repo().api.signedIn()) App.background(() -> App.repo().presence(action, null));
            // Toutes les minutes : relit l'historique et le statut VIP (suivi entre appareils).
            if (++beats % 3 == 0 && top != null && dialog == null && !loadingActive && App.repo().api.signedIn()) { top.onRefresh(); refreshBadge(); }
            App.MAIN.postDelayed(this, 20000);
        }
    };

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        Ui.init(this);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        root = new FrameLayout(this);
        root.setBackgroundColor(Ui.BG);
        stage = new FrameLayout(this);
        root.addView(stage, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        buildNav();
        layer = new FrameLayout(this);
        root.addView(layer, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        toast = Ui.lines(Ui.text(this, 16, Ui.TEXT, Ui.W_MEDIUM), 3);
        toast.setBackground(Ui.stroked(0xF21A1D26, 0x26FFFFFF, 1, 18));
        toast.setPadding(dp(26), dp(16), dp(26), dp(16));
        toast.setGravity(Gravity.CENTER);
        toast.setMaxWidth(dp(680));
        toast.setElevation(dp(12));
        toast.setVisibility(View.GONE);
        FrameLayout.LayoutParams tp = Ui.flp(Ui.WRAP, Ui.WRAP, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        tp.bottomMargin = dp(44);
        root.addView(toast, tp);
        setContentView(root);
        root.getViewTreeObserver().addOnGlobalFocusChangeListener(focusTracker);
        start();
    }

    private final ViewTreeObserver.OnGlobalFocusChangeListener focusTracker = (oldFocus, newFocus) -> {
        Screen top = top();
        if (newFocus == null) return;
        if (top != null && top.view != null && isInside(newFocus, top.view)) top.lastFocus = newFocus;
        boolean inNav = isInside(newFocus, nav);
        // En montant dans la barre depuis le contenu, on arrive toujours sur la rubrique active.
        if (inNav && (oldFocus == null || !isInside(oldFocus, nav)) && top != null) {
            View active = navItems.get(top.railId());
            if (active != null && active != newFocus) nav.post(active::requestFocus);
        }
    };

    public static boolean isInside(View v, View parent) {
        while (v != null) { if (v == parent) return true; v = v.getParent() instanceof View ? (View) v.getParent() : null; }
        return false;
    }

    /** Premier écran selon l'état : connexion, choix du profil, puis accueil. */
    public void start() {
        Repo repo = App.repo();
        if (!repo.api.signedIn()) setRoot("login", new LoginScreen(this));
        else if (repo.profile() == null) setRoot("profiles", new ProfilesScreen(this, true));
        else openRail("home");
    }

    // ------------------------------------------------------------ Barre de navigation

    private static final String[][] TABS = {
            {"home", "Accueil"}, {"movies", "Films"}, {"series", "Séries"}, {"collections", "Collections"},
            {"live", "TV en direct"}, {"history", "Historique"},
    };

    private void buildNav() {
        nav = new FrameLayout(this);
        nav.setBackground(Ui.gradient(GradientDrawable.Orientation.TOP_BOTTOM, 0xF2060A15, 0xB3060A15, 0x00060A15));
        navRow = Ui.row(this);
        navRow.setGravity(Gravity.CENTER_VERTICAL);
        navRow.setPadding(dp(44), dp(20), dp(44), dp(10));
        Ui.noClip(navRow);

        LinearLayout logo = Ui.row(this);
        logo.addView(Ui.label(this, "YAMON", 21, Ui.ACCENT, Ui.W_BLACK));
        logo.addView(Ui.label(this, "FILM", 21, Ui.TEXT, Ui.W_BLACK));
        navRow.addView(logo, Ui.lp(Ui.WRAP, Ui.WRAP, 0, 0, dp(22), 0));

        for (String[] t : TABS) addNavItem(t[0], tab(t[1]));
        View spacer = new View(this);
        navRow.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1f));

        ImageView search = Ui.iconButton(this, R.drawable.ic_search, 42);
        ((LinearLayout.LayoutParams) search.getLayoutParams()).rightMargin = dp(14);
        addNavItem("search", search);

        vipBadge = Ui.text(this, 14, Ui.GOLD, Ui.W_SEMIBOLD);
        vipBadge.setText("VIP");
        vipBadge.setGravity(Gravity.CENTER);
        vipBadge.setFocusable(true);
        vipBadge.setClickable(true);
        vipBadge.setMinHeight(dp(42));
        vipBadge.setPadding(dp(16), 0, dp(18), 0);
        StateListDrawable vb = new StateListDrawable();
        vb.addState(Ui.focusedState(), Ui.round(Ui.GOLD, 21));
        vb.addState(new int[]{}, Ui.stroked(0x1FF5B83D, 0x66F5B83D, 1.5f, 21));
        vipBadge.setBackground(vb);
        vipBadge.setTextColor(new ColorStateList(new int[][]{Ui.focusedState(), {}}, new int[]{0xFF1A1206, Ui.GOLD}));
        android.graphics.drawable.Drawable crown = getDrawable(R.drawable.ic_crown).mutate();
        crown.setBounds(0, 0, dp(18), dp(18));
        vipBadge.setCompoundDrawables(crown, null, null, null);
        vipBadge.setCompoundDrawablePadding(dp(8));
        vipBadge.setCompoundDrawableTintList(new ColorStateList(new int[][]{Ui.focusedState(), {}}, new int[]{0xFF1A1206, Ui.GOLD}));
        Ui.onFocus(vipBadge, 1.07f, null);
        vipBadge.setLayoutParams(Ui.lp(Ui.WRAP, Ui.WRAP, 0, 0, dp(14), 0));
        // Le statut VIP est affiché dans le menu du profil (la barre doit tenir sur un écran TV).

        avatar = new FrameLayout(this);
        avatar.setFocusable(true);
        avatar.setClickable(true);
        avatar.setBackground(Ui.oval(Ui.ACCENT));
        StateListDrawable ring = new StateListDrawable();
        GradientDrawable on = new GradientDrawable();
        on.setShape(GradientDrawable.OVAL);
        on.setStroke(dp(3), Ui.FOCUS);
        ring.addState(Ui.focusedState(), on);
        ring.addState(new int[]{}, new android.graphics.drawable.ColorDrawable(0));
        avatar.setForeground(ring);
        Ui.clipOval(avatar);
        avatarLetter = Ui.text(this, 18, Ui.TEXT, Ui.W_BOLD);
        avatarLetter.setGravity(Gravity.CENTER);
        avatar.addView(avatarLetter, Ui.flp(Ui.MATCH, Ui.MATCH, Gravity.CENTER));
        avatarImage = new ImageView(this);
        avatarImage.setScaleType(ImageView.ScaleType.CENTER_CROP);
        avatar.addView(avatarImage, Ui.flp(Ui.MATCH, Ui.MATCH, 0));
        Ui.onFocus(avatar, 1.12f, null);
        avatar.setLayoutParams(Ui.lp(dp(42), dp(42)));
        addNavItem("profile", avatar);

        nav.addView(navRow, new FrameLayout.LayoutParams(Ui.MATCH, Ui.WRAP));
        root.addView(nav, new FrameLayout.LayoutParams(Ui.MATCH, dp(130)));
    }

    private TextView tab(String label) {
        TextView t = Ui.text(this, 15, Ui.MUTED, Ui.W_MEDIUM);
        t.setText(label);
        t.setGravity(Gravity.CENTER);
        t.setSingleLine(true);
        t.setFocusable(true);
        t.setClickable(true);
        t.setMinHeight(dp(40));
        t.setPadding(dp(14), 0, dp(14), 0);
        StateListDrawable bg = new StateListDrawable();
        bg.addState(Ui.focusedState(), Ui.round(Ui.FOCUS, 21));
        bg.addState(Ui.activatedState(), Ui.stroked(0x33003CDA, Ui.ACCENT, 1, 10));
        bg.addState(new int[]{}, new android.graphics.drawable.ColorDrawable(0));
        t.setBackground(bg);
        t.setTextColor(new ColorStateList(new int[][]{Ui.focusedState(), Ui.activatedState(), {}}, new int[]{Ui.INK, Ui.TEXT, Ui.MUTED}));
        Ui.onFocus(t, 1.06f, null);
        t.setLayoutParams(Ui.lp(Ui.WRAP, Ui.WRAP, 0, 0, dp(2), 0));
        return t;
    }

    private void addNavItem(String id, View item) {
        item.setOnClickListener(v -> {
            if (id.equals("profile")) showProfileMenu();
            else if (id.equals("account")) openVipOrAccount();
            else openRail(id);
        });
        item.setOnKeyListener((v, code, e) -> {
            if (e.getAction() != KeyEvent.ACTION_DOWN) return false;
            if (code == KeyEvent.KEYCODE_DPAD_DOWN) { focusContent(); return true; }
            if (code == KeyEvent.KEYCODE_DPAD_UP) return true;
            int i = navOrder.indexOf(v);
            if (code == KeyEvent.KEYCODE_DPAD_LEFT) { if (i > 0) navOrder.get(i - 1).requestFocus(); return true; }
            if (code == KeyEvent.KEYCODE_DPAD_RIGHT) { if (i + 1 < navOrder.size()) navOrder.get(i + 1).requestFocus(); return true; }
            return false;
        });
        if (item.getLayoutParams() == null) item.setLayoutParams(Ui.lp(Ui.WRAP, Ui.WRAP));
        navRow.addView(item);
        navItems.put(id, item);
        navOrder.add(item);
    }

    private void updateNav() {
        Screen top = top();
        String id = top == null ? null : top.railId();
        nav.setVisibility(id != null ? View.VISIBLE : View.GONE);
        for (Map.Entry<String, View> e : navItems.entrySet()) e.getValue().setActivated(e.getKey().equals(id));
    }

    /** Avatar et badge VIP de la barre, mis à jour avec le profil et l'abonnement. */
    public void refreshProfileChip() {
        Profile p = App.repo().profile();
        avatarLetter.setText(p == null ? "?" : p.initial());
        if (p != null && p.imageAvatar()) App.images().load(avatarImage, p.avatar, dp(46), dp(46));
        else App.images().load(avatarImage, null, 0, 0);
    }

    public void refreshBadge() {
        if (!App.repo().api.signedIn()) return;
        App.io(null, () -> App.repo().subscription(), (s, e) -> {
            if (s == null) return;
            if (App.repo().isAdmin()) vipBadge.setText("Admin");
            else if (s.vip) vipBadge.setText("VIP");
            else vipBadge.setText(Math.min(s.count, Logic.FREE_WATCH_LIMIT) + " / " + Logic.FREE_WATCH_LIMIT);
            vipBadge.setTag(s.vip || App.repo().isAdmin());
        });
    }

    private void openVipOrAccount() {
        if (Boolean.TRUE.equals(vipBadge.getTag())) openRail("account");
        else openRail("account");
    }

    /** Menu du profil : changer de profil, compte, déconnexion. */
    public void showProfileMenu() {
        Profile p = App.repo().profile();
        LinearLayout panel = Dialogs.panel(this, 440);
        panel.setGravity(Gravity.CENTER_HORIZONTAL);
        FrameLayout big = new FrameLayout(this);
        big.setBackground(Ui.oval(Ui.ACCENT));
        Ui.clipOval(big);
        TextView letter = Ui.label(this, p == null ? "?" : p.initial(), 34, Ui.TEXT, Ui.W_BOLD);
        letter.setGravity(Gravity.CENTER);
        big.addView(letter, Ui.flp(Ui.MATCH, Ui.MATCH, Gravity.CENTER));
        if (p != null && p.imageAvatar()) {
            ImageView img = new ImageView(this);
            img.setScaleType(ImageView.ScaleType.CENTER_CROP);
            big.addView(img, Ui.flp(Ui.MATCH, Ui.MATCH, 0));
            App.images().load(img, p.avatar, dp(96), dp(96));
        }
        panel.addView(big, Ui.lp(dp(96), dp(96)));
        panel.addView(Ui.label(this, p == null ? "Profil" : p.name, 24, Ui.TEXT, Ui.W_BOLD), Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(14), 0, 0));
        panel.addView(Ui.label(this, App.repo().email(), 14, Ui.MUTED, Ui.W_REGULAR), Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(4), 0, dp(12)));
        TextView status = Ui.label(this, vipBadge.getText().toString().equals("VIP") ? "👑  VIP actif" : vipBadge.getText().toString().equals("Admin") ? "Administrateur" : "Offre gratuite · " + vipBadge.getText() + " visions utilisées", 14, Ui.GOLD, Ui.W_SEMIBOLD);
        status.setBackground(Ui.stroked(0x1FF5B83D, 0x55F5B83D, 1, 14));
        status.setPadding(dp(14), dp(6), dp(14), dp(6));
        panel.addView(status, Ui.lp(Ui.WRAP, Ui.WRAP, 0, 0, 0, dp(22)));
        TextView change = Ui.button(this, "Changer de profil", R.drawable.ic_user, Ui.STYLE_NORMAL);
        TextView account = Ui.button(this, "Mon compte et VIP", R.drawable.ic_crown, Ui.STYLE_NORMAL);
        TextView logout = Ui.button(this, "Se déconnecter", R.drawable.ic_logout, Ui.STYLE_GHOST);
        change.setOnClickListener(v -> { closeDialog(); setRoot("profiles", new ProfilesScreen(this, false)); });
        account.setOnClickListener(v -> { closeDialog(); openRail("account"); });
        logout.setOnClickListener(v -> { closeDialog(); Dialogs.confirm(this, "Se déconnecter ?", "Tu devras saisir à nouveau ton email et ton mot de passe sur cette TV.", "Se déconnecter", this::signOut); });
        panel.addView(change, Ui.lp(dp(360), Ui.WRAP, 0, 0, 0, dp(12)));
        panel.addView(account, Ui.lp(dp(360), Ui.WRAP, 0, 0, 0, dp(12)));
        TextView requests = Ui.button(this, "Demander un film ou une série", R.drawable.ic_request, Ui.STYLE_NORMAL);
        requests.setOnClickListener(v -> { closeDialog(); openRail("requests"); });
        panel.addView(requests, Ui.lp(dp(360), Ui.WRAP, 0, 0, 0, dp(12)));
        panel.addView(logout, Ui.lp(dp(360), Ui.WRAP));
        showDialog(panel, change, null);
    }

    public void signOut() {
        App.background(() -> App.repo().signOut());
        App.repo().setProfile(null);
        setRoot("login", new LoginScreen(this));
    }

    public void focusTopBar() {
        Screen top = top();
        View item = top == null ? null : navItems.get(top.railId());
        if (item != null && nav.getVisibility() == View.VISIBLE) item.requestFocus();
    }

    /** Compatibilité : l'ancien menu latéral est remplacé par la barre du haut. */
    public void focusRail() { focusTopBar(); }

    private void focusContent() {
        Screen top = top();
        if (top != null) top.restoreFocus();
    }

    /** Ouvre une rubrique, en conservant son état si elle a déjà été ouverte. */
    public void openRail(String id) {
        if (App.repo().childProfile() && ("live".equals(id) || "requests".equals(id))) { toast("Cette rubrique est réservée aux profils Standard."); return; }
        Screen s = roots.get(id);
        if (s == null) {
            switch (id) {
                case "search": s = new SearchScreen(this); break;
                case "movies": s = new BrowseScreen(this, "movies", "Films", "movie"); break;
                case "series": s = new BrowseScreen(this, "series", "Séries", "series"); break;
                case "collections": s = new CollectionsScreen(this); break;
                case "history": s = new HistoryScreen(this); break;
                case "live": s = new LiveScreen(this); break;
                case "requests": s = new RequestsScreen(this); break;
                case "account": s = new AccountScreen(this); break;
                default: s = new HomeScreen(this); id = "home"; break;
            }
        }
        setRoot(id, s);
    }

    // ------------------------------------------------------------ Pile d'écrans

    public Screen top() { return stack.isEmpty() ? null : stack.get(stack.size() - 1); }

    private void attach(Screen s) {
        boolean first = s.view == null;
        if (first) s.view = s.create();
        if (s.view.getParent() == null) stage.addView(s.view, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        s.view.setVisibility(View.VISIBLE);
        s.view.setAlpha(0f);
        s.view.animate().alpha(1f).setDuration(200).start();
        updateNav();
        s.onShow(first);
        final Screen target = s;
        stage.post(() -> { if (top() == target) target.restoreFocus(); });
        // Second essai quand le contenu arrive un peu plus tard (données en cache, mise en page).
        stage.postDelayed(() -> {
            View f = getCurrentFocus();
            if (top() == target && dialog == null && !loadingActive && (f == null || !f.isShown())) target.restoreFocus();
        }, 400);
    }

    private void detach(Screen s, boolean destroy) {
        s.onHide();
        if (s.view != null) {
            s.view.animate().cancel();
            if (destroy) stage.removeView(s.view);
            else s.view.setVisibility(View.GONE);
        }
        if (destroy) s.destroy();
    }

    public void setRoot(String id, Screen s) {
        closeDialog();
        while (!stack.isEmpty()) {
            Screen old = stack.remove(stack.size() - 1);
            boolean keep = roots.containsValue(old);
            detach(old, !keep);
        }
        if (id.equals("login") || id.equals("profiles")) {
            // Changement de compte ou de profil : toutes les rubriques sont rechargées.
            for (Screen r : new ArrayList<>(roots.values())) { if (r != s) detach(r, true); }
            roots.clear();
        }
        roots.put(id, s);
        stack.add(s);
        if (id.equals("home")) { refreshProfileChip(); refreshBadge(); }
        attach(s);
    }

    public void push(Screen s) {
        closeDialog();
        Screen current = top();
        if (current != null) detach(current, false);
        stack.add(s);
        attach(s);
    }

    public void pop() {
        if (stack.size() <= 1) return;
        Screen old = stack.remove(stack.size() - 1);
        detach(old, !roots.containsValue(old));
        attach(top());
    }

    // ------------------------------------------------------------ Navigation de haut niveau

    public void openMedia(Models.Media media) { Actions.openMedia(this, media); }

    public void fail(Exception e) {
        if (e instanceof Api.AuthExpired) {
            toast("Ta session a expiré. Reconnecte-toi.");
            App.repo().setProfile(null);
            setRoot("login", new LoginScreen(this));
        } else toast(App.message(e));
    }

    public void toast(String message) {
        if (message == null || message.isEmpty()) return;
        toast.setText(message);
        toast.removeCallbacks(hideToast);
        toast.animate().cancel();
        toast.setVisibility(View.VISIBLE);
        toast.setAlpha(0f);
        toast.setTranslationY(dp(10));
        toast.animate().alpha(1f).translationY(0).setDuration(200).start();
        toast.postDelayed(hideToast, Math.max(2800, Math.min(6000, message.length() * 60)));
    }

    // ------------------------------------------------------------ Chargement

    private View loadingView;
    private TextView loadingText;
    private int loadingToken;
    private boolean loadingActive;
    private final Runnable revealLoading = () -> {
        if (loadingView == null) return;
        loadingView.setVisibility(View.VISIBLE);
        loadingView.animate().alpha(1f).setDuration(180).start();
    };

    /**
     * Affiche « Chargement… » par-dessus l'écran (après 120 ms, pour ne pas clignoter sur les actions rapides).
     * Retourne un jeton : le résultat d'une action annulée avec Retour est ignoré.
     */
    public int showLoading(String message) {
        if (loadingView == null) {
            FrameLayout box = new FrameLayout(this);
            box.setBackgroundColor(0xC7060A15);
            box.setClickable(true);
            LinearLayout card = Ui.column(this);
            card.setGravity(Gravity.CENTER_HORIZONTAL);
            Spinner spin = new Spinner(this);
            card.addView(spin, Ui.lp(dp(64), dp(64)));
            loadingText = Ui.lines(Ui.text(this, 20, Ui.TEXT, Ui.W_SEMIBOLD), 2);
            loadingText.setGravity(Gravity.CENTER);
            card.addView(loadingText, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(24), 0, 0));
            TextView hint = Ui.label(this, "Retour pour annuler", 13, Ui.DIM, Ui.W_REGULAR);
            card.addView(hint, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(10), 0, 0));
            box.addView(card, Ui.flp(Ui.WRAP, Ui.WRAP, Gravity.CENTER));
            root.addView(box, root.indexOfChild(toast), new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
            loadingView = box;
        }
        loadingText.setText(message);
        loadingView.animate().cancel();
        loadingView.removeCallbacks(revealLoading);
        if (loadingView.getVisibility() != View.VISIBLE) {
            loadingView.setAlpha(0f);
            loadingView.postDelayed(revealLoading, 120);
        }
        loadingActive = true;
        return ++loadingToken;
    }

    /** Masque le chargement ; retourne false si l'action a été annulée entre-temps. */
    public boolean hideLoading(int token) {
        if (token != loadingToken) return false;
        loadingToken++;
        loadingActive = false;
        if (loadingView != null) {
            loadingView.removeCallbacks(revealLoading);
            loadingView.animate().cancel();
            loadingView.setVisibility(View.GONE);
        }
        return true;
    }

    public boolean isLoading() { return loadingActive; }

    private void cancelLoading() { hideLoading(loadingToken); }

    /** Anneau de chargement animé aux couleurs de l'application. */
    public static final class Spinner extends View {
        private final android.graphics.Paint track = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        private final android.graphics.Paint arc = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        private final android.graphics.RectF rect = new android.graphics.RectF();
        public Spinner(android.content.Context c) {
            super(c);
            track.setStyle(android.graphics.Paint.Style.STROKE);
            track.setStrokeWidth(dp(4));
            track.setColor(0x1FFFFFFF);
            arc.setStyle(android.graphics.Paint.Style.STROKE);
            arc.setStrokeWidth(dp(4));
            arc.setStrokeCap(android.graphics.Paint.Cap.ROUND);
            arc.setColor(Ui.ACCENT);
        }
        @Override protected void onDraw(android.graphics.Canvas canvas) {
            float pad = dp(4);
            rect.set(pad, pad, getWidth() - pad, getHeight() - pad);
            canvas.drawOval(rect, track);
            long t = android.os.SystemClock.uptimeMillis();
            float start = (t % 1000) * 0.36f;
            float sweep = 60 + 200 * (float) Math.abs(Math.sin((t % 1600) / 1600.0 * Math.PI));
            canvas.drawArc(rect, start, sweep, false, arc);
            if (isShown()) postInvalidateOnAnimation();
        }
    }

    // ------------------------------------------------------------ Fenêtres

    public boolean dialogOpen() { return dialog != null; }

    /** Affiche une fenêtre par-dessus l'écran ; le focus reste dans la fenêtre. */
    public void showDialog(View panel, View focus, Runnable onClosed) {
        closeDialog();
        FrameLayout dim = new FrameLayout(this);
        dim.setBackgroundColor(0xD9060A15);
        dim.setClickable(true);
        dim.addView(panel, Ui.flp(Ui.WRAP, Ui.WRAP, Gravity.CENTER));
        layer.addView(dim, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        dialog = dim;
        dialogClosed = onClosed;
        stage.setDescendantFocusability(ViewGroup.FOCUS_BLOCK_DESCENDANTS);
        nav.setDescendantFocusability(ViewGroup.FOCUS_BLOCK_DESCENDANTS);
        dim.setAlpha(0f);
        dim.animate().alpha(1f).setDuration(160).start();
        panel.setScaleX(0.94f); panel.setScaleY(0.94f);
        panel.animate().scaleX(1f).scaleY(1f).setDuration(200).setInterpolator(new android.view.animation.DecelerateInterpolator(1.6f)).start();
        dim.post(() -> { if (focus != null) focus.requestFocus(); else panel.requestFocus(); });
    }

    public void closeDialog() {
        if (dialog == null) return;
        layer.removeView(dialog);
        dialog = null;
        stage.setDescendantFocusability(ViewGroup.FOCUS_AFTER_DESCENDANTS);
        nav.setDescendantFocusability(ViewGroup.FOCUS_AFTER_DESCENDANTS);
        Runnable after = dialogClosed;
        dialogClosed = null;
        Screen top = top();
        if (top != null) top.restoreFocus();
        if (after != null) after.run();
    }

    // ------------------------------------------------------------ Télécommande

    static boolean isSelect(int code) {
        return code == KeyEvent.KEYCODE_DPAD_CENTER || code == KeyEvent.KEYCODE_ENTER || code == KeyEvent.KEYCODE_NUMPAD_ENTER || code == KeyEvent.KEYCODE_BUTTON_A;
    }

    static boolean isDirection(int code) {
        return code == KeyEvent.KEYCODE_DPAD_UP || code == KeyEvent.KEYCODE_DPAD_DOWN || code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT;
    }

    @Override public boolean dispatchKeyEvent(KeyEvent e) {
        int code = e.getKeyCode(), action = e.getAction();
        // Pendant un chargement, seule la touche Retour (annuler) est prise en compte.
        if (loadingActive) {
            if ((code == KeyEvent.KEYCODE_BACK || code == KeyEvent.KEYCODE_ESCAPE || code == KeyEvent.KEYCODE_BUTTON_B) && action == KeyEvent.ACTION_UP) cancelLoading();
            centerDown = false;
            return true;
        }
        // Touche maintenue : on limite la cadence pour garder un défilement net, sans file d'attente.
        if (action == KeyEvent.ACTION_DOWN && e.getRepeatCount() > 0 && isDirection(code)) {
            long now = SystemClock.uptimeMillis();
            if (now - lastRepeat < 90) return true;
            lastRepeat = now;
        }
        if (isSelect(code) && !(getCurrentFocus() instanceof android.widget.EditText)) {
            if (action == KeyEvent.ACTION_DOWN) {
                if (e.getRepeatCount() == 0) { centerDown = true; longFired = false; centerEvent = new KeyEvent(e); return true; }
                if (centerDown && !longFired && dialog == null) {
                    Screen top = top();
                    View f = getCurrentFocus();
                    if (top != null && f != null && !isInside(f, nav) && top.onLongPress(f)) longFired = true;
                }
                return true;
            }
            if (action == KeyEvent.ACTION_UP) {
                if (!centerDown) return true;
                centerDown = false;
                if (longFired) return true;
                KeyEvent down = centerEvent;
                centerEvent = null;
                if (down != null) super.dispatchKeyEvent(down);
                return super.dispatchKeyEvent(e);
            }
        }
        if (code == KeyEvent.KEYCODE_MENU && action == KeyEvent.ACTION_DOWN && e.getRepeatCount() == 0 && dialog == null) {
            Screen top = top();
            View f = getCurrentFocus();
            if (top != null && (f == null || !isInside(f, nav))) top.onLongPress(f);
            return true;
        }
        if (code == KeyEvent.KEYCODE_BACK || code == KeyEvent.KEYCODE_ESCAPE || code == KeyEvent.KEYCODE_BUTTON_B) {
            if (action == KeyEvent.ACTION_UP && !e.isCanceled()) back();
            return true;
        }
        if (dialog == null && action == KeyEvent.ACTION_DOWN) {
            Screen top = top();
            View focus = getCurrentFocus();
            if (top != null && (focus == null || !isInside(focus, nav)) && top.onKey(e)) return true;
            if ((focus == null || !focus.isShown()) && isDirection(code) && top != null) { top.restoreFocus(); return true; }
        }
        return super.dispatchKeyEvent(e);
    }

    private void back() {
        if (dialog != null) { closeDialog(); return; }
        View focus = getCurrentFocus();
        if (focus != null && isInside(focus, nav)) {
            Screen top = top();
            if (top != null && "home".equals(top.railId())) {
                Dialogs.confirm(this, "Quitter YAMONFILM ?", "Tu pourras reprendre là où tu t'es arrêté.", "Quitter", this::finish);
            } else focusContent();
            return;
        }
        Screen top = top();
        if (top == null) { finish(); return; }
        if (top.onBack()) return;
        if (stack.size() > 1) { pop(); return; }
        String id = top.railId();
        if (id != null && !id.equals("home")) { openRail("home"); return; }
        if (id == null && top instanceof ProfilesScreen && App.repo().profile() != null) { openRail("home"); return; }
        if (id != null) { focusTopBar(); return; }
        Dialogs.confirm(this, "Quitter YAMONFILM ?", "Tu pourras reprendre là où tu t'es arrêté.", "Quitter", this::finish);
    }

    // ------------------------------------------------------------ Cycle de vie

    @Override protected void onResume() {
        super.onResume();
        resumed = true;
        App.MAIN.removeCallbacks(heartbeat);
        App.MAIN.post(heartbeat);
        Screen top = top();
        if (top != null && returningFromPlayer) { returningFromPlayer = false; top.onShow(false); top.restoreFocus(); refreshBadge(); }
        else if (top != null && pausedOnce && dialog == null) { top.onRefresh(); refreshBadge(); }
        if (Actions.openAccountOnReturn) { Actions.openAccountOnReturn = false; push(new VipScreen(this)); }
    }

    @Override protected void onPause() {
        super.onPause();
        resumed = false;
        pausedOnce = true;
        App.MAIN.removeCallbacks(heartbeat);
    }

    private boolean returningFromPlayer;
    public void launchPlayer(Intent intent) {
        returningFromPlayer = true;
        startActivity(intent);
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
    }

    public boolean isResumedNow() { return resumed; }

    @Override protected void onDestroy() {
        App.MAIN.removeCallbacks(heartbeat);
        for (Screen s : stack) s.destroy();
        for (Screen s : roots.values()) s.destroy();
        super.onDestroy();
    }
}
