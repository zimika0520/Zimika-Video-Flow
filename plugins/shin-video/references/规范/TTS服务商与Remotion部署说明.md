# TTS 服务商与 Remotion 部署说明

这份说明给 Agent 和部署人员使用，用于在新机器上配置 Shin-video 的音频、时间轴和本地视频渲染环境。

## 一、部署目标

完整链路：

```text
口播文案.md
→ TTS 服务商同次生成最终音频和原生时间戳
→ 口播音频.mp3
→ RUN_DIR/subtitle-timeline.json
→ 场景、素材和导演方案
→ Remotion 渲染器内部 Production Gate
→ Remotion 直接生成 <项目目录>/<视频标题>.mp4
```

必须具备：

```text
Node.js
npm
FFmpeg
Remotion
Shin-video 模板和视觉组件库
至少一个支持原生时间戳的 TTS 服务商
```

## 二、基础环境

检查：

```bash
node -v
npm -v
ffmpeg -version
```

macOS 缺少基础工具时：

```bash
brew install node ffmpeg
```

## 三、配置 MiniMax

在项目根目录 `.env.local` 中填写：

```text
MINIMAX_API_KEY=你的密钥
MINIMAX_TTS_ENDPOINT=https://api.minimax.chat/v1/t2a_v2
MINIMAX_TTS_MODEL=speech-2.8-hd
MINIMAX_VOICE_ID=你的音色ID
MINIMAX_GROUP_ID=可选
```

验收标准：

```text
请求成功
得到最终音频
得到与该音频同次生成的原生时间戳
能规范化保存为 RUN_DIR/subtitle-timeline.json
```

## 四、配置火山引擎

在项目根目录 `.env.local` 中填写：

```text
VOLCENGINE_TTS_API_KEY=你的密钥
VOLCENGINE_TTS_ENDPOINT=你的接口地址
VOLCENGINE_TTS_RESOURCE_ID=seed-tts-2.0
VOLCENGINE_TTS_VOICE_ID=zh_female_xiaohe_uranus_bigtts
```

验收标准与 MiniMax 相同：最终音频和原生时间戳必须来自同一次请求。

## 五、配置其他 TTS 服务商

自定义服务商必须提供：

```text
接口地址
请求方法
鉴权字段或请求头
模型标识
音色标识
音频字段或下载地址
原生时间戳字段
错误响应结构
```

统一适配后必须输出：

```text
口播音频.mp3
RUN_DIR/subtitle-timeline.json
```

只返回音频、不返回原生时间戳的服务商不满足当前工作流合同。

## 六、时间轴规范

`RUN_DIR/subtitle-timeline.json` 必须满足：

```text
source = provider-native
记录 provider
记录 requestId 或等价请求标识
记录 audioFingerprint
记录 voiceoverFingerprint
segments 按时间递增
每段 start 小于 end
整体覆盖最终音频有效时长
```

推荐结构：

```json
{
  "source": "provider-native",
  "provider": "minimax",
  "requestId": "provider-request-id",
  "audioFile": "口播音频.mp3",
  "audioFingerprint": "sha256:...",
  "voiceoverFile": "口播文案.md",
  "voiceoverFingerprint": "sha256:...",
  "segments": [
    {
      "start": 0,
      "end": 1.8,
      "textHint": "仅用于定位，不作为字幕正文"
    }
  ]
}
```

`textHint` 或服务商返回文本不得直接成为字幕。字幕正文始终从确认后的 `口播文案.md` 重新切分并映射到时间段。

以下任一变化都会使旧时间轴失效：

```text
口播文案变化
最终音频变化
服务商、模型或音色变化
重新发起 TTS 请求
音频或文案指纹不匹配
```

## 七、部署 Remotion

进入完整 Shin-video 项目：

```bash
cd "/path/to/Shin-video"
npm install
npx remotion --version
npm run doctor
```

日常制作直接通过 `$shin-video` 生成最终 MP4。以下命令仅用于开发、排查或用户明确要求审片：

```bash
npm run remotion:studio
npm run render:preview
npm run render:final
```

输出约定：

```text
<项目目录>/<视频标题>.mp4
```

如果 Remotion 依赖缺失：

```bash
npm install remotion @remotion/cli @remotion/renderer @remotion/bundler
```

如果编码环境异常：

```bash
ffmpeg -version
```

仅创建一个空白 Remotion 项目不能替代 Shin-video 模板。正式部署还必须包含：

```text
Remotion 入口
runtime 数据读取
remotion/visual-library
导演镜头类型映射
字幕安全区
生产门槛
渲染后质量检查
```

## 八、项目目录

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
│       ├── style-profile.json
│       └── style-profile.json
└── <视频标题>.mp4
```

## 九、首次部署与故障排查

首次部署、引擎更新或 TTS 接入变更时：

```text
1. 使用一小段确认后的口播文案发起请求。
2. 验证最终音频可播放。
3. 验证原生时间戳来自同一请求。
4. 验证 source 为 provider-native。
5. 验证音频和文案指纹一致。
6. 验证时间段有序且覆盖有效音频。
```

Remotion 环境检查：

```bash
npm install
npm run doctor
```

日常制作不重复运行 `npm run doctor`、测试、构建、工作流验证或预览渲染。每条视频只保留：

```text
一次最终音频/时间轴校验
渲染器内部 Production Gate
最终视频的可播放性、声音、时长与尺寸检查
```

## 十、失败提示

缺少 TTS 配置：

```text
当前没有可用的 TTS 服务商。请配置 MiniMax、火山引擎，或提供满足音频与原生时间戳合同的其他服务商。
```

缺少原生时间戳：

```text
当前服务商只返回了音频，没有返回本次音频对应的原生时间戳，正式工作流已停止。
```

音频或文案指纹不匹配：

```text
当前时间轴不属于这版音频或口播文案，需要重新调用 TTS 生成音频和时间轴。
```

缺少 Remotion：

```text
当前项目还没有完整的本地渲染环境。请安装依赖；首次部署、引擎更新或排查时再运行 npm run doctor。
```

## 十一、硬性原则

- 不接受只有音频的正式输入。
- 不使用非同次 TTS 返回或无法验证来源的时间位置。
- 不允许服务商返回文本覆盖确认后的口播文案。
- 不复用与当前音频或文案指纹不一致的旧时间轴。
- 不把真实密钥写入版本库或公开材料。
- 不把空白 Remotion 项目描述成完整 Shin-video 渲染环境。
