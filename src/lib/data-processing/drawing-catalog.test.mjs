import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as echarts from 'echarts';
import { DRAWING_TEMPLATES, panelTemplateId } from './drawing-catalog.ts';
import { PAPER_FIGURES } from './paper-figures/catalog.ts';
import { parseTemplateTable, suggestMapping, buildTemplateData } from './templates.ts';
import { createTemplateOption } from './template-chart.ts';
import { standaloneTexts, renderStandaloneImage } from './standalone-image.ts';
const style={title:'用户单图',xLabel:'样品',yLabel:'数值',fontFamily:'Arial',fontSize:12,palette:'journal',showGrid:false,showValues:false,errorMeasure:'SD',width:680,height:420};

test('one library retains every source region as an independent typed template with its own preview',()=>{
    assert.equal(DRAWING_TEMPLATES.length,118);
    assert.equal(new Set(DRAWING_TEMPLATES.map(t=>t.id)).size,118);
    assert.equal(DRAWING_TEMPLATES.filter(t=>t.paper&&t.chartId).length,69);
    assert.equal(DRAWING_TEMPLATES.filter(t=>!t.chartId).length,28);
    for(const f of PAPER_FIGURES)for(const r of f.regions){const item=DRAWING_TEMPLATES.find(t=>t.id===panelTemplateId(f.id,r.id));assert.ok(item);assert.equal(item.paper.regionId,r.id);assert.ok(existsSync(new URL(`../../../public${item.preview}`,import.meta.url)));}
});
test('all 69 numerical single panels bind demo columns and render without a full-paper backplate or other panels',()=>{
    for(const t of DRAWING_TEMPLATES.filter(t=>t.paper&&t.chartId)){
        const table=parseTemplateTable(t.demo),mapping=suggestMapping(table,t.chartId);
        const result=buildTemplateData(table,mapping,t.chartId,Object.keys(mapping.errors).length?'summary':'replicates');
        assert.ok(result.data,`${t.id}: ${result.error}`);
        const r=t.paper.region;
        const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:680,height:420});
        try{chart.setOption(createTemplateOption(result.data,t.chartId,{...style,customColors:r.colors,horizontal:r.kind==='horizontal',colorByCategory:r.kind==='bars',stackedArea:r.kind==='area',hatching:r.hatching,fillLines:r.fillSeries,sphereGuide:r.kind!=='vectors'}));const svg=chart.renderToSVGString();assert.ok(svg.startsWith('<svg'));assert.ok(!/NaN|Infinity/.test(svg),t.id);assert.ok(!svg.includes('/paper-figures/'),t.id);}finally{chart.dispose();}
    }
});
test('paper presets accept new category names, fewer groups and values beyond the original paper ranges',()=>{
    const cases=[['paper-immuno-comparison-auroc',[['新实验组','Mean','SD'],['样品 α',12,1],['样品 β',25,2]]],['paper-vigil-radar-radar',[['指标','自有模型'],['指标甲',300],['指标乙',200],['指标丙',900],['指标丁',100]]],['paper-immuno-iedb-results-attention',[['行','自己列一','自己列二'],['自己行一',20,30],['自己行二',40,50]]]];
    for(const [id,matrix] of cases){const t=DRAWING_TEMPLATES.find(t=>t.id===id);const table=parseTemplateTable(matrix),mapping=suggestMapping(table,t.chartId);const r=buildTemplateData(table,mapping,t.chartId,Object.keys(mapping.errors).length?'summary':'replicates');assert.ok(r.data,`${id}: ${r.error}`);assert.equal(r.data.x.length,matrix.length-1);assert.equal(r.data.skipped,0);}
});
test('standalone illustration exports contain only the selected crop and escaped edits',()=>{
    for(const t of DRAWING_TEMPLATES.filter(t=>!t.chartId)){
        assert.ok(existsSync(new URL(`../../../public/paper-panels/${t.id}.png`,import.meta.url)));
        for(const text of standaloneTexts(t))assert.ok(text.x>=0&&text.y>=0&&text.x+text.w<=1.000001&&text.y+text.h<=1.000001);
        const svg=renderStandaloneImage(t,{title:'标题 <script>',caption:'说明 & 样品',labels:{}},`/paper-panels/${t.id}.png`);
        assert.ok(svg.includes('&lt;script&gt;'));assert.ok(svg.includes('说明 &amp; 样品'));assert.ok(!svg.includes('/paper-figures/'));assert.equal((svg.match(/<image /g)||[]).length,1);
    }
});
