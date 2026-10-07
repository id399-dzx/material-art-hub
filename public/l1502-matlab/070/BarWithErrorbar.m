% 带误差棒的柱状图绘制模板


%% 数据准备
% 读取数据
% 自变量
x = 1:4;
% 因变量
dataset = [0.341,0.493,0.324,0.428];
% 误差
err = [0.02 0.03 0.03 0.02];

%% 颜色定义
C = TheColor('xkcd',[346 785 523 769]);
C1 = C(1,:);
C2 = C(2,:);
C3 = C(3,:);
C4 = C(4,:);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 12;
figureHeight = 9;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]); % define the new figure dimensions
hold on

%% 带误差棒的柱状图绘制
% 绘制初始柱状图
GO = bar(x,dataset,0.6,'EdgeColor','none','LineWidth',1);
% 绘制误差棒图
for ii = 1:4
    er = errorbar(x(ii),dataset(ii),err(ii),'CapSize',20); 
    er.Color = C(ii,:);  
    er.LineWidth = 1.5;
    er.LineStyle = 'none';
end
hTitle = title('Bar with Errorbar');
hXLabel = xlabel('Samples');
hYLabel = ylabel('RMSE (m)');

%% 细节优化
% 柱状图赋色
GO.FaceColor = 'flat';
GO.CData(1,:) = C1;
GO.CData(2,:) = C2;
GO.CData(3,:) = C3;
GO.CData(4,:) = C4;
% 坐标区调整
set(gca, 'Box', 'off', ...                                   % 边框
         'Layer','top',...                                   % 图层
         'LineWidth', 1,...                                  % 线宽
         'XGrid', 'off', 'YGrid', 'off', ...                 % 网格
         'TickDir', 'out', 'TickLength', [.015 .015], ...    % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...       % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1],...     % 坐标轴颜色
         'YTick', 0:0.1:1,...                                % 坐标轴刻度
         'Ylim' , [0 0.6], ...
         'Xlim' , [0.3 4.7], ...
         'XTick', 1:4,...
         'Xticklabel',{'S1' 'S2' 'S3' 'S4' },...
         'Yticklabel',{0:0.1:1})
% 字体和字号
set(gca, 'FontName', 'Arial', 'FontSize', 10)
set([hXLabel, hYLabel], 'FontSize', 11, 'FontName', 'Arial')
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