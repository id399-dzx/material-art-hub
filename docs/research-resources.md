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
- 展示 Fesilent Reverie 自研、由管理员自行上传发布的项目；原有三个 GitHub 工具包已撤下，不自动读取或上传本地项目。
- 管理员登录后在软件插件页点击“上传插件”；素材上传页也提供“发布软件插件”入口。
- 必填插件名、适用软件、中文简介、版本及 ZIP 安装包；可选封面、功能、环境、安装步骤、输出说明。安装包最大 50 MB，封面最大 5 MB；存储服务可能有更低的实际限额。
- 发布后自动以卡片展示，点击打开中文详情及安装包下载；未发布时显示空状态。
- 复用现有 `assets` 表，以 `tags_style` 内部标记 `__fesilent_software_plugin_v1__` 分离插件与素材；`description` 保存版本化中文元数据，`source_file_url` 指向 `materials/uploads/plugins/` 中的 ZIP。素材页过滤内部标记，插件不混入素材列表。
- 沿用现有管理员身份验证及 Supabase RLS/Storage 策略，无新增数据库表或迁移。存储与数据库发布失败会尝试清理本次新增文件。
- 点击“上传并发布”后介绍及包公开可取。本版本不提供保密草稿；选择本地文件不会自动上传。私有草稿、下架及版本管理应另行采用独立表和私有存储。

## 界面约定

资源页面共用 `src/components/resources/resources.css` 和原生 `ResourceDialog`。弹窗使用原生键盘焦点约束，支持 Escape 关闭、正文独立滚动，详情和下载入口持续可见。导航在窄屏允许横向滚动。
