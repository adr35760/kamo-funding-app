/**
 * 新規セミナーLP（/ai-seminar・/real-seminar）の設定
 *
 * ■ 料金・定員が未確定のため「準備中」表示にしている。
 *   確定したら **このファイルの該当値を書き換えるだけ** で
 *   LP・確認メールの全箇所に反映される（他ファイルの修正は不要）。
 *
 *   例）AIセミナーの参加費が 11,000円、定員20名に確定した場合:
 *     price: { status: 'fixed', label: '11,000円（税込）' }
 *     capacity: { status: 'fixed', label: '20名限定' }
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
  capacity: PendingValue;
  contents: string[];
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
  // ★料金が確定したら status を 'fixed' にして label に金額を入れてください
  price: { status: 'pending' },
  // ★定員が確定したら status を 'fixed' にして label に人数を入れてください
  capacity: { status: 'pending' },
  contents: [
    '夢実現のステップ',
    'AIでページを作成',
    '成功のポイント',
    '鴨頭嘉人よりメッセージ',
    '掲載説明',
  ],
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
  price: { status: 'pending' },
  capacity: { status: 'pending' },
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
