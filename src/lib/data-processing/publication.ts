export type ExportSettings = { widthMm: number; dpi: number; grayscale: boolean; preset: 'single' | 'double' | 'custom' };
export type FigureIssue = { level: 'warning' | 'info'; message: string };
export const initialExportSettings = (): ExportSettings => ({ widthMm: 85, dpi: 300, grayscale: false, preset: 'single' });
export function exportDimensions(width: number, height: number, settings: ExportSettings) {
    if (![width, height, settings.widthMm, settings.dpi].every(Number.isFinite) || width <= 0 || height <= 0 || settings.widthMm < 40 || settings.widthMm > 300 || ![150, 300, 600].includes(settings.dpi)) throw new Error('导出宽度须为 40–300 mm，分辨率请选择 150 / 300 / 600 DPI。');
    const heightMm = settings.widthMm * height / width;
    return { widthMm: settings.widthMm, heightMm, widthPx: Math.round(settings.widthMm / 25.4 * settings.dpi), heightPx: Math.round(heightMm / 25.4 * settings.dpi) };
}
export function physicalSvg(svg: string, width: number, height: number, settings: ExportSettings) {
    const { widthMm, heightMm } = exportDimensions(width, height, settings);
    // Preserve a fixed viewport. Never crop to content: output dimensions stay exact.
    let output = svg.replace(/<svg\b([^>]*)>/, (_, attributes: string) => `<svg${attributes.replace(/\s(?:width|height|viewBox)="[^"]*"/g, '')} width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${width} ${height}">`);
    if (settings.grayscale) output = output.replace(/(<svg\b[^>]*>)/, '$1<defs><filter id="publication-grayscale" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/></filter></defs><g filter="url(#publication-grayscale)">').replace(/<\/svg>\s*$/, '</g></svg>');
    return output;
}
function crc32(bytes: Uint8Array) {
    let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    return (crc ^ 0xffffffff) >>> 0;
}
export function pngWithDpi(input: Uint8Array, dpi: number) {
    if (input.length < 8 || input[0] !== 137 || input[1] !== 80 || input[2] !== 78 || input[3] !== 71) throw new Error('PNG 文件无效。');
    const chunk = new Uint8Array(21), view = new DataView(chunk.buffer), pixelsPerMetre = Math.round(dpi / .0254);
    view.setUint32(0, 9); chunk.set([112, 72, 89, 115], 4); view.setUint32(8, pixelsPerMetre); view.setUint32(12, pixelsPerMetre); chunk[16] = 1; view.setUint32(17, crc32(chunk.subarray(4, 17)));
    const pieces: Uint8Array[] = [input.subarray(0, 8)]; let offset = 8, added = false;
    while (offset + 12 <= input.length) {
        const length = new DataView(input.buffer, input.byteOffset + offset, 4).getUint32(0), end = offset + length + 12;
        if (end > input.length) throw new Error('PNG 数据不完整。');
        const type = String.fromCharCode(...input.subarray(offset + 4, offset + 8));
        if (type !== 'pHYs') pieces.push(input.subarray(offset, end));
        if (type === 'IHDR') { pieces.push(chunk); added = true; }
        offset = end;
    }
    if (!added) throw new Error('PNG 缺少尺寸信息。');
    const output = new Uint8Array(pieces.reduce((sum, item) => sum + item.length, 0)); let position = 0;
    pieces.forEach(item => { output.set(item, position); position += item.length; });
    return output;
}
export async function auditSvg(svg: string, width: number, height: number, widthMm: number): Promise<FigureIssue[]> {
    await document.fonts.ready;
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (parsed.querySelector('parsererror')) throw new Error('图形 SVG 无法解析。');
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-50000px;top:0;opacity:0;pointer-events:none;';
    const root = document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
    root.setAttribute('width', String(width)); root.setAttribute('height', String(height)); host.append(root); document.body.append(host);
    const issues: FigureIssue[] = [];
    try {
        const texts = [...root.querySelectorAll('text')].filter(text => text.textContent?.trim()), canvas = root.getBoundingClientRect();
        let clipped = 0, small = 0, overlaps = 0;
        const boxes = texts.slice(0, 500).map(text => {
            const box = text.getBoundingClientRect(), style = getComputedStyle(text), size = parseFloat(style.fontSize);
            if (box.width > 0 && box.height > 0 && (box.left < canvas.left - 2 || box.right > canvas.right + 2 || box.top < canvas.top - 2 || box.bottom > canvas.bottom + 2)) clipped++;
            const scale = text.getScreenCTM();
            const fontPt = size * (scale ? Math.hypot(scale.a, scale.b) : 1) * widthMm / width * 72 / 25.4;
            if (Number.isFinite(fontPt) && fontPt < 6) small++;
            return { box, text };
        });
        boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => {
            const dx = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left), dy = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
            if (dx > 2 && dy > 2 && dx * dy > .2 * Math.min(a.box.width * a.box.height, b.box.width * b.box.height)) overlaps++;
        }));
        if (clipped) issues.push({ level: 'warning', message: `${clipped} 处矢量文字可能超出画布。建议缩短文字或调整画布比例后再次检查。` });
        if (small) issues.push({ level: 'warning', message: `${small} 处矢量文字按最终尺寸换算小于 6 pt。请增大输出宽度或字号。` });
        if (overlaps) issues.push({ level: 'warning', message: `${overlaps} 对文字包围框可能重叠（含标注）。请结合预览确认，必要时减少类别或增大画布。` });
        if (root.querySelector('image')) issues.push({ level: 'info', message: '图形包含位图。提高导出 DPI 不会增加底图细节；位图内文字无法通过此检查测量。' });
        issues.push({ level: 'info', message: '已检查矢量文字边界、字号与重叠。图例遮挡、字体字形、色觉可辨性和统计结论仍需对照预览核对。' });
    } finally { host.remove(); }
    return issues;
}
export function downloadFigureBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function rasterizeFigure(svg: string, width: number, height: number, settings: ExportSettings) {
    const dimensions = exportDimensions(width, height, settings);
    if (dimensions.widthPx * dimensions.heightPx > 24000000) throw new Error('导出超过 2400 万像素，请减小输出宽度或 DPI。');
    const url = URL.createObjectURL(new Blob([physicalSvg(svg, width, height, settings)], { type: 'image/svg+xml;charset=utf-8' }));
    try {
        await document.fonts.ready;
        const image = new Image(); await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('图形转换失败，请尝试 SVG 导出。')); image.src = url; });
        const canvas = document.createElement('canvas'); canvas.width = dimensions.widthPx; canvas.height = dimensions.heightPx;
        const context = canvas.getContext('2d'); if (!context) throw new Error('浏览器不能生成 PNG。');
        context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG 导出失败。')), 'image/png'));
        return new Blob([pngWithDpi(new Uint8Array(await blob.arrayBuffer()), settings.dpi).buffer as ArrayBuffer], { type: 'image/png' });
    } finally { URL.revokeObjectURL(url); }
}
