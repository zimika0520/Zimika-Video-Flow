---
name: audio-checker
description: 检查 Shin-video 项目中的口播音频.mp3 与 RUN_DIR/subtitle-timeline.json 是否来自同一次 TTS 生成、是否可用、是否适合交给场景生成和 Remotion 使用。
---

# 口播音频检查

检查项目目录中是否同时存在：

```text
口播音频.mp3
RUN_DIR/subtitle-timeline.json
```

> 路径约定：`RUN_DIR` 表示当前项目的 `<项目目录>/_runtime/<run-id>/`。`public/runtime/` 仅用于 Remotion 静态资源，不得作为项目中间产物目录。

## 如果缺少音频或时间轴

只提醒用户：

```text
请使用已配置的 TTS 服务商重新生成最终音频和原生时间戳。项目必须同时得到 口播音频.mp3 和 RUN_DIR/subtitle-timeline.json。
```

不要继续后面的场景生成或 Remotion 步骤。只有 mp3、服务商没有返回原生时间戳、或时间轴不是来自这次最终音频时，都必须明确失败；后续只能使用可验证的同次 TTS 原生时间位置。

## 检查内容

- 文件是否存在。
- 文件是否是音频。
- 文件大小是否明显异常。
- 时长是否能读取。
- 时长是否和口播文案大致匹配。
- `RUN_DIR/subtitle-timeline.json` 的 `source` 是否为 `provider-native`。
- 时间轴是否记录 TTS 服务商、音频指纹和口播文案指纹。
- 时间段是否单调递增、没有负值，并覆盖最终音频的有效时长。
- 服务商返回文本是否被忽略；字幕正文必须只取确认后的 `口播文案.md`。
- 音频或口播文案变化后，旧时间轴必须立即判定失效。

## 输出

检查通过后，继续交给 `scene-generator` 和 `subtitle-rhythm-builder`。
