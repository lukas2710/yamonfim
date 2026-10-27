const fs = require('node:fs');
const path = require('node:path');
const base = 'android-native-tv/app/src/main/java/com/yamonfilm/tv';
function walk(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.java')) {
      const s = fs.readFileSync(p, 'utf8');
      fs.writeFileSync(p, s.replace(/0x([A-Fa-f0-9]{2})07080C/g, '0x$1060A15').replaceAll('0xFF2A0609', '0xFF102759'));
    }
  }
}
walk(base);
const player = path.join(base, 'PlayerActivity.java');
let s = fs.readFileSync(player, 'utf8');
s = s.replace('buttons.addView(b, new LinearLayout.LayoutParams(0, dp(50), 1f));', 'LinearLayout.LayoutParams layout = new LinearLayout.LayoutParams(0, dp(50), 1f);\n        layout.setMargins(dp(3), 0, dp(3), 0);\n        buttons.addView(b, layout);');
s = s.replace('safeDuration(), playing || ended, media != null', 'safeDuration(), (playing || ended) && pendingSeek < 0, media != null');
fs.writeFileSync(player, s);
