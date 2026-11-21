/* 期中考重點：單純貝氏計算器、DBSCAN 點類型 */
(function () {
  'use strict';
  const { $, $$, el, fmt, tex, bindRange } = DM;

  /* ===== 單純貝氏 ===== */
  (function nbWidget() {
    const PLAY = [
      ['sunny', 'weak', 'no'], ['sunny', 'strong', 'no'], ['sunny', 'weak', 'yes'], ['rain', 'weak', 'yes'],
      ['rain', 'weak', 'yes'], ['rain', 'strong', 'no'], ['sunny', 'weak', 'no'], ['rain', 'weak', 'yes'],
    ].map((r) => ({ Outlook: r[0], Wind: r[1], Play: r[2] }));
    const SETS = {
      play: { rows: PLAY, attrs: ['Outlook', 'Wind'], target: 'Play', x: { Outlook: 'sunny', Wind: 'weak' } },
      buy: { rows: DT.DATA.buy, attrs: DT.DATA.attrs, target: DT.DATA.target, x: { age: 'youth', income: 'medium', student: 'yes', credit_rating: 'fair' } },
    };
    const dSel = $('#nb-data'), lap = $('#nb-lap'), xBox = $('#nb-x'), out = $('#nb-out');
    let S, x;
    const vals = (rows, a) => [...new Set(rows.map((r) => r[a]))];
    function build() {
      S = SETS[dSel.value]; x = Object.assign({}, S.x);
      xBox.innerHTML = '';
      for (const a of S.attrs) {
        const s = el('select', {}, vals(S.rows, a).map((v) => el('option', { value: v, text: v })));
        s.value = x[a];
        s.addEventListener('change', () => { x[a] = s.value; render(); });
        xBox.append(el('label', {}, [a + ' = ', s]));
      }
      render();
    }
    function render() {
      const cls = vals(S.rows, S.target), N = S.rows.length, L = lap.checked;
      const res = cls.map((c) => {
        const rc = S.rows.filter((r) => r[S.target] === c);
        const terms = S.attrs.map((a) => {
          const k = rc.filter((r) => r[a] === x[a]).length, v = vals(S.rows, a).length;
          return { a, num: k + (L ? 1 : 0), den: rc.length + (L ? v : 0) };
        });
        const p = (rc.length / N) * terms.reduce((s, t) => s * (t.num / t.den), 1);
        return { c, n: rc.length, terms, p };
      });
      const tot = res.reduce((s, r) => s + r.p, 0);
      const best = res.reduce((a, b) => (b.p > a.p ? b : a));
      out.innerHTML = res.map((_, i) => `<div class="nb-f" data-i="${i}"></div>`).join('') +
        `<div style="margin-top:6px">預測 ${S.target} = <span class="big">${best.c}</span>${tot ? `（正規化後 P(${best.c} | X) = ${fmt(best.p / tot, 3)}）` : ''}</div>` +
        `<div class="muted">${res.some((r) => r.p === 0) && !L ? '有類別的乘積是 0：某個條件機率是 0/n。勾「拉普拉斯修正」看看。' : L ? '拉普拉斯修正：每個條件機率的分子 +1、分母 + 該屬性的值數。' : '比大小時不用除以 P(X)；只有要寫出真正的機率時才正規化。'}</div>`;
      $$('.nb-f', out).forEach((d, i) => {
        const r = res[i];
        tex(d, `P(${r.c})\\prod P(x_k \\mid ${r.c}) = \\frac{${r.n}}{${N}} ${r.terms.map((t) => `\\times \\frac{${t.num}}{${t.den}}`).join(' ')} = ${fmt(r.p, 4)}`);
      });
    }
    dSel.addEventListener('change', build);
    lap.addEventListener('change', render);
    build();
  })();

  /* ===== DBSCAN 點類型 ===== */
  (function dbWidget() {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const P = [[1, 1], [1, 2], [2, 1], [2, 2], [3, 2], [4, 2], [7, 6]];
    const eIn = $('#db-e'), mIn = $('#db-m'), svg = $('#db-svg'), out = $('#db-out');
    let pick = 4;
    const W = 420, H = 270, L = 26, R = 10, T = 10, B = 24;
    const X = (v) => L + (v / 8) * (W - L - R), Y = (v) => T + (1 - v / 7) * (H - T - B);
    const unit = (W - L - R) / 8;
    function render() {
      const eps = Number(eIn.value), mp = Number(mIn.value);
      const nb = P.map((p) => P.map((q, j) => j).filter((j) => Math.hypot(p[0] - P[j][0], p[1] - P[j][1]) <= eps + 1e-9));
      const core = nb.map((n) => n.length >= mp);
      const type = P.map((_, i) => (core[i] ? 'core' : nb[i].some((j) => core[j]) ? 'border' : 'noise'));
      let g = `<path class="axis" d="M${L} ${T} V${H - B} H${W - R}"/>`;
      for (let v = 0; v <= 8; v++) g += `<text class="tick" x="${X(v)}" y="${H - B + 12}" text-anchor="middle">${v}</text>`;
      for (let v = 0; v <= 7; v++) g += `<text class="tick" x="${L - 4}" y="${Y(v)}" text-anchor="end">${v}</text>`;
      g += `<circle class="ring" cx="${X(P[pick][0])}" cy="${Y(P[pick][1])}" r="${eps * unit}" style="stroke-dasharray:4 3;opacity:.7"/>`;
      P.forEach((p, i) => {
        const st = type[i] === 'core' ? 'fill:color-mix(in srgb, var(--pos) 35%, var(--surface));stroke:var(--pos)' : type[i] === 'border' ? 'fill:color-mix(in srgb, var(--c-c) 40%, var(--surface));stroke:var(--c-c)' : 'fill:var(--surface);stroke:var(--text-2);stroke-dasharray:2 2';
        g += `<g class="dbp" data-i="${i}" style="cursor:pointer"><circle cx="${X(p[0])}" cy="${Y(p[1])}" r="11" style="${st};stroke-width:1.8"/><text class="lab" x="${X(p[0])}" y="${Y(p[1])}" text-anchor="middle">${names[i]}</text></g>`;
      });
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      $$('g.dbp', svg).forEach((n) => n.addEventListener('click', () => { pick = Number(n.dataset.i); render(); }));
      const i = pick, why = type[i] === 'core'
        ? `鄰域有 ${nb[i].length} 個點 ≥ MinPts ${mp} → 核心點`
        : type[i] === 'border'
          ? `鄰域只有 ${nb[i].length} 個 &lt; ${mp}，但鄰域中的 ${nb[i].filter((j) => core[j]).map((j) => names[j]).join('、')} 是核心點 → 邊界點`
          : `鄰域只有 ${nb[i].length} 個 &lt; ${mp}，鄰域中也沒有核心點 → 雜訊點`;
      out.innerHTML = `<div><strong>${names[i]}</strong> 的 ε 鄰域：{${nb[i].map((j) => names[j]).join(', ')}}；${why}</div>` +
        `<div style="margin-top:4px">核心：${names.filter((_, k) => type[k] === 'core').join('、') || '無'}；邊界：${names.filter((_, k) => type[k] === 'border').join('、') || '無'}；雜訊：${names.filter((_, k) => type[k] === 'noise').join('、') || '無'}</div>`;
    }
    bindRange(eIn, render, (v) => fmt(v, 1));
    bindRange(mIn, render);
  })();
})();
