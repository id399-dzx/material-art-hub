import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { validatedOverrides } from '@/lib/admin/registry';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export async function GET() {
    try {
        const client = await createClient();
        const { data, error } = await client.from('site_content').select('section,item_id,patch,hidden,updated_at');
        if (error) throw error;
        return NextResponse.json({ rows: validatedOverrides(data ?? []) }, { headers });
    } catch {
        return NextResponse.json({ error: '目录配置暂时无法读取，请稍后刷新重试。' }, { status: 503, headers });
    }
}
