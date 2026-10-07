% 函数三维折线图绘制模板

%% 数据准备
% 构造函数
xt = @(t) exp(-t/10).*sin(5*t);
yt = @(t) exp(-t/10).*cos(5*t);
zt = @(t) t;

%% 颜色定义
C = TheColor('xkcd',[507 270 627 725]);
% C = TheColor('sci',2068,'map',4);
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

%% 函数三维折线图绘制
f1 = fplot3(xt, yt, zt, [0 2*pi]);
hold on
f2 = fplot3(xt, yt, zt, [2*pi 4*pi]);
f3 = fplot3(xt, yt, zt, [4*pi 6*pi]);
f4 = fplot3(xt, yt, zt, [6*pi 8*pi]);
hTitle = title('Fplot3 Plot');
hXLabel = xlabel('x');
hYLabel = ylabel('y');
hZLabel = zlabel('z');

%% 细节优化
% 线条属性调整
set(f1,'LineStyle','-','LineWidth',2.5,'Color',C1)
set(f2,'LineStyle','-','LineWidth',2.5,'Color',C2)
set(f3,'LineStyle','-','LineWidth',2.5,'Color',C3)
set(f4,'LineStyle','-','LineWidth',2.5,'Color',C4)
% 坐标区调整
set(gca, 'Box', 'on', ...                                          % 边框
         'LineWidth',1,...                                         % 线宽
         'XGrid', 'on', 'YGrid', 'on', 'ZGrid', 'on',...           % 网格
         'TickDir', 'out', 'TickLength', [.005 .005])              % 刻度
hLegend = legend([f1,f2,f3,f4], ...
    'samp1', 'samp2', 'samp3', 'samp4', ...
    'Location', 'northwest');
% Legend位置微调 
P = hLegend.Position;
hLegend.Position = P + [0.01 -0.15 0 0];
% 字体字号
set(gca, 'FontName', 'Arial', 'FontSize', 10)
set([hXLabel,hYLabel,hZLabel,hLegend], 'FontName',  'Arial', 'FontSize', 10)
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