# Shin-video 新手使用指南

这份指南面向第一次使用 Shin-video 的用户。唯一公开入口是 `shin-video`。你只需要准备文章、配置一个支持原生时间戳的 TTS 服务商，并准备本地 Remotion 渲染环境；无需安装或调用额外阶段 Skill。

## 一、工作流会做什么

```text
文章或链接
→ 整理正文
→ 生成制作 Brief
→ 生成口播文案
→ TTS 服务商同时生成最终音频和原生时间戳
→ 生成字幕时间轴和视频场景
→ 搜集并绑定证据素材
→ 生成导演方案和视觉系统
→ Remotion 渲染器内部 Production Gate
→ 直接生成最终视频
```

字幕有两条固定规则：

```text
字幕正文只取确认后的 口播文案.md
字幕时间只取同次 TTS 请求返回的原生时间戳
```

服务商返回的文本只能用于核对时间位置，不能覆盖字幕正文。

## 二、准备本地环境

首次安装、引擎更新或环境故障排查时，进入 Shin-video 项目目录后检查：

```bash
node -v
npm -v
ffmpeg -version
npm install
npx remotion --version
npm run doctor
```

macOS 缺少基础环境时可以安装：

```bash
brew install node ffmpeg
```

`npm run doctor` 用于检查：

```text
Remotion 依赖和模板入口
导演镜头类型
remotion/visual-library 视觉组件库
工作流关键文件读取合同
生产门槛和输出目录
```

检查失败时先完成环境修复。日常制作不运行这些工程检查。只有安装、更新、发布、故障排查或用户明确要求完整工程自检时执行：

```bash
npm run verify-workflow
```

## 三、配置 TTS 服务商

复制环境变量模板：

```bash
cp .env.local.example .env.local
```

真实密钥只写入本机 `.env.local`，不要上传到 GitHub，也不要写进 Skill 或公开文档。

### MiniMax

```text
MINIMAX_API_KEY=你的密钥
MINIMAX_TTS_ENDPOINT=https://api.minimax.chat/v1/t2a_v2
MINIMAX_TTS_MODEL=speech-2.8-hd
MINIMAX_VOICE_ID=你的音色ID
MINIMAX_GROUP_ID=可选
```

### 火山引擎

```text
VOLCENGINE_TTS_API_KEY=你的密钥
VOLCENGINE_TTS_ENDPOINT=你的接口地址
VOLCENGINE_TTS_RESOURCE_ID=seed-tts-2.0
VOLCENGINE_TTS_VOICE_ID=zh_female_xiaohe_uranus_bigtts
```

### 其他服务商

其他服务商必须提供：

```text
接口地址
鉴权方式
模型标识
音色标识
最终音频
与最终音频同次生成的原生时间戳
```

如果服务商只返回音频，不返回原生时间戳，就不满足当前工作流要求，需要更换服务商或接口。

完整配置说明见：

```text
TTS服务商与Remotion部署说明.md
```

## 四、标准文件

每个项目至少包含：

```text
视频项目/
├── 文章正文.md
├── 口播文案.md
├── 口播音频.mp3
├── _runtime/
│   └── <run-id>/
│       ├── video-brief.json
│       ├── subtitle-timeline.json
│       ├── scenes.json
│       ├── asset-manifest.json
│       ├── visual-manifest.json
│       ├── director-plan.json
│       └── style-profile.json
└── <视频标题>.mp4
```

`RUN_DIR/subtitle-timeline.json` 必须满足：

```text
source 为 provider-native
记录服务商和请求信息
记录音频指纹和口播文案指纹
时间段按顺序递增
覆盖最终音频的有效时长
```

音频、文案或 TTS 请求发生变化后，旧时间轴立即失效，必须重新生成。

## 五、开始制作

通过 `$shin-video` 提交文章、链接或本地正文开始制作。插件不定义单独的安装、网页或命令行入口；运行引擎的可用命令以 `SHIN_VIDEO_ENGINE_ROOT` 指向目录中的 `package.json` 为准。

## 六、制作过程

### 1. 提供文章

可以粘贴正文、提供网页链接，或使用本地文章文件。

### 2. 确认口播

Agent 生成 `口播文案.md`。检查事实、语气和朗读流畅度。

### 3. 生成音频和时间轴

TTS 服务商必须在同一次请求中产出：

```text
口播音频.mp3
RUN_DIR/subtitle-timeline.json
```

只有音频时不能继续。时间轴通过校验后，Agent 才会生成字幕节奏和视频场景。

### 4. 生成导演方案

Agent 会结合文章、口播、时间轴和网络素材生成：

```text
RUN_DIR/asset-manifest.json
RUN_DIR/visual-manifest.json
RUN_DIR/director-plan.json
RUN_DIR/style-profile.json
```

用户确认导演稿、视觉风格和比例后，才进入渲染。

### 5. 渲染和验收

渲染器内部 Production Gate 通过后，直接生成：

```text
<项目目录>/<视频标题>.mp4
```

成片交付前只检查视频是否可播放、是否有声音、时长是否接近最终音频、尺寸是否正确。预览仅在你明确要求审片时生成。成功交付后，临时质检帧、报告、缓存和可选预览会自动清理。

## 七、常见问题

### TTS 服务商没有返回时间戳

当前请求必须停止。检查接口是否支持原生时间戳，或切换到满足合同的服务商重新生成同次音频与时间轴。

### 字幕文本和口播不一致

检查字幕正文是否重新取自 `口播文案.md`。服务商返回文本不能成为最终字幕。

### 音频更新后字幕错位

删除失效的 `RUN_DIR/subtitle-timeline.json`，用最终文案重新调用 TTS，同时生成新音频和新时间轴。

### 视频像幻灯片或画面重复

检查：

```text
RUN_DIR/asset-manifest.json
RUN_DIR/visual-manifest.json
RUN_DIR/director-plan.json
RUN_DIR/style-profile.json
Remotion 是否读取以上文件
```

缺少导演方案或视觉清单时禁止渲染。

### 字幕和主画面重叠

回到导演与渲染步骤，重新检查字幕安全区、主视觉目标区域和重叠风险。
