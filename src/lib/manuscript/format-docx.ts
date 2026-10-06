import JSZip from "jszip";
import { DOMParser, XMLSerializer, type Document as XmlDocument, type Element as XmlElement, type Node as XmlNode } from "@xmldom/xmldom";
import { getJournal, type JournalPreset, type ManuscriptOptions } from "./journals.ts";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const CONTENT = "http://schemas.openxmlformats.org/package/2006/content-types";
const M = "http://schemas.openxmlformats.org/officeDocument/2006/math";
export const MAX_MANUSCRIPT_BYTES = 20 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 150 * 1024 * 1024;
const MAX_XML_BYTES = 10 * 1024 * 1024;
const PROPERTY_ORDER: Record<string, string[]> = {
    pPr: ["pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl", "numPr", "suppressLineNumbers", "pBdr", "shd", "tabs", "suppressAutoHyphens", "kinsoku", "wordWrap", "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd", "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection", "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"],
    rPr: ["rStyle", "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike", "dstrike", "outline", "shadow", "emboss", "imprint", "noProof", "snapToGrid", "vanish", "webHidden", "color", "spacing", "w", "kern", "position", "sz", "szCs", "highlight", "u", "effect", "bdr", "shd", "fitText", "vertAlign", "rtl", "cs", "em", "lang", "eastAsianLayout", "specVanish", "oMath", "rPrChange"],
    sectPr: ["headerReference", "footerReference", "footnotePr", "endnotePr", "type", "pgSz", "pgMar", "paperSrc", "pgBorders", "lnNumType", "pgNumType", "cols", "formProt", "vAlign", "noEndnote", "titlePg", "textDirection", "bidi", "rtlGutter", "docGrid", "printerSettings", "sectPrChange"],
};

export type FormatReport = {
    journalName: string;
    paragraphCount: number;
    formattedParagraphs: number;
    tableCount: number;
    imageCount: number;
    equationCount: number;
    sectionCount: number;
    preservedLandscapeSections: number;
    changes: string[];
    checks: string[];
    warnings: string[];
};

export type FormattedManuscript = { bytes: Uint8Array; report: FormatReport };

function parseXml(source: string, label: string): XmlDocument {
    if (source.length > MAX_XML_BYTES) throw new Error(`${label}过大，无法在浏览器中安全处理。`);
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("文档包含不支持的 XML 声明，请用 Word 另存为标准 .docx 后重试。");
    try {
        const doc = new DOMParser({ onError: () => { throw new Error("Invalid XML"); } }).parseFromString(source, "application/xml");
        if (!doc.documentElement) throw new Error("Missing root");
        return doc;
    } catch {
        throw new Error(`${label}结构损坏，请先在 Word 中修复并另存为 .docx。`);
    }
}

function serialize(doc: XmlDocument) { return new XMLSerializer().serializeToString(doc); }
function descendants(node: XmlElement | XmlDocument, name: string, ns = W): XmlElement[] { return Array.from(node.getElementsByTagNameNS(ns, name)); }
function direct(node: XmlElement, name: string, ns = W): XmlElement | undefined {
    return Array.from(node.childNodes).find(child => child.nodeType === 1 && child.namespaceURI === ns && child.localName === name) as XmlElement | undefined;
}
function ensure(parent: XmlElement, name: string, first = false): XmlElement {
    const existing = direct(parent, name);
    if (existing) return existing;
    const node = parent.ownerDocument!.createElementNS(W, `w:${name}`);
    const order = PROPERTY_ORDER[parent.localName ?? ""];
    const later = order && Array.from(parent.childNodes).find(child => child.nodeType === 1 && order.indexOf(child.localName ?? "") > order.indexOf(name));
    if (first) parent.insertBefore(node, parent.firstChild); else if (later) parent.insertBefore(node, later); else parent.appendChild(node);
    return node;
}
function setW(element: XmlElement, attrs: Record<string, string | number>) { for (const [name, value] of Object.entries(attrs)) element.setAttributeNS(W, `w:${name}`, String(value)); }
function hasAncestor(node: XmlNode, names: string[]) {
    for (let parent = node.parentNode; parent; parent = parent.parentNode) if (parent.namespaceURI === W && names.includes(parent.localName ?? "")) return true;
    return false;
}
function bodyText(doc: XmlDocument) { return [...descendants(doc, "t"), ...descendants(doc, "t", M)].map(node => node.textContent ?? "").join("\u0000"); }
function hasPageField(doc: XmlDocument) {
    return descendants(doc, "instrText").some(node => /\bPAGE\b/i.test(node.textContent ?? "")) || descendants(doc, "fldSimple").some(node => /\bPAGE\b/i.test(node.getAttributeNS(W, "instr") ?? ""));
}

function validateOptions(options: ManuscriptOptions) {
    if (!["A4", "Letter"].includes(options.paper) || !["Times New Roman", "Arial", "Calibri"].includes(options.font) || ![1, 1.5, 2].includes(options.lineSpacing) || !Number.isFinite(options.fontSize) || options.fontSize < 9 || options.fontSize > 16 || !Number.isFinite(options.marginCm) || options.marginCm < 1.5 || options.marginCm > 3.5) throw new Error("排版参数不在允许范围内，请重新选择。");
}

function styleRoles(doc: XmlDocument | null) {
    const roles = new Map<string, { role: "title" | "heading" | "caption"; level: number }>();
    const records = new Map<string, XmlElement>();
    if (doc) for (const style of descendants(doc, "style")) records.set(style.getAttributeNS(W, "styleId") ?? "", style);
    if (doc) for (const style of descendants(doc, "style")) {
        const id = style.getAttributeNS(W, "styleId") ?? "";
        const name = direct(style, "name")?.getAttributeNS(W, "val") ?? id;
        const normalized = `${id} ${name}`.toLowerCase();
        const outline = direct(style, "pPr") && direct(direct(style, "pPr")!, "outlineLvl");
        if (/\btitle\b|标题$/.test(normalized) && !/subtitle/.test(normalized)) roles.set(id, { role: "title", level: 0 });
        else if (/heading|标题\s*\d/.test(normalized) || outline) roles.set(id, { role: "heading", level: Number(outline?.getAttributeNS(W, "val") ?? normalized.match(/\d/)?.[0] ?? 1) });
        else if (/caption|图注|题注/.test(normalized)) roles.set(id, { role: "caption", level: 0 });
    }
    for (const [id, style] of records) {
        if (roles.has(id)) continue;
        const visited = new Set<string>([id]);
        let base = direct(style, "basedOn")?.getAttributeNS(W, "val");
        while (base && !visited.has(base)) {
            visited.add(base);
            const inherited = roles.get(base);
            if (inherited) { roles.set(id, inherited); break; }
            const parent = records.get(base);
            base = parent && direct(parent, "basedOn")?.getAttributeNS(W, "val");
        }
    }
    return roles;
}

function makeFontResolver(styles: XmlDocument | null) {
    const records = new Map<string, XmlElement>();
    if (styles) for (const style of descendants(styles, "style")) records.set(style.getAttributeNS(W, "styleId") ?? "", style);
    const defaults = styles && descendants(styles, "docDefaults")[0];
    const defaultProps = defaults && direct(defaults, "rPrDefault");
    const defaultRun = defaultProps && direct(defaultProps, "rPr");
    const defaultFonts = defaultRun && direct(defaultRun, "rFonts");
    const defaultParagraphStyle = Array.from(records.values()).find(style => style.getAttributeNS(W, "type") === "paragraph" && ["1", "true", "on"].includes(style.getAttributeNS(W, "default") ?? ""))?.getAttributeNS(W, "styleId");
    return (runProps: XmlElement | undefined, paragraphStyle: string) => {
    const chainFonts: XmlElement[] = [];
    const directFonts = runProps && direct(runProps, "rFonts");
    if (directFonts) chainFonts.push(directFonts);
    for (const id of [runProps && direct(runProps, "rStyle")?.getAttributeNS(W, "val"), paragraphStyle || defaultParagraphStyle]) {
        const visited = new Set<string>(); let current = id;
        while (current && !visited.has(current)) {
            visited.add(current); const style = records.get(current); if (!style) break;
            const props = direct(style, "rPr"), fonts = props && direct(props, "rFonts");
            if (fonts) chainFonts.push(fonts);
            current = direct(style, "basedOn")?.getAttributeNS(W, "val");
        }
    }
    if (defaultFonts) chainFonts.push(defaultFonts);
    return ["ascii", "hAnsi"].map(name => chainFonts.map(font => font.getAttributeNS(W, name)).find(Boolean) ?? "").join(" ");
    };
}

function applyParagraphs(doc: XmlDocument, styles: XmlDocument | null, options: ManuscriptOptions) {
    const roles = styleRoles(styles);
    const effectiveFonts = makeFontResolver(styles);
    let changed = 0;
    for (const paragraph of descendants(doc, "p")) {
        // Tables, drawing text, equations, captions, and their original typography remain intact.
        if (hasAncestor(paragraph, ["tc", "txbxContent"]) || descendants(paragraph, "drawing").length || descendants(paragraph, "object").length || descendants(paragraph, "oMath", M).length || descendants(paragraph, "oMathPara", M).length || !descendants(paragraph, "t").length) continue;
        const props = ensure(paragraph, "pPr", true);
        const id = direct(props, "pStyle")?.getAttributeNS(W, "val") ?? "";
        const role = roles.get(id);
        if (role?.role === "caption") continue;
        setW(ensure(props, "spacing"), { line: Math.round(options.lineSpacing * 240), lineRule: "auto", before: role ? 120 : 0, after: role ? 80 : 0 });
        setW(ensure(props, "jc"), { val: "left" });
        if (options.lineNumbers) setW(ensure(props, "suppressLineNumbers"), { val: 0 });
        if (role) setW(ensure(props, "keepNext"), { val: 1 });
        for (const run of descendants(paragraph, "r")) {
            if (hasAncestor(run, ["del"]) || !descendants(run, "t").length || descendants(run, "drawing").length || descendants(run, "object").length || descendants(run, "sym").length || hasAncestor(run, ["txbxContent"])) continue;
            const existingFont = effectiveFonts(direct(run, "rPr"), id);
            if (/symbol|wingdings|webdings/i.test(existingFont)) continue;
            const runProps = ensure(run, "rPr", true);
            const fonts = ensure(runProps, "rFonts");
            // Preserve italics, bold, superscripts, chemistry notation, language, and all field nodes.
            fonts.removeAttributeNS(W, "asciiTheme"); fonts.removeAttributeNS(W, "hAnsiTheme");
            setW(fonts, { ascii: options.font, hAnsi: options.font });
            const size = role?.role === "title" ? options.fontSize + 4 : role?.role === "heading" ? options.fontSize + (role.level <= 1 ? 2 : 0) : options.fontSize;
            setW(ensure(runProps, "sz"), { val: Math.round(size * 2) });
            if (role) setW(ensure(runProps, "b"), { val: 1 });
        }
        changed++;
    }
    return changed;
}

function applySections(doc: XmlDocument, options: ManuscriptOptions) {
    const sections = descendants(doc, "sectPr").filter(section => !hasAncestor(section, ["sectPrChange"]));
    if (!sections.length) { const body = descendants(doc, "body")[0]; if (!body) throw new Error("没有找到有效的 Word 正文。"); sections.push(ensure(body, "sectPr")); }
    let landscapes = 0;
    const margin = Math.round(options.marginCm * 1440 / 2.54);
    for (const section of sections) {
        const size = ensure(section, "pgSz");
        const landscape = size.getAttributeNS(W, "orient") === "landscape" || Number(size.getAttributeNS(W, "w")) > Number(size.getAttributeNS(W, "h"));
        if (landscape && options.preserveLandscape) landscapes++;
        else { setW(size, options.paper === "Letter" ? { w: 12240, h: 15840 } : { w: 11906, h: 16838 }); size.removeAttributeNS(W, "orient"); }
        setW(ensure(section, "pgMar"), { top: margin, bottom: margin, left: margin, right: margin });
        if (options.singleColumn) {
            const cols = ensure(section, "cols"); setW(cols, { num: 1 });
            for (const child of descendants(cols, "col")) cols.removeChild(child);
        }
        if (options.lineNumbers) {
            const lines = ensure(section, "lnNumType");
            setW(lines, { countBy: 1, restart: "continuous", distance: 240 });
            // An explicit start on every section restarts numbering in Word-compatible renderers.
            lines.removeAttributeNS(W, "start");
        }
        else { const line = direct(section, "lnNumType"); if (line) section.removeChild(line); }
    }
    return { sections, landscapes };
}

function appendPageField(footer: XmlDocument) {
    if (hasPageField(footer)) return false;
    const root = footer.documentElement!;
    const paragraph = footer.createElementNS(W, "w:p");
    const paragraphProps = ensure(paragraph, "pPr");
    setW(ensure(paragraphProps, "jc"), { val: "center" });
    setW(ensure(paragraphProps, "suppressLineNumbers"), { val: 1 });
    const field = footer.createElementNS(W, "w:fldSimple"); setW(field, { instr: " PAGE " });
    const run = footer.createElementNS(W, "w:r"), text = footer.createElementNS(W, "w:t");
    const props = ensure(run, "rPr", true); setW(ensure(props, "rFonts"), { ascii: "Times New Roman", hAnsi: "Times New Roman" }); setW(ensure(props, "sz"), { val: 20 });
    text.textContent = "1"; run.appendChild(text); field.appendChild(run); paragraph.appendChild(field); root.appendChild(paragraph);
    return true;
}

async function addPageNumbers(zip: JSZip, doc: XmlDocument, sections: XmlElement[]) {
    const relEntry = zip.file("word/_rels/document.xml.rels");
    const rels = relEntry ? parseXml(await relEntry.async("string"), "文档关系") : parseXml(`<Relationships xmlns="${REL}"/>`, "文档关系");
    const content = parseXml(await zip.file("[Content_Types].xml")!.async("string"), "内容类型");
    const byId = new Map(descendants(rels, "Relationship", REL).map(item => [item.getAttribute("Id") ?? "", item]));
    const settingsEntry = zip.file("word/settings.xml");
    const settings = settingsEntry && parseXml(await settingsEntry.async("string"), "设置");
    const evenFlag = settings && descendants(settings, "evenAndOddHeaders")[0];
    const evenEnabled = evenFlag && !["0", "false", "off"].includes(evenFlag.getAttributeNS(W, "val") ?? "");
    const processed = new Set<string>(), inherited = new Map<string, string>();
    let generatedId: string | null = null;

    function createNumberedFooter() {
        if (generatedId) return generatedId;
        let suffix = 1;
        while (byId.has(`rIdWorkbenchPage${suffix}`) || zip.file(`word/footerWorkbench${suffix}.xml`)) suffix++;
        const footerName = `footerWorkbench${suffix}.xml`, relId = `rIdWorkbenchPage${suffix}`;
        const footer = parseXml(`<w:ftr xmlns:w="${W}"/>`, "页脚"); appendPageField(footer); zip.file(`word/${footerName}`, serialize(footer));
        const relationship = rels.createElementNS(REL, "Relationship");
        relationship.setAttribute("Id", relId); relationship.setAttribute("Type", `${R}/footer`); relationship.setAttribute("Target", footerName); rels.documentElement!.appendChild(relationship); byId.set(relId, relationship);
        const override = content.createElementNS(CONTENT, "Override"); override.setAttribute("PartName", `/word/${footerName}`); override.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"); content.documentElement!.appendChild(override);
        generatedId = relId; return relId;
    }
    async function numberExistingFooter(id: string) {
        const relationship = byId.get(id);
        if (!relationship || relationship.getAttribute("Type") !== `${R}/footer` || relationship.getAttribute("TargetMode") === "External") throw new Error("原稿页脚关系不完整，请用 Word 重新保存后重试。");
        const target = relationship.getAttribute("Target") ?? "";
        const path: string[] = target.startsWith("/") ? [] : ["word"];
        for (const piece of target.split("/")) { if (!piece || piece === ".") continue; if (piece === "..") path.pop(); else path.push(piece); }
        const name = path.join("/");
        const entry = zip.file(name);
        if (!entry) throw new Error("原稿缺少引用的页脚文件，请用 Word 修复并重新保存。");
        if (processed.has(name)) return;
        const footer = parseXml(await entry.async("string"), "页脚");
        if (appendPageField(footer)) zip.file(name, serialize(footer));
        processed.add(name);
    }
    for (const section of sections) {
        const refs = Array.from(section.childNodes).filter(node => node.nodeType === 1 && node.namespaceURI === W && node.localName === "footerReference") as XmlElement[];
        for (const reference of refs) {
            const id = reference.getAttributeNS(R, "id") ?? "";
            await numberExistingFooter(id);
            inherited.set(reference.getAttributeNS(W, "type") ?? "default", id);
        }
        const firstFlag = direct(section, "titlePg");
        const firstEnabled = firstFlag && !["0", "false", "off"].includes(firstFlag.getAttributeNS(W, "val") ?? "");
        const types = ["default", ...(firstEnabled ? ["first"] : []), ...(evenEnabled ? ["even"] : [])];
        for (const type of types) {
            if (inherited.has(type)) continue;
            const id = createNumberedFooter(); inherited.set(type, id);
            const reference = doc.createElementNS(W, "w:footerReference"); setW(reference, { type }); reference.setAttributeNS(R, "r:id", id);
            const afterHeaders = Array.from(section.childNodes).find(node => node.nodeType === 1 && !(node.namespaceURI === W && node.localName === "headerReference"));
            section.insertBefore(reference, afterHeaders ?? null);
        }
    }
    if (generatedId) { zip.file("word/_rels/document.xml.rels", serialize(rels)); zip.file("[Content_Types].xml", serialize(content)); }
    return null;
}

/** Updates OOXML formatting in place. The manuscript never leaves the browser. */
export async function formatManuscript(input: ArrayBuffer | Uint8Array, journalId: string, options?: ManuscriptOptions, journalPreset?: JournalPreset): Promise<FormattedManuscript> {
    const originalJournal = getJournal(journalId);
    if (journalPreset && journalPreset.id !== originalJournal.id) throw new Error("期刊排版方案与所选期刊不匹配。");
    const journal = journalPreset ?? originalJournal, selected = options ?? journal.options;
    validateOptions(selected);
    if (input.byteLength > MAX_MANUSCRIPT_BYTES) throw new Error("文件超过 20 MB，请压缩内嵌图片后重试。");
    let zip: JSZip;
    try { zip = await JSZip.loadAsync(input); } catch { throw new Error("无法读取此文件。请上传未加密的 .docx，而不是 .doc、PDF 或更名文件。"); }
    const entries = Object.values(zip.files);
    if (entries.length > 3000) throw new Error("文档包含过多文件，请在 Word 中另存为精简稿件后重试。");
    const expandedBytes = entries.reduce((sum, file) => sum + ((file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0), 0);
    if (expandedBytes > MAX_EXPANDED_BYTES) throw new Error("解压后的文档超过 150 MB，请压缩图片后重试。");
    if (entries.some(file => /\.xml$/.test(file.name) && ((file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0) > MAX_XML_BYTES)) throw new Error("文档的 XML 内容过大，请在 Word 中精简后重试。");
    if (!zip.file("word/document.xml") || !zip.file("[Content_Types].xml")) throw new Error("这个文件不是标准 Word .docx 文档。");
    if (entries.some(entry => /vbaProject\.bin|^_xmlsignatures\//i.test(entry.name))) throw new Error("暂不处理带宏或数字签名的文档，请另存为普通 .docx。");
    const doc = parseXml(await zip.file("word/document.xml")!.async("string"), "正文");
    if (doc.documentElement!.namespaceURI !== W) throw new Error("此文档采用暂不支持的 Word XML 格式，请另存为标准 .docx。");
    const beforeText = bodyText(doc);
    const styleEntry = zip.file("word/styles.xml");
    const styles = styleEntry ? parseXml(await styleEntry.async("string"), "样式") : null;
    const tableCount = descendants(doc, "tbl").length;
    const imageCount = entries.filter(entry => /^word\/media\//.test(entry.name) && !entry.dir).length;
    const equationCount = descendants(doc, "oMath", M).length;
    const formattedParagraphs = applyParagraphs(doc, styles, selected);
    const { sections, landscapes } = applySections(doc, selected);
    const warnings: string[] = [];
    if (journal.id === "plos-one" && (selected.lineSpacing !== 2 || !selected.singleColumn || !selected.lineNumbers || !selected.pageNumbers)) warnings.push("自定义参数没有启用全部 PLOS ONE 明确要求：双倍行距、单栏、连续行号与页码。请恢复这些选项，或在原稿中确认已有相应设置。");
    if (journal.id === "scientific-reports" && (!selected.singleColumn || !selected.pageNumbers)) warnings.push("Scientific Reports 的返修指南要求单栏和页码；当前自定义参数没有启用全部相关整理选项，请在 Word 中核对。");
    if (selected.pageNumbers) { const warning = await addPageNumbers(zip, doc, sections); if (warning) warnings.push(warning); }
    if (beforeText !== bodyText(doc)) throw new Error("正文保留检查未通过，未生成排版文件。");
    if (tableCount) warnings.push("表格的内容、单元格、字号和列宽保留；页边距改变后，请检查宽表是否超出页面。");
    if (imageCount) warnings.push("内嵌图片、锚点和尺寸保留；页宽改变后，请检查浮动图片与图注的位置。");
    if (zip.file("word/footnotes.xml")) warnings.push("保留原稿脚注；请按目标期刊要求决定是否移至正文。");
    if (descendants(doc, "ins").length || descendants(doc, "del").length) warnings.push("原稿修订记录已保留；正式投稿前请自行决定接受或保留修订。");
    zip.file("word/document.xml", serialize(doc));
    const report: FormatReport = {
        journalName: journal.name, paragraphCount: descendants(doc, "p").length, formattedParagraphs, tableCount, imageCount, equationCount, sectionCount: sections.length, preservedLandscapeSections: landscapes,
        changes: [`整理 ${formattedParagraphs} 个正文与已标记标题段落的字体、字号、左对齐和 ${selected.lineSpacing === 2 ? "双倍" : `${selected.lineSpacing} 倍`}行距。`, `设置 ${selected.paper} 页面与 ${selected.marginCm} cm 页边距${landscapes ? `，保留 ${landscapes} 个横向章节` : ""}。`, ...(selected.singleColumn ? ["正文章节统一单栏。"] : []), selected.lineNumbers ? "启用连续行号。" : "正文关闭行号。", ...(selected.pageNumbers ? ["保留已有 PAGE 域；缺少页码的页脚增加自动页码域。"] : ["原稿页脚和现有页码保持不变。"])],
        checks: [...journal.manualChecks, "表格、公式、图注保留原稿局部版式，请按期刊要求确认字号和行距。", "检查参考文献与正文引文对应、章节完整性和语义；本工具保持原内容与顺序。", "打开输出 Word 检查分页与图表位置，更新域后再提交。"], warnings,
    };
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
    return { bytes, report };
}
