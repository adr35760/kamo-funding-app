'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { isMetaPixelExcludedPath, trackMetaEvent } from '@/lib/meta-pixel';

/**
 * クライアント遷移（next/link）での PageView。
 *
 * 🔴 Next.js の App Router は内部リンクで再読み込みしないため、
 *    layout に置いたベースコードの PageView は「最初の1回」しか飛ばない。
 *    パスが変わった時だけ PageView を撃って補う。
 * 🔴 初回マウントでは撃たない（ベースコードが既に1回撃っている＝二重計上を防ぐ）。
 * 🔴 遷移先が内部業務ページ（/admin・/work・/ai-tool）なら撃たない
 *    （ベースコード側の先頭一致ガードと同じ判定を src/lib/meta-pixel.ts から使う）。
 */
export default function MetaPixelPageView() {
  const pathname = usePathname();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (isMetaPixelExcludedPath(pathname)) return;
    trackMetaEvent('PageView');
  }, [pathname]);

  return null;
}
