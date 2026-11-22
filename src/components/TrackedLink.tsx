'use client';

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { track, type TrackParams } from '@/lib/analytics';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /** 送るイベント名（例: 'case_select' / 'cta_click'） */
  event: string;
  /** イベントのパラメータ（例: { slug } / { position: 'case' }） */
  params?: TrackParams;
  children?: ReactNode;
};

/**
 * クリックを計測するだけの `<a>`。
 *
 * 🔴 遷移は絶対に妨げない：
 *    preventDefault も stopPropagation もしない。track() は同期で例外を投げないので、
 *    外部リンク（Googleカレンダー）・別タブ・ページ内アンカー・修飾キー付きクリックの
 *    どれでも、ブラウザの既定動作がそのまま働く。
 *
 * 🔴 二重計上しない：ハンドラはこの要素に1つだけ付く（ページ側の委譲ハンドラとは別物）。
 *    呼び出し側の onClick が preventDefault する場合も、「押した」事実は先に記録する
 *    （計測 → 元のハンドラの順）。
 */
export default function TrackedLink({ event, params, onClick, children, ...rest }: Props) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    track(event, params);
    onClick?.(e);
  };

  return (
    <a {...rest} onClick={handleClick}>
      {children}
    </a>
  );
}
