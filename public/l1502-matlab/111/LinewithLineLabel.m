% 带线标记的图绘制模板


%% 数据准备
% 读取数据
load data.mat
% 初始化绘图参数
X = data(:,1);
Y = data(:,2);

%% 颜色定义

C = TheColor('xkcd',[454 384 270 627]);
C1 = C(1,1:3);
C2 = C(2,1:3);
C3 = C(3,1:3);
C4 = C(4,1:3);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 15;
figureHeight = 12;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);
hold on

%% 带线标记的图绘制
% 原始数据绘制
L = line(X,Y);
% 标记线1绘制
x = 100;
y = Y(11);
LL1 = line([x x 0], [0 y y]);
S1 = scatter(x,y,60,C2,'filled');
% 标记线2绘制
x = 50;
y = Y(6);
LL2 = line([x x 0], [0 y y]);
S2 = scatter(x,y,60,C3,'filled');
% 标记线3绘制
x = 25;
y = Y(4)-Y(3);
LL3 = line([x x 0], [0 y y]);
S3 = scatter(x,y,60,C4,'filled');
hTitle = title('Closed loop response');
hXLabel = xlabel('Time');
hYLabel = ylabel('Tank temperature (normalized)');

%% 细节优化
% 赋色及属性调整
set(L,'LineStyle','-','LineWidth',3, 'Color',C1)
set(LL1,'LineStyle','-.','LineWidth',2.5, 'Color', C2)
set(LL2,'LineStyle','-.','LineWidth',2.5, 'Color', C3)
set(LL3,'LineStyle','-.','LineWidth',2.5, 'Color', C4)
% 坐标区调整
set(gca, 'Box', 'off', ...                                % 边框
         'Layer','top',...                                % 图层
         'LineWidth',1,...                                % 线宽
         'XGrid', 'off', 'YGrid', 'off', ...              % 网格
         'TickDir', 'out', 'TickLength', [0.01 0.01], ... % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...    % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])     % 坐标轴颜色
% Legend
hLegend = legend([LL1,LL2,LL3], ...
                 'Feature A','Feature B', 'Feature C',...
                 'Location', 'southeast');
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