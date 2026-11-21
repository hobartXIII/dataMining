/* 推薦系統互動元件：內容式相似度、使用者式 CF、矩陣分解 */
(function () {
  'use strict';
  const { $, $$, el, fmt, tex, rng, bindRange } = DM;
  const f3 = (x) => x.toFixed(3);

  /* ===== 內容式：音樂 ===== */
  (function cbfWidget() {
    const G = ['Pop', 'Rock', 'R&B', 'Jazz', 'Classical', 'Reggae'];
    const rows = [
      { name: '使用者 u', v: [10, 8, 0, 8, 0, 0], user: true },
      { name: 'Song A', v: [9, 7, 0, 6, 0, 0] },
      { name: 'Song B', v: [1, 0, 10, 0, 0, 6] },
      { name: 'Song C（補充）', v: [2, 1.6, 0, 1.6, 0, 0] },
    ];
    const tbl = $('#cb-table'), out = $('#cb-out'), mSel = $('#cb-m');
    const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), nrm = (a) => Math.sqrt(dot(a, a));
    function build() {
      let h = `<table><tr><th></th>${G.map((g) => `<th class="num">${g}</th>`).join('')}<th class="num">分數</th><th class="num">名次</th></tr>`;
      rows.forEach((r, i) => {
        h += `<tr${r.user ? ' class="hit"' : ''}><td>${r.name}</td>` + r.v.map((v, j) => `<td class="num"><input type="number" step="1" min="0" data-r="${i}" data-c="${j}" value="${v}" style="width:3.6em;text-align:right;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text);font:inherit;padding:2px"></td>`).join('') +
          `<td class="num" id="cb-s${i}"></td><td class="num" id="cb-r${i}"></td></tr>`;
      });
      tbl.innerHTML = h + '</table>';
      $$('input', tbl).forEach((inp) => inp.addEventListener('input', () => { rows[inp.dataset.r].v[inp.dataset.c] = Number(inp.value) || 0; render(); }));
    }
    function render() {
      const m = mSel.value, u = rows[0].v;
      const score = (v) => (m === 'cos' ? (nrm(u) && nrm(v) ? dot(u, v) / (nrm(u) * nrm(v)) : 0) : m === 'dot' ? dot(u, v) : Math.sqrt(v.reduce((s, x, i) => s + (x - u[i]) ** 2, 0)));
      const items = rows.slice(1).map((r, k) => ({ k: k + 1, s: score(r.v) }));
      const sorted = items.slice().sort((a, b) => (m === 'euc' ? a.s - b.s : b.s - a.s));
      $('#cb-s0').textContent = '—'; $('#cb-r0').textContent = '';
      items.forEach((it) => {
        $('#cb-s' + it.k).textContent = m === 'cos' ? fmt(it.s, 6) : fmt(it.s, 3);
        $('#cb-r' + it.k).textContent = sorted.indexOf(it) + 1;
      });
      const A = rows[1].v;
      out.innerHTML = '<div id="cb-f"></div>' +
        `<div>推薦順序（${m === 'euc' ? '距離越小越前面' : '分數越大越前面'}）：<strong>${sorted.map((it) => rows[it.k].name.replace('（補充）', '')).join(' → ')}</strong></div>` +
        `<div class="muted">${m === 'cos' ? 'Song C 和使用者方向完全一樣，所以餘弦 = 1 排第一；它的數值很小並不影響餘弦。' : m === 'dot' ? '內積會被向量長度放大：Song C 方向跟使用者一模一樣，但數值小，所以內積反而比 Song A 低。' : '歐氏距離看的是絕對差距：Song C 雖然方向相同，但離使用者 [10, 8, 0, 8, 0, 0] 很遠。'}</div>`;
      tex($('#cb-f', out), m === 'cos'
        ? `\\cos(u, A) = \\frac{${dot(u, A)}}{\\sqrt{${dot(u, u)}}\\sqrt{${dot(A, A)}}} = ${fmt(score(A), 6)}`
        : m === 'dot' ? `u \\cdot A = ${u.map((x, i) => `${x} \\times ${A[i]}`).filter((_, i) => u[i] && A[i]).join(' + ') || '0'} = ${fmt(dot(u, A), 3)}`
          : `\\lVert u - A \\rVert = \\sqrt{${u.map((x, i) => `(${x} - ${A[i]})^2`).join(' + ')}} = ${fmt(score(A), 3)}`);
    }
    build();
    mSel.addEventListener('change', render);
    render();
  })();

  /* ===== 使用者式 CF ===== */
  (function ucfWidget() {
    const users = ['Alice', 'User1', 'User2', 'User3', 'User4'];
    const ORIG = [[5, 3, 4, 4, null], [3, 1, 2, 3, 3], [4, 3, 4, 3, 5], [3, 3, 1, 5, 4], [1, 5, 5, 2, 1]];
    let R = ORIG.map((r) => r.slice());
    const TGT = 4;
    const tbl = $('#uc-table'), out = $('#uc-out'), kIn = $('#uc-k'), neg = $('#uc-neg');
    const mean = (a) => { const v = a.filter((x) => x != null); return v.reduce((s, x) => s + x, 0) / v.length; };
    function pearson(a, b) {
      const I = a.map((_, i) => i).filter((i) => i !== TGT && a[i] != null && b[i] != null);
      if (I.length < 2) return { s: 0, I, ma: 0, mb: 0 };
      const ma = I.reduce((s, i) => s + a[i], 0) / I.length, mb = I.reduce((s, i) => s + b[i], 0) / I.length;
      let nu = 0, da = 0, db = 0;
      for (const i of I) { nu += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
      return { s: da && db ? nu / Math.sqrt(da * db) : 0, I, ma, mb };
    }
    function build() {
      let h = '<table class="rm"><tr><th></th>' + [1, 2, 3, 4, 5].map((i) => `<th>Item${i}</th>`).join('') + '<th>sim(Alice, ·)</th><th>全部平均</th></tr>';
      users.forEach((u, i) => {
        h += `<tr id="uc-row${i}"><th>${u}</th>` + R[i].map((v, j) => (i === 0 && j === TGT
          ? '<td class="pred" id="uc-pred">?</td>'
          : `<td><input type="number" min="1" max="5" step="1" data-u="${i}" data-j="${j}" value="${v}"></td>`)).join('') +
          `<td class="num" id="uc-sim${i}"></td><td class="num" id="uc-mean${i}"></td></tr>`;
      });
      tbl.innerHTML = h + '</table>';
      $$('input', tbl).forEach((inp) => inp.addEventListener('input', () => {
        const v = Math.round(Number(inp.value));
        R[inp.dataset.u][inp.dataset.j] = v >= 1 && v <= 5 ? v : null;
        render();
      }));
    }
    function render() {
      const k = Number(kIn.value), A = R[0];
      const sims = users.map((_, i) => (i ? pearson(A, R[i]) : null));
      let cand = users.map((_, i) => i).filter((i) => i && R[i][TGT] != null && (neg.checked || sims[i].s > 0));
      cand.sort((a, b) => (neg.checked ? Math.abs(sims[b].s) - Math.abs(sims[a].s) : sims[b].s - sims[a].s));
      const nb = cand.slice(0, k);
      users.forEach((_, i) => {
        $('#uc-row' + i).className = nb.includes(i) ? 'hit' : '';
        $('#uc-sim' + i).textContent = i ? fmt(sims[i].s, 2) : '—';
        $('#uc-mean' + i).textContent = fmt(mean(R[i]), 2);
      });
      const ra = mean(A);
      let num = 0, den = 0;
      nb.forEach((i) => { num += sims[i].s * (R[i][TGT] - mean(R[i])); den += Math.abs(sims[i].s); });
      const pred = den ? ra + num / den : ra;
      $('#uc-pred').textContent = fmt(pred, 2);
      const s1 = sims[1];
      out.innerHTML = `<div>鄰居：${nb.length ? nb.map((i) => `${users[i]}（sim = ${fmt(sims[i].s, 2)}）`).join('、') : '沒有符合條件的鄰居 → 直接用 Alice 的平均'}</div>` +
        '<div id="uc-f" style="margin-top:6px"></div>' +
        `<div class="muted" style="margin-top:4px">相似度只在 Item1～4（共同評過的）上算：例如 sim(Alice, User1) 用的平均是 Alice ${fmt(s1.ma, 2)}、User1 ${fmt(s1.mb, 2)}；預測時改用全部評分的平均（表格最右欄）。${!neg.checked && sims[4].s < 0 ? ' User4 和 Alice 口味相反（負相似度），預設不選；勾「納入負相似度」並把 k 調到 4 看看。' : ''}</div>`;
      tex($('#uc-f', out), nb.length
        ? `\\hat{r}_{Alice,5} = ${fmt(ra, 2)} + \\frac{${nb.map((i) => `${fmt(sims[i].s, 2)}(${R[i][TGT]} - ${fmt(mean(R[i]), 2)})`).join(' + ')}}{${nb.map((i) => `|${fmt(sims[i].s, 2)}|`).join(' + ')}} = ${fmt(pred, 3)}`
        : `\\hat{r}_{Alice,5} = \\bar{r}_{Alice} = ${fmt(ra, 2)}`);
    }
    $('#uc-reset').addEventListener('click', () => { R = ORIG.map((r) => r.slice()); build(); render(); });
    neg.addEventListener('change', render);
    build();
    bindRange(kIn, render);
  })();

  /* ===== 矩陣分解 ===== */
  (function mfWidget() {
    const users = ['小明', '小華', '阿傑', '小美', '小芳', '阿凱'];
    const items = ['玩命', '捍衛', '不可能', '真愛', '樂來', '花樣'];
    const _ = null;
    const R = [
      [5, 4, _, 1, _, 1],
      [4, _, 5, _, 1, 2],
      [_, 5, 4, 2, 1, _],
      [1, _, 2, 5, 4, _],
      [2, 1, _, 4, _, 5],
      [_, 2, 1, _, 5, 4],
    ];
    const kIn = $('#mf-k'), lIn = $('#mf-l'), tbl = $('#mf-table'), svg = $('#mf-svg'), out = $('#mf-out');
    let U, V, hist, epochs;
    const obs = [];
    R.forEach((r, i) => r.forEach((v, j) => { if (v != null) obs.push([i, j, v]); }));
    function reset() {
      const k = Number(kIn.value), r = rng(42);
      U = R.map(() => Array.from({ length: k }, () => 0.8 + 0.6 * r()));
      V = items.map(() => Array.from({ length: k }, () => 0.8 + 0.6 * r()));
      hist = [loss()]; epochs = 0;
      render();
    }
    const pred = (i, j) => U[i].reduce((s, u, f) => s + u * V[j][f], 0);
    function loss() {
      const lam = Number(lIn.value);
      let e = 0, reg = 0;
      for (const [i, j, v] of obs) e += (v - pred(i, j)) ** 2;
      U.concat(V).forEach((row) => row.forEach((x) => { reg += x * x; }));
      return { rmse: Math.sqrt(e / obs.length), total: e + lam * reg };
    }
    function train(n) {
      const lam = Number(lIn.value), eta = 0.03, r = rng(1000 + epochs);
      for (let ep = 0; ep < n; ep++) {
        const ord = obs.slice();
        for (let i = ord.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
        for (const [i, j, v] of ord) {
          const e = v - pred(i, j);
          for (let f = 0; f < U[i].length; f++) {
            const u = U[i][f], w = V[j][f];
            U[i][f] += eta * (e * w - lam * u);
            V[j][f] += eta * (e * u - lam * w);
          }
        }
        epochs++;
        hist.push(loss());
      }
      render();
    }
    function render() {
      let h = '<table class="rm"><tr><th></th>' + items.map((t) => `<th>${t}</th>`).join('') + '</tr>';
      R.forEach((row, i) => {
        h += `<tr><th>${users[i]}</th>` + row.map((v, j) => {
          const p = pred(i, j);
          return v == null ? `<td class="pred">${epochs ? fmt(Math.max(1, Math.min(5, p)), 1) : '?'}</td>` : `<td>${v}<span class="muted" style="font-size:.75rem">${epochs ? ' (' + fmt(p, 1) + ')' : ''}</span></td>`;
        }).join('') + '</tr>';
      });
      tbl.innerHTML = h + '</table>';
      const W = 240, H = 190, L = 34, Rr = 8, T = 12, B = 24;
      const mx = Math.max(...hist.map((x) => x.rmse), 0.5);
      const n = Math.max(hist.length - 1, 1);
      const X = (e) => L + (e / n) * (W - L - Rr), Y = (v) => T + (1 - v / mx) * (H - T - B);
      let g = `<path class="axis" d="M${L} ${T} V${H - B} H${W - Rr}"/>`;
      for (const v of [0, mx / 2, mx]) g += `<text class="tick" x="${L - 4}" y="${Y(v)}" text-anchor="end">${fmt(v, 1)}</text>`;
      g += `<text class="tick" x="${W - Rr}" y="${H - 4}" text-anchor="end">epoch ${hist.length - 1}</text><text class="tick" x="${L + 4}" y="${T + 2}">RMSE（觀察到的）</text>`;
      g += `<path class="line acc" d="${hist.map((x, e) => (e ? 'L' : 'M') + X(e).toFixed(1) + ' ' + Y(x.rmse).toFixed(1)).join('')}"/>`;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      const last = hist[hist.length - 1];
      const k = U[0].length;
      out.innerHTML = epochs
        ? `<div>已訓練 ${epochs} 個 epoch：觀察到的評分 RMSE = <span class="big">${fmt(last.rmse, 3)}</span>，含正則化的總損失 = ${fmt(last.total, 3)}</div>` +
          `<div class="muted">括號是模型對已知評分的重建值；黃底是補出來的預測（裁到 1～5）。${k === 1 ? 'k = 1 只有一個潛在維度，只能表達「整體愛不愛看電影」，分不出動作派和文藝派。' : '前三部（動作）和後三部（文藝）的預測會分成兩派：喜歡動作片的人，文藝片的預測分數低。'}${Number(lIn.value) === 0 ? ' λ = 0：沒有正則化，訓練誤差可以壓得很低，但因子值可能變得很大，對缺失格子的預測不穩。' : ''}</div>` +
          `<div class="muted" style="font-size:.85rem">小明的潛在向量 u = (${U[0].map((x) => fmt(x, 2)).join(', ')})；《玩命》的 v = (${V[0].map((x) => fmt(x, 2)).join(', ')})</div>`
        : `<div>已隨機初始化 U（6 × ${k}）與 V（6 × ${k}）。觀察到 ${obs.length}／36 格（${fmt((obs.length / 36) * 100, 0)}%）。按「訓練」。</div>`;
    }
    $('#mf-train').addEventListener('click', () => train(50));
    $('#mf-reset').addEventListener('click', reset);
    bindRange(kIn, reset);
    bindRange(lIn, () => { if (U) { hist[hist.length - 1] = loss(); render(); } }, (v) => fmt(v, 2));
  })();
})();
