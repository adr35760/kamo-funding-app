'use client';

import { useEffect, useRef, useState } from 'react';
import GeneratedPageDoc, { generatedDocStyles, type GeneratedPageData } from '@/components/GeneratedPageDoc';

/**
 * /admin/ai-print/[id] — 送信済み生成結果のPDF出力ページ
 *
 * 管理画面の「AI生成結果」タブから新しいタブで開き、読み込み完了後に
 * 自動で印刷ダイアログ（＝PDFに保存）を開く。
 *
 * PDFの作り方は /ai-tool と同じ「印刷用CSS＋ブラウザのPDF保存」方式。
 * PDF生成ライブラリを使わないので日本語フォントの埋め込み事故（豆腐）が起きない。
 * 体裁は GeneratedPageDoc に1本化してあるため /ai-tool 出力と同一になる。
 *
 * 保護: src/middleware.ts の Basic認証（matcher の /admin/:path* に含まれる）
 */
export default function AIPrintPage({ params }: { params: { id: string } }) {
  const [page, setPage] = useState<GeneratedPageData | null>(null);
  const [meta, setMeta] = useState<{ title?: string; created_at?: string } | null>(null);
  const [error, setError] = useState('');
  // 「一度だけ自動印刷する」フラグは ref で持つ。
  // state にすると値の更新で effect の依存が変わり、cleanup が
  // setTimeout を取り消してしまい印刷ダイアログが開かない。
  const autoPrinted = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        // view=print: 口座情報を含まないレスポンスを取得する（PDFに載せないため）
        const res = await fetch(`/api/admin/ai-generations?id=${encodeURIComponent(params.id)}&view=print`);
        const data = await res.json();
        if (!res.ok || !data.generation) {
          setError(data.error || '対象の生成結果が見つかりませんでした');
          return;
        }
        setPage(data.generation.page as GeneratedPageData);
        setMeta({ title: data.generation.title, created_at: data.generation.created_at });
      } catch {
        setError('取得に失敗しました');
      }
    })();
  }, [params.id]);

  // 描画が終わってから印刷ダイアログを開く（空ページが印刷されるのを防ぐ）
  useEffect(() => {
    if (!page || autoPrinted.current) return;
    autoPrinted.current = true;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [page]);

  if (error) {
    return (
      <div style={{ fontFamily: "'Noto Sans JP', sans-serif", maxWidth: 900, margin: '0 auto', padding: 40 }}>
        <p style={{ color: '#E60012', fontSize: 14 }}>⚠️ {error}</p>
        <a href="/admin" style={{ fontSize: 13, color: '#666' }}>← 管理画面に戻る</a>
      </div>
    );
  }

  if (!page) {
    return (
      <div style={{ fontFamily: "'Noto Sans JP', sans-serif", textAlign: 'center', padding: 60, color: '#999' }}>
        読み込み中...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Noto Sans JP', sans-serif", maxWidth: 900, margin: '0 auto', padding: 20 }}>
      <style jsx global>{generatedDocStyles}</style>

      {/* 画面のみの操作バー（印刷には出ない） */}
      <div className="no-print" style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        background: '#FFF8E1', border: '1px solid #E6D9A8', borderRadius: 8,
        padding: 12, marginBottom: 20, fontSize: 13,
      }}>
        <button onClick={() => window.print()} style={{
          padding: '10px 18px', borderRadius: 6, border: 'none',
          background: '#E60012', color: '#fff', cursor: 'pointer', fontSize: 13,
        }}>
          PDFでダウンロード
        </button>
        <span style={{ color: '#666' }}>
          印刷ダイアログの「送信先」で「PDFに保存」を選んでください。
        </span>
        <a href="/admin" style={{ marginLeft: 'auto', color: '#666' }}>← 管理画面に戻る</a>
      </div>

      {/* 印刷対象の見出し（/ai-tool のPDFと同じブランド見出し） */}
      <div className="print-brand" style={{ marginBottom: 30 }}>
        <h1 style={{ color: '#E60012', fontSize: 28, margin: '0 0 8px' }}>
          🔥 KAMOファンディング AIクラファンページ作成ツール
        </h1>
        <p style={{ color: '#666', fontSize: 14 }}>
          送信済み生成結果{meta?.created_at ? ` ／ ${formatJst(meta.created_at)}` : ''}
        </p>
      </div>

      <GeneratedPageDoc page={page} />
    </div>
  );
}

function formatJst(iso: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso)) + ' JST';
}
