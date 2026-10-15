/* W1 互動元件 */
(function () {
  'use strict';
  const { $, $$, bindRange } = DM;

  /* ===== 支持度與信賴度 ===== */
  (function rule() {
    const calc = DM.ruleCalc($('#rule-box'), FIM.DATA.basket, ['Beer', 'Diaper'], ['Apple']);
    $$('#w-rule [data-rule]').forEach((b) => {
      b.addEventListener('click', () => {
        const [x, y] = b.dataset.rule.split('|');
        calc.set(x.split(','), y.split(','));
      });
    });
  })();

  /* ===== 升等分類器 ===== */
  (function tenure() {
    const TRAIN = [
      ['Bob', 'Assistant', 2, 'NO'], ['Alice', 'Associate', 8, 'YES'], ['John', 'Professor', 3, 'YES'],
      ['Amy', 'Associate', 9, 'YES'], ['Mike', 'Assistant', 5, 'NO'],
    ];
    const TEST = [
      ['Jessica', 'Associate', 2, 'NO'], ['Kevin', 'Assistant', 15, 'YES'], ['Frank', 'Associate', 3, 'NO'],
      ['Linda', 'Professor', 10, 'YES'], ['Mark', 'Professor', 5, 'YES'],
    ];
    const th = $('#t-th'), pos = $('#t-pos'), yr = $('#t-yr');
    const predict = (p, y) => (p === 'Professor' || y >= Number(th.value) ? 'YES' : 'NO');
    function table(title, rows) {
      let ok = 0;
      let h = `<table><tr><th colspan="5">${title}</th></tr><tr><th>姓名</th><th>職級</th><th class="num">年資</th><th>實際</th><th>預測</th></tr>`;
      for (const [n, p, y, t] of rows) {
        const pr = predict(p, y);
        if (pr === t) ok++;
        h += `<tr><td>${n}</td><td>${p}</td><td class="num">${y}</td><td>${t}</td><td class="${pr === t ? 'ok' : 'no'}">${pr} ${pr === t ? '✓' : '✗'}</td></tr>`;
      }
      return { html: h + '</table>', ok };
    }
    function render() {
      const a = table('訓練資料', TRAIN), b = table('測試資料', TEST);
      $('#t-train').innerHTML = a.html;
      $('#t-test').innerHTML = b.html;
      const p = pos.value, y = Number(yr.value), r = predict(p, y);
      const why = p === 'Professor' ? '職級是 Professor' : y >= Number(th.value) ? `年資 ${y} ≥ ${th.value}` : `不是 Professor，年資 ${y} < ${th.value}`;
      $('#t-out').innerHTML = `<div>規則：Position == Professor 或 YEARS ≥ ${th.value} → YES</div>` +
        `<div>訓練準確率 ${a.ok}/5、測試準確率 ${b.ok}/5${a.ok === 5 && b.ok === 5 ? '（全對）' : ''}</div>` +
        `<div style="margin-top:6px">你輸入的老師（${p}、${y} 年）：<span class="big">${r}</span>　<span class="muted">因為${why}</span></div>`;
    }
    bindRange(th, render);
    bindRange(yr, render);
    pos.addEventListener('change', render);
  })();
})();
