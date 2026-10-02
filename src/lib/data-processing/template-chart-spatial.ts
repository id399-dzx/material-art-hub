import type { EChartsOption, GraphicComponentOption } from "echarts";
import type { TemplateData } from "./templates";
import type { TemplateChartStyle } from "./template-chart";
import { textWidth, wrapChartText } from "./chart-layout.ts";

type Point = [number, number, number];
export function rotatePoint([x, y, z]: Point, yaw: number, pitch: number): Point {
    const a = yaw * Math.PI / 180, b = pitch * Math.PI / 180;
    const horizontal = x * Math.cos(a) - y * Math.sin(a), depth = x * Math.sin(a) + y * Math.cos(a);
    return [horizontal, z * Math.cos(b) - depth * Math.sin(b), z * Math.sin(b) + depth * Math.cos(b)];
}

// Only complete adjacent grid cells are connected; missing vertices remain holes.
export function surfaceFaces(points: Point[]): Point[][] {
    const xs = [...new Set(points.map(p => p[0]))].sort((a, b) => a - b), ys = [...new Set(points.map(p => p[1]))].sort((a, b) => a - b);
    const lookup = new Map(points.map(p => [`${p[0]},${p[1]}`, p]));
    const faces: Point[][] = [];
    xs.slice(1).forEach((x, i) => ys.slice(1).forEach((y, j) => {
        const corners = [[xs[i], ys[j]], [x, ys[j]], [x, y], [xs[i], y]].map(([px, py]) => lookup.get(`${px},${py}`));
        if (corners.every(Boolean)) faces.push(corners as Point[]);
    }));
    return faces;
}

export function createSpatialOption(data: TemplateData, template: "sphere" | "surface", style: TemplateChartStyle, palette: string[], shell: EChartsOption): EChartsOption {
    const points: Point[] = data.x.map((x, i) => [Number(x), data.series[0].values[i], data.series[1].values[i]]);
    const yaw = style.yaw ?? 35, pitch = style.pitch ?? 25, width = style.width ?? 680, height = style.height ?? 420;
    const labels = [style.xLabel || "X", style.yLabel || "Y", data.series[1].name].map(label => wrapChartText(label, Math.min(150, width * .23), style.fontSize, style.fontFamily));
    const labelWidth = Math.max(...labels.map(label => textWidth(label, style.fontSize, style.fontFamily)));
    const labelHeight = Math.max(...labels.map(label => label.split("\n").length * style.fontSize * 1.16));
    const title = wrapChartText(style.title, width - 64, style.fontSize + 2, style.fontFamily);
    const top = 12 + title.split("\n").length * (style.fontSize + 2) * 1.16 + 18;
    const bottom = Math.max(45, labelHeight + 20);
    const side = Math.max(45, labelWidth + 14);
    const wires: Point[][] = [];
    if (template === "sphere" && style.sphereGuide !== false) {
        for (const lat of [-60, -30, 0, 30, 60]) {
            const a = lat * Math.PI / 180;
            wires.push(Array.from({ length: 73 }, (_, i) => { const t = i / 72 * 2 * Math.PI; return [Math.cos(a) * Math.cos(t), Math.cos(a) * Math.sin(t), Math.sin(a)]; }));
        }
        for (const longitude of [0, 45, 90, 135]) {
            const a = longitude * Math.PI / 180;
            wires.push(Array.from({ length: 73 }, (_, i) => { const t = i / 72 * 2 * Math.PI; return [Math.cos(t) * Math.cos(a), Math.cos(t) * Math.sin(a), Math.sin(t)]; }));
        }
    }
    const bounds = points.reduce((b, p) => b.map((value, i) => Math.max(value, Math.abs(p[i]))) as Point, [1, 1, 1] as Point);
    const axes: Point[] = [[bounds[0] * 1.2, 0, 0], [0, bounds[1] * 1.2, 0], [0, 0, bounds[2] * 1.2]];
    const projected = [...points, ...wires.flat(), [0, 0, 0] as Point, ...axes].map(p => rotatePoint(p, yaw, pitch));
    const extents = projected.reduce((e, p) => [Math.min(e[0], p[0]), Math.max(e[1], p[0]), Math.min(e[2], p[1]), Math.max(e[3], p[1])], [Infinity, -Infinity, Infinity, -Infinity]);
    const scale = Math.min((width - side * 2) / Math.max(0.1, extents[1] - extents[0]), (height - top - bottom - labelHeight) / Math.max(0.1, extents[3] - extents[2]));
    const project = (p: Point): [number, number] => { const [x, y] = rotatePoint(p, yaw, pitch); return [width / 2 + (x - (extents[0] + extents[1]) / 2) * scale, top + labelHeight + (height - top - bottom - labelHeight) / 2 - (y - (extents[2] + extents[3]) / 2) * scale]; };
    const graphic: GraphicComponentOption[] = [];
    if (template === "sphere" && style.sphereGuide !== false) {
        graphic.push({ type: "circle", shape: { cx: project([0, 0, 0])[0], cy: project([0, 0, 0])[1], r: scale }, style: { fill: { type: "radial", x: 0.35, y: 0.3, r: 0.7, colorStops: [{ offset: 0, color: "#f8f6fc" }, { offset: 1, color: "#e4e1ef" }] }, stroke: "#d7d3e2", opacity: 0.65 } });
        wires.forEach(line => graphic.push({ type: "polyline", shape: { points: line.map(project) }, style: { stroke: "#b9b3cb", lineWidth: 0.7, opacity: 0.6, fill: "none" } }));
    } else if (template === "surface") {
        const zmin = Math.min(...points.map(p => p[2])), zmax = Math.max(...points.map(p => p[2]));
        const base = palette[0].replace("#", "");
        surfaceFaces(points).sort((a, b) => a.reduce((sum, p) => sum + rotatePoint(p, yaw, pitch)[2], 0) - b.reduce((sum, p) => sum + rotatePoint(p, yaw, pitch)[2], 0)).forEach(face => {
            const z = face.reduce((sum, p) => sum + p[2], 0) / 4, t = (z - zmin) / (zmax - zmin || 1);
            const channels = [0, 2, 4].map((i, index) => Math.round([235, 233, 243][index] * (1 - t) + parseInt(base.slice(i, i + 2), 16) * t));
            graphic.push({ type: "polygon", shape: { points: face.map(project) }, style: { fill: `rgb(${channels.join(",")})`, stroke: style.showGrid ? "#75718b" : "#fff", lineWidth: style.showGrid ? 0.6 : 0.25 } });
        });
    }
    axes.forEach((end, i) => {
        const origin = project([0, 0, 0]), to = project(end);
        graphic.push({ type: "line", shape: { x1: origin[0], y1: origin[1], x2: to[0], y2: to[1] }, style: { stroke: "#827d90", lineWidth: 1 } });
        graphic.push({ type: "text", x: to[0] + 4, y: to[1] - style.fontSize / 2, style: { text: labels[i], fill: "#48404f", font: `${style.fontSize}px ${style.fontFamily}`, lineHeight: style.fontSize * 1.16 } });
    });
    if (template === "sphere") points.slice().sort((a, b) => rotatePoint(a, yaw, pitch)[2] - rotatePoint(b, yaw, pitch)[2]).forEach(p => {
        const origin = project([0, 0, 0]), to = project(p), front = rotatePoint(p, yaw, pitch)[2] >= 0;
        graphic.push({ type: "line", shape: { x1: origin[0], y1: origin[1], x2: to[0], y2: to[1] }, style: { stroke: palette[0], lineWidth: 1, opacity: front ? 0.65 : 0.25 } });
        graphic.push({ type: "circle", shape: { cx: to[0], cy: to[1], r: 4.5 }, style: { fill: front ? palette[0] : palette[1], stroke: "#fff", lineWidth: 1, opacity: front ? 1 : 0.6 } });
    });
    graphic.push({ type: "text", left: "center", bottom: 16, style: { text: `正交投影 · 方位 ${yaw}° / 仰角 ${pitch}°${template === "sphere" ? style.sphereGuide === false ? " · 空间向量" : " · 参考球 R = 1" : " · 仅连接完整网格"}`, fill: "#787580", font: `11px ${style.fontFamily}` } });
    return { ...shell, graphic, series: [] };
}
