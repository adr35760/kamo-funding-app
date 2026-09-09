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
      title: '総支援額17億円を生み出したクラファンの専門家',
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
  capacityParty: { status: 'fixed', label: '懇親会 35名' },
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
      body: '18:30〜20:00、会場を移して懇親会を行います。あなたの挑戦を応援してくれる支援者や、同じように挑戦する仲間と直接つながれます。',
      party: true,
    },
  ],
  // セミナー本編は15:00〜18:30＝3時間半（懇親会を足すと5時間だが、
  // 企画が完成するのはセミナー部分なので「3時間半」が正しい）
  programClosing: '3時間半後には、あなたのクラウドファンディング企画と掲載ページのたたき台が完成します。',
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
      timeLabel: 'セミナー 15:00〜18:30',
      partyTimeLabel: '懇親会 18:30〜20:00',
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
 *   交流会のみの方には自動的に「18:30〜20:00」が入る（15:00は出ない）。
 *
 * 🔴 定員の注意: 懇親会の上限は35名で、**セミナー参加者20名も懇親会に入る**。
 *   そのため交流会のみの枠は 35 − 20 = **15名** を上限にしてあり、
 *   両方が満席でも懇親会は35名を超えない。
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
}

export const REAL_ATTEND_TIERS: RealAttendTier[] = [
  {
    label: 'セミナーから参加',
    isoDate: '2026-12-08T15:00:00+09:00',
    timeLabel: '15:00〜20:00（懇親会込み）',
    venue: { main: REAL_VENUE.seminar, sub: REAL_VENUE.party },
    capacity: 20,
    summary: 'セミナー本編（第1部〜第5部・鴨頭嘉人リアル登壇）から参加し、そのまま懇親会にも参加できます。',
  },
  {
    label: '交流会から参加',
    isoDate: '2026-12-08T18:30:00+09:00',
    timeLabel: '18:30〜20:00（懇親会のみ）',
    // 懇親会のみの方はエデュケーションギャラリーには来ないので出さない
    venue: { main: REAL_VENUE.party },
    capacity: 15,
    summary: '懇親会からの参加です。支援者や挑戦する仲間と直接つながれます。',
    partyOnly: true,
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
   * true のとき、**決済リンクを一切出さず**「お支払い方法は追ってご案内」と伝える。
   * 正しい商品が特定できていない状態でリンクを貼ると誤購入＝実害になるため、
   * 「リンクなしで案内する」を明示的な状態として持つ。
   */
  linkless?: boolean;
}

/**
 * pillar から決済案内を決める。
 * 2 = オンラインセミナー（9,800円）／3 = リアルセミナー＆懇親会（25,000円）。
 * それ以外（無料の掲載説明会など）は null = 決済案内を出さない。
 */
export function paymentInfoFor(pillar?: number | null): PaymentInfo | null {
  if (pillar === 2) {
    return {
      priceLabel: pendingLabel(AI_SEMINAR.price),
      // ストア掲載名と完全一致（2026-09-05 実ページ確認）
      productName: '【鴨頭嘉人特別参加会】AI時代のクラウドファンディング活用セミナー',
    };
  }
  if (pillar === 3) {
    // 🔴 **リアル回は決済リンクを出さない**（2026-09-05 判断）。
    //   ストアで19,800円の商品は「合同交流会のみ参加券　１８：３０集合です」＝
    //   **懇親会だけの参加券**で、当方のリアル回（セミナー15:00〜＋懇親会18:30〜）
    //   とは中身が違う。金額が同じでも代用はできず、お支払い後に
    //   「その券ではセミナーに入れません」となる事故が最悪なので、
    //   **正しいセット券のURLと商品名が確定するまでリンクを貼らない**。
    //   復活させるときは productName とリンク（PAYMENT_STORE_URL または
    //   商品個別URL）を入れて linkless を外す。
    return {
      priceLabel: pendingLabel(REAL_SEMINAR.price),
      linkless: true,
    };
  }
  return null;
}

/**
 * リアル回の「セミナー／懇親会」の内訳表記を返す。
 *
 * 🔴 リアル回の開催日時は DB では **セミナー開始〜懇親会終了（15:00〜20:00）** の
 *   ひとつの範囲になっている。範囲だけを見せると「18:30に終わる」あるいは
 *   逆に「20:00までセミナー」と誤解されるため、**内訳を必ず添える**。
 *   ページ（/real-seminar）はこの内訳を元から出しているので、
 *   メール側も同じ値を出して数字を揃える。
 *
 * @param eventDate DBの events.event_date（ISO文字列）
 * @returns 内訳の文字列（例: セミナー 15:00〜18:30／懇親会 18:30〜20:00）。
 *          該当セッションが設定に無ければ null（推測で書かない）。
 */
export function realSessionBreakdown(eventDate?: string | null): string | null {
  if (!eventDate) return null;
  const target = new Date(eventDate).getTime();
  if (Number.isNaN(target)) return null;

  // 「交流会から参加」の区分は懇親会だけなので、
  // セミナー本編の 15:00 を出すと**来る時間を間違える**。懇親会の時間だけ返す。
  const tier = realTierFor(eventDate);
  if (tier?.partyOnly) {
    const party = REAL_SEMINAR.sessions[0]?.partyTimeLabel;
    return party ?? null;
  }

  const s = REAL_SEMINAR.sessions.find(x => new Date(x.isoDate).getTime() === target);
  if (!s) return null;
  const parts = [s.timeLabel, s.partyTimeLabel].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return parts.join('／');
}
