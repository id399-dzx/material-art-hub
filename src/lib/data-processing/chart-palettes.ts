/** Classification colors follow the clear blue/orange, cyan/pink and green/purple examples in plot-is-all-you-need. */
export type ChartPaletteId = 'journal' | 'ocean' | 'earth' | 'berry' | 'soft' | 'accessible' | 'mono';
export type ChartPalette = {
    id: ChartPaletteId;
    name: string;
    description: string;
    colors: readonly string[];
    sequential: readonly string[];
    diverging: readonly string[];
};

export const DEFAULT_CHART_PALETTE: ChartPaletteId = 'journal';
export const CHART_PALETTES: readonly ChartPalette[] = [
    {
        id: 'journal', name: '期刊蓝橙', description: '清晰蓝橙、红绿与紫金，适合多系列曲线',
        colors: ['#1B6FAE', '#F08A3C', '#3FA55A', '#D1242F', '#7C5CC4', '#E8A917', '#12A5C8', '#EA0A6E'],
        sequential: ['#BCD7EC', '#8CBCE0', '#4A93C7', '#2367A4', '#08306B'],
        diverging: ['#27348B', '#ffffff', '#B5121B'],
    },
    {
        id: 'ocean', name: '蓝青玫红', description: '亮蓝、青色与玫红交替，适合散点和分布图',
        colors: ['#0A6AA8', '#EA0A6E', '#12A5C8', '#F08A3C', '#4B1D91', '#3FA55A', '#C8141E', '#E8A917'],
        sequential: ['#BCD7EC', '#8CBCE0', '#4A93C7', '#2367A4', '#08306B'],
        diverging: ['#1B6FAE', '#ffffff', '#E5303D'],
    },
    {
        id: 'earth', name: '鲜绿暖橙', description: '鲜绿暖橙搭配蓝紫，适合柱图和类别组成',
        colors: ['#3FA55A', '#F08A3C', '#4A93C7', '#9B59B6', '#D9534F', '#E8A917', '#008D93', '#D45087'],
        sequential: ['#B9E2B0', '#8CCC87', '#3FA55A', '#147B39', '#00441B'],
        diverging: ['#147B39', '#ffffff', '#D9534F'],
    },
    {
        id: 'berry', name: '紫橙对比', description: '明晰紫橙与蓝红，适合分组箱线和多面板',
        colors: ['#7C5CC4', '#F08A3C', '#29B6E6', '#D1242F', '#3FA55A', '#EA0A6E', '#E8A917', '#1B2A5C'],
        sequential: ['#D9D0EC', '#B9A8DF', '#9B84CC', '#7451B4', '#4B1D91'],
        diverging: ['#7C5CC4', '#ffffff', '#F08A3C'],
    },
    {
        id: 'soft', name: '清新柱面', description: '清新粉彩搭配清楚边线，作为填充图的备选',
        colors: ['#4F8EF7', '#F2A59D', '#8FBC9A', '#8E8CC0', '#F5C287', '#4DBEC5', '#D983B5', '#C5BB59'],
        sequential: ['#BCD7EC', '#8CBCE0', '#4A93C7', '#2367A4', '#08306B'],
        diverging: ['#4F8EF7', '#ffffff', '#E98B88'],
    },
    {
        id: 'accessible', name: '色觉友好', description: 'Okabe–Ito 配色，结合线型区分不同系列',
        colors: ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#000000'],
        sequential: ['#F1F8FC', '#C5E5F4', '#8BCBED', '#56B4E9', '#0072B2'],
        diverging: ['#0072B2', '#ffffff', '#D55E00'],
    },
    {
        id: 'mono', name: '黑白印刷', description: '灰阶搭配折线线型和点形，适合黑白打印',
        colors: ['#282828', '#696969', '#A0A0A0', '#C9C9C9', '#4B4B4B', '#888888'],
        sequential: ['#ffffff', '#D9D9D9', '#B0B0B0', '#707070', '#313131'],
        diverging: ['#888888', '#ffffff', '#222222'],
    },
];

export type ScalarPaletteId = 'viridis' | 'blue' | 'blue-pink' | 'blue-red' | 'warm' | 'gray';
export type ScalarPalette = { id: ScalarPaletteId; name: string; description: string; colors: readonly string[]; diverging: boolean };
export const SCALAR_PALETTES: readonly ScalarPalette[] = [
    { id: 'viridis', name: '紫蓝青黄', description: '由暗紫到明黄，适合连续场、热图和空间曲面', colors: ['#440154', '#482878', '#3E4989', '#31688E', '#26828E', '#1F9E89', '#35B779', '#6DCD59', '#B4DE2C', '#FDE725'], diverging: false },
    { id: 'blue', name: '清晰蓝阶', description: '由浅蓝到深蓝，适合频数、密度和单向强度', colors: ['#BCD7EC', '#8CBCE0', '#4A93C7', '#2367A4', '#08306B'], diverging: false },
    { id: 'blue-pink', name: '蓝粉对照', description: '蓝与粉红分居浅色两侧，适合双向量值', colors: ['#1B6FAE', '#33B3E3', '#DFEAF2', '#F5B5BB', '#E5303D'], diverging: true },
    { id: 'blue-red', name: '蓝红对照', description: '深蓝与深红分居浅色两侧，适合差值和相关矩阵', colors: ['#27348B', '#8F9BD6', '#F3F0F0', '#E08A85', '#B5121B'], diverging: true },
    { id: 'warm', name: '暖橙强度', description: '由浅橙到深褐，适合单向强度和权重', colors: ['#FBD3AE', '#F8B06E', '#F08A3C', '#CB5E18', '#8A2D04'], diverging: false },
    { id: 'gray', name: '灰阶强度', description: '由浅灰到近黑，适合灰阶导出', colors: ['#E0E0E0', '#BBBBBB', '#919191', '#606060', '#282828'], diverging: false },
];

export function getScalarPalette(id: ScalarPaletteId = 'viridis'): ScalarPalette {
    return SCALAR_PALETTES.find(palette => palette.id === id) ?? SCALAR_PALETTES[0];
}

export function getRecommendedPalette(kind: string): { palette: ChartPaletteId; scalarPalette: ScalarPaletteId } {
    if (kind === 'attention-heatmap' || kind === 'correlation-heatmap' || kind === 'correlation-matrix') return { palette: 'journal', scalarPalette: 'blue-red' };
    if (kind === 'confusion-matrix' || kind === 'calendar-heatmap') return { palette: 'journal', scalarPalette: 'blue' };
    if (['heatmap', 'contour', 'surface', 'tri-surface', 'tri-mesh', 'implicit-surface', 'bubble-matrix'].includes(kind)) return { palette: 'ocean', scalarPalette: 'viridis' };
    if (['histogram', 'histogram2', 'polar-histogram', 'density-heatmap', 'frequency-heatmap'].includes(kind)) return { palette: 'earth', scalarPalette: 'blue' };
    if (['box', 'grouped-box', 'jitter', 'multi-panel', 'inset', 'local-range-radar', 'dual-correlation', 'paired-correlation', 'filled-distribution'].includes(kind)) return { palette: 'berry', scalarPalette: 'blue-pink' };
    if (['violin', 'scatter', 'scatter3', 'scatter-matrix', 'scatter-marginal', 'bubble', 'bubble-cloud', 'polar-scatter', 'polar-bubble', 'embedding-scatter', 'position-scatter', 'sphere-points'].includes(kind)) return { palette: 'ocean', scalarPalette: 'viridis' };
    if (['bar', 'bar3', 'grouped-bar', 'horizontal-bar', 'stacked-bar', 'percent-bar', 'error-bar', 'mean-error', 'horizontal-error', 'hatched-percent', 'stacked-area', 'pie', 'pie3', 'pareto', 'pyramid', 'variable-bar', 'area', 'spatial-vectors'].includes(kind)) return { palette: 'earth', scalarPalette: 'warm' };
    return { palette: DEFAULT_CHART_PALETTE, scalarPalette: 'viridis' };
}

export function getChartValueColors(style: { colors?: readonly string[]; customColors?: readonly string[]; palette?: ChartPaletteId; scalarPalette?: ScalarPaletteId; scalarColors?: readonly string[] }, mode: 'sequential' | 'diverging' = 'sequential'): string[] {
    if (style.scalarPalette) return [...getScalarPalette(style.scalarPalette).colors];
    if (style.scalarColors?.length) return [...style.scalarColors];
    const colors = style.customColors?.length ? style.customColors : style.colors?.length ? style.colors : getChartPalette(style.palette).colors;
    return getValueColors(colors, mode, style.palette);
}

export function getChartPalette(id: ChartPaletteId = DEFAULT_CHART_PALETTE): ChartPalette {
    return CHART_PALETTES.find(palette => palette.id === id) ?? CHART_PALETTES[0];
}

export function findChartPalette(colors: readonly string[]): ChartPalette | undefined {
    return CHART_PALETTES.find(palette => palette.colors.length === colors.length && palette.colors.every((color, index) => color.toLowerCase() === colors[index].toLowerCase()));
}

// Records saved before independent scalar palettes keep their previous scalar colors.
const previousValueThemes = [
    { colors: ['#3B6E9E', '#CF7868', '#4B9188', '#8C79AA', '#B99A56', '#687C94', '#B8849B', '#78A8BA'], sequential: ['#EEF4F7', '#C4DDE4', '#8DBDC9', '#568FA7', '#315D82'], diverging: ['#3B6E9E', '#ffffff', '#CF7868'] },
    { colors: ['#326A92', '#55A8A0', '#7298BF', '#87B9AB', '#4C838F', '#9BAAC9', '#668C74', '#A7C8D6'], sequential: ['#F0F7F7', '#C5E3DD', '#88C4C1', '#4C99AA', '#285879'], diverging: ['#326A92', '#ffffff', '#429984'] },
    { colors: ['#658C73', '#BB8061', '#B3A267', '#667E97', '#977F72', '#A5899B', '#8F9D65', '#7FA5A0'], sequential: ['#F6F5EC', '#DEE6C9', '#B6CEA1', '#82A77B', '#456C58'], diverging: ['#658C73', '#ffffff', '#BB8061'] },
    { colors: ['#8A6F9E', '#BB7D94', '#6E93AB', '#759F99', '#BA9A68', '#9A82B5', '#CF9B8E', '#657E98'], sequential: ['#F7F0F6', '#E6CEDF', '#CAA5C5', '#A279A7', '#6B4E7E'], diverging: ['#6E93AB', '#ffffff', '#B46E91'] },
    { colors: ['#7D98BE', '#D39B99', '#85B4A5', '#AB9BC5', '#C7AF7D', '#91B5C4', '#BD9CB5', '#A6B68B'], sequential: ['#F7F7FC', '#DDDFF0', '#BEC8E1', '#9BABCE', '#7489B0'], diverging: ['#7D98BE', '#ffffff', '#D39B99'] },
];

/** Classification colors and numeric scales have distinct meanings. Saved custom colors stay intact. */
export function getValueColors(colors: readonly string[], mode: 'sequential' | 'diverging', fallbackId: ChartPaletteId = DEFAULT_CHART_PALETTE): string[] {
    const theme = findChartPalette(colors);
    if (theme) return [...theme[mode]];
    const previous = previousValueThemes.find(theme => theme.colors.length === colors.length && theme.colors.every((color, index) => color.toLowerCase() === colors[index].toLowerCase()));
    if (previous) return [...previous[mode]];
    return colors.length ? [...colors] : [...getChartPalette(fallbackId)[mode]];
}

/** Shared interpolation for vector geometry, using the same numeric scale as native chart series. */
export function interpolateChartColor(colors: readonly string[], position: number): string {
    if (colors.length < 2) {
        const color = colors[0] ?? getChartPalette().colors[0];
        return `rgb(${[1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16)).join(',')})`;
    }
    const t = Math.max(0, Math.min(1, position)) * (colors.length - 1);
    const index = Math.min(colors.length - 2, Math.floor(t)), fraction = t - index;
    const rgb = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
    const start = rgb(colors[index]), end = rgb(colors[index + 1]);
    return `rgb(${start.map((value, channel) => Math.round(value + (end[channel] - value) * fraction)).join(',')})`;
}
