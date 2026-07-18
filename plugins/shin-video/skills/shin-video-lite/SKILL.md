---
name: shin-video-lite
description: 保留给既有调用方的兼容入口。它将旧调用转入完整 Shin-video 链路，仍使用 TTS 服务商原生时间戳和确认后的口播文案。
---

# Shin-video 兼容入口

这是给既有调用方保留的兼容路由，不是新的公开入口。新的用户请求必须从 `shin-video-director` 开始；本 Skill 只承接已存在的 `shin-video-lite` 调用，并把它们转入相同的完整链路。

核心原则：

```text
用户只感知：文章进，视频出。
系统内部仍然走：brief、口播、TTS 音频与原生时间戳、场景、视觉清单、导演方案、风格系统、production gate、Remotion 渲染。
```

> 路径约定：`RUN_DIR` 表示当前项目的 `<项目目录>/_runtime/<run-id>/`。`public/runtime/` 仅用于 Remotion 静态资源，不得作为项目中间产物目录。

## 能解决什么问题

把公众号文章、新闻链接、网页正文或本地长文本变成一条带口播、字幕、导演镜头设计和 Remotion 动画的视频。

这个入口学习的是 `github-skill-video-maker` 的生产范式，不是只学习 GitHub 题材。真正要迁移的是：

```text
轻入口
→ browser evidence
→ video-brief.json
→ 真实截图/证据素材
→ asset-manifest.json
→ visual-manifest.json
→ 双层字幕
→ production gate
→ QA/发布包
```

所以，无论输入是不是 GitHub 仓库，只要是可公开讨论的文章或事件，都必须尝试外部资料检索和证据素材绑定，不能退回纯 PPT 卡片。

用户不需要理解 TTS 时间戳格式、Remotion、`director-plan.json`、`style-profile.json`、`visual-manifest.json` 或 production gate。

插件不定义 `shin-video:lite` 命令。若现有运行引擎已暴露同名兼容命令，它只能转入本 Skill；新调用使用 `shin-video-director`。

## 用户输入

```text
文章链接、文章正文或文章文件
可选：视频标题
可选：已有口播音频 mp3 和同一次 TTS 请求返回的原生时间轴
可选：风格、比例、音色
```

兼容调用可以省略中间产物展示，但仍必须取得用户明确的导演稿、视觉风格和比例确认；只有用户明确要求“先给我审核”时，才逐项展示专家审核材料。

## 用户输出

```text
日期文件夹/视频标题/
  视频标题.mp4
  口播文案.md
  video-brief.json
  asset-manifest.json
  director-plan.json
  visual-manifest.json
  style-profile.json
  publishing-pack.md
```

自检帧、临时截图、缓存文件可以生成，但项目完成后必须清理。

## 内部 Skill 组成

```text
web-article-cleaner
browser-evidence-capture
video-brief-builder
voiceover-writer
audio-checker
scene-generator
subtitle-rhythm-builder
asset-researcher
visual-manifest-builder
remotion-video-director
style-consultant
animation-preset-builder
production-gate-checker
remotion-renderer
```

## 默认自动执行流程

1. 接收文章或链接，调用 `web-article-cleaner` 整理正文。
2. 调用 `browser-evidence-capture` 记录来源文章、外部资料页、关键段落、截图坐标和证据边界；如果用户禁止使用公众号原图，只保存文本/HTML/坐标和外部资料截图，不把公众号原图作为视频素材。
3. 调用 `video-brief-builder` 生成 `RUN_DIR/video-brief.json`，先锁定观众、角度、钩子、证据和视觉禁区。
4. 调用 `voiceover-writer` 生成口播文案。兼容调用可以不逐句展示，但字幕正文仍以用户确认后的版本为准。
5. 使用已配置的 TTS 服务商同时生成最终音频和原生时间戳，并将时间位置规范化为 `RUN_DIR/subtitle-timeline.json`。默认支持 MiniMax 和火山引擎，也允许接入满足统一合同的其他服务商。
6. 调用 `audio-checker` 校验音频、时间轴、服务商信息和音频/文案指纹。用户提供 `--audio` 时必须同时提供同一次生成得到的时间轴。
7. 调用 `scene-generator` 和 `subtitle-rhythm-builder`。字幕正文必须来自确认后的口播文案，服务商返回文本不得覆盖字幕正文。
8. 调用 `asset-researcher` 自动搜集相关网页、真实截图、OpenGraph 图片或来源卡，生成 `RUN_DIR/asset-manifest.json` 和 `evidenceRecords`，并把素材绑定回 scenes。这个步骤适用于公众号、新闻、研报、产品发布、开源项目等任意文章输入，不是 GitHub 专属。
9. 调用 `visual-manifest-builder` 生成 `RUN_DIR/visual-manifest.json`，基于 `asset-manifest.json` 绑定每个镜头的画面目标、证据素材和字幕安全区。
10. 调用 `remotion-video-director` 输出导演稿和 `RUN_DIR/director-plan.json`，并取得用户确认后再进入风格步骤。
11. 调用 `style-consultant` 读取用户显式要求；用户未指定时必须追问风格和比例，不得根据文章内容自动选择。
12. 调用 `animation-preset-builder` 生成 `RUN_DIR/style-profile.json`。
13. 调用 `production-gate-checker`，不通过则停止渲染，并用普通语言说明返工点。
14. 调用 `remotion-renderer` 生成视频，并输出发布文案。

## 专家审核模式

当用户明确说“先给我审核导演方案”“先出视频指令”“不要直接渲染”时，才停在以下节点：

```text
video-brief.json
口播文案.md
director-script.md
director-plan.json
visual-manifest.json
style-profile.json
```

用户确认后再渲染。

## 失败处理

- 当前 TTS 服务商不可用：提示用户配置 MiniMax、火山引擎或满足统一合同的其他服务商，不暴露内部堆栈。
- TTS 服务商不返回原生时间戳：明确停止，说明该服务商不满足当前视频链路；不得只接受 mp3 后继续。
- Remotion 不可用：提示本地渲染环境不完整，并引导运行 `npm run doctor`。
- production gate 不通过：说明会影响视频质量的具体问题，不继续渲染。

## 禁止事项

- 不要向普通用户解释内部 JSON，除非用户主动问。
- 不要把“文档生成了”说成“视频生成了”。
- 不要让 TTS 服务商返回文本覆盖口播文案。
- 不要使用非同次 TTS 返回或无法验证来源的时间位置。
- 不要跳过 `browser-evidence-capture` 和 `asset-manifest.json`。
- 不要绕过 `asset-manifest.json` 直接套模板渲染。
- 不要把外部素材研究只用于 GitHub 项目；任意文章都要先尝试搜索相关官网、报道、产品页、数据页或可读证据卡。
- 不要在 production gate 失败后继续渲染。
- 不要把轻量入口做成只会问问题的人工流程；默认必须推进到成片包。
