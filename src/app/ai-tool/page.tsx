'use client';

import { useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import LegalFooter from '@/components/LegalFooter';
import GeneratedPageDoc, { generatedDocStyles } from '@/components/GeneratedPageDoc';
import { extendedToJapaneseJSON, type ProjectExtended } from '@/lib/ai-extended';
import {
  REWARD_CATEGORIES,
  REWARD_CATEGORY_LABELS,
  normalizeRewardCategory,
} from '@/lib/ai-prompts';

interface GeneratedPage {
  project: {
    title: string;
    subtitle: string;
    main_image_url: string;
    goal_amount: number;
    project_type: string;
    story: {
      lead: string;
      background: string;
      vision: string;
      use_of_funds: string;
      schedule: string;
      appeal: string;
    };
    creator: {
      name: string;
      avatar: string;
      bio: string;
      organization: string;
    };
    legal_info: Record<string, string>;
    extended?: ProjectExtended;
  };
  rewards: Array<{
    category?: string;
    tier: string;
    title: string;
    description: string;
    image_url: string;
    price: number;
    shipping_included: boolean;
    estimated_delivery: string;
    stock_limit: number | null;
    is_designated: boolean;
    designated_name: string;
    sponsor_name?: string;
  }>;
}

export default function AIToolPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedPage | null>(null);
  const [mode, setMode] = useState<string>('');
  // 3アクションの状態
  const [copied, setCopied] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'sent' | 'duplicate' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  // ヒアリング入力
  const [form, setForm] = useState({
    industry: '',
    businessDescription: '',
    goalAmount: 300000,
    deadlineDays: 30,
    targetAudience: '',
    currentChallenge: '',
    projectTrigger: '',
    crowdfundingGoal: '',
    activityHistory: '',
    creatorName: '',
    organization: '',
  });

  /**
   * 支援金振込口座。
   * ⚠️ 生成用の form とは**別のstate**で持つ。
   * AIへの送信ペイロード・掲載用JSON・PDFのどこにも載せないため、
   * 混入経路が構造的に作れないよう最初から分離している。
   */
  const [bank, setBank] = useState({
    bankName: '',
    branchName: '',
    accountType: '普通',
    accountNumber: '',
    accountHolder: '',
  });

  const updateForm = (key: string, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const updateBank = (key: string, value: string) => {
    setBank(prev => ({ ...prev, [key]: value }));
  };

  const hasBankInput = Object.values(bank).some(v => v && v !== '普通');

  const canProceedStep1 =
    form.industry && form.businessDescription && form.creatorName && form.goalAmount > 0;

  const handleGenerate = async () => {
    setLoading(true);
    setStep(3);
    try {
      // ⚠️ 送るのは form のみ。口座(bank)は別stateなので構造的に混入しない。
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.page);
        setMode(data.mode);
        setStep(4);
      } else {
        alert(data.error || '生成に失敗しました');
        setStep(2);
      }
    } catch {
      alert('通信エラーが発生しました');
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 掲載作業用のJSON。キー名は意味が分かる日本語ラベル付きで整形する。
   * ⚠️ 引数は生成結果(page)のみ。支援金振込口座は別state(bank)なので
   * このJSONに混入する経路が存在しない（KAMO掲載欄に貼る内容だから絶対に載せない）。
   */
  const buildExportJSON = (page: GeneratedPage) => ({
    プロジェクト: {
      タイトル: page.project.title,
      サブタイトル: page.project.subtitle,
      目標金額: page.project.goal_amount,
      プロジェクト種別: page.project.project_type,
      ストーリー: {
        リード: page.project.story.lead,
        '背景・現状': page.project.story.background,
        ビジョン: page.project.story.vision,
        資金使途: page.project.story.use_of_funds,
        スケジュール: page.project.story.schedule,
        訴求メッセージ: page.project.story.appeal,
      },
      起案者: {
        氏名: page.project.creator.name,
        紹介: page.project.creator.bio,
        組織名: page.project.creator.organization,
      },
      '特定商取引法に基づく表示': page.project.legal_info,
      ...(page.project.extended
        ? extendedToJapaneseJSON(page.project.extended, page.project.goal_amount)
        : {}),
    },
    リターン: REWARD_CATEGORIES.reduce((acc, cat) => {
      const items = page.rewards
        .filter(r => normalizeRewardCategory(r.category, r.tier) === cat)
        .map(r => ({
          'リターン名': r.title,
          内容: r.description,
          金額: r.price,
          '提供時期': r.estimated_delivery,
          '在庫上限': r.stock_limit,
          '送料込み': r.shipping_included,
          ...(r.sponsor_name ? { スポンサー名称: r.sponsor_name } : {}),
        }));
      if (items.length > 0) acc[REWARD_CATEGORY_LABELS[cat]] = items;
      return acc;
    }, {} as Record<string, unknown[]>),
  });

  const copyJSON = async () => {
    if (!result) return;
    const text = JSON.stringify(buildExportJSON(result), null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // クリップボードAPIが使えない環境向けのフォールバック
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const submitToKamo = async () => {
    if (!result || submitState === 'sending' || submitState === 'sent' || submitState === 'duplicate') return;
    setSubmitState('sending');
    setSubmitMessage('');
    try {
      const res = await fetch('/api/ai/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // page/input は掲載用（口座を含まない）。口座は bank_account として別に送り、
        // サーバ側でも page とは別カラムに保存する。
        body: JSON.stringify({
          page: result,
          input: form,
          mode,
          ...(hasBankInput ? { bank_account: bank } : {}),
        }),
      });
      const data = await res.json();
      if (data.success && data.duplicate) {
        setSubmitState('duplicate');
        setSubmitMessage('この内容はすでに送信済みです（重複して保存されていません）');
      } else if (data.success) {
        setSubmitState('sent');
        setSubmitMessage('送信しました');
      } else {
        setSubmitState('error');
        setSubmitMessage(data.error || '送信に失敗しました');
      }
    } catch {
      setSubmitState('error');
      setSubmitMessage('通信エラーが発生しました');
    }
  };

  /**
   * PDF出力。日本語フォントの埋め込み事故（豆腐＝□□□）を避けるため、
   * PDF生成ライブラリを使わず「印刷用CSS＋ブラウザのPDF保存」方式にしている。
   * ブラウザが表示に使っている日本語フォントがそのまま出力されるので必ず読める。
   */
  const downloadPDF = () => {
    window.print();
  };

  // パスワード認証画面
  if (!authenticated) {
    const handleAuth = () => {
      const correctPassword = process.env.NEXT_PUBLIC_AI_TOOL_PASSWORD || 'kamo2026';
      if (passwordInput === correctPassword) {
        setAuthenticated(true);
        setPwError('');
      } else {
        setPwError('パスワードが正しくありません');
      }
    };

    return (
      <>
      <SiteHeader current="/ai-tool" />
      <div style={{
        fontFamily: "'Noto Sans JP', sans-serif",
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #FFF5F5 0%, #FFFFFF 100%)',
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: 40,
          width: '100%',
          maxWidth: 380,
          boxShadow: '0 8px 40px rgba(230, 0, 18, 0.15)',
          border: '1px solid #FFE0E0',
          textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#E60012', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <span style={{fontSize: '24px', fontWeight: 900, color: '#fff'}}>AI</span>
          </div>
          <h1 style={{ color: '#E60012', fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
            AIクラファンページ作成ツール
          </h1>
          <p style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
            このツールは限定公開です。<br />パスワードを入力してください。
          </p>
          <input
            type="password"
            value={passwordInput}
            onChange={e => { setPasswordInput(e.target.value); setPwError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            placeholder="パスワード"
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 8,
              border: '2px solid #E0E0E0', fontSize: 15,
              boxSizing: 'border-box', marginBottom: 12,
              textAlign: 'center',
            }}
            autoFocus
          />
          {pwError && (
            <p style={{ color: '#E60012', fontSize: 13, marginBottom: 12 }}>{pwError}</p>
          )}
          <button
            onClick={handleAuth}
            style={{
              width: '100%', padding: '12px', borderRadius: 8,
              border: 'none', background: '#E60012', color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            認証する →
          </button>
          <p style={{ color: '#999', fontSize: 11, marginTop: 16 }}>
            KAMO FUNDING — 共犯者を集め、夢を叶える場所
          </p>
        </div>
      </div>
      <LegalFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader current="/ai-tool" />
    <div style={{ fontFamily: "'Noto Sans JP', sans-serif", maxWidth: 900, margin: '0 auto', padding: 20 }}>
      {/* Brand Header */}
      <div className="print-brand" style={{ marginBottom: 30 }}>
        <h1 style={{ color: '#E60012', fontSize: 28, margin: '0 0 8px' }}>
          🔥 KAMOファンディング AIクラファンページ作成ツール
        </h1>
        <p style={{ color: '#666', fontSize: 14 }}>
          ヒアリングに答えるだけで、クラファンページのひな形を自動生成します
        </p>
      </div>

      {/* Step Indicator */}
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 30 }}>
        {['ヒアリング', '確認', '生成中', 'プレビュー'].map((label, i) => (
          <div key={i} style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 12,
            textAlign: 'center',
            background: step >= i + 1 ? '#E60012' : '#f0f0f0',
            color: step >= i + 1 ? '#fff' : '#999',
          }}>
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {/* Step 1: ヒアリング */}
      {step === 1 && (
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 20 }}>プロジェクト情報を入力してください</h2>
          <div style={{ display: 'grid', gap: 16 }}>
            <Field label="業種" required>
              <select value={form.industry} onChange={e => updateForm('industry', e.target.value)}
                style={inputStyle}>
                <option value="">選択してください</option>
                <option value="飲食">飲食</option>
                <option value="小売">小売</option>
                <option value="サービス">サービス</option>
                <option value="製造">製造</option>
                <option value="IT">IT</option>
                <option value="その他">その他</option>
              </select>
            </Field>

            <Field label="事業概要（3-5文で）" required>
              <textarea value={form.businessDescription}
                onChange={e => updateForm('businessDescription', e.target.value)}
                style={{ ...inputStyle, minHeight: 80 }}
                placeholder="例: 沖縄で地元食材を使った飲食店を5年間運営しています。観光客向けの提供が中心ですが、地元のリピーターを増やしたいと考えています。" />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="目標金額（円）" required>
                <input type="number" value={form.goalAmount}
                  onChange={e => updateForm('goalAmount', Number(e.target.value))}
                  style={inputStyle} min={10000} step={10000} />
              </Field>

              <Field label="募集期間">
                <select value={form.deadlineDays}
                  onChange={e => updateForm('deadlineDays', Number(e.target.value))}
                  style={inputStyle}>
                  <option value={30}>30日</option>
                  <option value={45}>45日</option>
                  <option value={60}>60日</option>
                  <option value={90}>90日</option>
                </select>
              </Field>
            </div>

            <Field label="ターゲット層">
              <select value={form.targetAudience}
                onChange={e => updateForm('targetAudience', e.target.value)}
                style={inputStyle}>
                <option value="">選択してください</option>
                <option value="既存顧客">既存顧客</option>
                <option value="新規顧客">新規顧客</option>
                <option value="地域コミュニティ">地域コミュニティ</option>
                <option value="法人">法人</option>
              </select>
            </Field>

            <Field label="本業の現状課題">
              <textarea value={form.currentChallenge}
                onChange={e => updateForm('currentChallenge', e.target.value)}
                style={{ ...inputStyle, minHeight: 60 }}
                placeholder="例: 観光客の減少で売上が停滞しており、地元顧客の獲得が必要ですが、販路開拓の資金が不足しています。" />
            </Field>

            <Field label="今回プロジェクトをおこなうきっかけについて">
              <textarea value={form.projectTrigger}
                onChange={e => updateForm('projectTrigger', e.target.value)}
                style={{ ...inputStyle, minHeight: 80 }}
                placeholder="例: 常連のお客様から「家でも食べたい」と何度も言われたことがきっかけです。昨年の台風で店を数日閉めたときに、届ける手段がないことの弱さを実感しました。" />
              <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>
                入力すると生成結果の「なぜこの企画を始めたのか」がこの内容を起点に書かれます（空欄の場合はAIが推定して書きます）。
              </p>
            </Field>

            <Field label="クラファンで実現したいこと">
              <textarea value={form.crowdfundingGoal}
                onChange={e => updateForm('crowdfundingGoal', e.target.value)}
                style={{ ...inputStyle, minHeight: 60 }}
                placeholder="例: 新しいデリバリーサービスを立ち上げ、地元顧客にリーチしたい。" />
            </Field>

            <Field label="活動履歴">
              <textarea value={form.activityHistory}
                onChange={e => updateForm('activityHistory', e.target.value)}
                style={{ ...inputStyle, minHeight: 90 }}
                placeholder={'起業してから時系列で記載ください。\n例:\n2019年4月 個人事業として開業\n2021年6月 法人化\n2023年3月 ○○受賞'} />
              <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>
                入力すると生成結果の「活動歴」にそのまま反映されます（空欄の場合はAIが推定して埋めます）。
              </p>
            </Field>

            {/* 支援金振込口座 — KAMO事務局への提出用。掲載内容・PDF・AI生成には使いません */}
            <div style={{
              border: '1px solid #E6D9A8', background: '#FFFDF5',
              borderRadius: 8, padding: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: '#333', marginBottom: 4 }}>
                支援金振込口座（銀行口座）
              </div>
              <p style={{ fontSize: 11, color: '#8A6D1F', margin: '0 0 12px' }}>
                KAMO事務局への提出用です。<strong>掲載用JSON・PDF・AI生成には一切使用しません</strong>（管理画面でのみ確認できます）。未入力でも生成できます。
              </p>
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="銀行名">
                    <input value={bank.bankName} onChange={e => updateBank('bankName', e.target.value)}
                      style={inputStyle} placeholder="例: 三菱UFJ銀行" autoComplete="off" />
                  </Field>
                  <Field label="支店名">
                    <input value={bank.branchName} onChange={e => updateBank('branchName', e.target.value)}
                      style={inputStyle} placeholder="例: 那覇支店" autoComplete="off" />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="口座種別">
                    <select value={bank.accountType} onChange={e => updateBank('accountType', e.target.value)}
                      style={inputStyle}>
                      <option value="普通">普通</option>
                      <option value="当座">当座</option>
                      <option value="貯蓄">貯蓄</option>
                    </select>
                  </Field>
                  <Field label="口座番号">
                    <input value={bank.accountNumber} onChange={e => updateBank('accountNumber', e.target.value)}
                      style={inputStyle} placeholder="例: 1234567" inputMode="numeric" autoComplete="off" />
                  </Field>
                </div>
                <Field label="口座名義">
                  <input value={bank.accountHolder} onChange={e => updateBank('accountHolder', e.target.value)}
                    style={inputStyle} placeholder="例: カブシキガイシャ〇〇" autoComplete="off" />
                </Field>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="起案者名" required>
                <input value={form.creatorName}
                  onChange={e => updateForm('creatorName', e.target.value)}
                  style={inputStyle} placeholder="山田 太郎" />
              </Field>

              <Field label="組織名">
                <input value={form.organization}
                  onChange={e => updateForm('organization', e.target.value)}
                  style={inputStyle} placeholder="株式会社〇〇" />
              </Field>
            </div>
          </div>

          <button onClick={() => setStep(2)} disabled={!canProceedStep1}
            style={{
              marginTop: 24,
              padding: '12px 32px',
              borderRadius: 6,
              border: 'none',
              background: canProceedStep1 ? '#E60012' : '#ccc',
              color: '#fff',
              fontSize: 16,
              cursor: canProceedStep1 ? 'pointer' : 'not-allowed',
            }}>
            確認画面へ →
          </button>
        </div>
      )}

      {/* Step 2: 確認 */}
      {step === 2 && (
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 20 }}>入力内容を確認してください</h2>
          <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <ConfirmRow label="業種" value={form.industry} />
            <ConfirmRow label="事業概要" value={form.businessDescription} />
            <ConfirmRow label="目標金額" value={`¥${form.goalAmount.toLocaleString()}`} />
            <ConfirmRow label="募集期間" value={`${form.deadlineDays}日`} />
            <ConfirmRow label="ターゲット層" value={form.targetAudience} />
            <ConfirmRow label="本業の現状課題" value={form.currentChallenge} />
            <ConfirmRow label="今回プロジェクトをおこなうきっかけ" value={form.projectTrigger} />
            <ConfirmRow label="クラファンで実現したいこと" value={form.crowdfundingGoal} />
            <ConfirmRow label="活動履歴" value={form.activityHistory} />
            <ConfirmRow label="起案者名" value={form.creatorName} />
            <ConfirmRow label="組織名" value={form.organization} />
            {/* 口座は確認画面でもマスク表示（画面共有・スクショ事故を避ける） */}
            <ConfirmRow label="支援金振込口座" value={hasBankInput ? maskBank(bank) : ''} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setStep(1)} style={secondaryBtn}>← 戻る</button>
            <button onClick={handleGenerate} style={primaryBtn}>AIで生成する 🔥</button>
          </div>
        </div>
      )}

      {/* Step 3: 生成中 */}
      {step === 3 && loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🔥</div>
          <p style={{ fontSize: 18, color: '#E60012' }}>AIがクラファンページを生成中...</p>
          <p style={{ color: '#999', fontSize: 14 }}>少々お待ちください</p>
        </div>
      )}

      {/* Step 4: プレビュー */}
      {step === 4 && result && (
        <div>
          <div className="no-print" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>生成結果プレビュー</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {mode && (
                <span style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: mode === 'live' ? '#d4edda' : '#fff3cd',
                  color: mode === 'live' ? '#155724' : '#856404',
                }}>
                  {mode === 'live' ? 'AI生成' : 'モック（APIキー待ち）'}
                </span>
              )}
              <button onClick={copyJSON} style={secondaryBtn}>JSONコピー</button>
              <button onClick={() => { setStep(1); setResult(null); }} style={secondaryBtn}>新規作成</button>
            </div>
          </div>

          {/* 生成結果の表示・印刷用スタイル（PDFはブラウザのPDF保存を使うため
              日本語フォントの埋め込み事故が起きない） */}
          <style jsx global>{generatedDocStyles}</style>

          <GeneratedPageDoc page={result} />

          {/* 生成結果の3アクション（印刷時は非表示） */}
          <div className="result-actions no-print">
            <button onClick={copyJSON} style={primaryBtn}>JSONをコピー</button>
            <button
              onClick={submitToKamo}
              disabled={submitState === 'sending' || submitState === 'sent' || submitState === 'duplicate'}
              style={{
                ...primaryBtn,
                ...(submitState === 'sending' || submitState === 'sent' || submitState === 'duplicate'
                  ? { opacity: 0.55, cursor: 'not-allowed' }
                  : {}),
              }}
            >
              {submitState === 'sending' ? '送信中...' : '結果をKAMOに送信'}
            </button>
            <button onClick={downloadPDF} style={secondaryBtn}>PDFでダウンロード</button>
            <button onClick={() => { setStep(1); setResult(null); setSubmitState('idle'); setSubmitMessage(''); }} style={secondaryBtn}>
              ← やり直す
            </button>
          </div>

          {/* アクションのフィードバック */}
          <div className="no-print" aria-live="polite" style={{ marginTop: 10, minHeight: 22 }}>
            {copied && (
              <span style={{ fontSize: 13, fontWeight: 'bold', color: '#27AE60' }}>
                ✅ コピーしました（KAMOの掲載欄に貼り付けてください）
              </span>
            )}
            {submitMessage && (
              <div style={{
                fontSize: 13,
                fontWeight: 'bold',
                color: submitState === 'error' ? '#E60012' : submitState === 'duplicate' ? '#8A6D1F' : '#27AE60',
              }}>
                {submitState === 'sent' && '✅ '}
                {submitState === 'duplicate' && 'ℹ️ '}
                {submitState === 'error' && '⚠️ '}
                {submitMessage}
              </div>
            )}
          </div>

          <p className="no-print" style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            ※「PDFでダウンロード」は印刷ダイアログが開きます。送信先（プリンタ）で「PDFに保存」を選んでください。
          </p>
        </div>
      )}
    </div>
    <LegalFooter />
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid #ddd',
  fontSize: 14,
  boxSizing: 'border-box',
};

const primaryBtn: React.CSSProperties = {
  padding: '12px 24px',
  borderRadius: 6,
  border: 'none',
  background: '#E60012',
  color: '#fff',
  fontSize: 14,
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  padding: '12px 24px',
  borderRadius: 6,
  border: '1px solid #ddd',
  background: '#fff',
  color: '#333',
  fontSize: 14,
  cursor: 'pointer',
};

/** 口座の確認表示用マスク（銀行名＋下4桁のみ） */
function maskBank(bank: { bankName: string; branchName: string; accountNumber: string }): string {
  const last4 = bank.accountNumber.slice(-4);
  const head = [bank.bankName, bank.branchName].filter(Boolean).join(' ');
  return `${head || '（銀行名未入力）'} ${last4 ? `****${last4}` : ''}`.trim();
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 'bold', marginBottom: 4, color: '#333' }}>
        {label}{required && <span style={{ color: '#E60012' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid #eee' }}>
      <div style={{ width: 180, fontSize: 13, color: '#999', flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}

