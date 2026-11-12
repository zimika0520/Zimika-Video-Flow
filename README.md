# Zimika Video Flow

将文章、新闻链接或长文制作成带口播、字幕、证据素材、导演方案和 Remotion 动效的本地短视频。

Zimika Video Flow 是 Zimika 的二次开发作品，核心代码来自 [Shin-video](https://github.com/Shinchan-crayon/Shin-video)。它不把正文直接堆成卡片，而是先生成视频 Brief、口播、时间轴、素材清单和导演方案，再通过质量门禁交给 Remotion 渲染。来源与使用边界见 [UPSTREAM.md](UPSTREAM.md)。

```mermaid
flowchart LR
  A["文章 / 链接"] --> B["内容与证据"]
  B --> C["视频 Brief"]
  C --> D["口播与原生时间戳"]
  D --> E["场景、素材与视觉清单"]
  E --> F["导演方案与风格确认"]
  F --> G["Production Gate"]
  G --> H["本地成片"]
```

## 使用方式

面向 Codex 使用时，安装仓库中的插件，并直接调用：

```text
用 Zimika Video Flow 把这篇文章做成短视频，先给我导演方案审核。
```

插件内部继续保留 `shin-video` 标识以兼容既有脚本和测试，公开展示名称统一为 Zimika Video Flow。

安装、TTS 配置和首次制作说明见：

- [插件说明](plugins/shin-video/README.md)
- [首次使用](plugins/shin-video/references/规范/getting-started.md)
- [TTS 与 Remotion 配置](plugins/shin-video/references/规范/TTS服务商与Remotion部署说明.md)

## 本地引擎

仓库根目录保存实际运行的 Next.js 与 Remotion 引擎。复制 `.env.local.example` 为 `.env.local`，配置至少一个可返回“最终音频 + 原生时间戳”的 TTS 服务商，然后运行：

```bash
npm install
npm run doctor
```

默认成片输出到仓库内的 `./outputs/`，该目录不会被 Git 跟踪。你可以在 `.env.local` 里将 `DEFAULT_OUTPUT_ROOT` 改为任意本地目录。

## 仓库结构

```text
app/                 Web API
components/          编辑器界面
lib/                 工作流与渲染逻辑
remotion/            视频组件与动画
plugins/shin-video/  可安装的 Codex 插件
scripts/             引擎检查与渲染命令
test/                自动化测试
```

## 本地文件

真实 API Key、输出视频和运行时缓存只保存在本地，不会提交到仓库。可安装插件只包含运行所需的规则、模板、资源与配置示例。

## Zimika 的工程整理

- 统一应用、插件市场、页面标题和展示素材的品牌。
- 增加 `LEARNING_GUIDE.md`，覆盖安装、测试、页面启动、核心链路和面试讲法。
- 保留完整测试与构建流程；当前本地验证为 566 项测试通过，Next.js 生产构建成功。
- 保留上游来源、作者和授权说明，不把上游实现整体冒充为从零原创。

## 快速验证

```bash
npm ci
npm test -- --run
npm run build
```

真实生成视频前还需要配置支持原生时间戳的 TTS 服务、FFmpeg 和 `.env.local`。不要提交任何 API Key。
