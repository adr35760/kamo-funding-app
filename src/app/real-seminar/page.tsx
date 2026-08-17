'use client';

import SeminarLanding from '@/components/SeminarLanding';
import { REAL_SEMINAR } from '@/lib/seminar-config';

export default function RealSeminarPage() {
  // ヒーロー画像が届いたら heroImage="/real-seminar-hero.jpg" のように渡すだけでよい
  return <SeminarLanding config={REAL_SEMINAR} />;
}
