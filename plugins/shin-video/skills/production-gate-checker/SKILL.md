---
name: production-gate-checker
description: 在 Remotion 渲染前检查 Shin-video 生产门槛，阻断缺关键文件、证据来源错误、字幕来源错误、导演方案过期和不可执行镜头；镜头数量与声明多样性仅作为审片告警。
---

# Production Gate Checker

> 路径约定：`RUN_DIR` 表示当前项目的 `<项目目录>/_runtime/<run-id>/`。`public/runtime/` 仅用于 Remotion 静态资源，不得作为项目中间产物目录。

## 能解决什么问题

把可验证的运行前错误提前转成硬检查。渲染前必须确认制作源头、素材证据、字幕策略、导演方案和视觉配置都存在且匹配当前版本；最终画面是否重复、素材是否真正出现，则交给渲染后逐镜头质量检查。

## 输入

```text
RUN_DIR/video-brief.json
RUN_DIR/scenes.json
RUN_DIR/asset-manifest.json
RUN_DIR/visual-manifest.json
RUN_DIR/director-plan.json
RUN_DIR/style-profile.json
RUN_DIR/subtitle-timeline.json 或 RUN_DIR/scenes.json captions
口播音频.mp3
```

## 输出

```text
RUN_DIR/production-gate-report.json
```

## 渲染前硬阻断

- 存在 `RUN_DIR/video-brief.json`
- 存在 `RUN_DIR/asset-manifest.json`
- `asset-manifest` 包含 `evidenceRecords`
- `asset-manifest` 至少包含来源文章文本/HTML/摘录或外部资料页证据记录
- 存在 `RUN_DIR/visual-manifest.json`
- 存在最终音频
- 存在以最终音频对齐的字幕时间轴
- 存在 `RUN_DIR/director-plan.json`
- 存在 `RUN_DIR/style-profile.json`
- `director-plan` 匹配当前 scenes 指纹
- `visual-manifest` 匹配当前 scenes 指纹
- 每个 scene 的导演合同、renderer family、components 和 content 可执行
- 主画面没有大段复读字幕
- 每个 scene 声明字幕安全区
- 关键画面有素材或证据记录支撑
- 图表、K 线、仪表盘、热力图等数值可视化必须有事实数据来源，不得补造数值

以上任一项失败，都不允许进入 Remotion 渲染。

## 渲染前告警

以下项目只用于提示审片重点，不得单独阻断渲染：

- 单镜头是否超过 10 秒
- 镜头数是否低于 `floor(视频时长 / 10) + 1`
- 声明的视觉形式、renderer family 或镜头/动效组合数量是否偏少
- 相邻镜头是否声明了相同视觉形式
- 是否只改变淡入、平移、缩放，而没有改变画面结构

这些声明只能描述“计划怎么做”，不能证明“最终画面真的不同”。最终是否允许交付，以渲染后质量报告为准。

## 渲染后交付门槛

Remotion 渲染完成后必须：

- 为每个 scene 抽取一张中点代表帧
- 比较相邻镜头的最终构图相似度
- 连续 3 个镜头构图高度相似时阻止最终交付
- 检查导演选中的主视觉是否进入实际渲染
- 同一主视觉素材高频复用时给出告警
- 检查黑帧、时长、尺寸、字幕安全区和主要布局冲突

预览可以保留用于返工，但渲染后质量报告未通过时，不得把文件作为最终成片交付。

## 命令

在 Shin-video 项目根目录可执行：

```bash
npm run production-gate -- --video-brief=RUN_DIR/video-brief.json --scenes=RUN_DIR/scenes.json --asset-manifest=RUN_DIR/asset-manifest.json --visual-manifest=RUN_DIR/visual-manifest.json --director-plan=RUN_DIR/director-plan.json --style-profile=RUN_DIR/style-profile.json --audio=口播音频.mp3
```

渲染器也会在内部调用 production gate。检查失败时不允许继续渲染。

## 输出解释

- `passed: true`：允许进入 Remotion 渲染。
- `passed: false`：停止渲染，按 errors 修复。
- `warnings`：不一定阻止渲染，但必须在审片时重点检查。
