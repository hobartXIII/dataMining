/* W4 互動元件 */
(function () {
  'use strict';
  const { $, $$, fmtSet, pct, bindRange, drawLattice, levelsOf } = DM;
  const { key } = FIM;

  /* ===== 支持度與信賴度 ===== */
  (function rule4() {
    const calc = DM.ruleCalc($('#rule4-box'), FIM.DATA.tdb4, ['c', 'd'], ['a']);
    $$('#w-rule4 [data-rule]').forEach((b) => b.addEventListener('click', () => {
      const [x, y] = b.dataset.rule.split('|');
      calc.set(x.split(','), y.split(','));
    }));
  })();

  /* ===== 閉合與極大 ===== */
  (function lattice() {
    const inp = $('#lat-min'), svg = $('#lat-svg'), out = $('#lat-out');
    let sel = ['b', 'c'];
    function render() {
      const min = Number(inp.value);
      const all = FIM.lattice(FIM.DATA.tdb4, ['a', 'b', 'c', 'd'], min);
      const by = new Map(all.map((x) => [key(x.set), x]));
      const rows = levelsOf(['a', 'b', 'c', 'd']).map((r) => r.map((s) => {
        const x = by.get(key(s));
        const cls = (x.maximal ? 'max' : x.closed ? 'closed' : x.frequent ? 'freq' : 'inf') + (key(s) === key(sel) ? ' sel' : '');
        return { set: s, cls, label: `${s.join('')}:${x.count}` };
      }));
      drawLattice(svg, rows, (s) => { sel = s; render(); });
      const f = all.filter((x) => x.frequent), c = all.filter((x) => x.closed), m = all.filter((x) => x.maximal);
      const x = by.get(key(sel));
      const sup = x.supersets;
      let why;
      if (!x.frequent) why = `支持計數 ${x.count} &lt; ${min}，不頻繁，不用判斷閉合或極大。`;
      else if (!sup.length) why = '它沒有超集（已經是全部項目），所以一定閉合也一定極大。';
      else {
        const same = sup.filter((y) => y.count === x.count), fr = sup.filter((y) => y.frequent);
        why = `多一個項目的超集：${sup.map((y) => `${fmtSet(y.set)}:${y.count}`).join('、')}。<br>` +
          (same.length ? `閉合？✗ ${same.map((y) => fmtSet(y.set)).join('、')} 的支持計數一樣是 ${x.count}，回報它就能推回 ${fmtSet(x.set)}。` : `閉合？✓ 每個超集的支持計數都比 ${x.count} 小。`) + '<br>' +
          (fr.length ? `極大？✗ ${fr.map((y) => fmtSet(y.set)).join('、')} 也是頻繁的。` : '極大？✓ 沒有任何超集是頻繁的。');
      }
      out.innerHTML = `<div>頻繁 <strong>${f.length}</strong> 個、閉合 <strong>${c.length}</strong> 個、極大 <strong>${m.length}</strong> 個（不頻繁 ${15 - f.length} 個）</div>` +
        `<div>閉合：${c.map((y) => fmtSet(y.set)).join('、') || '無'}</div>` +
        `<div>極大：${m.map((y) => fmtSet(y.set)).join('、') || '無'}</div>` +
        `<div style="margin-top:6px"><strong>${fmtSet(x.set)}</strong>（支持計數 ${x.count}）：${why}</div>`;
    }
    bindRange(inp, render);
  })();

  /* ===== 剪枝格子圖 ===== */
  (function prune() {
    const svg = $('#prune-svg'), out = $('#prune-out');
    const ITEMS = ['A', 'B', 'C', 'D', 'E'];
    let bad = [['A', 'B']];
    function render() {
      const isSup = (s, b) => b.every((i) => s.includes(i));
      const rows = levelsOf(ITEMS).map((r) => r.map((s) => {
        const self = bad.some((b) => key(b) === key(s));
        const cut = !self && bad.some((b) => isSup(s, b));
        return { set: s, cls: self ? 'inf sel' : cut ? 'inf' : 'freq', label: s.join('') };
      }));
      drawLattice(svg, rows, (s) => {
        const k = key(s);
        bad = bad.some((b) => key(b) === k) ? bad.filter((b) => key(b) !== k) : bad.concat([s]);
        render();
      });
      const cut = rows.flat().filter((n) => n.cls === 'inf').length;
      out.innerHTML = bad.length
        ? `<div>設為不頻繁：${bad.map(fmtSet).join('、')}</div><div>被剪掉、不用計算支持度的超集共 <span class="big">${cut}</span> 個（31 個項目集中）。</div>` +
          `<div class="muted">灰底粗框是你點的不頻繁項目集，其他灰底是被剪掉的超集。{A, B} 的超集有 ABC、ABD、ABE、ABCD、ABCE、ABDE、ABCDE，共 7 個。</div>`
        : '<span class="muted">點任何一格把它設為不頻繁。</span>';
    }
    $('#prune-reset').addEventListener('click', () => { bad = [['A', 'B']]; render(); });
    $('#prune-clear').addEventListener('click', () => { bad = []; render(); });
    render();
  })();

  /* ===== Apriori 與規則 ===== */
  (function aprioriWidget() {
    const sel = $('#ap-data'), minInp = $('#ap-min'), dbBox = $('#ap-db'), out = $('#ap-out');
    const next = $('#ap-next'), all = $('#ap-all'), reset = $('#ap-reset'), countEl = $('#ap-count');
    const conf = $('#ru-conf'), only = $('#ru-only'), rtable = $('#ru-table'), rout = $('#ru-out');
    let res = null, shown = 1;
    const chips = (list, cls) => list.map((x) => `<span class="chip ${cls || ''}">${fmtSet(x.set || x)}${x.count !== undefined ? ':' + x.count : ''}</span>`).join(' ');
    function run() {
      const db = FIM.DATA[sel.value];
      const min = Math.max(1, Number(minInp.value) || 1);
      res = FIM.apriori(db, min);
      dbBox.innerHTML = '<table><tr><th>TID</th><th>項目</th></tr>' + db.map((t) => `<tr><td>${t.tid}</td><td>${t.items.join(', ')}</td></tr>`).join('') + '</table>';
      shown = 1;
      renderLevels();
      renderRules();
    }
    function renderLevels() {
      const min = Math.max(1, Number(minInp.value) || 1);
      const lv = res.levels;
      let h = '';
      lv.slice(0, shown).forEach((l) => {
        h += `<div class="level"><h4>k = ${l.k}</h4>`;
        if (l.k === 1) {
          h += `<div><span class="lab">掃描得 C1</span> ${l.counted.map((c) => `<span class="chip ${c.count >= min ? 'ok' : 'no'}">${fmtSet(c.set)}:${c.count}</span>`).join(' ')}</div>`;
        } else {
          h += `<div><span class="lab">連接得 C${l.k}</span> ${l.joined.length ? l.joined.map((c) => `<span class="chip">${fmtSet(c.set)}</span>`).join(' ') : '<span class="muted">L' + (l.k - 1) + ' 無法再連接，結束</span>'}</div>`;
          if (l.joined.length) {
            h += `<div><span class="lab">剪枝</span> ${l.pruned.length ? l.pruned.map((p) => `<span class="chip cut">${fmtSet(p.set)}（${p.missing.map((m) => m.join('')).join('、')}）</span>`).join(' ') : '<span class="muted">' + (l.k === 2 ? '2-項目集的子集都是頻繁 1-項目集，沒有可剪的' : '沒有') + '</span>'}</div>`;
            h += `<div><span class="lab">掃描計數</span> ${l.counted.length ? l.counted.map((c) => `<span class="chip ${c.count >= min ? 'ok' : 'no'}">${fmtSet(c.set)}:${c.count}</span>`).join(' ') : '<span class="muted">候選全被剪光，不用掃描</span>'}</div>`;
          }
        }
        h += `<div><span class="lab">L${l.k}</span> ${l.L.length ? chips(l.L, 'ok') : '∅'}</div></div>`;
      });
      if (shown >= lv.length) {
        const total = lv.reduce((s, l) => s + l.L.length, 0);
        const cands = lv.slice(1).reduce((s, l) => s + l.joined.length, 0), pr = lv.slice(1).reduce((s, l) => s + l.pruned.length, 0);
        h += `<div class="level"><strong>結束：頻繁項目集共 ${total} 個</strong>（${lv.filter((l) => l.L.length).map((l) => `L${l.k} ${l.L.length} 個`).join('、')}）。連接產生 ${cands} 個候選，其中 ${pr} 個靠剪枝省下計數；共掃描資料庫 ${lv.filter((l) => l.k === 1 || l.counted.length).length} 次。</div>`;
      }
      out.innerHTML = h;
      next.disabled = all.disabled = shown >= lv.length;
      countEl.textContent = `${Math.min(shown, lv.length)}／${lv.length} 層`;
    }
    function renderRules() {
      const mc = Number(conf.value) / 100;
      const rs = FIM.rules(res.freq, mc);
      const n = FIM.DATA[sel.value].length;
      const list = only.checked ? rs.filter((r) => r.ok) : rs;
      let h = '<table><tr><th>來自</th><th>規則</th><th class="num">支持度</th><th class="num">信賴度</th><th>強規則？</th></tr>';
      for (const r of list) {
        h += `<tr class="${r.ok ? '' : 'dim'}"><td class="itemset">${r.from.join('')}</td><td class="itemset">${fmtSet(r.X)} ⇒ ${fmtSet(r.Y)}</td>` +
          `<td class="num">${r.supCount}/${n}</td><td class="num">${r.supCount}/${r.xCount} = ${pct(r.conf)}</td><td class="${r.ok ? 'ok' : 'no'}">${r.ok ? '✓' : '✗'}</td></tr>`;
      }
      rtable.innerHTML = rs.length ? h + '</table>' : '<p class="muted" style="padding:8px 12px;margin:0">沒有大小 ≥ 2 的頻繁項目集，產生不了規則。</p>';
      rout.innerHTML = `候選規則 ${rs.length} 條，信賴度 ≥ ${conf.value}% 的強規則 <span class="big">${rs.filter((r) => r.ok).length}</span> 條。`;
    }
    next.addEventListener('click', () => { shown++; renderLevels(); });
    all.addEventListener('click', () => { shown = res.levels.length; renderLevels(); });
    reset.addEventListener('click', () => { shown = 1; renderLevels(); });
    sel.addEventListener('change', run);
    minInp.addEventListener('input', run);
    only.addEventListener('change', renderRules);
    run();
    bindRange(conf, renderRules);
  })();
})();
