% 分组气泡云图绘制模板


%% 数据准备
% 读取数据
load populationData.mat

%% 颜色定义

C = TheColor('sci',500);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 20;
figureHeight = 14;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);

%% 分组气泡云图绘制
b = bubblecloud(populationData,'Population','Country','Region');
title('Population of 216 countries');

%% 细节优化
% 属性调整
b.EdgeColor = 'w';
b.FontSize = 9;
b.ColorOrder = C;
b.FontName = 'Arial';
% 背景颜色
set(gcf,'Color',[1 1 1])

%% 图片输出
figW = figureWidth;
figH = figureHeight;
set(figureHandle,'PaperUnits',figureUnits);
set(figureHandle,'PaperPosition',[0 0 figW figH]);
fileout = 'test';
print(figureHandle,[fileout,'.png'],'-r300','-dpng');