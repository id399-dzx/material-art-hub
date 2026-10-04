import { DOMParser, XMLSerializer, type Element as XmlElement } from '@xmldom/xmldom';
import type { ExportSettings, FigureIssue } from './publication.ts';

export type FigureAsset = { id: string; name: string; kind: 'template' | 'processing' | 'upload'; width: number; height: number; svg?: string; dataUrl?: string; demo?: boolean; attribution?: string; caption?: string; editSnapshot?: unknown };
export type CompositionPanel = { id: string; assetId: string; x: number; y: number; width: number; height: number; caption: string };
export type CompositionDocument = { version: 1; name: string; assets: FigureAsset[]; panels: CompositionPanel[]; width: number; height: number; gap: number; margin: number; layout: 'grid' | 'row' | 'column' | 'hero-top' | 'hero-left'; columns: number; labelStyle: 'a' | 'A' | '(a)' | '1' | 'none'; labelSize: number; fontFamily: string; exportSettings?: ExportSettings; heightMode?: 'auto' | 'fixed' };

export const MAX_FIGURE_BYTES = 20 * 1024 * 1024;
export const MAX_COMPOSITION_BYTES = 64 * 1024 * 1024;
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const ELEMENTS = new Set('svg g defs path rect circle ellipse line polyline polygon text tspan textPath title desc clipPath mask linearGradient radialGradient stop pattern use image symbol marker filter feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence'.split(' '));
const PRESENTATION = new Set('fill fill-opacity fill-rule stroke stroke-opacity stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset opacity color font-family font-size font-style font-weight font-variant letter-spacing word-spacing text-anchor dominant-baseline alignment-baseline baseline-shift clip-path clip-rule mask filter visibility display vector-effect paint-order color-interpolation color-interpolation-filters shape-rendering text-rendering image-rendering'.split(' '));
const ATTRIBUTES = new Set(('id x y x1 y1 x2 y2 dx dy width height viewBox preserveAspectRatio transform d points rx ry r cx cy fx fy fr offset gradientUnits gradientTransform spreadMethod patternUnits patternContentUnits patternTransform clipPathUnits maskUnits maskContentUnits markerWidth markerHeight refX refY orient markerUnits marker-start marker-mid marker-end href xlink:href xmlns xmlns:xlink xml:space version lengthAdjust textLength startOffset method spacing in in2 result type values mode operator k1 k2 k3 k4 stdDeviation edgeMode kernelMatrix kernelUnitLength divisor bias order targetX targetY scale xChannelSelector yChannelSelector baseFrequency numOctaves seed stitchTiles flood-color flood-opacity stop-color stop-opacity surfaceScale diffuseConstant specularConstant specularExponent limitingConeAngle azimuth elevation pointsAtX pointsAtY pointsAtZ z exponent slope intercept amplitude tableValues radius').split(' '));
const escapeXml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
const round = (value: number) => Math.round(value * 1000) / 1000;
const byteLength = (value: string) => new TextEncoder().encode(value).length;
const idValid = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(value);
export function createFigureId(prefix = 'figure'): string { return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`}`; }

function parseSvg(source: string) {
    if (typeof source !== 'string' || !source.trim() || byteLength(source) > MAX_FIGURE_BYTES) throw new Error('SVG 为空或超过 20 MB，请缩小文件后重试。');
    if (/<!DOCTYPE|<!ENTITY|<\?/i.test(source.replace(/^\s*<\?xml\s[^?]*\?>/, ''))) throw new Error('SVG 包含不支持的 XML 声明。');
    try {
        const doc = new DOMParser({ onError: () => { throw new Error('Invalid SVG'); } }).parseFromString(source, 'image/svg+xml');
        if (doc.documentElement?.localName !== 'svg') throw new Error('Missing SVG');
        return doc;
    } catch { throw new Error('SVG 结构损坏，请重新导出标准 SVG。'); }
}

/** Accept self-contained bitmap data only, never links to remote files. */
export function validateBitmapDataUrl(value: unknown): string {
    if (typeof value !== 'string' || value.length > Math.ceil(MAX_FIGURE_BYTES * 4 / 3) + 100) throw new Error('图片超过 20 MB 或内容无效。');
    const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match || match[2].length % 4 !== 0) throw new Error('图片必须是自包含的 PNG 或 JPEG，不能引用外部网址。');
    const bytes = atob(match[2].slice(0, 48));
    if (match[1] === 'png' ? !bytes.startsWith('\x89PNG\r\n\x1a\n') : !bytes.startsWith('\xff\xd8\xff')) throw new Error('图片的格式与内容不一致。');
    return value;
}

function svgLength(value: string | null) {
    const match = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(px|pt|mm|cm|in)?\s*$/.exec(value ?? '');
    if (!match) return NaN;
    return Number(match[1]) * ({ px: 1, pt: 96 / 72, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 }[match[2] ?? 'px'] ?? 1);
}

function fontAttributes(value: string): [string, string][] {
    const match = /^(.*?)\s*(\d+(?:\.\d+)?(?:px|pt|mm|cm|in|em|rem|%))(?:\s*\/\s*(?:normal|\d+(?:\.\d+)?(?:px|pt|em|rem|%)?))?\s+(.+)$/.exec(value.trim());
    if (!match || !/^[\p{L}\p{N}\s'",._-]+$/u.test(match[3])) throw new Error('SVG 字体缩写无法解析，请使用 font-size 与 font-family 展示属性。');
    const attrs: [string, string][] = [['font-size', match[2]], ['font-family', match[3]], ['font-style', 'normal'], ['font-weight', 'normal'], ['font-variant', 'normal']];
    for (const token of match[1].trim().split(/\s+/).filter(Boolean)) {
        if (token === 'normal') continue;
        const key = ['italic', 'oblique'].includes(token) ? 'font-style' : ['bold', 'bolder', 'lighter'].includes(token) || /^[1-9]00$/.test(token) ? 'font-weight' : token === 'small-caps' ? 'font-variant' : null;
        if (!key) throw new Error('SVG 字体缩写包含不支持的设置，请转换为独立展示属性。');
        const attribute = attrs.find(item => item[0] === key)!; attribute[1] = token;
    }
    return attrs;
}

function inlineStaticStyles(root: XmlElement) {
    const all = [root, ...Array.from(root.getElementsByTagName('*'))];
    const rules: { selectors: string[]; values: [string, string][]; order: number }[] = [];
    for (const style of all.filter(node => node.localName === 'style')) {
        if (style.namespaceURI && style.namespaceURI !== SVG_NS) throw new Error('SVG 包含不支持的样式命名空间。');
        let css = (style.textContent ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
        if (/[<>\\]|@|expression\s*\(/i.test(css)) throw new Error('SVG 使用动态或外部 CSS，请导出静态 SVG。');
        css = css.replace(/([^{}]+)\{([^{}]*)\}/g, (_, selectorSource: string, body: string) => {
            const selectors = selectorSource.split(',').map(selector => selector.trim());
            if (selectors.some(selector => !/^(?:\*|[A-Za-z][A-Za-z0-9]*|[.#][A-Za-z_][A-Za-z0-9_-]*)$/.test(selector))) throw new Error('SVG 使用不支持的 CSS 选择器，请转换为内联展示属性。');
            const values: [string, string][] = body.split(';').filter(part => part.trim()).flatMap(part => {
                const colon = part.indexOf(':'), key = part.slice(0, colon).trim(), value = part.slice(colon + 1).trim();
                if (colon < 0 || key !== 'font' && !PRESENTATION.has(key) || /!important/i.test(value)) throw new Error('SVG 使用不支持的 CSS 属性，请转换为内联展示属性。');
                return key === 'font' ? fontAttributes(value) : [[key, value]];
            });
            rules.push({ selectors, values, order: rules.length });
            if (rules.length > 500) throw new Error('SVG 样式规则过多，请简化后重试。');
            return '';
        });
        if (css.trim()) throw new Error('SVG 样式结构损坏，请重新导出。');
        style.parentNode?.removeChild(style);
    }
    for (const node of all.filter(item => item.localName !== 'style')) {
        const applied = rules.flatMap(rule => {
            const matched = rule.selectors.filter(selector => selector === '*' || selector === node.localName || selector.startsWith('#') && selector.slice(1) === node.getAttribute('id') || selector.startsWith('.') && (node.getAttribute('class') ?? '').split(/\s+/).includes(selector.slice(1)));
            if (!matched.length) return [];
            const specificity = Math.max(...matched.map(selector => selector.startsWith('#') ? 100 : selector.startsWith('.') ? 10 : selector === '*' ? 0 : 1));
            return [{ ...rule, specificity }];
        }).sort((a, b) => a.specificity - b.specificity || a.order - b.order);
        for (const rule of applied) for (const [key, value] of rule.values) node.setAttribute(key, value);
    }
}

/** Strict static SVG subset. Vector elements and local paint references remain editable. */
export function sanitizeFigureSvg(source: string, prefix?: string): { svg: string; width: number; height: number } {
    const doc = parseSvg(source), root = doc.documentElement!;
    // Exporter metadata is not displayed. Drop it before checking visible vector content.
    for (const metadata of Array.from(root.getElementsByTagName('*')).filter(node => node.localName === 'metadata' && (!node.namespaceURI || node.namespaceURI === SVG_NS))) metadata.parentNode?.removeChild(metadata);
    inlineStaticStyles(root);
    const nodes = [root, ...Array.from(root.getElementsByTagName('*'))];
    if (nodes.length > 100000) throw new Error('SVG 图形元素过多，请简化后重试。');
    const ids = new Map<string, string>(), safePrefix = prefix ? prefix.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) : '';
    for (const node of nodes) {
        if (!ELEMENTS.has(node.localName ?? '') || node.namespaceURI && node.namespaceURI !== SVG_NS) throw new Error(`SVG 包含不支持的 ${node.localName ?? '元素'}；请导出静态矢量图。`);
        let depth = 0; for (let parent = node.parentNode; parent; parent = parent.parentNode) if (++depth > 100) throw new Error('SVG 层级过深，请简化后重试。');
        const id = node.getAttribute('id');
        if (id) {
            if (!idValid(id) || ids.has(id)) throw new Error('SVG 内部标识重复或无效，请重新导出。');
            ids.set(id, safePrefix ? `${safePrefix}-${id}` : id);
        }
    }
    const reference = (id: string) => { const mapped = ids.get(id); if (!mapped) throw new Error('SVG 引用了不存在的图形标识。'); return mapped; };
    for (const node of nodes) {
        for (const attr of Array.from(node.attributes)) {
            const name = attr.name, value = attr.value.trim();
            if (/^on/i.test(name)) throw new Error('SVG 含事件脚本，不能加入组图。');
            if (attr.namespaceURI && ![XLINK_NS, XML_NS, XMLNS_NS].includes(attr.namespaceURI)) { node.removeAttribute(name); continue; }
            if (attr.namespaceURI === XMLNS_NS) { if (![SVG_NS, XLINK_NS, XML_NS].includes(value)) node.removeAttribute(name); continue; }
            if (attr.namespaceURI === XLINK_NS && attr.localName === 'href' && name !== 'xlink:href') { node.removeAttribute(name); node.setAttributeNS(XLINK_NS, 'xlink:href', value); continue; }
            if (name === 'style') {
                node.removeAttribute(name);
                for (const part of value.split(';').filter(item => item.trim())) {
                    const colon = part.indexOf(':'), key = part.slice(0, colon).trim(), cssValue = part.slice(colon + 1).trim();
                    if (colon < 0 || key !== 'font' && !PRESENTATION.has(key) || /[{}<>\\]|@|expression\s*\(|!important/i.test(cssValue)) throw new Error('SVG 使用不支持的 CSS 样式，请导出带内联展示属性的 SVG。');
                    for (const [property, propertyValue] of key === 'font' ? fontAttributes(cssValue) : [[key, cssValue]]) node.setAttribute(property, propertyValue);
                }
                continue;
            }
            if (!ATTRIBUTES.has(name) && !PRESENTATION.has(name)) node.removeAttribute(name);
        }
        for (const attr of Array.from(node.attributes)) {
            const name = attr.name; let value = attr.value;
            if (name === 'xmlns' || attr.namespaceURI === XMLNS_NS) continue;
            if (/javascript\s*:|vbscript\s*:|expression\s*\(|[<>\\]/i.test(value)) throw new Error('SVG 包含不安全的属性。');
            if (name === 'id') value = reference(value);
            else if (name === 'href' || name === 'xlink:href') {
                if (value.startsWith('#')) value = `#${reference(value.slice(1))}`;
                else if (node.localName === 'image') value = validateBitmapDataUrl(value);
                else throw new Error('SVG 不能引用外部网址、脚本或文件。');
            } else {
                if (/url\s*\(/i.test(value)) {
                    value = value.replace(/url\(\s*['"]?#([^\s)'" ]+)['"]?\s*\)/gi, (_, id: string) => `url(#${reference(id)})`);
                    if (/url\s*\(/i.test(value.replace(/url\(#[A-Za-z0-9_.:-]+\)/g, ''))) throw new Error('SVG 只能使用图内定义的样式，不能引用外部资源。');
                }
                if (/https?:|file:|data:|\/\//i.test(value)) throw new Error('SVG 不能引用外部资源。');
            }
            node.setAttribute(name, value);
        }
    }
    const byId = new Map(nodes.filter(node => node.getAttribute('id')).map(node => [node.getAttribute('id')!, node])), visited = new Set<string>(), visiting = new Set<string>();
    const visitReference = (id: string) => {
        if (visiting.has(id)) throw new Error('SVG 包含循环图形引用。');
        if (visited.has(id)) return;
        if (visiting.size > 100) throw new Error('SVG 图形引用层级过深。');
        const target = byId.get(id); if (!target) return;
        visiting.add(id);
        const uses = target.localName === 'use' ? [target] : Array.from(target.getElementsByTagName('*')).filter(node => node.localName === 'use');
        for (const use of uses) { const href = use.getAttribute('href') || use.getAttribute('xlink:href'); if (href?.startsWith('#')) visitReference(href.slice(1)); }
        visiting.delete(id); visited.add(id);
    };
    for (const use of nodes.filter(node => node.localName === 'use')) { const href = use.getAttribute('href') || use.getAttribute('xlink:href'); if (href?.startsWith('#')) visitReference(href.slice(1)); }
    const viewBox = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
    const width = viewBox.length === 4 ? viewBox[2] : svgLength(root.getAttribute('width')), height = viewBox.length === 4 ? viewBox[3] : svgLength(root.getAttribute('height'));
    if (![width, height].every(value => Number.isFinite(value) && value > 0 && value <= 50000) || viewBox.length === 4 && !viewBox.every(Number.isFinite)) throw new Error('SVG 缺少有效的尺寸或 viewBox。');
    root.setAttribute('xmlns', SVG_NS); root.setAttribute('xmlns:xlink', XLINK_NS);
    root.setAttribute('width', String(width)); root.setAttribute('height', String(height));
    if (viewBox.length !== 4) root.setAttribute('viewBox', `0 0 ${width} ${height}`);
    // Comments do not affect figure appearance and must not carry embedded markup.
    for (const node of nodes) for (const child of Array.from(node.childNodes)) if ([7, 8].includes(child.nodeType)) node.removeChild(child);
    return { svg: new XMLSerializer().serializeToString(root), width, height };
}

/** ECharts puts its final geometry in attributes; only hover and animation CSS is removed. */
export function prepareChartSvg(source: string): string {
    const doc = parseSvg(source), root = doc.documentElement!;
    for (const style of Array.from(root.getElementsByTagName('style'))) {
        let css = style.textContent ?? '';
        if (/url\s*\(|@import|expression\s*\(|[<>\\]/i.test(css)) throw new Error('图表 SVG 包含不支持的 CSS。');
        css = css.replace(/@keyframes\s+zr\d+-ani-\d+\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
        css = css.replace(/\.zr\d+-cls-\d+(:hover)?\s*\{([^{}]*)\}/g, (block, hover: string | undefined, body: string) => {
            const keys = body.split(';').filter(item => item.trim()).map(item => item.split(':')[0].trim());
            const allowed = hover ? ['cursor', 'pointer-events', 'fill', 'stroke', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-width'] : ['animation', 'animation-delay', 'animation-timing-function'];
            return keys.every(key => allowed.includes(key)) ? '' : block;
        });
        if (css.trim()) throw new Error('图表包含影响静态外观的 CSS，请先转换为展示属性。');
        style.parentNode?.removeChild(style);
    }
    return sanitizeFigureSvg(new XMLSerializer().serializeToString(root)).svg;
}

export function createComposition(): CompositionDocument {
    return { version: 1, name: '我的论文组图', assets: [], panels: [], width: 1200, height: 800, gap: 24, margin: 32, layout: 'grid', columns: 2, labelStyle: 'a', labelSize: 24, fontFamily: 'Arial', heightMode: 'auto', exportSettings: { widthMm: 180, dpi: 300, grayscale: false, preset: 'double' } };
}

function bounded(input: unknown, label: string, min: number, max: number, integer = false): number {
    if (typeof input !== 'number' || !Number.isFinite(input) || input < min || input > max || integer && !Number.isInteger(input)) throw new Error(`${label}应为 ${min}–${max}${integer ? ' 的整数' : ''}。`);
    return input;
}
function textValue(input: unknown, label: string, max: number, fallback = ''): string {
    if (input === undefined) return fallback;
    if (typeof input !== 'string' || input.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input)) throw new Error(`${label}格式无效或过长。`);
    return input;
}
function record(input: unknown): Record<string, unknown> { if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('组图工程结构无效。'); return input as Record<string, unknown>; }
function snapshotCopy(input: unknown): unknown {
    if (input === undefined) return undefined;
    let count = 0;
    const inspect = (value: unknown, depth: number) => {
        if (++count > 1000000 || depth > 64) throw new Error('原图编辑数据过大或层级过深。');
        if (value === null || ['string', 'boolean'].includes(typeof value)) return;
        if (typeof value === 'number' && Number.isFinite(value)) return;
        if (Array.isArray(value)) { value.forEach(item => inspect(item, depth + 1)); return; }
        if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
            for (const [key, item] of Object.entries(value)) {
                if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('原图编辑数据含不支持的字段。');
                if (item !== undefined) inspect(item, depth + 1);
            }
            return;
        }
        throw new Error('原图编辑数据应为可保存的 JSON 数据。');
    };
    inspect(input, 0);
    return JSON.parse(JSON.stringify(input));
}

export function validateComposition(input: unknown): CompositionDocument {
    const value = record(input);
    if (value.version !== 1 || !Array.isArray(value.assets) || !Array.isArray(value.panels) || value.assets.length > 100 || value.panels.length > 100) throw new Error('不支持该工程版本，或图片数量超过 100 张。');
    const layouts = ['grid', 'row', 'column', 'hero-top', 'hero-left'], labels = ['a', 'A', '(a)', '1', 'none'];
    if (!layouts.includes(value.layout as string) || !labels.includes(value.labelStyle as string)) throw new Error('工程中的布局或标号样式无效。');
    const doc: CompositionDocument = {
        version: 1, name: textValue(value.name, '工程名称', 200, '我的论文组图'), assets: [], panels: [],
        width: bounded(value.width, '画布宽度', 300, 6000), height: bounded(value.height, '画布高度', 100, 20000), gap: bounded(value.gap, '间距', 0, 240), margin: bounded(value.margin, '边距', 0, 300),
        columns: bounded(value.columns, '列数', 1, 6, true), labelSize: bounded(value.labelSize, '标号字号', 8, 96), fontFamily: textValue(value.fontFamily, '字体', 120, 'Arial'), layout: value.layout as CompositionDocument['layout'], labelStyle: value.labelStyle as CompositionDocument['labelStyle'],
    };
    if (!doc.fontFamily.trim() || /[<>";{}\\]/.test(doc.fontFamily)) throw new Error('字体名称无效。');
    if (value.heightMode !== undefined && !['auto', 'fixed'].includes(value.heightMode as string)) throw new Error('画布高度模式无效。');
    doc.heightMode = value.heightMode === 'fixed' ? 'fixed' : 'auto';
    if (value.exportSettings !== undefined) {
        const settings = record(value.exportSettings);
        if (![150, 300, 600].includes(settings.dpi as number) || !['single', 'double', 'custom'].includes(settings.preset as string) || typeof settings.grayscale !== 'boolean') throw new Error('工程导出规格无效。');
        doc.exportSettings = { widthMm: bounded(settings.widthMm, '导出宽度（mm）', 40, 300), dpi: settings.dpi as number, grayscale: settings.grayscale, preset: settings.preset as ExportSettings['preset'] };
    }
    const assetIds = new Set<string>(), panelIds = new Set<string>();
    for (const raw of value.assets) {
        const item = record(raw);
        if (!idValid(item.id) || assetIds.has(item.id) || !['template', 'processing', 'upload'].includes(item.kind as string)) throw new Error('图片标识重复或类型无效。');
        assetIds.add(item.id);
        const asset: FigureAsset = { id: item.id, name: textValue(item.name, '图片名称', 300, '未命名图片'), kind: item.kind as FigureAsset['kind'], width: bounded(item.width, '原图宽度', 1, 50000), height: bounded(item.height, '原图高度', 1, 50000) };
        if (typeof item.svg === 'string') {
            const clean = sanitizeFigureSvg(item.svg); asset.svg = clean.svg; asset.width = clean.width; asset.height = clean.height;
        } else if (item.dataUrl !== undefined) asset.dataUrl = validateBitmapDataUrl(item.dataUrl);
        else throw new Error(`“${asset.name}”缺少原始图片。`);
        if (item.demo !== undefined) { if (typeof item.demo !== 'boolean') throw new Error('示例图标记无效。'); asset.demo = item.demo; }
        if (item.attribution !== undefined) asset.attribution = textValue(item.attribution, '图片来源', 2000);
        if (item.caption !== undefined) asset.caption = textValue(item.caption, '图片图注', 2000);
        if (item.editSnapshot !== undefined) asset.editSnapshot = snapshotCopy(item.editSnapshot);
        doc.assets.push(asset);
    }
    for (const raw of value.panels) {
        const panel = record(raw);
        if (!idValid(panel.id) || panelIds.has(panel.id) || typeof panel.assetId !== 'string' || !assetIds.has(panel.assetId)) throw new Error('子图标识重复或原图不存在。');
        panelIds.add(panel.id);
        doc.panels.push({ id: panel.id, assetId: panel.assetId, x: bounded(panel.x, '子图横坐标', -20000, 20000), y: bounded(panel.y, '子图纵坐标', -20000, 20000), width: bounded(panel.width, '子图宽度', 20, 12000), height: bounded(panel.height, '子图高度', 20, 20000), caption: textValue(panel.caption, '图注', 2000) });
    }
    if (byteLength(JSON.stringify(doc)) > MAX_COMPOSITION_BYTES) throw new Error('组图工程超过 64 MB，请减少图片或原始数据。');
    return doc;
}

export function panelLabel(index: number, style: CompositionDocument['labelStyle']): string {
    if (style === 'none') return '';
    if (style === '1') return String(index + 1);
    let label = '', number = index + 1;
    while (number > 0) { number--; label = String.fromCharCode(97 + number % 26) + label; number = Math.floor(number / 26); }
    return style === 'A' ? label.toUpperCase() : style === '(a)' ? `(${label})` : label;
}

function captionLines(caption: string, width: number, size: number) {
    const lines: string[] = []; let current = '', used = 0;
    for (const char of caption) {
        if (char === '\n') { lines.push(current); current = ''; used = 0; continue; }
        const weight = /[^\u0000-\u007f]/.test(char) ? 1 : .6;
        if (current && (used + weight) * size > Math.max(width, size)) { lines.push(current); current = ''; used = 0; }
        current += char; used += weight;
    }
    if (current || caption.endsWith('\n')) lines.push(current);
    return lines;
}
function panelSpacing(doc: CompositionDocument, panel: Pick<CompositionPanel, 'width' | 'caption'>) {
    const size = doc.labelSize * .72, lines = captionLines(panel.caption, panel.width, size);
    return { top: doc.labelStyle === 'none' ? 0 : doc.labelSize * 1.45, bottom: lines.length ? lines.length * size * 1.4 + size * .5 : 0, captionSize: size, lines };
}
export function getPanelImageRect(doc: CompositionDocument, panel: CompositionPanel): { x: number; y: number; width: number; height: number } {
    const asset = doc.assets.find(item => item.id === panel.assetId);
    if (!asset) throw new Error('子图的原始图片不存在。');
    const space = panelSpacing(doc, panel), availableHeight = Math.max(1, panel.height - space.top - space.bottom), scale = Math.min(panel.width / asset.width, availableHeight / asset.height);
    const width = asset.width * scale, height = asset.height * scale;
    return { x: panel.x + (panel.width - width) / 2, y: panel.y + space.top + (availableHeight - height) / 2, width, height };
}

export function arrangeComposition(input: CompositionDocument, options: { preserveHeight?: boolean } = {}): CompositionDocument {
    const doc = { ...input, panels: input.panels.map(panel => ({ ...panel })) };
    if (!doc.panels.length) return doc;
    const available = doc.width - doc.margin * 2;
    if (available < 100) throw new Error('边距过大，画布没有足够的排图空间。');
    const naturalHeight = (panel: CompositionPanel, width: number) => {
        const asset = doc.assets.find(item => item.id === panel.assetId);
        if (!asset) throw new Error('组图原图不存在。');
        const space = panelSpacing(doc, { ...panel, width });
        return Math.min(720, Math.max(100, width * asset.height / asset.width)) + space.top + space.bottom;
    };
    const grid = (panels: CompositionPanel[], columns: number, x: number, y: number, width: number) => {
        columns = Math.min(columns, panels.length || 1);
        const cellWidth = (width - doc.gap * (columns - 1)) / columns;
        if (cellWidth < 40) throw new Error('列数或间距过大，请减少列数、间距或增大画布。');
        for (let start = 0; start < panels.length; start += columns) {
            const row = panels.slice(start, start + columns), height = Math.max(...row.map(panel => naturalHeight(panel, cellWidth)));
            row.forEach((panel, column) => Object.assign(panel, { x: round(x + column * (cellWidth + doc.gap)), y: round(y), width: round(cellWidth), height: round(height) }));
            y += height + doc.gap;
        }
        return y - (panels.length ? doc.gap : 0);
    };
    let bottom: number;
    if (doc.layout === 'hero-top' && doc.panels.length > 1) {
        const hero = doc.panels[0], heroHeight = naturalHeight(hero, available);
        Object.assign(hero, { x: doc.margin, y: doc.margin, width: available, height: round(heroHeight) });
        bottom = grid(doc.panels.slice(1), doc.columns, doc.margin, doc.margin + heroHeight + doc.gap, available);
    } else if (doc.layout === 'hero-left' && doc.panels.length > 1) {
        const hero = doc.panels[0], heroWidth = (available - doc.gap) * .6, rightWidth = available - heroWidth - doc.gap;
        bottom = grid(doc.panels.slice(1), Math.min(2, doc.columns), doc.margin + heroWidth + doc.gap, doc.margin, rightWidth);
        const height = Math.max(bottom - doc.margin, naturalHeight(hero, heroWidth));
        Object.assign(hero, { x: doc.margin, y: doc.margin, width: round(heroWidth), height: round(height) });
        bottom = doc.margin + height;
    } else bottom = grid(doc.panels, doc.layout === 'row' ? doc.panels.length : doc.layout === 'column' ? 1 : doc.columns, doc.margin, doc.margin, available);
    const calculatedHeight = round(Math.max(100, bottom + doc.margin));
    if (options.preserveHeight ?? input.heightMode === 'fixed') {
        const availableHeight = doc.height - doc.margin * 2;
        if (availableHeight < 40) throw new Error('画布高度或边距不足，请增大高度或减少边距。');
        const scale = Math.min(1, availableHeight / Math.max(1, bottom - doc.margin)), offsetX = (available - available * scale) / 2, offsetY = (availableHeight - (bottom - doc.margin) * scale) / 2;
        doc.panels = doc.panels.map(panel => ({ ...panel, x: round(doc.margin + offsetX + (panel.x - doc.margin) * scale), y: round(doc.margin + offsetY + (panel.y - doc.margin) * scale), width: round(panel.width * scale), height: round(panel.height * scale) }));
        if (doc.panels.some(panel => { const space = panelSpacing(doc, panel); return panel.width < 20 || panel.height < space.top + space.bottom + 20; })) throw new Error('画布高度不足以完整放置图片、标号和图注，请增大高度或减少子图数量。');
    } else doc.height = calculatedHeight;
    if (doc.height > 20000) throw new Error('组图过高，请增加列数或减少子图数量。');
    return doc;
}

export function addAssetToComposition(doc: CompositionDocument, asset: FigureAsset): CompositionDocument {
    const exists = doc.assets.some(item => item.id === asset.id);
    let next = { ...doc, assets: exists ? doc.assets.map(item => item.id === asset.id ? { ...asset } : item) : [...doc.assets, { ...asset }], panels: doc.panels.map(panel => ({ ...panel })) };
    if (next.assets.length > 100 || next.panels.length >= 100 && !next.panels.some(panel => panel.assetId === asset.id)) throw new Error('每份工程最多添加 100 张图片。');
    if (!next.panels.some(panel => panel.assetId === asset.id)) {
        next.panels.push({ id: createFigureId('panel'), assetId: asset.id, x: doc.margin, y: doc.margin, width: 500, height: 350, caption: asset.caption ?? '' });
        next = arrangeComposition(next);
    }
    return validateComposition(next);
}
export function removePanel(doc: CompositionDocument, id: string): CompositionDocument { return arrangeComposition({ ...doc, panels: doc.panels.filter(panel => panel.id !== id) }); }

export function renderCompositionSvg(input: CompositionDocument): string {
    // Rendering only needs source images. Raw tables can contain a million data points.
    const doc = validateComposition({ ...input, assets: input.assets.map(asset => ({ ...asset, editSnapshot: undefined })) });
    const content = doc.panels.map((panel, index) => {
        const asset = doc.assets.find(item => item.id === panel.assetId)!, image = getPanelImageRect(doc, panel), space = panelSpacing(doc, panel), label = panelLabel(index, doc.labelStyle);
        let source: string;
        if (asset.svg) {
            const clean = sanitizeFigureSvg(asset.svg, `panel-${index}`), parsed = parseSvg(clean.svg), svg = parsed.documentElement!;
            svg.setAttribute('x', String(round(image.x))); svg.setAttribute('y', String(round(image.y)));
            svg.setAttribute('width', String(round(image.width))); svg.setAttribute('height', String(round(image.height))); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            source = new XMLSerializer().serializeToString(svg);
        } else source = `<image x="${round(image.x)}" y="${round(image.y)}" width="${round(image.width)}" height="${round(image.height)}" preserveAspectRatio="xMidYMid meet" href="${escapeXml(asset.dataUrl!)}"/>`;
        const tags = label ? `<text x="${round(panel.x)}" y="${round(panel.y + doc.labelSize)}" font-family="${escapeXml(doc.fontFamily)}" font-size="${doc.labelSize}" font-weight="700" fill="#111827">${escapeXml(label)}</text>` : '';
        const caption = space.lines.map((line, lineIndex) => `<text x="${round(panel.x)}" y="${round(panel.y + panel.height - space.bottom + space.captionSize * (1.4 * lineIndex + 1.1))}" font-family="${escapeXml(doc.fontFamily)}" font-size="${round(space.captionSize)}" fill="#1f2937">${escapeXml(line)}</text>`).join('');
        return `<g>${tags}${source}${caption}</g>`;
    }).join('');
    const descriptions = doc.assets.filter(asset => doc.panels.some(panel => panel.assetId === asset.id)).map(asset => `${asset.name}${asset.demo ? '（示例数据）' : ''}${asset.attribution ? `；来源：${asset.attribution}` : ''}`).join('；');
    return `<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}"><title>${escapeXml(doc.name)}</title><desc>${escapeXml(descriptions)}</desc><rect width="${doc.width}" height="${doc.height}" fill="#fff"/>${content}</svg>`;
}

export function compositionIssues(doc: CompositionDocument, widthMm: number, dpi: number): FigureIssue[] {
    bounded(widthMm, '导出宽度（mm）', 40, 300);
    if (![150, 300, 600].includes(dpi)) throw new Error('分辨率请选择 150 / 300 / 600 DPI。');
    const issues: FigureIssue[] = [];
    let outside = 0, crowded = 0, overlapping = 0, lowResolution = 0, demo = 0;
    doc.panels.forEach((panel, index) => {
        const asset = doc.assets.find(item => item.id === panel.assetId); if (!asset) return;
        if (panel.x < 0 || panel.y < 0 || panel.x + panel.width > doc.width + .01 || panel.y + panel.height > doc.height + .01) outside++;
        const space = panelSpacing(doc, panel); if (panel.height < space.top + space.bottom + 40) crowded++;
        for (const other of doc.panels.slice(index + 1)) if (Math.min(panel.x + panel.width, other.x + other.width) - Math.max(panel.x, other.x) > 1 && Math.min(panel.y + panel.height, other.y + other.height) - Math.max(panel.y, other.y) > 1) overlapping++;
        if (!asset.svg) {
            const image = getPanelImageRect(doc, panel), effectiveDpi = asset.width / (image.width / doc.width * widthMm / 25.4);
            if (effectiveDpi < dpi * .95) lowResolution++;
        }
        if (asset.demo) demo++;
    });
    if (outside) issues.push({ level: 'warning', message: `${outside} 张子图超出画布，导出时可能被截断。请调整位置或重新自动排版。` });
    if (overlapping) issues.push({ level: 'warning', message: `${overlapping} 对子图区域重叠，请检查图片、标号和图注是否互相遮挡。` });
    if (crowded) issues.push({ level: 'warning', message: `${crowded} 张子图没有足够空间容纳图注与图片，请增大子图或缩短图注。` });
    if (lowResolution) issues.push({ level: 'warning', message: `${lowResolution} 张位图按最终尺寸换算不足 ${dpi} DPI；提高导出 DPI 无法增加原图细节。` });
    if (doc.labelStyle !== 'none' && doc.labelSize * widthMm / doc.width * 72 / 25.4 < 6) issues.push({ level: 'warning', message: '子图标号按最终尺寸换算小于 6 pt，请增大字号或输出宽度。' });
    if (demo) issues.push({ level: 'warning', message: `${demo} 张子图仍使用示例数据，请替换为自己的数据后用于论文。` });
    if (!doc.panels.length) issues.push({ level: 'warning', message: '画布中还没有子图，请先添加图片。' });
    return issues;
}
