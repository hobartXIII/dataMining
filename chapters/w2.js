/* W2 互動元件 */
(function () {
  'use strict';
  const { $, $$, fmt, cssVar, setupCanvas, onRedraw, pointer } = DM;

  const median = (a) => {
    const n = a.length, m = Math.floor(n / 2);
    return n % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };

  /* ===== 描述統計與盒鬚圖 ===== */
  (function stats() {
    const inp = $('#s-data'), svg = $('#s-svg'), out = $('#s-out');
    function render() {
      const a = inp.value.split(/[\s,，、]+/).filter((s) => s !== '').map(Number).filter(isFinite).sort((p, q) => p - q);
      if (a.length < 2) { out.innerHTML = '<span class="bad">至少要輸入 2 個數字。</span>'; svg.innerHTML = ''; return; }
      const n = a.length, sum = a.reduce((s, v) => s + v, 0), mean = sum / n;
      const med = median(a);
      const half = Math.floor(n / 2);
      const lo = a.slice(0, half), hi = a.slice(n % 2 ? half + 1 : half);
      const q1 = median(lo), q3 = median(hi), iqr = q3 - q1;
      const lb = q1 - 1.5 * iqr, ub = q3 + 1.5 * iqr;
      const outl = a.filter((v) => v < lb || v > ub);
      const inl = a.filter((v) => v >= lb && v <= ub);
      const freq = {};
      a.forEach((v) => { freq[v] = (freq[v] || 0) + 1; });
      const top = Math.max(...Object.values(freq));
      const modes = top > 1 ? Object.keys(freq).filter((k) => freq[k] === top).map(Number) : [];
      const trim = n > 2 ? a.slice(1, -1).reduce((s, v) => s + v, 0) / (n - 2) : NaN;
      const vp = a.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
      const vs = vp * n / (n - 1);

      // 盒鬚圖
      const W = 600, H = 120, L = 30, R = 570;
      const min = a[0], max = a[n - 1];
      const span = max - min || 1;
      const x = (v) => L + (v - min) / span * (R - L);
      const wl = inl.length ? inl[0] : q1, wr = inl.length ? inl[inl.length - 1] : q3;
      const txt = cssVar('--text'), t2 = cssVar('--text-2'), acc = cssVar('--accent'), neg = cssVar('--neg');
      let g = `<line x1="${x(wl)}" y1="50" x2="${x(q1)}" y2="50" stroke="${txt}" stroke-width="1.5"/>` +
        `<line x1="${x(q3)}" y1="50" x2="${x(wr)}" y2="50" stroke="${txt}" stroke-width="1.5"/>` +
        `<line x1="${x(wl)}" y1="38" x2="${x(wl)}" y2="62" stroke="${txt}" stroke-width="1.5"/>` +
        `<line x1="${x(wr)}" y1="38" x2="${x(wr)}" y2="62" stroke="${txt}" stroke-width="1.5"/>` +
        `<rect x="${x(q1)}" y="30" width="${Math.max(1, x(q3) - x(q1))}" height="40" fill="${acc}" fill-opacity=".18" stroke="${acc}" stroke-width="1.8"/>` +
        `<line x1="${x(med)}" y1="30" x2="${x(med)}" y2="70" stroke="${acc}" stroke-width="3"/>`;
      a.forEach((v) => {
        const o = v < lb || v > ub;
        g += `<circle cx="${x(v)}" cy="${o ? 50 : 95}" r="${o ? 6 : 4}" fill="${o ? neg : t2}" fill-opacity="${o ? 1 : .6}"/>`;
      });
      const lab = (v, s, y) => `<text x="${x(v)}" y="${y}" fill="${t2}" font-size="12" text-anchor="middle">${s}</text>`;
      g += lab(q1, 'Q1', 22) + lab(q3, 'Q3', 22) + lab(med, '中位數', 82);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;

      out.innerHTML =
        `<div>排序：${a.join(', ')}（n = ${n}）</div>` +
        `<div>平均數 = ${fmt(sum, 3)} ÷ ${n} = <strong>${fmt(mean, 3)}</strong>　中位數 = <strong>${fmt(med, 3)}</strong>　眾數 = <strong>${modes.length ? modes.join(', ') : '無'}</strong>　截尾平均（去頭尾各 1 個）= <strong>${fmt(trim, 3)}</strong></div>` +
        `<div>下半部 ${lo.join(', ')} → Q1 = <strong>${fmt(q1, 3)}</strong>；上半部 ${hi.join(', ')} → Q3 = <strong>${fmt(q3, 3)}</strong>；IQR = <strong>${fmt(iqr, 3)}</strong>；全距 = ${fmt(max - min, 3)}</div>` +
        `<div>離群值界線：下界 ${fmt(q1, 3)} − 1.5 × ${fmt(iqr, 3)} = ${fmt(lb, 3)}，上界 ${fmt(q3, 3)} + 1.5 × ${fmt(iqr, 3)} = ${fmt(ub, 3)} → 離群值：<strong class="${outl.length ? 'bad' : 'good'}">${outl.length ? outl.join(', ') : '沒有'}</strong></div>` +
        `<div class="muted">五數概括：${fmt(min, 3)}、${fmt(q1, 3)}、${fmt(med, 3)}、${fmt(q3, 3)}、${fmt(max, 3)}；母體變異數 ${fmt(vp, 3)}（σ = ${fmt(Math.sqrt(vp), 3)}），樣本變異數 ${fmt(vs, 3)}（s = ${fmt(Math.sqrt(vs), 3)}）</div>`;
    }
    inp.addEventListener('input', render);
    $$('#w-stats [data-set]').forEach((b) => b.addEventListener('click', () => { inp.value = b.dataset.set; render(); }));
    document.addEventListener('themechange', () => requestAnimationFrame(render));
    render();
  })();

  /* ===== 共變異數與相關係數 ===== */
  (function cov() {
    const canvas = $('#cov-canvas'), tbl = $('#cov-table'), out = $('#cov-out');
    let pts = [[2, 5], [3, 8], [5, 10], [4, 11], [6, 14]];
    let drag = -1, view = null;
    function calc() {
      const n = pts.length;
      const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
      const prods = pts.map(([x, y]) => (x - mx) * (y - my));
      const c = prods.reduce((s, v) => s + v, 0) / n;
      const sx = Math.sqrt(pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0) / n);
      const sy = Math.sqrt(pts.reduce((s, p) => s + (p[1] - my) ** 2, 0) / n);
      return { n, mx, my, prods, c, sx, sy, r: sx && sy ? c / (sx * sy) : NaN };
    }
    function draw() {
      const { ctx, w, h } = setupCanvas(canvas, 0.75);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const x0 = Math.min(0, ...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(0, ...ys) - 1, y1 = Math.max(...ys) + 1;
      const P = 30;
      view = { x0, x1, y0, y1, P, w, h };
      const X = (v) => P + (v - x0) / (x1 - x0) * (w - 2 * P), Y = (v) => h - P - (v - y0) / (y1 - y0) * (h - 2 * P);
      const k = calc();
      ctx.strokeStyle = cssVar('--border'); ctx.lineWidth = 1;
      for (let v = Math.ceil(x0); v <= x1; v++) { ctx.beginPath(); ctx.moveTo(X(v), P); ctx.lineTo(X(v), h - P); ctx.stroke(); }
      for (let v = Math.ceil(y0); v <= y1; v += (y1 - y0 > 20 ? 2 : 1)) { ctx.beginPath(); ctx.moveTo(P, Y(v)); ctx.lineTo(w - P, Y(v)); ctx.stroke(); }
      // 平均線把平面分成四個象限：右上、左下的點讓共變異數變大
      ctx.strokeStyle = cssVar('--c-c'); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X(k.mx), P); ctx.lineTo(X(k.mx), h - P); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(P, Y(k.my)); ctx.lineTo(w - P, Y(k.my)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = cssVar('--text-2');
      ctx.fillText(`x̄ = ${fmt(k.mx, 2)}`, X(k.mx) + 4, P + 12);
      ctx.fillText(`ȳ = ${fmt(k.my, 2)}`, w - P - 60, Y(k.my) - 6);
      pts.forEach(([x, y], i) => {
        ctx.beginPath(); ctx.arc(X(x), Y(y), 7, 0, Math.PI * 2);
        ctx.fillStyle = k.prods[i] > 1e-9 ? cssVar('--pos') : k.prods[i] < -1e-9 ? cssVar('--neg') : cssVar('--text-2');
        ctx.fill();
      });
      render(k);
    }
    function render(k) {
      let h = '<table><tr><th>點</th><th class="num">x − x̄</th><th class="num">y − ȳ</th><th class="num">乘積</th></tr>';
      pts.forEach(([x, y], i) => {
        h += `<tr><td>(${fmt(x, 2)}, ${fmt(y, 2)})</td><td class="num">${fmt(x - k.mx, 2)}</td><td class="num">${fmt(y - k.my, 2)}</td><td class="num ${k.prods[i] > 1e-9 ? 'ok' : k.prods[i] < -1e-9 ? 'no' : ''}">${fmt(k.prods[i], 2)}</td></tr>`;
      });
      tbl.innerHTML = h + '</table>';
      const dir = k.c > 1e-9 ? '同方向（一起漲）' : k.c < -1e-9 ? '反方向' : '沒有線性共同變動';
      out.innerHTML = `<div>Cov = 乘積總和 ${fmt(k.prods.reduce((s, v) => s + v, 0), 3)} ÷ ${k.n} = <span class="big">${fmt(k.c, 3)}</span>　→ ${dir}</div>` +
        `<div>σ<sub>x</sub> = ${fmt(k.sx, 3)}、σ<sub>y</sub> = ${fmt(k.sy, 3)} → r = Cov ÷ (σ<sub>x</sub>σ<sub>y</sub>) = <span class="big">${isFinite(k.r) ? fmt(k.r, 3) : '—'}</span></div>` +
        `<div class="muted">綠點在右上或左下象限（乘積為正），紅點在左上或右下（乘積為負）。${Math.abs(k.c) < 1e-9 ? '這組點的 Cov = 0，但 y 完全由 x 決定：共變異數為 0 不代表獨立。' : ''}</div>`;
    }
    canvas.addEventListener('pointerdown', (ev) => {
      if (!view) return;
      const p = pointer(canvas, ev);
      const { x0, x1, y0, y1, P, w, h } = view;
      const X = (v) => P + (v - x0) / (x1 - x0) * (w - 2 * P), Y = (v) => h - P - (v - y0) / (y1 - y0) * (h - 2 * P);
      drag = pts.findIndex(([x, y]) => Math.hypot(X(x) - p.x, Y(y) - p.y) < 14);
      if (drag >= 0) canvas.setPointerCapture(ev.pointerId);
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (drag < 0) return;
      const p = pointer(canvas, ev);
      const { x0, x1, y0, y1, P, w, h } = view;
      const vx = x0 + (p.x - P) / (w - 2 * P) * (x1 - x0), vy = y0 + (h - P - p.y) / (h - 2 * P) * (y1 - y0);
      pts[drag] = [Math.round(Math.min(x1, Math.max(x0, vx))), Math.round(Math.min(y1, Math.max(y0, vy)))];
      draw();
    });
    canvas.addEventListener('pointerup', () => { drag = -1; draw(); });
    $$('#w-cov [data-pts]').forEach((b) => b.addEventListener('click', () => {
      pts = b.dataset.pts.split(';').map((s) => s.split(',').map(Number));
      draw();
    }));
    onRedraw(draw);
  })();

  /* ===== 卡方 ===== */
  (function chi() {
    const tbl = $('#chi-table'), out = $('#chi-out');
    let o = [250, 200, 50, 1000];
    const NAMES = [['喜歡科幻', '不喜歡科幻'], ['下棋', '不下棋']];
    function build() {
      const inp = (i) => `<input type="number" min="0" step="1" value="${o[i]}" data-i="${i}" style="width:84px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font:inherit">`;
      tbl.innerHTML = `<table><tr><th></th><th>${NAMES[1][0]}</th><th>${NAMES[1][1]}</th><th class="num">合計</th></tr>` +
        `<tr><th>${NAMES[0][0]}</th><td>${inp(0)} <span class="muted" data-e="0"></span></td><td>${inp(1)} <span class="muted" data-e="1"></span></td><td class="num" data-r="0"></td></tr>` +
        `<tr><th>${NAMES[0][1]}</th><td>${inp(2)} <span class="muted" data-e="2"></span></td><td>${inp(3)} <span class="muted" data-e="3"></span></td><td class="num" data-r="1"></td></tr>` +
        `<tr><th>合計</th><td class="num" data-c="0"></td><td class="num" data-c="1"></td><td class="num" data-n></td></tr></table>`;
      $$('input', tbl).forEach((el) => el.addEventListener('input', () => { o[Number(el.dataset.i)] = Math.max(0, Number(el.value) || 0); calc(); }));
      calc();
    }
    function calc() {
      const r = [o[0] + o[1], o[2] + o[3]], c = [o[0] + o[2], o[1] + o[3]], n = r[0] + r[1];
      $$('[data-r]', tbl).forEach((el) => { el.textContent = r[el.dataset.r]; });
      $$('[data-c]', tbl).forEach((el) => { el.textContent = c[el.dataset.c]; });
      $('[data-n]', tbl).textContent = n;
      if (!n || r.includes(0) || c.includes(0)) { out.innerHTML = '<span class="bad">每列、每欄的合計都要大於 0。</span>'; return; }
      const e = [r[0] * c[0] / n, r[0] * c[1] / n, r[1] * c[0] / n, r[1] * c[1] / n];
      $$('[data-e]', tbl).forEach((el) => { el.textContent = `（期望 ${fmt(e[el.dataset.e], 2)}）`; });
      const parts = o.map((v, i) => (v - e[i]) ** 2 / e[i]);
      const x2 = parts.reduce((s, v) => s + v, 0);
      out.innerHTML = `<div>各格 (o − e)² ÷ e：${parts.map((p) => fmt(p, 2)).join(' + ')}</div>` +
        `<div>χ² = <span class="big">${fmt(x2, 2)}</span>　自由度 = (2 − 1)(2 − 1) = 1</div>` +
        `<div>顯著水準 0.05（臨界值 3.841）：${x2 > 3.841 ? '<span class="good">拒絕 H0，有關聯</span>' : '<span class="muted">不能拒絕 H0</span>'}　` +
        `0.001（臨界值 10.828）：${x2 > 10.828 ? '<span class="good">拒絕 H0，有關聯</span>' : '<span class="muted">不能拒絕 H0</span>'}</div>` +
        `<div class="muted"><span class="tag add">補充</span>臨界值查卡方分配表，講義例子只給 χ² 值。</div>`;
    }
    $$('#w-chi [data-chi]').forEach((b) => b.addEventListener('click', () => { o = b.dataset.chi.split(',').map(Number); build(); }));
    build();
  })();
})();
