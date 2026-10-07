/** Curated from the restrained solid colors and ordered scales in the AddcolorPlus reference. */
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
        id: 'journal', name: '期刊经典', description: '沉静蓝、珊瑚与青绿，适合多组数据对比',
        colors: ['#3B6E9E', '#CF7868', '#4B9188', '#8C79AA', '#B99A56', '#687C94', '#B8849B', '#78A8BA'],
        sequential: ['#EEF4F7', '#C4DDE4', '#8DBDC9', '#568FA7', '#315D82'],
        diverging: ['#3B6E9E', '#ffffff', '#CF7868'],
    },
    {
        id: 'ocean', name: '海盐蓝绿', description: '蓝青与冷绿，适合曲线、热图和空间数据',
        colors: ['#326A92', '#55A8A0', '#7298BF', '#87B9AB', '#4C838F', '#9BAAC9', '#668C74', '#A7C8D6'],
        sequential: ['#F0F7F7', '#C5E3DD', '#88C4C1', '#4C99AA', '#285879'],
        diverging: ['#326A92', '#ffffff', '#429984'],
    },
    {
        id: 'earth', name: '自然大地', description: '森林绿、陶土与麦金，适合生态和材料研究',
        colors: ['#658C73', '#BB8061', '#B3A267', '#667E97', '#977F72', '#A5899B', '#8F9D65', '#7FA5A0'],
        sequential: ['#F6F5EC', '#DEE6C9', '#B6CEA1', '#82A77B', '#456C58'],
        diverging: ['#658C73', '#ffffff', '#BB8061'],
    },
    {
        id: 'berry', name: '莓果暮色', description: '紫莓与灰蓝，适合分组分布和相关性图表',
        colors: ['#8A6F9E', '#BB7D94', '#6E93AB', '#759F99', '#BA9A68', '#9A82B5', '#CF9B8E', '#657E98'],
        sequential: ['#F7F0F6', '#E6CEDF', '#CAA5C5', '#A279A7', '#6B4E7E'],
        diverging: ['#6E93AB', '#ffffff', '#B46E91'],
    },
    {
        id: 'soft', name: '柔和粉彩', description: '低饱和淡彩，适合柱图、面积填充和演示',
        colors: ['#7D98BE', '#D39B99', '#85B4A5', '#AB9BC5', '#C7AF7D', '#91B5C4', '#BD9CB5', '#A6B68B'],
        sequential: ['#F7F7FC', '#DDDFF0', '#BEC8E1', '#9BABCE', '#7489B0'],
        diverging: ['#7D98BE', '#ffffff', '#D39B99'],
    },
    {
        id: 'accessible', name: '色觉友好', description: 'Okabe–Ito 配色，结合线型区分不同系列',
        colors: ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#000000'],
        sequential: ['#F1F8FC', '#C5E5F4', '#8BCBED', '#56B4E9', '#0072B2'],
        diverging: ['#0072B2', '#ffffff', '#D55E00'],
    },
    {
        id: 'mono', name: '黑白印刷', description: '灰阶搭配线型与纹理，适合黑白打印',
        colors: ['#282828', '#696969', '#A0A0A0', '#C9C9C9', '#4B4B4B', '#888888'],
        sequential: ['#ffffff', '#D9D9D9', '#B0B0B0', '#707070', '#313131'],
        diverging: ['#888888', '#ffffff', '#222222'],
    },
];

export function getChartPalette(id: ChartPaletteId = DEFAULT_CHART_PALETTE): ChartPalette {
    return CHART_PALETTES.find(palette => palette.id === id) ?? CHART_PALETTES[0];
}

export function findChartPalette(colors: readonly string[]): ChartPalette | undefined {
    return CHART_PALETTES.find(palette => palette.colors.length === colors.length && palette.colors.every((color, index) => color.toLowerCase() === colors[index].toLowerCase()));
}

/** Classification colors and numeric scales have distinct meanings. Saved custom colors stay intact. */
export function getValueColors(colors: readonly string[], mode: 'sequential' | 'diverging', fallbackId: ChartPaletteId = DEFAULT_CHART_PALETTE): string[] {
    const theme = findChartPalette(colors);
    if (theme) return [...theme[mode]];
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
