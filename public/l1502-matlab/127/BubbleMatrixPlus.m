% 进阶气泡热图绘制模板


%% 数据准备
% 读取数据
load data.mat
% 生成矩阵坐标数据
[r,c] = size(data);
x = 1:c;
y = 1:r;
[xx,yy] = meshgrid(x,y);
yy = flipud(yy);
f1 = data(:)*10;
f2 = data(:);

%% 颜色定义

map = TheColor('sci',2068);
% map = flipud(map);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 16;
figureHeight = 12;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);
hold on

%% 进阶气泡热图绘制
t = tiledlayout(1,1);
nexttile
bubblechart(xx(:),yy(:),f1,f2,'MarkerFaceAlpha',0.8);
bubblesize([5 25])
hTitle = title('BubbleMatrixPlus Plot');
hXLabel = xlabel('XAxis');
hYLabel = ylabel('YAxis');

%% 细节优化
% 赋色
colormap(map)
% 坐标轴美化
axis equal
set(gca, 'Box', 'on', ...                            
         'XGrid', 'on', 'YGrid', 'on', ...                  
         'TickDir', 'in', 'TickLength', [0 0], ...         
         'XMinorTick', 'off', 'YMinorTick', 'off', ...          
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1],...        
         'XTick', 0:1:c+1,...                                    
         'XLim', [0 c+1],...
         'YTick', 0:1:r+1,...
         'YLim', [0 r+1],...
         'XTickLabel',{'','A1','A2','A3','A4','A5','A6','A7','A8','A9','A10',''},...
         'YTickLabel',{'','B1','B2','B3','B4','B5','B6','B7','B8','B9','B10',''})
ytickangle(90)
% 添加图例
% 颜色条
cb = colorbar;
cb.Label.String = 'Feature2';
cb.Layout.Tile = 'east';
% 气泡尺寸
blgd = bubblelegend('Feature1',...
                    'Style','vertical',...
                    'BubbleSizeOrder','descending',...
                    'box','on',...
                    'NumBubbles',3,... ...
                    'FontName', 'Arial',...
                    'FontSize', 10);
bt = get(blgd,'Title');
bt.FontWeight = 'normal';
bt.FontName = 'Arial';
bt.FontSize = 10;
blgd.Layout.Tile = 'east';
% 字体字号
set(gca, 'FontName', 'Arial', 'FontSize', 10)
set([hXLabel,hYLabel], 'FontName',  'Arial', 'FontSize', 11)
set(hTitle, 'FontSize', 13, 'FontWeight' , 'bold')
% 背景颜色
set(gcf,'Color',[1 1 1])

%% 图片输出
figW = figureWidth;
figH = figureHeight;
set(figureHandle,'PaperUnits',figureUnits);
set(figureHandle,'PaperPosition',[0 0 figW figH]);
fileout = 'test';
print(figureHandle,[fileout,'.png'],'-r300','-dpng');
