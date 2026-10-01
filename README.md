# MaterialArt Hub

科研数据处理工作台与素材库。数据处理页面位于 `/data-processing`，可导入实验表格、绘制图表并导出图片；素材探索、账号和素材上传使用 Supabase。

## 绘图入口

- [基础绘图说明](docs/data-templates.md)：21 类通用科研图表，含数据检查、绘图建议和物理规格导出。
- [论文图例模板说明](docs/paper-figure-templates.md)：逐张对应 figures4papers 首页的 17 张具体图例，可按面板替换数据、文字和插图。原图保留为位图底板，替换图表与文字为矢量；原图资源遵循 CC BY-NC 4.0。

- [两项目对比与优化记录](docs/research-workbench-comparison.md)：实际覆盖、验证结果与剩余能力差距。

## 本地运行

```bash
npm install
npm run dev
```

打开 <http://localhost:3000/data-processing>。数据处理功能本身不请求 Supabase，素材服务暂时不可用时仍可使用。

## 配置素材库

在项目根目录的 `.env.local` 中设置当前 Supabase 项目的公开配置：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

使用 Supabase 控制台显示的当前项目地址和公开密钥；不要将 `service_role` 密钥放入 `NEXT_PUBLIC_` 变量。修改配置后重启开发服务器。素材库还需要 `assets` 表、`materials` Storage bucket，以及控制读取、发布和删除权限的 RLS / Storage 策略。本仓库没有这些资源的数据库迁移或素材备份，替换项目配置不会自动恢复原有素材。

如果浏览器提示素材无法加载，先检查项目地址是否仍能解析，再到 Supabase 控制台确认项目状态。域名无法解析时，前端修改无法恢复该远端项目。

## 检查

```bash
npm run build
npm run lint
node --test src/lib/data-processing/parse.test.mjs
```
