% 伪彩图绘制模板


%% 数据准备
% 读取数据
load data.mat
[X,Y] = meshgrid(xi,yi);
Z = DSM;

%% 颜色定义

map = TheColor('sci',2068);
% map = flipud(map);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 15;
figureHeight = 10;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);
hold on

%% 伪彩图绘制
p = pcolor(X,Y,Z);
hTitle = title('Pcolor Plot');
hXLabel = xlabel('x');
hYLabel = ylabel('y');

%% 细节优化
% 赋色
colormap(map)
colorbar
% 线调整
p.EdgeColor = 'none';
% 坐标区调整
axis tight
set(gca, 'Box', 'off', ...                                  % 边框
         'LineWidth', 1, 'GridLineStyle', '-',...           % 坐标轴线宽线型
         'Layer','top',...                                  % 图层           
         'XGrid', 'off', 'YGrid', 'off', ...                % 网格
         'TickDir', 'out', 'TickLength', [.01 .01], ...     % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off',...       % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])       % 坐标轴颜色
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
% 字体和字号
set(gca, 'FontName', 'Arial', 'FontSize', 11)
set([hXLabel,hYLabel], 'FontName',  'Arial', 'FontSize', 11)
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