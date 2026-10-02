import type { TemplateData } from "./templates.ts";

export type ElectrochemicalChartSpec = {
    kind: "cv" | "gcd" | "charge-discharge" | "rate" | "cycle" | "nyquist" | "bode" | "lsv";
    xLog?: boolean;
    yLog?: boolean;
    equalAxes?: boolean;
    secondaryYLabel?: string;
};

export type ImaginaryMode = "negative-imaginary" | "raw-imaginary";

/** Check the selected axis convention without sorting, smoothing, or normalizing observations. */
export function prepareElectrochemicalData(
    data: TemplateData,
    spec: ElectrochemicalChartSpec,
    imaginaryMode: ImaginaryMode = "negative-imaginary",
): { data?: TemplateData; error?: string } {
    if (spec.xLog && data.x.some(value => typeof value !== "number" || !Number.isFinite(value) || value <= 0)) {
        return { error: "对数频率轴要求 X 列全部为大于 0 的数值。请检查频率列；不会自动删除或改写非正数。" };
    }
    // Bode's second series is phase, which may be negative and remains on a linear axis.
    const logarithmicSeries = spec.kind === "bode" ? data.series.slice(0, 1) : data.series;
    if (spec.yLog && logarithmicSeries.some(series => series.values.some(value => !Number.isFinite(value) || value <= 0))) {
        return { error: "对数阻抗幅值轴要求左轴数值全部大于 0。请检查幅值列；不会取绝对值或自动删除非正数。" };
    }
    if (spec.kind !== "nyquist" || imaginaryMode !== "raw-imaginary") return { data };
    return {
        data: {
            ...data,
            series: data.series.map(series => ({ ...series, name: `−(${series.name})`, values: series.values.map(value => -value) })),
            warnings: [...data.warnings, "已按所选原始虚部 Im(Z) 约定，将 Y 值乘以 −1 绘制 −Im(Z)；保留正负号，未取绝对值。"],
        },
    };
}
