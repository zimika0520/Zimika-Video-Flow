# Shin-video Agent 执行指南

这份指南规定 Agent 如何把文章稳定推进到成片，同时把工程细节隐藏在简单的用户体验后面。

## 一、入口策略

```text
所有新请求：使用 shin-video-director。
既有 shin-video-lite 调用：作为兼容路由转入同一完整链路。
```

对用户只需说明：

```text
给文章，确认口播和画面方向，等待成片。
```

不要要求普通用户理解内部 JSON、命令或组件结构。

## 二、首次运行检查

先读取：

```text
../规范/getting-started.md
../规范/前期准备说明.md
../规范/TTS服务商与Remotion部署说明.md
../../workflow-manifest.json
../../skills/shin-video-director/SKILL.md
../../skills/shin-video-lite/SKILL.md
```

再检查：

```bash
node -v
npm -v
ffmpeg -version
npx remotion --version
npm run doctor
```

交付前需要全量验证时执行：

```bash
npm run verify-workflow
```

`npm run doctor` 未通过时停止制作。不要把只有总控文档、缺少模板或视觉组件的安装描述成完整工作流。

当前公开工作流由 1 个轻量入口、1 个专业总控和 14 个阶段 Skill 组成，共 16 个 Skill。完整工作流至少包含：

```text
shin-video-director
shin-video-lite
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

## 三、TTS 配置合同

必须至少配置一个支持原生时间戳的 TTS 服务商。

MiniMax：

```text
MINIMAX_API_KEY
MINIMAX_TTS_ENDPOINT
MINIMAX_TTS_MODEL
MINIMAX_VOICE_ID
MINIMAX_GROUP_ID（可选）
```

火山引擎：

```text
VOLCENGINE_TTS_API_KEY
VOLCENGINE_TTS_ENDPOINT
VOLCENGINE_TTS_RESOURCE_ID
VOLCENGINE_TTS_VOICE_ID
```

其他服务商必须提供接口地址、鉴权、模型和音色，并同时返回：

```text
最终音频
与最终音频同次生成的原生时间戳
```

统一输出：

```text
口播音频.mp3
RUN_DIR/subtitle-timeline.json
```

时间轴硬性要求：

```text
source = provider-native
包含服务商和请求信息
包含音频指纹
包含口播文案指纹
时间段单调递增
覆盖最终音频有效时长
```

服务商返回文本只可用于校验时间位置。字幕正文必须只取确认后的 `口播文案.md`。

只有 mp3、时间轴来自另一轮请求、音频或文案指纹不匹配、服务商不返回原生时间戳时，都必须停止。后续只能使用可验证的同次 TTS 原生时间位置。

真实密钥只写入本机 `.env.local`，不得打印、提交或写入公开材料。

## 四、完整执行链路

```text
文章或链接
→ web-article-cleaner
→ 文章正文.md
→ browser-evidence-capture
→ video-brief-builder
→ RUN_DIR/video-brief.json
→ voiceover-writer
→ 口播文案.md
→ TTS 服务商同时生成最终音频和原生时间戳
→ 口播音频.mp3
→ RUN_DIR/subtitle-timeline.json
→ audio-checker
→ scene-generator
→ subtitle-rhythm-builder
→ RUN_DIR/scenes.json
→ asset-researcher
→ RUN_DIR/asset-manifest.json
→ visual-manifest-builder
→ RUN_DIR/visual-manifest.json
→ remotion-video-director
→ RUN_DIR/director-plan.json
→ style-consultant
→ animation-preset-builder
→ RUN_DIR/style-profile.json
→ production-gate-checker
→ RUN_DIR/production-gate-report.json
→ remotion-renderer
→ RUN_DIR/preview.mp4
→ <项目目录>/<视频标题>.mp4
```

新请求从 `shin-video-director` 开始。运行引擎若仍保留 `shin-video-lite` 命令，只能将既有调用转入该兼容路由；插件不定义该命令。

## 五、失效规则

出现以下任一变化时，旧 `RUN_DIR/subtitle-timeline.json` 失效：

```text
口播文案变化
音频变化
音色、模型或服务商变化
TTS 请求重新执行
音频指纹或文案指纹不匹配
```

时间轴变化后，以下产物也必须重新生成或重新校验：

```text
RUN_DIR/scenes.json
RUN_DIR/visual-manifest.json
RUN_DIR/director-plan.json
RUN_DIR/style-profile.json
RUN_DIR/production-gate-report.json
```

## 六、口播和字幕规则

`口播文案.md` 只能包含真正需要朗读的文字，禁止混入：

```text
画面提示
分镜说明
图片提示
时间码
Remotion 指令
字幕编号
```

字幕规则：

```text
按完整语义断句
避免一句只显示半截
避免语气词单独成条
固定在底部安全区
只跟随最终音频时间轴
不被主画面卡片切换约束
```

## 七、导演和素材规则

`RUN_DIR/scenes.json` 生成后必须先完成素材与导演阶段：

```text
RUN_DIR/asset-manifest.json
RUN_DIR/visual-manifest.json
RUN_DIR/director-plan.json
```

导演方案必须解决：

```text
镜头类型差异
节奏起伏和记忆帧
主画面解释信息而非复读字幕
素材与观点有证据关系
字幕安全区和重叠风险
背景、布局和动效不复用旧模板
不使用无意义抖动
```

用户明确要求先审导演方案时，必须暂停交付导演稿；普通轻量模式可继续执行，但要记录本次视觉选择。

## 八、风格与渲染

专业模式下使用一问一答确认：

```text
视频画面感觉
16:9 或 9:16
```

兼容路由也必须取得用户确认的风格和比例，不能依据文章自动选择或静默套固定配置。

进入渲染前检查：

```text
RUN_DIR/video-brief.json
RUN_DIR/subtitle-timeline.json
RUN_DIR/scenes.json
RUN_DIR/asset-manifest.json
RUN_DIR/visual-manifest.json
RUN_DIR/director-plan.json
RUN_DIR/style-profile.json
口播音频.mp3
```

依赖检查：

```bash
npm ls zod @remotion/bundler @remotion/cli @remotion/renderer remotion --depth=0
npm run doctor
```

生产门槛未通过时禁止渲染。

## 九、渲染后验收

预览至少检查：

```text
视频可播放
声音存在
时长接近最终音频
无黑屏和长空白
字幕正文正确
字幕时间与音频一致
字幕未遮挡主画面
主画面没有大段复读字幕
关键素材与口播观点一致
相邻镜头构图没有连续高度重复
```

用户确认预览后再导出最终视频。临时帧、自检截图和缓存可在验收期间保留，项目完成后清理。

## 十、失败提示

缺少 TTS 配置：

```text
当前还没有可用的 TTS 服务商。请配置 MiniMax、火山引擎，或提供一个能同时返回最终音频和原生时间戳的其他服务商。
```

缺少原生时间戳：

```text
当前服务商只返回了音频，没有返回这次音频对应的原生时间戳，无法继续生成可靠字幕和镜头时间轴。
```

缺少 Remotion：

```text
当前项目的本地渲染环境不完整。请先安装项目依赖并运行 npm run doctor。
```

生产门槛失败：

```text
当前制作包存在会影响成片质量的问题，已停止渲染。请先按检查报告补齐缺失文件或修复时间轴、素材、导演方案和字幕安全区。
```
