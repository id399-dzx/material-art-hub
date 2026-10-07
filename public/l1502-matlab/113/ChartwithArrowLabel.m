% 带箭头标记的图绘制模板


%% 数据准备
% 构造数据
x = -3.0:0.01:3.0;
f = x.^2;
g = 5*sin(x) + 5;
% 交点
xeq(1) = -0.956; yeq(1) = 0.916;
xeq(2) =  2.685; yeq(2) = 7.207;

%% 颜色定义

C = TheColor('xkcd',[454 304 383]);
C1 = C(1,1:3);
C2 = C(2,1:3);
C3 = C(3,1:3);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 15;
figureHeight = 12;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);
hold on

%% 带箭头标记的图绘制
% 线
p1 = plot(x,f);
p2 = plot(x,g);
p3 = plot(xeq,yeq);
% 箭头注释
a1 = annotation('textarrow',[0.394 0.394],[0.350 0.209]);
a2 = annotation('textarrow',[0.799 0.851],[0.697 0.697]);
hTitle = title('f(x) = x^2    g(x) = sin(x) + 5');
hXLabel = xlabel('x');
hYLabel = ylabel('f(x)  g(x)');

%% 细节优化
% 线条及文字属性调整
set(a1,'String','f(x) = g(x)','LineWidth',1.5,'FontName','Arail','FontSize',10)
set(a2,'String','f(x) = g(x)','LineWidth',1.5,'FontName','Arail','FontSize',10)
set(p1,'LineStyle','-','LineWidth',2, 'Color',C1)
set(p2,'LineStyle','-','LineWidth',2, 'Color',C2)
set(p3,'LineStyle','none','Marker','o','MarkerFaceColor',C3,'MarkerEdgeColor',C3,'MarkerSize',10)
% 坐标区调整
set(gca, 'Box', 'off', ...                                % 边框
         'Layer','top',...                                % 图层
         'LineWidth',1,...                                % 线宽
         'XGrid', 'off', 'YGrid', 'off', ...              % 网格
         'TickDir', 'out', 'TickLength', [0.01 0.01], ... % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...    % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])     % 坐标轴颜色
% Legend
hLegend = legend([p1,p2], ...
                 'f(x) = x^2','g(x) = 5*sin(x)+5',...
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