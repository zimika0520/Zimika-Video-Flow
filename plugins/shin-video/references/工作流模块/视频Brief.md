---
module: 视频Brief
description: 在口播确认前后生成 Zimika Video Flow 的制作源头 RUN_DIR/video-brief.json，锁定主题、观众、钩子、证据、视觉方向和字幕策略。
---

# Video Brief Builder

> 路径约定：`RUN_DIR` 表示当前项目的 `<项目目录>/_runtime/<run-id>/`。`public/runtime/` 仅用于 Remotion 静态资源，不得作为项目中间产物目录。

## 能解决什么问题

防止视频从文章直接跳到模板。先回答“这条视频为什么值得看、给谁看、用什么证据讲清楚”，再进入音频、时间轴和导演方案。

## 输入

```text
文章正文.md
用户补充需求
口播文案.md（如果已经确认）
素材约束或平台约束
```

## 输出

```text
RUN_DIR/video-brief.json
```

## 必填字段

```text
topic
audience
coreAngle
whyWatch
viewerDoubt
plainAnswer
hook
narrativeArc
proofPoints
assetNeeds
visualDirection
subtitleStrategy
productionGate
requiredOutputs
```

## 字幕策略硬规则

```text
已配置的 TTS 服务商负责同时生成最终音频和原生时间戳
原生时间戳统一保存为 RUN_DIR/subtitle-timeline.json
字幕正文以口播文案为准
TTS 服务商返回文本不允许改写字幕正文
Remotion 只按 subtitle-timeline 渲染底部字幕
```

`subtitleStrategy.textSource` 必须是 `voiceover-script`。
`subtitleStrategy.timingSource` 必须是 `provider-native`。

服务商不返回原生时间戳时必须停止，只能切换到合格服务商重新生成同次音频与时间轴。音频或口播文案变化后，旧时间轴立即失效。

## 质量门槛

- `coreAngle` 不能只是标题复述，必须是视频判断角度。
- `whyWatch` 必须回答观众为什么继续看。
- `visualDirection.mustAvoid` 必须写出本条视频的视觉禁区。
- `assetNeeds` 必须说明哪些素材能支撑关键观点。
- 不允许把导演镜头细节塞进 brief，brief 只定义制作目标。
