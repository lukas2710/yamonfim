package app.yamonfim.tv;

/** Device-independent cursor geometry, also exercised by JVM tests. */
public final class RemoteCursor {
    public static float clamp(float value, float size) {
        return Math.max(0, Math.min(value, Math.max(0, size - 1)));
    }
    public static float step(float density, int repeats) {
        return Math.max(1f, density) * (repeats > 6 ? 28f : 14f);
    }
    private RemoteCursor() {}
}
