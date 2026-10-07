% 进阶气泡图绘制模板


%% 数据准备
% 读取数据
load data.mat
% 初始化绘图参数
xx = data(:,1);
yy = data(:,2);
f1 = data(:,3);
f2 = data(:,3)*10;

%% 颜色定义

map = TheColor('sci',2068);
% map = flipud(map);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 16;
figureHeight = 12;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);

%% 进阶气泡图绘制
t = tiledlayout(1,1);
nexttile
bubblechart(xx, yy, f1, f2,'MarkerFaceAlpha',0.8);
bubblesize([5 30])
hTitle = title('BubblePlus Plot');
hXLabel = xlabel('XAxis');
hYLabel = ylabel('YAxis');

%% 细节优化
% 赋色
colormap(map)
% 坐标轴美化
set(gca, 'Box', 'off', ...                                       % 边框
         'Layer','top',...                                       % 图层
         'LineWidth',1,...                                       % 线宽
         'XGrid', 'off', 'YGrid', 'off', ...                     % 网格
         'TickDir', 'out', 'TickLength', [.01 .01], ...          % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...           % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1],...         % 坐标轴颜色
         'XTick', 0:2:24,...                                     % 坐标区刻度、范围
         'XLim', [0 23],...
         'YTick', 0:0.2:1.2,...
         'YLim', [0 1.2])
% 添加图例
% 颜色条
cb = colorbar;
cb.Label.String = 'Feature2';
cb.Layout.Tile = 'east';
% 气泡尺寸
blgd = bubblelegend('Feature1',...
                    'Style','vertical',...
                    'BubbleSizeOrder','descending',...
                    'box','on',...
                    'NumBubbles',3,... ...
                    'FontName', 'Arial',...
                    'FontSize', 9);
bt = get(blgd,'Title');
bt.FontWeight = 'normal';
bt.FontName = 'Arial';
bt.FontSize = 9;
blgd.Layout.Tile = 'east';
% 字体和字号
set(gca, 'FontName', 'Arial', 'FontSize', 11)
set([hXLabel,hYLabel], 'FontName',  'Arial', 'FontSize', 11)
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
