% 函数极坐标线图绘制模板


%% 数据准备
% 构造函数
f = @(t) sin (5/4 * t);

%% 颜色定义

C = TheColor('sci',1);
C1 = C(1,:);
C2 = C(2,:);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 14;
figureHeight = 14;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]); 

%% 函数极坐标线图绘制
P1 = ezpolar(f,[0,4*pi]);
hold on
P2 = ezpolar(f,[4*pi,8*pi]);
hTitle = title('Plot of Polar Coordinate Defined Function');

%% 细节优化
% 定义线宽和颜色(或线型、符号、线宽和颜色)
set(P1, 'LineWidth', 2,  'Color', C1)
set(P2, 'LineWidth', 2,  'Color', C2)
% 字体和字号
set(gca, 'FontName', 'Arial', 'FontSize', 11)
set(hTitle, 'FontName', 'Arial', 'FontSize', 12, 'FontWeight' , 'bold')
% 背景颜色
set(gcf,'Color',[1 1 1])

%% 图片输出
figW = figureWidth;
figH = figureHeight;
set(figureHandle,'PaperUnits',figureUnits);
set(figureHandle,'PaperPosition',[0 0 figW figH]);
fileout = 'test';
print(figureHandle,[fileout,'.png'],'-r300','-dpng');