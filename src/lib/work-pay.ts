/**
 * 固定給・インセンティブの制度定義（t iku 指示 2026-10-19／対象は小川のみ）
 *
 * 🔴 ここが制度の唯一の定義。金額・料率を変えるときはこのファイルだけ直す。
 *   タスクには作成時点の単価をコピーして保存するので、
 *   あとから料率を変えても過去の実績金額は書き換わらない。
 */

/** 固定給 75,000円／月平均65時間（週15時間） */
export const FIXED_MONTHLY_YEN = 75_000;
export const FIXED_MONTHLY_MINUTES = 65 * 60;
export const FIXED_WEEKLY_MINUTES = 15 * 60;

/** 固定給に含まれる7業務（①〜⑦）と月間目安 */
export interface FixedItem {
  code: string;
  no: string;
  name: string;
  detail: string;
  monthlyMinutes: number;
}

export const FIXED_ITEMS: FixedItem[] = [
  { code: 'inq', no: '①', name: '問い合わせ一次対応', detail: '起案希望者・支援者からの問い合わせ受付、定型回答、担当者への引継ぎ', monthlyMinutes: 12 * 60 },
  { code: 'progress', no: '②', name: '掲載案件の進捗管理', detail: '公開日・終了日・必要書類・進捗状況の確認、管理表更新', monthlyMinutes: 12 * 60 },
  { code: 'contact', no: '③', name: '起案者への事務連絡', detail: '必要資料の依頼、締切連絡、手続き案内', monthlyMinutes: 10 * 60 },
  { code: 'admin_ops', no: '④', name: 'プラットフォーム事務処理', detail: '掲載情報の確認、管理画面更新、定型的な事務作業', monthlyMinutes: 12 * 60 },
  { code: 'internal', no: '⑤', name: '社内連絡・業務報告', detail: 'Chatwork報告、タスク管理、定例ミーティング', monthlyMinutes: 8 * 60 },
  { code: 'support', no: '⑥', name: '運営補助・資料整理', detail: '既存資料の整理、定型書類作成、簡単な集計', monthlyMinutes: 6 * 60 },
  { code: 'reserve', no: '⑦', name: '予備対応時間', detail: '通常業務の範囲内で発生する軽微な対応', monthlyMinutes: 5 * 60 },
];

/** インセンティブ対象業務と報酬 */
export interface IncentiveRate {
  code: string;
  category: string;
  name: string;
  /** per_unit: 1件あたり単価 / percent: 売上・手数料に対する料率 */
  kind: 'per_unit' | 'percent';
  value: number;
  unitLabel: string;
}

export const INCENTIVE_RATES: IncentiveRate[] = [
  { code: 'thumb', category: '制作', name: 'サムネイル制作', kind: 'per_unit', value: 3_000, unitLabel: '1枚' },
  { code: 'page_build', category: '制作', name: 'クラファンページ構成・制作', kind: 'per_unit', value: 10_000, unitLabel: '1案件' },
  { code: 'banner', category: '制作', name: '告知画像・バナー制作', kind: 'per_unit', value: 2_000, unitLabel: '1枚' },
  { code: 'sns_copy', category: '制作', name: 'SNS告知文章作成', kind: 'per_unit', value: 2_000, unitLabel: '1案件' },
  { code: 'consult60', category: '相談', name: '起案者向け有料相談（60分）', kind: 'per_unit', value: 3_000, unitLabel: '1回' },
  { code: 'plan_design', category: '相談', name: 'クラファン企画・リターン設計', kind: 'per_unit', value: 5_000, unitLabel: '1案件' },
  { code: 'mc_online', category: 'イベント', name: 'オンラインイベント司会', kind: 'per_unit', value: 10_000, unitLabel: '1回' },
  { code: 'mc_real', category: 'イベント', name: 'リアルイベント司会', kind: 'per_unit', value: 20_000, unitLabel: '1回' },
  { code: 'event_plan', category: 'イベント', name: 'イベント企画・進行台本作成', kind: 'per_unit', value: 10_000, unitLabel: '1案件' },
  { code: 'sales_consult', category: '営業', name: '法人・個人コンサル成約', kind: 'percent', value: 10, unitLabel: '税抜売上' },
  { code: 'sales_jimukyoku', category: '営業', name: '事務局サービス成約', kind: 'percent', value: 10, unitLabel: '税抜売上' },
  { code: 'sales_pf_new', category: '営業', name: 'PF新規案件獲得', kind: 'percent', value: 10, unitLabel: 'PF税抜手数料' },
  { code: 'referral_pf', category: '紹介', name: 'PF案件紹介のみ', kind: 'percent', value: 5, unitLabel: 'PF税抜手数料' },
];

export const findFixedItem = (code: string | null | undefined) =>
  FIXED_ITEMS.find(i => i.code === code) ?? null;
export const findIncentiveRate = (code: string | null | undefined) =>
  INCENTIVE_RATES.find(r => r.code === code) ?? null;

export interface PayableTask {
  work_kind?: string | null;
  incentive_code?: string | null;
  unit_rate?: number | null;
  unit_count?: number | null;
  rate_percent?: number | string | null;
  sales_base?: number | null;
  actual_minutes?: number | null;
  estimated_minutes?: number | null;
}

/** そのタスクの成果報酬（円）。per_unit は単価×数量、percent は売上×料率 */
export function incentiveYen(t: PayableTask): number {
  const rate = findIncentiveRate(t.incentive_code);
  const percent = t.rate_percent != null ? Number(t.rate_percent) : rate?.kind === 'percent' ? rate.value : null;
  if (percent != null && !Number.isNaN(percent)) {
    return Math.floor(((t.sales_base ?? 0) * percent) / 100);
  }
  const unit = t.unit_rate ?? (rate?.kind === 'per_unit' ? rate.value : 0);
  const count = t.unit_count ?? 1;
  return (unit ?? 0) * (count || 0);
}

/** そのタスクで実際に使った時間（分）。実績が無ければ想定で代用 */
export function workedMinutes(t: PayableTask): number {
  return t.actual_minutes ?? t.estimated_minutes ?? 0;
}

/** 税抜の売上・手数料から報酬を出す（%案件の見積り用） */
export function percentYen(salesBase: number, code: string): number {
  const r = findIncentiveRate(code);
  if (!r || r.kind !== 'percent') return 0;
  return Math.floor((salesBase * r.value) / 100);
}

/** 分を「12時間30分」形式に */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}時間${m}分`;
  if (h) return `${h}時間`;
  return `${m}分`;
}

export const formatYen = (yen: number) => `${yen.toLocaleString('ja-JP')}円`;
