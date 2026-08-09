import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ partners: [], error: error.message });
    }
    return NextResponse.json({ partners: data || [] });
  } catch {
    return NextResponse.json({ partners: [] });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
