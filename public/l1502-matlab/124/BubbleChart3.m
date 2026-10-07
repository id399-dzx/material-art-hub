% 三维气泡图绘制模板

%% 数据准备
% 读取数据
load carsmall.mat

%% 颜色定义

map = TheColor('sci',500);
C = map(2,1:3);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 15;
figureHeight = 12;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);

%% 三维气泡图绘制
b1 = bubblechart3(MPG,Weight,Displacement,Horsepower,...
    'MarkerFaceAlpha',0.2,...
    'MarkerEdgeColor',C,...
    'MarkerFaceColor',C);
bubblesize([3 30])
view(-41,30)
hTitle = title('Bubble3 chart');
hXLabel = xlabel('Miles Per Gallon (MPG)');
hYLabel = ylabel('Weight');
hZLabel = zlabel('Displacement');

%% 细节优化
% 坐标区调整
set(gca, 'Box', 'on', ...                                                           % 边框
         'XGrid', 'on', 'YGrid', 'on', 'ZGrid', 'on',...                            % 网格
         'TickDir', 'out', 'TickLength', [.01 .01], ...                             % 刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1],'ZColor', [.1 .1 .1])          % 坐标轴颜色
set(gca, 'xlim',[0 50],...
         'zlim',[0 500])
% legend
blgd = bubblelegend('Horsepower');
blgd.Location = 'eastoutside';
bt = get(blgd,'Title');
bt.FontWeight = 'normal';
bt.FontName = 'Arial';
bt.FontSize = 9;
% 字体和字号
set(gca, 'FontName', 'Arial', 'FontSize', 11)
set([hXLabel,hYLabel,hZLabel], 'FontName',  'Arial', 'FontSize', 11)
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