"use client";

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Radar, RotateCcw } from "lucide-react";
import type { RadarSettings } from "@/lib/data-processing/chart-style-settings";
import "./chart-style-editors.css";

export type RadarIndicatorDescription = { name: string; values: number[]; min: number; max: number };
export type RadarSettingsEditorProps = {
    indicators: RadarIndicatorDescription[];
    value?: RadarSettings;
    onChange: (value: RadarSettings | undefined) => void;
    disabled?: boolean;
};

function numberLabel(value: number) {
    return Number.isFinite(value) ? Number(value.toPrecision(7)).toString() : "—";
}

function ownAxis(value: RadarSettings | undefined, name: string) {
    return value?.axes && Object.hasOwn(value.axes, name) ? value.axes[name] : undefined;
}

function IndicatorRange({ indicator, range, onApply, onAutomatic, disabled }: {
    indicator: RadarIndicatorDescription;
    range?: { min: number; max: number };
    onApply: (range: { min: number; max: number }) => void;
    onAutomatic: () => void;
    disabled: boolean;
}) {
    const id = useId();
    const [minDraft, setMinDraft] = useState(String(range?.min ?? indicator.min));
    const [maxDraft, setMaxDraft] = useState(String(range?.max ?? indicator.max));
    const [error, setError] = useState("");
    let dataMin = Infinity, dataMax = -Infinity;
    for (const number of indicator.values) if (Number.isFinite(number)) { dataMin = Math.min(dataMin, number); dataMax = Math.max(dataMax, number); }
    const hasData = Number.isFinite(dataMin);
    const apply = () => {
        const min = Number(minDraft), max = Number(maxDraft);
        if (!minDraft.trim() || !maxDraft.trim() || !Number.isFinite(min) || !Number.isFinite(max)) { setError("请填写有效的最小值和最大值。"); return; }
        if (max <= min) { setError("最大值必须大于最小值。"); return; }
        if (hasData && (min > dataMin || max < dataMax)) { setError(`范围需包含当前数据 ${numberLabel(dataMin)} 至 ${numberLabel(dataMax)}，请扩大范围。`); return; }
        setError("");
        onApply({ min, max });
    };
    return <fieldset className="chart-style-indicator" disabled={disabled}>
        <legend><span title={indicator.name}>{indicator.name}</span><small>{range ? "固定量程" : "自动量程"}</small></legend>
        <p className="chart-style-indicator__data">{hasData ? `数据范围 ${numberLabel(dataMin)} — ${numberLabel(dataMax)}` : "此指标暂无有效数值"}</p>
        <div className="chart-style-fields">
            <label className="chart-style-field" htmlFor={`${id}-min`}>最小值<input type="text" inputMode="decimal" id={`${id}-min`} value={minDraft} aria-label={`${indicator.name}最小值`} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={event => { setMinDraft(event.target.value); setError(""); }} /></label>
            <label className="chart-style-field" htmlFor={`${id}-max`}>最大值<input type="text" inputMode="decimal" id={`${id}-max`} value={maxDraft} aria-label={`${indicator.name}最大值`} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={event => { setMaxDraft(event.target.value); setError(""); }} /></label>
        </div>
        {error && <p className="chart-style-editor__error" id={`${id}-error`} role="alert">{error}</p>}
        <div className="chart-style-indicator__actions"><button type="button" className="chart-style-apply" onClick={apply}>应用固定范围</button><button type="button" className="chart-style-reset" disabled={!range} onClick={onAutomatic}><RotateCcw size={11} aria-hidden="true" />恢复自动</button></div>
    </fieldset>;
}

function PresetIcon({ circle }: { circle: boolean }) {
    return <svg viewBox="0 0 42 42" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.35">{circle ? <><circle cx="21" cy="21" r="16" /><circle cx="21" cy="21" r="8" /></> : <><path d="m21 5 15.2 11-5.8 18H11.6L5.8 16z" /><path d="m21 13 7.6 5.5-2.9 9h-9.4l-2.9-9z" /></>}<path d="M21 21V5m0 16L36.2 16M21 21l9.4 13M21 21l-9.4 13M21 21 5.8 16" /></g><path d="m21 9 11 8-6 13H14l-5-13z" fill="currentColor" fillOpacity=".13" stroke="currentColor" strokeWidth="1.3" /></svg>;
}

export default function RadarSettingsEditor({ indicators, value, onChange, disabled = false }: RadarSettingsEditorProps) {
    const id = useId();
    if (!indicators.length) return null;
    const names = indicators.map(item => item.name);
    const savedOrder = [...new Set(value?.order ?? [])].filter(name => names.includes(name));
    const orderedNames = [...savedOrder, ...names.filter(name => !savedOrder.includes(name))];
    const orderedIndicators = orderedNames.map(name => indicators.find(item => item.name === name)!);
    const shape = value?.shape ?? "polygon", splitNumber = value?.splitNumber ?? 5, startAngle = value?.startAngle ?? 90;
    const update = (patch: Partial<RadarSettings>) => onChange({ ...value, ...patch });
    const setRange = (name: string, range: { min: number; max: number } | undefined) => {
        const axes = range ? { ...value?.axes, [name]: range } : { ...value?.axes };
        if (!range) delete axes[name];
        const next = { ...value };
        if (Object.keys(axes).length) next.axes = axes;
        else delete next.axes;
        onChange(Object.values(next).some(item => item !== undefined) ? next : undefined);
    };
    const moveIndicator = (index: number, direction: -1 | 1) => {
        const order = [...orderedNames];
        [order[index], order[index + direction]] = [order[index + direction], order[index]];
        update({ order });
    };
    return <details className="chart-style-editor chart-style-editor--radar">
        <summary><Radar size={14} aria-hidden="true" /><strong>雷达布局与量程</strong><span>{indicators.length} 个指标</span></summary>
        <div className="chart-style-editor__body">
            <fieldset className="chart-style-fields" disabled={disabled}>
                <div className="chart-style-field--wide chart-style-presets" role="group" aria-label="雷达外观预设">
                    {(["polygon", "circle"] as const).map(preset => <button key={preset} type="button" className={`chart-style-preset${shape === preset && splitNumber === 5 && startAngle === 90 ? " is-selected" : ""}`} aria-pressed={shape === preset && splitNumber === 5 && startAngle === 90} onClick={() => update({ shape: preset, splitNumber: 5, startAngle: 90 })}><PresetIcon circle={preset === "circle"} /><span>{preset === "circle" ? "圆形网格" : "经典多边形"}</span></button>)}
                </div>
                <label className="chart-style-field" htmlFor={`${id}-shape`}>网格形状<select id={`${id}-shape`} value={shape} onChange={event => update({ shape: event.target.value as RadarSettings["shape"] })}><option value="polygon">多边形</option><option value="circle">圆形</option></select></label>
                <label className="chart-style-field" htmlFor={`${id}-split`}>网格层数<select id={`${id}-split`} value={splitNumber} onChange={event => update({ splitNumber: Number(event.target.value) })}>{Array.from({ length: 8 }, (_, index) => index + 3).map(number => <option key={number} value={number}>{number} 层</option>)}</select></label>
                <label className="chart-style-field chart-style-field--wide" htmlFor={`${id}-angle`}>起始角度<span className="chart-style-range"><input id={`${id}-angle`} type="range" min="0" max="360" step="1" value={startAngle} onChange={event => update({ startAngle: Number(event.target.value) })} /><output htmlFor={`${id}-angle`}>{startAngle}°</output></span></label>
            </fieldset>
            <details className="chart-style-subsection">
                <summary><strong>指标量程</strong><span>{Object.keys(value?.axes ?? {}).filter(name => names.includes(name)).length ? "含固定范围" : "全部自动"}</span></summary>
                <p className="chart-style-editor__hint">每个指标可独立设置范围。点击应用后更新图表，范围必须包含当前数据。</p>
                <div className="chart-style-indicators">{orderedIndicators.map(indicator => { const range = ownAxis(value, indicator.name); return <IndicatorRange key={`${indicator.name}:${range?.min ?? "auto"}:${range?.max ?? "auto"}:${indicator.min}:${indicator.max}`} indicator={indicator} range={range} disabled={disabled} onApply={range => setRange(indicator.name, range)} onAutomatic={() => setRange(indicator.name, undefined)} />; })}</div>
            </details>
            <details className="chart-style-subsection">
                <summary><strong>指标排序</strong><span>调整排列顺序</span></summary>
                <p className="chart-style-editor__hint">从起始角度按图表方向排列；调整顺序不会改变数据。</p>
                <ol className="chart-style-order">{orderedNames.map((name, index) => <li key={name}><small>{index + 1}</small><span title={name}>{name}</span><div><button type="button" aria-label={`${name}上移`} disabled={disabled || index === 0} onClick={() => moveIndicator(index, -1)}><ArrowUp size={13} aria-hidden="true" /></button><button type="button" aria-label={`${name}下移`} disabled={disabled || index === orderedNames.length - 1} onClick={() => moveIndicator(index, 1)}><ArrowDown size={13} aria-hidden="true" /></button></div></li>)}</ol>
            </details>
            <button type="button" className="chart-style-reset chart-style-reset--all" disabled={disabled || !value || !Object.keys(value).length} onClick={() => onChange(undefined)}><RotateCcw size={12} aria-hidden="true" />恢复默认布局与自动量程</button>
        </div>
    </details>;
}
