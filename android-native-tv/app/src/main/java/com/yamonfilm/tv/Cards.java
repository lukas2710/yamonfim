package com.yamonfilm.tv;

import android.content.Context;
import android.graphics.Rect;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.FrameLayout;
import android.widget.GridView;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.yamonfilm.tv.Models.Media;

import java.util.ArrayList;
import java.util.List;

import static com.yamonfilm.tv.Ui.dp;

/** Cartes, rangées et grilles optimisées pour la télécommande. */
public final class Cards {
    private Cards() { }

    public static final int POSTER_W = 140, POSTER_H = 210;

    /** Carte affiche (2:3) ou paysage (16:9), avec cadre de sélection et zoom. */
    public static final class Card extends FrameLayout {
        public final ImageView image;
        public final TextView fallback;
        private TextView title, subtitle, badge;
        private View progressTrack, progressBar;
        public Object data;
        /** L'image a été demandée (chargement progressif des rangées). */
        public boolean bound;
        final int imgW, imgH;
        private final boolean landscape;

        public Card(Context c, int widthDp, int heightDp, boolean landscape, boolean focusable) {
            super(c);
            this.landscape = landscape;
            imgW = dp(widthDp); imgH = dp(heightDp);
            setLayoutParams(new ViewGroup.MarginLayoutParams(imgW, imgH));
            setBackground(Ui.gradient(android.graphics.drawable.GradientDrawable.Orientation.TL_BR, 0xFF172443, 0xFF0B1224));
            setForeground(Ui.focusRing(14));
            Ui.clipRound(this, 14);
            setFocusable(focusable);
            setClickable(focusable);
            fallback = Ui.lines(Ui.text(c, 15, Ui.MUTED, Ui.W_SEMIBOLD), 4);
            fallback.setGravity(Gravity.CENTER);
            fallback.setPadding(dp(10), dp(10), dp(10), dp(10));
            addView(fallback, Ui.flp(Ui.MATCH, Ui.MATCH, Gravity.CENTER));
            image = new ImageView(c);
            image.setScaleType(ImageView.ScaleType.CENTER_CROP);
            addView(image, Ui.flp(Ui.MATCH, Ui.MATCH, 0));
            if (focusable) Ui.onFocus(this, landscape ? 1.035f : 1.045f, null);
        }

        private void ensureCaption() {
            if (title != null) return;
            Context c = getContext();
            View shade = new View(c);
            shade.setBackground(Ui.gradient(GradientDrawable.Orientation.BOTTOM_TOP, 0xF2000000, 0xA6000000, 0x00000000));
            addView(shade, Ui.flp(Ui.MATCH, imgH * 2 / 3, Gravity.BOTTOM));
            LinearLayout box = Ui.column(c);
            box.setPadding(dp(14), 0, dp(14), dp(13));
            subtitle = Ui.lines(Ui.text(c, 11, 0xFF8AAFFF, Ui.W_SEMIBOLD), 1);
            subtitle.setLetterSpacing(0.12f);
            title = Ui.lines(Ui.text(c, 15, Ui.TEXT, Ui.W_SEMIBOLD), 2);
            box.addView(subtitle);
            box.addView(title, Ui.lp(Ui.MATCH, Ui.WRAP, 0, dp(3), 0, 0));
            addView(box, Ui.flp(Ui.MATCH, Ui.WRAP, Gravity.BOTTOM));
        }

        public Card caption(String sub, String main) {
            ensureCaption();
            subtitle.setText(sub);
            subtitle.setVisibility(sub == null || sub.isEmpty() ? GONE : VISIBLE);
            title.setText(main);
            return this;
        }

        public Card badge(String value, int color) {
            if (badge == null) {
                badge = Ui.text(getContext(), 11, 0xFFFFFFFF, Ui.W_SEMIBOLD);
                badge.setPadding(dp(8), dp(4), dp(8), dp(4));
                FrameLayout.LayoutParams p = Ui.flp(Ui.WRAP, Ui.WRAP, Gravity.TOP | Gravity.START);
                p.setMargins(dp(8), dp(8), 0, 0);
                addView(badge, p);
            }
            badge.setVisibility(value == null ? GONE : VISIBLE);
            if (value != null) { badge.setText(value); badge.setBackground(Ui.round(color, 7)); }
            return this;
        }

        public Card progress(float fraction) {
            if (progressTrack == null) {
                progressTrack = new View(getContext());
                progressTrack.setBackground(Ui.round(0x40FFFFFF, 2));
                FrameLayout.LayoutParams tp = Ui.flp(Ui.MATCH, dp(4), Gravity.BOTTOM);
                tp.setMargins(dp(14), 0, dp(14), dp(8));
                addView(progressTrack, tp);
                progressBar = new View(getContext());
                progressBar.setBackground(Ui.round(Ui.ACCENT, 2));
                FrameLayout.LayoutParams bp = Ui.flp(0, dp(4), Gravity.BOTTOM | Gravity.START);
                bp.setMargins(dp(14), 0, 0, dp(8));
                addView(progressBar, bp);
            }
            boolean show = fraction > 0.005f;
            progressTrack.setVisibility(show ? VISIBLE : GONE);
            progressBar.setVisibility(show ? VISIBLE : GONE);
            progressBar.getLayoutParams().width = Math.round((imgW - dp(28)) * Math.min(1f, fraction));
            progressBar.requestLayout();
            return this;
        }

        public void bindImage(String url, String fallbackText) {
            fallback.setText(fallbackText);
            App.images().load(image, url, imgW, imgH);
        }

        public void bindMedia(Media m) {
            data = m;
            if (landscape) {
                caption(m.isSeries() ? "SÉRIE" : "FILM", m.title);
                bindImage(Logic.tmdbSize(m.image(), "w780"), "");
            } else {
                bindImage(Logic.tmdbSize(m.poster, "w342"), m.title);
            }
        }

        /** Dans une grille, la sélection remplace le focus : même effet visuel. */
        @Override public void setSelected(boolean selected) {
            boolean changed = selected != isSelected();
            super.setSelected(selected);
            if (changed && !isFocusable()) {
                float s = selected ? (landscape ? 1.035f : 1.045f) : 1f;
                animate().scaleX(s).scaleY(s).translationZ(selected ? dp(10) : 0).setInterpolator(new android.view.animation.DecelerateInterpolator(1.6f)).setDuration(180).start();
            }
        }
    }

    // ------------------------------------------------------------ Défilement horizontal

    /** Défile seulement quand l'élément sélectionné approche du bord : mouvement calme. */
    public static final class HScroll extends HorizontalScrollView {
        public final LinearLayout items;
        public HScroll(Context c) {
            super(c);
            setHorizontalScrollBarEnabled(false);
            setOverScrollMode(OVER_SCROLL_NEVER);
            setFillViewport(false);
            Ui.noClip(this);
            items = Ui.row(c);
            Ui.noClip(items);
            addView(items, new LayoutParams(Ui.WRAP, Ui.WRAP));
        }
        @Override protected int computeScrollDeltaToGetChildRectOnScreen(Rect rect) { return 0; }
        @Override public void requestChildFocus(View child, View focused) {
            super.requestChildFocus(child, focused);
            View item = focused;
            while (item != null && item.getParent() != items) item = item.getParent() instanceof View ? (View) item.getParent() : null;
            if (item != null) reveal(item, true);
        }
        public void reveal(View item, boolean smooth) {
            int peek = dp(110), width = getWidth();
            if (width == 0) return;
            int x = getScrollX(), target = x;
            int left = item.getLeft() + items.getPaddingLeft() * 0, right = item.getRight();
            if (right + peek > x + width) target = right + peek - width;
            if (left - dp(40) < target) target = Math.max(0, left - dp(40));
            if (item.getLeft() <= items.getPaddingLeft() + dp(4)) target = 0;
            int max = Math.max(0, items.getWidth() - width);
            target = Math.max(0, Math.min(max, target));
            if (target != x) { if (smooth) smoothScrollTo(target, 0); else scrollTo(target, 0); }
        }
    }

    /** Défilement vertical : aligne la rangée sélectionnée en haut (mode TV) ou la garde visible. */
    public static final class VScroll extends ScrollView {
        public final LinearLayout content;
        private final boolean alignTop;
        private int topOffset;
        public VScroll(Context c, boolean alignTop) {
            super(c);
            this.alignTop = alignTop;
            setVerticalScrollBarEnabled(false);
            setOverScrollMode(OVER_SCROLL_NEVER);
            setSmoothScrollingEnabled(true);
            // Les rangées restent dans leur zone : rien ne déborde sur le titre au-dessus.
            setClipChildren(true);
            setClipToPadding(true);
            clipInParent(this);
            content = Ui.column(c);
            Ui.noClip(content);
            addView(content, new LayoutParams(Ui.MATCH, Ui.WRAP));
        }
        public void setTopOffset(int px) { topOffset = px; }
        @Override protected int computeScrollDeltaToGetChildRectOnScreen(Rect rect) { return 0; }
        @Override public void requestChildFocus(View child, View focused) {
            super.requestChildFocus(child, focused);
            reveal(focused);
        }
        public void reveal(View focused) {
            View item = focused;
            while (item != null && item.getParent() != content) item = item.getParent() instanceof View ? (View) item.getParent() : null;
            if (item == null) return;
            int height = getHeight();
            if (height == 0) return;
            int y = getScrollY(), target;
            if (alignTop) target = item.getTop() - topOffset;
            else {
                Rect r = new Rect();
                focused.getDrawingRect(r);
                offsetDescendantRectToMyCoords(focused, r);
                int margin = dp(60);
                target = y;
                if (r.bottom + margin > y + height) target = r.bottom + margin - height;
                if (r.top - margin < target) target = r.top - margin;
            }
            int max = Math.max(0, content.getHeight() - height);
            target = Math.max(0, Math.min(max, target));
            if (target != y) smoothScrollTo(0, target);
        }
    }

    // ------------------------------------------------------------ Rangée (titre + cartes)

    public static final class Shelf extends LinearLayout {
        public final TextView title;
        public final HScroll scroll;
        public int lastIndex;
        public Object data;

        public Shelf(Context c, String label) {
            super(c);
            setOrientation(VERTICAL);
            Ui.noClip(this);
            title = Ui.text(c, 20, Ui.TEXT, Ui.W_SEMIBOLD);
            title.setText(label);
            title.setPadding(dp(4), 0, 0, dp(10));
            addView(title);
            scroll = new HScroll(c);
            scroll.items.setPadding(dp(4), dp(12), dp(80), dp(18));
            addView(scroll, new LayoutParams(Ui.MATCH, Ui.WRAP));
            setPadding(0, 0, 0, dp(10));
        }

        public void add(View card, int gapDp) {
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(card.getLayoutParams().width, card.getLayoutParams().height);
            p.setMargins(0, 0, dp(gapDp), 0);
            final int index = scroll.items.getChildCount();
            View.OnFocusChangeListener previous = card.getOnFocusChangeListener();
            card.setOnFocusChangeListener((v, has) -> { if (previous != null) previous.onFocusChange(v, has); if (has) lastIndex = index; });
            scroll.items.addView(card, p);
        }

        public int count() { return scroll.items.getChildCount(); }
        public View item(int i) { return i >= 0 && i < count() ? scroll.items.getChildAt(i) : null; }

        public int indexOf(View focused) {
            View item = focused;
            while (item != null && item.getParent() != scroll.items) item = item.getParent() instanceof View ? (View) item.getParent() : null;
            return item == null ? -1 : scroll.items.indexOfChild(item);
        }

        public boolean focus(int index) {
            if (count() == 0) return false;
            View v = item(Math.max(0, Math.min(count() - 1, index)));
            return v != null && v.requestFocus();
        }

        public boolean focusLast() { return focus(lastIndex); }
    }

    // ------------------------------------------------------------ Grille de titres virtualisée

    public static final class MediaAdapter extends BaseAdapter {
        public final List<Media> items = new ArrayList<>();
        private final boolean landscape;
        public MediaAdapter(boolean landscape) { this.landscape = landscape; }
        public void set(List<Media> list) { items.clear(); items.addAll(list); notifyDataSetChanged(); }
        @Override public int getCount() { return items.size(); }
        @Override public Media getItem(int i) { return items.get(i); }
        @Override public long getItemId(int i) { return i; }
        @Override public boolean hasStableIds() { return false; }
        @Override public View getView(int position, View convert, ViewGroup parent) {
            Card card = convert instanceof Card ? (Card) convert : landscape ? new Card(parent.getContext(), 260, 146, true, false) : new Card(parent.getContext(), POSTER_W, POSTER_H, false, false);
            card.setLayoutParams(new GridView.LayoutParams(card.imgW, card.imgH));
            Media m = items.get(position);
            card.bindMedia(m);
            return card;
        }
    }

    /** Range des cartes focusables par lignes (petites listes : collections, historique). */
    public static void wrap(LinearLayout container, List<View> cards, int perRow, int gapDp) {
        container.removeAllViews();
        LinearLayout line = null;
        for (int i = 0; i < cards.size(); i++) {
            if (i % perRow == 0) {
                line = Ui.row(container.getContext());
                Ui.noClip(line);
                container.addView(line, Ui.lp(Ui.WRAP, Ui.WRAP, 0, 0, 0, dp(gapDp + 6)));
            }
            View card = cards.get(i);
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(card.getLayoutParams().width, card.getLayoutParams().height);
            p.setMargins(0, 0, dp(gapDp), 0);
            line.addView(card, p);
        }
    }

    /**
     * Avec l'accélération matérielle, une vue est coupée à ses bords par le réglage de son PARENT.
     * On l'active donc sur le parent des zones qui défilent, pour que rien ne déborde au-dessus.
     */
    static void clipInParent(View v) {
        v.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener() {
            @Override public void onViewAttachedToWindow(View view) {
                if (view.getParent() instanceof ViewGroup) ((ViewGroup) view.getParent()).setClipChildren(true);
            }
            @Override public void onViewDetachedFromWindow(View view) { }
        });
    }

    public static GridView grid(Context c, int columns, boolean landscape) {
        GridView g = new GridView(c);
        g.setNumColumns(columns);
        g.setColumnWidth(dp(landscape ? 260 : POSTER_W));
        g.setStretchMode(GridView.NO_STRETCH);
        g.setHorizontalSpacing(dp(landscape ? 22 : 20));
        g.setVerticalSpacing(dp(landscape ? 26 : 24));
        g.setSelector(new android.graphics.drawable.ColorDrawable(0));
        g.setDrawSelectorOnTop(false);
        g.setVerticalScrollBarEnabled(false);
        g.setOverScrollMode(View.OVER_SCROLL_NEVER);
        g.setFocusable(true);
        // La grille reste dans sa zone quand elle défile ; la marge laisse la place au zoom de sélection.
        g.setPadding(dp(14), dp(18), dp(14), dp(40));
        g.setClipChildren(true);
        g.setClipToPadding(false);
        clipInParent(g);
        g.setVerticalFadingEdgeEnabled(true);
        g.setFadingEdgeLength(dp(36));
        return g;
    }
}
