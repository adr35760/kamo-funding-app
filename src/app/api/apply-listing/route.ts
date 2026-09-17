import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendListingApplicationNotifyEmail } from '@/lib/email';

/**
 * POST /api/apply-listing
 *
 * 掲載申込書（KAMOファンディング申込書）のWebフォームの送信先。
 * 入力項目は申込書（docx）の表と1対1で対応している。
 *
 * 🔴 口座情報を受け取る経路。方針は ai_generations と揃える:
 *   - DBには全体を保存する（事務局が振込に使う）
 *   - **通知メールには下4桁だけ**を載せる（メールは転送・誤送信の経路になる）
 *   - 管理画面の一覧も下4桁のみ。全体は詳細画面でのみ表示
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const companyName = str(body.companyName);
    const contactName = str(body.contactName);
    const contactEmail = str(body.contactEmail);

    // 必須3項目だけを弾く。他は申込書でも空欄のまま返送されることがあるため
    // フォーム側の必須表示に任せ、APIでは落とさない（入力が消えるのが最悪）。
    if (!companyName) {
      return NextResponse.json({ success: false, error: '会社名は必須です' }, { status: 400 });
    }
    if (!contactName) {
      return NextResponse.json({ success: false, error: 'ご担当者のお名前は必須です' }, { status: 400 });
    }
    if (!contactEmail.includes('@')) {
      return NextResponse.json(
        { success: false, error: '有効なメールアドレスを入力してください' },
        { status: 400 }
      );
    }
    if (body.agreedTerms !== true) {
      return NextResponse.json(
        { success: false, error: '出品者向け規約への同意が必要です' },
        { status: 400 }
      );
    }

    const insertData = {
      company_name: companyName,
      representative: str(body.representative) || null,
      company_postal_code: str(body.companyPostalCode) || null,
      company_address: str(body.companyAddress) || null,
      contact_name: contactName,
      contact_department: str(body.contactDepartment) || null,
      contact_phone: str(body.contactPhone) || null,
      contact_email: contactEmail,
      contact_postal_code: str(body.contactPostalCode) || null,
      contact_address: str(body.contactAddress) || null,
      project_name: str(body.projectName) || null,
      project_summary: str(body.projectSummary) || null,
      project_type: str(body.projectType) || null,
      goal_amount: toAmount(body.goalAmount),
      recruit_start_hope: str(body.recruitStartHope) || null,
      recruit_end_hope: str(body.recruitEndHope) || null,
      support_hope: str(body.supportHope) || null,
      bank_name: str(body.bankName) || null,
      bank_branch: str(body.bankBranch) || null,
      bank_account_type: str(body.bankAccountType) || null,
      bank_account_number: str(body.bankAccountNumber) || null,
      bank_account_holder: str(body.bankAccountHolder) || null,
      remarks: str(body.remarks) || null,
      agency: str(body.agency) || null,
      agreed_terms: true,
      status: 'new',
    };

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('listing_applications')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      if (isMissingTable(error)) {
        // 🔴 保存できないまま「送信できました」と見せない。
        //   入力内容が消えるのが最悪なので、そのことを明示して控えを促す。
        console.error('apply-listing: listing_applications テーブルが未作成');
        return NextResponse.json(
          {
            success: false,
            needsMigration: true,
            error:
              '申し訳ありません。ただ今お申し込みを受け付けられません（保存先の準備が完了していません）。お手数ですが入力内容をお控えのうえ、info@local-creation.com までご連絡ください。',
          },
          { status: 503 }
        );
      }
      console.error('apply-listing insert error:', error);
      return NextResponse.json(
        { success: false, error: '保存に失敗しました。お手数ですが時間をおいて再度お試しください。' },
        { status: 500 }
      );
    }

    // 通知メールは**保存が成功したあとだけ**送る。失敗しても申込は成立させる。
    const emailResult = await sendListingApplicationNotifyEmail({
      companyName,
      representative: insertData.representative ?? undefined,
      companyPostalCode: insertData.company_postal_code ?? undefined,
      companyAddress: insertData.company_address ?? undefined,
      contactName,
      contactDepartment: insertData.contact_department ?? undefined,
      contactPhone: insertData.contact_phone ?? undefined,
      contactEmail,
      contactPostalCode: insertData.contact_postal_code ?? undefined,
      contactAddress: insertData.contact_address ?? undefined,
      projectName: insertData.project_name ?? undefined,
      projectSummary: insertData.project_summary ?? undefined,
      projectType: insertData.project_type ?? undefined,
      goalAmount: insertData.goal_amount,
      recruitStartHope: insertData.recruit_start_hope ?? undefined,
      recruitEndHope: insertData.recruit_end_hope ?? undefined,
      supportHope: insertData.support_hope ?? undefined,
      bankMasked: maskBank(insertData.bank_name, insertData.bank_account_number),
      remarks: insertData.remarks ?? undefined,
      agency: insertData.agency ?? undefined,
    });
    if (!emailResult.success) {
      console.error('apply-listing notify email failed:', emailResult.error);
    }

    return NextResponse.json({ success: true, application_id: data.id });
  } catch (err) {
    console.error('API /apply-listing error:', err);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** 「1,500,000」「150万円」等の申告値から数字だけを取る。数字が無ければ null */
function toAmount(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  const digits = str(v).replace(/[^0-9]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 通知メール用。「三菱UFJ銀行 ****6543」 */
function maskBank(bankName: string | null, accountNumber: string | null): string | undefined {
  if (!bankName && !accountNumber) return undefined;
  const tail = accountNumber ? `****${accountNumber.slice(-4)}` : '（口座番号なし）';
  return `${bankName || '（銀行名なし）'} ${tail}`;
}

/** listing_applications テーブルが未作成（マイグレーション未実行）かを判定する */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  const msg = error.message || '';
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    (/listing_applications/.test(msg) &&
      /could not find the table|does not exist/i.test(msg))
  );
}

export const dynamic = 'force-dynamic';
