# Zimika Video Flow 学习路线

这个项目适合拿来展示全栈开发、Agent 工作流编排和视频渲染。学习顺序按“先跑通、再拆链路、最后改功能”。

## 第 1 天：环境与基线

```bash
cd Zimika-Video-Flow
npm ci
npm test -- --run
npm run build
```

当前基线是 571 项测试通过，Next.js 生产构建成功。先确认这两个结果，再改代码。

查看环境状态：

```bash
npm run doctor
```

缺少 TTS Key 或 FFmpeg 时，doctor 报错是正常的；先把根因读明白，不要直接删检查。

## 第 2 天：启动界面

```bash
cp .env.local.example .env.local
npm run dev
```

打开 `http://localhost:3000`。不要提交 `.env.local`，不要把自己的 API Key 写入 README 或代码。

仓库内的 `examples/demo-article.md` 是一篇原创短示例，可用于熟悉界面输入和测试链路。

## 第 3 天：读核心链路

按顺序看：

1. `app/page.tsx`：页面状态与操作入口。
2. `app/api/`：前端调用的后端路由。
3. `lib/production-gate.ts`：渲染前的硬门禁。
4. `lib/production-handoff.ts`：Zimika 新增的九项输入盘点与下一步动作。
5. `lib/director-plan.ts`：导演方案的数据结构。
6. `lib/remotion-render.ts`：Remotion 渲染。
7. `remotion/`：真正的视频组件与动画。

你要能用一句话解释：文章先被转换成口播和原生时间轴，再生成场景、素材、视觉清单与导演方案，通过 Production Gate 后才交给 Remotion 渲染。

再解释 Zimika 的独立扩展：

```text
Production Handoff Brief 先盘点所有输入，再调用 Production Gate；
它先报损坏文件、缺失文件，最后才允许渲染。
```

## 第 4 天：完成第一次有意义的修改

从诊断和界面层开始，不要一上来改渲染核心：

1. 在临时 `RUN_DIR` 中删除一个 JSON，观察 Handoff Brief 如何指出缺失文件。
2. 放入无效 JSON，观察它如何把动作从“补齐”升级为“修复”。
3. 运行相关测试。
4. 再运行完整 `npm test -- --run` 和 `npm run build`。

提交信息写成 `feat(ui): ...` 或 `fix(ui): ...`，不要使用“update”这种看不出行为的描述。

## 第 5 天：准备面试表达

用 90 秒按这个顺序讲：

1. 输入：文章或链接。
2. 生成链路：口播、TTS 原生时间轴、场景、素材、视觉清单、导演方案。
3. 可靠性：Production Gate 阻止缺音频、时间轴或导演方案的渲染。
4. 接手可靠性：Production Handoff Brief 盘点九项输入，并把修复、补齐、门禁错误和可渲染状态区分开。
5. 前端与渲染：Next.js 提供编辑界面，Remotion 按场景组件渲染 MP4。
6. 工程验证：571 项测试通过，生产构建成功。

同时明确说明这是二次开发作品，你负责品牌化、工程整理和后续功能演进。不要把自己说不懂的内部模块包装成“一人从零实现”。
