% 水平双向柱状图绘制模板


%% 数据准备
% 读取数据
load data.mat
% 初始化参数
X = x;
Y1 = dataset1;
Y2 = dataset2;

%% 颜色定义

C1 = TheColor('xkcd',83);
C2 = TheColor('xkcd',426);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 16;
figureHeight = 12;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]); % define the new figure dimensions
hold on

%% 水平双向柱状图绘制
GO1 = barh(X,Y1,0.6,'EdgeColor','k','LineWidth',1);
GO2 = barh(X,Y2,0.6,'EdgeColor','k','LineWidth',1);
hTitle = title('Bidirectional barh chart');
hXLabel = xlabel('Xaxis');
hYLabel = ylabel('Yaxis');

%% 细节优化
% 赋色
GO1.FaceColor = C1;
GO2.FaceColor = C2;
% 基线调整
BL = get(GO2,'BaseLine');
BL.LineWidth = 1;
% 坐标区调整
set(gca, 'Box', 'off', ...                                         % 边框
         'LineWidth', 1, 'GridLineStyle', '-',...                  % 坐标轴线宽
         'XGrid', 'off', 'YGrid', 'off', ...                       % 网格
         'TickDir', 'out', 'TickLength', [.01 .01], ...            % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...             % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])              % 坐标轴颜色
set(gca, 'YTick', 1:6,...
         'Ylim' , [0.5 6.5], ... 
         'Yticklabel',{'A','B','C','D','E','F'},...
         'XTick', -8000:4000:12000)
% Legend
hLegend = legend([GO1,GO2], ...
                 'Income','Payout', ...
                 'Location', 'northwest');
% 字体和字号
set(gca, 'FontName', 'Arial', 'FontSize', 10)
set([hLegend,hXLabel,hYLabel], 'FontSize', 11, 'FontName', 'Arial')
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