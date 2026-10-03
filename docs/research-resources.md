# 科研资源工作台

主导航中的数据处理、科研 Skill、论文排版和软件插件是同级入口。

## 科研 Skill

- 路径：`/research-skills`。
- 2026-10-03 核对 GitHub 用户 `id399-dzx` 的 58 个公开星标仓库，收录 28 个含实际 Skill 定义的科研或科研辅助仓库。
- 14 个科研专用、14 个科研辅助，按 7 类场景筛选。技能集合的子技能在同一卡片的详情中查看。
- 卡片提供中文功能、所需输入、输出、运行环境和来源；详情按钮跳转原 GitHub 仓库。
- 数据来自经审核的静态目录，浏览器不使用 GitHub Token，不执行上游代码。
- 更新：`node scripts/sync-starred-skills.mjs --sync`；离线完整性检查：`node scripts/sync-starred-skills.mjs --check`。新增项目须补充中文审核说明后收录。

## 论文排版

- 路径：`/paper-formatting`。
- 首批 8 本期刊：Nature、Nature Communications、Scientific Reports、PLOS ONE、ACS Applied Materials & Interfaces、Advanced Materials、Advanced Energy Materials、PNAS Nexus。
- 期刊卡片附官方作者指南及适用的模板入口。明确区分初次投稿的灵活格式政策、返修要求与可修改的工作台默认参数。
- 用户选择期刊，在弹窗中导入 `.docx`、确认排版参数并生成一份新的可编辑 Word 文件。
- Word 文件只在浏览器本地解析、处理和下载，不上传 Supabase、服务器或第三方 AI 服务；原稿不被覆盖。
- 格式处理保留原章节顺序、文字、图片、表格、公式及引文内容。结果报告列出实际格式调整与作者仍需复核的项目。
- 此功能整理投稿稿件的版式；不会自动重写引文、改变科学内容，也不保证生成期刊最终出版版式。
- 本地文件处理依赖 JSZip 与 xmldom，按需加载。维护期刊规则时需再次核对官方指南，记录核对日期。

## 软件插件

- 路径：`/software-plugins`。
- 当前展示自有的 Blender 参考图建模、PowerPoint 科研图重建、Illustrator 科研图重绘工具包。
- 每张卡片提供中文功能、环境、安装步骤、GitHub 来源和真实 ZIP 下载。
- 当前发布的三个包是由 AI Agent 调用的 Skill 与脚本工具包，界面明确注明使用入口及软件兼容范围。
- Blender 使用公开 Release；PPT 和 Illustrator 使用固定提交源码包，避免下载内容随分支更新而变化。
- 不打包本机缓存、私密配置、Git 凭据或第三方二进制运行环境。

## 界面约定

资源页面共用 `src/components/resources/resources.css` 和原生 `ResourceDialog`。弹窗使用原生键盘焦点约束，支持 Escape 关闭、正文独立滚动，详情和下载入口持续可见。导航在窄屏允许横向滚动。
