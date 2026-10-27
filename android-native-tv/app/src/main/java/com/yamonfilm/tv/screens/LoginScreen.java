package com.yamonfilm.tv.screens;

import android.graphics.drawable.GradientDrawable;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.yamonfilm.tv.App;
import com.yamonfilm.tv.MainActivity;
import com.yamonfilm.tv.Screen;
import com.yamonfilm.tv.Ui;

import static com.yamonfilm.tv.Ui.dp;

/** Connexion et création de compte (mêmes comptes que le site). */
public final class LoginScreen extends Screen {
    private EditText email, password;
    private TextView submit, toggle, title, error;
    private boolean signUp, loading;

    public LoginScreen(MainActivity main) { super(main); }

    @Override protected View create() {
        FrameLayout root = new FrameLayout(main);
        root.setBackground(Ui.gradient(GradientDrawable.Orientation.TL_BR, 0xFF102759, 0xFF0D0E14, 0xFF060A15));
        LinearLayout row = Ui.row(main);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(80), dp(40), dp(80), dp(40));
        Ui.noClip(row);

        LinearLayout brand = Ui.column(main);
        LinearLayout logo = Ui.row(main);
        TextView yamon = Ui.label(main, "YAMON", 46, Ui.ACCENT, Ui.W_BLACK);
        TextView film = Ui.label(main, "FILM", 46, Ui.TEXT, Ui.W_BLACK);
        yamon.setSingleLine(true);
        film.setSingleLine(true);
        logo.addView(yamon);
        logo.addView(film);
        brand.addView(logo);
        TextView tagline = Ui.label(main, "Tes films et séries,\nsur grand écran.", 26, Ui.TEXT, Ui.W_SEMIBOLD);
        tagline.setLineSpacing(0, 1.15f);
        brand.addView(tagline, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(14), 0, 0));
        TextView note = Ui.label(main, "Utilise le même compte que sur le site.\nTes profils, ton historique et ton accès VIP te suivent.", 16, Ui.MUTED, false);
        note.setLineSpacing(0, 1.35f);
        brand.addView(note, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(22), 0, 0));
        row.addView(brand, new LinearLayout.LayoutParams(0, Ui.WRAP, 1f));

        LinearLayout form = Ui.column(main);
        form.setBackground(Ui.stroked(0xE6111319, 0x1FFFFFFF, 1, 28));
        form.setPadding(dp(40), dp(36), dp(40), dp(32));
        form.setElevation(dp(20));
        Ui.noClip(form);
        title = Ui.label(main, "Connexion", 30, Ui.TEXT, Ui.W_BOLD);
        form.addView(title);
        email = Ui.input(main, "Adresse email", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        email.setImeOptions(EditorInfo.IME_ACTION_NEXT);
        form.addView(email, Ui.lp(Ui.MATCH, Ui.WRAP, 0, dp(24), 0, 0));
        password = Ui.input(main, "Mot de passe", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        password.setImeOptions(EditorInfo.IME_ACTION_DONE);
        form.addView(password, Ui.lp(Ui.MATCH, Ui.WRAP, 0, dp(14), 0, 0));
        email.setOnEditorActionListener((v, action, e) -> { password.requestFocus(); return true; });
        password.setOnEditorActionListener((v, action, e) -> { submit.requestFocus(); return false; });
        error = Ui.label(main, "", 14, 0xFFFF8A8A, false);
        error.setVisibility(View.GONE);
        form.addView(error, Ui.lp(Ui.MATCH, Ui.WRAP, 0, dp(12), 0, 0));
        submit = Ui.button(main, "Se connecter", 0, Ui.STYLE_PRIMARY);
        submit.setGravity(Gravity.CENTER);
        submit.setOnClickListener(v -> submit());
        form.addView(submit, Ui.lp(Ui.MATCH, Ui.WRAP, 0, dp(20), 0, 0));
        toggle = Ui.button(main, "Pas encore de compte ? Créer un compte", 0, Ui.STYLE_GHOST);
        toggle.setGravity(Gravity.CENTER);
        toggle.setOnClickListener(v -> setMode(!signUp));
        form.addView(toggle, Ui.lp(Ui.MATCH, Ui.WRAP, 0, dp(12), 0, 0));
        row.addView(form, new LinearLayout.LayoutParams(dp(470), Ui.WRAP));
        root.addView(row, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        return root;
    }

    private void setMode(boolean create) {
        signUp = create;
        title.setText(create ? "Créer un compte" : "Connexion");
        submit.setText(create ? "Créer mon compte" : "Se connecter");
        toggle.setText(create ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? Créer un compte");
        error.setVisibility(View.GONE);
    }

    private void showError(String message, int color) {
        error.setTextColor(color);
        error.setText(message);
        error.setVisibility(View.VISIBLE);
    }

    private void submit() {
        if (loading) return;
        final String mail = email.getText().toString().trim(), pass = password.getText().toString();
        if (mail.isEmpty() || !mail.contains("@")) { showError("Saisis ton adresse email.", 0xFFFF8A8A); email.requestFocus(); return; }
        if (pass.isEmpty()) { showError("Saisis ton mot de passe.", 0xFFFF8A8A); password.requestFocus(); return; }
        loading = true;
        submit.setText(signUp ? "Création…" : "Connexion…");
        final boolean creating = signUp;
        io(() -> creating ? App.repo().api.signUp(mail, pass) : App.repo().api.signIn(mail, pass) != null, (ok, e) -> {
            loading = false;
            setMode(creating);
            if (e != null) { showError(App.message(e), 0xFFFF8A8A); return; }
            if (creating && !ok) {
                setMode(false);
                showError("Compte créé avec succès ! Vérifie ton adresse email si une confirmation est demandée, puis connecte-toi.", 0xFF7EE2A8);
                password.setText("");
                return;
            }
            App.repo().setProfile(null);
            main.setRoot("profiles", new ProfilesScreen(main, true));
        });
    }

    @Override protected View defaultFocus() { return email.getText().length() == 0 ? email : submit; }
    @Override protected String presenceAction() { return "Navigate sur le site"; }
}
