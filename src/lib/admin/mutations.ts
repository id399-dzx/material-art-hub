import type { SupabaseClient } from '@supabase/supabase-js';
import { PLUGIN_ASSET_TAG, pluginFromAsset, validatePluginDetails } from '../software-plugins/catalog.ts';
import { ContentHttpError } from './authorization.ts';
import { validateContentPatch } from './schema.ts';
import type { AdminAsset, ContentMutation, ContentOverride, ContentPatch, StaticSection } from './types.ts';

export const ADMIN_ASSET_COLUMNS = 'id,title,description,image_url,source_file_url,tags_application,tags_material,tags_process,tags_style,hidden,created_at,updated_at';
const conflict = (): never => { throw new ContentHttpError('内容已被修改，请刷新后重新编辑。', 409); };
const unavailable = (): never => { throw new ContentHttpError('内容服务暂时无法完成请求，请刷新检查结果后再操作。', 503); };
export async function applyContentMutation(client: SupabaseClient, mutation: ContentMutation) {
    if (mutation.section === 'assets' || mutation.section === 'plugins') return applyAssetMutation(client, mutation);
    const section = mutation.section as StaticSection;
    const { data, error } = await client.from('site_content').select('section,item_id,patch,hidden,updated_at')
        .eq('section', section).eq('item_id', mutation.itemId).maybeSingle();
    if (error) return unavailable();
    const current = data as ContentOverride | null;
    if ((current?.updated_at ?? null) !== mutation.expectedVersion) return conflict();
    const previous = current ? validateContentPatch(section, current.patch) : {};
    let patch = previous;
    if (mutation.action === 'edit') {
        patch = { ...previous, ...mutation.patch, ...(mutation.patch.options ? { options: { ...(previous.options as object), ...(mutation.patch.options as object) } } : {}) };
    }
    const hidden = mutation.action === 'hide' ? true : mutation.action === 'restore' || mutation.action === 'reset' ? false : (current?.hidden ?? false);
    const result = await client.rpc('manage_site_content', {
        p_section: section, p_item_id: mutation.itemId, p_patch: mutation.action === 'reset' ? {} : patch,
        p_hidden: hidden, p_expected: mutation.expectedVersion, p_reset: mutation.action === 'reset',
    });
    if (result.error) return unavailable();
    if (Array.isArray(result.data) && result.data.length === 0) return conflict();
    if (!Array.isArray(result.data) || result.data.length !== 1 || result.data[0].section !== section || result.data[0].item_id !== mutation.itemId) return unavailable();
    return { ok: true, row: mutation.action === 'reset' ? null : result.data[0] };
}

async function applyAssetMutation(client: SupabaseClient, mutation: ContentMutation) {
    const { data, error } = await client.from('assets').select(ADMIN_ASSET_COLUMNS).eq('id', mutation.itemId).maybeSingle();
    if (error) return unavailable();
    const original = data as AdminAsset | null;
    if (!original) throw new ContentHttpError('条目不存在或已不可用。', 404);
    const plugin = original.tags_style?.includes(PLUGIN_ASSET_TAG) ?? false;
    if (plugin !== (mutation.section === 'plugins')) throw new ContentHttpError('条目不属于所选内容分类。', 400);
    const expected = mutation.expected!;
    if (original.title !== expected.title || original.description !== expected.description || original.hidden !== expected.hidden || original.updated_at !== mutation.expectedVersion) return conflict();
    const changes: ContentPatch = { hidden: mutation.action === 'hide' ? true : mutation.action === 'restore' ? false : original.hidden };
    if (mutation.action === 'edit') {
        if (!plugin) Object.assign(changes, mutation.patch);
        else {
            const parsed = pluginFromAsset({ ...original, image_url: original.image_url ?? '/plugin-placeholder.svg', description: original.description ?? '' }, new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin);
            if (!parsed) throw new ContentHttpError('插件安装包信息无效，无法保存介绍。请先检查已发布的安装包。', 422);
            const { title, ...descriptionPatch } = mutation.patch;
            const updated = validatePluginDetails({ ...validatePluginDetails(parsed), ...descriptionPatch });
            changes.description = JSON.stringify(updated);
            if (title !== undefined) changes.title = title;
        }
    }
    const query = client.from('assets').update(changes).eq('id', original.id).eq('updated_at', mutation.expectedVersion!)
        .eq('title', expected.title).eq('hidden', expected.hidden);
    // The trigger advances updated_at on every edit, including tags and package
    // metadata. Keep large descriptions out of the URL; their snapshot was
    // checked above and this version filter also protects the read/write gap.
    const result = await query.select(ADMIN_ASSET_COLUMNS);
    if (result.error) return unavailable();
    if (Array.isArray(result.data) && result.data.length === 0) return conflict();
    if (!Array.isArray(result.data) || result.data.length !== 1 || result.data[0].id !== original.id) return unavailable();
    // This path only updates metadata. Package references, images, hashes and
    // Storage objects stay attached to the original row throughout the write.
    return { ok: true, row: result.data[0] };
}
