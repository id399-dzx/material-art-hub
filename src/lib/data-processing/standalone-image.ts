import { PAPER_FIGURES, type FigureText } from './paper-figures/catalog.ts';
import { escapeXml } from './paper-figures/render.ts';
import type { DrawingTemplate } from './drawing-catalog.ts';

export type ImageTemplateChanges = { image?: string; filename?: string; title: string; caption: string; labels: Record<string, string> };
export function standaloneTexts(template: DrawingTemplate): FigureText[] {
    if (!template.paper) return [];
    const figure = PAPER_FIGURES.find(f => f.id === template.paper!.figureId)!;
    const [x,y,w,h] = template.paper.region.rect;
    return figure.texts.filter(t => t.x >= x && t.y >= y && t.x+t.w <= x+w && t.y+t.h <= y+h)
        .map(t => ({...t,x:(t.x-x)/w,y:(t.y-y)/h,w:t.w/w,h:t.h/h}));
}
export function imageCanvasSize(template: DrawingTemplate) {
    const paper = template.paper!, figure = PAPER_FIGURES.find(f => f.id === paper.figureId)!;
    return { width: 1000, imageHeight: figure.height * paper.region.rect[3] / (figure.width * paper.region.rect[2]) * 1000 };
}
export function renderStandaloneImage(template: DrawingTemplate, changes: ImageTemplateChanges, background: string) {
    const {imageHeight} = imageCanvasSize(template), height = imageHeight+90;
    const image = changes.image || background;
    let labels = '';
    if (!changes.image) for (const t of standaloneTexts(template)) {
        if (changes.labels[t.id] === undefined) continue;
        const x=t.x*1000,y=55+t.y*imageHeight,w=t.w*1000,h=t.h*imageHeight;
        const vertical=h>w*1.8&&t.text.length>=3, size=Math.max(5,(vertical?w:h)*.85);
        const fill=/^#[a-f\d]{6}$/i.test(t.background)?t.background:'#ffffff';
        const color=/^#[a-f\d]{6}$/i.test(t.color)?t.color:'#222222';
        labels+=`<g><rect x="${x-1}" y="${y-1}" width="${w+2}" height="${h+2}" fill="${fill}"/><text ${vertical?`transform="translate(${x+w/2} ${y+h/2}) rotate(-90)" x="0" y="${size*.35}" text-anchor="middle"`:`x="${x}" y="${y+size}"`} font-family="Arial,sans-serif" font-size="${size}" fill="${color}">${escapeXml(changes.labels[t.id])}</text></g>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}" role="img"><title>${escapeXml(changes.title)}</title><metadata>Standalone image template. Source: Chen Liu and collaborators, figures4papers, CC BY-NC 4.0. ${escapeXml(template.paper!.source)}; ${escapeXml(template.paper!.regionId)}. ${changes.image?'Image replaced by user.':'Original paper illustration; cropped to this module.'}</metadata><rect width="1000" height="${height}" fill="white"/><text x="500" y="32" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#222222">${escapeXml(changes.title)}</text><image href="${escapeXml(image)}" x="0" y="55" width="1000" height="${imageHeight}" preserveAspectRatio="xMidYMid meet"/>${labels}<text x="15" y="${height-12}" font-family="Arial,sans-serif" font-size="12" fill="#666666">${escapeXml(changes.caption)}</text></svg>`;
}
