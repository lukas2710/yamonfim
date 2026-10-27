const fs = require('node:fs');
const base = 'android-native-tv/app/src/main/java/com/yamonfilm/tv/';
function edit(path, fn) { const s = fs.readFileSync(path, 'utf8'); fs.writeFileSync(path, fn(s)); }
for (const file of ['Ui.java', 'Cards.java', 'MainActivity.java']) edit(base + file, s => s.replaceAll('0xFF07080C', '0xFF060A15').replaceAll('0xFF151518', '0xFF10192D').replaceAll('0xFF202024', '0xFF192743').replaceAll('0xFFE50914', '0xFF003CDA').replaceAll('0x33E50914', '0x33003CDA').replaceAll('0xFF181113', '0xFF101D3B').replaceAll('0xFF252126', '0xFF172443').replaceAll('0xFF131316', '0xFF0B1224').replaceAll('0xFFFFA3A8', '0xFF8AAFFF'));
edit(base + 'Ui.java', s => s.replace('bg.addState(EMPTY, style == STYLE_GHOST', 'bg.addState(EMPTY, "Regarder".equals(label) ? watchBackground() : style == STYLE_GHOST').replace('    /** Bouton rond à icône seule', `    private static Drawable watchBackground() {
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

    /** Bouton rond à icône seule`));
edit('android-native-tv/app/src/main/res/values/styles.xml', s => s.replaceAll('#FFE50914', '#FF003CDA'));
edit(base + 'PlayerActivity.java', s => s
 .replace('dp(30), 1f', 'dp(44), 1f')
 .replace('control("Épisode préc."', 'control("Préc."').replace('control("Épisode suiv."', 'control("Suiv."')
 .replace('        overlay.addView(buttons);', `        overlay.addView(buttons);
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
        }`)
 .replace('0xF51D1014', '0xF5061028')
 .replace('        b.setOnClickListener(v -> { action.run(); scheduleHide(); });', `        b.setTextSize(13);
        b.setPadding(dp(10), 0, dp(10), 0);
        b.setCompoundDrawablePadding(dp(6));
        b.setMinHeight(dp(48));
        b.setOnClickListener(v -> { action.run(); scheduleHide(); });`)
 .replace('buttons.addView(b, Ui.lp(Ui.WRAP, Ui.WRAP, 0, 0, dp(12), 0));', 'buttons.addView(b, new LinearLayout.LayoutParams(0, dp(50), 1f));')
 .replace('pendingSeek = Math.max(0, duration > 0 ? Math.min(duration - 1000, base + deltaMs) : base + deltaMs);', 'pendingSeek = Logic.seekTarget(base, deltaMs, duration);')
 .replace('private long scrubStep(int repeat) { return repeat < 6 ? 10000 : repeat < 16 ? 30000 : 60000; }', 'private long scrubStep(int repeat) { return Logic.seekStep(repeat); }')
 .replace('        if (overlayVisible() && down) scheduleHide();', `        if (overlayVisible() && down) scheduleHide();
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
        }`)
 .replace('if (down && seek.hasFocus() && MainActivity.isSelect(code)) { togglePause(); return true; }', 'if (down && seek.hasFocus() && MainActivity.isSelect(code)) { if (e.getRepeatCount() == 0) togglePause(); return true; }')
 .replace('        if (overlayVisible()) { showOverlay(false); return; }', '        if (overlayVisible()) { if (pendingSeek >= 0) { App.MAIN.removeCallbacks(commitSeek); commitSeek(); } showOverlay(false); return; }')
 .replace('SeekView(Context c) { super(c); setFocusable(true); }', 'SeekView(Context c) { super(c); setFocusable(true); setContentDescription("Position de lecture. Gauche et droite pour reculer ou avancer. OK pour mettre en pause."); }'));
edit(base + 'Logic.java', s => s.replace('public final class Logic {', `public final class Logic {
    public static long seekStep(int repeat) { return repeat < 6 ? 10000L : repeat < 16 ? 30000L : 60000L; }
    public static long seekTarget(long base, long delta, long duration) {
        long target = base + delta;
        return Math.max(0, duration > 0 ? Math.min(Math.max(0, duration - 1000), target) : target);
    }`));
edit('android-native-tv/tests/LogicTest.java', s => s.replace('        System.out.println(passed', `        check(Logic.seekTarget(5000, -10000, 60000) == 0, "retour limité au début");
        check(Logic.seekTarget(55000, 30000, 60000) == 59000, "avance limitée à la fin");
        check(Logic.seekTarget(0, 10000, 500) == 0, "durée très courte");
        check(Logic.seekTarget(10000, 10000, 0) == 20000, "durée encore inconnue");
        check(Logic.seekStep(0) == 10000 && Logic.seekStep(5) == 10000, "appui court précis");
        check(Logic.seekStep(6) == 30000 && Logic.seekStep(16) == 60000, "appui prolongé accéléré");
        System.out.println(passed`));
edit('android-native-tv/build-apk.ps1', s => s.replace("$version = '2.3.1'", "$version = '2.4.0'").replace("'--version-code', '11'", "'--version-code', '12'"));
edit('android-native-tv/app/src/main/AndroidManifest.xml', s => s.replace('versionCode="11"', 'versionCode="12"').replace('versionName="2.3.1"', 'versionName="2.4.0"'));
edit('app/app/page.tsx', s => s.replace("VERSION = '2.3.1'", "VERSION = '2.4.0'").replace("VERSION='2.3.1'", "VERSION='2.4.0'"));
