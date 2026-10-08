/** Per-series settings are keyed by the original series name, never its display index. */
export type SeriesAppearance = {
    color?: string;
    lineWidth?: number;
    lineType?: "solid" | "dashed" | "dotted";
    symbol?: "none" | "circle" | "rect" | "triangle" | "diamond" | "roundRect";
    symbolSize?: number;
    fillOpacity?: number;
};

export type SeriesAppearances = Record<string, SeriesAppearance>;

/** Indicator ranges and ordering keep their source names across data replacement. */
export type RadarSettings = {
    shape?: "polygon" | "circle";
    splitNumber?: number;
    startAngle?: number;
    axes?: Record<string, { min: number; max: number }>;
    order?: string[];
};

function record(value: unknown, name: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error(`${name}必须是设置对象。`);
    return value as Record<string, unknown>;
}

function fields(value: Record<string, unknown>, allowed: string[], name: string): void {
    if (Reflect.ownKeys(value).some(key => typeof key !== "string" || !allowed.includes(key))) throw new Error(`${name}包含不支持的设置。`);
}

function indicatorName(value: unknown): asserts value is string {
    if (typeof value !== "string" || !value.trim() || value.length > 256) throw new Error("指标名称不能为空，且最多 256 个字符。");
}

/** Reject malformed persisted settings and return a detached, own-property-only copy. */
export function validateRadarSettings(value: unknown): RadarSettings {
    const source = record(value, "雷达图设置");
    fields(source, ["shape", "splitNumber", "startAngle", "axes", "order"], "雷达图设置");
    const result: RadarSettings = {};
    if (Object.hasOwn(source, "shape")) {
        if (source.shape !== "polygon" && source.shape !== "circle") throw new Error("雷达网格形状无效。");
        result.shape = source.shape;
    }
    if (Object.hasOwn(source, "splitNumber")) {
        if (typeof source.splitNumber !== "number" || !Number.isInteger(source.splitNumber) || source.splitNumber < 3 || source.splitNumber > 10) throw new Error("雷达网格分段数须为 3–10 的整数。");
        result.splitNumber = source.splitNumber;
    }
    if (Object.hasOwn(source, "startAngle")) {
        if (typeof source.startAngle !== "number" || !Number.isFinite(source.startAngle) || source.startAngle < 0 || source.startAngle > 360) throw new Error("雷达起始角度须为 0–360。");
        result.startAngle = source.startAngle;
    }
    if (Object.hasOwn(source, "axes")) {
        const axes = record(source.axes, "指标范围");
        if (Reflect.ownKeys(axes).some(key => typeof key !== "string") || Object.keys(axes).length > 256) throw new Error("指标范围最多支持 256 个指标。");
        result.axes = Object.fromEntries(Object.entries(axes).map(([name, value]) => {
            indicatorName(name);
            const bounds = record(value, "指标范围");
            fields(bounds, ["min", "max"], "指标范围");
            if (typeof bounds.min !== "number" || typeof bounds.max !== "number" || !Number.isFinite(bounds.min) || !Number.isFinite(bounds.max) || bounds.max <= bounds.min) throw new Error(`「${name}」的上下限须为有限数值，且上限大于下限。`);
            return [name, { min: bounds.min, max: bounds.max }];
        }));
    }
    if (Object.hasOwn(source, "order")) {
        if (!Array.isArray(source.order) || source.order.length > 256) throw new Error("指标排序最多支持 256 个指标。");
        for (const name of source.order) indicatorName(name);
        if (new Set(source.order).size !== source.order.length) throw new Error("指标排序不能包含重复名称。");
        result.order = [...source.order];
    }
    return result;
}
