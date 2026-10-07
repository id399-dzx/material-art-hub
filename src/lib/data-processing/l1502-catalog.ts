import type { DrawingTemplate, DrawingType } from './drawing-catalog.ts';
import type { TemplateId } from './templates.ts';
import type { L1502Kind, L1502Spec } from './l1502-spec.ts';
import { createL1502Demo } from './l1502-demo.ts';

type KindInfo = { english: string; category: DrawingType; chartId: TemplateId; description: string; requirement: string; guide: string };
const info = (english: string, category: DrawingType, chartId: TemplateId, description: string, requirement: string, guide: string): KindInfo => ({ english, category, chartId, description, requirement, guide });

const KINDS: Record<L1502Kind, KindInfo> = {
    line: info('Line', '折线图', 'line', '在真实数值横轴上连接各系列观测。', 'X ＋ 一列或多列系列 Y', '每行一个横轴位置，系列各占一列；保留输入坐标与行顺序。'),
    bar: info('Bar', '柱状图', 'grouped-bar', '比较类别之间的单组或多组数值。', 'X 类别 ＋ 一列或多列系列数值', '每行一个类别，每列一个数值系列；并排排列与堆叠组成分别处理。'),
    'dual-axis': info('Dual axis', '折线图', 'dual-axis', '两个量纲不同的指标分别使用左右坐标轴。', 'X ＋ 左轴系列 ＋ 右轴系列', '第一列系列绑定左轴，第二列系列绑定右轴；分别填写轴名和单位。'),
    'stacked-bar': info('Stacked bar', '组成图', 'stacked-bar', '以可相加的组成值展示类别合计与各部分。', 'X 类别 ＋ 非负组成系列；分组可加 Group', '组成列采用相同单位；分组堆叠在每个类别内分别保留各组的组成。'),
    area: info('Area', '折线图', 'line', '以填充面积展示多条曲线的范围和变化。', 'X ＋ 非负系列 Y', '填写各系列实际曲线值；重叠面积与堆叠面积采用各自的图形结构。'),
    scatter: info('Scatter', '散点图', 'scatter', '按独立 XY 坐标展示观测点。', 'X ＋ Y；可选 Color / Group / Label', '每行一个观测，Group 区分组别，Color 编码数值，Label 保留点标签。'),
    bubble: info('Bubble', '散点图', 'scatter', '用位置、气泡面积和颜色同时编码观测。', 'X ＋ Y ＋ Size；可选 Color / Group / Label', 'Size 填非负数值；大小映射为气泡面积，颜色数值与大小可分别绑定。'),
    'bubble-cloud': info('Bubble cloud', '散点图', 'scatter', '按非负权重排列带名称的气泡云。', 'Word ＋ Size；可选 Color / Group', 'Word 为项目名称，Size 为非负权重；气泡位置由打包布局产生，分组云按 Group 分区。'),
    'scatter-matrix': info('Scatter matrix', '多图布局', 'scatter', '以多个成对散点面板比较各数值变量。', '至少两列数值变量；可选 Group', '各变量占一列，每行一个样本；对角面板展示变量分布，其他面板使用对应变量对。'),
    'scatter-marginal': info('Scatter with marginal histograms', '多图布局', 'scatter', '共用观测值绘制散点与两个边缘直方图。', 'X ＋ Y；可选 Group', '散点和边缘频数来自同一批 XY 样本，分箱数可调整。'),
    stem: info('Stem', '折线图', 'line', '以零基线和针状线段展示离散位置的数值。', 'X ＋ 一列或多列系列 Y', '每个数值位置保留一根针状线；多组系列按对应位置叠加。'),
    'error-bar': info('Bar with error bars', '柱状图', 'error-bar', '在类别柱形上展示输入的误差幅度。', 'X ＋ SeriesA ＋ SeriesA_error；其他系列同样命名', '误差列填写已计算的非负误差，和对应系列成对绑定；说明误差采用 SD、SEM 或其他定义。'),
    'error-line': info('Line with error bars', '折线图', 'line', '在数值曲线上展示各点的已计算误差。', 'X ＋ SeriesA ＋ SeriesA_error；区间可用 lower / upper', '误差列填写已计算幅度；上下界列按对应系列直接绘制，不根据演示点推断统计区间。'),
    heatmap: info('Heatmap', '热图', 'heatmap', '将行列矩阵中的标量值映射到颜色。', '首列为行标签，其余列名为列位置，单元格为数值', '矩阵采用宽表，每行一个行位置；数值列名与数值行标签可保留真实坐标间距。'),
    box: info('Box plot', '分布图', 'box', '从各类别的原始样本显示中位数与四分位分布。', 'Category ＋ Value ＋ Group（长表）', '每行一个原始观测；类别与组别分别绑定，不使用均值代替原始样本。'),
    pie: info('Pie', '组成图', 'percent-bar', '以扇区面积表达非负组成值的占比。', 'X 类别 ＋ Y 非负组成值', '各行是不同成分，组成总量必须大于零；扇区占比按输入合计计算。'),
    step: info('Step', '折线图', 'line', '用水平段与跳变展示离散更新的曲线。', 'X ＋ 一列或多列系列 Y', '每行一个更新位置，曲线在相邻位置之间保持阶梯结构。'),
    'bubble-matrix': info('Bubble matrix', '热图', 'heatmap', '在行列交点以气泡面积与颜色编码两个数值。', 'X ＋ Y ＋ Size ＋ Color（长表）', '每行一个矩阵单元；Size 与 Color 分别绑定，行列标签按输入保留。'),
    histogram: info('Histogram', '分布图', 'histogram', '由原始样本分箱统计频数。', 'Y 原始样本值；可选 Group', '每行一个观测；按样本分箱，分组数据分别显示频数。'),
    histogram2: info('Bivariate histogram', '分布图', 'heatmap', '按二维数值区间统计 XY 样本频数。', 'X ＋ Y 原始样本坐标', '每行一个二维观测；两个方向独立分箱，柱高或颜色表示各区间计数。'),
    pareto: info('Pareto', '柱状图', 'grouped-bar', '按贡献值降序显示柱形和累计百分比。', 'X 类别 ＋ Y 非负贡献值', '累计百分比由输入贡献值计算；总量需大于零。'),
    'word-cloud': info('Word cloud', '文本图', 'network', '用字号和排版位置展示词项权重。', 'Word ＋ Weight 非负权重', '每行一个词项；权重控制字号，文字由输入保留，不自动从文章统计词频。'),
    parallel: info('Parallel coordinates', '多图布局', 'radar', '在平行排列的变量轴之间连接每个样本。', '多列数值变量；可选 Group', '每行一个样本，每列一个变量；各轴量程分别显示，线条按 Group 区分。'),
    jitter: info('Clustered scatter', '散点图', 'scatter', '在各类别内保留原始样本并避免点重叠。', 'X 类别 ＋ Y 样本值 ＋ Group', '每行一个原始观测，类别方向的排布用于减少重叠，不改变数值轴上的样本值。'),
    pyramid: info('Population pyramid', '柱状图', 'horizontal-bar', '以左右对称的横向柱形比较两个系列。', 'X 类别 ＋ 两列系列数值', '两组分别排列在中心两侧；展示数量的绝对值，侧向由两组约定决定。'),
    confidence: info('Line with input bounds', '折线图', 'line', '以曲线与填充区间展示输入的上下界。', 'X ＋ SeriesA ＋ SeriesA_lower ＋ SeriesA_upper', '每个系列都使用对应的已计算上下界；区间定义由你填写，演示数据不代表统计置信水平。'),
    network: info('Network', '网络与流程', 'network', '按节点与边的连接关系显示网络。', 'Source ＋ Target；可选 Weight', '每行一条边；节点名称保留，权重控制边宽，有向图保留起点到终点的方向。'),
    'variable-bar': info('Variable width bar', '柱状图', 'grouped-bar', '同时保留每根柱的起点、宽度和高度。', 'Start ＋ Value ＋ Size（柱宽）', 'Start 为柱形区间起点，Size 为正宽度，Value 为高度；区间按输入坐标绘制。'),
    'multi-panel': info('Multiple panels', '多图布局', 'multi-panel', '在各自坐标区中显示共享数据的多个面板。', '数值 X ＋ 多列系列 Y；可选误差列', '各面板使用对应数值系列，保留独立坐标区和本期布局。'),
    inset: info('Inset plot', '多图布局', 'line', '在主图内嵌入同一数据的局部放大面板。', '数值 X ＋ 多列系列 Y', '主图使用完整范围，嵌入图截取同一输入数据的局部区间。'),
    'polar-line': info('Polar line', '极坐标图', 'radar', '以角度与半径展示连续极坐标曲线。', 'X 角度（弧度） ＋ Y 半径；可选 Group', '角度采用弧度，半径需非负；各组分别连接输入点。'),
    'polar-scatter': info('Polar scatter', '极坐标图', 'scatter', '在极坐标系中展示独立观测点。', 'X 角度（弧度） ＋ Y 半径；可选 Group', '每行一个极坐标观测，不把点位置自动变为函数曲线。'),
    'polar-bubble': info('Polar bubble', '极坐标图', 'scatter', '在极坐标位置以气泡面积编码额外数值。', 'X 角度（弧度） ＋ Y 半径 ＋ Size；可选 Color / Group', 'Size 映射到面积，Group 区分系列；保留输入角度与半径。'),
    'polar-histogram': info('Polar histogram', '极坐标图', 'histogram', '按角度区间统计样本频数。', 'Y 原始角度（弧度）', '每行一个角度观测；将角度按完整周期归入对应分箱。'),
    vector2: info('Two-dimensional vectors', '等高线与场图', 'scatter', '按向量起点和 UV 分量绘制二维箭头。', 'X ＋ Y ＋ U ＋ V；可选 Color', 'XY 为起点，UV 为向量分量；模值赋色直接使用向量模或指定 Color。'),
    compass: info('Compass', '极坐标图', 'trajectory', '以共同原点展示 UV 向量的方向与长度。', 'U ＋ V；可选 Color', '方向由 atan2(V,U) 确定，长度由 UV 模值确定，保留向量差异。'),
    contour: info('Contour', '等高线与场图', 'heatmap', '在数值 XY 网格上绘制标量 Z 的等值线。', 'X ＋ Y ＋ Z 完整网格（长表）', '每行一个网格点；使用输入的 Z 数值计算等值线，缺失网格不自动补为零。'),
    bar3: info('Three-dimensional bar', '三维图', 'surface', '在二维位置网格上以柱高展示第三个数值。', 'X ＋ Y ＋ Z', '每行一个网格柱，XY 保留对应位置，Z 控制柱高。'),
    scatter3: info('Three-dimensional scatter', '三维图', 'sphere', '在 XYZ 坐标系中展示三维观测点。', 'X ＋ Y ＋ Z；可选 Size / Color / Group / Label', '每行一个三维观测；Size 可控制气泡面积，Color 控制数值颜色。'),
    line3: info('Three-dimensional line', '三维图', 'sphere', '按 XYZ 位置与输入顺序连接空间曲线。', 'X ＋ Y ＋ Z；可选 Group', '保留空间坐标及行顺序；不同组分别连接，不自动归一化或平滑。'),
    stem3: info('Three-dimensional stem', '三维图', 'surface', '在 XY 平面以针状线段展示 Z 数值。', 'X ＋ Y ＋ Z', '每行一根从平面基线出发的针，端点使用输入 Z 值。'),
    surface: info('Surface', '三维图', 'surface', '按 XY 网格的 Z 值重建曲面或网格曲面。', 'X ＋ Y ＋ Z 完整网格（长表）', '每行一个网格点；网格线、面填充、底部等高线与光照分别按本期图式设置。'),
    waterfall: info('Waterfall', '三维图', 'surface', '以逐行剖面及其落地边线展示网格数值。', 'X ＋ Y ＋ Z 完整网格（长表）', '同一 Y 位置的点组成一个剖面；瀑布结构保留各剖面次序。'),
    ribbon: info('Ribbon', '三维图', 'surface', '把多个序列展开为并列的三维条带。', 'X ＋ Y ＋ Z 完整网格（长表）', 'X 为沿带位置，Y 区分条带，Z 为高度；各条带之间保留间隔。'),
    'tri-mesh': info('Triangular mesh', '三维图', 'surface', '在不规则 XY 点上构造三角网格。', 'X ＋ Y ＋ Z 不规则网格点', '每行一个网格顶点，按 XY 点三角剖分并保留网格线。'),
    'tri-surface': info('Triangular surface', '三维图', 'surface', '由不规则网格点构造填充的三角曲面。', 'X ＋ Y ＋ Z 不规则网格点', '各行作为顶点按 XY 位置三角剖分，Z 为顶点高度。'),
    pie3: info('Three-dimensional pie', '三维图', 'surface', '以带厚度的扇区展示组成比例。', 'X 类别 ＋ Y 非负组成值', '占比根据非负输入值计算，扇区厚度仅用于空间显示。'),
    vector3: info('Three-dimensional vectors', '三维图', 'sphere', '从 XYZ 起点沿 UVW 分量绘制空间箭头。', 'X ＋ Y ＋ Z ＋ U ＋ V ＋ W；可选 Color', '起点与向量分量分别绑定，颜色可编码真实模值或指定标量。'),
    'implicit-surface': info('Implicit surface', '三维图', 'surface', '从三维标量场中提取指定等值面的几何结构。', 'X ＋ Y ＋ Z ＋ Color（标量 F）完整三维网格', 'Color 存储 F(x,y,z)，等值面按指定 F 值提取；演示场为 x²+y²+z²−1，默认显示 F=0。'),
};

type L1502Entry = { issue: number; name: string; kind: L1502Kind; flags?: Omit<L1502Spec, 'issue' | 'folder' | 'kind'>; category?: DrawingType };

// One entry per original issue, including variants that share numerical semantics.
const ENTRIES: readonly L1502Entry[] = [
    { issue: 1, name: "折线图", kind: "line" },
    { issue: 2, name: "柱状图", kind: "bar", flags: { grouped: true } },
    { issue: 3, name: "双轴折线图", kind: "dual-axis", flags: { dualMode: "line" } },
    { issue: 4, name: "双轴柱状图", kind: "dual-axis", flags: { dualMode: "bar" }, category: "柱状图" },
    { issue: 5, name: "双轴柱线图", kind: "dual-axis", flags: { dualMode: "mixed" }, category: "柱状图" },
    { issue: 6, name: "堆叠图", kind: "stacked-bar", flags: { stacked: true } },
    { issue: 7, name: "面积图", kind: "area", flags: { filled: true } },
    { issue: 8, name: "多组横向柱状图", kind: "bar", flags: { horizontal: true, grouped: true } },
    { issue: 9, name: "横向堆叠图", kind: "stacked-bar", flags: { horizontal: true, stacked: true } },
    { issue: 10, name: "叠加柱状图", kind: "bar", flags: { overlaid: true } },
    { issue: 11, name: "单组柱状图", kind: "bar" },
    { issue: 12, name: "三维柱状图", kind: "bar3" },
    { issue: 13, name: "三维柱状图高度赋色", kind: "bar3", flags: { colorByValue: true } },
    { issue: 14, name: "三维柱状图渐变", kind: "bar3", flags: { colorByValue: true, gradient: true } },
    { issue: 15, name: "散点图", kind: "scatter" },
    { issue: 16, name: "特征渲染的散点图", kind: "scatter", flags: { colorByValue: true } },
    { issue: 17, name: "散点图气泡", kind: "bubble", flags: { colorByValue: true } },
    { issue: 18, name: "散点图矩阵", kind: "bubble-matrix", flags: { colorByValue: true } },
    { issue: 19, name: "散点折线图", kind: "line" },
    { issue: 20, name: "三维散点图", kind: "scatter3", flags: { grouped: true } },
    { issue: 21, name: "三维散点图特征渲染", kind: "scatter3", flags: { colorByValue: true } },
    { issue: 22, name: "热图", kind: "heatmap" },
    { issue: 23, name: "热图灵活版", kind: "heatmap", flags: { colorByValue: true } },
    { issue: 24, name: "多组堆叠图", kind: "stacked-bar", flags: { stacked: true, grouped: true } },
    { issue: 25, name: "针状图", kind: "stem" },
    { issue: 26, name: "多组针状图", kind: "stem", flags: { grouped: true } },
    { issue: 27, name: "三维针状图", kind: "stem3" },
    { issue: 28, name: "柱状图误差棒", kind: "error-bar", flags: { grouped: true } },
    { issue: 29, name: "进阶折线图", kind: "error-line" },
    { issue: 30, name: "面积填充图", kind: "area", flags: { stacked: true, filled: true } },
    { issue: 31, name: "堆叠折线图", kind: "multi-panel", flags: { panelLayout: "grid" } },
    { issue: 32, name: "等高线图", kind: "contour" },
    { issue: 33, name: "等高线填充图", kind: "contour", flags: { filled: true } },
    { issue: 34, name: "箱线图", kind: "box" },
    { issue: 35, name: "填充箱线图", kind: "box", flags: { filled: true } },
    { issue: 36, name: "横向单组柱状图", kind: "bar", flags: { horizontal: true } },
    { issue: 37, name: "三维折线图", kind: "line3" },
    { issue: 38, name: "饼图", kind: "pie" },
    { issue: 39, name: "阶梯图", kind: "step" },
    { issue: 40, name: "带偏移扇区的饼图", kind: "pie", flags: { exploded: true } },
    { issue: 41, name: "气泡图", kind: "bubble", flags: { colorByValue: true } },
    { issue: 42, name: "气泡矩阵图", kind: "bubble-matrix", flags: { colorByValue: true } },
    { issue: 43, name: "直方图", kind: "histogram", flags: { grouped: true } },
    { issue: 44, name: "二元直方图", kind: "histogram2" },
    { issue: 45, name: "带直方图的散点图", kind: "scatter-marginal" },
    { issue: 46, name: "帕累托图", kind: "pareto" },
    { issue: 47, name: "词云图", kind: "word-cloud" },
    { issue: 48, name: "平行坐标图", kind: "parallel", flags: { grouped: true } },
    { issue: 49, name: "散点矩阵图", kind: "scatter-matrix" },
    { issue: 50, name: "分簇散点图", kind: "jitter", flags: { grouped: true } },
    { issue: 51, name: "抖动控制的分簇散点图", kind: "jitter", flags: { grouped: true, jitter: true } },
    { issue: 52, name: "三维分簇散点图", kind: "scatter3", flags: { jitter: true, colorByValue: true } },
    { issue: 53, name: "网格曲面图", kind: "surface", flags: { filled: false } },
    { issue: 54, name: "带帷幕的网格曲面图", kind: "surface", flags: { filled: false, curtain: true } },
    { issue: 55, name: "带等高线的网格曲面图", kind: "surface", flags: { filled: false, withContours: true } },
    { issue: 56, name: "曲面图", kind: "surface", flags: { filled: true } },
    { issue: 57, name: "光影曲面图", kind: "surface", flags: { filled: true, lighting: true } },
    { issue: 58, name: "伪彩图", kind: "heatmap", flags: { colorByValue: true }, category: "等高线与场图" },
    { issue: 59, name: "光影伪彩图", kind: "heatmap", flags: { colorByValue: true, lighting: true }, category: "等高线与场图" },
    { issue: 60, name: "瀑布图", kind: "waterfall" },
    { issue: 61, name: "横向多组堆叠图", kind: "stacked-bar", flags: { stacked: true, grouped: true, horizontal: true } },
    { issue: 62, name: "水平三维柱状图", kind: "bar3", flags: { horizontal: true } },
    { issue: 63, name: "高度赋色的水平三维柱状图", kind: "bar3", flags: { horizontal: true, colorByValue: true } },
    { issue: 64, name: "渐变水平三维柱状图", kind: "bar3", flags: { horizontal: true, colorByValue: true, gradient: true } },
    { issue: 65, name: "带等高线的曲面图", kind: "surface", flags: { filled: true, withContours: true } },
    { issue: 66, name: "条带图", kind: "ribbon" },
    { issue: 67, name: "三角网格图", kind: "tri-mesh" },
    { issue: 68, name: "三角曲面图", kind: "tri-surface", flags: { filled: true } },
    { issue: 69, name: "带误差棒的折线图", kind: "error-line" },
    { issue: 70, name: "带误差棒的柱状图", kind: "error-bar" },
    { issue: 71, name: "三维饼图", kind: "pie3" },
    { issue: 72, name: "金字塔图", kind: "pyramid", flags: { horizontal: true } },
    { issue: 73, name: "带等高线的光影曲面图", kind: "surface", flags: { filled: true, withContours: true, lighting: true } },
    { issue: 74, name: "双对数刻度折线图", kind: "line", flags: { logX: true, logY: true } },
    { issue: 75, name: "对数刻度柱状图", kind: "bar", flags: { logY: true } },
    { issue: 76, name: "半对数刻度折线图", kind: "line", flags: { logX: true } },
    { issue: 77, name: "对数刻度横向柱状图", kind: "bar", flags: { horizontal: true, logX: true } },
    { issue: 78, name: "进阶词云图", kind: "word-cloud", flags: { colorByValue: true } },
    { issue: 79, name: "无线条等高线填充图", kind: "contour", flags: { filled: true } },
    { issue: 80, name: "羽状图", kind: "vector2" },
    { issue: 81, name: "极坐标折线图", kind: "polar-line", flags: { grouped: true } },
    { issue: 82, name: "箭头图", kind: "vector2" },
    { issue: 83, name: "三维箭头图", kind: "vector3" },
    { issue: 84, name: "极坐标散点图", kind: "polar-scatter", flags: { grouped: true } },
    { issue: 85, name: "模值赋色的箭头图", kind: "vector2", flags: { colorByValue: true } },
    { issue: 86, name: "带置信区间的折线图", kind: "confidence", flags: { filled: true } },
    { issue: 87, name: "模值赋色的三维箭头图", kind: "vector3", flags: { colorByValue: true } },
    { issue: 88, name: "无向图", kind: "network" },
    { issue: 89, name: "有向图", kind: "network", flags: { directed: true } },
    { issue: 90, name: "带权重的有向图", kind: "network", flags: { directed: true, colorByValue: true } },
    { issue: 91, name: "不等宽柱状图", kind: "variable-bar" },
    { issue: 92, name: "折线图升级", kind: "line", flags: { grouped: true } },
    { issue: 93, name: "带类别标签的散点图", kind: "scatter", flags: { grouped: true, labels: false } },
    { issue: 94, name: "带置信区间的折线散点图", kind: "confidence", flags: { filled: true, labels: false } },
    { issue: 95, name: "双向柱状图", kind: "bar", flags: { grouped: true } },
    { issue: 96, name: "分组箱线图", kind: "box", flags: { grouped: true } },
    { issue: 97, name: "多子图", kind: "multi-panel", flags: { panelLayout: "grid", panelCharts: ['error-bar', 'line', 'pie', 'stacked-bar'] } },
    { issue: 98, name: "大小不同多子图", kind: "multi-panel", flags: { panelLayout: "bottom-span", panelCharts: ['error-bar', 'line', 'area'] } },
    { issue: 99, name: "正负柱状图", kind: "bar" },
    { issue: 100, name: "紧凑排列多子图", kind: "multi-panel", flags: { panelLayout: "compact", panelCharts: ['error-bar', 'line', 'stacked-bar', 'pie'] } },
    { issue: 101, name: "人口金字塔图", kind: "pyramid", flags: { horizontal: true } },
    { issue: 102, name: "分组填充箱线图", kind: "box", flags: { grouped: true, filled: true } },
    { issue: 103, name: "分组散点图", kind: "scatter", flags: { grouped: true } },
    { issue: 104, name: "带缺口的分组箱线图", kind: "box", flags: { grouped: true, notched: true } },
    { issue: 105, name: "带缺口的分组填充箱线图", kind: "box", flags: { grouped: true, filled: true, notched: true } },
    { issue: 106, name: "带误差棒的堆叠柱状图", kind: "error-bar", flags: { stacked: true } },
    { issue: 107, name: "标签散点图", kind: "scatter", flags: { labels: true } },
    { issue: 108, name: "特征渲染的标签散点图", kind: "scatter", flags: { labels: true, colorByValue: true } },
    { issue: 109, name: "特征渲染的标签气泡散点图", kind: "bubble", flags: { labels: true, colorByValue: true } },
    { issue: 110, name: "水平双向柱状图", kind: "bar", flags: { horizontal: true, grouped: true } },
    { issue: 111, name: "带线标记的图", kind: "line", flags: { annotation: "line" } },
    { issue: 112, name: "带阴影标记的图", kind: "line", flags: { annotation: "band" } },
    { issue: 113, name: "带箭头标记的图", kind: "line", flags: { annotation: "arrow" } },
    { issue: 114, name: "带图形标记的图", kind: "stem", flags: { annotation: "shape" } },
    { issue: 115, name: "带Latex公式的图", kind: "line", flags: { annotation: "formula" } },
    { issue: 116, name: "带时间刻度的图", kind: "line", flags: { timeX: true } },
    { issue: 117, name: "气泡云图", kind: "bubble-cloud", flags: { labels: true } },
    { issue: 118, name: "进阶气泡图", kind: "bubble", flags: { colorByValue: true } },
    { issue: 119, name: "分组气泡图", kind: "bubble", flags: { grouped: true } },
    { issue: 120, name: "分组气泡云图", kind: "bubble-cloud", flags: { grouped: true, labels: true } },
    { issue: 121, name: "图中图", kind: "inset" },
    { issue: 122, name: "函数折线图", kind: "line" },
    { issue: 123, name: "水平正负柱状图", kind: "bar", flags: { horizontal: true } },
    { issue: 124, name: "三维气泡图", kind: "scatter3" },
    { issue: 125, name: "特征渲染的三维气泡图", kind: "scatter3", flags: { colorByValue: true } },
    { issue: 126, name: "分组三维气泡图", kind: "scatter3", flags: { grouped: true } },
    { issue: 127, name: "进阶气泡热图", kind: "bubble-matrix", flags: { colorByValue: true } },
    { issue: 128, name: "函数三维折线图", kind: "line3", flags: { grouped: true } },
    { issue: 129, name: "函数网格曲面图", kind: "surface", flags: { filled: false } },
    { issue: 130, name: "函数曲面图", kind: "surface", flags: { filled: true } },
    { issue: 131, name: "函数等高线图", kind: "contour" },
    { issue: 132, name: "函数等高线填充图", kind: "contour", flags: { filled: true } },
    { issue: 133, name: "函数极坐标折线图", kind: "polar-line" },
    { issue: 134, name: "隐函数折线图", kind: "contour", flags: { implicit: true } },
    { issue: 135, name: "隐函数曲面图", kind: "implicit-surface", flags: { implicit: true, filled: true } },
    { issue: 136, name: "极坐标气泡图", kind: "polar-bubble", flags: { colorByValue: true } },
    { issue: 137, name: "极坐标分组气泡图", kind: "polar-bubble", flags: { grouped: true } },
    { issue: 138, name: "极坐标直方图", kind: "polar-histogram" },
    { issue: 139, name: "罗盘图", kind: "compass" },
];

function guideFor(spec: L1502Spec): string {
    const notes = [KINDS[spec.kind].guide];
    if (spec.kind === 'dual-axis') notes.push(`本期默认采用${spec.dualMode === 'bar' ? '双轴柱形' : spec.dualMode === 'mixed' ? '左轴柱形和右轴曲线' : '双轴曲线'}。`);
    if (spec.issue === 10) notes.push('多组柱形使用相同位置并以不同宽度叠加，不计算累计总量。');
    if (spec.issue === 29) notes.push('同时保留观测误差、模型曲线和模型已计算上下界；曲线拟合应在导入前完成。');
    if (spec.issue === 31) notes.push('原图是纵向排列的独立系列坐标轴；不把各系列数值相加。');
    if (spec.issue === 76) notes.push('本期来源同时含 X 轴与 Y 轴半对数两种示例；默认 X 轴对数，可切换对数轴。');
    if (spec.issue === 80) notes.push('羽状结构从一条共同基线上依次排列各向量，XY 为其基线起点。');
    if (spec.issue === 93) notes.push('类别标签采用分组图例。');
    if (spec.issue === 97) notes.push('2×2 面板依次为左上误差柱、右上折线、左下饼图、右下堆叠柱形。');
    if (spec.issue === 100) notes.push('紧凑 2×2 面板依次为左上误差柱、右上折线、左下堆叠柱形、右下饼图。');
    if (spec.issue === 98) notes.push('左上误差柱、右上折线；底部重叠面积面板横跨两列。');
    if (spec.notched) notes.push('缺口采用中位数 ± 1.57×IQR/√n 的近似公式；仅作样本分布提示，不直接代表已检验的统计结论。');
    if (spec.annotation) notes.push('参考线、阴影、箭头、图形及公式为可修改的图上注释，与输入数值系列分别设置。');
    if (spec.annotation === 'formula') notes.push('数学标注以可编辑文字展示，可输入 Unicode 数学符号；不执行 MATLAB LaTeX 解释器。');
    if (spec.logX || spec.logY) notes.push('对数轴上的数值需大于零，请核对输入单位和坐标范围。');
    if (spec.implicit && spec.kind === 'contour') notes.push('Z 存储二维标量 F，隐函数曲线采用 F=0 等值线；演示为 x²+y²−2.25。');
    notes.push(`图式参考：L1502 / ${spec.folder}。网页图形由网站独立重建，示例为独立生成的演示数据，不是原文件的测量结果。`);
    return notes.join(' ');
}

export const L1502_SPECS: readonly L1502Spec[] = ENTRIES.map(entry => ({
    issue: entry.issue, folder: `Matlab论文插图绘制模板第${entry.issue}期-${entry.name}`, kind: entry.kind, ...entry.flags,
}));

export const L1502_TEMPLATES: DrawingTemplate[] = ENTRIES.map((entry, index) => {
    const spec = L1502_SPECS[index], kind = KINDS[spec.kind];
    const id = `l1502-${String(spec.issue).padStart(3, '0')}`;
    const category = entry.category ?? kind.category;
    return {
        id, name: entry.name, english: `L1502 ${String(spec.issue).padStart(3, '0')} · ${kind.english}`,
        chartId: spec.kind === 'bar' && spec.horizontal ? 'horizontal-bar' : kind.chartId,
        category, description: kind.description, requirement: kind.requirement, tag: `L1502 第 ${spec.issue} 期`,
        guide: guideFor(spec), xLabel: spec.kind.startsWith('polar-') ? '角度 (rad)' : 'X',
        yLabel: spec.kind.startsWith('polar-') && spec.kind !== 'polar-histogram' ? '半径' : 'Y',
        demo: createL1502Demo(spec), preview: `/drawing-previews/${id}.svg`, l1502: spec,
    };
});
