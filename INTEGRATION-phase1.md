# LP ↔ Next.js 統合ガイド（Engineer向け）

## ファイル構成
```
kamo-design/lp-nextjs/
 ├─ kamo-lp.css       — LP専用CSS（brand variables含む、593行）
 └─ lp-page.tsx       — Next.js用Reactコンポーネント（'use client'）
```

## 統合手順

### Option A: LPをNext.jsページとして組み込む（推奨）

1. `kamo-lp.css` → `src/app/(lp)/kamo-lp.css` または `src/styles/kamo-lp.css`
2. `lp-page.tsx` → `src/app/(lp)/page.tsx` または既存の `src/app/page.tsx` を置き換え
3. `import './kamo-lp.css'` のパスを合わせる
4. `/api/events` エンドポイントを追加（イベント一覧をJSONで返す）
   - Supabase接続済み: `events` テーブルから SELECT
   - 未接続: フォールバックの静的データがコンポーネント内に組み込み済み

### Option B: 静的HTMLとして public/ に配置

1. `kamo-design/lp/index.html` → `public/lp.html`
2. Next.jsの `/` にリダイレクト or リンクを配置
3. フォームの `action="/api/apply"` はそのまま動作（Same-origin）
4. ただし event_id の動的取得は不可（静的HTMLのため）

## 変更ポイント（元のHTML → React版）

| 項目 | HTML版 | React版 |
|------|--------|---------|
| `class=` | `class` | `className` |
| `<style>` | `<head>`内 | `import './kamo-lp.css'` |
| フォーム送信 | `setTimeout` モック | `fetch('/api/apply')` 実API呼び出し |
| event_id select | 静的option | `useEffect` で `/api/events` から動的取得 + フォールバック |
| FAQアコーディオン | `onclick` 属性 | `onClick` Reactハンドラ |
| スクロール効果 | `window.addEventListener` | `useEffect` で管理 |
| 完了画面 | なし | `submitted` state で完了画面を表示 |
| エラー処理 | なし | `error` state でエラーメッセージ表示 |

## Engineerが対応が必要なもの

1. **`/api/events` エンドポイント** — `events` テーブルから `id, title, event_date` を返すGET API
   ```typescript
   // src/app/api/events/route.ts
   export async function GET() {
     // Supabase接続時: SELECT id, title, event_date FROM events ORDER BY event_date
     // 未接続時: 空配列を返す（LP側でフォールバック表示）
   }
   ```

2. **グローバルCSSとの競合確認** — `kamo-lp.css` の `:root` 変数と `body` スタイルが
   既存のグローバルCSSと競合する可能性あり。必要に応じてLPセクションをラッパーで囲んでスコープ化。

3. **`<head>` 要素** — React版では `<head>` をコンポーネント内に置いているが、
   Next.jsの `metadata` オブジェクトに移行推奨:
   ```typescript
   import { Metadata } from 'next';
   export const metadata: Metadata = {
     title: 'KAMOファンディング 掲載説明会 | 夢を叶える場所、共犯者を集めよう',
     description: 'KAMOファンディングの無料掲載説明会...',
   };
   ```

## ブランドCSS変数（他ページでも共用可能）

```css
:root {
  --kamo-red: #E60012;
  --kamo-red-dark: #B8000E;
  --kamo-red-light: #FF3333;
  --kamo-gold: #D4A017;
  --kamo-gold-light: #F0C75E;
  --kamo-white: #FFFFFF;
  --kamo-dark: #1A1A1A;
  --kamo-gray: #666666;
  --kamo-light-bg: #FFF5F5;
  --kamo-border: #FFE0E0;
  --font-jp: 'Noto Sans JP', sans-serif;
  --font-en: 'Montserrat', sans-serif;
  --radius: 12px;
  --radius-lg: 24px;
  --shadow: 0 4px 20px rgba(230, 0, 18, 0.1);
  --shadow-lg: 0 8px 40px rgba(230, 0, 18, 0.15);
  --max-width: 1080px;
}
```

これらの変数を `globals.css` に移せば、admin画面・AIツールUI でも共用可能。
