# 电池资讯与 Fesilent Reverie

默认首页 `/` 跳转到 `/battery`；原素材探索保留在 `/reverie`。点击左上角站名可以在电池资讯和 Fesilent Reverie 之间切换，所有科研工具原有路径不变。

- `/battery`：公开资讯、栏目与站内摘要检索。
- `/battery/items/[id]`：资讯摘要、研究看点及原文链接。
- `/battery/companies`：城市、地区、业务方向与企业关键词筛选。

页面沿用现有 Next.js / Vercel 部署，不新增云数据库、模型调用或后台常驻进程。资讯数据是从本机资讯站匿名公开读取层导出的白名单 JSON，存放在 `src/data/battery`。全文、草稿、数据库、管理员配置和登录凭据不在导出范围中。主站既有素材和账号服务不变。

采集、筛选和 DeepSeek 整理由本机独立项目 `fesilent-battery-news` 承担。完成公开发布后，在本机运行 `D:\Ai HOT\tools\Publish-Battery-News.ps1`，它会重新读取公开资讯及企业目录，只提交两个数据快照，再推送至本仓库的 main 分支。现有主站部署连接应随 GitHub 更新重新部署。内容撤回后也要同步并部署，线上快照才会移除该条。

网页显示文章的原始发表日期；没有精确时间的条目保持日期精度，未知时间明确标注。这里的查询只搜索已收录摘要、来源与标签，不触发外部检索或模型调用。

验证：`npm run build`、`node --test src/lib/battery/catalog.test.mjs`，以及本机集成测试中的双向切换、资讯详情与原文、城市/业务筛选、空状态、手机布局和键盘收起菜单。
