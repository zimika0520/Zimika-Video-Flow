---
name: remotion-renderer
description: 调用 Remotion 使用 RUN_DIR/scenes.json、RUN_DIR/style-profile.json 和 口播音频.mp3 渲染 Shin-video 预览视频与最终成片，并做基础质量检查。
---

# Remotion 渲染成片

这是场景四第 10 步，只能在 `remotion-video-director`、`style-consultant` 和 `animation-preset-builder` 完成之后执行。

调用 Remotion 渲染视频。

> 路径约定：`RUN_DIR` 表示当前项目的 `<项目目录>/_runtime/<run-id>/`。`public/runtime/` 仅用于 Remotion 静态资源，不得作为项目中间产物目录。

## 输入

```text
RUN_DIR/scenes.json
RUN_DIR/video-brief.json
RUN_DIR/asset-manifest.json
RUN_DIR/visual-manifest.json
RUN_DIR/director-plan.json
RUN_DIR/style-profile.json
RUN_DIR/subtitle-timeline.json
口播音频.mp3
```

## 渲染前检查

渲染前必须检查：

- 必须存在 `RUN_DIR/scenes.json`
- 必须存在 `RUN_DIR/video-brief.json`
- 必须存在 `RUN_DIR/asset-manifest.json`
- 必须存在 `RUN_DIR/visual-manifest.json`
- 必须存在 `RUN_DIR/director-plan.json`
- 必须存在 `RUN_DIR/style-profile.json`
- 必须存在最终音频对齐的字幕时间轴
- 必须存在 `口播音频.mp3`
- `RUN_DIR/video-brief.json` 必须声明字幕正文来自确认后的口播文案，时间位置来自 TTS 服务商原生时间戳
- `RUN_DIR/subtitle-timeline.json` 的 `source` 必须是 `provider-native`，并与当前音频和口播文案指纹匹配
- `RUN_DIR/asset-manifest.json` 必须包含每个 scene 的素材绑定和可追溯 `evidenceRecords`
- `RUN_DIR/visual-manifest.json` 必须为每个 scene 声明 `visualGoal`、`narrationClaim`、`safeZones` 和 `overlapRisks`
- `RUN_DIR/director-plan.json` 必须包含 `directorPlanVersion`
- `RUN_DIR/director-plan.json` 必须包含 `sourceScenesFingerprint`
- `sourceScenesFingerprint` 必须与当前 `RUN_DIR/scenes.json` 重新计算后的指纹一致
- `RUN_DIR/director-plan.json` 必须包含 `audioStrategy`
- `RUN_DIR/director-plan.json` 必须包含 `reviewScorecard`
- `RUN_DIR/director-plan.json` 的每个 scene 必须包含可执行 `components`
- `RUN_DIR/style-profile.json` 必须包含 `styleProfileVersion`
- `RUN_DIR/style-profile.json` 必须包含可执行视觉配置，而不是只有中文描述

缺少 RUN_DIR/director-plan.json 时，停止渲染，回到 `remotion-video-director`，先生成导演方案。

如果 `RUN_DIR/scenes.json`、口播文案、素材包、音频时间轴有任何变化，旧 `RUN_DIR/director-plan.json` 一律视为失效。此时不允许“先渲染看看”，必须先回到 `remotion-video-director`，基于当前口播文案、素材包和时间轴重新生成视觉系统、视觉效果和导演方案。

如果 `RUN_DIR/director-plan.json` 缺少 `audioStrategy`、`reviewScorecard`、scene components、用户确认过的导演稿，或仍然像自然语言分镜而不是可执行 DSL，停止渲染，回到 `remotion-video-director` 重新生成。

缺少 RUN_DIR/style-profile.json 时，停止渲染，回到 `style-consultant` 和 `animation-preset-builder`，先询问视觉风格并生成配置。

Remotion 模板必须读取 `RUN_DIR/video-brief.json`、`RUN_DIR/asset-manifest.json`、`RUN_DIR/visual-manifest.json`、`RUN_DIR/director-plan.json` 和 `RUN_DIR/style-profile.json`，并把其中的素材绑定、证据记录、`directorType`、`shotStyle`、`cameraMotion`、`visualFoundation`、`motionSystem`、`effectsSystem`、`transitionSystem`、`visualGoal`、`safeZones`、`overlapRisks` 应用到画面。如果模板没有读取这些文件，禁止继续渲染或交付。

Remotion 模板还必须读取 `RUN_DIR/scenes.json` 里每一段的：

```text
sceneType
directorType
shotStyle
cameraMotion
visualIntent
layoutRecipe
motionVariant
transition
visualModules
pace
```

渲染时不能再只用正则或固定顺序猜模板。正确方式是：

```text
scene.sceneType -> 对应场景组件
directorPlan.scenes[].directorType -> 对应导演镜头组件
shotStyle / cameraMotion -> 决定镜头运动和空间层次
motionVariant -> 对应入场、镜头、卡片、关键词动画
visualModules -> 启用 transforms / layers / transitions / effects / fonts / measuring / randomness / animation math / noise / light leaks / starburst / svg path 等 Remotion 视觉能力
video-brief.json -> 提供观众、角度、证据方向、字幕策略和生产门槛
asset-manifest.json -> 提供网页证据、截图、来源卡、OpenGraph 图片、evidenceRecords 和 scene 素材绑定
visual-manifest.json -> 提供每个镜头的视觉目标、证据素材、安全区和重叠风险
style-profile.json -> 提供统一主题、色彩、字体、安全区、动效强度和防重复规则
```

如果一条视频里所有段落都长得一样，或者没有读取 `director-plan.json`、`sceneType` / `motionVariant` / `visualModules`，视为渲染质量检查失败，需要回到 `scene-generator`、`remotion-video-director` 和 `animation-preset-builder` 修正。

## Remotion 官方实现规则

渲染模板必须按 Remotion 官方方式实现：

- 用 `<Sequence>` / `<Series>` 编排每个 scene 的时间，不用普通 React 状态模拟时间轴。
- 用 `useCurrentFrame()` 读取当前帧。
- 用 `interpolate()`、`spring()`、`Easing`、`interpolateColors()` 做动画，不用 CSS transition 当作核心动效。
- 字幕按 captions JSON / caption items 独立渲染，字幕只跟随音频时序，不和主画面卡片绑定。
- 资源使用 Remotion 支持的静态文件、图片、字体和音频加载方式。
- 需要图表、关系图、时间线时，封装为可复用组件，不要每个 scene 重写一套 UI。
  - scene 组件优先来自导演方案里的 `components` 映射和 `../../references/规范/component-library.md`，不要在渲染阶段临时发明整套重复界面。
- 渲染前必须通过 `production-gate-checker`；production gate 未通过时停止，不允许“先出一版看看”。
- production gate 中的镜头时长、镜头密度、声明视觉形式数量、renderer family 数量和动效组合数量只产生告警，不得单独阻断渲染。
- 音频按 `audioStrategy` 执行：口播优先；没有音乐素材时不强行加音乐；有音乐时必须 ducking，不能盖住人声。
- 文字必须限制最大行宽或测量尺寸，避免字幕、图表和标题互相覆盖。
- 默认不加噪点，不做无意义抖动。
- 图表、K 线、仪表盘、热力图只允许读取有来源的数据。缺少事实数值时，改用定性关系、关键词、证据截图或结构图，不得补造曲线、百分比和刻度。
- 普通网页证据、外部截图和来源素材优先于通用主题卡片或固定模板回退。

## 输出

预览：

```text
RUN_DIR/preview.mp4
```

最终：

```text
<项目目录>/<视频标题>.mp4
```

## 环境检查

在 Shin-video 项目根目录先检查：

```bash
node -v
npm -v
npx remotion --version
npm run doctor
npm ls zod @remotion/bundler @remotion/cli @remotion/renderer remotion --depth=0
ffmpeg -version
```

`npm run doctor` 是渲染前硬门禁。它必须确认：

```text
remotion/visual-library 已存在且模块完整
lib/types.ts 包含新版 directorType
scene-generator 能输出新版导演类型、components、shotStyle、background 和 animation
remotion/Video.tsx 能把新版 directorType 分发到对应视觉组件
lib/remotion-render.ts 会校验 sourceScenesFingerprint
lib/remotion-render.ts 会执行 production gate
Skill 文档已要求读取 RUN_DIR/director-plan.json 和 RUN_DIR/style-profile.json
```

如果 `npm run doctor` 失败，禁止继续渲染。此时继续跑 Remotion 只会让导演方案退化成旧模板，产出质量不可控。

完整交付前建议执行：

```bash
npm run verify-workflow
```

Remotion 依赖必须版本对齐。当前 Shin-video 模板要求：

```text
remotion 4.0.484
@remotion/cli 4.0.484
@remotion/bundler 4.0.484
@remotion/renderer 4.0.484
zod 4.3.6
```

如果出现 `Remotion version mismatch`、`zod` 版本不符合要求，或 Remotion 四个包版本不一致，先修依赖再渲染：

```bash
npm install zod@4.3.6 remotion@4.0.484 @remotion/cli@4.0.484 @remotion/bundler@4.0.484 @remotion/renderer@4.0.484 --save-exact
```

如果 `npx remotion --version` 失败，先读取：

```text
../../references/规范/TTS服务商与Remotion部署说明.md
```

已有 Shin-video 项目时，优先执行：

```bash
npm install
```

如果仍缺 Remotion：

```bash
npm install remotion@4.0.484 @remotion/cli@4.0.484 @remotion/renderer@4.0.484 @remotion/bundler@4.0.484 zod@4.3.6 --save-exact
```

## 渲染规则

- 先生成 `RUN_DIR/preview.mp4`。
- 用户确认预览后，再输出 `<项目目录>/<视频标题>.mp4`。
- 如果项目目录不存在，先创建。
- 不要把最终视频输出到其他目录。

## 命令模板

预览：

```bash
npm run render:preview
```

最终成片：

```bash
npm run render:final
```

如果项目没有这两个脚本，先不要乱猜命令；读取当前项目 `package.json`，找到 Remotion 渲染脚本后再执行。

## 基础质量检查

渲染后检查：

- 视频文件是否存在。
- 文件大小是否明显异常。
- 视频是否能播放。
- 是否有音频。
- 是否黑屏。
- 视频时长是否接近口播音频时长。
- 字幕和主要文字是否明显溢出。
- 字幕是否固定在底部安全区，且没有和主画面重叠。
- 主画面是否没有复述完整字幕。
- 是否执行了 `audioStrategy`，音乐没有盖住口播。
- 是否存在 `reviewScorecard`，且没有标记为 `rework` 仍继续导出。
- 每个 scene 是否生成一张中点代表帧。
- 相邻镜头最终构图是否经过相似度比较。
- 是否出现连续 3 个高度相似的最终构图；出现时禁止交付。
- 导演选中的主视觉素材是否实际进入画面。
- 同一主视觉素材是否被高频复用；出现时列为返工告警。
- 字幕安全区、标题、图表、素材主体是否存在遮挡或冲突。
- 镜头时长、镜头密度、声明视觉形式、renderer family 和动效组合数量只作为审片参考，不得代替逐镜头代表帧检查。
- Remotion 模板是否真的读取 `RUN_DIR/director-plan.json`、`RUN_DIR/style-profile.json` 与 `RUN_DIR/scenes.json` 的新视觉字段。
- 是否使用 ffprobe 或等效工具确认音视频流、时长和编码结果。
- 是否保留质量报告和代表帧供预览审查。

预览检查失败时保留质量报告和代表帧供返工；最终导出检查失败时删除失败的最终 MP4，不得交付。

## 失败提示

缺 Remotion 时：

```text
当前项目还没有可用的 Remotion 环境。我需要先执行 npm install，并确认 npx remotion --version 可以正常输出。
```

缺 FFmpeg 时：

```text
当前机器缺少 FFmpeg，Remotion 渲染可能无法正常编码视频。我需要先安装 FFmpeg。
```

渲染失败时：

```text
Remotion 渲染失败。我会先检查 scenes.json、style-profile.json、口播音频.mp3、FFmpeg 和输出目录，再重新渲染。
```
