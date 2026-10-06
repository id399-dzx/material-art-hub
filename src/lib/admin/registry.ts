import { RESEARCH_SKILLS } from '../research-skills/catalog.ts';
import { JOURNAL_PRESETS } from '../manuscript/journals.ts';
import { DRAWING_TEMPLATES } from '../data-processing/drawing-catalog.ts';
import { validateContentPatch } from './schema.ts';
import type { ContentOverride, ContentSection, StaticSection } from './types.ts';

export const STATIC_CATALOGS: Record<StaticSection, { id: string; item: Record<string, unknown> }[]> = {
    skills: RESEARCH_SKILLS.map(item => ({ id: item.repo, item })),
    journals: JOURNAL_PRESETS.map(item => ({ id: item.id, item })),
    templates: DRAWING_TEMPLATES.map(item => ({ id: item.id, item })),
};
export function knownContentId(section: ContentSection, id: string): boolean {
    if (section === 'assets' || section === 'plugins') return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    return STATIC_CATALOGS[section].some(item => item.id === id);
}
export function validatedOverrides(rows: unknown[]): ContentOverride[] {
    return rows.flatMap(value => {
        const row = value as ContentOverride;
        if (!row || !['skills', 'templates', 'journals'].includes(row.section) || !knownContentId(row.section, row.item_id)) return [];
        if (typeof row.hidden !== 'boolean' || typeof row.updated_at !== 'string') throw new Error('已保存的内容版本无效。');
        return [{ ...row, patch: validateContentPatch(row.section, row.patch) }];
    });
}
export function mergeContentItem<T>(item: T, patch: Record<string, unknown>): T {
    const base = item as Record<string, unknown>;
    return { ...base, ...patch, ...(patch.options ? { options: { ...(base.options as object), ...(patch.options as object) } } : {}) } as T;
}
