/* Isolated preview: user code only executes in a disposable Blob Worker. */
(() => {
    'use strict';
    const CHANNEL = 'fesilent-chart-code-v1';
    const token = location.hash.slice(1);
    const MAX_CODE = 2000000;
    const MAX_OPTION = 4000000;
    const TIMEOUT = 2500;
    const chartNode = document.getElementById('chart');
    let chart = null;
    let worker = null;
    let timer = null;
    let workerUrl = null;
    let lastOption = null;
    let latest = 0;
    let dimensions = { width: 760, height: 500 };
    const emit = payload => parent.postMessage({ channel: CHANNEL, token, ...payload }, '*');
    const workerSource = String.raw`
        'use strict';
        const send = self.postMessage.bind(self);
        const NativeFunction = Function;
        const NativeJSON = JSON;
        const finite = Number.isFinite;
        const ownEntries = Object.entries;
        const isArray = Array.isArray;
        const objectFromEntries = Object.fromEntries;
        const NativeSet = Set;
        self.onmessage = event => {
            const { code, id } = event.data;
            try {
                // No browser, credentials, network, nested workers, or imported scripts.
                for (const key of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker', 'importScripts', 'indexedDB', 'caches', 'BroadcastChannel', 'postMessage', 'close']) {
                    try { Object.defineProperty(self, key, { value: undefined, writable: false, configurable: false }); } catch {}
                }
                Object.defineProperty(self, 'option', { value: undefined, writable: true, configurable: true });
                let getOption;
                try { getOption = new NativeFunction('"use strict"; let __chartResult;\n' + code + '\n; if (typeof option !== "undefined") __chartResult = option; return __chartResult;'); }
                catch (error) {
                    if (!/^\s*\{/.test(code)) throw error;
                    getOption = new NativeFunction('"use strict"; return (' + code + '\n);');
                }
                let result;
                try { result = getOption(); } catch (error) { throw error; }
                // A bare object is also accepted, but only after successful syntax checking.
                if (result === undefined && /^\s*\{/.test(code)) result = new NativeFunction('"use strict"; return (' + code + '\n);')();
                if (!result || typeof result !== 'object' || isArray(result)) throw new Error('请定义 const option = { ... }，或输入完整的配置对象。');
                const active = new NativeSet();
                const originalSeries = result.series ? isArray(result.series) ? result.series : [result.series] : [];
                if (originalSeries.length > 128) throw new Error('代码预览最多支持 128 个数据系列，请筛选系列。');
                let renderItems = 0;
                const visit = (value, path, depth = 0) => {
                    if (depth > 64) throw new Error('图表层级超过 64 层，请简化配置。');
                    if (typeof value === 'function') throw new Error(path + ' 是函数回调。请使用字符串 formatter 或提前计算数据。');
                    if (value === undefined) return undefined;
                    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
                    if (typeof value === 'number') { if (!finite(value)) throw new Error(path + ' 包含 NaN 或 Infinity。'); return value; }
                    if (typeof value !== 'object') throw new Error(path + ' 包含不支持的值。');
                    if (active.has(value)) throw new Error('option 包含循环引用。');
                    active.add(value);
                    if (isArray(value) && (/\.(?:data|source|nodes|links|edges|children|elements|graphic)$/.test(path) || /\.dataset(?:\[\d+\])?\.source\.[^.]+$/.test(path))) {
                        renderItems += value.length;
                        if (renderItems > 20000) throw new Error('代码预览最多支持 20,000 个数据项，请筛选数据后重新运行。');
                    }
                    const clean = isArray(value) ? value.map((item, i) => visit(item, path + '[' + i + ']', depth + 1) ?? null) : objectFromEntries(ownEntries(value).map(([key, item]) => [key, visit(item, path + '.' + key, depth + 1)]));
                    active.delete(value);
                    return clean;
                };
                const cleaned = visit(result, 'option');
                const json = NativeJSON.stringify(cleaned);
                if (json.length > 4000000) throw new Error('生成的图表数据过大，请减少数据量。');
                const series = cleaned.series ? isArray(cleaned.series) ? cleaned.series : [cleaned.series] : [];
                if (series.some(item => item && item.type === 'custom')) throw new Error('此工作台支持原生 ECharts 系列；custom 系列需要绘制回调，暂不支持。');
                send({ id, ok: true, json });
            } catch (error) { send({ id, ok: false, error: error && error.message ? String(error.message).slice(0, 1000) : '代码运行失败。' }); }
        };
    `;

    function stopWorker() {
        if (worker) worker.terminate();
        worker = null;
        if (timer) clearTimeout(timer);
        timer = null;
        if (workerUrl) URL.revokeObjectURL(workerUrl);
        workerUrl = null;
    }
    function createChart() {
        if (chart) chart.dispose();
        chart = echarts.init(chartNode, null, { renderer: 'svg', width: dimensions.width, height: dimensions.height });
    }
    function fitChart() {
        // Keep publication dimensions while scaling the preview to its viewport.
        chartNode.style.width = dimensions.width + 'px';
        chartNode.style.height = dimensions.height + 'px';
        const scale = Math.min(innerWidth / dimensions.width, innerHeight / dimensions.height);
        chartNode.style.transformOrigin = 'top left';
        chartNode.style.transform = 'translate(' + Math.max(0, (innerWidth - dimensions.width * scale) / 2) + 'px,' + Math.max(0, (innerHeight - dimensions.height * scale) / 2) + 'px) scale(' + scale + ')';
    }
    function fail(id, message) { emit({ kind: 'error', id, error: message }); }
    function render(id, json) {
        try {
            if (typeof json !== 'string' || json.length > MAX_OPTION) throw new Error('图表数据格式无效。');
            const option = JSON.parse(json);
            option.animation = false;
            // HTML tooltips are unnecessary in scientific SVG previews.
            const tooltips = option.tooltip ? Array.isArray(option.tooltip) ? option.tooltip : [option.tooltip] : [];
            for (const tooltip of tooltips) if (tooltip && typeof tooltip === 'object') tooltip.renderMode = 'richText';
            createChart();
            chart.setOption(option, { notMerge: true, lazyUpdate: false });
            fitChart();
            const svg = chart.renderToSVGString();
            if (!svg || /\b(?:d|transform|cx|cy|r|x|y|width|height)="[^"]*(?:NaN|Infinity)/.test(svg)) throw new Error('图表生成失败，请检查数据和轴范围。');
            lastOption = option;
            emit({ kind: 'rendered', id, svg, json, width: dimensions.width, height: dimensions.height });
        } catch (error) {
            // A failed render cannot replace the previous successful preview.
            if (lastOption) { try { createChart(); chart.setOption(lastOption, { notMerge: true }); fitChart(); } catch {} }
            fail(id, error && error.message ? String(error.message).slice(0, 1000) : '绘图失败。');
        }
    }
    addEventListener('message', event => {
        const message = event.data;
        if (event.source !== parent || !message || message.channel !== CHANNEL || message.token !== token) return;
        if (!['run', 'restore'].includes(message.kind) || !Number.isSafeInteger(message.id) || message.id < latest) return;
        latest = message.id;
        stopWorker();
        if (message.kind === 'run' && (typeof message.code !== 'string' || message.code.length > MAX_CODE)) return fail(message.id, '代码超过 2 MB，请缩小数据量。');
        dimensions = {
            width: Number.isFinite(message.width) ? Math.max(240, Math.min(2400, message.width)) : 760,
            height: Number.isFinite(message.height) ? Math.max(240, Math.min(2400, message.height)) : 500,
        };
        if (message.kind === 'restore') { render(message.id, message.json); return; }
        try {
            workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
            worker = new Worker(workerUrl);
            worker.onmessage = resultEvent => {
                const result = resultEvent.data;
                if (!result || result.id !== latest) return;
                stopWorker();
                if (!result.ok) fail(result.id, String(result.error || '代码运行失败。').slice(0, 1000));
                else render(result.id, result.json);
            };
            worker.onerror = event => { const id = latest; stopWorker(); fail(id, event.message || '代码执行失败。'); };
            timer = setTimeout(() => { const id = latest; stopWorker(); fail(id, '代码运行超过 2.5 秒，已停止。请检查无限循环或减少计算量。'); }, TIMEOUT);
            worker.postMessage({ id: message.id, code: message.code });
        } catch (error) { stopWorker(); fail(message.id, String(error.message || '无法启动代码执行器。')); }
    });
    addEventListener('resize', fitChart);
    addEventListener('pagehide', stopWorker);
    if (!token || !window.echarts) emit({ kind: 'fatal', error: '本地图表引擎加载失败，请刷新页面后重试。' });
    else emit({ kind: 'ready' });
})();
