% 折线图绘制模板

%% 数据准备
% 读取数据
load data.mat

%% 颜色定义

% C = TheColor('xkcd',[336 816 210 346]);
C = TheColor('sci',1796);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 12;
figureHeight = 9;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);

%% 折线图绘制
p = plot(x,A);
hTitle = title('Line Plot');
hXLabel = xlabel('XAxis');
hYLabel = ylabel('YAxis');

%% 细节调整
% 线条属性调整
MarkerL = {'v','o','^','s'};
for i = 1:4
    set(p(i),'LineStyle','-','Marker',MarkerL{i},'LineWidth',2.5,'Color',C(i,1:3))
end
% 坐标区属性调整
set(gca, 'Box', 'off', ...                                % 边框
         'LineWidth', 1,...                               % 线宽
         'XGrid', 'off', 'YGrid', 'on', ...               % 网格
         'TickDir', 'out', 'TickLength', [.01 .01], ...   % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...    % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])     % 坐标轴颜色
% 坐标轴刻度调整
set(gca, 'XTick', 0:1:8,  'YTick', 0:20:80,...            % 刻度位置、间隔
         'Xlim' ,[0 8],'Ylim' ,[0 60], ...                % 坐标轴范围
         'Xticklabel',{0:1:8},...                         % X坐标轴刻度标签
         'Yticklabel',{0:20:80})                          % Y坐标轴刻度标签
% Legend
hLegend = legend(p, ...
                 'Samp1', 'Samp2','Samp3','Samp4', ...
                 'Location', 'northeast');
% Legend位置微调 
P = hLegend.Position;
hLegend.Position = P + [0.01 0.03 0 0];
% 字体和字号
set(gca, 'FontName', 'Arial', 'FontSize', 10)
set([hLegend, hXLabel, hYLabel], 'FontSize', 11, 'FontName', 'Arial')
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