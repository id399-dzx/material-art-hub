% 罗盘图绘制模板


clear

%% 数据准备
% 读取数据
load data.mat

%% 颜色定义

C = TheColor('sci',500);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 14;
figureHeight = 14;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]); 

%% 罗盘图绘制
c = compass(u,v);
hTitle = title('Compass chart');

%% 细节优化
% 属性调整
for i = 1:length(u)
    c(i).LineWidth = 1.5;
    c(i).Color = C(3,1:3);
end
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
fileout = '罗盘图';
print(figureHandle,[fileout,'.png'],'-r300','-dpng');