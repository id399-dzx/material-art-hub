"use client";

import { useState, useEffect, useRef } from "react";
import * as xlsx from "xlsx";
import ReactECharts from 'echarts-for-react';
import { UploadCloud, FileSpreadsheet, Box, Settings2, RefreshCw, Zap, FileText, Trash2, Sparkles, Activity, Battery, Cpu, RotateCw, ZapIcon } from "lucide-react";


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

const saveDataToDB = async (data: { x?: any[], y?: any[], chunks?: any[], stitchedInfo: any }) => {
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

const loadDataFromDB = async (): Promise<any> => {
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

// --- Simple Markdown Parser for UI ---
const parseMarkdown = (text: string) => {
    if (!text) return null;
    let html = text
        // Headers
        .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-indigo-300 mt-4 mb-2">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-indigo-400 mt-5 mb-3 border-b border-indigo-500/30 pb-2">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mt-6 mb-4">$1</h1>')
        // Bold
        .replace(/\*\*(.*)\*\*/gim, '<strong class="text-white font-bold">$1</strong>')
        // Italic
        .replace(/\*(.*)\*/gim, '<em class="text-indigo-200 italic">$1</em>')
        // Unordered lists
        .replace(/^\s*[-*+]\s+(.*)$/gim, '<li class="ml-4 list-disc marker:text-indigo-500 pl-1 mb-1">$1</li>')
        // Ordered lists
        .replace(/^\s*\d+\.\s+(.*)$/gim, '<li class="ml-4 list-decimal marker:text-purple-500 pl-1 mb-1">$1</li>')
        // Wrap lists in ul/ol (simplified logic)
        // Line breaks
        .replace(/\n$/gim, '<br />');

    // Wrap consecutive li elements with ul (a basic approach)
    html = html.replace(/(<li.*<\/li>)\n/gim, '$1');

    // Add spacing between paragraphs
    const paragraphs = html.split('\n\n').map(p => {
        if (p.trim() && !p.startsWith('<h') && !p.startsWith('<li')) {
            return `<p class="mb-3">${p}</p>`;
        }
        return p;
    }).join('\n');

    return paragraphs;
};

const autoDetectDataType = (xData: any[], yData: any[]) => {
    if (!xData || !yData || xData.length === 0) return 'GCD';

    let xMax = -Infinity, xMin = Infinity, yMax = -Infinity;
    for (let i = 0; i < xData.length; i++) {
        if (xData[i] > xMax) xMax = xData[i];
        if (xData[i] < xMin) xMin = xData[i];
        if (yData[i] > yMax) yMax = yData[i];
    }

    // 1. 波数特征 (Raman / FT-IR): X 轴极大
    if (xMax > 400 && xMax <= 4500 && xMin >= 0) return 'Raman'; // 这里统称 Raman/FT-IR
    // 2. 电池特征 (GCD): Y 轴通常为极其微小的电压 (0~5V 左右)
    if (yMax <= 10) return 'GCD';
    // 3. 衍射特征 (XRD): X 轴通常在 5~120度
    if (xMax <= 150 && xMin >= 0 && xMax > 15) return 'XRD';
    // 4. 能谱特征 (XPS): 结合能范围或者高强度的 CPS
    if (xMax > 150 && xMax <= 1500) return 'XPS';

    return 'GCD'; // 默认兜底
};
export default function DataProcessingPage() {
    const [dataType, setDataType] = useState<string>('GCD');
    const hasAutoDetectedRef = useRef<boolean>(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [fileChunks1, setFileChunks1] = useState<{ id: string, name: string, x: any[], y: any[] }[]>([]);
    const [stitchedInfo, setStitchedInfo] = useState<{ count: number, totalPoints: number } | null>(null);
    const [fileChunks2, setFileChunks2] = useState<{ id: string, name: string, x: any[], y: any[] }[]>([]);
    const [stitchedInfo2, setStitchedInfo2] = useState<{ count: number, totalPoints: number } | null>(null);
    const [fileName2, setFileName2] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lineWidth, setLineWidth] = useState<number>(2);
    const [fontFamily, setFontFamily] = useState<string>("Times New Roman");
    const [titleSize, setTitleSize] = useState<number>(16);
    const [labelSize, setLabelSize] = useState<number>(14);
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
    const [insetTotalX, setInsetTotalX] = useState<any[]>([]);
    const [insetTotalY, setInsetTotalY] = useState<any[]>([]);
    const [insetFontSize, setInsetFontSize] = useState<string>('10');
    const [showInsetAxisName, setShowInsetAxisName] = useState<boolean>(false);
    const [insetXAxisName, setInsetXAxisName] = useState<string>('X-axis');
    const [insetYAxisName, setInsetYAxisName] = useState<string>('Y-axis');
    const [insetXSplit, setInsetXSplit] = useState<string>('');
    const [insetYSplit, setInsetYSplit] = useState<string>('');

    // Custom Templates System
    const [customTemplates, setCustomTemplates] = useState<any[]>([]);
    const [newTemplateName, setNewTemplateName] = useState<string>("");

    // Isolation State for Performance (Only update chart on explicit apply)
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [appliedOptions, setAppliedOptions] = useState<any>(null);

    // AI Data Insights State
    const [dataInsights, setDataInsights] = useState<{ maxCapacity: string, voltageRange: string, estimatedCycles: string, voltageHysteresis: string, status: 'idle' | 'analyzing' | 'done', report: string, primary: string, secondary: string }>({
        maxCapacity: '-',
        voltageRange: '-',
        estimatedCycles: '-',
        voltageHysteresis: '-',
        status: 'idle',
        report: '',
        primary: '',
        secondary: ''
    });

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
                if (cachedData.chunks) {
                    setFileChunks1(cachedData.chunks);
                } else if (cachedData.x && cachedData.y) {
                    setFileChunks1([{ id: 'cached', name: '缓存数据', x: cachedData.x, y: cachedData.y }]);
                }
                setStitchedInfo(cachedData.stitchedInfo);
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
        };
        initData();
    }, []);

    useEffect(() => {
        if (dataType === 'XRD') {
            setXAxisName('2 Theta (degree)');
            setYAxisName('Intensity (a.u.)');
        } else if (dataType === 'XPS') {
            setXAxisName('Binding Energy (eV)');
            setYAxisName('Intensity (a.u.)');
        } else if (dataType === 'Raman' || dataType === 'FT-IR') {
            setXAxisName('Wavenumber (cm⁻¹)');
            setYAxisName('Intensity (a.u.)');
        } else if (dataType === 'GCD') {
            setXAxisName('Capacity');
            setYAxisName('Voltage (V)');
        }
    }, [dataType]);

    const handleApplyTemplate = (p: any) => {
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

        // Force an immediate refresh
        setTimeout(() => {
            const btn = document.getElementById('refresh-chart-btn');
            if (btn) btn.click();
        }, 50);
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
        hasAutoDetectedRef.current = false; // 重置嗅探锁
        setFileChunks1([]);
        setStitchedInfo(null);
        setFileName(null);
        setFileChunks2([]);
        setStitchedInfo2(null);
        setFileName2(null);
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

        setFileName(files.length === 1 ? files[0].name : `已选中 ${files.length} 个文件`);
        setError(null);
        setStitchedInfo(null);
        setIsLoading(true);

        setTimeout(async () => {
            try {
                const newChunks: { id: string, name: string, x: any[], y: any[] }[] = [];
                for (const file of files) {
                    const data = await parseExcelFile(file);
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

                setFileChunks1(prev => {
                    const updated = [...prev, ...newChunks];
                    const count = updated.length;
                    const totalPoints = updated.reduce((acc, chunk) => acc + chunk.x.length, 0);

                    saveDataToDB({ chunks: updated, stitchedInfo: { count, totalPoints } });
                    setStitchedInfo({ count, totalPoints });

                    return updated;
                });

                setIsLoading(false);

                // Clear the file input so the same files can be selected again
                const fileInput = document.getElementById('data-upload') as HTMLInputElement;
                if (fileInput) fileInput.value = '';

            } catch (err: any) {
                console.error("Error parsing files:", err);
                setError(`解析或拼接失败: ${err.message || "文件格式不受支持"}`);
                setFileChunks1([]);
                setStitchedInfo(null);
                setIsLoading(false);
            }
        }, 50); // Give UI time to render loading state
    };

    const handleFileUpload2 = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Sort files by name to ensure sequential stitching
        files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        setFileName2(files.length === 1 ? files[0].name : `已选中 ${files.length} 个文件`);
        setError(null);
        setStitchedInfo2(null);
        setIsLoading(true);

        setTimeout(async () => {
            try {
                const newChunks: { id: string, name: string, x: any[], y: any[] }[] = [];
                for (const file of files) {
                    const data = await parseExcelFile(file);
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
                    const count = updated.length;
                    const totalPoints = updated.reduce((acc, chunk) => acc + chunk.x.length, 0);
                    setStitchedInfo2({ count, totalPoints });
                    return updated;
                });

                setIsLoading(false);

                const fileInput = document.getElementById('data-upload-2') as HTMLInputElement;
                if (fileInput) fileInput.value = '';

            } catch (err: any) {
                console.error("Error parsing files 2:", err);
                setError(`解析对比样失败: ${err.message || "文件格式不受支持"}`);
                setFileChunks2([]);
                setStitchedInfo2(null);
                setIsLoading(false);
            }
        }, 50);
    };

    const handleRemoveChunk1 = (id: string) => {
        setFileChunks1(prev => {
            const updated = prev.filter(chunk => chunk.id !== id);
            const count = updated.length;
            const totalPoints = updated.reduce((acc, chunk) => acc + chunk.x.length, 0);
            saveDataToDB({ chunks: updated, stitchedInfo: { count, totalPoints } });
            setStitchedInfo({ count, totalPoints });
            if (updated.length === 0) {
                setFileName(null);
                setAppliedOptions(null);
            }
            return updated;
        });
    };

    const handleRemoveChunk2 = (id: string) => {
        setFileChunks2(prev => {
            const updated = prev.filter(chunk => chunk.id !== id);
            const count = updated.length;
            const totalPoints = updated.reduce((acc, chunk) => acc + chunk.x.length, 0);
            setStitchedInfo2({ count, totalPoints });
            if (updated.length === 0) setFileName2(null);
            return updated;
        });
    };

    const handleInsetFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Sort files by name to ensure sequential stitching
        files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        setIsLoading(true);

        setTimeout(async () => {
            try {
                let totalX: any[] = [];
                let totalY: any[] = [];

                for (const file of files) {
                    const data = await parseExcelFile(file);
                    totalX = [...totalX, ...data.x];
                    totalY = [...totalY, ...data.y];
                }

                setInsetTotalX(totalX);
                setInsetTotalY(totalY);
                setIsLoading(false);

                const fileInput = document.getElementById('inset-upload') as HTMLInputElement;
                if (fileInput) fileInput.value = '';

            } catch (err: any) {
                console.error("Error parsing inset files:", err);
                setIsLoading(false);
            }
        }, 50);
    };

    const handleDeepAnalysis = async () => {
        if (!followUpText.trim()) return;
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
            setDeepAnalysisReport(data.report || "深度探讨完成，暂无详细内容。");
        } catch (error) {
            console.error("深度分析失败:", error);
            setDeepAnalysisReport("调用大模型失败，请检查网络。");
        } finally {
            setIsDeepAnalyzing(false);
            setFollowUpText(""); // 提问完清空输入框
        }
    };

    // Helper to parse individual Excel files wrapped in a Promise
    const parseExcelFile = (file: File): Promise<{ x: any[], y: any[] }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const bstr = evt.target?.result;
                    const workbook = xlsx.read(bstr, { type: "binary" });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = xlsx.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

                    if (jsonData.length < 2) {
                        return reject(new Error(`文件 ${file.name} 中至少需要包含两行/两列数据。`));
                    }

                    let xData: any[] = [];
                    let yData: any[] = [];

                    const firstRow = jsonData[0];
                    const secondRow = jsonData[1];

                    xData = firstRow.filter((val: any) => val !== undefined && val !== null && val !== "");
                    yData = secondRow.filter((val: any) => val !== undefined && val !== null && val !== "");

                    if (jsonData.length > 5 && xData.length <= 2) {
                        xData = [];
                        yData = [];
                        for (let i = 0; i < jsonData.length; i++) {
                            const row = jsonData[i];
                            if (row[0] !== undefined) xData.push(row[0]);
                            if (row[1] !== undefined) yData.push(row[1]);
                        }
                    }

                    resolve({ x: xData, y: yData });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsBinaryString(file);
        });
    };

    const generateOption = () => {
        if (fileChunks1.length === 0) return {};

        const totalX1 = fileChunks1.flatMap(chunk => chunk.x);
        const totalY1 = fileChunks1.flatMap(chunk => chunk.y);
        const totalX2 = fileChunks2.flatMap(chunk => chunk.x);
        const totalY2 = fileChunks2.flatMap(chunk => chunk.y);

        const axisLineWidth = Number(lineWidth) || 2;
        const majorTickLength = 8;
        const minorTickLength = 4;

        // Combine into [x, y] pairs, casting to Number to force ECharts to use value axis
        const seriesData = totalX1.map((xVal, index) => [Number(xVal), Number(totalY1[index])]);

        const activeInsetX = useMainDataForInset ? totalX1 : insetTotalX;
        const activeInsetY = useMainDataForInset ? totalY1 : insetTotalY;
        const insetSeriesData = activeInsetX.map((xVal, idx) => [Number(xVal), Number(activeInsetY[idx])]);

        const parseGridValue = (val: string | number | undefined) => {
            if (!val) return undefined;
            const strVal = String(val).trim();
            // 如果包含 %，直接作为字符串返回；否则转换为纯数字（绝对像素）
            return strVal.includes('%') ? strVal : Number(strVal);
        };

        const baseGrid: any = {
            show: true,
            borderWidth: 1.5,
            borderColor: '#111', // Dark border for scientific style
            top: '12%',
            right: '8%',
            bottom: '15%',
            left: '15%',
        };

        const baseXAxis: any = {
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

        const baseYAxis: any = {
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

        const baseSeries: any = {
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
            toolbox: {
                feature: {
                    saveAsImage: {
                        pixelRatio: 4,
                        name: fileName ? `Processed_${fileName.split('.')[0]}` : '科研图表',
                        title: '保存为超清 PNG'
                    }
                },
                iconStyle: {
                    borderColor: '#333'
                }
            },
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
                    fileChunks2.length > 0 ? { ...baseSeries, xAxisIndex: 0, yAxisIndex: 0, name: seriesName2, data: totalX2.map((val: any, idx: number) => [Number(val), Number(totalY2[idx])]), itemStyle: { color: lineColor2 }, lineStyle: { width: lineWidth, color: lineColor2 } } : null
                ].filter(Boolean);

                if (!showInset) return mainSeries;

                const baseInsetSeries1 = { ...baseSeries, xAxisIndex: 1, yAxisIndex: 1, zlevel: 1, data: insetSeriesData };

                const insetSeries = useMainDataForInset ? [
                    baseInsetSeries1,
                    fileChunks2.length > 0 ? { ...baseSeries, xAxisIndex: 1, yAxisIndex: 1, zlevel: 1, name: seriesName2, data: totalX2.map((val: any, idx: number) => [Number(val), Number(totalY2[idx])]), itemStyle: { color: lineColor2 }, lineStyle: { width: lineWidth, color: lineColor2 } } : null
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
        const xData = fileChunks1.flatMap((c: any) => c.x).map(Number);
        const yData = fileChunks1.flatMap((c: any) => c.y).map(Number);
        if (xData.length === 0) return;
        setDataInsights(prev => ({ ...prev, status: 'analyzing' }));

        // 信任 React 状态 dataType，不再强制覆盖
        let payload: any = { dataType: dataType, dataPointsCount: xData.length, maxCapacity: '-', voltageRange: '-', topPeaks: '' };
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
            payload.maxCapacity = maxCap;
            payload.voltageRange = `${vMin} - ${vMax}`;
            setDataInsights(prev => ({ ...prev, maxCapacity: maxCap, voltageRange: payload.voltageRange }));
        } else {
            // 学术级宽域寻峰 (Prominent Peaks)
            let localPeaks: any[] = [];
            // 放弃平均值基线，改用底噪宽容度（仅排除极低数据）
            const sortedY = [...yData].sort((a, b) => a - b);
            const baseline = sortedY[Math.floor(sortedY.length * 0.1)]; // 底部10%视为基线
            const noiseThreshold = baseline + (sortedY[sortedY.length - 1] - baseline) * 0.03; // 高于基线3%才算峰
            // 采用 5点窗 (前后各看2个点) 避免把单侧毛刺当成峰
            for (let i = 2; i < xData.length - 2; i++) {
                const y = yData[i];
                if (y > yData[i - 1] && y > yData[i + 1] &&
                    y > yData[i - 2] && y > yData[i + 2] &&
                    y > noiseThreshold) {
                    localPeaks.push({ x: xData[i], y: y });
                }
            }

            // 按强度降序，对于 XRD/XPS 至少抓取前 12 个强峰提供给大模型
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
            setDataInsights(prev => ({ ...prev, status: 'done', report: data.report || "分析完成，暂无详细报告。", primary: data.primary || "", secondary: data.secondary || "" }));
        } catch (error: any) {
            console.error("AI 分析抛出异常:", error);
            setDataInsights(prev => ({
                ...prev,
                status: 'done',
                report: `<span style="color:#ff4d4f; font-weight:bold;">[系统连接诊断报告]</span>\n\n数据链路上报阻断：${error.message}\n\n建议排查路径：\n1. 检查环境变量 \`DEEPSEEK_API_KEY\` 是否已成功注入。\n2. 检查账户余额或当前 API 并发限流限制。`,
                primary: "获取失败",
                secondary: "诊断异常"
            }));
        }
    };

    // 1. 专门处理数据嗅探的 Effect (绝对安全：仅在全新数据导入时执行一次)
    useEffect(() => {
        if (fileChunks1.length === 0) {
            setDataInsights({ maxCapacity: '-', voltageRange: '-', estimatedCycles: '-', voltageHysteresis: '-', status: 'idle', report: '', primary: '', secondary: '' });
            hasAutoDetectedRef.current = false; // 数据被清空时，允许下次重新嗅探
        } else if (!hasAutoDetectedRef.current) {
            // 仅在当前批次首次有数据时嗅探一次
            const xData = fileChunks1.flatMap((c: any) => c.x).map(Number);
            const yData = fileChunks1.flatMap((c: any) => c.y).map(Number);
            if (xData.length > 0) {
                const detectedType = autoDetectDataType(xData, yData);
                setDataType(detectedType);
                hasAutoDetectedRef.current = true; // 上锁！防止后续上传对比样时被篡改
            }
        }
    }, [fileChunks1]);

    // 2. 专门处理数据或参数变动时，自动刷新图表的 Effect
    useEffect(() => {
        if (fileChunks1.length > 0) {
            // 给 React 状态更新一点缓冲时间，防止拿到旧数据
            const timer = setTimeout(() => {
                handleRefreshChart();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [fileChunks1, fileChunks2]);

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-gray-200 font-sans p-6 md:p-10 flex flex-col items-center">

            <div className="max-w-4xl w-full flex flex-col items-center mb-10">
                <Box size={48} className="text-indigo-600 mb-4 drop-shadow-sm" />
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">GCD 科研数据处理中心</h1>
                <p className="text-gray-400 text-center max-w-2xl">
                    上传 .xlsx / .csv 文件，系统将自动读取前两行列作为 X 轴与 Y 轴数据，并生成符合顶级期刊发表标准的矢量图表。
                </p>
            </div>

            <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-8 items-start">
                {/* Left Panel: Upload and Params Accordions */}
                <div
                    className="flex flex-col gap-4"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleRefreshChart();
                        }
                    }}
                >

                    {/* Accordion 1: Data & Presets */}
                    <details open className="group bg-gray-800 rounded-2xl shadow-2xl shadow-black/50 border border-gray-700 overflow-hidden transition-all duration-300">
                        <summary className="cursor-pointer list-none flex items-center gap-2 p-4 bg-gray-900 hover:bg-gray-700 outline-none select-none font-semibold text-gray-200 transition-colors border-b border-gray-600">
                            <FileSpreadsheet size={20} className="text-indigo-500" />
                            📁 数据源与模板
                        </summary>
                        <div className="p-4 pt-4 flex flex-col gap-6 bg-gray-800">
                            <div className="flex flex-col gap-2 bg-gray-900/50 p-4 rounded-xl border border-indigo-500/30">
                                <label className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                                    🔬 当前分析数据类型 (Data Modality)
                                </label>
                                <select
                                    value={dataType}
                                    onChange={(e) => setDataType(e.target.value)}
                                    className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                >
                                    <option value="GCD">GCD (恒电流充放电)</option>
                                    <option value="XRD">XRD (X射线衍射)</option>
                                    <option value="XPS">XPS (X射线光电子能谱)</option>
                                    <option value="Raman">Raman (拉曼光谱)</option>
                                    <option value="FT-IR">FT-IR (傅里叶红外光谱)</option>
                                </select>
                            </div>
                            {/* Fancy Upload Box */}
                            <div
                                onClick={() => document.getElementById("data-upload")?.click()}
                                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 bg-gray-900 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group/upload"
                            >
                                <input
                                    id="data-upload"
                                    type="file"
                                    multiple
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                <UploadCloud size={36} className="text-slate-400 group-hover/upload:text-indigo-500 transition-colors mb-4" />
                                <p className="text-sm font-medium text-gray-400 group-hover/upload:text-slate-700 mb-1">
                                    {fileName ? fileName : "点击或拖拽多个 Excel / CSV 文件 (主数据)"}
                                </p>
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
                                                    <span className="text-[10px] text-gray-500 leading-tight">{chunk.x.length.toLocaleString()} pts</span>
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

                            {/* Control Sample Upload Box */}
                            <div
                                onClick={() => document.getElementById("data-upload-2")?.click()}
                                className="border-2 border-dashed border-red-900/50 hover:border-red-500 hover:bg-red-900/10 bg-gray-900 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group/upload"
                            >
                                <input
                                    id="data-upload-2"
                                    type="file"
                                    multiple
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileUpload2}
                                    className="hidden"
                                />
                                <UploadCloud size={28} className="text-red-900/50 group-hover/upload:text-red-500 transition-colors mb-2" />
                                <p className="text-xs font-medium text-gray-400 group-hover/upload:text-slate-700 mb-1">
                                    {fileName2 ? fileName2 : "上传对比样数据 (Control)"}
                                </p>
                            </div>

                            {/* Chunks List 2 */}
                            {fileChunks2.length > 0 && (
                                <div className="bg-gray-900/50 rounded-lg p-2 mt-2 space-y-1">
                                    {fileChunks2.map((chunk) => (
                                        <div key={chunk.id} className="flex items-center justify-between bg-gray-800/80 border border-gray-700/50 rounded-md py-2 px-3 hover:bg-gray-700 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <FileText size={14} className="text-red-400" />
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-gray-200 font-medium truncate max-w-[180px] leading-tight">{chunk.name}</span>
                                                    <span className="text-[10px] text-gray-500 leading-tight">{chunk.x.length.toLocaleString()} pts</span>
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
                                <button
                                    onClick={handleClearData}
                                    className="w-full mt-2 py-2 rounded-lg font-bold flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white transition-all shadow-md"
                                >
                                    🗑️ 清空 / 重置数据
                                </button>
                            )}

                            {/* Template Library */}
                            <div className="border border-gray-700 rounded-xl p-5 bg-gray-900/50 space-y-5">
                                <h3 className="text-white font-bold flex items-center gap-2">
                                    <Zap size={16} className="text-indigo-400" />
                                    排版模板库 (Template Library)
                                </h3>

                                {/* System Presets */}
                                <div className="space-y-2">
                                    <p className="text-xs text-gray-400">系统内置</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <button onClick={() => handleApplyTemplate(PRESETS.nature)} className="bg-gray-800 border border-gray-600 hover:border-indigo-400 hover:bg-gray-700 text-gray-300 text-xs py-2 px-3 rounded-lg transition-all flex flex-col items-start gap-1">
                                            <span className="font-bold text-white">A. 经典出版级</span>
                                            <span className="text-[10px] text-gray-400">Nature/Science</span>
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
                                    <button
                                        onClick={handleSaveTemplate}
                                        disabled={!newTemplateName.trim()}
                                        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs font-bold py-2 px-3 rounded-lg transition-all"
                                    >
                                        💾 保存当前为模板
                                    </button>
                                </div>
                            </div>
                        </div>
                    </details>

                    {/* Accordion 2: Size Settings */}
                    <details className="group bg-gray-800 rounded-2xl shadow-2xl shadow-black/50 border border-gray-700 overflow-hidden transition-all duration-300">
                        <summary className="cursor-pointer list-none flex items-center gap-2 p-4 bg-gray-900 hover:bg-gray-700 outline-none select-none font-semibold text-gray-200 transition-colors border-b border-gray-600/50 group-open:border-gray-100">
                            <Settings2 size={20} className="text-indigo-400" />
                            🖼️ 图表尺寸设定
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
                    <details className="group bg-gray-800 rounded-2xl shadow-2xl shadow-black/50 border border-gray-700 overflow-hidden transition-all duration-300">
                        <summary className="cursor-pointer list-none flex items-center gap-2 p-4 bg-gray-900 hover:bg-gray-700 outline-none select-none font-semibold text-gray-200 transition-colors border-b border-gray-600/50 group-open:border-gray-100">
                            <Settings2 size={20} className="text-emerald-400" />
                            坐标轴控制
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
                                    <option value="false">☐ 固定底部边框 (科研规范)</option>
                                    <option value="true">☑️ 吸附 Y=0 刻度 (十字交叉)</option>
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
                    <details className="group bg-gray-800 rounded-2xl shadow-2xl shadow-black/50 border border-gray-700 overflow-hidden transition-all duration-300">
                        <summary className="cursor-pointer list-none flex items-center gap-2 p-4 bg-gray-900 hover:bg-gray-700 outline-none select-none font-semibold text-gray-200 transition-colors border-b border-gray-600/50 group-open:border-gray-100">
                            <Settings2 size={20} className="text-pink-400" />
                            数据与外观
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
                    <details className="group bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                        <summary className="cursor-pointer list-none flex items-center gap-2 p-4 hover:bg-gray-800 outline-none select-none font-semibold text-gray-200 transition-colors border-b border-gray-700 group-open:border-gray-600">
                            🔍 局部放大图 (Inset Chart)
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
                                    <div
                                        onClick={() => document.getElementById("inset-upload")?.click()}
                                        className="border border-dashed border-gray-600 hover:border-blue-500 bg-gray-800 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all duration-300"
                                    >
                                        <input
                                            id="inset-upload"
                                            type="file"
                                            multiple
                                            accept=".xlsx, .xls, .csv"
                                            onChange={handleInsetFileUpload}
                                            className="hidden"
                                        />
                                        <p className="text-sm font-medium text-gray-400 mb-1">
                                            {insetTotalX.length > 0 ? `已加载独立点数: ${insetTotalX.length}` : "点击此处上传附图独立数据文件 (.xlsx, .csv)"}
                                        </p>
                                    </div>
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

                    <button
                        id="refresh-chart-btn"
                        onClick={handleRefreshChart}
                        disabled={fileChunks1.length === 0}
                        className={`w-full mt-2 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${fileChunks1.length === 0
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]'
                            }`}
                    >
                        <RefreshCw size={18} className={fileChunks1.length > 0 ? "hover:rotate-180 transition-transform duration-500" : ""} />
                        注入参数并刷新绘图
                    </button>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl">
                            {error}
                        </div>
                    )}
                </div> {/* End of Left Panel */}

                {/* Right Panel: Data Preview */}
                <div className="sticky top-4 self-start bg-gray-800 rounded-2xl p-6 shadow-2xl shadow-black/50 border border-gray-700 flex flex-col gap-6 overflow-hidden">
                    <h2 className="text-lg font-bold text-white flex items-center justify-between border-b border-gray-700 pb-4">
                        <div className="flex items-center gap-2">
                            预览验证
                        </div>
                        {stitchedInfo && (
                            <span className="text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20">
                                ✅ 当前已累计加载 {stitchedInfo.totalPoints.toLocaleString()} 个数据点 (共 {stitchedInfo.count} 个文件块)
                            </span>
                        )}
                    </h2>

                    <div className="flex-1 w-full h-full bg-gray-900/80 rounded-xl border border-gray-700 relative flex items-center justify-center overflow-hidden min-h-[400px]">
                        {isLoading ? (
                            <div className="text-gray-400 flex flex-col items-center gap-4">
                                <RefreshCw size={40} className="animate-spin opacity-40 text-indigo-400" />
                                <p className="text-indigo-400 font-medium tracking-wide">🚀 正在降采样与解析海量数据，请稍候...</p>
                            </div>
                        ) : fileChunks1.length === 0 || !appliedOptions ? (
                            <div className="text-gray-400 flex flex-col items-center gap-4">
                                <Box size={40} className="opacity-40" />
                                <p>尚未导入数据，暂无图表生成</p>
                            </div>
                        ) : (
                            <div className="w-full h-full p-2 flex items-center justify-center overflow-auto">
                                <ReactECharts
                                    option={appliedOptions}
                                    style={{ height: `${chartHeight}px`, width: `${chartWidth}px` }}
                                    opts={{ renderer: 'canvas' }}
                                    notMerge={true}
                                />
                            </div>
                        )}
                    </div>

                    {/* AI Insights Engine UI */}
                    <div className="w-full relative overflow-hidden rounded-xl border border-indigo-500/30 bg-gray-900/80 p-5 mt-2 shadow-[0_0_20px_rgba(79,70,229,0.15)] group">
                        {/* Glowing Background Effect */}
                        <div className="absolute top-0 right-0 -m-8 w-32 h-32 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/30 transition-all duration-700"></div>
                        <div className="absolute bottom-0 left-0 -m-8 w-24 h-24 bg-purple-600/20 rounded-full blur-2xl pointer-events-none"></div>

                        <h3 className="text-white font-bold flex items-center gap-2 mb-4 border-b border-indigo-500/30 pb-3 relative z-10">
                            <Sparkles size={18} className="text-indigo-400" />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                                ✨ AI 电化学性能自动评估 (Beta)
                            </span>
                        </h3>

                        <div className="relative z-10">
                            {dataInsights.status === 'idle' && (
                                <div className="flex justify-center py-6">
                                    <button
                                        onClick={generateAIReport}
                                        disabled={fileChunks1.length === 0}
                                        className="relative overflow-hidden group px-8 py-3 rounded-xl font-bold text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800"
                                    >
                                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-80 group-hover:opacity-100 bg-[length:200%_auto] animate-gradient-xy transition-opacity"></div>
                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                            🚀 一键提取特征并生成顶刊级分析报告
                                        </span>
                                    </button>
                                </div>
                            )}

                            {dataInsights.status === 'analyzing' && (
                                <div className="flex flex-col items-center justify-center gap-4 py-8">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin"></div>
                                        <Sparkles size={16} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-400 animate-pulse" />
                                    </div>
                                    <p className="text-gray-300 font-medium tracking-wide animate-pulse">
                                        🧠 专家模型正在结合 <span className="text-indigo-400 font-bold">{dataType === 'GCD' ? '电化学体系' : '光谱与结晶学特质'}</span> 进行深度特征解码，请稍候...
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
                                                        <span className="text-[10px] md:text-xs font-medium text-gray-400 flex items-center gap-1"><Battery size={12} className="text-emerald-400" /> 最大比容量</span>
                                                    </div>
                                                    <div className="text-sm md:text-lg font-bold text-white flex items-end gap-1">
                                                        {dataInsights.maxCapacity} <span className="text-[10px] md:text-xs font-normal text-gray-500 mb-1">mAh/g</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col bg-gray-800/80 rounded-lg p-3 border border-gray-700/50">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] md:text-xs font-medium text-gray-400 flex items-center gap-1"><Activity size={12} className="text-orange-400" /> 工作电压窗口</span>
                                                    </div>
                                                    <div className="text-sm md:text-lg font-bold text-white truncate">
                                                        {dataInsights.voltageRange}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col bg-gray-800/80 rounded-lg p-3 border border-gray-700/50">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] md:text-xs font-medium text-gray-400 flex items-center gap-1"><RotateCw size={12} className="text-sky-400" /> 估算循环圈数</span>
                                                    </div>
                                                    <div className="text-sm md:text-lg font-bold text-white flex items-end gap-1">
                                                        {dataInsights.estimatedCycles} <span className="text-[10px] md:text-xs font-normal text-gray-500 mb-1">Cycles</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col bg-gray-800/80 rounded-lg p-3 border border-gray-700/50">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] md:text-xs font-medium text-gray-400 flex items-center gap-1"><ZapIcon size={12} className="text-yellow-400" /> 极化压差估算</span>
                                                    </div>
                                                    <div className="text-sm md:text-lg font-bold text-white">
                                                        {dataInsights.voltageHysteresis}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex flex-col bg-slate-800/80 rounded-xl p-4 border border-indigo-500/20 shadow-lg shadow-indigo-500/10 col-span-2 relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
                                                    <div className="flex justify-between items-center mb-2 relative z-10">
                                                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5"><Activity size={14} className="text-emerald-400" /> 核心定性解析 (Primary Insight)</span>
                                                    </div>
                                                    <div className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 relative z-10">
                                                        {dataInsights.primary || "等待解析..."}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col bg-slate-800/80 rounded-xl p-4 border border-purple-500/20 shadow-lg shadow-purple-500/10 col-span-2 relative overflow-hidden group mt-2">
                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
                                                    <div className="flex justify-between items-center mb-2 relative z-10">
                                                        <span className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5"><ZapIcon size={14} className="text-yellow-400" /> 深度属性拓扑 (Secondary Insight)</span>
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
                                            <button
                                                onClick={generateAIReport}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/30 rounded-md transition-all group"
                                            >
                                                <RefreshCw size={12} className="text-indigo-300 group-hover:rotate-180 transition-transform duration-500" />
                                                <span>重新分析</span>
                                            </button>
                                        </div>
                                        <div
                                            className="leading-relaxed text-gray-300 text-sm markdown-body"
                                            dangerouslySetInnerHTML={{ __html: parseMarkdown(dataInsights.report || '') || '' }}
                                        />
                                    </div>

                                    {/* Conversation Input Box */}
                                    <div className="col-span-1 md:col-span-2 mt-4 flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                value={followUpText}
                                                onChange={(e) => setFollowUpText(e.target.value)}
                                                placeholder="补充实验背景或追问专家 (例如：该样品是在 800°C 煅烧的...)"
                                                className="w-full bg-gray-800/50 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all pr-24"
                                            />
                                            <button
                                                onClick={handleDeepAnalysis}
                                                disabled={isDeepAnalyzing || !followUpText.trim()}
                                                className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-white font-medium text-xs transition-colors ${isDeepAnalyzing || !followUpText.trim() ? 'bg-gray-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                                            >
                                                {isDeepAnalyzing ? "分析中..." : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>}
                                            </button>
                                        </div>
                                    </div>
                                    {/* Deep Analysis Result Container */}
                                    {deepAnalysisReport && (
                                        <div className="col-span-1 md:col-span-2 mt-4 h-full flex flex-col bg-gray-800/50 rounded-lg border border-indigo-500/20 p-4 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
                                            <div className="flex items-center gap-2 mb-2 relative z-10">
                                                <Activity size={14} className="text-indigo-400" />
                                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">深度探讨回执 (Deep Dive)</span>
                                            </div>
                                            <div
                                                className="leading-relaxed text-gray-300 text-sm markdown-body relative z-10"
                                                dangerouslySetInnerHTML={{ __html: parseMarkdown(deepAnalysisReport) || '' }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
