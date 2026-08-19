/**
 * 新規セミナーLP（/ai-seminar・/real-seminar）の設定
 *
 * ■ 料金・定員はすべて確定済み（2026-08-18時点）。
 *   値を変更する場合は **このファイルの該当値を書き換えるだけ** で
 *   LP・確認メールの全箇所に反映される（他ファイルの修正は不要）。
 *   PendingValue の 'pending' は、将来新しい回で未確定値が出た場合の
 *   「準備中」表示用に残してある。
 *
 *
 * ■ 参加費・税表記は確定済み（オンライン9,800円（税込）／リアル19,800円（税込））。
 * ■ 定員: リアルはセミナー20名・懇親会35名で確定。
 *   events.capacity にはセミナー本体の20を入れており、申込上限の判定はこの20が基準。
 *   懇親会の35名は capacityParty として表示専用に持つ。
 *   オンラインの定員も20名で確定済み。
 *
 * ■ 懇親会が別料金かは未確定のため、リアル回は料金の内訳を書かない方針。
 */

export type PendingValue =
  | { status: 'pending'; label?: string }
  | { status: 'fixed'; label: string };

/** 未確定値の表示文字列（LP・メール共通） */
export function pendingLabel(v: PendingValue, fallback = '準備中（決まり次第ご案内します）'): string {
  if (v.status === 'fixed') return v.label;
  return v.label || fallback;
}

/**
 * 価格の税表記が未確定のための注記。
 * 税区分（税込／税別）が確定したら、price の label に反映して
 * この定数を '' にすれば注記は表示されなくなる。
 */
export const PRICE_TAX_NOTE = ''; // 税表記は「税込」で確定したため注記は不要

/**
 * 価格ラベルを「金額」と「補足（税込など）」に分解する。
 * 例: '9,800円（税込）' → { amount: '9,800円', suffix: '税込' }
 * 金額を大きく、税表記を小さく表示するために使う（税表記は必ず残す）。
 */
export function splitPriceLabel(v: PendingValue): { amount: string; suffix?: string } {
  const label = pendingLabel(v);
  const m = label.match(/^(.*?)（(.+?)）\s*$/);
  if (m) return { amount: m[1].trim(), suffix: m[2].trim() };
  return { amount: label };
}

export const ZOOM_NOTE = 'オンライン（Zoom）で開催します。参加URLは開催が近づきましたらメールでご案内します。';

/** 会場情報（リアル回） */
export const REAL_VENUE = {
  seminar: 'エデュケーションギャラリー',
  party: 'YAKINIKUMAFIA',
} as const;

export interface SeminarSession {
  /** 表示用の日付ラベル（例: 10/5（月）） */
  dateLabel: string;
  /** 時間の表示（例: 16:00〜20:00） */
  timeLabel: string;
  /** 懇親会の時間（リアル回のみ） */
  partyTimeLabel?: string;
  /** events.event_date に対応するISO文字列（JST） */
  isoDate: string;
}

/** 詳細プログラムの1ブロック（見出し＋説明文） */
export interface ProgramBlock {
  /** 「第1部」「特別セッション」などのラベル */
  label: string;
  /** 見出し */
  title: string;
  /** 説明文 */
  body: string;
  /** 特別枠として強調表示するか（鴨頭嘉人の登壇など） */
  special?: boolean;
}

export interface SeminarConfig {
  slug: string;
  /** events.pillar（2=オンラインセミナー / 3=リアル懇親会） */
  pillar: 2 | 3;
  title: string;
  /** ページのH1などで使う短いタイトル */
  shortTitle: string;
  lead: string;
  /** 開催形式の表示 */
  format: string;
  price: PendingValue;
  /** 価格に添える補足（例: セミナー＋懇親会込み） */
  priceNote?: string;
  /** 参加費を大きく強調表示するか（申込判断に直結するため） */
  emphasizePrice?: boolean;
  capacity: PendingValue;
  /** 懇親会の定員（リアル回のみ・表示専用。申込上限はセミナー側 capacity が基準） */
  capacityParty?: PendingValue;
  contents: string[];
  /** 詳細プログラム（設定されていれば contents より優先して表示） */
  program?: ProgramBlock[];
  /** プログラム末尾に強調表示する締めの一文 */
  programClosing?: string;
  sessions: SeminarSession[];
  /** 会場（オンラインは null） */
  venue: { seminar: string; party?: string } | null;
}

export const AI_SEMINAR: SeminarConfig = {
  slug: 'ai-seminar',
  pillar: 2,
  title: '【鴨頭嘉人特別参加会】AI時代のクラウドファンディング活用セミナー',
  shortTitle: 'AI時代のクラウドファンディング活用セミナー',
  lead:
    'AIを活用してクラウドファンディングのページを作り、夢を実現するための実践セミナー。鴨頭嘉人が特別参加します。',
  format: 'オンライン開催（Zoom）',
  price: { status: 'fixed', label: '9,800円（税込）' },
  // 参加費を大きく強調（t iku指示・両ページ共通の意匠）
  emphasizePrice: true,
  capacity: { status: 'fixed', label: '20名' },
  contents: [
    '夢実現のステップ',
    'AIでページを作成',
    '成功のポイント',
    '鴨頭嘉人よりメッセージ',
    '掲載説明',
  ],
  program: [
    {
      label: '第1部',
      title: '夢を「応援される企画」に変える',
      body: '実現したいこと、挑戦する理由、届けたい相手を整理し、プロジェクトの中心メッセージを作ります。',
    },
    {
      label: '第2部',
      title: '支援されるプロジェクトの共通点',
      body: '支援を集めるために必要な「共感」「信頼」「ストーリー」の作り方を学びます。',
    },
    {
      label: '第3部',
      title: 'AIでクラファン企画を作る',
      body: 'KAMOファンディングのAIツールを使い、コンセプト、ターゲット、タイトル、企画概要を作成します。',
    },
    {
      label: '第4部',
      title: 'AIで掲載ページを作る',
      body: 'AIでページ構成と文章のたたき台を作り、自分の経験や想いを加えて、心が動く掲載ページへ仕上げます。',
    },
    {
      label: '第5部',
      title: 'リターンと支援戦略',
      body: '応援型、商品・サービス、体験、スポンサーなどのリターンと、公開後の告知計画を設計します。',
    },
    {
      label: '特別セッション',
      title: '鴨頭嘉人',
      body: '「挑戦する人に、共犯者が集まる理由」をテーマに、応援される人の考え方をお伝えします。参加者の企画への公開アドバイスと質疑応答も行います。',
      special: true,
    },
  ],
  programClosing: '4時間後には、あなたのクラウドファンディング企画と掲載ページのたたき台が完成します。',
  sessions: [
    { dateLabel: '10/5（月）', timeLabel: '16:00〜20:00', isoDate: '2026-10-05T16:00:00+09:00' },
    { dateLabel: '11/10（火）', timeLabel: '16:00〜20:00', isoDate: '2026-11-10T16:00:00+09:00' },
  ],
  venue: null,
};

export const REAL_SEMINAR: SeminarConfig = {
  slug: 'real-seminar',
  pillar: 3,
  title: 'リアルセミナー＆懇親会（支援者と繋がる交流会）',
  shortTitle: 'リアルセミナー＆懇親会',
  lead:
    '鴨頭嘉人がリアル登壇。セミナーのあとは懇親会で、あなたの挑戦を応援してくれる支援者と直接つながれます。',
  format: 'リアル開催（セミナー＋懇親会）',
  // セミナー＋懇親会込みの金額（内訳は記載しない方針）
  price: { status: 'fixed', label: '19,800円（税込）' },
  priceNote: 'セミナー＋懇親会込み',
  // 参加費を大きく強調（/ai-seminar と統一意匠）
  emphasizePrice: true,
  capacity: { status: 'fixed', label: 'セミナー 20名' },
  capacityParty: { status: 'fixed', label: '懇親会 35名' },
  contents: [
    '夢実現のステップ',
    'AIでページを作成',
    '成功のポイント',
    '鴨頭嘉人リアル登壇',
    '掲載説明',
    '支援者と繋がる交流会',
  ],
  sessions: [
    {
      dateLabel: '10/25（日）',
      timeLabel: 'セミナー 15:00〜18:30',
      partyTimeLabel: '懇親会 18:30〜20:00',
      isoDate: '2026-10-25T15:00:00+09:00',
    },
    {
      dateLabel: '12/8（火）',
      timeLabel: 'セミナー 15:00〜18:30',
      partyTimeLabel: '懇親会 18:30〜20:00',
      isoDate: '2026-12-08T15:00:00+09:00',
    },
  ],
  venue: { seminar: REAL_VENUE.seminar, party: REAL_VENUE.party },
};

export const SEMINAR_CONFIGS = [AI_SEMINAR, REAL_SEMINAR];
