# YAMONFILM TV 2.7.4

- Version code 24, same package and signing key as the published Android TV app.
- Requests the catalogue with gzip and enforces a total response deadline while reading.
- Stops the unbounded Supabase pagination fallback when the catalogue API is unavailable; the home screen can show its retry action.
- Preserves the playback timeout improvements from 2.7.3.
- Built and signed; APK signature v2/v3 verification passed.
