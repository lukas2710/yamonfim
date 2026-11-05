package com.yamonfilm.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
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
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.yamonfilm.tv.Cards.Card;
import com.yamonfilm.tv.Cards.Shelf;
import com.yamonfilm.tv.Models.Channel;
import com.yamonfilm.tv.Models.Episode;
import com.yamonfilm.tv.Models.Media;
import com.yamonfilm.tv.Models.Season;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.yamonfilm.tv.Ui.dp;

/**
 * Lecteur plein écran, piloté à la télécommande.
 * - Films et séries : flux préparé par le site (/api/playback) et lu par le lecteur natif,
 *   avec changement de source, choix de la langue, bascule automatique si un lien tombe,
 *   épisode suivant au générique. Une vision gratuite n'est comptée qu'une fois la vidéo lancée.
 * - TV en direct et vidéos directes : lecteur natif.
 * - Autres lecteurs intégrés : page web pilotée par un pointeur (secours).
 */
public final class PlayerActivity extends Activity implements App.Alive {
    private static final int MODE_NATIVE = 0, MODE_DIRECT = 1, MODE_WEB = 2;
    private static final int MAX_FAILOVERS = 4;

    private Actions.PlayerSession ps;
    private Media media;
    private int season, episode, mode;
    private boolean live, alive = true, resumed;
    private SharedPreferences prefs;

    // Vues
    private FrameLayout root, stage;
    private LinearLayout loadingBox, topBar, bottomBar, buttons, errorBox, sheet, countdown;
    private FrameLayout drawer;
    private TextView loadingTitle, loadingStatus, title, subtitle, infoPill, timeLeft, timeRight, toastView;
    private TextView errorText, errorRetry, errorSource, errorQuit, countdownText, countdownGo, countdownCancel;
    private ImageView playPause;
    private SeekView seek;

    // Lecteur natif
    private SurfaceView surface;
    private SurfaceHolder holder;
    private MediaPlayer player;
    private boolean prepared, wantPlay = true;
    private long resumeAtMs;
    private int videoW, videoH;
    private AudioManager audio;
    private AudioFocusRequest focusRequest;

    // Flux du site
    private String source = "";
    private Repo.Stream stream;
    private final List<String> excluded = new ArrayList<>();
    private String selectedEmbed = "";
    private int failovers, generation;
    private String audioLang = "";
    private long stallSince = -1;
    private Repo.Stream preparedNext;
    private String preparedNextSource = "";
    private long preparedNextAt;

    // Lecteur web (secours)
    private WebView web;
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;
    private CursorView cursor;

    // Avance / retour
    private long pendingSeek = -1;
    private int scrubRepeat;
    private long lastRepeat;

    // Suivi : vision, historique, épisodes vus, générique
    private boolean chargePending;
    private long chargeFirstPos = -1;
    private final Set<String> markedSeen = new HashSet<>();
    private long playingSince = -1, playedMs, lastSavedPosition = -1;
    private boolean ended, autoNextOffered, switching, waitingForStillWatching;
    private int autoChainCount;
    private double creditsStart = -2;
    private String creditsKey = "";

    private final Runnable hideControls = () -> { if (isPlaying() && !drawerOpen() && !sheetOpen()) showControls(false, null); };
    private final Runnable commitSeek = this::commitSeek;
    private final Runnable hideToast = () -> toastView.animate().alpha(0f).setDuration(250).start();
    private final Runnable tick = new Runnable() { @Override public void run() { onTick(); App.MAIN.postDelayed(this, 500); } };
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
        prefs = getSharedPreferences("app", MODE_PRIVATE);
        audioLang = prefs.getString("audio_lang", "fr");
        live = ps.live;
        media = ps.media;
        season = ps.season;
        episode = ps.episode;
        chargePending = ps.free;
        audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);

        root = new FrameLayout(this);
        root.setBackgroundColor(0xFF000000);
        root.setFocusable(true);
        stage = new FrameLayout(this);
        root.addView(stage, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
        buildLoading();
        buildControls();
        buildCountdown();
        buildDrawer();
        buildError();
        toastView = Ui.lines(Ui.text(this, 16, Ui.TEXT, Ui.W_MEDIUM), 2);
        toastView.setBackground(Ui.stroked(0xF2141E38, 0x26FFFFFF, 1, 18));
        toastView.setPadding(dp(24), dp(14), dp(24), dp(14));
        toastView.setAlpha(0f);
        FrameLayout.LayoutParams tp = Ui.flp(Ui.WRAP, Ui.WRAP, Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        tp.topMargin = dp(32);
        root.addView(toastView, tp);
        setContentView(root);
        open(live ? ps.url : media.rawSource(season, episode), Logic.resumeStart(ps.resumeAt) * 1000L);
    }

    // ================================================================= Ouverture

    /** Ouvre une source : le site prépare le flux si possible, sinon lecture directe ou page web. */
    private void open(String src, long resumeMs) {
        generation++;
        source = src == null ? "" : src;
        ended = false;
        autoNextOffered = false;
        waitingForStillWatching = false;
        creditsStart = -2;
        playingSince = -1;
        playedMs = 0;
        lastSavedPosition = -1;
        resumeAtMs = Math.max(0, resumeMs);
        stallSince = -1;
        hideError();
        hideSheet();
        closeDrawer();
        hideCountdown();
        if (live || Logic.isDirectVideo(source)) mode = MODE_DIRECT;
        else if (Logic.isNativePlayback(source)) mode = MODE_NATIVE;
        else mode = MODE_WEB;
        updateTitles();
        if (mode == MODE_WEB) {
            releasePlayer();
            String url = Logic.preparePlayerUrl(source);
            if (!url.isEmpty() && resumeMs >= 30_000L) url = Logic.setParam(url, "start", String.valueOf(resumeMs / 1000L));
            if (url.isEmpty()) { showError("Aucun lecteur disponible pour ce titre.", false); return; }
            showLoading("Ouverture du lecteur…");
            startWeb(url);
            return;
        }
        destroyWeb();
        if (mode == MODE_DIRECT) {
            showLoading(live ? "Connexion à la chaîne…" : "Chargement de la vidéo…");
            startMedia(live ? source : source, resumeMs, live);
            return;
        }
        resolve(resumeMs, "Recherche du meilleur flux…");
    }

    /** Demande au site un flux lisible (en excluant les sources déjà tombées). */
    private void resolve(long resumeMs, String status) {
        final int gen = ++generation;
        showLoading(status);
        final String src = source;
        final List<String> skip = new ArrayList<>(excluded);
        final String chosen = selectedEmbed;
        // Épisode suivant préparé en avance (moins de 45 secondes) : départ immédiat.
        if (skip.isEmpty() && chosen.isEmpty() && preparedNext != null && src.equals(preparedNextSource) && SystemClock.elapsedRealtime() - preparedNextAt < 45000) {
            Repo.Stream ready = preparedNext;
            preparedNext = null;
            useStream(ready, resumeMs);
            return;
        }
        App.io(this, () -> App.repo().playback(src, skip, chosen), (st, e) -> {
            if (gen != generation) return;
            if (e instanceof Api.AuthExpired) { showError("Ta session a expiré. Reconnecte-toi dans l'application.", false); return; }
            if (e != null) { showError(App.message(e), false); return; }
            if (st.error != null) {
                // Le site indique les sources essayées : on les écarte et on continue la recherche.
                int before = excluded.size();
                for (String a : st.attempted) if (!excluded.contains(a)) excluded.add(a);
                if (!chosen.isEmpty()) { selectedEmbed = ""; if (!excluded.contains(chosen)) excluded.add(chosen); resolve(resumeMs, "Cette source est indisponible : retour au choix automatique…"); return; }
                if (st.hasMore && excluded.size() > before && failovers < MAX_FAILOVERS) { failovers++; resolve(resumeMs, "Recherche d'une autre source disponible…"); return; }
                showError(st.error, false);
                return;
            }
            useStream(st, resumeMs);
        });
    }

    private void useStream(Repo.Stream st, long resumeMs) {
        stream = st;
        // Langue préférée (VF par défaut), comme sur le site.
        String chosenLang = "";
        if (!st.audioTracks.isEmpty()) {
            String[] match = null;
            for (String[] t : st.audioTracks) if (Logic.audioLanguage(t[2]).equals(Logic.audioLanguage(audioLang))) { match = t; break; }
            if (match == null) for (String[] t : st.audioTracks) if ("fr".equals(Logic.audioLanguage(t[2]))) { match = t; break; }
            if (match == null) match = st.audioTracks.get(0);
            chosenLang = match[2];
        }
        currentTrackLang = chosenLang;
        updateInfoPill();
        updateOptionButtons();
        startMedia(streamUrl(st, chosenLang), resumeMs, false);
    }

    private String currentTrackLang = "";

    /** Adresse finale : profil TV du proxy (flux compatibles TV) et piste audio choisie. */
    private static String streamUrl(Repo.Stream st, String lang) {
        StringBuilder u = new StringBuilder(st.url);
        u.append(st.url.contains("?") ? "&" : "?").append("profile=android-tv");
        if (lang != null && !lang.isEmpty()) u.append("&audio=").append(Api.enc(lang));
        return u.toString();
    }

    /** Une source est tombée : on passe automatiquement à la suivante. */
    private void failover(long resumeMs, String reason) {
        if (mode != MODE_NATIVE) { showError(reason, false); return; }
        if (stream != null && stream.embed != null && !stream.embed.isEmpty() && !excluded.contains(stream.embed)) excluded.add(stream.embed);
        if (!selectedEmbed.isEmpty()) { if (!excluded.contains(selectedEmbed)) excluded.add(selectedEmbed); selectedEmbed = ""; }
        if (failovers < MAX_FAILOVERS) {
            failovers++;
            releasePlayer();
            resolve(resumeMs, "Flux interrompu : recherche d'une autre source…");
        } else showError("Ce titre n'est disponible sur aucune source pour le moment. Réessaie dans un instant.", stream != null && !stream.alternatives.isEmpty());
    }

    // ================================================================= Lecteur natif

    private void startMedia(String url, long resumeMs, boolean liveStream) {
        releasePlayer();
        resumeAtMs = resumeMs;
        prepared = false;
        wantPlay = true;
        stallSince = -1;
        if (surface == null) {
            surface = new SurfaceView(this);
            surface.getHolder().addCallback(new SurfaceHolder.Callback() {
                @Override public void surfaceCreated(SurfaceHolder h) { holder = h; if (player != null) try { player.setDisplay(h); } catch (Exception ignored) { } }
                @Override public void surfaceChanged(SurfaceHolder h, int f, int w, int hh) { }
                @Override public void surfaceDestroyed(SurfaceHolder h) { holder = null; if (player != null) try { player.setDisplay(null); } catch (Exception ignored) { } }
            });
            stage.addView(surface, 0, Ui.flp(Ui.MATCH, Ui.MATCH, Gravity.CENTER));
        }
        surface.setVisibility(View.VISIBLE);
        final int gen = generation;
        MediaPlayer mp = new MediaPlayer();
        player = mp;
        try {
            mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MOVIE).build());
            Map<String, String> headers = new HashMap<>();
            headers.put("User-Agent", Api.USER_AGENT);
            if (liveStream) headers.put("Referer", "https://iptv-org.github.io/");
            mp.setDataSource(this, Uri.parse(url), headers);
            if (holder != null) mp.setDisplay(holder);
            mp.setScreenOnWhilePlaying(true);
            mp.setOnPreparedListener(p -> {
                if (p != player || gen != generation) return;
                prepared = true;
                hideLoading();
                long duration = safeDuration();
                if (!live && resumeAtMs > 0 && duration > 0 && resumeAtMs < duration - 5000) p.seekTo((int) resumeAtMs);
                if (wantPlay) play();
                updatePlayPause();
                if (stream != null && failovers > 0) toast(stream.height > 0 ? "Nouvelle source : " + stream.height + "p · " + providerName(stream.provider) : "Lecture reprise sur une autre source");
                showControls(true, null);
                fetchCredits();
            });
            mp.setOnVideoSizeChangedListener((p, w, h) -> { videoW = w; videoH = h; fitSurface(); });
            mp.setOnInfoListener((p, what, extra) -> {
                if (what == MediaPlayer.MEDIA_INFO_BUFFERING_START) { showLoading("Mise en mémoire…"); stallSince = SystemClock.elapsedRealtime(); }
                else if (what == MediaPlayer.MEDIA_INFO_BUFFERING_END || what == MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START) { hideLoading(); stallSince = -1; }
                return false;
            });
            mp.setOnCompletionListener(p -> { if (p == player) onEnded(); });
            mp.setOnErrorListener((p, what, extra) -> {
                if (p != player) return true;
                if (live) showError("Cette chaîne est indisponible pour le moment. Essaie une autre chaîne.", false);
                else failover(currentPositionForRetry(), "Ce flux est indisponible.");
                return true;
            });
            mp.prepareAsync();
        } catch (Exception e) {
            if (live) showError("Cette chaîne ne peut pas être lue sur cette télévision.", false);
            else failover(resumeMs, "Ce flux ne peut pas être lu sur cette télévision.");
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
        if (p.width != tw || p.height != th) { p.width = tw; p.height = th; p.gravity = Gravity.CENTER; surface.setLayoutParams(p); }
    }

    private long safeDuration() { try { return prepared && !live ? Math.max(0, player.getDuration()) : 0; } catch (Exception e) { return 0; } }
    private long safePosition() { try { return prepared ? Math.max(0, player.getCurrentPosition()) : 0; } catch (Exception e) { return 0; } }
    private boolean isPlaying() { try { return player != null && prepared && player.isPlaying(); } catch (Exception e) { return false; } }
    private long currentPositionForRetry() { long p = safePosition(); return p > 0 ? p : lastSavedPosition > 0 ? lastSavedPosition * 1000 : resumeAtMs; }

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
        App.MAIN.removeCallbacks(hideControls);
    }

    private void togglePause() {
        if (mode == MODE_WEB) { if (root.getWidth() > 0) tapAt(root.getWidth() / 2f, root.getHeight() / 2f); return; }
        if (isPlaying()) pause(); else play();
        showControls(true, playPause);
    }

    private void updatePlayPause() {
        playPause.setImageResource(isPlaying() || (!prepared && wantPlay) ? R.drawable.ic_pause : R.drawable.ic_play);
    }

    private void stopPlayClock() { if (playingSince >= 0) { playedMs += SystemClock.elapsedRealtime() - playingSince; playingSince = -1; } }

    private void releasePlayer() {
        if (player != null) {
            MediaPlayer p = player;
            player = null;
            prepared = false;
            try { p.reset(); } catch (Exception ignored) { }
            p.release();
        }
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

    // ================================================================= Langue et source

    /** Change la langue sans recharger toute la recherche : même flux, autre piste. */
    private void chooseAudio(String lang) {
        if (stream == null || lang.equals(currentTrackLang)) return;
        currentTrackLang = lang;
        audioLang = lang;
        prefs.edit().putString("audio_lang", lang).apply();
        long pos = safePosition();
        updateOptionButtons();
        showLoading("Changement de langue…");
        startMedia(streamUrl(stream, lang), pos, false);
        toast("Langue : " + audioLabelFor(lang));
    }

    /** Change de lien en gardant la position. "" = choix automatique. */
    private void chooseSource(String embed) {
        long pos = currentPositionForRetry();
        selectedEmbed = embed;
        if (!embed.isEmpty()) excluded.remove(embed);
        failovers = 0;
        releasePlayer();
        resolve(pos, embed.isEmpty() ? "Recherche du meilleur flux…" : "Changement de source…");
    }

    private String audioLabelFor(String lang) {
        if (stream != null) for (int i = 0; i < stream.audioTracks.size(); i++) {
            String[] t = stream.audioTracks.get(i);
            if (t[2].equals(lang)) return Logic.audioLabel(t[1], t[2], i);
        }
        return Logic.audioLabel("", lang, 0);
    }

    private static String providerName(String provider) {
        if (provider == null || provider.isEmpty()) return "source";
        if (provider.startsWith("api.") || provider.contains("moviez")) return "Moviez";
        if (provider.contains("embedorigin")) return "EmbedOrigin";
        return provider;
    }

    private void updateInfoPill() {
        if (stream == null) { infoPill.setVisibility(View.GONE); return; }
        String q = stream.height >= 2000 ? "4K" : stream.height >= 1000 ? "Full HD · " + stream.height + "p" : stream.height >= 700 ? "HD · " + stream.height + "p" : stream.height > 0 ? stream.height + "p" : "";
        infoPill.setText((q.isEmpty() ? "" : q + "  ·  ") + providerName(stream.provider));
        infoPill.setVisibility(View.VISIBLE);
    }

    // ================================================================= Lecteur web (secours)

    @SuppressLint("SetJavaScriptEnabled")
    private void startWeb(String url) {
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
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return request.isForMainFrame(); }
                @Override public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                    if (view == web) {
                        stage.removeView(web);
                        web.destroy();
                        web = null;
                        if (cursor != null) { root.removeView(cursor); cursor = null; }
                        customView = null;
                        showError("Le lecteur s'est arrêté. Appuie sur Réessayer pour le relancer.", false);
                    }
                    return true;
                }
                @Override public void onPageFinished(WebView view, String u) {
                    App.MAIN.postDelayed(() -> { if (alive) hideLoading(); }, 1200);
                    if (playingSince < 0 && resumed) playingSince = SystemClock.elapsedRealtime();
                    fetchCredits();
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
            root.addView(cursor, root.indexOfChild(topBar), new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
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
            toast("Flèches : déplacer le pointeur · OK : cliquer · Retour : menu de lecture");
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
    }

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

    // ================================================================= Interface

    private void buildLoading() {
        loadingBox = Ui.column(this);
        loadingBox.setGravity(Gravity.CENTER_HORIZONTAL);
        loadingBox.addView(new MainActivity.Spinner(this), Ui.lp(dp(64), dp(64)));
        loadingTitle = Ui.lines(Ui.text(this, 22, Ui.TEXT, Ui.W_SEMIBOLD), 2);
        loadingTitle.setGravity(Gravity.CENTER);
        loadingBox.addView(loadingTitle, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(22), 0, 0));
        loadingStatus = Ui.lines(Ui.text(this, 15, Ui.MUTED, Ui.W_REGULAR), 2);
        loadingStatus.setGravity(Gravity.CENTER);
        loadingBox.addView(loadingStatus, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(8), 0, 0));
        root.addView(loadingBox, Ui.flp(Ui.WRAP, Ui.WRAP, Gravity.CENTER));
    }

    private void showLoading(String status) {
        loadingStatus.setText(status);
        loadingBox.setVisibility(View.VISIBLE);
        loadingBox.animate().cancel();
        loadingBox.setAlpha(1f);
    }

    private void hideLoading() { loadingBox.setVisibility(View.GONE); }

    private void buildControls() {
        // Bandeau du haut : titre, épisode, qualité et source.
        topBar = Ui.row(this);
        topBar.setGravity(Gravity.TOP);
        topBar.setBackground(Ui.gradient(GradientDrawable.Orientation.TOP_BOTTOM, 0xE6000000, 0x80000000, 0x00000000));
        topBar.setPadding(dp(56), dp(34), dp(56), dp(70));
        LinearLayout titles = Ui.column(this);
        title = Ui.lines(Ui.text(this, 28, Ui.TEXT, Ui.W_BOLD), 1);
        subtitle = Ui.lines(Ui.text(this, 16, 0xFFD0D3DA, Ui.W_MEDIUM), 1);
        titles.addView(title);
        titles.addView(subtitle, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(6), 0, 0));
        topBar.addView(titles, new LinearLayout.LayoutParams(0, Ui.WRAP, 1f));
        infoPill = Ui.text(this, 13, Ui.TEXT, Ui.W_SEMIBOLD);
        infoPill.setBackground(Ui.stroked(0x33000000, 0x40FFFFFF, 1, 14));
        infoPill.setPadding(dp(14), dp(7), dp(14), dp(7));
        infoPill.setVisibility(View.GONE);
        topBar.addView(infoPill);
        root.addView(topBar, Ui.flp(Ui.MATCH, Ui.WRAP, Gravity.TOP));

        // Bandeau du bas : progression et commandes.
        bottomBar = Ui.column(this);
        bottomBar.setBackground(Ui.gradient(GradientDrawable.Orientation.BOTTOM_TOP, 0xF2000000, 0xA6000000, 0x00000000));
        bottomBar.setPadding(dp(56), dp(80), dp(56), dp(34));
        Ui.noClip(bottomBar);
        LinearLayout seekRow = Ui.row(this);
        seekRow.setGravity(Gravity.CENTER_VERTICAL);
        timeLeft = Ui.text(this, 15, Ui.TEXT, Ui.W_SEMIBOLD);
        timeRight = Ui.text(this, 15, Ui.MUTED, Ui.W_MEDIUM);
        seek = new SeekView(this);
        seekRow.addView(timeLeft, Ui.lp(dp(84), Ui.WRAP));
        seekRow.addView(seek, new LinearLayout.LayoutParams(0, dp(34), 1f));
        timeRight.setGravity(Gravity.END);
        seekRow.addView(timeRight, Ui.lp(dp(84), Ui.WRAP));
        bottomBar.addView(seekRow, Ui.lp(Ui.MATCH, Ui.WRAP, 0, 0, 0, dp(18)));
        buttons = Ui.row(this);
        buttons.setGravity(Gravity.CENTER_VERTICAL);
        Ui.noClip(buttons);
        bottomBar.addView(buttons);
        root.addView(bottomBar, Ui.flp(Ui.MATCH, Ui.WRAP, Gravity.BOTTOM));
        playPause = Ui.iconButton(this, R.drawable.ic_pause, 58);
        playPause.setOnClickListener(v -> togglePause());
        topBar.setVisibility(View.GONE);
        bottomBar.setVisibility(View.GONE);
    }

    private TextView optAudio, optSource;

    /** Boutons selon le mode : lecture, ±10 s, épisodes, suivant, langue, source (ou chaînes en direct). */
    private void rebuildButtons() {
        buttons.removeAllViews();
        addControl(playPause);
        if (mode == MODE_WEB) {
            addControl(pill("Pointeur", R.drawable.ic_pointer, () -> { showControls(false, null); if (cursor != null) cursor.show(); }));
        } else if (!live) {
            ImageView rew = Ui.iconButton(this, R.drawable.ic_rewind, 50);
            rew.setOnClickListener(v -> seekBy(-10000, true));
            ImageView fwd = Ui.iconButton(this, R.drawable.ic_forward, 50);
            fwd.setOnClickListener(v -> seekBy(10000, true));
            addControl(rew);
            addControl(fwd);
        }
        if (live) {
            addControl(pill("Chaîne précédente", R.drawable.ic_prev, () -> zap(-1)));
            addControl(pill("Chaîne suivante", R.drawable.ic_next, () -> zap(1)));
            addControl(pill("Chaînes", R.drawable.ic_list, this::showSheet));
        } else if (media.hasEpisodes()) {
            addControl(pill("Épisodes", R.drawable.ic_list, this::showSheet));
            if (media.next(season, episode) != null) addControl(pill("Épisode suivant", R.drawable.ic_next, () -> step(1)));
        }
        optAudio = null; optSource = null;
        if (mode == MODE_NATIVE) {
            optAudio = pill("Langue", R.drawable.ic_live, this::showAudioOptions);
            optSource = pill("Source", R.drawable.ic_refresh, this::showSourceOptions);
            addControl(optAudio);
            addControl(optSource);
        }
        if (mode == MODE_WEB) addControl(pill("Recharger", R.drawable.ic_refresh, () -> open(source, 0)));
        updateOptionButtons();
    }

    private void addControl(View v) {
        if (v.getParent() instanceof LinearLayout) ((LinearLayout) v.getParent()).removeView(v);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(Ui.WRAP, Ui.WRAP);
        if (v instanceof ImageView) { p.width = v.getLayoutParams() != null ? v.getLayoutParams().width : dp(50); p.height = p.width; }
        p.rightMargin = dp(14);
        p.gravity = Gravity.CENTER_VERTICAL;
        buttons.addView(v, p);
    }

    private TextView pill(String label, int icon, Runnable action) {
        TextView b = Ui.button(this, label, icon, Ui.STYLE_GHOST);
        b.setOnClickListener(v -> { action.run(); scheduleHide(); });
        return b;
    }

    private void updateOptionButtons() {
        if (optAudio != null) {
            boolean several = stream != null && stream.audioTracks.size() > 1;
            optAudio.setText(currentTrackLang.isEmpty() ? "Audio d'origine" : audioLabelFor(currentTrackLang));
            optAudio.setAlpha(several ? 1f : 0.55f);
        }
        if (optSource != null) {
            int n = stream == null ? 0 : stream.alternatives.size();
            optSource.setText(selectedEmbed.isEmpty() ? (n > 1 ? "Source · auto (" + n + ")" : "Source · auto") : "Source · " + (indexOfAlt(selectedEmbed) + 1));
        }
    }

    private int indexOfAlt(String embed) {
        if (stream != null) for (int i = 0; i < stream.alternatives.size(); i++) if (stream.alternatives.get(i)[0].equals(embed)) return i;
        return -1;
    }

    private void updateTitles() {
        if (live) {
            Channel c = ps.channels.get(ps.channel);
            title.setText(c.name);
            subtitle.setText("EN DIRECT  ·  " + c.category + "  ·  chaîne " + (ps.channel + 1) + " / " + ps.channels.size());
            loadingTitle.setText(c.name);
        } else {
            title.setText(media.title);
            Episode ep = media.episode(season, episode);
            if (media.hasEpisodes() && ep != null) {
                String s = "Saison " + media.seasons.get(season).number + "  ·  Épisode " + ep.number + (ep.title.isEmpty() ? "" : "  —  " + ep.title);
                subtitle.setText(s);
                loadingTitle.setText(media.title + "\nS" + media.seasons.get(season).number + " · É" + ep.number);
            } else {
                subtitle.setText(media.isSeries() ? "Série" : "Film" + (media.year > 0 ? "  ·  " + media.year : ""));
                loadingTitle.setText(media.title);
            }
        }
        boolean seekable = !live && mode != MODE_WEB;
        seek.setVisibility(seekable ? View.VISIBLE : View.INVISIBLE);
        timeLeft.setVisibility(seekable ? View.VISIBLE : View.INVISIBLE);
        timeRight.setVisibility(seekable ? View.VISIBLE : View.INVISIBLE);
        if (mode != MODE_NATIVE) { stream = null; infoPill.setVisibility(View.GONE); }
        rebuildButtons();
    }

    private boolean controlsVisible() { return bottomBar.getVisibility() == View.VISIBLE; }

    /** Affiche ou masque les commandes (fondu doux) ; `focus` reçoit la sélection. */
    private void showControls(boolean show, View focus) {
        if (show) {
            for (View v : new View[]{topBar, bottomBar}) {
                v.animate().cancel();
                if (v.getVisibility() != View.VISIBLE) { v.setVisibility(View.VISIBLE); v.setAlpha(0f); }
                v.animate().alpha(1f).setDuration(180).start();
            }
            updateProgressUi();
            View target = focus != null ? focus : MainActivity.isInside(getCurrentFocus(), bottomBar) ? null : (seek.getVisibility() == View.VISIBLE ? seek : playPause);
            if (target != null) target.requestFocus();
            if (cursor != null) cursor.hide();
            scheduleHide();
        } else if (controlsVisible()) {
            for (View v : new View[]{topBar, bottomBar}) {
                v.animate().cancel();
                v.animate().alpha(0f).setDuration(200).withEndAction(() -> v.setVisibility(View.GONE)).start();
            }
            if (web != null) web.requestFocus(); else root.requestFocus();
        }
    }

    private void scheduleHide() {
        App.MAIN.removeCallbacks(hideControls);
        App.MAIN.postDelayed(hideControls, 4500);
    }

    private void toast(String text) {
        toastView.setText(text);
        toastView.removeCallbacks(hideToast);
        toastView.animate().cancel();
        toastView.setAlpha(1f);
        toastView.postDelayed(hideToast, 4000);
    }

    // ------------------------------------------------------------ Tiroir d'options (langue, source)

    private void buildDrawer() {
        drawer = new FrameLayout(this);
        drawer.setBackground(Ui.gradient(GradientDrawable.Orientation.RIGHT_LEFT, 0xF5060A15, 0xE6060A15, 0x00060A15));
        drawer.setVisibility(View.GONE);
        root.addView(drawer, new FrameLayout.LayoutParams(Ui.MATCH, Ui.MATCH));
    }

    private boolean drawerOpen() { return drawer.getVisibility() == View.VISIBLE; }

    /** Liste d'options sur la droite : la sélection courante est cochée. */
    private void showOptions(String heading, String hint, List<String[]> options, String current, OptionChoice choice) {
        drawer.removeAllViews();
        LinearLayout col = Ui.column(this);
        col.setPadding(dp(36), dp(48), dp(48), dp(40));
        Ui.noClip(col);
        col.addView(Ui.label(this, heading, 28, Ui.TEXT, Ui.W_BOLD));
        if (hint != null) {
            TextView h = Ui.label(this, hint, 14, Ui.MUTED, Ui.W_REGULAR);
            h.setLineSpacing(0, 1.3f);
            col.addView(h, Ui.lp(dp(420), Ui.WRAP, 0, dp(8), 0, dp(10)));
        }
        View focus = null;
        LinearLayout list = Ui.column(this);
        Ui.noClip(list);
        for (String[] o : options) {
            boolean on = o[0].equals(current);
            TextView b = Ui.button(this, (on ? "✓  " : "") + o[1], 0, on ? Ui.STYLE_NORMAL : Ui.STYLE_GHOST);
            b.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
            b.setOnClickListener(v -> { closeDrawer(); choice.chosen(o[0]); });
            list.addView(b, Ui.lp(dp(440), Ui.WRAP, 0, dp(12), 0, 0));
            if (on || focus == null) focus = b;
            if (on) focus = b;
        }
        ScrollView scroll = new ScrollView(this);
        scroll.setVerticalScrollBarEnabled(false);
        Ui.noClip(scroll);
        scroll.addView(list);
        col.addView(scroll, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(6), 0, 0));
        drawer.addView(col, Ui.flp(Ui.WRAP, Ui.MATCH, Gravity.END));
        showControls(false, null);
        drawer.setVisibility(View.VISIBLE);
        drawer.setAlpha(0f);
        col.setTranslationX(dp(60));
        drawer.animate().alpha(1f).setDuration(180).start();
        col.animate().translationX(0).setInterpolator(new DecelerateInterpolator(1.6f)).setDuration(220).start();
        if (web != null) web.setFocusable(false);
        final View f = focus;
        if (f != null) drawer.post(f::requestFocus);
        if (cursor != null) cursor.hide();
    }

    interface OptionChoice { void chosen(String value); }

    private void closeDrawer() {
        if (!drawerOpen()) return;
        drawer.setVisibility(View.GONE);
        drawer.removeAllViews();
        if (web != null) { web.setFocusable(true); web.requestFocus(); } else root.requestFocus();
    }

    private void showAudioOptions() {
        if (stream == null) return;
        if (stream.audioTracks.size() < 2) { toast(stream.audioTracks.isEmpty() ? "Cette vidéo n'a qu'une piste audio (audio d'origine)." : "Cette vidéo n'a qu'une langue : " + audioLabelFor(currentTrackLang) + "."); return; }
        List<String[]> opts = new ArrayList<>();
        List<String[]> tracks = new ArrayList<>(stream.audioTracks);
        // Le français en premier, comme sur le site.
        Collections.sort(tracks, (a, b) -> Boolean.compare("fr".equals(Logic.audioLanguage(b[2])), "fr".equals(Logic.audioLanguage(a[2]))));
        for (int i = 0; i < tracks.size(); i++) opts.add(new String[]{tracks.get(i)[2], Logic.audioLabel(tracks.get(i)[1], tracks.get(i)[2], i)});
        showOptions("Langue audio", "La langue choisie est retenue pour les prochaines vidéos.", opts, currentTrackLang, this::chooseAudio);
    }

    private void showSourceOptions() {
        if (stream == null) return;
        List<String[]> opts = new ArrayList<>();
        opts.add(new String[]{"", "Automatique · meilleure qualité vérifiée"});
        for (int i = 0; i < stream.alternatives.size(); i++) {
            String[] a = stream.alternatives.get(i);
            int h = Integer.parseInt(a[2]);
            String host;
            try { host = "Lien ajouté".equals(a[1]) ? a[1] : Uri.parse(a[0]).getHost(); } catch (Exception e) { host = a[1]; }
            opts.add(new String[]{a[0], "Source " + (i + 1) + "  ·  " + (h > 0 ? h + "p" : "qualité inconnue") + "  ·  " + providerName(host)});
        }
        showOptions("Source vidéo", "Si l'image coupe ou ne correspond pas, essaie une autre source : la lecture reprend au même endroit.", opts, selectedEmbed, this::chooseSource);
    }

    // ------------------------------------------------------------ Épisodes / chaînes (panneau du bas)

    private boolean sheetOpen() { return sheet != null && sheet.getVisibility() == View.VISIBLE; }

    private void showSheet() {
        if (!live && (media == null || !media.hasEpisodes())) return;
        showControls(false, null);
        if (cursor != null) cursor.hide();
        if (sheet == null) {
            sheet = Ui.column(this);
            sheet.setBackground(Ui.gradient(GradientDrawable.Orientation.BOTTOM_TOP, 0xFA060A15, 0xEB060A15, 0x00060A15));
            sheet.setPadding(dp(48), dp(80), dp(20), dp(30));
            Ui.noClip(sheet);
            root.addView(sheet, Ui.flp(Ui.MATCH, Ui.WRAP, Gravity.BOTTOM));
        }
        sheet.removeAllViews();
        if (live) {
            Shelf shelf = new Shelf(this, "Chaînes");
            for (int i = 0; i < ps.channels.size(); i++) {
                final int index = i;
                Channel c = ps.channels.get(i);
                Card card = new Card(this, 170, 110, true, true);
                card.image.setScaleType(ImageView.ScaleType.FIT_CENTER);
                card.image.setPadding(dp(24), dp(12), dp(24), dp(34));
                card.caption(i == ps.channel ? "EN COURS" : "", c.name);
                card.bindImage(c.logo, "");
                card.setOnClickListener(v -> { hideSheet(); ps.channel = index; open(c.url, 0); });
                shelf.add(card, 16);
            }
            shelf.lastIndex = ps.channel;
            sheet.addView(shelf);
        } else renderEpisodeSheet(season);
        sheet.setVisibility(View.VISIBLE);
        sheet.setAlpha(0f);
        sheet.animate().alpha(1f).setDuration(180).start();
        if (web != null) web.setFocusable(false);
        sheet.post(() -> {
            Shelf last = (Shelf) sheet.getChildAt(sheet.getChildCount() - 1);
            last.focusLast();
            View item = last.item(last.lastIndex);
            if (item != null) last.scroll.reveal(item, false);
        });
    }

    private void renderEpisodeSheet(int s) {
        sheet.removeAllViews();
        if (media.seasons.size() > 1) {
            Shelf seasons = new Shelf(this, "Saisons");
            for (int i = 0; i < media.seasons.size(); i++) {
                final int index = i;
                TextView chip = Ui.chip(this, "Saison " + media.seasons.get(i).number);
                chip.setActivated(i == s);
                chip.setLayoutParams(new LinearLayout.LayoutParams(Ui.WRAP, Ui.WRAP));
                chip.setOnClickListener(v -> { renderEpisodeSheet(index); sheet.post(() -> ((Shelf) sheet.getChildAt(1)).focus(0)); });
                seasons.add(chip, 10);
            }
            seasons.lastIndex = s;
            sheet.addView(seasons);
        }
        Season se = media.seasons.get(s);
        Shelf eps = new Shelf(this, "Saison " + se.number + "  ·  " + se.episodes.size() + " épisodes");
        for (int i = 0; i < se.episodes.size(); i++) {
            final int index = i;
            Episode ep = se.episodes.get(i);
            Card card = new Card(this, 240, 135, true, true);
            boolean current = s == season && i == episode;
            card.caption(current ? "EN COURS" : "ÉPISODE " + ep.number + (ep.runtime > 0 ? " · " + ep.runtime + " MIN" : ""), ep.label());
            String img = !ep.still.isEmpty() ? ep.still : !se.poster.isEmpty() ? se.poster : media.image();
            card.bindImage(Logic.tmdbSize(img, "w500"), "");
            if (markedSeen.contains(Logic.epKey(s, i))) card.badge("✓ VU", 0xE6168A45);
            if (current) card.badge("▶ EN COURS", Ui.ACCENT);
            card.setOnClickListener(v -> { hideSheet(); if (!current) playEpisode(s, index); });
            eps.add(card, 16);
        }
        eps.lastIndex = s == season ? episode : 0;
        sheet.addView(eps);
    }

    private void hideSheet() {
        if (!sheetOpen()) return;
        sheet.setVisibility(View.GONE);
        sheet.removeAllViews();
        if (web != null) { web.setFocusable(true); web.requestFocus(); if (cursor != null) cursor.show(); }
        else root.requestFocus();
    }

    // ------------------------------------------------------------ Épisode suivant (générique)

    private void buildCountdown() {
        countdown = Ui.column(this);
        countdown.setBackground(Ui.stroked(0xF2121419, 0x33FFFFFF, 1, 22));
        countdown.setPadding(dp(26), dp(20), dp(26), dp(20));
        Ui.noClip(countdown);
        countdownText = Ui.label(this, "", 16, Ui.TEXT, Ui.W_SEMIBOLD);
        countdown.addView(countdownText);
        LinearLayout row = Ui.row(this);
        Ui.noClip(row);
        countdownGo = Ui.button(this, "Lancer maintenant", R.drawable.ic_next, Ui.STYLE_PRIMARY);
        countdownGo.setOnClickListener(v -> {
            if (waitingForStillWatching) {
                waitingForStillWatching = false;
                autoChainCount = 0;
                autoNextOffered = false;
                hideCountdown();
                goNext(false);
            } else {
                autoNextOffered = true;
                hideCountdown();
                goNext(false);
            }
        });
        countdownCancel = Ui.button(this, "Annuler", 0, Ui.STYLE_GHOST);
        countdownCancel.setOnClickListener(v -> {
            if (waitingForStillWatching) {
                waitingForStillWatching = false;
                autoChainCount = 0;
                hideCountdown();
                finish();
            } else {
                autoNextOffered = true;
                hideCountdown();
            }
        });
        row.addView(countdownGo);
        row.addView(countdownCancel, Ui.lp(Ui.WRAP, Ui.WRAP, dp(12), 0, 0, 0));
        countdown.addView(row, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(14), 0, 0));
        countdown.setVisibility(View.GONE);
        FrameLayout.LayoutParams p = Ui.flp(Ui.WRAP, Ui.WRAP, Gravity.BOTTOM | Gravity.END);
        p.setMargins(0, 0, dp(56), dp(56));
        root.addView(countdown, p);
    }

    private void showCountdown(int seconds) {
        if (waitingForStillWatching) return;
        int[] next = media.next(season, episode);
        Episode ep = next == null ? null : media.episode(next[0], next[1]);
        countdownGo.setText("Lancer maintenant");
        countdownCancel.setText("Annuler");
        countdownText.setText("Épisode suivant dans " + seconds + " s" + (ep != null ? "\nS" + media.seasons.get(next[0]).number + " · É" + ep.number + (ep.title.isEmpty() ? "" : " — " + ep.title) : ""));
        if (countdown.getVisibility() != View.VISIBLE) {
            countdown.setVisibility(View.VISIBLE);
            countdown.setAlpha(0f);
            countdown.setTranslationY(dp(20));
            countdown.animate().alpha(1f).translationY(0).setDuration(220).start();
            if (!controlsVisible() && !drawerOpen() && !sheetOpen()) countdownGo.requestFocus();
        }
    }

    private void hideCountdown() {
        waitingForStillWatching = false;
        if (countdown.getVisibility() != View.VISIBLE) return;
        boolean had = MainActivity.isInside(getCurrentFocus(), countdown);
        countdown.setVisibility(View.GONE);
        if (had) root.requestFocus();
    }

    private void goNext(boolean automatic) {
        if (live || media == null) return;
        if (automatic && autoChainCount >= 3) {
            autoNextOffered = true;
            showStillWatching();
            return;
        }
        if (automatic) autoChainCount++;
        else autoChainCount = 0;
        // Passer à la suite depuis le générique compte comme vu, quel que soit le pourcentage.
        if (ended || automatic || watchedEnough(safePosition() / 1000.0, safeDuration() / 1000.0)) markSeen();
        step(1, automatic);
    }

    private void showStillWatching() {
        waitingForStillWatching = true;
        countdownText.setText("Tu es toujours là ?\nTu as enchaîné plusieurs épisodes.");
        countdownGo.setText("Continuer");
        countdownCancel.setText("Arrêter");
        if (countdown.getVisibility() != View.VISIBLE) {
            countdown.setVisibility(View.VISIBLE);
            countdown.setAlpha(0f);
            countdown.setTranslationY(dp(20));
            countdown.animate().alpha(1f).translationY(0).setDuration(220).start();
        }
        countdownGo.requestFocus();
    }

    /** Début du générique (site : /api/episode-credits) ; sans repère, 30 s avant la fin. */
    private long durationForProgress() {
        long duration = safeDuration();
        if (duration > 0 || media == null) return duration;
        int minutes = media.runtime;
        if (media.hasEpisodes()) {
            Models.Episode ep = media.episode(season, episode);
            if (ep != null && ep.runtime > 0) minutes = ep.runtime;
        }
        return minutes > 0 ? minutes * 60_000L : 0;
    }

    private long webPosition() {
        long elapsed = playedMs + (playingSince >= 0 ? SystemClock.elapsedRealtime() - playingSince : 0);
        long duration = durationForProgress();
        return duration > 0 ? Math.min(elapsed, duration) : elapsed;
    }

    private void fetchCredits() {
        if (live || media == null || !media.hasEpisodes()) return;
        final double duration = durationForProgress() / 1000.0;
        if (duration < 300) { creditsStart = -1; return; }
        final String key = season + ":" + episode + ":" + Math.round(duration);
        if (key.equals(creditsKey) && creditsStart > -2) return;
        creditsKey = key;
        final Media m = media; final int s = season, e = episode; final int gen = generation;
        App.io(this, () -> App.repo().creditsStart(m, s, e, duration), (start, err) -> {
            if (gen == generation && key.equals(creditsKey)) creditsStart = start == null ? -1 : start;
        });
    }

    // ================================================================= Épisodes et chaînes

    private void step(int direction) {
        step(direction, false);
    }

    private void step(int direction, boolean automatic) {
        if (live) { zap(direction); return; }
        if (!automatic) autoChainCount = 0;
        int[] target = direction > 0 ? media.next(season, episode) : media.previous(season, episode);
        if (target == null) { toast(direction > 0 ? "C'est le dernier épisode." : "C'est le premier épisode."); return; }
        playEpisode(target[0], target[1]);
    }

    /** Changement d'épisode : même règle que le site (vérification du quota, vision comptée au démarrage). */
    private void playEpisode(int s, int e) {
        if (switching) return;
        final String src = media.rawSource(s, e);
        if (src.isEmpty()) { toast("Aucun lecteur disponible pour cet épisode."); return; }
        switching = true;
        persist();
        showLoading("Vérification de ton accès…");
        App.io(this, () -> App.repo().reserveViewing(), (access, error) -> {
            switching = false;
            if (error != null) { hideLoading(); toast(App.message(error)); return; }
            if (!access.allowed) { hideLoading(); showQuotaReached(); return; }
            chargePending = false;
            ps.unlimited = access.vip;
            startEpisode(s, e, src);
        });
    }

    private void startEpisode(int s, int e, String src) {
        season = s; episode = e;
        excluded.clear();
        selectedEmbed = "";
        failovers = 0;
        chargeFirstPos = -1;
        final Media m = media;
        App.repo().enqueue(() -> App.repo().saveHistory(m, s, e, 0, 0));
        open(src, 0);
    }

    private void showQuotaReached() {
        releasePlayer();
        destroyWeb();
        showError("Tes 5 visions gratuites de la semaine sont épuisées. Passe au VIP (sur ton téléphone ou ton ordinateur) pour regarder sans limite, ou attends la remise à zéro du dimanche.", false);
        errorRetry.setText("Découvrir le VIP");
        errorRetry.setOnClickListener(v -> { Actions.openAccountOnReturn = true; finish(); });
    }

    private void zap(int direction) {
        int n = ps.channels.size();
        if (n == 0) return;
        ps.channel = ((ps.channel + direction) % n + n) % n;
        open(ps.channels.get(ps.channel).url, 0);
        showControls(true, null);
    }

    // ================================================================= Suivi de lecture

    private String key() { return media.isSeries() ? Logic.epKey(season, episode) : "movie_main"; }

    /** Un épisode quitté pendant son générique est vu, même sous le pourcentage (site : episodeFinished). */
    private boolean watchedEnough(double pos, double dur) {
        return Logic.shouldMarkSeen(pos, dur, ps.unlimited) || media != null && media.hasEpisodes() && Logic.episodeFinished(pos, dur);
    }

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
        boolean timed = mode != MODE_WEB;
        if (timed && !prepared) return;
        final long position = (timed ? safePosition() : webPosition()) / 1000;
        final long duration = durationForProgress() / 1000;
        lastSavedPosition = position;
        final Media m = media; final int s = season, e = episode;
        App.repo().enqueue(() -> App.repo().saveHistory(m, s, e, position, duration));
    }

    private void onTick() {
        if (!resumed) return;
        if (mode == MODE_WEB) {
            if (playingSince < 0) playingSince = SystemClock.elapsedRealtime();
            if (controlsVisible()) updateProgressUi();
            if (live || media == null) return;
            long posMs = webPosition(), durMs = durationForProgress();
            double pos = posMs / 1000.0, dur = durMs / 1000.0;
            if (dur > 0 && watchedEnough(pos, dur)) markSeen();
            if (lastSavedPosition < 0 || Math.abs(pos - lastSavedPosition) >= 10) persist();
            if (!media.hasEpisodes()) return;
            int[] next = media.next(season, episode);
            if (next == null || autoNextOffered || dur < 60) return;
            double target = creditsStart >= 0 ? Math.min(creditsStart + 5, dur) : dur - 30;
            double remaining = target - pos;
            if (remaining <= 0) { autoNextOffered = true; hideCountdown(); goNext(true); }
            else if (remaining <= 5) showCountdown((int) Math.ceil(remaining));
            else hideCountdown();
            return;
        }
        boolean playing = isPlaying();
        if (playing && playingSince < 0) playingSince = SystemClock.elapsedRealtime();
        if (!playing) stopPlayClock();
        if (controlsVisible()) updateProgressUi();
        if (live || !prepared) return;
        long posMs = safePosition(), durMs = safeDuration();
        double pos = posMs / 1000.0, dur = durMs / 1000.0;

        // Une vision gratuite est comptée quand l'image avance vraiment (site : handleProgress).
        if (chargePending && playing) {
            if (chargeFirstPos < 0) chargeFirstPos = posMs;
            else if (posMs - chargeFirstPos >= 1000) chargeNow();
        }

        // Image figée plus de 30 s pendant la lecture : on passe à une autre source.
        if (playing && stallSince > 0 && SystemClock.elapsedRealtime() - stallSince > 30000 && mode == MODE_NATIVE) { stallSince = -1; failover(posMs, "Flux bloqué."); return; }

        if (watchedEnough(pos, dur)) markSeen();
        if (lastSavedPosition < 0 || Math.abs(pos - lastSavedPosition) >= 10) persist();

        if (!media.hasEpisodes()) return;
        int[] next = media.next(season, episode);
        // Prépare l'épisode suivant une minute avant la fin, pour un enchaînement immédiat.
        if (next != null && playing && dur > 60 && dur - pos <= 60 && dur - pos > 30) prepareNext(next);
        if (next == null || autoNextOffered || !playing || dur < 60) { if (!playing || next == null) hideCountdown(); return; }
        double target = creditsStart >= 0 ? Math.min(creditsStart + 5, dur) : dur - 30;
        double remaining = target - pos;
        if (remaining <= 0) { autoNextOffered = true; hideCountdown(); goNext(true); }
        else if (remaining <= 5) showCountdown((int) Math.ceil(remaining));
        else hideCountdown();
    }

    private void chargeNow() {
        chargePending = false;
        App.io(this, () -> App.repo().reserveViewing(), (access, error) -> {
            if (error != null || access == null) return; // Un échec d'enregistrement n'interrompt jamais une vidéo lancée.
            Actions.invalidateQuota();
            if (!access.allowed) { showQuotaReached(); return; }
            if (!access.vip) toast(access.remaining > 0 ? "Vision gratuite utilisée · il t'en reste " + access.remaining + " sur " + Logic.FREE_WATCH_LIMIT + " cette semaine." : "C'était ta dernière vision gratuite de la semaine.");
        });
    }

    private void prepareNext(int[] next) {
        final String src = media.rawSource(next[0], next[1]);
        if (!Logic.isNativePlayback(src) || Logic.isDirectVideo(src) || src.equals(preparedNextSource)) return;
        preparedNextSource = src;
        App.io(this, () -> App.repo().playback(src, new ArrayList<>(), ""), (st, e) -> {
            if (st != null && st.error == null && src.equals(preparedNextSource)) { preparedNext = st; preparedNextAt = SystemClock.elapsedRealtime(); }
        });
    }

    private void onEnded() {
        if (ended) return;
        ended = true;
        stopPlayClock();
        markSeen();
        persist();
        updatePlayPause();
        if (live) return;
        if (media.next(season, episode) != null && !autoNextOffered) { autoNextOffered = true; goNext(true); }
        else { toast("Lecture terminée. Ton historique est à jour."); showControls(true, playPause); }
    }

    // ================================================================= Avance / retour

    private void seekBy(long deltaMs, boolean show) {
        if (mode == MODE_WEB || live || !prepared) return;
        long duration = safeDuration();
        long base = pendingSeek >= 0 ? pendingSeek : safePosition();
        pendingSeek = Math.max(0, duration > 0 ? Math.min(duration - 1000, base + deltaMs) : base + deltaMs);
        updateProgressUi();
        App.MAIN.removeCallbacks(commitSeek);
        App.MAIN.postDelayed(commitSeek, 600);
        if (show) showControls(true, MainActivity.isInside(getCurrentFocus(), bottomBar) ? null : seek);
    }

    private void commitSeek() {
        if (pendingSeek < 0 || player == null || !prepared) { pendingSeek = -1; return; }
        try { player.seekTo((int) pendingSeek); } catch (Exception ignored) { }
        pendingSeek = -1;
        scrubRepeat = 0;
        updateProgressUi();
        persist();
    }

    /** Pas d'avance : 10 s, puis 30 s et 60 s quand la touche reste appuyée. */
    private long scrubStep(int repeat) { return repeat < 5 ? 10000 : repeat < 14 ? 30000 : 60000; }

    private void updateProgressUi() {
        if (mode == MODE_WEB || live) return;
        long duration = safeDuration(), position = pendingSeek >= 0 ? pendingSeek : safePosition();
        seek.set(duration > 0 ? position / (float) duration : 0f, pendingSeek >= 0);
        timeLeft.setText(Logic.formatTime(position / 1000));
        timeRight.setText(duration > 0 ? "-" + Logic.formatTime(Math.max(0, duration - position) / 1000) : "--:--");
    }

    // ================================================================= Erreurs

    private void buildError() {
        errorBox = Ui.column(this);
        errorBox.setGravity(Gravity.CENTER_HORIZONTAL);
        errorBox.setBackground(Ui.stroked(0xF20D1529, 0x1FFFFFFF, 1, 26));
        errorBox.setPadding(dp(40), dp(34), dp(40), dp(30));
        Ui.noClip(errorBox);
        errorText = Ui.label(this, "", 17, Ui.TEXT, Ui.W_REGULAR);
        errorText.setGravity(Gravity.CENTER);
        errorText.setLineSpacing(0, 1.35f);
        errorBox.addView(errorText, Ui.lp(dp(560), Ui.WRAP));
        LinearLayout row = Ui.row(this);
        Ui.noClip(row);
        errorRetry = Ui.button(this, "Réessayer", R.drawable.ic_refresh, Ui.STYLE_PRIMARY);
        errorSource = Ui.button(this, "Changer de source", R.drawable.ic_list, Ui.STYLE_NORMAL);
        errorQuit = Ui.button(this, "Quitter", R.drawable.ic_back, Ui.STYLE_GHOST);
        errorQuit.setOnClickListener(v -> finish());
        row.addView(errorRetry);
        row.addView(errorSource, Ui.lp(Ui.WRAP, Ui.WRAP, dp(14), 0, 0, 0));
        row.addView(errorQuit, Ui.lp(Ui.WRAP, Ui.WRAP, dp(14), 0, 0, 0));
        errorBox.addView(row, Ui.lp(Ui.WRAP, Ui.WRAP, 0, dp(24), 0, 0));
        errorBox.setVisibility(View.GONE);
        root.addView(errorBox, Ui.flp(Ui.WRAP, Ui.WRAP, Gravity.CENTER));
    }

    private void showError(String text, boolean canChangeSource) {
        hideLoading();
        showControls(false, null);
        hideCountdown();
        if (cursor != null) cursor.hide();
        errorText.setText(text);
        errorRetry.setText(live ? "Réessayer" : "Réessayer");
        errorRetry.setOnClickListener(v -> {
            hideError();
            excluded.clear(); selectedEmbed = ""; failovers = 0;
            if (live) open(ps.channels.get(ps.channel).url, 0);
            else open(source, currentPositionForRetry());
        });
        errorSource.setVisibility(canChangeSource && stream != null ? View.VISIBLE : View.GONE);
        errorSource.setOnClickListener(v -> { hideError(); showSourceOptions(); });
        errorQuit.setText(live ? "Chaîne suivante" : "Quitter");
        errorQuit.setOnClickListener(v -> { if (live) { hideError(); zap(1); } else finish(); });
        errorBox.setVisibility(View.VISIBLE);
        if (web != null) web.setFocusable(false);
        errorRetry.requestFocus();
    }

    private boolean errorVisible() { return errorBox.getVisibility() == View.VISIBLE; }

    private void hideError() {
        errorBox.setVisibility(View.GONE);
        if (web != null) web.setFocusable(true);
    }

    // ================================================================= Télécommande

    private boolean centerDown, longFired;

    @Override public boolean dispatchKeyEvent(KeyEvent e) {
        int code = e.getKeyCode(), action = e.getAction();
        boolean down = action == KeyEvent.ACTION_DOWN;
        boolean uiOpen = controlsVisible() || sheetOpen() || drawerOpen() || errorVisible() || MainActivity.isInside(getCurrentFocus(), countdown);
        if (controlsVisible() && down) scheduleHide();

        if (code == KeyEvent.KEYCODE_BACK || code == KeyEvent.KEYCODE_ESCAPE || code == KeyEvent.KEYCODE_BUTTON_B) {
            if (action == KeyEvent.ACTION_UP && !e.isCanceled()) back();
            return true;
        }
        switch (code) {
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: case KeyEvent.KEYCODE_HEADSETHOOK: case KeyEvent.KEYCODE_SPACE:
                if (down && e.getRepeatCount() == 0) togglePause(); return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY:
                if (down && e.getRepeatCount() == 0) { if (mode == MODE_WEB) togglePause(); else { play(); showControls(true, playPause); } } return true;
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                if (down && e.getRepeatCount() == 0) { if (mode == MODE_WEB) togglePause(); else { pause(); showControls(true, playPause); } } return true;
            case KeyEvent.KEYCODE_MEDIA_STOP:
                if (down) finish(); return true;
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                if (down) seekBy(30000, true); return true;
            case KeyEvent.KEYCODE_MEDIA_REWIND:
                if (down) seekBy(-30000, true); return true;
            case KeyEvent.KEYCODE_MEDIA_NEXT: case KeyEvent.KEYCODE_CHANNEL_UP:
                if (down && e.getRepeatCount() == 0) step(1); return true;
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS: case KeyEvent.KEYCODE_CHANNEL_DOWN:
                if (down && e.getRepeatCount() == 0) step(-1); return true;
            case KeyEvent.KEYCODE_MENU: case KeyEvent.KEYCODE_INFO:
                if (down && e.getRepeatCount() == 0) {
                    if (mode == MODE_NATIVE) showSourceOptions();
                    else showControls(!controlsVisible(), null);
                }
                return true;
            default: break;
        }

        // Interface ouverte : navigation normale, cadence limitée, barre de progression pilotable.
        if (uiOpen) {
            boolean horizontal = code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT;
            if (down && seek.hasFocus() && horizontal) {
                scrubRepeat = e.getRepeatCount() == 0 ? 0 : scrubRepeat + 1;
                if (e.getRepeatCount() > 0) {
                    long now = SystemClock.uptimeMillis();
                    if (now - lastRepeat < 70) return true;
                    lastRepeat = now;
                }
                seekBy((code == KeyEvent.KEYCODE_DPAD_LEFT ? -1 : 1) * scrubStep(scrubRepeat), false);
                return true;
            }
            if (down && e.getRepeatCount() > 0 && MainActivity.isDirection(code)) {
                long now = SystemClock.uptimeMillis();
                if (now - lastRepeat < 90) return true;
                lastRepeat = now;
            }
            if (seek.hasFocus() && MainActivity.isSelect(code)) { if (down && e.getRepeatCount() == 0) togglePause(); return true; }
            // Haut depuis la barre : rien au-dessus, on garde la sélection.
            if (down && seek.hasFocus() && code == KeyEvent.KEYCODE_DPAD_UP) return true;
            return super.dispatchKeyEvent(e);
        }

        // Aucune interface : raccourcis de lecture.
        if (MainActivity.isSelect(code)) {
            if (down) {
                if (e.getRepeatCount() == 0) { centerDown = true; longFired = false; return true; }
                if (centerDown && !longFired) { longFired = true; if (mode == MODE_NATIVE) showSourceOptions(); else if (mode == MODE_WEB) webMenu(); else showControls(true, null); }
                return true;
            }
            if (!centerDown) return true;
            centerDown = false;
            if (longFired) return true;
            if (mode == MODE_WEB && cursor != null && cursor.isShownNow()) { tapAt(cursor.x, cursor.y); cursor.show(); }
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
            if (mode == MODE_WEB) { moveCursor(code, e.getRepeatCount()); return true; }
            if (live) {
                if (code == KeyEvent.KEYCODE_DPAD_UP && e.getRepeatCount() == 0) zap(1);
                else if (code == KeyEvent.KEYCODE_DPAD_DOWN && e.getRepeatCount() == 0) zap(-1);
                else showControls(true, null);
                return true;
            }
            if (code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT) {
                scrubRepeat = e.getRepeatCount() == 0 ? 0 : scrubRepeat + 1;
                seekBy((code == KeyEvent.KEYCODE_DPAD_LEFT ? -1 : 1) * scrubStep(scrubRepeat), true);
                return true;
            }
            if (e.getRepeatCount() == 0) showControls(true, code == KeyEvent.KEYCODE_DPAD_DOWN ? playPause : seek);
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    /** Menu du lecteur web : mêmes choix qu'avec les commandes, plus le pointeur. */
    private void webMenu() {
        List<String[]> opts = new ArrayList<>();
        opts.add(new String[]{"resume", "Reprendre la lecture"});
        if (media.hasEpisodes()) {
            opts.add(new String[]{"episodes", "Épisodes et saisons"});
            if (media.next(season, episode) != null) opts.add(new String[]{"next", "Épisode suivant"});
            if (media.previous(season, episode) != null) opts.add(new String[]{"prev", "Épisode précédent"});
        }
        opts.add(new String[]{"reload", "Recharger le lecteur"});
        opts.add(new String[]{"quit", "Quitter la lecture"});
        showOptions("Lecture", "Ce lecteur se pilote avec le pointeur : flèches pour le déplacer, OK pour cliquer.", opts, "resume", v -> {
            switch (v) {
                case "episodes": showSheet(); break;
                case "next": step(1); break;
                case "prev": step(-1); break;
                case "reload": open(source, 0); break;
                case "quit": finish(); break;
                default: if (cursor != null) cursor.show(); break;
            }
        });
    }

    private void back() {
        if (customView != null) { exitCustomView(); return; }
        if (drawerOpen()) { closeDrawer(); return; }
        if (sheetOpen()) { hideSheet(); return; }
        if (controlsVisible()) { showControls(false, null); return; }
        if (countdown.getVisibility() == View.VISIBLE) { autoNextOffered = true; hideCountdown(); return; }
        if (mode == MODE_WEB && !errorVisible()) { webMenu(); return; }
        finish();
    }

    // ================================================================= Cycle de vie

    @Override protected void onResume() {
        super.onResume();
        resumed = true;
        App.MAIN.post(tick);
        App.MAIN.post(presence);
        if (web != null) { web.onResume(); if (playingSince < 0) playingSince = SystemClock.elapsedRealtime(); }
        if (mode != MODE_WEB && player != null && prepared && wantPlay) play();
    }

    @Override protected void onPause() {
        resumed = false;
        App.MAIN.removeCallbacks(tick);
        App.MAIN.removeCallbacks(presence);
        stopPlayClock();
        if (mode != MODE_WEB && player != null && prepared) {
            boolean wasPlaying = isPlaying();
            try { player.pause(); } catch (Exception ignored) { }
            wantPlay = wasPlaying;
        }
        persist();
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override protected void onDestroy() {
        alive = false;
        generation++;
        App.MAIN.removeCallbacks(tick);
        App.MAIN.removeCallbacks(presence);
        App.MAIN.removeCallbacks(hideControls);
        App.MAIN.removeCallbacks(commitSeek);
        releasePlayer();
        destroyWeb();
        super.onDestroy();
    }

    @Override public void finish() {
        if (!live && media != null && prepared && mode != MODE_WEB) {
            double pos = safePosition() / 1000.0, dur = safeDuration() / 1000.0;
            // Un épisode quitté dans ses deux dernières minutes compte comme vu (site : episodeFinished).
            if (watchedEnough(pos, dur)) markSeen();
        }
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

    // ================================================================= Vues

    /** Barre de progression : fine au repos, épaisse et avec un curseur quand elle est sélectionnée. */
    static final class SeekView extends View {
        private float fraction; private boolean preview;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        SeekView(Context c) { super(c); setFocusable(true); }
        void set(float f, boolean p) { fraction = Math.max(0, Math.min(1, f)); preview = p; invalidate(); }
        @Override protected void onDraw(Canvas canvas) {
            float h = isFocused() ? dp(8) : dp(4), cy = getHeight() / 2f, pad = dp(14), w = getWidth() - pad * 2;
            paint.setColor(0x40FFFFFF);
            canvas.drawRoundRect(pad, cy - h / 2, pad + w, cy + h / 2, h, h, paint);
            paint.setColor(preview ? Ui.GOLD : Ui.ACCENT);
            canvas.drawRoundRect(pad, cy - h / 2, pad + w * fraction, cy + h / 2, h, h, paint);
            if (isFocused()) {
                paint.setColor(0x55FFFFFF);
                canvas.drawCircle(pad + w * fraction, cy, dp(16), paint);
                paint.setColor(0xFFFFFFFF);
                canvas.drawCircle(pad + w * fraction, cy, dp(10), paint);
            }
        }
        @Override protected void onFocusChanged(boolean gain, int dir, android.graphics.Rect prev) { super.onFocusChanged(gain, dir, prev); invalidate(); }
    }

    /** Pointeur affiché au-dessus du lecteur web de secours. */
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
