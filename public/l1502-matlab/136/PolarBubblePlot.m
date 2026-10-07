% 极坐标气泡图绘制模板


%% 数据准备
% 读取数据
load data.mat
% 初始化绘图参数
dis = distance;
d = diam;
ang = angle;

%% 颜色定义

% 多色
map = TheColor('sci',500);
C = map(1:8,1:3);
% 单色
% map = TheColor('sci',500);
% C = map(1,1:3);

%% 图片尺寸设置（单位：厘米）
figureUnits = 'centimeters';
figureWidth = 16;
figureHeight = 12;

%% 窗口设置
figureHandle = figure;
set(gcf, 'Units', figureUnits, 'Position', [0 0 figureWidth figureHeight]); 

%% 极坐标气泡图绘制
p1 = polarbubblechart(ang,dis,d,C,...
     'MarkerFaceAlpha',0.7,...
     'MarkerEdgeColor','k');
hTitle = title('Polarbubble Plot');
bubblesize([7 40])

%% 细节优化
% 坐标区调整
set(gca, 'LineWidth',1,...                                 % 线宽
         'RGrid','on','ThetaGrid','on',...                 % 网格
         'GridColor',[0 0 0],...                           % 网格颜色
         'ThetaZeroLocation','right',...                   % 极角0位置
         'TickDir', 'out', 'TickLength', [0 0], ...        % 刻度
         'RMinorTick', 'off', 'ThetaMinorTick', 'off', ... % 小刻度
         'RAxisLocation',270,...                           % 极径标签位置
         'RLim',[0 3],...                                  % 极径范围
         'ThetaDir', 'clockwise')                          % 极角方向
% legend
blgd = bubblelegend('Diameter (m)',...
                    'Location', 'westoutside');
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
fileout = 'test';
print(figureHandle,[fileout,'.png'],'-r300','-dpng');