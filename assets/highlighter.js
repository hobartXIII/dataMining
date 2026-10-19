/* 螢光筆：選取文字標色、換色、清除，標記存在瀏覽器，可匯出後寫回 repo 變成共享標記。
   獨立檔案，不依賴其他程式；規格與移植說明見 docs/highlighter.md。

   用法（script 要在呼叫它的程式之前載入）：
     Highlighter.setup({
       course: { id: 'cv', name: 'ComputerVision' },  // 必填：localStorage 前綴與匯出檔名
       chapter: 'c1',                // 本頁識別；null 表示這頁不能標記（例如首頁），選單仍可匯出與清除全部
       content: 'main',              // 可標記的內容區
       skip: '.widget, .katex',      // 不能標記的區塊（內容會變動的都要列進來）
       buttonClass: 'icon-btn',      // 選單按鈕套用的 class，讓它跟頁首其他按鈕一致
     });
     header.append(Highlighter.menu());   // 「🖍 標記」選單按鈕
     Highlighter.start();                 // 公式等內容渲染完成後呼叫，才會畫上標記

   個人標記：localStorage `<course.id>-hl:<chapter>`
   對共享標記的改色／隱藏：`<course.id>-hl-ovr:<chapter>`（{ id: 顏色 | null }）
   共享標記：同目錄的 highlights.js（window.HL_SHARED = { course, marks: { chapter: [...] } }），
             由 tools/merge-highlights.js 從匯出檔產生 */
(function () {
  'use strict';

  const MARKS = [
    { c: 'y', label: '黃底' }, { c: 'g', label: '綠底' }, { c: 'p', label: '粉底' },
    { c: 'r', label: '紅字' }, { c: 'b', label: '藍字' },
  ];
  const BASE_SKIP = 'script, style, button, .hl-tool';
  const CTX = 20;   // 前後文字數

  // 共享標記資料檔：跟本檔放在同一層。在 load 事件前插入的 script 會延後 load，start() 時已載好
  const selfSrc = document.currentScript && document.currentScript.src;
  if (selfSrc) {
    const s = document.createElement('script');
    s.src = new URL('highlights.js', selfSrc).href;
    document.head.append(s);
  }

  /* ---------- 小工具 ---------- */
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c != null) e.append(c);
    return e;
  }
  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 無法存取 localStorage */ }
  }

  let cfg = null;
  let page = null;   // 本頁的操作，由 start() 設定；不能標記的頁面沒有

  function setup(opts) {
    if (!opts || !opts.course || !opts.course.id) throw new Error('Highlighter.setup 需要 course.id');
    cfg = {
      content: 'main', chapter: null, skip: '', buttonClass: '',
      ...opts,
    };
    cfg.course = { name: opts.course.id, ...opts.course };
    cfg.skip = cfg.skip ? `${cfg.skip}, ${BASE_SKIP}` : BASE_SKIP;
  }

  /* ---------- 匯出與清除全部 ---------- */
  // 收集這門課所有章節的個人標記與對共享標記的修改
  function collect() {
    const id = cfg.course.id;
    const data = { course: id, exported: new Date().toISOString(), personal: {}, overrides: {} };
    const re = new RegExp(`^${id}-hl(-ovr)?:(.+)$`);
    const keys = [];
    let n = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const m = re.exec(k);
        if (!m) continue;
        keys.push(k);
        const v = load(k, null);
        if (m[1] && v && Object.keys(v).length) { data.overrides[m[2]] = v; n += Object.keys(v).length; }
        if (!m[1] && v && v.length) { data.personal[m[2]] = v; n += v.length; }
      }
    } catch (e) { /* 無法存取 localStorage */ }
    return { data, n, keys };
  }

  function exportMarks() {
    const { data, n } = collect();
    if (!n) return 0;
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `${cfg.course.name}-highlights-${data.exported.slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return n;
  }

  // 清除這門課所有章節的個人標記與修改（共享檔本身不受影響）
  function clearCourse() {
    collect().keys.forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* 忽略 */ } });
    location.reload();
  }

  /* ---------- 頁首選單 ---------- */
  // 按兩次才執行的按鈕：第一次把文字換成確認提示
  function confirmButton(text, confirmText, onConfirm) {
    const b = el('button', { type: 'button', class: 'hl-menu-item', text });
    b.addEventListener('click', () => {
      if (b.dataset.armed) { onConfirm(); return; }
      b.dataset.armed = '1';
      b.textContent = confirmText;
    });
    return b;
  }

  // 「🖍 標記」選單：匯出、清除本頁、清除本課程全部
  function menu() {
    const btn = el('button', {
      class: ('hl-menu-btn ' + cfg.buttonClass).trim(), type: 'button', title: '螢光筆標記：匯出或清除',
      'aria-haspopup': 'true', 'aria-expanded': 'false',
    }, ['🖍', el('span', { class: 'hl-lbl', text: ' 標記' })]);
    const box = el('div', { class: 'hl-menu', hidden: '' });
    const wrapEl = el('div', { class: 'hl-menu-wrap' }, [btn, box]);
    const close = () => { box.hidden = true; btn.setAttribute('aria-expanded', 'false'); };

    function open() {
      const total = collect().n;
      const pageN = page ? page.count() : 0;
      const exp = el('button', { type: 'button', class: 'hl-menu-item', text: '⬇ 匯出標記（JSON）' });
      exp.addEventListener('click', () => {
        const n = exportMarks();
        exp.textContent = n ? `✓ 已匯出 ${n} 個` : '沒有標記可以匯出';
      });
      exp.disabled = !total;
      const items = [exp];
      if (page) {
        const p = confirmButton(`清除本頁標記（${pageN}）`, `再按一次清除本頁 ${pageN} 個`, () => { page.clear(); close(); });
        p.disabled = !pageN;
        items.push(p);
      }
      const all = confirmButton(`清除本課程全部標記（${total}）`, `再按一次清除全部 ${total} 個`, clearCourse);
      all.disabled = !total;
      items.push(all, el('p', { class: 'hl-menu-note', text: '標記只存在這個瀏覽器；匯出並寫回 repo 的共享標記不會被清除。' }));
      box.replaceChildren(...items);
      box.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    }

    btn.addEventListener('click', () => { if (box.hidden) open(); else close(); });
    document.addEventListener('mousedown', (ev) => { if (!wrapEl.contains(ev.target)) close(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });
    return wrapEl;
  }

  /* ---------- 標記 ---------- */
  function start() {
    const chapter = cfg.chapter;
    const main = document.querySelector(cfg.content);
    if (!chapter || !main) return;
    const key = `${cfg.course.id}-hl:${chapter}`, ovrKey = `${cfg.course.id}-hl-ovr:${chapter}`;

    const sharedFile = window.HL_SHARED || {};
    if (sharedFile.course && sharedFile.course !== cfg.course.id) {
      console.warn(`highlights.js 是課程「${sharedFile.course}」的，本頁是「${cfg.course.id}」，不載入共享標記`);
    }
    const sharedMarks = sharedFile.course === cfg.course.id ? (sharedFile.marks || {})[chapter] || [] : [];
    const shared = sharedMarks.map((h) => ({ ...h, shared: true }));
    const sharedIds = new Set(shared.map((h) => h.id));
    let ovr = load(ovrKey, {});
    let list = load(key, []);
    // 已經寫進共享檔的個人標記不再重複保存
    const kept = list.filter((h) => !sharedIds.has(h.id));
    if (kept.length !== list.length) { list = kept; save(key, list); }
    // 共享檔已經反映的改色／刪除也不再保存
    let pruned = false;
    for (const [id, c] of Object.entries(ovr)) {
      const h = shared.find((x) => x.id === id);
      if (!h || h.c === c) { delete ovr[id]; pruned = true; }
    }
    if (pruned) save(ovrKey, ovr);
    const persist = () => { save(key, list); save(ovrKey, ovr); };

    // 可標記的文字節點與其在全文中的起點
    function textNodes() {
      const out = [];
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement.closest(cfg.skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      let base = 0;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) { out.push({ n, base }); base += n.length; }
      return out;
    }
    const fullText = (nodes) => nodes.map((x) => x.n.data).join('');

    function rangeToOffsets(range) {
      let s = Infinity, e = -Infinity;
      for (const { n, base } of textNodes()) {
        if (!range.intersectsNode(n)) continue;
        const st = n === range.startContainer ? range.startOffset : 0;
        const en = n === range.endContainer ? range.endOffset : n.length;
        if (en > st) { s = Math.min(s, base + st); e = Math.max(e, base + en); }
      }
      return s < e ? { s, e } : null;
    }

    // 找出標記目前的位置：原位置對得上就用；否則在所有相同文字中挑前後文最像的
    function locate(h, full) {
      if (full.slice(h.s, h.e) === h.text) return h.s;
      const score = (i) => {
        let k = 0;
        const pre = h.pre || '', post = h.post || '';
        while (k < pre.length && full[i - 1 - k] === pre[pre.length - 1 - k]) k++;
        let j = 0;
        while (j < post.length && full[i + h.text.length + j] === post[j]) j++;
        return k + j;
      };
      let best = -1, bestScore = -1;
      for (let i = full.indexOf(h.text); i >= 0; i = full.indexOf(h.text, i + 1)) {
        const sc = score(i);
        if (sc > bestScore) { best = i; bestScore = sc; }
      }
      return best;
    }

    const drawn = new Set();   // 目前畫在頁面上的標記 id
    function wrap(h) {
      const nodes = textNodes();
      const s = locate(h, fullText(nodes));
      if (s < 0) return false;
      const e = s + h.text.length;
      h.s = s; h.e = e;        // 位置可能是靠前後文找回來的，更新成目前的
      const segs = [];
      for (const { n, base } of nodes) {
        const a = Math.max(s, base) - base, b = Math.min(e, base + n.length) - base;
        // 只有空白的片段不包：表格、清單元素之間的空白被包進 <mark> 會破壞版面
        if (b > a && n.data.slice(a, b).trim()) segs.push([n, a, b]);
      }
      for (let [n, a, b] of segs) {
        if (b < n.length) n.splitText(b);
        if (a > 0) n = n.splitText(a);
        const m = el('mark', { class: 'hl-mark', 'data-c': h.c, 'data-id': h.id });
        if (h.shared) m.dataset.shared = '';
        n.replaceWith(m);
        m.append(n);
      }
      if (segs.length) drawn.add(h.id);
      return segs.length > 0;
    }

    function unwrap(id) {
      drawn.delete(id);
      for (const m of $$(`mark.hl-mark[data-id="${id}"]`, main)) {
        const p = m.parentNode;
        m.replaceWith(...m.childNodes);
        p.normalize();
      }
    }
    const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    function makeMark(full, s, e, c) {
      return {
        id: newId(), c, s, e, text: full.slice(s, e),
        pre: full.slice(Math.max(0, s - CTX), s), post: full.slice(e, e + CTX),
      };
    }
    // 把 [s, e) 範圍內的個人標記挖掉：完全在範圍內的刪除，跨出範圍的只留外面那段。
    // 新標記會先挖掉重疊的舊標記，所以同一段文字不會疊好幾層
    function carve(s, e) {
      const full = fullText(textNodes());
      let changed = false;
      const out = [];
      for (const h of list) {
        if (!drawn.has(h.id) || h.e <= s || h.s >= e) { out.push(h); continue; }
        changed = true;
        unwrap(h.id);
        for (const [a, b] of [[h.s, s], [e, h.e]]) {
          if (b > a && full.slice(a, b).trim()) {
            const part = makeMark(full, a, b, h.c);
            if (wrap(part)) out.push(part);
          }
        }
      }
      list = out;
      return changed;
    }
    const overlaps = (s, e) => list.some((h) => drawn.has(h.id) && h.s < e && h.e > s);
    const recolorMarks = (id, c) => $$(`mark.hl-mark[data-id="${id}"]`, main).forEach((m) => { m.dataset.c = c; });

    // 浮動工具列
    const tool = el('div', { class: 'hl-tool', hidden: '' });
    document.body.append(tool);
    tool.addEventListener('mousedown', (ev) => ev.preventDefault());   // 不要讓點按鈕清掉選取
    const hide = () => { tool.hidden = true; };

    function show(rect, items) {
      tool.replaceChildren(...items);
      tool.hidden = false;
      const vw = document.documentElement.clientWidth;
      const w = tool.offsetWidth;
      const x = Math.max(8, Math.min(vw - w - 8, rect.left + rect.width / 2 - w / 2));
      tool.style.left = x + window.scrollX + 'px';
      tool.style.top = rect.bottom + window.scrollY + 8 + 'px';
    }

    const swatch = (c, label, current, onPick) => el('button', {
      type: 'button', class: 'hl-sw' + (c === current ? ' on' : ''), 'data-c': c, title: label, 'aria-label': label,
      text: c === 'r' || c === 'b' ? 'A' : '', onclick: onPick,
    });
    const button = (text, onclick, title) => el('button', { type: 'button', class: 'hl-btn', text, onclick, ...(title ? { title } : {}) });

    function onSelect() {
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const markable = (node) => main.contains(node) && !(node.nodeType === 1 ? node : node.parentElement).closest(cfg.skip);
      if (!markable(range.startContainer) || !markable(range.endContainer)) return;
      const off = rangeToOffsets(range);
      if (!off) return;
      const items = MARKS.map((m) => swatch(m.c, m.label, null, () => {
        const h = makeMark(fullText(textNodes()), off.s, off.e, m.c);
        sel.removeAllRanges();
        carve(off.s, off.e);
        if (wrap(h)) list.push(h);
        persist(); hide();
      }));
      if (overlaps(off.s, off.e)) {
        items.push(button('🧽 清除', () => {
          sel.removeAllRanges();
          carve(off.s, off.e);
          persist(); hide();
        }, '清除選取範圍內的個人標記'));
      }
      show(range.getBoundingClientRect(), items);
    }

    function onMarkClick(mark) {
      const id = mark.dataset.id;
      const h = list.find((x) => x.id === id) || shared.find((x) => x.id === id);
      if (!h) return;
      const current = h.shared && ovr[id] ? ovr[id] : h.c;
      const recolor = (c) => () => {
        if (h.shared) { if (c === h.c) delete ovr[id]; else ovr[id] = c; } else h.c = c;
        persist(); recolorMarks(id, c); hide();
      };
      const items = MARKS.map((m) => swatch(m.c, m.label, current, recolor(m.c)));
      if (h.shared) {
        items.push(button('隱藏', () => { ovr[id] = null; persist(); unwrap(id); hide(); }, '只在這台裝置隱藏；匯出後可從共享檔刪除'));
        items.push(el('span', { class: 'hl-note', text: '共享標記' }));
      } else {
        items.push(button('移除', () => { unwrap(id); list = list.filter((x) => x !== h); persist(); hide(); }));
        const clearAll = button('清除本頁個人標記', () => {
          if (clearAll.dataset.armed) { page.clear(); return; }
          clearAll.dataset.armed = '1';
          clearAll.textContent = `再按一次清除 ${list.length} 個`;
        });
        items.push(clearAll);
      }
      show(mark.getBoundingClientRect(), items);
    }

    document.addEventListener('mouseup', (ev) => { if (!tool.contains(ev.target)) setTimeout(onSelect, 0); });
    document.addEventListener('keyup', (ev) => { if (ev.shiftKey) onSelect(); });
    document.addEventListener('touchend', () => setTimeout(onSelect, 300));
    document.addEventListener('mousedown', (ev) => { if (!tool.contains(ev.target)) hide(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') hide(); });
    main.addEventListener('click', (ev) => {
      const mark = ev.target.closest('mark.hl-mark');
      if (mark && window.getSelection().isCollapsed) onMarkClick(mark);
    });

    // 先畫共享，個人標記疊在上面。找不到的先保留，不刪
    for (const h of shared) {
      if (ovr[h.id] === null) continue;
      if (wrap(h) && ovr[h.id]) recolorMarks(h.id, ovr[h.id]);
    }
    // 依建立順序畫上去，後畫的取代重疊的舊標記（順便整理舊版疊了好幾層的資料）
    const stored = list;
    let tidied = false;
    list = [];
    for (const h of stored) {
      const st = locate(h, fullText(textNodes()));
      if (st >= 0 && carve(st, st + h.text.length)) tidied = true;
      wrap(h);
      list.push(h);
    }
    if (tidied) persist();

    page = {
      count: () => list.length,
      clear: () => { list.forEach((x) => unwrap(x.id)); list = []; persist(); hide(); },
    };
  }

  window.Highlighter = { setup, menu, start, export: exportMarks };
})();
