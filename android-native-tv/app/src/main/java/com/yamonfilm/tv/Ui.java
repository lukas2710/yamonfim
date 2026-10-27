package com.yamonfilm.tv;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.graphics.drawable.StateListDrawable;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Système de design TV : couleurs, typographie Poppins, boutons, pastilles, effets de sélection. */
public final class Ui {
    private Ui() { }

    // Couleurs
    public static final int BG = 0xFF060A15;
    public static final int SURFACE = 0xFF10192D;
    public static final int SURFACE2 = 0xFF192743;
    public static final int GLASS = 0x1FFFFFFF;
    public static final int STROKE = 0x26FFFFFF;
    public static final int TEXT = 0xFFF6F7F9;
    public static final int MUTED = 0xFFB7B7BF;
    public static final int DIM = 0xFF6E7485;
    public static final int ACCENT = 0xFF003CDA;
    public static final int GOLD = 0xFFF5B83D;
    public static final int GREEN = 0xFF2BD576;
    public static final int FOCUS = 0xFFFFFFFF;
    public static final int INK = 0xFF060A15;

    /** Marge haute des rubriques, sous la barre de navigation. */
    public static final int TOP = 104;
    /** Marge latérale de sécurité TV. */
    public static final int SIDE = 56;

    static final int[] FOCUSED = {android.R.attr.state_focused};
    static final int[] SELECTED = {android.R.attr.state_selected};
    static final int[] ACTIVATED = {android.R.attr.state_activated};
    static final int[] EMPTY = {};
    public static int[] focusedState() { return FOCUSED.clone(); }
    public static int[] activatedState() { return ACTIVATED.clone(); }

    private static float density = 1f;
    private static Typeface regular, medium, semibold, bold, black;
    public static final int W_REGULAR = 0, W_MEDIUM = 1, W_SEMIBOLD = 2, W_BOLD = 3, W_BLACK = 4;

    public static void init(Context c) {
        density = c.getResources().getDisplayMetrics().density;
        if (regular == null) {
            try {
                regular = c.getResources().getFont(R.font.poppins_regular);
                medium = c.getResources().getFont(R.font.poppins_medium);
                semibold = c.getResources().getFont(R.font.poppins_semibold);
                bold = c.getResources().getFont(R.font.poppins_bold);
                black = c.getResources().getFont(R.font.poppins_extrabold);
            } catch (Exception e) {
                regular = Typeface.create("sans-serif", Typeface.NORMAL);
                medium = Typeface.create("sans-serif-medium", Typeface.NORMAL);
                semibold = bold = black = Typeface.create("sans-serif", Typeface.BOLD);
            }
        }
    }

    public static int dp(float v) { return Math.round(v * density); }

    public static Typeface font(int weight) {
        switch (weight) {
            case W_MEDIUM: return medium;
            case W_SEMIBOLD: return semibold;
            case W_BOLD: return bold;
            case W_BLACK: return black;
            default: return regular;
        }
    }

    public static GradientDrawable round(int color, float radiusDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(radiusDp));
        return g;
    }

    public static GradientDrawable stroked(int color, int strokeColor, float strokeDp, float radiusDp) {
        GradientDrawable g = round(color, radiusDp);
        g.setStroke(dp(strokeDp), strokeColor);
        return g;
    }

    public static GradientDrawable ring(int strokeColor, float strokeDp, float radiusDp) {
        return stroked(Color.TRANSPARENT, strokeColor, strokeDp, radiusDp);
    }

    public static GradientDrawable gradient(GradientDrawable.Orientation o, int... colors) {
        return new GradientDrawable(o, colors);
    }

    public static GradientDrawable oval(int color) {
        GradientDrawable g = new GradientDrawable();
        g.setShape(GradientDrawable.OVAL);
        g.setColor(color);
        return g;
    }

    /** Cadre de sélection : liseré blanc net et halo doux autour. */
    public static Drawable focusRing(float radiusDp) {
        LayerDrawable on = new LayerDrawable(new Drawable[]{ring(0x40FFFFFF, 7, radiusDp + 2), ring(FOCUS, 3, radiusDp)});
        on.setLayerInset(0, -dp(4), -dp(4), -dp(4), -dp(4));
        StateListDrawable s = new StateListDrawable();
        s.addState(FOCUSED, ring(FOCUS, 3, radiusDp));
        s.addState(SELECTED, ring(FOCUS, 3, radiusDp));
        s.addState(EMPTY, new ColorDrawable(Color.TRANSPARENT));
        return s;
    }

    public static void clipRound(View v, final float radiusDp) {
        v.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View view, Outline outline) { outline.setRoundRect(0, 0, view.getWidth(), view.getHeight(), dp(radiusDp)); }
        });
        v.setClipToOutline(true);
    }

    public static void clipOval(View v) {
        v.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View view, Outline outline) { outline.setOval(0, 0, view.getWidth(), view.getHeight()); }
        });
        v.setClipToOutline(true);
    }

    // ------------------------------------------------------------ Texte

    public static TextView text(Context c, float sp, int color, int weight) {
        TextView t = new TextView(c);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        t.setIncludeFontPadding(false);
        t.setTypeface(font(weight));
        if (sp >= 28) t.setLetterSpacing(-0.01f);
        return t;
    }

    public static TextView text(Context c, float sp, int color, boolean bold) { return text(c, sp, color, bold ? W_SEMIBOLD : W_REGULAR); }

    public static TextView lines(TextView t, int max) {
        t.setMaxLines(max);
        t.setEllipsize(TextUtils.TruncateAt.END);
        return t;
    }

    public static TextView label(Context c, String value, float sp, int color, boolean bold) {
        TextView t = text(c, sp, color, bold);
        t.setText(value);
        return t;
    }

    public static TextView label(Context c, String value, float sp, int color, int weight) {
        TextView t = text(c, sp, color, weight);
        t.setText(value);
        return t;
    }

    /** Petit intitulé en capitales espacées (rubrique, type de contenu). */
    public static TextView kicker(Context c, String value, int color) {
        TextView t = text(c, 12, color, W_SEMIBOLD);
        t.setText(value);
        t.setLetterSpacing(0.22f);
        t.setAllCaps(true);
        return t;
    }

    /** Pastille d'information (année, genre, durée…). */
    public static TextView tag(Context c, String value) {
        TextView t = text(c, 13, 0xFFE6E8EE, W_MEDIUM);
        t.setText(value);
        t.setBackground(round(0x24FFFFFF, 8));
        t.setPadding(dp(10), dp(5), dp(10), dp(5));
        return t;
    }

    // ------------------------------------------------------------ Sélection

    private static final DecelerateInterpolator EASE = new DecelerateInterpolator(1.6f);

    /** Effet de sélection : zoom fluide et élévation, plus action facultative à la prise de focus. */
    public static void onFocus(final View v, final float scale, final Runnable focused) {
        v.setOnFocusChangeListener((view, has) -> {
            view.animate().scaleX(has ? scale : 1f).scaleY(has ? scale : 1f).translationZ(has ? dp(4) : 0)
                    .setInterpolator(EASE).setDuration(120).start();
            if (has && focused != null) focused.run();
        });
    }

    // ------------------------------------------------------------ Boutons

    public static final int STYLE_NORMAL = 0, STYLE_PRIMARY = 1, STYLE_GOLD = 2, STYLE_GHOST = 3;

    public static TextView button(Context c, String label, int iconRes, int style) {
        TextView b = text(c, 16, TEXT, W_SEMIBOLD);
        b.setText(label);
        b.setGravity(Gravity.CENTER);
        b.setSingleLine(true);
        b.setFocusable(true);
        b.setClickable(true);
        b.setMinHeight(dp(50));
        b.setPadding(dp(iconRes != 0 ? 22 : 28), 0, dp(28), 0);
        int normalBg = style == STYLE_PRIMARY ? ACCENT : style == STYLE_GOLD ? GOLD : style == STYLE_GHOST ? 0x14FFFFFF : 0x29FFFFFF;
        int normalText = style == STYLE_GOLD ? 0xFF1A1206 : TEXT;
        StateListDrawable bg = new StateListDrawable();
        bg.addState(FOCUSED, round(FOCUS, 10));
        bg.addState(EMPTY, "Regarder".equals(label) ? watchBackground() : style == STYLE_GHOST ? stroked(normalBg, 0x33FFFFFF, 1.5f, 10) : round(normalBg, 10));
        b.setBackground(bg);
        ColorStateList colors = new ColorStateList(new int[][]{FOCUSED, EMPTY}, new int[]{INK, normalText});
        b.setTextColor(colors);
        if (iconRes != 0) {
            Drawable icon = c.getDrawable(iconRes).mutate();
            icon.setBounds(0, 0, dp(22), dp(22));
            b.setCompoundDrawables(icon, null, null, null);
            b.setCompoundDrawablePadding(dp(10));
            b.setCompoundDrawableTintList(colors);
        }
        b.setElevation(0);
        onFocus(b, 1.035f, null);
        return b;
    }

    private static Drawable watchBackground() {
        return new android.graphics.drawable.Drawable() {
            final android.graphics.Paint p = new android.graphics.Paint(3);
            @Override public void draw(android.graphics.Canvas canvas) {
                android.graphics.Rect b = getBounds();
                android.graphics.Path clip = new android.graphics.Path();
                clip.addRoundRect(new android.graphics.RectF(b), dp(10), dp(10), android.graphics.Path.Direction.CW);
                int save = canvas.save(); canvas.clipPath(clip);
                p.setColor(ACCENT); canvas.drawRect(b, p);
                android.graphics.Path tip = new android.graphics.Path();
                tip.moveTo(b.left + b.width() * .94f, b.top);
                tip.lineTo(b.right, b.top); tip.lineTo(b.right, b.bottom);
                tip.lineTo(b.left + b.width() * .86f, b.bottom); tip.close();
                p.setColor(0xFFF02D3F); canvas.drawPath(tip, p); canvas.restoreToCount(save);
            }
            @Override public void setAlpha(int alpha) { p.setAlpha(alpha); }
            @Override public void setColorFilter(android.graphics.ColorFilter filter) { p.setColorFilter(filter); }
            @Override public int getOpacity() { return android.graphics.PixelFormat.TRANSLUCENT; }
        };
    }

    /** Bouton rond à icône seule (recherche, retour…). */
    public static ImageView iconButton(Context c, int iconRes, int sizeDp) {
        ImageView b = new ImageView(c);
        b.setImageResource(iconRes);
        b.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        b.setPadding(dp(sizeDp * 0.27f), dp(sizeDp * 0.27f), dp(sizeDp * 0.27f), dp(sizeDp * 0.27f));
        b.setFocusable(true);
        b.setClickable(true);
        StateListDrawable bg = new StateListDrawable();
        bg.addState(FOCUSED, oval(FOCUS));
        bg.addState(EMPTY, oval(0x1FFFFFFF));
        b.setBackground(bg);
        b.setImageTintList(new ColorStateList(new int[][]{FOCUSED, EMPTY}, new int[]{INK, TEXT}));
        b.setLayoutParams(new LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp)));
        onFocus(b, 1.1f, null);
        return b;
    }

    /** Pastille de choix (saison, catégorie). L'état « activé » marque le choix courant. */
    public static TextView chip(Context c, String label) {
        TextView b = text(c, 15, TEXT, W_MEDIUM);
        b.setText(label);
        b.setGravity(Gravity.CENTER);
        b.setSingleLine(true);
        b.setFocusable(true);
        b.setClickable(true);
        b.setMinHeight(dp(42));
        b.setPadding(dp(20), 0, dp(20), 0);
        StateListDrawable bg = new StateListDrawable();
        bg.addState(FOCUSED, round(FOCUS, 21));
        bg.addState(ACTIVATED, stroked(0x33FFFFFF, 0x66FFFFFF, 1.5f, 21));
        bg.addState(EMPTY, round(0x12FFFFFF, 21));
        b.setBackground(bg);
        b.setTextColor(new ColorStateList(new int[][]{FOCUSED, ACTIVATED, EMPTY}, new int[]{INK, TEXT, MUTED}));
        onFocus(b, 1.06f, null);
        return b;
    }

    /** Champ de saisie : OK ouvre le clavier de la télévision. */
    public static android.widget.EditText input(Context c, String hint, int inputType) {
        android.widget.EditText e = new android.widget.EditText(c);
        e.setHint(hint);
        e.setInputType(inputType);
        e.setSingleLine(true);
        e.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        e.setTypeface(font(W_MEDIUM));
        e.setTextColor(TEXT);
        e.setHintTextColor(DIM);
        e.setPadding(dp(22), 0, dp(22), 0);
        e.setMinHeight(dp(58));
        StateListDrawable bg = new StateListDrawable();
        bg.addState(FOCUSED, stroked(0x1FFFFFFF, FOCUS, 2.5f, 16));
        bg.addState(EMPTY, stroked(0x12FFFFFF, 0x1FFFFFFF, 1, 16));
        e.setBackground(bg);
        // Le clavier de la TV ne s'ouvre que sur OK, pas dès que le champ est sélectionné.
        e.setShowSoftInputOnFocus(false);
        e.setOnKeyListener((v, code, ev) -> {
            boolean ok = code == android.view.KeyEvent.KEYCODE_DPAD_CENTER || code == android.view.KeyEvent.KEYCODE_ENTER || code == android.view.KeyEvent.KEYCODE_NUMPAD_ENTER;
            if (!ok) return false;
            if (ev.getAction() == android.view.KeyEvent.ACTION_UP) {
                android.view.inputmethod.InputMethodManager imm = (android.view.inputmethod.InputMethodManager) c.getSystemService(Context.INPUT_METHOD_SERVICE);
                if (imm != null) imm.showSoftInput(v, android.view.inputmethod.InputMethodManager.SHOW_FORCED);
            }
            return true;
        });
        return e;
    }

    public static ImageView icon(Context c, int res, int color, int sizeDp) {
        ImageView i = new ImageView(c);
        i.setImageResource(res);
        i.setImageTintList(ColorStateList.valueOf(color));
        i.setLayoutParams(new LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp)));
        return i;
    }

    /** En-tête de rubrique : intitulé, grand titre, sous-titre facultatif. */
    public static LinearLayout header(Context c, String kicker, String title, String subtitle) {
        LinearLayout h = column(c);
        if (kicker != null) h.addView(kicker(c, kicker, ACCENT), lp(WRAP, WRAP, 0, 0, 0, dp(8)));
        TextView t = label(c, title, 36, TEXT, W_BOLD);
        h.addView(t);
        if (subtitle != null) {
            TextView s = label(c, subtitle, 16, MUTED, W_REGULAR);
            h.addView(s, lp(WRAP, WRAP, 0, dp(8), 0, 0));
        }
        return h;
    }

    public static LinearLayout row(Context c) { LinearLayout l = new LinearLayout(c); l.setOrientation(LinearLayout.HORIZONTAL); return l; }
    public static LinearLayout column(Context c) { LinearLayout l = new LinearLayout(c); l.setOrientation(LinearLayout.VERTICAL); return l; }

    public static LinearLayout.LayoutParams lp(int w, int h) { return new LinearLayout.LayoutParams(w, h); }
    public static LinearLayout.LayoutParams lp(int w, int h, int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(w, h);
        p.setMargins(left, top, right, bottom);
        return p;
    }
    public static FrameLayout.LayoutParams flp(int w, int h, int gravity) { return new FrameLayout.LayoutParams(w, h, gravity); }

    public static final int MATCH = ViewGroup.LayoutParams.MATCH_PARENT, WRAP = ViewGroup.LayoutParams.WRAP_CONTENT;

    public static void noClip(ViewGroup g) { g.setClipChildren(false); g.setClipToPadding(false); }

    public static View spacer(Context c, int wDp, int hDp) { View v = new View(c); v.setLayoutParams(new LinearLayout.LayoutParams(dp(wDp), dp(hDp))); return v; }

    /** Fond d'écran commun : noir profond avec une lueur discrète. */
    public static Drawable screenBackground() {
        GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFF101D3B, 0xFF060A15, 0xFF060A15});
        return g;
    }
}
