# Shin-video Remotion 视觉组件库

这份组件库的目标不是堆素材，而是让导演系统可以按内容选择合适的画面表达。

## 使用原则

主画面负责解释、强化、可视化，不重复完整字幕。

字幕跟随 `_runtime/<run-id>/subtitle-timeline.json`，默认放在底部安全区。时间位置来自 TTS 服务商原生时间戳，字幕文本只取确认后的口播文案。

所有组件都必须支持：

- 数据驱动，不写死单个案例
- 16:9 优先，9:16 可通过外层留白容器适配
- 无噪点默认值
- 不使用无意义抖动
- 关键标签、字幕、图表节点不重叠

## 已新增组件

### 背景

- `SoftGradientBackground`：柔和渐变背景
- `DataFieldBackground`：数据场背景
- `GridDepthBackground`：透视网格背景
- `RadarBackground`：雷达扫描背景

### 动效

- `RevealText`：逐字渐显
- `NumberCount`：数字计数
- `PathTrace`：路径描边
- `CardStack`：卡片堆叠入场
- `FocusZoom`：焦点推进
- `CameraPush`：轻镜头推进

### 数据图

- `MetricCounter`：核心数字卡
- `BarRaceChart`：横向条形数据
- `LineTrendChart`：趋势线
- `KLineChart` / `CandlestickPanel`：K 线图
- `GaugeMeter`：仪表盘

### 财经

- `MarketHeatmap`：市场热力图
- `RiskMeter`：风险温度表
- `VolatilityBand`：波动带
- `PositionFlow`：仓位流向

### 科技产业

- `ChipArchitecture`：芯片架构图
- `ComputeFlow`：算力/推理流程图
- `ProductEcosystemMap`：产品生态图

### 叙事

- `TimelineRail`：高级时间线
- `EventCard`：事件卡
- `EvidenceWall`：证据墙
- `QuoteFocus`：金句聚焦
- `ChapterBreak`：章节转场

### 关系图

- `NodeGraph`：节点关系图
- `SupplyChainMap`：供应链图
- `DecisionTree`：决策树
- `CausalMap`：因果关系图

### 安全布局

- `SafeArea`：安全区域容器
- `SafeSubtitleLayer`：透明底字幕层
- `TextFitBox`：文字自适应
- `findLayoutCollisions`：碰撞检测函数
- `CollisionGuard`：调试用碰撞可视化容器

## DeepSeek 自研芯片新闻推荐组合

这类视频适合使用：

1. `ChapterBreak` 或 `EventCard` 做开场
2. `TimelineRail` 讲事件演进
3. `ChipArchitecture` 解释推理芯片
4. `ComputeFlow` 展示模型请求到推理输出
5. `SupplyChainMap` 展示算力依赖和替代路径
6. `ProductEcosystemMap` 展示模型、API、应用、芯片之间的闭环
7. `RiskMeter` 或 `DecisionTree` 讲早期项目和量产风险
8. `SafeSubtitleLayer` 保证字幕不遮挡核心画面

## 可选扩展能力

- 组件 5 秒样片生成脚本
- 截图级布局验收
- 自动碰撞报告
- director-plan 到组件选择的映射表
- 外部图表库兼容性验证
