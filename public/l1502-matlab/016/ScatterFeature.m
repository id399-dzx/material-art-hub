% 散点图（特征渲染赋色）绘制模板


%% 数据准备
% 读取数据
data = load('Vaihingen_Strip_05_part.txt');
% x坐标
x = data(:,1);
% y坐标
y = data(:,2);
% 特征向量
f = data(:,3);
% f = data(:,12);

%% 颜色定义

map = addcolorplus(305);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 20;
figureHeight = 11;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);
hold on

%% 散点图（特征渲染赋色）绘制
scatter(x, y, 5, f, 'filled')

%% 细节优化
% 赋色
colormap(map)
% 添加颜色条
colorbar
% 删除坐标刻度
set(gca,'xtick',[])
set(gca,'ytick',[])
% 坐标区显示调整
axis off tight equal
% 删除白边
set(gca,'LooseInset',get(gca,'TightInset'))
% 调节颜色条标记字体字号
set(gca, 'FontName', 'Helvetica', 'FontSize', 10)
% 背景颜色
set(gcf,'Color',[1 1 1])

%% 图片输出
% figW = figureWidth;
% figH = figureHeight;
% set(figureHandle,'PaperUnits',figureUnits);
% set(figureHandle,'PaperPosition',[0 0 figW figH]);
% fileout = 'test';
% print(figureHandle,[fileout,'.png'],'-r300','-dpng');
