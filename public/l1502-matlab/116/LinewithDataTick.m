% 带时间刻度的图绘制模板

%% 数据准备
% 读取数据
load RideSummary.mat

%% 颜色定义

C = TheColor('xkcd',384);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 15;
figureHeight = 12;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);
hold on

%% 带时间刻度的图绘制
p = plot(byDate.Date, byDate.MeanDuration);
xlim([datetime(2012,7,1) datetime(2012,8,31)])
datetick('x','mm-dd','keepticks')
xtickangle(40)
hTitle = title('Mean Ride Duration between July and August 2012');
hXLabel = xlabel('Date');
hYLabel = ylabel('Mean Ride Duration');

%% 细节优化
% 赋色及属性调整
set(p,'LineStyle','-','LineWidth',1.5, 'Color',C)
% 坐标区调整
set(gca, 'Box', 'off', ...                                % 边框
         'Layer','top',...                                % 图层
         'LineWidth',1,...                                % 线宽
         'XGrid', 'on', 'YGrid', 'on', ...                % 网格
         'TickDir', 'out', 'TickLength', [0.01 0.01], ... % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...    % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])     % 坐标轴颜色
% 字体和字号
set(gca, 'FontName', 'Arial', 'FontSize', 10)
set([hXLabel,hYLabel], 'FontSize', 11, 'FontName', 'Arial')
set(hTitle, 'FontSize', 12, 'FontWeight' , 'bold')
% 背景颜色
set(gcf,'Color',[1 1 1])
% 添加上、右框线
xc = get(gca,'XColor');
yc = get(gca,'YColor');
unit = get(gca,'units');
ax = axes( 'Units', unit,...
           'Position',get(gca,'Position'),...
           'XAxisLocation','top',...
           'YAxisLocation','right',...
           'Color','none',...
           'XColor',xc,...
           'YColor',yc);
set(ax, 'linewidth',1,...
        'XTick', [],...
        'YTick', []);

%% 图片输出
figW = figureWidth;
figH = figureHeight;
set(figureHandle,'PaperUnits',figureUnits);
set(figureHandle,'PaperPosition',[0 0 figW figH]);
fileout = 'test';
print(figureHandle,[fileout,'.png'],'-r300','-dpng');