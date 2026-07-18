# Shin-video Agent Guide

`shin-video-director` 是唯一推荐公开入口。它根据用户现有材料在专业模式和轻量模式之间路由；`shin-video-lite` 仅保留为兼容入口。

开始制作前，按以下顺序读取：

```text
workflow-manifest.json
references/规范/getting-started.md
references/审核规则/agent-guide.md
references/规范/前期准备说明.md
skills/shin-video-director/SKILL.md
```

## 工作流

```text
文章或链接
→ 文章正文.md
→ 浏览器证据采集
→ RUN_DIR/video-brief.json
→ 口播文案.md
→ TTS 最终音频 + 服务商原生时间戳
→ RUN_DIR/subtitle-timeline.json
→ RUN_DIR/scenes.json
→ RUN_DIR/asset-manifest.json
→ RUN_DIR/visual-manifest.json
→ RUN_DIR/director-plan.json
→ RUN_DIR/style-profile.json
→ RUN_DIR/production-gate-report.json
→ RUN_DIR/preview.mp4
→ <项目目录>/<视频标题>.mp4
```

其中 `RUN_DIR` 固定表示：

```text
<项目目录>/_runtime/<run-id>/
```

`public/runtime/` 是 Remotion 的静态资源目录，不是项目中间产物目录。

## 硬规则

- 确认后的 `口播文案.md` 是字幕正文唯一来源。
- TTS 服务商原生时间戳只提供时间位置；不得用服务商返回文本改写字幕正文。
- 先生成 `video-brief.json`、`asset-manifest.json`、`visual-manifest.json`、`director-plan.json`，再进入风格与渲染。
- 用户未确认导演稿时，不得渲染。
- 视觉风格和比例必须由用户确认；不得设置隐藏默认风格。
- 关键事实必须由外部证据素材、数据来源卡或可复核结构图支撑；主画面不得复读完整字幕。
- 引擎的 `npm run doctor` 或生产门槛未通过时，停止渲染并说明缺失条件。
- 不复用上一条视频的排版、背景或动效作为当前视频的默认方案。

## 引擎边界

插件负责工作流编排和质量规则。TTS、素材处理、Production Gate 与 Remotion 渲染由 Shin-video 本地引擎执行。引擎通过 `SHIN_VIDEO_ENGINE_ROOT` 或配置文件定位；不得假设用户目录或固定绝对路径。
