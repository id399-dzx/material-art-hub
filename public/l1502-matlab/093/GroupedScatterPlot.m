% 带类别标签的散点图绘制模板


%% 数据准备
% 读取数据
A = load('data.txt');
% 初始化参数
X = A(:,1);
Y = A(:,2);
L = A(:,7);
lgs = {'Powerline','Low vegetation','Impervious surfaces','Car',...
       'Fence/Hedge','Roof','Facade','Shrub','Tree'};

%% 颜色定义

C = TheColor('sci',503);%503 612 617 632

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 16;
figureHeight = 9;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]);

%% 带类别标签的散点图绘制
Cluster = unique(L);
nCluster = length(Cluster);
for i = 1:nCluster
    id = find(L==Cluster(i));  
    scatter(X(id,1),Y(id,1),8,...
        'Marker','s', ...
        'MarkerEdgeColor',C(i,1:3), ...
        'MarkerFaceColor',C(i,1:3));
    hold on
end

%% 细节优化
% 删除坐标刻度
set(gca,'xtick',[])
set(gca,'ytick',[])
% 坐标区显示调整
axis off tight equal
% Legend
[hL1,hL2]= legend(lgs,...
                'FontWeight','bold',...
                'Box','off',...
                'Location', 'eastoutside',...
                'Orientation','vertical');
set(hL1, 'FontName', 'Arial', 'FontSize', 10)
for n=1:length(hL2)
    if sum(strcmp(properties(hL2(n)),'MarkerSize'))
        hL2(n).MarkerSize=10;
    elseif sum(strcmp(properties(hL2(n).Children),'MarkerSize'))
        hL2(n).Children.MarkerSize=10;
    end
end
% 删除白边
set(gca,'LooseInset',get(gca,'TightInset'))
% 背景颜色
set(gcf,'Color',[1 1 1])

%% 图片输出
figW = figureWidth;
figH = figureHeight;
set(figureHandle,'PaperUnits',figureUnits);
set(figureHandle,'PaperPosition',[0 0 figW figH]);
fileout = 'test';
print(figureHandle,[fileout,'.png'],'-r300','-dpng');