'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackMetaEvent } from '@/lib/meta-pixel';

/**
 * クライアント遷移（next/link）での PageView。
 *
 * 🔴 Next.js の App Router は内部リンクで再読み込みしないため、
 *    layout に置いたベースコードの PageView は「最初の1回」しか飛ばない。
 *    パスが変わった時だけ PageView を撃って補う。
 * 🔴 初回マウントでは撃たない（ベースコードが既に1回撃っている＝二重計上を防ぐ）。
 */
export default function MetaPixelPageView() {
  const pathname = usePathname();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    trackMetaEvent('PageView');
  }, [pathname]);

  return null;
}
