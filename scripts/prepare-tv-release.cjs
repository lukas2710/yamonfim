const fs=require('node:fs');
function change(p,fn){fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));}
change('android-native-tv/tests/LogicTest.java',s=>{const start=s.indexOf('        check(!next.offer('),end=s.indexOf('        System.out.println',start);return s.slice(0,start)+`        check(!next.update(2979000, 3000000, true, true) && next.remaining == -1, "avant les vingt secondes");
        check(!next.update(2980000, 3000000, true, true) && next.remaining == 20, "décompte réel vingt secondes");
        check(!next.update(2995000, 3000000, false, true) && next.remaining == 5, "pause conserve la position");
        check(next.update(3000000, 3000000, true, true), "suite à la fin");
        next.reset(); next.marker(2900000, 3000000);
        check(!next.update(2880000, 3000000, true, true) && next.remaining == 20, "décompte avant marqueur");
        check(next.update(2900000, 3000000, true, true), "suite au générique connu");
        next.cancel(); check(!next.update(3000000, 3000000, true, true), "annulation respectée");
        next.reset(); check(!next.update(3000000, 3000000, true, false), "dernier épisode");
        check(Logic.isResolvedPlayer("/api/catalogue-player?tmdb=1396&type=tv&season=1&episode=2"), "catalogue résolu sans page 404");
        check(!Logic.isResolvedPlayer("https://yamonfim.vercel.app.evil.test/api/catalogue-player?tmdb=1396&type=movie"), "hôte catalogue exact");
`+s.slice(end);});
change('android-native-tv/build-apk.ps1',s=>s.replace("$version = '2.2.0'","$version = '2.3.0'").replace("'--version-code', '9'","'--version-code', '10'"));
change('android-native-tv/app/src/main/AndroidManifest.xml',s=>s.replace('versionCode="9"','versionCode="10"').replace('versionName="2.2.0"','versionName="2.3.0"'));
change('android-native-tv/app/src/main/java/com/yamonfilm/tv/screens/HomeScreen.java',s=>s.replace('private boolean initialFocusDone;','private boolean initialFocusDone;\n    private boolean catalogueBusy;\n    private long catalogueUpdated;').replace('private void refreshCatalogue() {','private void refreshCatalogue() {\n        if (catalogueBusy) return;\n        catalogueBusy = true;').replace('if (e != null) {\n                if (App.repo().catalogue().isEmpty())','catalogueBusy = false;\n            if (e != null) {\n                if (App.repo().catalogue().isEmpty())').replace('            renderCatalogue();\n        });\n    }','            catalogueUpdated = android.os.SystemClock.elapsedRealtime();\n            renderCatalogue();\n        });\n    }').replace('onRefresh() { loadHistory(); }','onRefresh() { loadHistory(); if (android.os.SystemClock.elapsedRealtime() - catalogueUpdated > 300000) { refreshCatalogue(); loadCollections(); } }'));
