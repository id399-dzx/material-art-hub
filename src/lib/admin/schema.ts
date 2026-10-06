import type { ContentMutation, ContentPatch, ContentSection } from './types.ts';

export class ContentValidationError extends Error {}
export type EditableField = { key: string; label: string; kind: 'text' | 'array' | 'select' | 'url' | 'date'; required?: boolean; limit?: number; choices?: readonly string[]; optionalUrl?: boolean };
const text = (key: string, label: string, required = false, limit = 4000): EditableField => ({ key, label, kind: 'text', required, limit });
const list = (key: string, label: string): EditableField => ({ key, label, kind: 'array' });
const select = (key: string, label: string, choices: readonly string[]): EditableField => ({ key, label, kind: 'select', choices });
const link = (key: string, label: string, optionalUrl = false): EditableField => ({ key, label, kind: 'url', optionalUrl });
export const CONTENT_FIELDS: Record<ContentSection, EditableField[]> = {
    skills: [text('title', '技能名称', true, 160), text('summary', '中文简介', true), select('category', '研究场景', ['literature', 'figure', 'writing', 'presentation', 'computing', 'three-dimensional', 'knowledge']), select('scope', '适用范围', ['research', 'support']), list('features', '主要功能'), text('inputs', '输入内容'), text('outputs', '输出内容'), text('environment', '运行环境'), text('note', '使用提醒'), link('url', '项目链接'), link('readmeUrl', '说明文档链接', true), list('topics', '主题标签'), list('skillPaths', '技能文档路径')],
    templates: [text('name', '模板名称', true, 160), text('english', '英文名称', true, 160), select('category', '图形分类', ['电化学测试', '柱状图', '组成图', '折线图', '散点图', '热图', '分布图', '雷达图', '三维图', '网络与流程']), text('description', '模板简介', true), text('requirement', '数据要求', true), text('tag', '用途标签', false, 120), text('guide', '使用说明'), text('xLabel', '横轴默认文字', false, 160), text('yLabel', '纵轴默认文字', false, 160)],
    journals: [text('name', '期刊名称', true, 160), text('publisher', '出版社', true, 160), select('field', '研究领域', ['综合科研', '材料与能源', '生命科学']), select('policy', '投稿格式政策', ['灵活初次投稿', '有明确版式要求']), text('summary', '中文简介', true), list('officialRequirements', '官方格式要求'), list('manualChecks', '人工核对事项'), link('sourceUrl', '官方指南链接'), text('sourceTitle', '指南名称', true, 255), link('templateUrl', '官方模板链接', true), { key: 'checkedOn', label: '核对日期', kind: 'date' }],
    assets: [text('title', '素材名称', true, 160), text('description', '素材介绍'), list('tags_application', '应用领域'), list('tags_material', '材料体系'), list('tags_process', '物理与化学过程'), list('tags_style', '视觉风格')],
    plugins: [text('title', '插件名称', true, 160), select('host', '适用软件', ['Blender', 'PowerPoint', 'Illustrator', '其他']), text('summary', '中文简介', true), text('version', '显示版本', true, 80), list('features', '主要功能'), list('environment', '运行环境'), list('installation', '安装与使用'), list('outputs', '输出内容')],
};
export const CHOICE_LABELS: Record<string, string> = { literature: '文献与阅读', figure: '科研绘图', writing: '写作与排版', presentation: '论文与汇报', computing: '计算与仿真', 'three-dimensional': '3D 可视化', knowledge: '知识与文档', research: '科研专用', support: '科研辅助' };
export const JOURNAL_OPTION_FIELDS = [
    { key: 'paper', label: '纸张', kind: 'select', choices: ['A4', 'Letter'] },
    { key: 'font', label: '字体', kind: 'select', choices: ['Times New Roman', 'Arial', 'Calibri'] },
    { key: 'fontSize', label: '字号（pt）', kind: 'number', min: 9, max: 16 },
    { key: 'lineSpacing', label: '行距', kind: 'select', choices: ['1', '1.5', '2'] },
    { key: 'marginCm', label: '页边距（cm）', kind: 'number', min: 1.5, max: 3.5 },
    { key: 'lineNumbers', label: '连续行号', kind: 'boolean' },
    { key: 'pageNumbers', label: '页码', kind: 'boolean' },
    { key: 'singleColumn', label: '单栏正文', kind: 'boolean' },
    { key: 'preserveLandscape', label: '保留横向页面', kind: 'boolean' },
] as const;
export const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const fail = (message: string): never => { throw new ContentValidationError(message); };
function validTimestamp(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
    const date = value.slice(0, 10);
    return new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date;
}
function validateOptions(value: unknown): ContentPatch {
    if (!isRecord(value) || Object.keys(value).some(key => !JOURNAL_OPTION_FIELDS.some(field => field.key === key))) return fail('期刊排版参数包含不支持的字段。');
    const result: ContentPatch = {};
    for (const [key, item] of Object.entries(value)) {
        const field = JOURNAL_OPTION_FIELDS.find(field => field.key === key)!;
        if (field.kind === 'boolean') { if (typeof item !== 'boolean') fail(field.label + '必须为开关值。'); }
        else if (field.kind === 'number') { if (typeof item !== 'number' || !Number.isFinite(item) || item < field.min || item > field.max) fail(field.label + '超出允许范围。'); }
        else if (key === 'lineSpacing') { if (![1, 1.5, 2].includes(item as number) || typeof item !== 'number') fail('行距必须为 1、1.5 或 2。'); }
        else if (!field.choices.includes(item as never)) fail(field.label + '无效。');
        result[key] = item;
    }
    return result;
}
export function validateContentPatch(section: ContentSection, value: unknown): ContentPatch {
    if (!isRecord(value)) return fail('修改内容必须为对象。');
    const fields = CONTENT_FIELDS[section];
    const result: ContentPatch = {};
    for (const [key, item] of Object.entries(value)) {
        if (section === 'journals' && key === 'options') { result.options = validateOptions(item); continue; }
        const field = fields.find(field => field.key === key);
        if (!field) fail('不允许修改字段：' + key);
        const spec = field!;
        if (spec.kind === 'array') {
            if (!Array.isArray(item) || item.length > 40 || item.some(entry => typeof entry !== 'string' || !entry.trim() || entry.length > 1000)) fail(spec.label + '最多 40 条，每条不超过 1000 字。');
            const entries = (item as string[]).map(entry => entry.trim());
            if (section === 'assets' && entries.some(entry => entry.startsWith('__fesilent_'))) fail('不能将内部插件标记作为素材标签。');
            result[key] = [...new Set(entries)];
            continue;
        }
        if (typeof item !== 'string' || item.length > (spec.limit ?? 4000)) fail(spec.label + '格式或长度无效。');
        const cleaned = (item as string).trim();
        if (spec.required && !cleaned) fail('请填写' + spec.label + '。');
        if (spec.kind === 'select' && !spec.choices?.includes(cleaned)) fail(spec.label + '不在可选范围内。');
        if (spec.kind === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned) || !Number.isFinite(Date.parse(cleaned)) || new Date(cleaned).toISOString().slice(0, 10) !== cleaned)) fail('请填写有效的核对日期。');
        if (spec.kind === 'url' && !(spec.optionalUrl && !cleaned)) {
            try { const url = new URL(cleaned); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) fail(spec.label + '必须是 HTTP 或 HTTPS 链接。'); }
            catch { fail(spec.label + '必须是 HTTP 或 HTTPS 链接。'); }
        }
        result[key] = cleaned;
    }
    return result;
}
export function validateContentMutation(value: unknown, knownId: (section: ContentSection, id: string) => boolean): ContentMutation {
    if (!isRecord(value) || Object.keys(value).some(key => !['section', 'itemId', 'action', 'patch', 'expectedVersion', 'expected'].includes(key))) return fail('管理请求格式无效。');
    const { section, itemId, action } = value;
    if (typeof section !== 'string' || !Object.hasOwn(CONTENT_FIELDS, section) || typeof itemId !== 'string' || !knownId(section as ContentSection, itemId)) fail('未找到可管理的条目。');
    if (!['edit', 'hide', 'restore', 'reset'].includes(action as string)) fail('不支持该管理操作。');
    if ((section === 'assets' || section === 'plugins') && action === 'reset') fail('素材和插件没有代码默认值，请使用编辑或恢复。');
    const patch = validateContentPatch(section as ContentSection, value.patch ?? {});
    if (action !== 'edit' && Object.keys(patch).length) fail('上下架或恢复操作不能同时修改内容。');
    const mutation = { section, itemId, action, patch } as ContentMutation;
    if (section === 'assets' || section === 'plugins') {
        const expected = value.expected;
        if (!isRecord(expected) || Object.keys(expected).some(key => !['title', 'description', 'hidden'].includes(key)) || typeof expected.title !== 'string' || !(expected.description === null || typeof expected.description === 'string') || typeof expected.hidden !== 'boolean') fail('缺少原始内容版本，请刷新后重试。');
        mutation.expected = expected as ContentMutation['expected'];
        if (!validTimestamp(value.expectedVersion)) fail('缺少有效的素材版本，请刷新后重试。');
        mutation.expectedVersion = value.expectedVersion as string;
    } else {
        if (value.expectedVersion !== null && !validTimestamp(value.expectedVersion)) fail('缺少有效的内容版本，请刷新后重试。');
        mutation.expectedVersion = value.expectedVersion as string | null;
    }
    return mutation;
}
