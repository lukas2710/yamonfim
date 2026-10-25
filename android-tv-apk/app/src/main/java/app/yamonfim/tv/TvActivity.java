package app.yamonfim.tv;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
public final class TvActivity extends Activity {
    private static final int BACKGROUND = Color.rgb(10, 10, 11);
    private static final int ACCENT = Color.rgb(239, 68, 68);
    private static final int FILE_REQUEST = 900;
    private FrameLayout root;
    private WebView web;
    private ProgressBar progress;
    private LinearLayout errorPanel;
    private View fullScreenVideo;
    private WebChromeClient.CustomViewCallback fullScreenCallback;
    private ValueCallback<Uri[]> fileCallback;
    private String retryUrl = NavigationPolicy.SITE_URL;
    private boolean failed;
    private int oldOrientation;
    private final Handler tvHandler = new Handler(Looper.getMainLooper());
    private CursorOverlay cursorOverlay;
    private boolean pointerMode;
    private boolean longCenter;
    private boolean centerHeld;
    private boolean tvPlayerActive;
    private long lastDirectionalEvent;
    private float cursorX;
    private float cursorY;
    private final Runnable openLongPressMenu = () -> {
        if (centerHeld) { longCenter = true; showTvMenu(); }
    };
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BACKGROUND);
        getWindow().setNavigationBarColor(BACKGROUND);
        root = new FrameLayout(this);
        root.setBackgroundColor(BACKGROUND);
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (fullScreenVideo != null) view.setPadding(0, 0, 0, 0);
            else if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        web = new WebView(this);
        web.setBackgroundColor(BACKGROUND);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        configureWebView();
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.requestFocus();
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(ACCENT));
        root.addView(progress, new FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP));
        createErrorPanel();
        initializeTvControls();
        if (state == null || web.restoreState(state) == null) web.loadUrl(NavigationPolicy.SITE_URL);
    }
    private void configureWebView() {
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        WebView.setWebContentsDebuggingEnabled(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // A series player uses cross-origin iframes; its subframes stay inside the player.
                if (!request.isForMainFrame()) return false;
                String url = request.getUrl().toString();
                if (NavigationPolicy.isInternal(url)) return false;
                if (request.hasGesture()) openBrowser(url);
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                failed = false; tvPlayerActive = false;
                errorPanel.setVisibility(View.GONE);
                progress.setVisibility(View.VISIBLE);
                if (NavigationPolicy.isInternal(url)) { retryUrl = url; view.setAlpha(0f); }
            }
            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
                installTvNavigation(view, url);
                if (!failed) errorPanel.setVisibility(View.GONE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showConnectionError();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 500) showConnectionError();
            }
            @Override public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                // Avoid an Android crash if the system reclaims the video process.
                root.removeView(view);
                view.destroy();
                web = null;
                recreate();
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) {
                progress.setProgress(value);
                progress.setVisibility(value >= 100 || failed || fullScreenVideo != null ? View.GONE : View.VISIBLE);
            }
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullScreenVideo != null) { callback.onCustomViewHidden(); return; }
                fullScreenVideo = view;
                cursorOverlay.setVisibility(View.GONE);
                fullScreenCallback = callback;
                oldOrientation = getRequestedOrientation();
                web.setVisibility(View.GONE);
                progress.setVisibility(View.GONE);
                root.addView(view, new FrameLayout.LayoutParams(-1, -1));
                view.setFocusable(true);
                view.requestFocus();
                root.setPadding(0, 0, 0, 0);
                getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                if (Build.VERSION.SDK_INT >= 30) {
                    WindowInsetsController controller = getWindow().getInsetsController();
                    if (controller != null) { controller.hide(WindowInsets.Type.systemBars()); controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); }
                } else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            }
            @Override public void onHideCustomView() { leaveVideoFullScreen(); }
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean gesture, Message resultMsg) {
                if (!gesture) return false;
                WebView popup = new WebView(TvActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    private boolean route(String url) {
                        if ("about:blank".equals(url)) return false;
                        if (NavigationPolicy.isInternal(url)) web.loadUrl(url); else openBrowser(url);
                        popup.post(popup::destroy);
                        return true;
                    }
                    @Override public boolean shouldOverrideUrlLoading(WebView child, WebResourceRequest request) { return route(request.getUrl().toString()); }
                    @Override public void onPageStarted(WebView child, String url, android.graphics.Bitmap icon) { route(url); }
                });
                ((WebView.WebViewTransport) resultMsg.obj).setWebView(popup);
                resultMsg.sendToTarget();
                return true;
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!NavigationPolicy.isInternal(web.getUrl())) return false;
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try { startActivityForResult(params.createIntent(), FILE_REQUEST); }
                catch (ActivityNotFoundException unavailable) { fileCallback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
        });
    }
    private void createErrorPanel() {
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(30), dp(30), dp(30), dp(30));
        errorPanel.setBackgroundColor(BACKGROUND);
        TextView brand = new TextView(this);
        brand.setText("YAMONFILM"); brand.setTextColor(ACCENT); brand.setTextSize(23); brand.setGravity(Gravity.CENTER); brand.setTypeface(null, 1);
        errorPanel.addView(brand, new LinearLayout.LayoutParams(-1, -2));
        TextView message = new TextView(this);
        message.setText("La connexion au site est indisponible.\nVérifie Internet puis réessaie."); message.setTextSize(15); message.setTextColor(Color.LTGRAY); message.setGravity(Gravity.CENTER); message.setPadding(0, dp(25), 0, dp(25));
        errorPanel.addView(message, new LinearLayout.LayoutParams(-1, -2));
        Button retry = new Button(this); retry.setText("Réessayer"); retry.setTextColor(Color.WHITE); retry.setBackgroundTintList(android.content.res.ColorStateList.valueOf(ACCENT));
        retry.setOnClickListener(view -> { errorPanel.setVisibility(View.GONE); web.loadUrl(retryUrl); });
        errorPanel.addView(retry, new LinearLayout.LayoutParams(-1, dp(52)));
        errorPanel.setVisibility(View.GONE);
        root.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1));
    }
    private void showConnectionError() {
        failed = true;
        leaveVideoFullScreen();
        setPointerMode(false);
        progress.setVisibility(View.GONE);
        errorPanel.setVisibility(View.VISIBLE);
    }
    private void openBrowser(String url) {
        if (!NavigationPolicy.canOpenBrowser(url)) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (ActivityNotFoundException unavailable) { Toast.makeText(this, "Aucun navigateur disponible pour ouvrir ce lien.", Toast.LENGTH_LONG).show(); }
    }
    private void leaveVideoFullScreen() {
        if (fullScreenVideo == null) return;
        root.removeView(fullScreenVideo);
        fullScreenVideo = null;
        web.setVisibility(View.VISIBLE);
        web.requestFocus();
        if (pointerMode) cursorOverlay.setVisibility(View.VISIBLE);
        getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) controller.show(WindowInsets.Type.systemBars());
        } else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        setRequestedOrientation(oldOrientation);
        root.requestApplyInsets();
        if (fullScreenCallback != null) { WebChromeClient.CustomViewCallback callback = fullScreenCallback; fullScreenCallback = null; callback.onCustomViewHidden(); }
    }
    @Override public void onBackPressed() {
        if (pointerMode) { setPointerMode(false); return; }
        if (fullScreenVideo != null) { leaveVideoFullScreen(); return; }
        if (web != null && NavigationPolicy.isInternal(web.getUrl()) && errorPanel.getVisibility() != View.VISIBLE) {
            web.evaluateJavascript("Boolean(window.YamonTv && window.YamonTv.back())", handled -> {
                if (!"true".equals(handled)) navigateBack();
            });
            return;
        }
        navigateBack();
    }
    private void navigateBack() {
        if (pointerMode) { setPointerMode(false); return; }
        if (web != null && web.canGoBack()) { web.goBack(); return; }
        new AlertDialog.Builder(this).setTitle("Quitter YAMONFILM ?").setNegativeButton("Rester", null).setPositiveButton("Quitter", (dialog, which) -> finish()).show();
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_REQUEST && fileCallback != null) { fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data)); fileCallback = null; }
    }
    @Override protected void onSaveInstanceState(Bundle outState) { if (web != null) web.saveState(outState); super.onSaveInstanceState(outState); }
    @Override protected void onPause() { centerHeld = false; tvHandler.removeCallbacks(openLongPressMenu); if (web != null) web.onPause(); CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        tvHandler.removeCallbacksAndMessages(null);
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        if (fullScreenVideo != null && web != null) leaveVideoFullScreen();
        if (web != null) { root.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void initializeTvControls() {
        web.getSettings().setTextZoom(100);
        cursorOverlay = new CursorOverlay();
        cursorOverlay.setFocusable(false);
        cursorOverlay.setClickable(false);
        cursorOverlay.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        cursorOverlay.setVisibility(View.GONE);
        root.addView(cursorOverlay, new FrameLayout.LayoutParams(-1, -1));
        root.post(() -> { cursorX = web.getWidth() / 2f; cursorY = web.getHeight() / 2f; });
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) controller.hide(WindowInsets.Type.systemBars());
        } else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        if (!getPreferences(MODE_PRIVATE).getBoolean("tv-interface-help-v2", false)) {
            tvHandler.postDelayed(() -> new AlertDialog.Builder(this)
                .setTitle("Bienvenue sur YAMONFILM TV")
                .setMessage("Ton nouveau menu TV est à gauche : Accueil, Films, Séries, Recherche, Collections et Historique. Le bouton Plus donne accès aux autres fonctions.\n\nFlèches : choisir un élément\nOK : ouvrir ou valider\nRetour : fermer une fenêtre ou revenir\n\nAppui long sur OK : commandes TV et mode pointeur.")
                .setPositiveButton("Commencer", (dialog, which) -> {
                    getPreferences(MODE_PRIVATE).edit().putBoolean("tv-interface-help-v2", true).apply();
                    web.requestFocus();
                }).show(), 500);
        }
    }
    private void installTvNavigation(WebView view, String url) {
        if (!NavigationPolicy.isInternal(url) || !NavigationPolicy.isInternal(view.getUrl())) return;
        try {
            String layout = readTvAsset("tv-layout.css") + "\n" + readTvAsset("tv-shell.css") + "\n" + readTvAsset("tv-player.css");
            String bootstrap = "(function(){"
                + "document.documentElement.setAttribute('data-yamon-tv','compact');"
                + "var meta=document.querySelector('meta[name=viewport]');"
                + "if(!meta){meta=document.createElement('meta');meta.name='viewport';document.head.appendChild(meta);}"
                + "var scale=Math.max(.25,Math.min(4,screen.width/1280));"
                + "meta.setAttribute('content','width=1280,initial-scale='+scale);"
                + "var style=document.getElementById('yamon-tv-layout');"
                + "if(!style){style=document.createElement('style');style.id='yamon-tv-layout';document.head.appendChild(style);}"
                + "style.textContent=" + org.json.JSONObject.quote(layout) + ";"
                + "})();";
            view.evaluateJavascript(bootstrap + readTvAsset("tv-shell.js") + "\n" + readTvAsset("tv-player.js") + "\n" + readTvAsset("tv-navigation.js") + "\n" + readTvAsset("tv-performance.js"), result -> {
                if (web != null && !isFinishing()) view.setAlpha(1f);
            });
        } catch (Exception unavailable) {
            view.setAlpha(1f);
            Toast.makeText(this, "Le mode pointeur reste disponible par appui long sur OK.", Toast.LENGTH_LONG).show();
        }
    }
    private String readTvAsset(String name) throws java.io.IOException {
        try (InputStream input = getAssets().open(name); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int size;
            while ((size = input.read(buffer)) != -1) output.write(buffer, 0, size);
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }
    private void showTvMenu() {
        String[] entries = { "Accueil", "Recharger cette page", pointerMode ? "Revenir au mode sélection" : "Activer le mode pointeur", "Aide télécommande" };
        new AlertDialog.Builder(this).setTitle("YAMONFILM TV · Commandes")
            .setItems(entries, (dialog, which) -> {
                if (which == 0) { leaveVideoFullScreen(); setPointerMode(false); web.loadUrl(NavigationPolicy.SITE_URL); }
                else if (which == 1) { leaveVideoFullScreen(); web.reload(); }
                else if (which == 2) { leaveVideoFullScreen(); setPointerMode(!pointerMode); }
                else new AlertDialog.Builder(this).setTitle("Ta télécommande")
                    .setMessage("Flèches + OK : naviguer.\nRetour : fermer le lecteur ou revenir.\nAppui long sur OK (ou touche Menu) : commandes TV.\n\nMode pointeur : flèches pour déplacer le cercle, OK pour cliquer. Aux bords haut/bas, les flèches font défiler la page. Retour désactive le pointeur si aucun dialogue n’est ouvert.\n\nPour écrire, sélectionne un champ puis valide avec OK : le clavier Android TV s’ouvre.")
                    .setPositiveButton("Compris", null).show();
                web.requestFocus();
            }).setNegativeButton("Fermer", null).show();
    }
    private void setPointerMode(boolean enabled) {
        pointerMode = enabled;
        if (cursorOverlay == null) return;
        cursorOverlay.setVisibility(enabled ? View.VISIBLE : View.GONE);
        if (enabled && web != null) {
            cursorX = RemoteCursor.clamp(cursorX, web.getWidth());
            cursorY = RemoteCursor.clamp(cursorY, web.getHeight());
            cursorOverlay.invalidate();
            Toast.makeText(this, "Mode pointeur · flèches pour déplacer, OK pour cliquer", Toast.LENGTH_LONG).show();
        }
    }
    private void hoverPointer() {
        if (web == null) return;
        long now = SystemClock.uptimeMillis();
        MotionEvent hover = MotionEvent.obtain(now, now, MotionEvent.ACTION_HOVER_MOVE, cursorX, cursorY, 0);
        hover.setSource(android.view.InputDevice.SOURCE_MOUSE);
        web.dispatchGenericMotionEvent(hover); hover.recycle();
    }
    private void clickPointer() {
        if (web == null) return;
        dispatchWebTap(cursorX, cursorY);
    }
    private void dispatchWebTap(float x, float y) {
        if (web == null) return;
        long now = SystemClock.uptimeMillis();
        MotionEvent down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, x, y, 0);
        MotionEvent up = MotionEvent.obtain(now, now + 70, MotionEvent.ACTION_UP, x, y, 0);
        web.dispatchTouchEvent(down);
        web.dispatchTouchEvent(up);
        down.recycle(); up.recycle();
        web.requestFocus();
        tvHandler.postDelayed(this::consumePlayerAction, 80);
    }
    private void consumePlayerAction() {
        if (web == null || !NavigationPolicy.isInternal(web.getUrl())) return;
        web.evaluateJavascript("({playing:Boolean(window.YamonTvPlayer && window.YamonTvPlayer.isActive()),action:window.YamonTvPlayer ? window.YamonTvPlayer.takeNativeAction() : null})", value -> {
            if (web == null || isFinishing()) return;
            try {
                org.json.JSONObject response = new org.json.JSONObject(value);
                tvPlayerActive = response.optBoolean("playing", false);
                org.json.JSONObject action = response.optJSONObject("action");
                if (action == null) return;
                if (!"pointer".equals(action.optString("type"))) return;
                double x = action.getDouble("x"), y = action.getDouble("y");
                if (!Double.isFinite(x) || !Double.isFinite(y)) return;
                setPointerMode(true);
                cursorX = RemoteCursor.clamp((float)x * web.getWidth(), web.getWidth());
                cursorY = RemoteCursor.clamp((float)y * web.getHeight(), web.getHeight());
                cursorOverlay.invalidate();
                long now = SystemClock.uptimeMillis();
                MotionEvent hover = MotionEvent.obtain(now, now, MotionEvent.ACTION_HOVER_MOVE, cursorX, cursorY, 0);
                hover.setSource(android.view.InputDevice.SOURCE_MOUSE);
                web.dispatchGenericMotionEvent(hover); hover.recycle();
                Toast.makeText(this, "Flèches : viser la barre de lecture · OK : cliquer · Retour : quitter le pointeur", Toast.LENGTH_LONG).show();
            } catch (Exception noAction) { /* No native action requested. */ }
        });
    }
    private void activateSelection() {
        if (web == null) return;
        web.evaluateJavascript("window.YamonTvPlayer && window.YamonTvPlayer.activate() ? {handled:true} : (window.YamonTv ? window.YamonTv.target() : null)", value -> {
            if (web == null || isFinishing() || isDestroyed()) return;
            try {
                org.json.JSONObject target = new org.json.JSONObject(value);
                if (target.optBoolean("handled", false)) return;
                double x = target.getDouble("x"), y = target.getDouble("y");
                if (Double.isNaN(x) || Double.isNaN(y) || x < 0 || x > 1 || y < 0 || y > 1) return;
                dispatchWebTap((float) x * web.getWidth(), (float) y * web.getHeight());
            } catch (Exception nativeControl) {
                long now = SystemClock.uptimeMillis();
                web.dispatchKeyEvent(new KeyEvent(now, now, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DPAD_CENTER, 0));
                web.dispatchKeyEvent(new KeyEvent(now, now + 30, KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DPAD_CENTER, 0));
            }
        });
    }
    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        if (code == KeyEvent.KEYCODE_MENU) {
            if (event.getAction() == KeyEvent.ACTION_UP) {
                leaveVideoFullScreen();
                if (web != null) web.evaluateJavascript("Boolean(window.YamonTvPlayer && window.YamonTvPlayer.remote('menu'))", handled -> { if (!"true".equals(handled)) showTvMenu(); });
                else showTvMenu();
            }
            return true;
        }
        if (web == null || fullScreenVideo != null || errorPanel == null || errorPanel.getVisibility() == View.VISIBLE || !web.hasFocus()) return super.dispatchKeyEvent(event);
        if (!pointerMode && event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0 &&
                ((tvPlayerActive && (code == KeyEvent.KEYCODE_DPAD_UP || code == KeyEvent.KEYCODE_DPAD_DOWN)) ||
                 code == KeyEvent.KEYCODE_MEDIA_NEXT || code == KeyEvent.KEYCODE_MEDIA_PREVIOUS)) {
            String action = code == KeyEvent.KEYCODE_DPAD_UP ? "up" : code == KeyEvent.KEYCODE_DPAD_DOWN ? "down" : code == KeyEvent.KEYCODE_MEDIA_NEXT ? "next" : "previous";
            KeyEvent forwarded = new KeyEvent(event);
            web.evaluateJavascript("Boolean(window.YamonTvPlayer && window.YamonTvPlayer.remote('" + action + "'))", handled -> {
                if (web != null && !"true".equals(handled)) web.dispatchKeyEvent(forwarded);
            });
            return true;
        }
        // Bound held-key repeats so a slow TV cannot build up a navigation backlog.
        if (!pointerMode && event.getAction() == KeyEvent.ACTION_DOWN &&
                (code == KeyEvent.KEYCODE_DPAD_UP || code == KeyEvent.KEYCODE_DPAD_DOWN ||
                 code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT)) {
            long now = SystemClock.uptimeMillis();
            if (event.getRepeatCount() > 0 && now - lastDirectionalEvent < 85) return true;
            lastDirectionalEvent = now;
        }
        if (code == KeyEvent.KEYCODE_DPAD_CENTER || code == KeyEvent.KEYCODE_ENTER || code == KeyEvent.KEYCODE_NUMPAD_ENTER || code == KeyEvent.KEYCODE_BUTTON_A) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) {
                if (event.getRepeatCount() == 0) {
                    centerHeld = true; longCenter = false;
                    tvHandler.postDelayed(openLongPressMenu, 750);
                }
                return true;
            }
            if (event.getAction() == KeyEvent.ACTION_UP) {
                tvHandler.removeCallbacks(openLongPressMenu);
                centerHeld = false;
                if (longCenter || event.isCanceled()) return true;
                if (pointerMode) clickPointer();
                else activateSelection();
                return true;
            }
        }
        if (pointerMode && (code == KeyEvent.KEYCODE_DPAD_UP || code == KeyEvent.KEYCODE_DPAD_DOWN || code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT)) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) {
                float step = RemoteCursor.step(getResources().getDisplayMetrics().density, event.getRepeatCount());
                if (code == KeyEvent.KEYCODE_DPAD_LEFT) cursorX -= step;
                if (code == KeyEvent.KEYCODE_DPAD_RIGHT) cursorX += step;
                if (code == KeyEvent.KEYCODE_DPAD_UP) { if (cursorY <= dp(15)) web.scrollBy(0, -dp(55)); cursorY -= step; }
                if (code == KeyEvent.KEYCODE_DPAD_DOWN) { if (cursorY >= web.getHeight() - dp(16)) web.scrollBy(0, dp(55)); cursorY += step; }
                cursorX = RemoteCursor.clamp(cursorX, web.getWidth());
                cursorY = RemoteCursor.clamp(cursorY, web.getHeight());
                cursorOverlay.invalidate();
            }
            return true;
        }
        return super.dispatchKeyEvent(event);
    }
    private final class CursorOverlay extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        CursorOverlay() { super(TvActivity.this); }
        @Override protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            paint.setStyle(Paint.Style.FILL); paint.setColor(Color.argb(75, 239, 68, 68));
            canvas.drawCircle(cursorX, cursorY, dp(15), paint);
            paint.setStyle(Paint.Style.STROKE); paint.setColor(Color.WHITE); paint.setStrokeWidth(dp(2));
            canvas.drawCircle(cursorX, cursorY, dp(8), paint);
            paint.setStyle(Paint.Style.FILL); paint.setColor(ACCENT);
            canvas.drawCircle(cursorX, cursorY, dp(3), paint);
        }
    }
}
