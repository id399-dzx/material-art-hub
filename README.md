# MaterialArt Hub

科研数据处理工作台与素材库。数据处理页面位于 `/data-processing`，可导入实验表格、绘制图表并导出图片；素材探索、账号和素材上传使用 Supabase。

## 绘图入口

- [通用绘图规则](docs/data-templates.md)：统一数据模板库保留数据检查、绘图建议和物理规格导出。
- [论文图例模板说明](docs/paper-figure-templates.md)：当前 31 个数据模板、10 个分类，包括 17 个通用模板、6 个论文图式代表和 8 个电化学测试模板。原有通用与论文图式按实际结构去重，两种小提琴全部保留，机制插图已移除。点击模板在弹窗中编辑，只导出当前数据图；所有缩略图用演示数据完整绘制，不再裁剪原论文图片。论文图式保留来源署名与 CC BY-NC 4.0 说明。
- [电化学测试专栏](docs/electrochemical-templates.md)：CV、GCD、电压–比容量、倍率、循环与可选库仑效率、Nyquist、Bode、LSV；支持表头字段建议、显式虚部符号选择及对数坐标输入校验。新增模板和演示数据独立编写。
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
