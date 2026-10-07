% 基础三维散点图绘制模板


%% 数据准备
% 读取数据
A1 = load('LionScan1.xyz');
A2 = load('LionScan2.xyz');
x1 = A1(:,1);
y1 = A1(:,2);
z1 = A1(:,3);
x2 = A2(:,1);
y2 = A2(:,2);
z2 = A2(:,3);

%% 颜色定义

C1 = colorplus(48);
C2 = colorplus(305);

%% 基础三维散点图绘制
figure
scatter3(x1, y1, z1, 2, repmat(C1,length(x1),1), 'filled')
hold on
scatter3(x2, y2, z2, 2, repmat(C2,length(x2),1), 'filled')
hTitle = title('Scatter3');
hXLabel = xlabel('XAxis');
hYLabel = ylabel('YAxis');
hZLabel = zlabel('ZAxis');

%% 细节优化
% 坐标轴美化
axis equal
view(23.68,24.27)
set(gca, 'Box', 'on', ...                                       % 边框
         'XGrid', 'on', 'YGrid', 'on', ...                      % 网格
         'TickDir', 'out', 'TickLength', [.015 .015], ...       % 刻度
         'XMinorTick', 'off', 'YMinorTick', 'off', ...          % 小刻度
         'XColor', [.1 .1 .1],  'YColor', [.1 .1 .1])           % 坐标轴颜色
% 字体和字号
set(gca, 'FontName', 'Helvetica')
set([hXLabel, hYLabel, hZLabel], 'FontName', 'AvantGarde')
set(gca, 'FontSize', 10)
set([hXLabel, hYLabel, hZLabel], 'FontSize', 11)
set(hTitle, 'FontSize', 11, 'FontWeight' , 'bold')
% 背景颜色
set(gcf,'Color',[1 1 1])

%% 图片输出
print('test.png','-r300','-dpng');
