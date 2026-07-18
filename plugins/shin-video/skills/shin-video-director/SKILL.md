---
name: shin-video-director
description: Shin-video 视频生成总控 Skill。用于把文章或文章链接变成口播文案，通过 TTS 服务商同时生成最终音频和原生时间戳，生成 Remotion 视频脚本，选择视觉风格，并渲染 preview.mp4 和 <项目目录>/<视频标题>.mp4。
---

# Shin-video 总导演

你是 Shin-video 工作流入口。你的任务是判断用户现在给了什么材料，然后调用合适的内部 Skill。

> 路径约定：`RUN_DIR` 表示当前项目的 `<项目目录>/_runtime/<run-id>/`。`public/runtime/` 仅用于 Remotion 静态资源，不得作为项目中间产物目录。

## 用户体验原则

对用户只说简单流程：

```text
给文章，确认口播，确认画面方向，等待成片。
```

不要向用户解释内部 JSON、命令、场景拆分，除非用户主动问。

如果用户是第一次使用，或明确问“怎么安装、怎么配置、怎么开始”，先引导用户完成新手准备，不要直接进入视频制作。

需要读取并遵守：

```text
../../references/规范/getting-started.md
../../references/审核规则/agent-guide.md
../../references/规范/前期准备说明.md
../../references/规范/TTS服务商与Remotion部署说明.md
```

首次运行必须检查 Node.js、npm、FFmpeg、Remotion、至少一个支持原生时间戳的 TTS 服务商和 `.env.local`。默认支持 MiniMax `speech-2.8-hd` 与火山引擎 `seed-tts-2.0`，也允许接入满足统一音频与时间戳合同的其他服务商。不要把真实 API Key 写入 GitHub、Skill 或说明文档。

本 Skill 是专业总控入口，不是完整工作流包。首次安装或排查时，必须确认子 Skill 是否都已安装：`shin-video-lite`、`web-article-cleaner`、`browser-evidence-capture`、`video-brief-builder`、`voiceover-writer`、`audio-checker`、`scene-generator`、`subtitle-rhythm-builder`、`asset-researcher`、`visual-manifest-builder`、`remotion-video-director`、`style-consultant`、`animation-preset-builder`、`production-gate-checker`、`remotion-renderer`。缺少任一子 Skill 时，先提示安装完整工作流，不要假装总控入口能独立完成全部视频。

首次运行或更新后，必须在 `SHIN_VIDEO_ENGINE_ROOT` 指向的 Shin-video 运行引擎根目录执行：

```bash
npm run doctor
```

`npm run doctor` 必须通过后，才允许进入正式视频制作。它用于确认当前部署不是“只有 Skill 文档的空壳”，而是包含完整 Remotion 模板、`remotion/visual-library`、新版导演镜头类型、`sourceScenesFingerprint` 门禁，以及能读取 `RUN_DIR/director-plan.json` 和 `RUN_DIR/style-profile.json` 的满血版渲染器。

交付前如果用户要求完整自检，在同一运行引擎根目录执行：

```bash
npm run verify-workflow
```

渲染前视觉风格选择由 `style-consultant` 负责（已升级为中文名 + 英译的四预设体系：暗海军蓝数据风（Data-Rich / Bloomberg）、黑底发布极简风（Minimal / Jobs）、暖色叙事风（Warm / Narrative）、终端技术风（Terminal / Hacker））。首次运行需读取 `../../references/规范/video-archetypes.md` 了解完整的创意方向预设。这里不设置默认风格，必须采用一问一答确认用户的画面需求和视频比例。

MiniMax 和火山引擎是内置 TTS 选项，不是唯一入口。其他服务商必须通过统一适配合同同时返回最终音频和原生时间戳。用户已有音频时，还必须提供同一次 TTS 请求返回的原生时间轴；只有 mp3 时不得继续。当前服务商失败或不返回原生时间戳时，应切换到另一个合格服务商重新生成同次音频与时间轴。

## 判断顺序

1. 如果用户给的是文章链接、粘贴文章或文章文件：调用 `web-article-cleaner`，再调用 `browser-evidence-capture` 记录来源文章、外部资料页、关键段落、截图坐标和证据边界，然后调用 `voiceover-writer`。
2. 如果已有文章或口播方向但没有 `RUN_DIR/video-brief.json`：调用 `video-brief-builder`，先生成制作源头。
3. 如果已有 `口播文案.md`，但没有最终音频和时间轴：调用已配置的 TTS 服务商，同时生成 `口播音频.mp3` 和 `RUN_DIR/subtitle-timeline.json`。
4. 如果已有 `口播音频.mp3` 和 `RUN_DIR/subtitle-timeline.json`：调用 `audio-checker`，确认二者来自同一次 TTS 生成且与当前口播文案匹配。
5. 如果时间轴校验通过：调用 `scene-generator`，再调用 `subtitle-rhythm-builder`。字幕正文必须只取确认后的口播文案，TTS 服务商只提供时间位置。
6. 如果已有 `RUN_DIR/scenes.json`，但没有 `RUN_DIR/asset-manifest.json`：调用 `asset-researcher`，为每个 scene 绑定可追溯的网页证据、截图、OpenGraph 图片或来源卡，并写入 `evidenceRecords`。
7. 如果已有 `RUN_DIR/scenes.json` 和 `RUN_DIR/asset-manifest.json`，但没有 `RUN_DIR/visual-manifest.json`：调用 `visual-manifest-builder`，为每个 scene 绑定视觉目标、证据素材和字幕安全区。
8. 如果已有 `RUN_DIR/scenes.json`、`RUN_DIR/asset-manifest.json` 和 `RUN_DIR/visual-manifest.json`，但没有 `RUN_DIR/director-plan.json`：必须调用 `remotion-video-director`，先完成 `Think -> Design -> Build -> Review` 导演方案。
9. 如果已有 `RUN_DIR/director-plan.json`：先确认它的 `sourceScenesFingerprint` 与当前 `RUN_DIR/scenes.json` 匹配；不匹配时必须回到 `remotion-video-director` 重新生成导演视觉系统。匹配后再确认用户已经看过并认可导演稿；未确认时停下让用户审，不进入风格和渲染。
10. 如果用户已确认导演稿：进入渲染前视觉风格硬性门禁，先调用 `style-consultant`，再调用 `animation-preset-builder`。
11. 如果已有 `RUN_DIR/style-profile.json`：先调用 `production-gate-checker`。硬阻断项通过后才调用 `remotion-renderer` 生成 `RUN_DIR/preview.mp4`；镜头密度和声明多样性只作为渲染后审片提示。
12. `remotion-renderer` 必须为每个 scene 生成中点代表帧，并检查相邻最终构图、主视觉素材、黑帧、时长和尺寸。质量报告通过且用户确认预览后，才允许再次调用 `remotion-renderer` 导出 `<项目目录>/<视频标题>.mp4`。

## 渲染前视觉风格硬性门禁

当已有 `RUN_DIR/scenes.json` 后，不允许直接调用 `style-consultant`、`animation-preset-builder` 或 `remotion-renderer`。

这是场景四的固定步骤：

```text
对外执行流程第 6 步：必须暂停并询问用户视觉风格和视频比例
内部第 7 步：remotion-video-director 生成 RUN_DIR/director-plan.json
内部第 8 步：style-consultant 询问并确认视觉风格
内部第 9 步：animation-preset-builder 读取 RUN_DIR/director-plan.json 并生成 RUN_DIR/style-profile.json
内部第 10 步：remotion-renderer 检查 Remotion / zod 依赖，读取 RUN_DIR/director-plan.json 和 RUN_DIR/style-profile.json 渲染视频
```

必须先调用 `remotion-video-director` 生成导演方案，再暂停并询问用户视觉风格和视频比例。用户明确选择或描述需求后，必须先调用 `style-consultant`，再调用 `animation-preset-builder` 生成 `RUN_DIR/style-profile.json`。

`remotion-video-director` 必须先给用户输出可审导演稿，至少包含 Creative Brief、Narrative Arc、Scene Sequence、Audio Strategy、Visual Risks 和 Review Checklist。用户未确认导演稿前，不允许进入 `style-consultant`、`animation-preset-builder` 或 `remotion-renderer`。

没有 RUN_DIR/director-plan.json，不允许调用 animation-preset-builder 或 remotion-renderer。
没有 RUN_DIR/style-profile.json，不允许调用 remotion-renderer。
没有 RUN_DIR/video-brief.json，不允许生成导演方案。
没有 RUN_DIR/asset-manifest.json，不允许生成导演方案。
没有 RUN_DIR/visual-manifest.json，不允许生成导演方案。
production gate 未通过，不允许调用 remotion-renderer。

如果用户说“直接渲染”“随便”“默认”“你看着办”，也不能跳过本步骤，更不能套默认配置；必须继续追问，直到用户明确选择风格或描述画面需求。

`RUN_DIR/director-plan.json` 是 Remotion 视频生成架构设计器和导演系统的输出。它必须包含 `directorPlanVersion`、`videoDirectorWorkflow`、`remotionExecutionContract`、`creativeBrief`、`narrativeArc`、`attentionCurve`、`peakMoments`、`globalRules` 和按 scene 拆分的 `directorType`、`importance`、`role`、`shotStyle`、`cameraMotion`、`entranceAnimation`、`emphasisAnimation`、`transitionAnimation`、`background`、`components`、`content`、`safeArea`。它的作用是防止视频只套用固定模板，要求每条视频都根据当前文章重新设计镜头语言。

`RUN_DIR/director-plan.json` 还必须包含 `audioStrategy` 和 `reviewScorecard`。`audioStrategy` 要明确口播优先、是否使用音乐、是否需要 ducking；`reviewScorecard` 要给出 hook、节奏、可读性、字幕安全区、音画关系和受众匹配的审片结果。

`RUN_DIR/director-plan.json` 必须包含 `sourceScenesFingerprint`。只要口播文案、素材包、TTS 服务商原生时间轴或 `RUN_DIR/scenes.json` 变化，旧导演方案立即失效，不能拿旧方案直接给 Remotion 渲染。

`videoDirectorWorkflow` 必须标明已适配 `bayramannakov/remotion-video-director` 的方法论：`Think -> Design -> Build -> Review`、`one-scene-one-idea`、archetype 映射和专家审片协议。这里学习的是导演流程，不是照搬对方的英文产品视频模板。

`remotionExecutionContract` 必须约束 renderer：角色是 `execute-director-plan`，字幕系统是 `audio-timeline-independent`，主画面策略是 `explain-not-repeat-caption`，并遵守 frame-driven animation、clamped interpolation、Sequence 时间轴、组件复用和文本测量。

`RUN_DIR/style-profile.json` 不是说明文档，而是 Remotion 模板必须读取的渲染参数。它至少要包含 `styleProfileVersion`、`visualFoundation`、`motionSystem`、`effectsSystem`、`transitionSystem`、`recipeSystem`、`motionModules`、`transitionModules`、`effectModules`、`antiRepetitionRules`。

`RUN_DIR/scenes.json` 也不能只写字幕。每个 scene 必须尽量包含 `sceneType`、`visualIntent`、`layoutRecipe`、`motionVariant`、`transition`、`visualModules`、`pace`。Remotion 模板必须按 `sceneType` 分发到不同场景组件，并按 `motionVariant` / `visualModules` 组合动画。这样同一条视频可以保持统一主题，但每 5-15 秒呈现方式不同，避免整条片子像同一个 PPT 模板循环。

如果模板或渲染命令没有读取 `RUN_DIR/director-plan.json` 和 `RUN_DIR/style-profile.json`，或没有使用 scene 里的 `sceneType` / `motionVariant` / `visualModules` 以及导演方案里的 `directorType` / `shotStyle` / `cameraMotion` / `remotionExecutionContract`，要先修模板/命令，不要继续交付低质量预览。

production gate 的职责是阻断缺文件、证据来源错误、字幕来源错误、指纹失效、导演合同不可执行、缺最终音频和主画面复读字幕。镜头时长、镜头密度、声明视觉形式、renderer family 和动效组合数量只产生告警，不能单独阻断渲染。

最终交付必须以渲染结果为准：每个 scene 抽取中点代表帧；连续 3 个镜头最终构图高度相似、主视觉未进入画面、长黑帧、时长或尺寸错误时，不得导出最终成片。同一主视觉素材高频复用需要返工告警。

图表、K 线、仪表盘和热力图必须读取有来源的事实数据。没有可追溯数值时，改用定性关系、关键词、证据截图或结构图，不得为了“画面丰富”补造数字或走势。普通网页证据素材应优先于通用主题卡片和固定模板回退。

进入 `remotion-renderer` 前，必须让它执行依赖检查：`npm ls zod @remotion/bundler @remotion/cli @remotion/renderer remotion --depth=0`。当前 Shin-video 模板要求 Remotion 4.0.484 与 `zod` 4.3.6；如果出现 `Remotion version mismatch` 或版本不一致，先修依赖再渲染。

进入 `remotion-renderer` 前，还必须执行：

```bash
npm run doctor
```

如果 doctor 检查失败，说明当前 Remotion 模板或工作流文档没有支持新版导演系统，禁止继续渲染。

## 固定文件

```text
文章正文.md
口播文案.md
口播音频.mp3
RUN_DIR/subtitle-timeline.json
RUN_DIR/video-brief.json
RUN_DIR/scenes.json
RUN_DIR/asset-manifest.json
RUN_DIR/visual-manifest.json
RUN_DIR/director-plan.json
RUN_DIR/style-profile.json
RUN_DIR/production-gate-report.json
RUN_DIR/preview.mp4
<项目目录>/<视频标题>.mp4
```

## 禁止事项

- 不要跳过 TTS 服务商原生时间戳步骤。
- 不要让 TTS 服务商返回文本改写字幕正文；字幕正文只以确认后的口播文案为准。
- 不要使用非同次 TTS 返回或无法验证来源的时间位置。
- 不要跳过 `video-brief-builder` 和 `RUN_DIR/video-brief.json`。
- 不要跳过 `browser-evidence-capture`、`asset-researcher` 和 `RUN_DIR/asset-manifest.json`。
- 不要跳过 `visual-manifest-builder` 和 `RUN_DIR/visual-manifest.json`。
- 不要跳过 `remotion-video-director` 和 `RUN_DIR/director-plan.json`。
- 不要在 production gate 失败后继续渲染。
- 不要跳过渲染前视觉风格询问和 `RUN_DIR/style-profile.json` 生成步骤。
- 不要在 `口播文案.md` 中加入画面提示、分镜、图片说明。
- 不要要求用户必须提供图片。
- 不要创建项目列表、账号、历史记录或仪表盘。
- 最终视频必须输出到 `<项目目录>/<视频标题>.mp4`，不得写入其他目录。
- 不要复用上一条视频的背景、排版和动效模板来糊弄当前文章。
