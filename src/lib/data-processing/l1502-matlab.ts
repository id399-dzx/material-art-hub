export type L1502MatlabScript = {
    name: string;
    path: string;
    role: "plot" | "helper";
    lines: number;
    bytes: number;
    sha256: string;
    dataFiles: string[];
    externalFunctions: string[];
};

export type L1502MatlabManifest = {
    issue: number;
    folder: string;
    scripts: L1502MatlabScript[];
};

export function l1502MatlabMetadataPath(issue: number): string {
    if (!Number.isInteger(issue) || issue < 1 || issue > 139) throw new Error("未找到这一期的 MATLAB 源码。");
    return `/l1502-matlab/${String(issue).padStart(3, "0")}/metadata.json`;
}

export function readL1502MatlabManifest(value: unknown, issue: number): L1502MatlabManifest {
    const base = l1502MatlabMetadataPath(issue).replace(/metadata\.json$/, "");
    if (!value || typeof value !== "object") throw new Error("源码信息格式错误，请稍后重试。");
    const candidate = value as Partial<L1502MatlabManifest>;
    if (candidate.issue !== issue || typeof candidate.folder !== "string" || !Array.isArray(candidate.scripts) || candidate.scripts.length === 0) {
        throw new Error("源码与当前图例不匹配，请稍后重试。");
    }
    const names = new Set<string>();
    for (const script of candidate.scripts) {
        if (!script || typeof script !== "object" || typeof script.name !== "string" || !/^[A-Za-z0-9_]+\.m$/.test(script.name) ||
            script.path !== `${base}${script.name}` || names.has(script.name) || !["plot", "helper"].includes(script.role) ||
            !Number.isInteger(script.lines) || script.lines < 1 || !Number.isInteger(script.bytes) || script.bytes < 1 ||
            typeof script.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(script.sha256) ||
            !Array.isArray(script.dataFiles) || !script.dataFiles.every(name => typeof name === "string") ||
            !Array.isArray(script.externalFunctions) || !script.externalFunctions.every(name => typeof name === "string")) {
            throw new Error("源码信息不完整，请稍后重试。");
        }
        names.add(script.name);
    }
    return candidate as L1502MatlabManifest;
}
