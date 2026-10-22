# 两个完整应用的产品切换

电池资讯保留原有 React Router 网站、PostgreSQL、API 和 worker。主站不再重写资讯页面，也不再复制公开摘要 JSON。点击产品切换器中的「电池资讯」，通过 `/battery` 入口转到原应用；Fesilent Reverie 仍在 `/reverie`。

`src/lib/battery-app-origin.json` 保存原应用公开根地址。环境变量 `BATTERY_APP_ORIGIN` 可显式覆盖；缺少地址时返回 503。`/battery/<原路径>` 保留路径与查询参数转到原应用，入口响应不缓存。

精选、全部动态、热点、日报/周报/月报、主题、收藏、搜索、详情、企业目录、外观设置、管理后台、信源、模型 API 配置、采集及 RSS/API/MCP 均由原站直接提供。账号和浏览器本地数据仍属于各自原应用。

用户选择在自己的电脑运行完整资讯服务。现用 Cloudflare Quick Tunnel 提供临时访问地址；电脑、应用和通道进程必须保持运行。它没有长期固定地址或可用性保证，通道重建后用本机 `tools/Connect-Battery-Website.ps1` 更新主站入口并部署。

本机启动入口在应用启动后建立连接并更新主站入口；停止入口先停止本安装创建的通道，再停止应用。原始 `http://localhost:3000` 仍可直接访问；数据库、管理员密码、模型密钥和采集登录状态不进入主站仓库。发布和撤回资讯直接生效，无需 GitHub 快照同步。
