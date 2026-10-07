"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { CHART_PALETTES, type ChartPaletteId } from "@/lib/data-processing/chart-palettes";
import "./chart-palette-picker.css";

type ExtraPalette = {
    name: string;
    description: string;
    colors: readonly string[];
    selected: boolean;
    onSelect: () => void;
    option?: EChartsOption | null;
};

export type ChartPalettePreview = {
    width: number;
    height: number;
    createOption: (id: ChartPaletteId) => EChartsOption | null;
    /** Include raw-data/style content when custom renderItem closures hide it from the option. */
    revision?: string | number;
};

export type PalettePreviewItem = { id: string; option: EChartsOption | null };

/** Serializing chart content prevents unstable parent callbacks from scheduling the same render again. */
export function usePaletteThumbnails(items: readonly PalettePreviewItem[], width: number, height: number, enabled = true, revision?: string | number) {
    const canvasWidth = Math.max(1, Math.min(2400, Number.isFinite(width) ? width : 760));
    const canvasHeight = Math.max(1, Math.min(1800, Number.isFinite(height) ? height : 500));
    const signature = JSON.stringify([canvasWidth, canvasHeight, revision, items], (_, value) => typeof value === "function" ? value.toString() : value);
    const [rendered, setRendered] = useState<{ signature: string; images: Record<string, string> }>({ signature: "", images: {} });
    useEffect(() => {
        if (!enabled || !items.length) return;
        let cancelled = false, timer: ReturnType<typeof setTimeout>;
        const images: Record<string, string> = {};
        let index = 0;
        const renderNext = () => {
            if (cancelled) return;
            const item = items[index++];
            if (item.option) {
                let chart: echarts.ECharts | undefined;
                try {
                    chart = echarts.init(null, undefined, { renderer: "svg", ssr: true, width: canvasWidth, height: canvasHeight });
                    chart.setOption({ ...item.option, animation: false });
                    images[item.id] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(chart.renderToSVGString())}`;
                } catch {
                    // Failed charts stay visibly unavailable; sample data never replaces user data.
                } finally { chart?.dispose(); }
            }
            if (index < items.length) timer = setTimeout(renderNext, 0);
            else if (!cancelled) setRendered({ signature, images });
        };
        // Debounce parameter typing, then return to the event loop between individual charts.
        timer = setTimeout(renderNext, 90);
        return () => { cancelled = true; clearTimeout(timer); };
        // Chart content is the dependency; function and object identities are deliberately ignored.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature, canvasWidth, canvasHeight, enabled]);
    return { images: rendered.signature === signature ? rendered.images : {}, busy: enabled && items.length > 0 && rendered.signature !== signature };
}

export function PaletteThumbnail({ src, width, height, busy, alt }: { src?: string; width: number; height: number; busy: boolean; alt: string }) {
    return <span className="chart-palette-thumbnail" style={{ aspectRatio: `${width} / ${height}` }}>
        {src ?
            // This image is an in-memory ECharts SVG, not an external asset requiring Next optimization.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} width={width} height={height} alt={alt} /> :
            <span className="chart-palette-thumbnail__placeholder">{busy ? <><Loader2 size={15} className="animate-spin" />生成预览</> : "暂无有效预览"}</span>}
    </span>;
}

function PaletteIllustration({ colors }: { colors: readonly string[] }) {
    return <span className="chart-palette-thumbnail chart-palette-thumbnail--illustration">
        <svg viewBox="0 0 180 100" aria-hidden="true"><path d="M15 12v74h150" fill="none" stroke="#d7d5df" strokeWidth="1" />
            {[0, 1, 2, 3].map(index => <rect key={index} x={28 + index * 32} y={64 - index * 9} width="13" height={22 + index * 9} rx="2" fill={colors[index % colors.length]} opacity=".35" />)}
            <path d="m24 55 28-15 30 7 28-22 30 7 18-16" fill="none" stroke={colors[0]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="m24 71 28-8 30 10 28-19 30-3 18-10" fill="none" stroke={colors[1 % colors.length]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg><small>配色示意</small>
    </span>;
}

function Swatches({ colors }: { colors: readonly string[] }) {
    return <span className="chart-palette-picker__swatches" aria-hidden="true">
        {colors.map((color, index) => <i key={`${index}-${color}`} style={{ backgroundColor: color }} />)}
    </span>;
}

export default function ChartPalettePicker({ value, onChange, currentColors, extraPalette, disabled = false, preview }: {
    value: ChartPaletteId | null;
    onChange: (id: ChartPaletteId) => void;
    currentColors?: readonly string[];
    extraPalette?: ExtraPalette;
    disabled?: boolean;
    preview?: ChartPalettePreview;
}) {
    const extraOption = extraPalette?.option;
    const previews = useMemo(() => {
        if (!preview) return [];
        const themes: PalettePreviewItem[] = CHART_PALETTES.map(palette => {
            try { return { id: palette.id, option: preview.createOption(palette.id) }; }
            catch { return { id: palette.id, option: null }; }
        });
        return extraOption === undefined ? themes : [...themes, { id: "reference", option: extraOption }];
    }, [preview, extraOption]);
    const { images, busy } = usePaletteThumbnails(previews, preview?.width ?? 760, preview?.height ?? 500, !!preview, preview?.revision);
    const selected = CHART_PALETTES.find(palette => palette.id === value);
    const selectionName = extraPalette?.selected ? extraPalette.name : selected?.name ?? "已保存配色";
    return <div className="chart-palette-picker" role="group" aria-label="配色方案">
        <div className="chart-palette-picker__heading"><span>配色方案</span><small>{selectionName}</small></div>
        <p className="chart-palette-picker__hint">{preview ? "同一份当前数据，直接比较配色效果。" : "配色示意 · 选择后应用到图表。"}</p>
        {!selected && !extraPalette?.selected && currentColors?.length ? <div className="chart-palette-picker__saved">
            <Swatches colors={currentColors} />
            <span>保留当前颜色；选择新方案即可替换。</span>
        </div> : null}
        <div className="chart-palette-picker__grid" aria-busy={busy}>
            {CHART_PALETTES.map(palette => <button key={palette.id} className={`chart-palette-picker__card${value === palette.id ? " is-selected" : ""}`} type="button" aria-pressed={value === palette.id} aria-label={`${palette.name}配色`} disabled={disabled} onClick={() => onChange(palette.id)}>
                {preview ? <PaletteThumbnail src={images[palette.id]} width={preview.width} height={preview.height} busy={busy} alt={`${palette.name}：当前数据配色预览`} /> : <PaletteIllustration colors={palette.colors} />}
                <Swatches colors={palette.colors.slice(0, 4)} />
                <span className="chart-palette-picker__card-heading"><strong>{palette.name}</strong><span className="chart-palette-picker__check" aria-hidden="true">{value === palette.id && <Check size={10} strokeWidth={3} />}</span></span>
            </button>)}
            {extraPalette && <button className={`chart-palette-picker__card chart-palette-picker__card--reference${extraPalette.selected ? " is-selected" : ""}`} type="button" aria-pressed={extraPalette.selected} aria-label={`${extraPalette.name}配色`} disabled={disabled} onClick={extraPalette.onSelect}>
                {preview && extraOption !== undefined && <PaletteThumbnail src={images.reference} width={preview.width} height={preview.height} busy={busy} alt={`${extraPalette.name}：当前数据采用参考配色的预览`} />}
                <Swatches colors={extraPalette.colors.slice(0, 4)} />
                <span className="chart-palette-picker__card-heading"><strong>{extraPalette.name}</strong><span className="chart-palette-picker__check" aria-hidden="true">{extraPalette.selected && <Check size={10} strokeWidth={3} />}</span></span>
                <small>{extraPalette.description}</small>
            </button>}
        </div>
    </div>;
}
