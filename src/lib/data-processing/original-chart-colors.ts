/** Preserve the original defaults only for the three categories requested by the user. */
const ORIGINAL_CATEGORIES = new Set(['热图', '三维图', '等高线与场图']);
const ORIGINAL_L1502_COLORS = ['#147a8b', '#e3a438', '#9a5b90', '#4566ac', '#62a889', '#d86864', '#7a70b4', '#7f939d'];
const ORIGINAL_FIELD_COLORS = ['#244d8b', '#64bbc5', '#f5e6a7', '#cc4943'];
const ORIGINAL_JOURNAL_COLORS = ['#38679b', '#c77972', '#64958c', '#9783b6', '#c29b57', '#7c919f'];

export function isOriginalColorCategory(category: string): boolean {
    return ORIGINAL_CATEGORIES.has(category);
}

export function originalL1502Colors(category: string): {
    colors: string[]; scalarColors: string[]; scalarPalette: undefined; scalarConstantColor?: string;
} | null {
    if (!isOriginalColorCategory(category)) return null;
    return {
        colors: [...ORIGINAL_L1502_COLORS],
        scalarColors: [...(category === '三维图' ? ORIGINAL_L1502_COLORS : ORIGINAL_FIELD_COLORS)],
        scalarPalette: undefined,
        ...(category !== '三维图' ? { scalarConstantColor: '#64bbc5' } : {}),
    };
}

export function originalTemplateColors(template: {
    category: string; chartId: string; paper?: { region: { colors?: readonly string[] } }; variant?: string;
}): { customColors: string[]; scalarColors?: string[]; scalarPalette: undefined } | null {
    if (!isOriginalColorCategory(template.category)) return null;
    const customColors = template.paper?.region.colors?.length ? [...template.paper.region.colors] : [...ORIGINAL_JOURNAL_COLORS];
    return {
        customColors,
        scalarPalette: undefined,
        ...(template.chartId === 'surface' ? { scalarColors: ['#ebe9f3', customColors[0]] }
            : template.chartId === 'heatmap' && !template.paper ? { scalarColors: ['#f4eff9', '#acb9d3', '#38679b'] } : {}),
    };
}
