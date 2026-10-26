import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isReferralCodeShape, normalizeReferralCode, referralShareUrl } from '@/lib/referral-link';

/**
 * GET /api/admin/referral-stats — 紹介パートナー別の申込数
 *
 * 管理画面「紹介リンク」タブのデータ源。
 *
 * 🔴 この集計でいちばん大事なのは**「0件」と「読めなかった」を区別すること**。
 *    registrations.referral_code は後付けの列なので、SQL未実行の環境では存在しない。
 *    そこで `applications: 0` を返すと、画面が「誰も申し込んでいない」と断定してしまい、
 *    「リンクが効いていない」という誤った判断につながる（実際は計測できていないだけ）。
 *    そのため列が無いときは applications を **null** で返し、columnAvailable:false を添える。
 *    共有リンク自体は列が無くても作れるので、配布は止めない。
 *
 * 未登録コード（パートナー一覧に無いコードが保存されている行）も別枠で返す。
 * 消さずに見せるのは、コードの打ち間違い・パートナー削除の痕跡を潰さないため。
 */

export const dynamic = 'force-dynamic';

interface PartnerRow {
  id: string;
  name: string | null;
  email: string | null;
  organization: string | null;
  partner_type: string | null;
  referral_code: string | null;
  status: string | null;
  created_at: string | null;
}

interface RegistrationRefRow {
  referral_code: string | null;
  created_at: string | null;
}

/** ページあたりの取得件数（PostgREST の既定上限に引っかからないように分割する） */
const PAGE_SIZE = 1000;

/** referral_code 列が未追加か（PGRST204 / 42703） */
function isMissingReferralColumn(error: { code?: string; message?: string }): boolean {
  const msg = error.message || '';
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  return /referral_code/.test(msg) && /column|could not find|does not exist/i.test(msg);
}

export async function GET() {
  // 🔴 getSupabaseAdmin() は環境変数が無いとクエリを投げる前に例外を投げる。
  //    クライアント生成自体を try に入れる（if (error) では拾えない）。
  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { ok: false, error: '管理用のDB接続が設定されていません（環境変数）' },
      { status: 500 }
    );
  }

  // 1) パートナー一覧
  const { data: partnerData, error: partnerError } = await supabase
    .from('partners')
    .select('id, name, email, organization, partner_type, referral_code, status, created_at')
    .order('created_at', { ascending: false });

  if (partnerError) {
    return NextResponse.json(
      { ok: false, error: `パートナー一覧を取得できませんでした: ${partnerError.message}` },
      { status: 500 }
    );
  }
  const partners = (partnerData || []) as PartnerRow[];

  // 2) 申込の紹介コード（列が未追加なら「読めない」として扱う）
  const regRows: RegistrationRefRow[] = [];
  let columnAvailable = true;
  let columnError: string | null = null;

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('registrations')
      .select('referral_code, created_at')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      if (isMissingReferralColumn(error)) {
        columnAvailable = false;
        columnError = error.message || null;
      } else {
        // 列の有無以外の失敗は「読めなかった」として返す（0件に化けさせない）
        return NextResponse.json(
          { ok: false, error: `申込の集計を取得できませんでした: ${error.message}` },
          { status: 500 }
        );
      }
      break;
    }

    const page = (data || []) as RegistrationRefRow[];
    regRows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  // 3) 集計（DB側ではなくJSで数える: 申込件数は数千件規模で、コード別の内訳も見たいため）
  const countByCode = new Map<string, { count: number; lastAppliedAt: string | null }>();
  let unassigned = 0;

  if (columnAvailable) {
    for (const row of regRows) {
      const code = normalizeReferralCode(row.referral_code);
      if (!isReferralCodeShape(code)) {
        unassigned += 1;
        continue;
      }
      const current = countByCode.get(code) ?? { count: 0, lastAppliedAt: null };
      current.count += 1;
      if (row.created_at && (!current.lastAppliedAt || row.created_at > current.lastAppliedAt)) {
        current.lastAppliedAt = row.created_at;
      }
      countByCode.set(code, current);
    }
  }

  const partnerCodes = new Set<string>();

  const partnerRows = partners
    .map(p => {
      const code = normalizeReferralCode(p.referral_code);
      if (code) partnerCodes.add(code);
      const stats = code ? countByCode.get(code) : undefined;
      return {
        id: p.id,
        name: p.name || '（お名前なし）',
        email: p.email,
        organization: p.organization,
        partnerType: p.partner_type,
        status: p.status,
        code,
        shareUrl: code ? referralShareUrl(code) : null,
        // 列が読めないときは null（0 と区別する）
        applications: columnAvailable && code ? (stats?.count ?? 0) : null,
        lastAppliedAt: columnAvailable && code ? (stats?.lastAppliedAt ?? null) : null,
      };
    })
    // 申込数の多い順 → 同数なら新しい登録順（元の並びを保つ）
    .sort((a, b) => (b.applications ?? -1) - (a.applications ?? -1));

  // 4) 未登録コード（保存はされているがパートナー一覧に無い）
  const unknownCodes = columnAvailable
    ? Array.from(countByCode.entries())
        .filter(([code]) => !partnerCodes.has(code))
        .map(([code, s]) => ({ code, count: s.count, lastAppliedAt: s.lastAppliedAt }))
        .sort((a, b) => b.count - a.count)
    : [];

  const totalApplications = columnAvailable
    ? Array.from(countByCode.values()).reduce((sum, s) => sum + s.count, 0)
    : null;

  return NextResponse.json({
    ok: true,
    columnAvailable,
    columnError,
    partners: partnerRows,
    totals: {
      applications: totalApplications,
      unassigned: columnAvailable ? unassigned : null,
      withApplications: columnAvailable
        ? partnerRows.filter(p => (p.applications ?? 0) > 0).length
        : null,
      partners: partnerRows.length,
    },
    unknownCodes,
  });
}
