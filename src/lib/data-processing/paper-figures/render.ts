import type { FigureRegion, PaperFigure } from './catalog.ts';
import type { PaperChanges, PaperPanelData } from './data.ts';

export const escapeXml = (value: unknown) => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const f = (value: number) => Number(value.toFixed(4));
const color = (value: string | undefined, fallback = '#3775ba') => /^#[a-f\d]{6}$/i.test(value || '') ? value! : fallback;
const path = (points: number[][], close = false) => points.map(([x,y],i)=>`${i?'L':'M'}${f(x)},${f(y)}`).join(' ') + (close?' Z':'');
const line = (x1:number,y1:number,x2:number,y2:number,stroke='#444',width=1) => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${color(stroke,'#444444')}" stroke-width="${f(width)}"/>`;
const label = (x:number,y:number,text:unknown,size:number,anchor='middle',fill='#333333') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-family="Arial,sans-serif" font-size="${f(size)}" fill="${color(fill,'#333333')}">${escapeXml(text)}</text>`;
const quantile = (sorted: number[], p:number) => { const index=(sorted.length-1)*p,lo=Math.floor(index); return sorted[lo]+(sorted[Math.ceil(index)]-sorted[lo])*(index-lo); };
const extent = (values:number[]):[number,number] => { if(!values.length)return [0,1];const min=Math.min(...values),max=Math.max(...values);return min===max?[min-.5,max+.5]:[min,max]; };
function interpolate(colors:string[],value:number) {
 const v=Math.max(0,Math.min(1,value))*(colors.length-1),i=Math.min(colors.length-2,Math.floor(v)),t=v-i;
 const a=color(colors[i]).slice(1),b=color(colors[i+1]).slice(1);
 return '#'+[0,2,4].map(offset=>Math.round(parseInt(a.slice(offset,offset+2),16)*(1-t)+parseInt(b.slice(offset,offset+2),16)*t).toString(16).padStart(2,'0')).join('');
}

export function renderPaperPanel(region:FigureRegion,data:PaperPanelData,canvasHeight:number) {
 const [rx,ry,rw,rh]=region.rect, x=rx*1000,y=ry*canvasHeight,w=rw*1000,h=rh*canvasHeight;
 const points=data.points,palette=region.colors || ['#3775ba','#eaa080','#93cf93','#a891c0'];
 const groups=region.series || [...new Set(points.map(point=>point.series))];
 const categories=region.categories || [...new Set(points.map(point=>String(point.x)))];
 const xr=data.xRange||region.xRange||extent(points.map(point=>Number(point.x)).filter(Number.isFinite));
 const yr=data.yRange||region.yRange||extent(points.map(point=>point.y));
 const px=(v:number)=>x+(v-xr[0])/(xr[1]-xr[0])*w, py=(v:number)=>y+h-(v-yr[0])/(yr[1]-yr[0])*h;
 const stroke=Math.max(.5,w/200),font=Math.min(10,Math.max(3.5,h/18));
 const id=region.id.replace(/[^a-z0-9-]/gi,'');
 let content='';
 const cap=(cx:number,lower:number,upper:number)=> line(cx,py(lower),cx,py(upper),'#555555',stroke*.7)+line(cx-2,py(lower),cx+2,py(lower),'#555555',stroke*.7)+line(cx-2,py(upper),cx+2,py(upper),'#555555',stroke*.7);
 if(region.kind==='bars') {
  const band=w/categories.length,seriesCount=groups.length;
  points.forEach(point=>{const i=categories.indexOf(String(point.x)),s=groups.indexOf(point.series),bw=band*.76/seriesCount,cx=x+band*(i+.5)+(s-(seriesCount-1)/2)*bw;
   const c=color(palette[(seriesCount===1?i:s)%palette.length]);
   content+=`<rect x="${f(cx-bw*.47)}" y="${f(py(point.y))}" width="${f(bw*.94)}" height="${f(Math.max(0,py(0)-py(point.y)))}" fill="${c}"/>`;
   if(point.error!==undefined)content+=cap(cx,point.y-point.error,point.y+point.error);
  });
 } else if(region.kind==='horizontal') {
  const rows=categories.length,band=h/rows;
  points.forEach(point=>{const i=categories.indexOf(String(point.x)),s=groups.indexOf(point.series),cy=y+(i+.5)*band;
   content+=`<rect x="${f(px(xr[0]))}" y="${f(cy-band*.35)}" width="${f(Math.max(0,px(point.y)-px(xr[0])))}" height="${f(band*.7)}" fill="${color(palette[s%palette.length])}"/>`;
   if(point.error!==undefined)content+=line(px(point.y-point.error),cy,px(point.y+point.error),cy,'#555555',stroke*.7)+line(px(point.y-point.error),cy-2,px(point.y-point.error),cy+2,'#555555',stroke*.7)+line(px(point.y+point.error),cy-2,px(point.y+point.error),cy+2,'#555555',stroke*.7);
  });
 } else if(region.kind==='stacked') {
  const band=w/categories.length;
  categories.forEach((category,i)=>{let total=0;groups.forEach((group,s)=>{const point=points.find(point=>String(point.x)===category&&point.series===group);if(!point)return;
    const top=total+point.y;
    content+=`<rect x="${f(x+band*(i+.12))}" y="${f(py(top))}" width="${f(band*.76)}" height="${f(py(total)-py(top))}" fill="${color(palette[i%palette.length])}" stroke="#777777" stroke-width="${f(stroke*.45)}"/>`;
    if(region.hatching && s!==2)content+=`<rect x="${f(x+band*(i+.12))}" y="${f(py(top))}" width="${f(band*.76)}" height="${f(py(total)-py(top))}" fill="url(#${id}-hatch-${s%3})"/>`;
    total=top;
  });});
 } else if(region.kind==='line'||region.kind==='scatter'||region.kind==='area') {
  const accumulated=new Map<string|number,number>();
  groups.forEach((group,s)=>{const selected=points.filter(point=>point.series===group);const c=color(palette[s%palette.length]);
   const coordinates=selected.map(point=>[px(Number(point.x)),py(point.y+(region.kind==='area'?(accumulated.get(point.x)||0):0))]);
   if(region.kind==='area') {
    const lower=selected.map(point=>[px(Number(point.x)),py(accumulated.get(point.x)||0)]).reverse();
    content+=`<path d="${path([...coordinates,...lower],true)}" fill="${c}" fill-opacity=".85" stroke="${c}" stroke-width="${f(stroke)}"/>`;
    if(region.hatching)content+=`<path d="${path([...coordinates,...lower],true)}" fill="url(#${id}-hatch-${s%3})"/>`;
    selected.forEach(point=>accumulated.set(point.x,(accumulated.get(point.x)||0)+point.y));
   } else if(region.kind==='line') {
    if(region.fillSeries && coordinates.length)content+=`<path d="${path([...coordinates,[coordinates[coordinates.length-1][0],py(0)],[coordinates[0][0],py(0)]],true)}" fill="${c}" fill-opacity=".12"/>`;
    const segments=region.breakAfterX===undefined?[coordinates]:[selected.filter(point=>Number(point.x)<region.breakAfterX!).map(point=>[px(Number(point.x)),py(point.y)]),selected.filter(point=>Number(point.x)>region.breakAfterX!).map(point=>[px(Number(point.x)),py(point.y)])];
    segments.forEach(segment=>{if(segment.length)content+=`<path d="${path(segment)}" fill="none" stroke="${c}" stroke-width="${f(stroke*1.35)}" ${group==='SFT only'?'stroke-dasharray="4 3"':''}/>`;});
    if(region.comparisonOffset!==undefined)selected.filter(point=>Number(point.x)<region.breakAfterX!).forEach(point=>{const other=selected.find(candidate=>Number(candidate.x)===Number(point.x)+region.comparisonOffset!);if(other)content+=`<path d="${path([[px(Number(point.x)),py(point.y)],[px(Number(other.x)),py(other.y)]])}" fill="none" stroke="${c}" stroke-width="${f(stroke*.6)}" stroke-dasharray="2 2"/>`;});
   }
   if(region.kind!=='area'&&!region.fillSeries&&group!=='SFT only')coordinates.forEach(([cx,cy])=>content+=`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(region.kind==='scatter'?Math.max(.7,w/100):Math.max(1.2,w/110))}" fill="${c}" fill-opacity="${region.kind==='scatter'?.8:1}"/>`);
  });

  if(region.markerX!==undefined && groups.length>=3) {
   const near=(name:string)=>points.filter(point=>point.series===name).sort((a,b)=>Math.abs(Number(a.x)-region.markerX!)-Math.abs(Number(b.x)-region.markerX!))[0];
   const first=near(groups[1]),second=near(groups[2]);
   if(first&&second)content+=`<path d="${path([[px(region.markerX),py(first.y)],[px(region.markerX),py(second.y)]])}" stroke="#333333" stroke-width=".7" marker-start="url(#${id}-double-arrow)" marker-end="url(#${id}-double-arrow)"/>`;
  } } else if(region.kind==='heatmap') {
  const xs:(string|number)[]=region.categories||[...new Set(points.map(point=>Number(point.x)))].sort((a,b)=>a-b),ys=[...new Set(points.map(point=>point.y))].sort((a,b)=>a-b);
  const numeric=!region.categories;
  const bounds=(values:number[],index:number):[number,number]=>{const value=values[index];if(values.length===1)return [value-.5,value+.5];return [index===0?value-(values[1]-value)/2:(values[index-1]+value)/2,index===values.length-1?value+(value-values[index-1])/2:(value+values[index+1])/2];};
  const vr=region.valueRange||extent(points.map(point=>point.z!));
  points.forEach(point=>{const col=xs.indexOf(numeric?Number(point.x):String(point.x)),row=ys.indexOf(point.y);let bx=x+col*w/xs.length,by=y+row*h/ys.length,bw=w/xs.length,bh=h/ys.length;
   if(numeric && region.xRange) {const [lo,hi]=bounds(xs.map(Number),col);bx=px(lo);bw=px(hi)-bx;}
   if(region.yRange) {const [lo,hi]=numeric?bounds(ys,row):[point.y-.5,point.y+.5];if(numeric){by=py(hi);bh=py(lo)-by;}else{const span=region.yRange[1]-region.yRange[0]+1;by=y+(lo-(region.yRange[0]-.5))/span*h;bh=(hi-lo)/span*h;}}
   content+=`<rect x="${f(bx)}" y="${f(by)}" width="${f(bw+.1)}" height="${f(bh+.1)}" fill="${interpolate(palette.length>=2?palette:['#ffffff',palette[0]],(point.z!-vr[0])/(vr[1]-vr[0]||1))}"/>`;
  });
 } else if(region.kind==='radar') {
  const cx=x+w/2,cy=y+h/2,r=Math.min(w,h)/2;
  const position=(i:number,t:number)=>[cx+Math.sin(i/categories.length*Math.PI*2)*r*t,cy-Math.cos(i/categories.length*Math.PI*2)*r*t];
  for(let level=1;level<=3;level++) {
   const vertices=categories.map((_,i)=>{const range=region.radarRanges?.[i]||[0,100],ticks=region.radarTicks?.[i]||[0,33.333,66.667,100];return position(i,(ticks[level]-range[0])/(range[1]-range[0]));});
   content+=`<path d="${path(vertices,true)}" fill="none" stroke="#888888" stroke-width=".65"/>`;
  }
  categories.forEach((_,i)=>{const [ex,ey]=position(i,1);content+=line(cx,cy,ex,ey,'#bbbbbb',.55);
   const range=region.radarRanges?.[i]||[0,100],ticks=region.radarTicks?.[i]||[0,33.333,66.667,100];
   ticks.slice(1,-1).forEach(value=>{const [tx,ty]=position(i,(value-range[0])/(range[1]-range[0]));content+=label(tx+2,ty-1,Number(value.toFixed(1)),Math.max(3.5,r/25),'start');});
  });
  groups.forEach((group,s)=>{const vertices=categories.map((category,i)=>{const value=points.find(point=>point.series===group&&String(point.x)===category)!.y,range=region.radarRanges?.[i]||[0,100];return position(i,(value-range[0])/(range[1]-range[0]));});
   content+=`<path d="${path(vertices,true)}" fill="${color(palette[s%palette.length])}" fill-opacity=".05" stroke="${color(palette[s%palette.length])}" stroke-width="${f(stroke)}"/>`;
   vertices.forEach(([cx,cy])=>content+=`<circle cx="${f(cx)}" cy="${f(cy)}" r="1" fill="${color(palette[s%palette.length])}"/>`);
  });

 } else if(region.kind==='sphere'||region.kind==='vectors'||region.kind==='surface') {
  const bound=Math.max(1,...points.flatMap(point=>[Math.abs(Number(point.x)),Math.abs(point.y),Math.abs(point.z!)]));
  const radius=Math.min(w,h)*.36,cx=x+w*.48,cy=y+h*.5;
  const project=(a:number,b:number,c:number)=>[cx+(a*.83-b*.55)/bound*radius,cy-(c*.85+b*.33+a*.2)/bound*radius];
  if(region.kind==='sphere'||region.kind==='vectors') {
   if(region.kind==='sphere') {
    const oval=region.id==='decorrelation';
    content+=`<defs><radialGradient id="${id}-ball" cx="32%" cy="22%" r="85%"><stop offset="0" stop-color="${oval?'#b1cfdb':'#ffffff'}"/><stop offset=".6" stop-color="${oval?'#85aabd':'#ebebeb'}"/><stop offset="1" stop-color="${oval?'#4d6a7d':'#969ca2'}"/></radialGradient></defs><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(radius)}" ry="${f(radius*(oval?.65:1))}" transform="rotate(${oval?-22:0} ${f(cx)} ${f(cy)})" fill="url(#${id}-ball)"/>`;
    content+=`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(radius)}" ry="${f(radius*.34)}" fill="none" stroke="#a3a6ab" stroke-width=".6" stroke-dasharray="2 2"/>`;
   } else {for(const axis of [[1,0,0],[0,1,0],[0,0,1]]) {const [ex,ey]=project(...axis as [number,number,number]);content+=line(cx,cy,ex,ey,'#333333',.8);}}
   points.forEach(point=>{const [ex,ey]=project(Number(point.x),point.y,point.z!);content+=line(cx,cy,ex,ey,'#d26870',1)+`<circle cx="${f(ex)}" cy="${f(ey)}" r="${f(Math.max(1.3,w/90))}" fill="#b64342"/>`;});
   if(region.id==='dispersion'||region.id==='orthogonalization')points.slice(0,-1).forEach((point,i)=>{const a=project(Number(point.x),point.y,point.z!),b=project(Number(points[i+1].x),points[i+1].y,points[i+1].z!);content+=`<path d="M${f(a[0])},${f(a[1])} Q${f(cx)},${f(cy-radius*.5)} ${f(b[0])},${f(b[1])}" fill="none" stroke="#b64342" stroke-width="1" marker-end="url(#${id}-arrow)"/>`;});
  } else {
   const xs=[...new Set(points.map(point=>Number(point.x)))].sort((a,b)=>a-b),ys=[...new Set(points.map(point=>point.y))].sort((a,b)=>a-b);
   const lookup=new Map(points.map(point=>[`${point.x},${point.y}`,point]));
   for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++) {const corners=[[xs[i],ys[j]],[xs[i+1],ys[j]],[xs[i+1],ys[j+1]],[xs[i],ys[j+1]]].map(([a,b])=>lookup.get(`${a},${b}`));if(corners.some(point=>!point))continue;
    const vertices=corners.map(point=>project(Number(point!.x),point!.y,point!.z!));content+=`<path d="${path(vertices,true)}" fill="${interpolate(['#dce9f7','#8ba4c8','#eac3b4'],(corners.reduce((sum,point)=>sum+point!.z!,0)/4/bound+1)/2)}" stroke="#ffffff" stroke-width=".3"/>`;
   }
  }
 } else if(region.kind==='violin'||region.kind==='box') {
  const band=w/categories.length,seriesCount=groups.length;
  categories.forEach((category,c)=>groups.forEach((group,s)=>{const samples=points.filter(point=>String(point.x)===category&&point.series===group).map(point=>point.y).sort((a,b)=>a-b);if(!samples.length)return;
   const cx=x+band*(c+.5)+(s-(seriesCount-1)/2)*band*.35/seriesCount,bw=band*.32/seriesCount,q1=quantile(samples,.25),q2=quantile(samples,.5),q3=quantile(samples,.75),iqr=q3-q1;
   const lower=samples.find(value=>value>=q1-1.5*iqr)!,upper=[...samples].reverse().find(value=>value<=q3+1.5*iqr)!;
   if(region.kind==='box')content+=`<rect x="${f(cx-bw/2)}" y="${f(py(q3))}" width="${f(bw)}" height="${f(py(q1)-py(q3))}" fill="${color(palette[s%palette.length])}" stroke="#777777" stroke-width=".7"/>`;
   else {const mean=samples.reduce((a,b)=>a+b,0)/samples.length,sd=Math.sqrt(samples.reduce((sum,value)=>sum+(value-mean)**2,0)/Math.max(1,samples.length-1));const bandwidth=Math.max((yr[1]-yr[0])*.025,1.06*sd*samples.length**(-.2));
    const density=Array.from({length:61},(_,i)=>{const value=yr[0]+i/60*(yr[1]-yr[0]);return [value,samples.reduce((sum,sample)=>sum+Math.exp(-.5*((value-sample)/bandwidth)**2),0)]});const max=Math.max(...density.map(point=>point[1]));
    const shape=[...density.map(([value,d])=>[cx-d/max*bw,py(value)]),...density.toReversed().map(([value,d])=>[cx+d/max*bw,py(value)])];
    content+=`<path d="${path(shape,true)}" fill="${color(palette[c%palette.length])}" stroke="#777777" stroke-width=".7"/>`;
   }
   content+=line(cx,py(lower),cx,py(upper),'#555555',.7)+line(cx-bw*.3,py(q2),cx+bw*.3,py(q2),'#555555',1);
   if(region.kind==='box')samples.forEach((sample,i)=>{content+=`<circle cx="${f(cx+Math.sin(i*2.4)*bw*.32)}" cy="${f(py(sample))}" r="${f(Math.max(.6,w/250))}" fill="white" stroke="#333333" stroke-width=".5"/>`;});
  }));
 }
 // Replacements contain only the plot interior; original panel titles and external labels stay in place.
 let axes='';
 if(data.yRange && region.yRange && !['radar','sphere','vectors','surface','heatmap','horizontal'].includes(region.kind)) {
  axes+=`<rect x="${f(x-font*2.8)}" y="${f(y-font*.7)}" width="${f(font*2.6)}" height="${f(h+font*1.4)}" fill="white"/>`;
  for(let i=0;i<=4;i++)axes+=label(x-font*.4,y+h-h*i/4+font*.35,Number((yr[0]+(yr[1]-yr[0])*i/4).toPrecision(4)),font,'end');
 }
 if(data.xRange && region.xRange && !['radar','sphere','vectors','surface','heatmap','horizontal'].includes(region.kind)) {
  axes+=`<rect x="${f(x-font*.5)}" y="${f(y+h+font*.2)}" width="${f(w+font)}" height="${f(font*1.35)}" fill="white"/>`;
  for(let i=0;i<=4;i++)axes+=label(x+w*i/4,y+h+font*1.2,Number((xr[0]+(xr[1]-xr[0])*i/4).toPrecision(4)),font);
 }
 const patterns=Array.from({length:3},(_,i)=>`<pattern id="${id}-hatch-${i}" width="4" height="4" patternUnits="userSpaceOnUse"><path d="${i===0?'M-1,1 L1,-1 M0,4 L4,0 M3,5 L5,3':i===1?'M0,0 L4,4':'M0,0 L4,4 M0,4 L4,0'}" stroke="#333333" stroke-width=".4" fill="none"/></pattern>`).join('');
 const clipShape=region.kind==='radar'?`<path d="${path(categories.map((_,i)=>[x+w/2+Math.sin(i/categories.length*Math.PI*2)*Math.min(w,h)/2*1.003,y+h/2-Math.cos(i/categories.length*Math.PI*2)*Math.min(w,h)/2*1.003]),true)}"/>`:`<rect x="${f(x+.4)}" y="${f(y+.4)}" width="${f(w-.8)}" height="${f(h-.8)}"/>`;
 return `<g data-panel="${escapeXml(region.id)}"><defs><clipPath id="${id}-clip">${clipShape}</clipPath>${patterns}<marker id="${id}-double-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L6 3 L0 6" fill="none" stroke="#333333"/></marker><marker id="${id}-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#b64342"/></marker></defs><g clip-path="url(#${id}-clip)"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="white"/>${content}</g>${axes}</g>`;
}

export function renderPaperFigure(figure:PaperFigure,changes:PaperChanges,backgroundHref=`/paper-figures/${figure.id}.png`,footer=true) {
 const height=figure.height/figure.width*1000;
 let layers='';
 for(const region of figure.regions) {
  const data=changes.panels[region.id],image=changes.images[region.id];
  if(data)layers+=renderPaperPanel(region,data,height);
  if(image && /^data:image\/(png|jpeg|webp);base64,/.test(image)) {const [x,y,w,h]=region.rect;layers+=`<rect x="${f(x*1000)}" y="${f(y*height)}" width="${f(w*1000)}" height="${f(h*height)}" fill="white"/><image href="${escapeXml(image)}" x="${f(x*1000)}" y="${f(y*height)}" width="${f(w*1000)}" height="${f(h*height)}" preserveAspectRatio="xMidYMid meet"/>`;}
  if(data && region.retainedRects) region.retainedRects.forEach(([rx,ry,rw,rh],i)=>{const clip=`${region.id}-structure-${i}`;layers+=`<defs><clipPath id="${clip}"><rect x="${f(rx*1000)}" y="${f(ry*height)}" width="${f(rw*1000)}" height="${f(rh*height)}"/></clipPath></defs><image href="${escapeXml(backgroundHref)}" width="1000" height="${f(height)}" clip-path="url(#${clip})"/>`;});
  if(data && region.annotationsInside) {
   const texts=figure.texts.filter(text=>(region.id!=='training'||/VIGIL|leverage/.test(text.text))&&text.x>=region.rect[0] && text.y>=region.rect[1] && text.x+text.w<=region.rect[0]+region.rect[2] && text.y+text.h<=region.rect[1]+region.rect[3]);
   texts.forEach(text=>{const clip=`${region.id}-${text.id}-retained`;layers+=`<defs><clipPath id="${clip}"><rect x="${f(text.x*1000)}" y="${f(text.y*height)}" width="${f(text.w*1000)}" height="${f(text.h*height)}"/></clipPath></defs><image href="${escapeXml(backgroundHref)}" width="1000" height="${f(height)}" clip-path="url(#${clip})"/>`;});
  }
 }
 for(const text of figure.texts) {
  const replacement=changes.labels[text.id];if(replacement===undefined)continue;
  const vertical=text.h*height>text.w*1000*1.8&&text.text.length>=3;const size=Math.max(2.5,(vertical?text.w*1000:text.h*height)*.88),lines=replacement.split('\n');
  layers+=`<g data-label="${text.id}"><rect x="${f(text.x*1000-1)}" y="${f(text.y*height-.6)}" width="${f(text.w*1000+2)}" height="${f(Math.max(text.h*height+.9,vertical?text.h*height:lines.length*size*1.15))}" fill="${color(text.background,'#ffffff')}"/>`;
  if(vertical) {const cx=(text.x+text.w/2)*1000,cy=(text.y+text.h/2)*height;lines.forEach((value,i)=>layers+=`<text transform="translate(${f(cx)} ${f(cy)}) rotate(-90)" x="0" y="${f(size*.35+i*size*1.15)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${f(size)}" ${lines.length===1?`textLength="${f(text.h*height)}" lengthAdjust="spacingAndGlyphs"`:''} fill="${color(text.color,'#222222')}">${escapeXml(value)}</text>`);}
  else lines.forEach((value,i)=>layers+=`<text x="${f(text.x*1000)}" y="${f(text.y*height+size*(i+1))}" font-family="Arial,sans-serif" font-size="${f(size)}" ${lines.length===1?`textLength="${f(text.w*1000)}" lengthAdjust="spacingAndGlyphs"`:''} fill="${color(text.color,'#222222')}">${escapeXml(value)}</text>`);
  layers+='</g>';
 }
 const changed=Object.keys(changes.panels).length+Object.keys(changes.images).length+Object.keys(changes.labels).length;
 const note=changed?'已替换区域使用用户数据 / 文字；未替换区域仍为原图示例。原图统计与结论标注须按实验核对。':'原论文图例示例，包含原作者数据与结论；尚未替换为用户数据。';
 return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="2400" height="${f((height+(footer?40:0))*2.4)}" viewBox="0 0 1000 ${f(height+(footer?40:0))}" role="img"><title>${escapeXml(figure.name)}</title><metadata>Original figure: Chen Liu and collaborators, figures4papers. https://github.com/ChenLiu-1996/figures4papers/${escapeXml(figure.source)} | CC BY-NC 4.0. Image-backed composite template with editable replacement layers. ${escapeXml(note)}</metadata><rect width="1000" height="100%" fill="white"/><image href="${escapeXml(backgroundHref)}" width="1000" height="${f(height)}"/>${layers}${footer?label(12,height+15,note,8,'start','#555555')+label(12,height+30,'Source: Chen Liu et al. · figures4papers · CC BY-NC 4.0 · 背景插图为位图，替换图表与文字为矢量',7,'start','#777777'):''}</svg>`;
}
