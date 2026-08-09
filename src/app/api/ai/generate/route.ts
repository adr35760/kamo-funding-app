import { NextRequest, NextResponse } from 'next/server';
import {
  SYSTEM_PROMPT,
  buildPageGenerationPrompt,
  calculateRewardTiers,
  type HearingInput,
  type CrowdfundingPage,
} from '@/lib/ai-prompts';

/**
 * POST /api/ai/generate
 * 
 * ヒアリング入力からクラファンページのひな形をAI生成する。
 * OpenAI APIキーが未設定の場合はモック応答を返す（開発・UIテスト用）。
 * 
 * Body: HearingInput
 * Response: { success: true, page: CrowdfundingPage, mode: "live" | "mock" }
 */
export async function POST(request: NextRequest) {
  try {
    const input: HearingInput = await request.json();

    // 入力バリデーション
    if (!input.industry || !input.goalAmount || !input.creatorName) {
      return NextResponse.json(
        { success: false, error: '必須項目が不足しています（業種・目標金額・起案者名）' },
        { status: 400 }
      );
    }

    const apiKey = process.env.KAMO_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const apiBaseUrl = process.env.KAMO_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

    if (!apiKey) {
      // モック応答（APIキー未到着時のUIテスト用）
      const mockPage = generateMockPage(input);
      return NextResponse.json({
        success: true,
        page: mockPage,
        mode: 'mock',
      });
    }

    // 本物のLLM呼び出し
    const prompt = buildPageGenerationPrompt(input);
    // Gensparkプロキシの場合は利用可能なモデルを使用、直接OpenAIの場合はgpt-4o
    const model = apiBaseUrl.includes('genspark') ? 'gpt-5.1' : 'gpt-4o';
    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI API error:', response.status, errText);
      // フォールバック to mock
      const mockPage = generateMockPage(input);
      return NextResponse.json({
        success: true,
        page: mockPage,
        mode: 'mock_fallback',
      });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from LLM');
    }

    const page: CrowdfundingPage = JSON.parse(content);

    return NextResponse.json({
      success: true,
      page,
      mode: 'live',
    });
  } catch (err) {
    console.error('API /ai/generate error:', err);
    return NextResponse.json(
      { success: false, error: 'AI生成中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * モックページ生成（APIキー未到着時のUIテスト用）
 * 実際のKAMOファンディングページに近い品質で出力する。
 */
function generateMockPage(input: HearingInput): CrowdfundingPage {
  const tiers = calculateRewardTiers(input.goalAmount);
  const deliveryDate = new Date(Date.now() + input.deadlineDays * 86400000 + 14 * 86400000);
  const deliveryStr = deliveryDate.toISOString().split('T')[0];
  const startDate = new Date();
  const startStr = `${startDate.getMonth() + 1}月${startDate.getDate()}日`;
  const endDate = new Date(Date.now() + input.deadlineDays * 86400000);
  const endStr = `${endDate.getMonth() + 1}月${endDate.getDate()}日`;

  // 業種別テンプレート
  const templates = getIndustryTemplate(input.industry);
  const titleKeyword = input.crowdfundingGoal
    ? input.crowdfundingGoal.replace(/したい|したい！|を立ち上げたい.*/, '').slice(0, 20)
    : templates.titleKeyword;

  return {
    project: {
      title: `「${titleKeyword}」を${templates.titleAction}たい！`,
      subtitle: `${input.industry}の${templates.subtitleSuffix} — ${input.targetAudience || '地域の皆様'}に新しい価値を`,
      main_image_url: '',
      goal_amount: input.goalAmount,
      project_type: '実行確約型',
      story: {
        lead: `${startStr}、${input.organization || input.creatorName}の${input.creatorName}です。${input.businessDescription}${input.currentChallenge ? `\n\n今、${input.currentChallenge}という課題に直面しています。この課題を乗り越えるため、皆様のお力添えを借りたく、このプロジェクトを立ち上げました。` : ''}`,
        background: `${input.businessDescription}\n\nしかし、${input.currentChallenge || '市場環境の変化により、従来のやり方だけでは成長の限界を感じています'}。このままでは、${templates.backgroundRisk}という危機感があります。\n\nだからこそ、今、大胆な一手を打つ必要があります。${input.crowdfundingGoal || templates.defaultGoal} — これが実現できれば、${templates.backgroundHope}ことができます。`,
        vision: `${input.crowdfundingGoal || templates.defaultGoal}。\n\nこれが実現した未来を想像してください。\n${templates.visionDescription}\n\n${input.targetAudience || '地域の皆様'}にとって、${templates.visionBenefit}。これが私たちの描く未来です。`,
        use_of_funds: `皆様からいただいた支援金は、以下の用途で活用いたします。\n\n■ 内訳（目安）\n・${templates.fundUse1}: 約${Math.round(input.goalAmount * 0.4).toLocaleString()}円（40%）\n・${templates.fundUse2}: 約${Math.round(input.goalAmount * 0.3).toLocaleString()}円（30%）\n・${templates.fundUse3}: 約${Math.round(input.goalAmount * 0.2).toLocaleString()}円（20%）\n・クラファン手数料・事務費: 約${Math.round(input.goalAmount * 0.1).toLocaleString()}円（10%）\n\nすべての資金を、${input.crowdfundingGoal || 'プロジェクトの実現'}のために真摯に活用いたします。`,
        schedule: `■ 募集期間: ${startStr}〜${endStr}（${input.deadlineDays}日間）\n■ 達成後のスケジュール:\n・${endDate.getMonth() + 1}月下旬: 実行プロジェクト開始\n・${deliveryDate.getMonth() + 1}月: リターン製作・発送開始\n・${deliveryStr}頃: 全リターンのお届け完了予定\n\n※進捗は随时報告いたします。`,
        appeal: `最後まで読んでいただき、ありがとうございます。\n\n${input.creatorName}として、本業を本気で立て直そうとしています。${input.currentChallenge ? `${input.currentChallenge} — この壁を、皆様と一緒に乗り越えたい。` : 'この壁を、皆様と一緒に乗り越えたい。'}\n\n「共犯者」を募集します。このプロジェクトに共感してくださる方、一緒に${templates.appealGoal}を実現しませんか？\n\nあなたの支援が、私たちの挑戦を現実に変えます。ひとりひとりの支援が、大きなうねりになります。\n\nどうか、ご支援よろしくお願いいたします。`,
      },
      creator: {
        name: input.creatorName,
        avatar: '',
        bio: `${input.industry}で事業を展開する${input.organization || input.creatorName}。${input.businessDescription.split('。')[0]}。本業の課題をクラウドファンディングの力で突破すべく、挑戦中。`,
        organization: input.organization || '',
      },
      legal_info: {
        business_name: input.organization || input.creatorName,
        address: '',
        representative: input.creatorName,
        contact_email: '',
        price_range: '各プロジェクトページ参照',
        delivery: `各リターンのご提供予定時期をご参照ください（概ね${deliveryStr}頃）`,
        payment: 'クレジットカード/購入時決済',
        shipping: '無料(商品代金に含む)',
        returns: '破損・発送ミスのみ14日以内にお問い合わせください',
        defects: '14日以内にお問い合わせください',
      },
    },
    rewards: [
      {
        tier: 'entry',
        title: `【応援コース】${templates.entryRewardName}`,
        description: `${input.creatorName}の挑戦を応援するコースです。\n\n${templates.entryRewardDesc}\n\n※お礼の手紙にお届け先情報は不要です。`,
        image_url: '',
        price: tiers.entry,
        shipping_included: true,
        estimated_delivery: deliveryStr,
        stock_limit: null,
        is_designated: false,
        designated_name: '',
      },
      {
        tier: 'standard',
        title: `【お試しコース】${templates.standardRewardName}`,
        description: `${templates.standardRewardDesc}\n\n${input.industry}の良さを存分に味わっていただけるセットです。ご自身はもちろん、ご家族や友人へのギフトとしてもお使いいただけます。`,
        image_url: '',
        price: tiers.standard,
        shipping_included: true,
        estimated_delivery: deliveryStr,
        stock_limit: 100,
        is_designated: false,
        designated_name: '',
      },
      {
        tier: 'premium',
        title: `【特別セットコース】${templates.premiumRewardName}`,
        description: `通常では販売していない限定の特別セットです。\n\n${templates.premiumRewardDesc}\n\nこのコースは本プロジェクト限定の特別仕様。数量限定でのご提供となります。`,
        image_url: '',
        price: tiers.premium,
        shipping_included: true,
        estimated_delivery: deliveryStr,
        stock_limit: 50,
        is_designated: false,
        designated_name: '',
      },
      {
        tier: 'vip',
        title: `【VIP体験コース】${templates.vipRewardName}`,
        description: `${input.creatorName}と直接つながれるVIPコース。\n\n${templates.vipRewardDesc}\n\n※日時はご相談の上決定いたします。遠方の方はオンラインでの対応も可能です。`,
        image_url: '',
        price: tiers.vip,
        shipping_included: true,
        estimated_delivery: deliveryStr,
        stock_limit: 10,
        is_designated: false,
        designated_name: '',
      },
      {
        tier: 'sponsor',
        title: `【ダイヤモンドスポンサー】企業・団体様向け`,
        description: `本プロジェクトの最高位スポンサーコースです。\n\n${templates.sponsorRewardDesc}\n\n■ スポンサー特典\n・プロジェクトページへのロゴ掲載\n・SNSでの感謝投稿（リツイート・シェア歓迎）\n・${input.creatorName}による企業訪問・意見交換会（1回）\n・月1回のオンライン進捗報告（3ヶ月間）\n\n※特典内容につきましては、ご相談の上カスタマイズ可能です。`,
        image_url: '',
        price: tiers.sponsor,
        shipping_included: true,
        estimated_delivery: deliveryStr,
        stock_limit: 5,
        is_designated: false,
        designated_name: '',
        sponsor_name: 'ダイヤモンド',
      },
    ],
  };
}

/**
 * 業種別テンプレート
 */
function getIndustryTemplate(industry: string) {
  const templates: Record<string, {
    titleKeyword: string;
    titleAction: string;
    subtitleSuffix: string;
    backgroundRisk: string;
    backgroundHope: string;
    visionDescription: string;
    visionBenefit: string;
    defaultGoal: string;
    fundUse1: string;
    fundUse2: string;
    fundUse3: string;
    appealGoal: string;
    entryRewardName: string;
    entryRewardDesc: string;
    standardRewardName: string;
    standardRewardDesc: string;
    premiumRewardName: string;
    premiumRewardDesc: string;
    vipRewardName: string;
    vipRewardDesc: string;
    sponsorRewardDesc: string;
  }> = {
    飲食: {
      titleKeyword: '新しい味の挑戦',
      titleAction: '進化さ',
      subtitleSuffix: '挑戦',
      backgroundRisk: '地域の食文化が失われる',
      backgroundHope: '地域の皆様に安心・安全な食を届け続け',
      visionDescription: '地域の食材を活かした新しいメニューが生まれ、食べ物を通じた人の輪が広がる。観光客にも地元の方にも愛される店になる。',
      visionBenefit: '美味しい食と温かいもてなしに出会える場所が残る',
      defaultGoal: '新しいデリバリーサービスとメニュー開発',
      fundUse1: '設備投資（デリバリー体制・調理器具）',
      fundUse2: '新メニュー開発・食材仕入れ',
      fundUse3: '販路拡大・集客活動',
      appealGoal: '地域の食を未来へ残す',
      entryRewardName: 'お礼のお手紙+オリジナルレシピカード',
      entryRewardDesc: '心を込めたお礼のお手紙と、当家自慢のオリジナルレシピカード（1品）をお送りします。',
      standardRewardName: 'お試しセット',
      standardRewardDesc: '当家の人気メニュー3品を特別セットにしてお届けします。冷凍便にて発送いたします。',
      premiumRewardName: '限定フルコース',
      premiumRewardDesc: '通常メニューにはない、季節の食材を活かした限定フルコース（2名様分）。店舗でのご利用またはお届け便を選択いただけます。',
      vipRewardName: 'シェフとつくるプライベート料理体験',
      vipRewardDesc: '当家の厨房で、${creatorName}と一緒に1品を調理する特別体験（2時間・2名様）。その後、完成した料理とお酒で乾杯！',
      sponsorRewardDesc: '企業様のロゴを掲載した限定コラボメニューの開発・提供、および店舗での企業展示を実施します。',
    },
    小売: {
      titleKeyword: '新しいショッピング体験',
      titleAction: '進化さ',
      subtitleSuffix: '挑戦',
      backgroundRisk: '地域の商店街が衰退する',
      backgroundHope: '地域の皆様に便利で楽しい買い物体験を提供し',
      visionDescription: 'オンラインとオフラインを融合した新しい店舗形態が生まれ、地域の商店街に活気が戻る。',
      visionBenefit: 'いつでも便利に、そして楽しく買い物ができる場所が残る',
      defaultGoal: 'オンラインショップの立ち上げと店舗リニューアル',
      fundUse1: 'オンラインショップ構築・システム導入',
      fundUse2: '店舗リニューアル・ディスプレイ刷新',
      fundUse3: '新商品開発・仕入れ',
      appealGoal: '地域の商店街に活気を取り戻す',
      entryRewardName: 'お礼のお手紙+オリジナルエコバッグ',
      entryRewardDesc: '心を込めたお礼のお手紙と、当店オリジナルデザインのエコバッグをお送りします。',
      standardRewardName: 'お試しショッピングセット',
      standardRewardDesc: '当店の人気商品3点を特別セットにしてお届けします。ギフト包装も可能です。',
      premiumRewardName: '限定コレクションセット',
      premiumRewardDesc: '本プロジェクト限定のオリジナル商品セット。通常では販売しない特別アイテムが含まれます。',
      vipRewardName: 'プライベートショッピング体験',
      vipRewardDesc: '営業時間外の貸切ショッピング体験（2名様・2時間）。スタッフがコーディネートをサポートし、その後ティータイム付き。',
      sponsorRewardDesc: '店舗での企業ロゴ展示、コラボレーション商品の開発・販売、および店舗イベントでのPRを実施します。',
    },
    サービス: {
      titleKeyword: 'サービスの新展開',
      titleAction: '広げ',
      subtitleSuffix: '挑戦',
      backgroundRisk: '顧客のニーズに応えられなくなる',
      backgroundHope: 'より多くの方に質の高いサービスを提供し',
      visionDescription: '新しいサービスラインが確立され、より多くの顧客に価値を届けられる体制が整う。',
      visionBenefit: 'いつでも、どこでも、質の高いサービスを受けられる',
      defaultGoal: '新サービスの立ち上げと提供体制の拡充',
      fundUse1: '新サービス開発・システム構築',
      fundUse2: 'スタッフ研修・体制強化',
      fundUse3: '集客・マーケティング活動',
      appealGoal: 'サービスの質を落とさず、より多くの人へ',
      entryRewardName: 'お礼のお手紙+オリジナルグッズ',
      entryRewardDesc: '心を込めたお礼のお手紙と、当店オリジナルのロゴグッズ（ステッカーやタオル等）をお送りします。',
      standardRewardName: 'お試しサービス券',
      standardRewardDesc: '当店の基本サービスを1回無料でご利用いただける券をお届けします。ご家族・ご友人へのギフトとしてもお使いいただけます。',
      premiumRewardName: '限定プレミアムサービス',
      premiumRewardDesc: '通常メニューにはない特別サービス。プロジェクト限定の特別コースで、通常の1.5倍の時間をかけた至極の体験をご提供します。',
      vipRewardName: 'プライベートコンサルティング',
      vipRewardDesc: '${creatorName}による1対1のプライベートコンサルティング（2時間）。あなたの課題に合わせた個別アドバイスを実施します。',
      sponsorRewardDesc: '企業向けの特別サービスプランの提供、共同セミナーの開催、およびプロジェクトページでの企業PRを実施します。',
    },
    製造: {
      titleKeyword: 'ものづくりの新境地',
      titleAction: '開拓',
      subtitleSuffix: '挑戦',
      backgroundRisk: '技術の継承が途絶える',
      backgroundHope: '日本のものづくりの価質を世界に発信し',
      visionDescription: '新しい製造ラインが稼働し、これまで作れなかった製品が生まれる。技術の継承も確実なものになる。',
      visionBenefit: '高品質な日本製の製品が手に入り続ける',
      defaultGoal: '新製品開発と製造ラインの導入',
      fundUse1: '製造設備・機械の導入',
      fundUse2: '新製品の試作・開発',
      fundUse3: '販路開拓・展示会出展',
      appealGoal: 'ものづくりの魂を未来へ',
      entryRewardName: 'お礼のお手紙+製造工程見学動画',
      entryRewardDesc: '心を込めたお礼のお手紙と、工場の製造工程を見学できる限定動画の視聴リンクをお送りします。',
      standardRewardName: '新製品お試しセット',
      standardRewardDesc: '今回開発した新製品のミニサイズ版をお届けします。市場に出る前に手に入れる特別な体験です。',
      premiumRewardName: '限定記念モデル',
      premiumRewardDesc: 'プロジェクト支援者限定の記念モデル。シリアルナンバー入りで、世界に〇個だけの特別仕様です。',
      vipRewardName: '工場見学+ものづくり体験',
      vipRewardDesc: '当社の工場を見学いただき、職人と一緒に1品を作る体験（半日・2名様）。お弁当付き。',
      sponsorRewardDesc: '企業様との共同開発プロジェクトの優先交渉権、製造ラインのレンタル優先権、および製品への企業ロゴ刻印を実施します。',
    },
    IT: {
      titleKeyword: 'テクノロジーで新しい未来を',
      titleAction: '切り拓',
      subtitleSuffix: '挑戦',
      backgroundRisk: 'デジタル化の波に乗り遅れる',
      backgroundHope: 'テクノロジーの力で地域の課題を解決し',
      visionDescription: '新しいプロダクトがリリースされ、これまでなかったデジタルサービスが地域を便利にする。',
      visionBenefit: 'テクノロジーの力で日々の生活がもっと便利になる',
      defaultGoal: '新プロダクトの開発とリリース',
      fundUse1: 'プロダクト開発・エンジニアリング',
      fundUse2: 'インフラ・サーバー構築',
      fundUse3: 'ユーザーテスト・マーケティング',
      appealGoal: 'テクノロジーで地域を元気に',
      entryRewardName: 'お礼のお手紙+ベータ版アクセス権',
      entryRewardDesc: '心を込めたお礼のお手紙と、新プロダクトのベータ版への先行アクセス権をお送りします。',
      standardRewardName: '1年間プレミアムプラン',
      standardRewardDesc: '新プロダクトのプレミアムプランを1年間無料でご利用いただけます。一般公開前の先行利用です。',
      premiumRewardName: '限定ライフタイムライセンス',
      premiumRewardDesc: 'プロジェクト支援者限定のライフタイムライセンス（永久利用権）。将来の機能拡張もすべて含まれます。',
      vipRewardName: '開発者と1対1のワークショップ',
      vipRewardDesc: '${creatorName}と1対1で、プロダクトの使い方やカスタマイズ方法を深く学ぶワークショップ（2時間・オンライン）。',
      sponsorRewardDesc: 'プロダクトへの企業ロゴ掲載、APIアクセスの優先提供、および共同開発パートナーとしての優先交渉権を提供します。',
    },
  };

  return templates[industry] || templates['サービス'];
}
