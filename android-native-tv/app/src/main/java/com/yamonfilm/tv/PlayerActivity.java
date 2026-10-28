package com.yamonfilm.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.yamonfilm.tv.Cards.Card;
import com.yamonfilm.tv.Cards.Shelf;
import com.yamonfilm.tv.Models.Channel;
import com.yamonfilm.tv.Models.Episode;
import com.yamonfilm.tv.Models.Media;
import com.yamonfilm.tv.Models.Season;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

import static com.yamonfilm.tv.Ui.dp;

/**
 * Lecteur plein écran.
 * - Vidéo directe (mp4/m3u8) et TV en direct : lecteur natif avec commandes à la télécommande.
 * - Lecteur intégré (Moviez…) : page web avec pointeur piloté par les flèches.
 */
public final class PlayerActivity extends Activity implements App.Alive {
    private Actions.PlayerSession ps;
    private Media media;
    private int season, episode;
    private boolean live, direct, alive = true, resumed;

    private FrameLayout root, stage;
    private LinearLayout spinner;
    private TextView loadingTitle;
    private LinearLayout errorBox;
    private TextView errorText, errorRetry, errorExtra;

    // Lecteur natif
    private SurfaceView surface;
    private SurfaceHolder holder;
    private MediaPlayer player;
    private boolean prepared, wantPlay = true;
    private long resumeAtMs;
    private int videoW, videoH;
    private AudioManager audio;
    private AudioFocusRequest focusRequest;

    // Lecteur web
    private WebView web;
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;
    private CursorView cursor;

    // Commandes
    private LinearLayout overlay, buttons, panel;
    private TextView title, subtitle, time, liveBadge, playPause, prevButton, nextButton, listButton, upNext;
    private String preparedEpisode = "";
    private android.graphics.drawable.ClipDrawable nextProgress;
    private SeekView seek;
    private long pendingSeek = -1;
    private int scrubRepeat;
    private LinearLayout webMenu;

    // Suivi (historique, épisodes vus)
    private final Set<String> markedSeen = new HashSet<>();
    private long playingSince = -1, playedMs, lastSavedPosition = -1;
    private boolean ended;
    private final Logic.AutoNext autoNext = new Logic.AutoNext();
    private String creditsRequestKey = "";
    private int openGeneration;
    private String playbackBase = "";
    private JSONArray audioOptions = new JSONArray();
    private String sourceUrl = "", activeEmbed = "";
    private final Set<String> failedEmbeds = new HashSet<>();
    private int recoveryAttempts;
    private long loadingSince = -1;
    private boolean recovering;
    private void recoverStream() {
        if (recovering || !alive) return;
        recovering = true;
        long saved = prepared ? safePosition() : resumeAtMs;
        if (recoveryAttempts >= 3) { loadingSince = -1; showError("Le flux ne répond pas. Réessaie ou choisis une autre source."); return; }
        recoveryAttempts++;
        releasePlayer(); spinner.setVisibility(View.VISIBLE);
        if (!activeEmbed.isEmpty()) failedEmbeds.add(activeEmbed);
        App.repo().api.invalidatePlayback();
        final int generation = openGeneration;
        final String retrySource = sourceUrl;
        App.MAIN.postDelayed(() -> { if (alive && generation == openGeneration) open(retrySource, saved); }, recoveryAttempts * 1000L);
    }

    private final Runnable hideOverlay = () -> { if (player != null && prepared && player.isPlaying()) showOverlay(false); };
    private final Runnable commitSeek = this::commitSeek;
    private final Runnable tick = new Runnable() { @Override public void run() { onTick(); App.MAIN.postDelayed(this, 250); } };
    private final Runnable presence = new Runnable() {
        @Override public void run() {
            final String id = live || media == null ? null : media.id;
            App.background(() -> App.repo().presence(live ? "Navigate sur le site" : "Regarde un média", id));
            App.MAIN.postDelayed(this, 20000);
        }
    };

    @Override public boolean alive() { return alive; }

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        ps = Actions.session;
        if (ps == null) { finish(); return; }
        Ui.init(this);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        live = ps.live;
        media = ps.media;
        season = ps.season;
        episode = ps.episode;
        audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);

        root = new FrameLayout(this);
        root.setBackgroundColor(0xFF000000);
        root.setFocusable(true);
        stage = new FrameLayout(this);
        root.addView(stage, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        spinner = Ui.column(this);
        spinner.setGravity(Gravity.CENTER_HORIZONTAL);
        spinner.setBackground(Ui.round(0xD9171A22, 24));
        spinner.setPadding(dp(44), dp(30), dp(44), dp(26));
        spinner.addView(new MainActivity.Spinner(this), Ui.lp(dp(60), dp(60)));
        loadingTitle = Ui.lines(Ui.text(this, 19, Ui.TEXT, true), 2);
        loadingTitle.setGravity(Gravity.CENTER);
        spinner.addView(loadingTitle, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(18), 0, 0));
        TextView wait = Ui.label(this, "Chargement de la vidéo…", 14, Ui.MUTED, false);
        spinner.addView(wait, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(6), 0, 0));
        root.addView(spinner, Ui.flp(Ui.WRAP, Ui.WRAP, Gravity.CENTER));
        buildOverlay();
        buildError();
        setContentView(root);
        long resumeMs = ps.resumeAt * 1000L;
        if (!live && ps.resumeAt > 0) {
            long exact = getPreferences(MODE_PRIVATE).getLong(bookmarkKey(), -1);
            if (exact / 1000 == ps.resumeAt) resumeMs = exact;
        }
        open(ps.url, resumeMs);
    }

    // ------------------------------------------------------------ Ouverture

    private void open(String url, long resumeMs) {
        final int generation = ++openGeneration;
        autoNext.reset();
        recovering = false; loadingSince = SystemClock.elapsedRealtime();
        creditsRequestKey = "";
        if (!url.equals(sourceUrl)) { failedEmbeds.clear(); recoveryAttempts = 0; }
        sourceUrl = url;
        App.MAIN.removeCallbacks(commitSeek);
        pendingSeek = -1;
        audioOptions = new JSONArray(); playbackBase = "";
        resumeAtMs = resumeMs;
        ended = false;
        playingSince = -1;
        playedMs = 0;
        lastSavedPosition = -1;
        hideError();
        hidePanel();
        upNext.setVisibility(View.GONE);
        direct = live || Logic.isDirectVideo(url) || Logic.isResolvedPlayer(url);
        updateTitles();
        updateLoadingTitle();
        if (Logic.isResolvedPlayer(url)) {
            destroyWeb(); releasePlayer(); spinner.setVisibility(View.VISIBLE);
            final Set<String> excluded = new HashSet<>(failedEmbeds);
            App.io(this, () -> App.repo().api.playback(url, excluded), (data, error) -> {
                if (generation != openGeneration) return;
                if (error != null) { recoverStream(); return; }
                playbackBase = data.optString("url", "");
                activeEmbed = data.optString("embed", "");
                JSONArray tracks = data.optJSONArray("audioTracks");
                audioOptions = tracks == null ? new JSONArray() : tracks;
                startDirect(withPreferredAudio(playbackBase), resumeMs);
            });
        }
        else if (direct) { destroyWeb(); startDirect(url, resumeMs); }
        else { releasePlayer(); startWeb(url); }
    }

    private void updateTitles() {
        if (live) {
            Channel c = ps.channels.get(ps.channel);
            title.setText(c.name);
            subtitle.setText(c.category + "  ·  chaîne " + (ps.channel + 1) + " / " + ps.channels.size());
            liveBadge.setVisibility(View.VISIBLE);
        } else {
            title.setText(media.title);
            Episode ep = media.episode(season, episode);
            if (media.hasEpisodes() && ep != null) subtitle.setText("Saison " + media.seasons.get(season).number + " · Épisode " + ep.number + (ep.title.isEmpty() ? "" : " — " + ep.title));
            else subtitle.setText(media.isSeries() ? "Série" : "Film");
            liveBadge.setVisibility(View.GONE);
        }
        boolean hasList = live || (media != null && media.hasEpisodes());
        prevButton.setVisibility(hasList ? View.VISIBLE : View.GONE);
        nextButton.setVisibility(hasList ? View.VISIBLE : View.GONE);
        listButton.setVisibility(hasList ? View.VISIBLE : View.GONE);
        prevButton.setText(live ? "Chaîne préc." : "Épisode préc.");
        nextButton.setText(live ? "Chaîne suiv." : "Épisode suiv.");
        listButton.setText(live ? "Chaînes" : "Épisodes");
        if (!live) {
            prevButton.setEnabled(media.previous(season, episode) != null);
            nextButton.setEnabled(media.next(season, episode) != null);
            prevButton.setAlpha(prevButton.isEnabled() ? 1f : 0.4f);
            nextButton.setAlpha(nextButton.isEnabled() ? 1f : 0.4f);
        }
        seek.setVisibility(live || !direct ? View.GONE : View.VISIBLE);
        time.setVisibility(live || !direct ? View.GONE : View.VISIBLE);
        findViewWithTagSafe("rew").setVisibility(direct && !live ? View.VISIBLE : View.GONE);
        findViewWithTagSafe("fwd").setVisibility(direct && !live ? View.VISIBLE : View.GONE);
        playPause.setVisibility(direct ? View.VISIBLE : View.GONE);
        findViewWithTagSafe("pointer").setVisibility(direct ? View.GONE : View.VISIBLE);
        findViewWithTagSafe("audio").setVisibility(direct && !live ? View.VISIBLE : View.GONE);
    }

    private void updateLoadingTitle() {
        if (live) { loadingTitle.setText(ps.channels.get(ps.channel).name); return; }
        Episode ep = media.episode(season, episode);
        loadingTitle.setText(media.title + (media.hasEpisodes() && ep != null ? "\nSaison " + media.seasons.get(season).number + " · Épisode " + ep.number : ""));
    }

    private View findViewWithTagSafe(String tag) { View v = buttons.findViewWithTag(tag); return v == null ? new View(this) : v; }

    // ------------------------------------------------------------ Lecteur natif

    private void startDirect(String url, long resumeMs) {
        releasePlayer();
        resumeAtMs = resumeMs;
        prepared = false;
        wantPlay = true;
        spinner.setVisibility(View.VISIBLE);
        if (surface == null) {
            surface = new SurfaceView(this);
            surface.getHolder().addCallback(new SurfaceHolder.Callback() {
                @Override public void surfaceCreated(SurfaceHolder h) { holder = h; if (player != null) try { player.setDisplay(h); } catch (Exception ignored) { } }
                @Override public void surfaceChanged(SurfaceHolder h, int f, int w, int hh) { }
                @Override public void surfaceDestroyed(SurfaceHolder h) { holder = null; if (player != null) try { player.setDisplay(null); } catch (Exception ignored) { } }
            });
            stage.addView(surface, Ui.flp(Ui.MATCH, Ui.MATCH, Gravity.CENTER));
        }
        surface.setVisibility(View.VISIBLE);
        MediaPlayer mp = new MediaPlayer();
        player = mp;
        try {
            mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MOVIE).build());
            Map<String, String> headers = new HashMap<>();
            headers.put("User-Agent", Api.USER_AGENT);
            if (live) headers.put("Referer", "https://iptv-org.github.io/");
            mp.setDataSource(this, Uri.parse(url), headers);
            if (holder != null) mp.setDisplay(holder);
            mp.setScreenOnWhilePlaying(true);
            mp.setOnPreparedListener(p -> {
                if (p != player) return;
                prepared = true; loadingSince = -1;
                spinner.setVisibility(View.GONE);
                long duration = safeDuration();
                boolean restoring = !live && resumeAtMs > 0 && duration > 0 && resumeAtMs < duration - 1000;
                if (restoring) {
                    p.setOnSeekCompleteListener(done -> { if (done == player && wantPlay && resumed) play(); });
                    p.seekTo(resumeAtMs, MediaPlayer.SEEK_CLOSEST);
                }
                selectPreferredNativeAudio();
                if (!restoring && wantPlay && resumed) play();
                updatePlayPause();
                showOverlay(true);

            });
            mp.setOnVideoSizeChangedListener((p, w, h) -> { videoW = w; videoH = h; fitSurface(); });
            mp.setOnInfoListener((p, what, extra) -> {
                if (p != player) return true;
                if (what == MediaPlayer.MEDIA_INFO_BUFFERING_START) { if (loadingSince < 0) loadingSince = SystemClock.elapsedRealtime(); spinner.setVisibility(View.VISIBLE); }
                else if (what == MediaPlayer.MEDIA_INFO_BUFFERING_END || what == MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START) { loadingSince = -1; spinner.setVisibility(View.GONE); }
                return false;
            });
            mp.setOnCompletionListener(p -> { if (p == player) onEnded(); });
            mp.setOnErrorListener((p, what, extra) -> {
                if (p != player) return true;
                recoverStream();
                return true;
            });
            mp.prepareAsync();
        } catch (Exception e) {
            recoverStream();
        }
    }

    private void fitSurface() {
        if (surface == null || videoW <= 0 || videoH <= 0) return;
        int w = root.getWidth(), h = root.getHeight();
        if (w == 0 || h == 0) return;
        float ratio = videoW / (float) videoH;
        int tw = w, th = Math.round(w / ratio);
        if (th > h) { th = h; tw = Math.round(h * ratio); }
        FrameLayout.LayoutParams p = (FrameLayout.LayoutParams) surface.getLayoutParams();
        if (p.width != tw || p.height != th) { p.width = tw; p.height = th; surface.setLayoutParams(p); }
    }

    private long safeDuration() { try { return prepared && !live ? Math.max(0, player.getDuration()) : 0; } catch (Exception e) { return 0; } }
    private long safePosition() { try { return prepared ? Math.max(0, player.getCurrentPosition()) : 0; } catch (Exception e) { return 0; } }

    private void play() {
        if (player == null || !prepared) { wantPlay = true; return; }
        requestAudioFocus();
        try { player.start(); } catch (Exception ignored) { }
        wantPlay = true;
        if (playingSince < 0) playingSince = SystemClock.elapsedRealtime();
        updatePlayPause();
        scheduleHide();
    }

    private void pause() {
        wantPlay = false;
        if (player != null && prepared) try { player.pause(); } catch (Exception ignored) { }
        stopPlayClock();
        updatePlayPause();
        persist();
        App.MAIN.removeCallbacks(hideOverlay);
    }

    private void togglePause() {
        if (!direct) { tapAt(root.getWidth() / 2f, root.getHeight() / 2f); return; }
        boolean playing = player != null && prepared && player.isPlaying();
        if (playing) pause(); else play();
        showOverlay(true);
    }

    private void updatePlayPause() {
        boolean playing = player != null && prepared && player.isPlaying();
        playPause.setText(playing ? "Pause" : "Lecture");
        android.graphics.drawable.Drawable icon = getDrawable(playing ? R.drawable.ic_pause : R.drawable.ic_play).mutate();
        icon.setBounds(0, 0, dp(22), dp(22));
        playPause.setCompoundDrawables(icon, null, null, null);
    }

    private void stopPlayClock() {
        if (playingSince >= 0) { playedMs += SystemClock.elapsedRealtime() - playingSince; playingSince = -1; }
    }

    private void releasePlayer() {
        if (player != null) {
            MediaPlayer p = player;
            player = null;
            prepared = false;
            try { p.reset(); } catch (Exception ignored) { }
            p.release();
        }
        if (surface != null) surface.setVisibility(View.GONE);
        abandonAudioFocus();
    }

    private void requestAudioFocus() {
        if (focusRequest == null) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MOVIE).build())
                    .setOnAudioFocusChangeListener(change -> { if (change == AudioManager.AUDIOFOCUS_LOSS) pause(); })
                    .build();
        }
        audio.requestAudioFocus(focusRequest);
    }

    private void abandonAudioFocus() { if (focusRequest != null) audio.abandonAudioFocusRequest(focusRequest); }

    // ------------------------------------------------------------ Lecteur web (Moviez et autres)

    @SuppressLint("SetJavaScriptEnabled")
    private void startWeb(String url) {
        spinner.setVisibility(View.VISIBLE);
        if (web == null) {
            web = new WebView(this);
            web.setBackgroundColor(0xFF000000);
            WebSettings s = web.getSettings();
            s.setJavaScriptEnabled(true);
            s.setDomStorageEnabled(true);
            s.setMediaPlaybackRequiresUserGesture(false);
            s.setSupportMultipleWindows(true);
            s.setJavaScriptCanOpenWindowsAutomatically(false);
            s.setAllowFileAccess(false);
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
            s.setUserAgentString(s.getUserAgentString().replace("; wv", "").replace("Version/4.0 ", ""));
            android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
            web.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    // Le cadre principal reste sur le lecteur : les redirections publicitaires sont bloquées.
                    return request.isForMainFrame();
                }
                @Override public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                    // Moteur web arrêté (mémoire de la TV) : on libère la page sans fermer l'application.
                    if (view == web) {
                        stage.removeView(web);
                        web.destroy();
                        web = null;
                        if (cursor != null) { root.removeView(cursor); cursor = null; }
                        if (webMenu != null) { root.removeView(webMenu); webMenu = null; }
                        customView = null;
                        showError("Le lecteur s'est arrêté. Appuie sur Réessayer pour le relancer.");
                    }
                    return true;
                }
                @Override public void onPageFinished(WebView view, String u) {
                    App.MAIN.postDelayed(() -> { if (alive) spinner.setVisibility(View.GONE); }, 1200);
                    if (playingSince < 0 && resumed) playingSince = SystemClock.elapsedRealtime();
                }
            });
            web.setWebChromeClient(new WebChromeClient() {
                @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean gesture, android.os.Message msg) { return false; }
                @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                    if (customView != null) { callback.onCustomViewHidden(); return; }
                    customView = view; customCallback = callback;
                    stage.addView(view, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
                }
                @Override public void onHideCustomView() { exitCustomView(); }
            });
            web.setFocusable(true);
            stage.addView(web, 0, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
            cursor = new CursorView(this);
            root.addView(cursor, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
            buildWebMenu();
        }
        String safe = url.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;");
        String html = "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                + "<meta name=\"referrer\" content=\"origin\"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}"
                + "iframe{position:fixed;left:0;top:0;width:100%;height:100%;border:0}</style></head><body>"
                + "<iframe id=\"p\" src=\"" + safe + "\" allow=\"autoplay; fullscreen; encrypted-media; picture-in-picture\" allowfullscreen referrerpolicy=\"origin\"></iframe>"
                + "<script>var f=document.getElementById('p');f.addEventListener('load',function(){try{f.focus()}catch(e){}});</script></body></html>";
        web.loadDataWithBaseURL(Api.SITE + "watch/" + media.id, html, "text/html", "utf-8", null);
        web.requestFocus();
        cursor.center();
        cursor.show();
        if (!App.repo().flag("help_pointer")) {
            App.repo().setFlag("help_pointer");
            message("Flèches : déplacer le pointeur · OK : cliquer dans le lecteur · Retour : menu de lecture");
        }
    }

    private void exitCustomView() {
        if (customView == null) return;
        stage.removeView(customView);
        customView = null;
        if (customCallback != null) customCallback.onCustomViewHidden();
        customCallback = null;
    }

    private void destroyWeb() {
        if (web == null) return;
        exitCustomView();
        stage.removeView(web);
        web.loadUrl("about:blank");
        web.destroy();
        web = null;
        if (cursor != null) { root.removeView(cursor); cursor = null; }
        if (webMenu != null) { root.removeView(webMenu); webMenu = null; }
    }

    /** Clic simulé à l'endroit du pointeur : il atteint aussi le lecteur intégré. */
    private void tapAt(float x, float y) {
        long now = SystemClock.uptimeMillis();
        MotionEvent down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, x, y, 0);
        down.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        stage.dispatchTouchEvent(down);
        down.recycle();
        MotionEvent up = MotionEvent.obtain(now, now + 60, MotionEvent.ACTION_UP, x, y, 0);
        up.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        stage.dispatchTouchEvent(up);
        up.recycle();
    }

    private void hover(float x, float y) {
        if (web == null) return;
        long now = SystemClock.uptimeMillis();
        MotionEvent.PointerProperties props = new MotionEvent.PointerProperties();
        props.id = 0; props.toolType = MotionEvent.TOOL_TYPE_MOUSE;
        MotionEvent.PointerCoords coords = new MotionEvent.PointerCoords();
        coords.x = x; coords.y = y;
        MotionEvent e = MotionEvent.obtain(now, now, MotionEvent.ACTION_HOVER_MOVE, 1, new MotionEvent.PointerProperties[]{props}, new MotionEvent.PointerCoords[]{coords}, 0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_MOUSE, 0);
        View target = customView != null ? customView : web;
        target.dispatchGenericMotionEvent(e);
        e.recycle();
    }

    private void moveCursor(int code, int repeat) {
        float step = dp(Math.min(46, 14 + repeat * 4));
        float dx = code == KeyEvent.KEYCODE_DPAD_LEFT ? -step : code == KeyEvent.KEYCODE_DPAD_RIGHT ? step : 0;
        float dy = code == KeyEvent.KEYCODE_DPAD_UP ? -step : code == KeyEvent.KEYCODE_DPAD_DOWN ? step : 0;
        if (!cursor.isShownNow()) { cursor.show(); return; }
        cursor.move(dx, dy, root.getWidth(), root.getHeight());
        hover(cursor.x, cursor.y);
    }

    private void buildWebMenu() {
        webMenu = Ui.column(this);
        webMenu.setBackground(Ui.round(0xF0171A22, 22));
        webMenu.setPadding(dp(30), dp(26), dp(30), dp(24));
        Ui.noClip(webMenu);
        webMenu.setVisibility(View.GONE);
        webMenu.addView(Ui.lines(Ui.label(this, "Lecture", 22, Ui.TEXT, true), 1));
        TextView hint = Ui.label(this, "Le lecteur intégré se pilote avec le pointeur :\nflèches pour le déplacer, OK pour cliquer (pause, ±10 s, sous-titres, volume).", 14, Ui.MUTED, false);
        hint.setLineSpacing(0, 1.25f);
        webMenu.addView(hint, Ui.lp(dp(440), Ui.WRAP, 0, dp(8), 0, dp(16)));
        addMenuButton("Reprendre la lecture", R.drawable.ic_play, this::closeWebMenu);
        addMenuButton("Quitter la lecture", R.drawable.ic_back, this::finish);
        if (media.hasEpisodes()) {
            addMenuButton("Épisode suivant", R.drawable.ic_next, () -> { closeWebMenu(); step(1); });
            addMenuButton("Épisode précédent", R.drawable.ic_prev, () -> { closeWebMenu(); step(-1); });
            addMenuButton("Épisodes et saisons", R.drawable.ic_list, () -> { closeWebMenu(); showPanel(); });
        }
        addMenuButton("Recharger le lecteur", R.drawable.ic_refresh, () -> { closeWebMenu(); open(media.playerUrl(season, episode), 0); });
        root.addView(webMenu, Ui.flp(Ui.WRAP, Ui.WRAP, Gravity.CENTER));
    }

    private void addMenuButton(String label, int icon, Runnable action) {
        TextView b = Ui.button(this, label, icon, Ui.STYLE_NORMAL);
        b.setOnClickListener(v -> action.run());
        webMenu.addView(b, Ui.lp(Ui.MATCH, Ui.WRAP, 0, 0, 0, dp(10)));
    }

    private boolean webMenuOpen() { return webMenu != null && webMenu.getVisibility() == View.VISIBLE; }
    private void openWebMenu() {
        if (webMenu == null) return;
        webMenu.setVisibility(View.VISIBLE);
        cursor.hide();
        web.setFocusable(false);
        webMenu.getChildAt(2).requestFocus();
    }
    private void closeWebMenu() {
        if (webMenu == null) return;
        webMenu.setVisibility(View.GONE);
        if (web != null) { web.setFocusable(true); web.requestFocus(); }
        if (cursor != null) cursor.show();
    }

    // ------------------------------------------------------------ Commandes à l'écran

    private void buildOverlay() {
        overlay = Ui.column(this);
        overlay.setBackground(Ui.gradient(GradientDrawable.Orientation.BOTTOM_TOP, 0xF2000000, 0xB3000000, 0x00000000));
        overlay.setPadding(dp(56), dp(80), dp(56), dp(34));
        Ui.noClip(overlay);
        LinearLayout titleRow = Ui.row(this);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        liveBadge = Ui.label(this, "EN DIRECT", 12, 0xFFFFFFFF, true);
        liveBadge.setBackground(Ui.round(Ui.ACCENT, 6));
        liveBadge.setPadding(dp(8), dp(4), dp(8), dp(4));
        titleRow.addView(liveBadge, Ui.lp(Ui.WRAP, Ui.WRAP, 0, 0, dp(12), 0));
        title = Ui.lines(Ui.text(this, 30, Ui.TEXT, true), 1);
        titleRow.addView(title);
        overlay.addView(titleRow);
        subtitle = Ui.lines(Ui.text(this, 17, Ui.MUTED, false), 1);
        overlay.addView(subtitle, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(6), 0, dp(16)));
        LinearLayout seekRow = Ui.row(this);
        seekRow.setGravity(Gravity.CENTER_VERTICAL);
        seek = new SeekView(this);
        seekRow.addView(seek, new LinearLayout.LayoutParams(0, dp(44), 1f));
        time = Ui.text(this, 16, Ui.TEXT, true);
        seekRow.addView(time, Ui.lp(Ui.WRAP, Ui.WRAP, dp(18), 0, 0, 0));
        overlay.addView(seekRow, Ui.lp(Ui.MATCH, Ui.WRAP, 0, 0, 0, dp(14)));
        buttons = Ui.row(this);
        Ui.noClip(buttons);
        prevButton = control("Préc.", R.drawable.ic_prev, () -> step(-1), null);
        control("-10 s", R.drawable.ic_rewind, () -> seekBy(-10000), "rew");
        playPause = control("Pause", R.drawable.ic_pause, this::togglePause, null);
        control("+10 s", R.drawable.ic_forward, () -> seekBy(10000), "fwd");
        nextButton = control("Suiv.", R.drawable.ic_next, () -> step(1), null);
        listButton = control("Épisodes", R.drawable.ic_list, this::showPanel, null);
        control("Pointeur", R.drawable.ic_pointer, () -> { showOverlay(false); if (cursor != null) cursor.show(); }, "pointer");
        control("Langue", R.drawable.ic_list, this::showAudio, "audio");
        overlay.addView(buttons);
        TextView help = Ui.label(this, "◀ ▶ : ±10 s · maintenir pour accélérer   |   OK : pause / lecture   |   ↓ : commandes   |   Retour : fermer", 12, Ui.MUTED, false);
        help.setSingleLine(true);
        help.setEllipsize(android.text.TextUtils.TruncateAt.END);
        overlay.addView(help, Ui.lp(Ui.MATCH, Ui.WRAP, 0, dp(16), 0, 0));
        seek.setId(View.generateViewId());
        playPause.setId(View.generateViewId());
        seek.setNextFocusDownId(playPause.getId());
        for (int i = 0; i < buttons.getChildCount(); i++) {
            View button = buttons.getChildAt(i);
            button.setId(i == 2 ? playPause.getId() : View.generateViewId());
            button.setNextFocusUpId(seek.getId());
        }
        root.addView(overlay, Ui.flp(Ui.MATCH, Ui.WRAP, Gravity.BOTTOM));
        overlay.setVisibility(View.GONE);

        upNext = Ui.button(this, "Épisode suivant", R.drawable.ic_next, Ui.STYLE_PRIMARY);
        upNext.setVisibility(View.GONE);
        upNext.setOnClickListener(v -> { upNext.setVisibility(View.GONE); step(1); });
        nextProgress = new android.graphics.drawable.ClipDrawable(Ui.round(Ui.ACCENT, 0), Gravity.LEFT, android.graphics.drawable.ClipDrawable.HORIZONTAL);
        android.graphics.drawable.LayerDrawable nextBackground = new android.graphics.drawable.LayerDrawable(new android.graphics.drawable.Drawable[]{Ui.stroked(0xF5061028, Ui.ACCENT, 1, 14), nextProgress});
        nextBackground.setLayerGravity(1, Gravity.BOTTOM);
        nextBackground.setLayerHeight(1, dp(4));
        upNext.setBackground(nextBackground);
        upNext.setMinHeight(dp(66));
        upNext.setTextSize(18);
        upNext.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        FrameLayout.LayoutParams up = Ui.flp(Ui.MATCH, Ui.WRAP, Gravity.BOTTOM);
        up.setMargins(dp(56), 0, dp(56), dp(30));
        root.addView(upNext, up);

        panel = Ui.column(this);
        panel.setBackground(Ui.gradient(GradientDrawable.Orientation.BOTTOM_TOP, 0xFA000000, 0xE6000000, 0x00000000));
        panel.setPadding(dp(48), dp(70), dp(20), dp(30));
        Ui.noClip(panel);
        panel.setVisibility(View.GONE);
        root.addView(panel, Ui.flp(Ui.MATCH, Ui.WRAP, Gravity.BOTTOM));
    }

    private TextView control(String label, int icon, Runnable action, String tag) {
        TextView b = Ui.button(this, label, icon, Ui.STYLE_GHOST);
        b.setTextSize(13);
        b.setPadding(dp(10), 0, dp(10), 0);
        b.setCompoundDrawablePadding(dp(6));
        b.setMinHeight(dp(48));
        b.setOnClickListener(v -> { action.run(); scheduleHide(); });
        if (tag != null) b.setTag(tag);
        LinearLayout.LayoutParams layout = new LinearLayout.LayoutParams(0, dp(50), 1f);
        layout.setMargins(dp(3), 0, dp(3), 0);
        buttons.addView(b, layout);
        return b;
    }

    private boolean overlayVisible() { return overlay.getVisibility() == View.VISIBLE; }

    private void showOverlay(boolean show) {
        if (show) {
            // Un fondu de disparition en cours est annulé (sinon les commandes disparaîtraient).
            overlay.animate().cancel();
            if (!overlayVisible()) {
                overlay.setVisibility(View.VISIBLE);
                overlay.setAlpha(0f);
            }
            overlay.animate().alpha(1f).setDuration(160).start();
            updateProgressUi();
            if (!MainActivity.isInside(getCurrentFocus(), overlay)) {
                View target = direct && !live ? seek : direct ? playPause : listButton.getVisibility() == View.VISIBLE ? listButton : findViewWithTagSafe("pointer");
                target.requestFocus();
            }
            if (cursor != null) cursor.hide();
            scheduleHide();
        } else if (overlayVisible()) {
            overlay.animate().cancel();
            overlay.animate().alpha(0f).setDuration(160).withEndAction(() -> overlay.setVisibility(View.GONE)).start();
            if (web != null) web.requestFocus(); else root.requestFocus();
        }
    }

    private void scheduleHide() {
        App.MAIN.removeCallbacks(hideOverlay);
        App.MAIN.postDelayed(hideOverlay, 5000);
    }

    private void message(String text) {
        TextView t = Ui.lines(Ui.label(this, text, 16, Ui.TEXT, true), 3);
        t.setBackground(Ui.round(0xF0262A35, 14));
        t.setPadding(dp(22), dp(14), dp(22), dp(14));
        FrameLayout.LayoutParams p = Ui.flp(Ui.WRAP, Ui.WRAP, Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        p.topMargin = dp(36);
        root.addView(t, p);
        t.postDelayed(() -> t.animate().alpha(0f).setDuration(250).withEndAction(() -> root.removeView(t)).start(), 4500);
    }

    // ------------------------------------------------------------ Avance / retour

    private void seekBy(long deltaMs) {
        if (!direct || live || !prepared) return;
        long duration = safeDuration();
        long base = pendingSeek >= 0 ? pendingSeek : safePosition();
        pendingSeek = Logic.seekTarget(base, deltaMs, duration);
        updateProgressUi();
        App.MAIN.removeCallbacks(commitSeek);
        App.MAIN.postDelayed(commitSeek, 650);
        showOverlay(true);
    }

    private void commitSeek() {
        if (pendingSeek < 0 || player == null || !prepared) { pendingSeek = -1; return; }
        try { player.seekTo(pendingSeek, MediaPlayer.SEEK_CLOSEST); } catch (Exception ignored) { }
        pendingSeek = -1;
        scrubRepeat = 0;
        updateProgressUi();
        persist();
    }

    private long scrubStep(int repeat) { return Logic.seekStep(repeat); }

    // ------------------------------------------------------------ Épisodes et chaînes

    private void step(int direction) {
        if (live) { zap(direction); return; }
        int[] target = direction > 0 ? media.next(season, episode) : media.previous(season, episode);
        if (target == null) { message(direction > 0 ? "C'est le dernier épisode." : "C'est le premier épisode."); return; }
        playEpisode(target[0], target[1]);
    }

    private boolean switching;

    /** Changement d'épisode : même parcours que le site (vision réservée, historique mis à jour). */
    private void playEpisode(int s, int e) {
        if (switching) return;
        String url = media.playerUrl(s, e);
        if (url.isEmpty()) { message("Aucun lecteur disponible pour cet épisode."); return; }
        switching = true;
        autoNext.cancel(); upNext.setVisibility(View.GONE);
        persist();
        spinner.setVisibility(View.VISIBLE);
        App.io(this, () -> App.repo().reserveViewing(), (access, error) -> {
            switching = false;
            if (error != null) { spinner.setVisibility(View.GONE); message(App.message(error)); return; }
            Actions.invalidateQuota();
            if (!access.allowed) { spinner.setVisibility(View.GONE); showQuotaReached(); return; }
            if (!access.vip) message(access.remaining > 0 ? "Vision gratuite utilisée · il t'en reste " + access.remaining + " sur " + Logic.FREE_WATCH_LIMIT + "." : "C'était ta dernière vision gratuite de la semaine.");
            season = s; episode = e;
            ps.season = s; ps.episode = e; ps.resumeAt = 0; ps.url = url;
            final Media m = media;
            App.repo().enqueue(() -> App.repo().saveHistory(m, s, e, 0, 0));
            open(url, 0);
        });
    }

    private void showQuotaReached() {
        releasePlayer();
        destroyWeb();
        showError("Tes 5 visions gratuites sont épuisées. Passe au VIP (sur ton téléphone ou ton ordinateur) pour regarder sans limite, ou attends la remise à zéro du dimanche.");
        errorRetry.setText("Découvrir le VIP");
        errorRetry.setOnClickListener(v -> { Actions.openAccountOnReturn = true; finish(); });
        errorExtra.setText("Quitter la lecture");
    }

    private void zap(int direction) {
        int n = ps.channels.size();
        if (n == 0) return;
        ps.channel = ((ps.channel + direction) % n + n) % n;
        open(ps.channels.get(ps.channel).url, 0);
        showOverlay(true);
    }

    private boolean panelVisible() { return panel.getVisibility() == View.VISIBLE; }

    private void showPanel() {
        if (!live && (media == null || !media.hasEpisodes())) return;
        showOverlay(false);
        if (cursor != null) cursor.hide();
        panel.removeAllViews();
        if (live) {
            Shelf shelf = new Shelf(this, "Chaînes");
            for (int i = 0; i < ps.channels.size(); i++) {
                final int index = i;
                Channel c = ps.channels.get(i);
                Card card = new Card(this, 170, 110, true, true);
                card.image.setScaleType(android.widget.ImageView.ScaleType.FIT_CENTER);
                card.image.setPadding(dp(24), dp(12), dp(24), dp(34));
                card.caption(i == ps.channel ? "EN COURS" : "", c.name);
                card.bindImage(c.logo, "");
                card.setOnClickListener(v -> { hidePanel(); ps.channel = index; open(c.url, 0); });
                shelf.add(card, 16);
            }
            panel.addView(shelf);
            shelf.lastIndex = ps.channel;
        } else {
            renderEpisodePanel(season);
        }
        panel.setVisibility(View.VISIBLE);
        panel.setAlpha(0f);
        panel.animate().alpha(1f).setDuration(160).start();
        panel.post(() -> {
            Shelf last = (Shelf) panel.getChildAt(panel.getChildCount() - 1);
            last.focusLast();
            View item = last.item(last.lastIndex);
            if (item != null) last.scroll.reveal(item, false);
        });
    }

    private int panelSeason;

    private void renderEpisodePanel(int s) {
        panelSeason = s;
        panel.removeAllViews();
        if (media.seasons.size() > 1) {
            Shelf seasons = new Shelf(this, "Saisons");
            for (int i = 0; i < media.seasons.size(); i++) {
                final int index = i;
                TextView chip = Ui.chip(this, "Saison " + media.seasons.get(i).number);
                chip.setActivated(i == s);
                chip.setLayoutParams(new LinearLayout.LayoutParams(Ui.WRAP, Ui.WRAP));
                chip.setOnClickListener(v -> { renderEpisodePanel(index); panel.post(() -> ((Shelf) panel.getChildAt(1)).focus(0)); });
                seasons.add(chip, 10);
            }
            seasons.lastIndex = s;
            panel.addView(seasons);
        }
        Season se = media.seasons.get(s);
        Shelf eps = new Shelf(this, "Saison " + se.number + " · " + se.episodes.size() + " épisodes");
        for (int i = 0; i < se.episodes.size(); i++) {
            final int index = i;
            Episode ep = se.episodes.get(i);
            Card card = new Card(this, 230, 130, true, true);
            boolean current = s == season && i == episode;
            card.caption(current ? "EN COURS" : "ÉPISODE " + ep.number, ep.label());
            String img = !ep.still.isEmpty() ? ep.still : !se.poster.isEmpty() ? se.poster : media.image();
            card.bindImage(Logic.tmdbSize(img, "w500"), "");
            if (markedSeen.contains(Logic.epKey(s, i))) card.badge("✓ VU", 0xE6168A45);
            card.setOnClickListener(v -> { if (current) { hidePanel(); return; } hidePanel(); playEpisode(s, index); });
            eps.add(card, 16);
        }
        eps.lastIndex = s == season ? episode : 0;
        panel.addView(eps);
    }

    private void hidePanel() {
        if (!panelVisible()) return;
        panel.setVisibility(View.GONE);
        panel.removeAllViews();
        if (web != null) { web.requestFocus(); if (cursor != null) cursor.show(); }
        else root.requestFocus();
    }

    // ------------------------------------------------------------ Suivi de lecture

    private String language(String value) {
        String code = value == null ? "" : value.toLowerCase(java.util.Locale.ROOT).split("[-_]")[0];
        return "fra".equals(code) || "fre".equals(code) ? "fr" : "eng".equals(code) ? "en" : code;
    }

    private String preferredLanguage() { return getPreferences(MODE_PRIVATE).getString("audio_language", "fr"); }

    private String withPreferredAudio(String base) {
        JSONObject chosen = null;
        for (int i = 0; i < audioOptions.length(); i++) {
            JSONObject track = audioOptions.optJSONObject(i); if (track == null) continue;
            if (language(track.optString("lang")).equals(language(preferredLanguage()))) { chosen = track; break; }
            if (chosen == null || "fr".equals(language(track.optString("lang")))) chosen = track;
        }
        return chosen != null && !chosen.optString("lang").isEmpty() ? Uri.parse(base).buildUpon().appendQueryParameter("audio", chosen.optString("lang")).build().toString() : base;
    }

    private void selectPreferredNativeAudio() {
        if (!playbackBase.isEmpty() || player == null || !prepared) return;
        try {
            MediaPlayer.TrackInfo[] tracks = player.getTrackInfo();
            for (int i = 0; i < tracks.length; i++) if (tracks[i].getTrackType() == MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_AUDIO &&
                    language(tracks[i].getLanguage()).equals(language(preferredLanguage()))) { player.selectTrack(i); break; }
        } catch (Exception ignored) { }
    }

    private void showAudio() {
        if (!prepared || player == null) { message("Attends que la vidéo soit prête."); return; }
        final List<String> names = new ArrayList<>(), langs = new ArrayList<>();
        final List<Integer> indices = new ArrayList<>();
        if (!playbackBase.isEmpty()) {
            for (int pass = 0; pass < 2; pass++) for (int i = 0; i < audioOptions.length(); i++) {
                JSONObject option = audioOptions.optJSONObject(i); if (option == null) continue;
                String lang = option.optString("lang"), name = option.optString("name");
                if (("fr".equals(language(lang)) ? 0 : 1) != pass) continue;
                names.add(name.isEmpty() ? ("fr".equals(language(lang)) ? "Français (VF)" : lang.isEmpty() ? "Audio d’origine" : lang) : name);
                langs.add(lang); indices.add(i);
            }
        } else try {
            MediaPlayer.TrackInfo[] tracks = player.getTrackInfo();
            for (int pass = 0; pass < 2; pass++) for (int i = 0; i < tracks.length; i++) {
                if (tracks[i].getTrackType() != MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_AUDIO) continue;
                String lang = tracks[i].getLanguage();
                if (("fr".equals(language(lang)) ? 0 : 1) != pass) continue;
                names.add("fr".equals(language(lang)) ? "Français (VF)" : "en".equals(language(lang)) ? "English" : lang);
                langs.add(lang); indices.add(i);
            }
        } catch (Exception ignored) { }
        if (names.size() < 2) { message("Une seule piste audio disponible pour cette vidéo."); return; }
        new android.app.AlertDialog.Builder(this).setTitle("Langue audio")
            .setItems(names.toArray(new String[0]), (dialog, which) -> {
                String lang = langs.get(which);
                if (!lang.isEmpty()) getPreferences(MODE_PRIVATE).edit().putString("audio_language", lang).apply();
                if (!playbackBase.isEmpty()) {
                    long at = safePosition(); boolean wasPlaying = player != null && prepared && player.isPlaying();
                    persist(); startDirect(withPreferredAudio(playbackBase), at); wantPlay = wasPlaying;
                } else try { player.selectTrack(indices.get(which)); } catch (Exception ignored) { message("Cette piste audio est indisponible."); }
            }).setNegativeButton("Retour", null).show();
    }

    private String bookmarkKey() {
        return "resume:" + App.repo().userId() + ":" + App.repo().profileId() + ":" + (media == null ? "" : media.id) + ":" + season + ":" + episode;
    }

    private String key() { return media.isSeries() ? Logic.epKey(season, episode) : "movie_main"; }

    private void markSeen() {
        if (live || media == null) return;
        final String k = key();
        if (!markedSeen.add(k)) return;
        final String id = media.id;
        App.repo().enqueue(() -> App.repo().setWatched(id, Collections.singletonList(k), true));
    }

    /** Enregistre la position (toutes les 10 s, à la pause et à la sortie). */
    private void persist() {
        if (live || media == null) return;
        // Lecteur intégré : position inconnue, on enregistre le temps passé lecteur ouvert (estimation).
        long estimated = (resumeAtMs + playedMs + (playingSince >= 0 ? SystemClock.elapsedRealtime() - playingSince : 0)) / 1000;
        final long position = direct ? safePosition() / 1000 : estimated, duration = direct ? safeDuration() / 1000 : 0;
        if (direct && !prepared) return;
        if (direct) getPreferences(MODE_PRIVATE).edit().putLong(bookmarkKey(), safePosition()).apply();
        ps.resumeAt = position;
        lastSavedPosition = position;
        final Media m = media; final int s = season, e = episode;
        App.repo().enqueue(() -> App.repo().saveHistory(m, s, e, position, duration));
    }

    private void onTick() {
        if (!resumed) return;
        if (direct && wantPlay && loadingSince >= 0 && SystemClock.elapsedRealtime() - loadingSince > 25000 && (prepared || !Logic.isResolvedPlayer(sourceUrl))) { recoverStream(); return; }
        if (ended && autoNext.active() && !switching && !panelVisible()) { autoNext.cancel(); step(1); return; }
        long played = playedMs + (playingSince >= 0 ? SystemClock.elapsedRealtime() - playingSince : 0);
        if (direct) {
            boolean playing = player != null && prepared && player.isPlaying();
            if (playing && playingSince < 0) playingSince = SystemClock.elapsedRealtime();
            if (!playing) stopPlayClock();
            if (overlayVisible()) updateProgressUi();
            if (!live && prepared) {
                long pos = safePosition() / 1000, dur = safeDuration() / 1000;
                final String markerKey = sourceUrl + ":" + dur;
                if (dur >= 300 && media != null && !markerKey.equals(creditsRequestKey)) {
                    creditsRequestKey = markerKey;
                    final int generation = openGeneration;
                    final long actualDuration = safeDuration();
                    final String source = sourceUrl;
                    App.io(this, () -> App.repo().api.episodeCredits(source, actualDuration), (data, error) -> {
                        if (generation != openGeneration || !markerKey.equals(creditsRequestKey) || data == null) return;
                        double start = data.optDouble("start", -1), reference = data.optDouble("duration", -1);
                        if (!Double.isNaN(start) && !Double.isInfinite(start) && start >= 0 && start * 1000 < actualDuration && Math.abs(reference * 1000 - actualDuration) <= 2000) autoNext.marker(Math.round(start * 1000), Math.round(reference * 1000));
                    });
                }
                if (Logic.isCompleted(pos, dur)) markSeen();
                if (playing && dur > 60 && dur - pos <= 60 && dur - pos > 30 && !sourceUrl.equals(preparedEpisode)) {
                    preparedEpisode = sourceUrl;
                    int[] nextEpisode = media == null ? null : media.next(season, episode);
                    if (nextEpisode != null) {
                        final String nextSource = media.playerUrl(nextEpisode[0], nextEpisode[1]);
                        if (Logic.isResolvedPlayer(nextSource)) App.io(this, () -> App.repo().api.playback(nextSource), (data, error) -> { });
                    }
                }
                if (lastSavedPosition < 0 || Math.abs(pos - lastSavedPosition) >= 10) persist();
                boolean wasActive = autoNext.active();
                boolean launch = autoNext.update(safePosition(), safeDuration(), (playing || ended) && pendingSeek < 0, media != null && media.next(season, episode) != null);
                if (launch && !panelVisible()) { autoNext.cancel(); upNext.setVisibility(View.GONE); step(1); return; }
                if (autoNext.active() && !wasActive) {
                    App.MAIN.removeCallbacks(hideOverlay); overlay.animate().cancel(); overlay.setVisibility(View.GONE);
                    upNext.setVisibility(View.VISIBLE); upNext.requestFocus();
                }
                if (autoNext.active()) upNext.setText("LECTURE SUIVANTE DANS " + autoNext.remaining + " s" + (!playing && !ended ? " · en pause" : "") + " · Retour : annuler");
                else upNext.setVisibility(View.GONE);
                if (nextProgress != null) nextProgress.setLevel(autoNext.active() ? Math.max(0, Math.min(10000, (5 - autoNext.remaining) * 2000)) : 0);
            }
        }
        // Lecteur intégré : progression estimée enregistrée toutes les 30 secondes.
        if (!direct && !live && played > 0 && (played / 1000) % 30 == 0) persist();
        // Comme sur le site : le titre est marqué vu après 5 secondes de lecture.
        if (!live && played >= Logic.SEEN_DELAY_MS) markSeen();
    }

    private void updateProgressUi() {
        if (!direct || live) return;
        long duration = safeDuration(), position = pendingSeek >= 0 ? pendingSeek : safePosition();
        seek.set(duration > 0 ? position / (float) duration : 0f, pendingSeek >= 0);
        time.setText(Logic.formatTime(position / 1000) + " / " + (duration > 0 ? Logic.formatTime(duration / 1000) : "--:--"));
    }

    private void onEnded() {
        if (ended) return;
        ended = true;
        stopPlayClock();
        markSeen();
        persist();
        updatePlayPause();
        int[] next = media == null ? null : media.next(season, episode);
        if (next != null) {
            autoNext.ended(true);
            if (autoNext.active()) {
                upNext.setText("Épisode suivant dans " + autoNext.remaining + " s · Retour : annuler");
                upNext.setVisibility(View.VISIBLE); upNext.requestFocus();
            }
        } else {
            message("Lecture terminée. Ton historique est à jour.");
            showOverlay(true);
        }
    }

    // ------------------------------------------------------------ Erreurs

    private void buildError() {
        errorBox = Ui.column(this);
        errorBox.setGravity(Gravity.CENTER_HORIZONTAL);
        errorBox.setBackground(Ui.round(0xF0171A22, 22));
        errorBox.setPadding(dp(36), dp(30), dp(36), dp(28));
        Ui.noClip(errorBox);
        errorText = Ui.label(this, "", 17, Ui.TEXT, false);
        errorText.setGravity(Gravity.CENTER);
        errorText.setLineSpacing(0, 1.3f);
        errorBox.addView(errorText, Ui.lp(dp(520), Ui.WRAP));
        LinearLayout row = Ui.row(this);
        Ui.noClip(row);
        errorRetry = Ui.button(this, "Réessayer", R.drawable.ic_refresh, Ui.STYLE_PRIMARY);
        errorExtra = Ui.button(this, "Quitter la lecture", R.drawable.ic_back, Ui.STYLE_NORMAL);
        errorExtra.setOnClickListener(v -> finish());
        row.addView(errorRetry);
        row.addView(errorExtra, Ui.lp(Ui.WRAP, Ui.WRAP, dp(14), 0, 0, 0));
        errorBox.addView(row, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(22), 0, 0));
        errorBox.setVisibility(View.GONE);
        root.addView(errorBox, Ui.flp(Ui.WRAP, Ui.WRAP, Gravity.CENTER));
    }

    private void showError(String text) {
        autoNext.cancel(); upNext.setVisibility(View.GONE);
        spinner.setVisibility(View.GONE);
        showOverlay(false);
        if (cursor != null) cursor.hide();
        errorText.setText(text);
        errorRetry.setText("Réessayer");
        errorExtra.setText(live ? "Chaîne suivante" : "Quitter la lecture");
        errorExtra.setOnClickListener(v -> { if (live && errorExtra.getText().toString().startsWith("Chaîne")) zap(1); else finish(); });
        errorRetry.setOnClickListener(v -> {
            hideError();
            recoveryAttempts = 0; failedEmbeds.clear(); App.repo().api.invalidatePlayback();
            if (live) open(ps.channels.get(ps.channel).url, 0);
            else open(media.playerUrl(season, episode), safePositionForRetry());
        });
        errorBox.setVisibility(View.VISIBLE);
        if (web != null) web.setFocusable(false);
        errorRetry.requestFocus();
    }

    private long safePositionForRetry() { return lastSavedPosition > 0 ? lastSavedPosition * 1000 : resumeAtMs; }

    private void hideError() {
        errorBox.setVisibility(View.GONE);
        if (web != null) web.setFocusable(true);
    }

    // ------------------------------------------------------------ Télécommande

    private boolean centerDown, longFired;
    private KeyEvent centerEvent;
    private long lastRepeat;

    @Override public boolean dispatchKeyEvent(KeyEvent e) {
        int code = e.getKeyCode(), action = e.getAction();
        boolean down = action == KeyEvent.ACTION_DOWN;
        boolean uiOpen = overlayVisible() || panelVisible() || errorBox.getVisibility() == View.VISIBLE || webMenuOpen() || upNext.hasFocus();
        if (overlayVisible() && down) scheduleHide();
        boolean horizontal = code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT;
        boolean mediaSeek = code == KeyEvent.KEYCODE_MEDIA_FAST_FORWARD || code == KeyEvent.KEYCODE_MEDIA_REWIND;
        if (direct && !live && pendingSeek >= 0 && !down && (horizontal || mediaSeek)) {
            App.MAIN.removeCallbacks(commitSeek);
            commitSeek();
            return true;
        }
        if (direct && !live && prepared && down && (mediaSeek || (horizontal && (!uiOpen || seek.hasFocus())))) {
            long now = SystemClock.uptimeMillis();
            if (e.getRepeatCount() > 0 && now - lastRepeat < 180) return true;
            lastRepeat = now;
            scrubRepeat = e.getRepeatCount() == 0 ? 0 : scrubRepeat + 1;
            boolean backwards = code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_MEDIA_REWIND;
            seekBy((backwards ? -1 : 1) * (mediaSeek ? 30000 : scrubStep(scrubRepeat)));
            seek.requestFocus();
            return true;
        }

        if (code == KeyEvent.KEYCODE_BACK || code == KeyEvent.KEYCODE_ESCAPE || code == KeyEvent.KEYCODE_BUTTON_B) {
            if (action == KeyEvent.ACTION_UP && !e.isCanceled()) back();
            return true;
        }

        switch (code) {
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: case KeyEvent.KEYCODE_HEADSETHOOK:
                if (down && e.getRepeatCount() == 0) togglePause(); return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY:
                if (down && e.getRepeatCount() == 0) { if (direct) { play(); showOverlay(true); } else togglePause(); } return true;
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                if (down && e.getRepeatCount() == 0) { if (direct) { pause(); showOverlay(true); } else togglePause(); } return true;
            case KeyEvent.KEYCODE_MEDIA_STOP:
                if (down) finish(); return true;
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                if (down) seekBy(30000); return true;
            case KeyEvent.KEYCODE_MEDIA_REWIND:
                if (down) seekBy(-30000); return true;
            case KeyEvent.KEYCODE_MEDIA_NEXT: case KeyEvent.KEYCODE_CHANNEL_UP:
                if (down && e.getRepeatCount() == 0) step(1); return true;
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS: case KeyEvent.KEYCODE_CHANNEL_DOWN:
                if (down && e.getRepeatCount() == 0) step(-1); return true;
            case KeyEvent.KEYCODE_MENU:
                if (down && e.getRepeatCount() == 0) { if (direct) showOverlay(!overlayVisible()); else if (webMenuOpen()) closeWebMenu(); else openWebMenu(); } return true;
            default: break;
        }

        // Interface ouverte : navigation normale entre les boutons, avec cadence limitée.
        if (uiOpen) {
            if (down && e.getRepeatCount() > 0 && MainActivity.isDirection(code)) {
                long now = SystemClock.uptimeMillis();
                if (seek.hasFocus() && (code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT)) {
                    scrubRepeat++;
                    seekBy((code == KeyEvent.KEYCODE_DPAD_LEFT ? -1 : 1) * scrubStep(scrubRepeat));
                    return true;
                }
                if (now - lastRepeat < 90) return true;
                lastRepeat = now;
            }
            if (down && seek.hasFocus() && (code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT)) {
                scrubRepeat = 0;
                seekBy(code == KeyEvent.KEYCODE_DPAD_LEFT ? -10000 : 10000);
                return true;
            }
            if (down && seek.hasFocus() && MainActivity.isSelect(code)) { if (e.getRepeatCount() == 0) togglePause(); return true; }
            if (!down && seek.hasFocus() && MainActivity.isSelect(code)) return true;
            return super.dispatchKeyEvent(e);
        }

        // Aucune interface : raccourcis de lecture.
        if (MainActivity.isSelect(code)) {
            if (down) {
                if (e.getRepeatCount() == 0) { centerDown = true; longFired = false; return true; }
                if (centerDown && !longFired) { longFired = true; if (direct) showOverlay(true); else openWebMenu(); }
                return true;
            }
            if (!centerDown) return true;
            centerDown = false;
            if (longFired) return true;
            if (direct) togglePause();
            else if (cursor != null && cursor.isShownNow()) { tapAt(cursor.x, cursor.y); cursor.show(); }
            else togglePause();
            return true;
        }
        if (MainActivity.isDirection(code)) {
            if (!down) return true;
            if (e.getRepeatCount() > 0) {
                long now = SystemClock.uptimeMillis();
                if (now - lastRepeat < 70) return true;
                lastRepeat = now;
            }
            if (!direct) { moveCursor(code, e.getRepeatCount()); return true; }
            if (live) {
                if (code == KeyEvent.KEYCODE_DPAD_UP && e.getRepeatCount() == 0) zap(1);
                else if (code == KeyEvent.KEYCODE_DPAD_DOWN && e.getRepeatCount() == 0) zap(-1);
                else showOverlay(true);
                return true;
            }
            if (code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT) {
                scrubRepeat = e.getRepeatCount() == 0 ? 0 : scrubRepeat + 1;
                seekBy((code == KeyEvent.KEYCODE_DPAD_LEFT ? -1 : 1) * scrubStep(scrubRepeat));
                return true;
            }
            if (code == KeyEvent.KEYCODE_DPAD_DOWN && media.hasEpisodes() && e.getRepeatCount() == 0) { showPanel(); return true; }
            if (e.getRepeatCount() == 0) showOverlay(true);
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    private void back() {
        if (autoNext.active()) { autoNext.cancel(); upNext.setVisibility(View.GONE); root.requestFocus(); message("Passage automatique annulé. Tu peux regarder le générique."); return; }
        if (customView != null) { exitCustomView(); return; }
        if (webMenuOpen()) { closeWebMenu(); return; }
        if (panelVisible()) { hidePanel(); return; }
        if (overlayVisible()) { if (pendingSeek >= 0) { App.MAIN.removeCallbacks(commitSeek); commitSeek(); } showOverlay(false); return; }
        if (upNext.getVisibility() == View.VISIBLE) { upNext.setVisibility(View.GONE); return; }
        if (!direct && errorBox.getVisibility() != View.VISIBLE) { openWebMenu(); return; }
        finish();
    }

    // ------------------------------------------------------------ Cycle de vie

    @Override protected void onResume() {
        super.onResume();
        resumed = true;
        App.MAIN.post(tick);
        App.MAIN.post(presence);
        if (web != null) { web.onResume(); if (playingSince < 0) playingSince = SystemClock.elapsedRealtime(); }
        if (direct && player != null && prepared && wantPlay) play();
    }

    @Override protected void onPause() {
        if (pendingSeek >= 0) commitSeek();
        resumed = false;
        App.MAIN.removeCallbacks(tick);
        App.MAIN.removeCallbacks(presence);
        stopPlayClock();
        if (direct && player != null && prepared) {
            boolean wasPlaying = player.isPlaying();
            try { player.pause(); } catch (Exception ignored) { }
            wantPlay = wasPlaying;
        }
        persist();
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override protected void onDestroy() {
        alive = false;
        App.MAIN.removeCallbacks(tick);
        App.MAIN.removeCallbacks(presence);
        App.MAIN.removeCallbacks(hideOverlay);
        App.MAIN.removeCallbacks(commitSeek);
        releasePlayer();
        destroyWeb();
        super.onDestroy();
    }

    @Override public void finish() {
        openGeneration++;
        autoNext.cancel();
        if (pendingSeek >= 0) commitSeek();
        persist();
        super.finish();
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
            fitSurface();
        }
    }

    // ------------------------------------------------------------ Vues

    /** Barre de progression focusable : gauche/droite pour avancer ou reculer. */
    static final class SeekView extends View {
        private float fraction; private boolean preview;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        SeekView(Context c) { super(c); setFocusable(true); setContentDescription("Position de lecture. Gauche et droite pour reculer ou avancer. OK pour mettre en pause."); }
        void set(float f, boolean p) { fraction = Math.max(0, Math.min(1, f)); preview = p; invalidate(); }
        @Override protected void onDraw(Canvas canvas) {
            float h = isFocused() ? dp(8) : dp(5), cy = getHeight() / 2f, w = getWidth();
            paint.setColor(0x55FFFFFF);
            canvas.drawRoundRect(0, cy - h / 2, w, cy + h / 2, h, h, paint);
            paint.setColor(preview ? Ui.GOLD : Ui.ACCENT);
            canvas.drawRoundRect(0, cy - h / 2, w * fraction, cy + h / 2, h, h, paint);
            if (isFocused()) { paint.setColor(0xFFFFFFFF); canvas.drawCircle(w * fraction, cy, dp(11), paint); }
        }
        @Override protected void onFocusChanged(boolean gain, int dir, android.graphics.Rect prev) { super.onFocusChanged(gain, dir, prev); invalidate(); }
    }

    /** Pointeur affiché au-dessus du lecteur intégré. */
    static final class CursorView extends View {
        float x, y;
        private boolean visible;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Runnable autoHide = this::hide;
        CursorView(Context c) { super(c); setFocusable(false); setClickable(false); }
        void center() { x = getWidth() > 0 ? getWidth() / 2f : getResources().getDisplayMetrics().widthPixels / 2f; y = getHeight() > 0 ? getHeight() / 2f : getResources().getDisplayMetrics().heightPixels / 2f; }
        boolean isShownNow() { return visible; }
        void show() { visible = true; invalidate(); removeCallbacks(autoHide); postDelayed(autoHide, 4000); }
        void hide() { visible = false; removeCallbacks(autoHide); invalidate(); }
        void move(float dx, float dy, int w, int h) {
            x = Math.max(dp(6), Math.min(w - dp(6), x + dx));
            y = Math.max(dp(6), Math.min(h - dp(6), y + dy));
            show();
        }
        @Override public boolean onTouchEvent(MotionEvent e) { return false; }
        @Override protected void onDraw(Canvas canvas) {
            if (!visible) return;
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(0x55000000);
            canvas.drawCircle(x, y, dp(17), paint);
            paint.setColor(0xFFFFFFFF);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(3));
            canvas.drawCircle(x, y, dp(14), paint);
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Ui.ACCENT);
            canvas.drawCircle(x, y, dp(5), paint);
        }
    }
}
