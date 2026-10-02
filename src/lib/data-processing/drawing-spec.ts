/** Distinct data layouts may share an ECharts engine without being duplicate templates. */
export type PaperChartVariant =
    | 'mean-error' | 'horizontal-error' | 'hatched-percent' | 'baseline-line'
    | 'stacked-area' | 'violin' | 'sphere-points' | 'spatial-vectors'
    | 'local-range-radar' | 'filled-distribution' | 'embedding-scatter'
    | 'position-scatter' | 'attention-heatmap' | 'frequency-heatmap'
    | 'density-heatmap' | 'grouped-box' | 'dual-correlation' | 'paired-correlation';
