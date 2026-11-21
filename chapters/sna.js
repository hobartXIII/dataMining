/* 社群網路互動元件：中心性、n-clique 檢查、模組度與 GN、連結預測、LTM／ICM、SI／SIR／SIS */
(function () {
  'use strict';
  const { $, $$, el, fmt, tex, rng, bindRange } = DM;

  /* ---------- 圖的工具 ---------- */
  // G = { names, pos: [[x,y]...], edges: [[i,j]...], vb: [w,h] }
  function adj(G) {
    const A = G.names.map(() => []);
    G.edges.forEach(([i, j]) => { A[i].push(j); A[j].push(i); });
    return A;
  }
  function bfs(A, s, allowed) {
    const d = A.map(() => Infinity); d[s] = 0;
    const q = [s];
    while (q.length) {
      const u = q.shift();
      for (const v of A[u]) if (d[v] === Infinity && (!allowed || allowed.has(v))) { d[v] = d[u] + 1; q.push(v); }
    }
    return d;
  }
  // Brandes：回傳節點介數與邊介數（無向、每對只算一次）
  function brandes(A, edges) {
    const n = A.length, cb = new Array(n).fill(0), eb = new Map(edges.map(([i, j]) => [key(i, j), 0]));
    for (let s = 0; s < n; s++) {
      const S = [], P = A.map(() => []), sig = new Array(n).fill(0), d = new Array(n).fill(-1);
      sig[s] = 1; d[s] = 0;
      const Q = [s];
      while (Q.length) {
        const v = Q.shift(); S.push(v);
        for (const w of A[v]) {
          if (d[w] < 0) { d[w] = d[v] + 1; Q.push(w); }
          if (d[w] === d[v] + 1) { sig[w] += sig[v]; P[w].push(v); }
        }
      }
      const delta = new Array(n).fill(0);
      while (S.length) {
        const w = S.pop();
        for (const v of P[w]) {
          const c = (sig[v] / sig[w]) * (1 + delta[w]);
          eb.set(key(v, w), eb.get(key(v, w)) + c);
          delta[v] += c;
        }
        if (w !== s) cb[w] += delta[w];
      }
    }
    for (const k of eb.keys()) eb.set(k, eb.get(k) / 2);
    return { node: cb.map((x) => x / 2), edge: eb };
  }
  const key = (i, j) => (i < j ? i + '-' + j : j + '-' + i);
  function components(n, edges) {
    const A = Array.from({ length: n }, () => []);
    edges.forEach(([i, j]) => { A[i].push(j); A[j].push(i); });
    const c = new Array(n).fill(-1);
    let k = 0;
    for (let s = 0; s < n; s++) {
      if (c[s] >= 0) continue;
      const st = [s]; c[s] = k;
      while (st.length) { const u = st.pop(); for (const v of A[u]) if (c[v] < 0) { c[v] = k; st.push(v); } }
      k++;
    }
    return c;
  }
  function modularity(n, edges, comm) {
    const m = edges.length, deg = new Array(n).fill(0);
    edges.forEach(([i, j]) => { deg[i]++; deg[j]++; });
    const groups = [...new Set(comm)];
    return groups.map((g) => {
      const inside = edges.filter(([i, j]) => comm[i] === g && comm[j] === g).length;
      const D = deg.reduce((s, d, i) => s + (comm[i] === g ? d : 0), 0);
      return { g, inside, D, q: (2 * inside - (D * D) / (2 * m)) / (2 * m) };
    });
  }
  function draw(svg, G, o = {}) {
    let s = '';
    G.edges.forEach(([i, j], k) => {
      const [x1, y1] = G.pos[i], [x2, y2] = G.pos[j];
      s += `<line class="e ${o.ecls ? o.ecls(k, i, j) : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    });
    (o.extra || []).forEach(([i, j, cls]) => {
      const [x1, y1] = G.pos[i], [x2, y2] = G.pos[j];
      s += `<line class="e ${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    });
    if (o.elab) G.edges.forEach(([i, j], k) => {
      const t = o.elab(k, i, j); if (t === '') return;
      s += `<text class="w" x="${(G.pos[i][0] + G.pos[j][0]) / 2}" y="${(G.pos[i][1] + G.pos[j][1]) / 2}">${t}</text>`;
    });
    G.names.forEach((nm, i) => {
      const [x, y] = G.pos[i];
      s += `<g class="v ${o.vcls ? o.vcls(i) : ''}" data-i="${i}"><circle cx="${x}" cy="${y}" r="${G.r || 16}"/><text x="${x}" y="${y}">${nm}</text></g>`;
      if (o.sub) { const t = o.sub(i); if (t !== '') s += `<text class="score" x="${x}" y="${y + (G.r || 16) + 10}">${t}</text>`; }
    });
    svg.setAttribute('viewBox', `0 0 ${G.vb[0]} ${G.vb[1]}`);
    svg.innerHTML = s;
    if (o.click) $$('g.v', svg).forEach((g) => g.addEventListener('click', () => o.click(Number(g.dataset.i))));
  }
  const E = (names, list) => list.split(' ').map((p) => p.split('-').map((x) => names.indexOf(x)));

  /* ===== 中心性 ===== */
  (function centWidget() {
    const N1 = ['A', 'B', 'C', 'D', 'E'];
    const N2 = ['A', 'B', 'C', 'D', 'E', 'F'];
    const NB = ['a', 'b', 'c', 'd', 'M', 'e', 'f', 'g', 'h'];
    const NS = ['C', 'A', 'B', 'D', 'E', 'F', 'G'];
    const GR = {
      path: { names: N1, pos: N1.map((_, i) => [50 + i * 95, 50]), edges: E(N1, 'A-B B-C C-D D-E'), vb: [480, 90] },
      close: { names: N2, pos: [[50, 45], [140, 45], [230, 45], [320, 45], [410, 45], [230, 125]], edges: E(N2, 'A-B B-C C-D D-E C-F'), vb: [460, 165] },
      p3: { names: ['A', 'B', 'C'], pos: [[110, 50], [230, 50], [350, 50]], edges: [[0, 1], [1, 2]], vb: [460, 90] },
      bridge: { names: NB, pos: [[50, 50], [50, 150], [130, 50], [130, 150], [230, 100], [330, 50], [330, 150], [410, 50], [410, 150]], edges: E(NB, 'a-b a-c a-d b-c b-d c-d d-M c-M M-e M-f e-f e-g e-h f-g f-h g-h'), vb: [460, 200] },
      star: { names: NS, pos: [[150, 100], [70, 40], [70, 160], [230, 40], [230, 160], [320, 160], [410, 160]], edges: E(NS, 'C-A C-B C-D C-E E-F F-G'), vb: [460, 200] },
    };
    const gSel = $('#ce-g'), mSel = $('#ce-m'), itIn = $('#ce-it'), svg = $('#ce-svg'), tbl = $('#ce-table'), out = $('#ce-out');
    function eig(A, rounds) {
      let x = A.map(() => 1);
      for (let t = 0; t < rounds; t++) {
        const y = x.map((xi, i) => xi + A[i].reduce((s, j) => s + x[j], 0));
        const mx = Math.max(...y);
        x = y.map((v) => v / mx);
      }
      const Ax = x.map((_, i) => A[i].reduce((s, j) => s + x[j], 0));
      const lam = Ax.reduce((s, v, i) => s + v * x[i], 0) / x.reduce((s, v) => s + v * v, 0);
      return { x, lam, Ax };
    }
    function render() {
      const G = GR[gSel.value], A = adj(G), n = G.names.length, m = mSel.value;
      $('#ce-it-l').hidden = m !== 'eig';
      const deg = A.map((a) => a.length);
      const bt = brandes(A, G.edges).node;
      const dist = G.names.map((_, i) => bfs(A, i).reduce((s, d, j) => s + (j === i ? 0 : d), 0));
      const ev = eig(A, m === 'eig' ? Number(itIn.value) : 200);
      let val, show, fx;
      if (m === 'deg') { val = deg; show = (i) => `${deg[i]}（${fmt(deg[i] / (n - 1), 3)}）`; fx = (i) => fmt(deg[i] / (n - 1), 2); }
      if (m === 'btw') { val = bt; show = (i) => fmt(bt[i], 3); fx = (i) => fmt(bt[i], 2); }
      if (m === 'clo') { val = dist.map((d) => (n - 1) / d); show = (i) => `${n - 1}/${dist[i]} = ${fmt((n - 1) / dist[i], 3)}`; fx = (i) => `${n - 1}/${dist[i]}`; }
      if (m === 'eig') { val = ev.x; show = (i) => fmt(ev.x[i], 4); fx = (i) => fmt(ev.x[i], 3); }
      const mx = Math.max(...val);
      draw(svg, G, { vcls: (i) => (Math.abs(val[i] - mx) < 1e-9 ? 'on' : ''), sub: fx });
      const order = G.names.map((_, i) => i).sort((a, b) => val[b] - val[a]);
      const head = { deg: '度（正規化）', btw: '介數', clo: '正規化接近', eig: '特徵向量（最大 = 1）' }[m];
      tbl.innerHTML = `<table><tr><th class="num">名次</th><th>節點</th><th>${head}</th>${m === 'eig' ? '<th class="num">鄰居分數和</th>' : ''}</tr>` +
        order.map((i, r) => `<tr${r === 0 || Math.abs(val[i] - mx) < 1e-9 ? ' class="hit"' : ''}><td class="num">${r + 1}</td><td>${G.names[i]}</td><td>${show(i)}</td>${m === 'eig' ? `<td class="num">${fmt(ev.Ax[i], 4)}</td>` : ''}</tr>`).join('') + '</table>';
      const tips = {
        deg: '只數直接連結。在「兩群加一座橋」中，橋 M 的度只有 4，排不到前面。',
        btw: gSel.value === 'path' ? '講義第 17 頁：0, 3, 4, 3, 0。' : gSel.value === 'bridge' ? '左右兩群之間 4 × 4 = 16 對節點的最短路徑全部經過 M，所以 C_B(M) = 16 最高；度數卻只有 4。' : '每個節點對的功勞平均分給它的各條最短路徑。',
        clo: gSel.value === 'close' ? '講義第 20 頁：A 5/13、B 5/9、C 5/7、D 5/9、E 5/13、F 5/11。' : '分母是到其他所有節點的最短距離總和。',
        eig: Number(itIn.value) < 20 ? `第 ${itIn.value} 回合：每個節點的新分數 = 自己 + 鄰居，再除以最大值。拖到 20 看收斂。` : `收斂後 Ax = λx，λ ≈ ${fmt(ev.lam, 4)}${gSel.value === 'p3' ? '（講義：1.4142 = √2）' : ''}。右欄的鄰居分數和 = λ × 自己的分數。`,
      };
      out.innerHTML = `<div>${tips[m]}</div>`;
    }
    [gSel, mSel].forEach((x) => x.addEventListener('change', render));
    bindRange(itIn, render);
  })();

  /* ===== n-clique／n-club／n-clan ===== */
  (function cliqueWidget() {
    const names = ['1', '2', '3', '4', '5', '6'];
    const G = { names, pos: [[150, 30], [95, 95], [205, 95], [60, 175], [240, 175], [150, 235]], edges: E(names, '1-2 1-3 2-3 2-4 3-5 4-6 5-6'), vb: [300, 265] };
    const A = adj(G), n = 6;
    const nIn = $('#cq-n'), kIn = $('#cq-k'), cIn = $('#cq-c'), svg = $('#cq-svg'), out = $('#cq-out'), seg = $('#cq-presets');
    let S = new Set([0, 1, 2, 3, 4]);
    const full = G.names.map((_, i) => bfs(A, i));
    const diamIn = (set) => { let d = 0; for (const i of set) { const di = bfs(A, i, set); for (const j of set) d = Math.max(d, di[j]); } return d; };
    const isNClique = (set, k) => [...set].every((i) => [...set].every((j) => full[i][j] <= k));
    const outside = (set) => G.names.map((_, i) => i).filter((i) => !set.has(i));
    const plus = (set, v) => new Set([...set, v]);
    function kcore(k) {
      const alive = new Set(G.names.map((_, i) => i));
      let changed = true;
      while (changed) {
        changed = false;
        for (const v of [...alive]) if (A[v].filter((u) => alive.has(u)).length < k) { alive.delete(v); changed = true; }
      }
      return alive;
    }
    [[0, 1, 2], [0, 1, 2, 3, 4], [1, 2, 3, 4, 5], [0, 1, 2, 3], [0, 1, 2, 4]].forEach((p) => {
      const b = el('button', { class: 'btn', type: 'button', text: '{' + p.map((i) => i + 1).join(', ') + '}' });
      b.addEventListener('click', () => { S = new Set(p); render(); });
      seg.append(b);
    });
    $('#cq-clear').addEventListener('click', () => { S = new Set(); render(); });
    const yes = (b) => (b ? '<span class="good">✓</span>' : '<span class="bad">✗</span>');
    function render() {
      const k = Number(nIn.value), kp = Number(kIn.value), kc = Number(cIn.value);
      const core = kcore(kc);
      draw(svg, G, {
        vcls: (i) => (S.has(i) ? 'sel' : '') + (core.has(i) ? ' g1' : ''),
        ecls: (e, i, j) => (S.has(i) && S.has(j) ? 'hl' : ''),
        click: (i) => { if (S.has(i)) S.delete(i); else S.add(i); render(); },
      });
      if (S.size < 2) { out.innerHTML = '<span class="muted">至少選 2 個節點。</span>' + coreLine(core, kc); return; }
      const set = [...S].sort((a, b) => a - b), lab = '{' + set.map((i) => i + 1).join(', ') + '}';
      const clique = set.every((i) => set.every((j) => i === j || A[i].includes(j)));
      const nc = isNClique(S, k), ncMax = nc && outside(S).every((v) => !isNClique(plus(S, v), k));
      const dm = diamIn(S), club = dm <= k, clubMax = club && outside(S).every((v) => diamIn(plus(S, v)) > k);
      const plex = set.every((i) => A[i].filter((j) => S.has(j)).length >= S.size - kp);
      let far = '';
      if (nc && !club) {
        for (const i of set) { const di = bfs(A, i, S); for (const j of set) if (di[j] > k && i < j) { far = `集合內 ${i + 1} 到 ${j + 1} 的距離是 ${di[j] === Infinity ? '∞（不連通）' : di[j]}`; break; } if (far) break; }
      }
      out.innerHTML = `<div><strong>${lab}</strong>（${S.size} 個節點，導出子圖直徑 = ${dm === Infinity ? '∞' : dm}）</div>` +
        `<div>clique（兩兩直接相連）：${yes(clique)}</div>` +
        `<div>${k}-clique（原圖距離 ≤ ${k}，且極大）：${yes(ncMax)}${nc && !ncMax ? '（距離條件成立，但還能再加節點，不是極大）' : ''}</div>` +
        `<div>${k}-club（子圖直徑 ≤ ${k}，且極大）：${yes(clubMax)}${club && !clubMax ? '（直徑條件成立，但不是極大）' : ''}</div>` +
        `<div>${k}-clan（${k}-clique 且子圖直徑 ≤ ${k}）：${yes(ncMax && club)}</div>` +
        `<div>${kp}-plex（每點在集合內至少 ${S.size} − ${kp} = ${S.size - kp} 個鄰居）：${yes(plex)}</div>` +
        (far ? `<div class="muted">${far}：在原圖可以經過集合外的節點縮短，但導出子圖不行。</div>` : '') + coreLine(core, kc);
    }
    const coreLine = (core, kc) => `<div class="muted" style="margin-top:4px">${kc}-core（淡藍色）：${core.size ? '{' + [...core].map((i) => i + 1).join(', ') + '}' : '空的'}</div>`;
    bindRange(nIn, render); bindRange(kIn, render); bindRange(cIn, render);
  })();

  /* ===== 模組度與 Girvan–Newman ===== */
  (function modWidget() {
    const GR = {
      lec: { names: ['1', '2', '3', '4', '5', '6', '7'], pos: [[60, 60], [60, 180], [150, 120], [260, 120], [350, 40], [350, 200], [430, 120]], edges: E(['1', '2', '3', '4', '5', '6', '7'], '1-2 1-3 2-3 3-4 4-5 4-6 4-7 5-6 5-7 6-7'), vb: [480, 240], lec: [0, 0, 0, 1, 1, 1, 1] },
      two: (() => {
        const nm = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
        return { names: nm, pos: [[50, 60], [50, 180], [140, 30], [140, 210], [190, 120], [290, 120], [340, 30], [340, 210], [430, 60], [430, 180]], edges: E(nm, 'a-b a-c a-e b-d b-e c-e d-e c-a e-f d-h f-g f-h f-i g-i h-j i-j g-h'), vb: [480, 240], lec: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1] };
      })(),
    };
    // 去掉重複邊
    for (const g of Object.values(GR)) { const seen = new Set(); g.edges = g.edges.filter(([i, j]) => { const k = key(i, j); if (seen.has(k)) return false; seen.add(k); return true; }); }
    const gSel = $('#md-g'), svg = $('#md-svg'), out = $('#md-out');
    let G, comm, removed, lastCut;
    function reset(keepComm) {
      G = GR[gSel.value]; removed = new Set(); lastCut = null;
      if (!keepComm) comm = G.lec.slice();
      render();
    }
    function render() {
      const live = G.edges.filter((_, k) => !removed.has(k));
      const liveIdx = G.edges.map((_, k) => k).filter((k) => !removed.has(k));
      const A = G.names.map(() => []);
      live.forEach(([i, j]) => { A[i].push(j); A[j].push(i); });
      const eb = brandes(A, live).edge;
      const mxE = Math.max(0, ...live.map(([i, j]) => eb.get(key(i, j))));
      draw(svg, G, {
        vcls: (i) => 'g' + (comm[i] % 3),
        ecls: (k, i, j) => (removed.has(k) ? 'cut' : Math.abs(eb.get(key(i, j)) - mxE) < 1e-9 && mxE > 0 ? 'hl' : ''),
        elab: (k, i, j) => (removed.has(k) ? '' : fmt(eb.get(key(i, j)), 1)),
        click: (i) => { comm[i] = (comm[i] + 1) % 3; render(); },
      });
      const parts = modularity(G.names.length, G.edges, comm), Q = parts.reduce((s, p) => s + p.q, 0);
      const m = G.edges.length;
      out.innerHTML = `<div>原圖 m = ${m}、2m = ${2 * m}。目前 ${parts.length} 個社群：</div><div class="q-lines"></div>` +
        `<div>Q = <span class="big">${fmt(Q, 4)}</span></div>` +
        `<div class="muted">${lastCut ? `剛剛移除了邊 ${lastCut}（介數最高）。` : ''}模組度永遠用<strong>原圖</strong>的邊算；粗藍線是目前介數最高的邊。${parts.length === 1 ? '全部同一群：觀察到的群內邊比例 = 1、期望也 = 1，所以 Q = 0。' : ''}</div>`;
      const box = $('.q-lines', out);
      parts.forEach((p) => {
        const d = el('div');
        box.append(d);
        tex(d, `Q_{${p.g + 1}} = \\frac{1}{${2 * m}}\\left(${2 * p.inside} - \\frac{${p.D} \\times ${p.D}}{${2 * m}}\\right) = ${fmt(p.q, 4)}`);
      });
      $('#md-gn').disabled = !liveIdx.length;
      render.liveIdx = liveIdx; render.eb = eb;
    }
    $('#md-gn').addEventListener('click', () => {
      const liveIdx = render.liveIdx, eb = render.eb;
      if (!liveIdx.length) return;
      let best = liveIdx[0];
      for (const k of liveIdx) if (eb.get(key(...G.edges[k])) > eb.get(key(...G.edges[best])) + 1e-9) best = k;
      removed.add(best);
      lastCut = G.names[G.edges[best][0]] + '–' + G.names[G.edges[best][1]];
      comm = components(G.names.length, G.edges.filter((_, k) => !removed.has(k)));
      render();
    });
    $('#md-reset').addEventListener('click', () => reset(true));
    $('#md-one').addEventListener('click', () => { comm = G.names.map(() => 0); render(); });
    $('#md-lec').addEventListener('click', () => { comm = G.lec.slice(); render(); });
    gSel.addEventListener('change', () => reset(false));
    reset(false);
  })();

  /* ===== 連結預測 ===== */
  (function linkWidget() {
    const names = ['x', 'y', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const G = {
      names, vb: [420, 300], r: 15,
      pos: [[80, 150], [330, 150], [200, 60], [200, 240], [60, 40], [300, 270], [400, 60], [400, 230], [120, 280], [270, 50]],
      edges: E(names, 'x-a x-b x-c y-a y-b y-d y-e y-f a-c b-d b-g b-h g-h'),
    };
    const A = adj(G), mSel = $('#lk-m'), svg = $('#lk-svg'), tbl = $('#lk-table'), out = $('#lk-out');
    let pick = [0, 1], next = 0;
    function scores(x, y) {
      const Nx = new Set(A[x]), Ny = new Set(A[y]);
      const common = [...Nx].filter((z) => Ny.has(z)), uni = new Set([...Nx, ...Ny]);
      return {
        common, uni,
        cn: common.length,
        jac: uni.size ? common.length / uni.size : 0,
        aa: common.reduce((s, z) => s + (A[z].length > 1 ? 1 / Math.log(A[z].length) : 0), 0),
        pa: Nx.size * Ny.size,
      };
    }
    function render() {
      const m = mSel.value;
      const pairs = [];
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if (!A[i].includes(j)) pairs.push({ i, j, s: scores(i, j) });
      pairs.sort((p, q) => q.s[m] - p.s[m]);
      const top = pairs.slice(0, 3);
      const [x, y] = pick, s = scores(x, y);
      draw(svg, G, {
        vcls: (i) => (i === x || i === y ? 'sel' : s.common.includes(i) ? 'on' : ''),
        sub: (i) => `deg ${A[i].length}`,
        extra: top.map((p) => [p.i, p.j, 'cand']).concat(A[x].includes(y) ? [] : [[x, y, 'hl']]),
        click: (i) => { pick[next] = i; next = 1 - next; if (pick[0] === pick[1]) pick[1 - next] = (i + 1) % names.length; render(); },
      });
      const f = (v) => fmt(v, 3);
      tbl.innerHTML = `<table><tr><th class="num">#</th><th>節點對</th><th class="num">${{ cn: 'CN', jac: 'Jaccard', aa: 'AA', pa: 'PA' }[m]}</th></tr>` +
        pairs.map((p, r) => `<tr class="${(p.i === x && p.j === y) || (p.i === y && p.j === x) ? 'hit' : ''}"><td class="num">${r + 1}</td><td>${names[p.i]}–${names[p.j]}</td><td class="num">${f(p.s[m])}</td></tr>`).join('') + '</table>';
      if (A[x].includes(y)) { out.innerHTML = `<div>${names[x]} 和 ${names[y]} 已經相連，連結預測只對沒相連的節點對打分。</div>`; return; }
      const nm = (arr) => '{' + [...arr].map((i) => names[i]).join(', ') + '}';
      out.innerHTML = `<div>N(${names[x]}) = ${nm(A[x])}、N(${names[y]}) = ${nm(A[y])}；交集 ${nm(s.common)}（綠色）、聯集 ${nm(s.uni)}</div>` +
        '<div class="lk-f"></div><div class="lk-f"></div><div class="lk-f"></div><div class="lk-f"></div>' +
        '<div class="muted">AA 用自然對數（講義寫 log，沒寫底數；換成以 10 為底，數值會變但排名不變）。度數 1 的共同鄰居 log 1 = 0，這裡略過。</div>';
      const fs = $$('.lk-f', out);
      tex(fs[0], `CN = |${nm(s.common).replace(/[{}]/g, (c) => '\\' + c)}| = ${s.cn}`);
      tex(fs[1], `Jaccard = \\frac{${s.cn}}{${s.uni.size}} = ${f(s.jac)}`);
      tex(fs[2], `AA = ${s.common.length ? s.common.map((z) => `\\frac{1}{\\ln ${A[z].length}}`).join(' + ') : '0'} = ${f(s.aa)}`);
      tex(fs[3], `PA = ${A[x].length} \\times ${A[y].length} = ${s.pa}`);
    }
    mSel.addEventListener('change', render);
    render();
  })();

  /* ===== LTM／ICM ===== */
  (function diffWidget() {
    const names = 'ABCDEFGHIJKL'.split('');
    const G = {
      names, vb: [500, 270], r: 15,
      pos: [[50, 70], [50, 200], [140, 135], [230, 60], [230, 210], [320, 135], [410, 60], [410, 210], [470, 135], [140, 30], [320, 30], [320, 245]],
      edges: E(names, 'A-B A-C B-C C-D C-E D-E D-F E-F F-G F-H G-I H-I G-H A-J J-D D-K K-G E-L L-H'),
    };
    const A = adj(G), n = names.length;
    const mSel = $('#df-m'), pIn = $('#df-p'), svg = $('#df-svg'), out = $('#df-out');
    let seeds = new Set([0]), seed = 5, theta, active, fresh, tried, round, done, log, rr;
    function newRandom() { const r = rng(seed++); theta = names.map(() => Math.round(r() * 100) / 100); restart(); }
    function restart() { active = new Set(seeds); fresh = new Set(seeds); tried = new Set(); round = 0; done = false; log = []; rr = rng(seed * 7 + 1); render(); }
    function stepLTM(act, fr) {
      const nw = [];
      for (let v = 0; v < n; v++) {
        if (act.has(v)) continue;
        const inf = A[v].filter((u) => act.has(u)).length / A[v].length;
        if (inf >= theta[v] - 1e-12) nw.push(v);
      }
      return nw;
    }
    function stepICM(act, fr, r, tr, p) {
      const nw = new Set(), msgs = [];
      for (const v of fr) for (const w of A[v]) {
        if (act.has(w) || tr.has(v + '>' + w)) continue;
        tr.add(v + '>' + w);
        const x = r();
        const ok = x < p;
        if (msgs) msgs.push(`${names[v]}→${names[w]}：r = ${x.toFixed(2)} ${ok ? '&lt;' : '≥'} ${p} ${ok ? '成功' : '失敗'}`);
        if (ok) nw.add(w);
      }
      return { nw: [...nw], msgs };
    }
    function step() {
      if (done) return;
      let nw, msgs = [];
      if (mSel.value === 'ltm') nw = stepLTM(active, fresh);
      else ({ nw, msgs } = stepICM(active, fresh, rr, tried, Number(pIn.value)));
      round++;
      nw.forEach((v) => active.add(v));
      fresh = new Set(nw);
      log.push({ round, nw, msgs });
      if (!nw.length) done = true;
      render();
    }
    function sigma() {
      const p = Number(pIn.value), runs = 1000, r = rng(99);
      let tot = 0;
      for (let k = 0; k < runs; k++) {
        const act = new Set(seeds); let fr = new Set(seeds); const tr = new Set();
        if (mSel.value === 'ltm') {
          const th = names.map(() => r());
          for (;;) {
            const nw = [];
            for (let v = 0; v < n; v++) if (!act.has(v) && A[v].filter((u) => act.has(u)).length / A[v].length >= th[v]) nw.push(v);
            if (!nw.length) break;
            nw.forEach((v) => act.add(v));
          }
        } else {
          while (fr.size) {
            const nw = new Set();
            for (const v of fr) for (const w of A[v]) { if (act.has(w) || tr.has(v + '>' + w)) continue; tr.add(v + '>' + w); if (r() < p) nw.add(w); }
            nw.forEach((v) => act.add(v)); fr = nw;
          }
        }
        tot += act.size;
      }
      return tot / runs;
    }
    function render() {
      const ltm = mSel.value === 'ltm';
      $('#df-p-l').hidden = ltm;
      draw(svg, G, {
        vcls: (i) => (fresh.has(i) && round > 0 ? 'new' : active.has(i) ? 'on' : ''),
        sub: (i) => (ltm ? `θ=${theta[i].toFixed(2)}` : ''),
        elab: ltm ? undefined : () => '',
        click: (i) => { if (seeds.has(i)) { if (seeds.size > 1) seeds.delete(i); } else seeds.add(i); restart(); },
      });
      const lines = log.map((l) => `第 ${l.round} 回合：${l.nw.length ? '新啟動 ' + l.nw.map((v) => names[v]).join('、') : '沒有新節點 → 停止'}` +
        (l.msgs.length ? `<div class="muted" style="font-size:.84rem">${l.msgs.join('；')}</div>` : ''));
      let hint = '';
      if (ltm && !done) {
        const cand = names.map((_, v) => v).filter((v) => !active.has(v) && A[v].some((u) => active.has(u)));
        hint = cand.map((v) => `${names[v]}：${A[v].filter((u) => active.has(u)).length}/${A[v].length} = ${fmt(A[v].filter((u) => active.has(u)).length / A[v].length, 2)} ${A[v].filter((u) => active.has(u)).length / A[v].length >= theta[v] ? '≥' : '&lt;'} θ ${theta[v].toFixed(2)}`).join('；');
      }
      out.innerHTML = `<div>種子 S = {${[...seeds].map((v) => names[v]).join(', ')}}；目前啟動 <span class="big">${active.size}</span>／${n} 個${done ? '（已停止）' : ''}</div>` +
        (lines.length ? `<div style="margin-top:4px">${lines.join('<br>')}</div>` : '') +
        (hint ? `<div class="muted" style="margin-top:4px">下一回合要檢查的節點（已啟動鄰居的權重和 vs. 門檻）：${hint}</div>` : '') +
        (render.sig != null ? `<div style="margin-top:4px">σ(S) ≈ <strong>${fmt(render.sig, 2)}</strong>（${ltm ? 'LTM，每次模擬重抽門檻' : `ICM，p = ${pIn.value}`}，1000 次平均）</div>` : '');
      $('#df-step').disabled = done;
    }
    $('#df-step').addEventListener('click', step);
    $('#df-reset').addEventListener('click', () => { render.sig = null; restart(); });
    $('#df-new').addEventListener('click', () => { render.sig = null; newRandom(); });
    $('#df-sigma').addEventListener('click', () => { render.sig = sigma(); render(); });
    mSel.addEventListener('change', () => { render.sig = null; restart(); });
    bindRange(pIn, () => { if (theta) { render.sig = null; restart(); } }, (v) => fmt(v, 2));
    newRandom();
  })();

  /* ===== SI／SIR／SIS ===== */
  (function sirWidget() {
    const mSel = $('#sr-m'), bIn = $('#sr-b'), gIn = $('#sr-g'), svg = $('#sr-svg'), out = $('#sr-out');
    function render() {
      const m = mSel.value, beta = Number(bIn.value), gam = Number(gIn.value);
      $('#sr-g-l').hidden = m === 'si';
      const N = 100, Tmax = 60, dt = 0.05;
      let S = 90, I = 10, R = 0;
      const tr = [[0, S, I, R]];
      let peak = [0, I];
      for (let t = dt; t <= Tmax + 1e-9; t += dt) {
        const inf = beta * S * I, rec = m === 'si' ? 0 : gam * I;
        S += (-inf + (m === 'sis' ? rec : 0)) * dt;
        I += (inf - rec) * dt;
        if (m === 'sir') R += rec * dt;
        if (I > peak[1]) peak = [t, I];
        if (Math.round(t / dt) % 10 === 0) tr.push([t, S, I, R]);
      }
      const W = 460, H = 220, L = 34, Rr = 12, T = 12, B = 26;
      const X = (t) => L + (t / Tmax) * (W - L - Rr), Y = (v) => T + (1 - v / N) * (H - T - B);
      let g = `<path class="axis" d="M${L} ${T} V${H - B} H${W - Rr}"/>`;
      for (const v of [0, 50, 100]) g += `<text class="tick" x="${L - 4}" y="${Y(v)}" text-anchor="end">${v}</text><path class="grid" d="M${L} ${Y(v)} H${W - Rr}"/>`;
      for (const t of [0, 20, 40, 60]) g += `<text class="tick" x="${X(t)}" y="${H - B + 12}" text-anchor="middle">${t}</text>`;
      g += `<text class="tick" x="${W - Rr}" y="${H - 4}" text-anchor="end">時間 t</text>`;
      const path = (k) => tr.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[k]).toFixed(1)).join('');
      g += `<path class="line acc" d="${path(1)}"/><path class="line c0" d="${path(2)}"/>`;
      if (m === 'sir') g += `<path class="line pos" d="${path(3)}"/>`;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      const last = tr[tr.length - 1];
      const R0 = (beta * N) / gam;
      out.innerHTML = '<div id="sr-f"></div>' +
        (m === 'si' ? `<div>沒有康復：最後所有人都會被感染（t = 60 時 I = ${fmt(last[2], 1)}）。曲線是 S 形：一開始 I 少、後來 S 少，兩者各半時最快。</div>`
          : m === 'sir' ? `<div>感染高峰在 t ≈ ${fmt(peak[0], 1)}，I 最多 ${fmt(peak[1], 1)} 人；最後 R = ${fmt(last[3], 1)} 人得過病、S = ${fmt(last[1], 1)} 人始終沒被感染。<span class="tag add">補充</span>基本再生數 R₀ = βN/γ = ${fmt(R0, 2)}${R0 <= 1 ? '（≤ 1，疫情不會擴大）' : ''}。</div>`
            : `<div>康復後又變回易感：I 最後停在平衡值 ${fmt(last[2], 1)}${R0 > 1 ? `（<span class="tag add">補充</span>理論值 N − γ/β = ${fmt(N - gam / beta, 1)}）` : '（βN ≤ γ，疾病會消失）'}。</div>`);
      tex($('#sr-f', out), `t = 0:\\ \\beta S I = ${beta} \\times 90 \\times 10 = ${fmt(beta * 900, 3)}${m === 'si' ? '' : `,\\quad \\gamma I = ${gam} \\times 10 = ${fmt(gam * 10, 2)}`}`);
    }
    mSel.addEventListener('change', render);
    bindRange(bIn, render, (v) => fmt(v, 3));
    bindRange(gIn, render, (v) => fmt(v, 2));
  })();
})();
