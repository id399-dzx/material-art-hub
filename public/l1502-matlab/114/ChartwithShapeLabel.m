% 带图形标记的图绘制模板

%% 数据准备
data = [2 4 6 7 8 7 5 2];

%% 颜色定义

C = TheColor('xkcd',[572 298 693]);
C1 = C(1,:);
C2 = C(2,:);
C0 = C(3,:);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 15;
figureHeight = 12;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);

%% 带图形标记的图绘制
st = stem(data,...
    'MarkerEdgeColor','k',...     % 符号轮廓颜色
    'MarkerFaceColor',C0,...      % 符号填充颜色
    'Marker','o',...              % 符号类型
    'MarkerSize',10,...           % 符号尺寸
    'LineWidth',1.5,...           % 线宽
    'LineStyle','-',...           % 线型
    'Color','k');                 % 线的颜色
axis([0 9 0 9])
annotation('rectangle',[.32 .6 .2 .2],'Color',C1,'LineWidth',2)
annotation('ellipse',[.68 .51 .11 .1],'Color',C2,'LineWidth',2)
hTitle = title('Chart with Shape Label');
hXLabel = xlabel('x');
hYLabel = ylabel('y');

%% 细节调整
% 坐标区属性调整
set(gca, 'Box', 'off', ...                                % 边框
         'LineWidth', 1,...                               % 线宽
         'XGrid', 'off', 'YGrid', 'on', ...               % 网格
         'TickDir', 'out', 'TickLength', [.01 .01], ...   % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...    % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])     % 坐标轴颜色
% 字体和字号
set(gca, 'FontName', 'Arial', 'FontSize', 10)
set([hXLabel, hYLabel], 'FontSize', 11, 'FontName', 'Arial')
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