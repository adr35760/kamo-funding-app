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
 * ■ 参加費・税表記は確定済み（オンライン9,800円（税込）／リアル25,000円（税込））。
 *   リアルは2026-09-09に19,800円→25,000円へ改定し、参加区分が2つになった
 *   （どちらも同額。REAL_ATTEND_TIERS を参照）。
 * ■ 定員: リアルはセミナー20名・懇親会40名で確定（2026-09-10 t iku回答: 懇親会は40名入る）。
 *   events.capacity にはセミナー本体の20を入れており、申込上限の判定はこの20が基準。
 *   懇親会の40名は capacityParty として表示専用に持つ。
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
  /** 講師紹介（プロフィール文は未提供のため役割＋お名前のみ） */
  speakers?: Speaker[];
  sessions: SeminarSession[];
  /** 会場（オンラインは null） */
  venue: { seminar: string; party?: string } | null;
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
      title: '総支援額16億円を生み出したクラファンの専門家',
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
  lead:
    '鴨頭嘉人がリアル登壇。セミナーのあとは懇親会で、あなたの挑戦を応援してくれる支援者と直接つながれます。',
  format: 'リアル開催（セミナー＋懇親会）',
  // 2026-09-09 料金改定: 19,800円 → 25,000円。
  // 参加区分が2つあり**どちらも同額**（t iku指示に2回明記された意図的な同額）なので、
  // ヒーロー等の代表価格はこの1つで正しく表せる。区分ごとの違いは
  // REAL_ATTEND_TIERS を参照（時間・会場・含まれるものが異なる）。
  price: { status: 'fixed', label: '25,000円（税込）' },
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
      body: '18:00〜20:00、会場を移して懇親会を行います。あなたの挑戦を応援してくれる支援者や、同じように挑戦する仲間と直接つながれます。',
      party: true,
    },
  ],
  // セミナー本編は15:30〜18:00＝2時間半（懇親会を足すと受付から5時間だが、
  // 企画が完成するのはセミナー部分なので「2時間半」が正しい）
  programClosing: '2時間半後には、あなたのクラウドファンディング企画と掲載ページのたたき台が完成します。',
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
      receptionTimeLabel: '受付 15:00〜',
      timeLabel: 'セミナー 15:30〜18:00',
      partyTimeLabel: '懇親会 18:00〜20:00',
      isoDate: '2026-12-08T15:00:00+09:00',
    },
  ],
  venue: { seminar: REAL_VENUE.seminar, party: REAL_VENUE.party },
};

/**
 * リアル回（12/8）の参加区分。
 *
 * 2026-09-09 の料金改定で「セミナーから参加」「交流会から参加」の2区分になった。
 * **どちらも25,000円（税込）**で、違うのは開始時刻・会場・含まれる内容。
 *
 * 🔴 実装方針: 区分ごとに **events の行を分ける**（DBスキーマは変更しない）。
 *   registrations に区分カラムを足すマイグレーションは不要で、
 *   既存の申込フロー（/api/apply の満席判定・中止判定・完了メール・
 *   当日リマインドcron）が**そのまま両区分に効く**。
 *   完了メールの日時も events.event_date から出るので、
 *   交流会のみの方には自動的に「18:00〜20:00」が入る（15:00・受付行は出ない）。
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
   *   交流会のみ券が届くと、25,000円を払って15:00に入場できない。
   * 🔴 productName は**ストア掲載名と一字一句同じ**にする（全角数字もそのまま）。
   *   お客様がストアで見る文字と違うと、どれを買うか判断できない。
   * 未確定のあいだは undefined にし、リンクを貼らず「追ってご案内」とする。
   */
  payment?: { productName: string; productUrl: string };
}

export const REAL_ATTEND_TIERS: RealAttendTier[] = [
  {
    label: 'セミナーから参加',
    isoDate: '2026-12-08T15:00:00+09:00',
    timeLabel: '15:00〜20:00（懇親会込み）',
    venue: { main: REAL_VENUE.seminar, sub: REAL_VENUE.party },
    capacity: 20,
    summary: 'セミナー本編（第1部〜第5部・鴨頭嘉人リアル登壇）から参加し、そのまま懇親会にも参加できます。',
    // ストア実測（2026-09-09）。商品名の【１２／８】は全角のまま
    payment: {
      productName: 'リアルセミナー参加＆合同交流会セット券【１２／８】',
      productUrl: 'https://www.kamofunding.com/stores/kamofunding04/products/72012',
    },
  },
  {
    label: '交流会から参加',
    isoDate: '2026-12-08T18:00:00+09:00',
    timeLabel: '18:00〜20:00（懇親会のみ）',
    // 懇親会のみの方はエデュケーションギャラリーには来ないので出さない
    venue: { main: REAL_VENUE.party },
    capacity: 20,
    summary: '懇親会からの参加です。支援者や挑戦する仲間と直接つながれます。',
    partyOnly: true,
    // ストア実測（2026-09-09）
    payment: {
      productName: '12/8交流会のみ参加券',
      productUrl: 'https://www.kamofunding.com/stores/kamofunding04/products/72011',
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
 *   **12/8の券が案内される**（25,000円を払って入場できない事故と同じ形）。
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

export const AWARD_VENUE = {
  main: '池袋 harevutai',
  party: 'YAKINIKUMAFIA',
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
      // ストアの説明は「表彰式観覧券＋鴨頭LIVE＋表彰者との懇親会参加権」で、
      // 鴨頭LIVE = 第二部と思われるが未確認のため画像どおりの表記にしてある。
      // 確定したらこの title と body を差し替える。
      title: 'イベント',
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
 * 2 = オンラインセミナー（9,800円）／3 = リアルセミナー＆懇親会（25,000円）／
 * 4 = KAMOファンディングアワード（25,000円）。
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
    //   セミナー参加の方に交流会のみ券を案内すると、25,000円を払って15:00に
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
 * 🔴 リアル回の開催日時は DB では **セミナー開始〜懇親会終了（15:00〜20:00）** の
 *   ひとつの範囲になっている。範囲だけを見せると「18:00に終わる」あるいは
 *   逆に「20:00までセミナー」と誤解されるため、**内訳を必ず添える**。
 *   ページ（/real-seminar）はこの内訳を元から出しているので、
 *   メール側も同じ値を出して数字を揃える。
 *
 * @param eventDate DBの events.event_date（ISO文字列）
 * @returns 内訳の文字列（例: 受付 15:00〜／セミナー 15:30〜18:00／懇親会 18:00〜20:00）。
 *          該当セッションが設定に無ければ null（推測で書かない）。
 */
export function realSessionBreakdown(eventDate?: string | null): string | null {
  if (!eventDate) return null;
  const target = new Date(eventDate).getTime();
  if (Number.isNaN(target)) return null;

  // 「交流会から参加」の区分は懇親会だけなので、
  // セミナー本編の 15:30 や受付 15:00 を出すと**来る時間を間違える**。懇親会の時間だけ返す。
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
