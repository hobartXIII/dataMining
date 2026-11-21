/* W9 互動元件：k-NN、線性迴歸、sigmoid、SVM、核函數、集成、Bagging／AdaBoost、bootstrap */
(function () {
  'use strict';
  const { $, $$, el, fmt, tex, rng, gauss, bindRange } = DM;
  const f3 = (x) => x.toFixed(3);
  const f4 = (x) => x.toFixed(4);

  // 座標軸：回傳 SVG 字串
  function axes(o) {
    const { W, H, L, R, T, B, X, Y, xt = [], yt = [], xl = '', yl = '' } = o;
    let g = `<path class="axis" d="M${L} ${T} V${H - B} H${W - R}"/>`;
    for (const v of xt) g += `<text class="tick" x="${X(v)}" y="${H - B + 12}" text-anchor="middle">${v}</text>`;
    for (const v of yt) g += `<text class="tick" x="${L - 5}" y="${Y(v)}" text-anchor="end">${v}</text>`;
    if (xl) g += `<text class="tick" x="${W - R}" y="${H - 6}" text-anchor="end">${xl}</text>`;
    if (yl) g += `<text class="tick" x="${L + 4}" y="${T + 2}" text-anchor="start">${yl}</text>`;
    return g;
  }
  function svgXY(svg, ev) {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }

  /* ===== k-NN ===== */
  (function knnWidget() {
    const svg = $('#knn-svg'), out = $('#knn-out');
    const kIn = $('#knn-k'), dSel = $('#knn-dist'), zChk = $('#knn-z'), rChk = $('#knn-region'), dataSel = $('#knn-data');
    const W = 440, H = 300, L = 46, R = 12, T = 12, B = 30;
    const SETS = {};
    (function make() {
      let r = rng(7);
      const blob = [];
      for (let i = 0; i < 16; i++) blob.push({ x: [3 + 1.3 * gauss(r), 6.6 + 1.3 * gauss(r)], c: 0 });
      for (let i = 0; i < 16; i++) blob.push({ x: [6.6 + 1.3 * gauss(r), 3.4 + 1.3 * gauss(r)], c: 1 });
      blob.push({ x: [6.2, 4.6], c: 0 }, { x: [3.4, 5.4], c: 1 });   // 兩個雜訊點：k = 1 時會產生小孤島
      blob.forEach((p) => { p.x = p.x.map((v) => Math.min(9.6, Math.max(0.4, v))); });
      SETS.blob = { pts: blob, lo: [0, 0], hi: [10, 10], names: ['x₁', 'x₂'], q: [5, 5], fmt: [(v) => fmt(v, 1), (v) => fmt(v, 1)] };
      r = rng(21);
      const sc = [];
      for (let i = 0; i < 34; i++) {
        const age = 20 + r() * 50, inc = 25000 + r() * 90000;
        let c = age > 45 ? 1 : 0;
        if (r() < 0.06) c = 1 - c;
        sc.push({ x: [age, inc], c });
      }
      SETS.scale = { pts: sc, lo: [18, 20000], hi: [72, 120000], names: ['年齡（歲）', '年收入（元）'], q: [52, 60000], fmt: [(v) => fmt(v, 0), (v) => Math.round(v).toLocaleString('en-US')] };
    })();
    let S = SETS.blob, q = S.q.slice();
    const X = (v) => L + ((v - S.lo[0]) / (S.hi[0] - S.lo[0])) * (W - L - R);
    const Y = (v) => T + (1 - (v - S.lo[1]) / (S.hi[1] - S.lo[1])) * (H - T - B);
    const iX = (px) => S.lo[0] + ((px - L) / (W - L - R)) * (S.hi[0] - S.lo[0]);
    const iY = (py) => S.lo[1] + (1 - (py - T) / (H - T - B)) * (S.hi[1] - S.lo[1]);

    function stats() {
      const n = S.pts.length;
      const mu = [0, 1].map((j) => S.pts.reduce((s, p) => s + p.x[j], 0) / n);
      const sd = [0, 1].map((j) => Math.sqrt(S.pts.reduce((s, p) => s + (p.x[j] - mu[j]) ** 2, 0) / n));
      return { mu, sd };
    }
    function knn(x, k, st) {
      const tf = (v, j) => (zChk.checked ? (v - st.mu[j]) / st.sd[j] : v);
      const l1 = dSel.value === 'l1';
      const d = S.pts.map((p, i) => {
        const a = tf(p.x[0], 0) - tf(x[0], 0), b = tf(p.x[1], 1) - tf(x[1], 1);
        return { i, d: l1 ? Math.abs(a) + Math.abs(b) : Math.hypot(a, b) };
      }).sort((a, b) => a.d - b.d);
      const nb = d.slice(0, k);
      const votes = [0, 0];
      nb.forEach((o) => votes[S.pts[o.i].c]++);
      const label = votes[0] === votes[1] ? S.pts[nb[0].i].c : votes[0] > votes[1] ? 0 : 1;
      return { nb, votes, label, tie: votes[0] === votes[1] };
    }
    function render() {
      const k = Number(kIn.value), st = stats();
      let g = '';
      if (rChk.checked) {
        const NX = 44, NY = 30, cw = (W - L - R) / NX, ch = (H - T - B) / NY;
        for (let a = 0; a < NX; a++) for (let b = 0; b < NY; b++) {
          const cx = L + (a + 0.5) * cw, cy = T + (b + 0.5) * ch;
          const r = knn([iX(cx), iY(cy)], k, st);
          g += `<rect class="r${r.label}" x="${(L + a * cw).toFixed(1)}" y="${(T + b * ch).toFixed(1)}" width="${(cw + 0.4).toFixed(1)}" height="${(ch + 0.4).toFixed(1)}"/>`;
        }
      }
      const tk = (lo, hi, n) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
      g += `<path class="axis" d="M${L} ${T} V${H - B} H${W - R}"/>`;
      tk(S.lo[0], S.hi[0], 4).forEach((v) => { g += `<text class="tick" x="${X(v)}" y="${H - B + 12}" text-anchor="middle">${S.fmt[0](v)}</text>`; });
      tk(S.lo[1], S.hi[1], 4).forEach((v) => { g += `<text class="tick" x="${L - 4}" y="${Y(v)}" text-anchor="end">${S === SETS.scale ? fmt(v / 1000, 0) + 'k' : S.fmt[1](v)}</text>`; });
      g += `<text class="tick" x="${W - R}" y="${H - 6}" text-anchor="end">${S.names[0]}</text><text class="tick" x="${L + 4}" y="${T + 4}">${S.names[1]}</text>`;
      const r = knn(q, k, st);
      for (const o of r.nb) g += `<path class="nbline" d="M${X(q[0])} ${Y(q[1])} L${X(S.pts[o.i].x[0])} ${Y(S.pts[o.i].x[1])}"/>`;
      S.pts.forEach((p, i) => {
        g += `<circle class="p c${p.c}" cx="${X(p.x[0])}" cy="${Y(p.x[1])}" r="5"/>`;
        if (r.nb.some((o) => o.i === i)) g += `<circle class="ring" cx="${X(p.x[0])}" cy="${Y(p.x[1])}" r="8.5"/>`;
      });
      g += `<rect class="q" x="${X(q[0]) - 6}" y="${Y(q[1]) - 6}" width="12" height="12" transform="rotate(45 ${X(q[0])} ${Y(q[1])})"/>`;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      const nm = ['A', 'B'];
      const rows = r.nb.map((o, j) => `${j + 1}. (${S.fmt[0](S.pts[o.i].x[0])}, ${S.fmt[1](S.pts[o.i].x[1])}) 類別 ${nm[S.pts[o.i].c]}，距離 ${fmt(o.d, 3)}`);
      let note = '';
      if (S === SETS.scale) {
        note = zChk.checked
          ? '已標準化：兩個特徵都換成「離平均幾個標準差」，年齡重新有發言權；這份資料的類別主要由年齡決定（約 45 歲為界）。'
          : '沒有標準化：年收入相差上萬，年齡最多差 50，距離幾乎只由年收入決定，決策區域變成一條條橫帶。勾「標準化」比較。';
      } else if (k === 1) note = 'k = 1：每個訓練點都自成一區，連雜訊點旁邊也長出小孤島（過度配適）。';
      else if (k >= 11) note = 'k 很大：邊界很平滑，但靠近另一群的少數點會被「吞掉」（過度平滑）。';
      if (r.tie) note += ' 票數平手：用最近那個鄰居的類別決定。<span class="tag add">補充</span>實務上常把 k 設成奇數避免平手。';
      out.innerHTML = `<div>查詢點 (${S.fmt[0](q[0])}, ${S.fmt[1](q[1])})，k = ${k}：A ${r.votes[0]} 票、B ${r.votes[1]} 票 → 預測 <span class="big ${r.label ? '' : 'bad'}" style="color:var(${r.label ? '--c-b' : '--c-a'})">${nm[r.label]}</span></div>` +
        `<div class="muted" style="font-size:.88rem">${rows.join('<br>')}</div>` +
        (zChk.checked ? `<div class="muted" style="font-size:.88rem">訓練集統計：μ = (${S.fmt[0](st.mu[0])}, ${S.fmt[1](st.mu[1])})，σ = (${S.fmt[0](st.sd[0])}, ${S.fmt[1](st.sd[1])})；距離是在標準化後的空間算的。</div>` : '') +
        (note ? `<div style="margin-top:4px">${note}</div>` : '');
    }
    svg.addEventListener('click', (ev) => {
      const p = svgXY(svg, ev);
      if (p.x < L || p.x > W - R || p.y < T || p.y > H - B) return;
      q = [iX(p.x), iY(p.y)];
      render();
    });
    dataSel.addEventListener('change', () => { S = SETS[dataSel.value]; q = S.q.slice(); zChk.checked = false; render(); });
    [dSel, zChk, rChk].forEach((e) => e.addEventListener('change', render));
    bindRange(kIn, render);
  })();

  /* ===== 線性迴歸 ===== */
  (function linregWidget() {
    const xi = $('#lr-x'), yi = $('#lr-y'), svg = $('#lr-svg'), out = $('#lr-out');
    const parse = (s) => s.split(/[,，\s]+/).filter(Boolean).map(Number);
    function render() {
      const xs = parse(xi.value), ys = parse(yi.value);
      if (xs.length !== ys.length || xs.length < 2 || xs.concat(ys).some((v) => !isFinite(v))) {
        out.innerHTML = '<span class="muted">x 和 y 要是數量相同（至少 2 個）的數字。</span>'; svg.innerHTML = ''; return;
      }
      const n = xs.length, sx = xs.reduce((a, b) => a + b, 0), sxx = xs.reduce((a, b) => a + b * b, 0);
      const yb = ys.reduce((a, b) => a + b, 0) / n;
      const num = xs.reduce((s, x, i) => s + x * (ys[i] - yb), 0), den = sxx - sx * sx / n;
      if (Math.abs(den) < 1e-12) { out.innerHTML = '<span class="muted">x 全部一樣，分母為 0，無法求斜率。</span>'; svg.innerHTML = ''; return; }
      const w = num / den, b = ys.reduce((s, y, i) => s + (y - w * xs[i]), 0) / n;
      const sse = ys.reduce((s, y, i) => s + (y - (w * xs[i] + b)) ** 2, 0);
      const W = 420, H = 220, L = 34, R = 12, T = 12, B = 26;
      const x0 = Math.min(0, ...xs), x1 = Math.max(...xs) + 1, y0 = Math.min(0, ...ys, w * x0 + b, w * x1 + b), y1 = Math.max(...ys, w * x0 + b, w * x1 + b) * 1.08 + 0.5;
      const X = (v) => L + ((v - x0) / (x1 - x0)) * (W - L - R), Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
      const nice = (lo, hi) => { const st = Math.pow(10, Math.floor(Math.log10((hi - lo) / 4 || 1))); const s = [1, 2, 5, 10].map((m) => m * st).find((s2) => (hi - lo) / s2 <= 6); const r = []; for (let v = Math.ceil(lo / s) * s; v <= hi + 1e-9; v += s) r.push(Number(v.toFixed(6))); return r; };
      let g = axes({ W, H, L, R, T, B, X, Y, xt: nice(x0, x1), yt: nice(y0, y1), xl: 'x', yl: 'y' });
      g += `<path class="line acc" d="M${X(x0)} ${Y(w * x0 + b)} L${X(x1)} ${Y(w * x1 + b)}"/>`;
      xs.forEach((x, i) => {
        g += `<path class="nbline" d="M${X(x)} ${Y(ys[i])} V${Y(w * x + b)}"/><circle class="p c0" cx="${X(x)}" cy="${Y(ys[i])}" r="5"/>`;
      });
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      out.innerHTML = '<div id="lr-f1"></div><div id="lr-f2"></div><div id="lr-f3"></div>' +
        `<div>迴歸線 <span class="big">ŷ = ${fmt(w, 4)}x ${b >= 0 ? '+' : '−'} ${fmt(Math.abs(b), 4)}</span>，平方誤差總和 L = ${fmt(sse, 4)}</div>` +
        '<div class="muted">虛線是殘差 \\(y_i - \\hat{y}_i\\)：最小平方法讓它們的平方和最小。</div>';
      tex($('#lr-f1', out), `\\bar{y} = ${fmt(yb, 4)}`);
      tex($('#lr-f2', out), `w = \\frac{${xs.map((x, i) => `${x}(${ys[i]} - ${fmt(yb, 3)})`).join(' + ')}}{${xs.map((x) => `${x}^2`).join(' + ')} - \\frac{1}{${n}}(${xs.join(' + ')})^2} = \\frac{${fmt(num, 4)}}{${fmt(den, 4)}} = ${fmt(w, 4)}`);
      tex($('#lr-f3', out), `b = \\frac{1}{${n}}\\left[${xs.map((x, i) => `(${ys[i]} - ${fmt(w, 3)} \\times ${x})`).join(' + ')}\\right] = ${fmt(b, 4)}`);
      DM.renderMath(out);
    }
    xi.addEventListener('input', render); yi.addEventListener('input', render);
    render();
  })();

  /* ===== Sigmoid ===== */
  (function logitWidget() {
    const zIn = $('#lg-z'), svg = $('#lg-svg'), out = $('#lg-out');
    const sig = (z) => 1 / (1 + Math.exp(-z));
    function render(z) {
      const W = 420, H = 190, L = 34, R = 12, T = 12, B = 26;
      const X = (v) => L + ((v + 8) / 16) * (W - L - R), Y = (v) => T + (1 - v) * (H - T - B);
      let g = axes({ W, H, L, R, T, B, X, Y, xt: [-8, -4, 0, 4, 8], yt: [0, 0.5, 1], xl: 'z', yl: 'σ(z)' });
      g += `<path class="grid" d="M${L} ${Y(0.5)} H${W - R}"/><path class="grid" d="M${X(0)} ${T} V${H - B}"/>`;
      let d = '';
      for (let i = 0; i <= 160; i++) { const v = -8 + i / 10; d += (i ? 'L' : 'M') + X(v).toFixed(1) + ' ' + Y(sig(v)).toFixed(1); }
      g += `<path class="line acc" d="${d}"/>`;
      g += `<path class="nbline" d="M${X(z)} ${H - B} V${Y(sig(z))} H${L}"/><circle class="q" cx="${X(z)}" cy="${Y(sig(z))}" r="6"/>`;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      const p = sig(z);
      out.innerHTML = '<div id="lg-f"></div>' +
        `<div>p ${p >= 0.5 ? '≥' : '&lt;'} 0.5 → 預測 <span class="big ${p >= 0.5 ? 'good' : 'bad'}">${p >= 0.5 ? '正類 ŷ = 1' : '負類 ŷ = −1'}</span></div>` +
        `<div class="muted">若真實標籤 y = 1，這筆對概似的貢獻是 p = ${f4(p)}；y = 0 則是 1 − p = ${f4(1 - p)}。最大概似估計就是調 w、b 讓所有貢獻的乘積最大。</div>`;
      tex($('#lg-f', out), `\\sigma(${fmt(z, 2)}) = \\frac{1}{1 + e^{${fmt(-z, 2)}}} = ${f4(p)}`);
    }
    bindRange(zIn, render, (v) => fmt(v, 1));
  })();

  /* ===== SVM（簡化 SMO，線性核） ===== */
  (function svmWidget() {
    const svg = $('#svm-svg'), out = $('#svm-out'), cIn = $('#svm-c'), seg = $('#svm-cls');
    const W = 420, H = 300, L = 30, R = 12, T = 12, B = 26;
    const X = (v) => L + (v / 10) * (W - L - R), Y = (v) => T + (1 - v / 10) * (H - T - B);
    const iX = (px) => ((px - L) / (W - L - R)) * 10, iY = (py) => (1 - (py - T) / (H - T - B)) * 10;
    const BASE = [
      [2, 7, -1], [3, 8.5, -1], [1.5, 5, -1], [3.5, 6, -1], [2.5, 3.5, -1], [4.2, 8, -1], [1, 8, -1],
      [6, 3, 1], [7.5, 4.5, 1], [8, 2, 1], [6.5, 1.5, 1], [8.5, 6, 1], [5.8, 4.8, 1], [9, 3.5, 1],
    ];
    let data = BASE.map((p) => p.slice()), addCls = 1;
    function smo(C) {
      const n = data.length, xs = data.map((p) => [p[0], p[1]]), ys = data.map((p) => p[2]);
      const K = (i, j) => xs[i][0] * xs[j][0] + xs[i][1] * xs[j][1];
      const a = new Array(n).fill(0);
      let b = 0, passes = 0, iter = 0;
      const r = rng(5);
      const f = (i) => { let s = b; for (let j = 0; j < n; j++) if (a[j]) s += a[j] * ys[j] * K(j, i); return s; };
      const tol = 1e-4;
      while (passes < 30 && iter < 4000) {
        let changed = 0; iter++;
        for (let i = 0; i < n; i++) {
          const Ei = f(i) - ys[i];
          if ((ys[i] * Ei < -tol && a[i] < C) || (ys[i] * Ei > tol && a[i] > 0)) {
            let j = Math.floor(r() * (n - 1)); if (j >= i) j++;
            const Ej = f(j) - ys[j];
            const ai = a[i], aj = a[j];
            let lo, hi;
            if (ys[i] !== ys[j]) { lo = Math.max(0, aj - ai); hi = Math.min(C, C + aj - ai); } else { lo = Math.max(0, ai + aj - C); hi = Math.min(C, ai + aj); }
            if (hi - lo < 1e-12) continue;
            const eta = 2 * K(i, j) - K(i, i) - K(j, j);
            if (eta >= 0) continue;
            a[j] = Math.min(hi, Math.max(lo, aj - (ys[j] * (Ei - Ej)) / eta));
            if (Math.abs(a[j] - aj) < 1e-7) continue;
            a[i] = ai + ys[i] * ys[j] * (aj - a[j]);
            const b1 = b - Ei - ys[i] * (a[i] - ai) * K(i, i) - ys[j] * (a[j] - aj) * K(i, j);
            const b2 = b - Ej - ys[i] * (a[i] - ai) * K(i, j) - ys[j] * (a[j] - aj) * K(j, j);
            b = a[i] > 0 && a[i] < C ? b1 : a[j] > 0 && a[j] < C ? b2 : (b1 + b2) / 2;
            changed++;
          }
        }
        passes = changed ? 0 : passes + 1;
      }
      const w = [0, 0];
      for (let i = 0; i < n; i++) { w[0] += a[i] * ys[i] * xs[i][0]; w[1] += a[i] * ys[i] * xs[i][1]; }
      return { w, b, a };
    }
    function lineAt(w, b, c) {
      // w0 x + w1 y + b = c，在 [0,10]² 內的線段
      const pts = [];
      if (Math.abs(w[1]) > 1e-9) for (const x of [0, 10]) pts.push([x, (c - b - w[0] * x) / w[1]]);
      if (Math.abs(w[0]) > 1e-9) for (const y of [0, 10]) pts.push([(c - b - w[1] * y) / w[0], y]);
      const inside = pts.filter((p) => p[0] >= -1e-6 && p[0] <= 10 + 1e-6 && p[1] >= -1e-6 && p[1] <= 10 + 1e-6);
      if (inside.length < 2) return '';
      inside.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      const p = inside[0], q = inside[inside.length - 1];
      return `M${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)} L${X(q[0]).toFixed(1)} ${Y(q[1]).toFixed(1)}`;
    }
    function render() {
      const C = Math.pow(10, Number(cIn.value));
      const { w, b, a } = smo(C);
      const nw = Math.hypot(w[0], w[1]);
      let g = axes({ W, H, L, R, T, B, X, Y, xt: [0, 5, 10], yt: [0, 5, 10], xl: 'x₁', yl: 'x₂' });
      if (nw > 1e-9) {
        g += `<path class="line dash" d="${lineAt(w, b, 1)}"/><path class="line dash" d="${lineAt(w, b, -1)}"/><path class="line" d="${lineAt(w, b, 0)}"/>`;
      }
      let sv = 0, viol = 0, wrong = 0;
      data.forEach((p, i) => {
        const fx = w[0] * p[0] + w[1] * p[1] + b, m = p[2] * fx;
        g += `<circle class="p ${p[2] > 0 ? 'c1' : 'c0'}" cx="${X(p[0])}" cy="${Y(p[1])}" r="5.5"/>`;
        if (a[i] > 1e-6) { g += `<circle class="ring" cx="${X(p[0])}" cy="${Y(p[1])}" r="9"/>`; sv++; }
        if (m < 1 - 1e-3) viol++;
        if (m < 0) wrong++;
      });
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      out.innerHTML = '<div id="svm-f"></div>' +
        `<div>C = ${fmt(C, 3)}：邊界寬度 2/‖w‖ = <span class="big">${nw > 1e-9 ? fmt(2 / nw, 3) : '∞'}</span>，支援向量（λ &gt; 0）${sv} 個，落在邊界內 ${viol} 個，分錯 ${wrong} 個。</div>` +
        `<div class="muted">${C >= 30 ? 'C 很大：幾乎不允許違規，接近硬邊界。' : C <= 0.05 ? 'C 很小：違規很便宜，邊界變得很寬，很多點都落在邊界內。' : '試著加一個跑到對面的點，再比較 C = 0.01 和 C = 100。'}</div>`;
      tex($('#svm-f', out), `f(x) = ${fmt(w[0], 3)}x_1 ${w[1] >= 0 ? '+' : '-'} ${fmt(Math.abs(w[1]), 3)}x_2 ${b >= 0 ? '+' : '-'} ${fmt(Math.abs(b), 3)}`);
    }
    svg.addEventListener('click', (ev) => {
      const p = svgXY(svg, ev);
      if (p.x < L || p.x > W - R || p.y < T || p.y > H - B) return;
      data.push([iX(p.x), iY(p.y), addCls]);
      render();
    });
    $$('button', seg).forEach((bt) => bt.addEventListener('click', () => {
      addCls = Number(bt.dataset.c);
      $$('button', seg).forEach((x) => x.setAttribute('aria-pressed', String(x === bt)));
    }));
    $('#svm-reset').addEventListener('click', () => { data = BASE.map((p) => p.slice()); render(); });
    bindRange(cIn, render, (v) => fmt(v, 2));
  })();

  /* ===== 核函數 ===== */
  (function kernelWidget() {
    const ids = ['#kn-x1', '#kn-x2', '#kn-z1', '#kn-z2', '#kn-g'];
    const ins = ids.map((s) => $(s)), out = $('#kn-out');
    function render() {
      const [x1, x2, z1, z2, g] = ins.map((i) => Number(i.value) || 0);
      const s2 = Math.SQRT2;
      const px = [x1 * x1, s2 * x1 * x2, x2 * x2], pz = [z1 * z1, s2 * z1 * z2, z2 * z2];
      const dotp = px[0] * pz[0] + px[1] * pz[1] + px[2] * pz[2];
      const xz = x1 * z1 + x2 * z2, d2 = (x1 - z1) ** 2 + (x2 - z2) ** 2;
      out.innerHTML = '<div id="kn-a"></div><div id="kn-b"></div><div id="kn-c"></div><div id="kn-d" style="margin-top:6px"></div>' +
        `<div class="muted">兩種算法都得到 ${fmt(dotp, 4)}：核技巧只用 2 維的乘法就算出 3 維空間的內積。RBF 核對應的是無限維的 φ，只能用核函數算。</div>`;
      tex($('#kn-a', out), `\\phi(x) = (${fmt(px[0], 3)},\\ ${fmt(px[1], 3)},\\ ${fmt(px[2], 3)}),\\quad \\phi(z) = (${fmt(pz[0], 3)},\\ ${fmt(pz[1], 3)},\\ ${fmt(pz[2], 3)})`);
      tex($('#kn-b', out), `\\phi(x)^T\\phi(z) = ${fmt(px[0] * pz[0], 3)} + ${fmt(px[1] * pz[1], 3)} + ${fmt(px[2] * pz[2], 3)} = ${fmt(dotp, 4)}`);
      tex($('#kn-c', out), `(x^Tz)^2 = (${x1} \\times ${z1} + ${x2} \\times ${z2})^2 = ${fmt(xz, 3)}^2 = ${fmt(xz * xz, 4)}`);
      tex($('#kn-d', out), `K_{RBF}(x, z) = e^{-\\gamma\\lVert x - z\\rVert^2} = e^{-${g} \\times ${fmt(d2, 3)}} = ${f4(Math.exp(-g * d2))}`);
    }
    ins.forEach((i) => i.addEventListener('input', render));
    render();
  })();

  /* ===== 集成錯誤率 ===== */
  (function ensWidget() {
    const nIn = $('#en-n'), eIn = $('#en-e'), svg = $('#en-svg'), out = $('#en-out');
    const lchoose = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };
    function render() {
      const n = Number(nIn.value), e = Number(eIn.value), need = Math.floor(n / 2) + 1;
      const pm = [];
      for (let i = 0; i <= n; i++) pm.push(Math.exp(lchoose(n, i) + i * Math.log(e) + (n - i) * Math.log(1 - e)));
      const err = pm.slice(need).reduce((a, b) => a + b, 0);
      const W = 440, H = 180, L = 34, R = 10, T = 12, B = 26;
      const mx = Math.max(...pm);
      const bw = (W - L - R) / (n + 1);
      const X = (i) => L + i * bw, Y = (v) => T + (1 - v / mx) * (H - T - B);
      let g = `<path class="axis" d="M${L} ${T} V${H - B} H${W - R}"/>`;
      pm.forEach((p, i) => { g += `<rect class="bar${i >= need ? ' bad' : ''}" x="${(X(i) + bw * 0.12).toFixed(1)}" y="${Y(p).toFixed(1)}" width="${(bw * 0.76).toFixed(1)}" height="${(H - B - Y(p)).toFixed(1)}"/>`; });
      const step = n > 30 ? 10 : n > 12 ? 5 : 1;
      for (let i = 0; i <= n; i += step) g += `<text class="tick" x="${X(i) + bw / 2}" y="${H - B + 12}" text-anchor="middle">${i}</text>`;
      g += `<path class="grid" d="M${X(need)} ${T} V${H - B}"/><text class="tick" x="${X(need) + 4}" y="${T + 6}">≥ ${need} 個錯 → 多數決錯</text>`;
      g += `<text class="tick" x="${W - R}" y="${H - 6}" text-anchor="end">同時錯的分類器數</text>`;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      out.innerHTML = '<div id="en-f"></div>' +
        `<div>集成錯誤率 <span class="big ${err < e ? 'good' : 'bad'}">${f4(err)}</span>（單一分類器 ${fmt(e, 2)}）</div>` +
        `<div class="muted">${e > 0.5 ? 'ε &gt; 0.5：每個分類器比亂猜還差，多數決會把錯誤放大。' : e === 0.5 ? 'ε = 0.5：和亂猜一樣，集成沒有幫助。' : '前提是分類器彼此獨立；如果 25 個預測完全一樣，集成錯誤率就還是 ε。'}</div>`;
      tex($('#en-f', out), `\\sum_{i=${need}}^{${n}} \\binom{${n}}{i} ${fmt(e, 2)}^i \\, ${fmt(1 - e, 2)}^{${n}-i} = ${f4(err)}`);
    }
    bindRange(nIn, render);
    bindRange(eIn, render, (v) => v.toFixed(2));
  })();

  /* ===== Bagging／AdaBoost 決策樹樁 ===== */
  (function boostWidget() {
    const xs = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const ys = [1, 1, 1, -1, -1, -1, -1, 1, 1, 1];
    const n = xs.length, ROUNDS = 10;
    const cuts = [0.05].concat(xs.slice(0, -1).map((x, i) => Number(((x + xs[i + 1]) / 2).toFixed(3))), [1.05]);
    const mode = $('#bs-mode'), svg = $('#bs-svg'), tbl = $('#bs-table'), out = $('#bs-out'), cnt = $('#bs-count');
    let rounds = [], weights, rnd;
    const H2 = (p, q) => { const t = p + q; if (!t) return 0; let h = 0; for (const c of [p, q]) if (c) h -= (c / t) * Math.log2(c / t); return h; };
    // 依樣本（索引陣列）用資訊增益選樹樁
    function stumpIG(idx) {
      const cnt2 = (arr) => [arr.filter((i) => ys[i] > 0).length, arr.filter((i) => ys[i] < 0).length];
      const all = cnt2(idx), base = H2(all[0], all[1]);
      const maj = (c) => (c[0] >= c[1] ? 1 : -1);
      let best = null;
      for (const t of cuts) {
        const l = idx.filter((i) => xs[i] <= t), r = idx.filter((i) => xs[i] > t);
        const cl = cnt2(l), cr = cnt2(r);
        const gain = base - (l.length / idx.length) * H2(cl[0], cl[1]) - (r.length / idx.length) * H2(cr[0], cr[1]);
        if (!best || gain > best.gain + 1e-12) best = { t, gain, left: l.length ? maj(cl) : maj(all), right: r.length ? maj(cr) : maj(all) };
      }
      return best;
    }
    function stumpW(w) {
      let best = null;
      for (const t of cuts) for (const left of [1, -1]) {
        let e = 0;
        for (let i = 0; i < n; i++) if ((xs[i] <= t ? left : -left) !== ys[i]) e += w[i];
        if (!best || e < best.err - 1e-12) best = { t, left, right: -left, err: e };
      }
      return best;
    }
    const h = (s, x) => (x <= s.t ? s.left : s.right);
    function reset() {
      rounds = []; weights = new Array(n).fill(1 / n); rnd = rng(11);
      render();
    }
    function step() {
      if (rounds.length >= ROUNDS) return;
      if (mode.value === 'bag') {
        const idx = Array.from({ length: n }, () => Math.floor(rnd() * n)).sort((a, b) => a - b);
        const s = stumpIG(idx);
        s.sample = idx; s.alpha = 1;
        rounds.push(s);
      } else {
        const s = stumpW(weights);
        const e = Math.min(Math.max(s.err, 1e-10), 1 - 1e-10);
        s.alpha = 0.5 * Math.log((1 - e) / e);
        s.wBefore = weights.slice();
        const nw = weights.map((w, i) => w * Math.exp(-s.alpha * ys[i] * h(s, xs[i])));
        const Z = nw.reduce((a, b) => a + b, 0);
        weights = nw.map((w) => w / Z);
        rounds.push(s);
      }
      render();
    }
    function ensemble(x) {
      let s = 0;
      for (const r of rounds) s += r.alpha * h(r, x);
      return s;
    }
    function render() {
      const isAda = mode.value === 'ada';
      cnt.textContent = `${rounds.length}／${ROUNDS} 輪`;
      $('#bs-next').disabled = $('#bs-all').disabled = rounds.length >= ROUNDS;
      const W = 460, H = 200, L = 30, R = 14;
      const X = (x) => L + ((x - 0.05) / 1.0) * (W - L - R);
      const last = rounds[rounds.length - 1];
      let g = `<path class="axis" d="M${L} 150 H${W - R}"/>`;
      // 權重／抽樣次數長條
      const bars = isAda ? (last ? last.wBefore : weights) : (last ? xs.map((_, i) => last.sample.filter((j) => j === i).length) : new Array(n).fill(0));
      const mx = isAda ? Math.max(...bars, 0.2) : 4;
      bars.forEach((v, i) => {
        const hh = (v / mx) * 58;
        g += `<rect class="bar" x="${X(xs[i]) - 9}" y="${150 - hh}" width="18" height="${hh}"/>`;
        g += `<text class="tick" x="${X(xs[i])}" y="${144 - hh}" text-anchor="middle">${isAda ? fmt(v, 3) : v}</text>`;
      });
      if (last) g += `<path class="line acc" d="M${X(last.t)} 70 V160"/><text class="tick" x="${X(last.t) + 4}" y="74">第 ${rounds.length} 輪：x ≤ ${last.t} → ${last.left > 0 ? '+' : '−'}，否則 ${last.right > 0 ? '+' : '−'}</text>`;
      xs.forEach((x, i) => {
        g += `<circle class="p ${ys[i] > 0 ? 'c1' : 'c0'}" cx="${X(x)}" cy="30" r="10"/><text class="lab" x="${X(x)}" y="30" text-anchor="middle">${ys[i] > 0 ? '+' : '−'}</text>`;
        g += `<text class="tick" x="${X(x)}" y="164" text-anchor="middle">${x}</text>`;
        if (rounds.length) {
          const p = ensemble(x) >= 0 ? 1 : -1;
          g += `<text class="lab" x="${X(x)}" y="184" text-anchor="middle" style="fill:var(${p === ys[i] ? '--pos' : '--neg'})">${p > 0 ? '+' : '−'}${p === ys[i] ? '' : '✗'}</text>`;
        }
      });
      g += `<text class="tick" x="${L - 4}" y="30" text-anchor="end">y</text>`;
      if (rounds.length) g += `<text class="tick" x="${L - 4}" y="184" text-anchor="end">H</text>`;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      // 表格
      let t = `<table><tr><th class="num">輪</th>${isAda ? '' : '<th>抽到的樣本（x）</th>'}<th>樹樁</th>${isAda ? '<th class="num">加權錯誤率 ε</th><th class="num">α</th>' : '<th class="num">資訊增益</th>'}</tr>`;
      rounds.forEach((r, i) => {
        t += `<tr><td class="num">${i + 1}</td>${isAda ? '' : `<td style="font-family:var(--mono);font-size:.84rem">${r.sample.map((j) => xs[j]).join(' ')}</td>`}` +
          `<td>x ≤ ${r.t} → ${r.left > 0 ? '+' : '−'}；x &gt; ${r.t} → ${r.right > 0 ? '+' : '−'}</td>` +
          (isAda ? `<td class="num">${f4(r.err)}</td><td class="num">${f4(r.alpha)}</td>` : `<td class="num">${f4(r.gain)}</td>`) + '</tr>';
      });
      tbl.innerHTML = rounds.length ? t + '</table>' : '';
      const acc = rounds.length ? xs.filter((x, i) => (ensemble(x) >= 0 ? 1 : -1) === ys[i]).length : 0;
      out.innerHTML = !rounds.length
        ? `<div>${isAda ? '一開始每筆權重都是 1/10 = 0.1（長條）。' : 'Bagging 每輪從 10 筆中取後放回抽 10 筆。'}按「下一輪」。</div>`
        : `<div>合併 ${rounds.length} 個樹樁（${isAda ? '依 α 加權投票' : '多數決'}）：訓練資料分對 <span class="big">${acc}/10</span></div>` +
          `<div class="muted">${isAda ? '長條是這一輪訓練時用的權重：上一輪分錯的樣本權重變大，所以這輪的樹樁會優先把它們分對。' : '長條是這一輪每筆被抽到的次數；沒被抽到（0）的是袋外資料。'}${acc === 10 ? ' 已經全部分對：單一樹樁做不到，組合起來就可以。' : ''}</div>`;
    }
    $('#bs-next').addEventListener('click', step);
    $('#bs-all').addEventListener('click', () => { while (rounds.length < ROUNDS) step(); });
    $('#bs-reset').addEventListener('click', reset);
    mode.addEventListener('change', reset);
    reset();
  })();

  /* ===== Bootstrap ===== */
  (function bootWidget() {
    const nIn = $('#bt-n'), box = $('#bt-cells'), out = $('#bt-out');
    let r = rng(3), total = 0, hit = 0;
    function draw() {
      const n = Number(nIn.value);
      const c = new Array(n).fill(0);
      for (let i = 0; i < n; i++) c[Math.floor(r() * n)]++;
      box.innerHTML = '';
      c.forEach((v, i) => box.append(el('span', { class: 'chip' + (v ? ' ok' : ' no'), text: `#${i + 1}×${v}` })));
      const inBag = c.filter((v) => v).length;
      total += n; hit += inBag;
      const th = 1 - Math.pow(1 - 1 / n, n);
      out.innerHTML = `<div>這次 ${n} 筆中有 <strong>${inBag}</strong> 筆被抽到（${fmt((inBag / n) * 100, 1)}%），${n - inBag} 筆是袋外資料。</div>` +
        `<div>理論值 1 − (1 − 1/${n})<sup>${n}</sup> = <span class="big">${fmt(th * 100, 2)}%</span>；目前累積 ${fmt((hit / total) * 100, 2)}%（共 ${total} 筆）。n → ∞ 時趨近 63.21%。</div>`;
    }
    bindRange(nIn, () => { total = 0; hit = 0; draw(); });
    $('#bt-draw').addEventListener('click', draw);
  })();
})();
