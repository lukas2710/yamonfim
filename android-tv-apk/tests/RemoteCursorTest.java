import app.yamonfim.tv.RemoteCursor;

public class RemoteCursorTest {
    private static int checks;
    private static void check(boolean condition) { checks++; if (!condition) throw new AssertionError("Remote cursor check " + checks); }
    public static void main(String[] args) {
        check(RemoteCursor.clamp(-20, 1920) == 0);
        check(RemoteCursor.clamp(2000, 1920) == 1919);
        check(RemoteCursor.clamp(500, 1920) == 500);
        check(RemoteCursor.clamp(50, 0) == 0);
        check(RemoteCursor.clamp(20, 1) == 0);
        check(RemoteCursor.step(1, 0) == 14);
        check(RemoteCursor.step(2, 0) == 28);
        check(RemoteCursor.step(1, 7) > RemoteCursor.step(1, 0));
        check(RemoteCursor.step(0, 0) >= 1);
        float x = 960;
        for (int i = 0; i < 1000; i++) x = RemoteCursor.clamp(x + RemoteCursor.step(1, i), 1920);
        check(x == 1919);
        System.out.println(checks + " remote cursor checks passed");
    }
}
