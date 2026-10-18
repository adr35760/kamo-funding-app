'use client';

import { useState } from 'react';
import '@/styles/supporter-register.css';
import '@/styles/survey.css';
import SiteHeader from '@/components/SiteHeader';
import LegalFooter from '@/components/LegalFooter';

export interface SurveyEventInfo {
  id: string;
  title: string;
  eventDateFullJa: string;
}

interface Option {
  value: string;
  label?: string;
  num?: string;
  aria?: string;
}

/** 設問の選択肢ピル（5段階・はい/いいえ・はい/検討中/いいえ を共通の見た目で出す） */
function Options({
  name,
  options,
  value,
  onChange,
  scale = false,
}: {
  name: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  scale?: boolean;
}) {
  return (
    <div className={`survey-options${scale ? ' is-scale' : ''}`}>
      {options.map((o) => (
        <label key={o.value} className={`survey-option${value === o.value ? ' is-checked' : ''}`}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            aria-label={o.aria}
          />
          {o.num ? <span className="survey-option-num">{o.num}</span> : null}
          {o.label ? <span>{o.label}</span> : null}
        </label>
      ))}
    </div>
  );
}

const SCALE: Option[] = [
  { value: '1', num: '1', aria: '1（低い）' },
  { value: '2', num: '2', aria: '2' },
  { value: '3', num: '3', aria: '3' },
  { value: '4', num: '4', aria: '4' },
  { value: '5', num: '5', aria: '5（高い）' },
];

const YES_NO: Option[] = [
  { value: 'yes', label: 'はい' },
  { value: 'no', label: 'いいえ' },
];

export default function SurveyForm({ event }: { event: SurveyEventInfo | null }) {
  const [satisfaction, setSatisfaction] = useState('');
  const [clarity, setClarity] = useState('');
  const [listingIntent, setListingIntent] = useState('');
  const [wantsMeeting, setWantsMeeting] = useState('');
  const [wantsSeminar, setWantsSeminar] = useState('');
  const [interestedAdvisor, setInterestedAdvisor] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const showContact = wantsMeeting === 'yes';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // 二重送信の防止: 送信中・送信済みなら何もしない
    if (submitting || submitted) return;

    const missing: string[] = [];
    if (!satisfaction) missing.push('設問1');
    if (!clarity) missing.push('設問2');
    if (!listingIntent) missing.push('設問3');
    if (!wantsMeeting) missing.push('設問4');
    if (!wantsSeminar) missing.push('設問5');
    if (!interestedAdvisor) missing.push('設問6');
    if (missing.length > 0) {
      setError(`未回答の設問があります（${missing.join('・')}）。すべての設問にご回答ください。`);
      return;
    }
    if (!event) {
      setError('対象の説明会が特定できませんでした。配布メールのリンクから開き直してください。');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          satisfaction: Number(satisfaction),
          clarity: Number(clarity),
          listing_intent: listingIntent,
          wants_meeting: wantsMeeting === 'yes',
          wants_seminar: wantsSeminar === 'yes',
          interested_advisor: interestedAdvisor === 'yes',
          name: name.trim(),
          email: email.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '回答の送信に失敗しました。時間をおいて再度お試しください。');
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '回答の送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="survey">
      <SiteHeader current="/survey" />

      <section className="hero">
        <div className="container">
          <div className="hero-badge">2分で完了</div>
          <h1>
            ご参加いただいた説明会について
            <br />
            <span className="gold">アンケート</span>にご協力ください
          </h1>
          <p>
            今後の運営の参考にさせていただきます。全6問・すべて必須です。回答は匿名でも送信できます。
          </p>
        </div>
      </section>

      <section className="form-section" id="survey">
        <div className="container">
          <div className="form-card">
            {submitted ? (
              <div className="success-state">
                <div className="check"></div>
                <h3>ご回答ありがとうございました</h3>
                <p>
                  アンケートを受け付けました。
                  <br />
                  いただいたご意見は今後の運営に活かしてまいります。
                </p>
              </div>
            ) : (
              <>
                <h2>
                  掲載説明会<span className="gold">アンケート</span>
                </h2>
                <p className="form-sub">
                  該当するものをお選びください。所要時間は約2分です。
                </p>

                {event ? (
                  <div className="survey-event">
                    <span className="survey-event-label">対象の説明会</span>
                    <span className="survey-event-title">{event.title}</span>
                    <br />
                    <span className="survey-event-date">{event.eventDateFullJa}</span>
                  </div>
                ) : (
                  <div className="survey-notice">
                    アンケートの対象となる説明会が見つかりませんでした。
                    <br />
                    お手数ですが、配布メールのリンクから開き直してください。
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  {/* 設問1 */}
                  <div className="survey-q">
                    <div className="survey-q-label">
                      <span className="survey-q-num">1</span>
                      <span>本日の説明会の満足度</span>
                      <span className="survey-required">必須</span>
                    </div>
                    <p className="survey-hint">1：不満 〜 5：満足</p>
                    <Options name="satisfaction" options={SCALE} value={satisfaction} onChange={setSatisfaction} scale />
                  </div>

                  {/* 設問2 */}
                  <div className="survey-q">
                    <div className="survey-q-label">
                      <span className="survey-q-num">2</span>
                      <span>説明は分かりやすかったか</span>
                      <span className="survey-required">必須</span>
                    </div>
                    <p className="survey-hint">1：分かりにくい 〜 5：分かりやすい</p>
                    <Options name="clarity" options={SCALE} value={clarity} onChange={setClarity} scale />
                  </div>

                  {/* 設問3 */}
                  <div className="survey-q">
                    <div className="survey-q-label">
                      <span className="survey-q-num">3</span>
                      <span>掲載を検討したいか</span>
                      <span className="survey-required">必須</span>
                    </div>
                    <Options
                      name="listing_intent"
                      options={[
                        { value: 'yes', label: 'はい' },
                        { value: 'considering', label: '検討中' },
                        { value: 'no', label: 'いいえ' },
                      ]}
                      value={listingIntent}
                      onChange={setListingIntent}
                    />
                  </div>

                  {/* 設問4 */}
                  <div className="survey-q">
                    <div className="survey-q-label">
                      <span className="survey-q-num">4</span>
                      <span>生島との個別ミーティングを希望するか</span>
                      <span className="survey-required">必須</span>
                    </div>
                    <Options name="wants_meeting" options={YES_NO} value={wantsMeeting} onChange={setWantsMeeting} />
                  </div>

                  {/* 個別ミーティング希望＝はい のときだけ入力を促す（任意） */}
                  {showContact && (
                    <div className="survey-contact">
                      <p className="survey-contact-note">
                        個別ミーティングのご案内のため、お名前とメールアドレスをご入力ください（任意）。
                      </p>
                      <div className="form-group">
                        <label>お名前</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="鴨頭 太郎"
                          autoComplete="name"
                        />
                      </div>
                      <div className="form-group">
                        <label>メールアドレス</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="example@email.com"
                          autoComplete="email"
                          inputMode="email"
                        />
                      </div>
                    </div>
                  )}

                  {/* 設問5 */}
                  <div className="survey-q">
                    <div className="survey-q-label">
                      <span className="survey-q-num">5</span>
                      <span>オンライン・リアルセミナーは参加したいですか？</span>
                      <span className="survey-required">必須</span>
                    </div>
                    <Options name="wants_seminar" options={YES_NO} value={wantsSeminar} onChange={setWantsSeminar} />
                  </div>

                  {/* 設問6 */}
                  <div className="survey-q">
                    <div className="survey-q-label">
                      <span className="survey-q-num">6</span>
                      <span>クラファンのアドバイザー及び紹介報酬制度は興味ありますか？</span>
                      <span className="survey-required">必須</span>
                    </div>
                    <Options
                      name="interested_advisor"
                      options={YES_NO}
                      value={interestedAdvisor}
                      onChange={setInterestedAdvisor}
                    />
                  </div>

                  {error && <div className="survey-error">{error}</div>}

                  <button
                    type="submit"
                    className="form-submit"
                    disabled={submitting || submitted}
                    style={submitting ? { opacity: 0.7 } : {}}
                  >
                    {submitting ? '送信中...' : '回答を送信する →'}
                  </button>
                  <p className="form-note">
                    ※ 回答は匿名でも送信できます（お名前・メールアドレスは任意です）
                    <br />※ 二重送信はできません
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="footer">
        &copy; 2026 KAMO FUNDING. All rights reserved.
        <LegalFooter />
      </div>
    </div>
  );
}
