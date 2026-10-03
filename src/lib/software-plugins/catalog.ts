export type SoftwareHost = "Blender" | "PowerPoint" | "Illustrator";

export type SoftwarePlugin = {
  id: string;
  name: string;
  host: SoftwareHost;
  subtitle: string;
  summary: string;
  features: string[];
  environment: string[];
  installation: string[];
  boundaries: string[];
  outputs: string[];
  repositoryUrl: string;
  downloadUrl: string;
  downloadKind: "发布包 ZIP" | "源码 ZIP";
  version: string;
  packageSize: string;
  verifiedOn: string;
};

// Public packages owned by id399-dzx. Downloads point to a release or an exact
// source revision; no local agent caches or private runtime files are published.
export const SOFTWARE_PLUGINS: SoftwarePlugin[] = [
  {
    id: "blender-reference-modeling",
    name: "Blender 参考图建模",
    host: "Blender",
    subtitle: "从参考图到可编辑三维模型",
    summary: "把参考图分析、几何构建与多视角渲染串联起来，适合科研结构建模和示意图制作。",
    features: [
      "整理正视、侧视、顶视与透视等结构信息，记录可见与推断区域。",
      "用几何规格组织 Blender 中的模型对象、参数与构建顺序。",
      "输出绑定模型的多视角透明白模，支持相机调整与材质配色流程。",
      "保存阶段状态和文件校验信息，便于中断后恢复与复核。",
    ],
    environment: ["本地 Blender、Python，以及可加载 Skill 的 AI Agent。", "离线版本：不包含云端建模 API 或 API 密钥配置。"],
    installation: [
      "下载发布包 ZIP 并解压，保留 SKILL.md、scripts 和 references 等目录。",
      "把工具包放入 AI Agent 的 Skill 目录，按包内说明配置 Blender 与 Python 路径。",
      "提供参考图和目标输出要求，从结构确认开始执行建模流程。",
    ],
    boundaries: ["这是由 AI Agent 调用的 Skill 工具包；使用入口位于 Agent，需本地安装 Blender。", "参考图中的遮挡结构需要确认，复杂几何与最终渲染仍需复核。"],
    outputs: ["可编辑 .blend", "透明 PNG", "几何规格与阶段报告"],
    repositoryUrl: "https://github.com/id399-dzx/modeling-from-reference-images-offline",
    downloadUrl: "https://github.com/id399-dzx/modeling-from-reference-images-offline/releases/download/offline-c77b32c/modeling-from-reference-images-offline-c77b32c.zip",
    downloadKind: "发布包 ZIP",
    version: "offline-c77b32c",
    packageSize: "178 KB",
    verifiedOn: "2026-10-03",
  },
  {
    id: "powerpoint-scientific-figures",
    name: "PowerPoint 科研图重建",
    host: "PowerPoint",
    subtitle: "让科研图在 PPT 中继续编辑",
    summary: "把科研机制图和流程示意图整理为 PowerPoint 原生路径、文字与分组对象，支持逐步绘制和任务恢复。",
    features: [
      "用原生文字、箭头、连接器与 Freeform 路径构建科研图形。",
      "按语义对象分组，保留移动、改色和修改文字的能力。",
      "支持从轮廓、填色到细节的分阶段播放，以及中断恢复。",
      "对目标文件、场景清单与原生对象结构进行校验。",
    ],
    environment: ["Windows PowerPoint、PowerShell、Python，以及可加载 Skill 的 AI Agent。", "参考图分析需另外安装 scientific-figure-shapes，安装说明见 GitHub。"],
    installation: [
      "下载固定版本源码 ZIP，解压后将文件夹命名为 fesilent-science-ppt-skill。",
      "放入 AI Agent 的 Skill 目录，依照 README 配置依赖。",
      "打开已保存的 PowerPoint 文件，提供文件路径、目标页码与参考图。",
    ],
    boundaries: ["这是 Skill 与脚本工具包，通过 Agent 驱动 PowerPoint。", "macOS 实时 Freeform 播放尚未认证；WPS 兼容性未在此版本说明中确认。", "照片与连续纹理可保留为局部图像资产，不能保证所有内容都变为可编辑路径。"],
    outputs: ["可编辑 PPT 图形", "语义场景清单", "播放计划与审计报告"],
    repositoryUrl: "https://github.com/id399-dzx/fesilent-science-ppt-skill",
    downloadUrl: "https://github.com/id399-dzx/fesilent-science-ppt-skill/archive/eb415f2e21a2395585103421224d92827f8f1c3c.zip",
    downloadKind: "源码 ZIP",
    version: "eb415f2",
    packageSize: "115 KB",
    verifiedOn: "2026-10-03",
  },
  {
    id: "illustrator-scientific-figures",
    name: "Illustrator 科研图重绘",
    host: "Illustrator",
    subtitle: "参考图重绘与可编辑矢量",
    summary: "在本地 Illustrator 中重绘科研图，结合原生路径、可编辑文字、语义分组和画布质量检查。",
    features: [
      "在打开的 Illustrator 文档中绘制路径、结构线与分层填色。",
      "保持 Live Text 可编辑，支持上下标、希腊字母与混合字号。",
      "按面板、细胞、组织和箭头等语义对象分组，便于继续编辑。",
      "提供描摹、原生绘制与混合模式，配套尺寸、文字和结构检查。",
    ],
    environment: ["Windows 10/11 x64、PowerShell 5.1+、Python 3.11–3.14。", "推荐 Illustrator 2026；2023 仅作为扁平科研图模式的兼容回退。"],
    installation: [
      "下载固定版本源码 ZIP，解压后将文件夹命名为 fesilent-science-skill。",
      "放入 AI Agent 的 Skill 目录，按照 README 安装依赖并检查本地环境。",
      "打开目标 Illustrator 文档，提供参考图和需要保留的文字、分组及编辑要求。",
    ],
    boundaries: ["这是在本地运行的 Skill 与脚本工具包，需安装 Illustrator。", "语义标注和复杂材质需要视觉复核，自动绘制不能保证任意图片的 1:1 还原。", "缓存播放等实验能力的状态，以所下载版本的 README 为准。"],
    outputs: ["可编辑 .ai", "矢量与预览图", "语义场景与 QA 报告"],
    repositoryUrl: "https://github.com/id399-dzx/fesilent-science-skill",
    downloadUrl: "https://github.com/id399-dzx/fesilent-science-skill/archive/545e9541498c573e6f04ce448fafc834c390f21b.zip",
    downloadKind: "源码 ZIP",
    version: "545e954",
    packageSize: "404 KB",
    verifiedOn: "2026-10-03",
  },
];
