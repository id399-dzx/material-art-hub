% 带latex公式的图绘制模板

%% 数据准备
x = 1:10;
fib = zeros(1, 10);
for i = 1:10
    fib(i) = (((1+sqrt(5))/2)^i - ((1-sqrt(5))/2)^i)/sqrt(5);
end
eq = '$$F_n={1 \over \sqrt{5}}\left[\left({1+\sqrt{5}\over 2}\right)^n -\left({1-\sqrt{5}\over 2}\right)^n\right]$$';

%% 颜色定义

C = TheColor('xkcd',[715 587]);
C1 = C(1,:);
C2 = C(2,:);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 15;
figureHeight = 12;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);
hold on

%% 带latex公式的图绘制
p = plot(x, fib);
t = text(2, 45, eq);
hTitle = title('Fibonacci Numbers from 1-10');
hXLabel = xlabel('n');
hYLabel = ylabel('F_n');

%% 细节调整
% 公式及线条属性调整
set(t,'Interpreter', 'Latex', 'FontSize', 13, 'Color', C1)
set(p,'LineStyle','-','Marker','s','MarkerSize',10,'MarkerFaceColor',C2, ...
      'LineWidth',2.5,'Color',C2)
% 坐标区属性调整
set(gca, 'Box', 'off', ...                                % 边框
         'LineWidth', 1,...                               % 线宽
         'XGrid', 'off', 'YGrid', 'on', ...               % 网格
         'TickDir', 'out', 'TickLength', [.01 .01], ...   % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...    % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])     % 坐标轴颜色
set(gca, 'XLim',[0.5 10.5],...
         'YLim',[-5 60])
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