import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { PAPER_FIGURES } from '../src/lib/data-processing/paper-figures/catalog.ts';
const output = new URL('../public/paper-panels/', import.meta.url);
await mkdir(output, { recursive: true });
let count = 0;
for (const figure of PAPER_FIGURES) {
    const input = new URL(`../public/paper-figures/${figure.id}.png`, import.meta.url);
    const metadata = await sharp(input.pathname).metadata();
    for (const region of figure.regions) {
        const [x,y,w,h] = region.rect;
        const left = Math.floor(x * metadata.width), top = Math.floor(y * metadata.height);
        const width = Math.min(metadata.width-left, Math.ceil(w*metadata.width)), height = Math.min(metadata.height-top, Math.ceil(h*metadata.height));
        const id = `paper-${figure.id}-${region.id}`;
        const cropped = await sharp(input.pathname).extract({left,top,width,height}).png().toBuffer();
        await sharp(cropped).resize({width:600,height:360,fit:'contain',background:'#ffffff'}).webp({quality:86}).toFile(new URL(`${id}-preview.webp`,output).pathname);
        if (region.kind === 'image') await sharp(cropped).toFile(new URL(`${id}.png`,output).pathname);
        count++;
    }
}
console.log(`Generated ${count} independent panel previews and 28 standalone image backplates.`);
