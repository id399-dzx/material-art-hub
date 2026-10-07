% 特征渲染的标签散点图绘制模板


%% 数据准备
% 读取数据
load data.mat
% 初始化参数
for i = 1:10
    x(i,1) = data{i,7};
    y(i,1) = data{i,8};
    f(i,1) = data{i,5};
end
lbs = data(:,2);
bs = 250;

%% 颜色定义

map = TheColor('sci',2064);
% map = flipud(map);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 16;
figureHeight = 14;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);
hold on

%% 特征渲染的标签散点图绘制
scatter(x, y, 150, f, 'filled')
for i = 1:length(x)
    text(x(i)+bs,y(i),lbs{i},'HorizontalAlignment','left','VerticalAlignment','middle',...
        'FontSize',10,'FontName','Arail','color','k','FontWeight','normal')
end
hTitle = title('Feature rendered labeled scatter plot');
hXLabel = xlabel('Healthexp');
hYLabel = ylabel('Infmortality');

%% 细节优化
% 赋色
colormap(map)
colorbar
% 坐标区调整
set(gca, 'Box', 'off', ...                                         % 边框
         'LineWidth', 1, 'GridLineStyle', '-',...                  % 坐标轴线宽
         'XGrid', 'on', 'YGrid', 'on', ...                         % 网格
         'TickDir', 'out', 'TickLength', [.005 .005], ...          % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...             % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])              % 坐标轴颜色
set(gca, 'XTick', 2000:2000:10000,...
         'Xlim' , [2000 9000])
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