package com.yamonfilm.tv;

import android.view.KeyEvent;
import android.view.View;

/** Un écran de l'application. Les écrans restent en mémoire dans la pile pour un retour instantané. */
public abstract class Screen implements App.Alive {
    protected final MainActivity main;
    protected View view;
    protected View lastFocus;
    private boolean alive = true;

    protected Screen(MainActivity main) { this.main = main; }

    protected abstract View create();

    /** Appelé à chaque affichage ; `first` vaut true à la création. */
    protected void onShow(boolean first) { }
    protected void onHide() { }
    /** Rafraîchissement discret (retour sur l'application, toutes les minutes) : suivi entre appareils. */
    protected void onRefresh() { }
    protected void onDestroy() { }

    /** Touche enfoncée, avant le traitement standard. Retourner true pour la consommer. */
    protected boolean onKey(KeyEvent event) { return false; }
    /** Appui long sur OK ou touche Menu sur l'élément sélectionné. */
    protected boolean onLongPress(View focused) { return false; }
    /** Retour : true si l'écran a géré la touche. */
    protected boolean onBack() { return false; }
    /** Élément qui reçoit le focus par défaut. */
    protected View defaultFocus() { return null; }

    /** Identifiant du menu latéral ; null pour un écran sans menu. */
    protected String railId() { return null; }
    protected String presenceAction() { return "Navigate sur le site"; }

    @Override public boolean alive() { return alive; }
    final void destroy() { alive = false; onDestroy(); }

    public void restoreFocus() {
        View target = lastFocus;
        if (target != null && target.isAttachedToWindow() && target.isShown() && target.isFocusable() && target.requestFocus()) return;
        View d = defaultFocus();
        if (d != null && d.isShown() && d.requestFocus()) return;
        if (view != null) view.requestFocus();
    }

    protected <T> void io(App.Work<T> work, App.Done<T> done) { App.io(this, work, done); }

    /** Gestion commune des erreurs : session expirée → connexion, sinon message. */
    protected void fail(Exception e) { main.fail(e); }
}
