'use client';

import SeminarLanding from '@/components/SeminarLanding';
import { AI_SEMINAR } from '@/lib/seminar-config';

export default function AiSeminarPage() {
  // ヒーロー画像が届いたら heroImage="/ai-seminar-hero.jpg" のように渡すだけでよい
  return <SeminarLanding config={AI_SEMINAR} />;
}
