package com.yamonfilm.tv.screens;

import android.graphics.Outline;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.ScrollView;
import org.json.JSONArray;
import org.json.JSONObject;

import com.yamonfilm.tv.App;
import com.yamonfilm.tv.Dialogs;
import com.yamonfilm.tv.MainActivity;
import com.yamonfilm.tv.Models.Profile;
import com.yamonfilm.tv.R;
import com.yamonfilm.tv.Screen;
import com.yamonfilm.tv.Ui;

import java.util.ArrayList;
import java.util.List;

import static com.yamonfilm.tv.Ui.dp;

/** Création ou modification d'un profil. */
public final class ProfileEditScreen extends Screen {
    private final Profile editing;
    private EditText name;
    private String avatar;
    private final List<View> avatarViews = new ArrayList<>();
    private boolean saving;
    private LinearLayout grid;
    private int avatarSize;
    private int columns;

    public ProfileEditScreen(MainActivity main, Profile editing) {
        super(main);
        this.editing = editing;
        avatar = editing != null && editing.avatar != null && !editing.avatar.isEmpty() ? editing.avatar : ProfilesScreen.AVATARS[0][1];
    }

    @Override protected View create() {
        FrameLayout root = new FrameLayout(main);
        root.setBackgroundColor(Ui.BG);
        LinearLayout col = Ui.column(main);
        col.setPadding(dp(40), dp(24), dp(40), dp(30));
        int available = main.getResources().getDisplayMetrics().widthPixels - dp(100);
        columns = Math.max(2, Math.min(8, available / dp(120)));
        avatarSize = Math.min(dp(96), (available - columns * dp(18)) / columns);
        Ui.noClip(col);
        col.addView(Ui.label(main, editing == null ? "Nouveau profil" : "Modifier le profil", 32, Ui.TEXT, true));
        name = Ui.input(main, "Nom du profil", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        name.setImeOptions(EditorInfo.IME_ACTION_DONE);
        if (editing != null) name.setText(editing.name);
        col.addView(name, Ui.lp(dp(460), Ui.WRAP, 0, dp(22), 0, 0));
        col.addView(Ui.label(main, "Choisis un avatar", 18, Ui.MUTED, true), Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(26), 0, dp(10)));
        grid = Ui.column(main);
        Ui.noClip(grid);
        renderAvatars(new JSONArray());
        col.addView(grid);
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
        col.addView(buttons, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(18), 0, 0));
        ScrollView scroll = new ScrollView(main);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        scroll.addView(col);
        root.addView(scroll);
        io(() -> App.repo().profileAvatars(), (rows, error) -> {
            if (error != null) { main.toast("Nouveaux avatars indisponibles. Les avatars habituels restent disponibles."); return; }
            renderAvatars(rows);
        });
        return root;
    }

    private void renderAvatars(JSONArray rows) {
        grid.removeAllViews();
        avatarViews.clear();
        java.util.LinkedHashMap<String, List<String[]>> groups = new java.util.LinkedHashMap<>();
        List<String[]> defaults = new ArrayList<>();
        for (String[] item : ProfilesScreen.AVATARS) defaults.add(item);
        groups.put("Les classiques", defaults);
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.optJSONObject(i);
            if (row == null || !row.optString("image_url").startsWith("https://")) continue;
            String category = row.optString("category", "Autres");
            if (!groups.containsKey(category)) groups.put(category, new ArrayList<>());
            groups.get(category).add(new String[]{row.optString("name"), row.optString("image_url")});
        }
        for (java.util.Map.Entry<String, List<String[]>> group : groups.entrySet()) {
            grid.addView(Ui.label(main, group.getKey(), 16, Ui.TEXT, true), Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(12), 0, dp(12)));
            List<String[]> entries = group.getValue();
            LinearLayout line = null;
            for (int i = 0; i < entries.size(); i++) {
                if (i % columns == 0) { line = Ui.row(main); Ui.noClip(line); grid.addView(line, Ui.lp(Ui.WRAP, Ui.WRAP, 0, 0, 0, dp(14))); }
                final String url = entries.get(i)[1];
                FrameLayout a = new FrameLayout(main);
                a.setFocusable(true);
                a.setClickable(true);
                a.setTag(url);
                a.setContentDescription(entries.get(i)[0]);
                a.setBackground(Ui.round(0xFF2A2E39, 50));
                StateListDrawable ring = new StateListDrawable();
                ring.addState(Ui.focusedState(), oval(Ui.FOCUS));
                ring.addState(Ui.activatedState(), oval(Ui.GOLD));
                ring.addState(new int[]{}, new android.graphics.drawable.ColorDrawable(0));
                a.setForeground(ring);
                a.setOutlineProvider(new ViewOutlineProvider() { @Override public void getOutline(View v, Outline o) { o.setOval(0, 0, v.getWidth(), v.getHeight()); } });
                a.setClipToOutline(true);
                ImageView img = new ImageView(main);
                img.setScaleType(ImageView.ScaleType.CENTER_CROP);
                a.addView(img, Ui.flp(Ui.MATCH, Ui.MATCH, 0));
                App.images().load(img, url, avatarSize, avatarSize);
                a.setActivated(url.equals(avatar));
                a.setOnClickListener(v -> { avatar = url; for (View o : avatarViews) o.setActivated(url.equals(o.getTag())); });
                Ui.onFocus(a, 1.1f, null);
                LinearLayout tile = Ui.column(main);
                tile.addView(a, Ui.lp(avatarSize, avatarSize));
                TextView caption = Ui.label(main, entries.get(i)[0], 12, Ui.MUTED, false);
                caption.setMaxLines(2);
                caption.setGravity(Gravity.CENTER);
                tile.addView(caption, Ui.lp(avatarSize, Ui.WRAP, 0, dp(6), 0, 0));
                line.addView(tile, Ui.lp(avatarSize, Ui.WRAP, 0, 0, dp(18), 0));
                avatarViews.add(a);
            }
        }
    }

    private static GradientDrawable oval(int color) {
        GradientDrawable g = new GradientDrawable();
        g.setShape(GradientDrawable.OVAL);
        g.setStroke(dp(4), color);
        return g;
    }

    private void save() {
        final String value = name.getText().toString().trim();
        if (value.isEmpty()) { main.toast("Donne un nom à ce profil."); name.requestFocus(); return; }
        if (saving) return;
        saving = true;
        final String chosen = avatar;
        io(() -> { App.repo().saveProfile(editing == null ? null : editing.id, value, chosen); return true; }, (ok, e) -> {
            saving = false;
            if (e != null) { fail(e); return; }
            main.toast(editing == null ? "Profil créé" : "Profil enregistré");
            main.pop();
        });
    }

    @Override protected View defaultFocus() { return name; }
}
