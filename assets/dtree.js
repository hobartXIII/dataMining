/* 分類與決策樹的計算：熵、Gini、資訊增益、增益比、二元 Gini 分割、決策樹歸納、連續屬性門檻
   純計算，不碰 DOM；瀏覽器掛在 window.DT，Node 可用 require() 驗算 */
(function (root) {
  'use strict';

  const log2 = (x) => Math.log(x) / Math.LN2;

  // 熵：counts 是各類別的個數；p = 0 的項當作 0
  function entropy(counts) {
    const n = counts.reduce((a, b) => a + b, 0);
    if (!n) return 0;
    let h = 0;
    for (const c of counts) if (c) h -= (c / n) * log2(c / n);
    return h;
  }
  function gini(counts) {
    const n = counts.reduce((a, b) => a + b, 0);
    if (!n) return 0;
    return 1 - counts.reduce((s, c) => s + (c / n) ** 2, 0);
  }

  // 類別清單：依資料中第一次出現的順序
  function classesOf(rows, target) {
    const out = [];
    for (const r of rows) if (!out.includes(r[target])) out.push(r[target]);
    return out;
  }
  function countBy(rows, target, classes) {
    return classes.map((c) => rows.filter((r) => r[target] === c).length);
  }
  function majority(rows, target, classes) {
    const cnt = countBy(rows, target, classes);
    let best = 0;
    cnt.forEach((c, i) => { if (c > cnt[best]) best = i; });
    return classes[best];
  }

  // 依屬性 attr 的每個值分割；values 給定時照它的順序（含空的分割）
  function partition(rows, attr, values) {
    const vals = values || classesOf(rows, attr);
    return vals.map((v) => ({ value: v, rows: rows.filter((r) => r[attr] === v) }));
  }

  // 一個屬性的所有評分（多路分割）
  function evaluate(rows, attr, target, classes, values) {
    classes = classes || classesOf(rows, target);
    const n = rows.length;
    const parts = partition(rows, attr, values).filter((p) => p.rows.length);
    const infoD = entropy(countBy(rows, target, classes));
    const giniD = gini(countBy(rows, target, classes));
    let infoA = 0, giniA = 0, splitInfo = 0;
    const detail = parts.map((p) => {
      const cnt = countBy(p.rows, target, classes);
      const w = p.rows.length / n;
      const h = entropy(cnt), g = gini(cnt);
      infoA += w * h;
      giniA += w * g;
      splitInfo -= w * log2(w);
      return { value: p.value, size: p.rows.length, counts: cnt, entropy: h, gini: g };
    });
    const gain = infoD - infoA;
    return {
      attr, n, classes, infoD, giniD, parts: detail, infoA, gain, splitInfo,
      gainRatio: splitInfo ? gain / splitInfo : 0, giniA, giniDrop: giniD - giniA,
    };
  }

  // CART：類別屬性的所有二元分割（值的子集 vs. 其餘），回傳依 Gini 由小到大
  function binaryGini(rows, attr, target, classes) {
    classes = classes || classesOf(rows, target);
    const vals = classesOf(rows, attr);
    const n = rows.length;
    const out = [];
    // 固定最後一個值在右邊，避免 {A}|{B} 和 {B}|{A} 重複
    const m = vals.length - 1;
    for (let mask = 1; mask < (1 << m); mask++) {
      const left = vals.filter((_, i) => i < m && (mask & (1 << i)));
      const right = vals.filter((v) => !left.includes(v));
      const L = rows.filter((r) => left.includes(r[attr])), R = rows.filter((r) => right.includes(r[attr]));
      const cl = countBy(L, target, classes), cr = countBy(R, target, classes);
      const g = (L.length / n) * gini(cl) + (R.length / n) * gini(cr);
      out.push({ left, right, nl: L.length, nr: R.length, cl, cr, gini: g });
    }
    out.sort((a, b) => a.gini - b.gini);
    return out;
  }

  const CRITERIA = {
    gain: { name: '資訊增益（ID3）', score: (e) => e.gain, better: (a, b) => a > b + 1e-12 },
    ratio: { name: '增益比（C4.5）', score: (e) => e.gainRatio, better: (a, b) => a > b + 1e-12 },
    gini: { name: 'Gini 不純度（CART）', score: (e) => e.giniA, better: (a, b) => a < b - 1e-12 },
  };

  // 通用決策樹演算法（講義第 36 頁），多路分割。
  // 每個節點都有 order：依遞迴（前序）處理的順序編號，給逐步展開用
  function build(rows, attrs, target, criterion = 'gain', opts = {}) {
    const classes = opts.classes || classesOf(rows, target);
    const domain = {};
    for (const a of attrs) domain[a] = classesOf(rows, a);
    const crit = CRITERIA[criterion];
    let order = 0, id = 0;
    function grow(D, cand, parentMajority, depth) {
      const node = { id: id++, order: order++, rows: D, counts: countBy(D, target, classes), depth };
      if (!D.length) {
        node.leaf = true; node.label = parentMajority; node.reason = 'empty';
        return node;
      }
      const cls = classesOf(D, target);
      if (cls.length === 1) {
        node.leaf = true; node.label = cls[0]; node.reason = 'pure';
        return node;
      }
      if (!cand.length) {
        node.leaf = true; node.label = majority(D, target, classes); node.reason = 'noattr';
        return node;
      }
      const scores = cand.map((a) => evaluate(D, a, target, classes));
      let best = scores[0];
      for (const s of scores) if (crit.better(crit.score(s), crit.score(best))) best = s;
      node.attr = best.attr;
      node.scores = scores;
      node.reason = 'split';
      const rest = cand.filter((a) => a !== best.attr);
      const maj = majority(D, target, classes);
      node.children = partition(D, best.attr, domain[best.attr])
        .map((p) => ({ value: p.value, node: grow(p.rows, rest, maj, depth + 1) }));
      return node;
    }
    const tree = grow(rows, attrs, majority(rows, target, classes), 0);
    return { tree, steps: order, classes };
  }

  // 走訪一筆資料，回傳經過的節點 id 與預測
  function classify(tree, x) {
    const path = [];
    let n = tree;
    while (n) {
      path.push(n.id);
      if (n.leaf) return { label: n.label, path };
      const c = n.children.find((ch) => ch.value === x[n.attr]);
      n = c && c.node;
    }
    return { label: null, path };
  }

  // 把樹轉成 if–then 規則
  function rules(tree) {
    const out = [];
    (function walk(n, conds) {
      if (n.leaf) { out.push({ conds, label: n.label, size: n.rows.length }); return; }
      for (const c of n.children) walk(c.node, conds.concat([[n.attr, c.value]]));
    })(tree, []);
    return out;
  }

  // 連續屬性：排序後取相鄰兩值的中點當候選門檻，算每個門檻的資訊增益
  function thresholds(points) {
    const pts = points.slice().sort((a, b) => a.x - b.x);
    const classes = classesOf(pts, 'y');
    const all = countBy(pts, 'y', classes);
    const infoD = entropy(all);
    const n = pts.length;
    const out = [];
    for (let i = 0; i < n - 1; i++) {
      if (pts[i].x === pts[i + 1].x) continue;
      const t = (pts[i].x + pts[i + 1].x) / 2;
      const L = pts.filter((p) => p.x <= t), R = pts.filter((p) => p.x > t);
      const cl = countBy(L, 'y', classes), cr = countBy(R, 'y', classes);
      const infoA = (L.length / n) * entropy(cl) + (R.length / n) * entropy(cr);
      out.push({ t, cl, cr, infoA, gain: infoD - infoA });
    }
    return { pts, classes, infoD, splits: out };
  }

  const DT = {
    log2, entropy, gini, classesOf, countBy, majority, partition, evaluate, binaryGini,
    CRITERIA, build, classify, rules, thresholds,
  };

  /* ---------- 講義的資料集 ---------- */
  const ROWS = [
    ['youth', 'high', 'no', 'fair', 'no'],
    ['youth', 'high', 'no', 'excellent', 'no'],
    ['middle', 'high', 'no', 'fair', 'yes'],
    ['senior', 'medium', 'no', 'fair', 'yes'],
    ['senior', 'low', 'yes', 'fair', 'yes'],
    ['senior', 'low', 'yes', 'excellent', 'no'],
    ['middle', 'low', 'yes', 'excellent', 'yes'],
    ['youth', 'medium', 'no', 'fair', 'no'],
    ['youth', 'low', 'yes', 'fair', 'yes'],
    ['senior', 'medium', 'yes', 'fair', 'yes'],
    ['youth', 'medium', 'yes', 'excellent', 'yes'],
    ['middle', 'medium', 'no', 'excellent', 'yes'],
    ['middle', 'high', 'yes', 'fair', 'yes'],
    ['senior', 'medium', 'no', 'excellent', 'no'],
  ];
  const ATTRS = ['age', 'income', 'student', 'credit_rating'];
  DT.DATA = {
    // Week 7 第 21 頁：buy_computer 訓練資料（14 筆）
    buy: ROWS.map((r, i) => ({
      id: 'R' + (i + 1), age: r[0], income: r[1], student: r[2], credit_rating: r[3], buy_computer: r[4],
    })),
    attrs: ATTRS,
    target: 'buy_computer',
    // 第 23～26 頁：要預測的三位新顧客
    customers: [
      { name: '顧客 1（第 24 頁）', age: 'middle', income: 'high', student: 'no', credit_rating: 'excellent' },
      { name: '顧客 2（第 25 頁）', age: 'senior', income: 'medium', student: 'no', credit_rating: 'excellent' },
      { name: '顧客 3（第 26 頁）', age: 'youth', income: 'low', student: 'no', credit_rating: 'fair' },
    ],
    // 第 46 頁：連續屬性 age 排序後的值；類別標籤是補充的
    ages: [15, 18, 21, 22, 24, 25, 29, 31],
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DT;
  else root.DT = DT;
})(typeof window !== 'undefined' ? window : globalThis);
