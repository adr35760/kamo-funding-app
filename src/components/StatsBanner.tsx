import '@/styles/stats-banner.css';
import { STATS_BANNER } from '@/lib/site-stats';

/**
 * 実績バナー（3ページ共通・コンパクトな横長）。
 *
 * 2026-11-21 t iku 指示:
 *   - トップ（/）ファーストビュー直下・成功事例（/success）冒頭・掲載説明会LP（/lp）の
 *     信頼性セクションで**まったく同じ表示**にする。
 *   - 縦に長かった旧バナーを作り直し、PCの高さ160px以下に収める。
 *     上段＝3つの数値（横1列）／中段＝内訳1行／下段＝注記1行。
 *
 * 🔴 文言・数値は src/lib/site-stats.ts の STATS_BANNER のみを参照する
 *    （このコンポーネントにも各ページにも数値を直書きしない）。
 * 🔴 スタイルは src/styles/stats-banner.css に閉じる。各ページの色トークン
 *    （/lp の赤×金など）に依存させない＝白カードとして3ページで同じ見た目にする。
 */
export default function StatsBanner({
  className = '',
  id,
}: {
  /** ページ側で余白だけ足すためのフック（見た目は変えない） */
  className?: string;
  id?: string;
}) {
  const { heading, items, breakdown, source } = STATS_BANNER;

  return (
    <section
      className={`kamo-stats-banner${className ? ` ${className}` : ''}`}
      id={id}
      aria-label={heading}
    >
      <p className="kamo-stats-banner__title">{heading}</p>

      <div className="kamo-stats-banner__grid">
        {items.map((item) => (
          <div className="kamo-stats-banner__item" key={item.value}>
            <p className="kamo-stats-banner__value">{item.value}</p>
            {/* label が無い項目（93.7%）は行の高さを揃えるため透明なプレースホルダを置く */}
            <p className={`kamo-stats-banner__label${item.label ? '' : ' is-empty'}`} aria-hidden={item.label ? undefined : true}>
              {item.label || '\u00a0'}
            </p>
            <p className={`kamo-stats-banner__note${item.emphasis ? ' is-strong' : ''}`}>{item.note}</p>
          </div>
        ))}
      </div>

      <div className="kamo-stats-banner__breakdown">
        <span className="kamo-stats-banner__breakdown-title">{breakdown.heading}</span>
        <ul className="kamo-stats-banner__breakdown-list">
          {breakdown.items.map((item) => (
            <li className="kamo-stats-banner__breakdown-item" key={item.label}>
              <span className="kamo-stats-banner__breakdown-label">{item.label}</span>
              <span className="kamo-stats-banner__breakdown-value">{item.value}</span>
            </li>
          ))}
          <li className="kamo-stats-banner__breakdown-item is-total">
            <span className="kamo-stats-banner__breakdown-label">{breakdown.total.label}</span>
            <span className="kamo-stats-banner__breakdown-value">{breakdown.total.value}</span>
          </li>
        </ul>
      </div>

      <p className="kamo-stats-banner__source">{source}</p>
    </section>
  );
}
