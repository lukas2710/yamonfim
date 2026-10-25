package app.yamonfim.android;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
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

public final class MainActivity extends Activity {
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

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(ACCENT));
        root.addView(progress, new FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP));
        createErrorPanel();
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
                failed = false;
                errorPanel.setVisibility(View.GONE);
                progress.setVisibility(View.VISIBLE);
                if (NavigationPolicy.isInternal(url)) retryUrl = url;
            }
            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
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
                fullScreenCallback = callback;
                oldOrientation = getRequestedOrientation();
                web.setVisibility(View.GONE);
                progress.setVisibility(View.GONE);
                root.addView(view, new FrameLayout.LayoutParams(-1, -1));
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
                WebView popup = new WebView(MainActivity.this);
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
        if (fullScreenVideo != null) { leaveVideoFullScreen(); return; }
        if (web != null && web.canGoBack()) { web.goBack(); return; }
        new AlertDialog.Builder(this).setTitle("Quitter YAMONFILM ?").setNegativeButton("Rester", null).setPositiveButton("Quitter", (dialog, which) -> finish()).show();
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_REQUEST && fileCallback != null) { fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data)); fileCallback = null; }
    }
    @Override protected void onSaveInstanceState(Bundle outState) { if (web != null) web.saveState(outState); super.onSaveInstanceState(outState); }
    @Override protected void onPause() { if (web != null) web.onPause(); CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        if (fullScreenVideo != null && web != null) leaveVideoFullScreen();
        if (web != null) { root.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
