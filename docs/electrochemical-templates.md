# 电化学测试模板

入口：`/data-processing?templates=electrochem#paper-figures`。也可在论文图例模板目录点击首个分类「电化学测试」，或选择来源「电化学专栏」。专栏有 8 个按实验目的编写的模板，使用同一个上传、字段绑定、预览和导出弹窗。

整个模板库当前为 **31 个模板、10 个分类**；原有 23 个结构模板与两种小提琴保持不变，机制插图不再展示。电化学演示表格和 SVG 独立编写，不包含外部实验数据或裁剪图片。

## 输入与坐标

表中的单位是示例。上传文件后使用实际绑定表头作为轴名称，用户应确认单位并修改轴名；系统不会把 A 自动换算成 mA，把容量换算成比容量，或转换参比电极。

| 模板 | X 列 | Y 列 | 建议表头示例 | 输入要求 |
| --- | --- | --- | --- | --- |
| 循环伏安曲线 · CV | 电位 | 一列或多列电流 | `Potential (V vs. Ag/AgCl)`、`Current_10mVs (mA)`、`Current_50mVs (mA)` | 保留正反扫和重复电位；在列名标注扫描速率。 |
| 恒流充放电曲线 · GCD | 时间 | 一列或多列电位 / 电压 | `Time (s)`、`Potential_1Ag (V)` | 按采集顺序填写，保留放电起点的电位突变。 |
| 电压–比容量曲线 | 已计算的容量 / 比容量 | 充电、放电或不同循环的电压 | `Specific capacity (mAh/g)`、`Voltage_charge (V)`、`Voltage_discharge (V)` | 多条曲线共用相同容量采样点；采样点不同应分别作图。 |
| 倍率性能 | 循环序号 | 一列或多列容量 | `Cycle number`、`Capacity_A (mAh/g)`、`Capacity_B (mAh/g)` | 每行一圈；倍率阶段在图题、列名或图注说明，按实际先后顺序排列。 |
| 循环性能与库仑效率 | 循环序号 | 左轴容量 / 保持率；右轴 CE 可选 | `Cycle number`、`Capacity (mAh/g)`、`CE (%)` | 不提供 CE 时选择「不显示库仑效率」；百分数填写 99.5 而非 0.995。 |
| 阻抗谱 · Nyquist | 实部 Re(Z) / Z′ | 负虚部 −Im(Z) / −Z″，或原始虚部 | `Re(Z) (Ω)`、`Im(Z) (Ω)` | 上传后必须选择虚部约定；两个阻抗列使用相同单位。 |
| 阻抗谱 · Bode | 原始频率 | 左轴阻抗模值；右轴相位 | `Frequency (Hz)`、`\|Z\| (Ω)`、`Phase (°)` | 频率、模值严格大于零；相位可为负。不能把 Re(Z) 当作模值。 |
| 线性扫描伏安 · LSV | 电位 | 一列或多列电流 / 电流密度 | `Potential (V vs. RHE)`、`Current density (mA/cm²)` | 保留单向扫描与电流符号；归一化和参比换算由用户先完成。 |

CV 和 LSV 的通常表达为电流对电位，电位相对于实际参比电极；CV 包含反向扫描，LSV 为单向扫描。这也是保留重复 X 和采集顺序的原因。[Pine 仪器官方手册，23 页](https://www.pineresearch.com/wp-content/uploads/sites/2/2019/03/AFCBP1-manual-LMCBP1H.pdf)

时间–电压、电压–容量和容量 / 效率–循环次数表达不同实验信息；测试条件或倍率变化应在实验记录和图注中明确。[BioLogic：如何阅读电池循环曲线](https://www.biologic.net/topics/how-to-read-cycling-curves/)

## 从上传到自己的数据图

1. 点击模板卡片打开弹窗。可先「载入示例」查看完整图式，或「下载示例表格」检查列结构。
2. 上传最大 10 MB 的 CSV、XLS 或 XLSX。CSV 支持 UTF-8、UTF-16、GB18030；Excel 可切换工作表；无表头表格可取消「首行为列名」。
3. 检查字段建议。系统根据电位、电流、时间、容量、循环、实部 / 虚部、频率、模值、相位或效率表头优先建议绑定；无法识别时采用可用数值列。建议不是单位识别或实验判断，所有字段可手动更换。
4. 对 Nyquist 确认虚部约定；对 Bode 分别绑定模值与相位；对循环性能选择是否显示 CE 右轴。相关输入未满足时预览会提示错误。
5. 修改标题、X / Y / 右轴名称、字体、配色、画布和图注。电位参比、扫描速率、电流密度、倍率方案及容量归一化基准应按实际实验填写。
6. 导出 SVG、150 / 300 / 600 DPI PNG，或使用浏览器打印为 PDF。支持 85 / 180 mm 或 40–300 mm 自定义物理宽度、灰度与文字布局检查；详见[通用绘图规则](data-templates.md)。

文件读取、数据计算与图形导出在浏览器内进行。内置演示数据标注「示例」，不代表真实测量或性能结论。

## Nyquist：符号与比例

电化学 Nyquist 常用横轴 Re(Z)、纵轴 −Im(Z)。两轴应为同一单位，单位数值对应相同像素长度，避免将半圆拉成椭圆、改变角度或误判形状。[BioLogic：EIS 表达方式](https://www.biologic.net/topics/what-is-eis/)

上传后不会根据数值正负猜测仪器约定，必须在「虚部列输入约定」中明确选择：

- **已经是 −Im(Z) · 保持原值**：不改变上传值。
- **原始 Im(Z) · 虚部取负**：绘图时 Y 乘以 −1；轴名同步提示取负。

转换不取绝对值，因此感抗等导致的正负号仍保留。原始表格不被改写。按原始频率扫描顺序排列数据，不按 Re(Z) 排序；当前模板只绑定实部 / 虚部，不从曲线生成频率信息。

## Bode：对数轴与相位

模板以原始频率为 X，在左侧对数轴绘制阻抗模值，在右侧线性轴绘制有符号相位角；两个 Y 列有独立单位。频率、模值出现零或负数时，会阻止绘图并提示修正绑定或原始表格，不自动删除该点、取绝对值或补造正数。[Gamry：EIS 基础与数据表达](https://www.gamry.com/application-notes/EIS/basics-of-electrochemical-impedance-spectroscopy)

填写原始 `Frequency (Hz)` 与 `|Z|`，不要输入已经取过 `log10` 的值再套用对数轴。模值不是 Re(Z)，相位不是 −Im(Z)。当前模板不从复数阻抗自动推算模值和相位；应使用仪器输出或已核对的计算结果。

## 循环性能与适用范围

循环性能左轴绑定容量，也可上传已计算的保持率并修改轴名；右轴的库仑效率可单独关闭，关闭后仅绘制容量曲线。效率使用上传值，不自动计算、不强制截断为 0–100%；效率百分数与 0–1 小数表示须由用户自行确认。

各曲线共用一列 X，保留原始行序，不自动平滑、插值或填补。缺失 / 无效数值沿用通用规则并提示行号；Bode 的非正数另作阻断校验。CV 的回扫重复电位不会合并，倍率图不会按倍率大小重排。

模板用于表达数据，不自动计算比电容、面积 / 质量归一化、能量、功率、参比换算、iR 校正、CE、容量保持率、Tafel 参数或等效电路参数。不从演示半圆或示意图推断 Rct、扩散系数及时间常数；EIS 参数需要真实频率数据、合适模型与拟合验证，不同电路也可能解释同一谱。[Gamry：EIS 参数拟合与模型非唯一性](https://www.gamry.com/application-notes/EIS/basics-of-electrochemical-impedance-spectroscopy)

## 实现与检查

- `src/lib/data-processing/electrochemical-templates.ts`：8 个目的预设、坐标说明与独立演示数据。
- `src/lib/data-processing/electrochemical-mapping.ts`：语义表头建议；不转换单位。
- `src/lib/data-processing/electrochemistry.ts`：对数输入校验与显式虚部约定。
- `src/components/data-processing/TemplateStudio.tsx`：电化学专栏、左右轴绑定和符号选择。
- `scripts/generate-drawing-previews.mjs`：以同一演示数据、字段绑定和 ECharts 渲染器生成完整 SVG 预览，不裁剪原图。

验证命令：

```bash
node --experimental-strip-types --test src/lib/data-processing/electrochemical-templates.test.mjs src/lib/data-processing/electrochemical-mapping.test.mjs src/lib/data-processing/electrochemistry.test.mjs
node --experimental-strip-types scripts/generate-drawing-previews.mjs --check
```

前一项覆盖演示数据、字段重排、仪器索引 / 时间列排除、可选 CE、原始顺序、正负号、对数轴及 Nyquist 单位长度；后一项检查当前全部 31 个缩略图的完整画布文字边界，并生成联系表供逐张核对。检查针对数据和图形行为，不代替对实验记录及科学结论的确认。
