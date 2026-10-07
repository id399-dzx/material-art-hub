% 散点图（气泡）绘制模板

%% 数据准备
% 读取数据
load data.mat
% x坐标
xx = data(:,1);
% y坐标
yy = data(:,2);
% 特征（特征大小对应颜色/点的尺寸）
sz = data(:,3);

%% 颜色定义

map = addcolorplus(300);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 12;
figureHeight = 8;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);
hold on

%% 散点图（气泡）绘制
scatter(xx, yy, sz, sz, 'filled', 'MarkerFaceAlpha',0.7)
hTitle = title('Scatter Bubble');
hXLabel = xlabel('Number of Sites');
hYLabel = ylabel('MAE');

%% 细节优化
% 赋色
colormap(map)
% 坐标轴美化
set(gca, 'Box', 'on', ...                                        % 边框
         'XGrid', 'off', 'YGrid', 'off', ...                     % 网格
         'TickDir', 'in', 'TickLength', [.01 .01], ...           % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...           % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1],...         % 坐标轴颜色
         'XTick', 0:2:22,...                                     % 坐标区刻度、范围
         'XLim', [0 21],...
         'YTick', 0:0.2:1.2,...
         'YLim', [0 1.2])
% 字体和字号
set(gca, 'FontName', 'Helvetica')
set([hXLabel, hYLabel], 'FontName', 'AvantGarde')
set(gca, 'FontSize', 10)
set([hXLabel, hYLabel], 'FontSize', 11)
set(hTitle, 'FontSize', 11, 'FontWeight' , 'bold')
% 背景颜色
set(gcf,'Color',[1 1 1])

%% 图片输出
% figW = figureWidth;
% figH = figureHeight;
% set(figureHandle,'PaperUnits',figureUnits);
% set(figureHandle,'PaperPosition',[0 0 figW figH]);
% fileout = 'test';
% print(figureHandle,[fileout,'.png'],'-r300','-dpng');
