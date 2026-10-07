% 三维分簇散点图绘制模板


%% 数据准备
% 读取数据
[day,bikeCount,hourOfDay,direction] = readBicycleData;

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

%% 三维分簇散点图绘制
s = swarmchart3(day,direction,bikeCount,8,hourOfDay,'filled');
hTitle = title('Distribution of bicycle traffic according to day and direction');
c = colorbar();
hYlabel = ylabel(c, "Time of the day");
hZlabel = zlabel("Number of bicycles");
view(-37.6,27.8)

%% 细节优化
% 赋色
colormap(map)
% 调节抖动宽度
set(s, 'YJitterWidth', 0.5)
% 坐标轴美化
set(gca, 'Box', 'off', ...                                                  % 边框
         'LineWidth',1,...                                                  % 线宽
         'XGrid', 'on', 'YGrid', 'on', 'ZGrid', 'on',...                    % 网格
         'TickDir', 'out', 'TickLength', [.01 .01], ...                     % 刻度
         'XMinorTick','off','YMinorTick','off','ZMinorTick','off', ...      % 小刻度
         'XColor', [.1 .1 .1], 'YColor', [.1 .1 .1], 'ZColor', [.1 .1 .1])  % 坐标轴颜色
% 字体和字号
set(gca, 'FontName', 'Arial', 'FontSize', 9)
set([hYlabel,hZlabel], 'FontName',  'Arial', 'FontSize', 9)
set(hTitle, 'FontSize', 11, 'FontWeight' , 'bold')
% 背景颜色
set(gcf,'Color',[1 1 1])

%% 图片输出
figW = figureWidth;
figH = figureHeight;
set(figureHandle,'PaperUnits',figureUnits);
set(figureHandle,'PaperPosition',[0 0 figW figH]);
fileout = 'test';
print(figureHandle,[fileout,'.png'],'-r300','-dpng');

function [day, bikeCount, hours, direction] = readBicycleData()
    load bicycleData.mat bicycleData;
    daynames = ["Sunday" "Monday" "Tuesday" "Wednesday" "Thursday" "Friday" "Saturday"];
    dirNames = ["Eastbound"; "Westbound"];
    day = repmat(categorical(bicycleData.Day,daynames),[2,1]); % Duplicate Day column 
    hours = repmat(hour(bicycleData.Timestamp),[2,1]); % Duplicate Timestamp column
    direction = categorical(repelem(dirNames,length(bicycleData.Day))); % Create column vector of two direction categories
    bikeCount = [bicycleData.Eastbound; bicycleData.Westbound]; % Vertically concatenate Eastbound and Westbound traffic values
end