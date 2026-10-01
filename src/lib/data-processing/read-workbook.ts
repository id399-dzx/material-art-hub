import * as XLSX from 'xlsx';

export function decodeCsv(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le', { fatal: true }).decode(buffer);
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be', { fatal: true }).decode(buffer);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { return new TextDecoder('gb18030', { fatal: true }).decode(buffer); }
}
export function readWorkbook(buffer: ArrayBuffer, filename: string) {
    return /\.csv$/i.test(filename) ? XLSX.read(decodeCsv(buffer), {type:'string'}) : XLSX.read(buffer, {type:'array'});
}
