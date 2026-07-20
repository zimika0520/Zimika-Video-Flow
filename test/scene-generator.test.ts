import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { deriveDirectorComponents } from "@/lib/director-components";
import { generateScenes } from "@/lib/scene-generator";

describe("generateScenes", () => {
  test("generates readable scenes from a timeline without a material pack", async () => {
    const result = await generateScenes({
      timelineSegments: [
        { id: "seg-1", start: 0, end: 3, text: "今天我们聊一个很反常的现象" },
        { id: "seg-2", start: 3, end: 6, text: "美国科技股上涨但是资金却在撤离" },
        { id: "seg-3", start: 6, end: 9, text: "真正的问题不是涨跌而是风险偏好变了" },
        { id: "seg-4", start: 9, end: 12, text: "所以结论很简单不要只盯着指数" },
      ],
      audioSrc: "/tmp/voice.mp3",
    });

    expect(result.materialPackPath).toBeUndefined();
    expect(result.narrativeLayer?.attentionCurve.length).toBeGreaterThanOrEqual(5);
    expect(result.duration).toBe(12);
    expect(result.scenes.length).toBeGreaterThanOrEqual(2);
    expect(result.scenes[0]).toMatchObject({
      start: 0,
      images: [],
      layout: "title",
      sceneType: "impact-hook",
      layoutRecipe: "metric-hero",
      narrativeRole: "opening",
    });
    expect(result.scenes[0].directorType).toBeTruthy();
    expect(result.scenes.at(-1)).toMatchObject({ layout: "ending", sceneType: "summary-card" });
    expect(result.scenes.every((scene) => scene.directorContractIssues?.length === 0)).toBe(true);
    expect(result.scenes.map((scene) => scene.subtitle).join("")).toContain("美国科技股上涨但是资金却在撤离");
  });

  test("uses explicit voiceover text as subtitles while keeping provider-native timings", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-scenes-voiceover-path-"));
    const voiceoverPath = join(root, "口播文案.md");
    await writeFile(voiceoverPath, [
      "腾讯混元 Hy3 正式发布了。",
      "",
      "Hy3 采用 MoE 架构，支持 256K 上下文。",
      "",
      "简单说，这次升级更偏实用主义。",
    ].join("\n"));

    const timelineSegments = [
      { id: "seg-1", start: 0, end: 3, text: "腾讯混源HiFi三正式发布了" },
      { id: "seg-2", start: 3, end: 6, text: "Hi3采用猫翼架构支持二五六K上下文" },
      { id: "seg-3", start: 6, end: 9, text: "简单说这次升级更偏实用主义" },
    ];
    const result = await generateScenes({ voiceoverPath, timelineSegments });
    const boundaries = new Set(
      timelineSegments.flatMap((segment) => [segment.start, segment.end]),
    );
    const timings = result.scenes.map((scene) => ({
      start: scene.start,
      end: scene.end,
    }));

    expect(result.duration).toBe(9);
    expect(result.scenes.map((scene) => scene.subtitle)).toEqual([
      "腾讯混元 Hy3 正式发布了。",
      "Hy3 采用 MoE 架构，支持 256K 上下文。",
      "简单说，这次升级更偏实用主义。",
    ]);
    expect(result.scenes.map((scene) => [scene.start, scene.end])).toEqual([
      [0, 3],
      [3, 6],
      [6, 9],
    ]);
    expect(timings.every((timing) =>
      boundaries.has(timing.start) && boundaries.has(timing.end),
    )).toBe(true);
    expect(timings.every((timing) => timing.end > timing.start)).toBe(true);
    expect(timings.slice(1).every((timing, index) =>
      timing.start === timings[index].end,
    )).toBe(true);
    expect(result.scenes.map((scene) => scene.subtitle).join("").replace(/\s+/g, "")).toBe(
      [
        "腾讯混元 Hy3 正式发布了。",
        "Hy3 采用 MoE 架构，支持 256K 上下文。",
        "简单说，这次升级更偏实用主义。",
      ].join("").replace(/\s+/g, ""),
    );
  });

  test("rejects voiceover blocks when the provider timeline has too few non-zero boundaries", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-scenes-short-timeline-"));
    const voiceoverPath = join(root, "口播文案.md");
    await writeFile(voiceoverPath, "第一段。\n\n第二段。\n");

    await expect(generateScenes({
      voiceoverPath,
      timelineSegments: [
        { id: "only", start: 0, end: 4, text: "第一段第二段" },
      ],
    })).rejects.toThrow("服务商原生时间轴只有 1 个时间段，无法为 2 个口播块分配非零边界");
  });

  test("splits a single long voiceover paragraph into dense scenes", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-scenes-long-voiceover-"));
    const voiceoverPath = join(root, "口播文案.md");
    const sentences = [
      "MiniMax 目前正在调整模型路线，随后把重点转向真实应用。",
      "新模型日均调用量增长 20 倍，API 请求量也持续上升。",
      "输入价格是 1 元每百万 tokens，输出价格是 4 元每百万 tokens。",
      "命中缓存后，输入价格降到 0.25 元每百万 tokens。",
      "团队面前有两条路，一条依赖云端算力，一条建设自有推理集群。",
      "真正的问题是，模型公司能不能一直把算力命脉交给外部供应商？",
      "训练侧关注吞吐，推理侧关注延迟，部署侧关注调度效率。",
      "制程、HBM 高带宽内存和软件生态，仍然是绕不开的三道门槛。",
      "这不是单纯的模型发布，而是产品、成本和供应链的同步调整。",
      "用户留存率从 42% 提升到 68%，说明应用体验出现了变化。",
      "企业客户、开发者和终端用户，通过 API 与 Agent 形成一条使用链路。",
      "如果调用继续增长，长期推理成本会直接影响商业毛利。",
      "行业竞争已经不只发生在参数上，也开始进入芯片和基础设施。",
      "这更像一个行业信号，而不是马上改写格局的终局。",
      "团队不是为了炫技，而是想把成本和供应节奏握在自己手里。",
      "最后的判断是，它不想再一直等待别人提供关键算力。",
    ];
    await writeFile(voiceoverPath, `${sentences.join("")}\n`);

    const timelineSegments = sentences.map((text, index) => ({
      id: `seg-long-${index + 1}`,
      start: index * 5,
      end: (index + 1) * 5,
      text,
    }));

    const result = await generateScenes({ voiceoverPath, timelineSegments });

    expect(result.duration).toBe(80);
    expect(result.scenes.length).toBeGreaterThanOrEqual(8);
    expect(Math.max(...result.scenes.map((scene) => scene.end - scene.start))).toBeLessThan(10);
    const visualForms = new Set(result.scenes.map((scene) => `${scene.sceneType}:${scene.directorType}`));
    expect(visualForms.size).toBeGreaterThan(result.scenes.length / 2);
  });

  test("uses enough real renderer families for a long DeepSeek-style script", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-scenes-deepseek-"));
    const voiceoverPath = join(root, "口播文案.md");
    const lines = [
      "DeepSeek 被曝要自己做 AI 芯片了。",
      "但这事不能简单理解成挑战英伟达。",
      "真正的关键词，是推理成本和算力控制权。",
      "据报道，DeepSeek 的自研芯片项目大约一年前启动，目前仍处在早期阶段。",
      "重点是，它瞄准的不是训练芯片，而是推理芯片。",
      "训练芯片像造赛车，难在长时间满负荷、万卡互联和软件生态。",
      "推理芯片更像每天跑在路上的车。",
      "模型上线之后，每一次提问、API 调用和代码生成，都要消耗推理算力。",
      "训练是一次性投入。",
      "推理是长期水电费。",
      "当调用量越来越大，每个 token 的成本，就会变成真正的商业问题。",
      "这也是 DeepSeek 造芯片最值得看的地方。",
      "它不是为了卖芯片，也不是为了炫技。",
      "更可能是想让模型跑在适合自己的硬件上，把成本压下来，把供应节奏握在手里。",
      "现在的 DeepSeek 绕不开两条路：一条是英伟达，一条是国产替代芯片。",
      "但英伟达受出口管制影响，供应不稳定。",
      "国产芯片也不是 DeepSeek 独享，大家都在抢同一批产能。",
      "所以问题变成了：一家模型公司，能不能一直把算力命脉交给别人？",
      "当然，自研芯片没那么容易。",
      "制程、HBM 高带宽内存、软件生态、流片和量产，每一关都很硬。",
      "所以这不是一个马上改变行业的故事。",
      "它更像一个信号。",
      "AI 竞争已经不只发生在模型参数上了。",
      "也开始进入芯片、供应链和每一次推理调用的成本里。",
      "DeepSeek 这次动手，核心不是要干掉谁。",
      "而是它不想再一直等别人发货。",
    ];
    await writeFile(voiceoverPath, lines.join("\n\n"));
    const timelineSegments = lines.map((text, index) => ({
      id: `deepseek-${index + 1}`,
      start: index * 4.5,
      end: (index + 1) * 4.5,
      text,
    }));

    const result = await generateScenes({ voiceoverPath, timelineSegments });
    const visibleContent = JSON.stringify(
      result.scenes.map((scene) => ({
        headline: scene.content?.headline,
        keywords: scene.content?.keywords,
        timelineItems: scene.content?.timelineItems,
        nodes: scene.content?.nodes,
        comparisons: scene.content?.comparisons,
        summaryItems: scene.content?.summaryItems,
      })),
    );
    const bySubtitle = (part: string) => result.scenes.find((scene) => scene.subtitle.includes(part));

    expect(result.scenes.length).toBeGreaterThanOrEqual(12);
    expect(visibleContent).not.toMatch(/核心信息|关键点|旧状态|新结果/);
    expect(bySubtitle("关键词，是推理成本")?.directorType).toBe("FinancialMeter");
    expect(bySubtitle("训练芯片像造赛车")?.directorType).not.toBe("EvidenceHero");
    expect(bySubtitle("模型上线之后")?.directorType).toBe("FinancialMeter");
    expect(bySubtitle("两条路")?.directorType).toBe("DependencyMap");
    expect(bySubtitle("算力命脉")?.directorType).toBe("QuestionPause");
    expect(bySubtitle("制程、HBM")?.directorType).toBe("BarrierWall");
    expect(bySubtitle("开始进入芯片")?.directorType).toBe("IndustrySignal");
    expect(bySubtitle("不想再一直等别人发货")?.directorType).toBe("FinalJudgement");
  });

  test("adds varied visual recipes for timeline-only videos", async () => {
    const result = await generateScenes({
      timelineSegments: [
        { id: "seg-1", start: 0, end: 4, text: "今天这件事最反常的地方不是上涨，而是资金正在撤离。" },
        { id: "seg-2", start: 4, end: 8, text: "第一，收入结构里有三条线索，分别是项目、授权和资产价格。" },
        { id: "seg-3", start: 8, end: 12, text: "其中一个数字非常关键，相关收入已经超过12亿美金。" },
        { id: "seg-4", start: 12, end: 16, text: "背后的关系也不复杂，项目方、授权方和流量入口互相绑定。" },
        { id: "seg-5", start: 16, end: 20, text: "但真正的风险在于，身份、资金和舆论开始叠在一起。" },
        { id: "seg-6", start: 20, end: 24, text: "所以最后的判断很简单，不要只看表面数字，要看这条链路怎么形成。" },
      ],
    });

    const sceneTypes = result.scenes.map((scene) => scene.sceneType);
    const motionVariants = result.scenes.map((scene) => scene.motionVariant);

    expect(new Set(sceneTypes).size).toBeGreaterThanOrEqual(3);
    expect(result.scenes.every((scene) => scene.layoutRecipe && scene.visualIntent && scene.visualModules?.includes("transforms"))).toBe(true);
    expect(result.scenes.every((scene) => scene.directorType && scene.visualPriority && scene.motionStyle && scene.components?.length && scene.content)).toBe(true);
    expect(sceneTypes.at(0)).toBe("impact-hook");
    expect(sceneTypes.at(-1)).toBe("summary-card");

    for (let index = 1; index < result.scenes.length; index += 1) {
      expect(sceneTypes[index]).not.toBe(sceneTypes[index - 1]);
      expect(motionVariants[index]).not.toBe(motionVariants[index - 1]);
    }
  });

  test("builds a director DSL for long pure-text videos", async () => {
    const timelineSegments = [
      "今年一月底，腾讯混元宣布重建大模型预训练与强化学习基础设施。",
      "四月二十三日，重建后的首个成果 Hy3 preview 发布。",
      "七月六日，经过两个月真实场景打磨，腾讯混元 Hy3 正式发布。",
      "它已经接入 WorkBuddy、CodeBuddy、元宝、Marvis 和 ima 等业务。",
      "日均 Token 消耗量相比 preview 增加了二十倍。",
      "WorkBuddy 自主选择 Hy3 preview 的用户增长了六倍。",
      "在真实业务长文和 RAG 评测里，幻觉率下降约百分之四十四。",
      "Hy3 采用 MoE 架构，总参数二百九十五 B，激活参数二十一 B。",
      "它支持二百五十六 K 上下文，代码、办公和金融建模都有明显提升。",
      "内部二百七十位专家盲测中，Hy3 均分二点六七，超过 GLM 五点一。",
      "WorkBuddy 办公任务解决率从百分之七十二提升到百分之九十。",
      "Marvis Agent 文件任务完成率达到百分之九十三点七。",
      "价格方面，输入一元每百万 tokens，输出四元每百万 tokens。",
      "命中缓存时，输入价格降到零点二五元每百万 tokens。",
      "开源方面，Hy3 采用 Apache 二点零协议，可以免费商用。",
      "所以这次发布的核心不是炫技，而是把实用模型推向更低成本。",
    ].map((text, index) => ({
      id: `seg-${index + 1}`,
      start: index * 5,
      end: (index + 1) * 5,
      text,
    }));

    const result = await generateScenes({ timelineSegments });
    const directorTypes = result.scenes.map((scene) => scene.directorType);

    expect(result.narrativeLayer?.structure.opening).toBeTruthy();
    expect(result.narrativeLayer?.peakMoments.length).toBeGreaterThanOrEqual(2);
    expect(directorTypes).toEqual(expect.arrayContaining(["DataExplosion", "Pricing"]));
    const dataExplosionScenes = result.scenes.filter(
      (scene) => scene.directorType === "DataExplosion",
    );
    const pricingScenes = result.scenes.filter(
      (scene) => scene.directorType === "Pricing",
    );
    expect(dataExplosionScenes.length).toBeGreaterThan(0);
    expect(pricingScenes.length).toBeGreaterThan(0);
    expect(dataExplosionScenes.every(
      (scene) => (scene.semantics?.metrics.length ?? 0) > 0,
    )).toBe(true);
    expect(pricingScenes.every(
      (scene) => (scene.semantics?.prices.length ?? 0) > 0,
    )).toBe(true);
    expect(result.scenes.every((scene) => scene.directorContractIssues?.length === 0)).toBe(true);
    expect(result.scenes.every((scene) => scene.sceneType && scene.layoutRecipe && scene.motionVariant)).toBe(true);
  });

  test("builds Director DSL v2 shot language, animation, background, and importance", async () => {
    const timelineSegments = [
      "腾讯混元 Hy3 正式发布，这是重建基础设施后的关键成果。",
      "它先在四月发布 preview，又在七月经过真实业务打磨后正式上线。",
      "Hy3 已经接入 WorkBuddy、CodeBuddy、元宝、Marvis 和 ima。",
      "日均 Token 消耗量增长二十倍，说明高性价比模型开始被真实业务采用。",
      "幻觉率相比 preview 下降百分之四十四，常识错误率也继续降低。",
      "技术上采用 MoE 架构，总参数二百九十五 B，激活参数二十一 B。",
      "它支持二百五十六 K 上下文，代码、办公、金融建模都有明显提升。",
      "价格方面，输入一元每百万 tokens，输出四元每百万 tokens。",
      "命中缓存时，输入成本降到零点二五元每百万 tokens。",
      "最后它采用 Apache 二点零协议开源，可以免费商用。",
    ].map((text, index) => ({
      id: `seg-v2-${index + 1}`,
      start: index * 6,
      end: (index + 1) * 6,
      text,
    }));

    const result = await generateScenes({ timelineSegments });
    const shotStyles = result.scenes.map((scene) => scene.shotStyle);
    const roles = result.scenes.map((scene) => scene.role);
    const dataScenes = result.scenes.filter((scene) => scene.directorType === "DataExplosion" || scene.directorType === "Pricing");

    expect(new Set(shotStyles).size).toBeGreaterThanOrEqual(3);
    expect(result.scenes.some((scene) => (scene.importance ?? 0) >= 9 && scene.role === "memory")).toBe(true);
    expect(roles.filter((role) => role === "spike").length).toBeGreaterThanOrEqual(2);
    expect(result.scenes.every((scene) => scene.animation?.cameraMotion && scene.animation?.entranceAnimation)).toBe(true);
    expect(result.scenes.every((scene) => scene.background?.backgroundType && scene.background?.backgroundMotion && scene.background?.backgroundRole)).toBe(true);
    expect(dataScenes.length).toBeGreaterThan(0);
    expect(dataScenes.every((scene) => scene.animation?.dataAnimation === "kineticCounter" || scene.animation?.dataAnimation === "particleFormation")).toBe(true);
    expect(result.scenes.map((scene) => scene.directorType)).not.toContain("Pause");
    expect(result.narrativeLayer?.structure.coreUpgrade).toBeTruthy();
    expect(result.narrativeLayer?.structure.pricingAdvantage).toBeTruthy();
    expect(result.narrativeLayer?.structure.openSourceValue).toBeTruthy();
  });

  test("adds reviewable creative brief and director script before rendering", async () => {
    const result = await generateScenes({
      timelineSegments: [
        { id: "seg-1", start: 0, end: 4, text: "这次升级最值得注意的，不是功能堆叠，而是底层能力真正稳定了。" },
        { id: "seg-2", start: 4, end: 8, text: "首先它把接入业务拉通了，所以不再只是实验室里的模型演示。" },
        { id: "seg-3", start: 8, end: 12, text: "其次两个关键指标在往下走，一个是错误率，一个是调用成本。" },
        { id: "seg-4", start: 12, end: 16, text: "最后用户真正能感受到的是，任务完成更稳，价格也更低。" },
      ],
    });

    expect(result.videoArchetype).toBeTruthy();
    expect(result.creativeBrief).toMatchObject({
      archetype: result.videoArchetype,
      purpose: expect.any(String),
      coreMessage: expect.any(String),
    });
    expect(result.directorScript?.directorScriptVersion).toBe(1);
    expect(result.directorScript?.reviewChecklist.length).toBeGreaterThanOrEqual(3);
    expect(result.directorScript?.scenes).toHaveLength(result.scenes.length);
    expect(result.directorScript?.scenes[0]).toMatchObject({
      id: result.scenes[0].id,
      timeRange: expect.any(String),
      coreIdea: expect.any(String),
      avoid: expect.stringContaining("字幕"),
    });
  });

  test("derives components from selected semantics instead of topic injection", async () => {
    const finance = await generateScenes({
      timelineSegments: [
        { id: "finance-1", start: 0, end: 4, text: "今天市场最重要的不是指数上涨，而是 VIX 波动和仓位风险同时抬升。" },
        { id: "finance-2", start: 4, end: 8, text: "K线结构显示价格短线冲高，但资金并没有同步追上。" },
        { id: "finance-3", start: 8, end: 12, text: "所以这一段更适合看风险温度，而不是只看收益数字。" },
        { id: "finance-4", start: 12, end: 16, text: "如果美股继续上涨，但成交和流动性变弱，就要警惕回撤。" },
        { id: "finance-5", start: 16, end: 20, text: "仓位动作应该跟随风险指标变化，而不是跟随情绪追涨。" },
        { id: "finance-6", start: 20, end: 24, text: "最后的结论是，价格可以创新高，但风控不能缺席。" },
      ],
    });
    expect(finance.scenes.every((scene) =>
      scene.directorType !== undefined &&
      scene.content !== undefined &&
      JSON.stringify(scene.components) === JSON.stringify(
        deriveDirectorComponents(
          scene.directorType,
          scene.content,
          scene.visualTreatment,
        ),
      ),
    )).toBe(true);
    expect(finance.scenes.every((scene) => scene.directorContractIssues?.length === 0)).toBe(true);

    const chip = await generateScenes({
      timelineSegments: [
        { id: "chip-1", start: 0, end: 4, text: "这次自主芯片的重点不是口号，而是算力、推理和训练链路都被重新拆开。" },
        { id: "chip-2", start: 4, end: 8, text: "从 GPU 到云端 API，AI 服务器架构会直接影响模型部署效率。" },
        { id: "chip-3", start: 8, end: 12, text: "最后真正要看的，是芯片架构能不能支撑大模型推理成本下降。" },
        { id: "chip-4", start: 12, end: 16, text: "训练侧看吞吐，推理侧看延迟，部署侧看云端调度。" },
        { id: "chip-5", start: 16, end: 20, text: "如果半导体供应链不能稳定，模型能力就很难转成真实产品。" },
        { id: "chip-6", start: 20, end: 24, text: "所以芯片、算力和大模型，需要放在同一张系统图里理解。" },
      ],
    });
    expect(chip.scenes.every((scene) =>
      scene.directorType !== undefined &&
      scene.content !== undefined &&
      JSON.stringify(scene.components) === JSON.stringify(
        deriveDirectorComponents(
          scene.directorType,
          scene.content,
          scene.visualTreatment,
        ),
      ),
    )).toBe(true);
    expect(chip.scenes.every((scene) => scene.directorContractIssues?.length === 0)).toBe(true);
  });

  test("reads Chinese voiceover text and carries image markers", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-scenes-cn-"));
    await writeFile(join(root, "口播文案.md"), "第一句\n\n第二句");
    await writeFile(join(root, "图文位置.md"), "第一段\n\n<!-- image_1: 1.jpg -->");

    const result = await generateScenes({
      materialPackPath: root,
      timelineSegments: [
        { id: "seg-1", start: 0, end: 3, text: "第一句" },
        { id: "seg-2", start: 3, end: 6, text: "第二句" },
      ],
    });

    expect(result.scenes[1]).toMatchObject({
      subtitle: "第二句",
      images: ["1.jpg"],
      layout: "single-image",
    });
  });

  test("forces image anchors onto readable voiceover scenes", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-scenes-match-"));
    await writeFile(join(root, "口播文案.md"), "开场\n\n第一部分来自 WLFI。\n\n第二部分来自 meme 币授权。");
    await writeFile(join(root, "图文位置.md"), [
      "开场介绍。",
      "",
      "<!-- image_1: images/1.jpg -->",
      "",
      "第一部分来自 WLFI。特朗普从 WLFI 里总共赚到了约6亿美金。",
      "",
      "<!-- image_2: images/2.jpg -->",
      "",
      "第二部分来自 meme 币相关授权。协议金额高达6.35亿美金。",
    ].join("\n"));

    const result = await generateScenes({
      materialPackPath: root,
      timelineSegments: [
        { id: "seg-1", start: 0, end: 3, text: "开场介绍" },
        { id: "seg-2", start: 3, end: 6, text: "第一部分来自WLFI" },
        { id: "seg-3", start: 6, end: 9, text: "特朗普从WLFI里总共赚到了约6亿美金" },
        { id: "seg-4", start: 9, end: 12, text: "第二部分来自meme币相关授权" },
        { id: "seg-5", start: 12, end: 15, text: "协议金额高达6.35亿美金" },
      ],
    });

    expect(result.scenes).toHaveLength(3);
    expect(result.scenes.map((scene) => scene.subtitle)).toEqual(["开场", "第一部分来自 WLFI。", "第二部分来自 meme 币授权。"]);
    expect(result.scenes[1].images).toEqual(["1.jpg"]);
    expect(result.scenes[2].images).toEqual(["2.jpg"]);
  });

  test("uses voiceover paragraphs for readable scenes and carries marker images", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-scenes-readable-"));
    const voiceover = [
      "美国政府道德办公室公布了特朗普2025年度收入审计报告。",
      "",
      "第一部分来自 WLFI。报告显示，特朗普从 WLFI 里总共赚到了约6亿美金。",
      "",
      "其中代币出售收入高达2.3亿美金，股权出售收入大约6500万美金。",
      "",
      "第二部分来自 meme 币相关授权。",
    ].join("\n");
    await writeFile(join(root, "口播文案.md"), voiceover);
    await writeFile(join(root, "图文位置.md"), [
      "开场介绍。",
      "",
      "<!-- image_1: images/1.jpg -->",
      "",
      "首先如图1所示，特朗普总共从WLFI里赚到了6亿美金，代币出售就高达2.3亿美金。",
      "",
      "<!-- image_2: images/2.jpg -->",
      "",
      "那至于meme币具体赚了多少钱呢？如图2所示，有一项授权收入。",
    ].join("\n"));

    const result = await generateScenes({
      materialPackPath: root,
      timelineSegments: [
        { id: "seg-1", start: 0, end: 3, text: "美国政府道德办公室公布了特朗普2025年" },
        { id: "seg-2", start: 3, end: 6, text: "度收入审计报告" },
        { id: "seg-3", start: 6, end: 9, text: "第一部分来自WLFI" },
        { id: "seg-4", start: 9, end: 12, text: "报告显示特朗普从WLFI里总共赚到了约6亿美金" },
        { id: "seg-5", start: 12, end: 15, text: "其中代币出售收入高达2.3亿美金" },
        { id: "seg-6", start: 15, end: 18, text: "第二部分来自meme币相关授权" },
      ],
    });

    expect(result.scenes).toHaveLength(4);
    expect(result.scenes[0].subtitle).toBe("美国政府道德办公室公布了特朗普2025年度收入审计报告。");
    expect(result.scenes[1].subtitle).toBe("第一部分来自 WLFI。报告显示，特朗普从 WLFI 里总共赚到了约6亿美金。");
    expect(result.scenes[1].images).toEqual(["1.jpg"]);
    expect(result.scenes[2].images).toEqual(["1.jpg"]);
    expect(result.scenes[3].images).toEqual(["2.jpg"]);
    expect(result.duration).toBe(18);
    const timelineBoundaries = new Set(
      [0, 3, 6, 9, 12, 15, 18],
    );
    expect(result.scenes.every((scene) =>
      timelineBoundaries.has(scene.start) &&
      timelineBoundaries.has(scene.end) &&
      scene.end > scene.start,
    )).toBe(true);
    expect(result.scenes.slice(1).every((scene, index) =>
      scene.start === result.scenes[index].end,
    )).toBe(true);
    expect(result.scenes.map((scene) => scene.subtitle).join("").replace(/\s+/g, "")).toBe(
      voiceover.replace(/\s+/g, ""),
    );
  });

  test("keeps U1 scenes readable without leading punctuation or numeric-only headlines", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-scenes-u1-"));
    await writeFile(join(root, "口播文案.md"), [
      "6月30日晚，优必选发布情感陪伴仿生机器人 U1 系列，现场仿生机器人与真人共舞，表情、五官和身材都高度拟真，还接入了智能大模型，能做出眨眼、挑眉、微笑等 30 多种复合表情。",
      "",
      "最吸引眼球的是价格和订单。U1Lite 售价 11.98 万元，U1Pro 售价 16.98 万元，高动态全身版女款 88 万元，男款 99 万元。",
      "",
      "但问题也很现实：3000 元定金可退，最终付款率未知；仿生机器人的量产难度极高，眉毛、睫毛等细节还需要大量人工。",
    ].join("\n"));
    await writeFile(join(root, "图文位置.md"), "优必选 U1 发布。\n\n<!-- image_1: images/1.jpg -->");

    const result = await generateScenes({
      materialPackPath: root,
      timelineSegments: [
        { id: "seg-1", start: 0, end: 6, text: "优必选发布情感陪伴仿生机器人U1系列" },
        { id: "seg-2", start: 6, end: 12, text: "现场机器人与真人共舞表情五官和身材高度拟真" },
        { id: "seg-3", start: 12, end: 16, text: "还能做出三十多种复合表情" },
        { id: "seg-4", start: 16, end: 22, text: "价格和订单U1Lite售价十一点九八万元" },
        { id: "seg-5", start: 22, end: 28, text: "U1Pro售价十六点九八万元" },
        { id: "seg-6", start: 28, end: 32, text: "高动态全身版价格更高" },
        { id: "seg-7", start: 32, end: 38, text: "三千元定金可退最终付款率未知" },
        { id: "seg-8", start: 38, end: 45, text: "仿生机器人的量产难度极高细节仍需人工" },
      ],
    });

    expect(result.scenes.every((scene) => !/^[，、。！？；,.!?;]/.test(scene.subtitle))).toBe(true);
    expect(result.scenes.some((scene) => scene.subtitle.startsWith("、五官和身材"))).toBe(false);
    expect(result.scenes.every((scene) => !/^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*$/.test(scene.visualBrief?.headline ?? ""))).toBe(true);
    const u1LitePriceScene = result.scenes.find(
      (scene) => scene.subtitle.includes("U1Lite 售价 11.98 万元"),
    );
    expect(u1LitePriceScene).toBeDefined();
    expect(u1LitePriceScene?.semantics?.prices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "11.98万元",
          currency: "CNY",
          source: expect.objectContaining({ kind: "subtitle" }),
        }),
      ]),
    );
  });

  test("uses legacy voiceover image markers and limits images to two", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-scenes-"));
    await mkdir(join(root, "images"));
    await writeFile(join(root, "voiceover.md"), [
      "# 口播文案",
      "",
      "如果你觉得 Claude Code 太硬核，用不上，WorkBuddy 可以先顶上。",
      "",
      "【画面：1.jpg，2.jpg，3.jpg，展示下载入口】",
      "先去官网下载客户端。",
    ].join("\n"));
    await writeFile(join(root, "image-list.md"), "# 图片清单");
    await writeFile(join(root, "article.cleaned.md"), "正文");
    await writeFile(join(root, "video-prompt.md"), "视频比例：16:9 横屏");

    const result = await generateScenes({
      materialPackPath: root,
      timelineSegments: [
        { id: "seg-1", start: 0, end: 2, text: "开场" },
        { id: "seg-2", start: 2, end: 5, text: "下载" },
      ],
    });

    expect(result.duration).toBe(5);
    expect(result.scenes).toHaveLength(2);
    expect(result.scenes[0]).toMatchObject({
      start: 0,
      layout: "quote",
      images: [],
    });
    expect(result.scenes[1]).toMatchObject({
      end: 5,
      layout: "split-image",
      images: ["1.jpg", "2.jpg"],
    });
    expect(result.warnings).toContain("scene-0002 引用了超过 2 张图片，已保留前 2 张");
  });
});
