/**
 * 報酬計算ロジック — t iku確定値に基づく
 * 
 * 紹介パートナー: 総支援金額（税抜）× 2%
 * アドバイザー: KAMO手数料の20% ＋ コンサルフィー¥30,000〜100,000
 * アドバイザー受講料: ¥128,000
 */

export const REWARD_CONFIG = {
  // 紹介パートナー
  REFERRAL_REWARD_RATE: 0.02,  // 総支援金額の2%
  
  // アドバイザー
  ADVISOR_REWARD_RATE: 0.20,   // KAMO手数料の20%
  CONSULTANT_FEE_MIN: 30000,   // コンサルフィー下限
  CONSULTANT_FEE_MAX: 100000,  // コンサルフィー上限
  ADVISOR_COURSE_FEE: 128000,  // 受講料
  
  // KAMOプラットフォーム手数料率（t iku確認待ち — 仮置き10%）
  KAMO_PLATFORM_FEE_RATE: 0.10,
};

export interface RewardCalculation {
  partnerType: 'referral' | 'advisor' | 'supporter';
  totalSupportAmount: number;  // 総支援金額（税抜）
  kamoPlatformFee: number;     // KAMO手数料
  kamoPaidReward: number;      // KAMOから支払う報酬
  consultantFee?: { min: number; max: number };  // コンサルフィー（アドバイザーのみ）
  totalEstimatedReward: number; // 想定総報酬
}

/**
 * 報酬計算
 */
export function calculateReward(
  partnerType: 'referral' | 'advisor' | 'supporter',
  totalSupportAmount: number
): RewardCalculation {
  const kamoPlatformFee = Math.round(totalSupportAmount * REWARD_CONFIG.KAMO_PLATFORM_FEE_RATE);
  
  if (partnerType === 'referral') {
    const reward = Math.round(totalSupportAmount * REWARD_CONFIG.REFERRAL_REWARD_RATE);
    return {
      partnerType,
      totalSupportAmount,
      kamoPlatformFee,
      kamoPaidReward: reward,
      totalEstimatedReward: reward,
    };
  }
  
  if (partnerType === 'advisor') {
    const advisorBaseReward = Math.round(kamoPlatformFee * REWARD_CONFIG.ADVISOR_REWARD_RATE);
    const consultantFee = {
      min: REWARD_CONFIG.CONSULTANT_FEE_MIN,
      max: REWARD_CONFIG.CONSULTANT_FEE_MAX,
    };
    return {
      partnerType,
      totalSupportAmount,
      kamoPlatformFee,
      kamoPaidReward: advisorBaseReward,
      consultantFee,
      totalEstimatedReward: advisorBaseReward + consultantFee.min,
    };
  }
  
  // supporter: 報酬設定なし（コミュニティ参加型）
  return {
    partnerType,
    totalSupportAmount,
    kamoPlatformFee,
    kamoPaidReward: 0,
    totalEstimatedReward: 0,
  };
}

/**
 * 報酬シミュレーション（管理画面・マイページ用）
 */
export function simulateReward(
  partnerType: 'referral' | 'advisor' | 'supporter',
  totalSupportAmount: number
): string {
  const calc = calculateReward(partnerType, totalSupportAmount);
  
  if (partnerType === 'referral') {
    return `紹介料: ¥${calc.kamoPaidReward.toLocaleString()}（総支援金額¥${totalSupportAmount.toLocaleString()}（税抜）× 2%）`;
  }
  
  if (partnerType === 'advisor') {
    return `KAMO報酬: ¥${calc.kamoPaidReward.toLocaleString()}（手数料の20%）＋ コンサルフィー: ¥${calc.consultantFee!.min.toLocaleString()}〜${calc.consultantFee!.max.toLocaleString()} = 想定¥${calc.totalEstimatedReward.toLocaleString()}〜${(calc.kamoPaidReward + calc.consultantFee!.max).toLocaleString()}`;
  }
  
  return `サポーター: 報酬設定なし（コミュニティ参加型）`;
}
