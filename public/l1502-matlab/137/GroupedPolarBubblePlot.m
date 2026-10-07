% 极坐标分组气泡图绘制模板

clear          

%% 数据准备
% 读取数据
load data.mat

%% 颜色定义

map = TheColor('sci',512);
C1 = repmat(map(1,1:3),10,1);
C2 = repmat(map(2,1:3),10,1);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 16;
figureHeight = 12;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]); 

%% 极坐标分组气泡图绘制
t = tiledlayout(1,1);
nexttile
p1 = polarbubblechart(TH1,R1,SZ1,C1);
hold on
p2 = polarbubblechart(TH2,R2,SZ2,C2);
hTitle = title('Polarbubble chart');
bubblesize([7 30])

%% 细节优化
% 坐标区调整
set(gca, 'LineWidth',1,...                                 % 线宽
         'RGrid','on','ThetaGrid','on',...                 % 网格
         'GridColor',[0 0 0],...                           % 网格颜色
         'ThetaZeroLocation','right',...                   % 极角0位置
         'TickDir', 'out', 'TickLength', [0 0], ...        % 刻度
         'RMinorTick', 'off', 'ThetaMinorTick', 'off', ... % 小刻度
         'RAxisLocation',270,...                           % 极径标签位置
         'RLim',[0 40],...                                 % 极径范围
         'ThetaDir', 'clockwise')                          % 极角方向
% legend
hLegend = legend('Sample1','Sample2','Linewidth',0.5);
hLegend.Layout.Tile = 'east';
% 气泡尺寸
blgd = bubblelegend('Sz');
blgd.Layout.Tile = 'east';
bt = get(blgd,'Title');
bt.FontWeight = 'normal';
bt.FontName = 'Arial';
bt.FontSize = 9;
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
fileout = '极坐标分组气泡图';
print(figureHandle,[fileout,'.png'],'-r300','-dpng');