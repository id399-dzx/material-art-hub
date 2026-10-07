% 函数折线图绘制模板


%% 数据准备
% 构造函数
fun1 = @(x) sin(1.1*x-pi/5);
fun2 = @(x) sin(1.1*x);
fun3 = @(x) sin(1.1*x+pi/5);
fun4 = @(x) sin(1.1*x+2*pi/5);

%% 颜色定义

C = TheColor('sci',1796);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 15;
figureHeight = 12;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);

%% 函数折线图绘制
p1 = fplot(fun1,[-5 5],'LineStyle','-','Marker','v','LineWidth',2,'MarkerFaceColor',C(1,1:3),'Color',C(1,1:3));
hold on
p2 = fplot(fun2,[-5 5],'LineStyle','-','Marker','o','LineWidth',2,'MarkerFaceColor',C(2,1:3),'Color',C(2,1:3));
p3 = fplot(fun3,[-5 5],'LineStyle','-','Marker','^','LineWidth',2,'MarkerFaceColor',C(3,1:3),'Color',C(3,1:3));
p4 = fplot(fun4,[-5 5],'LineStyle','-','Marker','s','LineWidth',2,'MarkerFaceColor',C(4,1:3),'Color',C(4,1:3));
hTitle = title('Fplot Plot');
hXLabel = xlabel('XAxis');
hYLabel = ylabel('YAxis');

%% 细节调整
% 坐标区属性调整
set(gca, 'Box', 'off', ...                                % 边框
         'LineWidth', 1,...                               % 线宽
         'XGrid', 'off', 'YGrid', 'on', ...               % 网格
         'TickDir', 'out', 'TickLength', [.01 .01], ...   % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...    % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])     % 坐标轴颜色
set(gca, 'XLim',[-5.2 5.2],...
         'YLim',[-1.1 1.1])
% Legend
hLegend = legend([p1,p2,p3,p4], ...
                 'Samp1', 'Samp2','Samp3','Samp4', ...
                 'Location', 'northeast');
% Legend位置微调 
P = hLegend.Position;
hLegend.Position = P + [0.00 0.01 0 0];
% 字体和字号
set(gca, 'FontName', 'Arial', 'FontSize', 10)
set([hLegend, hXLabel, hYLabel], 'FontSize', 11, 'FontName', 'Arial')
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