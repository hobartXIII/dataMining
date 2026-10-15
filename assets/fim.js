/* 頻繁樣式探勘的計算：Apriori、關聯規則、閉合／極大、DHP、交易縮減、負邊界、FP-tree、FP-Growth
   純計算，不碰 DOM；瀏覽器掛在 window.FIM，Node 可用 require() 驗算 */
(function (root) {
  'use strict';

  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const key = (s) => s.join(',');
  const sorted = (s) => Array.from(new Set(s)).sort(cmp);
  const has = (tx, set) => set.every((i) => tx.includes(i));

  // db: [{ tid, items: [...] }]，items 會排序去重
  function normalize(db) {
    return db.map((t) => ({ tid: t.tid, items: sorted(t.items) }));
  }
  function count(db, set) {
    let n = 0;
    for (const t of db) if (has(t.items, set)) n++;
    return n;
  }
  function tidsOf(db, set) {
    return db.filter((t) => has(t.items, set)).map((t) => t.tid);
  }

  // 所有 k-1 子集
  function subsetsMinusOne(set) {
    return set.map((_, i) => set.filter((__, j) => j !== i));
  }
  // 所有非空真子集（依大小、字典序）
  function properSubsets(set) {
    const out = [];
    const n = set.length;
    for (let m = 1; m < (1 << n) - 1; m++) {
      const s = [];
      for (let i = 0; i < n; i++) if (m & (1 << i)) s.push(set[i]);
      out.push(s);
    }
    out.sort((a, b) => a.length - b.length || cmp(key(a), key(b)));
    return out;
  }

  /* ---------- Apriori ---------- */
  // 回傳 { levels, freq }；levels[i] = { k, joined, pruned, counted, L }
  function apriori(db, minCount) {
    db = normalize(db);
    const freq = new Map();
    const levels = [];
    const items = sorted(db.flatMap((t) => t.items));
    const c1 = items.map((i) => ({ set: [i], count: count(db, [i]) }));
    let L = c1.filter((c) => c.count >= minCount);
    levels.push({ k: 1, joined: null, pruned: [], counted: c1, L });
    L.forEach((x) => freq.set(key(x.set), x.count));
    let k = 1;
    while (L.length) {
      const Ls = L.map((x) => x.set);
      const inL = new Set(Ls.map(key));
      const joined = [];
      for (let i = 0; i < Ls.length; i++) {
        for (let j = i + 1; j < Ls.length; j++) {
          const a = Ls[i], b = Ls[j];
          let same = true;
          for (let t = 0; t < k - 1; t++) if (a[t] !== b[t]) { same = false; break; }
          if (!same || !(a[k - 1] < b[k - 1])) continue;
          joined.push({ set: a.concat([b[k - 1]]), from: [a, b] });
        }
      }
      const pruned = [], keep = [];
      for (const c of joined) {
        const missing = k === 1 ? [] : subsetsMinusOne(c.set).filter((s) => !inL.has(key(s)));
        if (missing.length) pruned.push({ set: c.set, missing });
        else keep.push(c.set);
      }
      const counted = keep.map((s) => ({ set: s, count: count(db, s) }));
      L = counted.filter((c) => c.count >= minCount);
      k++;
      levels.push({ k, joined, pruned, counted, L });
      L.forEach((x) => freq.set(key(x.set), x.count));
      if (!joined.length) break;
    }
    return { levels, freq };
  }

  // 由頻繁項目集產生規則；freq: Map(key -> count)
  function rules(freq, minConf) {
    const out = [];
    const sets = Array.from(freq.keys()).map((k) => k.split(','))
      .filter((s) => s.length >= 2)
      .sort((a, b) => a.length - b.length || cmp(key(a), key(b)));
    for (const l of sets) {
      const cl = freq.get(key(l));
      for (const s of properSubsets(l)) {
        const y = l.filter((i) => !s.includes(i));
        const cs = freq.get(key(s));
        const conf = cl / cs;
        out.push({ X: s, Y: y, from: l, supCount: cl, xCount: cs, conf, ok: conf >= minConf - 1e-12 });
      }
    }
    return out;
  }

  /* ---------- 閉合與極大 ---------- */
  // 列舉 items 的所有非空子集
  function lattice(db, items, minCount) {
    db = normalize(db);
    items = sorted(items);
    const n = items.length;
    const all = [];
    for (let m = 1; m < (1 << n); m++) {
      const s = [];
      for (let i = 0; i < n; i++) if (m & (1 << i)) s.push(items[i]);
      all.push({ set: s, count: count(db, s) });
    }
    const by = new Map(all.map((x) => [key(x.set), x]));
    for (const x of all) x.frequent = x.count >= minCount;
    for (const x of all) {
      const sup = items.filter((i) => !x.set.includes(i)).map((i) => by.get(key(sorted(x.set.concat([i])))));
      x.supersets = sup;
      // 只要檢查多一個項目的超集就夠：支持度只會越加越小
      x.closed = x.frequent && sup.every((y) => y.count !== x.count);
      x.maximal = x.frequent && sup.every((y) => !y.frequent);
    }
    all.sort((a, b) => a.set.length - b.set.length || cmp(key(a.set), key(b.set)));
    return all;
  }

  /* ---------- DHP ---------- */
  // order: { A: 1, B: 2, ... }；h({x,y}) = (order(x)*10 + order(y)) mod m
  function dhp(db, order, m, minCount) {
    db = normalize(db);
    const h = (x, y) => (order[x] * 10 + order[y]) % m;
    const buckets = Array.from({ length: m }, () => ({ count: 0, items: [] }));
    const txPairs = db.map((t) => {
      const pairs = [];
      for (let i = 0; i < t.items.length; i++) {
        for (let j = i + 1; j < t.items.length; j++) {
          const p = [t.items[i], t.items[j]];
          const b = h(p[0], p[1]);
          buckets[b].count++;
          buckets[b].items.push(key(p));
          pairs.push({ set: p, bucket: b });
        }
      }
      return { tid: t.tid, items: t.items, pairs };
    });
    const items = sorted(db.flatMap((t) => t.items));
    const c1 = items.map((i) => ({ set: [i], count: count(db, [i]) }));
    const L1 = c1.filter((c) => c.count >= minCount).map((c) => c.set[0]);
    const c2 = [];
    for (let i = 0; i < L1.length; i++) {
      for (let j = i + 1; j < L1.length; j++) {
        const s = [L1[i], L1[j]];
        const b = h(s[0], s[1]);
        c2.push({ set: s, bucket: b, bucketCount: buckets[b].count, pass: buckets[b].count >= minCount, count: count(db, s) });
      }
    }
    const L2 = c2.filter((c) => c.pass && c.count >= minCount).map((c) => c.set);
    return { buckets, txPairs, c1, L1, c2, L2 };
  }

  // 交易縮減：從 k 進到 k+1，項目出現在少於 k 個「該交易所含的頻繁 k-項目集」就丟掉
  function reduceTx(db, Lk, k) {
    db = normalize(db);
    return db.map((t) => {
      const inside = Lk.filter((s) => has(t.items, s));
      const occ = {};
      t.items.forEach((i) => { occ[i] = inside.filter((s) => s.includes(i)).length; });
      const kept = t.items.filter((i) => occ[i] >= k);
      return { tid: t.tid, items: t.items, inside, occ, kept, removed: kept.length < k + 1 };
    });
  }

  // 負邊界：不在 Ls、但所有 (|X|-1)-子集都在 Ls 的項目集
  function negativeBorder(Ls, items) {
    items = sorted(items);
    const inLs = new Set(Ls.map((s) => key(sorted(s))));
    const out = [];
    const n = items.length;
    for (let m = 1; m < (1 << n); m++) {
      const s = [];
      for (let i = 0; i < n; i++) if (m & (1 << i)) s.push(items[i]);
      if (inLs.has(key(s))) continue;
      const ok = s.length === 1 || subsetsMinusOne(s).every((x) => inLs.has(key(x)));
      if (ok) out.push(s);
    }
    out.sort((a, b) => a.length - b.length || cmp(key(a), key(b)));
    return out;
  }

  /* ---------- FP-tree ---------- */
  // F-list：依支持計數由大到小；同分時依 tie（明確順序陣列）或字母順序
  function flist(db, minCount, tie) {
    db = normalize(db);
    const cnt = {};
    db.forEach((t) => t.items.forEach((i) => { cnt[i] = (cnt[i] || 0) + 1; }));
    const rank = (i) => (tie && tie.includes(i) ? tie.indexOf(i) : 1e6);
    const items = Object.keys(cnt).filter((i) => cnt[i] >= minCount)
      .sort((a, b) => cnt[b] - cnt[a] || rank(a) - rank(b) || cmp(a, b));
    const removed = Object.keys(cnt).filter((i) => cnt[i] < minCount).sort(cmp);
    return { items, counts: cnt, removed };
  }
  function orderTx(items, fl) {
    return fl.filter((i) => items.includes(i));
  }

  let nodeId = 0;
  function newNode(item, parent) {
    return { id: ++nodeId, item, count: 0, parent, children: [] };
  }
  // txs: [{ items: [...已排序], w }]；回傳 { root, header, paths }，paths[i] = 第 i 筆走過的節點 id
  function fpTree(txs, fl) {
    const root = newNode(null, null);
    const header = new Map(fl.map((i) => [i, []]));
    const paths = [];
    for (const t of txs) {
      let cur = root;
      const path = [];
      for (const it of t.items) {
        let ch = cur.children.find((c) => c.item === it);
        if (!ch) {
          ch = newNode(it, cur);
          cur.children.push(ch);
          if (!header.has(it)) header.set(it, []);
          header.get(it).push(ch);
        }
        ch.count += t.w || 1;
        path.push(ch.id);
        cur = ch;
      }
      paths.push(path);
    }
    return { root, header, paths };
  }

  // 條件樣式基底：item 的每個節點往根走的前綴路徑，計數用該節點的計數
  function condBase(tree, item) {
    const out = [];
    for (const nd of tree.header.get(item) || []) {
      const path = [];
      let p = nd.parent;
      while (p && p.item !== null) { path.unshift(p.item); p = p.parent; }
      if (path.length) out.push({ path, count: nd.count });
    }
    return out;
  }

  // 在加權交易上做樣式成長；fl 為全域順序，只往「排在前面」的項目延伸，保證每個樣式只出現一次
  function grow(txs, minCount, fl, suffix, out) {
    const cnt = {};
    txs.forEach((t) => t.items.forEach((i) => { cnt[i] = (cnt[i] || 0) + t.w; }));
    const freqItems = fl.filter((i) => (cnt[i] || 0) >= minCount);
    for (let idx = freqItems.length - 1; idx >= 0; idx--) {
      const x = freqItems[idx];
      const pat = [x].concat(suffix);
      out.push({ set: pat, count: cnt[x] });
      const proj = [];
      for (const t of txs) {
        const p = t.items.indexOf(x);
        if (p > 0) {
          const pre = t.items.slice(0, p).filter((i) => (cnt[i] || 0) >= minCount);
          if (pre.length) proj.push({ items: pre, w: t.w });
        }
      }
      if (proj.length) grow(proj, minCount, fl, pat, out);
    }
    return out;
  }

  // 整份資料的 FP-Growth：回傳 F-list、樹、每個後綴一列
  function fpMine(db, minCount, tie) {
    db = normalize(db);
    const F = flist(db, minCount, tie);
    const fl = F.items;
    const ordered = db.map((t) => ({ tid: t.tid, raw: t.items, items: orderTx(t.items, fl), w: 1 }));
    const tree = fpTree(ordered, fl);
    const rows = [];
    for (let idx = fl.length - 1; idx >= 0; idx--) {
      const x = fl[idx];
      const base = condBase(tree, x);
      const cnt = {};
      base.forEach((b) => b.path.forEach((i) => { cnt[i] = (cnt[i] || 0) + b.count; }));
      const kept = fl.filter((i) => (cnt[i] || 0) >= minCount);
      const dropped = fl.filter((i) => cnt[i] && cnt[i] < minCount);
      const condTxs = base.map((b) => ({ items: b.path.filter((i) => kept.includes(i)), w: b.count }))
        .filter((t) => t.items.length);
      const condTree = fpTree(condTxs, kept);
      const patterns = [{ set: [x], count: F.counts[x] }];
      grow(condTxs, minCount, fl, [x], patterns);
      rows.push({ item: x, base, cnt, kept, dropped, condTree, single: isSinglePath(condTree.root), patterns });
    }
    const all = rows.flatMap((r) => r.patterns);
    return { F, fl, ordered, tree, rows, all };
  }

  function isSinglePath(rootNode) {
    let n = rootNode;
    while (n.children.length === 1) n = n.children[0];
    return n.children.length === 0;
  }

  const FIM = {
    cmp, key, sorted, has, normalize, count, tidsOf, properSubsets, subsetsMinusOne,
    apriori, rules, lattice, dhp, reduceTx, negativeBorder,
    flist, orderTx, fpTree, condBase, grow, fpMine, isSinglePath,
  };

  /* ---------- 講義的資料集 ---------- */
  FIM.DATA = {
    // Week 1 購物籃
    basket: [
      { tid: 'T1', items: ['Bread', 'Apple', 'Milk'] },
      { tid: 'T2', items: ['Beer', 'Apple', 'Diaper'] },
      { tid: 'T3', items: ['Bread', 'Beer', 'Apple', 'Diaper'] },
      { tid: 'T4', items: ['Beer', 'Diaper'] },
    ],
    // Week 4 第 9 頁：4 筆交易
    tdb4: [
      { tid: '00001', items: ['a', 'c', 'd'] },
      { tid: '00002', items: ['b', 'c', 'd', 'e'] },
      { tid: '00003', items: ['a', 'b', 'c', 'd'] },
      { tid: '00004', items: ['a', 'd'] },
    ],
    // Week 4 第 51 頁、Week 6：9 筆交易
    tdb9: [
      { tid: '001', items: ['a', 'b', 'e'] },
      { tid: '002', items: ['b', 'd'] },
      { tid: '003', items: ['b', 'c'] },
      { tid: '004', items: ['a', 'b', 'd'] },
      { tid: '005', items: ['a', 'c'] },
      { tid: '006', items: ['b', 'c'] },
      { tid: '007', items: ['a', 'c', 'f'] },
      { tid: '008', items: ['a', 'b', 'c', 'e'] },
      { tid: '009', items: ['a', 'b', 'c'] },
    ],
    // Week 4 筆記的練習題資料
    practice: [
      { tid: 'T1', items: ['A', 'B', 'C'] },
      { tid: 'T2', items: ['A', 'C'] },
      { tid: 'T3', items: ['A', 'D'] },
      { tid: 'T4', items: ['B', 'C', 'E'] },
      { tid: 'T5', items: ['A', 'B', 'C', 'E'] },
    ],
    // Week 6 第 17 頁：DHP
    dhp4: [
      { tid: '100', items: ['A', 'C', 'D'] },
      { tid: '200', items: ['B', 'C', 'E'] },
      { tid: '300', items: ['A', 'B', 'C', 'E'] },
      { tid: '400', items: ['B', 'E'] },
    ],
    // Week 6 第 46 頁：課本範例
    textbook: [
      { tid: '100', items: ['f', 'a', 'c', 'd', 'g', 'i', 'm', 'p'] },
      { tid: '200', items: ['a', 'b', 'c', 'f', 'l', 'm', 'o'] },
      { tid: '300', items: ['b', 'f', 'h', 'j', 'o', 'w'] },
      { tid: '400', items: ['b', 'c', 'k', 's', 'p'] },
      { tid: '500', items: ['a', 'f', 'c', 'e', 'l', 'p', 'm', 'n'] },
    ],
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = FIM;
  else root.FIM = FIM;
})(typeof window !== 'undefined' ? window : globalThis);
