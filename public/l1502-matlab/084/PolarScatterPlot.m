% 极坐标散点图绘制模板

%% 数据准备
% 读取数据
load data0.mat
% 初始化参数
Theta = t;
R1 = r1;
R2 = r2;

%% 颜色定义

C = TheColor('xkcd',[240 588]);
C1 = C(1,1:3);
C2 = C(2,1:3);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 14;
figureHeight = 14;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]); 

%% 极坐标散点图绘制
ps1 = polarscatter(Theta,R1,40);
hold on
ps2 = polarscatter(Theta,R2,40);
hTitle = title('PolarScatter Plot');

%% 细节优化
% 对象属性修改
ps1.LineWidth = 2;
ps1.MarkerEdgeColor = C1;
ps2.LineWidth = 2;
ps2.MarkerEdgeColor = C2;
% 坐标区调整
set(gca, 'LineWidth',0.7,...                               % 线宽
         'RGrid','on','ThetaGrid','on',...                 % 网格
         'GridColor',[0 0 0],...                           % 网格颜色
         'ThetaZeroLocation','right',...                   % 极角0位置
         'TickDir', 'out', 'TickLength', [0 0], ...        % 刻度
         'RMinorTick', 'off', 'ThetaMinorTick', 'off', ... % 小刻度
         'RAxisLocation',60,...                            % 极径标签位置
         'ThetaDir', 'clockwise')                          % 极角方向
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