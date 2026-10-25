package app.yamonfim.tv;

import java.net.URI;

/** Small, testable boundary between the site and external browser links. */
public final class NavigationPolicy {
    public static final String SITE_URL = "https://yamonfim.vercel.app/";
    private NavigationPolicy() {}

    public static boolean isInternal(String value) {
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                && "yamonfim.vercel.app".equalsIgnoreCase(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && uri.getUserInfo() == null;
        } catch (Exception ignored) { return false; }
    }

    public static boolean canOpenBrowser(String value) {
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (Exception ignored) { return false; }
    }
}
