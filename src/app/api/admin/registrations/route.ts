import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ registrations: [], error: error.message });
    }
    return NextResponse.json({ registrations: data || [] });
  } catch {
    return NextResponse.json({ registrations: [] });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
