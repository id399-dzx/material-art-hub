import { createFigureId, MAX_COMPOSITION_BYTES, MAX_FIGURE_BYTES, sanitizeFigureSvg, validateComposition, type CompositionDocument, type FigureAsset } from './figure-composition.ts';
import { downloadFigureBlob } from './publication.ts';

const DB_NAME = 'fesilent-figure-composition';
const STORE = 'projects';
const KEY = 'current';
function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('当前浏览器不支持本地草稿，请下载工程保存。')); return; }
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('无法打开本地草稿，请检查浏览器存储权限或下载工程保存。'));
        request.onblocked = () => reject(new Error('本地草稿正在被其他窗口使用，请关闭其他窗口后重试。'));
    });
}
export async function loadComposition(): Promise<CompositionDocument | null> {
    const db = await openDatabase();
    try {
        const value = await new Promise<unknown>((resolve, reject) => {
            const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
            request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('读取本地草稿失败，请重新打开已下载的工程。'));
        });
        return value === undefined ? null : validateComposition(value);
    } finally { db.close(); }
}
export async function saveComposition(doc: CompositionDocument): Promise<void> {
    const validated = validateComposition(doc), db = await openDatabase();
    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(STORE, 'readwrite'); transaction.objectStore(STORE).put(validated, KEY);
            transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(new Error('本地保存失败，可能是存储空间不足；请下载工程备份。')); transaction.onabort = () => reject(new Error('草稿保存被中断，请下载工程备份。'));
        });
    } finally { db.close(); }
}
export async function openCompositionFile(file: File): Promise<CompositionDocument> {
    if (file.size > MAX_COMPOSITION_BYTES) throw new Error('组图工程超过 64 MB，请选择较小的工程。');
    let value: unknown; try { value = JSON.parse(await file.text()); } catch { throw new Error('无法读取工程，请选择下载保存的组图 JSON 文件。'); }
    return validateComposition(value);
}
export function downloadComposition(doc: CompositionDocument): void {
    const validated = validateComposition(doc), filename = (validated.name.trim() || '论文组图').replace(/[\\/:*?"<>|]/g, '_');
    downloadFigureBlob(new Blob([JSON.stringify(validated)], { type: 'application/json;charset=utf-8' }), `${filename}.figure.json`);
}
function fileDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('图片读取失败，请重新选择文件。')); reader.readAsDataURL(file); });
}
export async function readFigureUpload(file: File): Promise<FigureAsset> {
    if (!file.size || file.size > MAX_FIGURE_BYTES) throw new Error('请选择不超过 20 MB 的 PNG、JPEG 或 SVG 图片。');
    const svg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
    const asset: FigureAsset = { id: createFigureId('upload'), name: file.name.replace(/\.(svg|png|jpe?g)$/i, ''), kind: 'upload', width: 1, height: 1 };
    if (svg) {
        const clean = sanitizeFigureSvg(await file.text()); return { ...asset, ...clean };
    }
    // Check file signatures before the browser decoder, including extension/type mismatches.
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const png = header.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte), jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
    if (!png && !jpeg) throw new Error('暂时支持 PNG、JPEG 和静态 SVG。请将其他格式转换后上传。');
    const dataUrl = await fileDataUrl(new File([file], file.name, { type: png ? 'image/png' : 'image/jpeg' }));
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('图片无法解码，请重新导出 PNG 或 JPEG。')); image.src = dataUrl; });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 50000 || image.naturalHeight > 50000 || image.naturalWidth * image.naturalHeight > 100000000) throw new Error('图片尺寸过大，请将图片缩小到 1 亿像素以内。');
    return { ...asset, width: image.naturalWidth, height: image.naturalHeight, dataUrl };
}
