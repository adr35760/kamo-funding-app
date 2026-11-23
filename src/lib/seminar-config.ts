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
 * ■ 参加費・税表記は確定済み（オンライン9,800円（税込）／リアル22,000円（税込））。
 *   リアルは2026-09-09に19,800円→25,000円、2026-11-22に25,000円→22,000円へ改定
 *   （t iku確定）。参加区分が2つあり、どちらも同額（REAL_ATTEND_TIERS を参照）。
 *   🔴 金額は REAL_SEMINAR.price / AI_SEMINAR.price の1箇所だけを直す。
 * ■ 定員: リアルはセミナー20名・懇親会40名で確定（2026-09-10 t iku回答: 懇親会は40名入る）。
 *   events.capacity にはセミナー本体の20を入れており、申込上限の判定はこの20が基準。
 *   懇親会の40名は capacityParty として表示専用に持つ。
 *   オンラインの定員も20名で確定済み。
 *
 * ■ 懇親会が別料金かは未確定のため、リアル回は料金の内訳を書かない方針。
 */
import { NUM_JISSEKI_KAMO } from './seminar-info-content';
import {
  SUPPORTED_PROJECTS_LABEL,
  TOTAL_RAISED_LABEL,
  ACHIEVEMENT_RATE_LABEL,
  STATS_DEFINITION,
  STATS_PERIOD_NOTE,
} from './site-stats';


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

/**
 * 会場情報（リアル回）。
 *
 * 🔴 2026-11-22 t iku確定: **懇親会もセミナーと同会場（エデュケーションギャラリー）**。
 *   以前は懇親会だけ別会場だったため party を分けて持っていたが、いまは同じ建物の中で
 *   続けて行う。将来また分かれた場合は party に別名を入れれば、
 *   ページ・メールは「会場を移す」前提の表示に自動で戻る（描画側で同名判定をしている）。
 */
export const REAL_VENUE = {
  seminar: 'エデュケーションギャラリー',
  party: 'エデュケーションギャラリー',
} as const;

export interface SeminarSession {
  /** 表示用の日付ラベル（例: 10/5（月）） */
  dateLabel: string;
  /** 時間の表示（例: 16:00〜20:00） */
  timeLabel: string;
  /** 受付時刻（リアル回のみ・A区分にのみ出す。交流会のみの方には無関係） */
  receptionTimeLabel?: string;
  /** 懇親会の時間（リアル回のみ） */
  partyTimeLabel?: string;
  /** events.event_date に対応するISO文字列（JST） */
  isoDate: string;
  /**
   * 「第N回」の回次。**実施した回数の通し番号**であり、配列の並び順とは独立。
   *
   * 中止・削除された回があっても残りの回が繰り上がらないよう、明示的に持たせる。
   * （例: 10/25 第1回が中止になっても 12/8 は「第2回」のまま）
   * DBの events.title に含まれる「第N回」と必ず一致させること。
   * 未指定なら配列インデックス+1にフォールバックする。
   */
  round?: number;
}

/**
 * 当日のタイムテーブルの1コマ（リアル回のみ・2026-11-22 t iku案）。
 *
 * 🔴 ここは「当日の流れが分かる粒度」に留める。各パートの狙いを長文で説明しない
 *    （詳細プログラムは上の program / CORE_PROGRAM が担う）。
 */
export interface TimetableRow {
  /** 時刻の表示（例: 16:00〜16:10） */
  time: string;
  /** 所要時間の表示（例: 10分） */
  minutes?: string;
  /** コマの見出し */
  title: string;
  /** 何をするかの1行説明 */
  body: string;
}

/** タイムテーブル1本（セミナー150分／懇親会120分） */
export interface Timetable {
  /** 見出しの上に出す小さなラベル（例: セミナー 150分） */
  kicker?: string;
  /** 見出し */
  heading: string;
  /** 見出し下の1行リード */
  lead?: string;
  rows: TimetableRow[];
  /** 合計時間の表示（例: セミナー合計 150分） */
  totalLabel?: string;
  /** 表の下に置く注記（不確実な約束は書かない） */
  note?: string;
}

/** 詳細プログラムの1ブロック（見出し＋説明文） */
export interface ProgramBlock {
  /**
   * 「第1部」「特別セッション」「懇親会」などのラベル。
   * 表示はこの値をそのまま使う（配列の並び順から採番しない）。
   * 第1部〜第5部のあとに懇親会などが続いても「第6部」に化けないようにするため。
   */
  label: string;
  /** 見出し */
  title: string;
  /** 説明文 */
  body: string;
  /** 特別枠として強調表示するか（鴨頭嘉人の登壇など） */
  special?: boolean;
  /** 懇親会など、セミナー本編の後に続く枠。金の枠線で本編と区別する */
  party?: boolean;
}

/** 講師紹介の1名分 */
export interface Speaker {
  /** 役割・肩書き（例: メイン講師） */
  role: string;
  /** お名前 */
  name: string;
  /** 写真のパス（4:3に統一済み） */
  image: string;
  /** 肩書（役割ラベル・お名前とは別の3段目） */
  title?: string;
  /**
   * プロフィール本文。
   *
   * 🔴 未提供のあいだは **undefined のままにする**（推測で経歴を書かない）。
   *   t iku から原稿が届いたら coreSpeakers() の該当者に文字列を入れるだけで、
   *   /ai-seminar・/real-seminar の両方に同時に出る。
   *   改行は \n で区切ると段落として表示される。
   */
  profile?: string;
  /** 特別枠として強調するか（鴨頭嘉人など） */
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
  /**
   * 当日のタイムテーブル（リアル回のみ）。
   * 🔴 未設定ならセクションごと描画しない（/ai-seminar は持たない）。
   */
  timetables?: Timetable[];
  /** 講師紹介（プロフィール文は未提供のため役割＋お名前のみ） */
  speakers?: Speaker[];
  sessions: SeminarSession[];
  /** 会場（オンラインは null） */
  venue: { seminar: string; party?: string } | null;

  /* ------------------------------------------------------------------
   * ここから下は「LPの訴求ブロック」— すべて**オプション**。
   *
   * 🔴 /ai-seminar と共用のコンポーネント（SeminarLanding）を壊さないため、
   *   未設定なら**そのセクション自体を描画しない**。
   *   リアル回（/real-seminar）だけが値を持つ。
   * ------------------------------------------------------------------ */

  /**
   * ページ最上部（ヒーローより上）に置く告知バナー。
   * 🔴 装飾ではなく告知なので、必ず alt を付け、リンクは張らない（ページ内の告知）。
   *    画像全体が見えるよう width:100% / height:auto で表示する。
   *    未設定なら要素ごと描画しない（/ai-seminar は未設定）。
   */
  topBanner?: { src: string; alt: string; width: number; height: number };
  /**
   * セクション見出しの上の英字小見出し（リアル回のみ）。
   * 「英字の小見出し＋和文の大見出し＋金の細い罫線」で見出しを統一するための飾り。
   * 未設定のキーは何も出さない（/ai-seminar は undefined のまま）。
   */
  eyebrows?: {
    values?: string;
    program?: string;
    timetable?: string;
    community?: string;
    speakers?: string;
    schedule?: string;
    included?: string;
    audience?: string;
    closing?: string;
    apply?: string;
  };
  /** ヒーロー最上部の小さなタグライン（例: A × B × C）。未設定なら出さない */
  heroTagline?: string;
  /** ヒーローのH1。未設定なら title をH1にする（/ai-seminar はこちら） */
  heroCatch?: string;
  /** ヒーローの主CTAラベル。未設定なら「申し込む →」 */
  ctaLabel?: string;
  /**
   * ヒーローに出す実績。数値は site-stats.ts の定数から取る（直書きしない）。
   * 931%等の旧値・独自集計はここに入れない。
   */
  heroStats?: { value: string; label: string; note?: string }[];
  /** 実績の注記（集計期間・合算範囲・93.7%の対象）。site-stats の定義文を使う */
  heroStatNote?: string;
  /** 3大価値などのカード群 */
  valueProps?: {
    heading: string;
    lead?: string;
    items: { title: string; body: string }[];
  };
  /**
   * 「成功者から直接話を聞ける機会」セクション（今回の差別化）。
   * paragraphs → punch（強調1文）→ after（締め）の順に描画する。
   */
  community?: {
    eyebrow?: string;
    heading: string;
    paragraphs: string[];
    punch: string;
    after?: string;
  };
  /**
   * 参加費に含まれるものの整理。区分ごとの可否（seminar / party）を持たせ、
   * 価格の直前に「何が含まれるか」を並べる。
   * 🔴 可否は REAL_ATTEND_TIERS の区分（セミナーから参加／交流会から参加）に対応する。
   */
  valueTable?: {
    heading: string;
    lead?: string;
    rows: { label: string; body: string; seminar: boolean; party: boolean }[];
    /** 「これらを1日で体験できます」など価格直前の締め */
    closing: string;
  };
  /** 対象者別のメッセージ */
  audience?: {
    heading: string;
    lead?: string;
    items: { label: string; body: string }[];
  };
  /** ページ末尾のクロージング（見出し＋本文＋強調1文） */
  closing?: {
    heading: string;
    paragraphs: string[];
    punch: string;
  };
}

/**
 * セミナー本編のプログラム（第1部〜第5部）。
 *
 * 🔴 **オンライン（/ai-seminar）とリアル（/real-seminar）で共通の唯一の情報源**。
 *   同じ文章を2か所に書くと片方だけ直して必ずズレるため、ここだけを編集する。
 *   両ページ固有の項目（鴨頭嘉人の登壇形態・懇親会など）は、
 *   各 config 側でこの配列に足す形にしてある。
 */
export const CORE_PROGRAM: ProgramBlock[] = [
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
];

/**
 * 登壇者3名。
 *
 * 🔴 **両ページ共通の唯一の情報源**（CORE_PROGRAM と同じ方針）。
 *   プロフィール文は未提供のため、役割＋お名前＋肩書のみ（勝手に作らない）。
 *
 * @param kamogashiraRole 鴨頭嘉人の役割ラベル。リアル回は会場に実際に立つので
 *        「特別登壇（リアル登壇）」と出し分ける。他2名は共通。
 */
export function coreSpeakers(kamogashiraRole = '特別登壇'): Speaker[] {
  return [
    {
      role: 'メイン講師',
      name: '生島 正',
      title: `KAMOファンディング単独で累計支援総額${NUM_JISSEKI_KAMO}のクラファン支援の専門家`,
      image: '/speaker-ikushima.jpg',
    },
    { role: 'AI導入講師', name: '堺 彬', title: 'AI導入の専門家', image: '/speaker-sakai.jpg' },
    {
      role: kamogashiraRole,
      name: '鴨頭嘉人',
      title: 'YouTube講演家',
      image: '/speaker-kamogashira.jpg',
      special: true,
    },
  ];
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
    // 第1部〜第5部は CORE_PROGRAM（リアル回と共通）
    ...CORE_PROGRAM,
    {
      label: '特別セッション',
      title: '鴨頭嘉人',
      body: '「挑戦する人に、共犯者が集まる理由」をテーマに、応援される人の考え方をお伝えします。参加者の企画への公開アドバイスと質疑応答も行います。',
      special: true,
    },
  ],
  programClosing: '4時間後には、あなたのクラウドファンディング企画と掲載ページのたたき台が完成します。',
  // 登壇者はリアル回と共通（coreSpeakers が唯一の情報源）
  speakers: coreSpeakers(),
  sessions: [
    { round: 1, dateLabel: '10/5（月）', timeLabel: '16:00〜20:00', isoDate: '2026-10-05T16:00:00+09:00' },
    { round: 2, dateLabel: '11/10（火）', timeLabel: '16:00〜20:00', isoDate: '2026-11-10T16:00:00+09:00' },
  ],
  venue: null,
};

export const REAL_SEMINAR: SeminarConfig = {
  slug: 'real-seminar',
  pillar: 3,
  title: 'リアルセミナー＆懇親会（支援者と繋がる交流会）',
  shortTitle: 'リアルセミナー＆懇親会',
  // 2026-11-22 t iku案のファーストビュー本文。数値は site-stats の定数から組み立てる
  lead:
    `5年間で${SUPPORTED_PROJECTS_LABEL}・${TOTAL_RAISED_LABEL}の支援実績、達成率${ACHIEVEMENT_RATE_LABEL}。` +
    '実績あるコンサルタントの直接指導で、あなたの挑戦を具体的なプロジェクトへ。' +
    'AIを使った企画づくり、クラファン成功者との交流、鴨頭嘉人さんとの特別な時間も。',
  format: 'リアル開催（セミナー＋懇親会）',

  /* ---- ページ最上部の告知バナー（2026-11-22 t iku指示） --------------
   * 🔴 「表彰式」の行を削除済みの版（public/real-seminar-challenger-meetup.jpg）。
   *    画像は差し替えるだけでよく、ページ側はこの設定を見て描画する。
   * ------------------------------------------------------------------ */
  topBanner: {
    src: '/real-seminar-challenger-meetup.jpg',
    alt: 'KAMOファンディング 挑戦者交流会・鴨頭嘉人参加会',
    width: 1728,
    height: 576,
  },
  /* ---- 見出しの英字小見出し（見た目のみ・文言は変えない） ---- */
  eyebrows: {
    values: 'THREE VALUES',
    program: 'PROGRAM',
    community: 'COMMUNITY',
    speakers: 'SPEAKERS',
    timetable: 'TIMETABLE',
    schedule: 'DATE & FEE',
    included: 'WHAT’S INCLUDED',
    audience: 'FOR WHOM',
    closing: 'MESSAGE',
    apply: 'ENTRY',
  },

  /* ---- 訴求ブロック（リアル回のみ） ----------------------------------
   * 🔴 数値は site-stats.ts、料金・日時・定員は下の price / sessions /
   *    capacity を正とする。文章に金額や時刻を直書きしない。
   * ------------------------------------------------------------------ */
  heroTagline: 'クラファン実践セミナー × 成功者交流会 × 鴨頭嘉人特別参加会',
  // 🔴 2026-11-22 t iku案。「リアルセミナー＆懇親会」はイベント名で購入理由にならないため、
  //    誰から何を学べるかをファーストビューで言い切る（見出し＝約束、本文＝根拠）。
  heroCatch: 'クラファン成功のプロに直接学び、成功者とつながる特別な1日。',
  ctaLabel: '参加枠を確認して申し込む',
  heroStats: [
    { value: SUPPORTED_PROJECTS_LABEL, label: '累計支援件数', note: '両サービス合計' },
    { value: TOTAL_RAISED_LABEL, label: '累計支援総額', note: '両サービス合計' },
    // 93.7%だけはKAMO単独。数値の直下に必ず明記する（他ページのバナーと同じ扱い）
    { value: ACHIEVEMENT_RATE_LABEL, label: '目標達成率', note: 'KAMOファンディング単独' },
  ],
  // 🔴 実績の主体を必ず明記する（577件・約19.5億円は両サービスのサポート案件の合算、
  //    93.7%はKAMOファンディング単独）。他ページのバナーと同じ文を使う。
  heroStatNote: `${STATS_PERIOD_NOTE}${STATS_DEFINITION}`,
  valueProps: {
    heading: 'セミナーの3つの価値',
    lead: '「学ぶ」「つながる」「会える」を、1日で。',
    items: [
      {
        title: '成功実績のあるプロから直接指導',
        body: 'クラウドファンディング支援の実績を持つ専門家から、企画設計や支援を集めるための考え方を学べます。一般論ではなく、自分の企画を前進させるための具体的なアドバイスを受けられます。',
      },
      {
        title: 'クラファン成功者と挑戦者が集まる',
        body: 'これから挑戦する人だけでなく、すでに成功を経験した人も参加します。実践者のリアルな体験を聞き、仲間や協力者とのつながりを作れる場です。',
      },
      {
        title: '鴨頭嘉人さんとリアルに交流',
        body: '鴨頭嘉人さんのリアル登壇に加えて、参加者の企画への公開アドバイスと質疑応答を行います。懇親会では鴨頭嘉人さんと直接話せます。',
      },
    ],
  },
  community: {
    eyebrow: 'この日ならではの機会',
    heading: 'クラファン成功者から、直接話を聞ける機会はありますか？',
    paragraphs: [
      'クラウドファンディングの成功事例は、インターネットでいくらでも調べられます。でも、成功するまでに何を考え、何を準備し、どんな壁を乗り越えたのか。そのリアルな話を、本人から直接聞ける機会は多くありません。',
      '今回のイベントには、これからクラファンに挑戦する人だけでなく、すでに成功した経験を持つ人も参加します。',
    ],
    punch: '成功者の経験、挑戦者の情熱、プロの専門知識が、一つの場所に集まる。',
    after: 'ここで生まれる出会いが、あなたの挑戦を前に進めるきっかけになるかもしれません。',
  },
  valueTable: {
    heading: '参加費に含まれるもの',
    lead: '当日は、次の5つを1日で体験できます。参加区分によって含まれる内容が異なります。',
    rows: [
      {
        label: 'プロによる直接指導',
        body: 'クラファン戦略・企画へのアドバイス',
        seminar: true,
        party: false,
      },
      {
        label: 'AI実践ワーク',
        body: '企画と掲載ページのたたき台作成',
        seminar: true,
        party: false,
      },
      {
        label: '鴨頭嘉人さんの特別講演',
        body: 'リアル登壇・公開アドバイス・質疑応答',
        seminar: true,
        party: false,
      },
      {
        label: '成功者・挑戦者との交流',
        body: '経験談・人脈・協力関係づくり',
        seminar: true,
        party: true,
      },
      {
        label: '懇親会',
        body: 'セミナーと同じ会場で、鴨頭嘉人さんや参加者との交流会',
        seminar: true,
        party: true,
      },
    ],
    closing: 'これらを1日で体験できます。',
  },
  audience: {
    heading: 'こんな方におすすめです',
    lead: '参加する目的は、人によってそれぞれ。あなたの現在地から参加できます。',
    items: [
      {
        label: '初めて挑戦する人',
        body: '何から始めればいいかが分かり、AIを使って企画を形にできます。',
      },
      {
        label: 'これから実施する人',
        body: '公開前に見直すべきポイントが分かり、成功率を高めるための改善につながります。',
      },
      {
        label: '過去に成功した人',
        body: '次の挑戦に向けて、成功者や挑戦する仲間との人脈と新しい可能性が広がります。',
      },
      {
        label: '鴨頭さんのファン',
        body: 'セミナーでは鴨頭さんのリアル登壇を間近で聞き、懇親会では直接話せます。挑戦する仲間とも出会えます。',
      },
    ],
  },
  closing: {
    heading: 'あなたの夢を、応援してくれる人に出会いに行きませんか？',
    paragraphs: [
      'クラウドファンディングは、単なる資金調達の手段ではありません。自分の想いを伝え、共感してくれる仲間を集め、一緒に未来を作っていく挑戦です。',
      '今回のセミナーでは、実績のあるプロから直接学び、AIを活用して企画を形にし、さらに成功者や挑戦する仲間と出会うことができます。鴨頭嘉人さんのリアル登壇と、懇親会での直接の交流も、この日ならではの内容です。',
    ],
    punch: '「いつかやりたい」を、「具体的に動き出す」に変える1日へ。',
  },
  // 料金の履歴: 19,800円（〜2026-09-08）→ 25,000円（2026-09-09）→
  // **22,000円（2026-11-22 t iku確定）**。参加区分2つはどちらも同額。
  // ヒーロー等の代表価格はこの1つで正しく表せる。区分ごとの違いは
  // REAL_ATTEND_TIERS を参照（時間・会場・含まれるものが異なる）。
  // 🔴 サイト内の金額はここだけを直す（/seminar・完了メール・特商法表記も追随する）。
  //    ストアの商品価格（外部）はコード外なので、別途 22,000円 への変更が必要。
  price: { status: 'fixed', label: '22,000円（税込）' },
  priceNote: '参加区分は2つ・どちらも同額',
  // 参加費を大きく強調（/ai-seminar と統一意匠）
  emphasizePrice: true,
  capacity: { status: 'fixed', label: 'セミナー 20名' },
  capacityParty: { status: 'fixed', label: '懇親会 40名' },
  contents: [
    '夢実現のステップ',
    'AIでページを作成',
    '成功のポイント',
    '鴨頭嘉人リアル登壇',
    '掲載説明',
    '支援者と繋がる交流会',
  ],
  program: [
    // 第1部〜第5部は CORE_PROGRAM（オンライン回と共通・同一文言）
    ...CORE_PROGRAM,
    {
      label: '特別セッション',
      title: '鴨頭嘉人 リアル登壇',
      body: '「挑戦する人に、共犯者が集まる理由」をテーマに、応援される人の考え方を会場で直接お伝えします。参加者の企画への公開アドバイスと質疑応答も行います。',
      special: true,
    },
    {
      label: '懇親会',
      title: '支援者と繋がる交流会',
      body: '18:30〜20:30、セミナーと同じ会場で懇親会を行います。鴨頭嘉人さんをはじめ、あなたの挑戦を応援してくれる支援者や、同じように挑戦する仲間と直接話せる場です。',
      party: true,
    },
  ],
  // セミナー本編は16:00〜18:30＝150分（受付15:30・懇親会18:30〜20:30まで含めると5時間）。
  // 企画が完成するのはセミナー部分なので、締めの一文は本編の長さに合わせる。
  programClosing: 'セミナー150分で、あなたのクラウドファンディング企画と掲載ページのたたき台が完成します。',
  /* ---- 当日のタイムテーブル（2026-11-22 t iku案） ----------------------
   * 🔴 時刻は sessions（受付15:30／セミナー16:00〜18:30／懇親会18:30〜20:30）
   *    と必ず一致させる。片方だけ直すと当日の案内と食い違う。
   * 🔴 各コマは「何をするか」の1行まで。パートの狙いの長文は載せない。
   * 🔴 鴨頭嘉人さんの時間は本人の予定に合わせて動きうるため、
   *    「確定」「必ず」といった約束は書かず、時間割としてだけ示す。
   * ------------------------------------------------------------------ */
  timetables: [
    {
      kicker: 'セミナー 150分',
      heading: '当日のタイムテーブル（セミナー150分）',
      lead: '講義を聞くだけで終わらせず、企画を作り、プロの指導を受け、応援者に伝える準備までを1日で行います。',
      rows: [
        {
          time: '16:00〜16:10',
          minutes: '10分',
          title: 'オープニング・ゴール設定',
          body: '今日のゴールを確認し、自分の挑戦を一文で書き出します。',
        },
        {
          time: '16:10〜16:30',
          minutes: '20分',
          title: '成功するクラファンの共通点',
          body: '支援される企画に共通する特徴と、つまずきやすいポイントを学びます。',
        },
        {
          time: '16:30〜16:50',
          minutes: '20分',
          title: '企画・コンセプト設計',
          body: '誰のどんな課題を、何で解決するのかを整理します。',
        },
        {
          time: '16:50〜17:25',
          minutes: '35分',
          title: 'AI実践ワーク',
          body: 'AIツールで、タイトル・コンセプト・ページ構成・リターン案のたたき台を作ります。',
        },
        {
          time: '17:25〜17:35',
          minutes: '10分',
          title: '休憩・企画提出',
          body: '休憩をとりながら、ここまでに作った企画を提出します。',
        },
        {
          time: '17:35〜18:05',
          minutes: '30分',
          title: '鴨頭さん特別セッション',
          body: '応援される人の考え方を、鴨頭嘉人さんが会場で直接お話しします。',
        },
        {
          time: '18:05〜18:20',
          minutes: '15分',
          title: 'プロの公開添削・質問',
          body: '参加者の企画に、プロがその場で具体的な改善案を返します。',
        },
        {
          time: '18:20〜18:30',
          minutes: '10分',
          title: 'まとめ・交流準備',
          body: '懇親会で自分の企画を30秒で伝えられるように準備します。',
        },
      ],
      totalLabel: 'セミナー合計 150分',
      note: '進行の状況により、時刻が前後する場合があります。',
    },
    {
      kicker: '懇親会 120分',
      heading: '懇親会（120分）のプログラム',
      lead: 'セミナーと同じ会場で、成功者・挑戦者・応援したい人が混ざって話せる時間です。',
      rows: [
        {
          time: '18:30〜18:40',
          minutes: '10分',
          title: '開会・乾杯・交流ルール',
          body: '乾杯と、交流の進め方・名札の使い方をご案内します。',
        },
        {
          time: '18:40〜19:00',
          minutes: '20分',
          title: '成功者のショートトーク',
          body: 'クラファン成功者が、経験と苦労した点を短く語ります。',
        },
        {
          time: '19:00〜19:30',
          minutes: '30分',
          title: '鴨頭さんを交えた交流タイム',
          body: '鴨頭嘉人さんを囲んで、テーブルごとに話します。',
        },
        {
          time: '19:30〜20:10',
          minutes: '40分',
          title: '自由交流・マッチング',
          body: '挑戦する人、成功した人、応援したい人が入り混じって話せます。',
        },
        {
          time: '20:10〜20:20',
          minutes: '10分',
          title: 'つながりの共有',
          body: '今日生まれたつながりや気づきを、全体で共有します。',
        },
        {
          time: '20:20〜20:30',
          minutes: '10分',
          title: '締め・集合写真',
          body: '締めの挨拶と、集合写真の撮影です。',
        },
      ],
      totalLabel: '懇親会 合計 120分',
    },
  ],
  // オンライン回と同じ3名。鴨頭嘉人は会場に実際に立つので役割ラベルだけ変える
  speakers: coreSpeakers('特別登壇（リアル登壇）'),
  // 10/25 第1回は開催中止（2026-09-05・t iku判断）。
  // DB側も events.status='cancelled' にして非表示にしている。
  // 12/8 は「第2回」のまま維持する方針のため round を明示している
  // （配列インデックス由来だと繰り上がって「第1回」になり、
  //   DBのイベント名「…第2回」や申込完了メールの表記と食い違う）。
  sessions: [
    {
      round: 2,
      dateLabel: '12/8（火）',
      // 🔴 2026-11-22 t iku確定の新日程（受付15:30／セミナー16:00〜18:30／懇親会18:30〜20:30）。
      //    isoDate は「受付開始」の時刻。DBの events.event_date もこの値に揃えること
      //    （揃っていないと realTierFor() が区分を引けず、時間・会場・決済券が出ない）。
      receptionTimeLabel: '受付 15:30〜',
      timeLabel: 'セミナー 16:00〜18:30',
      partyTimeLabel: '懇親会 18:30〜20:30',
      isoDate: '2026-12-08T15:30:00+09:00',
    },
  ],
  venue: { seminar: REAL_VENUE.seminar, party: REAL_VENUE.party },
};

/**
 * リアル回（12/8）の参加区分。
 *
 * 2026-09-09 の料金改定で「セミナーから参加」「交流会から参加」の2区分になった。
 * **どちらも同額（REAL_SEMINAR.price＝22,000円 税込・2026-11-22改定）**で、
 * 違うのは開始時刻・会場・含まれる内容。
 *
 * 🔴 実装方針: 区分ごとに **events の行を分ける**（DBスキーマは変更しない）。
 *   registrations に区分カラムを足すマイグレーションは不要で、
 *   既存の申込フロー（/api/apply の満席判定・中止判定・完了メール・
 *   当日リマインドcron）が**そのまま両区分に効く**。
 *   完了メールの日時も events.event_date から出るので、
 *   交流会のみの方には自動的に「18:30〜20:30」が入る（15:30・受付行は出ない）。
 *
 * 🔴 定員の注意: 懇親会の上限は40名で、**セミナー参加者20名も懇親会に入る**。
 *   そのため交流会のみの枠は 40 − 20 = **20名** を上限にしてあり、
 *   両方が満席でも懇親会は40名を超えない（20＋20＝40でちょうど上限）。
 *   （events.capacity は行ごとに独立して判定されるため、
 *     この配分で持たせるのが、跨ぎの在庫管理を作らずに上限を守る唯一の方法）
 */
export interface RealAttendTier {
  /** 区分の表示名 */
  label: string;
  /** DBの events.event_date と突き合わせるISO時刻（JST） */
  isoDate: string;
  /** 時間の表示 */
  timeLabel: string;
  /** この区分の参加者にとっての会場（メール・ページ共通） */
  venue: { main: string; sub?: string };
  /** 定員 */
  capacity: number;
  /** 一言説明 */
  summary: string;
  /** 懇親会のみの区分か（セミナー本編の案内を出さない判定に使う） */
  partyOnly?: boolean;
  /**
   * この区分の決済券。
   *
   * 🔴 **区分と券の対応を絶対に間違えないこと。** セミナー参加の方に
   *   交流会のみ券が届くと、参加費を払って15:30に入場できない。
   * 🔴 productName は**ストア掲載名と一字一句同じ**にする（全角数字もそのまま）。
   *   お客様がストアで見る文字と違うと、どれを買うか判断できない。
   * 未確定のあいだは undefined にし、リンクを貼らず「追ってご案内」とする。
   */
  payment?: { productName: string; productUrl: string };
}

export const REAL_ATTEND_TIERS: RealAttendTier[] = [
  {
    label: 'セミナーから参加',
    // 🔴 2026-11-22 t iku確定: 受付15:30／セミナー16:00〜18:30／懇親会18:30〜20:30。
    //    isoDate は受付開始。DBの events.event_date（A区分の行）も同じ値にする。
    isoDate: '2026-12-08T15:30:00+09:00',
    timeLabel: '15:30〜20:30（懇親会込み）',
    // 懇親会も同会場なので sub は持たない（会場を移さない）
    venue: { main: REAL_VENUE.seminar },
    capacity: 20,
    summary:
      'セミナー本編（第1部〜第5部・鴨頭嘉人リアル登壇）から参加し、そのまま同じ会場の懇親会にも参加できます。プロの直接指導とAI実践ワークを含みます。',
    // ストア実測（2026-09-09）。商品名の【１２／８】は全角のまま
    payment: {
      productName: 'リアルセミナー参加＆合同交流会セット券【１２／８】',
      productUrl: 'https://www.kamofunding.com/stores/kamofunding04/products/73507',
    },
  },
  {
    label: '交流会から参加',
    // 🔴 A区分と同じく 2026-11-22 の新日程に合わせる（18:30〜20:30）。
    isoDate: '2026-12-08T18:30:00+09:00',
    timeLabel: '18:30〜20:30（懇親会のみ）',
    // 懇親会もセミナーと同会場（エデュケーションギャラリー）になった
    venue: { main: REAL_VENUE.party },
    capacity: 20,
    summary:
      '懇親会からの参加です。会場はセミナーと同じエデュケーションギャラリーで、鴨頭嘉人さんや成功者、挑戦する仲間と直接話せます。セミナー本編・AI実践ワーク・講師による指導は含まれません。',
    partyOnly: true,
    // ストア実測（2026-09-09）
    payment: {
      // 2026-11-23 ストア商品の入れ替え（72011→73508）。商品名もストア表記に合わせる
      productName: 'ビジネス合同交流会のみ参加【１２／８】',
      productUrl: 'https://www.kamofunding.com/stores/kamofunding04/products/73508',
    },
  },
];

/**
 * DBの events.event_date からリアル回の参加区分を引く。
 * 区分が特定できない行では null（推測で時間や会場を書かない）。
 */
export function realTierFor(eventDate?: string | null): RealAttendTier | null {
  if (!eventDate) return null;
  const t = new Date(eventDate).getTime();
  if (Number.isNaN(t)) return null;
  return REAL_ATTEND_TIERS.find(x => new Date(x.isoDate).getTime() === t) ?? null;
}

/**
 * 11/9 KAMOファンディングアワード（pillar 4）
 *
 * 🔴 **12/8のリアル回（pillar 3）とは完全に別のイベント**。
 *   REAL_VENUE / REAL_ATTEND_TIERS / REAL_SEMINAR.sessions /
 *   realSessionBreakdown() / realTierFor() には**一切依存しない**。
 *   12/8側の定数に harevutai を足したり sessions を拡張すると
 *   12/8の表示・メールが壊れるため、ここに独立して持つ。
 *
 * 🔴 **pillar を 4 に分ける理由（最重要）**: paymentInfoFor() は pillar で
 *   決済券を決めている。11/9を pillar 3 に混ぜると、参加区分が特定できない行で
 *   **12/8の券が案内される**（参加費を払って入場できない事故と同じ形）。
 *   pillar 4 は券が1つに固定されるため、取り違えの余地が構造的に無い。
 *
 * 🔴 **定員は 40 のみを持つ**（懇親会会場の定員）。
 *   t iku 回答（2026-09-10）は「表彰式100名／懇親会40名」だが、
 *   券は「合同交流会＋KAMOファンアワード参加権付」＝**懇親会込みの1種類だけ**なので
 *   申込上限は小さい方の40。**100名は設定に持たない** —
 *   観覧のみの券が無い今、100はお客様の判断材料にならないのに
 *   「まだ空いている」という誤解だけを生む。観覧券が出たら足す。
 */
export interface AwardPart {
  /** 区分ラベル（第一部／第二部／懇親会） */
  label: string;
  title: string;
  /** 時間の表示 */
  timeLabel: string;
  /** この区分の会場 */
  venue: string;
  /** 懇親会かどうか（意匠の出し分け用） */
  party?: boolean;
}

/**
 * 11/9アワードの会場。
 *
 * 🔴 アワードは2026-11-09で終了し、`/award` は `/seminar` へ308転送している
 *   （2026-11-23）。当時の懇親会の会場名はサイトから外したため、
 *   ここには具体的な店名を残さず「当日ご案内」としておく
 *   （12/8の会場と読み違えられる文字列を残さないため）。
 */
export const AWARD_VENUE = {
  main: '池袋 harevutai',
  party: '当日ご案内',
} as const;

export const AWARD_EVENT = {
  slug: 'award',
  pillar: 4 as const,
  title: 'KAMOファンディングアワード',
  // 🔴 回次は付けない（t iku 確定・2026-09-10）。events.title も同じ文字列にする。
  shortTitle: 'KAMOファンディングアワード',
  lead:
    'KAMOファンディングで挑戦した方々を表彰する年に一度の式典です。表彰式のあとは懇親会で、挑戦者・支援者と直接つながれます。',
  format: 'リアル開催（表彰式＋懇親会）',
  dateLabel: '11/9（月）',
  /**
   * DBの events.event_date と突き合わせるISO時刻（JST）。
   * 第一部の開始時刻。受付（17:30）ではなく開始時刻を持つ。
   */
  isoDate: '2026-11-09T18:00:00+09:00',
  receptionTimeLabel: '受付 17:30〜',
  /**
   * 🔴 時刻は t iku の公式日程画像を正として確定（2026-09-10）。
   *   ストアの商品説明（第一部20:30終了・懇親会21:00開始）は誤りで、
   *   ストア側の説明文修正は t iku 対応。
   *
   * 第二部と懇親会の間に30分空く（会場移動）。12/8のように連続していないため、
   * timeLabel + partyTimeLabel の2本立てではなく**区間の配列**で持つ。
   */
  parts: [
    {
      label: '第一部',
      title: 'KAMOファンディング表彰式',
      timeLabel: '18:00〜20:00',
      venue: AWARD_VENUE.main,
    },
    {
      label: '第二部',
      // 第二部の名称は「KAMOファンディングLIVE」で確定（2026-09-13 t iku 指示）。
      // ストアの説明は「表彰式観覧券＋鴨頭LIVE＋表彰者との懇親会参加権」だが、
      // 正式名称は鴨頭氏個人名ではなく KAMOファンディングLIVE。
      title: 'KAMOファンディングLIVE',
      timeLabel: '18:00〜20:00',
      venue: AWARD_VENUE.main,
    },
    {
      label: '懇親会',
      title: '表彰者との懇親会',
      timeLabel: '20:30〜22:30',
      venue: AWARD_VENUE.party,
      party: true,
    },
  ] as AwardPart[],
  price: { status: 'fixed', label: '25,000円（税込）' } as PendingValue,
  capacity: { status: 'fixed', label: '40名' } as PendingValue,
  /** 申込上限の判定に使う実数（events.capacity と一致させる） */
  capacityNumber: 40,
  venue: AWARD_VENUE,
  // PM実測（2026-09-10）。商品名は**ストア表記のまま**（全角＋を崩さない）
  payment: {
    productName: '合同交流会＋KAMOファンアワード参加権付',
    productUrl: 'https://www.kamofunding.com/stores/kamofunding04/products/72010',
  },
};

/**
 * 11/9アワードの内訳文字列（メール・ページ共通の単一の情報源）。
 * 例: 受付 17:30〜／第一部 18:00〜20:00／第二部 18:00〜20:00／懇親会 20:30〜22:30
 *
 * 12/8の realSessionBreakdown() とは別関数。**12/8側は触らない**。
 */
export function awardBreakdown(): string {
  const parts = AWARD_EVENT.parts.map(p => `${p.label} ${p.timeLabel}`);
  return [AWARD_EVENT.receptionTimeLabel, ...parts].join('／');
}

export const SEMINAR_CONFIGS = [AI_SEMINAR, REAL_SEMINAR];

/**
 * お支払い（決済）の案内 — 申込完了メールに載せる情報。
 *
 * 🔴 **有料セミナーのみ**が対象。無料の掲載説明会（info_session / pillar 1）や
 *   パートナー系メールには絶対に出さない（下の paymentInfoFor() が pillar で弁別する）。
 *
 * リンク先は t iku 指定の**ストアトップ**で、複数商品が並んでいる：
 *   - 【鴨頭嘉人特別参加会】AI時代のクラウドファンディング活用セミナー … 9,800円（税込）
 *   - お試し価格！あなたのクラファン企画！壁打ち＆集め方指南します！ … 15,000円（税込）
 *   - 合同交流会のみ参加券　１８：３０集合です … 19,800円（税込）
 * そのため、**どれを選ぶべきかを金額と商品名で明示**しないと誤購入が起きる。
 */
export const PAYMENT_STORE_URL = 'https://www.kamofunding.com/stores/kamofunding04/';

export interface PaymentInfo {
  /** 参加費の表示（例: 9,800円（税込）） */
  priceLabel: string;
  /**
   * ストアで選ぶべき商品名。
   * ストアの掲載名と**一字一句同じ**であることが誤購入防止の条件なので、
   * 確認できていない場合は undefined にして金額のみで案内する（推測で書かない）。
   */
  productName?: string;
  /**
   * 商品ページの直リンク。
   * 指定があればストアトップではなく**その商品ページへ直接**送る。
   * 複数商品から選ばせないので、誤購入の余地そのものが無くなる。
   */
  productUrl?: string;
  /**
   * true のとき、**決済リンクを一切出さず**「お支払い方法は追ってご案内」と伝える。
   * 正しい商品が特定できていない状態でリンクを貼ると誤購入＝実害になるため、
   * 「リンクなしで案内する」を明示的な状態として持つ。
   */
  linkless?: boolean;
}

/**
 * pillar から決済案内を決める。
 * 2 = オンラインセミナー（9,800円）／3 = リアルセミナー＆懇親会（22,000円）／
 * 4 = KAMOファンディングアワード（25,000円・別商品なので変更しない）。
 * それ以外（無料の掲載説明会など）は null = 決済案内を出さない。
 */
export function paymentInfoFor(pillar?: number | null, eventDate?: string | null): PaymentInfo | null {
  if (pillar === 2) {
    return {
      priceLabel: pendingLabel(AI_SEMINAR.price),
      // ストア掲載名と完全一致（2026-09-05 実ページ確認）
      productName: '【鴨頭嘉人特別参加会】AI時代のクラウドファンディング活用セミナー',
    };
  }
  if (pillar === 4) {
    // 🔴 11/9アワードは券が**1種類だけ**。区分による引き当てが無いので
    //   取り違えが構造的に起きない（12/8との混同を防ぐため pillar を分けてある）。
    return {
      priceLabel: pendingLabel(AWARD_EVENT.price),
      productName: AWARD_EVENT.payment.productName,
      productUrl: AWARD_EVENT.payment.productUrl,
    };
  }
  if (pillar === 3) {
    // 🔴 リアル回は**参加区分ごとに決済券が違う**（2026-09-09 に専用券が用意された）。
    //   セミナー参加の方に交流会のみ券を案内すると、参加費を払って15:30に
    //   入場できない。**区分から引いた券以外は絶対に出さない**。
    const tier = realTierFor(eventDate);
    if (!tier?.payment) {
      // 区分が特定できない／券が未確定の行では、金額だけ伝えてリンクは貼らない。
      // 誤った券を案内するより、案内が一手間増える方が安全。
      return { priceLabel: pendingLabel(REAL_SEMINAR.price), linkless: true };
    }
    return {
      priceLabel: pendingLabel(REAL_SEMINAR.price),
      productName: tier.payment.productName,
      productUrl: tier.payment.productUrl,
    };
  }
  return null;
}

/**
 * リアル回の「セミナー／懇親会」の内訳表記を返す。
 *
 * 🔴 リアル回の開催日時は DB では **受付開始〜懇親会終了（15:30〜20:30）** の
 *   ひとつの範囲になっている。範囲だけを見せると「18:30に終わる」あるいは
 *   逆に「20:30までセミナー」と誤解されるため、**内訳を必ず添える**。
 *   ページ（/real-seminar）はこの内訳を元から出しているので、
 *   メール側も同じ値を出して数字を揃える。
 *
 * @param eventDate DBの events.event_date（ISO文字列）
 * @returns 内訳の文字列（例: 受付 15:30〜／セミナー 16:00〜18:30／懇親会 18:30〜20:30）。
 *          該当セッションが設定に無ければ null（推測で書かない）。
 */
export function realSessionBreakdown(eventDate?: string | null): string | null {
  if (!eventDate) return null;
  const target = new Date(eventDate).getTime();
  if (Number.isNaN(target)) return null;

  // 「交流会から参加」の区分は懇親会だけなので、
  // セミナー本編の 16:00 や受付 15:30 を出すと**来る時間を間違える**。懇親会の時間だけ返す。
  const tier = realTierFor(eventDate);
  if (tier?.partyOnly) {
    const party = REAL_SEMINAR.sessions[0]?.partyTimeLabel;
    return party ?? null;
  }

  const s = REAL_SEMINAR.sessions.find(x => new Date(x.isoDate).getTime() === target);
  if (!s) return null;
  // A区分のみ受付行を先頭に足す（partyOnly は上で return 済み）
  const parts = [s.receptionTimeLabel, s.timeLabel, s.partyTimeLabel].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return parts.join('／');
}
