% 分组气泡图绘制模板


%% 数据准备
% 读取数据
load data.mat
% 初始化绘图参数
X1 = x;
X2 = x;
Y1 = y1;
Y2 = y2;
SZ1 = sz1;
SZ2 = sz2;

%% 颜色定义

map = TheColor('sci',500);
C1 = repmat(map(1,1:3),20,1);
C2 = repmat(map(2,1:3),20,1);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 16;
figureHeight = 12;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);

%% 分组气泡图绘制
t = tiledlayout(1,1);
nexttile
bubblechart(X1,Y1,SZ1,C1)
hold on
bubblechart(X2,Y2,SZ2,C2)
bubblesize([5 30])
hTitle = title('BubbleGrouped chart');
hXLabel = xlabel('Xaxis');
hYLabel = ylabel('Yaxis');

%% 细节优化
% 坐标区调整
set(gca, 'Box', 'off', ...                                     % 边框
         'LineWidth',1,...                                     % 线宽
         'XGrid', 'on', 'YGrid', 'on',...                      % 网格
         'TickDir', 'out', 'TickLength', [.01 .01], ...        % 刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])          % 坐标轴颜色
% 添加图例
% 标签
hLegend = legend('Sample1','Sample2','Linewidth',0.5);
hLegend.Layout.Tile = 'east';
% 气泡尺寸
blgd = bubblelegend('SZ',...
                    'Style','vertical',...
                    'BubbleSizeOrder','descending',...
                    'box','on',...
                    'NumBubbles',3,... ...
                    'FontName', 'Arial',...
                    'FontSize', 9);
blgd.Layout.Tile = 'east';
bt = get(blgd,'Title');
bt.FontWeight = 'normal';
bt.FontName = 'Arial';
bt.FontSize = 9;
% 字体和字号
set(gca, 'FontName', 'Arial', 'FontSize', 11)
set([hLegend,hXLabel,hYLabel], 'FontName',  'Arial', 'FontSize', 11)
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