/* 共用：週次清單、頁首、目錄、主題切換、KaTeX、測驗、逐步展開、FP-tree 繪圖、規則計算器 */
(function () {
  'use strict';

  // 新增一週時，在這裡加一行（done: 網頁是否完成）
  const CHAPTERS = [
    { id: 'w1', no: 'W1', title: '資料探勘導論', desc: 'KDD 流程、描述型與預測型探勘、關聯規則、分類、分群、離群值', done: true },
    { id: 'w2', no: 'W2', title: '資料前處理', desc: '髒資料、屬性類型、集中趨勢與離散程度、盒鬚圖、相關係數、卡方檢定', done: true },
    { id: 'w4', no: 'W4', title: '頻繁樣式探勘與 Apriori', desc: '支持度、信賴度、閉合與極大頻繁項目集、Apriori 連接與剪枝、規則產生', done: true },
    { id: 'w6', no: 'W6', title: 'Apriori 改良與 FP-Growth', desc: 'DHP 雜湊、交易縮減、分割、抽樣與負邊界、FP-tree、FP-Growth', done: true },
  ];
  // 首頁倒數：考試與作業截止日
  const EXAMS = [
    { name: '作業 1（Weka）', date: '2026-11-06' },
    { name: '考試', date: '2026-11-27' },
    { name: '作業 2（LibSVM）', date: '2026-11-27' },
    { name: '作業 3（Kaggle）', date: '2026-12-18' },
    { name: '論文導讀', date: '2026-12-25' },
  ];
  // 課程識別：螢光筆（highlighter.js）的 localStorage 前綴與匯出檔名。其他課程的筆記若部署在
  // 同一個 github.io 網域，localStorage 是共用的，靠這個前綴分開
  const COURSE = { id: 'dm', name: 'DataMining' };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c != null) e.append(c);
    return e;
  }

  // 數字格式：去掉多餘的 0
  function fmt(n, d = 3) {
    if (!isFinite(n)) return String(n);
    const r = Number(n.toFixed(d));
    return Object.is(r, -0) ? '0' : String(r);
  }
  const int = (n) => Math.round(n).toLocaleString('en-US');

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  /* ---------- 主題 ---------- */
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    document.dispatchEvent(new Event('themechange'));
  }
  applyTheme(store('dm-theme'));
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      document.dispatchEvent(new Event('themechange'));
    });
  }
  function isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /* ---------- 頁首 ---------- */
  function buildTopbar() {
    const current = document.body.dataset.chapter || 'home';
    const inChapter = current !== 'home';
    const prefix = inChapter ? '../' : '';
    const nav = el('nav', { class: 'chapnav', 'aria-label': '週次' });
    nav.append(el('a', { href: prefix + 'index.html', text: '首頁', class: current === 'home' ? 'active' : '' }));
    for (const c of CHAPTERS) {
      if (!c.done) continue;
      nav.append(el('a', {
        href: prefix + 'chapters/' + c.id + '.html',
        text: c.no, title: c.title, class: current === c.id ? 'active' : '',
      }));
    }
    const themeBtn = el('button', { class: 'icon-btn', type: 'button', title: '切換深色／淺色' });
    const label = () => { themeBtn.textContent = isDark() ? '☀ 淺色' : '☾ 深色'; };
    label();
    themeBtn.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      store('dm-theme', next);
      applyTheme(next);
      label();
    });
    const hlMenu = window.Highlighter ? window.Highlighter.menu() : null;
    const bar = el('header', { class: 'topbar' }, [
      el('div', { class: 'topbar-inner' }, [
        el('a', { class: 'brand', href: prefix + 'index.html', text: '⛏️ 資料探勘筆記' }),
        nav, hlMenu, themeBtn,
      ]),
    ]);
    document.body.prepend(bar);
  }

  /* ---------- 目錄 ---------- */
  function buildToc() {
    const toc = $('.toc');
    const main = $('main');
    if (!toc || !main) return;
    const heads = $$('h2, h3', main).filter((h) => !h.closest('.widget, .quiz, .callout'));
    let n = 0;
    const links = [];
    for (const h of heads) {
      if (!h.id) h.id = 'sec-' + (++n);
      const a = el('a', { href: '#' + h.id, text: h.textContent, class: h.tagName === 'H3' ? 'sub' : '' });
      toc.append(a);
      links.push([h, a]);
    }
    // 目前位置 = 最後一個已捲過頁首的標題
    let ticking = false;
    const sync = () => {
      ticking = false;
      let cur = links[0];
      for (const l of links) { if (l[0].getBoundingClientRect().top < 110) cur = l; else break; }
      links.forEach(([, a]) => a.classList.toggle('active', cur && a === cur[1]));
      if (cur) {
        const a = cur[1], t = toc.getBoundingClientRect(), r = a.getBoundingClientRect();
        if (r.top < t.top || r.bottom > t.bottom) toc.scrollTop += r.top - t.top - t.height / 3;
      }
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(sync); } }, { passive: true });
    sync();
  }

  /* ---------- KaTeX ---------- */
  function renderMath(root = document.body) {
    if (!window.renderMathInElement) return;
    window.renderMathInElement(root, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false,
    });
  }
  // 把 TeX 字串渲染進元素（互動元件用）
  function tex(elm, s, display = false) {
    if (window.katex) window.katex.render(s, elm, { displayMode: display, throwOnError: false });
    else elm.textContent = s;
  }

  /* ---------- 測驗 ---------- */
  function initQuizzes() {
    for (const q of $$('.quiz[data-answer]')) {
      const ans = q.dataset.answer;
      const explain = $('.explain', q);
      const btns = $$('.opts button', q);
      for (const b of btns) {
        b.type = 'button';
        b.addEventListener('click', () => {
          const ok = b.dataset.opt === ans;
          b.classList.add(ok ? 'right' : 'wrong');
          if (ok) {
            btns.forEach((x) => { x.disabled = true; });
            if (explain) explain.hidden = false;
          } else {
            b.disabled = true;
          }
        });
      }
      if (explain) {
        const reveal = el('button', { class: 'btn', type: 'button', text: '直接看解答', style: 'margin-top:8px' });
        reveal.addEventListener('click', () => {
          btns.forEach((x) => {
            x.disabled = true;
            if (x.dataset.opt === ans) x.classList.add('right');
          });
          explain.hidden = false;
          reveal.remove();
        });
        explain.before(reveal);
      }
    }
  }

  /* ---------- 逐步展開 ---------- */
  // <div class="steps"><p class="steps-title">…</p><ol><li>…</li></ol></div>
  // 一開始只顯示題目，按「下一步」一次多顯示一步
  function initSteps() {
    for (const box of $$('.steps')) {
      const items = $$('ol > li', box);
      if (!items.length) continue;
      let shown = 0;
      const next = el('button', { class: 'btn primary', type: 'button' });
      const all = el('button', { class: 'btn', type: 'button', text: '全部展開' });
      const reset = el('button', { class: 'btn', type: 'button', text: '收起' });
      const count = el('span', { class: 'muted', style: 'font-size:.88rem' });
      const sync = () => {
        items.forEach((li, i) => { li.hidden = i >= shown; });
        next.textContent = shown === 0 ? '開始第 1 步 ▶' : '下一步 ▶';
        next.disabled = all.disabled = shown >= items.length;
        reset.hidden = shown === 0;
        count.textContent = shown >= items.length ? `共 ${items.length} 步，全部展開` : `${shown}／${items.length} 步`;
      };
      next.addEventListener('click', () => { shown = Math.min(items.length, shown + 1); sync(); });
      all.addEventListener('click', () => { shown = items.length; sync(); });
      reset.addEventListener('click', () => { shown = 0; sync(); });
      box.append(el('div', { class: 'steps-ctrl' }, [next, all, reset, count]));
      sync();
    }
  }

  /* ---------- 矩陣 ---------- */
  // M: 2D 陣列；opts.cls(i,j,v) 回傳 class 字串；opts.onClick(i,j)；opts.text(i,j,v)
  function matrix(M, opts = {}) {
    const rows = M.length;
    const cols = rows ? M[0].length : 0;
    const g = el('div', { class: 'matrix' + (opts.small ? ' small' : '') });
    g.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const v = M[i][j];
        const txt = opts.text ? opts.text(i, j, v) : (v === null || v === undefined ? '' : fmt(v, 2));
        let cls = 'cell';
        if (v === null || v === undefined) cls += ' empty';
        else if (typeof v === 'number' && v < 0) cls += ' neg';
        if (opts.cls) cls += ' ' + (opts.cls(i, j, v) || '');
        if (opts.onClick) cls += ' click';
        const c = el('div', { class: cls, text: txt || (v == null ? '·' : '') });
        if (opts.onClick) c.addEventListener('click', () => opts.onClick(i, j));
        g.append(c);
      }
    }
    if (!opts.caption) return g;
    return el('div', { class: 'matrix-block' }, [g, el('div', { class: 'cap', text: opts.caption })]);
  }

  /* ---------- 畫布 ---------- */
  // 建立高解析度畫布，回傳 { ctx, w, h }（w,h 為 CSS 像素，依 aspect 比例）
  function setupCanvas(canvas, aspect) {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
    const h = Math.round(w * aspect);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '13px system-ui, sans-serif';
    return { ctx, w, h };
  }
  // 元件重畫：主題切換、視窗縮放時自動呼叫
  const redrawers = [];
  function onRedraw(fn) { redrawers.push(fn); fn(); }
  let rt = null;
  const redrawAll = () => redrawers.forEach((f) => f());
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(redrawAll, 120); });
  document.addEventListener('themechange', () => requestAnimationFrame(redrawAll));

  // 指標座標（CSS 像素）
  function pointer(canvas, ev) {
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  // 可重現的亂數
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function gauss(r) {
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // 綁定滑桿與數值顯示：<input id=x> 旁邊的 <span data-for=x>
  function bindRange(input, onChange, format = (v) => v) {
    const out = document.querySelector(`[data-for="${input.id}"]`);
    const upd = () => { if (out) out.textContent = format(Number(input.value)); onChange(Number(input.value)); };
    input.addEventListener('input', upd);
    upd();
  }

  /* ---------- 首頁 ---------- */
  function buildHome() {
    const cards = $('#chapter-cards');
    if (cards) {
      for (const c of CHAPTERS) {
        cards.append(el('a', { class: 'card' + (c.done ? '' : ' todo'), href: 'chapters/' + c.id + '.html' }, [
          el('span', { class: 'num', text: c.no }),
          el('h3', { text: c.title }),
          el('p', { text: c.done ? c.desc : '尚未完成' }),
        ]));
      }
    }
    const cd = $('#countdown');
    if (cd) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      for (const e of EXAMS) {
        const d = new Date(e.date + 'T00:00:00');
        const days = Math.round((d - today) / 86400000);
        cd.append(el('div', { class: 'count-card' }, [
          el('div', { class: 'n', text: days > 0 ? days + ' 天' : days === 0 ? '今天！' : '已結束' }),
          el('div', { class: 'l', text: `${e.name}　${e.date}` }),
        ]));
      }
    }
  }

  /* ---------- 項目集 ---------- */
  const fmtSet = (s) => '{' + s.join(', ') + '}';
  const pct = (x) => fmt(x * 100, 1) + '%';
  // 分數與百分比：2/3 → 2/3（66.7%）
  const frac = (a, b) => (b ? `${a}/${b}（${pct(a / b)}）` : '—');

  /* ---------- FP-tree 繪圖 ---------- */
  // root: FIM.fpTree 的根；opts.hl: 要標亮的項目；opts.fresh: Set(node id) 剛插入的路徑；opts.links: 是否畫節點鏈
  function drawTree(svg, root, opts = {}) {
    const UX = 64, UY = 58, PADX = 34, PADY = 22, NW = 50, NH = 26;
    let leaf = 0, depth = 0;
    const nodes = [];
    (function place(n, d) {
      n._d = d; depth = Math.max(depth, d);
      if (!n.children.length) n._x = leaf++;
      else {
        n.children.forEach((c) => place(c, d + 1));
        n._x = (n.children[0]._x + n.children[n.children.length - 1]._x) / 2;
      }
      nodes.push(n);
    })(root, 0);
    const W = Math.max(1, leaf) * UX + PADX * 2 - (UX - NW);
    const H = depth * UY + NH + PADY * 2;
    const X = (n) => PADX + NW / 2 + n._x * UX;
    const Y = (n) => PADY + NH / 2 + n._d * UY;
    let g = '';
    for (const n of nodes) for (const c of n.children) {
      g += `<path class="edge" d="M${X(n)} ${Y(n) + NH / 2} L${X(c)} ${Y(c) - NH / 2}"/>`;
    }
    if (opts.links && opts.hl) {
      const same = nodes.filter((n) => n.item === opts.hl).sort((a, b) => a._x - b._x);
      for (let i = 1; i < same.length; i++) {
        const a = same[i - 1], b = same[i];
        g += `<path class="link" d="M${X(a) + NW / 2} ${Y(a)} C${X(a) + NW} ${Y(a) + 18}, ${X(b) - NW} ${Y(b) + 18}, ${X(b) - NW / 2} ${Y(b)}"/>`;
      }
    }
    for (const n of nodes) {
      const isRoot = n.item === null;
      let cls = 'node' + (isRoot ? ' root' : '');
      if (!isRoot && opts.hl && n.item === opts.hl) cls += ' hl';
      if (opts.fresh && opts.fresh.has(n.id)) cls += ' new';
      const label = isRoot ? 'null' : `${n.item}:${n.count}`;
      g += `<g class="${cls}"><rect x="${X(n) - NW / 2}" y="${Y(n) - NH / 2}" width="${NW}" height="${NH}" rx="7"/>` +
        `<text x="${X(n)}" y="${Y(n)}">${label}</text></g>`;
    }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.maxWidth = W * 1.15 + 'px';
    svg.innerHTML = g;
  }

  /* ---------- 項目集格子圖 ---------- */
  // 畫格子圖：rows = [[{ set, cls, label }...], ...]，回傳每格的 <g>
  function drawLattice(svg, rows, onClick) {
    const NW = 58, NH = 30, GX = 10, GY = 34, PAD = 10;
    const maxN = Math.max(...rows.map((r) => r.length));
    const W = maxN * NW + (maxN - 1) * GX + PAD * 2;
    const H = rows.length * NH + (rows.length - 1) * GY + PAD * 2;
    const pos = new Map();
    const key = window.FIM.key;
    rows.forEach((r, i) => {
      const rowW = r.length * NW + (r.length - 1) * GX;
      const x0 = (W - rowW) / 2;
      r.forEach((n, j) => pos.set(key(n.set), { x: x0 + j * (NW + GX) + NW / 2, y: PAD + i * (NH + GY) + NH / 2 }));
    });
    let g = '';
    rows.forEach((r, i) => {
      if (i === 0) return;
      for (const n of r) {
        const p = pos.get(key(n.set));
        for (const s of window.FIM.subsetsMinusOne(n.set)) {
          const q = pos.get(key(s));
          if (q) g += `<line class="edge" x1="${q.x}" y1="${q.y + NH / 2}" x2="${p.x}" y2="${p.y - NH / 2}"/>`;
        }
      }
    });
    for (const r of rows) for (const n of r) {
      const p = pos.get(key(n.set));
      g += `<g class="n ${n.cls}" data-k="${key(n.set)}"><rect x="${p.x - NW / 2}" y="${p.y - NH / 2}" width="${NW}" height="${NH}" rx="7"/>` +
        `<text x="${p.x}" y="${p.y}">${n.label}</text></g>`;
    }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = g;
    $$('g.n', svg).forEach((nd) => nd.addEventListener('click', () => onClick(nd.dataset.k.split(','))));
  }
  function levelsOf(items) {
    const rows = [];
    const n = items.length;
    for (let m = 1; m < (1 << n); m++) {
      const s = items.filter((_, i) => m & (1 << i));
      (rows[s.length - 1] = rows[s.length - 1] || []).push(s);
    }
    return rows;
  }

  /* ---------- 規則計算器 ---------- */
  // 在 box 裡畫出 X、Y 的項目按鈕、交易表與支持度／信賴度
  function ruleCalc(box, db, X0, Y0) {
    const items = window.FIM.sorted(db.flatMap((t) => t.items));
    const X = new Set(X0), Y = new Set(Y0);
    const rowX = el('div', { class: 'pick' }), rowY = el('div', { class: 'pick' });
    const table = el('div', { class: 'table-wrap' });
    const out = el('div', { class: 'readout' });
    box.append(
      el('div', { class: 'controls' }, [el('span', { class: 'muted', text: '前項 X：' }), rowX]),
      el('div', { class: 'controls' }, [el('span', { class: 'muted', text: '後項 Y：' }), rowY]),
      table, out);
    const btns = [];
    for (const [row, S, T] of [[rowX, X, Y], [rowY, Y, X]]) {
      for (const it of items) {
        const b = el('button', { class: 'btn', type: 'button', text: it });
        b.addEventListener('click', () => {
          if (S.has(it)) S.delete(it); else { S.add(it); T.delete(it); }
          render();
        });
        btns.push([b, S, it]);
        row.append(b);
      }
    }
    function render() {
      btns.forEach(([b, S, it]) => b.setAttribute('aria-pressed', String(S.has(it))));
      const xs = items.filter((i) => X.has(i)), ys = items.filter((i) => Y.has(i));
      const xy = xs.concat(ys);
      let h = '<table><tr><th>TID</th><th>項目</th><th>含 X</th><th>含 X ∪ Y</th></tr>';
      for (const t of db) {
        const hx = xs.length && window.FIM.has(t.items, xs), hxy = xy.length && window.FIM.has(t.items, xy) && xs.length && ys.length;
        h += `<tr class="${hxy ? 'hit' : ''}"><td>${t.tid}</td><td>${t.items.join(', ')}</td>` +
          `<td class="${hx ? 'ok' : 'no'}">${hx ? '✓' : '—'}</td><td class="${hxy ? 'ok' : 'no'}">${hxy ? '✓' : '—'}</td></tr>`;
      }
      table.innerHTML = h + '</table>';
      if (!xs.length || !ys.length) {
        out.innerHTML = '<span class="muted">X 和 Y 都至少要選一個項目，而且不能重複（X ∩ Y = ∅）。</span>';
        return;
      }
      const n = db.length, cx = window.FIM.count(db, xs), cxy = window.FIM.count(db, xy);
      out.innerHTML = `<div>規則：<strong class="itemset">${fmtSet(xs)} ⇒ ${fmtSet(ys)}</strong></div>` +
        `<div>支持度 = sup(X ∪ Y) ÷ |D| = ${cxy}/${n} = <span class="big">${pct(cxy / n)}</span></div>` +
        `<div>信賴度 = sup(X ∪ Y) ÷ sup(X) = ${cx ? `${cxy}/${cx} = <span class="big">${pct(cxy / cx)}</span>` : '分母為 0，無法計算'}</div>` +
        `<div class="muted">反過來的 ${fmtSet(ys)} ⇒ ${fmtSet(xs)}：支持度一樣是 ${pct(cxy / n)}，信賴度 = ${cxy}/${window.FIM.count(db, ys)}${window.FIM.count(db, ys) ? ` = ${pct(cxy / window.FIM.count(db, ys))}` : ''}</div>`;
    }
    render();
    return { set(x, y) { X.clear(); Y.clear(); x.forEach((i) => X.add(i)); y.forEach((i) => Y.add(i)); render(); } };
  }

  window.DM = {
    CHAPTERS, $, $$, el, fmt, int, cssVar, tex, matrix, setupCanvas, onRedraw, pointer, rng, gauss,
    bindRange, renderMath, isDark, fmtSet, pct, frac, drawTree, drawLattice, levelsOf, ruleCalc,
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (window.Highlighter) {
      const ch = document.body.dataset.chapter;
      window.Highlighter.setup({
        course: COURSE,
        chapter: ch && ch !== 'home' ? ch : null,   // 首頁不是筆記，不能標記
        content: 'main',
        skip: '.widget, .katex, .steps-ctrl',
        buttonClass: 'icon-btn',
      });
    }
    buildTopbar();
    buildHome();
    initQuizzes();
    initSteps();
    buildToc();
  });
  // KaTeX 以 defer 載入，等全部載完再渲染
  window.addEventListener('load', () => {
    renderMath();
    if (window.Highlighter) window.Highlighter.start();   // 公式渲染後才畫標記，位置才對得上
  });
})();
