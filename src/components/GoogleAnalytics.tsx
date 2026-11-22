'use client';

import { useEffect } from 'react';
import { initAnalytics } from '@/lib/analytics';

/**
 * GA4 の読み込み（全ページ共通）。
 *
 * 🔴 測定IDはビルド時に埋め込まれる公開値（秘密情報ではない）。
 *    環境変数 `NEXT_PUBLIC_GA_ID` があればそれを優先し、無ければ下の定数を使う。
 *    Vercel の環境変数を触れない場合でも計測が動くようにするための既定値。
 */
const DEFAULT_GA_ID = 'G-DPL8W2ZH4X';

export default function GoogleAnalytics() {
  useEffect(() => {
    initAnalytics(process.env.NEXT_PUBLIC_GA_ID || DEFAULT_GA_ID);
  }, []);
  return null;
}
