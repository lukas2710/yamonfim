package com.yamonfilm.tv.screens;

import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.yamonfilm.tv.App;
import com.yamonfilm.tv.Cards;
import com.yamonfilm.tv.Dialogs;
import com.yamonfilm.tv.MainActivity;
import com.yamonfilm.tv.Models.Profile;
import com.yamonfilm.tv.R;
import com.yamonfilm.tv.Screen;
import com.yamonfilm.tv.Ui;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static com.yamonfilm.tv.Ui.dp;

/** Création ou modification d'un profil : nom, mode (Standard, Kids, Junior) et avatar. */
public final class ProfileEditScreen extends Screen {
    private final Profile editing;
    private EditText name;
    private String avatar, mode;
    private final List<View> avatarViews = new ArrayList<>();
    private final List<TextView> modeChips = new ArrayList<>();
    private LinearLayout avatarsBox;
    private TextView preview;
    private boolean saving;

    private static final String[][] MODES = {
            {"standard", "Standard", "Tout le catalogue"},
            {"kids", "Kids", "Petits enfants"},
            {"junior", "Junior", "Enfants plus grands"},
    };

    public ProfileEditScreen(MainActivity main, Profile editing) {
        super(main);
        this.editing = editing;
        avatar = editing != null && editing.avatar != null && !editing.avatar.isEmpty() ? editing.avatar : ProfilesScreen.AVATARS[0][1];
        mode = editing != null && editing.mode != null ? editing.mode : "standard";
    }

    @Override protected View create() {
        FrameLayout root = new FrameLayout(main);
        root.setBackground(Ui.gradient(GradientDrawable.Orientation.TOP_BOTTOM, 0xFF0F1830, 0xFF060A15));
        Cards.VScroll scroll = new Cards.VScroll(main, false);
        LinearLayout col = scroll.content;
        col.setPadding(dp(80), dp(44), dp(80), dp(60));
        col.addView(Ui.kicker(main, editing == null ? "NOUVEAU PROFIL" : "MODIFIER LE PROFIL", Ui.ACCENT_TEXT));
        LinearLayout top = Ui.row(main);
        top.setGravity(Gravity.CENTER_VERTICAL);
        Ui.noClip(top);
        preview = new TextView(main);
        LinearLayout fields = Ui.column(main);
        Ui.noClip(fields);
        name = Ui.input(main, "Nom du profil", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        name.setImeOptions(EditorInfo.IME_ACTION_DONE);
        if (editing != null) name.setText(editing.name);
        fields.addView(name, Ui.lp(dp(460), Ui.WRAP));
        // Mode du profil : comme sur le site, Kids et Junior ne voient que les titres adaptés.
        LinearLayout modes = Ui.row(main);
        Ui.noClip(modes);
        for (String[] m : MODES) {
            TextView chip = Ui.chip(main, m[1] + "  ·  " + m[2]);
            chip.setActivated(m[0].equals(mode));
            chip.setOnClickListener(v -> { mode = m[0]; for (TextView c : modeChips) c.setActivated(c == v); });
            modes.addView(chip, Ui.lp(Ui.WRAP, Ui.WRAP, 0, 0, dp(10), 0));
            modeChips.add(chip);
        }
        fields.addView(modes, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(16), 0, 0));
        top.addView(fields);
        col.addView(top, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(18), 0, 0));

        LinearLayout buttons = Ui.row(main);
        Ui.noClip(buttons);
        TextView save = Ui.button(main, "Enregistrer", R.drawable.ic_check, Ui.STYLE_PRIMARY);
        save.setOnClickListener(v -> save());
        buttons.addView(save);
        TextView cancel = Ui.button(main, "Annuler", 0, Ui.STYLE_NORMAL);
        cancel.setOnClickListener(v -> main.pop());
        buttons.addView(cancel, Ui.lp(Ui.WRAP, Ui.WRAP, dp(14), 0, 0, 0));
        if (editing != null) {
            TextView delete = Ui.button(main, "Supprimer", R.drawable.ic_trash, Ui.STYLE_GHOST);
            delete.setOnClickListener(v -> Dialogs.confirm(main, "Supprimer « " + editing.name + " » ?", null, "Supprimer", () ->
                    io(() -> { App.repo().deleteProfile(editing.id); return true; }, (ok, e) -> { if (e != null) fail(e); else { main.toast("Profil supprimé"); main.pop(); } })));
            buttons.addView(delete, Ui.lp(Ui.WRAP, Ui.WRAP, dp(14), 0, 0, 0));
        }
        col.addView(buttons, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(22), 0, 0));

        col.addView(Ui.label(main, "Choisis un avatar", 22, Ui.TEXT, Ui.W_SEMIBOLD), Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(30), 0, dp(4)));
        avatarsBox = Ui.column(main);
        Ui.noClip(avatarsBox);
        col.addView(avatarsBox);
        root.addView(scroll, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        // Avatars d'origine tout de suite, puis ceux de la bibliothèque du site.
        renderAvatars(defaultAvatars());
        io(() -> App.repo().avatarCategories(), (groups, e) -> { if (groups != null) renderAvatars(groups); });
        return root;
    }

    private static Map<String, List<String[]>> defaultAvatars() {
        Map<String, List<String[]>> groups = new java.util.LinkedHashMap<>();
        for (String[][] group : com.yamonfilm.tv.Logic.DEFAULT_AVATARS) {
            List<String[]> list = new ArrayList<>();
            for (int i = 1; i < group.length; i++) list.add(group[i]);
            groups.put(group[0][0], list);
        }
        return groups;
    }

    /** Avatars par catégorie, en rangées défilantes. */
    private void renderAvatars(Map<String, List<String[]>> groups) {
        boolean hadFocus = MainActivity.isInside(main.getCurrentFocus(), avatarsBox);
        avatarsBox.removeAllViews();
        avatarViews.clear();
        View selected = null;
        for (Map.Entry<String, List<String[]>> g : groups.entrySet()) {
            if (g.getValue().isEmpty()) continue;
            Cards.Shelf shelf = new Cards.Shelf(main, g.getKey());
            shelf.title.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 16);
            shelf.title.setTextColor(Ui.MUTED);
            for (String[] a : g.getValue()) {
                View v = avatarTile(a[1]);
                shelf.add(v, 18);
                if (a[1].equals(avatar)) selected = v;
            }
            avatarsBox.addView(shelf, Ui.lp(Ui.MATCH, Ui.WRAP, 0, dp(10), 0, 0));
        }
        if (hadFocus) (selected != null ? selected : avatarViews.isEmpty() ? name : avatarViews.get(0)).requestFocus();
    }

    private View avatarTile(String url) {
        FrameLayout a = new FrameLayout(main);
        a.setLayoutParams(new android.view.ViewGroup.MarginLayoutParams(dp(96), dp(96)));
        a.setFocusable(true);
        a.setClickable(true);
        a.setTag(url);
        a.setBackground(Ui.gradient(GradientDrawable.Orientation.TL_BR, 0xFF23304F, 0xFF111A30));
        StateListDrawable ring = new StateListDrawable();
        ring.addState(Ui.focusedState(), Ui.ring(Ui.FOCUS, 4, 24));
        ring.addState(Ui.activatedState(), Ui.ring(Ui.GOLD, 4, 24));
        ring.addState(new int[]{}, new android.graphics.drawable.ColorDrawable(0));
        a.setForeground(ring);
        Ui.clipRound(a, 24);
        ImageView img = new ImageView(main);
        img.setScaleType(ImageView.ScaleType.CENTER_CROP);
        a.addView(img, Ui.flp(Ui.MATCH, Ui.MATCH, 0));
        App.images().load(img, url, dp(96), dp(96));
        a.setActivated(url.equals(avatar));
        a.setOnClickListener(v -> { avatar = url; for (View o : avatarViews) o.setActivated(url.equals(o.getTag())); });
        Ui.onFocus(a, 1.12f, null);
        avatarViews.add(a);
        return a;
    }

    private void save() {
        final String value = name.getText().toString().trim();
        if (value.isEmpty()) { main.toast("Donne un nom à ce profil."); name.requestFocus(); return; }
        if (saving) return;
        saving = true;
        final String chosen = avatar, chosenMode = mode;
        io(() -> { App.repo().saveProfile(editing == null ? null : editing.id, value, chosen, chosenMode); return true; }, (ok, e) -> {
            saving = false;
            if (e != null) { fail(e); return; }
            main.toast(editing == null ? "Profil créé" : "Profil enregistré");
            main.pop();
        });
    }

    @Override protected View defaultFocus() { return name; }
}
