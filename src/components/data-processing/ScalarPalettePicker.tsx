"use client";

import { useId, useMemo } from "react";
import { Check } from "lucide-react";
import type { EChartsOption } from "echarts";
import { SCALAR_PALETTES, getScalarPalette, type ScalarPaletteId } from "@/lib/data-processing/chart-palettes";
import { PaletteThumbnail, usePaletteThumbnails, type PalettePreviewItem } from "./ChartPalettePicker";
import "./scalar-palette-picker.css";

export type ScalarPalettePreview = {
    width: number;
    height: number;
    createOption: (id: ScalarPaletteId) => EChartsOption | null;
    revision?: string | number;
};

type ExtraScalarPalette = {
    name: string;
    description: string;
    colors: readonly string[];
    selected: boolean;
    onSelect: () => void;
    option?: EChartsOption | null;
};

export default function ScalarPalettePicker({ value, onChange, disabled = false, preview, extraPalette }: {
    value?: ScalarPaletteId;
    onChange: (id: ScalarPaletteId) => void;
    disabled?: boolean;
    preview?: ScalarPalettePreview;
    extraPalette?: ExtraScalarPalette;
}) {
    const selectId = useId();
    const originalSelected = !!extraPalette?.selected;
    const palette = value && !originalSelected ? getScalarPalette(value) : undefined;
    const activeColors = originalSelected ? extraPalette?.colors : palette?.colors;
    const extraOption = extraPalette?.option;
    const previews = useMemo(() => {
        if (!preview) return [];
        const themes: PalettePreviewItem[] = SCALAR_PALETTES.map(item => {
            try { return { id: item.id, option: preview.createOption(item.id) }; }
            catch { return { id: item.id, option: null }; }
        });
        return extraOption === undefined ? themes : [...themes, { id: "original", option: extraOption }];
    }, [preview, extraOption]);
    const { images, busy } = usePaletteThumbnails(previews, preview?.width ?? 760, preview?.height ?? 500, !!preview, preview?.revision);
    return <div className="scalar-palette-picker">
        <label htmlFor={selectId}>数值色阶<span>{originalSelected ? extraPalette?.name : palette ? palette.diverging ? "发散渐变" : "顺序渐变" : "已保存色阶"}</span></label>
        <select id={selectId} aria-label="数值色阶" value={originalSelected ? "original" : value ?? ""} onChange={event => event.target.value === "original" ? extraPalette?.onSelect() : onChange(event.target.value as ScalarPaletteId)} disabled={disabled}>
            {!value && !originalSelected && <option value="" disabled>保留原有色阶</option>}
            {extraPalette && <option value="original">{extraPalette.name}</option>}
            {SCALAR_PALETTES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {!!activeColors?.length && <><div className="scalar-palette-picker__scale" aria-hidden="true" style={{ background: `linear-gradient(90deg, ${activeColors.join(", ")})` }} />
        <div className="scalar-palette-picker__labels"><span>低值</span>{palette?.diverging && <span>中点</span>}<span>高值</span></div></>}
        <p>{originalSelected ? extraPalette?.description : palette?.description ?? "保留已保存图表的颜色，选择新色阶后才替换。"}</p>
        {preview && <><p className="scalar-palette-picker__preview-note">同一份当前数据，比较数值渐变。</p><div className="scalar-palette-picker__grid" role="group" aria-label="数值色阶预览" aria-busy={busy}>
            {SCALAR_PALETTES.map(item => <button className={`scalar-palette-picker__card${!originalSelected && item.id === value ? " is-selected" : ""}`} key={item.id} type="button" aria-label={`${item.name}色阶`} aria-pressed={!originalSelected && item.id === value} disabled={disabled} onClick={() => onChange(item.id)}>
                <PaletteThumbnail src={images[item.id]} width={preview.width} height={preview.height} busy={busy} alt={`${item.name}：当前数据数值色阶预览`} />
                <span className="scalar-palette-picker__mini-scale" aria-hidden="true" style={{ background: `linear-gradient(90deg, ${item.colors.join(", ")})` }} />
                <span className="scalar-palette-picker__card-title"><strong>{item.name}</strong>{!originalSelected && item.id === value && <Check size={11} strokeWidth={3} aria-hidden="true" />}</span>
            </button>)}
            {extraPalette && <button className={`scalar-palette-picker__card scalar-palette-picker__card--original${originalSelected ? " is-selected" : ""}`} type="button" aria-label={`恢复${extraPalette.name}`} aria-pressed={originalSelected} disabled={disabled} onClick={extraPalette.onSelect}>
                {extraOption !== undefined && <PaletteThumbnail src={images.original} width={preview.width} height={preview.height} busy={busy} alt={`${extraPalette.name}：当前数据的初始数值色阶预览`} />}
                <span className="scalar-palette-picker__mini-scale" aria-hidden="true" style={{ background: `linear-gradient(90deg, ${extraPalette.colors.join(", ")})` }} />
                <span className="scalar-palette-picker__card-title"><strong>{extraPalette.name}</strong>{originalSelected && <Check size={11} strokeWidth={3} aria-hidden="true" />}</span>
                <small>{extraPalette.description}</small>
            </button>}
        </div></>}
    </div>;
}
