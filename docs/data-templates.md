# 数据模板

入口：`/data-processing#data-templates`。浏览器导航返回数据处理后，模板的文件、列绑定和样式仍保留；刷新页面后恢复示例。

## 操作

1. 选择多组折线图、分组柱状图或均值与误差条。
2. 使用演示数据试用，或导入不超过 10 MB 的 CSV、XLS、XLSX。Excel 可切换工作表；无表头数据取消“首行为列名”。
3. 绑定 X / 类别列和 Y 列。误差条支持每行的独立重复实验，或已计算的均值与误差列。
4. 调整标题、轴名称、字体、配色、尺寸和网格；导出 SVG 或三倍尺寸 PNG。

## 数据规则

- 空白或非数值不当作零。选中数据列不完整的行整体跳过并提示原始行号。
- 折线保留原始点顺序，不自动排序、平滑、插值或填补。
- 柱状图每行对应一个类别，重复类别需要用户先汇总。
- 重复实验至少两列；SD 为样本标准差（分母 n−1），SEM 为 SD / √n。
- 汇总误差必须为非负数；填写的误差值不会转换。识别到 SEM / 标准误列时默认 SEM，否则默认 SD，用户应按实验记录确认。
- 内置数据是自编的布局演示，画布与导出标题均标注示例。
- 文件读取、数据计算及图像导出均在浏览器完成。

## 实现和来源

借鉴 figures4papers 的通用科研图表分类与模板思路；未复制其代码、图片、配色文件、实验数据或文档。图表选项、缩略图和示例表格独立实现，使用项目已有的 ECharts 和 SheetJS。

- `src/components/data-processing/TemplateStudio.tsx`：界面与导入导出。
- `src/lib/data-processing/templates.ts`：数据校验与误差计算。
- `src/lib/data-processing/template-chart.ts`：图表选项。

验证：`node --experimental-strip-types --test src/lib/data-processing/templates.test.mjs`。包括缺失值、真实行号、SD / SEM、类别校验、分组误差条定位、CSV 转义和 ECharts SVG 渲染。
