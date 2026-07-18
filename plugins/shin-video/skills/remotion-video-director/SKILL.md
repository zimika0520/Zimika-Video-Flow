---
name: remotion-video-director
description: Use when Shin-video already has RUN_DIR/scenes.json and needs a director-grade Remotion plan before style presets or rendering.
---

# Remotion 视频导演

这是 Shin-video 的内部导演层 Skill，位于 `scene-generator` / `subtitle-rhythm-builder` 之后，`style-consultant` / `animation-preset-builder` / `remotion-renderer` 之前。

它的任务不是渲染视频，而是把 `RUN_DIR/scenes.json` 从“分段文字和时间轴”升级为可执行的视频导演方案，输出：

```text
RUN_DIR/director-plan.json
```

没有 `RUN_DIR/director-plan.json`，不允许进入动画预设生成，也不允许调用 Remotion 渲染。

如果 `RUN_DIR/scenes.json`、口播文案、素材包或 TTS 服务商原生时间轴发生变化，已有 `RUN_DIR/director-plan.json` 必须作废并重新生成。导演层必须针对当前这一版口播文案和素材重新设计视觉系统、镜头功能、动效组合和字幕安全区，不能复用上一版 director-plan 后直接渲染。

> 路径约定：`RUN_DIR` 表示当前项目的 `<项目目录>/_runtime/<run-id>/`。`public/runtime/` 仅用于 Remotion 静态资源，不得作为项目中间产物目录。

## 输入

```text
文章正文.md
口播文案.md
RUN_DIR/video-brief.json
RUN_DIR/subtitle-timeline.json
RUN_DIR/scenes.json
RUN_DIR/asset-manifest.json
RUN_DIR/visual-manifest.json
```

## 输出

```text
RUN_DIR/director-plan.json
```

## 渲染器兼容门禁

生成导演方案前，必须确认本地 Shin-video 渲染器支持当前导演系统：

```bash
npm run doctor
```

如果 `npm run doctor` 失败，先补齐或更新本地 Shin-video 项目，不要继续生成 `RUN_DIR/director-plan.json`。原因是导演方案必须被 Remotion 模板执行；如果渲染器不支持新版 `directorType`、`shotStyle`、`components`、`sourceScenesFingerprint`、`RUN_DIR/style-profile.json` 和 `remotion/visual-library`，导演方案写得再完整也会在渲染阶段退化成旧模板。

## 来源融合

本 Skill 强制融合两个参考：

- `bayramannakov/remotion-video-director`：吸收它的 `Think -> Design -> Build -> Review` 方法、Creative Brief、Scene Focus Rule、archetype 选择、专家审片协议和 Remotion build 约束。
- Remotion 官方 skills / best practices：用于把导演方案约束到 Remotion 可实现的 API 和渲染规则上。

不要把这两个参考写成“可选建议”。在 Shin-video 中，它们是进入渲染前的强制门禁。

注意：这里只融合方法论和执行协议，不照搬它的英文 SaaS 模板、固定场景结构或具体视觉样式。每条 Shin-video 必须根据当前文章、音频时间轴、素材包和用户需求重新生成导演方案。

## 必读参考文件

每次生成导演方案前，必须读取并吸收下列文件，不能只凭本 Skill 摘要生成：

```text
../../references/规范/video-archetypes.md
../../references/规范/expert-definitions.md
../../references/规范/remotion-patterns.md
../../references/规范/component-library.md
../../references/规范/music-and-audio.md
```

读取目的：

- `video-archetypes.md`：确定视频 archetype、创意方向和适用场景。
- `expert-definitions.md`：用于专家审片协议和质量评分。
- `remotion-patterns.md`：约束 Remotion 可实现的动画、镜头和工程写法。
- `component-library.md`：优先复用组件，不允许每个 scene 临时堆重复 UI。
- `music-and-audio.md`：确定口播优先、音乐策略、音量 ducking 和音画关系。

如果这些插件参考文件缺失，停止生成导演方案，先提示补全插件安装。

## Discovery 硬门禁

导演方案不是自动套模板。进入 `Design` 前，如果缺少以下信息，必须一问一答追问，一次只问一个问题，并等待用户回答：

- 目标观众是谁。
- 视频目的是什么。
- 用户希望观众看完后记住什么或做什么。
- 时长、比例、平台限制。
- 用户明确不想要的视觉风格或旧模板。
- 是否允许使用网络素材、图片、视频或音乐。

用户说“你看着办”“默认”“随便”“直接做”“先渲染”，不能视为确认。此时必须继续追问关键缺口，不允许自动选择默认风格或默认导演方案。

## 用户可审导演稿

生成 `RUN_DIR/director-plan.json` 前，必须先给用户一版可审导演稿，至少包含：

```text
Creative Brief
Narrative Arc
Scene Sequence
Audio Strategy
Visual Risks
Review Checklist
```

用户未确认导演稿前，不进入 `style-consultant`、`animation-preset-builder` 或 `remotion-renderer`。如果用户要求修改节奏、镜头、视觉密度、素材使用方式，先更新导演稿和 `RUN_DIR/director-plan.json`，再继续后续步骤。

## 四阶段硬流程

生成 `RUN_DIR/director-plan.json` 时必须按下面顺序思考并落盘：

1. `Think`
   - 明确本条视频的观众、目的、核心承诺、视频 archetype。
   - 识别文章的主线、转折、证据、峰值和收束。

2. `Design`
  - 读取 `RUN_DIR/video-brief.json`、`RUN_DIR/asset-manifest.json` 和 `RUN_DIR/visual-manifest.json`。
  - 生成 creative brief、narrative arc、attention curve、peak moments。
  - 按 `one-scene-one-idea` 拆 scene，每个 scene 只服务一个信息功能。

3. `Build`
  - 把每个 scene 翻译为 Remotion 可执行字段：`directorType`、`shotStyle`、`importance`、`animation`、`background`、`components`、`content`。
  - 每个 scene 必须绑定 `asset-manifest` 中的素材/证据记录，以及 `visual-manifest` 中的 `visualGoal`、`evidenceAsset`、`safeZones`、`overlapRisks` 和 `forbiddenReuse`。
  - 同时输出 `remotionExecutionContract`，要求 renderer 只执行导演方案，不自行猜测模板。

4. `Review`
   - 输出导演审阅稿，检查字幕安全区、主画面不复述字幕、镜头差异、节奏峰值和可读性。
   - 审不过时回到 `Design`，不要进入渲染。

## 核心原则

- 每条视频必须根据当前文章重新生成导演方案，不允许套用上一条视频或旧模板。
- 主画面不能重复完整字幕；主画面只负责解释、强化、可视化。
- 字幕只跟随音频时序，固定在底部字幕安全区。
- 一个 scene 只表达一个主要信息，不要把多个结论塞进同一个画面。
- 画面必须有镜头语言差异，不能全是卡片加 fade / scale。
- 动画服务内容理解，不使用无意义抖动、噪点、闪烁或廉价特效。
- 背景可以动态，但默认干净克制；噪点默认关闭。

## director-plan.json 必须包含

```json
{
  "directorPlanVersion": 1,
  "sourceScenesFingerprint": "当前 RUN_DIR/scenes.json 的 sha256 指纹",
  "videoDirectorWorkflow": {
    "sourceSkill": "bayramannakov/remotion-video-director",
    "adaptedPhases": ["Think", "Design", "Build", "Review"],
    "sceneFocusRule": "one-scene-one-idea",
    "archetypeMapping": {
      "upstream": ["Product Launch", "Recurring Data Report", "Narrative Intro", "Technical Demo", "Growth Marketing"],
      "shinVideo": ["news-commentary", "finance-explainer", "event-breakdown", "tech-demo", "narrative-explainer"]
    },
    "expertReviewProtocol": ["director", "information-design", "motion-design", "caption-safety", "audience-comprehension"]
  },
  "remotionExecutionContract": {
      "rendererRole": "execute-director-plan",
      "subtitleSystem": "audio-timeline-independent",
      "mainVisualPolicy": "explain-not-repeat-caption",
      "requiredInputs": ["RUN_DIR/video-brief.json", "RUN_DIR/scenes.json", "RUN_DIR/asset-manifest.json", "RUN_DIR/visual-manifest.json", "RUN_DIR/director-plan.json", "RUN_DIR/style-profile.json", "RUN_DIR/subtitle-timeline.json", "口播音频.mp3"],
      "requiredOutputs": ["RUN_DIR/preview.mp4", "<项目目录>/<视频标题>.mp4"],
    "remotionRules": [
      "frame-driven-animation",
      "clamped-interpolation",
      "sequence-based-timing",
      "component-reuse",
      "text-measurement",
      "no-css-transition-timeline"
    ]
  },
  "creativeBrief": {
    "topic": "当前视频主题",
    "audience": "目标观众",
    "tone": "表达语气",
    "mustAvoid": ["PPT化", "主画面复述完整字幕", "跨主题复用旧模板"]
  },
  "audioStrategy": {
    "voiceoverPrimary": true,
    "music": "none | user-provided | royalty-free",
    "duckingRequired": true,
    "musicVolumeDuringNarration": "0.10-0.15",
    "avoidAiAmbientAudio": true,
    "notes": "口播是主线；音乐和音效只能托底节奏，不能抢字幕和人声"
  },
  "narrativeArc": {
    "opening": "引入",
    "turn": "转折",
    "proof": "证明",
    "reinforcement": "强化",
    "closing": "收束"
  },
  "attentionCurve": [
    { "start": 0, "end": 10, "intensity": 85, "purpose": "吸引" }
  ],
  "peakMoments": [
    { "time": 12.4, "reason": "关键数字或观点", "visualTreatment": "重点强化方式" }
  ],
  "globalRules": {
    "captionSafeZone": "bottom",
    "mainVisualPolicy": "explain-not-repeat-caption",
    "noiseDefault": false,
    "reuseOldTemplate": false,
    "minShotTypes": 4,
    "minMotionVariants": 4
  },
  "scenes": [
    {
      "id": "scene-0001",
      "start": 0,
      "end": 5.2,
      "duration": 5.2,
      "informationFunction": "本镜头的信息功能",
      "mainMessage": "主画面只表达的短句或关键词",
      "captionText": "底部字幕文本",
      "directorType": "Hero",
      "sceneType": "impact-hook",
      "importance": 9,
      "role": "memory",
      "shotStyle": "Reveal",
      "visualPriority": "extreme",
      "motionStyle": "sharp",
      "cameraMotion": "dollyIn",
      "entranceAnimation": "maskReveal",
      "emphasisAnimation": "highlightSweep",
      "transitionAnimation": "wipe",
      "background": {
        "type": "Gradient",
        "motion": "slowDrift",
        "role": "emotional"
      },
      "components": ["HeroTitle", "KeywordCluster"],
      "componentSource": "plugin-root/references/规范/component-library.md",
      "content": {
        "title": "短标题",
        "keywords": ["关键词1", "关键词2"],
        "visualMetaphor": "用图形、关系、数字或留白表达，而不是复述字幕"
      },
      "safeArea": {
        "caption": "bottom",
        "mainVisualAvoidsCaption": true
      }
    }
  ],
  "reviewScorecard": {
    "requiredBeforeFinalExport": true,
    "dimensions": [
      "hook-clarity",
      "core-message-landed",
      "pacing-dynamism",
      "visual-readability",
      "caption-safety",
      "audio-visual-harmony",
      "audience-fit"
    ],
    "verdict": "ship | one-more-pass | rework"
  }
}
```

## 镜头系统

`directorType` 必须从下列类型中选择，并保证整条视频多样化：

```text
Hero
Timeline
SystemMap
DataExplosion
Contrast
SpecSheet
Pricing
Pause
Summary
EvidenceHero
KeywordInvestigation
FinancialMeter
SystemStack
DependencyMap
QuestionPause
BarrierWall
EvidenceReturn
IndustrySignal
CompetitionLayerStack
FinalJudgement
```

规则：

- 开头必须有 `Hero`。
- 必须至少包含 `Timeline`、`SystemMap`、`DataExplosion`、`Contrast` 中的 3 种。
- 视觉形式按 `sceneType + directorType` 组合计算，`floor(镜头数 / 2) + 1` 作为导演设计目标，不是渲染阻断配额。
- 连续镜头声明相同视觉形式时必须标记审片风险；只换淡入、平移或缩放不算真正解决重复问题。
- 科技、芯片、AI 基础设施、供应链、行业竞争类内容，优先使用 `EvidenceHero`、`KeywordInvestigation`、`SystemStack`、`DependencyMap`、`BarrierWall`、`IndustrySignal`、`CompetitionLayerStack`、`FinalJudgement` 等新版镜头。
- 金融、价格、成本、仓位、市场数据类内容，优先使用 `FinancialMeter`、`DataExplosion`、`Pricing`、`Contrast`。
- 有价格、成本、tokens、增长率等内容时，优先使用 `Pricing` 或 `DataExplosion`。
- 只有存在可追溯事实数据时才能设计定量图表、K 线、仪表盘或热力图；没有数据时必须改用定性关系、证据截图或关键词结构。
- `Pause` / `QuestionPause` 只用于节奏停顿，不能显示“信息停顿”这类废话；画面应低信息密度、强留白、关系断点或关键问题停顿。
- 结尾必须是 `Summary` 或等效收束镜头。
- 如果选择了新版 directorType，`components` 必须绑定到 `remotion/visual-library` 中的可执行组件，不能只写自然语言描述。

## Shot Language

每个 scene 必须指定 `shotStyle`：

```text
Burst
Flow
Reveal
Zoom
Split
Collapse
```

规则：

- 不允许所有 scene 使用同一种 `shotStyle`。
- 连续 2 个 scene 不允许完全相同的 `directorType + shotStyle + motionStyle`。
- 每 10-15 秒必须出现一次 `importance >= 8` 的记忆镜头或视觉峰值。
- 不允许连续 3 个 support scene。

## Animation Grammar

每个 scene 至少包含：

```text
entranceAnimation
emphasisAnimation
transitionAnimation
cameraMotion
```

可用动画词汇：

```text
fadeBlurIn
slideParallaxIn
maskReveal
zoomIn
kineticPop
highlightSweep
depthPush
elasticStretch
kineticCounter
lineTrace
nodeConnect
stackExpand
columnRise
wipe
morph
split
flowMerge
cameraPan
dollyIn
dollyOut
parallaxDrift
guidedPan
```

禁用：

- 无意义画面抖动。
- 默认噪点背景。
- 全片只用 fade / scale / slide。
- 主画面铺满长句字幕。

## Remotion 实现约束

导演方案必须能被 Remotion 模板实现：

- 使用 `<Sequence>` / `<Series>` 控制时间。
- 使用 `useCurrentFrame()`、`interpolate()`、`spring()`、`Easing`、`interpolateColors()` 做帧驱动动画。
- 不使用 CSS transition 作为核心时间轴动画。
- 组件要复用，例如 `HeroTitle`、`TimelineView`、`NodeGraph`、`MetricCard`、`PriceCard`、`SpecTable`、`PauseScreen`、`SummaryCard`。
- 字幕使用字幕 JSON / caption items 独立渲染，不和主画面内容绑定。
- 文本必须测量或限制行宽，避免遮挡字幕和主视觉。
- renderer 的职责是 `execute-director-plan`：读取 `director-plan.json` 和 `style-profile.json` 后执行，不允许跳回“根据字幕临时猜画面”的旧路径。
- 每个 scene 的 `components` 必须优先从 `../../references/规范/component-library.md` 和 Shin-video 本地组件映射中选择；禁止在每个 scene 里临时堆一套重复 UI。
- `audioStrategy` 必须被传递给渲染提示或渲染配置；如果没有音乐素材，明确使用 `music: none`，不要默认生成 AI 环境音。
- 如果需要音乐，口播期间必须 ducking，避免盖住人声和字幕节奏。

## 质量自检

输出 `RUN_DIR/director-plan.json` 前必须检查：

- 是否已经读取 5 个必读参考文件。
- 是否已完成 Discovery 追问，且用户确认导演稿。
- 是否存在 `directorPlanVersion`。
- 是否存在 `videoDirectorWorkflow` 和 `remotionExecutionContract`。
- 是否有 `creativeBrief`、`narrativeArc`、`attentionCurve`、`peakMoments`。
- 是否存在 `audioStrategy`，并明确口播优先、音乐策略和 ducking。
- 是否存在 `reviewScorecard`，并给出 `ship | one-more-pass | rework` 判断。
- 是否每个 scene 都有信息功能，而不是纯装饰。
- 是否每个 scene 都有可复用 `components`，且组件来源清楚。
- 是否主画面没有复述完整字幕。
- 是否字幕安全区固定在底部。
- 是否至少 4 种镜头表达或动画组合。
- 是否没有复用上一条视频的主题模板、背景、排版和动效。
- 是否没有推断默认视觉风格；视觉风格必须交给 `style-consultant` 一问一答确认。
