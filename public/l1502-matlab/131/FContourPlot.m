% 函数等高线图绘制模板

%% 数据准备
% 函数构造
f = @(x,y) sin(2*x) + cos(2*y);
% 初始化绘图参数
LevelStep = 0.2;
LW = 1.5;

%% 颜色定义

map = TheColor('sci',2068);
% map = flipud(map);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 15;
figureHeight = 12;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);

%% 函数等高线图绘制
h = fcontour(f,'LevelStep',LevelStep,...
               'LineWidth',LW);
hTitle = title('Fcontour Plot');
hXLabel = xlabel('XAxis');
hYLabel = ylabel('YAxis');

%% 细节优化
% 赋色
colormap(map)
colorbar
% 坐标轴美化
set(gca, 'Box', 'off', ...                                        % 边框
         'LineWidth', 1,...                                       % 线宽
         'Layer','top',...                                        % 图层
         'XGrid', 'off', 'YGrid', 'off', ...                      % 网格
         'TickDir', 'out', 'TickLength', [.005 .005], ...         % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...            % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])             % 坐标轴颜色
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