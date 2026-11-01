package com.yamonfilm.tv;
import java.util.*;

/** Profile-scoped complete titles: every stored episode is required for a series. */
public final class Completion {
    private Completion() { }
    public static <T extends Discovery.Title> Set<String> titles(List<T> items, Map<String, Map<String, Long>> seen, List<Discovery.Viewing> history, Map<String, List<String>> required) {
        Map<String, Discovery.Viewing> progress = new HashMap<>();
        for (Discovery.Viewing viewing : history) { Discovery.Viewing old = progress.get(viewing.id); if (old == null || viewing.updated > old.updated) progress.put(viewing.id, viewing); }
        Set<String> result = new HashSet<>();
        for (T item : items) {
            Discovery.Viewing viewing = progress.get(item.id()); Map<String, Long> keys = seen.get(item.id());
            boolean finished = viewing != null && viewing.duration > 0 && viewing.seconds / (double) viewing.duration >= .95;
            boolean interrupted = viewing != null && viewing.duration > 0 && !finished;
            long latest = 0; if (keys != null) for (long time : keys.values()) latest = Math.max(latest, time);
            boolean manual = latest > 0 && latest > (viewing == null ? 0 : viewing.updated);
            if ("movie".equals(item.type())) { if (keys != null && keys.containsKey("movie_main")) result.add(item.id()); }
            else {
                List<String> episodes = required.get(item.id()); int watchedEpisodes = 0;
                if (keys != null) for (String key : keys.keySet()) if (key.matches("s\\d+_e\\d+")) watchedEpisodes++;
                // Keep completed badges when a catalogue season was renumbered after legacy seen flags were saved.
                if (episodes != null && !episodes.isEmpty() && keys != null && (keys.keySet().containsAll(episodes) || watchedEpisodes >= episodes.size())) result.add(item.id());
            }
        }
        return result;
    }
}
