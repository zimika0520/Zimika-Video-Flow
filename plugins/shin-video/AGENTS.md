# Shin-video Agent Guide

`shin-video` 是唯一公开入口。它根据用户现有材料在内部路由完整生产链路；不要向用户暴露或要求安装阶段 Skill。

## 默认模式

默认使用 `production` 模式。文章转视频、继续当前视频、重新渲染、修改口播或画面、交付成片，都只推进视频项目，不修改 Shin-video 仓库。

只有用户明确要求修改、升级、开发、重构或修复插件、引擎或源码，才切换到 `development` 模式。安装、API 配置和环境排查可以运行 `npm run doctor`，但不授权修改源码。

`production` 模式只允许写入本机配置、项目运行目录和最终输出目录；禁止修改 `plugins/`、`skills/`、`lib/`、`remotion/`、`scripts/`、`test/`、插件清单和 Git 状态，禁止 commit、push、发布以及运行开发测试或构建。引擎能力不足时停止当前阶段并报告阻塞，不得现场开发修复。

开始制作前，按以下顺序读取：

```text
references/规范/getting-started.md
references/审核规则/agent-guide.md
references/规范/前期准备说明.md
skills/shin-video/SKILL.md
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
- 日常制作仅执行最终音频/时间轴一致性、导演方案/场景指纹、风格配置和基础媒体有效性检查；Brief、素材证据、视觉清单和导演语义质量不得在渲染前重复审查。
- `npm run doctor` 仅用于首次安装、引擎更新或环境故障排查；Production Gate 未通过时，停止渲染并说明缺失条件。
- 不复用上一条视频的排版、背景或动效作为当前视频的默认方案。
- 默认直接渲染最终 MP4。仅当用户明确要求审片时才生成预览；成功交付后自动清理临时 QA 帧、报告、缓存和可选预览。

## 引擎边界

插件负责工作流编排和质量规则。TTS、素材处理、Production Gate 与 Remotion 渲染由 Shin-video 本地引擎执行。引擎通过 `SHIN_VIDEO_ENGINE_ROOT` 或配置文件定位；不得假设用户目录或固定绝对路径。
