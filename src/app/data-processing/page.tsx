"use client";

import { useState, useEffect, useRef, useSyncExternalStore, useMemo } from "react";
import Image from "next/image";
import * as xlsx from "xlsx";
import ReactECharts from 'echarts-for-react';
import { UploadCloud, FileSpreadsheet, Settings2, RefreshCw, Zap, FileText, Trash2, Sparkles, Activity, Battery, Cpu, RotateCw, ZapIcon, Download, ArrowUpRight } from "lucide-react";
import { parseXYMatrix, type XYOrientationChoice } from "@/lib/data-processing/parse";
import SafeReport from "@/components/data-processing/SafeReport";
import DataAdvisor from "@/components/data-processing/DataAdvisor";
import PublicationExport from "@/components/data-processing/PublicationExport";
import { initialExportSettings } from "@/lib/data-processing/publication";
import { readWorkbook } from "@/lib/data-processing/read-workbook";
import { parseTemplateTable } from "@/lib/data-processing/templates";
import TemplateStudio, { type TemplateStudioHandle } from "@/components/data-processing/TemplateStudio";
import { GlassButton } from "@/components/ui/GlassButton";
import "./workbench.css";

type DataChunk = { id: string; name: string; x: number[]; y: number[] };
type ChartTemplateParams = {
    fontFamily?: string; lineWidth?: number; lineColor?: string; titleSize?: number;
    labelSize?: number; seriesName?: string; legendPosition?: string;
    xAxisName?: string; yAxisName?: string; xMin?: string; xMax?: string;
    xInterval?: string; xOnZero?: boolean; yMin?: string; yMax?: string;
    yInterval?: string; chartWidth?: number; chartHeight?: number;
};
type ChartTemplate = { id: string; name: string; params: ChartTemplateParams };
type CachedData = {
    schemaVersion?: number;
    chunks?: DataChunk[];
    controlChunks?: DataChunk[];
    insetX?: number[];
    insetY?: number[];
    stitchedInfo?: { count: number; totalPoints: number };
    x?: number[];
    y?: number[];
};

const emptyInsights = () => ({
    maxCapacity: '-', voltageRange: '-', estimatedCycles: '-', voltageHysteresis: '-',
    status: 'idle' as const, report: '', primary: '', secondary: ''
});

// --- IndexedDB Helper for Large Data Persistence ---
const DB_NAME = 'MaterialArtHubDB';
const STORE_NAME = 'dataStore';

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const saveDataToDB = async (data: CachedData) => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(data, 'processedData');
        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error("Failed to save data to IndexedDB", err);
    }
};

const loadDataFromDB = async (): Promise<CachedData | null> => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get('processedData');
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error("Failed to load data from IndexedDB", err);
        return null;
    }
};

const clearDataFromDB = async () => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete('processedData');
        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error("Failed to clear data from IndexedDB", err);
    }
};
// ----------------------------------------------------

const subscribeWorkspace = (callback: () => void) => {
    window.addEventListener("hashchange", callback);
    return () => window.removeEventListener("hashchange", callback);
};
const getWorkspace = () => ["#paper-figures", "#data-templates"].includes(window.location.hash) ? "templates" : "processing";
const getServerWorkspace = () => "processing";

export default function DataProcessingPage() {
    const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getServerWorkspace);
    const templateStudioRef = useRef<TemplateStudioHandle>(null);
    const [exportSettings, setExportSettings] = useState(initialExportSettings);
    const [figureExporting, setFigureExporting] = useState(false);
    const [dataType, setDataType] = useState<string>('GCD');
    const [dataOrientation, setDataOrientation] = useState<XYOrientationChoice>('auto');
    const [importWarnings, setImportWarnings] = useState<string[]>([]);
    const [cacheLoaded, setCacheLoaded] = useState(false);
    const [templateApplyCount, setTemplateApplyCount] = useState(0);
    const analysisVersionRef = useRef(0);
    const analysisRequestRef = useRef(0);
    const mainFileInputRef = useRef<HTMLInputElement>(null);
    const chartRef = useRef<ReactECharts>(null);
    useEffect(() => {
        if (workspace !== "processing") return;
        const frame = requestAnimationFrame(() => chartRef.current?.getEchartsInstance()?.resize());
        return () => cancelAnimationFrame(frame);
    }, [workspace]);
    const [fileName, setFileName] = useState<string | null>(null);
    const [fileChunks1, setFileChunks1] = useState<DataChunk[]>([]);
    const [fileChunks2, setFileChunks2] = useState<DataChunk[]>([]);
    const [fileName2, setFileName2] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lineWidth, setLineWidth] = useState<number>(2);
    const [fontFamily, setFontFamily] = useState<string>("Times New Roman");
    const [titleSize, setTitleSize] = useState<number>(18);
    const [labelSize, setLabelSize] = useState<number>(16);
    const [chartWidth, setChartWidth] = useState<number>(600);
    const [chartHeight, setChartHeight] = useState<number>(400);

    // Advanced Chart Control States
    const [xAxisName, setXAxisName] = useState<string>("Capacity");
    const [yAxisName, setYAxisName] = useState<string>("Voltage (V)");
    const [xMin, setXMin] = useState<string>("");
    const [xMax, setXMax] = useState<string>("");
    const [xInterval, setXInterval] = useState<string>("");
    const [xOnZero, setXOnZero] = useState<boolean>(false);
    const [yMin, setYMin] = useState<string>("");
    const [yMax, setYMax] = useState<string>("");
    const [yInterval, setYInterval] = useState<string>("");
    const [lineColor, setLineColor] = useState<string>("#00BFFF");
    const [seriesName, setSeriesName] = useState<string>("Data 1");
    const [lineColor2, setLineColor2] = useState<string>("#ff4500");
    const [seriesName2, setSeriesName2] = useState<string>("Control Sample");
    const [legendPosition, setLegendPosition] = useState<string>("top-right");

    // Inset Chart Control States
    const [showInset, setShowInset] = useState<boolean>(false);
    const [insetXMin, setInsetXMin] = useState<string>("");
    const [insetXMax, setInsetXMax] = useState<string>("");
    const [insetYMin, setInsetYMin] = useState<string>("");
    const [insetYMax, setInsetYMax] = useState<string>("");
    const [insetLeft, setInsetLeft] = useState<string>('60%');
    const [insetTop, setInsetTop] = useState<string>('15%');
    const [insetWidth, setInsetWidth] = useState<string>('35%');
    const [insetHeight, setInsetHeight] = useState<string>('35%');

    const [useMainDataForInset, setUseMainDataForInset] = useState<boolean>(true);
    const [insetTotalX, setInsetTotalX] = useState<number[]>([]);
    const [insetTotalY, setInsetTotalY] = useState<number[]>([]);
    const [insetFontSize, setInsetFontSize] = useState<string>('10');
    const [showInsetAxisName, setShowInsetAxisName] = useState<boolean>(false);
    const [insetXAxisName, setInsetXAxisName] = useState<string>('X-axis');
    const [insetYAxisName, setInsetYAxisName] = useState<string>('Y-axis');
    const [insetXSplit, setInsetXSplit] = useState<string>('');
    const [insetYSplit, setInsetYSplit] = useState<string>('');

    // Custom Templates System
    const [customTemplates, setCustomTemplates] = useState<ChartTemplate[]>([]);
    const [newTemplateName, setNewTemplateName] = useState<string>("");

    // Isolation State for Performance (Only update chart on explicit apply)
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [appliedOptions, setAppliedOptions] = useState<ReturnType<typeof generateOption> | null>(null);

    // AI Data Insights State
    const [dataInsights, setDataInsights] = useState<{ maxCapacity: string, voltageRange: string, estimatedCycles: string, voltageHysteresis: string, status: 'idle' | 'analyzing' | 'done', report: string, primary: string, secondary: string }>(emptyInsights);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    // Deep Analysis State
    const [followUpText, setFollowUpText] = useState("");
    const [deepAnalysisReport, setDeepAnalysisReport] = useState("");
    const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);

    const PRESETS = {
        nature: {
            fontFamily: "Times New Roman", lineWidth: 2.5, lineColor: "#1a1a1a",
            titleSize: 16, labelSize: 14, xMin: "", xMax: "", xInterval: "",
            yMin: "", yMax: "", yInterval: "", legendPosition: "top-right"
        },
        bright: {
            fontFamily: "Arial", lineWidth: 2, lineColor: "#00BFFF",
            titleSize: 14, labelSize: 12, xMin: "", xMax: "", xInterval: "",
            yMin: "", yMax: "", yInterval: "", legendPosition: "top-right"
        },
        electro: {
            fontFamily: "Times New Roman", lineWidth: 2, lineColor: "#D9001B",
            titleSize: 16, labelSize: 14, xMin: "", xMax: "", xInterval: "",
            yMin: "", yMax: "", yInterval: "", legendPosition: "top-right"
        }
    };

    // Load from IndexedDB and LocalStorage on mount
    useEffect(() => {
        const initData = async () => {
            const cachedData = await loadDataFromDB();
            if (cachedData) {
                if (cachedData.schemaVersion !== 2) {
                    setImportWarnings(['已恢复旧版浏览器缓存；旧版导入方式可能造成 X/Y 错位，建议重新导入原始文件。']);
                }
                if (cachedData.chunks) {
                    setFileChunks1(cachedData.chunks);
                    if (cachedData.chunks.length > 0) {
                        setFileName(cachedData.chunks.length === 1 ? cachedData.chunks[0].name : `已恢复 ${cachedData.chunks.length} 个文件`);
                    }
                } else if (cachedData.x && cachedData.y) {
                    setFileChunks1([{ id: 'cached', name: '缓存数据', x: cachedData.x, y: cachedData.y }]);
                    setFileName('缓存数据');
                }
                if (cachedData.controlChunks) {
                    setFileChunks2(cachedData.controlChunks);
                    if (cachedData.controlChunks.length > 0) setFileName2(cachedData.controlChunks.length === 1 ? cachedData.controlChunks[0].name : `已恢复 ${cachedData.controlChunks.length} 个文件`);
                }
                if (cachedData.insetX) setInsetTotalX(cachedData.insetX);
                if (cachedData.insetY) setInsetTotalY(cachedData.insetY);
            }

            const saved = localStorage.getItem('myChartPresets');
            const savedTemplates = localStorage.getItem('myCustomTemplates');
            if (savedTemplates) {
                try {
                    setCustomTemplates(JSON.parse(savedTemplates));
                } catch (e) {
                    console.error("Failed to parse custom templates", e);
                }
            }

            if (saved) {
                try {
                    const p = JSON.parse(saved);
                    if (p.fontFamily) setFontFamily(p.fontFamily);
                    if (p.lineWidth) setLineWidth(p.lineWidth);
                    if (p.titleSize) setTitleSize(p.titleSize);
                    if (p.labelSize) setLabelSize(p.labelSize);
                    if (p.lineColor) setLineColor(p.lineColor);
                    if (p.seriesName) setSeriesName(p.seriesName);
                    if (p.legendPosition) setLegendPosition(p.legendPosition);
                    if (p.xAxisName !== undefined) setXAxisName(p.xAxisName);
                    if (p.yAxisName !== undefined) setYAxisName(p.yAxisName);
                    if (p.xMin !== undefined) setXMin(p.xMin);
                    if (p.xMax !== undefined) setXMax(p.xMax);
                    if (p.xInterval !== undefined) setXInterval(p.xInterval);
                    if (p.xOnZero !== undefined) setXOnZero(p.xOnZero);
                    if (p.yMin !== undefined) setYMin(p.yMin);
                    if (p.yMax !== undefined) setYMax(p.yMax);
                    if (p.yInterval !== undefined) setYInterval(p.yInterval);
                    if (p.chartWidth !== undefined) setChartWidth(p.chartWidth);
                    if (p.chartHeight !== undefined) setChartHeight(p.chartHeight);
                } catch (e) {
                    console.error("Failed to parse local storage presets", e);
                }
            }
            setCacheLoaded(true);
        };
        initData();
    }, []);

    useEffect(() => {
        if (!cacheLoaded) return;
        const count = fileChunks1.length;
        const totalPoints = fileChunks1.reduce((sum, chunk) => sum + chunk.x.length, 0);
        void saveDataToDB({
            schemaVersion: 2,
            chunks: fileChunks1,
            controlChunks: fileChunks2,
            insetX: insetTotalX,
            insetY: insetTotalY,
            stitchedInfo: { count, totalPoints }
        });
    }, [cacheLoaded, fileChunks1, fileChunks2, insetTotalX, insetTotalY]);

    const handleDataTypeChange = (value: string) => {
        setDataType(value);
        const names: Record<string, [string, string]> = {
            GCD: ['Capacity', 'Voltage (V)'],
            XRD: ['2 Theta (degree)', 'Intensity (a.u.)'],
            XPS: ['Binding Energy (eV)', 'Intensity (a.u.)'],
            Raman: ['Wavenumber (cm⁻¹)', 'Intensity (a.u.)'],
            'FT-IR': ['Wavenumber (cm⁻¹)', 'Intensity (a.u.)']
        };
        const [xName, yName] = names[value] ?? names.GCD;
        setXAxisName(xName);
        setYAxisName(yName);
        setTemplateApplyCount(count => count + 1);
    };

    const handleApplyTemplate = (p: ChartTemplateParams) => {
        if (p.fontFamily !== undefined) setFontFamily(p.fontFamily);
        if (p.lineWidth !== undefined) setLineWidth(p.lineWidth);
        if (p.lineColor !== undefined) setLineColor(p.lineColor);
        if (p.titleSize !== undefined) setTitleSize(p.titleSize);
        if (p.labelSize !== undefined) setLabelSize(p.labelSize);
        if (p.xMin !== undefined) setXMin(p.xMin);
        if (p.xMax !== undefined) setXMax(p.xMax);
        if (p.xInterval !== undefined) setXInterval(p.xInterval);
        if (p.xOnZero !== undefined) setXOnZero(p.xOnZero);
        if (p.yMin !== undefined) setYMin(p.yMin);
        if (p.yMax !== undefined) setYMax(p.yMax);
        if (p.yInterval !== undefined) setYInterval(p.yInterval);
        if (p.legendPosition !== undefined) setLegendPosition(p.legendPosition);
        if (p.seriesName !== undefined) setSeriesName(p.seriesName);
        if (p.xAxisName !== undefined) setXAxisName(p.xAxisName);
        if (p.yAxisName !== undefined) setYAxisName(p.yAxisName);
        if (p.chartWidth !== undefined) setChartWidth(p.chartWidth);
        if (p.chartHeight !== undefined) setChartHeight(p.chartHeight);
        setTemplateApplyCount(count => count + 1);
    };

    const handleSaveTemplate = () => {
        if (!newTemplateName.trim()) {
            alert("请输入模板名称");
            return;
        }

        const currentParams = {
            fontFamily, lineWidth, lineColor, titleSize, labelSize, seriesName, legendPosition,
            xAxisName, yAxisName, xMin, xMax, xInterval, xOnZero, yMin, yMax, yInterval, chartWidth, chartHeight
        };

        const newTemplate = {
            id: Date.now().toString(),
            name: newTemplateName.trim(),
            params: currentParams
        };

        const updatedTemplates = [...customTemplates, newTemplate];
        setCustomTemplates(updatedTemplates);
        localStorage.setItem('myCustomTemplates', JSON.stringify(updatedTemplates));
        setNewTemplateName("");
        alert("模板保存成功！");
    };

    const handleDeleteTemplate = (id: string) => {
        const updatedTemplates = customTemplates.filter(t => t.id !== id);
        setCustomTemplates(updatedTemplates);
        localStorage.setItem('myCustomTemplates', JSON.stringify(updatedTemplates));
    };


    const handleClearData = async () => {
        if (!window.confirm('确定清空当前主数据、对比样和附图数据吗？')) return;
        setFileChunks1([]);
        setFileName(null);
        setFileChunks2([]);
        setFileName2(null);
        setInsetTotalX([]);
        setInsetTotalY([]);
        setShowInset(false);
        setUseMainDataForInset(true);
        setImportWarnings([]);
        setError(null);
        setFollowUpText('');
        setDataType('GCD');
        setAppliedOptions(null);
        const fileInput = document.getElementById('data-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        const fileInput2 = document.getElementById('data-upload-2') as HTMLInputElement;
        if (fileInput2) fileInput2.value = '';
        await clearDataFromDB();
        localStorage.removeItem('myChartPresets');
        // Reset to some nice defaults
        setXAxisName("Capacity");
        setYAxisName("Voltage (V)");
        setSeriesName("Data 1");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Sort files by name to ensure sequential stitching
        files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        setError(null);
        setImportWarnings([]);
        setIsLoading(true);

        setTimeout(async () => {
            try {
                const newChunks: DataChunk[] = [];
                const warnings: string[] = [];
                for (const file of files) {
                    const data = await parseExcelFile(file);
                    warnings.push(...data.warnings.map(warning => `${file.name}：${warning}`));
                    newChunks.push({
                        id: Date.now().toString() + Math.random().toString(),
                        name: file.name,
                        x: data.x,
                        y: data.y
                    });
                }

                if (newChunks.length === 0) {
                    throw new Error("所有文件中均未提取到有效数据。");
                }

                setFileChunks1(prev => [...prev, ...newChunks]);

                setFileName(files.length === 1 ? files[0].name : `已加载 ${files.length} 个文件`);
                setImportWarnings(warnings);
                setIsLoading(false);

                // Clear the file input so the same files can be selected again
                const fileInput = document.getElementById('data-upload') as HTMLInputElement;
                if (fileInput) fileInput.value = '';

            } catch (err: unknown) {
                console.error("Error parsing files:", err);
                setError(`解析或拼接失败: ${err instanceof Error ? err.message : "文件格式不受支持"}`);
                setIsLoading(false);
                const fileInput = document.getElementById('data-upload') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            }
        }, 50); // Give UI time to render loading state
    };

    const handleFileUpload2 = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Sort files by name to ensure sequential stitching
        files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        setError(null);
        setImportWarnings([]);
        setIsLoading(true);

        setTimeout(async () => {
            try {
                const newChunks: DataChunk[] = [];
                const warnings: string[] = [];
                for (const file of files) {
                    const data = await parseExcelFile(file);
                    warnings.push(...data.warnings.map(warning => `${file.name}：${warning}`));
                    newChunks.push({
                        id: Date.now().toString() + Math.random().toString(),
                        name: file.name,
                        x: data.x,
                        y: data.y
                    });
                }

                if (newChunks.length === 0) {
                    throw new Error("所有文件中均未提取到有效数据。");
                }

                setFileChunks2(prev => {
                    const updated = [...prev, ...newChunks];
                    return updated;
                });

                setFileName2(files.length === 1 ? files[0].name : `已加载 ${files.length} 个文件`);
                setImportWarnings(warnings);
                setIsLoading(false);

                const fileInput = document.getElementById('data-upload-2') as HTMLInputElement;
                if (fileInput) fileInput.value = '';

            } catch (err: unknown) {
                console.error("Error parsing files 2:", err);
                setError(`解析对比样失败: ${err instanceof Error ? err.message : "文件格式不受支持"}`);
                setIsLoading(false);
                const fileInput = document.getElementById('data-upload-2') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            }
        }, 50);
    };

    const handleRemoveChunk1 = (id: string) => {
        setFileChunks1(prev => {
            const updated = prev.filter(chunk => chunk.id !== id);
            if (updated.length === 0) {
                setFileName(null);
                setAppliedOptions(null);
            } else {
                setFileName(updated.length === 1 ? updated[0].name : `已加载 ${updated.length} 个文件`);
            }
            return updated;
        });
    };

    const handleRemoveChunk2 = (id: string) => {
        setFileChunks2(prev => {
            const updated = prev.filter(chunk => chunk.id !== id);
            setFileName2(updated.length === 0 ? null : updated.length === 1 ? updated[0].name : `已加载 ${updated.length} 个文件`);
            return updated;
        });
    };

    const handleInsetFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Sort files by name to ensure sequential stitching
        files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        setImportWarnings([]);
        setIsLoading(true);

        setTimeout(async () => {
            try {
                let totalX: number[] = [];
                let totalY: number[] = [];
                const warnings: string[] = [];

                for (const file of files) {
                    const data = await parseExcelFile(file);
                    warnings.push(...data.warnings.map(warning => `${file.name}：${warning}`));
                    totalX = [...totalX, ...data.x];
                    totalY = [...totalY, ...data.y];
                }

                setInsetTotalX(totalX);
                setInsetTotalY(totalY);
                setImportWarnings(warnings);
                setIsLoading(false);

                const fileInput = document.getElementById('inset-upload') as HTMLInputElement;
                if (fileInput) fileInput.value = '';

            } catch (err: unknown) {
                console.error("Error parsing inset files:", err);
                setError(`附图数据解析失败: ${err instanceof Error ? err.message : "文件格式不受支持"}`);
                setIsLoading(false);
                const fileInput = document.getElementById('inset-upload') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            }
        }, 50);
    };

    const handleDeepAnalysis = async () => {
        if (!followUpText.trim()) return;
        const requestVersion = analysisVersionRef.current;
        setAnalysisError(null);
        setIsDeepAnalyzing(true);
        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dataType,
                    isFollowUp: true,
                    followUpText,
                    previousReport: dataInsights.report
                })
            });
            if (!res.ok) throw new Error('API 请求失败');
            const data = await res.json();
            if (requestVersion !== analysisVersionRef.current) return;
            setDeepAnalysisReport(data.report || "深度探讨完成，暂无详细内容。");
            setFollowUpText("");
        } catch (error) {
            console.error("深度分析失败:", error);
            if (requestVersion === analysisVersionRef.current) setAnalysisError("追问失败，请稍后重试。输入内容已保留。");
        } finally {
            if (requestVersion === analysisVersionRef.current) setIsDeepAnalyzing(false);
        }
    };

    // Keep X/Y values paired, regardless of whether the file uses two columns or two rows.
    const parseExcelFile = (file: File): Promise<ReturnType<typeof parseXYMatrix>> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const buffer = evt.target?.result;
                    if (!(buffer instanceof ArrayBuffer)) throw new Error('文件读取失败');
                    const workbook = readWorkbook(buffer, file.name);
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    if (!worksheet) throw new Error('文件中没有可读取的工作表');
                    const rows = xlsx.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null });
                    resolve(parseXYMatrix(rows, dataOrientation));
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    };

    const generateOption = () => {
        if (fileChunks1.length === 0) return {};

        const seriesFromChunks = (chunks: DataChunk[]) => chunks.flatMap((chunk, chunkIndex) => [
            ...chunk.x.map((xValue, index) => [xValue, chunk.y[index]]),
            ...(chunkIndex < chunks.length - 1 ? [[null, null]] : [])
        ]);

        const axisLineWidth = Number(lineWidth) || 2;
        const majorTickLength = 8;
        const minorTickLength = 4;

        // A null pair breaks the line between independently uploaded files.
        const seriesData = seriesFromChunks(fileChunks1);
        const controlSeriesData = seriesFromChunks(fileChunks2);
        const insetSeriesData = useMainDataForInset
            ? seriesData
            : insetTotalX.map((xValue, index) => [xValue, insetTotalY[index]]);

        const parseGridValue = (val: string | number | undefined) => {
            if (!val) return undefined;
            const strVal = String(val).trim();
            // 如果包含 %，直接作为字符串返回；否则转换为纯数字（绝对像素）
            return strVal.includes('%') ? strVal : Number(strVal);
        };

        const baseGrid = {
            show: true,
            borderWidth: 1.5,
            borderColor: '#111', // Dark border for scientific style
            top: '12%',
            right: '8%',
            bottom: '15%',
            left: '15%',
        };

        const baseXAxis = {
            type: 'value',
            name: xAxisName,
            nameLocation: 'center',
            nameGap: 30,
            min: xMin !== "" ? Number(xMin) : undefined,
            max: xMax !== "" ? Number(xMax) : undefined,
            interval: xInterval !== "" ? Number(xInterval) : undefined,
            nameTextStyle: {
                fontSize: titleSize,
                color: '#000',
                fontWeight: 'bold'
            },
            axisLine: {
                show: true,
                onZero: xOnZero,
                lineStyle: { width: axisLineWidth }
            },
            axisTick: {
                show: true,
                inside: true, // Specific requirement: ticks facing inwards
                length: majorTickLength,
                lineStyle: { width: axisLineWidth }
            },
            minorTick: {
                show: true,
                splitNumber: 2, // 极其关键：等分为2份，即中间产生 1 根副刻度
                length: minorTickLength,
                lineStyle: { width: axisLineWidth / 2 }
            },
            axisLabel: {
                fontSize: labelSize,
                color: '#000',
                margin: 12
            },
            splitLine: {
                show: false // Specific requirement: no grid lines
            }
        };

        const baseYAxis = {
            type: 'value',
            name: yAxisName,
            nameLocation: 'center',
            nameGap: 40,
            min: yMin !== "" ? Number(yMin) : undefined,
            max: yMax !== "" ? Number(yMax) : undefined,
            interval: yInterval !== "" ? Number(yInterval) : undefined,
            nameTextStyle: {
                fontSize: titleSize,
                color: '#000',
                fontWeight: 'bold'
            },
            axisLine: {
                show: true,
                onZero: false,
                lineStyle: { width: axisLineWidth }
            },
            axisTick: {
                show: true,
                inside: true, // Specific requirement: ticks facing inwards
                length: majorTickLength,
                lineStyle: { width: axisLineWidth }
            },
            minorTick: {
                show: true,
                splitNumber: 2, // 极其关键：等分为2份，即中间产生 1 根副刻度
                length: minorTickLength,
                lineStyle: { width: axisLineWidth / 2 }
            },
            axisLabel: {
                fontSize: labelSize,
                color: '#000',
                margin: 12
            },
            splitLine: {
                show: false // Specific requirement: no grid lines
            }
        };

        const baseSeries = {
            name: seriesName,
            data: seriesData,
            type: 'line',
            symbol: 'none',
            showSymbol: false,
            sampling: 'none', // 绝对禁止抽样，保证折返曲线 100% 连贯
            animation: false, // 彻底关闭初始动画，释放海量 CPU 算力
            hoverAnimation: false, // 关闭鼠标悬浮时的点放大动画
            large: true,
            largeThreshold: 5000,
            itemStyle: {
                color: lineColor
            },
            lineStyle: {
                width: lineWidth,
                color: lineColor
            }
        };

        return {
            backgroundColor: '#ffffff', // Required white background
            textStyle: {
                fontFamily: fontFamily,
            },
            dataZoom: [
                {
                    type: 'inside', // 开启鼠标滚轮缩放
                    xAxisIndex: 0,
                    filterMode: 'none' // 绝对禁止在缩放时过滤掉视野外的数据，防止连接线断裂
                },
                {
                    type: 'inside', // 支持 Y 轴联动缩放
                    yAxisIndex: 0,
                    filterMode: 'none'
                }
            ],
            tooltip: {
                trigger: 'axis',
                animation: false,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderColor: '#ccc',
                textStyle: {
                    color: '#333',
                    fontFamily: fontFamily
                }
            },
            legend: {
                show: true,
                orient: 'vertical',
                ...(legendPosition === 'top-right' ? { top: '15%', right: '12%' } :
                    legendPosition === 'top-left' ? { top: '15%', left: '18%' } :
                        legendPosition === 'bottom-right' ? { bottom: '20%', right: '12%' } :
                            { bottom: '20%', left: '18%' }),
                textStyle: {
                    fontFamily: fontFamily,
                    fontSize: labelSize,
                    color: '#000'
                }
            },
            grid: showInset ? [
                baseGrid,
                { left: parseGridValue(insetLeft), top: parseGridValue(insetTop), width: parseGridValue(insetWidth), height: parseGridValue(insetHeight), backgroundColor: 'transparent', show: true, borderColor: '#4b5563', borderWidth: axisLineWidth, zlevel: 1 }
            ] : baseGrid,
            xAxis: showInset ? [
                { ...baseXAxis, gridIndex: 0 },
                {
                    ...baseXAxis,
                    gridIndex: 1,
                    min: insetXMin !== "" ? Number(insetXMin) : undefined,
                    max: insetXMax !== "" ? Number(insetXMax) : undefined,
                    zlevel: 1,
                    name: showInsetAxisName ? insetXAxisName : undefined,
                    nameTextStyle: { ...baseXAxis.nameTextStyle, fontSize: Number(insetFontSize) },
                    axisLabel: { ...baseXAxis.axisLabel, fontSize: Number(insetFontSize) },
                    interval: insetXSplit !== "" ? Number(insetXSplit) : undefined,
                    axisTick: { ...baseXAxis.axisTick, length: majorTickLength / 2 },
                    minorTick: { ...baseXAxis.minorTick, length: minorTickLength / 2 }
                }
            ] : baseXAxis,
            yAxis: showInset ? [
                { ...baseYAxis, gridIndex: 0 },
                {
                    ...baseYAxis,
                    gridIndex: 1,
                    min: insetYMin !== "" ? Number(insetYMin) : undefined,
                    max: insetYMax !== "" ? Number(insetYMax) : undefined,
                    zlevel: 1,
                    name: showInsetAxisName ? insetYAxisName : undefined,
                    nameTextStyle: { ...baseYAxis.nameTextStyle, fontSize: Number(insetFontSize) },
                    axisLabel: { ...baseYAxis.axisLabel, fontSize: Number(insetFontSize) },
                    interval: insetYSplit !== "" ? Number(insetYSplit) : undefined,
                    axisTick: { ...baseYAxis.axisTick, length: majorTickLength / 2 },
                    minorTick: { ...baseYAxis.minorTick, length: minorTickLength / 2 }
                }
            ] : baseYAxis,
            series: (() => {
                const mainSeries = [
                    { ...baseSeries, xAxisIndex: 0, yAxisIndex: 0 },
                    fileChunks2.length > 0 ? { ...baseSeries, xAxisIndex: 0, yAxisIndex: 0, name: seriesName2, data: controlSeriesData, itemStyle: { color: lineColor2 }, lineStyle: { width: lineWidth, color: lineColor2 } } : null
                ].filter(Boolean);

                if (!showInset) return mainSeries;

                const baseInsetSeries1 = { ...baseSeries, xAxisIndex: 1, yAxisIndex: 1, zlevel: 1, data: insetSeriesData };

                const insetSeries = useMainDataForInset ? [
                    baseInsetSeries1,
                    fileChunks2.length > 0 ? { ...baseSeries, xAxisIndex: 1, yAxisIndex: 1, zlevel: 1, name: seriesName2, data: controlSeriesData, itemStyle: { color: lineColor2 }, lineStyle: { width: lineWidth, color: lineColor2 } } : null
                ].filter(Boolean) : [baseInsetSeries1];

                return [...mainSeries, ...insetSeries];
            })()
        };
    };

    const handleRefreshChart = () => {
        setAppliedOptions(generateOption());

        // Save to browser LocalStorage
        const currentParams = {
            fontFamily, lineWidth, lineColor, titleSize, labelSize, seriesName, legendPosition,
            xAxisName, yAxisName, xMin, xMax, xInterval, yMin, yMax, yInterval, chartWidth, chartHeight, xOnZero
        };
        localStorage.setItem('myChartPresets', JSON.stringify(currentParams));
    };

    const generateAIReport = async () => {
        if (fileChunks1.length === 0) {
            alert("请先上传主数据以供 AI 分析！");
            return;
        }
        const requestVersion = analysisVersionRef.current;
        const requestId = ++analysisRequestRef.current;
        const xData = fileChunks1.flatMap(chunk => chunk.x);
        const yData = fileChunks1.flatMap(chunk => chunk.y);
        if (xData.length === 0) return;
        if (xData.length !== yData.length || xData.some(value => !Number.isFinite(value)) || yData.some(value => !Number.isFinite(value))) {
            setAnalysisError('当前数据包含无效或未配对的数值，请重新导入原始文件后分析。');
            return;
        }
        setAnalysisError(null);
        setDeepAnalysisReport('');
        setDataInsights(prev => ({ ...prev, status: 'analyzing' }));

        const payload: {
            dataType: string; dataPointsCount: number; xAxisLabel: string; yAxisLabel: string;
            maxCapacity?: number; voltageRange?: string; topPeaks?: string;
        } = { dataType, dataPointsCount: xData.length, xAxisLabel: xAxisName, yAxisLabel: yAxisName };
        if (dataType === 'GCD') {
            let xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
            for (let i = 0; i < xData.length; i++) {
                if (xData[i] > xMax) xMax = xData[i];
                if (yData[i] < yMin) yMin = yData[i];
                if (yData[i] > yMax) yMax = yData[i];
            }
            const maxCap = xMax.toFixed(2);
            const vMin = yMin.toFixed(2);
            const vMax = yMax.toFixed(2);
            payload.maxCapacity = xMax;
            const voltageRange = `${vMin} - ${vMax}`;
            payload.voltageRange = voltageRange;
            setDataInsights(prev => ({ ...prev, maxCapacity: maxCap, voltageRange }));
        } else {
            // Local maxima are candidates for review, not a phase identification.
            const localPeaks: { x: number; y: number }[] = [];
            // 放弃平均值基线，改用底噪宽容度（仅排除极低数据）
            const sortedY = [...yData].sort((a, b) => a - b);
            const baseline = sortedY[Math.floor(sortedY.length * 0.1)]; // 底部10%视为基线
            const noiseThreshold = baseline + (sortedY[sortedY.length - 1] - baseline) * 0.03; // 高于基线3%才算峰
            // Check each file independently so the join cannot create a false peak.
            for (const chunk of fileChunks1) {
                for (let i = 2; i < chunk.x.length - 2; i++) {
                    const y = chunk.y[i];
                    if (y > chunk.y[i - 1] && y > chunk.y[i + 1] &&
                        y > chunk.y[i - 2] && y > chunk.y[i + 2] &&
                        y > noiseThreshold) {
                        localPeaks.push({ x: chunk.x[i], y });
                    }
                }
            }

            // Include up to 12 candidate peaks in the AI request.
            localPeaks.sort((a, b) => b.y - a.y);
            const topPeaks = localPeaks.slice(0, 12).map(p => p.x.toFixed(2)).join(', ');

            payload.topPeaks = topPeaks;
            setDataInsights(prev => ({ ...prev, maxCapacity: `分析模式: ${dataType}`, voltageRange: `提取群峰: ${localPeaks.slice(0, 5).map(p => p.x.toFixed(1)).join(', ')}...` }));
        }
        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                // 读取后端返回的真实报错（如 500 API 不可用等）
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.report || '大模型认知引擎无响应');
            }
            const data = await res.json();
            if (requestVersion !== analysisVersionRef.current || requestId !== analysisRequestRef.current) return;
            setDataInsights(prev => ({ ...prev, status: 'done', report: data.report || "分析完成，暂无详细报告。", primary: data.primary || "", secondary: data.secondary || "" }));
        } catch (error: unknown) {
            console.error("AI 分析抛出异常:", error);
            if (requestVersion !== analysisVersionRef.current || requestId !== analysisRequestRef.current) return;
            setDataInsights(prev => ({ ...prev, status: 'idle', report: '', primary: '', secondary: '' }));
            setAnalysisError(error instanceof Error ? error.message : 'AI 分析失败，请稍后重试。');
        }
    };

    // Analysis belongs to the current data and axis meaning only.
    useEffect(() => {
        analysisVersionRef.current += 1;
        analysisRequestRef.current += 1;
        setDataInsights(emptyInsights());
        setDeepAnalysisReport('');
        setAnalysisError(null);
        setIsDeepAnalyzing(false);
    }, [fileChunks1, fileChunks2, insetTotalX, insetTotalY, dataType, xAxisName, yAxisName]);

    // Refresh from committed state so a mode switch cannot leave old axis labels on the chart.
    useEffect(() => {
        if (fileChunks1.length > 0) {
            setAppliedOptions(generateOption());
        } else {
            setAppliedOptions(null);
        }
        // generateOption captures the currently committed chart settings.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileChunks1, fileChunks2, templateApplyCount, insetTotalX, insetTotalY, showInset, useMainDataForInset]);

    const mainPointCount = fileChunks1.reduce((sum, chunk) => sum + chunk.x.length, 0);

    const processedMatrix = useMemo(() => [["来源文件", xAxisName || "X", yAxisName || "Y"], ...fileChunks1.flatMap(chunk => chunk.x.map((x, i) => [chunk.name, x, chunk.y[i]]))], [fileChunks1, xAxisName, yAxisName]);
    const processedTable = useMemo(() => parseTemplateTable(processedMatrix), [processedMatrix]);
    async function exportMainSvg() {
        if (!chartRef.current || !appliedOptions) throw new Error("请先导入数据并更新图表。");
        const currentOptions = chartRef.current.getEchartsInstance().getOption();
        const echarts = await import('echarts');
        const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: Math.max(200, chartWidth || 600), height: Math.max(200, chartHeight || 400) });
        try { chart.setOption({ ...currentOptions, animation: false }); return chart.renderToSVGString(); }
        finally { chart.dispose(); }
    }

    return (
        <main className="data-workbench min-h-[calc(100vh-4rem)]">
            <div className="workbench-shell">
                <div className="workbench-appbar">
                    <header className="workbench-hero">
                        <div className="workbench-eyebrow">DATA STUDIO <span className="workbench-eyebrow-divider">/</span> 科研绘图</div>
                        <h1>{workspace === "templates" ? "论文图例模板" : "科研数据工作台"}</h1>
                        <p>{workspace === "templates" ? "选择图式、替换实验数据，生成独立的论文图表。" : "导入实验数据、绘制曲线，让每组结果清晰可见。"}</p>
                    </header>
                    <div className="workbench-appbar-actions">
                        <nav className="workbench-pill-nav" aria-label="工作台区域">
                            <a className={workspace === "processing" ? "is-active" : ""} aria-current={workspace === "processing" ? "page" : undefined} href="#data-source">数据处理</a>
                            <a className={workspace === "templates" ? "is-active" : ""} aria-current={workspace === "templates" ? "page" : undefined} href="#paper-figures">论文图例模板</a>
                            <a href="#chart-preview">图表画布</a>
                            <a href="#analysis">辅助解读</a>
                        </nav>
                        {workspace === "processing" && <button type="button" className="workbench-top-upload" onClick={() => mainFileInputRef.current?.click()}>
                            <UploadCloud size={16} /> 导入文件
                        </button>}
                    </div>
                </div>

                <div hidden={workspace !== "processing"}>
                <div className="workbench-quick-stats" aria-label="当前数据概览">
                    <div className="workbench-stat">
                        <span>已导入文件</span>
                        <strong>{fileChunks1.length.toLocaleString()}</strong>
                        <small>主数据 · Excel / CSV</small>
                    </div>
                    <div className="workbench-stat workbench-stat--accent">
                        <span>有效数据点</span>
                        <strong>{mainPointCount.toLocaleString()}</strong>
                        <small>已识别 X / Y 数值对</small>
                    </div>
                    <div className="workbench-stat">
                        <span>当前数据类型</span>
                        <strong>{dataType}</strong>
                        <small>{fileChunks2.length > 0 ? `已添加 ${fileChunks2.length} 组对比文件` : "可在导入区切换类型"}</small>
                    </div>
                </div>

            <div className="workbench-grid">
                <div className="workbench-data-zone" id="data-source">

                    {/* Accordion 1: Data & Presets */}
                    <details open className="workbench-card workbench-data-card group bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden transition-all duration-300">
                        <summary className="cursor-pointer list-none flex items-center gap-2 p-4 bg-gray-900 outline-none select-none font-semibold text-gray-200 border-b border-gray-600">
                            <span className="workbench-section-index">01</span>
                            <FileSpreadsheet size={19} />
                            <span>导入数据</span>
                        </summary>
                        <div className="p-4 pt-4 flex flex-col gap-6 bg-gray-800">
                            <label htmlFor="data-upload"
                                className="workbench-upload cursor-pointer group/upload"
                            >
                                <input
                                    id="data-upload"
                                    ref={mainFileInputRef}
                                    type="file"
                                    multiple
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileUpload}
                                    className="sr-only"
                                />
                                <Image
                                    src="/images/data-glass-ribbon.png"
                                    alt=""
                                    width={230}
                                    height={210}
                                    className="workbench-upload-art"
                                    priority
                                />
                                <span className="workbench-upload-icon"><UploadCloud size={24} /></span>
                                <strong>{fileName ? "继续添加主数据" : "选择主数据文件"}</strong>
                                <span>点击选择 Excel / CSV 文件 · 支持多选</span>
                            </label>

                            <div className="workbench-dataset-options">
                                <div className="workbench-field">
                                    <label htmlFor="data-type">数据类型</label>
                                    <select id="data-type" value={dataType} onChange={(e) => handleDataTypeChange(e.target.value)}>
                                        <option value="GCD">GCD · 恒电流充放电</option>
                                        <option value="XRD">XRD · X 射线衍射</option>
                                        <option value="XPS">XPS · X 射线光电子能谱</option>
                                        <option value="Raman">Raman · 拉曼光谱</option>
                                        <option value="FT-IR">FT-IR · 傅里叶红外光谱</option>
                                    </select>
                                </div>
                                <div className="workbench-field">
                                    <label htmlFor="data-orientation">X/Y 数据排列</label>
                                    <select id="data-orientation" value={dataOrientation} onChange={(e) => setDataOrientation(e.target.value as XYOrientationChoice)}>
                                        <option value="auto">自动识别（默认按两列）</option>
                                        <option value="row-pairs">逐行两列：每行一组 X/Y</option>
                                        <option value="two-rows">前两行：第一行 X、第二行 Y</option>
                                    </select>
                                </div>
                                <p>自动识别仅判断表格排列；数据类型和单位请按实验记录确认。更改排列方式后请重新导入。</p>
                            </div>

                            {/* Chunks List 1 */}
                            {fileChunks1.length > 0 && (
                                <div className="bg-gray-900/50 rounded-lg p-2 mt-2 space-y-1">
                                    {fileChunks1.map((chunk) => (
                                        <div key={chunk.id} className="flex items-center justify-between bg-gray-800/80 border border-gray-700/50 rounded-md py-2 px-3 hover:bg-gray-700 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <FileText size={14} className="text-indigo-400" />
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-gray-200 font-medium truncate max-w-[180px] leading-tight">{chunk.name}</span>
                                                    <span className="text-[10px] text-gray-500 leading-tight">{chunk.x.length.toLocaleString()} 个数据点</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRemoveChunk1(chunk.id); }}
                                                className="text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors p-1.5 rounded-md flex items-center justify-center font-bold"
                                                title="移除此区块"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {fileChunks1.length > 0 && (
                                <details className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-xs text-slate-300">
                                    <summary className="cursor-pointer font-medium text-indigo-300">核对首个文件的前 5 组 X/Y 数值</summary>
                                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
                                        <span className="font-bold">X</span><span className="font-bold">Y</span>
                                        {fileChunks1[0].x.slice(0, 5).map((xValue, index) => (
                                            <div key={index} className="contents"><span>{xValue}</span><span>{fileChunks1[0].y[index]}</span></div>
                                        ))}
                                    </div>
                                </details>
                            )}
                            {error && <div className="workbench-inline-error" role="alert">{error}</div>}
                            {importWarnings.length > 0 && (
                                <div className="workbench-inline-warning space-y-1" role="status">
                                    {importWarnings.map((warning, index) => <p key={`${index}-${warning}`}>{warning}</p>)}
                                </div>
                            )}

                            {/* Control Sample Upload Box */}
                            <label htmlFor="data-upload-2"
                                className="workbench-control-upload cursor-pointer group/upload"
                            >
                                <input
                                    id="data-upload-2"
                                    type="file"
                                    multiple
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileUpload2}
                                    className="sr-only"
                                />
                                <span className="workbench-control-icon"><UploadCloud size={18} /></span>
                                <span><strong>{fileName2 ? "继续添加对比数据" : "添加对比数据"}</strong><small>可选 · 与主数据叠加显示</small></span>
                            </label>

                            {/* Chunks List 2 */}
                            {fileChunks2.length > 0 && (
                                <div className="bg-gray-900/50 rounded-lg p-2 mt-2 space-y-1">
                                    {fileChunks2.map((chunk) => (
                                        <div key={chunk.id} className="flex items-center justify-between bg-gray-800/80 border border-gray-700/50 rounded-md py-2 px-3 hover:bg-gray-700 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <FileText size={14} className="text-red-400" />
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-gray-200 font-medium truncate max-w-[180px] leading-tight">{chunk.name}</span>
                                                    <span className="text-[10px] text-gray-500 leading-tight">{chunk.x.length.toLocaleString()} 个数据点</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRemoveChunk2(chunk.id); }}
                                                className="text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors p-1.5 rounded-md flex items-center justify-center font-bold"
                                                title="移除此区块"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {(fileChunks1.length > 0 || fileChunks2.length > 0) && (
                                <GlassButton
                                    variant="danger"
                                    size="md"
                                    onClick={handleClearData}
                                    className="workbench-clear-data w-full mt-2"
                                >
                                    <Trash2 size={15} /> 清空全部数据
                                </GlassButton>
                            )}

                            {/* Template Library */}
                            <details className="workbench-template">
                                <summary><Zap size={16} /> 绘图模板 <small>可选</small></summary>
                                <div className="workbench-template-content space-y-5">

                                {/* System Presets */}
                                <div className="space-y-2">
                                    <p className="text-xs text-gray-400">系统内置</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <button onClick={() => handleApplyTemplate(PRESETS.nature)} className="bg-gray-800 border border-gray-600 hover:border-indigo-400 hover:bg-gray-700 text-gray-300 text-xs py-2 px-3 rounded-lg transition-all flex flex-col items-start gap-1">
                                            <span className="font-bold text-white">A. 黑白出版风</span>
                                            <span className="text-[10px] text-gray-400">清晰的轴线与文字</span>
                                        </button>
                                        <button onClick={() => handleApplyTemplate(PRESETS.bright)} className="bg-gray-800 border border-gray-600 hover:border-blue-400 hover:bg-gray-700 text-gray-300 text-xs py-2 px-3 rounded-lg transition-all flex flex-col items-start gap-1">
                                            <span className="font-bold text-blue-400">B. 明亮清透风</span>
                                            <span className="text-[10px] text-gray-400">科研PPT专属</span>
                                        </button>
                                        <button onClick={() => handleApplyTemplate(PRESETS.electro)} className="bg-gray-800 border border-gray-600 hover:border-red-400 hover:bg-gray-700 text-gray-300 text-xs py-2 px-3 rounded-lg transition-all flex flex-col items-start gap-1">
                                            <span className="font-bold text-red-400">C. 电化学对比</span>
                                            <span className="text-[10px] text-gray-400">经典红线</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Custom Presets */}
                                {customTemplates.length > 0 && (
                                    <div className="space-y-2 border-t border-gray-700 pt-3">
                                        <p className="text-xs text-indigo-300">我的自定义模板</p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {customTemplates.map((t) => (
                                                <div key={t.id} className="group flex relative">
                                                    <button onClick={() => handleApplyTemplate(t.params)} className="flex-1 bg-gray-800 border border-indigo-900/50 hover:border-indigo-500 hover:bg-gray-700 text-indigo-400 text-xs py-2 px-3 rounded-lg transition-all flex flex-col items-start gap-1 pr-6 truncate">
                                                        <span className="font-bold truncate w-full text-left">{t.name}</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                                                        className="absolute right-1 top-1 bottom-1 px-2 text-gray-500 hover:text-red-400 hover:bg-gray-600/50 rounded transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center"
                                                        title="删除此模板"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Save Custom Form */}
                                <div className="flex items-center gap-2 border-t border-gray-700 pt-4 mt-2">
                                    <input
                                        type="text"
                                        placeholder="输入模板名称以保存..."
                                        value={newTemplateName}
                                        onChange={(e) => setNewTemplateName(e.target.value)}
                                        className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    />
                                    <GlassButton
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleSaveTemplate}
                                        disabled={!newTemplateName.trim()}
                                        className="workbench-save-template"
                                    >
                                        保存当前设置
                                    </GlassButton>
                                </div>
                                </div>
                            </details>
                        </div>
                    </details>

                </div>

                {/* Chart preview */}
                <section id="chart-preview" className="workbench-preview workbench-card self-start bg-gray-800 rounded-2xl p-6 border border-gray-700 flex flex-col gap-6 overflow-hidden" aria-labelledby="workbench-preview-title">
                    <div className="workbench-preview-heading">
                        <div>
                            <span className="workbench-card-eyebrow">VISUAL CANVAS</span>
                            <h2 id="workbench-preview-title">图表画布 <ArrowUpRight size={18} aria-hidden="true" /></h2>
                            <p>核对曲线，调整参数，设置物理尺寸，检查并导出 PNG、SVG 或打印 PDF。</p>
                        </div>
                        <div className="workbench-chart-toolbar">
                            <GlassButton
                                id="refresh-chart-btn"
                                variant="secondary"
                                size="sm"
                                onClick={handleRefreshChart}
                                disabled={fileChunks1.length === 0}
                                className="workbench-refresh"
                            >
                                <RefreshCw size={15} /> 更新图表
                            </GlassButton>
                            <GlassButton
                                variant="primary"
                                size="sm"
                                onClick={() => document.getElementById("main-publication-export")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                                disabled={fileChunks1.length === 0 || !appliedOptions}
                                className="workbench-export"
                            >
                                <Download size={15} /> 检查与导出
                            </GlassButton>
                        </div>
                    </div>

                    <div className="workbench-canvas-meta">
                        <span className="workbench-canvas-status"><i aria-hidden="true" />{fileChunks1.length > 0 ? "曲线已就绪" : "等待导入数据"}</span>
                        {mainPointCount > 0 && (
                            <span className="workbench-data-count">
                                {mainPointCount.toLocaleString()} 点 · {fileChunks1.length} 个文件
                            </span>
                        )}
                    </div>

                    <div className="workbench-preview-frame flex-1 w-full h-full rounded-xl border relative flex items-center justify-center overflow-hidden min-h-[400px]">
                        {isLoading ? (
                            <div className="workbench-empty flex flex-col items-center gap-4">
                                <RefreshCw size={32} className="animate-spin" />
                                <p>正在解析数据，请稍候…</p>
                            </div>
                        ) : fileChunks1.length === 0 || !appliedOptions ? (
                            <div className="workbench-empty flex flex-col items-center gap-4">
                                <span className="workbench-empty-icon"><Activity size={28} /></span>
                                <strong>还没有图表</strong>
                                <p>上传实验数据，曲线会在这里呈现</p>
                                <button type="button" className="workbench-empty-upload" onClick={() => mainFileInputRef.current?.click()}>
                                    <UploadCloud size={16} /> 选择文件开始
                                </button>
                                <small>支持 CSV、XLS、XLSX</small>
                            </div>
                        ) : (
                            <div className="workbench-chart-scroll w-full h-full p-2 flex items-center justify-center overflow-auto">
                                <ReactECharts
                                    ref={chartRef}
                                    option={appliedOptions}
                                    style={{ height: `${chartHeight}px`, width: `${chartWidth}px` }}
                                    opts={{ renderer: 'canvas' }}
                                    notMerge={true}
                                />
                            </div>
                        )}
                    </div>
                    {fileChunks1.length > 0 && <p className="workbench-chart-pan-hint">左右滑动图表，可查看完整曲线</p>}
                    <div id="main-publication-export"><PublicationExport width={Math.max(200, chartWidth || 600)} height={Math.max(200, chartHeight || 400)} settings={exportSettings} onChange={setExportSettings} getSvg={exportMainSvg} filename={fileName || "实验曲线"} disabled={!appliedOptions || isLoading} onBusy={setFigureExporting} revision={appliedOptions} /></div>
                </section>

                {fileChunks1.length > 0 && <div className="workbench-data-advisor"><p>下方检查当前已解析的主样品 XY 数据；原始导入中的跳过行见上传提示。</p><DataAdvisor key={`${fileName}-${fileChunks1.length}`} table={processedTable} mapping={{ x: 1, ys: [2], errors: {} }} initialGoal="trend" initialGroup={-1} demo={false} disabled={figureExporting} onApply={(id, mapping) => { templateStudioRef.current?.loadData(fileName || "已处理实验数据", processedMatrix, id, mapping); window.location.hash = "paper-figures"; }} /></div>}
                <div className="workbench-settings-zone" id="chart-settings">
                    <div className="workbench-settings-heading">
                        <span className="workbench-card-eyebrow">CUSTOMIZE</span>
                        <h2>图表设置</h2>
                        <p>修改参数后，在画布顶部更新图表。</p>
                    </div>

                    {/* Accordion 2: Size Settings */}
                    <details className="workbench-card group bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden transition-all duration-300">
                        <summary className="cursor-pointer list-none flex items-center gap-2 p-4 bg-gray-900 hover:bg-gray-700 outline-none select-none font-semibold text-gray-200 transition-colors border-b border-gray-600/50 group-open:border-gray-100">
                            <span className="workbench-section-index">02</span><Settings2 size={18} /> 图表尺寸
                        </summary>
                        <div className="p-4 pt-4 bg-gray-800">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-medium text-slate-600">图表宽度 (px)</label>
                                    <input type="number" min="200" step="50" max="3000" value={chartWidth} onChange={(e) => setChartWidth(Number(e.target.value))} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-medium text-slate-600">图表高度 (px)</label>
                                    <input type="number" min="200" step="50" max="3000" value={chartHeight} onChange={(e) => setChartHeight(Number(e.target.value))} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                                </div>
                            </div>
                        </div>
                    </details>

                    {/* 3. 坐标轴与范围 */}
                    <details className="workbench-card group bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden transition-all duration-300">
                        <summary className="cursor-pointer list-none flex items-center gap-2 p-4 bg-gray-900 hover:bg-gray-700 outline-none select-none font-semibold text-gray-200 transition-colors border-b border-gray-600/50 group-open:border-gray-100">
                            <span className="workbench-section-index">03</span><Settings2 size={18} /> 坐标轴与范围
                        </summary>
                        <div className="p-4 pt-4 bg-gray-800 grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2 col-span-2">
                                <label className="text-xs font-medium text-slate-400">X 轴标题</label>
                                <input type="text" value={xAxisName} onChange={(e) => setXAxisName(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-400">X 轴最小值</label>
                                <input type="number" placeholder="自适应" value={xMin} onChange={(e) => setXMin(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-400">X 轴最大值</label>
                                <input type="number" placeholder="自适应" value={xMax} onChange={(e) => setXMax(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                            </div>
                            <div className="flex flex-col gap-2 col-span-2">
                                <label className="text-xs font-medium text-slate-400">X 轴主刻度间距 (步长)</label>
                                <input type="number" placeholder="自适应" value={xInterval} onChange={(e) => setXInterval(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                            </div>

                            <div className="flex flex-col gap-2 col-span-2 mb-2">
                                <label className="text-xs font-medium text-slate-400">X 轴位置 (X-Axis Position)</label>
                                <select value={xOnZero ? "true" : "false"} onChange={(e) => setXOnZero(e.target.value === "true")} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 appearance-none transition-all">
                                    <option value="false">固定在底部边框</option>
                                    <option value="true">穿过 Y = 0 刻度</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-2 col-span-2 mt-2">
                                <label className="text-xs font-medium text-slate-400">Y 轴标题</label>
                                <input type="text" value={yAxisName} onChange={(e) => setYAxisName(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-400">Y 轴最小值</label>
                                <input type="number" placeholder="自适应" value={yMin} onChange={(e) => setYMin(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-400">Y 轴最大值</label>
                                <input type="number" placeholder="自适应" value={yMax} onChange={(e) => setYMax(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                            </div>
                            <div className="flex flex-col gap-2 col-span-2">
                                <label className="text-xs font-medium text-slate-400">Y 轴主刻度间距 (步长)</label>
                                <input type="number" placeholder="自适应" value={yInterval} onChange={(e) => setYInterval(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                            </div>
                        </div>
                    </details>

                    {/* 4. 数据与外观 */}
                    <details className="workbench-card group bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden transition-all duration-300">
                        <summary className="cursor-pointer list-none flex items-center gap-2 p-4 bg-gray-900 hover:bg-gray-700 outline-none select-none font-semibold text-gray-200 transition-colors border-b border-gray-600/50 group-open:border-gray-100">
                            <span className="workbench-section-index">04</span><Settings2 size={18} /> 曲线与图例
                        </summary>
                        <div className="p-4 pt-4 bg-gray-800 grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-400">数据图例名称 (Series Name)</label>
                                <input type="text" value={seriesName} onChange={(e) => setSeriesName(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-400">曲线颜色 (Color)</label>
                                <div className="flex items-center gap-2 w-full h-full">
                                    <input type="color" value={lineColor} onChange={(e) => setLineColor(e.target.value)} className="h-9 w-12 rounded bg-transparent border-0 cursor-pointer p-0" />
                                    <span className="text-sm font-mono text-slate-300">{lineColor}</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-red-400/80">对比样图例 (Control Name)</label>
                                <input type="text" value={seriesName2} onChange={(e) => setSeriesName2(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-red-400/80">对比颜色 (Control Color)</label>
                                <div className="flex items-center gap-2 w-full h-full">
                                    <input type="color" value={lineColor2} onChange={(e) => setLineColor2(e.target.value)} className="h-9 w-12 rounded bg-transparent border-0 cursor-pointer p-0" />
                                    <span className="text-sm font-mono text-slate-300">{lineColor2}</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-400">图例位置 (Legend)</label>
                                <select value={legendPosition} onChange={(e) => setLegendPosition(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 appearance-none transition-all">
                                    <option value="top-right">右上角 (Top-Right)</option>
                                    <option value="top-left">左上角 (Top-Left)</option>
                                    <option value="bottom-right">右下角 (Bottom-Right)</option>
                                    <option value="bottom-left">左下角 (Bottom-Left)</option>
                                </select>
                            </div>
                        </div>
                    </details>

                    {/* 5. 局部放大图 */}
                    <details className="workbench-card group bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                        <summary className="cursor-pointer list-none flex items-center gap-2 p-4 hover:bg-gray-800 outline-none select-none font-semibold text-gray-200 transition-colors border-b border-gray-700 group-open:border-gray-600">
                            <span className="workbench-section-index">05</span><Settings2 size={18} /> 局部放大图 <small className="workbench-summary-note">可选</small>
                        </summary>
                        <div className="p-4 pt-4 bg-gray-900 grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2 col-span-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="showInset"
                                    checked={showInset}
                                    onChange={(e) => setShowInset(e.target.checked)}
                                    className="w-4 h-4 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500/50"
                                />
                                <label htmlFor="showInset" className="text-sm font-medium text-slate-300 cursor-pointer">启用局部放大图 (Inset Chart)</label>
                            </div>

                            <div className="flex flex-col gap-2 col-span-2">
                                <label className="text-xs font-medium text-slate-400">数据源：与主图同步 / 独立上传数据</label>
                                <select
                                    value={useMainDataForInset ? "true" : "false"}
                                    onChange={(e) => setUseMainDataForInset(e.target.value === "true")}
                                    disabled={!showInset}
                                    className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 appearance-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="true">与主图同步数据</option>
                                    <option value="false">独立数据流 (上传附图专属数据)</option>
                                </select>
                            </div>

                            {!useMainDataForInset && showInset && (
                                <div className="col-span-2 flex flex-col gap-2">
                                    <label className="text-xs font-medium text-slate-400">独立附图数据上传</label>
                                    <label htmlFor="inset-upload"
                                        className="border border-dashed border-gray-600 hover:border-blue-500 bg-gray-800 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all duration-300"
                                    >
                                        <input
                                            id="inset-upload"
                                            type="file"
                                            multiple
                                            accept=".xlsx, .xls, .csv"
                                            onChange={handleInsetFileUpload}
                                            className="sr-only"
                                        />
                                        <p className="text-sm font-medium text-gray-400 mb-1">
                                            {insetTotalX.length > 0 ? `已加载独立点数: ${insetTotalX.length}` : "点击此处上传附图独立数据文件 (.xlsx, .csv)"}
                                        </p>
                                    </label>
                                </div>
                            )}

                            <div className="flex flex-col gap-2 mt-2">
                                <label className="text-xs font-medium text-slate-400">附图字体大小</label>
                                <input type="number" placeholder="10" value={insetFontSize} onChange={(e) => setInsetFontSize(e.target.value)} disabled={!showInset} className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>

                            <div className="flex flex-col gap-2 mt-2 justify-center">
                                <div className="flex items-center gap-2 h-full pt-6">
                                    <input type="checkbox" id="showInsetAxisName" checked={showInsetAxisName} onChange={(e) => setShowInsetAxisName(e.target.checked)} disabled={!showInset} className="w-4 h-4 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500/50 disabled:opacity-50" />
                                    <label htmlFor="showInsetAxisName" className="text-xs font-medium text-slate-400 cursor-pointer">显示附图轴标题</label>
                                </div>
                            </div>

                            {showInsetAxisName && showInset && (
                                <>
                                    <div className="flex flex-col gap-2 mt-2">
                                        <label className="text-xs font-medium text-slate-400">附图 X 轴标题</label>
                                        <input type="text" value={insetXAxisName} onChange={(e) => setInsetXAxisName(e.target.value)} disabled={!showInset} className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                                    </div>
                                    <div className="flex flex-col gap-2 mt-2">
                                        <label className="text-xs font-medium text-slate-400">附图 Y 轴标题</label>
                                        <input type="text" value={insetYAxisName} onChange={(e) => setInsetYAxisName(e.target.value)} disabled={!showInset} className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                                    </div>
                                </>
                            )}

                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-400">附图 X 轴最小值</label>
                                <input type="number" placeholder="自适应" value={insetXMin} onChange={(e) => setInsetXMin(e.target.value)} disabled={!showInset} className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-400">附图 X 轴最大值</label>
                                <input type="number" placeholder="自适应" value={insetXMax} onChange={(e) => setInsetXMax(e.target.value)} disabled={!showInset} className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                            <div className="flex flex-col gap-2 mt-2">
                                <label className="text-xs font-medium text-slate-400">附图 Y 轴最小值</label>
                                <input type="number" placeholder="自适应" value={insetYMin} onChange={(e) => setInsetYMin(e.target.value)} disabled={!showInset} className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                            <div className="flex flex-col gap-2 mt-2">
                                <label className="text-xs font-medium text-slate-400">附图 Y 轴最大值</label>
                                <input type="number" placeholder="自适应" value={insetYMax} onChange={(e) => setInsetYMax(e.target.value)} disabled={!showInset} className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                            <div className="flex flex-col gap-2 mt-2">
                                <label className="text-xs font-medium text-slate-400">X轴主刻度间距 (步长)</label>
                                <input type="number" placeholder="自适应" value={insetXSplit} onChange={(e) => setInsetXSplit(e.target.value)} disabled={!showInset} className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                            <div className="flex flex-col gap-2 mt-2">
                                <label className="text-xs font-medium text-slate-400">Y轴主刻度间距 (步长)</label>
                                <input type="number" placeholder="自适应" value={insetYSplit} onChange={(e) => setInsetYSplit(e.target.value)} disabled={!showInset} className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                            <div className="flex flex-col gap-2 mt-2">
                                <label className="text-xs font-medium text-slate-400">左偏移 (Left) <span className="text-[10px] text-slate-500">支持 % 或绝对像素（如 200）</span></label>
                                <input type="text" placeholder="60%" value={insetLeft} onChange={(e) => setInsetLeft(e.target.value)} disabled={!showInset} className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                            <div className="flex flex-col gap-2 mt-2">
                                <label className="text-xs font-medium text-slate-400">上偏移 (Top) <span className="text-[10px] text-slate-500">支持 % 或绝对像素</span></label>
                                <input type="text" placeholder="15%" value={insetTop} onChange={(e) => setInsetTop(e.target.value)} disabled={!showInset} className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                            <div className="flex flex-col gap-2 mt-2">
                                <label className="text-xs font-medium text-slate-400">宽度 (Width) <span className="text-[10px] text-slate-500">支持 % 或绝对像素</span></label>
                                <input type="text" placeholder="35%" value={insetWidth} onChange={(e) => setInsetWidth(e.target.value)} disabled={!showInset} className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                            <div className="flex flex-col gap-2 mt-2">
                                <label className="text-xs font-medium text-slate-400">高度 (Height) <span className="text-[10px] text-slate-500">支持 % 或绝对像素</span></label>
                                <input type="text" placeholder="35%" value={insetHeight} onChange={(e) => setInsetHeight(e.target.value)} disabled={!showInset} className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                        </div>
                    </details>

                </div>
            </div>

                    {/* AI Insights Engine UI */}
                    <section id="analysis" className="workbench-analysis workbench-card" aria-labelledby="workbench-analysis-title">
                        <div className="workbench-analysis-heading">
                            <div>
                                <span className="workbench-card-eyebrow">可选步骤</span>
                                <h2 id="workbench-analysis-title"><Sparkles size={20} /> 辅助解读 <span>Beta</span></h2>
                                <p>提取数据特征并生成文字分析，供实验核验时参考。</p>
                            </div>
                        </div>

                        <div className="relative z-10">
                            {dataInsights.status === 'idle' && (
                                <div className="workbench-analysis-idle">
                                    <GlassButton
                                        variant="primary"
                                        size="lg"
                                        onClick={generateAIReport}
                                        disabled={fileChunks1.length === 0}
                                        className="workbench-analysis-trigger"
                                    >
                                        <span className="flex items-center justify-center gap-2"><Sparkles size={16} /> 生成辅助分析</span>
                                    </GlassButton>
                                </div>
                            )}
                            {analysisError && <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{analysisError}</p>}

                            {dataInsights.status === 'analyzing' && (
                                <div className="flex flex-col items-center justify-center gap-4 py-8">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin"></div>
                                        <Sparkles size={16} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-400 animate-pulse" />
                                    </div>
                                    <p className="text-gray-300 font-medium tracking-wide animate-pulse">
                                        正在分析已提取的数据特征，请稍候...
                                    </p>
                                </div>
                            )}

                            {dataInsights.status === 'done' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Metrics Dashboard */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {dataType === 'GCD' ? (
                                            <>
                                                <div className="flex flex-col bg-gray-800/80 rounded-lg p-3 border border-gray-700/50">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] md:text-xs font-medium text-gray-400 flex items-center gap-1"><Battery size={12} className="text-emerald-400" /> 最大 X 值</span>
                                                    </div>
                                                    <div className="text-sm md:text-lg font-bold text-white flex items-end gap-1">
                                                        {dataInsights.maxCapacity}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col bg-gray-800/80 rounded-lg p-3 border border-gray-700/50">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] md:text-xs font-medium text-gray-400 flex items-center gap-1"><Activity size={12} className="text-orange-400" /> Y 值范围</span>
                                                    </div>
                                                    <div className="text-sm md:text-lg font-bold text-white truncate">
                                                        {dataInsights.voltageRange}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col bg-gray-800/80 rounded-lg p-3 border border-gray-700/50">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] md:text-xs font-medium text-gray-400 flex items-center gap-1"><RotateCw size={12} className="text-sky-400" /> 数据点数</span>
                                                    </div>
                                                    <div className="text-sm md:text-lg font-bold text-white flex items-end gap-1">
                                                        {fileChunks1.reduce((sum, chunk) => sum + chunk.x.length, 0)}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col bg-gray-800/80 rounded-lg p-3 border border-gray-700/50">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] md:text-xs font-medium text-gray-400 flex items-center gap-1"><ZapIcon size={12} className="text-yellow-400" /> 已加载文件块</span>
                                                    </div>
                                                    <div className="text-sm md:text-lg font-bold text-white">
                                                        {fileChunks1.length}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex flex-col bg-slate-800/80 rounded-xl p-4 border border-indigo-500/20 shadow-lg shadow-indigo-500/10 col-span-2 relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
                                                    <div className="flex justify-between items-center mb-2 relative z-10">
                                                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5"><Activity size={14} className="text-emerald-400" /> 初步特征摘要</span>
                                                    </div>
                                                    <div className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 relative z-10">
                                                        {dataInsights.primary || "等待解析..."}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col bg-slate-800/80 rounded-xl p-4 border border-purple-500/20 shadow-lg shadow-purple-500/10 col-span-2 relative overflow-hidden group mt-2">
                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
                                                    <div className="flex justify-between items-center mb-2 relative z-10">
                                                        <span className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5"><ZapIcon size={14} className="text-yellow-400" /> 证据范围与待核验项</span>
                                                    </div>
                                                    <div className="text-sm md:text-base font-medium text-gray-300 relative z-10 leading-relaxed">
                                                        {dataInsights.secondary || "等待特征解码..."}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* AI Summary Canvas */}
                                    <div className="h-full flex flex-col bg-gray-800/50 rounded-lg border border-purple-500/20 p-4">
                                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-purple-500/20">
                                            <div className="flex items-center gap-2">
                                                <Cpu size={14} className="text-purple-400" />
                                                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">AI Report</span>
                                            </div>
                                            <GlassButton
                                                variant="secondary"
                                                size="sm"
                                                onClick={generateAIReport}
                                                className="workbench-reanalyze group"
                                            >
                                                <RefreshCw size={12} className="text-indigo-300 group-hover:rotate-180 transition-transform duration-500" />
                                                <span>重新分析</span>
                                            </GlassButton>
                                        </div>
                                        <SafeReport text={dataInsights.report || ''} />
                                        <p className="mt-4 text-xs text-slate-400">辅助解读需结合原始曲线、实验条件和参考文献核验。</p>
                                    </div>

                                    {/* Conversation Input Box */}
                                    <div className="col-span-1 md:col-span-2 mt-4 flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                value={followUpText}
                                                onChange={(e) => setFollowUpText(e.target.value)}
                                                placeholder="补充实验背景或提出追问（例如：样品在 800°C 煅烧）"
                                                className="w-full bg-gray-800/50 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all pr-24"
                                            />
                                            <GlassButton
                                                variant="primary"
                                                size="sm"
                                                onClick={handleDeepAnalysis}
                                                disabled={isDeepAnalyzing || !followUpText.trim()}
                                                className="workbench-followup-send absolute right-2 top-1/2 -translate-y-1/2"
                                                aria-label={isDeepAnalyzing ? "分析中" : "发送追问"}
                                            >
                                                {isDeepAnalyzing ? "分析中..." : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>}
                                            </GlassButton>
                                        </div>
                                    </div>
                                    {/* Deep Analysis Result Container */}
                                    {deepAnalysisReport && (
                                        <div className="col-span-1 md:col-span-2 mt-4 h-full flex flex-col bg-gray-800/50 rounded-lg border border-indigo-500/20 p-4 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
                                            <div className="flex items-center gap-2 mb-2 relative z-10">
                                                <Activity size={14} className="text-indigo-400" />
                                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">追问结果</span>
                                            </div>
                                            <SafeReport text={deepAnalysisReport} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
                <TemplateStudio ref={templateStudioRef} active={workspace === "templates"} />
            </div>
        </main>
    );
}
