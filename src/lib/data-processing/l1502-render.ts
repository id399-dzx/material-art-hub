import type { EChartsOption } from 'echarts';
import { L1502_SPATIAL_KINDS, type L1502Data, type L1502Spec, type L1502Style } from './l1502-spec.ts';
import { createL1502TwoDimensionalOption } from './l1502-render-2d.ts';
import { createL1502SpatialOption } from './l1502-render-spatial.ts';

export function createL1502Option(data: L1502Data, spec: L1502Spec, style: L1502Style): EChartsOption {
    const resolved = { ...spec, colorByValue: spec.colorByValue || data.mapping.color !== undefined };
    return L1502_SPATIAL_KINDS.includes(spec.kind)
        ? createL1502SpatialOption(data, resolved, style)
        : createL1502TwoDimensionalOption(data, resolved, style);
}
