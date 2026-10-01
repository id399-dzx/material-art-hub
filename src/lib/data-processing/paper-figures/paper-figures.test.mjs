import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { PAPER_FIGURES } from './catalog.ts';
import { emptyPaperChanges, paperDemoPoints, paperExampleCsv, parsePaperData } from './data.ts';
import { renderPaperFigure } from './render.ts';
const matrix = (region, points=paperDemoPoints(region)) => [['panel','series','x','y','z','error'],...points.map(point=>[region.id,point.series,point.x,point.y,point.z??null,point.error??null])];

test('all seventeen README figures have their own retained backplate, text coordinates and panel bounds',()=>{
 assert.equal(PAPER_FIGURES.length,17);assert.equal(new Set(PAPER_FIGURES.map(figure=>figure.source)).size,17);
 for(const figure of PAPER_FIGURES){
  assert.ok(existsSync(`public/paper-figures/${figure.id}.png`));assert.ok(figure.texts.length>0);
  for(const region of figure.regions){const [x,y,w,h]=region.rect;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1&&y+h<=1,`${figure.id}/${region.id}`);}
  const svg=renderPaperFigure(figure,emptyPaperChanges());assert.ok(svg.includes(`/paper-figures/${figure.id}.png`));assert.match(svg,/原论文图例示例/);assert.doesNotMatch(svg,/data-panel=/);
 }
 assert.match(readFileSync('public/paper-figures/ATTRIBUTION.md','utf8'),/CC BY-NC 4.0/);
});
test('every numerical panel accepts its authored example and renders finite SVG replacement geometry',()=>{
 let count=0;
 for(const figure of PAPER_FIGURES)for(const region of figure.regions){
  if(region.kind==='image')continue;
  const result=parsePaperData(matrix(region),figure,region,'test.csv');assert.equal(result.error,null,`${figure.id}/${region.id}: ${result.error}`);
  const changes=emptyPaperChanges();changes.panels=result.panels;
  const svg=renderPaperFigure(figure,changes);assert.ok(svg.includes(`data-panel="${region.id}"`));assert.doesNotMatch(svg,/NaN|Infinity|height="-/);assert.match(svg,/未替换区域仍为原图示例/);count++;
 }
 assert.ok(count>50);
});
test('the full-figure CSV can replace every numerical panel atomically',()=>{
 for(const figure of PAPER_FIGURES){
  const first=figure.regions.find(region=>region.kind!=='image');if(!first)continue;
  const book=XLSX.read(paperExampleCsv(figure),{type:'string'}),rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:null});
  const result=parsePaperData(rows,figure,first,'full.csv');assert.equal(result.error,null,figure.id);assert.equal(Object.keys(result.panels).length,figure.regions.filter(region=>region.kind!=='image').length);
 }
});
test('missing numbers are skipped as whole rows, supplied zeros and error magnitudes remain unchanged',()=>{
 const figure=PAPER_FIGURES[4],region=figure.regions[0];
 const result=parsePaperData([['x','y','series','error'],[0,0,'DPO',0],[1,null,'DPO',2],[2,5,'DPO',.3]],figure,region,'test');
 assert.equal(result.error,null);assert.deepEqual(result.panels[region.id].points.map(p=>[p.x,p.y,p.error]),[[0,0,0],[2,5,.3]]);assert.match(result.warnings[0],/第 3 行/);
});
test('invalid panel IDs and duplicate categorical rows never silently overwrite another region',()=>{
 const figure=PAPER_FIGURES[0],region=figure.regions[0];
 assert.match(parsePaperData([['panel','x','y'],['other','A',.7]],figure,region,'bad').error,/不属于/);
 const rows=matrix(region);rows.push(rows[1]);assert.match(parsePaperData(rows,figure,region,'bad').error,/重复/);
});
test('radar retains twelve explicit benchmark scales and rejects incomplete or out-of-scale input',()=>{
 const figure=PAPER_FIGURES[3],region=figure.regions[0];assert.equal(region.radarRanges.length,12);
 assert.match(parsePaperData(matrix(region,paperDemoPoints(region).slice(1)),figure,region,'bad').error,/完整/);
 const points=paperDemoPoints(region);points[0].y=500;assert.match(parsePaperData(matrix(region,points),figure,region,'bad').error,/原图刻度/);
});
test('composition rejects incomplete or non-unit proportions',()=>{
 const figure=PAPER_FIGURES[1],region=figure.regions[0],points=paperDemoPoints(region);
 points[0].y=.9;assert.match(parsePaperData(matrix(region,points),figure,region,'bad').error,/之和/);
 assert.match(parsePaperData(matrix(region,points.slice(1)),figure,region,'bad').error,/完整/);
});
test('user text remains inert XML and self-contained exports embed the background and attribution',()=>{
 const figure=PAPER_FIGURES[0],changes=emptyPaperChanges();changes.labels[figure.texts[0].id]='<script>alert("x")</script> & <image href="https://example.com">';
 const svg=renderPaperFigure(figure,changes,'data:image/png;base64,AA==');assert.doesNotMatch(svg,/<script>|<image href="https:/);assert.match(svg,/&lt;script&gt;/);assert.match(svg,/data:image\/png;base64,AA==/);assert.match(svg,/CC BY-NC 4.0/);
});

test('heatmap color bars and explicit positions cannot silently misrepresent imported values',()=>{
 const figure=PAPER_FIGURES[9],region=figure.regions.find(r=>r.id==='high-frequency');
 const points=paperDemoPoints(region);points[0].z=46;assert.match(parsePaperData(matrix(region,points),figure,region,'bad').error,/色标/);
 points[0].z=20;points[0].y=1.5;assert.match(parsePaperData(matrix(region,points),figure,region,'bad').error,/整数位置/);
 points[0].y=1;points[0].series='another';assert.match(parsePaperData(matrix(region,points),figure,region,'bad').error,/series/);
});
test('fixed baselines remain constant and a missing probability series never crashes the figure',()=>{
 const figure=PAPER_FIGURES[4],region=figure.regions[0],points=paperDemoPoints(region);points[0].y=12;
 assert.match(parsePaperData(matrix(region,points),figure,region,'bad').error,/固定基线/);
 const concept=PAPER_FIGURES[5],distribution=concept.regions[0],changes=emptyPaperChanges();
 changes.panels[distribution.id]={points:paperDemoPoints(distribution).filter(p=>p.series===distribution.series[0]),filename:'one.csv'};
 assert.doesNotThrow(()=>renderPaperFigure(concept,changes));
});
test('edited vertical axis names retain the original text orientation',()=>{
 const figure=PAPER_FIGURES[0],changes=emptyPaperChanges(),axis=figure.texts.find(t=>t.text==='AUROC');changes.labels[axis.id]='测试指标';
 const svg=renderPaperFigure(figure,changes);assert.match(svg,/rotate\(-90\)/);assert.match(svg,/测试指标/);
});
