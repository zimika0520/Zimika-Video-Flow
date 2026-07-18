---
name: animation-preset-builder
description: 将用户选择的视频风格转换为 Remotion 可读的动画和视觉配置，输出 RUN_DIR/style-profile.json。
---

# 动画预设生成

这是场景四第 9 步，位于 `remotion-video-director` 和 `style-consultant` 之后、`remotion-renderer` 之前。

把用户选择的视觉风格转换成：

```text
RUN_DIR/style-profile.json
```

本 Skill 必须基于 Remotion Designing visuals 生成动画配置。
必须把风格转换为可执行的 Remotion 视觉参数，而不是只写中文描述。

输出的 `RUN_DIR/style-profile.json` 必须被 Remotion 模板读取。如果后续模板没有读取这个文件，要停止并修正模板或渲染命令。

注意：视频风格不是整条视频的一套固定模板。它只定义基础主题；真正的画面变化由 `RUN_DIR/director-plan.json` 中每段 scene 的 `directorType`、`shotStyle`、`cameraMotion`、`entranceAnimation`、`emphasisAnimation`、`transitionAnimation`、`background`、`components`，以及 `RUN_DIR/scenes.json` 中的 `sceneType`、`layoutRecipe`、`motionVariant`、`transition`、`visualModules` 共同决定。

> 路径约定：`RUN_DIR` 表示当前项目的 `<项目目录>/_runtime/<run-id>/`。`public/runtime/` 仅用于 Remotion 静态资源，不得作为项目中间产物目录。

## 必需输入

```text
RUN_DIR/director-plan.json
RUN_DIR/scenes.json
用户选择的视频风格
用户选择的视频比例
```

缺少 `RUN_DIR/director-plan.json` 时，停止执行，回到 `remotion-video-director`。不允许根据固定风格模板直接生成 `RUN_DIR/style-profile.json`。

## 配置内容

至少包含：

- 主色调
- 背景风格
- 标题动画
- 关键词高亮
- 字幕样式
- 卡片动画
- 数字动画
- 场景转场
- 结尾总结卡
- recipeSystem：可用 sceneType、layoutRecipe、motionVariant、visualModules 和编排序列
- motionModules：标题、卡片、镜头、关键词高亮可用的动效模块
- transitionModules：可用转场
- effectModules：可用视觉效果模块
- antiRepetitionRules：防止整条视频套同一个模板
- sectionPacing：开场、中段、结尾的节奏倾向
- directorBindings：把 director-plan 的 directorType / shotStyle / cameraMotion 映射到 Remotion 可执行模块
- captionSystem：底部字幕安全区，和主画面分离

## Remotion Designing visuals 能力库

生成 `RUN_DIR/style-profile.json` 时，必须把 Remotion Designing visuals 下的能力纳入配置。不是只使用 transforms。

必须覆盖这些视觉能力：

- transforms：opacity、scale、translate、rotate、skew，并用 makeTransform() 组合 transform。
- assets：图片、视频、音频、字体资源的布局规则和安全边距。
- layers：标题、字幕、关键词、数据卡、背景层、装饰层的层级规则。
- transitions：fade、wipe、slide、push、match-cut 等场景转场。
- effects：blur、shadow、filter、blend、mask、light、glow 等视觉效果。
- fonts：字体族、字号层级、字重、行高、字间距、最大行宽。
- measuring items：文字和卡片尺寸检测，防止溢出和遮挡。
- randomness：可复现的轻微随机位移、粒子、浮动，但必须固定 seed。
- maps：只有地理内容需要时才启用，不要默认开启。
- animation math：interpolate、spring、Easing.bezier、extrapolate clamp、stagger。
- posterization：需要定格、跳帧、漫画感时才使用。
- html-in-canvas：需要图表、网页截图或复杂排版时才使用。
- noise visualization：背景纹理、颗粒、频谱、波形等轻量动效；默认关闭，除非用户明确要求。
- shaders：默认不启用；只有项目模板已支持时才使用。
- light leaks：默认不启用；只用于转场点缀，不能抢内容。
- starburst：默认不启用；只用于强节奏短视频中的重点爆点。
- SVG path：用于路径描边、箭头、关系线、下划线擦除和高亮框。
- interpolateColors()：用于背景、关键词、数字卡、状态色的颜色动画。

## 输入前提

必须先有 `style-consultant` 确认后的用户风格选择或用户画面描述。没有明确选择时，不允许生成 `RUN_DIR/style-profile.json`。

## 示例：暗海军蓝数据风（Data-Rich / Bloomberg）

仅当用户明确选择或描述接近该方向时，才使用此配置作为基础：

```text
背景：暗海军蓝、分层面板、可读性优先
主色：青蓝
强调色：绿色、琥珀、珊瑚红
标题：快速错落入场
关键词：扫描高亮或下划线擦除
数字：count-up / kinetic counter
卡片：数据卡、图表卡错峰弹出
转场：quick cross-dissolve / wipe / data-cut
镜头：轻微 push-in / guided pan
结尾：总结卡片
```

## 输出 JSON 结构

必须输出结构化 JSON，至少包含 `styleProfileVersion`。示例：

```json
{
  "styleProfileVersion": 1,
  "styleName": "暗海军蓝数据风（Data-Rich / Bloomberg）",
  "aspectRatio": "9:16",
  "directorPlanRequired": true,
  "visualFoundation": {
    "background": {
      "type": "dark-data-dashboard",
      "colors": ["#0D1117", "#161B22"],
      "gradientMotion": "slow-pan",
      "noise": { "enabled": false, "opacity": 0 }
    },
    "palette": {
      "primary": "#06B6D4",
      "secondary": "#4ADE80",
      "accent": "#f59e0b",
      "text": "#F1F5F9"
    },
    "typography": {
      "fontFamily": "system-ui",
      "titleWeight": 750,
      "captionWeight": 520,
      "lineHeight": 1.18,
      "maxCharsPerLine": 15
    }
  },
  "layoutSystem": {
    "safeArea": { "top": 96, "right": 72, "bottom": 160, "left": 72 },
    "layers": ["background", "visual-card", "title", "keyword", "caption", "foreground-accent"],
    "overflowGuard": true,
    "measureTextBeforeRender": true
  },
  "motionSystem": {
    "titleEnter": {
      "opacity": [0, 1],
      "translate": ["0, 28px", "0, 0"],
      "scale": [0.96, 1],
      "rotate": ["0deg", "0deg"],
      "skew": ["0deg", "0deg"],
      "easing": "Easing.bezier(0.16, 1, 0.3, 1)"
    },
    "cardEnter": {
      "opacity": [0, 1],
      "translate": ["0, 36px", "0, 0"],
      "scale": [0.92, 1],
      "staggerFrames": 5
    },
    "keywordHighlight": {
      "opacity": [0, 1],
      "scale": [0.98, 1],
      "underlineWipe": true,
      "svgPath": "underline-left-to-right",
      "colorAnimation": "interpolateColors()"
    },
    "transformComposer": "makeTransform()"
  },
  "effectsSystem": {
    "borderRadius": 22,
    "boxShadow": "0 18px 48px rgba(15, 23, 42, 0.12)",
    "filter": "none",
    "gradient": "linear-gradient(135deg, #f8fbff 0%, #eef7f6 100%)"
  },
  "transitionSystem": {
    "default": "soft-wipe",
    "durationFrames": 16,
    "lightLeaks": false,
    "starburst": false
  },
  "recipeSystem": {
    "sceneTypes": ["impact-hook", "news-context", "data-breakdown", "relationship-map", "risk-contrast", "timeline", "evidence-zoom", "concept-steps", "quote-impact", "summary-card"],
    "layoutRecipes": ["metric-hero", "news-column", "stacked-data-cards", "node-map", "split-risk-cards", "horizontal-timeline", "screenshot-focus", "step-ladder", "quote-slam", "closing-summary"],
    "motionVariants": ["scale-pop", "line-draw", "column-wipe", "scan-rise", "card-stack", "white-flash", "slow-push", "guided-pan", "warning-pulse", "type-build"],
    "visualModules": ["transforms", "assets", "layers", "transitions", "effects", "fonts", "measuring", "randomness", "animation-math", "svg-path", "color-interpolation"],
    "defaultSequence": ["impact-hook", "news-context", "data-breakdown", "relationship-map", "risk-contrast", "concept-steps", "quote-impact", "summary-card"]
  },
  "directorBindings": {
    "Hero": ["HeroTitle", "KeywordCluster"],
    "Timeline": ["TimelineView"],
    "SystemMap": ["NodeGraph"],
    "DataExplosion": ["MetricCard", "KineticCounter"],
    "Contrast": ["SplitPanel"],
    "SpecSheet": ["SpecTable"],
    "Pricing": ["PriceCard"],
    "Pause": ["PauseScreen"],
    "Summary": ["SummaryCard"]
  },
  "captionSystem": {
    "source": "captions-json",
    "position": "bottom",
    "safeAreaBottom": 160,
    "mainVisualMustAvoidCaption": true
  },
  "antiRepetitionRules": {
    "maxSameSceneTypeInRow": 1,
    "maxSameMotionVariantInRow": 1,
    "minSceneTypesPerVideo": 3
  }
}
```

## 规则

- 不设置默认风格。
- 不因为用户说“默认”“随便”“你看着办”就自动选择暗海军蓝数据风。
- 不使用暗黑科技风作为兜底。
- 不使用夸张炫技转场作为兜底。
- 动画服务信息表达，不要抢内容。
- 不允许只输出中文说明，必须生成可被 Remotion 模板读取的 `RUN_DIR/style-profile.json`。
- 没有用户选择时，停止并回到 `style-consultant` 继续追问。
- 不允许把 0-60 秒全部套同一个画面模板；同一主题下也要允许多种 sceneType 和 motionVariant 组合。
- 不允许覆盖 `RUN_DIR/director-plan.json` 的镜头设计；只能把它翻译成主题、字体、颜色和 Remotion 模块映射。
- 默认不启用噪点、无意义抖动和闪烁。
