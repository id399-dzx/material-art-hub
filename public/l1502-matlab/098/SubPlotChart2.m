% 大小不同多子图绘制模板


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

%% 大小不同多子图绘制
%%%% 绘制带误差棒的柱状图 %%%%
subplot(2,2,1)
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

%%%% 绘制折线图 %%%%
subplot(2,2,2)
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
         'Xlim' ,[0.5 8.5],'Ylim' ,[0 60], ...                % 坐标轴范围
         'Xticklabel',{0:1:8},...                         % X坐标轴刻度标签
         'Yticklabel',{0:20:80})                          % Y坐标轴刻度标签
hLegend = legend(p, ...
                 'Samp1', 'Samp2','Samp3','Samp4', ...
                 'Location', 'northeast'); 
set(gca, 'FontName', 'Arial', 'FontSize', 9)
set([hLegend, hXLabel, hYLabel], 'FontSize', 9, 'FontName', 'Arial')
set(hTitle, 'FontSize', 12, 'FontWeight' , 'bold')
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

%%%% 绘制面积图 %%%%
subplot(2,2,[3 4])
N = size(areadatax,1);
AC = TheColor('sci',2064,'map',N);
AC = flipud(AC);
for i = 1:N
    area(areadatax(i,:),areadatay(i,:),'LineWidth',2,'FaceColor',AC(i,:),'EdgeColor',AC(i,:),...
          'FaceAlpha',.5,'EdgeAlpha',1);
    hold on
end
hTitle = title('Area Plot');
hXLabel = xlabel('Cortical depth(normalized)');
hYLabel = ylabel('Cell density');
% 细节优化
set(gca, 'Box', 'off', ...                                         % 边框
         'LineWidth', 1,...                                        % 线宽
         'XGrid', 'off', 'YGrid', 'off', ...                       % 网格
         'TickDir', 'out', 'TickLength', [.005 .005], ...          % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...             % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1],...           % 坐标轴颜色
         'XTick', 0:0.1:1.2,...                                    % 刻度与范围
         'XLim', [0.05 1.05],...
         'YLim', [0 1])
set(gca, 'FontName', 'Arial', 'FontSize', 9)
set([hXLabel, hYLabel], 'FontSize', 9, 'FontName', 'Arial')
set(hTitle, 'FontSize', 12, 'FontWeight' , 'bold')
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