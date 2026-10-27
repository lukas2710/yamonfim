package com.yamonfilm.tv;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.drawable.StateListDrawable;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;

import static com.yamonfilm.tv.Ui.dp;

/** Clavier à l'écran, conçu pour les flèches de la télécommande. */
public final class Keyboard extends LinearLayout {
    public interface Listener { void changed(String text); }
    private final StringBuilder text = new StringBuilder();
    private final Listener listener;

    public Keyboard(Context c, Listener listener) {
        super(c);
        this.listener = listener;
        setOrientation(VERTICAL);
        Ui.noClip(this);
        String keys = "abcdefghijklmnopqrstuvwxyz1234567890";
        LinearLayout line = null;
        for (int i = 0; i < keys.length(); i++) {
            if (i % 6 == 0) { line = Ui.row(c); Ui.noClip(line); addView(line, Ui.lp(Ui.WRAP, Ui.WRAP, 0, 0, 0, dp(6))); }
            final String k = String.valueOf(keys.charAt(i));
            line.addView(key(c, k.toUpperCase(), 1, () -> type(k)));
        }
        LinearLayout specials = Ui.row(c);
        Ui.noClip(specials);
        specials.addView(key(c, "Espace", 2, () -> type(" ")));
        specials.addView(key(c, "⌫", 2, this::erase));
        specials.addView(key(c, "Effacer", 2, this::clear));
        addView(specials);
    }

    private TextView key(Context c, String label, int span, Runnable action) {
        TextView k = Ui.text(c, 18, Ui.TEXT, Ui.W_MEDIUM);
        k.setText(label);
        k.setGravity(Gravity.CENTER);
        k.setFocusable(true);
        k.setClickable(true);
        StateListDrawable bg = new StateListDrawable();
        bg.addState(Ui.focusedState(), Ui.round(Ui.FOCUS, 12));
        bg.addState(new int[]{}, Ui.round(0x14FFFFFF, 12));
        k.setBackground(bg);
        k.setTextColor(new ColorStateList(new int[][]{Ui.focusedState(), {}}, new int[]{Ui.INK, Ui.TEXT}));
        k.setOnClickListener(v -> action.run());
        k.setLayoutParams(Ui.lp(dp(48) * span + dp(6) * (span - 1), dp(46), 0, 0, dp(6), 0));
        Ui.onFocus(k, 1.08f, null);
        return k;
    }

    public String text() { return text.toString(); }
    public void type(String c) { if (text.length() < 60) { text.append(c); listener.changed(text()); } }
    public void erase() { if (text.length() > 0) { text.setLength(text.length() - 1); listener.changed(text()); } }
    public void clear() { text.setLength(0); listener.changed(""); }
    public android.view.View firstKey() { return ((LinearLayout) getChildAt(0)).getChildAt(0); }

    private LinearLayout rowOf(android.view.View key) { return key.getParent() instanceof LinearLayout && key.getParent() != this ? (LinearLayout) key.getParent() : null; }
    public boolean isFirstInRow(android.view.View key) { LinearLayout r = rowOf(key); return r != null && r.indexOfChild(key) == 0; }
    public boolean isLastInRow(android.view.View key) { LinearLayout r = rowOf(key); return r != null && r.indexOfChild(key) == r.getChildCount() - 1; }
    public boolean isTopRow(android.view.View key) { return rowOf(key) == getChildAt(0); }
    /** Donne le focus à la dernière touche d'une ligne (retour depuis les résultats). */
    public void focusRowEnd(int row) {
        LinearLayout r = (LinearLayout) getChildAt(Math.max(0, Math.min(getChildCount() - 1, row)));
        r.getChildAt(r.getChildCount() - 1).requestFocus();
    }
}
