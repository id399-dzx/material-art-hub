% 极坐标直方图绘制模板


clear

%% 数据准备
% 构造数据
theta = atan2(rand(100000,1)-0.5,2*(rand(100000,1)-0.5));

%% 颜色定义

map = TheColor('sci',500);
C = map(2,1:3);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 14;
figureHeight = 14;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]); 

%% 极坐标直方图绘制
polarhistogram(theta,25,...
    'FaceColor',C,...
    'EdgeColor','k',...
    'FaceAlpha',0.6,...
    'LineWidth',0.5);
hTitle = title('Polar Histogram Chart');

%% 细节优化
% 坐标区调整
set(gca, 'LineWidth',1,...                                 % 线宽
         'RGrid','on','ThetaGrid','on',...                 % 网格
         'GridColor',[0 0 0],...                           % 网格颜色
         'ThetaZeroLocation','right',...                   % 极角0位置
         'TickDir', 'out', 'TickLength', [0 0], ...        % 刻度
         'RMinorTick', 'off', 'ThetaMinorTick', 'off', ... % 小刻度
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
fileout = '极坐标直方图';
print(figureHandle,[fileout,'.png'],'-r300','-dpng');