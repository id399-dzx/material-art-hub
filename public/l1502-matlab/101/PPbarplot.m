% 人口金字塔图绘制模板


%% 数据准备
% 读取数据
load data.mat
% 初始化数据
X = x;
Y1 = dataset1;
Y2 = dataset2;
lbs = {'0-4' '5-9' '10-14' '15-19' '20-24' '25-29' '30-34' '35-39' '40-44',...
       '45-49' '50-54' '55-59' '60-64' '65-69' '70-74' '75-79' '80-84' '85-89',...
       '90-94' '95-99' '100+'};

%% 颜色定义

C1 = TheColor('xkcd',260);
C2 = TheColor('xkcd',426);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 13;
figureHeight = 10;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);
hold on

%% 人口金字塔图绘制
GO1 = barh(X,Y1,0.6,'EdgeColor','k','LineWidth',0.7);
GO2 = barh(X,Y2,0.6,'EdgeColor','k','LineWidth',0.7);
hTitle = title('Population pyramid chart');
hXLabel = xlabel('Percentage');
hYLabel = ylabel('Age');

%% 细节优化
% 赋色
GO1.FaceColor = C1;
GO2.FaceColor = C2;
% 基线调整
BL = get(GO2,'BaseLine');
BL.LineWidth = 0.7;
% 坐标区调整
set(gca, 'Box', 'off', ...                                         % 边框
         'LineWidth', 1, 'GridLineStyle', '-',...                  % 坐标轴线宽
         'XGrid', 'off', 'YGrid', 'on', ...                        % 网格
         'TickDir', 'out', 'TickLength', [.015 .015], ...          % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...             % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])              % 坐标轴颜色
set(gca, 'XTick', -6:2:6,...
         'Xlim' , [-6 6], ... 
         'Xticklabel',{'-6%','-4%','-2%','0%','2%','4%','6%'},...
         'YTick', 1:21,...
         'Yticklabel',lbs)
% Legend
hLegend = legend([GO1,GO2], ...
                 'Female','Male', ...
                 'Location', 'northeast');
% 字体和字号
set(gca, 'FontName', 'Arial', 'FontSize', 9)
set([hLegend,hXLabel,hYLabel], 'FontSize', 10, 'FontName', 'Arial')
set(hTitle, 'FontSize', 11, 'FontWeight' , 'bold')
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