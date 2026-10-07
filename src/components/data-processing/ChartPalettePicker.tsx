"use client";

import { Check } from "lucide-react";
import { CHART_PALETTES, type ChartPaletteId } from "@/lib/data-processing/chart-palettes";
import "./chart-palette-picker.css";

type ExtraPalette = {
    name: string;
    description: string;
    colors: readonly string[];
    selected: boolean;
    onSelect: () => void;
};

function Swatches({ colors }: { colors: readonly string[] }) {
    return <span className="chart-palette-picker__swatches" aria-hidden="true">
        {colors.map((color, index) => <i key={`${index}-${color}`} style={{ backgroundColor: color }} />)}
    </span>;
}

export default function ChartPalettePicker({ value, onChange, currentColors, extraPalette, disabled = false }: {
    value: ChartPaletteId | null;
    onChange: (id: ChartPaletteId) => void;
    currentColors?: readonly string[];
    extraPalette?: ExtraPalette;
    disabled?: boolean;
}) {
    const selected = CHART_PALETTES.find(palette => palette.id === value);
    const selectionName = extraPalette?.selected ? extraPalette.name : selected?.name ?? "已保存配色";
    return <div className="chart-palette-picker" role="group" aria-label="配色方案">
        <div className="chart-palette-picker__heading"><span>配色方案</span><small>{selectionName}</small></div>
        <p className="chart-palette-picker__hint">分类色与数值渐变，随图表自动匹配。</p>
        {!selected && !extraPalette?.selected && currentColors?.length ? <div className="chart-palette-picker__saved">
            <Swatches colors={currentColors} />
            <span>保留当前颜色；选择新方案即可替换。</span>
        </div> : null}
        <div className="chart-palette-picker__grid">
            {CHART_PALETTES.map(palette => <button key={palette.id} className={`chart-palette-picker__card${value === palette.id ? " is-selected" : ""}`} type="button" aria-pressed={value === palette.id} aria-label={`${palette.name}配色`} disabled={disabled} onClick={() => onChange(palette.id)}>
                <span className="chart-palette-picker__card-heading"><strong>{palette.name}</strong><span className="chart-palette-picker__check" aria-hidden="true">{value === palette.id && <Check size={10} strokeWidth={3} />}</span></span>
                <Swatches colors={palette.colors} />
                <span className="chart-palette-picker__gradient" aria-hidden="true" style={{ background: `linear-gradient(90deg, ${palette.sequential.join(", ")})` }} />
                <small>{palette.description}</small>
            </button>)}
            {extraPalette && <button className={`chart-palette-picker__card chart-palette-picker__card--reference${extraPalette.selected ? " is-selected" : ""}`} type="button" aria-pressed={extraPalette.selected} aria-label={`${extraPalette.name}配色`} disabled={disabled} onClick={extraPalette.onSelect}>
                <span className="chart-palette-picker__card-heading"><strong>{extraPalette.name}</strong><span className="chart-palette-picker__check" aria-hidden="true">{extraPalette.selected && <Check size={10} strokeWidth={3} />}</span></span>
                <Swatches colors={extraPalette.colors} />
                <small>{extraPalette.description}</small>
            </button>}
        </div>
    </div>;
}
