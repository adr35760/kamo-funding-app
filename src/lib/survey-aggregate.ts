/**
 * アンケート集計の純粋関数（DBにもNext.jsにも依存しない＝テストしやすい）。
 *
 * 🔴 方針: 「読めなかった」と「0件」は必ず区別する。
 *   このモジュールは受け取った配列だけを集計する。**エラーは呼び出し側で扱う**
 *   （error を空配列に変換して渡すと、集計画面が嘘の0を断定する）。
 */

export interface SurveyResponseRow {
  id: string;
  event_id: string | null;
  satisfaction: number;
  clarity: number;
  listing_intent: string;
  wants_meeting: boolean;
  wants_seminar: boolean;
  interested_advisor: boolean;
  comment: string | null;
  name: string | null;
  email: string | null;
  created_at: string;
}

export interface Distribution {
  key: string;
  label: string;
  count: number;
  /** 棒グラフの幅（％）。呼び出し側で使う */
  percent: number;
}

export interface SurveySummary {
  total: number;
  satisfactionAvg: number | null;
  clarityAvg: number | null;
  satisfactionDist: Distribution[];
  clarityDist: Distribution[];
  listingIntentDist: Distribution[];
  wantsMeetingDist: Distribution[];
  wantsSeminarDist: Distribution[];
  interestedAdvisorDist: Distribution[];
  /** 個別ミーティング希望者（新しい順） */
  meetingRequests: SurveyResponseRow[];
}

export const LISTING_INTENT_LABELS: Record<string, string> = {
  yes: 'はい',
  considering: '検討中',
  no: 'いいえ',
};

/** 設問のラベル（表示・CSVで共有） */
export const SURVEY_QUESTION_LABELS = {
  satisfaction: '本日の説明会の満足度',
  clarity: '説明は分かりやすかったか',
  listing_intent: '掲載を検討したいか',
  wants_meeting: '生島との個別ミーティングを希望するか',
  wants_seminar: 'オンライン・リアルセミナーは参加したいですか？',
  interested_advisor: 'クラファンのアドバイザー及び紹介報酬制度は興味ありますか？',
} as const;

function dist(keys: string[], labels: Record<string, string>, counts: Map<string, number>): Distribution[] {
  const total = keys.reduce((s, k) => s + (counts.get(k) ?? 0), 0);
  return keys.map((k) => {
    const count = counts.get(k) ?? 0;
    return {
      key: k,
      label: labels[k] ?? k,
      count,
      percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    };
  });
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
}

function countBy<T>(rows: T[], key: (r: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export function summarizeSurvey(rows: SurveyResponseRow[]): SurveySummary {
  const scaleKeys = ['1', '2', '3', '4', '5'];
  const scaleLabels = { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' };
  const yesNoKeys = ['yes', 'no'];
  const yesNoLabels = { yes: 'はい', no: 'いいえ' };

  const meetingRequests = rows
    .filter((r) => r.wants_meeting)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return {
    total: rows.length,
    satisfactionAvg: avg(rows.map((r) => Number(r.satisfaction))),
    clarityAvg: avg(rows.map((r) => Number(r.clarity))),
    satisfactionDist: dist(scaleKeys, scaleLabels, countBy(rows, (r) => String(r.satisfaction))),
    clarityDist: dist(scaleKeys, scaleLabels, countBy(rows, (r) => String(r.clarity))),
    listingIntentDist: dist(['yes', 'considering', 'no'], LISTING_INTENT_LABELS, countBy(rows, (r) => r.listing_intent)),
    wantsMeetingDist: dist(yesNoKeys, yesNoLabels, countBy(rows, (r) => (r.wants_meeting ? 'yes' : 'no'))),
    wantsSeminarDist: dist(yesNoKeys, yesNoLabels, countBy(rows, (r) => (r.wants_seminar ? 'yes' : 'no'))),
    interestedAdvisorDist: dist(yesNoKeys, yesNoLabels, countBy(rows, (r) => (r.interested_advisor ? 'yes' : 'no'))),
    meetingRequests,
  };
}

/** JSTの「YYYY/MM/DD HH:mm」表記 */
export function formatJstDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * 回答のCSVを作る（Excelで開けるようBOM付き・全セル引用）。
 * @param eventTitles event_id → 説明会タイトルの対応
 */
export function buildSurveyCsv(
  rows: SurveyResponseRow[],
  eventTitles: Map<string, string>
): string {
  const header = [
    '回答日時（JST）',
    '対象の説明会',
    SURVEY_QUESTION_LABELS.satisfaction,
    SURVEY_QUESTION_LABELS.clarity,
    SURVEY_QUESTION_LABELS.listing_intent,
    SURVEY_QUESTION_LABELS.wants_meeting,
    SURVEY_QUESTION_LABELS.wants_seminar,
    SURVEY_QUESTION_LABELS.interested_advisor,
    'お名前',
    'メールアドレス',
    'ご意見・ご感想',
  ];
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push(
      [
        formatJstDateTime(r.created_at),
        r.event_id ? eventTitles.get(r.event_id) ?? '' : '',
        r.satisfaction,
        r.clarity,
        LISTING_INTENT_LABELS[r.listing_intent] ?? r.listing_intent,
        r.wants_meeting ? 'はい' : 'いいえ',
        r.wants_seminar ? 'はい' : 'いいえ',
        r.interested_advisor ? 'はい' : 'いいえ',
        r.name ?? '',
        r.email ?? '',
        r.comment ?? '',
      ]
        .map(csvCell)
        .join(',')
    );
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
