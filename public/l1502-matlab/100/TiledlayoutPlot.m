% 紧凑排列多子图绘制模板


%% 数据准备
% 读取数据
load data.mat

%% 颜色定义

map = TheColor('sci',2064,'map',10);
map = flipud(map);
C = map([1 2 3 6],1:3);
C1 = map(1,1:3);
C2 = map(2,1:3);
C3 = map(3,1:3);
C4 = map(6,1:3);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 20;
figureHeight = 16;

%% 窗口设置
figureHandle = figure('Color','w');
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);

%% 紧凑排列多子图绘制
t = tiledlayout(2,2);
% 绘制带误差棒的柱状图
nexttile(1)
hold on
x = 1:4;
GO = bar(x,bardata,0.6,'EdgeColor','none','LineWidth',1);
for ii = 1:4
    er = errorbar(x(ii),bardata(ii),barerr(ii),'CapSize',20); 
    er.Color = C(ii,:);  
    er.LineWidth = 1.5;
    er.LineStyle = 'none';
end
hTitle = title('Bar with Errorbar');
hXLabel = xlabel('Samples');
hYLabel = ylabel('RMSE (m)');
% 细节优化
GO.FaceColor = 'flat';
GO.CData(1,:) = C1;
GO.CData(2,:) = C2;
GO.CData(3,:) = C3;
GO.CData(4,:) = C4;
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
set(gca, 'FontName', 'Arial', 'FontSize', 9)
set([hXLabel, hYLabel], 'FontSize', 9, 'FontName', 'Arial')
set(hTitle, 'FontSize', 12, 'FontWeight' , 'bold')

% 绘制折线图
nexttile(2)
x = 1:8;
p = plot(x,linedata);
hTitle = title('Line Plot');
hXLabel = xlabel('XAxis');
hYLabel = ylabel('YAxis');
% 细节优化
MarkerL = {'v','o','^','s'};
for i = 1:4
    set(p(i),'LineStyle','-','Marker',MarkerL{i},'LineWidth',2.5,'Color',C(i,1:3))
end
set(gca, 'Box', 'off', ...                                % 边框
         'LineWidth', 1,...                               % 线宽
         'XGrid', 'off', 'YGrid', 'off', ...              % 网格
         'TickDir', 'out', 'TickLength', [.015 .015], ... % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...    % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])     % 坐标轴颜色
set(gca, 'XTick', 0:1:8,  'YTick', 0:20:80,...            % 刻度位置、间隔
         'Xlim' ,[0 8],'Ylim' ,[0 60], ...                % 坐标轴范围
         'Xticklabel',{0:1:8},...                         % X坐标轴刻度标签
         'Yticklabel',{0:20:80})                          % Y坐标轴刻度标签
hLegend = legend(p, ...
                 'Samp1', 'Samp2','Samp3','Samp4', ...
                 'Location', 'northeast'); 
set(gca, 'FontName', 'Arial', 'FontSize', 9)
set([hLegend, hXLabel, hYLabel], 'FontSize', 9, 'FontName', 'Arial')
set(hTitle, 'FontSize', 12, 'FontWeight' , 'bold')

% 绘制饼图
nexttile(4)
pie(Piedata, Pieexplode)
hTitle = title('Pie chart');
% 细节优化
colormap(C)
th = findobj(gca, 'Type', 'text');
set(th, 'FontName', 'Arail', 'FontSize', 10)
set(hTitle, 'FontSize', 12, 'FontWeight' , 'bold')

% 绘制堆叠图
nexttile(3)
x = 1:13;
GO = bar(x,stackeddata,0.8,'stacked','EdgeColor','k');
hTitle = title('Stacked bar chart');
hXLabel = xlabel('Samples');
hYLabel = ylabel('RMSE (m)');
% 细节优化
GO(1).FaceColor = C1;
GO(2).FaceColor = C2;
GO(3).FaceColor = C3;
GO(4).FaceColor = C4;
GO(1).ShowBaseLine='off';
set(gca, 'Box', 'off', ...                                         % 边框
         'LineWidth', 1, ...                                       % 线宽
         'XGrid', 'off', 'YGrid', 'off', ...                         % 网格
         'TickDir', 'out', 'TickLength', [.015 .015], ...          % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...             % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])              % 坐标轴颜色
set(gca, 'YTick', 0:0.3:1.8,...
         'Ylim' , [0 1.5], ...
         'XTick', 1:13,...
         'Xticklabel',{1:13},...
         'Yticklabel',{0:0.3:1.8}) 
hLegend = legend([GO(1),GO(2),GO(3),GO(4)], ...
                 'A', 'B', 'C', 'D', ...
                 'Location', 'northeast');
set(gca, 'FontName', 'Arial', 'FontSize', 9)
set([hLegend,hXLabel, hYLabel], 'FontName', 'Arial', 'FontSize', 9)
set(hTitle, 'FontSize', 12, 'FontWeight' , 'bold')

%% 细节优化
% 减小子图间距
t.TileSpacing = 'compact';
t.Padding = 'compact';

%% 图片输出
figW = figureWidth;
figH = figureHeight;
set(figureHandle,'PaperUnits',figureUnits);
set(figureHandle,'PaperPosition',[0 0 figW figH]);
fileout = 'test';
print(figureHandle,[fileout,'.png'],'-r300','-dpng');