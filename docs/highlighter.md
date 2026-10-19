# 螢光筆功能規格（給其他筆記專案移植用）

這份文件描述「電腦視覺互動式網頁筆記」裡的螢光筆功能：讀者在網頁上畫線、改字體顏色，標記先存在瀏覽器，必要時匯出成 JSON、寫回 repo，變成每台裝置都看得到的共享標記。

功能已抽成獨立檔案，不依賴本專案其他程式，移植時**直接複製，不要重寫**：

| 檔案 | 用途 |
|---|---|
| `assets/highlighter.js` | 全部邏輯，對外只有 `window.Highlighter = { setup, menu, start, export }` |
| `assets/highlighter.css` | 標記顏色 `--mk-*`（淺色／深色）與工具列、選單樣式；介面沿用頁面的 `--surface`、`--border` 等 tokens，沒有時用內建預設值 |
| `assets/highlights.js` | 共享標記資料檔，`window.HL_SHARED = { course, marks }`；新專案從空的開始 |
| `tools/merge-highlights.js` | 把匯出的 JSON 合併進 `highlights.js`（Node） |

本專案的接法見 `assets/common.js`（搜尋 `Highlighter`）。

## 移植步驟

1. 複製上面 4 個檔案，`highlighter.js`、`highlighter.css`、`highlights.js` 放在同一個資料夾（`highlighter.js` 會自動載入同目錄的 `highlights.js`）。
2. 把 `highlights.js` 改成空的，`course` 換成新課程的識別：
   ```js
   window.HL_SHARED = { "course": "ml", "marks": {} };
   ```
3. 每一頁加上樣式與 script，`highlighter.js` 要在呼叫它的程式之前載入：
   ```html
   <link rel="stylesheet" href="assets/highlighter.css">
   <script defer src="assets/highlighter.js"></script>
   <script defer src="assets/<你的主程式>.js"></script>
   ```
4. 在主程式裡設定、放選單、啟動：
   ```js
   Highlighter.setup({
     course: { id: 'ml', name: 'MachineLearning' },   // 必填，id 要和 highlights.js 的 course 相同
     chapter: document.body.dataset.chapter || null,  // 本頁識別；首頁等非筆記頁給 null
     content: 'main',                                 // 可標記的內容區
     skip: '.widget, .katex',                         // 不能標記的區塊（內容會變動的都要列）
     buttonClass: 'icon-btn',                         // 選單按鈕套用頁首按鈕的 class
   });
   header.append(Highlighter.menu());                 // 頁首放「🖍 標記」選單（setup 之後）
   // 公式等內容渲染完成後：
   Highlighter.start();
   ```
5. 依第 9 節驗證清單測試。

## 可以直接貼給 Claude 的 prompt

> 我從 ComputerVision 專案複製了螢光筆的 4 個檔案（`assets/highlighter.js`、`assets/highlighter.css`、`assets/highlights.js`、`tools/merge-highlights.js`）與規格 `docs/highlighter.md`，請依文件的「移植步驟」接到這個筆記網站，**直接使用這些檔案，不要重寫邏輯**。
> 本課程的識別是 `{ id: '<短代號，例如 ml>', name: '<英文名稱，例如 MachineLearning>' }`。
> 內容區塊是 `<選擇器，例如 main>`，章節識別從 `<例如 body[data-chapter]>` 讀取；
> 不能標記的區塊有 `<例如 .widget、公式、按鈕>`。
> 公式由 `<KaTeX auto-render／MathJax／無>` 在 `<時機>` 渲染，`Highlighter.start()` 必須在渲染完成後才呼叫。
> 不是筆記的頁面（例如首頁 `<選擇器或條件>`）`chapter` 給 `null`。
> 特別注意這幾點，都是原專案實際出過的問題：
> 1. 新標記要取代重疊的舊標記，不可以疊層（否則換色後「移除」只拿掉最上層，看起來清不掉）；載入時也要整理舊資料。
> 2. 要有「🧽 清除」與頁首「🖍 標記」選單（匯出、清除本頁、清除本課程全部，清除要按兩次確認），清除功能不能只藏在點標記後的工具列裡。
> 3. localStorage 鍵名與匯出檔名都要帶課程識別，同一個 github.io 網域下的其他課程才不會混在一起。
> 4. 測試時要用真的滑鼠拖曳選取、點按鈕，不能只用程式建立選取範圍。
> 5. 瀏覽器可能快取舊版 HTML，測試看不到新功能時先強制重新載入或在網址加參數。
> 完成後依照文件最後的「驗證清單」逐項測試並回報結果。

以下各節是 `highlighter.js` 的行為規格：要修改功能或除錯時參考，移植時不必重寫。

---

## 1. 功能需求

1. **標記**：在內容區選取文字，選取範圍下方跳出色票，點一下就套用。
   - 5 種樣式：黃底 `y`、綠底 `g`、粉底 `p`、紅字 `r`、藍字 `b`。
   - 選取範圍可以跨過粗體、連結等行內元素。
   - **新標記取代重疊的舊標記，不可以疊層**：完全被蓋住的舊標記刪除，跨出範圍的舊標記只保留範圍外的部分。否則換色後按「移除」只會拿掉最上層，底下的舊顏色又露出來，看起來像清不掉（實際發生過的問題）。
   - 選取範圍和既有個人標記重疊時，色票後面多一個「🧽 清除」，挖掉範圍內的標記（同樣的規則，不影響範圍外的部分）。
2. **修改**：點已經標記的文字，跳出同一排色票（目前顏色有外框）可以換色，另外還有：
   - 個人標記：「移除」、「清除本頁個人標記」（要按兩次，第一次按鈕文字變成「再按一次清除 N 個」，不用 `confirm()`）。
   - 共享標記：「隱藏」，以及「共享標記」小字說明。
3. **保存**：重新整理、關掉瀏覽器後標記還在；不修改任何原始檔。
4. **頁首「🖍 標記」選單**（窄螢幕只顯示 🖍），每次打開時重新計算數量，數量為 0 的項目停用：
   - 「⬇ 匯出標記（JSON）」：下載這門課所有章節的個人標記與對共享標記的修改。
   - 「清除本頁標記（N）」：只在章節頁出現，清除本頁個人標記。
   - 「清除本課程全部標記（N）」：刪除所有 `<course.id>-hl*` 鍵後重新整理；不影響其他課程的鍵與共享檔。
   - 兩個清除都要按兩次（第一次變成紅字「再按一次清除 N 個」）；選單底部說明標記只存在這個瀏覽器。
   - 點選單外或按 Esc 關閉。
5. **共享**：匯出檔交給維護者合併進 repo 的資料檔，部署後每台裝置都看得到。
6. 支援手機寬度與深色模式。

## 2. 儲存位置與鍵名

標記存在 **localStorage**（不是 cookie，也不是 sessionStorage）：關閉瀏覽器仍保留、不會送到伺服器。

| 鍵名 | 內容 |
|---|---|
| `<course.id>-hl:<chapter>` | 個人標記陣列 |
| `<course.id>-hl-ovr:<chapter>` | 對共享標記的修改：`{ id: 顏色 }` 表示改色，`{ id: null }` 表示隱藏 |

注意：

- **localStorage 依網址來源（origin）分開**。`file://`、`http://localhost:8765`、GitHub Pages 是三份互不相通的資料。讀者平常用哪個網址畫線，就要在那個網址匯出。
- **GitHub Pages 的所有專案網站共用同一個 origin**（`<帳號>.github.io`）。多門課的筆記會共用同一個 localStorage，所以鍵名一定要加上課程前綴 `course.id`，匯出時也只撈自己前綴的鍵。
- 所有 localStorage 存取都要包在 `try/catch`，無痕模式或封鎖網站資料時可能會丟出例外。

## 3. 標記的資料格式

```json
{ "id": "mvduxmf8nv4u", "c": "r", "s": 187, "e": 191,
  "text": "電腦視覺", "pre": "件定位、物件偵測、圖像分割，並比較「傳統", "post": "（手動設計特徵）」與「現代電腦視覺（自動" }
```

| 欄位 | 說明 |
|---|---|
| `id` | `Date.now().toString(36)` 加 4 個亂數字元 |
| `c` | 樣式：`y` `g` `p` `r` `b` |
| `s`, `e` | 在「可標記全文」中的起訖位置（見下一節） |
| `text` | 標記的原文 |
| `pre`, `post` | 前後各 20 個字，位置對不上時用來找回正確的那一處 |

共享標記在記憶體中另外加上 `shared: true`，但不寫進檔案。

## 4. 定位演算法

### 4.1 可標記全文

用 `TreeWalker` 走訪內容區所有文字節點，**排除**祖先符合下列選擇器的節點，再把剩下的文字依序串起來，就是「可標記全文」：

```
.widget, .katex, script, style, button, .steps-ctrl, .hl-tool
```

- 互動元件、公式、按鈕裡的文字會隨操作或渲染而變動，所以不能標記，也不算進位置。
- 依各專案調整這份清單：凡是由 JS 動態產生、內容會變的區塊都要排除。
- 被 `hidden` 隱藏的元素（例如尚未展開的解答）仍然要算進位置，讓位置不受展開狀態影響。

### 4.2 選取範圍 → 位置

對每個可標記文字節點，若 `range.intersectsNode(n)`，取交集部分（起點節點用 `startOffset`、終點節點用 `endOffset`），換算成全文位置，取最小起點與最大終點。這樣可以處理起訖點落在元素節點上的情況。

### 4.3 還原時找位置（`locate`）

1. 如果 `全文.slice(s, e) === text`，直接用原位置。
2. 否則找出全文中所有 `text` 出現的位置，為每一處計分：往前比對 `pre`、往後比對 `post`，連續相同的字數相加，取分數最高的一處。
3. 都找不到就不顯示，但**保留資料不刪**（內容可能只是暫時改動，或公式載入失敗）。

### 4.4 包上 `<mark>`

- 先收集所有要包的片段（節點、起點、終點），再一次處理，避免邊走訪邊切割節點。
- 每個片段：`splitText(b)` 切掉後段，`splitText(a)` 取出中段，換成 `<mark class="hl-mark" data-c data-id>`（共享標記多一個 `data-shared`）。
- **跳過只有空白的片段**：表格、清單元素之間的空白文字節點如果被包進 `<mark>`，會破壞 `<table>`／`<ul>` 版面。
- 移除時把同一個 `data-id` 的所有 `<mark>` 拆掉，然後對父元素呼叫 `normalize()`，把切開的文字節點接回去。

### 4.5 取代重疊標記（`carve(s, e)`）

每個已畫上的個人標記都記住目前位置（`wrap()` 成功時把 `s`、`e` 更新成實際位置，並把 id 放進 `drawn` 集合）。`carve(s, e)` 對每個和 `[s, e)` 重疊的個人標記：拆掉它的 `<mark>`，再把 `[h.s, s)` 與 `[e, h.e)` 中非空白的部分建成新標記（新 id、同顏色、重新計算 `text`／`pre`／`post`）畫回去。新增標記時先 `carve` 再 `wrap`；「🧽 清除」只 `carve`。

### 4.6 還原時機與順序

- **一定要在公式渲染完成之後才還原**（本專案是在 `window` 的 `load` 事件裡，先 `renderMath()` 再 `Highlighter.start()`）。渲染前後的全文不同，選取時記下的位置是渲染後的。
- 先畫共享標記（套用 `-hl-ovr` 的改色、跳過隱藏的），再畫個人標記。個人標記會包在共享標記裡面，所以重疊時個人標記的顏色會顯示在上面。
- 個人標記依建立順序一個一個畫，每個都先 `carve` 再 `wrap`，所以後建立的會取代重疊的舊標記。有整理到就寫回 localStorage，順便修好舊版疊了好幾層的資料。
- `setup()` 的 `chapter` 為 `null`（本專案的首頁）時不啟動標記，選單也不出現「清除本頁標記」。

## 5. 浮動工具列

- 一個 `position: absolute` 的 `.hl-tool` 掛在 `body` 上，位置是選取範圍（或被點的 `<mark>`）的 `getBoundingClientRect()` 正下方 8px，加上 `scrollX/scrollY`。
- 水平置中，但要限制在 `8px ~ 視窗寬 − 工具列寬 − 8px`，並設 `max-width: calc(100vw - 16px)`，手機上才不會撐出橫向捲軸。
- 在工具列上 `mousedown` 時 `preventDefault()`，否則點色票會先清掉選取。
- 觸發：`mouseup`（`setTimeout 0` 後檢查選取）、按住 Shift 的 `keyup`、`touchend`（延遲 300ms，等手機選取完成）。
- 關閉：在工具列以外 `mousedown`、按 Esc。
- 點擊 `<mark>`：只在選取範圍是空的（`isCollapsed`）時才開修改工具列，避免和拖曳選取衝突。
- 選取起點或終點落在內容區外、或在不可標記的區塊裡，就不顯示工具列。

## 6. 樣式

全部在 `highlighter.css`。標記色彩用 CSS 變數，淺色與深色各一組；深色同時寫在 `@media (prefers-color-scheme: dark)`（`:root:not([data-theme="light"])`）與 `:root[data-theme="dark"]`，跟隨系統也支援手動切換：

| token | 淺色 | 深色 |
|---|---|---|
| `--mk-y` 黃底 | `#ffe98a` | `#6b5a12` |
| `--mk-g` 綠底 | `#c8f0d2` | `#1f4d30` |
| `--mk-p` 粉底 | `#ffd3e4` | `#5e2741` |
| `--mk-r` 紅字 | `#d1242f` | `#ff8a80` |
| `--mk-b` 藍字 | `#1f5fd1` | `#8ab4ff` |

- `mark.hl-mark` 預設 `color: inherit; background: none;`，蓋掉瀏覽器預設的黃色 `<mark>`；底色樣式設 `background`，字色樣式設 `color` 加 `font-weight: 600`。
- 色票是 28px 圓形按鈕，底色樣式填滿顏色，字色樣式顯示一個彩色的「A」。
- 介面（工具列、按鈕 `.hl-btn`、選單）用 `var(--surface, #fff)` 這種寫法：頁面有定義 `--surface`、`--surface-2`、`--border`、`--text`、`--text-2`、`--accent`、`--accent-soft`、`--neg`、`--radius` 就跟著頁面配色，沒有就用預設值。
- 選單按鈕本身另外套用 `setup()` 的 `buttonClass`，外觀和頁首其他按鈕一致；寬度 480px 以下只顯示 🖍。

## 7. 共享標記與回寫流程

### 7.1 共享資料檔 `assets/highlights.js`

```js
window.HL_SHARED = {
  "course": "cv",
  "marks": {
    "c0": [ {"id":"…","c":"r","s":187,"e":191,"text":"…","pre":"…","post":"…"} ]
  }
};
```

- 用 `.js` 而不是 `.json`：直接用 `file://` 開網頁時，瀏覽器會擋 `fetch()` 讀本機 JSON。
- 由 `highlighter.js` 自動載入，頁面不必另外加：執行時用 `document.currentScript.src` 算出同目錄的 `highlights.js` 網址，建立 `<script>` 加進 `<head>`。在 `load` 事件之前插入的 script 會延後 `load`，所以在 `load` 裡呼叫 `start()` 時資料已經載好。
- `course` 和 `setup()` 的 `course.id` 不同時不載入共享標記，並在 console 警告（避免複製檔案後忘了換）。
- 每章一行一個標記，方便 git diff。

### 7.2 匯出檔

檔名：`<course.name>-highlights-YYYY-MM-DD.json`

```json
{
  "course": "cv",
  "exported": "2026-10-18T13:24:40.005Z",
  "personal":  { "c0": [ …個人標記… ] },
  "overrides": { "c0": { "<共享標記 id>": "b", "<另一個 id>": null } }
}
```

- 只撈 `^<course.id>-hl(-ovr)?:` 的鍵；沒有任何資料時選單項目停用，匯出後項目文字變成「✓ 已匯出 N 個」。
- 用 `Blob` ＋ `URL.createObjectURL` ＋ `<a download>` 下載，之後 `revokeObjectURL`。

### 7.3 合併工具 `tools/merge-highlights.js`

`node tools/merge-highlights.js <匯出檔>`

1. 用 `vm.runInNewContext` 執行 `highlights.js` 取得目前的共享標記。
2. 讀出 `highlights.js` 的 `course`，和匯出檔的 `course` 不同就拒絕合併（避免把別門課的檔案合進來）。
3. `personal`：`id` 不存在才加入，只保留 `id c s e text pre post` 欄位。重複執行不會重複加。
4. `overrides`：`null` 刪除該共享標記，顏色則改色。
5. 重寫 `highlights.js`，印出「新增 N、改色 N、刪除 N；共享標記共 N 個」。

### 7.4 部署後自動清理

頁面載入時：

- 個人標記中 `id` 已經在共享檔裡的，從 localStorage 刪掉（已經「升級」為共享）。
- `-hl-ovr` 中共享檔已經反映的修改（`id` 已不存在，或顏色已相同）也刪掉。

這樣讀者不必手動清除，下次匯出也不會帶出重複資料。

## 8. 已知限制

- 個人標記只存在單一瀏覽器的單一 origin；清除網站資料、無痕視窗、換裝置都看不到。
- 共享標記不是即時同步，要經過「匯出 → 合併 → commit／push → 部署」。即時跨裝置同步需要後端，超出純靜態網站的範圍。
- repo 公開時，共享標記也是公開的。
- 不能標記互動元件、公式、按鈕裡的文字；跨過公式的選取只會標到公式前後的文字。
- 筆記內容大改後，找不到原文的標記不會顯示（資料仍保留）。

## 9. 驗證清單

1. `node --check` 檢查 JS 語法。
2. 用本機伺服器開啟章節頁（例如 `python -m http.server 8765`）。
3. 選取一段跨過粗體的文字標成紅字，確認 `<mark>` 正確、localStorage 有資料；重新整理後仍在。
4. 點標記換色、移除，確認 DOM 與 localStorage 都更新，且父元素的文字節點有接回去。
   - **用真的滑鼠拖曳選取**（不要只用程式建立選取範圍）：選取一段已標記的文字改成另一個顏色，確認沒有巢狀 `<mark>`、localStorage 沒有重複筆數；選取標記的中間按「🧽 清除」，確認標記變成前後兩段。
   - 把疊了好幾層的舊資料放進 localStorage 再重新整理，確認自動整理成不重疊、保留最後一次的顏色。
   - 頁首選單：清除本頁（按兩次）、清除本課程全部（其他課程前綴的鍵要保留）、首頁只有匯出與清除全部。
5. 在含公式的段落標記，重新整理後位置正確，頁面沒有 `.katex-error`。
6. 匯出：可以在測試時暫時覆寫 `HTMLAnchorElement.prototype.click` 攔下下載連結，再 `fetch(a.href)` 讀出 JSON，不必真的下載檔案。確認檔名、`course`、各章資料。
7. 把匯出檔中某個重複字詞的 `s` 故意改錯，合併後確認它仍標在前後文相符的那一處，而不是第一處。
8. 合併兩次，第二次應為「新增 0」；拿 `course` 不同的檔案合併應被拒絕。
9. 合併後重新整理：共享標記出現、重複的個人標記與修改已從 localStorage 清掉；對共享標記改色、隱藏後再匯出、合併，確認共享檔改色與刪除正確。
10. 390px 寬度（可用固定寬度的 `<iframe>` 載入頁面測試），淺色與深色主題都要確認 `document.documentElement.scrollWidth` 不超過視窗寬度，工具列不超出畫面。
11. 測完清掉測試用的 localStorage 鍵，並把 `highlights.js` 的 `marks` 還原成空的 `{}`。
