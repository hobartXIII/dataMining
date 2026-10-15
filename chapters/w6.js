/* W6 互動元件 */
(function () {
  'use strict';
  const { $, $$, el, fmtSet, bindRange, drawTree, drawLattice, levelsOf } = DM;
  const { key } = FIM;
  // 課本範例的 F-list 同分時依講義順序（f 在 c 前面）
  const TIE = { textbook: ['f', 'c', 'a', 'b', 'm', 'p'] };
  const DEFMIN = { tdb9: 2, textbook: 3, practice: 2 };

  /* ===== DHP ===== */
  let dhpResult = null;
  const trRender = [];
  (function dhpWidget() {
    const db = FIM.DATA.dhp4;
    const ORDER = { A: 1, B: 2, C: 3, D: 4, E: 5 };
    const inp = $('#dhp-min'), txBox = $('#dhp-tx'), bBox = $('#dhp-buckets'), out = $('#dhp-out');
    let pick = null;
    function render() {
      const min = Number(inp.value);
      const r = FIM.dhp(db, ORDER, 7, min);
      dhpResult = { r, min };
      let h = '<table><tr><th>TID</th><th>項目</th><th>2-子集 → 桶子編號</th></tr>';
      for (const t of r.txPairs) {
        h += `<tr><td>${t.tid}</td><td>${t.items.join(', ')}</td><td>${t.pairs.map((p) => `<span class="chip ${pick !== null && p.bucket === pick ? 'hl' : ''}">${p.set.join('')}→${p.bucket}</span>`).join(' ')}</td></tr>`;
      }
      txBox.innerHTML = h + '</table>';
      bBox.innerHTML = '';
      r.buckets.forEach((b, i) => {
        const btn = el('button', {
          class: 'bucket ' + (b.count >= min ? 'pass' : 'fail'), type: 'button', 'aria-pressed': String(pick === i),
          html: `<div class="a">桶 ${i}</div><div class="n">${b.count}</div><div class="a">${b.items.join(' ') || '—'}</div>`,
        });
        btn.addEventListener('click', () => { pick = pick === i ? null : i; render(); });
        bBox.append(btn);
      });
      const passed = r.c2.filter((c) => c.pass);
      out.innerHTML =
        `<div>\\(L_1\\)：${r.c1.map((c) => `<span class="chip ${c.count >= min ? 'ok' : 'no'}">${c.set[0]}:${c.count}</span>`).join(' ')}</div>` +
        `<div style="margin-top:4px">\\(L_1 \\bowtie L_1\\) 得 ${r.c2.length} 個候選，雜湊過濾：${r.c2.map((c) => `<span class="chip ${c.pass ? 'ok' : 'cut'}">${c.set.join('')}（桶 ${c.bucket}＝${c.bucketCount}）</span>`).join(' ')}</div>` +
        `<div style="margin-top:4px">剩下 \\(C_2\\) ${passed.length} 個，實際計數：${passed.map((c) => `<span class="chip ${c.count >= min ? 'ok' : 'no'}">${c.set.join('')}:${c.count}</span>`).join(' ') || '無'} → \\(L_2\\) = ${r.L2.length ? r.L2.map((s) => s.join('')).join('、') : '∅'}</div>` +
        `<div class="muted" style="margin-top:4px">${pick !== null ? `桶 ${pick} 裝了 ${r.buckets[pick].items.join('、') || '（空的）'}，計數 ${r.buckets[pick].count}。` : '綠色桶子的計數 ≥ min_sup，紅色的 &lt; min_sup。'}${passed.some((c) => c.count < min) ? '　注意：有候選通過了雜湊過濾，實際計數卻不夠，這就是碰撞。' : ''}</div>`;
      DM.renderMath(out);
      trRender.forEach((f) => f());
    }
    bindRange(inp, render);
  })();

  /* ===== 交易縮減 ===== */
  (function trWidget() {
    const tbl = $('#tr-table'), out = $('#tr-out');
    function render() {
      if (!dhpResult) return;
      const { r, min } = dhpResult;
      const rows = FIM.reduceTx(FIM.DATA.dhp4, r.L2, 2);
      let h = '<table><tr><th>TID</th><th>項目</th><th>所含的 L2</th><th>各項目出現次數</th><th>下一輪</th></tr>';
      for (const t of rows) {
        h += `<tr class="${t.removed ? 'dim' : ''}"><td>${t.tid}</td><td>${t.items.join(', ')}</td>` +
          `<td>${t.inside.map((s) => s.join('')).join('、') || '—'}</td>` +
          `<td>${t.items.map((i) => `<span class="chip ${t.occ[i] >= 2 ? 'ok' : 'no'}">${i}:${t.occ[i]}</span>`).join(' ')}</td>` +
          `<td class="${t.removed ? 'no' : 'ok'}">${t.removed ? '整筆移除' : '保留 ' + fmtSet(t.kept)}</td></tr>`;
      }
      tbl.innerHTML = h + '</table>';
      const kept = rows.filter((t) => !t.removed);
      const reduced = kept.map((t) => ({ tid: t.tid, items: t.kept }));
      const L3 = FIM.apriori(reduced, min).levels.find((l) => l.k === 3);
      out.innerHTML = `<div>第三輪只要掃 <strong>${kept.length}</strong> 筆交易（原本 4 筆）：${kept.map((t) => `${t.tid} ${fmtSet(t.kept)}`).join('、') || '沒有交易了'}</div>` +
        `<div>在縮減後的資料上得到 L3 = ${L3 && L3.L.length ? L3.L.map((x) => `${fmtSet(x.set)}:${x.count}`).join('、') : '∅'}</div>` +
        `<div class="muted">min_sup 跟著上面的 DHP 元件；改那裡的門檻，這張表也會一起變。</div>`;
    }
    trRender.push(render);
    render();
  })();

  /* ===== 負邊界 ===== */
  (function nbWidget() {
    const svg = $('#nb-svg'), out = $('#nb-out');
    let items = ['A', 'B', 'C', 'D'];
    let Ls = [['A'], ['C'], ['D'], ['C', 'D']];
    function render() {
      const nb = FIM.negativeBorder(Ls, items);
      const inLs = new Set(Ls.map(key)), inNb = new Set(nb.map(key));
      const rows = levelsOf(items).map((r) => r.map((s) => ({
        set: s, label: s.join(''),
        cls: inLs.has(key(s)) ? 'freq' : inNb.has(key(s)) ? 'max' : 'inf',
      })));
      drawLattice(svg, rows, (s) => {
        const k = key(s);
        Ls = inLs.has(k) ? Ls.filter((x) => key(x) !== k) : Ls.concat([s]);
        render();
      });
      const closedDown = Ls.every((s) => s.length === 1 || FIM.subsetsMinusOne(s).every((x) => inLs.has(key(x))));
      out.innerHTML = `<div>\\(L_S\\) = ${Ls.length ? Ls.slice().sort((a, b) => a.length - b.length || FIM.cmp(key(a), key(b))).map(fmtSet).join('、') : '∅'}</div>` +
        `<div>負邊界 = <strong>${nb.map(fmtSet).join('、') || '∅'}</strong></div>` +
        `<div class="muted">驗證時要掃描的項目集：\\(L_S\\) ${Ls.length} 個 ＋ 負邊界 ${nb.length} 個。如果負邊界裡任何一個在全資料庫上是頻繁的，抽樣就失敗。</div>` +
        (closedDown ? '' : '<div class="bad">注意：\\(L_S\\) 裡有項目集的子集不在 \\(L_S\\)，真正的頻繁項目集不會這樣（違反 Apriori 性質）。</div>');
      DM.renderMath(out);
    }
    $('#nb-lec').addEventListener('click', () => { items = ['A', 'B', 'C', 'D']; Ls = [['A'], ['C'], ['D'], ['C', 'D']]; render(); });
    $('#nb-q').addEventListener('click', () => { items = ['A', 'B', 'C', 'D', 'E']; Ls = [['A'], ['B'], ['C'], ['A', 'C']]; render(); });
    $('#nb-clear').addEventListener('click', () => { Ls = []; render(); });
    render();
  })();

  /* ===== 逐筆建 FP-tree ===== */
  (function fptree() {
    const sel = $('#ft-data'), minInp = $('#ft-min');
    const flBox = $('#ft-flist'), tbl = $('#ft-table'), hdr = $('#ft-header'), svg = $('#ft-svg'), out = $('#ft-out');
    const next = $('#ft-next'), all = $('#ft-all'), reset = $('#ft-reset'), cnt = $('#ft-count');
    let F = null, ordered = [], shown = 0, hl = null;
    function prep() {
      const db = FIM.DATA[sel.value];
      const min = Math.max(1, Number(minInp.value) || 1);
      F = FIM.flist(db, min, TIE[sel.value]);
      ordered = FIM.normalize(db).map((t) => ({ tid: t.tid, raw: db.find((x) => x.tid === t.tid).items, items: FIM.orderTx(t.items, F.items), w: 1 }));
      flBox.innerHTML = `<div>第一次掃描：${Object.keys(F.counts).sort((a, b) => F.counts[b] - F.counts[a] || FIM.cmp(a, b)).map((i) => `<span class="chip ${F.counts[i] >= min ? 'ok' : 'no'}">${i}:${F.counts[i]}</span>`).join(' ')}</div>` +
        `<div>F-list = <strong class="itemset">${F.items.join('-') || '（沒有頻繁項目）'}</strong>${F.removed.length ? `　<span class="muted">刪掉不頻繁的 ${F.removed.join('、')}</span>` : ''}</div>`;
      shown = 0; hl = null;
      render();
    }
    function render() {
      const tree = FIM.fpTree(ordered.slice(0, shown), F.items);
      const fresh = new Set(shown ? tree.paths[shown - 1] : []);
      let h = '<table><tr><th>TID</th><th>原始項目</th><th>依 F-list 排序</th></tr>';
      ordered.forEach((t, i) => {
        h += `<tr class="${i === shown - 1 ? 'hit' : i >= shown ? 'dim' : ''}"><td>${t.tid}</td><td>${t.raw.join(', ')}</td><td class="itemset">${t.items.join(', ') || '—'}</td></tr>`;
      });
      tbl.innerHTML = h + '</table>';
      let hh = '<table><tr><th>標頭表</th><th class="num">計數</th><th class="num">節點</th></tr>';
      for (const it of F.items) {
        const nodes = tree.header.get(it) || [];
        const c = nodes.reduce((s, n) => s + n.count, 0);
        hh += `<tr class="${hl === it ? 'hit' : ''}" data-it="${it}" style="cursor:pointer"><td><strong>${it}</strong></td><td class="num">${c}</td><td class="num">${nodes.length}</td></tr>`;
      }
      hdr.innerHTML = hh + '</table>';
      $$('tr[data-it]', hdr).forEach((tr) => tr.addEventListener('click', () => { hl = hl === tr.dataset.it ? null : tr.dataset.it; render(); }));
      drawTree(svg, tree.root, { hl, fresh, links: true });
      const t = ordered[shown - 1];
      out.innerHTML = shown === 0 ? '<span class="muted">按「插入下一筆」開始，一開始只有根節點 null{}。</span>'
        : `<div>插入 ${t.tid}：<span class="itemset">${t.items.join(' → ') || '（沒有頻繁項目，不用插入）'}</span></div>` +
          `<div class="muted">${describe(tree, shown - 1)}</div>` +
          (shown === ordered.length ? `<div style="margin-top:4px"><strong>完成：</strong>樹上共 ${countNodes(tree.root) - 1} 個節點（不含根），原始資料共 ${ordered.reduce((s, x) => s + x.items.length, 0)} 個頻繁項目，共用前綴省下 ${ordered.reduce((s, x) => s + x.items.length, 0) - (countNodes(tree.root) - 1)} 個。</div>` : '');
      next.disabled = all.disabled = shown >= ordered.length;
      cnt.textContent = `${shown}／${ordered.length} 筆`;
    }
    function countNodes(n) { return 1 + n.children.reduce((s, c) => s + countNodes(c), 0); }
    function describe(tree, i) {
      // 比對前一棵樹，找出哪些節點是共用的、哪些是新開的
      const prev = FIM.fpTree(ordered.slice(0, i), F.items);
      const items = ordered[i].items;
      let cur = prev.root, shared = 0;
      for (const it of items) {
        const ch = cur.children.find((c) => c.item === it);
        if (!ch) break;
        shared++; cur = ch;
      }
      if (!items.length) return '這筆交易的項目都不頻繁。';
      if (shared === items.length) return `整條路徑都已經存在，${items.join('、')} 的計數各 +1。`;
      if (!shared) return `沒有可以共用的前綴，從根開新分支：${items.join(' → ')}。`;
      return `共用前綴 ${items.slice(0, shared).join(' → ')}（計數 +1），從 ${items[shared - 1]} 底下開新分支：${items.slice(shared).join(' → ')}。`;
    }
    next.addEventListener('click', () => { shown++; render(); });
    all.addEventListener('click', () => { shown = ordered.length; render(); });
    reset.addEventListener('click', () => { shown = 0; render(); });
    sel.addEventListener('change', () => { minInp.value = DEFMIN[sel.value]; prep(); });
    minInp.addEventListener('input', prep);
    prep();
  })();

  /* ===== FP-Growth 探勘 ===== */
  (function fpg() {
    const sel = $('#fg-data'), minInp = $('#fg-min'), seg = $('#fg-items');
    const out = $('#fg-out'), svg = $('#fg-svg'), tbl = $('#fg-table'), sum = $('#fg-sum');
    let M = null, cur = null;
    const pat = (p) => `<span class="chip ok">${fmtSet(p.set)}:${p.count}</span>`;
    function run() {
      const min = Math.max(1, Number(minInp.value) || 1);
      M = FIM.fpMine(FIM.DATA[sel.value], min, TIE[sel.value]);
      cur = M.rows.length ? M.rows[0].item : null;
      seg.innerHTML = '';
      for (const r of M.rows) {
        const b = el('button', { class: 'btn', type: 'button', text: r.item });
        b.addEventListener('click', () => { cur = r.item; render(); });
        seg.append(b);
      }
      let h = '<table><tr><th>後綴</th><th>條件樣式基底</th><th>條件 FP-tree</th><th>頻繁樣式</th></tr>';
      for (const r of M.rows) {
        h += `<tr data-row="${r.item}"><td><strong>${r.item}</strong></td><td class="itemset">${r.base.map((b) => `{${b.path.join(', ')}: ${b.count}}`).join(' ') || '空'}</td>` +
          `<td class="itemset">${treeText(r.condTree.root) || '無'}</td><td>${r.patterns.map(pat).join(' ')}</td></tr>`;
      }
      tbl.innerHTML = h + '</table>';
      $$('tr[data-row]', tbl).forEach((tr) => tr.addEventListener('click', () => { cur = tr.dataset.row; render(); }));
      sum.innerHTML = `F-list = <span class="itemset">${M.fl.join('-')}</span>，頻繁項目集合計 <span class="big">${M.all.length}</span> 個（Apriori 驗算：${FIM.apriori(FIM.DATA[sel.value], min).freq.size} 個）。`;
      render();
    }
    // 條件樹寫成路徑：⟨b:4, a:2⟩、⟨a:2⟩
    function treeText(root) {
      const paths = [];
      (function walk(n, acc) {
        const next = n.item === null ? acc : acc.concat([`${n.item}:${n.count}`]);
        if (!n.children.length) { if (next.length) paths.push(next); return; }
        n.children.forEach((c) => walk(c, next));
      })(root, []);
      return paths.map((p) => `⟨${p.join(', ')}⟩`).join('、');
    }
    function render() {
      $$('button', seg).forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === cur)));
      $$('tr[data-row]', tbl).forEach((tr) => tr.classList.toggle('hit', tr.dataset.row === cur));
      const r = M.rows.find((x) => x.item === cur);
      if (!r) { out.innerHTML = '<span class="muted">沒有頻繁項目。</span>'; svg.innerHTML = ''; return; }
      const min = Math.max(1, Number(minInp.value) || 1);
      const counts = M.fl.filter((i) => r.cnt[i]).map((i) => `<span class="chip ${r.cnt[i] >= min ? 'ok' : 'no'}">${i}:${r.cnt[i]}</span>`).join(' ');
      let how;
      if (!r.base.length) how = `${r.item} 的上面就是根，沒有前綴路徑，只有 {${r.item}} 本身。`;
      else if (!r.kept.length) how = '基底中沒有項目達到 min_sup，條件 FP-tree 是空的，只有後綴本身。';
      else if (r.single) how = `條件 FP-tree 是單一路徑，直接列出 ${r.kept.join('、')} 的所有組合再接上 ${r.item}，支持度取組合中最小的節點計數。`;
      else how = '條件 FP-tree 有分支，要對它的每個項目再遞迴一次（下面的樣式已經包含遞迴的結果）。';
      out.innerHTML = `<div><strong>後綴 ${r.item}</strong>（總計數 ${M.F.counts[r.item]}，樹中 ${M.tree.header.get(r.item).length} 個節點）</div>` +
        `<div>條件樣式基底：<span class="itemset">${r.base.map((b) => `{${b.path.join(', ')}: ${b.count}}`).join('、') || '空'}</span></div>` +
        `<div>基底中各項目計數：${counts || '—'}</div>` +
        `<div>${how}</div>` +
        `<div style="margin-top:4px">頻繁樣式：${r.patterns.map(pat).join(' ')}</div>`;
      drawTree(svg, r.condTree.root, {});
    }
    sel.addEventListener('change', () => { minInp.value = DEFMIN[sel.value]; run(); });
    minInp.addEventListener('input', run);
    run();
  })();
})();
