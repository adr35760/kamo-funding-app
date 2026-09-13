/**
 * 生成結果の追加7項目（t iku指示）のスキーマと**サーバ側の検証・補正**。
 *
 * 1. プロジェクト名称の提案（23文字 × 3案・必ず「したい！」で締める）
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

/** 名称案の目標文字数（t iku指示 2026-09-13: 20文字 → 23文字） */
export const TITLE_PROPOSAL_LENGTH = 23;

/**
 * 名称案の必須の締め（t iku指示 2026-09-13）。
 *
 * 🔴 **長すぎて切る経路で最初に落ちるのがここ**。23文字で機械的に切ると
 *   末尾の「したい！」が消えて仕様を満たさなくなる。adjustTitleProposal() では
 *   **本体を 23−4=19 文字に収めてから付け直す**順序で組み立てている。
 */
export const TITLE_PROPOSAL_SUFFIX = 'したい！';
/** 本体（接尾語を除いた部分）に使える文字数 */
const TITLE_BODY_LENGTH = TITLE_PROPOSAL_LENGTH - Array.from(TITLE_PROPOSAL_SUFFIX).length;
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
  /** 1. プロジェクト名称の提案（23文字 × 3案・必ず「したい！」で終わる） */
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
 * 名称案を「23文字ぴったり・必ず『したい！』で終わる」形に整える。
 *
 * 🔴 実装の順序が仕様の核心:
 *   1. 既にある「したい！」「したい」などの締めを一度**剥がす**（二重化を防ぐ）
 *   2. 本体を **19文字以内**に収める（長ければここで切る）
 *   3. 最後に必ず `したい！` を付ける
 *   先に23文字で切ってから締めを足そうとすると、切った時点で締めが落ちる。
 *   「切った後に必ず付け直す」ため、本体の長さで管理している。
 */
export function adjustTitleProposal(raw: string, context: { title?: string; industry?: string }): string {
  // 🔴 最終ゲート: どの分岐を通っても「23文字ちょうど・したい！終わり」を保証する。
  //   trimBodyTail() で1〜2文字短くなる経路があるため、出口で必ず数え直す。
  return finalizeTitle(buildTitleCandidate(raw, context));
}

/**
 * 出口の保証。本体を19文字に合わせ直してから締めを付ける。
 *
 * 🔴 ここが「切った後に必ず付け直す」の最終担保。どの分岐を通っても
 *   この関数を通るので、23文字ちょうど・`したい！` 終わりが崩れない。
 *   長い場合は cutBody() で**語の区切りに寄せて**切る（単語の途中で
 *   切れた語尾が残ると「〜デリバリ飲したい！」のように壊れる）。
 */
function finalizeTitle(candidate: string): string {
  const body = stripTitleTail(candidate);
  const len = charLength(body);
  if (len === TITLE_BODY_LENGTH) return body + TITLE_PROPOSAL_SUFFIX;
  if (len > TITLE_BODY_LENGTH) {
    return trimBodyTail(cutBody(body, TITLE_BODY_LENGTH)) + TITLE_PROPOSAL_SUFFIX;
  }
  // 不足分は「途中で切っても読める定型フレーズ」だけで埋める。
  // 文脈語（業種・タイトル）を足すと単語の途中で切れて語尾が崩れるため使わない。
  const padded = sliceChars(`${body}をみんなの力で地域に広げて形に`, TITLE_BODY_LENGTH);
  return trimBodyTail(padded) + TITLE_PROPOSAL_SUFFIX;
}

function buildTitleCandidate(raw: string, context: { title?: string; industry?: string }): string {
  const body = stripTitleTail(String(raw ?? '').replace(/\s+/g, '').replace(/[「」『』【】]/g, ''));
  const len = charLength(body);

  // ちょうど収まる場合はそのまま締めを付ける
  if (len === TITLE_BODY_LENGTH) return body + TITLE_PROPOSAL_SUFFIX;

  // 長い場合: **本体を19文字に切ってから**締めを付け直す。
  // 助詞（を・に・へ・で）終わりは「〜をしたい！」と自然に繋がるので触らない。
  // 読点や開き括弧で終わったときだけ削る。
  if (len > TITLE_BODY_LENGTH) {
    return trimBodyTail(cutBody(body, TITLE_BODY_LENGTH)) + TITLE_PROPOSAL_SUFFIX;
  }

  // 短い場合: 「したい！」で終わる接尾語のうち、不足分とちょうど一致するものを使う。
  // 本体が読点や中黒で終わっていると「〜挑戦、をみんなで」と崩れるので先に整える。
  const clean = trimBodyTail(body);
  const endsWithParticle = /[をにでへとがはのも]$/.test(clean);
  const suffix = buildSuffix(TITLE_PROPOSAL_LENGTH - charLength(clean), endsWithParticle);
  if (suffix !== null) return clean + suffix;

  // 接尾語で埋められない場合は、頭に業種を足して長さを稼いでから同じ手順をもう一度
  const prefixed = `${context.industry ?? ''}${context.industry ? 'の' : ''}${clean}`;
  if (charLength(prefixed) >= TITLE_BODY_LENGTH) {
    return trimBodyTail(cutBody(prefixed, TITLE_BODY_LENGTH)) + TITLE_PROPOSAL_SUFFIX;
  }
  const suffix2 = buildSuffix(
    TITLE_PROPOSAL_LENGTH - charLength(prefixed),
    /[をにでへとがはのも]$/.test(prefixed)
  );
  if (suffix2 !== null) return prefixed + suffix2;

  // 最後の手段: 定型語で19文字まで埋めてから締めを付ける（ここでも順序は同じ）
  const padded = sliceChars(`${prefixed}応援プロジェクトを地域のみんなと一緒に`, TITLE_BODY_LENGTH);
  return trimBodyTail(padded) + TITLE_PROPOSAL_SUFFIX;
}

/**
 * 既存の願望表現の締めを剥がす。
 *
 * 🔴 LLMは「〜を彩りたい」「〜に変わりたい」のように**「したい」以外の
 *   願望形**で返してくる。これを剥がさずに接尾語を足すと
 *   「〜彩りたい計画したい！」「〜変わりたいにしたい！」と二重になる。
 *   そのため「したい」だけでなく **動詞＋たい／たいです** を落とす。
 *   ただし「〜みたい」「〜だいたい」のような語は願望ではないので除外する。
 */
function stripTitleTail(s: string): string {
  let t = s.replace(/[。．!！?？]+$/, '');
  // 「〜したいです」「〜たいです」→ です を落としてから「たい」を処理
  t = t.replace(/です$/, '');
  // 願望の「たい」を1回だけ落とす。直前が「み」「だい」等の場合は願望ではない
  const m = t.match(/^(.*?)(たい)$/);
  if (m && m[1].length > 0 && !/[みだべみ]$/.test(m[1])) {
    t = m[1];
    // 「〜し」「〜きた」などの活用語尾が残るので、サ変の「し」だけ落とす
    t = t.replace(/し$/, '');
  }
  return t.replace(/[。．!！?？]+$/, '');
}

/**
 * 本体の末尾が「したい！」に繋がらない文字（読点・開き括弧・中黒・伸ばし棒）で
 * 終わっている場合だけ削る。助詞終わりは自然に繋がるので触らない。
 */
function trimBodyTail(s: string): string {
  return s.replace(/[、，,・（(〜ー-]+$/, '');
}

/**
 * 本体を上限文字数に切る。
 *
 * 🔴 単純な切り捨てだと「〜新しいデリバリ」のように**単語の途中**で切れる。
 *   上限の手前3文字までの範囲に助詞・読点があればそこで切り、
 *   語の区切りに寄せてから締めを付ける（見出しとして読める形を優先）。
 */
function cutBody(s: string, limit: number): string {
  const cut = sliceChars(s, limit);
  const chars = toChars(cut);
  // 語の区切りを探す幅。狭すぎると「デリバリ」のように単語の途中で切れたままになる。
  for (let back = 0; back <= 6 && chars.length - back > 0; back++) {
    const i = chars.length - 1 - back;
    if ('をにでへとがはのも、，,・'.includes(chars[i])) {
      // 助詞はそのまま残すと「〜をしたい！」と繋がる。読点類は落とす。
      const end = '、，,・'.includes(chars[i]) ? i : i + 1;
      const piece = chars.slice(0, end).join('');
      if (charLength(piece) >= Math.floor(limit * 0.6)) return piece;
    }
  }
  return cut;
}

/**
 * 指定文字数ぴったりの接尾語を組み立てる。作れない場合は null。
 *
 * 🔴 **すべての候補が `したい！` で終わる**こと（t iku指示 2026-09-13）。
 *   旧テーブル（`を成功させたい` `をはじめます` `にご支援を` `への挑戦` `に挑戦` `始動`）は
 *   「したい！」で終わらないものが大半で、そのまま使うと仕様を満たせないため作り替えた。
 *   名詞句（0〜8文字）× 述語句（4〜14文字・すべて「したい！」終わり）の組み合わせで
 *   4〜22文字の不足を埋められるようにしている。
 */
function buildSuffix(need: number, bodyEndsWithParticle = false): string | null {
  // 締めの4文字より短い不足は接尾語では作れない（呼び出し側が本体を切る）
  if (need < charLength(TITLE_PROPOSAL_SUFFIX)) return null;

  // 名詞句（省略可・1つまで）。2つ重ねると不自然な語尾になる。
  const nouns = [
    '',                 // 0
    '計画',             // 2
    '応援企画',         // 4
    'プロジェクト',     // 6
    '応援プロジェクト', // 8
    '実現プロジェクト', // 8
    '挑戦プロジェクト', // 8
  ];
  // 述語句。**必ず「したい！」で終わる**。
  const tails = [
    'したい！',                     // 4
    'にしたい！',                   // 5
    'を実現したい！',               // 7
    'に挑戦したい！',               // 7
    'を応援したい！',               // 7
    'をカタチにしたい！',           // 9
    'を必ず実現したい！',           // 9
    'を一緒に実現したい！',         // 10
    'をみんなで実現したい！',       // 11
    'を地域のみんなと実現したい！', // 14
  ];

  // 🔴 本体が助詞（を・に・で…）で終わっているとき、助詞で始まる述語句を足すと
  //   「〜元気にをカタチにしたい！」のように助詞が二重になる。
  //   その場合は助詞で始まらない候補（名詞句を挟むか、述語句のみ）を優先する。
  const startsWithParticle = (w: string) => /^[をにでへとがはのも]/.test(w);
  const ordered = bodyEndsWithParticle
    ? [...tails.filter(t => !startsWithParticle(t)), ...tails.filter(startsWithParticle)]
    : tails;

  for (const n of nouns) {
    for (const t of ordered) {
      // 名詞句を挟めば助詞の二重は起きない（n が空のときだけ順序が効く）
      if (charLength(n) + charLength(t) === need) {
        if (bodyEndsWithParticle && n === '' && startsWithParticle(t)) continue;
        return n + t;
      }
    }
  }
  // 助詞回避で作れなかった場合は、長さ優先でもう一度探す（23文字は必ず守る）
  if (bodyEndsWithParticle) {
    for (const n of nouns) {
      for (const t of tails) {
        if (charLength(n) + charLength(t) === need) return n + t;
      }
    }
  }
  return null;
}

/**
 * 400文字級の本文を仕上げる。
 *
 * 方針（PM決定 2026-08-30）:
 *   **短い場合に他テキストを連結して字数を稼ぐことはしない。**
 *   継ぎ接ぎの400字より、自然な360字のほうが原稿として良い。
 *   不足時は呼び出し側が「1回だけ再生成」で対応し、それでも足りなければ短いまま出す。
 *
 * ここでやるのは次の2つだけ:
 *   1. 長すぎる場合に**文末（句点）で**切り詰める
 *   2. 「言いかけで途切れた文」を落として、必ず句点で終わる形にする
 */
export function adjustLongText(raw: string): string {
  let s = String(raw ?? '').replace(/\r/g, '').trim();
  if (!s) return '';

  // 長すぎ: 文の途中で切らないよう、句点の位置で切る。
  // 上限内の最後の句点で切ると大幅に短くなる場合は、上限を少し超えてでも
  // 次の句点まで含める（文章として自然な長さを優先する）。
  if (charLength(s) > LONG_TEXT_MAX) {
    const cut = sliceChars(s, LONG_TEXT_MAX);
    const inside = lastSentenceEnd(cut);
    if (inside > 0 && charLength(cut.slice(0, inside)) >= LONG_TEXT_MIN) {
      s = cut.slice(0, inside);
    } else {
      // 上限内に十分な長さの文末が無い場合は、上限を越えた直後の句点までで切る
      const extended = sliceChars(s, LONG_TEXT_MAX + 120);
      const after = firstSentenceEndAfter(extended, charLength(cut));
      s = after > 0 ? extended.slice(0, after) : (inside > 0 ? cut.slice(0, inside) : cut);
    }
  }

  return trimIncompleteTail(s);
}

/** from 文字目以降で最初に現れる文末記号の直後の位置。無ければ -1 */
function firstSentenceEndAfter(s: string, from: number): number {
  const chars = toChars(s);
  for (let i = Math.max(0, from - 1); i < chars.length; i++) {
    if ('。！？'.includes(chars[i])) return i + 1;
  }
  return -1;
}

/** 文末記号（。！？）の直後の位置を返す。無ければ -1 */
function lastSentenceEnd(s: string): number {
  let idx = -1;
  for (const mark of ['。', '！', '？', '.']) {
    const i = s.lastIndexOf(mark);
    if (i > idx) idx = i;
  }
  return idx >= 0 ? idx + 1 : -1;
}

/**
 * 末尾が句点で終わっていない（生成がトークン上限などで途切れた）場合、
 * 最後の完全な文までで打ち切る。「三つの価値です。第一に、〜」のように
 * **言いかけで終わった文が原稿に残らない**ようにするための担保。
 */
export function trimIncompleteTail(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/[。！？]$/.test(s)) return s;
  const end = lastSentenceEnd(s);
  // 完全な文が1つも無い場合は、切ると空になるのでそのまま返す（呼び出し側が再生成を判断する）
  if (end <= 0) return s;
  return s.slice(0, end).trim();
}

/**
 * 「◯つの」と列挙を宣言したのに項目が足りない、末尾が句点でない等、
 * 文章として破綻しているかを判定する。true なら再生成の対象。
 */
export function isTruncatedText(raw: string): boolean {
  const s = String(raw ?? '').trim();
  if (!s) return true;
  // 末尾が句点等で終わっていない = 途中で切れている
  if (!/[。！？]$/.test(s)) return true;

  // 「三つの価値」と宣言したのに「第三に」が無い等の言いかけを検出する
  const numerals: Record<string, number> = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
    '１': 1, '２': 2, '３': 3, '４': 4, '５': 5, '６': 6,
  };
  const declare = s.match(/([一二三四五六1-6１-６])\s*[つ点]の/);
  if (declare) {
    const expected = numerals[declare[1]];
    const ordinals = ['第一', '第二', '第三', '第四', '第五', '第六'];
    const found = ordinals.filter(o => s.includes(o)).length;
    // 序数を使って列挙し始めている場合のみ、宣言数に届いているかを見る
    if (found > 0 && expected && found < expected) return true;
  }
  return false;
}

/**
 * LLM本文とフォールバック文から、原稿として出せるものを選ぶ。
 * - 破綻している（言いかけ・空）本文は採用しない
 * - 短いだけなら**そのまま採用**する（360字の自然な文 ＞ 400字の継ぎ接ぎ）
 */
function pickLongText(raw: string | undefined, fallback: string): string {
  const candidate = adjustLongText(String(raw ?? ''));
  if (candidate && !isTruncatedText(candidate)) return candidate;
  // LLM本文が破綻している場合のみ、フォールバック文（ヒアリングから組んだ完全な文章）に差し替える
  return adjustLongText(fallback);
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

  // 割合は補正後の金額から再計算する（表示と金額が食い違わないように）。
  // 小数第1位に丸めると合計が 100.0% からずれるため、
  // 端数は最大の費目に寄せて**割合の合計も必ず 100.0%** にする。
  const ratios = scaled.map(v => Math.round((v / goal) * 1000) / 10);
  const ratioDiff = Math.round((100 - ratios.reduce((a, b) => a + b, 0)) * 10) / 10;
  if (ratioDiff !== 0) ratios[maxIdx] = Math.round((ratios[maxIdx] + ratioDiff) * 10) / 10;

  return src.map((s, i) => ({
    item: s.item,
    amount: scaled[i],
    ratio: ratios[i],
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
    /**
     * @deprecated 連結による字数稼ぎは廃止したため使用しない。
     * 呼び出し側の互換のため受け取るだけ。
     */
    supplements?: string[];
    /** 項目が丸ごと欠けていたときの代替 */
    fallback: ProjectExtended;
  }
): ProjectExtended {
  const fb = ctx.fallback;

  // 1. 名称案（必ず3案・各23文字・全案「したい！」終わり）
  const proposalsRaw = Array.isArray(raw?.title_proposals) ? raw!.title_proposals.filter(Boolean) : [];
  const proposals: string[] = [];
  for (let i = 0; i < 3; i++) {
    const cand = proposalsRaw[i] ?? fb.title_proposals[i] ?? fb.title_proposals[0] ?? ctx.title ?? '';
    proposals.push(adjustTitleProposal(String(cand), { title: ctx.title, industry: ctx.industry }));
  }

  // 2-4. 400文字級の本文
  // 2-4. 400文字級の本文。
  // 足りない場合に他テキストを連結して字数を稼ぐことはしない（継ぎ接ぎ防止）。
  // 破綻している場合のみ、丸ごとフォールバック文に差し替える。
  const overview = pickLongText(raw?.overview, fb.overview);
  const whyStarted = pickLongText(raw?.why_started, fb.why_started);
  const whatCreates = pickLongText(raw?.what_creates, fb.what_creates);

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
