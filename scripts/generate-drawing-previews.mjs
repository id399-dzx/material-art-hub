import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { DRAWING_TEMPLATES } from '../src/lib/data-processing/drawing-catalog.ts';
import { renderDrawingPreview } from './drawing-preview-options.mjs';

const output = new URL('../public/drawing-previews/', import.meta.url);
const auditPath = process.env.DRAWING_PREVIEW_AUDIT || '/tmp/material-hub-drawing-preview-audit.json';
const contactPath = process.env.DRAWING_PREVIEW_CONTACT || '/tmp/material-hub-drawing-preview-contact.png';
await mkdir(output, { recursive: true });
const templates = DRAWING_TEMPLATES.filter(template => template.chartId);
const expected = new Set(templates.map(template => `${template.id}.svg`));
const records = [];
for (const template of templates) {
    if (!/^[a-z\d-]+$/.test(template.id)) throw new Error(`Invalid preview ID: ${template.id}`);
    const rendered = renderDrawingPreview(template);
    const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const desc = `${template.name}; independently rendered demonstration data; ${template.l1502 ? `L1502 issue ${template.l1502.issue}; independent web implementation` : template.paper ? `source style: ${template.paper.source}; Chen Liu et al., figures4papers, CC BY-NC 4.0` : 'Fesilent Reverie data template'}`;
    const svg = rendered.svg.replace(/(<svg\b[^>]*>)/, `$1<desc>${escape(desc)}</desc>`);
    await writeFile(new URL(`${template.id}.svg`, output), svg);
    records.push({ id: template.id, name: template.name, width: rendered.width, height: rendered.height, texts: rendered.texts });
}
for (const name of await readdir(output)) {
    if (name.endsWith('.svg') && !expected.has(name)) await rm(new URL(name, output));
}
await writeFile(auditPath, JSON.stringify(records, null, 2));

// Full-canvas contact sheet: contains every retained chart, without cropping any canvas.
const columns = 3, cellWidth = 560, cellHeight = 410, labelHeight = 58;
const composites = [];
for (let index = 0; index < records.length; index++) {
    const item = records[index], x = (index % columns) * cellWidth, y = Math.floor(index / columns) * cellHeight;
    const image = await sharp(await readFile(new URL(`${item.id}.svg`, output))).resize({ width: cellWidth - 24, height: cellHeight - labelHeight - 20, fit: 'contain', background: '#fff' }).png().toBuffer();
    const title = item.name.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const label = Buffer.from(`<svg width="${cellWidth}" height="${labelHeight}"><rect width="100%" height="100%" fill="#f1f5f9"/><text x="12" y="22" font-family="Arial, sans-serif" font-size="14" fill="#111827">${index + 1}. ${title}</text><text x="12" y="44" font-family="Arial, sans-serif" font-size="11" fill="#475569">${item.id}</text></svg>`);
    composites.push({ input: image, left: x + 12, top: y + labelHeight + 8 }, { input: label, left: x, top: y });
}
await sharp({ create: { width: columns * cellWidth, height: Math.ceil(records.length / columns) * cellHeight, channels: 3, background: '#fff' } }).composite(composites).png().toFile(contactPath);
const contactPages = [];
const rowsPerPage = 3;
for (let page = 0; page * rowsPerPage * columns < records.length; page++) {
    const top = page * rowsPerPage * cellHeight;
    const height = Math.min(rowsPerPage * cellHeight, Math.ceil(records.length / columns) * cellHeight - top);
    const pagePath = contactPath.replace(/\.png$/i, `-page-${String(page + 1).padStart(2, '0')}.png`);
    await sharp(contactPath).extract({ left: 0, top, width: columns * cellWidth, height }).png().toFile(pagePath);
    contactPages.push(pagePath);
}
const clipped = records.flatMap(item => item.texts.filter(text => text.clipped).map(text => ({ id: item.id, ...text })));
console.log(JSON.stringify({ templates: records.length, output: fileURLToPath(output), audit: auditPath, contactSheet: contactPath, contactPages, clippedTexts: clipped.length, clippedTemplateIds: [...new Set(clipped.map(item => item.id))] }, null, 2));
if (process.argv.includes('--check') && clipped.length) throw new Error(`${clipped.length} text spans outside preview canvases; inspect ${auditPath}`);
