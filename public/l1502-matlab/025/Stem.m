% 针状图绘制模板


%% 数据准备
% 读取数据
load amplitudeData.mat
% 自变量
X = sample(1:48);
% 因变量
Y = amplitude(1:48);

%% 颜色定义

C1 = colorplus(27);
C2 = colorplus(242);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 12;
figureHeight = 8;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);
hold on

%% 针状图绘制
% 定义绘图参数
MarkerType = 'o';
MarkerSize = 6;
LineWidth = 1.2;
LineStyle = '-';
% 绘制
st = stem(X,Y,...
    'MarkerEdgeColor',C1,...      % 符号轮廓颜色
    'MarkerFaceColor',C2,...      % 符号填充颜色
    'Marker',MarkerType,...       % 符号类型
    'MarkerSize',MarkerSize,...   % 符号尺寸
    'LineWidth',LineWidth,...     % 线宽
    'LineStyle',LineStyle,...     % 线型
    'Color',C1);                  % 线的颜色
hTitle = title('FIR Polyphase Interpolator');
hXLabel = xlabel('Samples');
hYLabel = ylabel('Amplitude');

%% 细节优化
% 坐标轴美化
set(gca, 'Box', 'on', ...                                         % 边框
         'XGrid', 'off', 'YGrid', 'off', ...                      % 网格
         'TickDir', 'in', 'TickLength', [.015 .015], ...          % 刻度
         'XMinorTick', 'on', 'YMinorTick', 'on', ...              % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1],...          % 坐标轴颜色
         'XTick', -5:5:60,...
         'XLim', [-1 48],...
         'YTick', -1.5:0.5:1.5,...
         'YLim', [-1.2 1.2])
% 字体和字号
set(gca, 'FontName', 'Helvetica')
set([hXLabel, hYLabel], 'FontName', 'AvantGarde')
set(gca, 'FontSize', 10)
set([hXLabel, hYLabel], 'FontSize', 11)
set(hTitle, 'FontSize', 11, 'FontWeight' , 'bold')
% 背景颜色
set(gcf,'Color',[1 1 1])

%% 图片输出
figW = figureWidth;
figH = figureHeight;
set(figureHandle,'PaperUnits',figureUnits);
set(figureHandle,'PaperPosition',[0 0 figW figH]);
fileout = 'test';
print(figureHandle,[fileout,'.png'],'-r300','-dpng');