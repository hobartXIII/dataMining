/* W11 互動元件：Minkowski、非對稱二元、Gower、K-means／DBSCAN、階層式分群 */
(function () {
  'use strict';
  const { $, $$, el, fmt, tex, rng, gauss, bindRange } = DM;
  const f3 = (x) => x.toFixed(3);
  const PAL = ['var(--c-a)', 'var(--c-b)', 'var(--c-c)', 'var(--pos)', '#9b59b6', '#16a3b8', '#e67e22', '#8a8f98'];
  const dotStyle = (k) => (k < 0 ? '' : `style="fill:color-mix(in srgb, ${PAL[k % PAL.length]} 38%, var(--surface));stroke:${PAL[k % PAL.length]}"`);

  /* ===== Minkowski ===== */
  (function distWidget() {
    const ids = ['#ds-a1', '#ds-a2', '#ds-b1', '#ds-b2'], ins = ids.map((s) => $(s));
    const hIn = $('#ds-h'), svg = $('#ds-svg'), out = $('#ds-out');
    const isInf = (h) => h >= 11;
    function render() {
      const [a1, a2, b1, b2] = ins.map((i) => Number(i.value) || 0), h = Number(hIn.value);
      const dx = Math.abs(a1 - b1), dy = Math.abs(a2 - b2);
      const dh = isInf(h) ? Math.max(dx, dy) : Math.pow(dx ** h + dy ** h, 1 / h);
      // 單位圓
      const W = 200, H = 200, C = 100, S = 70;
      let g = `<path class="grid" d="M${C} 10 V190 M10 ${C} H190"/>`;
      const shape = (hh, cls) => {
        let d = '';
        for (let i = 0; i <= 360; i++) {
          const t = (i / 360) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t);
          let x, y;
          if (hh === Infinity) { const m = Math.max(Math.abs(c), Math.abs(s)); x = c / m; y = s / m; } else {
            const n = Math.pow(Math.abs(c) ** hh + Math.abs(s) ** hh, 1 / hh); x = c / n; y = s / n;
          }
          d += (i ? 'L' : 'M') + (C + S * x).toFixed(1) + ' ' + (C - S * y).toFixed(1);
        }
        return `<path class="${cls}" d="${d}"/>`;
      };
      g += shape(1, 'line dash') + shape(2, 'line dash') + shape(Infinity, 'line dash');
      g += shape(isInf(h) ? Infinity : h, 'line acc');
      g += `<text class="tick" x="${C + S + 4}" y="${C - 8}">1</text>`;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      out.innerHTML = '<div id="ds-f"></div>' +
        `<div style="margin-top:6px">L₁ = ${fmt(dx + dy, 4)}、L₂ = ${fmt(Math.hypot(dx, dy), 4)}、L∞ = ${fmt(Math.max(dx, dy), 4)}</div>` +
        `<div class="muted">虛線由內而外是 h = 1（菱形）、h = 2（圓）、h = ∞（正方形）；實線是目前的 h。h 越大，距離越被「差最多的那一維」主導。</div>`;
      tex($('#ds-f', out), isInf(h)
        ? `L_\\infty = \\max(|${a1} - ${b1}|, |${a2} - ${b2}|) = \\max(${dx}, ${dy}) = ${fmt(dh, 4)}`
        : `L_{${fmt(h, 1)}} = \\left(|${a1} - ${b1}|^{${fmt(h, 1)}} + |${a2} - ${b2}|^{${fmt(h, 1)}}\\right)^{1/${fmt(h, 1)}} = ${fmt(dh, 4)}`);
    }
    ins.forEach((i) => i.addEventListener('input', render));
    bindRange(hIn, render, (v) => (isInf(v) ? '∞' : fmt(v, 1)));
  })();

  /* ===== 非對稱二元 ===== */
  (function binWidget() {
    const names = ['Jack', 'Mary', 'Jim'];
    const attrs = ['發燒', '咳嗽', 'test-1', 'test-2', 'test-3', 'test-4'];
    const raw = [['M', 'Y', 'N', 'P', 'N', 'N', 'N'], ['F', 'Y', 'N', 'P', 'N', 'P', 'N'], ['M', 'Y', 'P', 'N', 'N', 'N', 'N']];
    const bits = raw.map((r) => r.slice(1).map((v) => (v === 'Y' || v === 'P' ? 1 : 0)));
    const tbl = $('#bn-table'), seg = $('#bn-pairs'), out = $('#bn-out');
    let pair = [0, 1];
    function render() {
      const [i, j] = pair, A = bits[i], B = bits[j];
      let h = `<table><tr><th>姓名</th><th>性別</th>${attrs.map((a) => `<th>${a}</th>`).join('')}</tr>`;
      raw.forEach((r, k) => {
        const on = k === i || k === j;
        h += `<tr class="${on ? 'hit' : 'dim'}"><td>${names[k]}</td><td class="muted">${r[0]}</td>${r.slice(1).map((v, a) => {
          const tag = on ? (A[a] && B[a] ? 'ok' : A[a] !== B[a] ? 'no' : '') : '';
          return `<td class="${tag}">${v}<span class="muted"> (${bits[k][a]})</span></td>`;
        }).join('')}</tr>`;
      });
      tbl.innerHTML = h + '</table>';
      let q = 0, r = 0, s = 0, t = 0;
      A.forEach((a, k) => { const b = B[k]; if (a && b) q++; else if (a && !b) r++; else if (!a && b) s++; else t++; });
      const asym = (r + s) / (q + r + s), sym = (r + s) / (q + r + s + t);
      out.innerHTML = `<div>${names[i]}（列）對 ${names[j]}（欄）的列聯表：q = ${q}（都是 1）、r = ${r}（${names[i]} 1、${names[j]} 0）、s = ${s}（${names[i]} 0、${names[j]} 1）、t = ${t}（都是 0）</div>` +
        '<div id="bn-f1"></div><div id="bn-f2"></div>' +
        `<div class="muted">t = ${t} 很大（大部分檢驗兩人都是陰性），對稱版把它算進分母，兩人看起來就比實際更相似；所以疾病資料用非對稱版。表格中綠色是 q、紅色是 r 或 s。</div>`;
      tex($('#bn-f1', out), `d_{asym}(\\text{${names[i]}}, \\text{${names[j]}}) = \\frac{${r} + ${s}}{${q} + ${r} + ${s}} = ${fmt(asym, 2)}`);
      tex($('#bn-f2', out), `d_{sym} = \\frac{${r} + ${s}}{${q} + ${r} + ${s} + ${t}} = ${fmt(sym, 2)}`);
      $$('button', seg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.p === pair.join())));
    }
    [[0, 1], [0, 2], [2, 1]].forEach((p) => {
      const b = el('button', { class: 'btn', type: 'button', text: `${names[p[0]]} × ${names[p[1]]}`, 'data-p': p.join() });
      b.addEventListener('click', () => { pair = p; render(); });
      seg.append(b);
    });
    render();
  })();

  /* ===== 混合型（Gower） ===== */
  (function mixedWidget() {
    const objs = [['code A', 'excellent', 45], ['code B', 'fair', 22], ['code C', 'good', 64], ['code A', 'excellent', 28]];
    const rank = { fair: 1, good: 2, excellent: 3 };
    const z = (v) => (rank[v] - 1) / 2;
    const nums = objs.map((o) => o[2]), lo = Math.min(...nums), hi = Math.max(...nums);
    const dataBox = $('#mx-data'), mat = $('#mx-mat'), out = $('#mx-out'), uses = $$('.mx-use');
    let cell = [1, 0];
    dataBox.innerHTML = '<table><tr><th>物件</th><th>test-1（名目）</th><th>test-2（順序）</th><th>z = (r − 1)/(M − 1)</th><th>test-3（數值）</th></tr>' +
      objs.map((o, i) => `<tr><td>${i + 1}</td><td>${o[0]}</td><td>${o[1]}</td><td class="num">${fmt(z(o[1]), 2)}</td><td class="num">${o[2]}</td></tr>`).join('') + '</table>';
    const parts = (i, j) => [objs[i][0] === objs[j][0] ? 0 : 1, Math.abs(z(objs[i][1]) - z(objs[j][1])), Math.abs(objs[i][2] - objs[j][2]) / (hi - lo)];
    function render() {
      const on = uses.map((u) => u.checked);
      const cnt = on.filter(Boolean).length;
      const d = (i, j) => (cnt ? parts(i, j).reduce((s, v, k) => s + (on[k] ? v : 0), 0) / cnt : 0);
      let h = '<table style="width:auto"><tr><th></th>' + objs.map((_, j) => `<th class="num">${j + 1}</th>`).join('') + '</tr>';
      objs.forEach((_, i) => {
        h += `<tr><th>${i + 1}</th>` + objs.map((__, j) => {
          if (j > i) return '<td></td>';
          if (j === i) return '<td class="num muted">0</td>';
          const sel = cell[0] === i && cell[1] === j;
          return `<td class="num click${sel ? ' ok' : ''}" data-c="${i},${j}" style="cursor:pointer${sel ? ';outline:2px solid var(--accent)' : ''}">${fmt(d(i, j), 3)}</td>`;
        }).join('') + '</tr>';
      });
      mat.innerHTML = `<div class="table-wrap" style="margin:0">${h}</table></div>`;
      $$('td[data-c]', mat).forEach((td) => td.addEventListener('click', () => { cell = td.dataset.c.split(',').map(Number); render(); }));
      const [i, j] = cell, p = parts(i, j);
      if (!cnt) { out.innerHTML = '<span class="muted">至少勾一個屬性。</span>'; return; }
      const lines = [];
      if (on[0]) lines.push(`test-1：${objs[i][0]} vs. ${objs[j][0]} → ${p[0] ? '不同 → 1' : '相同 → 0'}`);
      if (on[1]) lines.push(`test-2：${objs[i][1]}（${fmt(z(objs[i][1]), 2)}） vs. ${objs[j][1]}（${fmt(z(objs[j][1]), 2)}） → ${fmt(p[1], 3)}`);
      if (on[2]) lines.push(`test-3：|${objs[i][2]} − ${objs[j][2]}| / (${hi} − ${lo}) = ${Math.abs(objs[i][2] - objs[j][2])}/${hi - lo} = ${fmt(p[2], 3)}`);
      out.innerHTML = `<div><strong>d(${i + 1}, ${j + 1})</strong></div><div style="font-size:.92rem">${lines.join('<br>')}</div><div id="mx-f" style="margin-top:6px"></div>` +
        `<div class="muted">${cnt === 1 && on[0] ? '只用 test-1：講義第 27 頁的名目相異度矩陣，只有物件 1、4 都是 code A，d(4, 1) = 0。' : cnt === 3 ? '三個屬性權重都是 1，Gower 距離就是三者的平均。' : '只用勾選的屬性平均。'}</div>`;
      const used = p.filter((_, k) => on[k]);
      tex($('#mx-f', out), `d(${i + 1}, ${j + 1}) = \\frac{${used.map((v) => fmt(v, 3)).join(' + ')}}{${cnt}} = ${f3(used.reduce((a, b) => a + b, 0) / cnt)}`);
    }
    uses.forEach((u) => u.addEventListener('change', render));
    render();
  })();

  /* ===== K-means／DBSCAN ===== */
  (function kmWidget() {
    const svg = $('#km-svg'), esvg = $('#km-elbow'), out = $('#km-out');
    const dataSel = $('#km-data'), algoSel = $('#km-algo'), kIn = $('#km-k'), initSel = $('#km-init');
    const epsIn = $('#db-eps'), minIn = $('#db-min');
    const W = 420, H = 300, L = 10, R = 10, T = 10, B = 10, XR = 10, YR = (10 * (H - T - B)) / (W - L - R);
    const X = (v) => L + (v / XR) * (W - L - R), Y = (v) => T + (1 - v / YR) * (H - T - B);
    const DATA = {};
    (function make() {
      const blob = (r, n, cx, cy, sd) => Array.from({ length: n }, () => [cx + sd * gauss(r), cy + sd * gauss(r)]);
      let r = rng(31);
      DATA.blobs = [].concat(blob(r, 25, 2.6, 4.9, 0.6), blob(r, 25, 7.2, 5.1, 0.6), blob(r, 25, 5, 1.9, 0.6));
      r = rng(32);
      DATA.uneven = [].concat(blob(r, 60, 3.2, 3.5, 1.15), blob(r, 10, 8, 5.6, 0.3), blob(r, 10, 8.2, 1.4, 0.3));
      r = rng(33);
      const moons = [];
      for (let i = 0; i < 40; i++) { const t = Math.PI * r(); moons.push([1.6 + 2.4 * (Math.cos(t) + 1) + 0.18 * gauss(r), 2.4 + 2.4 * Math.sin(t) + 0.18 * gauss(r)]); }
      for (let i = 0; i < 40; i++) { const t = Math.PI * r(); moons.push([1.6 + 2.4 * (2 - Math.cos(t)) + 0.18 * gauss(r), 2.4 + 2.4 * (0.5 - Math.sin(t)) + 0.18 * gauss(r)]); }
      DATA.moons = moons;
      r = rng(34);
      DATA.outlier = [].concat(blob(r, 25, 2.5, 3.5, 0.55), blob(r, 25, 5.5, 3.5, 0.55), [[9.6, 6.7], [9.3, 6.9], [9.7, 6.3]]);
    })();
    const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
    let P, C, A, phase, iter, done, lastChanged, seed = 100, elbowCache = {};
    function initCenters(pts, K, how, r) {
      if (how === 'rand') {
        const idx = pts.map((_, i) => i);
        for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
        return idx.slice(0, K).map((i) => pts[i].slice());
      }
      const c = [pts[Math.floor(r() * pts.length)].slice()];
      while (c.length < K) {
        const D = pts.map((p) => Math.min(...c.map((q) => d2(p, q))));
        const tot = D.reduce((a, b) => a + b, 0);
        let u = r() * tot, k = 0;
        while (k < D.length - 1 && u > D[k]) { u -= D[k]; k++; }
        c.push(pts[k].slice());
      }
      return c;
    }
    function nearest(p, cs) { let b = 0; for (let k = 1; k < cs.length; k++) if (d2(p, cs[k]) < d2(p, cs[b])) b = k; return b; }
    function means(pts, as, cs) {
      return cs.map((c, k) => {
        const m = pts.filter((_, i) => as[i] === k);
        return m.length ? [m.reduce((s, p) => s + p[0], 0) / m.length, m.reduce((s, p) => s + p[1], 0) / m.length] : c;
      });
    }
    const sse = (pts, as, cs) => pts.reduce((s, p, i) => s + (as[i] >= 0 ? d2(p, cs[as[i]]) : 0), 0);
    function runFull(pts, K, r) {
      let cs = initCenters(pts, K, 'pp', r), as = pts.map(() => -1);
      for (let it = 0; it < 100; it++) {
        const na = pts.map((p) => nearest(p, cs));
        const ch = na.some((a, i) => a !== as[i]);
        as = na; cs = means(pts, as, cs);
        if (!ch) break;
      }
      return sse(pts, as, cs);
    }
    function elbow(key) {
      if (!elbowCache[key]) {
        const r = rng(77);
        elbowCache[key] = Array.from({ length: 8 }, (_, k) => Math.min(...Array.from({ length: 10 }, () => runFull(DATA[key], k + 1, r))));
      }
      return elbowCache[key];
    }
    function silhouette(pts, as) {
      const K = Math.max(...as) + 1;
      if (K < 2) return null;
      let tot = 0, n = 0;
      pts.forEach((p, i) => {
        if (as[i] < 0) return;
        const avg = new Array(K).fill(0), cnt = new Array(K).fill(0);
        pts.forEach((q, j) => { if (j !== i && as[j] >= 0) { avg[as[j]] += Math.sqrt(d2(p, q)); cnt[as[j]]++; } });
        if (!cnt[as[i]]) return;
        const a = avg[as[i]] / cnt[as[i]];
        let b = Infinity;
        for (let k = 0; k < K; k++) if (k !== as[i] && cnt[k]) b = Math.min(b, avg[k] / cnt[k]);
        if (!isFinite(b)) return;
        tot += (b - a) / Math.max(a, b); n++;
      });
      return n ? tot / n : null;
    }
    function reset() {
      P = DATA[dataSel.value];
      C = initCenters(P, Number(kIn.value), initSel.value, rng(seed++));
      A = P.map(() => -1); phase = 'assign'; iter = 0; done = false; lastChanged = null;
      render();
    }
    function step() {
      if (done) return;
      if (phase === 'assign') {
        const na = P.map((p) => nearest(p, C));
        lastChanged = na.filter((a, i) => a !== A[i]).length;
        A = na; phase = 'update'; iter++;
        if (lastChanged === 0) done = true;
      } else {
        C = means(P, A, C); phase = 'assign';
      }
      render();
    }
    function dbscan(pts, eps, minPts) {
      const nb = pts.map((p) => pts.map((q, j) => j).filter((j) => d2(p, pts[j]) <= eps * eps));
      const core = nb.map((n) => n.length >= minPts);
      const lab = pts.map(() => -1);
      let c = 0;
      pts.forEach((_, i) => {
        if (lab[i] >= 0 || !core[i]) return;
        const stack = [i]; lab[i] = c;
        while (stack.length) {
          const u = stack.pop();
          if (!core[u]) continue;
          for (const v of nb[u]) if (lab[v] < 0) { lab[v] = c; stack.push(v); }
        }
        c++;
      });
      return { lab, core, n: c };
    }
    function drawElbow(key, K) {
      const e = elbow(key), Wd = 220, Hd = 180, l = 34, rr = 8, t = 12, b = 26;
      const mx = e[0];
      const XX = (k) => l + ((k - 1) / 7) * (Wd - l - rr), YY = (v) => t + (1 - v / mx) * (Hd - t - b);
      let g = `<path class="axis" d="M${l} ${t} V${Hd - b} H${Wd - rr}"/>`;
      for (let k = 1; k <= 8; k++) g += `<text class="tick" x="${XX(k)}" y="${Hd - b + 12}" text-anchor="middle">${k}</text>`;
      g += `<text class="tick" x="${Wd - rr}" y="${Hd - 4}" text-anchor="end">K</text><text class="tick" x="${l + 4}" y="${t + 2}">SSE</text>`;
      g += `<path class="line acc" d="${e.map((v, k) => (k ? 'L' : 'M') + XX(k + 1).toFixed(1) + ' ' + YY(v).toFixed(1)).join('')}"/>`;
      e.forEach((v, k) => { g += `<circle class="${k + 1 === K ? 'q' : 'dot'}" cx="${XX(k + 1)}" cy="${YY(v)}" r="${k + 1 === K ? 6 : 3}"/>`; });
      esvg.setAttribute('viewBox', `0 0 ${Wd} ${Hd}`);
      esvg.innerHTML = g;
    }
    function render() {
      const isDB = algoSel.value === 'dbscan';
      $('#km-ctl').hidden = isDB; $('#db-ctl').hidden = !isDB;
      P = DATA[dataSel.value];
      let g = '';
      if (isDB) {
        const eps = Number(epsIn.value), mp = Number(minIn.value), r = dbscan(P, eps, mp);
        P.forEach((p, i) => {
          g += `<circle class="p${r.lab[i] < 0 ? ' cn' : ''}" ${dotStyle(r.lab[i])} cx="${X(p[0])}" cy="${Y(p[1])}" r="${r.core[i] ? 5.5 : 3.8}"/>`;
        });
        g += `<circle class="ring" cx="${X(9) }" cy="${Y(YR - 0.6)}" r="${(eps / XR) * (W - L - R)}" style="stroke-dasharray:3 3;opacity:.6"/><text class="tick" x="${X(9)}" y="${Y(YR - 0.6)}" text-anchor="middle">ε</text>`;
        const noise = r.lab.filter((l) => l < 0).length;
        const sil = silhouette(P, r.lab);
        out.innerHTML = `<div>ε = ${fmt(eps, 2)}、MinPts = ${mp}：找到 <span class="big">${r.n}</span> 群、雜訊 ${noise} 點（虛線空心）；大點是核心點、小點是邊界點。</div>` +
          `<div class="muted">${dataSel.value === 'moons' ? 'DBSCAN 沿著密集區域往外長，能把兩個月牙分開，K-means 做不到。' : dataSel.value === 'outlier' ? '右上角的離群值被標成雜訊，不會影響其他群。' : 'ε 太小：很多點變雜訊、群被切碎；ε 太大：不同群被連在一起。'}${sil !== null ? ` 輪廓係數（不含雜訊）= ${fmt(sil, 3)}。` : ''}</div>`;
        drawElbow(dataSel.value, -1);
      } else {
        const K = C.length;
        P.forEach((p, i) => { g += `<circle class="p${A[i] < 0 ? ' cn' : ''}" ${dotStyle(A[i])} cx="${X(p[0])}" cy="${Y(p[1])}" r="4.2"/>`; });
        if (phase === 'update' && !done) {
          // 預告新中心
          means(P, A, C).forEach((c, k) => { g += `<path class="nbline" d="M${X(C[k][0])} ${Y(C[k][1])} L${X(c[0])} ${Y(c[1])}"/>`; });
        }
        C.forEach((c, k) => {
          const x = X(c[0]), y = Y(c[1]);
          g += `<path class="ctr" d="M${x - 8} ${y - 8} L${x + 8} ${y + 8} M${x + 8} ${y - 8} L${x - 8} ${y + 8}" style="stroke:${PAL[k % PAL.length]};stroke-width:4"/><path class="ctr" d="M${x - 8} ${y - 8} L${x + 8} ${y + 8} M${x + 8} ${y - 8} L${x - 8} ${y + 8}" style="stroke-width:1.2"/>`;
        });
        const s = A[0] >= 0 ? sse(P, A, C) : null;
        let msg;
        if (A[0] < 0) msg = `已選好 ${K} 個初始中心（×）${initSel.value === 'pp' ? '，K-means++：後面的中心傾向選離前面遠的點' : '，隨機挑 K 個資料點'}。下一步：每個點分給最近的中心。`;
        else if (done) msg = `第 ${iter} 次分配後沒有任何點換群 → <strong>收斂</strong>。`;
        else if (phase === 'update') msg = `第 ${iter} 次分配：${lastChanged} 個點換了群。下一步：把每個中心移到群的平均（虛線是移動方向）。`;
        else msg = `中心已更新。下一步：重新分配。`;
        const sil = done ? silhouette(P, A) : null;
        const hint = { uneven: '大群被切開、小群被併：K-means 的邊界在兩個中心的正中間，群大小差很多時會出錯。', moons: 'K-means 用直線切開，兩個月牙各被切成兩半：它找不出非凸的群。', outlier: 'K = 3 時，常常有一個中心被右上角的 3 個離群值拉走，或把離群值硬併進某一群、拉偏中心。', blobs: '換「重新初始化」幾次（尤其用隨機初始化）：有時兩個中心落在同一群，收斂到 SSE 較高的區域最小值。' }[dataSel.value];
        out.innerHTML = `<div>${msg}</div>` + (s !== null ? `<div>SSE = <span class="big">${fmt(s, 3)}</span>（手肘圖中 K = ${K} 的最佳值 ${fmt(elbow(dataSel.value)[K - 1], 3)}）${sil !== null ? `，輪廓係數 = ${fmt(sil, 3)}` : ''}</div>` : '') +
          `<div class="muted">${hint}</div>`;
        $('#km-step').disabled = $('#km-run').disabled = done;
        $('#km-step').textContent = phase === 'assign' ? '分配 ▶' : '更新中心 ▶';
        drawElbow(dataSel.value, K);
      }
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
    }
    $('#km-step').addEventListener('click', step);
    $('#km-run').addEventListener('click', () => { let n = 0; while (!done && n++ < 400) step(); });
    $('#km-reinit').addEventListener('click', reset);
    initSel.addEventListener('change', reset);
    // 每份資料一個合適的 ε 預設值（月牙形的點比較稀，要大一點才連得起來）
    const EPS = { blobs: 0.8, uneven: 0.9, moons: 1.05, outlier: 0.7 };
    dataSel.addEventListener('change', () => { epsIn.value = EPS[dataSel.value]; P = null; epsIn.dispatchEvent(new Event('input')); reset(); });
    algoSel.addEventListener('change', render);
    bindRange(epsIn, () => { if (P) render(); }, (v) => fmt(v, 2));
    bindRange(minIn, () => { if (P) render(); });
    bindRange(kIn, () => reset());
  })();

  /* ===== 階層式分群 ===== */
  (function hierWidget() {
    const D = [
      [0, 2.3, 3.4, 1.2, 3.7],
      [2.3, 0, 2.0, 1.8, 2.2],
      [3.4, 2.0, 0, 4.2, 0.7],
      [1.2, 1.8, 4.2, 0, 4.4],
      [3.7, 2.2, 0.7, 4.4, 0],
    ];
    const link = $('#hc-link'), mat = $('#hc-mat'), svg = $('#hc-svg'), out = $('#hc-out'), cnt = $('#hc-count');
    let step = 0, full;
    const dist = (a, b, how) => {
      const ds = []; for (const i of a) for (const j of b) ds.push(D[i][j]);
      return how === 'single' ? Math.min(...ds) : how === 'complete' ? Math.max(...ds) : ds.reduce((s, v) => s + v, 0) / ds.length;
    };
    const name = (c) => c.map((i) => i + 1).sort((a, b) => a - b).join(',');
    function compute() {
      let cl = [[0], [1], [2], [3], [4]];
      const merges = [];
      while (cl.length > 1) {
        let best = null;
        for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) {
          const d = dist(cl[i], cl[j], link.value);
          if (!best || d < best.d - 1e-12) best = { i, j, d };
        }
        merges.push({ a: cl[best.i], b: cl[best.j], h: best.d, before: cl.map((c) => c.slice()) });
        const m = cl[best.i].concat(cl[best.j]);
        cl = cl.filter((_, k) => k !== best.i && k !== best.j).concat([m]);
      }
      return merges;
    }
    function render() {
      cnt.textContent = `${step}／4 次合併`;
      $('#hc-next').disabled = step >= 4;
      const cur = step < 4 ? full[step].before : [[0, 1, 2, 3, 4]];
      const nxt = step < 4 ? full[step] : null;
      // 目前的鄰近度矩陣
      let h = '<table style="width:auto"><tr><th></th>' + cur.map((c) => `<th class="num">${name(c)}</th>`).join('') + '</tr>';
      cur.forEach((ci, i) => {
        h += `<tr><th>${name(ci)}</th>` + cur.map((cj, j) => {
          if (j > i) return '<td></td>';
          if (j === i) return '<td class="num muted">0</td>';
          const d = dist(ci, cj, link.value);
          const isMin = nxt && ((name(nxt.a) === name(ci) && name(nxt.b) === name(cj)) || (name(nxt.a) === name(cj) && name(nxt.b) === name(ci)));
          const fresh = step > 0 && (ci.length > 1 || cj.length > 1) && (name(full[step - 1].a.concat(full[step - 1].b)) === name(ci) || name(full[step - 1].a.concat(full[step - 1].b)) === name(cj));
          return `<td class="num${isMin ? ' ok' : ''}" style="${isMin ? 'outline:2px solid var(--accent);' : ''}${fresh ? 'background:var(--hl)' : ''}">${fmt(d, 3)}</td>`;
        }).join('') + '</tr>';
      });
      mat.innerHTML = `<div class="table-wrap" style="margin:0">${h}</table></div>`;
      // 樹狀圖
      const order = [];
      (function leaves(c) {
        const m = full.find((x) => name(x.a.concat(x.b)) === name(c));
        if (!m) { order.push(c[0]); return; }
        leaves(m.a); leaves(m.b);
      })([0, 1, 2, 3, 4]);
      const W = 280, H = 220, L = 34, R = 12, T = 12, B = 24, maxH = full[3].h * 1.08;
      const X = (i) => L + ((order.indexOf(i) + 0.5) / 5) * (W - L - R), Y = (v) => T + (1 - v / maxH) * (H - T - B);
      let g = `<path class="axis" d="M${L} ${T} V${H - B}"/>`;
      for (const v of [0, 1, 2, 3, 4].filter((v) => v <= maxH)) g += `<text class="tick" x="${L - 4}" y="${Y(v)}" text-anchor="end">${v}</text><path class="grid" d="M${L} ${Y(v)} H${W - R}"/>`;
      const pos = {};
      for (let i = 0; i < 5; i++) { pos[i + 1 + ''] = { x: X(i), y: Y(0) }; g += `<text class="lab" x="${X(i)}" y="${H - B + 12}" text-anchor="middle">${i + 1}</text>`; }
      full.slice(0, step).forEach((m) => {
        const a = pos[name(m.a)], b = pos[name(m.b)], y = Y(m.h);
        g += `<path class="line acc" d="M${a.x} ${a.y} V${y} H${b.x} V${b.y}"/><text class="tick" x="${(a.x + b.x) / 2}" y="${y - 7}" text-anchor="middle">${fmt(m.h, 3)}</text>`;
        pos[name(m.a.concat(m.b))] = { x: (a.x + b.x) / 2, y };
      });
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      const how = { single: '最小值', complete: '最大值', average: '平均' }[link.value];
      let msg;
      if (step === 0) msg = '一開始每個點自成一群。框起來的是目前最小的距離，下一步就合併它們。';
      else {
        const m = full[step - 1];
        msg = `第 ${step} 次：在高度 ${fmt(m.h, 3)} 合併 {${name(m.a)}} 和 {${name(m.b)}}。黃底是合併後重算的距離（取原始點對距離的${how}）。`;
      }
      if (step === 4) {
        const two = full[3];
        msg +=` 完成。在最後一次合併前切開，得到兩群 {${name(two.a)}} | {${name(two.b)}}。`;
      }
      out.innerHTML = `<div>${msg}</div>`;
    }
    function reset() { full = compute(); step = 0; render(); }
    $('#hc-next').addEventListener('click', () => { if (step < 4) { step++; render(); } });
    $('#hc-reset').addEventListener('click', () => { step = 0; render(); });
    link.addEventListener('change', reset);
    reset();
  })();
})();
