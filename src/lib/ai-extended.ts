/**
 * 生成結果の追加7項目（t iku指示）のスキーマと**サーバ側の検証・補正**。
 *
 * 1. プロジェクト名称の提案（20文字 × 3案）
 * 2. プロジェクト概要（約400文字）
 * 3. なぜこの企画を始めたのか（約400文字）
 * 4. この企画で何を創出するのか（約400文字）
 * 5. 支援者向け発表会の企画（開催形式・時期・プログラム・支援者特典）
 * 6. 活動歴（年月＋出来事）
 * 7. 費用内訳（項目・金額・割合／合計＝目標金額）
 *
 * LLMは指定文字数を平気で外し、金額の合計も合わないため、
 * **この層で必ず数え直して補正する**。ここを通ったデータだけを画面・PDF・保存に流す。
 * 文字数は日本語なのでコードポイント数（[...str].length）で数える。
 */

/** 名称案の目標文字数（t iku指示: 20文字） */
export const TITLE_PROPOSAL_LENGTH = 20;
/** 概要・なぜ・創出の目標文字数（約400文字） */
export const LONG_TEXT_TARGET = 400;
/** 上記の許容下限。これを下回ったら補正・再生成の対象にする */
export const LONG_TEXT_MIN = 360;
/** 上記の許容上限 */
export const LONG_TEXT_MAX = 460;

export interface AnnouncementEvent {
  /** 開催形式（例: 会場＋オンライン配信のハイブリッド） */
  format: string;
  /** 開催時期（例: 2026年11月下旬） */
  timing: string;
  /** プログラム（進行の流れ） */
  program: string[];
  /** 支援者への特典 */
  supporter_perks: string[];
}

export interface ActivityHistoryItem {
  /** 年月（例: 2024年4月） */
  date: string;
  /** 出来事 */
  event: string;
}

export interface CostBreakdownItem {
  /** 費目 */
  item: string;
  /** 金額（円） */
  amount: number;
  /** 目標金額に対する割合（%） */
  ratio: number;
}

/** 生成結果の追加7項目 */
export interface ProjectExtended {
  /** 1. プロジェクト名称の提案（20文字 × 3案） */
  title_proposals: string[];
  /** 2. プロジェクト概要（約400文字） */
  overview: string;
  /** 3. なぜこの企画を始めたのか（約400文字） */
  why_started: string;
  /** 4. この企画で何を創出するのか（約400文字） */
  what_creates: string;
  /** 5. 支援者向け発表会の企画 */
  announcement_event: AnnouncementEvent;
  /** 6. 活動歴 */
  activity_history: ActivityHistoryItem[];
  /** 7. 費用内訳（合計＝目標金額） */
  cost_breakdown: CostBreakdownItem[];
}

/** 日本語を正しく数えるための文字数（コードポイント数） */
export function charLength(s: string): number {
  return toChars(s).length;
}

/** コードポイント配列化（tsconfig の target に依存しないよう Array.from を使う） */
function toChars(s: string): string[] {
  return Array.from(String(s ?? ''));
}

/** コードポイント単位の切り出し（サロゲートペアを壊さない） */
function sliceChars(s: string, n: number): string {
  return toChars(s).slice(0, n).join('');
}

/**
 * 名称案を「20文字ぴったり」に整える。
 * 長い場合は20文字で切り、短い場合は文脈語（タイトル由来のキーワード）で埋める。
 * 埋め草は日本語として読める語尾に限定し、記号での水増しはしない。
 */
export function adjustTitleProposal(raw: string, context: { title?: string; industry?: string }): string {
  const s = String(raw ?? '').replace(/\s+/g, '').replace(/[「」『』【】]/g, '');
  if (charLength(s) === TITLE_PROPOSAL_LENGTH) return s;
  if (charLength(s) > TITLE_PROPOSAL_LENGTH) return sliceChars(s, TITLE_PROPOSAL_LENGTH);

  // 短い場合は「日本語として自然な接尾語」だけで20文字ぴったりに揃える。
  // 端数を1文字ずつ埋めると「〜プロジェクト飲」のような不自然な語尾になるため、
  // 不足文字数と長さがちょうど一致する接尾語の組み合わせを探す。
  const need = TITLE_PROPOSAL_LENGTH - charLength(s);
  const suffix = buildSuffix(need);
  if (suffix !== null) return s + suffix;

  // 不足分を接尾語で作れない場合は、前置きを付けて長さを稼いでから切る
  // （語尾が崩れるよりは、頭に自然な語を足して20文字で切るほうが読める）
  const prefixed = `${context.industry ?? ''}${context.industry ? 'の' : ''}${s}`;
  if (charLength(prefixed) >= TITLE_PROPOSAL_LENGTH) return sliceChars(prefixed, TITLE_PROPOSAL_LENGTH);
  const need2 = TITLE_PROPOSAL_LENGTH - charLength(prefixed);
  const suffix2 = buildSuffix(need2);
  if (suffix2 !== null) return prefixed + suffix2;

  // 最後の手段: 定型語で埋めて20文字で切る
  return sliceChars(`${prefixed}応援プロジェクトにご支援をお願いします`, TITLE_PROPOSAL_LENGTH);
}

/**
 * 指定文字数ぴったりの接尾語を組み立てる。作れない場合は null。
 * 語の並びが日本語として読める順（修飾語 → 名詞 → 述語）になるよう候補を並べている。
 */
function buildSuffix(need: number): string | null {
  if (need <= 0) return null;
  // 名詞句（1つまで）と述語句（1つまで）。名詞句を2つ重ねると
  // 「〜プロジェクトクラファン挑戦」のような不自然な語尾になるため分けている。
  const nouns = [
    'プロジェクト',     // 6
    '応援プロジェクト', // 8
    '実現プロジェクト', // 8
    '挑戦プロジェクト', // 8
    '応援企画',         // 4
    '計画',             // 2
  ];
  const tails = [
    'を成功させたい', // 7
    'をはじめます',   // 6
    'にご支援を',     // 5
    'への挑戦',       // 4
    'に挑戦',         // 3
    '始動',           // 2
  ];

  const exact = [...nouns, ...tails].find(w => charLength(w) === need);
  if (exact) return exact;

  for (const n of nouns) {
    for (const t of tails) {
      if (charLength(n) + charLength(t) === need) return n + t;
    }
  }
  return null;
}

/**
 * 400文字級の本文を許容範囲に収める。
 * 長すぎる場合は文末（。）で切り詰め、短すぎる場合は補助テキストから文を足す。
 * それでも下限に届かない場合は呼び出し側が再生成を判断できるよう、結果と併せて判定できる。
 */
export function adjustLongText(raw: string, supplements: string[]): string {
  let s = String(raw ?? '').replace(/\r/g, '').trim();

  // 長すぎ: 文末で切る（句点が見つからなければ単純切り）
  if (charLength(s) > LONG_TEXT_MAX) {
    const cut = sliceChars(s, LONG_TEXT_MAX);
    const lastPeriod = cut.lastIndexOf('。');
    s = lastPeriod >= Math.floor(LONG_TEXT_MIN * 0.8) ? cut.slice(0, lastPeriod + 1) : cut;
    return s;
  }

  // 短すぎ: 補助テキストの文を足して下限を超えさせる（重複文は足さない）
  if (charLength(s) < LONG_TEXT_MIN) {
    for (const sup of supplements) {
      if (charLength(s) >= LONG_TEXT_MIN) break;
      const sentences = String(sup ?? '')
        .split(/(?<=。)/)
        .map(t => t.trim())
        .filter(Boolean);
      for (const sent of sentences) {
        if (charLength(s) >= LONG_TEXT_MIN) break;
        if (s.includes(sent)) continue;
        s = s ? `${s}\n${sent}` : sent;
      }
    }
    // 重複文だけで下限に届かない場合は、補助テキストを丸ごと足して下限を超えさせる。
    // 材料が尽きたらそこで止める（同じ文を機械的に繰り返して字数を稼がない）。
    if (charLength(s) < LONG_TEXT_MIN) {
      for (const sup of supplements) {
        if (charLength(s) >= LONG_TEXT_MIN) break;
        const add = String(sup ?? '').trim();
        if (!add || s.includes(add)) continue;
        s = s ? `${s}\n${add}` : add;
      }
    }
    if (charLength(s) > LONG_TEXT_MAX) return adjustLongText(s, []);
  }
  return s;
}

/** 本文が許容範囲（下限以上）に収まっているか */
export function isLongTextOk(s: string): boolean {
  const n = charLength(s);
  return n >= LONG_TEXT_MIN && n <= LONG_TEXT_MAX;
}

/**
 * 費用内訳を「合計＝目標金額」になるよう補正し、割合を再計算する。
 *
 * LLMの金額はほぼ合わないので、比率を保ったまま100円単位にスケールし、
 * 端数はいちばん大きい費目に寄せて必ず一致させる。
 */
export function normalizeCostBreakdown(
  items: Array<Partial<CostBreakdownItem>> | undefined,
  goalAmount: number
): CostBreakdownItem[] {
  const goal = Math.max(0, Math.round(Number(goalAmount) || 0));
  const src = (items ?? [])
    .map(it => ({
      item: String(it?.item ?? '').trim(),
      amount: Math.max(0, Math.round(Number(it?.amount) || 0)),
    }))
    .filter(it => it.item);

  if (goal === 0 || src.length === 0) return [];

  const sum = src.reduce((a, b) => a + b.amount, 0);
  // 金額が全部0（LLMが埋めなかった）場合は均等割り
  const weights = sum > 0 ? src.map(s => s.amount / sum) : src.map(() => 1 / src.length);

  // 100円単位にスケール
  const scaled = weights.map(w => Math.round((goal * w) / 100) * 100);
  let diff = goal - scaled.reduce((a, b) => a + b, 0);

  // 端数は最大の費目に寄せる（負の値が出ないよう保護）
  let maxIdx = 0;
  scaled.forEach((v, i) => { if (v > scaled[maxIdx]) maxIdx = i; });
  scaled[maxIdx] += diff;
  if (scaled[maxIdx] < 0) {
    // 極端なケース: 一旦0にして残差を再配分
    diff = scaled[maxIdx];
    scaled[maxIdx] = 0;
    for (let i = 0; i < scaled.length && diff < 0; i++) {
      if (i === maxIdx) continue;
      const take = Math.min(scaled[i], -diff);
      scaled[i] -= take;
      diff += take;
    }
  }

  return src.map((s, i) => ({
    item: s.item,
    amount: scaled[i],
    // 割合は補正後の金額から再計算する（表示と金額が食い違わないように）
    ratio: Math.round((scaled[i] / goal) * 1000) / 10,
  }));
}

/** 費用内訳の検算結果（報告・テスト用） */
export function verifyCostBreakdown(items: CostBreakdownItem[], goalAmount: number) {
  const total = items.reduce((a, b) => a + b.amount, 0);
  const ratioTotal = Math.round(items.reduce((a, b) => a + b.ratio, 0) * 10) / 10;
  return { total, goalAmount, matches: total === Math.round(goalAmount), ratioTotal };
}

/**
 * 追加7項目をまとめて検証・補正する。
 * 欠けている項目はフォールバック（既存ストーリー等から作った内容）で埋め、
 * 画面・PDF・JSONのどこかが空になる事故を防ぐ。
 */
export function normalizeExtended(
  raw: Partial<ProjectExtended> | undefined,
  ctx: {
    goalAmount: number;
    title?: string;
    industry?: string;
    /** 文字数が足りないときの補助テキスト（ストーリー本文など） */
    supplements: string[];
    /** 項目が丸ごと欠けていたときの代替 */
    fallback: ProjectExtended;
  }
): ProjectExtended {
  const fb = ctx.fallback;

  // 1. 名称案（必ず3案・各20文字）
  const proposalsRaw = Array.isArray(raw?.title_proposals) ? raw!.title_proposals.filter(Boolean) : [];
  const proposals: string[] = [];
  for (let i = 0; i < 3; i++) {
    const cand = proposalsRaw[i] ?? fb.title_proposals[i] ?? fb.title_proposals[0] ?? ctx.title ?? '';
    proposals.push(adjustTitleProposal(String(cand), { title: ctx.title, industry: ctx.industry }));
  }

  // 2-4. 400文字級の本文
  const overview = adjustLongText(raw?.overview || fb.overview, [fb.overview, ...ctx.supplements]);
  const whyStarted = adjustLongText(raw?.why_started || fb.why_started, [fb.why_started, ...ctx.supplements]);
  const whatCreates = adjustLongText(raw?.what_creates || fb.what_creates, [fb.what_creates, ...ctx.supplements]);

  // 5. 発表会の企画
  const ev = raw?.announcement_event;
  const announcement: AnnouncementEvent = {
    format: String(ev?.format || fb.announcement_event.format),
    timing: String(ev?.timing || fb.announcement_event.timing),
    program: (Array.isArray(ev?.program) ? ev!.program.map(String).filter(Boolean) : []).length
      ? ev!.program!.map(String).filter(Boolean)
      : fb.announcement_event.program,
    supporter_perks: (Array.isArray(ev?.supporter_perks) ? ev!.supporter_perks.map(String).filter(Boolean) : []).length
      ? ev!.supporter_perks!.map(String).filter(Boolean)
      : fb.announcement_event.supporter_perks,
  };

  // 6. 活動歴
  const historyRaw = Array.isArray(raw?.activity_history) ? raw!.activity_history : [];
  const history = historyRaw
    .map(h => ({ date: String(h?.date ?? '').trim(), event: String(h?.event ?? '').trim() }))
    .filter(h => h.date && h.event);
  const activityHistory = history.length > 0 ? history : fb.activity_history;

  // 7. 費用内訳（合計＝目標金額）
  let cost = normalizeCostBreakdown(raw?.cost_breakdown, ctx.goalAmount);
  if (cost.length === 0) cost = normalizeCostBreakdown(fb.cost_breakdown, ctx.goalAmount);

  return {
    title_proposals: proposals,
    overview,
    why_started: whyStarted,
    what_creates: whatCreates,
    announcement_event: announcement,
    activity_history: activityHistory,
    cost_breakdown: cost,
  };
}

/**
 * ヒアリングで入力された活動履歴（自由記述）を年月＋出来事の配列に整形する。
 * 「2019年4月 個人事業として開業 / 2021年6月 法人化」のようにスラッシュ区切り・
 * 改行区切りのどちらでも受ける。年月が読み取れない行は出来事のみとして残す。
 */
export function parseActivityHistory(raw: string | undefined): ActivityHistoryItem[] {
  const text = String(raw ?? '').trim();
  if (!text) return [];
  // 区切りは改行・「/」「|」「・」。ただし「2021/6」のような年月表記の
  // スラッシュで割ってしまわないよう、数字に挟まれた「/」は区切りにしない。
  const lines = text
    .replace(/((?:19|20)\d{2})\s*\/\s*(\d{1,2})/g, '$1年$2月')
    .split(/[\n\r]+|\s*[/｜|]\s*|\s*・\s*/)
    .map(t => t.trim())
    .filter(Boolean);

  const items: ActivityHistoryItem[] = [];
  for (const line of lines) {
    // 先頭の年月表記を拾う（2019年4月 / 2019/4 / 2019-04 / 2019年）
    const m = line.match(/^((?:19|20)\d{2})\s*[年\/\-.]\s*(\d{1,2})?\s*月?\s*[:：]?\s*/);
    if (m) {
      const date = m[2] ? `${m[1]}年${Number(m[2])}月` : `${m[1]}年`;
      const event = line.slice(m[0].length).trim();
      items.push({ date, event: event || '（記載なし）' });
    } else {
      items.push({ date: '', event: line });
    }
  }
  return items.filter(i => i.event);
}

/** JSONコピー用の日本語キー（t ikuがそのまま読める形） */
export function extendedToJapaneseJSON(ext: ProjectExtended, goalAmount: number) {
  return {
    'プロジェクト名称の提案': ext.title_proposals.map((t, i) => ({
      案: `案${i + 1}`,
      名称: t,
      文字数: charLength(t),
    })),
    'プロジェクト概要': ext.overview,
    'なぜこの企画を始めたのか': ext.why_started,
    'この企画で何を創出するのか': ext.what_creates,
    '支援者向け発表会の企画': {
      開催形式: ext.announcement_event.format,
      開催時期: ext.announcement_event.timing,
      プログラム: ext.announcement_event.program,
      支援者特典: ext.announcement_event.supporter_perks,
    },
    活動歴: ext.activity_history.map(h => ({ 年月: h.date, 出来事: h.event })),
    費用内訳: {
      明細: ext.cost_breakdown.map(c => ({ 費目: c.item, 金額: c.amount, 割合: `${c.ratio}%` })),
      合計: ext.cost_breakdown.reduce((a, b) => a + b.amount, 0),
      目標金額: goalAmount,
    },
  };
}
