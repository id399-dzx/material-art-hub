export type ManuscriptOptions = {
    paper: "A4" | "Letter";
    font: "Times New Roman" | "Arial" | "Calibri";
    fontSize: number;
    lineSpacing: 1 | 1.5 | 2;
    marginCm: number;
    lineNumbers: boolean;
    pageNumbers: boolean;
    singleColumn: boolean;
    preserveLandscape: boolean;
};

export type JournalPreset = {
    id: string;
    name: string;
    publisher: string;
    field: "综合科研" | "材料与能源" | "生命科学";
    monogram: string;
    accent: string;
    policy: "灵活初次投稿" | "有明确版式要求";
    summary: string;
    officialRequirements: string[];
    manualChecks: string[];
    sourceUrl: string;
    sourceTitle: string;
    templateUrl?: string;
    checkedOn: string;
    options: ManuscriptOptions;
};

const readable: ManuscriptOptions = { paper: "A4", font: "Times New Roman", fontSize: 12, lineSpacing: 1.5, marginCm: 2.54, lineNumbers: false, pageNumbers: true, singleColumn: true, preserveLandscape: true };
const checkedOn = "2026-10-03";

/** Official requirements and editable workbench defaults are deliberately separate. */
export const JOURNAL_PRESETS: JournalPreset[] = [
    {
        id: "nature", name: "Nature", publisher: "Nature Portfolio", field: "综合科研", monogram: "N", accent: "rose", policy: "灵活初次投稿",
        summary: "适合跨学科研究的初次投稿整理。官方接受灵活格式，Word 的行号也可由投稿系统生成。",
        officialRequirements: ["初次投稿允许灵活格式；可以将文字与图表合并提交。", "图与对应图注应放在同一页；参考文献列表需包含文章标题。"],
        manualChecks: ["核对文章类型、标题和篇幅限制。", "检查每幅图与图注是否位于同一页，并核对文献标题。"],
        sourceUrl: "https://www.nature.com/nature/for-authors/initial-submission", sourceTitle: "Nature · Initial submission", checkedOn, options: { ...readable },
    },
    {
        id: "nature-communications", name: "Nature Communications", publisher: "Nature Portfolio", field: "综合科研", monogram: "NC", accent: "blue", policy: "灵活初次投稿",
        summary: "将原稿整理为可读的审稿 Word。初次投稿的视觉版式较灵活，正式出版版式由期刊制作。",
        officialRequirements: ["初次投稿可将正文和图合并为一个文件，大小不超过 30 MB。", "补充信息单独提交；期刊出版版式在制作阶段统一。"],
        manualChecks: ["核对摘要、文章类型、图注和数据可用性声明。", "若期刊要求表格移至文末，请在 Word 中确认位置；本工具保持原稿顺序。"],
        sourceUrl: "https://www.nature.com/ncomms/submit/how-to-submit", sourceTitle: "Nature Communications · How to submit", checkedOn, options: { ...readable },
    },
    {
        id: "scientific-reports", name: "Scientific Reports", publisher: "Nature Portfolio", field: "综合科研", monogram: "SR", accent: "cyan", policy: "有明确版式要求",
        summary: "提供单栏、左对齐的审稿版式。官网对返修稿明确要求单栏、非两端对齐及页码。",
        officialRequirements: ["返修稿正文为单栏，不使用两端对齐；页脚使用阿拉伯数字页码。", "初次投稿可合并文字和图，官网给出的文件上限为 3 MB。"],
        manualChecks: ["核对标题、摘要、图表数量以及数据可用性声明。", "返修时需另交高分辨率图片与补充信息；本工具保留现有内嵌图片。"],
        sourceUrl: "https://www.nature.com/srep/author-instructions/submission-guidelines", sourceTitle: "Scientific Reports · Submission guidelines", checkedOn, options: { ...readable },
    },
    {
        id: "plos-one", name: "PLOS ONE", publisher: "PLOS", field: "生命科学", monogram: "P1", accent: "orange", policy: "有明确版式要求",
        summary: "应用双倍行距、单栏、连续行号和页码，方便审稿人定位正文。",
        officialRequirements: ["正文双倍行距，不能排成多栏。", "稿件应包含页码和连续行号，行号不按页重置。", "使用常见字体与字号，避免 Symbol 字体；标题层级最多三级。"],
        manualChecks: ["官网不允许脚注；请将脚注信息自行合并到正文或参考文献。", "核对标题层级、图表文件和引文格式；字体大小 12 pt 是工作台默认值。"],
        sourceUrl: "https://journals.plos.org/plosone/s/submission-guidelines", sourceTitle: "PLOS ONE · Submission Guidelines", checkedOn, options: { ...readable, lineSpacing: 2, lineNumbers: true },
    },
    {
        id: "acs-ami", name: "ACS Applied Materials & Interfaces", publisher: "ACS Publications", field: "材料与能源", monogram: "ACS", accent: "indigo", policy: "灵活初次投稿",
        summary: "面向材料界面研究的审稿稿件整理。ACS Fast Format 简化初次投稿的格式要求。",
        officialRequirements: ["ACS Fast Format 允许初次投稿采用简化、可读且一致的格式。", "仍需遵守目标期刊特有的稿件类型、内容及图表要求。"],
        manualChecks: ["核对目标期刊作者指南中的摘要、TOC 图及参考文献要求。", "材料表征与实验数据的完备性需要作者复核。"],
        sourceUrl: "https://researcher-resources.acs.org/publish/author_guidelines?coden=aamick", sourceTitle: "ACS Applied Materials & Interfaces · Author Guidelines", templateUrl: "https://researcher-resources.acs.org/publish/author_guidelines?coden=aamick", checkedOn, options: { ...readable },
    },
    {
        id: "advanced-materials", name: "Advanced Materials", publisher: "Wiley", field: "材料与能源", monogram: "AM", accent: "purple", policy: "灵活初次投稿",
        summary: "初次投稿采用 Free Format；返修和制作阶段可从官方指南获取 Word 模板。",
        officialRequirements: ["新投稿允许 Free Format，正文和图表可以合并或分文件提交。", "参考文献初次投稿可采用一致的格式；补充信息另交。"],
        manualChecks: ["返修和制作阶段请使用官网 Documents 下的 Word 模板核对。", "确认 TOC 图、声明以及期刊要求的章节顺序。"],
        sourceUrl: "https://advanced.onlinelibrary.wiley.com/hub/journal/15214095/author-guidelines", sourceTitle: "Advanced Materials · Author Guidelines", templateUrl: "https://advanced.onlinelibrary.wiley.com/hub/journal/15214095/author-guidelines", checkedOn, options: { ...readable },
    },
    {
        id: "advanced-energy-materials", name: "Advanced Energy Materials", publisher: "Wiley", field: "材料与能源", monogram: "AEM", accent: "green", policy: "灵活初次投稿",
        summary: "为能源材料稿件提供一致的初投稿版式；官方 Free Format 接受可读的现有格式。",
        officialRequirements: ["新投稿支持 Free Format，所需章节及图表说明仍须完整。", "官网提供 Word 和 LaTeX 模板供后续稿件准备使用。"],
        manualChecks: ["确认能源材料的实验表征、数据报告与 TOC 图。", "返修时从官网获取 Word 模板，核对章节和引文细则。"],
        sourceUrl: "https://advanced.onlinelibrary.wiley.com/hub/journal/16146840/author-guidelines", sourceTitle: "Advanced Energy Materials · Author Guidelines", templateUrl: "https://advanced.onlinelibrary.wiley.com/hub/journal/16146840/author-guidelines", checkedOn, options: { ...readable },
    },
    {
        id: "pnas-nexus", name: "PNAS Nexus", publisher: "Oxford University Press", field: "综合科研", monogram: "PN", accent: "teal", policy: "灵活初次投稿",
        summary: "用于跨学科论文的初次投稿整理。期刊初次投稿采用 format-neutral 格式政策。",
        officialRequirements: ["初次投稿采用 format-neutral，可使用一致且清晰的现有版式。", "文章结构、长度与所需声明仍取决于稿件类型。"],
        manualChecks: ["核对文章类型和 Significance Statement 等所需内容。", "若采用匿名审稿，需自行检查作者信息及文档元数据。"],
        sourceUrl: "https://academic.oup.com/pnasnexus/pages/general-instructions", sourceTitle: "PNAS Nexus · Information for authors", checkedOn, options: { ...readable },
    },
];

export function getJournal(id: string) {
    const journal = JOURNAL_PRESETS.find(item => item.id === id);
    if (!journal) throw new Error("未找到期刊排版方案。");
    return journal;
}
