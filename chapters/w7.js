/* W7 互動元件 */
(function () {
  'use strict';
  const { $, $$, el, fmt, tex } = DM;
  const { buy, attrs, target, customers, ages } = DT.DATA;
  const f3 = (x) => x.toFixed(3);
  const f4 = (x) => x.toFixed(4);
  const fr = (a, b) => `\\tfrac{${a}}{${b}}`;
  // 加上 ID 屬性的資料（每筆一個值）
  const buyId = buy.map((r) => Object.assign({ ID: r.id }, r));

  // 熵的展開式：-(9/14 log 9/14 + 5/14 log 5/14)
  function entTex(counts) {
    const n = counts.reduce((a, b) => a + b, 0);
    const terms = counts.filter((c) => c).map((c) => `${fr(c, n)}\\log_2${fr(c, n)}`);
    if (terms.length <= 1) return '0';
    return `-\\left(${terms.join(' + ')}\\right)`;
  }
  function giniTex(counts) {
    const n = counts.reduce((a, b) => a + b, 0);
    return `1 - ${counts.map((c) => `(${fr(c, n)})^2`).join(' - ')}`;
  }
  const yn = (cnt) => `<span class="good">${cnt[0]}</span>/<span class="bad">${cnt[1]}</span>`;

  /* ===== 熵與 Gini ===== */
  (function impurityWidget() {
    const ins = ['#imp-a', '#imp-b', '#imp-c'].map((s) => $(s));
    const out = $('#imp-out'), svg = $('#imp-svg'), seg = $('#imp-presets');
    const PRESETS = [
      ['9 : 5（14 筆）', [9, 5, 0]],
      ['M₁ 1 : 1', [1, 1, 0]],
      ['M₂ 2 : 1', [2, 1, 0]],
      ['M₃ 3 : 0', [3, 0, 0]],
      ['A30% B40% C30%', [3, 4, 3]],
    ];
    for (const [name, v] of PRESETS) {
      const b = el('button', { class: 'btn', type: 'button', text: name });
      b.addEventListener('click', () => { v.forEach((x, i) => { ins[i].value = x; }); render(); });
      seg.append(b);
    }
    function plot(p) {
      const W = 420, H = 190, L = 36, R = 12, T = 12, B = 28;
      const X = (x) => L + x * (W - L - R), Y = (y) => T + (1 - y) * (H - T - B);
      const path = (fn) => {
        let d = '';
        for (let i = 0; i <= 100; i++) { const x = i / 100; d += (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(fn(x)).toFixed(1); }
        return d;
      };
      const H2 = (x) => DT.entropy([x, 1 - x]), G2 = (x) => DT.gini([x, 1 - x]);
      let g = `<path class="axis" d="M${L} ${T} V${Y(0)} H${W - R}"/>`;
      for (const v of [0, 0.5, 1]) {
        g += `<text class="tick" x="${L - 6}" y="${Y(v)}" text-anchor="end">${v}</text>`;
        g += `<text class="tick" x="${X(v)}" y="${H - 8}" text-anchor="middle">${v}</text>`;
        if (v) g += `<path class="grid" d="M${L} ${Y(v)} H${W - R}"/>`;
      }
      g += `<text class="tick" x="${W - R}" y="${H - 8}" text-anchor="end">p（類別 1 的比例）</text>`;
      g += `<path class="c-h" d="${path(H2)}"/><path class="c-g" d="${path(G2)}"/>`;
      if (p !== null) {
        g += `<path class="grid" d="M${X(p)} ${T} V${Y(0)}"/>`;
        g += `<circle class="m-h" cx="${X(p)}" cy="${Y(H2(p))}" r="5"/><circle class="m-g" cx="${X(p)}" cy="${Y(G2(p))}" r="5"/>`;
      }
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
    }
    function render() {
      const cnt = ins.map((i) => Math.max(0, Math.floor(Number(i.value) || 0)));
      const used = cnt[2] ? cnt : cnt.slice(0, 2);
      const n = used.reduce((a, b) => a + b, 0);
      if (!n) { out.innerHTML = '<span class="muted">至少要有一筆資料。</span>'; plot(null); return; }
      const h = DT.entropy(used), g = DT.gini(used);
      const k = used.filter((c) => c).length;
      out.innerHTML = `<div>比例：${used.map((c, i) => `類別 ${i + 1} = ${c}/${n}`).join('、')}</div>` +
        `<div id="imp-h" style="margin-top:6px"></div><div id="imp-g"></div>` +
        `<div class="muted" style="margin-top:4px">${k <= 1 ? '只有一種類別：純節點，熵和 Gini 都是 0。' :
          `${used.length} 類時，熵最大 ${fmt(Math.log2(used.length), 3)}、Gini 最大 ${fmt(1 - 1 / used.length, 3)}（各類一樣多時）。`}</div>`;
      tex($('#imp-h', out), `H = ${entTex(used)} = ${f3(h)}`);
      tex($('#imp-g', out), `Gini = ${giniTex(used)} = ${f3(g)}`);
      plot(cnt[2] ? null : cnt[0] / n);
    }
    ins.forEach((i) => i.addEventListener('input', render));
    render();
  })();

  /* ===== 連續屬性門檻 ===== */
  (function threshWidget() {
    const svg = $('#th-svg'), tbl = $('#th-table'), out = $('#th-out');
    const labels = ['no', 'no', 'no', 'yes', 'yes', 'yes', 'yes', 'no'];
    function render() {
      const r = DT.thresholds(ages.map((x, i) => ({ x, y: labels[i] })));
      const best = r.splits.reduce((a, b) => (b.gain > a.gain + 1e-12 ? b : a), r.splits[0]);
      // 數線
      const W = 420, H = 92, L = 20, R = 20, lo = 13, hi = 33;
      const X = (v) => L + ((v - lo) / (hi - lo)) * (W - L - R);
      let g = `<path class="axis" d="M${L} 56 H${W - R}"/>`;
      for (const s of r.splits) {
        g += `<path class="${s === best ? 'cut best' : 'cut'}" d="M${X(s.t)} 22 V68"/>` +
          `<text class="tick" x="${X(s.t)}" y="84" text-anchor="middle">${fmt(s.t, 1)}</text>`;
      }
      ages.forEach((v, i) => {
        g += `<g class="pt ${labels[i]}" data-i="${i}"><circle cx="${X(v)}" cy="56" r="9"/>` +
          `<text x="${X(v)}" y="56">${labels[i] === 'yes' ? 'Y' : 'N'}</text></g>` +
          `<text class="tick" x="${X(v)}" y="34" text-anchor="middle">${v}</text>`;
      });
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      $$('g.pt', svg).forEach((p) => p.addEventListener('click', () => {
        const i = Number(p.dataset.i);
        labels[i] = labels[i] === 'yes' ? 'no' : 'yes';
        render();
      }));
      const ci = r.classes;
      const show = (c) => ci.map((k, j) => `${k} ${c[j]}`).join('、');
      let h = '<table><tr><th class="num">門檻 t</th><th>age ≤ t</th><th>age &gt; t</th><th class="num">Info_A(D)</th><th class="num">Gain</th></tr>';
      for (const s of r.splits) {
        h += `<tr class="${s === best ? 'hit' : ''}"><td class="num">${fmt(s.t, 1)}</td><td>${show(s.cl)}</td><td>${show(s.cr)}</td>` +
          `<td class="num">${f4(s.infoA)}</td><td class="num">${f4(s.gain)}</td></tr>`;
      }
      tbl.innerHTML = h + '</table>';
      out.innerHTML = `<div>8 個不同的值 → ${r.splits.length} 個候選門檻。Info(D) = ${f4(r.infoD)}</div>` +
        `<div>最佳門檻：<strong>age ≤ ${fmt(best.t, 1)}</strong>，Gain = <span class="big">${f4(best.gain)}</span></div>` +
        `<div class="muted">切完後兩邊的 age 仍然有大有小，所以 age 之後還可以用別的門檻再切一次。</div>`;
    }
    render();
  })();

  /* ===== 屬性評分表 ===== */
  (function splitWidget() {
    const sel = $('#sp-data'), chk = $('#sp-id'), tbl = $('#sp-table'), out = $('#sp-out');
    let pick = 'age';
    function rowsOf() {
      const src = chk.checked ? buyId : buy;
      return sel.value === 'all' ? src : src.filter((r) => r.age === sel.value);
    }
    function render() {
      const rows = rowsOf();
      const cand = (sel.value === 'all' ? attrs : attrs.filter((a) => a !== 'age')).concat(chk.checked ? ['ID'] : []);
      const classes = ['yes', 'no'];
      const ev = cand.map((a) => {
        const e = DT.evaluate(rows, a, target, classes);
        e.bin = DT.binaryGini(rows, a, target, classes)[0] || null;
        return e;
      });
      if (!cand.includes(pick)) pick = cand[0];
      const best = (fn, max) => ev.reduce((a, b) => ((max ? fn(b) > fn(a) + 1e-12 : fn(b) < fn(a) - 1e-12) ? b : a), ev[0]);
      const bG = best((e) => e.gain, true), bR = best((e) => e.gainRatio, true), bM = best((e) => e.giniA, false);
      const bB = best((e) => (e.bin ? e.bin.gini : Infinity), false);
      const cell = (e, b, v) => `<td class="num${e === b ? ' ok' : ''}">${v}</td>`;
      let h = '<table><tr><th>屬性</th><th>各分支 yes/no</th><th class="num">Info_A</th><th class="num">Gain</th><th class="num">SplitInfo</th><th class="num">GainRatio</th><th class="num">Gini_A（多路）</th><th>最佳二元 Gini（CART）</th></tr>';
      for (const e of ev) {
        const parts = e.attr === 'ID' ? `${e.parts.length} 支，每支 1 筆` : e.parts.map((p) => `${p.value} ${yn(p.counts)}`).join('、');
        h += `<tr class="click ${e.attr === pick ? 'hit' : ''}" data-a="${e.attr}"><td><button class="btn" type="button" aria-pressed="${e.attr === pick}">${e.attr}</button></td><td>${parts}</td>` +
          `<td class="num">${f4(e.infoA)}</td>${cell(e, bG, f4(e.gain))}<td class="num">${f4(e.splitInfo)}</td>${cell(e, bR, f4(e.gainRatio))}` +
          `${cell(e, bM, f4(e.giniA))}<td class="${e === bB ? 'ok' : ''}">${e.bin ? (e.attr === 'ID' ? '' : `{${e.bin.left.join(', ')}} | {${e.bin.right.join(', ')}} `) + f4(e.bin.gini) : '—'}</td></tr>`;
      }
      tbl.innerHTML = h + '</table>';
      $$('tr[data-a]', tbl).forEach((tr) => tr.addEventListener('click', () => { pick = tr.dataset.a; render(); }));

      const e = ev.find((x) => x.attr === pick);
      const n = e.n, dc = classes.map((c) => rows.filter((r) => r[target] === c).length);
      out.innerHTML = `<div>資料 ${n} 筆（yes ${dc[0]}、no ${dc[1]}），選的屬性：<strong>${e.attr}</strong></div>` +
        '<div class="sp-f" style="margin-top:6px"></div><div class="sp-f"></div><div class="sp-f"></div><div class="sp-f"></div><div class="sp-f"></div><div class="sp-f"></div>' +
        `<div class="muted" style="margin-top:6px">${note(e, ev, bG, bR)}</div>`;
      const fs = $$('.sp-f', out);
      tex(fs[0], `Info(D) = ${entTex(dc)} = ${f4(e.infoD)}`);
      if (e.attr === 'ID') {
        tex(fs[1], `Info_{ID}(D) = \\textstyle\\sum_{j=1}^{${n}} ${fr(1, n)} \\times 0 = 0`);
        tex(fs[3], `SplitInfo_{ID}(D) = -${n} \\times ${fr(1, n)}\\log_2${fr(1, n)} = \\log_2 ${n} = ${f4(e.splitInfo)}`);
      } else {
        tex(fs[1], `Info_{${tx(e.attr)}}(D) = ${e.parts.map((p) => `${fr(p.size, n)} \\times ${f3(p.entropy)}`).join(' + ')} = ${f4(e.infoA)}`);
        tex(fs[3], `SplitInfo_{${tx(e.attr)}}(D) = -\\left(${e.parts.map((p) => `${fr(p.size, n)}\\log_2${fr(p.size, n)}`).join(' + ')}\\right) = ${f4(e.splitInfo)}`);
      }
      tex(fs[2], `Gain(${tx(e.attr)}) = ${f4(e.infoD)} - ${f4(e.infoA)} = ${f4(e.gain)}`);
      tex(fs[4], `GainRatio(${tx(e.attr)}) = ${f4(e.gain)} / ${f4(e.splitInfo)} = ${f4(e.gainRatio)}`);
      tex(fs[5], `Gini(D) = ${f4(e.giniD)},\\quad Gini_{${tx(e.attr)}}(D) = ${e.parts.length > 6 ? '0' : e.parts.map((p) => `${fr(p.size, n)} \\times ${f3(p.gini)}`).join(' + ')} = ${f4(e.giniA)}`);
    }
    const tx = (a) => '\\text{' + a.replace(/_/g, '\\_') + '}';
    function note(e, ev, bG, bR) {
      if (e.attr === 'ID') return '每支只有 1 筆、全部是純的，所以 Info_ID = 0、Gain = Info(D) 達到最大；SplitInfo = log₂n 很大，但增益比仍然是最大的。這就是 C4.5 還要先排除「資訊增益低於平均」的屬性的原因。';
      const tips = [];
      if (e === bG) tips.push('資訊增益最大');
      if (e === bR) tips.push('增益比最大');
      if (e.gain > 0.999 * e.infoD && e.infoD > 0) tips.push('每個分支都是純的');
      return tips.length ? `${e.attr}：${tips.join('、')}。` : `${e.attr} 不是最好的屬性；點其他列比較。`;
    }
    sel.addEventListener('change', render);
    chk.addEventListener('change', render);
    render();
  })();

  /* ===== 決策樹歸納 ===== */
  (function treeWidget() {
    const crit = $('#tr-crit'), chk = $('#tr-id'), svg = $('#tr-svg'), out = $('#tr-out'), cnt = $('#tr-count');
    const btnNext = $('#tr-next'), btnAll = $('#tr-all'), btnReset = $('#tr-reset');
    const custBox = $('#tr-cust'), xBox = $('#tr-x'), pred = $('#tr-pred');
    let T = null, step = 0;
    const x = Object.assign({}, customers[0]);
    const domain = {};
    for (const a of attrs) domain[a] = DT.classesOf(buy, a);

    function rebuild() {
      const rows = chk.checked ? buyId : buy;
      const cand = attrs.concat(chk.checked ? ['ID'] : []);
      T = DT.build(rows, cand, target, crit.value, { classes: ['yes', 'no'] });
      step = 0;
      render();
    }
    // 依 step 決定可見的節點：處理過的（order < step）照實畫，它的子節點以待處理（虛線）畫出
    function visible(n) {
      if (n.order >= step || n.leaf) return { n, kids: [] };
      return { n, kids: n.children.map((c) => ({ value: c.value, v: visible(c.node) })) };
    }
    function draw(pathIds) {
      const NW = 96, NH = 40, GX = 14, UY = 78, PAD = 14;
      const vt = visible(T.tree);
      const nodes = [];
      let leaf = 0, depth = 0;
      (function place(v, d) {
        v._d = d; depth = Math.max(depth, d);
        if (!v.kids.length) v._x = leaf++;
        else {
          v.kids.forEach((k) => place(k.v, d + 1));
          v._x = (v.kids[0].v._x + v.kids[v.kids.length - 1].v._x) / 2;
        }
        nodes.push(v);
      })(vt, 0);
      const UX = NW + GX;
      const W = leaf * UX - GX + PAD * 2, H = depth * UY + NH + PAD * 2;
      const X = (v) => PAD + NW / 2 + v._x * UX, Y = (v) => PAD + NH / 2 + v._d * UY;
      let g = '';
      for (const v of nodes) for (const k of v.kids) {
        const on = pathIds && pathIds.includes(k.v.n.id);
        g += `<path class="edge${on ? ' on' : ''}" d="M${X(v)} ${Y(v) + NH / 2} L${X(k.v)} ${Y(k.v) - NH / 2}"/>`;
      }
      for (const v of nodes) for (const k of v.kids) {
        const mx = (X(v) + X(k.v)) / 2, my = (Y(v) + NH / 2 + Y(k.v) - NH / 2) / 2;
        g += `<text class="elabel" x="${mx}" y="${my}">${k.value}</text>`;
      }
      for (const v of nodes) {
        const n = v.n;
        const done = n.order < step;
        let cls = 'node', title;
        if (!done) { cls += ' pending'; title = '?'; }
        else if (n.leaf) { cls += ' leaf ' + n.label; title = n.label.toUpperCase(); }
        else title = n.attr + '?';
        if (n.order === step - 1) cls += ' cur';
        if (pathIds && pathIds.includes(n.id)) cls += ' path';
        g += `<g class="${cls}"><rect x="${X(v) - NW / 2}" y="${Y(v) - NH / 2}" width="${NW}" height="${NH}" rx="8"/>` +
          `<text class="t1" x="${X(v)}" y="${Y(v) - 7}">${title}</text>` +
          `<text class="t2" x="${X(v)}" y="${Y(v) + 10}">${n.counts[0]} yes / ${n.counts[1]} no</text></g>`;
      }
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.style.maxWidth = Math.max(W * 1.1, 240) + 'px';
      svg.innerHTML = g;
    }
    function findOrder(n, o) {
      if (n.order === o) return n;
      for (const c of n.children || []) { const r = findOrder(c.node, o); if (r) return r; }
      return null;
    }
    function pathText(n) {
      // 從根到 n 的條件
      const conds = [];
      (function walk(m, acc) {
        if (m === n) { conds.push(...acc); return true; }
        for (const c of m.children || []) if (walk(c.node, acc.concat([`${m.attr} = ${c.value}`]))) return true;
        return false;
      })(T.tree, []);
      return conds.length ? conds.join(' ∧ ') : '根節點';
    }
    function explain() {
      if (step === 0) {
        return `一開始全部 ${T.tree.rows.length} 筆都在根節點（yes ${T.tree.counts[0]}、no ${T.tree.counts[1]}）。按「下一步」處理第一個節點。`;
      }
      const n = findOrder(T.tree, step - 1);
      const head = `<div><strong>第 ${step} 步</strong>：${pathText(n)}（${n.rows.length} 筆：yes ${n.counts[0]}、no ${n.counts[1]}）</div>`;
      if (n.reason === 'pure') return head + `<div>全部都是 ${n.label} → 純節點，建葉節點 <strong>${n.label}</strong>（演算法第 ② 步）。</div>`;
      if (n.reason === 'noattr') return head + `<div>沒有候選屬性了 → 多數類別葉節點 <strong>${n.label}</strong>（第 ③ 步）。</div>`;
      if (n.reason === 'empty') return head + `<div>這個分支沒有任何訓練資料 → 用父節點的多數類別 <strong>${n.label}</strong>。</div>`;
      const c = DT.CRITERIA[crit.value];
      const key = crit.value === 'gain' ? 'gain' : crit.value === 'ratio' ? 'gainRatio' : 'giniA';
      const chips = n.scores.map((s) => `<span class="chip ${s.attr === n.attr ? 'ok' : ''}">${s.attr} ${f4(s[key])}</span>`).join(' ');
      return head + `<div>不純，用${c.name}比較候選屬性（${crit.value === 'gini' ? '越小越好' : '越大越好'}）：${chips}</div>` +
        `<div>選 <strong>${n.attr}</strong>，切成 ${n.children.length} 個分支：${n.children.map((ch) => `${ch.value} ${yn(ch.node.counts)}`).join('、')}</div>`;
    }
    function predict() {
      if (step < T.steps) { pred.innerHTML = '<span class="muted">先把樹長完（按「全部完成」），才能用它預測。</span>'; return null; }
      const r = DT.classify(T.tree, x);
      const steps = [];
      let n = T.tree;
      while (n && !n.leaf) {
        const ch = n.children.find((c) => c.value === x[n.attr]);
        steps.push(`${n.attr} = ${x[n.attr] === undefined ? '（新顧客沒有）' : x[n.attr]}`);
        n = ch && ch.node;
      }
      pred.innerHTML = r.label
        ? `<div>路徑：${steps.join(' → ') || '根就是葉'} → 預測 buy_computer = <span class="big ${r.label === 'yes' ? 'good' : 'bad'}">${r.label}</span></div>` +
          `<div class="muted">沒出現在路徑上的屬性完全沒被用到。</div>`
        : `<div>路徑：${steps.join(' → ')} → <span class="bad">找不到對應的分支</span></div><div class="muted">用 ID 長出來的樹只認得訓練資料裡的 14 個 ID，新顧客一律無法預測：這就是「分支多、增益大」卻沒有預測能力的例子。</div>`;
      return r.path;
    }
    function render() {
      cnt.textContent = `${step}／${T.steps} 個節點`;
      btnNext.disabled = btnAll.disabled = step >= T.steps;
      out.innerHTML = explain() + (step >= T.steps
        ? `<div style="margin-top:6px" class="muted">完成：${DT.rules(T.tree).length} 個葉節點。if–then 規則：${DT.rules(T.tree).filter((r) => r.label === 'yes').map((r) => r.conds.map((c) => c.join(' = ')).join(' ∧ ')).join('；') || '無'} ⇒ yes，其餘 ⇒ no。</div>` : '');
      $$('button', custBox).forEach((b, i) => b.setAttribute('aria-pressed', String(customers[i].age === x.age && customers[i].income === x.income && customers[i].student === x.student && customers[i].credit_rating === x.credit_rating)));
      $$('select', xBox).forEach((s) => { s.value = x[s.dataset.a]; });
      draw(predict());
    }
    customers.forEach((c) => {
      const b = el('button', { class: 'btn', type: 'button', text: c.name });
      b.addEventListener('click', () => { attrs.forEach((a) => { x[a] = c[a]; }); render(); });
      custBox.append(b);
    });
    for (const a of attrs) {
      const s = el('select', { 'data-a': a }, domain[a].map((v) => el('option', { value: v, text: v })));
      s.addEventListener('change', () => { x[a] = s.value; render(); });
      xBox.append(el('label', {}, [a + ' ', s]));
    }
    btnNext.addEventListener('click', () => { step = Math.min(T.steps, step + 1); render(); });
    btnAll.addEventListener('click', () => { step = T.steps; render(); });
    btnReset.addEventListener('click', () => { step = 0; render(); });
    crit.addEventListener('change', rebuild);
    chk.addEventListener('change', rebuild);
    rebuild();
  })();
})();
