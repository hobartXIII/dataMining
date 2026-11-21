/* W10 互動元件：Fisher score、過度配適、混淆矩陣、ROC、交叉驗證、重抽樣、LIBSVM 格式 */
(function () {
  'use strict';
  const { $, $$, el, fmt, tex, rng, gauss, bindRange } = DM;
  const f4 = (x) => x.toFixed(4);
  const pc = (x) => (isFinite(x) ? fmt(x * 100, 2) + '%' : '—');
  const parse = (s) => s.split(/[,，\s]+/).filter(Boolean).map(Number).filter((v) => isFinite(v));

  /* ===== Fisher score ===== */
  (function fisherWidget() {
    const a = $('#fs-a'), b = $('#fs-b'), out = $('#fs-out'), seg = $('#fs-presets');
    const PRE = [
      ['讀書時數', '8, 10, 12, 9, 11, 13', '2, 4, 3, 5, 1, 4'],
      ['學號末兩碼', '12, 87, 45, 33, 70, 5', '56, 21, 90, 8, 64, 39'],
    ];
    PRE.forEach(([name, x, y], i) => {
      const bt = el('button', { class: 'btn', type: 'button', text: name });
      bt.addEventListener('click', () => { a.value = x; b.value = y; render(); $$('button', seg).forEach((q, j) => q.setAttribute('aria-pressed', String(i === j))); });
      seg.append(bt);
    });
    function render() {
      const cls = [parse(a.value), parse(b.value)];
      if (cls.some((c) => c.length < 1)) { out.innerHTML = '<span class="muted">兩個類別都至少要有一個數字。</span>'; return; }
      const all = cls.flat(), mu = all.reduce((s, v) => s + v, 0) / all.length;
      const st = cls.map((c) => { const m = c.reduce((s, v) => s + v, 0) / c.length; return { n: c.length, m, v: c.reduce((s, x) => s + (x - m) ** 2, 0) / c.length }; });
      const num = st.reduce((s, c) => s + c.n * (c.m - mu) ** 2, 0), den = st.reduce((s, c) => s + c.n * c.v, 0);
      const F = den ? num / den : Infinity;
      out.innerHTML = `<div>整體平均 μ = ${fmt(mu, 3)}；類別 1：n = ${st[0].n}、μ₁ = ${fmt(st[0].m, 3)}、σ₁² = ${fmt(st[0].v, 3)}；類別 2：n = ${st[1].n}、μ₂ = ${fmt(st[1].m, 3)}、σ₂² = ${fmt(st[1].v, 3)}</div><div id="fs-f"></div>` +
        `<div class="muted">${F > 1 ? '類別之間的差距遠大於類別內的變動：好特徵。' : F < 0.1 ? '兩類的平均幾乎一樣、類別內又很分散：這個特徵對分類幾乎沒有幫助。' : '有一點區分能力。'}<span class="tag add">補充</span>這裡的變異數用母體變異數（除以 n）。</div>`;
      tex($('#fs-f', out), `F = \\frac{${st.map((c) => `${c.n}(${fmt(c.m, 2)} - ${fmt(mu, 2)})^2`).join(' + ')}}{${st.map((c) => `${c.n} \\times ${fmt(c.v, 2)}`).join(' + ')}} = \\frac{${fmt(num, 3)}}{${fmt(den, 3)}} = ${isFinite(F) ? fmt(F, 4) : '\\infty'}`);
    }
    a.addEventListener('input', render); b.addEventListener('input', render);
    seg.firstChild.click();
  })();

  /* ===== 過度配適：多項式迴歸 ===== */
  (function fitWidget() {
    const dIn = $('#fit-d'), more = $('#fit-more'), svg = $('#fit-svg'), esvg = $('#fit-err'), out = $('#fit-out');
    const truth = (x) => Math.sin(2 * Math.PI * x) * 0.9 + 0.3 * x;
    const r = rng(17);
    const mk = (n) => Array.from({ length: n }, () => { const x = r(); return [x, truth(x) + 0.28 * gauss(r)]; });
    // 訓練點的 x 大致均勻（格點加一點抖動），避免邊緣空白讓高次多項式一開始就爆掉
    const grid = (n, off) => Array.from({ length: n }, (_, i) => { const x = (i + off + 0.3 * (r() - 0.5)) / n; return [x, truth(x) + 0.28 * gauss(r)]; });
    const train12 = grid(12, 0.5), train24 = train12.concat(grid(12, 0.0).map((p) => [Math.min(0.99, p[0] + 0.0001), p[1]])), test = mk(80);
    const MAXD = 12;
    function solve(A, y) {
      const n = A.length, M = A.map((row, i) => row.concat([y[i]]));
      for (let c = 0; c < n; c++) {
        let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
        [M[c], M[p]] = [M[p], M[c]];
        const d = M[c][c] || 1e-12;
        for (let i = 0; i < n; i++) if (i !== c) { const f = M[i][c] / d; for (let j = c; j <= n; j++) M[i][j] -= f * M[c][j]; }
      }
      return M.map((row, i) => row[n] / (row[i] || 1e-12));
    }
    const feat = (x, d) => { const t = 2 * x - 1, v = [1]; for (let i = 1; i <= d; i++) v.push(v[i - 1] * t); return v; };
    function fit(data, d) {
      const p = d + 1, A = Array.from({ length: p }, () => new Array(p).fill(0)), y = new Array(p).fill(0);
      for (const [x, t] of data) { const f = feat(x, d); for (let i = 0; i < p; i++) { y[i] += f[i] * t; for (let j = 0; j < p; j++) A[i][j] += f[i] * f[j]; } }
      for (let i = 0; i < p; i++) A[i][i] += 1e-7;
      return solve(A, y);
    }
    const pred = (w, x) => feat(x, w.length - 1).reduce((s, f, i) => s + f * w[i], 0);
    const mse = (w, data) => data.reduce((s, [x, t]) => s + (pred(w, x) - t) ** 2, 0) / data.length;
    const curves = {};
    for (const key of ['12', '24']) {
      const tr = key === '12' ? train12 : train24;
      curves[key] = Array.from({ length: MAXD + 1 }, (_, d) => { const w = fit(tr, d); return { w, tr: mse(w, tr), te: mse(w, test) }; });
    }
    function render() {
      const d = Number(dIn.value), key = more.checked ? '24' : '12', tr = more.checked ? train24 : train12;
      const C = curves[key], cur = C[d];
      // 左：資料與曲線
      let W = 320, H = 220, L = 26, R = 8, T = 10, B = 20;
      let X = (x) => L + x * (W - L - R), Y = (y) => T + (1 - (y + 1.8) / 3.6) * (H - T - B);
      let g = `<path class="axis" d="M${L} ${T} V${H - B} H${W - R}"/>`;
      for (const [x, t] of test) g += `<circle class="p c1" cx="${X(x)}" cy="${Y(t)}" r="2.2" opacity=".55"/>`;
      for (const [x, t] of tr) g += `<circle class="p c0" cx="${X(x)}" cy="${Y(t)}" r="4.5"/>`;
      let p = '';
      for (let i = 0; i <= 200; i++) { const x = i / 200, y = Math.max(-1.8, Math.min(1.8, pred(cur.w, x))); p += (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1); }
      g += `<path class="line" d="${p}"/>`;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = `<defs><clipPath id="fit-clip"><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/></clipPath></defs><g clip-path="url(#fit-clip)">${g}</g>`;
      // 右：錯誤曲線
      W = 300; H = 220; L = 36; R = 10; T = 12; B = 26;
      const ymax = 0.6;
      X = (k) => L + (k / MAXD) * (W - L - R); Y = (v) => T + (1 - Math.min(v, ymax) / ymax) * (H - T - B);
      let e = `<path class="axis" d="M${L} ${T} V${H - B} H${W - R}"/>`;
      for (const v of [0, 0.2, 0.4, 0.6]) e += `<text class="tick" x="${L - 4}" y="${Y(v)}" text-anchor="end">${v}</text>`;
      for (const k of [0, 3, 6, 9, 12]) e += `<text class="tick" x="${X(k)}" y="${H - B + 12}" text-anchor="middle">${k}</text>`;
      e += `<text class="tick" x="${W - R}" y="${H - 4}" text-anchor="end">次數（複雜度）</text><text class="tick" x="${L + 4}" y="${T + 2}">MSE</text>`;
      const line = (fn) => C.map((c, k) => (k ? 'L' : 'M') + X(k).toFixed(1) + ' ' + Y(fn(c)).toFixed(1)).join('');
      e += `<path class="line c0" d="${line((c) => c.tr)}"/><path class="line acc" d="${line((c) => c.te)}"/>`;
      const best = C.reduce((bi, c, k) => (c.te < C[bi].te ? k : bi), 0);
      e += `<path class="grid" d="M${X(d)} ${T} V${H - B}"/><circle class="dot" cx="${X(best)}" cy="${Y(C[best].te)}" r="5"/><text class="tick" x="${X(best) + 6}" y="${Y(C[best].te) - 10}">測試最低</text>`;
      esvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      esvg.innerHTML = e;
      const state = d < 2 ? '配適不足：模型太簡單，訓練和測試錯誤都高。' : d > best + 2 ? '過度配適：曲線為了穿過訓練點而扭來扭去，訓練錯誤很低、測試錯誤變高。' : '接近剛好：測試錯誤在最低點附近。';
      out.innerHTML = `<div>次數 ${d}（${d + 1} 個參數，${tr.length} 筆訓練資料）：訓練 MSE = <span class="bad">${f4(cur.tr)}</span>、測試 MSE = <span style="color:var(--c-b);font-weight:600">${f4(cur.te)}</span></div>` +
        `<div>${state} 測試錯誤最低的是 ${best} 次。</div>`;
    }
    more.addEventListener('change', render);
    bindRange(dIn, render);
  })();

  /* ===== 混淆矩陣 ===== */
  (function cmWidget() {
    const ids = ['tp', 'fn', 'fp', 'tn'], ins = ids.map((k) => $('#cm-' + k));
    const beta = $('#cm-beta'), bars = $('#cm-bars'), out = $('#cm-out'), seg = $('#cm-presets');
    const PRE = [
      ['癌症練習（第 33 頁）', [90, 210, 140, 9560]],
      ['A', [10, 40, 10, 40]], ['B', [25, 25, 25, 25]], ['C', [40, 10, 40, 10]],
      ['3% 罹癌，全猜沒有', [0, 30, 0, 970]],
    ];
    PRE.forEach(([name, v], i) => {
      const b = el('button', { class: 'btn', type: 'button', text: name });
      b.addEventListener('click', () => { v.forEach((x, j) => { ins[j].value = x; }); render(); $$('button', seg).forEach((q, j) => q.setAttribute('aria-pressed', String(i === j))); });
      seg.append(b);
    });
    function render() {
      const [TP, FN, FP, TN] = ins.map((i) => Math.max(0, Number(i.value) || 0));
      const all = TP + FN + FP + TN, B = Number(beta.value);
      const acc = (TP + TN) / all, P = TP / (TP + FP), R = TP / (TP + FN), S = TN / (TN + FP), fpr = FP / (FP + TN);
      const F1 = 2 * P * R / (P + R), Fb = ((B * B + 1) * P * R) / (B * B * P + R);
      const rows = [['準確率', acc], ['精確率', P], ['召回率 TPR', R], ['特異度', S], ['F1', F1], [`F${fmt(B, 2)}`, Fb], ['FPR', fpr]];
      bars.innerHTML = rows.map(([k, v]) => `<div class="bar-row"><span>${k}</span><div class="bar-track"><div class="bar-fill" style="width:${isFinite(v) ? v * 100 : 0}%"></div></div><span class="mono">${pc(v)}</span></div>`).join('');
      out.innerHTML = `<div>共 ${all} 筆：實際正 P = ${TP + FN}、實際負 N = ${FP + TN}；預測正 P′ = ${TP + FP}、預測負 N′ = ${FN + TN}</div>` +
        '<div class="cm-f"></div><div class="cm-f"></div><div class="cm-f"></div><div class="cm-f"></div><div class="cm-f"></div>' +
        `<div class="muted">${note(TP, FN, FP, TN, acc, R)}</div>`;
      const fs = $$('.cm-f', out), q = (a, b) => (b ? `\\frac{${a}}{${b}}` : '\\frac{0}{0}');
      tex(fs[0], `Accuracy = \\frac{${TP} + ${TN}}{${all}} = ${pc(acc).replace('%', '\\%')}`);
      tex(fs[1], `Precision = ${q(TP, `${TP} + ${FP}`)} = ${pc(P).replace('%', '\\%')}, \\quad Recall = ${q(TP, `${TP} + ${FN}`)} = ${pc(R).replace('%', '\\%')}`);
      tex(fs[2], `Specificity = ${q(TN, `${FP} + ${TN}`)} = ${pc(S).replace('%', '\\%')}, \\quad FPR = ${q(FP, `${FP} + ${TN}`)} = ${pc(fpr).replace('%', '\\%')}`);
      tex(fs[3], `F_1 = \\frac{2 \\times ${fmt(P, 4)} \\times ${fmt(R, 4)}}{${fmt(P, 4)} + ${fmt(R, 4)}} = ${isFinite(F1) ? f4(F1) : '—'}`);
      tex(fs[4], `F_{${fmt(B, 2)}} = \\frac{(${fmt(B * B, 4)} + 1) \\times ${fmt(P, 4)} \\times ${fmt(R, 4)}}{${fmt(B * B, 4)} \\times ${fmt(P, 4)} + ${fmt(R, 4)}} = ${isFinite(Fb) ? f4(Fb) : '—'}`);
    }
    function note(TP, FN, FP, TN, acc, R) {
      if (TP === 0 && FP === 0) return '分類器從來不預測正類：精確率是 0/0 無法定義、召回率 0，準確率卻可能很高。這就是準確率會騙人的例子。';
      if (acc > 0.9 && R < 0.5) return `準確率 ${pc(acc)} 很高，但正類只抓到 ${pc(R)}：負類太多，把準確率撐高了。`;
      return 'β 調大，Fβ 會往召回率靠；β 調小則往精確率靠。';
    }
    ins.forEach((i) => i.addEventListener('input', render));
    bindRange(beta, render, (v) => fmt(v, 2));
    seg.firstChild.click();
  })();

  /* ===== ROC ===== */
  (function rocWidget() {
    const kIn = $('#roc-k'), abcd = $('#roc-abcd'), svg = $('#roc-svg'), tbl = $('#roc-table'), out = $('#roc-out');
    const score = [0.9, 0.8, 0.7, 0.6, 0.55, 0.54, 0.53, 0.51, 0.50, 0.4];
    const lab = ['P', 'P', 'N', 'P', 'P', 'N', 'N', 'N', 'P', 'N'];
    const LEC = [['A', 0.28, 0.63], ['B', 0.77, 0.77], ['C', 0.88, 0.24], ['D', 0.12, 0.76]];
    function pts() {
      const P = lab.filter((l) => l === 'P').length, N = lab.length - P;
      const r = [{ k: 0, tp: 0, fp: 0 }];
      let tp = 0, fp = 0;
      lab.forEach((l, i) => { if (l === 'P') tp++; else fp++; r.push({ k: i + 1, tp, fp }); });
      return { P, N, r: r.map((o) => Object.assign(o, { tpr: P ? o.tp / P : 0, fpr: N ? o.fp / N : 0 })) };
    }
    function render() {
      const k = Number(kIn.value), { P, N, r } = pts();
      let auc = 0;
      for (let i = 1; i < r.length; i++) auc += (r[i].fpr - r[i - 1].fpr) * (r[i].tpr + r[i - 1].tpr) / 2;
      const W = 300, H = 290, L = 34, R = 12, T = 12, B = 30;
      const X = (v) => L + v * (W - L - R), Y = (v) => T + (1 - v) * (H - T - B);
      let g = `<path class="axis" d="M${L} ${T} V${H - B} H${W - R}"/>`;
      for (const v of [0, 0.5, 1]) {
        g += `<text class="tick" x="${X(v)}" y="${H - B + 12}" text-anchor="middle">${v}</text><text class="tick" x="${L - 4}" y="${Y(v)}" text-anchor="end">${v}</text>`;
      }
      g += `<text class="tick" x="${W - R}" y="${H - 4}" text-anchor="end">FPR</text><text class="tick" x="${L + 4}" y="${T + 4}">TPR</text>`;
      g += `<path class="line dash" d="M${X(0)} ${Y(0)} L${X(1)} ${Y(1)}"/>`;
      const d = r.map((o, i) => (i ? 'L' : 'M') + X(o.fpr).toFixed(1) + ' ' + Y(o.tpr).toFixed(1)).join('');
      g += `<path class="area" d="${d} L${X(1)} ${Y(0)} L${X(0)} ${Y(0)} Z"/><path class="line acc" d="${d}"/>`;
      r.forEach((o) => { g += `<circle class="dot" cx="${X(o.fpr)}" cy="${Y(o.tpr)}" r="3"/>`; });
      g += `<circle class="q" cx="${X(r[k].fpr)}" cy="${Y(r[k].tpr)}" r="7"/>`;
      if (abcd.checked) for (const [n, fx, ty] of LEC) g += `<circle class="p c2" cx="${X(fx)}" cy="${Y(ty)}" r="6"/><text class="lab" x="${X(fx) + 9}" y="${Y(ty)}">${n}</text>`;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      let t = '<table><tr><th class="num">#</th><th class="num">分數</th><th>真實</th><th>預測</th></tr>';
      score.forEach((s, i) => {
        const pr = i < k ? 'P' : 'N';
        t += `<tr class="click${i < k ? ' hit' : ''}" data-i="${i}"><td class="num">${i + 1}</td><td class="num">${s}</td><td class="${lab[i] === 'P' ? 'ok' : 'no'}">${lab[i]}</td><td>${pr}${pr === lab[i] ? '' : ' ✗'}</td></tr>`;
      });
      tbl.innerHTML = t + '</table>';
      $$('tr[data-i]', tbl).forEach((tr) => tr.addEventListener('click', () => { const i = Number(tr.dataset.i); lab[i] = lab[i] === 'P' ? 'N' : 'P'; render(); }));
      const o = r[k];
      out.innerHTML = `<div>門檻 t = ${k === 0 ? '比最高分還高' : score[k - 1]}（前 ${k} 筆預測為正）：TP = ${o.tp}、FP = ${o.fp}、FN = ${P - o.tp}、TN = ${N - o.fp}</div>` +
        `<div>TPR = ${o.tp}/${P} = ${fmt(o.tpr, 3)}，FPR = ${o.fp}/${N} = ${fmt(o.fpr, 3)}；整條曲線的 <span class="big">AUC = ${f4(auc)}</span></div>` +
        '<div class="muted">遇到真實為 P 的資料，曲線往上走一格（1/P）；遇到 N，往右走一格（1/N）。正例排得越前面，曲線越貼近左上角。</div>';
    }
    abcd.addEventListener('change', render);
    bindRange(kIn, render);
  })();

  /* ===== k 折交叉驗證 ===== */
  (function cvWidget() {
    const kIn = $('#cv-k'), strat = $('#cv-strat'), box = $('#cv-folds'), out = $('#cv-out');
    const n = 20, posSet = new Set([2, 3, 7, 8, 12, 17]);
    let seed = 1, order;
    function shuffle() {
      const r = rng(seed++);
      order = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    }
    function folds(k) {
      const f = Array.from({ length: k }, () => []);
      if (strat.checked) {
        const pos = order.filter((i) => posSet.has(i)), neg = order.filter((i) => !posSet.has(i));
        pos.concat(neg).forEach((i, j) => f[j % k].push(i));
      } else {
        const base = Math.floor(n / k), extra = n % k;
        let p = 0;
        for (let j = 0; j < k; j++) { const sz = base + (j < extra ? 1 : 0); f[j] = order.slice(p, p + sz); p += sz; }
      }
      return f;
    }
    function render() {
      const k = Number(kIn.value), f = folds(k);
      box.innerHTML = '';
      f.forEach((fold, j) => {
        const cells = el('div', { class: 'fold-cells', style: `grid-template-columns:repeat(${n},1fr)` });
        for (let i = 0; i < n; i++) cells.append(el('span', { class: (fold.includes(i) ? 'va' : 'tr') + (posSet.has(i) ? ' pos' : ''), title: `第 ${i + 1} 筆${posSet.has(i) ? '（正類）' : ''}` }));
        box.append(el('div', { class: 'fold-row' }, [el('span', { class: 'muted', text: `第 ${j + 1} 輪` }), cells]));
      });
      const pc2 = f.map((fold) => fold.filter((i) => posSet.has(i)).length);
      const empty = pc2.filter((c) => c === 0).length;
      out.innerHTML = `<div>${k === n ? 'k = n = 20：留一法（LOOCV），' : ''}每輪驗證 ${f.map((x) => x.length).join('、')} 筆；各折的正類數：${pc2.join('、')}（整體正類比例 6/20 = 30%）</div>` +
        `<div class="muted">${k === n ? '每筆資料都恰好當過一次驗證資料；要訓練 20 次模型。' : empty && !strat.checked ? `有 ${empty} 折完全沒有正類：那一輪根本無法評估召回率。勾「分層」看看。` : strat.checked ? '分層後，每折的正類數最多只差 1。' : '每筆資料剛好被驗證一次、訓練 k − 1 次。'}</div>`;
    }
    $('#cv-shuffle').addEventListener('click', () => { shuffle(); render(); });
    strat.addEventListener('change', render);
    shuffle();
    bindRange(kIn, render);
  })();

  /* ===== 重抽樣與 SMOTE ===== */
  (function smoteWidget() {
    const svg = $('#sm-svg'), out = $('#sm-out'), seg = $('#sm-mode');
    const MODES = [['orig', '原始'], ['over', '隨機過採樣'], ['under', '隨機欠採樣'], ['smote', 'SMOTE（k = 3）']];
    let mode = 'orig', seed = 2;
    const r0 = rng(9);
    const maj = Array.from({ length: 30 }, () => [3.6 + 1.5 * gauss(r0), 5 + 1.6 * gauss(r0)]);
    const mino = [[7.2, 6.8], [7.9, 5.6], [6.6, 5.2], [8.4, 7.4], [7.4, 4.3], [6.4, 7.6]];
    MODES.forEach(([k, name]) => {
      const b = el('button', { class: 'btn', type: 'button', text: name, 'aria-pressed': String(k === mode) });
      b.addEventListener('click', () => { mode = k; $$('button', seg).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); render(); });
      seg.append(b);
    });
    $('#sm-again').addEventListener('click', () => { seed++; render(); });
    function render() {
      const r = rng(seed);
      const W = 420, H = 260, L = 12, R = 12, T = 12, B = 12;
      const X = (v) => L + (v / 10) * (W - L - R), Y = (v) => T + (1 - v / 10) * (H - T - B);
      let g = '', note = '';
      let keep = maj.map(() => true);
      if (mode === 'under') {
        const idx = maj.map((_, i) => i);
        for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
        keep = maj.map((_, i) => idx.indexOf(i) < mino.length);
      }
      maj.forEach((p, i) => { g += `<circle class="p c1" cx="${X(p[0])}" cy="${Y(p[1])}" r="5" opacity="${keep[i] ? 1 : 0.15}"/>`; });
      const dup = mino.map(() => 1);
      if (mode === 'over') for (let i = 0; i < maj.length - mino.length; i++) dup[Math.floor(r() * mino.length)]++;
      if (mode === 'smote') {
        const nn = mino.map((p, i) => mino.map((q, j) => ({ j, d: Math.hypot(p[0] - q[0], p[1] - q[1]) })).filter((o) => o.j !== i).sort((a, b) => a.d - b.d).slice(0, 3).map((o) => o.j));
        for (let s = 0; s < maj.length - mino.length; s++) {
          const i = Math.floor(r() * mino.length), j = nn[i][Math.floor(r() * 3)], lam = r();
          const p = mino[i], q = mino[j], x = [p[0] + lam * (q[0] - p[0]), p[1] + lam * (q[1] - p[1])];
          g += `<path class="nbline" d="M${X(p[0])} ${Y(p[1])} L${X(q[0])} ${Y(q[1])}"/><circle class="p c0" cx="${X(x[0])}" cy="${Y(x[1])}" r="3.6" opacity=".7"/>`;
        }
      }
      mino.forEach((p, i) => {
        g += `<circle class="p c0" cx="${X(p[0])}" cy="${Y(p[1])}" r="6.5"/>`;
        if (mode === 'over') g += `<text class="lab" x="${X(p[0]) + 9}" y="${Y(p[1]) - 8}">×${dup[i]}</text>`;
      });
      if (mode === 'orig') note = '多數類 30 筆、少數類 6 筆（比例 5 : 1）。分類器只要偏向藍色，準確率就很高。';
      if (mode === 'over') note = '把 6 個少數類樣本隨機複製到共 30 筆：沒有新資訊，模型容易把這幾個點背起來（過度配適）。';
      if (mode === 'under') note = '多數類只隨機留 6 筆（淡色是被丟掉的）：類別平衡了，但丟掉了 80% 的多數類資訊。';
      if (mode === 'smote') note = '合成 24 個新的少數類樣本（小紅點），都落在原有少數類樣本之間的線段上：比單純複製多樣，但也可能在類別重疊處產生雜訊。';
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      const nMaj = keep.filter(Boolean).length, nMin = mode === 'orig' ? 6 : mode === 'under' ? 6 : 30;
      out.innerHTML = `<div>訓練資料：多數類 ${nMaj} 筆、少數類 ${nMin} 筆</div><div class="muted">${note}</div>`;
    }
    render();
  })();

  /* ===== LIBSVM 格式與 svm-scale ===== */
  (function libsvmWidget() {
    const tr = $('#ls-train'), te = $('#ls-test'), sp = $('#ls-sparse'), sc = $('#ls-scale'), out = $('#ls-out');
    tr.value = '1, red, 45, 3.5\n0, blue, 22, 1.0\n1, green, 64, 2.0\n0, red, 28, 0.5';
    te.value = '1, green, 70, 3.0\n0, blue, 18, 1.5';
    const COLORS = ['red', 'blue', 'green'];
    function rows(text) {
      const res = [], bad = [];
      text.split('\n').map((s) => s.trim()).filter(Boolean).forEach((line, i) => {
        const p = line.split(/\s*,\s*/);
        const ci = COLORS.indexOf((p[1] || '').toLowerCase());
        const nums = p.slice(2).map(Number);
        if (p.length < 3 || ci < 0 || !isFinite(Number(p[0])) || nums.some((v) => !isFinite(v))) { bad.push(i + 1); return; }
        res.push({ y: p[0], x: COLORS.map((_, j) => (j === ci ? 1 : 0)).concat(nums) });
      });
      return { res, bad };
    }
    const num = (v) => String(Number(v.toFixed(6)));
    function line(r, f) {
      const parts = [];
      r.x.forEach((v, j) => {
        const val = f ? f(v, j) : v;
        if (val === null) return;
        if (sp.checked && val === 0) return;
        parts.push(`${j + 1}:${num(val)}`);
      });
      return `${r.y} ${parts.join(' ')}`.trim();
    }
    function render() {
      const A = rows(tr.value), Bt = rows(te.value);
      if (!A.res.length) { out.innerHTML = '<span class="muted">訓練資料至少要一列，格式：標籤, 顏色(red/blue/green), 數字, 數字</span>'; return; }
      const d = Math.max(...A.res.concat(Bt.res).map((r) => r.x.length));
      A.res.concat(Bt.res).forEach((r) => { while (r.x.length < d) r.x.push(0); });
      const mn = [], mx = [];
      for (let j = 0; j < d; j++) { mn.push(Math.min(...A.res.map((r) => r.x[j]))); mx.push(Math.max(...A.res.map((r) => r.x[j]))); }
      const scale = (v, j) => (mx[j] === mn[j] ? null : (v - mn[j]) / (mx[j] - mn[j]));
      const f = sc.checked ? scale : null;
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      let h = '';
      if (A.bad.length || Bt.bad.length) h += `<div class="bad">格式不對、已略過：訓練第 ${A.bad.join('、') || '—'} 列；測試第 ${Bt.bad.join('、') || '—'} 列</div>`;
      h += `<div class="muted">欄位：1 = red、2 = blue、3 = green（one-hot），4 起是數值特徵${sc.checked ? '。<span class="tag add">補充</span>真正的 svm-scale 輸出一律省略值為 0 的欄位（稀疏格式）' : ''}</div>`;
      if (sc.checked) {
        h += `<div style="margin-top:6px"><strong>scale.params</strong>（由訓練資料算出）</div><pre class="code" style="margin:4px 0">x\n0 1\n${mn.map((v, j) => `${j + 1} ${num(v)} ${num(mx[j])}`).join('\n')}</pre>`;
      }
      h += `<div><strong>${sc.checked ? 'train.scale' : 'train'}</strong></div><pre class="code" style="margin:4px 0">${esc(A.res.map((r) => line(r, f)).join('\n'))}</pre>`;
      if (Bt.res.length) {
        const out2 = Bt.res.map((r) => line(r, f)).join('\n');
        const outside = sc.checked && Bt.res.some((r) => r.x.some((v, j) => mx[j] !== mn[j] && ((v - mn[j]) / (mx[j] - mn[j]) < -1e-9 || (v - mn[j]) / (mx[j] - mn[j]) > 1 + 1e-9)));
        h += `<div><strong>${sc.checked ? 'test.scale' : 'test'}</strong>${sc.checked ? '（svm-scale -r scale.params test）' : ''}</div><pre class="code" style="margin:4px 0">${esc(out2)}</pre>`;
        if (outside) h += '<div class="muted">有測試值超出 [0, 1]：因為縮放範圍是由訓練資料決定的，這是正常的，不要用測試資料重算 min／max。</div>';
      }
      if (sc.checked && mn.some((v, j) => v === mx[j])) h += '<div class="muted"><span class="tag add">補充</span>訓練資料中最小值 = 最大值的欄位，svm-scale 會直接略過（不輸出）。</div>';
      out.innerHTML = h;
    }
    [tr, te].forEach((x) => x.addEventListener('input', render));
    [sp, sc].forEach((x) => x.addEventListener('change', render));
    render();
  })();
})();
