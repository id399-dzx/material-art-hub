# 科研资源工作台

主导航中的数据处理、科研 Skill、论文排版和软件插件是同级入口。

## 科研 Skill

- 路径：`/research-skills`。
- 2026-10-03 核对 GitHub 用户 `id399-dzx` 的 58 个公开星标仓库，收录 28 个含实际 Skill 定义的科研或科研辅助仓库。
- 14 个科研专用、14 个科研辅助，按 7 类场景筛选。技能集合的子技能在同一卡片的详情中查看。
- 卡片提供中文功能、所需输入、输出、运行环境和来源；详情按钮跳转原 GitHub 仓库。
- 匿名用户可以浏览卡片和筛选目录；打开工作台的中文详情或点击“查看详情”前需登录。原 GitHub 项目的公开访问规则不变。
- 数据来自经审核的静态目录，浏览器不使用 GitHub Token，不执行上游代码。
- 更新：`node scripts/sync-starred-skills.mjs --sync`；离线完整性检查：`node scripts/sync-starred-skills.mjs --check`。新增项目须补充中文审核说明后收录。

## 论文排版

- 路径：`/paper-formatting`。
- 首批 8 本期刊：Nature、Nature Communications、Scientific Reports、PLOS ONE、ACS Applied Materials & Interfaces、Advanced Materials、Advanced Energy Materials、PNAS Nexus。
- 期刊卡片附官方作者指南及适用的模板入口。明确区分初次投稿的灵活格式政策、返修要求与可修改的工作台默认参数。
- 用户选择期刊，在弹窗中导入 `.docx`、确认排版参数并生成一份新的可编辑 Word 文件。
- 期刊卡片、官方指南和排版参数可匿名浏览；导入文稿、生成排版结果及下载结果前需登录。
- Word 文件只在浏览器本地解析、处理和下载，不上传 Supabase、服务器或第三方 AI 服务；原稿不被覆盖。
- 格式处理保留原章节顺序、文字、图片、表格、公式及引文内容。结果报告列出实际格式调整与作者仍需复核的项目。
- 此功能整理投稿稿件的版式；不会自动重写引文、改变科学内容，也不保证生成期刊最终出版版式。
- 本地文件处理依赖 JSZip 与 xmldom，按需加载。维护期刊规则时需再次核对官方指南，记录核对日期。

## 软件插件

- 路径：`/software-plugins`。
- 展示 Fesilent Reverie 自研、由管理员自行上传发布的项目；原有三个 GitHub 工具包已撤下，不自动读取或上传本地项目。
- 管理员登录后在软件插件页点击“上传插件”；素材上传页也提供“发布软件插件”入口。
- 发布表单先只读检查管理员会话和私有安装包存储；配置未完成时在顶部显示原因与重试入口，填写内容及本机文件仍可保留。必填项错误可定位到字段，实际发布显示账号核验、ZIP 上传、封面上传及介绍保存阶段。
- 必填插件名、适用软件、中文简介、版本及 ZIP 安装包；可选封面、功能、环境、安装步骤、输出说明。安装包最大 50 MB，封面最大 5 MB；存储服务可能有更低的实际限额。
- 发布后自动以卡片展示，卡片及中文详情可匿名浏览；安装包仅供已登录用户下载。未发布时显示空状态。
- 复用现有 `assets` 表，以 `tags_style` 内部标记 `__fesilent_software_plugin_v1__` 分离插件与素材；`description` 保存版本化中文元数据。素材页过滤内部标记，插件不混入素材列表。
- ZIP 上传到私有 `plugin-packages` 桶，路径严格为 `<UUID>/package.zip`；`source_file_url` 保存 `storage://plugin-packages/<UUID>/package.zip` 引用，不保存公开下载链接。封面继续上传到公开的 `materials/uploads/plugins/<UUID>/cover.*`。
- 首次使用前须在 Supabase SQL Editor 执行 [`20261004000000_private_plugin_packages.sql`](../supabase/migrations/20261004000000_private_plugin_packages.sql)。该迁移只配置私有包桶和对应 Storage 策略，无新增业务数据表；管理员可只读检查该桶的配置，现有 `assets` 表、公开 `materials` 桶和素材权限仍需已配置。ZIP 限额为 50 MiB，允许 ZIP MIME 类型；已登录用户可读取合法包路径，仅指定管理员可上传或删除，包不允许覆盖、改名或移动。
- 下载入口为本站 `/api/software-plugins/<id>/download`。服务器每次验证登录会话；未登录返回 `401`，下载及错误响应均使用 `Cache-Control: private, no-store`。服务器获取包后流式返回 ZIP，不向浏览器返回签名链接或跳转到 Storage URL，匿名直访该入口无法下载包。
- 上传使用新 UUID 和 `upsert: false`。存储或数据库发布失败时，按两个桶分别尝试清理本次已经上传的文件；清理失败会提示管理员检查暂存文件。旧公开包引用需要迁移到私有桶后重新发布，不能直接作为下载入口。
- 点击“上传并发布”后介绍及公开封面可被浏览，私有包需登录下载。本版本不提供保密草稿；选择本地文件不会自动上传。草稿、下架及版本管理需后续单独设计。

## 登录与返回

- 受限操作会先显示登录提示，用户可以继续浏览公开内容。登录通过安全的站内 `next` 路径返回，并恢复所选 Skill、期刊或插件；选择参数只接受当前目录中存在的项目。
- 返回路径拒绝外站、协议相对 URL、反斜杠、控制字符和登录回调循环，不能用于跳转到任意网站。
- URL 只记录资源选择，不保存 Word 文稿、文稿内容或生成结果。Word 文件保留在本机及当前页面内存；跳转登录后需重新选择本地文件。

## 界面约定

资源页面共用 `src/components/resources/resources.css` 和原生 `ResourceDialog`。弹窗使用原生键盘焦点约束，支持 Escape 关闭、正文独立滚动，详情和下载入口持续可见。导航在窄屏允许横向滚动。
