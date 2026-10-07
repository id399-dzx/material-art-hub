% 图中图绘制模板


%% 数据准备
% 数据构造
t = linspace(0,2*pi);
t(1) = eps;
y = sin(t);

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

%% 图中图绘制
% 主图绘制
handaxes1 = axes('Units','normalized','Position', [0.12 0.12 0.8 0.8]); 
plot(t,y,'Color',C1,'LineWidth',2)
hXLabel1 = xlabel('t');
hYLabel1 = ylabel('sin(t)');
hTitle = title('Plot in plot');
% 次图1绘制
handaxes2 = axes('Units','normalized','Position', [0.57 0.57 0.28 0.28]);
fill(t, y.^2, C2,'LineWidth',1.2)
hXLabel2 = xlabel('t');
hYLabel2 = ylabel('(sin(t))^2');
% 次图2绘制
handaxes3 = axes('Units','normalized','Position', [0.22 0.22 0.28 0.28]);
plot(t,y.^3,'Color',C4,'LineWidth',2)
hXLabel3 = xlabel('t');
hYLabel3 = ylabel('(sin(t))^3');

%% 细节优化
% 主图坐标区调整
set(handaxes1, 'Box', 'off', ...                                % 边框
               'Layer','top',...                                % 图层
               'LineWidth',1,...                                % 线宽
               'XGrid', 'on', 'YGrid', 'on', ...                % 网格
               'TickDir', 'out', 'TickLength', [0.01 0.01], ... % 刻度
               'XMinorTick', 'off', 'YMinorTick', 'off', ...    % 小刻度
               'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])     % 坐标轴颜色
set(handaxes1, 'XLim',[0 2*pi])
set(handaxes1, 'FontName', 'Arial', 'FontSize', 10)
set([hXLabel1,hYLabel1], 'FontSize', 11, 'FontName', 'Arial')
xc = get(handaxes1,'XColor');
yc = get(handaxes1,'YColor');
unit = get(handaxes1,'units');
ax = axes( 'Units', unit,...
           'Position',get(handaxes1,'Position'),...
           'XAxisLocation','top',...
           'YAxisLocation','right',...
           'Color','none',...
           'XColor',xc,...
           'YColor',yc);
set(ax, 'linewidth',1,...
        'XTick', [],...
        'YTick', []);
% 次图1坐标区调整
set(handaxes2, 'Box', 'off', ...                                % 边框
               'Layer','top',...                                % 图层
               'LineWidth',1,...                                % 线宽
               'XGrid', 'on', 'YGrid', 'on', ...                % 网格
               'TickDir', 'out', 'TickLength', [0.01 0.01], ... % 刻度
               'XMinorTick', 'off', 'YMinorTick', 'off', ...    % 小刻度
               'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])     % 坐标轴颜色
set(handaxes2, 'FontName', 'Arial', 'FontSize', 9)
set([hXLabel2,hYLabel2], 'FontSize', 10, 'FontName', 'Arial')
xc = get(handaxes2,'XColor');
yc = get(handaxes2,'YColor');
unit = get(handaxes2,'units');
ax = axes( 'Units', unit,...
           'Position',get(handaxes2,'Position'),...
           'XAxisLocation','top',...
           'YAxisLocation','right',...
           'Color','none',...
           'XColor',xc,...
           'YColor',yc);
set(ax, 'linewidth',1,...
        'XTick', [],...
        'YTick', []);
% 次图2坐标区调整
set(handaxes3, 'Box', 'off', ...                                % 边框
               'Layer','top',...                                % 图层
               'LineWidth',1,...                                % 线宽
               'XGrid', 'on', 'YGrid', 'on', ...                % 网格
               'TickDir', 'out', 'TickLength', [0.01 0.01], ... % 刻度
               'XMinorTick', 'off', 'YMinorTick', 'off', ...    % 小刻度
               'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])     % 坐标轴颜色
set(handaxes3, 'FontName', 'Arial', 'FontSize', 9)
set([hXLabel3,hYLabel3], 'FontSize', 10, 'FontName', 'Arial')
xc = get(handaxes3,'XColor');
yc = get(handaxes3,'YColor');
unit = get(handaxes3,'units');
ax = axes( 'Units', unit,...
           'Position',get(handaxes3,'Position'),...
           'XAxisLocation','top',...
           'YAxisLocation','right',...
           'Color','none',...
           'XColor',xc,...
           'YColor',yc);
set(ax, 'linewidth',1,...
        'XTick', [],...
        'YTick', []);
% 标题
set(hTitle, 'FontSize', 12, 'FontWeight' , 'bold')
% 背景颜色
set(gcf,'Color',[1 1 1])

%% 图片输出
figW = figureWidth;
figH = figureHeight;
set(figureHandle,'PaperUnits',figureUnits);
set(figureHandle,'PaperPosition',[0 0 figW figH]);
fileout = 'test';
print(figureHandle,[fileout,'.png'],'-r300','-dpng');