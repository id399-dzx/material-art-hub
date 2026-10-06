import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ContentHttpError, requireContentAdministrator } from '@/lib/admin/authorization';
import { ContentValidationError, validateContentMutation } from '@/lib/admin/schema';
import { knownContentId, validatedOverrides } from '@/lib/admin/registry';
import { ADMIN_ASSET_COLUMNS, applyContentMutation } from '@/lib/admin/mutations';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
function failure(error: unknown) {
    const status = error instanceof ContentHttpError ? error.status : error instanceof ContentValidationError ? 400 : 503;
    const message = error instanceof ContentHttpError || error instanceof ContentValidationError ? error.message : '内容服务暂时无法完成请求，请刷新检查结果后再操作。';
    return NextResponse.json({ error: message }, { status, headers });
}
export async function GET() {
    try {
        const client = await createClient();
        await requireContentAdministrator(client);
        const results = await Promise.allSettled([
            client.from('site_content').select('section,item_id,patch,hidden,updated_at'),
            client.from('assets').select(ADMIN_ASSET_COLUMNS).order('created_at', { ascending: false }),
        ]);
        if (results.some(result => result.status === 'rejected' || result.value.error)) throw new Error('Content read failed');
        const content = results[0], assets = results[1];
        if (content.status !== 'fulfilled' || assets.status !== 'fulfilled') throw new Error('Content read failed');
        return NextResponse.json({ rows: validatedOverrides(content.value.data ?? []), assets: assets.value.data ?? [] }, { headers });
    } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
    try {
        const client = await createClient();
        await requireContentAdministrator(client);
        if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new ContentHttpError('请使用 JSON 提交内容。', 415);
        const body = await request.text();
        if (new TextEncoder().encode(body).length > 128 * 1024) throw new ContentHttpError('内容过大，请精简说明后保存。', 413);
        let value: unknown;
        try { value = JSON.parse(body); } catch { throw new ContentValidationError('提交的内容格式无效。'); }
        const mutation = validateContentMutation(value, knownContentId);
        return NextResponse.json(await applyContentMutation(client, mutation), { headers });
    } catch (error) { return failure(error); }
}
