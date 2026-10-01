import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {readWorkbook} from './read-workbook.ts';
const rows=b=>{const book=readWorkbook(new Uint8Array(b).buffer,'实验.csv');return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1});};
for(const prefix of ['', '\ufeff'])test(`Chinese UTF-8 CSV ${prefix?'with BOM':'without BOM'} preserves labels and measurements`,()=>{assert.deepEqual(rows(Buffer.from(prefix+'样品,数值\n甲,12')), [['样品','数值'],['甲',12]]);});
test('CSV from legacy Chinese Excel uses GB18030 when UTF-8 is invalid',()=>assert.deepEqual(rows(Buffer.from('d1f9c6b72ccafdd6b50abcd72c3132','hex')),[['样品','数值'],['甲',12]]));
test('UTF-16 CSV exported by spreadsheet software preserves Chinese characters',()=>assert.deepEqual(rows(Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from('样品,数值\n甲,12','utf16le')])),[['样品','数值'],['甲',12]]));
