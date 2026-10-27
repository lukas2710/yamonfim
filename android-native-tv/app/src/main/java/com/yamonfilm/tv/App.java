package com.yamonfilm.tv;

import android.app.Application;
import android.os.Handler;
import android.os.Looper;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

public final class App extends Application {
    private static App instance;
    public static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final ExecutorService IO = new ThreadPoolExecutor(3, 3, 30, TimeUnit.SECONDS, new LinkedBlockingQueue<>(), r -> {
        Thread t = new Thread(r, "yamonfilm-io");
        t.setPriority(Thread.NORM_PRIORITY - 1);
        return t;
    });

    private Repo repo;
    private Images images;

    @Override public void onCreate() {
        super.onCreate();
        instance = this;
        repo = new Repo(this);
        images = new Images(this);
    }

    public static Repo repo() { return instance.repo; }
    public static Images images() { return instance.images; }

    public interface Work<T> { T run() throws Exception; }
    public interface Done<T> { void done(T value, Exception error); }

    /** Lance un travail réseau ; le résultat revient sur le fil d'interface si `alive` est encore vrai. */
    public static <T> void io(final Alive alive, final Work<T> work, final Done<T> done) {
        IO.execute(() -> {
            T value = null; Exception error = null;
            try { value = work.run(); } catch (Exception e) { error = e; }
            final T v = value; final Exception err = error;
            if (done != null) MAIN.post(() -> { if (alive == null || alive.alive()) done.done(v, err); });
        });
    }

    public static void background(Runnable r) { IO.execute(r); }

    public interface Alive { boolean alive(); }

    public static String message(Exception e) {
        if (e == null) return "";
        String m = e.getMessage();
        if (m == null || m.isEmpty() || m.startsWith("java.") || m.contains("Exception")) return "Une erreur est survenue. Réessaie dans un instant.";
        return m;
    }
}
