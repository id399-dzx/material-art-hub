% 带直方图的散点图绘制模板


%% 数据准备
% 读取数据
load patients
tbl = table(LastName,Diastolic,Systolic,SelfAssessedHealthStatus);

%% 颜色定义

C = colorplus([34 202 83 104]);
% C = colorplus([441 378 187 83 ]);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 15;
figureHeight = 15;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]); 


%% 带直方图的散点图绘制
scatterhistogram(tbl,'Diastolic','Systolic', ...
    'GroupVariable','SelfAssessedHealthStatus', ...
    'NumBins',5,... 
    'ScatterPlotLocation','SouthWest',... 
    'LegendVisible','on',...
    'HistogramDisplayStyle','stairs');

%% 细节优化
% 细节调整
set(gca,'Color',C,...
        'FontName','Arial',...
        'FontSize',10,...
        'LineWidth',2.5,...
        'LineStyle',{':';'-.';'-';'--'},...
        'MarkerSize',40,...
        'MarkerStyle',{'o';'v';'^';'s'})
% 背景颜色
set(gcf,'Color',[1 1 1])

%% 图片输出
print('test.png','-r300','-dpng');
