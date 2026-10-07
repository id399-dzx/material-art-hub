import type { DataTable, TableCell } from './templates.ts';

export type L1502Kind =
    | 'line' | 'bar' | 'dual-axis' | 'stacked-bar' | 'area' | 'scatter' | 'bubble' | 'bubble-cloud'
    | 'scatter-matrix' | 'scatter-marginal' | 'stem' | 'error-bar' | 'error-line'
    | 'heatmap' | 'box' | 'pie' | 'step' | 'bubble-matrix' | 'histogram' | 'histogram2'
    | 'pareto' | 'word-cloud' | 'parallel' | 'jitter' | 'pyramid' | 'confidence'
    | 'network' | 'variable-bar' | 'multi-panel' | 'inset'
    | 'polar-line' | 'polar-scatter' | 'polar-bubble' | 'polar-histogram' | 'vector2' | 'compass' | 'contour'
    | 'bar3' | 'scatter3' | 'line3' | 'stem3' | 'surface' | 'waterfall' | 'ribbon'
    | 'tri-mesh' | 'tri-surface' | 'pie3' | 'vector3' | 'implicit-surface';

export type L1502Spec = {
    issue: number; folder: string; kind: L1502Kind;
    horizontal?: boolean; stacked?: boolean; overlaid?: boolean; filled?: boolean; gradient?: boolean;
    colorByValue?: boolean; labels?: boolean; grouped?: boolean; notched?: boolean;
    lighting?: boolean; withContours?: boolean; curtain?: boolean; exploded?: boolean;
    logX?: boolean; logY?: boolean; timeX?: boolean; directed?: boolean;
    dualMode?: 'line' | 'bar' | 'mixed'; panelLayout?: 'grid' | 'mixed' | 'compact' | 'bottom-span';
    panelCharts?: readonly ('line' | 'bar' | 'error-bar' | 'pie' | 'stacked-bar' | 'area')[];
    annotation?: 'line' | 'band' | 'arrow' | 'shape' | 'formula';
    implicit?: boolean;
    jitter?: boolean;
};

export type L1502Mapping = {
    x: number; ys: number[]; z?: number; group?: number; size?: number; color?: number;
    label?: number; u?: number; v?: number; w?: number; weight?: number;
    errors: Record<number, number>; bounds: Record<number, { lower: number; upper: number }>;
};
export type L1502Point = {
    x: number | string; y: number | string; z?: number;
    size?: number; color?: number; label?: string; group?: string;
    u?: number; v?: number; w?: number; error?: number; lower?: number; upper?: number;
};
export type L1502Series = { name: string; points: L1502Point[] };
export type L1502Matrix = {
    xs: (number | string)[]; ys: (number | string)[];
    cells: { xi: number; yi: number; value: number; size?: number }[];
};
export type L1502Data = {
    table: DataTable; mapping: L1502Mapping; series: L1502Series[]; points: L1502Point[];
    matrix?: L1502Matrix;
    samples?: { name: string; category: string; group: string; values: number[] }[];
    edges?: { source: string; target: string; weight: number }[];
    warnings: string[]; skipped: number;
};
export type L1502Result = { data: L1502Data | null; error: string | null };
export type L1502Style = {
    title: string; xLabel: string; yLabel: string; zLabel: string; secondaryYLabel: string;
    fontFamily: string; fontSize: number; width: number; height: number; colors: string[];
    showGrid: boolean; showValues: boolean; yaw: number; pitch: number;
    annotationX: number; annotationText: string; intervalLabel: string; bins: number; isoLevel: number;
};

export const L1502_SPATIAL_KINDS: readonly L1502Kind[] = ['bar3', 'scatter3', 'line3', 'stem3', 'surface', 'waterfall', 'ribbon', 'tri-mesh', 'tri-surface', 'pie3', 'vector3', 'implicit-surface'];
export const L1502_MATRIX_KINDS: readonly L1502Kind[] = ['heatmap', 'bubble-matrix'];
export const L1502_ROLE_LABELS: Record<Exclude<keyof L1502Mapping, 'x' | 'ys' | 'errors' | 'bounds'>, string> = {
    z: 'Z / 网格值', group: '分组', size: '气泡大小', color: '颜色数值', label: '点标签',
    u: '向量 U', v: '向量 V', w: '向量 W', weight: '权重',
};
export const L1502_COLORS = ['#147a8b', '#e3a438', '#9a5b90', '#4566ac', '#62a889', '#d86864', '#7a70b4', '#7f939d'];
export function l1502DefaultLayout(spec: L1502Spec) {
    const multiple = ['multi-panel', 'scatter-matrix', 'scatter-marginal', 'parallel'].includes(spec.kind);
    return multiple ? { width: 900, height: spec.issue === 31 ? 900 : 680, widthMm: 180 } : { width: 760, height: 500, widthMm: 85 };
}
export function l1502DefaultStyle(name: string, width = 760, height = 500): L1502Style {
    return { title: name, xLabel: 'X', yLabel: 'Y', zLabel: 'Z', secondaryYLabel: '右轴指标', fontFamily: 'Arial', fontSize: 14,
        width, height, colors: [...L1502_COLORS], showGrid: false, showValues: false, yaw: 35, pitch: 25,
        annotationX: 0, annotationText: '参考位置', intervalLabel: '输入区间', bins: 12, isoLevel: 0 };
}
export type L1502Demo = TableCell[][];
