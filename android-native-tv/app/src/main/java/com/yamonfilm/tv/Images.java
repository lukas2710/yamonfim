package com.yamonfilm.tv;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.LruCache;
import android.widget.ImageView;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.ref.WeakReference;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.LinkedBlockingDeque;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Chargeur d'images : cache mémoire + disque, décodage réduit à la taille affichée,
 * file « dernier demandé, premier servi » pour que l'écran visible passe d'abord.
 */
public final class Images {
    private static final int TAG = 0x7f0a0001;
    private final LruCache<String, Bitmap> memory;
    private final File dir;
    private final Map<String, Job> pending = new HashMap<>();
    private final ThreadPoolExecutor pool;

    Images(Context context) {
        int max = (int) Math.min(Runtime.getRuntime().maxMemory() / 5, 96L * 1024 * 1024);
        memory = new LruCache<String, Bitmap>(max) { @Override protected int sizeOf(String k, Bitmap b) { return b.getAllocationByteCount(); } };
        dir = new File(context.getCacheDir(), "img");
        dir.mkdirs();
        LinkedBlockingDeque<Runnable> stack = new LinkedBlockingDeque<Runnable>() {
            @Override public boolean offer(Runnable r) { return offerFirst(r); }
        };
        pool = new ThreadPoolExecutor(4, 4, 20, TimeUnit.SECONDS, stack, r -> {
            Thread t = new Thread(r, "yamonfilm-img");
            t.setPriority(Thread.NORM_PRIORITY - 2);
            return t;
        });
        App.background(this::trimDisk);
    }

    private final class Job implements Runnable {
        final String url, key; final int width, height;
        final List<WeakReference<ImageView>> targets = new ArrayList<>();
        Job(String url, String key, int w, int h) { this.url = url; this.key = key; width = w; height = h; }

        boolean wanted() {
            synchronized (pending) {
                for (WeakReference<ImageView> ref : targets) { ImageView v = ref.get(); if (v != null && key.equals(v.getTag(TAG))) return true; }
                return false;
            }
        }

        @Override public void run() {
            Bitmap bitmap = null;
            if (wanted()) {
                try { bitmap = decode(fetch(url), width, height); } catch (Throwable ignored) { }
            }
            final Bitmap result = bitmap;
            if (result != null) memory.put(key, result);
            App.MAIN.post(() -> {
                List<WeakReference<ImageView>> list;
                synchronized (pending) { pending.remove(key); list = new ArrayList<>(targets); }
                if (result == null) return;
                for (WeakReference<ImageView> ref : list) {
                    ImageView v = ref.get();
                    if (v != null && key.equals(v.getTag(TAG))) {
                        v.setImageBitmap(result);
                        v.setAlpha(0f);
                        v.animate().alpha(1f).setDuration(160).start();
                    }
                }
            });
        }
    }

    /** Affiche l'image `url` réduite à width×height pixels. Une URL vide efface la vue. */
    public void load(ImageView view, String url, int width, int height) {
        if (url == null || url.trim().isEmpty() || !url.startsWith("http")) {
            view.setTag(TAG, null);
            view.animate().cancel();
            view.setImageDrawable(null);
            return;
        }
        String key = url + "#" + width;
        if (key.equals(view.getTag(TAG)) && view.getDrawable() != null) return;
        view.setTag(TAG, key);
        view.animate().cancel();
        Bitmap cached = memory.get(key);
        if (cached != null) { view.setAlpha(1f); view.setImageBitmap(cached); return; }
        view.setImageDrawable(null);
        synchronized (pending) {
            Job job = pending.get(key);
            if (job != null) { job.targets.add(new WeakReference<>(view)); return; }
            job = new Job(url, key, width, height);
            job.targets.add(new WeakReference<>(view));
            pending.put(key, job);
            pool.execute(job);
        }
    }

    public void cancel(ImageView view) { view.setTag(TAG, null); }

    /** Préchargement silencieux (ex. image de fond de l'élément suivant). */
    public void prefetch(String url, int width, int height) {
        if (url == null || !url.startsWith("http")) return;
        final String key = url + "#" + width;
        if (memory.get(key) != null) return;
        pool.execute(() -> { try { Bitmap b = decode(fetch(url), width, height); if (b != null) memory.put(key, b); } catch (Throwable ignored) { } });
    }

    private byte[] fetch(String url) throws IOException {
        File file = new File(dir, Integer.toHexString(url.hashCode()) + "_" + url.length());
        if (file.exists() && file.length() > 0) {
            file.setLastModified(System.currentTimeMillis());
            try (InputStream in = new FileInputStream(file)) { return readAll(in); }
        }
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(8000);
            c.setReadTimeout(15000);
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("User-Agent", Api.USER_AGENT);
            // Comme le navigateur sur le site : certains hébergeurs d'images (avatars) l'exigent.
            c.setRequestProperty("Referer", Api.SITE);
            c.setRequestProperty("Accept", "image/webp,image/jpeg,image/png,image/*;q=0.8");
            if (c.getResponseCode() >= 400) throw new IOException("HTTP " + c.getResponseCode());
            byte[] data;
            try (InputStream in = c.getInputStream()) { data = readAll(in); }
            File tmp = new File(dir, file.getName() + ".tmp");
            try (FileOutputStream out = new FileOutputStream(tmp)) { out.write(data); }
            if (!tmp.renameTo(file)) tmp.delete();
            return data;
        } finally { c.disconnect(); }
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(64 * 1024);
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); if (out.size() > 12 * 1024 * 1024) throw new IOException("Image trop lourde"); }
        return out.toByteArray();
    }

    static Bitmap decode(byte[] data, int width, int height) {
        if (data == null || data.length == 0) return null;
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(data, 0, data.length, o);
        if (o.outWidth <= 0 || o.outHeight <= 0) return null;
        int sample = 1;
        while (o.outWidth / (sample * 2) >= width && o.outHeight / (sample * 2) >= height) sample *= 2;
        BitmapFactory.Options d = new BitmapFactory.Options();
        d.inSampleSize = sample;
        String mime = o.outMimeType == null ? "" : o.outMimeType;
        d.inPreferredConfig = mime.contains("png") || mime.contains("webp") || mime.contains("gif") ? Bitmap.Config.ARGB_8888 : Bitmap.Config.RGB_565;
        Bitmap b = BitmapFactory.decodeByteArray(data, 0, data.length, d);
        if (b == null) return null;
        float scale = Math.max(width / (float) b.getWidth(), height / (float) b.getHeight());
        if (scale < 0.8f) {
            Bitmap scaled = Bitmap.createScaledBitmap(b, Math.max(1, Math.round(b.getWidth() * scale)), Math.max(1, Math.round(b.getHeight() * scale)), true);
            if (scaled != b) b.recycle();
            b = scaled;
        }
        return b;
    }

    /** Limite le cache disque à environ 200 Mo, en retirant les images les plus anciennes. */
    private void trimDisk() {
        File[] files = dir.listFiles();
        if (files == null) return;
        long total = 0;
        for (File f : files) total += f.length();
        long limit = 200L * 1024 * 1024;
        if (total <= limit) return;
        List<File> list = new ArrayList<>(Arrays.asList(files));
        list.sort(Comparator.comparingLong(File::lastModified));
        for (Iterator<File> it = list.iterator(); it.hasNext() && total > limit * 0.75; ) { File f = it.next(); total -= f.length(); f.delete(); }
    }
}
