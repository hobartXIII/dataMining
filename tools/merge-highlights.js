// 把頁面「🖍 標記 → 匯出」下載的 JSON 合併進 assets/highlights.js（共享螢光筆標記）
// 用法：node tools/merge-highlights.js <DataMining-highlights-YYYY-MM-DD.json>
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = process.argv[2];
if (!src) { console.error('用法：node tools/merge-highlights.js <匯出的 JSON>'); process.exit(1); }

const target = path.join(__dirname, '..', 'assets', 'highlights.js');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(target, 'utf8'), sandbox);
const file = sandbox.window.HL_SHARED || {};
const course = file.course;
const shared = file.marks || {};
const data = JSON.parse(fs.readFileSync(src, 'utf8'));

// 確認是這門課匯出的檔案（課程識別記在 highlights.js 的 course，須與頁面 Highlighter.setup 的 course.id 相同）
if (!course) { console.error('assets/highlights.js 沒有 course 欄位'); process.exit(1); }
if (data.course !== course) {
  console.error(`這個檔案是課程「${data.course || '未標示'}」匯出的，本課程是「${course}」，不合併。`);
  process.exit(1);
}

const FIELDS = ['id', 'c', 's', 'e', 'text', 'pre', 'post'];
const pick = (h) => Object.fromEntries(FIELDS.filter((k) => h[k] !== undefined).map((k) => [k, h[k]]));
const stat = { added: 0, recolored: 0, removed: 0 };

for (const [ch, list] of Object.entries(data.personal || {})) {
  const cur = shared[ch] || (shared[ch] = []);
  const ids = new Set(cur.map((h) => h.id));
  for (const h of list) {
    if (!h.id || !h.text || ids.has(h.id)) continue;
    cur.push(pick(h));
    ids.add(h.id);
    stat.added++;
  }
}
for (const [ch, ovr] of Object.entries(data.overrides || {})) {
  const cur = shared[ch];
  if (!cur) continue;
  for (const [id, c] of Object.entries(ovr)) {
    const i = cur.findIndex((h) => h.id === id);
    if (i < 0) continue;
    if (c === null) { cur.splice(i, 1); stat.removed++; } else if (cur[i].c !== c) { cur[i].c = c; stat.recolored++; }
  }
}

// 每章一行一個標記，方便看 git diff
const chapters = Object.keys(shared).filter((ch) => shared[ch].length).sort();
const body = chapters.map((ch) =>
  `    ${JSON.stringify(ch)}: [\n${shared[ch].map((h) => '      ' + JSON.stringify(h)).join(',\n')}\n    ]`).join(',\n');
fs.writeFileSync(target,
  '/* 共享螢光筆標記（由 tools/merge-highlights.js 產生，勿手動編輯）\n' +
  '   每台裝置打開頁面都會看到；個人標記仍存在各自瀏覽器的 localStorage。 */\n' +
  'window.HL_SHARED = {\n' +
  `  "course": ${JSON.stringify(course)},\n` +
  `  "marks": {${body ? '\n' + body + '\n  ' : ''}}\n` +
  '};\n');

const total = chapters.reduce((n, ch) => n + shared[ch].length, 0);
console.log(`新增 ${stat.added}、改色 ${stat.recolored}、刪除 ${stat.removed}；共享標記共 ${total} 個（${chapters.join('、') || '無'}）`);
