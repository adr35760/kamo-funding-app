'use client';

import {
  REWARD_CATEGORIES,
  REWARD_CATEGORY_LABELS,
  REWARD_CATEGORY_STYLES,
  normalizeRewardCategory,
  type RewardCategory,
} from '@/lib/ai-prompts';

/**
 * 生成結果の本文（プロジェクト概要・ストーリー・リターン4カテゴリ・特商法表示）。
 *
 * /ai-tool のプレビューと /admin の PDF出力ページで同じ体裁を使うため、
 * ここに1本化している（片方だけ体裁が変わる事故を防ぐ）。
 * 印刷時に消したいUI（ボタン等）はこのコンポーネントの外に置く。
 */

export interface GeneratedPageData {
  project: {
    title: string;
    subtitle: string;
    main_image_url?: string;
    goal_amount: number;
    project_type?: string;
    story: {
      lead: string;
      background: string;
      vision: string;
      use_of_funds: string;
      schedule: string;
      appeal: string;
    };
    creator: {
      name: string;
      avatar?: string;
      bio?: string;
      organization: string;
    };
    legal_info: Record<string, string>;
  };
  rewards: Array<{
    category?: string;
    tier: string;
    title: string;
    description: string;
    image_url?: string;
    price: number;
    shipping_included?: boolean;
    estimated_delivery?: string;
    stock_limit?: number | null;
    is_designated?: boolean;
    designated_name?: string;
    sponsor_name?: string;
  }>;
}

const tierLabels: Record<string, string> = {
  entry: 'エントリー',
  standard: 'スタンダード',
  premium: 'プレミアム',
  vip: 'VIP',
  sponsor: 'スポンサー',
};

/** 空カテゴリは見出しごと出さない */
export function rewardsByCategory(page: GeneratedPageData) {
  return REWARD_CATEGORIES.map(cat => ({
    category: cat as RewardCategory,
    items: page.rewards.filter(r => normalizeRewardCategory(r.category, r.tier) === cat),
  })).filter(g => g.items.length > 0);
}

export default function GeneratedPageDoc({ page }: { page: GeneratedPageData }) {
  return (
    <>
      {/* Project Header */}
      <div style={{ border: '2px solid #E60012', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ background: '#E60012', color: '#fff', padding: 20 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 22 }}>{page.project.title}</h3>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>{page.project.subtitle}</p>
        </div>
        <div style={{ padding: 20, background: '#fff' }}>
          <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 12, color: '#999' }}>目標金額</span>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#E60012' }}>
                ¥{Number(page.project.goal_amount ?? 0).toLocaleString()}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#999' }}>起案者</span>
              <div style={{ fontSize: 18 }}>{page.project.creator?.name}</div>
              <div style={{ fontSize: 12, color: '#999' }}>{page.project.creator?.organization}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Story */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ color: '#E60012', borderBottom: '2px solid #E60012', paddingBottom: 8, fontSize: 16 }}>
          📖 ストーリー
        </h3>
        <StorySection title="リード" content={page.project.story?.lead} />
        <StorySection title="背景・現状" content={page.project.story?.background} />
        <StorySection title="ビジョン" content={page.project.story?.vision} />
        <StorySection title="資金使途" content={page.project.story?.use_of_funds} />
        <StorySection title="スケジュール" content={page.project.story?.schedule} />
        <StorySection title="訴求メッセージ" content={page.project.story?.appeal} />
      </div>

      {/* Rewards — 商品 / 体験 / サービス / スポンサー の4カテゴリ */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ color: '#E60012', borderBottom: '2px solid #E60012', paddingBottom: 8, fontSize: 16 }}>
          🎁 リターン（商品・体験・サービス・スポンサー）
        </h3>
        {rewardsByCategory(page).map(group => {
          const st = REWARD_CATEGORY_STYLES[group.category];
          return (
            <div key={group.category} style={{ marginTop: 16 }}>
              <h4 style={{
                margin: '0 0 10px',
                fontSize: 15,
                color: st.color,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span aria-hidden="true">{st.icon}</span>
                {REWARD_CATEGORY_LABELS[group.category]}
                <span style={{ fontSize: 12, color: '#999', fontWeight: 'normal' }}>
                  {group.items.length}件
                </span>
              </h4>
              {group.items.map((reward, i) => (
                <div key={i} style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12,
                  borderLeft: `4px solid ${st.color}`,
                }}>
                  <div className="reward-head" style={{ marginBottom: 8 }}>
                    <div>
                      <span style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: '#f0f0f0',
                        color: '#666',
                        marginRight: 8,
                      }}>
                        {tierLabels[reward.tier] || reward.tier}
                      </span>
                      <strong style={{ fontSize: 16 }}>{reward.title}</strong>
                      {reward.sponsor_name && (
                        <span style={{ marginLeft: 8, fontSize: 12, color: '#D4A017', fontWeight: 'bold' }}>
                          ({reward.sponsor_name})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: st.color, whiteSpace: 'nowrap' }}>
                      ¥{Number(reward.price ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <p style={{ fontSize: 14, color: '#555', margin: '4px 0', whiteSpace: 'pre-wrap' }}>{reward.description}</p>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    提供時期: {reward.estimated_delivery}
                    {reward.stock_limit ? ` / 在庫: ${reward.stock_limit}個` : ''}
                    {reward.shipping_included ? ' / 送料込' : ''}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Legal Info（印刷時は展開される — 印刷用CSS側で details > div を表示） */}
      <div style={{ marginBottom: 20 }}>
        <details>
          <summary style={{ cursor: 'pointer', color: '#666', fontSize: 14 }}>
            特定商取引法に基づく表示
          </summary>
          <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 16, marginTop: 8, fontSize: 13 }}>
            {Object.entries(page.project.legal_info ?? {}).map(([key, val]) => (
              val && <div key={key} style={{ marginBottom: 4 }}>
                <strong>{key}:</strong> {val}
              </div>
            ))}
          </div>
        </details>
      </div>
    </>
  );
}

function StorySection({ title, content }: { title: string; content?: string }) {
  if (!content) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <strong style={{ fontSize: 14, color: '#333' }}>{title}</strong>
      <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, margin: '4px 0 0' }}>{content}</p>
    </div>
  );
}

/** 生成結果の表示・印刷共通CSS（/ai-tool と /admin の印刷ページで同一） */
export const generatedDocStyles = `
  .result-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .reward-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  /* 狭い幅では横並びをやめて縦積みにする（確立パターン） */
  @media (max-width: 768px) {
    .result-actions { flex-direction: column; }
    .result-actions button { width: 100%; }
    .reward-head { flex-direction: column; gap: 4px; }
  }
  @media print {
    .no-print, .site-header, .site-header-spacer { display: none !important; }
    .print-brand p { display: none !important; }
    .print-brand { margin-bottom: 12px !important; }
    body { background: #fff; }
    details { display: block; }
    details > div { display: block !important; }
  }
`;
