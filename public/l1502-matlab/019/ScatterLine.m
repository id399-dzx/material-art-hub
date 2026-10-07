% 散点折线图绘制模板


%% 数据准备
% 读取数据
% 离散点
load data.mat
% 折线
xx = 0:0.001:160;
yy1 = 0:0.001:160;
yy2 = 0.84*xx+0.5;

%% 颜色定义

C0 = addcolorplus(1);
C1 = addcolorplus(221);
C2 = addcolorplus(134);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 12;
figureHeight = 8;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);
hold on

%% 散点折线图绘制
scatter(x, y, 3, repmat(C0,length(x),1), 'filled')
Line1 = line(xx,yy1);
Line2 = line(xx,yy2);
hTitle = title('Satellite-derived bathymetry');
hXLabel = xlabel('ICESat-2 bathymetric points in depth (m)');
hYLabel = ylabel('Estimated depth (m)');
hLegend = legend([Line1,Line2], ...
                 'A1', 'A2', ...
                 'Location', 'southeast');

%% 细节优化
% 线条美化
set(Line1, 'LineStyle', '-','Marker', 'none','LineWidth', 1.5,  'Color', C1)
set(Line2, 'LineStyle', '-','Marker', 'none','LineWidth', 1.5,  'Color', C2)
% 坐标轴美化
set(gca, 'Box', 'on', ...                                         % 边框
         'XGrid', 'off', 'YGrid', 'off', ...                      % 网格
         'TickDir', 'in', 'TickLength', [.015 .015], ...          % 刻度
         'XMinorTick', 'on', 'YMinorTick', 'on', ...              % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1],...          % 坐标轴颜色
         'XTick', 0:40:160,...                                    % 坐标区刻度、范围
         'XLim', [0 160],...
         'YTick', 0:40:160,...
         'YLim', [0 160])
% 字体和字号
set(gca, 'FontName', 'Helvetica')
set([hXLabel, hYLabel, hLegend], 'FontName', 'AvantGarde')
set(gca, 'FontSize', 10)
set([hXLabel, hYLabel, hLegend], 'FontSize', 11)
set(hTitle, 'FontSize', 11, 'FontWeight' , 'bold')
% 背景颜色
set(gcf,'Color',[1 1 1])

%% 图片输出
figW = figureWidth;
figH = figureHeight;
set(figureHandle,'PaperUnits',figureUnits);
set(figureHandle,'PaperPosition',[0 0 figW figH]);
fileout = 'test';
print(figureHandle,[fileout,'.png'],'-r600','-dpng');
