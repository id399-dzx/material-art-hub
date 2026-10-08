"use client";

import { useId } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import type { SeriesAppearances } from "@/lib/data-processing/chart-style-settings";
import "./chart-style-editors.css";

export type SeriesAppearanceDescription = {
    name: string;
    kind: "line" | "scatter" | "bar" | "radar";
    line: boolean;
    symbol: boolean;
    fill: boolean;
    defaultColor?: string;
    lineWidth?: number;
    lineType?: "solid" | "dashed" | "dotted";
    symbolType?: string;
    symbolSize?: number;
    fillOpacity?: number;
};

export type SeriesAppearanceEditorProps = {
    series: SeriesAppearanceDescription[];
    value?: SeriesAppearances;
    onChange: (value: SeriesAppearances | undefined) => void;
    disabled?: boolean;
};

const SERIES_KIND_LABEL = { line: "折线", scatter: "散点", bar: "柱形", radar: "雷达" };
const SYMBOL_OPTIONS = [
    ["none", "不显示"], ["circle", "圆点"], ["rect", "方形"],
    ["triangle", "三角形"], ["diamond", "菱形"], ["roundRect", "圆角方形"],
] as const;
const DEFAULT_SYMBOL_NAMES: Record<string, string> = {
    emptyCircle: "空心圆", emptyRect: "空心方形", emptyTriangle: "空心三角形",
    emptyDiamond: "空心菱形", emptyRoundRect: "空心圆角方形",
};
type Appearance = NonNullable<SeriesAppearances[string]>;

function ownAppearance(value: SeriesAppearances | undefined, name: string) {
    return value && Object.hasOwn(value, name) ? value[name] : undefined;
}

function inRange(value: number | undefined, fallback: number, min: number, max: number) {
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value!)) : fallback;
}

function SeriesControls({ item, value, onChange, onReset, disabled }: {
    item: SeriesAppearanceDescription;
    value?: Appearance;
    onChange: (appearance: Appearance) => void;
    onReset: () => void;
    disabled: boolean;
}) {
    const id = useId();
    const color = value?.color ?? item.defaultColor ?? "#9479ad";
    const validColor = /^#[0-9a-f]{6}$/i.test(color) ? color : "#9479ad";
    const lineWidth = inRange(value?.lineWidth ?? item.lineWidth, 2, 0.25, 12);
    const lineType = value?.lineType ?? item.lineType ?? "solid";
    const symbol = value?.symbol ?? item.symbolType ?? "circle";
    const templateSymbol = !SYMBOL_OPTIONS.some(([option]) => option === symbol);
    const templateSymbolName = Object.hasOwn(DEFAULT_SYMBOL_NAMES, symbol) ? `模板默认 · ${DEFAULT_SYMBOL_NAMES[symbol]}` : "模板默认标记";
    const symbolSize = inRange(value?.symbolSize ?? item.symbolSize, 6, 0, 30);
    const opacity = inRange(value?.fillOpacity ?? item.fillOpacity, item.kind === "bar" ? 1 : 0.2, 0, 1);
    const update = (patch: Partial<Appearance>) => onChange({ ...value, ...patch });
    return <details className="chart-style-series">
        <summary>
            <i className="chart-style-series__swatch" style={{ backgroundColor: validColor }} aria-hidden="true" />
            <span className="chart-style-series__name" title={item.name}>{item.name}</span>
            <small>{SERIES_KIND_LABEL[item.kind]}</small>
            {!!value && <span className="chart-style-series__edited" aria-label="已自定义" />}
        </summary>
        <fieldset className="chart-style-fields" disabled={disabled}>
            <div className="chart-style-color-field">
                <label htmlFor={`${id}-color`}>系列颜色</label>
                <div><input id={`${id}-color`} type="color" value={validColor} aria-label={`${item.name}颜色`} onChange={event => update({ color: event.target.value })} /><span>{validColor.toUpperCase()}</span></div>
            </div>
            {item.line && <>
                <label className="chart-style-field" htmlFor={`${id}-width`}>线宽<span className="chart-style-range"><input id={`${id}-width`} type="range" min="0.25" max="12" step="0.25" value={lineWidth} aria-label={`${item.name}线宽`} onChange={event => update({ lineWidth: Number(event.target.value) })} /><output htmlFor={`${id}-width`}>{lineWidth}</output></span></label>
                <label className="chart-style-field" htmlFor={`${id}-line`}>线型<select id={`${id}-line`} value={lineType} aria-label={`${item.name}线型`} onChange={event => update({ lineType: event.target.value as Appearance["lineType"] })}><option value="solid">实线</option><option value="dashed">虚线</option><option value="dotted">点线</option></select></label>
            </>}
            {item.symbol && <>
                <label className="chart-style-field" htmlFor={`${id}-symbol`}>点形<select id={`${id}-symbol`} value={symbol} aria-label={`${item.name}点形`} onChange={event => update({ symbol: event.target.value as Appearance["symbol"] })}>{templateSymbol && <option value={symbol} disabled>{templateSymbolName}</option>}{SYMBOL_OPTIONS.map(([option, label]) => <option value={option} key={option}>{label}</option>)}</select></label>
                <label className="chart-style-field" htmlFor={`${id}-size`}>点大小<span className="chart-style-range"><input id={`${id}-size`} type="range" min="0" max="30" step="1" value={symbolSize} aria-label={`${item.name}点大小`} disabled={symbol === "none"} onChange={event => update({ symbolSize: Number(event.target.value) })} /><output htmlFor={`${id}-size`}>{symbol === "none" ? "—" : symbolSize}</output></span></label>
            </>}
            {item.fill && <label className="chart-style-field chart-style-field--wide" htmlFor={`${id}-fill`}>{item.kind === "bar" ? "不透明度" : item.kind === "radar" ? "雷达填充" : "面积填充"}<span className="chart-style-range"><input id={`${id}-fill`} type="range" min="0" max="1" step="0.01" value={opacity} aria-label={`${item.name}${item.kind === "bar" ? "不透明度" : "填充透明度"}`} onChange={event => update({ fillOpacity: Number(event.target.value) })} /><output htmlFor={`${id}-fill`}>{Math.round(opacity * 100)}%</output></span></label>}
            <button type="button" className="chart-style-reset chart-style-field--wide" disabled={!value} onClick={onReset}><RotateCcw size={12} aria-hidden="true" />恢复此组默认样式</button>
        </fieldset>
    </details>;
}

export default function SeriesAppearanceEditor({ series, value, onChange, disabled = false }: SeriesAppearanceEditorProps) {
    if (!series.length) return null;
    const customized = series.filter(item => !!ownAppearance(value, item.name)).length;
    const changeSeries = (name: string, appearance: Appearance | undefined) => {
        const next = appearance ? { ...value, [name]: appearance } : { ...value };
        if (!appearance) delete next[name];
        onChange(Object.keys(next).length ? next : undefined);
    };
    return <details className="chart-style-editor chart-style-editor--series">
        <summary><SlidersHorizontal size={14} aria-hidden="true" /><strong>系列外观</strong><span>{customized ? `${customized} 组已调整` : `${series.length} 组数据`}</span></summary>
        <div className="chart-style-editor__body">
            <p className="chart-style-editor__hint">展开数据系列，分别调整颜色、线条和点形。更改会同步到预览。选择整体配色会替换单独设置的颜色，保留线条、点形和填充设置。</p>
            <div className="chart-style-series-list">{series.map(item => <SeriesControls key={item.name} item={item} value={ownAppearance(value, item.name)} disabled={disabled} onChange={appearance => changeSeries(item.name, appearance)} onReset={() => changeSeries(item.name, undefined)} />)}</div>
            <button type="button" className="chart-style-reset chart-style-reset--all" disabled={disabled || !value || !Object.keys(value).length} onClick={() => onChange(undefined)}><RotateCcw size={12} aria-hidden="true" />恢复全部系列默认样式</button>
        </div>
    </details>;
}
