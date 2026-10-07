% 不等宽柱状图绘制模板


%% 数据准备
% 读取数据
load data.mat

%% 颜色定义

map = TheColor('sci',2064,'map',5);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 15;
figureHeight = 12;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);
hold on

%% 不等宽柱状图绘制
for i = 1:5
    GO(i) = bar(x,y,'histc');
    GO(i).FaceVertexCData = map(i,1:3);
end
BW = bar(x,y,'histc');
hTitle = title('Bar chart with unequal width');
hXLabel = xlabel('Scale');
hYLabel = ylabel('RMSE (m)');

%% 细节优化
% 线面属性调整
L = findobj(gca,'Type','line');
P = findobj(gca,'Type','Patch');
for i = 1:6
    L(i).Marker = 'none';
end
P(1).EdgeColor = [0 0 0];
P(1).LineWidth = 1;
P(1).FaceVertexCData = map;
% 坐标区调整
set(gca, 'Box', 'off', ...                                         % 边框
         'LineWidth', 1, 'GridLineStyle', '-',...                  % 坐标轴线宽
         'XGrid', 'on', 'YGrid', 'on', ...                         % 网格
         'TickDir', 'out', 'TickLength', [.015 .015], ...          % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...             % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1],...           % 坐标轴颜色
         'YTick', 0:10:100,...                                     % 坐标轴刻度
         'Ylim' , [-2 60], ...                                     
         'Xlim' , [-3 93], ...
         'XTick', 0:10:100)
% Legend 
hLegend = legend(GO, ...
                 'A', 'B', 'C', 'D', 'E', ...
                 'Location', 'eastoutside');
% 字体和字号
set(gca, 'FontName', 'Arial', 'FontSize', 10)
set([hXLabel, hYLabel], 'FontSize', 11, 'FontName', 'Arial')
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