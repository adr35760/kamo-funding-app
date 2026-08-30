import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { BankAccountInput, CrowdfundingPage, HearingInput } from '@/lib/ai-prompts';

/**
 * POST /api/ai/submit
 *
 * AIツールの生成結果を KAMO 側（ai_generations テーブル）に保存する。
 *
 * 二重送信防止:
 *  - 生成結果 JSON のハッシュ（content_hash）に UNIQUE 制約を張っており、
 *    同一内容の再送は 23505 で弾かれる → duplicate: true を返す（エラーにしない）
 *  - クライアント側でもボタンを無効化する
 *
 * マイグレーション未実行時（テーブルなし）は 200 + needsMigration:true を返し、
 * 既存機能を壊さない。
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      page?: CrowdfundingPage;
      input?: Partial<HearingInput>;
      mode?: string;
      /** 支援金振込口座。page とは別カラムに保存する（掲載用JSONに混ぜない） */
      bank_account?: Partial<BankAccountInput>;
    };
    const page = body.page;
    const bankAccount = sanitizeBankAccount(body.bank_account);

    if (!page || !page.project || !page.project.title) {
      return NextResponse.json(
        { success: false, error: '送信する生成結果がありません' },
        { status: 400 }
      );
    }

    const contentHash = createHash('sha256')
      .update(JSON.stringify(page))
      .digest('hex');

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('ai_generations')
      .insert({
        title: page.project.title,
        subtitle: page.project.subtitle ?? null,
        creator_name: page.project.creator?.name ?? body.input?.creatorName ?? null,
        organization: page.project.creator?.organization ?? body.input?.organization ?? null,
        goal_amount: page.project.goal_amount ?? null,
        generation_mode: body.mode ?? null,
        hearing_input: body.input ?? null,
        page,
        // 掲載用の page とは別カラム。管理画面のみで表示する。
        bank_account: bankAccount,
        content_hash: contentHash,
      })
      .select('id, created_at')
      .single();

    if (error) {
      // 一意制約違反 = 同じ内容が既に送信済み
      if (error.code === '23505') {
        return NextResponse.json({ success: true, duplicate: true });
      }
      // bank_account カラム未追加（migration-ai-bank-account.sql 未実行）でも
      // 送信そのものは通す。口座だけ保存できないことを案内する。
      if (isMissingBankColumn(error)) {
        const retry = await supabase
          .from('ai_generations')
          .insert({
            title: page.project.title,
            subtitle: page.project.subtitle ?? null,
            creator_name: page.project.creator?.name ?? body.input?.creatorName ?? null,
            organization: page.project.creator?.organization ?? body.input?.organization ?? null,
            goal_amount: page.project.goal_amount ?? null,
            generation_mode: body.mode ?? null,
            hearing_input: body.input ?? null,
            page,
            content_hash: contentHash,
          })
          .select('id, created_at')
          .single();
        if (retry.error) {
          if (retry.error.code === '23505') {
            return NextResponse.json({ success: true, duplicate: true });
          }
          console.error('ai/submit retry insert error:', retry.error.code);
          return NextResponse.json(
            { success: false, error: '送信に失敗しました' },
            { status: 500 }
          );
        }
        return NextResponse.json({
          success: true,
          id: retry.data?.id,
          created_at: retry.data?.created_at,
          ...(bankAccount
            ? {
                warning:
                  '送信しました。ただし口座情報の保存先カラムが未作成のため、口座は保存されていません（supabase/migration-ai-bank-account.sql を実行してください）',
              }
            : {}),
        });
      }
      // テーブル未作成（マイグレーション未実行）
      if (isMissingTable(error)) {
        return NextResponse.json({
          success: false,
          needsMigration: true,
          error:
            '保存先テーブルが未作成です。supabase/migration-ai-generations.sql を Supabase の SQL Editor で実行してください。',
        });
      }
      console.error('ai/submit insert error:', error);
      return NextResponse.json(
        { success: false, error: '送信に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data?.id, created_at: data?.created_at });
  } catch (err) {
    console.error('API /ai/submit error:', err);
    return NextResponse.json(
      { success: false, error: '送信中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * 口座情報を保存できる形に整える。
 * - すべて空なら null（列に何も入れない）
 * - 想定した5項目のみ通す（余計なキーを保存しない）
 * - 値はそのまま保存するが、**ログ・エラーメッセージには出さない**
 */
function sanitizeBankAccount(
  raw: Partial<BankAccountInput> | undefined
): BankAccountInput | null {
  if (!raw) return null;
  const pick = (v: unknown) => String(v ?? '').trim().slice(0, 100);
  const account: BankAccountInput = {
    bankName: pick(raw.bankName),
    branchName: pick(raw.branchName),
    accountType: pick(raw.accountType),
    accountNumber: pick(raw.accountNumber),
    accountHolder: pick(raw.accountHolder),
  };
  const meaningful =
    account.bankName || account.branchName || account.accountNumber || account.accountHolder;
  return meaningful ? account : null;
}

/** bank_account カラムが未追加（マイグレーション未実行）かを判定する */
function isMissingBankColumn(error: { code?: string; message?: string }): boolean {
  const msg = error.message || '';
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    (/bank_account/.test(msg) && /column|could not find/i.test(msg))
  );
}

/**
 * ai_generations テーブルが存在しない（マイグレーション未実行）かを判定する。
 * PostgREST はスキーマキャッシュ由来の PGRST205 を返し、
 * 直接SQL経路では Postgres の 42P01 になるため両方を見る。
 */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /ai_generations/.test(error.message || '') && /could not find the table|does not exist/i.test(error.message || '')
  );
}

export const dynamic = 'force-dynamic';
