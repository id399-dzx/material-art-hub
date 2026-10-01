'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import * as XLSX from 'xlsx';
import { ArrowDownToLine, Check, ExternalLink, FileSpreadsheet, Layers3, Search, UploadCloud, Undo2, ZoomIn, ZoomOut, Type, ImageIcon } from 'lucide-react';
import { PAPER_FIGURES, PAPER_SOURCE, type FigureRegion } from '@/lib/data-processing/paper-figures/catalog';
import { emptyPaperChanges, paperDemoPoints, paperExampleCsv, parsePaperData, type PaperChanges, type PaperPanelData } from '@/lib/data-processing/paper-figures/data';
import { renderPaperFigure } from '@/lib/data-processing/paper-figures/render';
import PublicationExport from './PublicationExport';
import { initialExportSettings, type ExportSettings } from '@/lib/data-processing/publication';
import './paper-figure-studio.css';

const KIND_NAMES: Record<string,string> = {bars:'柱状与误差',horizontal:'横向比较',stacked:'组成堆叠',line:'折线',area:'累计面积',scatter:'散点',heatmap:'矩阵/密度',radar:'雷达',sphere:'球面与向量',vectors:'空间向量',surface:'曲面',violin:'样本分布',box:'样本箱线',image:'插图模块'};
function download(blob:Blob,name:string) { const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
async function dataUrl(blob:Blob) {return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('文件读取失败。'));reader.readAsDataURL(blob);});}
async function inlineBackground(id:string) {const response=await fetch(`/paper-figures/${id}.png`);if(!response.ok)throw new Error('图例底图读取失败，请刷新后重试。');return dataUrl(await response.blob());}
function validRange(values:unknown): values is [number,number] {return Array.isArray(values)&&values.length===2&&values.every(v=>typeof v==='number'&&Number.isFinite(v))&&values[0]<values[1];}

export default function PaperFigureStudio({active}:{active:boolean}) {
 const [selected,setSelected]=useState(PAPER_FIGURES[0].id),[search,setSearch]=useState(''),[filter,setFilter]=useState('全部');
 const [states,setStates]=useState<Record<string,PaperChanges>>({}),[history,setHistory]=useState<Record<string,PaperChanges>>({});
 const [regionId,setRegionId]=useState(PAPER_FIGURES[0].regions[0].id),[mode,setMode]=useState<'data'|'text'|'image'>('data');
 const [labelId,setLabelId]=useState(''),[textSearch,setTextSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[warnings,setWarnings]=useState<string[]>([]);
 const [reference,setReference]=useState(false),[outlines,setOutlines]=useState(true),[zoom,setZoom]=useState(100);
 const [exportSettings,setExportSettings]=useState<ExportSettings>(()=>({...initialExportSettings(),preset:"double",widthMm:180}));
 const figure=PAPER_FIGURES.find(item=>item.id===selected)!;
 const changes=useMemo(()=>states[selected]||emptyPaperChanges(),[states,selected]);
 const region=figure.regions.find(item=>item.id===regionId)||figure.regions[0];
 const label=figure.texts.find(item=>item.id===labelId);
 const filtered=PAPER_FIGURES.filter((item,index)=>(filter==='全部'||(filter==='统计图例'?index<7:index>=7))&&`${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase().trim()));
 const textItems=figure.texts.filter(item=>item.id===labelId||(changes.labels[item.id]??item.text).toLowerCase().includes(textSearch.toLowerCase()));
 const regionData=changes.panels[region.id];
 const counts=Object.keys(changes.panels).length+Object.keys(changes.images).length;
 const canvasHeight=figure.height/figure.width*1000;
 const svg=useMemo(()=>renderPaperFigure(figure,reference?emptyPaperChanges():changes,undefined,false),[figure,changes,reference]);
 const textBox=label?`${Math.round(label.x*100)}%, ${Math.round(label.y*100)}%`:'';

 function mutate(next:PaperChanges) {setHistory(current=>({...current,[selected]:changes}));setStates(current=>({...current,[selected]:next}));setReference(false);setError('');}
 function chooseFigure(id:string) {if(busy||id===selected)return;const next=PAPER_FIGURES.find(item=>item.id===id)!;setSelected(id);setRegionId(next.regions[0].id);setMode(next.regions[0].kind==='image'?'image':'data');setLabelId('');setTextSearch('');setReference(false);setZoom(100);setError('');setWarnings([]);}
 function chooseMode(next:'data'|'text'|'image') {if(busy)return;setMode(next);if(next!=='text'&&((next==='image')!==(region.kind==='image'))){const first=figure.regions.find(item=>(item.kind==='image')===(next==='image'));if(first)setRegionId(first.id);}setError('');}
 function chooseRegion(item:FigureRegion) {if(busy)return;setRegionId(item.id);setMode(item.kind==='image'?'image':'data');setReference(false);setError('');setWarnings([]);}
 function resetRegion() {const panels={...changes.panels},images={...changes.images};delete panels[region.id];delete images[region.id];mutate({...changes,panels,images});setWarnings([]);}
 async function importData(event:React.ChangeEvent<HTMLInputElement>) {
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  setBusy(true);setError('');setWarnings([]);
  try {
   if(!/\.(csv|xlsx|xls)$/i.test(file.name)||file.size>10*1024*1024)throw new Error('请导入 10 MB 以内的 CSV / XLS / XLSX。');
   const book=XLSX.read(await file.arrayBuffer(),{type:'array'}),sheets=book.SheetNames.map(name=>XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name],{header:1,defval:null,blankrows:true}));
   const matrix=sheets.find(rows=>rows.some(row=>row.some(cell=>cell!=null&&String(cell).trim())))||[];
   const result=parsePaperData(matrix,figure,region,file.name);if(result.error||!result.panels)throw new Error(result.error||'数据无法读取。');
   mutate({...changes,panels:{...changes.panels,...result.panels}});setWarnings([...result.warnings,...(book.SheetNames.length>1?['本次读取首个非空工作表；建议使用 panel 列把多个面板放在同一张表中。']:[])]);
  }catch(error){setError(error instanceof Error?error.message:'数据读取失败。');}finally{setBusy(false);}
 }
 async function importImage(event:React.ChangeEvent<HTMLInputElement>) {
  const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy(true);setError('');
  try {
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('插图支持 10 MB 以内的 PNG / JPEG / WebP。');
   const url=await dataUrl(file);const image=new window.Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('图片不能解码，请检查格式。'));image.src=url;});
   mutate({...changes,images:{...changes.images,[region.id]:url}});
  }catch(error){setError(error instanceof Error?error.message:'插图读取失败。');}finally{setBusy(false);}
 }
 function useDemo() {
  const result=parsePaperData([['panel','series','x','y','z','error'],...paperDemoPoints(region).map(point=>[region.id,point.series,point.x,point.y,point.z??null,point.error??null])],figure,region,'自编演示数据');
  if(result.error||!result.panels){setError(result.error||'示例不适用于此面板。');return;}
  mutate({...changes,panels:{...changes.panels,...result.panels}});setWarnings(['当前面板使用自编演示数据，仅用于试用替换功能，不是论文实验数据。',...result.warnings]);
 }
 function setAxis(axis:'x'|'y',index:0|1,value:string) {
  if(!regionData)return;const base=axis==='x'?(regionData.xRange||region.xRange):(regionData.yRange||region.yRange);if(!base)return;
  const next:[number,number]=[...base];next[index]=Number(value);
  if(!value.trim()||!validRange(next)){setError('坐标范围须为有限数值，且最小值小于最大值。');return;}
  mutate({...changes,panels:{...changes.panels,[region.id]:{...regionData,[axis==='x'?'xRange':'yRange']:next}}});
 }
 async function exportSvg() {
  const background=await inlineBackground(figure.id);
  return renderPaperFigure(figure,changes,background);
 }
 async function restoreProject(event:React.ChangeEvent<HTMLInputElement>) {
  const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy(true);setError('');
  try {
   if(file.size>30*1024*1024)throw new Error('模板工程文件不能超过 30 MB。');
   const project=JSON.parse(await file.text());if(project.version!==1||project.figureId!==selected||!project.changes)throw new Error('请选择此工程对应的图例后再打开。');
   const next=emptyPaperChanges();
   for(const [id,value] of Object.entries(project.changes.panels||{})) {
    const panel=figure.regions.find(region=>region.id===id),data=value as PaperPanelData;if(!panel||!Array.isArray(data.points))throw new Error('工程包含无效绘图区。');
    const result=parsePaperData([['panel','series','x','y','z','error'],...data.points.map(point=>[id,point.series,point.x,point.y,point.z??null,point.error??null])],figure,panel,'已保存工程');
    if(result.error||!result.panels||result.warnings.some(w=>w.includes('跳过')))throw new Error(result.error||'工程的数据不完整。');
    if(data.xRange!==undefined&&!validRange(data.xRange)||data.yRange!==undefined&&!validRange(data.yRange))throw new Error('工程坐标范围无效。');
    next.panels[id]={...result.panels[id],...(data.xRange?{xRange:data.xRange}:{}),...(data.yRange?{yRange:data.yRange}:{})};
   }
   for(const [id,text] of Object.entries(project.changes.labels||{})) {if(!figure.texts.some(label=>label.id===id)||typeof text!=='string'||text.length>500)throw new Error('工程文字标注无效。');next.labels[id]=text;}
   for(const [id,url] of Object.entries(project.changes.images||{})) {if(!figure.regions.some(region=>region.id===id&&region.kind==='image')||typeof url!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(url))throw new Error('工程插图无效。');next.images[id]=url;}
   mutate(next);setWarnings([]);
  }catch(error){setError(error instanceof Error?error.message:'工程读取失败。');}finally{setBusy(false);}
 }

 return <section id="paper-figures" className="paper-studio" hidden={!active} aria-labelledby="paper-studio-title">
  <input id="paper-figure-data-upload" type="file" accept=".csv,.xls,.xlsx" hidden disabled={busy} onChange={importData}/>
  <header className="paper-intro"><div><span className="paper-eyebrow"><Layers3 size={14}/> PAPER FIGURE COLLECTION / 论文图例模板</span><h2 id="paper-studio-title">从论文的完整表达开始<span>。</span></h2><p>沿用具体图例的编排、结构与标注，把你的数据放回对应面板。</p></div><div className="paper-intro-count"><strong>17</strong><span>原项目首页图例<br/>逐张对应 · 可对照原图</span></div></header>
  <div className="paper-toolbar"><div className="paper-filters">{['全部','统计图例','复合图例'].map(item=><button type="button" key={item} aria-pressed={filter===item} onClick={()=>setFilter(item)}>{item}<small>{item==='全部'?17:item==='统计图例'?7:10}</small></button>)}</div><label className="paper-search"><Search size={15}/><input aria-label="搜索论文图例" value={search} placeholder="搜索项目或图例" onChange={event=>setSearch(event.target.value)}/></label></div>
  <div className="paper-catalog-caption"><span>{filtered.length} / 17 张图例</span><a href={PAPER_SOURCE} target="_blank" rel="noreferrer">查看原项目 <ExternalLink size={12}/></a></div>
  <div className="paper-gallery" aria-label="选择论文图例">{filtered.map(item=><button type="button" key={item.id} disabled={busy} className={item.id===selected?'is-selected':''} aria-pressed={item.id===selected} onClick={()=>chooseFigure(item.id)}><div className="paper-card-image"><Image src={`/paper-figures/${item.id}-preview.webp`} width={600} height={390} alt={`${item.name}原图预览`}/><span>{String(PAPER_FIGURES.indexOf(item)+1).padStart(2,'0')}</span></div><div className="paper-card-body"><small>{item.project}</small><h3>{item.name}</h3><p>{item.description}</p><footer><span>{item.regions.filter(region=>region.kind!=='image').length} 个数据区 · {item.regions.filter(region=>region.kind==='image').length} 个插图区</span>{item.id===selected?<Check size={15}/>:<span>选择 →</span>}</footer></div></button>)}</div>
  {!filtered.length&&<p className="paper-empty">没有匹配的图例，请更换关键词。</p>}
  <div className="paper-editor-heading"><div><span className="paper-eyebrow">FIGURE EDITOR / 图例编辑</span><h3>{figure.name}</h3></div><div className="paper-editor-actions"><button type="button" disabled={busy||!history[selected]} onClick={()=>{const previous=history[selected];setStates(current=>({...current,[selected]:previous}));setHistory(current=>({...current,[selected]:changes}));setError('');setWarnings([]);setReference(false);}}><Undo2 size={14}/>撤销上一步</button><button type="button" disabled={busy} onClick={()=>{mutate(emptyPaperChanges());setWarnings([]);}}>恢复整图</button></div></div>
  <div className="paper-editor">
   <aside className="paper-controls"><fieldset disabled={busy}>
    <div className="paper-control-intro"><h4>选择要替换的区域</h4><p>保留原图底板；导入的数据与修改的标注绘制为独立图层。</p></div>
    <div className="paper-mode-tabs" role="group" aria-label="编辑内容"><button type="button" aria-pressed={mode==='data'} onClick={()=>chooseMode('data')}><FileSpreadsheet size={14}/>数据</button><button type="button" aria-pressed={mode==='text'} onClick={()=>chooseMode('text')}><Type size={14}/>文字标注</button><button type="button" aria-pressed={mode==='image'} onClick={()=>chooseMode('image')}><ImageIcon size={14}/>插图</button></div>
    {mode!=='text'&&<><label className="paper-field">{mode==='image'?'插图模块':'数据绘图区'}<select aria-label="选择图例绘图区" value={((mode==='image')===(region.kind==='image'))?region.id:''} onChange={event=>chooseRegion(figure.regions.find(region=>region.id===event.target.value)!)}>{figure.regions.filter(region=>mode==='image'?region.kind==='image':region.kind!=='image').map(region=><option key={region.id} value={region.id}>{region.name}</option>)}</select></label>
     {(mode==='data'&&region.kind!=='image')?<><div className="paper-region-meta"><span>{KIND_NAMES[region.kind]}</span><code>{region.id}</code></div><label className="paper-upload" htmlFor="paper-figure-data-upload"><UploadCloud size={25}/><strong>{busy?'正在读取…':'导入此图例的数据'}</strong><span>CSV / Excel · 最大 10 MB</span></label><div className="paper-small-actions"><button type="button" onClick={()=>download(new Blob([paperExampleCsv(figure,region)],{type:'text/csv;charset=utf-8'}),`${figure.id}-${region.id}-示例.csv`)}><ArrowDownToLine size={13}/>此面板 CSV</button><button type="button" onClick={()=>download(new Blob([paperExampleCsv(figure)],{type:'text/csv;charset=utf-8'}),`${figure.id}-整图示例.csv`)}>整图 CSV</button><button type="button" disabled={busy} onClick={useDemo}>试用演示数据</button></div><div className="paper-schema"><strong>数据格式</strong><p><code>panel, series, x, y{['sphere','vectors','surface','heatmap'].includes(region.kind)?', z':''}, error</code></p><p>panel 指定面板；省略时替换当前区域。series / 类别键沿用示例表格，显示文字可另行修改。空白数值不会补零。</p>{region.kind==='heatmap'&&<p>z 是格点数值；x、y 是格点坐标，不对缺失格点插值。</p>}{['violin','box'].includes(region.kind)&&<p>每行一条真实样本。箱体为 Q1 / Q3，中线为中位数，须线为 1.5×IQR 内最远观测；分布图由样本核密度绘制。</p>}{region.kind==='radar'&&<p>每根轴沿用原图对应的基准范围。数值超出该范围会提示，不能用裁切或平均填补掩盖。</p>}{region.hatching&&<p>保留原图的纹理编码，组成值须为比例或累计量。</p>}</div>
      {regionData&&<><div className="paper-source-status"><Check size={14}/><span>{regionData.filename} · {regionData.points.length} 行</span></div><div className="paper-table"><table><thead><tr><th>series</th><th>x</th><th>y</th>{regionData.points.some(point=>point.z!==undefined)&&<th>z</th>}</tr></thead><tbody>{regionData.points.slice(0,6).map((point,i)=><tr key={i}><td>{point.series}</td><td>{point.x}</td><td>{point.y}</td>{point.z!==undefined&&<td>{point.z}</td>}</tr>)}</tbody></table></div>{region.yRange&&!['radar','heatmap','horizontal'].includes(region.kind)&&<div className="paper-ranges"><span>Y 轴范围（同时更新刻度）</span>{([0,1] as const).map(index=><label key={index}>{index===0?'最小值':'最大值'}<input aria-label={index===0?'图例 Y 最小值':'图例 Y 最大值'} type="number" key={`${region.id}-${index}-${regionData.yRange?.[index]}`} defaultValue={(regionData.yRange||region.yRange||[0,1])[index]} onBlur={event=>setAxis('y',index,event.target.value)}/></label>)}</div>}{region.xRange&&['line','area','scatter'].includes(region.kind)&&<div className="paper-ranges"><span>X 轴范围（同时更新刻度）</span>{([0,1] as const).map(index=><label key={index}>{index===0?'最小值':'最大值'}<input aria-label={index===0?'图例 X 最小值':'图例 X 最大值'} type="number" key={`${region.id}-${index}-${regionData.xRange?.[index]}`} defaultValue={(regionData.xRange||region.xRange||[0,1])[index]} onBlur={event=>setAxis('x',index,event.target.value)}/></label>)}</div>}</>}
     </>:mode==='image'&&region.kind==='image'?<><label className="paper-upload"><ImageIcon size={25}/><strong>替换此插图模块</strong><span>PNG / JPEG / WebP · 最大 10 MB</span><input id="paper-figure-image-upload" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={importImage}/></label><p className="paper-help">图片按原区域等比例放置。请使用自己的结构图或机制图；此操作保留其他面板的位置与标注。</p>{changes.images[region.id]&&<div className="paper-source-status"><Check size={14}/>已替换为你的插图</div>}</>:<p className="paper-help">当前图例{mode==='image'?'没有单独的插图模块，请选择数据或文字标注。':'没有数值绘图区，请选择文字标注或插图模块。'}</p>}
     {(changes.panels[region.id]||changes.images[region.id])&&<button className="paper-reset-region" type="button" onClick={resetRegion}>恢复此区域的原图</button>}
    </>}
    {mode==='text'&&<><label className="paper-field">查找标注<input aria-label="搜索图例标注" value={textSearch} placeholder="输入标题、指标或结论关键词" onChange={event=>setTextSearch(event.target.value)}/></label><label className="paper-field">选择文字（也可点击图中标注）<select aria-label="选择图例文字" value={labelId} onChange={event=>{setLabelId(event.target.value);setReference(false);}}><option value="">请选择标注</option>{textItems.map(text=><option key={text.id} value={text.id}>{changes.labels[text.id]??text.text}</option>)}</select></label>{label?<><label className="paper-field">修改文字<textarea aria-label="编辑图例标注" rows={4} maxLength={500} value={changes.labels[label.id]??label.text} onChange={event=>mutate({...changes,labels:{...changes.labels,[label.id]:event.target.value}})}/></label><p className="paper-help">位置：{textBox}。文字识别可能有误，请对照原图核对公式、上下标和统计值。替换内容会沿用原位置；长文本可分行。</p><button type="button" className="paper-reset-region" onClick={()=>{const labels={...changes.labels};delete labels[label.id];mutate({...changes,labels});}}>恢复此标注</button></>:<p className="paper-help">文字来自原图的识别结果。未修改的文字保持原图显示，不会被识别文本替换。</p>}</>}
    {error&&<div className="paper-error" role="alert">{error}</div>}{!!warnings.length&&<div className="paper-warnings" role="status">{warnings.map((warning,i)=><p key={i}>{warning}</p>)}</div>}
   </fieldset></aside>
   <div className="paper-preview-column"><div className="paper-preview">
    <div className="paper-preview-toolbar"><div className="paper-preview-switch"><button type="button" aria-pressed={!reference} onClick={()=>setReference(false)}>我的图例</button><button type="button" aria-pressed={reference} onClick={()=>setReference(true)}>原图对照</button></div><div className="paper-zoom"><button aria-label="缩小图例" type="button" onClick={()=>setZoom(Math.max(100,zoom-50))}><ZoomOut size={15}/></button><span>{zoom}%</span><button aria-label="放大图例" type="button" onClick={()=>setZoom(Math.min(300,zoom+50))}><ZoomIn size={15}/></button></div></div>
    <div className="paper-canvas-scroll"><div className="paper-canvas" style={{width:`${zoom}%`}}><div className="paper-canvas-art" dangerouslySetInnerHTML={{__html:svg}}/>{!reference&&outlines&&<svg className="paper-canvas-targets" viewBox={`0 0 1000 ${canvasHeight}`} aria-label="图例可编辑区域">{mode==='text'?figure.texts.map(text=><rect key={text.id} x={text.x*1000} y={text.y*canvasHeight} width={text.w*1000} height={text.h*canvasHeight} className={labelId===text.id?'is-active':''} onClick={()=>setLabelId(text.id)}><title>{changes.labels[text.id]??text.text}</title></rect>):figure.regions.filter(item=>mode==='image'?item.kind==='image':item.kind!=='image').map(item=><rect key={item.id} x={item.rect[0]*1000} y={item.rect[1]*canvasHeight} width={item.rect[2]*1000} height={item.rect[3]*canvasHeight} className={region.id===item.id?'is-active':''} onClick={()=>chooseRegion(item)}><title>{item.name}</title></rect>)}</svg>}</div></div>
    <div className="paper-preview-status"><span>{reference?'原图示例':counts?`已替换 ${counts} / ${figure.regions.length} 个图形区域`:'原图示例 · 尚未替换数据'} · 已改 {Object.keys(changes.labels).length} 处文字</span><label><input type="checkbox" checked={outlines} onChange={event=>setOutlines(event.target.checked)}/>显示编辑区域</label></div>
    <PublicationExport key={selected} width={1000} height={canvasHeight+40} settings={exportSettings} onChange={setExportSettings} getSvg={exportSvg} filename={`${figure.id}-论文图例`} disabled={busy} onBusy={setBusy} revision={changes} extraIssues={[
     ...(figure.regions.filter(item=>item.kind!=='image'&&!changes.panels[item.id]).length?[{level:'warning' as const,message:`还有 ${figure.regions.filter(item=>item.kind!=='image'&&!changes.panels[item.id]).length} 个数据区保留原作者示例，请核对后用于自己的论文。`}]:[]),
     {level:'warning' as const,message:'原图的 P 值、公式和结论不会随新数据自动重算；请用文字标注逐项核对。'},
     {level:'info' as const,message:'SVG 内嵌原图底板；新数据和修改文字为矢量。打印 PDF 同样保留位图与矢量混合结构。'},
    ]} />
   </div><div className="paper-notes"><h4>这张图保留了什么</h4><p>{figure.description}</p><p>原图底板保留作者的布局、插图和标注；替换的数据区独立绘制。原图的 P 值、公式与结论不会根据新数据自动更新，请用文字编辑逐项核对。</p><div className="paper-project-actions"><button type="button" onClick={()=>download(new Blob([JSON.stringify({version:1,figureId:selected,changes},null,2)],{type:'application/json'}),`${selected}.paper-figure.json`)}>保存可继续编辑的工程</button><label>打开已保存工程<input type="file" accept=".json" disabled={busy} onChange={restoreProject}/></label></div></div><div className="paper-attribution"><a href={`${PAPER_SOURCE}/blob/main/${figure.source}`} target="_blank" rel="noreferrer">原始图例 <ExternalLink size={12}/></a><span>Chen Liu 与合作者 · figures4papers · <a href="/paper-figures/LICENSE.txt" target="_blank" rel="noreferrer">CC BY-NC 4.0</a> · 已添加编辑图层</span></div></div>
  </div>
 </section>;
}
