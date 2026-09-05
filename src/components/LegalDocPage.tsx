import React from 'react';
import SiteHeader from '@/components/SiteHeader';
import LegalFooter from '@/components/LegalFooter';
import '@/styles/legal-doc.css';
import type { LegalDoc } from '@/lib/legal-docs';

/**
 * 法務ページ（利用規約／プライバシーポリシー／特商法表記／キャンセルポリシー）の
 * 共通レイアウト。
 *
 * 原稿は Markdown を**一字一句そのまま**保持しており、ここでは
 * 見出し・表・箇条書き・強調の構造をそのままHTMLへ写すだけにする
 * （文言の加工は一切しない）。
 *
 * 表はスマホで横に溢れないことが最優先（返金条件が読めなくなるため）。
 * 390px以下では2列テーブルを「見出し＋値」の縦積みカードに切り替える
 * （CSS側の legal-table--stack）。
 */

/** インライン記法（**強調** のみ）をReactノードへ。原稿の文字は変えない */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(<strong key={`${keyPrefix}-b${i++}`}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { kind: 'h1' | 'h2' | 'h3'; text: string }
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] };

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map(c => c.trim());
}

const isDivider = (line: string) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-');

/** 原稿Markdownをブロック列へ。対応記法は原稿で実際に使われているものに限る */
function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ kind: h[1].length === 1 ? 'h1' : h[1].length === 2 ? 'h2' : 'h3', text: h[2].trim() });
      i++;
      continue;
    }

    // 表: ヘッダ行 + 区切り行 + データ行
    if (line.trim().startsWith('|') && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ kind: 'table', head, rows });
      continue;
    }

    // 箇条書き（- ） / 番号付き（1. ）
    if (/^\s*-\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (ordered ? /^\s*\d+\.\s+/.test(l) : /^\s*-\s+/.test(l)) {
          items.push(l.replace(/^\s*(?:-|\d+\.)\s+/, ''));
          i++;
        } else if (!l.trim() && items.length) {
          // 原稿には項目間に空行が入る箇所があるため、次も同種なら同じリストを継続
          const next = lines[i + 1] ?? '';
          const sameKind = ordered ? /^\s*\d+\.\s+/.test(next) : /^\s*-\s+/.test(next);
          if (!sameKind) break;
          i++;
        } else {
          break;
        }
      }
      blocks.push({ kind: ordered ? 'ol' : 'ul', items });
      continue;
    }

    // 段落（連続する非空行はそのまま改行として保持）
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() &&
           !/^(#{1,3})\s+/.test(lines[i]) &&
           !lines[i].trim().startsWith('|') &&
           !/^\s*-\s+/.test(lines[i]) &&
           !/^\s*\d+\.\s+/.test(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) blocks.push({ kind: 'p', lines: para });
  }
  return blocks;
}

export default function LegalDocPage({ doc }: { doc: LegalDoc }) {
  const blocks = parseBlocks(doc.markdown);
  // H1は原稿1行目にあるので、ページ見出しとして使い本文からは除く
  const h1 = blocks.find(b => b.kind === 'h1') as { kind: 'h1'; text: string } | undefined;
  const body = blocks.filter(b => b.kind !== 'h1');

  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-container">
          <h1 className="legal-title">{h1?.text ?? doc.title}</h1>
          <article className="legal-body">
            {body.map((b, idx) => {
              const k = `b${idx}`;
              if (b.kind === 'h2') return <h2 key={k} className="legal-h2">{renderInline(b.text, k)}</h2>;
              if (b.kind === 'h3') return <h3 key={k} className="legal-h3">{renderInline(b.text, k)}</h3>;
              if (b.kind === 'p') {
                return (
                  <p key={k} className="legal-p">
                    {b.lines.map((l, li) => (
                      <React.Fragment key={`${k}-l${li}`}>
                        {li > 0 && <br />}
                        {renderInline(l, `${k}-l${li}`)}
                      </React.Fragment>
                    ))}
                  </p>
                );
              }
              if (b.kind === 'ul') {
                return (
                  <ul key={k} className="legal-list">
                    {b.items.map((it, ii) => <li key={`${k}-i${ii}`}>{renderInline(it, `${k}-i${ii}`)}</li>)}
                  </ul>
                );
              }
              if (b.kind === 'ol') {
                return (
                  <ol key={k} className="legal-list legal-list--ol">
                    {b.items.map((it, ii) => <li key={`${k}-i${ii}`}>{renderInline(it, `${k}-i${ii}`)}</li>)}
                  </ol>
                );
              }
              if (b.kind !== 'table') return null;
              // 表: 2列は狭い画面で縦積み（data-label をCSSが見出しとして表示する）
              const stack = b.head.length === 2;
              return (
                <div key={k} className="legal-table-wrap">
                  <table className={`legal-table${stack ? ' legal-table--stack' : ''}`}>
                    <thead>
                      <tr>{b.head.map((h2c, hi) => <th key={`${k}-h${hi}`}>{renderInline(h2c, `${k}-h${hi}`)}</th>)}</tr>
                    </thead>
                    <tbody>
                      {b.rows.map((r, ri) => (
                        <tr key={`${k}-r${ri}`}>
                          {r.map((c, ci) => (
                            <td key={`${k}-r${ri}c${ci}`} data-label={b.head[ci] ?? ''}>
                              {renderInline(c, `${k}-r${ri}c${ci}`)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </article>
        </div>
      </main>
      <LegalFooter />
    </>
  );
}
