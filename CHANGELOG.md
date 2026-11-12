# 更新记录

## v0.3.0-zimika.1 — 2026-11-12

- 新增 Zimika 专属 `Production Handoff Brief`：对视频 Brief、场景、素材清单、视觉清单、导演方案、风格配置、服务商原生字幕时间轴、最终音频和口播文案执行只读盘点。
- 新增确定性接手优先级：修复损坏文件 → 补齐缺失文件 → 处理 Production Gate 错误 → 允许渲染。
- 新增 `npm run handoff-brief -- --run-dir=<RUN_DIR>`，报告写入 `RUN_DIR/production-handoff-brief.json`，不会修改视频制品。
- 新增 5 项专属回归测试；完整测试基线更新为 571 项通过，Next.js 生产构建成功。
- 包版本、插件清单、工作流清单、doctor 校验和公开文档同步升级为 `0.3.0-zimika.1`。

## v0.2.0-zimika.1

- Zimika Video Flow 独立副本、品牌与工程验证基线。
