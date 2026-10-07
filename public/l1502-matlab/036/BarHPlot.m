% 横向单组多色柱状图绘制模板

%% 数据准备
% 读取数据
% 因变量
x = [261 473 483 636 919 1066 1252 1555 1910];
% 自变量
y = 1:9;

%% 颜色定义

map = addcolorplus(296);
idx = linspace(1,64,9);
idx = round(idx);
C = map(idx,:);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 12;
figureHeight = 10;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]); % define the new figure dimensions
hold on

%% 绘制横向单组多色柱状图
GO = barh(y,x,0.9,'EdgeColor','k');
hTitle = title({'Excess natural deaths (ages 1yr +) per million population'; 'by province, up to 8 September'});
hXLabel = xlabel('Excess natural deaths (1 year+) per million population');
hYLabel = ylabel('Province');

%% 细节优化
% 赋色
GO.FaceColor = 'flat';
for i = 1:9
    GO.CData(i,:) = C(i,:);
end
% 坐标区调整
set(gca, 'Box', 'off', ...                                         % 边框
         'XGrid', 'off', 'YGrid', 'off', ...                       % 网格
         'TickDir', 'out', 'TickLength', [.015 .015], ...          % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...             % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1],...           % 坐标轴颜色
         'YTick', 1:1:9,...                                        % 刻度位置、间隔、范围
         'Ylim' , [0.3 9.7], ... 
         'XTick', 0:500:2000,...
         'Xlim' , [0 2000], ...
         'Xticklabel',{0:500:2000},...
         'Yticklabel',{'LP','NW','MP','KZN','NC','GP','WC','FS','EC'}) 
% 字体字号
set(gca, 'FontName', 'Arial', 'FontSize', 10)
set([hXLabel,hYLabel], 'FontName',  'Arial', 'FontSize', 10)
set(hTitle, 'FontSize', 11, 'FontWeight' , 'bold')
% 背景颜色
set(gcf,'Color',[1 1 1])

%% 图片输出
figW = figureWidth;
figH = figureHeight;
set(figureHandle,'PaperUnits',figureUnits);
set(figureHandle,'PaperPosition',[0 0 figW figH]);
fileout = 'test0';
print(figureHandle,[fileout,'.png'],'-r300','-dpng');