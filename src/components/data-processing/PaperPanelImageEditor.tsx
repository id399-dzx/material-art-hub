'use client';

import { useState } from 'react';
import { ImagePlus, ExternalLink, Undo2 } from 'lucide-react';
import type { DrawingTemplate } from '@/lib/data-processing/drawing-catalog';
import { imageCanvasSize, renderStandaloneImage, standaloneTexts, type ImageTemplateChanges } from '@/lib/data-processing/standalone-image';
import { initialExportSettings } from '@/lib/data-processing/publication';
import TemplateEditorDialog from './TemplateEditorDialog';
import PublicationExport from './PublicationExport';

const readImage = (blob: Blob) => new Promise<string>((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result)); reader.onerror=()=>reject(new Error('图片读取失败。')); reader.readAsDataURL(blob); });
function downloadProject(content: unknown, name: string) { const url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'})); const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
export default function PaperPanelImageEditor({template,active,onClose}:{template:DrawingTemplate|null;active:boolean;onClose:()=>void}) {
    const [states,setStates]=useState<Record<string,ImageTemplateChanges>>({});
    const [busy,setBusy]=useState(false),[error,setError]=useState(''),[labelId,setLabelId]=useState('');
    const [settings,setSettings]=useState(initialExportSettings);
    if (!template) return null;
    const item=template, changes=states[item.id]??{title:item.paper!.region.name.replace(/^[a-z] · /,''),caption:'',labels:{}};
    const texts=standaloneTexts(item), label=texts.find(t=>t.id===labelId);
    const background=`/paper-panels/${item.id}.png`;
    const {width,imageHeight}=imageCanvasSize(item);
    const update=(next:Partial<ImageTemplateChanges>)=>{setStates(current=>({...current,[item.id]:{...changes,...next}}));setError('');};
    async function upload(event:React.ChangeEvent<HTMLInputElement>) {
        const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy(true);setError('');
        try { if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('请选择 10 MB 以内的 PNG / JPEG / WebP 图片。');
            const image=await readImage(file);const decoded=new window.Image();await new Promise<void>((resolve,reject)=>{decoded.onload=()=>resolve();decoded.onerror=()=>reject(new Error('无法解码此图片。'));decoded.src=image;});
            update({image,filename:file.name,labels:{}});
        }catch(e){setError(e instanceof Error?e.message:'图片读取失败。');}finally{setBusy(false);}
    }
    async function exportSvg() { let embedded=background;if(!changes.image){const response=await fetch(background);if(!response.ok)throw new Error('插图读取失败，请刷新后重试。');embedded=await readImage(await response.blob());}return renderStandaloneImage(item,changes,embedded); }
    async function restore(event:React.ChangeEvent<HTMLInputElement>) {
        const file=event.target.files?.[0];event.target.value='';if(!file)return;setError('');setBusy(true);
        try{if(file.size>30*1024*1024)throw new Error('工程文件不能超过 30 MB。');const project=JSON.parse(await file.text()),c=project.changes;
            if(project.version!==2||project.templateId!==item.id||!c||typeof c.title!=='string'||c.title.length>80||typeof c.caption!=='string'||c.caption.length>300||!c.labels||typeof c.labels!=='object')throw new Error('请打开当前单图对应的工程文件。');
            if(c.image!==undefined&&(typeof c.image!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(c.image)))throw new Error('工程图片无效。');
            for(const [id,value] of Object.entries(c.labels))if(!texts.some(t=>t.id===id)||typeof value!=='string'||value.length>200)throw new Error('工程标注无效。');
            setStates(current=>({...current,[item.id]:{title:c.title,caption:c.caption,labels:c.labels,...(c.image?{image:c.image,filename:'已恢复的图片'}:{})}}));
        }catch(e){setError(e instanceof Error?e.message:'工程读取失败。');}finally{setBusy(false);}
    }
    return <TemplateEditorDialog open={active} title={item.name} eyebrow="STANDALONE ILLUSTRATION / 独立插图编辑" description="编辑这一个插图即可；不需要其他面板。上传自己的图片，修改标题与图注后单独导出。" busy={busy} onClose={onClose}>
        <div className="template-editor single-image-editor">
            <section className="template-input-panel template-glass"><fieldset disabled={busy}>
                <div className="template-binding-heading"><ImagePlus size={18}/><h3>替换这一张插图</h3></div>
                <p className="template-input-guide">此类为机制或结构插图，支持图片替换与文字编辑。数值绘图请选择对应的柱状、折线、散点等模板。</p>
                <label className="template-upload"><ImagePlus size={26}/><strong>上传自己的插图</strong><span>PNG / JPEG / WebP · 最大 10 MB</span><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={upload}/></label>
                {changes.filename&&<p className="template-notice">已替换：{changes.filename}</p>}
                <label className="template-field">插图标题<input value={changes.title} maxLength={80} onChange={e=>update({title:e.target.value})}/></label>
                <label className="template-field">图注<input value={changes.caption} maxLength={300} onChange={e=>update({caption:e.target.value})}/></label>
                {!changes.image&&texts.length>0&&<><label className="template-field">原图文字<select aria-label="选择单图文字" value={label?labelId:''} onChange={e=>setLabelId(e.target.value)}><option value="">选择要修改的标注</option>{texts.map(t=><option key={t.id} value={t.id}>{changes.labels[t.id]??t.text}</option>)}</select></label>{label&&<label className="template-field">修改标注<input value={changes.labels[label.id]??label.text} maxLength={200} onChange={e=>update({labels:{...changes.labels,[label.id]:e.target.value}})}/></label>}</>}
                <div className="template-example-actions"><button type="button" onClick={()=>update({image:undefined,filename:undefined,labels:{},title:item.paper!.region.name.replace(/^[a-z] · /,''),caption:''})}><Undo2 size={14}/>恢复原图示例</button></div>
                {error&&<p className="template-notice template-notice--error" role="alert">{error}</p>}
                <div className="single-image-project"><button type="button" onClick={()=>downloadProject({version:2,templateId:item.id,changes},`${item.id}.single-image.json`)}>保存编辑工程</button><label>打开编辑工程<input type="file" accept=".json" onChange={restore}/></label></div>
            </fieldset></section>
            <section className="template-preview-panel template-glass"><div className="template-preview-heading"><h3>单图预览</h3><span className="template-data-badge">{changes.image?'你的插图':'原图插图示例'}</span></div>
                <div className="single-image-canvas" dangerouslySetInnerHTML={{__html:renderStandaloneImage(item,changes,background)}}/>
                <PublicationExport width={width} height={imageHeight+90} settings={settings} onChange={setSettings} getSvg={exportSvg} filename={changes.title||item.name} disabled={busy} onBusy={setBusy} revision={changes} extraIssues={!changes.image?[{level:'warning',message:'当前保留原论文插图，请核对图中标注和内容后使用。'}]:[]}/>
                <p className="template-bottom-note">来源：{item.paper!.project} · Chen Liu 与合作者 · <a href={`https://github.com/ChenLiu-1996/figures4papers/blob/main/${item.paper!.source}`} target="_blank" rel="noreferrer">原始图例 <ExternalLink size={12}/></a> · <a href="/paper-figures/LICENSE.txt" target="_blank" rel="noreferrer">CC BY-NC 4.0</a>。原插图为位图，修改文字为矢量。</p>
            </section>
        </div>
    </TemplateEditorDialog>;
}
