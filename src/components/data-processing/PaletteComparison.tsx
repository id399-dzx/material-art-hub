"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import type { EChartsOption } from "echarts";
import { CHART_PALETTES, getChartPalette, type ChartPaletteId } from "@/lib/data-processing/chart-palettes";
import { PaletteThumbnail, usePaletteThumbnails, type ChartPalettePreview, type PalettePreviewItem } from "./ChartPalettePicker";
import "./palette-comparison.css";

export default function PaletteComparison({ open, onClose, preview, currentOption, value, onApply, disabled = false }: {
    open: boolean;
    onClose: () => void;
    preview: ChartPalettePreview;
    currentOption?: EChartsOption | null;
    value: ChartPaletteId | null;
    onApply: (id: ChartPaletteId) => void;
    disabled?: boolean;
}) {
    const [choices, setChoices] = useState<ChartPaletteId[]>(() => CHART_PALETTES.filter(palette => palette.id !== value).slice(0, 3).map(palette => palette.id));
    const items = useMemo((): PalettePreviewItem[] => {
        if (!open) return [];
        let baseline = currentOption ?? null;
        if (currentOption === undefined && value) {
            try { baseline = preview.createOption(value); }
            catch { baseline = null; }
        }
        const base = { id: "current", option: baseline };
        return [base, ...choices.map(id => {
            try { return { id, option: preview.createOption(id) }; }
            catch { return { id, option: null }; }
        })];
    }, [open, choices, preview, currentOption, value]);
    const { images, busy } = usePaletteThumbnails(items, preview.width, preview.height, open, preview.revision);
    if (!open) return null;
    return <section className="palette-comparison" aria-label="同数据配色对照">
        <header><div><h3>同数据配色对照</h3><p>图形、数据和数值色阶保持一致，只比较系列配色。</p></div><button type="button" onClick={onClose} disabled={disabled}><ArrowLeft size={14} />返回图表</button></header>
        <div className="palette-comparison__grid" aria-busy={busy}>
            <article className="palette-comparison__card palette-comparison__card--current">
                <div className="palette-comparison__card-heading"><strong>当前配色</strong><small>对照基准</small></div>
                <PaletteThumbnail src={images.current} width={preview.width} height={preview.height} busy={busy} alt="当前数据与当前配色的对照基准" />
                <div className="palette-comparison__baseline">{value ? getChartPalette(value).name : "已保存 / 自定义配色"}</div>
            </article>
            {choices.map((id, index) => <article key={index} className={`palette-comparison__card${value === id ? " is-current" : ""}`}>
                <label className="palette-comparison__select"><span>方案 {index + 1}</span><select aria-label={`对照方案 ${index + 1}`} value={id} disabled={disabled} onChange={event => setChoices(current => current.map((item, position) => position === index ? event.target.value as ChartPaletteId : item))}>
                    {CHART_PALETTES.map(palette => <option key={palette.id} value={palette.id} disabled={choices.some((item, position) => position !== index && item === palette.id)}>{palette.name}</option>)}
                </select></label>
                <PaletteThumbnail src={images[id]} width={preview.width} height={preview.height} busy={busy} alt={`${getChartPalette(id).name}：同一份当前数据的配色对照`} />
                <button className="palette-comparison__apply" type="button" disabled={disabled || !items.find(item => item.id === id)?.option} onClick={() => onApply(id)}>{value === id ? <><Check size={13} />已选配色</> : "应用此配色"}</button>
            </article>)}
        </div>
    </section>;
}
