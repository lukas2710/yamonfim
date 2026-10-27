package com.yamonfilm.tv.screens;

import android.content.Context;
import android.graphics.Outline;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.yamonfilm.tv.Actions;
import com.yamonfilm.tv.App;
import com.yamonfilm.tv.Dialogs;
import com.yamonfilm.tv.MainActivity;
import com.yamonfilm.tv.Models.Profile;
import com.yamonfilm.tv.R;
import com.yamonfilm.tv.Screen;
import com.yamonfilm.tv.Ui;

import java.util.List;

import static com.yamonfilm.tv.Ui.dp;

/** « Qui regarde ? » : profils du compte (table user_profiles). */
public final class ProfilesScreen extends Screen {
    private final boolean forced;
    private LinearLayout tiles;
    private TextView status;
    private List<Profile> profiles;

    public ProfilesScreen(MainActivity main, boolean forced) { super(main); this.forced = forced; }

    /** Mêmes avatars que la page Profils du site. */
    public static final String[][] AVATARS = {
            {"Raiponce", "https://static.wikia.nocookie.net/heros/images/4/42/Raiponce_Infobox.jpg/revision/latest?cb=20200723185055&path-prefix=fr"},
            {"Mickey", "https://avatarfiles.alphacoders.com/214/214614.jpg"},
            {"Reine des Neiges", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRz5Y10-MulAuvwLsp9t3wrzWVcXY5o2vfv3gnwPB2sJkKn0hBlTWzAo0-9&s=10"},
            {"Le Roi Lion", "https://journaldemickey.com/wp-content/uploads/2024/06/roi-lion-personnages.jpg"},
            {"Spider-Man", "https://avatarfiles.alphacoders.com/375/thumb-350-375896.webp"},
            {"Batman", "https://image.api.playstation.com/cdn/UP1018/CUSA00133_00/Dz5i57ktol8qBJsWEVdjNy8wj3Tc5fF0Y2MyX0Poi4lAniOaUpfjH5IU2vVejxey.png"},
            {"Joker", "https://img.magnific.com/free-vector/scary-clown-head-with-blue-hair-vector_43623-1371.jpg?semt=ais_hybrid&w=740&q=80"},
            {"Marvel", "https://avatarfiles.alphacoders.com/604/60402.jpg"},
            {"Mario", "https://pbs.twimg.com/profile_images/1929549617441521664/dn4udfbC_400x400.jpg"},
            {"Stranger Things", "https://cf-images.assettype.com/cinemaexpress%2F2026-01-01%2Fbr0w32gz%2FST5-1.jpg?w=480&auto=format%2Ccompress"},
            {"Anime", "https://www.projectxparis.com/cdn/shop/articles/344_75d7d802-3d2c-42ca-b360-afcc41033d8d.jpg?v=1759397750"},
            {"Gaming Neon", "https://cdn.dribbble.com/userupload/5333469/file/original-d913e65193d78f79999f30fce27114c8.png?resize=752x&vertical=center"},
    };

    @Override protected View create() {
        FrameLayout root = new FrameLayout(main);
        root.setBackground(Ui.gradient(GradientDrawable.Orientation.TOP_BOTTOM, 0xFF141722, 0xFF060A15));
        LinearLayout col = Ui.column(main);
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        Ui.noClip(col);
        LinearLayout logo = Ui.row(main);
        logo.addView(Ui.label(main, "YAMON", 26, Ui.ACCENT, Ui.W_BLACK));
        logo.addView(Ui.label(main, "FILM", 26, Ui.TEXT, Ui.W_BLACK));
        col.addView(logo, Ui.lp(Ui.WRAP, Ui.WRAP));
        col.addView(Ui.label(main, "Qui regarde ?", 46, Ui.TEXT, Ui.W_BOLD), Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(34), 0, 0));
        status = Ui.label(main, "Chargement des profils…", 16, Ui.MUTED, false);
        col.addView(status, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(10), 0, 0));
        HorizontalScrollView scroll = new HorizontalScrollView(main);
        scroll.setHorizontalScrollBarEnabled(false);
        Ui.noClip(scroll);
        tiles = Ui.row(main);
        tiles.setPadding(dp(30), dp(30), dp(30), dp(20));
        Ui.noClip(tiles);
        scroll.addView(tiles);
        col.addView(scroll, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(10), 0, 0));
        TextView hint = Ui.label(main, "Appui long sur OK pour modifier ou supprimer un profil", 14, Ui.DIM, false);
        col.addView(hint, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(6), 0, 0));
        TextView logout = Ui.button(main, "Se déconnecter", R.drawable.ic_logout, Ui.STYLE_GHOST);
        logout.setOnClickListener(v -> Dialogs.confirm(main, "Se déconnecter ?", "Tu devras saisir à nouveau ton email et ton mot de passe.", "Se déconnecter", () -> {
            App.background(() -> App.repo().signOut());
            App.repo().setProfile(null);
            main.setRoot("login", new LoginScreen(main));
        }));
        col.addView(logout, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(26), 0, 0));
        root.addView(col, Ui.flp(Ui.MATCH, Ui.WRAP, Gravity.CENTER));
        return root;
    }

    @Override protected void onShow(boolean first) { load(); }

    private void load() {
        io(() -> App.repo().profiles(), (list, e) -> {
            if (e != null) { status.setText("Impossible de charger tes profils. Réessaie dans un instant."); fail(e); return; }
            profiles = list;
            status.setText(list.isEmpty() ? "Crée ton premier profil pour commencer." : "Choisis ton profil");
            render();
        });
    }

    private void render() {
        String focusedId = lastFocus != null && lastFocus.getTag() instanceof String ? (String) lastFocus.getTag() : null;
        tiles.removeAllViews();
        View focus = null;
        for (Profile p : profiles) {
            View tile = tile(main, p.name, p.imageAvatar() ? p.avatar : null, p.initial(), 0);
            tile.setTag(p.id);
            tile.setOnClickListener(v -> choose(p));
            tiles.addView(tile);
            if (p.id.equals(focusedId) || (focus == null && App.repo().profile() != null && p.id.equals(App.repo().profileId()))) focus = tile;
        }
        View add = tile(main, "Ajouter un profil", null, "+", R.drawable.ic_plus);
        add.setTag("add");
        add.setOnClickListener(v -> main.push(new ProfileEditScreen(main, null)));
        tiles.addView(add);
        if (focus == null) focus = tiles.getChildAt(0);
        lastFocus = null;
        final View target = focus;
        tiles.post(() -> target.requestFocus());
    }

    private void choose(Profile p) {
        App.repo().setProfile(p);
        Actions.invalidateQuota();
        main.setRoot("home", new HomeScreen(main));
    }

    @Override protected boolean onLongPress(View focused) {
        if (focused == null || !(focused.getTag() instanceof String) || "add".equals(focused.getTag()) || profiles == null) return false;
        for (Profile p : profiles) if (p.id.equals(focused.getTag())) {
            Dialogs.actions(main, p.name, new String[]{"Regarder avec ce profil", "Modifier", "Supprimer"}, new int[]{R.drawable.ic_play, R.drawable.ic_edit, R.drawable.ic_trash}, i -> {
                if (i == 0) choose(p);
                else if (i == 1) main.push(new ProfileEditScreen(main, p));
                else Dialogs.confirm(main, "Supprimer « " + p.name + " » ?", "Le profil et son accès seront retirés de ce compte.", "Supprimer", () ->
                        io(() -> { App.repo().deleteProfile(p.id); return true; }, (ok, e) -> { if (e != null) fail(e); else { main.toast("Profil supprimé"); load(); } }));
            });
            return true;
        }
        return false;
    }

    /** Tuile ronde d'avatar avec nom. */
    static View tile(Context c, String name, String image, String initial, int iconRes) {
        LinearLayout tile = Ui.column(c);
        tile.setGravity(Gravity.CENTER_HORIZONTAL);
        tile.setFocusable(true);
        tile.setClickable(true);
        tile.setPadding(dp(18), 0, dp(18), 0);
        Ui.noClip(tile);
        FrameLayout avatar = new FrameLayout(c);
        avatar.setBackground(Ui.gradient(GradientDrawable.Orientation.TL_BR, 0xFF2A2F3D, 0xFF181B24));
        StateListDrawable ring = new StateListDrawable();
        ring.addState(Ui.focusedState(), Ui.ring(Ui.FOCUS, 4, 30));
        ring.addState(new int[]{}, Ui.ring(0x1AFFFFFF, 1, 30));
        avatar.setForeground(ring);
        Ui.clipRound(avatar, 30);
        avatar.setDuplicateParentStateEnabled(true);
        if (iconRes != 0) {
            ImageView i = Ui.icon(c, iconRes, Ui.TEXT, 54);
            avatar.addView(i, Ui.flp(dp(54), dp(54), Gravity.CENTER));
        } else {
            TextView letter = Ui.label(c, initial, 58, Ui.TEXT, Ui.W_BOLD);
            letter.setGravity(Gravity.CENTER);
            avatar.addView(letter, Ui.flp(Ui.MATCH, Ui.MATCH, Gravity.CENTER));
            letter.setBackground(Ui.gradient(GradientDrawable.Orientation.TL_BR, 0xFFFF3B47, 0xFFB2060F));
            if (image != null) {
                ImageView img = new ImageView(c);
                img.setScaleType(ImageView.ScaleType.CENTER_CROP);
                avatar.addView(img, Ui.flp(Ui.MATCH, Ui.MATCH, 0));
                App.images().load(img, image, dp(150), dp(150));
            }
        }
        tile.addView(avatar, Ui.lp(dp(156), dp(156)));
        TextView label = Ui.lines(Ui.label(c, name, 19, Ui.MUTED, Ui.W_MEDIUM), 1);
        label.setGravity(Gravity.CENTER);
        label.setMaxWidth(dp(170));
        label.setDuplicateParentStateEnabled(true);
        label.setTextColor(new android.content.res.ColorStateList(new int[][]{Ui.focusedState(), {}}, new int[]{Ui.TEXT, Ui.MUTED}));
        tile.addView(label, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(14), 0, 0));
        Ui.onFocus(tile, 1.1f, null);
        return tile;
    }

    @Override protected View defaultFocus() { return tiles == null ? null : tiles.getChildAt(0); }
    @Override protected boolean onBack() {
        if (forced || App.repo().profile() == null) return false;
        main.openRail("home");
        return true;
    }
}
