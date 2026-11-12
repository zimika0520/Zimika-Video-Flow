# Remotion 动画系统中文手册

这份手册用于渲染前引导用户选择视觉风格。不要把 API 细节直接甩给用户。

## Zimika Video Flow 强制导演层

Zimika Video Flow 不能只把 `RUN_DIR/scenes.json` 直接丢给 Remotion 套模板。

正确链路是：

```text
RUN_DIR/scenes.json
→ 导演方案
→ RUN_DIR/director-plan.json
→ 动画与风格系统
→ RUN_DIR/style-profile.json
→ Remotion 渲染
```

`RUN_DIR/director-plan.json` 必须说明每一段的叙事功能、主画面信息、字幕安全区、镜头类型、镜头运动、入场动画、强调动画、转场动画、背景角色和组件。

主画面不能复述完整字幕。字幕只跟随音频进度，固定在底部安全区。主画面负责解释、强化、可视化。

Remotion 模板必须使用 `useCurrentFrame()`、`interpolate()`、`spring()`、`<Sequence>` / `<Series>` 实现帧驱动动画，不能靠 CSS transition 糊弄时间轴。

## 用户能理解的动画选项

### 文字入场

文字从下方、侧边、透明度变化或轻微缩放进入画面。
适合标题、重点句、章节切换。

### 关键词高亮

对关键词加高亮底条、描边、颜色变化或轻微放大。
适合财经、新闻、知识解释类内容。

### 数字动画

金额、比例、排名从 0 增长到目标值。
适合财经 MG 视频。

### 卡片弹出

信息卡片错峰出现，形成节奏。
适合收入来源、事件拆解、观点列表。

### 转场动画

场景之间用淡入淡出、擦除、滑动、轻微缩放切换。
默认不要用太炫的 3D 翻转。

### 镜头推拉

画面轻微放大或移动，让静态内容有镜头感。
适合没有图片、主要靠文字和图形表达的视频。

### 结尾总结卡

最后用一张总结卡收束观点。
适合让用户记住核心结论。

## Remotion 内部能力

Agent 可根据需要使用：

```text
useCurrentFrame()
Sequence
Series
interpolate()
spring()
Easing
interpolateColors()
@remotion/transitions
```

## Zimika Video Flow 风格选择

Zimika Video Flow 不设置默认风格。渲染前必须先询问用户画面需求，再生成 `RUN_DIR/style-profile.json`。

可选风格库：

```text
暗海军蓝数据风（Data-Rich / Bloomberg）
黑底发布极简风（Minimal / Jobs）
暖色叙事风（Warm / Narrative）
终端技术风（Terminal / Hacker）
```

如果用户明确选择暗海军蓝数据风，设计方向：

- 暗海军蓝背景
- 数据面板和图表卡片
- 数字突出
- 关键词高亮
- 克制转场
- 有镜头推拉
- 不像纯 PPT
