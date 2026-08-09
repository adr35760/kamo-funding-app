# Pillar 4 LP ↔ Next.js 統合ガイド（Engineer向け）

## ファイル構成
```
pillar4-nextjs/
 ├─ partner-session.css         — 説明会LP用CSS
 ├─ partner-session-page.tsx    — 説明会LP Reactコンポーネント
 ├─ partner-register.css        — パートナー登録LP用CSS
 ├─ partner-register-page.tsx   — パートナー登録LP Reactコンポーネント
 ├─ supporter-register.css      — サポーター登録LP用CSS
 ├─ supporter-register-page.tsx — サポーター登録LP Reactコンポーネント
 └─ INTEGRATION.md              — このファイル
```

## 統合手順

### ルート構成（推奨）
```
src/app/
 ├─ (pillar4)/
 │   ├─ partner-session/page.tsx   → partner-session-page.tsx
 │   ├─ partners/page.tsx          → partner-register-page.tsx
 │   └─ supporters/page.tsx        → supporter-register-page.tsx
```

### CSS配置
各CSSファイルを対応するページコンポーネントと同じディレクトリ、または `src/styles/` に配置:
```
src/styles/
 ├─ partner-session.css
 ├─ partner-register.css
 └─ supporter-register.css
```
各コンポーネントの `import` パスを調整してください。

## APIエンドポイント（Engineer実装済み）

| コンポーネント | action先 | 状況 |
|---------------|----------|------|
| partner-session-page.tsx | `/api/apply-partner-session` | ✅ Engineer実装済み |
| partner-register-page.tsx | `/api/register-partner` | ✅ Engineer実装済み |
| supporter-register-page.tsx | `/api/register-supporter` | ✅ Engineer実装済み |

## フィールドマッピング（Engineer確認済み）

### 説明会LP → partner_session_registrations
| LP form name | DB カラム | 備考 |
|-------------|-----------|------|
| name | name | ✅ |
| email | email | ✅ UNIQUE |
| company | company | ✅ |
| profession | profession | ✅ |
| program_interest | program_interest | ✅ |
| event_id | event_id | ✅ FK→events |
| message | message | ✅ |

### パートナー登録LP → partners
| LP form name | DB カラム | 備考 |
|-------------|-----------|------|
| name | name | ✅ |
| email | email | ✅ UNIQUE |
| phone | phone | ✅ |
| company | organization | ✅ |
| network | network_description | ✅ |
| source | message | ✅ 参加経路 |

### サポーター登録LP → partners
| LP form name | DB カラム | 備考 |
|-------------|-----------|------|
| name | name | ✅ |
| email | email | ✅ UNIQUE |
| phone | phone | ✅ |
| company | organization | ✅ |
| support_type | support_preference | ✅ |
| session_attended | registered_event_id | ✅ FK→events |
| sns | sns | ✅ |
| message | supporter_motivation + message | ✅ |

## プレースホルダー（PM指示#3対応）

以下の項目は t iku さん確認待ちのため、LP上にプレースホルダーを表示:
- 紹介パートナー紹介料: 「¥30,000〜50,000 ※金額は調整中・詳細はお問い合わせください」
- アドバイザー報酬率: 「10〜15% ※報酬率・受講料は調整中・詳細はお問い合わせください」
- サポーター報酬: 「成果報酬 ※報酬詳細は調整中・お問い合わせください」

確定次第、該当箇所を更新してください。

## 3プログラムカラーシステム

| プログラム | アクセント色 | HEX | CSS変数（共用化推奨） |
|-----------|------------|-----|---------------------|
| 紹介パートナー | 緑 | #27AE60 | --partner-green |
| 認定アドバイザー | KAMO Red | #E60012 | --kamo-red（既存） |
| サポーター | KAMO Gold | #D4A017 | --kamo-gold（既存） |

globals.css に `--partner-green: #27AE60;` を追加すれば全UIで共用可能。
