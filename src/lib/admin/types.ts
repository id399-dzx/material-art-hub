export const ADMIN_EMAIL = 'id19991016@gmail.com';
export const STATIC_SECTIONS = ['templates', 'skills', 'journals'] as const;
export type StaticSection = typeof STATIC_SECTIONS[number];
export type ContentSection = StaticSection | 'assets' | 'plugins';
export type ContentPatch = Record<string, unknown>;
export type ContentOverride = { section: StaticSection; item_id: string; patch: ContentPatch; hidden: boolean; updated_at: string };
export type AdminAsset = {
    id: string; title: string; description: string | null; hidden: boolean; image_url: string | null;
    source_file_url: string | null; created_at: string; updated_at: string; tags_application: string[] | null;
    tags_material: string[] | null; tags_process: string[] | null; tags_style: string[] | null;
};
export type ContentAction = 'edit' | 'hide' | 'restore' | 'reset';
export type ContentMutation = {
    section: ContentSection; itemId: string; action: ContentAction; patch: ContentPatch;
    expectedVersion?: string | null;
    expected?: { title: string; description: string | null; hidden: boolean };
};
