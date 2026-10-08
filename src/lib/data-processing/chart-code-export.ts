import type { EChartsOption } from "echarts";

export const MAX_CHART_CODE_LENGTH = 2_000_000;
export const MAX_CHART_OPTION_LENGTH = 4_000_000;
export const MAX_CHART_RENDER_ITEMS = 20_000;
export const MAX_CHART_SERIES = 128;
export const MAX_CHART_OPTION_DEPTH = 64;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type ChartCodeSource = { code: string; warnings: string[] };

/** Callbacks that only format labels can fall back to ECharts' built-in display. */
function displayFormatter(path: string) {
    return /\.(?:tooltip|label|axisLabel|axisName|legend|visualMap)(?:\[\d+\])?\.formatter$/.test(path)
        || /\.tooltip(?:\[\d+\])?\.valueFormatter$/.test(path);
}

function serializableOption(option: EChartsOption): { option: JsonValue; warnings: string[] } {
    const warnings: string[] = [];
    const stack = new Set<object>();
    let renderItems = 0;
    const series = option.series ? Array.isArray(option.series) ? option.series : [option.series] : [];
    if (series.length > MAX_CHART_SERIES) throw new Error("代码预览最多支持 128 个数据系列，请筛选系列后再编辑。");
    if (series.some(item => item.type === "custom")) throw new Error("此图使用自定义绘制函数，请继续使用模板参数或 MATLAB 源码编辑。");
    function visit(value: unknown, path: string, arrayItem = false, depth = 0): JsonValue | undefined {
        if (depth > MAX_CHART_OPTION_DEPTH) throw new Error("图表层级过深，请简化配置。");
        if (typeof value === "function") {
            if (!displayFormatter(path)) throw new Error(`此图的 ${path} 依赖绘制或数据计算函数，暂不支持代码工作台。`);
            warnings.push(`${path} 使用内置文字显示替代原格式化回调，图中的数据不变。`);
            return undefined;
        }
        if (value === undefined) return arrayItem ? null : undefined;
        if (value === null || typeof value === "string" || typeof value === "boolean") return value;
        if (typeof value === "number") {
            if (!Number.isFinite(value)) throw new Error(`图表包含无效数值：${path}。`);
            return value;
        }
        if (value instanceof Date) return value.toISOString();
        if (typeof value !== "object") throw new Error(`图表包含不支持的值：${path}。`);
        if (stack.has(value)) throw new Error("此图包含循环引用，无法生成独立代码。");
        stack.add(value);
        let result: JsonValue;
        if (Array.isArray(value)) {
            if (/\.(?:data|source|nodes|links|edges|children|elements|graphic)$/.test(path) || /\.dataset(?:\[\d+\])?\.source\.[^.]+$/.test(path)) {
                renderItems += value.length;
                if (renderItems > MAX_CHART_RENDER_ITEMS) throw new Error("代码预览最多支持 20,000 个数据项，请筛选数据后再编辑。");
            }
            result = value.map((item, index) => visit(item, `${path}[${index}]`, true, depth + 1) ?? null);
        } else {
            const entries: [string, JsonValue][] = [];
            for (const [key, item] of Object.entries(value)) {
                const next = visit(item, `${path}.${key}`, false, depth + 1);
                if (next !== undefined) entries.push([key, next]);
            }
            result = Object.fromEntries(entries);
        }
        stack.delete(value);
        return result;
    }
    return { option: visit(option, "option")!, warnings };
}

export function canExportChartCode(option: EChartsOption | null | undefined): boolean {
    if (!option) return false;
    try {
        createChartCodeSource(option);
        return true;
    } catch {
        return false;
    }
}

/** Current observations and current chart settings, rather than the template demo. */
export function createChartCodeSource(option: EChartsOption): ChartCodeSource {
    const source = serializableOption(option);
    const comments = [
        "// Fesilent Reverie · 当前图表代码",
        "// 修改 series.data 或 dataset.source 可替换数据；也可编写 JavaScript 计算。",
        "// 代码自动运行，最终配置请命名为 option。函数回调和外部网络请求不受支持。",
        ...source.warnings.map(warning => `// ${warning}`),
    ];
    const code = `${comments.join("\n")}\n\nconst option = ${JSON.stringify(source.option, null, 2)};\n`;
    if (code.length > MAX_CHART_CODE_LENGTH) throw new Error("此图的数据过大，请先筛选数据后再进入代码工作台。");
    return { code, warnings: source.warnings };
}

export function chartCodeFilename(title: string, extension: "js" | "svg") {
    const name = title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 100) || "科研数据图";
    return `${name}.${extension}`;
}
