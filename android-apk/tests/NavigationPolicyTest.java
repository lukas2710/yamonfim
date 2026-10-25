import app.yamonfim.android.NavigationPolicy;

public class NavigationPolicyTest {
    private static int checks = 0;
    private static void check(boolean value) { checks++; if (!value) throw new AssertionError("Check " + checks + " failed"); }
    public static void main(String[] args) {
        check(NavigationPolicy.isInternal(NavigationPolicy.SITE_URL));
        check(NavigationPolicy.isInternal("https://yamonfim.vercel.app/watch/12?s=1&e=2"));
        check(NavigationPolicy.isInternal("https://YAMONFIM.vercel.app:443/login#token"));
        check(!NavigationPolicy.isInternal("https://yamonfim.vercel.app.evil.test/"));
        check(!NavigationPolicy.isInternal("https://yamonfim.vercel.app@evil.test/"));
        check(!NavigationPolicy.isInternal("https://evil.test@yamonfim.vercel.app/"));
        check(!NavigationPolicy.isInternal("http://yamonfim.vercel.app/"));
        check(!NavigationPolicy.isInternal("https://yamonfim.vercel.app:8443/"));
        check(!NavigationPolicy.isInternal("file:///sdcard/secret"));
        check(!NavigationPolicy.isInternal("intent://example/"));
        check(!NavigationPolicy.isInternal(null));
        check(NavigationPolicy.canOpenBrowser("https://buy.stripe.com/example"));
        check(!NavigationPolicy.canOpenBrowser("javascript:alert(1)"));
        check(!NavigationPolicy.canOpenBrowser("https://user:pass@example.test/"));
        check(!NavigationPolicy.canOpenBrowser("http://example.test"));
        check(!NavigationPolicy.canOpenBrowser("data:text/html,test"));
        System.out.println(checks + " navigation checks passed");
    }
}
