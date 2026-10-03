import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { formatManuscript, MAX_MANUSCRIPT_BYTES } from "./format-docx.ts";
import { JOURNAL_PRESETS } from "./journals.ts";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const M = "http://schemas.openxmlformats.org/officeDocument/2006/math";
const parse = xml => new DOMParser().parseFromString(xml, "application/xml");
const serialize = node => new XMLSerializer().serializeToString(node);
const all = (doc, name, ns = W) => Array.from(doc.getElementsByTagNameNS(ns, name));
const options = { ...JOURNAL_PRESETS[0].options };
const section = `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:bottom="720" w:left="720" w:right="720"/><w:cols w:num="2"/></w:sectPr>`;
const styles = `<w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/></w:style></w:styles>`;

function document(body, sect = section) { return `<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:m="${M}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><w:body>${body}${sect}</w:body></w:document>`; }
async function fixture(body = `<w:p><w:r><w:t>Research text 123 α β.</w:t></w:r></w:p>`, extras = {}, sect = section) {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
    zip.file("_rels/.rels", `<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`);
    zip.file("word/document.xml", document(body, sect)); zip.file("word/styles.xml", styles);
    zip.file("word/_rels/document.xml.rels", `<Relationships xmlns="${REL}"><Relationship Id="rIdLink" Type="${R}/hyperlink" Target="https://example.org/reference" TargetMode="External"/></Relationships>`);
    for (const [name, value] of Object.entries(extras)) zip.file(name, value);
    return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

test("real text, images, tables, equations, fields, comments and links survive formatting", async () => {
    const table = `<w:tbl><w:tblPr/><w:tr><w:tc><w:p><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>Measured 1.2345</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
    const equation = `<m:oMath><m:r><m:t>x² + β</m:t></m:r></m:oMath>`;
    const body = `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Test manuscript</w:t></w:r></w:p><w:p><w:r><w:rPr><w:i/><w:vertAlign w:val="superscript"/></w:rPr><w:t>Preserved value 1.2345</w:t></w:r><w:hyperlink r:id="rIdLink"><w:r><w:t>Original link</w:t></w:r></w:hyperlink><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> ADDIN ZOTERO_ITEM CSL_CITATION </w:instrText></w:r><w:r><w:t>[1]</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r><w:commentRangeStart w:id="0"/><w:ins w:id="5" w:author="Test"><w:r><w:t>Inserted text</w:t></w:r></w:ins><w:del w:id="6" w:author="Test"><w:r><w:delText>Deleted text</w:delText></w:r></w:del></w:p>${table}<w:p>${equation}</w:p><w:p><w:r><w:drawing><a:blip r:embed="rIdImage"/></w:drawing></w:r></w:p>`;
    const media = new Uint8Array([1, 7, 9, 44]);
    const input = await fixture(body, { "word/media/image1.png": media, "word/comments.xml": `<w:comments xmlns:w="${W}"><w:comment w:id="0"><w:p><w:r><w:t>Original comment</w:t></w:r></w:p></w:comment></w:comments>`, "word/footnotes.xml": `<w:footnotes xmlns:w="${W}"/>`, "word/header1.xml": `<w:hdr xmlns:w="${W}"><w:p><w:r><w:t>Original header</w:t></w:r></w:p></w:hdr>` });
    const originalBytes = input.slice(); const original = await JSZip.loadAsync(input);
    const output = await formatManuscript(input, "plos-one"); const zipped = await JSZip.loadAsync(output.bytes);
    assert.deepEqual(input, originalBytes, "the supplied buffer must stay untouched");
    for (const part of ["word/styles.xml", "word/comments.xml", "word/footnotes.xml", "word/header1.xml", "word/media/image1.png"]) assert.deepEqual(await zipped.file(part).async("uint8array"), await original.file(part).async("uint8array"));
    const before = parse(await original.file("word/document.xml").async("string")), after = parse(await zipped.file("word/document.xml").async("string"));
    assert.deepEqual(all(after, "t").map(node => node.textContent), all(before, "t").map(node => node.textContent));
    assert.equal(serialize(all(after, "tbl")[0]), serialize(all(before, "tbl")[0]));
    assert.equal(serialize(all(after, "oMath", M)[0]), serialize(all(before, "oMath", M)[0]));
    for (const name of ["instrText", "del", "commentRangeStart", "drawing", "vertAlign", "i"]) assert.equal(serialize(all(after, name)[0]), serialize(all(before, name)[0]));
    assert.equal(all(after, "hyperlink")[0].getAttributeNS(R, "id"), "rIdLink");
    assert.equal(all(after, "hyperlink")[0].textContent, "Original link");
    const rels = parse(await zipped.file("word/_rels/document.xml.rels").async("string"));
    assert.equal(all(rels, "Relationship", REL).find(item => item.getAttribute("Id") === "rIdLink").getAttribute("Target"), "https://example.org/reference");
    assert.equal(output.report.tableCount, 1); assert.equal(output.report.imageCount, 1); assert.equal(output.report.equationCount, 1);
    assert.ok(output.report.warnings.some(item => item.includes("修订")));
});

test("PLOS defaults apply actual double spacing, continuous line numbers, one column and page field", async () => {
    const output = await formatManuscript(await fixture(), "plos-one");
    const zip = await JSZip.loadAsync(output.bytes), doc = parse(await zip.file("word/document.xml").async("string"));
    assert.equal(all(doc, "spacing")[0].getAttributeNS(W, "line"), "480");
    assert.equal(all(doc, "cols")[0].getAttributeNS(W, "num"), "1");
    assert.equal(all(doc, "lnNumType")[0].getAttributeNS(W, "restart"), "continuous");
    assert.equal(all(doc, "lnNumType")[0].hasAttributeNS(W, "start"), false, "no section start value can restart continuous numbering");
    assert.equal(all(doc, "pgMar")[0].getAttributeNS(W, "left"), "1440");
    const footerName = Object.keys(zip.files).find(name => /footerWorkbench\d+\.xml$/.test(name));
    const footer = parse(await zip.file(footerName).async("string"));
    assert.match(serialize(footer), /PAGE/);
    assert.equal(all(footer, "suppressLineNumbers")[0].getAttributeNS(W, "val"), "1", "page-number footer is not numbered as a manuscript line");
});

test("historical section properties inside tracked changes stay byte-equivalent and unnumbered", async () => {
    const old = `<w:sectPrChange w:id="8" w:author="Reviewer"><w:sectPr><w:pgSz w:w="5000" w:h="7000"/><w:pgMar w:left="600"/><w:cols w:num="3"/></w:sectPr></w:sectPrChange>`;
    const input = await fixture(undefined, {}, section.replace("</w:sectPr>", `${old}</w:sectPr>`));
    const original = parse(await (await JSZip.loadAsync(input)).file("word/document.xml").async("string"));
    const output = await formatManuscript(input, "plos-one"); const after = parse(await (await JSZip.loadAsync(output.bytes)).file("word/document.xml").async("string"));
    assert.equal(serialize(all(after, "sectPrChange")[0]), serialize(all(original, "sectPrChange")[0])); assert.equal(output.report.sectionCount, 1);
});

test("first-page-only footer and enabled even pages receive missing default/even page numbers", async () => {
    const specialSection = `<w:sectPr><w:footerReference w:type="first" r:id="rIdFirst"/><w:titlePg/></w:sectPr>`;
    const input = await fixture(undefined, {
        "word/settings.xml": `<w:settings xmlns:w="${W}"><w:evenAndOddHeaders/></w:settings>`,
        "word/footer1.xml": `<w:ftr xmlns:w="${W}"><w:p><w:r><w:t>Institution first-page footer</w:t></w:r></w:p></w:ftr>`,
        "word/_rels/document.xml.rels": `<Relationships xmlns="${REL}"><Relationship Id="rIdFirst" Type="${R}/footer" Target="footer1.xml"/></Relationships>`,
    }, specialSection);
    const output = await formatManuscript(input, "nature"), zip = await JSZip.loadAsync(output.bytes), doc = parse(await zip.file("word/document.xml").async("string"));
    const refs = all(doc, "footerReference"); assert.deepEqual(new Set(refs.map(node => node.getAttributeNS(W, "type"))), new Set(["first", "default", "even"]));
    const oldFooter = await zip.file("word/footer1.xml").async("string"); assert.match(oldFooter, /Institution first-page footer/); assert.match(oldFooter, /PAGE/);
    const rels = parse(await zip.file("word/_rels/document.xml.rels").async("string"));
    for (const ref of refs) { const target = all(rels, "Relationship", REL).find(item => item.getAttribute("Id") === ref.getAttributeNS(R, "id")).getAttribute("Target"); assert.match(await zip.file(`word/${target}`).async("string"), /PAGE/); }
    const second = await formatManuscript(output.bytes, "nature"), secondZip = await JSZip.loadAsync(second.bytes);
    assert.equal(Object.keys(secondZip.files).filter(name => /footer.*\.xml$/.test(name)).length, 2, "reformatting does not duplicate footers");
});

test("inherited Symbol fonts and custom caption basedOn chains preserve glyph and caption typography", async () => {
    const symbolStyles = styles.replace("</w:styles>", `<w:style w:type="character" w:styleId="Symbols"><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr></w:style><w:style w:type="character" w:styleId="InheritedSymbols"><w:basedOn w:val="Symbols"/></w:style><w:style w:type="paragraph" w:styleId="SymbolParagraph"><w:rPr><w:rFonts w:ascii="Wingdings"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="FigureNotes"><w:basedOn w:val="Caption"/></w:style><w:style w:type="paragraph" w:styleId="DerivedNotes"><w:basedOn w:val="FigureNotes"/></w:style></w:styles>`);
    const body = `<w:p><w:r><w:rPr><w:rStyle w:val="InheritedSymbols"/></w:rPr><w:t>a</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="SymbolParagraph"/></w:pPr><w:r><w:t>l</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="DerivedNotes"/><w:spacing w:line="220"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/></w:rPr><w:t>Figure 1. Exact caption.</w:t></w:r></w:p>`;
    const input = await fixture(body, { "word/styles.xml": symbolStyles }); const before = parse(document(body));
    const output = await formatManuscript(input, "nature"), after = parse(await (await JSZip.loadAsync(output.bytes)).file("word/document.xml").async("string"));
    assert.equal(serialize(all(after, "r")[0]), serialize(all(before, "r")[0]));
    assert.equal(serialize(all(after, "r")[1]), serialize(all(before, "r")[1]));
    assert.equal(serialize(all(after, "p")[2]), serialize(all(before, "p")[2]));
});

test("landscape section and manual checks survive; explicit requirement overrides produce warnings", async () => {
    const input = await fixture(undefined, {}, `<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/></w:sectPr>`);
    const output = await formatManuscript(input, "plos-one", { ...options, lineSpacing: 1, lineNumbers: false, pageNumbers: false, singleColumn: false });
    const doc = parse(await (await JSZip.loadAsync(output.bytes)).file("word/document.xml").async("string"));
    assert.equal(all(doc, "pgSz")[0].getAttributeNS(W, "w"), "16838"); assert.equal(output.report.preservedLandscapeSections, 1);
    assert.ok(output.report.warnings.some(item => item.includes("PLOS ONE"))); assert.ok(output.report.checks.some(item => item.includes("参考文献")));
});

test("all eight journals generate editable archives with official source metadata", async () => {
    assert.equal(JOURNAL_PRESETS.length, 8); const input = await fixture();
    for (const journal of JOURNAL_PRESETS) {
        assert.ok(journal.sourceUrl.startsWith("https://")); assert.equal(journal.checkedOn, "2026-10-03");
        const result = await formatManuscript(input, journal.id); assert.ok((await JSZip.loadAsync(result.bytes)).file("word/document.xml")); assert.equal(result.report.journalName, journal.name);
    }
});

test("invalid ZIP, malformed XML, DTD, unsupported Word format and missing parts fail without output", async () => {
    await assert.rejects(formatManuscript(new Uint8Array([1, 2, 3]), "nature"), /无法读取/);
    const empty = await new JSZip().file("random.txt", "text").generateAsync({ type: "uint8array" }); await assert.rejects(formatManuscript(empty, "nature"), /标准 Word/);
    for (const xml of [`<!DOCTYPE test [<!ENTITY secret "bad">]>${document("<w:p/>")}`, `<w:document xmlns:w="${W}"><w:body><w:p></w:body></w:document>`, `<w:document xmlns:w="https://unsupported.example/word"><w:body/></w:document>`]) {
        const input = await fixture(undefined, { "word/document.xml": xml }); await assert.rejects(formatManuscript(input, "nature"), /XML|损坏|暂不支持/);
    }
    await assert.rejects(formatManuscript(await fixture(), "unknown"), /未找到/);
    await assert.rejects(formatManuscript(await fixture(), "nature", { ...options, fontSize: NaN }), /参数/);
});

test("size, highly compressed XML and macro gates reject before document parsing", async () => {
    await assert.rejects(formatManuscript(new Uint8Array(MAX_MANUSCRIPT_BYTES + 1), "nature"), /20 MB/);
    const massive = await fixture(undefined, { "word/oversized.xml": " ".repeat(10 * 1024 * 1024 + 1) }); assert.ok(massive.length < 100000); await assert.rejects(formatManuscript(massive, "nature"), /XML 内容过大/);
    await assert.rejects(formatManuscript(await fixture(undefined, { "word/vbaProject.bin": new Uint8Array([1]) }), "nature"), /宏或数字签名/);
});
