const fs = require('node:fs');
const base = 'android-native-tv/app/src/main/java/com/yamonfilm/tv/';
function edit(file, pairs) { let s = fs.readFileSync(base + file, 'utf8'); for (const [a,b] of pairs) { if (!s.includes(a)) throw Error(file + ': ' + a); s = s.split(a).join(b); } fs.writeFileSync(base + file,s); }
edit('Ui.java', [
 ['0xFF111319','0xFF151518'], ['0xFF1A1D26','0xFF202024'], ['0xFFA9AFBD','0xFFB7B7BF'],
 ['setDuration(180)','setDuration(120)'], ['dp(10) : 0','dp(4) : 0'],
 ['round(FOCUS, 26)','round(FOCUS, 10)'], ['1.5f, 26)','1.5f, 10)'], ['round(normalBg, 26)','round(normalBg, 10)'],
 ['onFocus(b, 1.07f','onFocus(b, 1.035f'], ['0xFF12141C, 0xFF07080C, 0xFF07080C','0xFF181113, 0xFF07080C, 0xFF07080C']
]);
edit('Cards.java', [
 ['0xFF1C2030, 0xFF12141B','0xFF252126, 0xFF131316'],
 ['landscape ? 1.08f : 1.1f','landscape ? 1.035f : 1.045f'], ['landscape ? 1.07f : 1.1f','landscape ? 1.035f : 1.045f'],
 ['0xFFFF6B73','0xFFFFA3A8']
]);
edit('screens/HomeScreen.java', [
 ['screenH * 0.66f','screenH * 0.72f'], ['dp(320)','dp(90)'],
 ['Ui.text(main, 40, Ui.TEXT, Ui.W_BOLD), 1','Ui.text(main, 36, Ui.TEXT, Ui.W_BOLD), 2'],
 ['dp(760), Ui.WRAP','Math.min(dp(660), screenW - dp(Ui.SIDE * 2)), Ui.WRAP'],
 ['dp(620), Ui.WRAP','Math.min(dp(560), screenW - dp(Ui.SIDE * 2)), Ui.WRAP'],
 ['"Reprendre", cards','"Reprendre la lecture", cards'],
 ['"Collections", cards','"Tes univers à explorer", cards']
]);
edit('screens/DetailScreen.java', [
 ['Ui.text(main, 46','Ui.text(main, 40'],
 ['dp(720), Ui.WRAP','Math.min(dp(660), w - dp(Ui.SIDE * 2)), Ui.WRAP'],
 ['dp(640), Ui.WRAP','Math.min(dp(580), w - dp(Ui.SIDE * 2)), Ui.WRAP']
]);
edit('MainActivity.java', [['Ui.round(0x1FFFFFFF, 21)','Ui.stroked(0x33E50914, Ui.ACCENT, 1, 10)']]);
console.log('Design TV actualisé.');
