package com.yamonfilm.tv;

import android.content.Intent;

import com.yamonfilm.tv.Models.Media;
import com.yamonfilm.tv.screens.DetailScreen;

import java.util.List;

/** Parcours communs : ouverture d'une fiche et lancement de la lecture avec les règles VIP. */
public final class Actions {
    private Actions() { }

    /**
     * La fiche s'ouvre tout de suite ; la vérification du quota se fait en parallèle.
     * Comme sur le site, si le quota gratuit est atteint, la promotion VIP s'affiche.
     */
    public static void openMedia(MainActivity main, Media media) { openMedia(main, media, -1); }

    /** `seasonIndex` : saison mise en avant (bannière, carrousel) sur laquelle ouvrir la fiche, ou -1. */
    public static void openMedia(MainActivity main, Media media, int seasonIndex) {
        if (media == null) return;
        DetailScreen detail = new DetailScreen(main, media, seasonIndex);
        main.push(detail);
        App.io(detail, () -> App.repo().quotaReached(), (reached, error) -> {
            if (error instanceof Api.AuthExpired) { main.fail(error); return; }
            if (error == null && reached && main.top() == detail && !main.dialogOpen()) Dialogs.vip(main);
        });
    }

    public static void invalidateQuota() { }

    /** Données de lecture partagées avec le lecteur (évite les limites de taille des Intent). */
    public static final class PlayerSession {
        public Media media; public int season, episode; public long resumeAt; public String url;
        public boolean live; public List<Models.Channel> channels; public int channel; public boolean unlimited;
        /** Vision gratuite à compter quand la vidéo démarre vraiment. */
        public boolean free;
    }
    public static PlayerSession session;
    /** Le lecteur demande d'ouvrir « Mon compte » au retour (quota atteint). */
    public static boolean openAccountOnReturn;

    /** Lance un épisode (ou le film) : réserve une vision, enregistre l'historique, ouvre le lecteur. */
    public static void play(MainActivity main, Media media, int s, int e, long resumeAt) {
        if (main.isLoading()) return;
        String url = media.playerUrl(s, e);
        if (url.isEmpty()) { main.toast("Aucun lecteur disponible pour cet épisode."); return; }
        Models.Episode ep = media.episode(s, e);
        String label = media.hasEpisodes() && ep != null ? "Préparation de l'épisode " + ep.number + "…" : "Préparation de la lecture…";
        final int token = main.showLoading(label);
        // Comme sur le site : les sources lues par le lecteur natif ne comptent la vision
        // qu'une fois l'image lancée ; les autres lecteurs la comptent au lancement.
        final boolean nativeSource = Logic.isNativePlayback(media.rawSource(s, e));
        App.io(null, () -> {
            if (!nativeSource) return App.repo().reserveViewing();
            Models.Subscription sub = App.repo().accessBeforePlay();
            if (sub == null) return new Logic.WatchAccess(true, true, -1);
            return new Logic.WatchAccess(sub.count < Logic.FREE_WATCH_LIMIT, false, Logic.FREE_WATCH_LIMIT - sub.count);
        }, (access, error) -> {
            if (!main.hideLoading(token)) return; // annulé avec Retour
            if (error != null) { main.fail(error); return; }
            if (!access.allowed) { Dialogs.vip(main); return; }
            if (!nativeSource && !access.vip) main.toast(access.remaining > 0 ? "Vision gratuite utilisée · il t'en reste " + access.remaining + " sur " + Logic.FREE_WATCH_LIMIT + " cette semaine." : "C'était ta dernière vision gratuite de la semaine.");
            App.repo().enqueue(() -> App.repo().saveHistory(media, s, e, resumeAt, 0));
            PlayerSession ps = new PlayerSession();
            ps.media = media; ps.season = s; ps.episode = e; ps.resumeAt = resumeAt; ps.url = url; ps.unlimited = access.vip;
            ps.free = nativeSource && !access.vip;
            session = ps;
            main.launchPlayer(new Intent(main, PlayerActivity.class));
        });
    }

    /** Reprise directe depuis « Reprendre » ou l'historique (option de l'appui long). */
    public static void resume(MainActivity main, String mediaId, Models.History h) {
        if (main.isLoading()) return;
        final int token = main.showLoading("Chargement…");
        App.io(null, () -> App.repo().media(mediaId), (m, error) -> {
            if (!main.hideLoading(token)) return;
            if (error != null) { main.fail(error); return; }
            int s = h.seasonIdx, ep = h.episodeIdx;
            if (m.hasEpisodes() && m.episode(s, ep) == null) { s = 0; ep = 0; }
            play(main, m, s, ep, h.currentTime);
        });
    }

    public static void playChannel(MainActivity main, List<Models.Channel> channels, int index) {
        PlayerSession ps = new PlayerSession();
        ps.live = true; ps.channels = channels; ps.channel = index; ps.url = channels.get(index).url;
        session = ps;
        main.launchPlayer(new Intent(main, PlayerActivity.class));
    }
}
