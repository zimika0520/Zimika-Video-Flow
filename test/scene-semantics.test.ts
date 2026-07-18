import { describe, expect, test } from "vitest";
import {
  buildSceneSemanticContext,
  extractSceneSemantics,
} from "@/lib/scene-semantics";
import type { RuntimeAssetManifest, Scene } from "@/lib/types";

const buildBoundExcerptContext = (scene: Scene, claim: string) => {
  const assetId = `${scene.id}-evidence-asset`;
  const recordId = `${scene.id}-evidence-record`;
  const localPath = `/tmp/${scene.id}-evidence.svg`;
  const sourceUrl = `https://example.com/${scene.id}`;
  const assetManifest: RuntimeAssetManifest = {
    assetManifestVersion: 1,
    generatedAt: "2026-07-13T00:00:00.000Z",
    sourceMode: "dry-run",
    queryTerms: [],
    sourcePages: [],
    evidenceRecords: [{
      id: recordId,
      kind: "source-excerpt",
      sourceUrl,
      localPath,
      text: claim,
      narrationClaim: claim,
      verificationMethod: "generated-card",
      capturedAt: "2026-07-13T00:00:00.000Z",
    }],
    assets: [{
      id: assetId,
      type: "evidence-card",
      role: "evidence",
      sourceUrl,
      localPath,
      fileName: `${scene.id}-evidence.svg`,
      mimeType: "image/svg+xml",
      attribution: "example.com",
      usageRisk: "low",
    }],
    sceneBindings: [{
      sceneId: scene.id,
      assetIds: [assetId],
      reason: "atomic fact conflict regression",
      narrationClaim: scene.subtitle,
    }],
    warnings: [],
  };

  return buildSceneSemanticContext({ scenes: [scene], assetManifest });
};

describe("extractSceneSemantics", () => {
  test("returns source-backed empty collections for an abstract statement", () => {
    const semantics = extractSceneSemantics({
      id: "scene-1",
      start: 0,
      end: 4,
      subtitle: "推理成本会变成长期水电费。",
      images: [],
      layout: "quote",
    });

    expect(semantics.sceneId).toBe("scene-1");
    expect(semantics.metrics).toEqual([]);
    expect(semantics.prices).toEqual([]);
    expect(semantics.concepts).toContain("推理成本");
  });

  test("extracts real metrics and prices with source text", () => {
    const semantics = extractSceneSemantics({
      id: "scene-price",
      start: 0,
      end: 5,
      subtitle: "输入 1 元每百万 tokens，输出 4 元每百万 tokens。",
      images: [],
      layout: "quote",
    });

    expect(semantics.metrics.map((item) => item.value)).toEqual(["1元", "4元"]);
    expect(semantics.prices).toHaveLength(2);
    expect(semantics.prices.every((item) => item.source.text.includes("每百万 tokens"))).toBe(true);
  });

  test("keeps the exact resource-consumption span traceable for FinancialMeter", () => {
    const subtitle =
      "模型上线之后，每一次提问、API 调用和代码生成，都要消耗推理算力。";
    const semantics = extractSceneSemantics({
      id: "scene-resource-consumption",
      start: 0,
      end: 5,
      subtitle,
      images: [],
      layout: "quote",
    });

    expect(semantics.concepts).toContain("消耗推理算力");
    expect(semantics.concepts).not.toContain("算力消耗");
    expect(semantics.concepts).not.toContain("推理成本");
    expect(semantics.sources[0]).toMatchObject({
      kind: "subtitle",
      text: subtitle,
      supportsFacts: true,
    });
  });

  test("extracts supported Chinese-written metrics and prices without rewriting source values", () => {
    const cases = [
      ["日均 Token 消耗量相比 preview 增加了二十倍。", ["二十倍"]],
      ["WorkBuddy 自主选择 Hy3 preview 的用户增长了六倍。", ["六倍"]],
      ["幻觉率下降约百分之四十四。", ["百分之四十四"]],
      ["总参数二百九十五 B，激活参数二十一 B。", ["二百九十五B", "二十一B"]],
      ["支持二百五十六 K 上下文。", ["二百五十六K"]],
      ["Hy3 均分二点六七，超过 GLM 五点一。", ["二点六七", "五点一"]],
      ["解决率从百分之七十二提升到百分之九十。", ["百分之七十二", "百分之九十"]],
      ["文件任务完成率达到百分之九十三点七。", ["百分之九十三点七"]],
    ] as const;

    for (const [subtitle, expectedValues] of cases) {
      const semantics = extractSceneSemantics({
        id: `scene-cn-metric-${expectedValues[0]}`,
        start: 0,
        end: 5,
        subtitle,
        images: [],
        layout: "quote",
      });

      expect(semantics.metrics.map((item) => item.value)).toEqual(expectedValues);
      expect(semantics.metrics.every((item) =>
        item.source.kind === "subtitle" &&
        item.source.text === subtitle &&
        subtitle.replace(/\s+/g, "").includes(item.value),
      )).toBe(true);
    }

    const priceSubtitle =
      "价格方面，输入一元每百万 tokens，输出四元每百万 tokens，命中缓存时输入价格降到零点二五元每百万 tokens。";
    const priceSemantics = extractSceneSemantics({
      id: "scene-cn-prices",
      start: 0,
      end: 5,
      subtitle: priceSubtitle,
      images: [],
      layout: "quote",
    });

    expect(priceSemantics.metrics.map((item) => item.value)).toEqual([
      "一元",
      "四元",
      "零点二五元",
    ]);
    expect(priceSemantics.prices.map((item) => item.value)).toEqual([
      "一元",
      "四元",
      "零点二五元",
    ]);
  });

  test("extracts two explicit Chinese calendar points as a traceable timeline", () => {
    const subtitle =
      "它先在四月发布 preview，又在七月经过真实业务打磨后正式上线。";
    const semantics = extractSceneSemantics({
      id: "scene-cn-timeline",
      start: 0,
      end: 6,
      subtitle,
      images: [],
      layout: "quote",
    });

    expect(semantics.timelineEvents).toEqual([
      expect.objectContaining({
        timeExpression: "四月",
        label: "它先在四月发布 preview",
      }),
      expect.objectContaining({
        timeExpression: "七月",
        label: "又在七月经过真实业务打磨后正式上线",
      }),
    ]);
    expect(semantics.timelineEvents.every((item) =>
      item.source.kind === "subtitle" &&
      item.source.text === subtitle &&
      item.source.supportsFacts,
    )).toBe(true);
  });

  test("rejects conflicting Chinese-written numeric signatures", () => {
    const scene: Scene = {
      id: "scene-cn-numeric-conflict",
      start: 0,
      end: 4,
      subtitle: "日均 Token 消耗量相比 preview 增加了二十倍。",
      images: [],
      layout: "quote",
    };
    const context = buildSceneSemanticContext({
      scenes: [scene],
      articleText: "日均 Token 消耗量相比 preview 增加了六倍。",
    });

    expect(context.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("normalizes CNY quantity units before comparing conflicting claims", () => {
    const scene: Scene = {
      id: "scene-cny-quantity-conflict",
      start: 0,
      end: 4,
      subtitle: "U1Lite 售价 11.98 万元。",
      images: [],
      layout: "quote",
    };
    const conflictingClaim = "U1Lite 价格为 11.98 元。";
    const articleContext = buildSceneSemanticContext({
      scenes: [scene],
      articleText: conflictingClaim,
    });
    const excerptContext = buildBoundExcerptContext(scene, conflictingClaim);

    expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
    expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
    expect(extractSceneSemantics(scene, articleContext).prices).toEqual([
      expect.objectContaining({
        value: "11.98万元",
        currency: "CNY",
        source: expect.objectContaining({ kind: "subtitle" }),
      }),
    ]);
  });

  test("rejects swapped prices between distinct product entities", () => {
    const scene: Scene = {
      id: "scene-cny-product-swap",
      start: 0,
      end: 5,
      subtitle: "U1Lite 售价 11.98 万元，U1Pro 售价 16.98 万元。",
      images: [],
      layout: "quote",
    };
    const conflictingClaim =
      "U1Lite 价格为 16.98 万元，U1Pro 定价 11.98 万元。";
    const articleContext = buildSceneSemanticContext({
      scenes: [scene],
      articleText: conflictingClaim,
    });
    const excerptContext = buildBoundExcerptContext(scene, conflictingClaim);

    expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
    expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("does not use another product entity as support for the same CNY amount", () => {
    const scene: Scene = {
      id: "scene-cny-wrong-product",
      start: 0,
      end: 4,
      subtitle: "U1Lite 售价 11.98 万元。",
      images: [],
      layout: "quote",
    };
    const wrongEntityClaim = "U1Pro 价格为 11.98 万元。";
    const articleContext = buildSceneSemanticContext({
      scenes: [scene],
      articleText: wrongEntityClaim,
    });
    const excerptContext = buildBoundExcerptContext(scene, wrongEntityClaim);

    expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
    expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("treats price wording as equivalent for the same product entity", () => {
    const scene: Scene = {
      id: "scene-cny-same-product-wording",
      start: 0,
      end: 4,
      subtitle: "U1Lite 售价 11.98 万元。",
      images: [],
      layout: "quote",
    };
    const context = buildSceneSemanticContext({
      scenes: [scene],
      articleText: "U1Lite 定价为十一万九千八百元。",
    });

    expect(context.sourcesBySceneId[scene.id]).toEqual([
      expect.objectContaining({
        kind: "article",
        text: "U1Lite 定价为十一万九千八百元。",
      }),
    ]);
  });

  test.each([
    "优必选 U1Lite 官方售价为 11.98 万元。",
    "优必选的 U1Lite 建议零售价为十一万九千八百元。",
    "优必选 U1Lite 官方定价为 11.98 万元。",
  ])("matches the core product entity across brand and price modifiers: %s", (
    sourceClaim,
  ) => {
    const scene: Scene = {
      id: `scene-cny-core-product-${sourceClaim}`,
      start: 0,
      end: 4,
      subtitle: "U1Lite 价格为 11.98 万元。",
      images: [],
      layout: "quote",
    };
    const context = buildSceneSemanticContext({
      scenes: [scene],
      articleText: sourceClaim,
    });

    expect(context.sourcesBySceneId[scene.id]).toEqual([
      expect.objectContaining({
        kind: "article",
        text: sourceClaim,
      }),
    ]);
  });

  test("rejects branded product prices when U1Lite and U1Pro values are swapped", () => {
    const scene: Scene = {
      id: "scene-cny-branded-product-swap",
      start: 0,
      end: 5,
      subtitle:
        "优必选 U1Lite 官方售价 11.98 万元，优必选 U1Pro 官方售价 16.98 万元。",
      images: [],
      layout: "quote",
    };
    const conflictingClaim =
      "U1Lite 建议零售价 16.98 万元，U1Pro 价格为 11.98 万元。";
    const articleContext = buildSceneSemanticContext({
      scenes: [scene],
      articleText: conflictingClaim,
    });
    const excerptContext = buildBoundExcerptContext(scene, conflictingClaim);

    expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
    expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("rejects swapped prices between a Chinese version and its Plus variant", () => {
    const scene: Scene = {
      id: "scene-cny-chinese-version-swap",
      start: 0,
      end: 5,
      subtitle: "标准版售价 10 万元，标准版Plus售价 12 万元。",
      images: [],
      layout: "quote",
    };
    const conflictingClaim =
      "标准版价格为 12 万元，标准版Plus建议零售价 10 万元。";
    const articleContext = buildSceneSemanticContext({
      scenes: [scene],
      articleText: conflictingClaim,
    });
    const excerptContext = buildBoundExcerptContext(scene, conflictingClaim);

    expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
    expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("does not let an entity-less price support an explicit product price", () => {
    const scene: Scene = {
      id: "scene-cny-missing-product",
      start: 0,
      end: 4,
      subtitle: "U1Lite 售价 11.98 万元。",
      images: [],
      layout: "quote",
    };
    const entityLessClaim = "价格为 11.98 万元。";
    const articleContext = buildSceneSemanticContext({
      scenes: [scene],
      articleText: entityLessClaim,
    });
    const excerptContext = buildBoundExcerptContext(scene, entityLessClaim);

    expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
    expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test.each([
    ["价格为 11.98 万元。", "11.98万元"],
    ["价格为 1 亿元。", "1亿元"],
    ["价格为一万元。", "一万元"],
    ["价格为十一万九千八百元。", "十一万九千八百元"],
    ["价格为两百元。", "两百元"],
  ])("extracts complete CNY amount %s without truncating its source value", (
    subtitle,
    expectedValue,
  ) => {
    const semantics = extractSceneSemantics({
      id: `scene-cny-${expectedValue}`,
      start: 0,
      end: 4,
      subtitle,
      images: [],
      layout: "quote",
    });

    expect(semantics.prices).toEqual([
      expect.objectContaining({
        value: expectedValue,
        currency: "CNY",
        source: expect.objectContaining({
          kind: "subtitle",
          text: subtitle,
        }),
      }),
    ]);
  });

  test("matches equivalent Arabic and Chinese CNY amounts by normalized value", () => {
    const scene: Scene = {
      id: "scene-equivalent-cny-amount",
      start: 0,
      end: 4,
      subtitle: "U1Lite 售价 11.98 万元。",
      images: [],
      layout: "quote",
    };
    const context = buildSceneSemanticContext({
      scenes: [scene],
      articleText: "U1Lite 售价十一万九千八百元。",
    });

    expect(context.sourcesBySceneId[scene.id]).toEqual([
      expect.objectContaining({
        kind: "article",
        text: "U1Lite 售价十一万九千八百元。",
      }),
    ]);
  });

  test("does not turn metaphors into prices", () => {
    const semantics = extractSceneSemantics({
      id: "scene-cost",
      start: 0,
      end: 5,
      subtitle: "训练是一次性投入，推理是长期水电费。",
      images: [],
      layout: "quote",
    });

    expect(semantics.prices).toEqual([]);
    expect(semantics.comparisons).toEqual([
      expect.objectContaining({ left: "训练", right: "推理" }),
    ]);
  });

  test("extracts only explicit structural semantics", () => {
    const layers = extractSceneSemantics({
      id: "layers",
      start: 0,
      end: 4,
      subtitle: "请求经过模型、API、推理服务，最后进入芯片执行。",
      images: [],
      layout: "quote",
    });
    const barriers = extractSceneSemantics({
      id: "barriers",
      start: 4,
      end: 8,
      subtitle: "制程、HBM、软件生态、流片和量产，每一关都很硬。",
      images: [],
      layout: "quote",
    });
    const dependency = extractSceneSemantics({
      id: "dependency",
      start: 8,
      end: 12,
      subtitle: "DeepSeek 绕不开两条路：一条是英伟达，一条是国产替代芯片。",
      images: [],
      layout: "quote",
    });
    const question = extractSceneSemantics({
      id: "question",
      start: 12,
      end: 16,
      subtitle: "一家模型公司，能不能一直把算力命脉交给别人？",
      images: [],
      layout: "quote",
    });
    const signal = extractSceneSemantics({
      id: "signal",
      start: 16,
      end: 20,
      subtitle: "它更像一个信号：竞争开始进入芯片、供应链和推理成本。",
      images: [],
      layout: "quote",
    });
    const judgement = extractSceneSemantics({
      id: "judgement",
      start: 20,
      end: 24,
      subtitle: "核心不是干掉谁，而是不想一直等别人发货。",
      images: [],
      layout: "quote",
    });

    expect(layers.orderedLayers).toEqual(["模型", "API", "推理服务", "芯片执行"]);
    expect(barriers.barriers).toEqual(["制程", "HBM", "软件生态", "流片", "量产"]);
    expect(dependency.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "DeepSeek", to: "英伟达" }),
        expect.objectContaining({ from: "DeepSeek", to: "国产替代芯片" }),
      ]),
    );
    expect(question.questions).toHaveLength(1);
    expect(signal.signals[0]).toMatchObject({ targets: ["芯片", "供应链", "推理成本"] });
    expect(judgement.judgements[0]?.conclusion).toContain("不想一直等别人发货");
  });

  test("keeps non-factual concept sources out of all factual structures", () => {
    const scene: Scene = {
      id: "scene-context",
      start: 0,
      end: 5,
      subtitle: "这项能力仍在早期阶段。",
      images: ["generated-concept.png"],
      layout: "quote",
    };
    const semantics = extractSceneSemantics(scene, {
      sourcesBySceneId: {
        "scene-context": [
          {
            kind: "article",
            referenceId: "article-p3",
            text: "项目一年前启动，目前仍处在早期阶段。",
            supportsFacts: true,
          },
          {
            kind: "evidence-record",
            referenceId: "evidence-7",
            text: "官方页面显示项目一年前启动，目前仍处在早期阶段。",
            supportsFacts: true,
          },
          {
            kind: "ai-concept",
            referenceId: "generated-concept.png",
            text: "画面里有 99 亿参数、输入 1 元每百万 tokens、两家公司之间的箭头，不是旧方案而是新方案。",
            supportsFacts: false,
          },
        ],
      },
    });

    expect(semantics.timelineEvents.map((item) => item.timeExpression)).toEqual(
      expect.arrayContaining(["一年前", "目前"]),
    );
    expect(semantics.evidenceRefs).toEqual(["evidence-7"]);
    expect(JSON.stringify({
      metrics: semantics.metrics,
      prices: semantics.prices,
      comparisons: semantics.comparisons,
      relations: semantics.relations,
      timelineEvents: semantics.timelineEvents,
      judgements: semantics.judgements,
    })).not.toContain("99 亿");
    expect(semantics.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ai-concept",
          referenceId: "generated-concept.png",
          supportsFacts: false,
        }),
      ]),
    );
    expect(semantics.sources).toHaveLength(4);
    expect(semantics.confidence.timelineEvents).toBe(1);
  });

  test("attaches only the best matching article claim unit", () => {
    const scene: Scene = {
      id: "scene-article",
      start: 0,
      end: 4,
      subtitle: "推理成本会变成真正的商业问题。",
      images: [],
      layout: "quote",
    };
    const context = buildSceneSemanticContext({
      scenes: [scene],
      articleText: [
        "项目一年前启动，目前仍处于早期阶段。推理成本随着调用量增长，会变成真正的商业问题。",
        "另一段只讨论旅游和天气。",
      ].join("\n\n"),
    });

    expect(context.sourcesBySceneId[scene.id]).toEqual([
      expect.objectContaining({
        kind: "article",
        text: "推理成本随着调用量增长，会变成真正的商业问题。",
        supportsFacts: true,
        matchedClaim: scene.subtitle,
      }),
    ]);
  });

  test("does not leak unrelated timeline facts from a neighboring article sentence", () => {
    const scene: Scene = {
      id: "scene-no-leak",
      start: 0,
      end: 4,
      subtitle: "这不能简单理解成挑战英伟达。",
      images: [],
      layout: "quote",
    };
    const context = buildSceneSemanticContext({
      scenes: [scene],
      articleText:
        "DeepSeek 的项目一年前启动，目前仍处于早期阶段。它不是为了简单挑战英伟达。",
    });
    const semantics = extractSceneSemantics(scene, context);

    expect(semantics.timelineEvents).toEqual([]);
    expect(context.sourcesBySceneId[scene.id].map((source) => source.text)).not.toContain(
      "DeepSeek 的项目一年前启动，目前仍处于早期阶段。",
    );
  });

  test("rejects conflicting calendar points in articles and bound source excerpts", () => {
    const scene: Scene = {
      id: "scene-calendar-conflict",
      start: 0,
      end: 6,
      subtitle: "它先在四月发布 preview，又在七月正式上线。",
      images: [],
      layout: "quote",
    };
    const conflictingClaim = "它先在五月发布 preview，又在八月正式上线。";
    const articleContext = buildSceneSemanticContext({
      scenes: [scene],
      articleText: conflictingClaim,
    });
    const excerptContext = buildBoundExcerptContext(scene, conflictingClaim);

    expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
    expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("rejects a timeline when only one event agrees and another related event conflicts", () => {
    const scene: Scene = {
      id: "scene-calendar-partial-conflict",
      start: 0,
      end: 6,
      subtitle: "它先在四月发布 preview，又在七月正式上线。",
      images: [],
      layout: "quote",
    };
    const conflictingClaim =
      "它先在四月发布 preview，又在八月完成正式上线。";
    const articleContext = buildSceneSemanticContext({
      scenes: [scene],
      articleText: conflictingClaim,
    });
    const excerptContext = buildBoundExcerptContext(scene, conflictingClaim);

    expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
    expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("accepts synonymous timeline event wording when every date agrees", () => {
    const scene: Scene = {
      id: "scene-calendar-synonym",
      start: 0,
      end: 6,
      subtitle: "它先在四月发布 preview，又在七月正式上线。",
      images: [],
      layout: "quote",
    };
    const context = buildSceneSemanticContext({
      scenes: [scene],
      articleText:
        "它先在四月发布 preview，又在七月完成正式上线。",
    });

    expect(context.sourcesBySceneId[scene.id]).toEqual([
      expect.objectContaining({
        kind: "article",
        text: "它先在四月发布 preview，又在七月完成正式上线。",
      }),
    ]);
  });

  test.each([
    "它先在2025年四月推出 preview，又在七月投入使用。",
    "它先在四月十五日发布 preview，又在2025年七月正式上线。",
    "它先在四月推出 preview，又在七月投入使用。",
  ])("accepts ordered timeline dates with partial precision and rewritten events: %s", (
    sourceClaim,
  ) => {
    const scene: Scene = {
      id: `scene-calendar-structured-${sourceClaim}`,
      start: 0,
      end: 6,
      subtitle: "它先在四月发布 preview，又在七月正式上线。",
      images: [],
      layout: "quote",
    };
    const context = buildSceneSemanticContext({
      scenes: [scene],
      articleText: sourceClaim,
    });

    expect(context.sourcesBySceneId[scene.id]).toEqual([
      expect.objectContaining({
        kind: "article",
        text: sourceClaim,
      }),
    ]);
  });

  test("rejects a timeline source with a different number of ordered dates", () => {
    const scene: Scene = {
      id: "scene-calendar-count-conflict",
      start: 0,
      end: 6,
      subtitle: "它先在四月发布 preview，又在七月正式上线。",
      images: [],
      layout: "quote",
    };
    const incompleteClaim = "它在四月推出 preview。";
    const articleContext = buildSceneSemanticContext({
      scenes: [scene],
      articleText: incompleteClaim,
    });
    const excerptContext = buildBoundExcerptContext(scene, incompleteClaim);

    expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
    expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("rejects swapped dates between release and launch events", () => {
    const scene: Scene = {
      id: "scene-calendar-action-binding-swap",
      start: 0,
      end: 6,
      subtitle: "它先在四月发布 preview，又在七月正式上线。",
      images: [],
      layout: "quote",
    };
    const conflictingClaim =
      "它先在四月投入使用，又在七月推出 preview。";
    const articleContext = buildSceneSemanticContext({
      scenes: [scene],
      articleText: conflictingClaim,
    });
    const excerptContext = buildBoundExcerptContext(scene, conflictingClaim);

    expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
    expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("rejects swapped dates between distinct objects of the same event type", () => {
    const scene: Scene = {
      id: "scene-calendar-object-binding-swap",
      start: 0,
      end: 6,
      subtitle: "它先在四月发布 A，又在七月发布 B。",
      images: [],
      layout: "quote",
    };
    const conflictingClaim = "它先在四月推出 B，又在七月推出 A。";
    const articleContext = buildSceneSemanticContext({
      scenes: [scene],
      articleText: conflictingClaim,
    });
    const excerptContext = buildBoundExcerptContext(scene, conflictingClaim);

    expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
    expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("rejects swapped dates between distinct Chinese product versions", () => {
    const scene: Scene = {
      id: "scene-calendar-chinese-version-binding-swap",
      start: 0,
      end: 6,
      subtitle: "四月发布标准版，七月发布专业版。",
      images: [],
      layout: "quote",
    };
    const conflictingClaim = "四月推出专业版，七月推出标准版。";
    const articleContext = buildSceneSemanticContext({
      scenes: [scene],
      articleText: conflictingClaim,
    });
    const excerptContext = buildBoundExcerptContext(scene, conflictingClaim);

    expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
    expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("rejects swapped dates between distinct Chinese named objects", () => {
    const scene: Scene = {
      id: "scene-calendar-chinese-object-binding-swap",
      start: 0,
      end: 6,
      subtitle: "四月发布小艺助手，七月发布盘古模型。",
      images: [],
      layout: "quote",
    };
    const conflictingClaim = "四月推出盘古模型，七月推出小艺助手。";
    const articleContext = buildSceneSemanticContext({
      scenes: [scene],
      articleText: conflictingClaim,
    });
    const excerptContext = buildBoundExcerptContext(scene, conflictingClaim);

    expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
    expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("keeps multiple matching calendar points in one narration claim", () => {
    const scene: Scene = {
      id: "scene-calendar-compatible",
      start: 0,
      end: 6,
      subtitle: "它先在四月发布 preview，又在七月正式上线。",
      images: [],
      layout: "quote",
    };
    const context = buildSceneSemanticContext({
      scenes: [scene],
      articleText: "它先在四月发布 preview，又在七月正式上线。",
    });
    const semantics = extractSceneSemantics(scene, context);

    expect(context.sourcesBySceneId[scene.id]).toHaveLength(1);
    expect(semantics.timelineEvents.map((item) => item.timeExpression)).toEqual([
      "四月",
      "七月",
    ]);
    expect(semantics.timelineEvents.every(
      (item) => item.source.kind === "subtitle",
    )).toBe(true);
  });

  test("rejects an article claim with conflicting negative polarity", () => {
    const scene: Scene = {
      id: "scene-article-polarity",
      start: 0,
      end: 4,
      subtitle: "项目目前仍处于早期阶段。",
      images: [],
      layout: "quote",
    };
    const context = buildSceneSemanticContext({
      scenes: [scene],
      articleText: "项目目前已经不处于早期阶段。",
    });

    expect(context.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("does not treat non-negative phrases such as not-only as factual negation", () => {
    const scene: Scene = {
      id: "scene-non-negative-bu",
      start: 0,
      end: 4,
      subtitle: "项目不仅处于早期阶段，还在持续投入。",
      images: [],
      layout: "quote",
    };
    const context = buildSceneSemanticContext({
      scenes: [scene],
      articleText: "项目处于早期阶段，还在持续投入。",
    });

    expect(context.sourcesBySceneId[scene.id]).toEqual([
      expect.objectContaining({
        kind: "article",
        text: "项目处于早期阶段，还在持续投入。",
      }),
    ]);
  });

  test("does not treat must-have-to as factual negation", () => {
    const scene: Scene = {
      id: "scene-must-have-to",
      start: 0,
      end: 4,
      subtitle: "项目不得不继续投入研发资源。",
      images: [],
      layout: "quote",
    };
    const context = buildSceneSemanticContext({
      scenes: [scene],
      articleText: "项目继续投入研发资源。",
    });

    expect(context.sourcesBySceneId[scene.id]).toEqual([
      expect.objectContaining({
        kind: "article",
        text: "项目继续投入研发资源。",
      }),
    ]);
  });

  test("rejects conflicting numeric signatures before matching articles and excerpts", () => {
    const priceScene: Scene = {
      id: "scene-conflicting-input-price",
      start: 0,
      end: 4,
      subtitle: "模型输入价格为 1 元每百万 tokens。",
      images: [],
      layout: "quote",
    };
    const conflictingClaim = "模型输入价格为 9 元每百万 tokens。";
    const articleContext = buildSceneSemanticContext({
      scenes: [priceScene],
      articleText: conflictingClaim,
    });
    const summaryContext = buildSceneSemanticContext({
      scenes: [priceScene],
      articleText: "模型输入价格按每百万 tokens 计费。",
    });
    const assetManifest: RuntimeAssetManifest = {
      assetManifestVersion: 1,
      generatedAt: "2026-07-13T00:00:00.000Z",
      sourceMode: "dry-run",
      queryTerms: [],
      sourcePages: [],
      evidenceRecords: [{
        id: "conflicting-price-excerpt",
        kind: "source-excerpt",
        sourceUrl: "https://example.com/conflicting-price",
        localPath: "/tmp/conflicting-price.svg",
        text: conflictingClaim,
        narrationClaim: conflictingClaim,
        verificationMethod: "generated-card",
        capturedAt: "2026-07-13T00:00:00.000Z",
      }],
      assets: [{
        id: "conflicting-price-asset",
        type: "evidence-card",
        role: "evidence",
        sourceUrl: "https://example.com/conflicting-price",
        localPath: "/tmp/conflicting-price.svg",
        fileName: "conflicting-price.svg",
        mimeType: "image/svg+xml",
        attribution: "example.com",
        usageRisk: "low",
      }],
      sceneBindings: [{
        sceneId: priceScene.id,
        assetIds: ["conflicting-price-asset"],
        reason: "numeric conflict regression",
        narrationClaim: priceScene.subtitle,
      }],
      warnings: [],
    };
    const excerptContext = buildSceneSemanticContext({
      scenes: [priceScene],
      assetManifest,
    });

    expect(articleContext.sourcesBySceneId[priceScene.id]).toEqual([]);
    expect(excerptContext.sourcesBySceneId[priceScene.id]).toEqual([]);
    expect(summaryContext.sourcesBySceneId[priceScene.id]).toEqual([
      expect.objectContaining({
        kind: "article",
        text: "模型输入价格按每百万 tokens 计费。",
      }),
    ]);
    expect(extractSceneSemantics(priceScene, articleContext).metrics.map(
      (item) => item.value,
    )).toEqual(["1元"]);
  });

  test("rejects conflicting percentage signatures for the same metric role", () => {
    const scene: Scene = {
      id: "scene-conflicting-market-share",
      start: 0,
      end: 4,
      subtitle: "市场份额达到 10%，处于领先位置。",
      images: [],
      layout: "quote",
    };
    const context = buildSceneSemanticContext({
      scenes: [scene],
      articleText: "市场份额达到 90%，处于领先位置。",
    });

    expect(context.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("rejects partially different numeric sets but accepts the same set in another order", () => {
    const scene: Scene = {
      id: "scene-multi-value-input-price",
      start: 0,
      end: 4,
      subtitle: "模型输入价格从 1 元调整到 2 元。",
      images: [],
      layout: "quote",
    };
    const conflicting = buildSceneSemanticContext({
      scenes: [scene],
      articleText: "模型输入价格从 1 元调整到 9 元。",
    });
    const reordered = buildSceneSemanticContext({
      scenes: [scene],
      articleText: "模型输入价格从 2 元调整到 1 元。",
    });

    expect(conflicting.sourcesBySceneId[scene.id]).toEqual([]);
    expect(reordered.sourcesBySceneId[scene.id]).toEqual([
      expect.objectContaining({
        kind: "article",
        text: "模型输入价格从 2 元调整到 1 元。",
      }),
    ]);
  });

  test("rejects explicit opposite directional predicates", () => {
    const opposites = [
      ["上涨", "下降"],
      ["上线", "下线"],
      ["增加", "减少"],
      ["上升", "下降"],
      ["增长", "下滑"],
    ];

    for (const [scenePredicate, sourcePredicate] of opposites) {
      const scene: Scene = {
        id: `scene-direction-${scenePredicate}-${sourcePredicate}`,
        start: 0,
        end: 4,
        subtitle: `项目指标正在${scenePredicate}。`,
        images: [],
        layout: "quote",
      };
      const context = buildSceneSemanticContext({
        scenes: [scene],
        articleText: `项目指标正在${sourcePredicate}。`,
      });

      expect(context.sourcesBySceneId[scene.id]).toEqual([]);
    }
  });

  test("rejects a reversed subject and object in an explicit acquisition claim", () => {
    const scene: Scene = {
      id: "scene-reversed-acquisition",
      start: 0,
      end: 4,
      subtitle: "甲公司收购乙公司。",
      images: [],
      layout: "quote",
    };
    const context = buildSceneSemanticContext({
      scenes: [scene],
      articleText: "乙公司收购甲公司。",
    });

    expect(context.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("rejects reversed acquisitions after ignoring explicit deal modifiers", () => {
    for (const modifier of ["宣布", "计划", "将", "拟"]) {
      const scene: Scene = {
        id: `scene-reversed-acquisition-${modifier}`,
        start: 0,
        end: 4,
        subtitle: `甲公司${modifier}收购乙公司。`,
        images: [],
        layout: "quote",
      };
      const context = buildSceneSemanticContext({
        scenes: [scene],
        articleText: `乙公司${modifier}收购甲公司。`,
      });

      expect(context.sourcesBySceneId[scene.id]).toEqual([]);
    }
  });

  test.each([
    {
      id: "trend",
      subtitle: "收入上涨，成本下降。",
      conflictingClaim: "收入下降，成本上涨。",
    },
    {
      id: "support",
      subtitle: "系统不支持离线、支持在线。",
      conflictingClaim: "系统支持离线、不支持在线。",
    },
    {
      id: "status",
      subtitle: "搜索服务已上线，旧接口已下线。",
      conflictingClaim: "搜索服务已下线，旧接口已上线。",
    },
    {
      id: "passive-acquisition",
      subtitle: "根据官方资料，甲公司宣布收购乙公司。",
      conflictingClaim: "根据官方资料，甲公司被乙公司收购。",
    },
  ])(
    "rejects conflicting $id atomic facts in articles and bound source excerpts",
    ({ id, subtitle, conflictingClaim }) => {
      const scene: Scene = {
        id: `scene-atomic-${id}`,
        start: 0,
        end: 4,
        subtitle,
        images: [],
        layout: "quote",
      };
      const articleContext = buildSceneSemanticContext({
        scenes: [scene],
        articleText: conflictingClaim,
      });
      const excerptContext = buildBoundExcerptContext(scene, conflictingClaim);

      expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
      expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
    },
  );

  test.each([
    {
      id: "support-connected-by-but",
      subtitle: "系统不支持离线模式但支持在线模式。",
      conflictingClaim: "系统支持离线模式但不支持在线模式。",
    },
    {
      id: "trend-connected-by-while",
      subtitle: "收入上涨而成本下降。",
      conflictingClaim: "收入下降而成本上涨。",
    },
    {
      id: "status-connected-by-while",
      subtitle: "搜索服务已上线而旧接口已下线。",
      conflictingClaim: "搜索服务已下线而旧接口已上线。",
    },
    {
      id: "trend-connected-by-but-long-form",
      subtitle: "收入上涨但是成本下降。",
      conflictingClaim: "收入上涨但成本上涨。",
    },
    {
      id: "status-connected-by-but-long-form",
      subtitle: "搜索服务已上线但是旧接口已下线。",
      conflictingClaim: "搜索服务已上线但旧接口已上线。",
    },
    {
      id: "trend-connected-by-simultaneously",
      subtitle: "收入上涨同时成本下降。",
      conflictingClaim: "收入下降同时成本上涨。",
    },
    {
      id: "ordered-trend",
      subtitle: "收入先上涨后下降。",
      conflictingClaim: "收入先下降后上涨。",
    },
  ])(
    "rejects conflicting $id atoms in articles and bound source excerpts",
    ({ id, subtitle, conflictingClaim }) => {
      const scene: Scene = {
        id: `scene-connected-atomic-${id}`,
        start: 0,
        end: 4,
        subtitle,
        images: [],
        layout: "quote",
      };
      const articleContext = buildSceneSemanticContext({
        scenes: [scene],
        articleText: conflictingClaim,
      });
      const excerptContext = buildBoundExcerptContext(scene, conflictingClaim);

      expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
      expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
    },
  );

  test("matches equivalent active and passive acquisition facts structurally", () => {
    const scene: Scene = {
      id: "scene-equivalent-passive-acquisition",
      start: 0,
      end: 4,
      subtitle: "甲公司计划收购乙公司。",
      images: [],
      layout: "quote",
    };
    const articleContext = buildSceneSemanticContext({
      scenes: [scene],
      articleText: "乙公司被甲公司收购。",
    });

    expect(articleContext.sourcesBySceneId[scene.id]).toEqual([
      expect.objectContaining({
        kind: "article",
        text: "乙公司被甲公司收购。",
      }),
    ]);
  });

  test("keeps cross-punctuation contrasts intact and rejects their reversed direction", () => {
    for (const separator of ["；", "。"]) {
      const scene: Scene = {
        id: `scene-cross-punctuation-${separator.charCodeAt(0)}`,
        start: 0,
        end: 5,
        subtitle: `项目不是已经成熟${separator}而是仍处于早期阶段。`,
        images: [],
        layout: "quote",
      };
      const accepted = buildSceneSemanticContext({
        scenes: [scene],
        articleText: `项目并非已经成熟${separator}而是仍处于早期阶段。`,
      });
      const rejected = buildSceneSemanticContext({
        scenes: [scene],
        articleText: `项目并非仍处于早期阶段${separator}而是已经成熟。`,
      });

      expect(accepted.sourcesBySceneId[scene.id]).toEqual([
        expect.objectContaining({
          kind: "article",
          text: `项目并非已经成熟${separator}而是仍处于早期阶段。`,
        }),
      ]);
      expect(rejected.sourcesBySceneId[scene.id]).toEqual([]);
    }
  });

  test("prefers input and output roles over trailing price words when deduplicating", () => {
    const scene: Scene = {
      id: "scene-business-role-priority",
      start: 0,
      end: 5,
      subtitle: "输入 1 元每百万 tokens，输出 1 元每百万 tokens。",
      images: [],
      layout: "quote",
    };
    const semantics = extractSceneSemantics(scene, {
      sourcesBySceneId: {
        [scene.id]: [{
          kind: "article",
          referenceId: "article-business-role-priority",
          text: "模型输出定价为 1 元每百万 tokens，模型输入售价为 1 元每百万 tokens。",
          supportsFacts: true,
        }],
      },
    });

    expect(semantics.metrics).toHaveLength(2);
    expect(semantics.prices).toHaveLength(2);
    expect(semantics.metrics.map((item) => item.label)).toEqual(["输入", "输出"]);
    expect(semantics.prices.map((item) => item.label)).toEqual(["输入", "输出"]);
    expect(
      [...semantics.metrics, ...semantics.prices].every(
        (item) => item.source.kind === "subtitle",
      ),
    ).toBe(true);
  });

  test("rejects bound evidence claims with conflicting negative polarity", () => {
    const scene: Scene = {
      id: "scene-evidence-polarity",
      start: 0,
      end: 4,
      subtitle: "项目目前仍处于早期阶段。",
      images: [],
      layout: "quote",
    };
    const oppositeClaim = "项目目前已经不处于早期阶段。";
    const assetManifest: RuntimeAssetManifest = {
      assetManifestVersion: 1,
      generatedAt: "2026-07-13T00:00:00.000Z",
      sourceMode: "dry-run",
      queryTerms: [],
      sourcePages: [],
      evidenceRecords: [
        {
          id: "opposite-source-text",
          kind: "source-text",
          sourceUrl: "https://example.com/opposite-text",
          localPath: "/tmp/opposite-text.txt",
          text: oppositeClaim,
          verificationMethod: "html-fetch",
          capturedAt: "2026-07-13T00:00:00.000Z",
        },
        {
          id: "opposite-source-excerpt",
          kind: "source-excerpt",
          sourceUrl: "https://example.com/opposite-excerpt",
          localPath: "/tmp/opposite-excerpt.svg",
          text: oppositeClaim,
          narrationClaim: oppositeClaim,
          verificationMethod: "generated-card",
          capturedAt: "2026-07-13T00:00:00.000Z",
        },
      ],
      assets: [
        {
          id: "opposite-text-asset",
          type: "evidence-card",
          role: "evidence",
          sourceUrl: "https://example.com/opposite-text",
          localPath: "/tmp/opposite-text.txt",
          fileName: "opposite-text.txt",
          mimeType: "text/plain",
          attribution: "example.com",
          usageRisk: "low",
        },
        {
          id: "opposite-excerpt-asset",
          type: "evidence-card",
          role: "evidence",
          sourceUrl: "https://example.com/opposite-excerpt",
          localPath: "/tmp/opposite-excerpt.svg",
          fileName: "opposite-excerpt.svg",
          mimeType: "image/svg+xml",
          attribution: "example.com",
          usageRisk: "low",
        },
      ],
      sceneBindings: [{
        sceneId: scene.id,
        assetIds: ["opposite-text-asset", "opposite-excerpt-asset"],
        reason: "polarity conflict regression",
        narrationClaim: scene.subtitle,
      }],
      warnings: [],
    };

    const context = buildSceneSemanticContext({ scenes: [scene], assetManifest });

    expect(context.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("deduplicates identical facts across sources and keeps the highest-priority source", () => {
    const factText =
      "输入 1 元每百万 tokens，输出 4 元每百万 tokens。项目一年前启动，目前仍处于早期阶段。";
    const scene: Scene = {
      id: "scene-deduplicated-facts",
      start: 0,
      end: 8,
      subtitle: factText,
      images: [],
      layout: "quote",
    };
    const semantics = extractSceneSemantics(scene, {
      sourcesBySceneId: {
        [scene.id]: [
          {
            kind: "evidence-record",
            referenceId: "evidence-duplicate",
            text: factText,
            supportsFacts: true,
          },
          {
            kind: "user-asset",
            referenceId: "user-duplicate",
            text: factText,
            supportsFacts: true,
          },
          {
            kind: "article",
            referenceId: "article-duplicate",
            text: factText,
            supportsFacts: true,
          },
        ],
      },
    });

    expect(semantics.metrics.map((item) => item.value)).toEqual(["1元", "4元"]);
    expect(semantics.prices).toHaveLength(2);
    expect(semantics.timelineEvents.map((item) => item.timeExpression)).toEqual([
      "一年前",
      "目前",
      "早期阶段",
    ]);
    expect([
      ...semantics.metrics,
      ...semantics.prices,
      ...semantics.timelineEvents,
    ].every((item) => item.source.kind === "subtitle")).toBe(true);
  });

  test("rejects swapped contrast conclusions in articles and source excerpts", () => {
    const scene: Scene = {
      id: "scene-swapped-contrast",
      start: 0,
      end: 5,
      subtitle: "项目并非已经成熟，而是仍处于早期阶段。",
      images: [],
      layout: "quote",
    };
    const reversedClaim = "项目并非仍处于早期阶段，而是已经成熟。";
    const articleContext = buildSceneSemanticContext({
      scenes: [scene],
      articleText: reversedClaim,
    });
    const assetManifest: RuntimeAssetManifest = {
      assetManifestVersion: 1,
      generatedAt: "2026-07-13T00:00:00.000Z",
      sourceMode: "dry-run",
      queryTerms: [],
      sourcePages: [],
      evidenceRecords: [{
        id: "swapped-contrast-excerpt",
        kind: "source-excerpt",
        sourceUrl: "https://example.com/swapped-contrast",
        localPath: "/tmp/swapped-contrast.svg",
        text: reversedClaim,
        narrationClaim: reversedClaim,
        verificationMethod: "generated-card",
        capturedAt: "2026-07-13T00:00:00.000Z",
      }],
      assets: [{
        id: "swapped-contrast-asset",
        type: "evidence-card",
        role: "evidence",
        sourceUrl: "https://example.com/swapped-contrast",
        localPath: "/tmp/swapped-contrast.svg",
        fileName: "swapped-contrast.svg",
        mimeType: "image/svg+xml",
        attribution: "example.com",
        usageRisk: "low",
      }],
      sceneBindings: [{
        sceneId: scene.id,
        assetIds: ["swapped-contrast-asset"],
        reason: "reversed conclusion must not support the scene",
        narrationClaim: scene.subtitle,
      }],
      warnings: [],
    };
    const excerptContext = buildSceneSemanticContext({
      scenes: [scene],
      assetManifest,
    });

    expect(articleContext.sourcesBySceneId[scene.id]).toEqual([]);
    expect(excerptContext.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("rejects swapped contrast conclusions when the contrast has no comma", () => {
    const scene: Scene = {
      id: "scene-swapped-contrast-no-comma",
      start: 0,
      end: 5,
      subtitle: "项目不是已经成熟而是仍处于早期阶段。",
      images: [],
      layout: "quote",
    };
    const context = buildSceneSemanticContext({
      scenes: [scene],
      articleText: "项目并非仍处于早期阶段而是已经成熟。",
    });

    expect(context.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("keeps distinct timeline facts that share a time expression while deduplicating sources", () => {
    const subtitle =
      "项目目前仍处于早期阶段，市场目前已经进入量产阶段。";
    const scene: Scene = {
      id: "scene-timeline-identity",
      start: 0,
      end: 6,
      subtitle,
      images: [],
      layout: "quote",
    };
    const semantics = extractSceneSemantics(scene, {
      sourcesBySceneId: {
        [scene.id]: [{
          kind: "article",
          referenceId: "article-timeline-prefix",
          text: `官方资料显示，${subtitle}`,
          supportsFacts: true,
        }],
      },
    });
    const currentEvents = semantics.timelineEvents.filter(
      (item) => item.timeExpression === "目前",
    );

    expect(currentEvents).toHaveLength(2);
    expect(currentEvents.map((item) => item.label)).toEqual([
      expect.stringContaining("项目"),
      expect.stringContaining("市场"),
    ]);
    expect(currentEvents.every((item) => item.source.kind === "subtitle")).toBe(true);
  });

  test("deduplicates reordered words in the same timeline fact", () => {
    const scene: Scene = {
      id: "scene-reordered-timeline",
      start: 0,
      end: 4,
      subtitle: "项目目前仍处于早期阶段。",
      images: [],
      layout: "quote",
    };
    const semantics = extractSceneSemantics(scene, {
      sourcesBySceneId: {
        [scene.id]: [{
          kind: "article",
          referenceId: "article-reordered-timeline",
          text: "目前项目仍处于早期阶段。",
          supportsFacts: true,
        }],
      },
    });

    expect(
      semantics.timelineEvents.filter((item) => item.timeExpression === "目前"),
    ).toHaveLength(1);
    expect(
      semantics.timelineEvents.filter((item) => item.timeExpression === "早期阶段"),
    ).toHaveLength(1);
    expect(semantics.timelineEvents.every(
      (item) => item.source.kind === "subtitle",
    )).toBe(true);
  });

  test("renumbers deduplicated timeline events after a lower-priority source adds an event", () => {
    const scene: Scene = {
      id: "scene-timeline-renumbered",
      start: 0,
      end: 6,
      subtitle: "一年前项目启动，项目目前仍处于早期阶段。",
      images: [],
      layout: "quote",
    };
    const semantics = extractSceneSemantics(scene, {
      sourcesBySceneId: {
        [scene.id]: [{
          kind: "article",
          referenceId: "article-new-timeline-event",
          text: "随后市场进入量产，项目目前仍处于早期阶段。",
          supportsFacts: true,
        }],
      },
    });

    expect(semantics.timelineEvents.map((item) => item.timeExpression)).toEqual([
      "一年前",
      "目前",
      "早期阶段",
      "随后",
    ]);
    expect(semantics.timelineEvents.map((item) => item.order)).toEqual([
      0,
      1,
      2,
      3,
    ]);
    expect(semantics.timelineEvents[3]?.source.kind).toBe("article");
  });

  test("strips source leads before deduplicating questions", () => {
    const scene: Scene = {
      id: "scene-prefixed-question",
      start: 0,
      end: 4,
      subtitle: "这项能力值得继续观察吗？",
      images: [],
      layout: "quote",
    };
    const semantics = extractSceneSemantics(scene, {
      sourcesBySceneId: {
        [scene.id]: [{
          kind: "article",
          referenceId: "article-prefixed-question",
          text: "官方资料显示，这项能力值得继续观察吗？",
          supportsFacts: true,
        }],
      },
    });

    expect(semantics.questions).toEqual(["这项能力值得继续观察吗？"]);
  });

  test("strips source leads before extracting and deduplicating fallback concepts", () => {
    const scene: Scene = {
      id: "scene-prefixed-fallback-concept",
      start: 0,
      end: 4,
      subtitle: "这项能力值得继续观察。",
      images: [],
      layout: "quote",
    };
    const semantics = extractSceneSemantics(scene, {
      sourcesBySceneId: {
        [scene.id]: [{
          kind: "article",
          referenceId: "article-prefixed-fallback-concept",
          text: "官方资料显示，这项能力值得继续观察。",
          supportsFacts: true,
        }],
      },
    });

    expect(semantics.concepts).toEqual(["这项能力值得继续观察"]);
    expect(semantics.concepts.join("")).not.toContain("官方资料显示");
  });

  test("deduplicates prefixed metric and price sources by numeric fact role", () => {
    const scene: Scene = {
      id: "scene-prefixed-prices",
      start: 0,
      end: 5,
      subtitle: "输入 1 元每百万 tokens，输出 4 元每百万 tokens。",
      images: [],
      layout: "quote",
    };
    const semantics = extractSceneSemantics(scene, {
      sourcesBySceneId: {
        [scene.id]: [{
          kind: "article",
          referenceId: "article-price-prefix",
          text: "官方价格显示输入 1 元每百万 tokens，输出 4 元每百万 tokens。",
          supportsFacts: true,
        }],
      },
    });

    expect(semantics.metrics.map((item) => item.value)).toEqual(["1元", "4元"]);
    expect(semantics.prices.map((item) => item.value)).toEqual(["1元", "4元"]);
    expect(
      [...semantics.metrics, ...semantics.prices].every(
        (item) => item.source.kind === "subtitle",
      ),
    ).toBe(true);
  });

  test("deduplicates rewritten price labels by role without merging input and output", () => {
    const inputScene: Scene = {
      id: "scene-rewritten-input-price",
      start: 0,
      end: 4,
      subtitle: "输入 1 元每百万 tokens。",
      images: [],
      layout: "quote",
    };
    const inputSemantics = extractSceneSemantics(inputScene, {
      sourcesBySceneId: {
        [inputScene.id]: [{
          kind: "article",
          referenceId: "article-rewritten-input-price",
          text: "模型输入价格为 1 元每百万 tokens。",
          supportsFacts: true,
        }],
      },
    });
    const equalValueScene: Scene = {
      id: "scene-equal-input-output-price",
      start: 4,
      end: 8,
      subtitle: "输入 1 元每百万 tokens，输出 1 元每百万 tokens。",
      images: [],
      layout: "quote",
    };
    const equalValueSemantics = extractSceneSemantics(equalValueScene);

    expect(inputSemantics.metrics).toHaveLength(1);
    expect(inputSemantics.prices).toHaveLength(1);
    expect(inputSemantics.metrics[0]?.source.kind).toBe("subtitle");
    expect(inputSemantics.prices[0]?.source.kind).toBe("subtitle");
    expect(equalValueSemantics.metrics).toHaveLength(2);
    expect(equalValueSemantics.prices).toHaveLength(2);
  });

  test("deduplicates prefixed dependency relations and keeps subtitle provenance", () => {
    const scene: Scene = {
      id: "scene-prefixed-relations",
      start: 0,
      end: 5,
      subtitle: "DeepSeek 绕不开两条路：一条是英伟达，一条是国产替代芯片。",
      images: [],
      layout: "quote",
    };
    const semantics = extractSceneSemantics(scene, {
      sourcesBySceneId: {
        [scene.id]: [{
          kind: "article",
          referenceId: "article-relation-prefix",
          text: "官方资料显示，DeepSeek 绕不开两条路：一条是英伟达，一条是国产替代芯片。",
          supportsFacts: true,
        }],
      },
    });

    expect(semantics.relations).toHaveLength(2);
    expect(semantics.relations.map((item) => item.from)).toEqual([
      "DeepSeek",
      "DeepSeek",
    ]);
    expect(semantics.relations.every((item) => item.source.kind === "subtitle")).toBe(true);
  });

  test("strips according-to source prefixes from dependency relation subjects", () => {
    const scene: Scene = {
      id: "scene-according-to-relation",
      start: 0,
      end: 5,
      subtitle: "DeepSeek 绕不开两条路：一条是英伟达，一条是国产替代芯片。",
      images: [],
      layout: "quote",
    };
    const semantics = extractSceneSemantics(scene, {
      sourcesBySceneId: {
        [scene.id]: [{
          kind: "article",
          referenceId: "article-according-to-relation",
          text: "根据官方资料，DeepSeek 绕不开两条路：一条是英伟达，一条是国产替代芯片。",
          supportsFacts: true,
        }],
      },
    });

    expect(semantics.relations).toHaveLength(2);
    expect(semantics.relations.map((item) => item.from)).toEqual([
      "DeepSeek",
      "DeepSeek",
    ]);
  });

  test("deduplicates all source-backed semantic structures across prefixed sources", () => {
    const comparisonScene: Scene = {
      id: "scene-dedupe-comparison",
      start: 0,
      end: 4,
      subtitle: "训练是一次性投入，推理是长期水电费。",
      images: [],
      layout: "quote",
    };
    const relationScene: Scene = {
      id: "scene-dedupe-relation",
      start: 4,
      end: 8,
      subtitle: "DeepSeek 绕不开两条路：一条是英伟达，一条是国产替代芯片。",
      images: [],
      layout: "quote",
    };
    const signalScene: Scene = {
      id: "scene-dedupe-signal",
      start: 8,
      end: 12,
      subtitle: "它更像一个信号：竞争开始进入芯片、供应链和推理成本。",
      images: [],
      layout: "quote",
    };
    const judgementScene: Scene = {
      id: "scene-dedupe-judgement",
      start: 12,
      end: 16,
      subtitle: "核心不是短期价格，而是长期成本。",
      images: [],
      layout: "quote",
    };
    const context = {
      sourcesBySceneId: {
        [comparisonScene.id]: [{
          kind: "article" as const,
          text: "官方分析显示，训练是一次性投入，推理是长期水电费。",
          supportsFacts: true,
        }],
        [relationScene.id]: [{
          kind: "article" as const,
          text: "官方资料显示，DeepSeek 绕不开两条路：一条是英伟达，一条是国产替代芯片。",
          supportsFacts: true,
        }],
        [signalScene.id]: [{
          kind: "article" as const,
          text: "行业报告显示，它更像一个信号：竞争开始进入芯片、供应链和推理成本。",
          supportsFacts: true,
        }],
        [judgementScene.id]: [{
          kind: "article" as const,
          text: "官方分析显示，核心不是短期价格，而是长期成本。",
          supportsFacts: true,
        }],
      },
    };
    const comparison = extractSceneSemantics(comparisonScene, context);
    const relation = extractSceneSemantics(relationScene, context);
    const signal = extractSceneSemantics(signalScene, context);
    const judgement = extractSceneSemantics(judgementScene, context);

    expect(comparison.comparisons).toHaveLength(1);
    expect(relation.relations).toHaveLength(2);
    expect(signal.signals).toHaveLength(1);
    expect(judgement.judgements).toHaveLength(1);
    expect([
      ...comparison.comparisons,
      ...relation.relations,
      ...signal.signals,
      ...judgement.judgements,
    ].every((item) => item.source.kind === "subtitle")).toBe(true);
  });

  test("builds evidence and concept sources from scene-bound assets", () => {
    const scene: Scene = {
      id: "scene-assets",
      start: 0,
      end: 4,
      subtitle: "项目目前仍处于早期阶段。",
      images: ["concept.png"],
      layout: "quote",
    };
    const assetManifest: RuntimeAssetManifest = {
      assetManifestVersion: 1,
      generatedAt: "2026-07-13T00:00:00.000Z",
      sourceMode: "dry-run",
      queryTerms: [],
      sourcePages: [],
      evidenceRecords: [{
        id: "evidence-7",
        kind: "source-text",
        sourceUrl: "https://example.com/source",
        localPath: "/tmp/evidence-7.txt",
        text: "项目目前仍处于早期阶段。",
        verificationMethod: "html-fetch",
        capturedAt: "2026-07-13T00:00:00.000Z",
      }],
      assets: [
        {
          id: "evidence-asset-7",
          type: "evidence-card",
          role: "evidence",
          sourceUrl: "https://example.com/source",
          localPath: "/tmp/evidence-7.txt",
          fileName: "evidence-7.txt",
          mimeType: "text/plain",
          attribution: "example.com",
          usageRisk: "low",
        },
        {
          id: "concept-1",
          type: "ai-generated",
          role: "concept",
          sourceUrl: "shin-video://generated-image/concept-1",
          localPath: "/tmp/concept.png",
          fileName: "concept.png",
          mimeType: "image/png",
          attribution: "AI-generated concept image",
          usageRisk: "medium",
          metadata: { prompt: "99 亿参数的芯片关系图" },
        },
      ],
      sceneBindings: [{
        sceneId: scene.id,
        assetIds: ["evidence-asset-7", "concept-1"],
        reason: "evidence and concept illustration",
        narrationClaim: scene.subtitle,
      }],
      warnings: [],
    };

    const context = buildSceneSemanticContext({ scenes: [scene], assetManifest });

    expect(context.sourcesBySceneId[scene.id]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "evidence-record",
          referenceId: "evidence-7",
          supportsFacts: true,
        }),
        expect.objectContaining({
          kind: "ai-concept",
          referenceId: "concept-1",
          supportsFacts: false,
        }),
      ]),
    );
  });

  test("rejects a text-matching evidence record that is not bound to the scene", () => {
    const scene: Scene = {
      id: "scene-unbound-evidence",
      start: 0,
      end: 4,
      subtitle: "项目目前仍处于早期阶段。",
      images: [],
      layout: "quote",
    };
    const assetManifest: RuntimeAssetManifest = {
      assetManifestVersion: 1,
      generatedAt: "2026-07-13T00:00:00.000Z",
      sourceMode: "dry-run",
      queryTerms: [],
      sourcePages: [],
      evidenceRecords: [{
        id: "unbound-evidence",
        kind: "source-text",
        sourceUrl: "https://example.com/unbound",
        localPath: "/tmp/unbound-evidence.txt",
        text: scene.subtitle,
        verificationMethod: "html-fetch",
        capturedAt: "2026-07-13T00:00:00.000Z",
      }],
      assets: [{
        id: "unbound-asset",
        type: "evidence-card",
        role: "evidence",
        sourceUrl: "https://example.com/unbound",
        localPath: "/tmp/unbound-evidence.txt",
        fileName: "unbound-evidence.txt",
        mimeType: "text/plain",
        attribution: "example.com",
        usageRisk: "low",
      }],
      sceneBindings: [],
      warnings: [],
    };

    const context = buildSceneSemanticContext({ scenes: [scene], assetManifest });
    const semantics = extractSceneSemantics(scene, context);

    expect(context.sourcesBySceneId[scene.id]).toEqual([]);
    expect(semantics.evidenceRefs).toEqual([]);
  });

  test("accepts an evidence record through a bound evidence asset source URL", () => {
    const scene: Scene = {
      id: "scene-url-evidence",
      start: 0,
      end: 4,
      subtitle: "项目目前仍处于早期阶段。",
      images: [],
      layout: "quote",
    };
    const assetManifest: RuntimeAssetManifest = {
      assetManifestVersion: 1,
      generatedAt: "2026-07-13T00:00:00.000Z",
      sourceMode: "dry-run",
      queryTerms: [],
      sourcePages: [],
      evidenceRecords: [{
        id: "url-evidence",
        kind: "external-screenshot",
        sourceUrl: "https://example.com/project-status",
        text: scene.subtitle,
        verificationMethod: "browser-capture",
        capturedAt: "2026-07-13T00:00:00.000Z",
      }],
      assets: [{
        id: "bound-screenshot",
        type: "web-screenshot",
        role: "evidence",
        sourceUrl: "https://example.com/project-status",
        localPath: "/tmp/project-status.png",
        fileName: "project-status.png",
        mimeType: "image/png",
        attribution: "example.com",
        usageRisk: "low",
      }],
      sceneBindings: [{
        sceneId: scene.id,
        assetIds: ["bound-screenshot"],
        reason: "status evidence",
        narrationClaim: scene.subtitle,
      }],
      warnings: [],
    };

    const context = buildSceneSemanticContext({ scenes: [scene], assetManifest });
    const semantics = extractSceneSemantics(scene, context);

    expect(semantics.evidenceRefs).toEqual(["url-evidence"]);
  });

  test("rejects a bound source excerpt whose narration claim belongs to another scene", () => {
    const scene: Scene = {
      id: "scene-wrong-claim",
      start: 0,
      end: 4,
      subtitle: "项目目前仍处于早期阶段。",
      images: [],
      layout: "quote",
    };
    const assetManifest: RuntimeAssetManifest = {
      assetManifestVersion: 1,
      generatedAt: "2026-07-13T00:00:00.000Z",
      sourceMode: "dry-run",
      queryTerms: [],
      sourcePages: [],
      evidenceRecords: [{
        id: "wrong-claim-evidence",
        kind: "source-excerpt",
        sourceUrl: "https://example.com/source",
        localPath: "/tmp/wrong-claim.svg",
        text: scene.subtitle,
        narrationClaim: "旅游旺季的天气会影响酒店价格。",
        verificationMethod: "generated-card",
        capturedAt: "2026-07-13T00:00:00.000Z",
      }],
      assets: [{
        id: "wrong-claim-card",
        type: "evidence-card",
        role: "evidence",
        sourceUrl: "https://example.com/source",
        localPath: "/tmp/wrong-claim.svg",
        fileName: "wrong-claim.svg",
        mimeType: "image/svg+xml",
        attribution: "example.com",
        usageRisk: "low",
      }],
      sceneBindings: [{
        sceneId: scene.id,
        assetIds: ["wrong-claim-card"],
        reason: "incorrectly assigned excerpt",
        narrationClaim: scene.subtitle,
      }],
      warnings: [],
    };

    const context = buildSceneSemanticContext({ scenes: [scene], assetManifest });

    expect(context.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("rejects a bound source excerpt without a narration claim", () => {
    const scene: Scene = {
      id: "scene-missing-claim",
      start: 0,
      end: 4,
      subtitle: "项目目前仍处于早期阶段。",
      images: [],
      layout: "quote",
    };
    const assetManifest: RuntimeAssetManifest = {
      assetManifestVersion: 1,
      generatedAt: "2026-07-13T00:00:00.000Z",
      sourceMode: "dry-run",
      queryTerms: [],
      sourcePages: [],
      evidenceRecords: [{
        id: "missing-claim-evidence",
        kind: "source-excerpt",
        sourceUrl: "https://example.com/source",
        localPath: "/tmp/missing-claim.svg",
        text: scene.subtitle,
        verificationMethod: "generated-card",
        capturedAt: "2026-07-13T00:00:00.000Z",
      }],
      assets: [{
        id: "missing-claim-card",
        type: "evidence-card",
        role: "evidence",
        sourceUrl: "https://example.com/source",
        localPath: "/tmp/missing-claim.svg",
        fileName: "missing-claim.svg",
        mimeType: "image/svg+xml",
        attribution: "example.com",
        usageRisk: "low",
      }],
      sceneBindings: [{
        sceneId: scene.id,
        assetIds: ["missing-claim-card"],
        reason: "excerpt without narration claim",
        narrationClaim: scene.subtitle,
      }],
      warnings: [],
    };

    const context = buildSceneSemanticContext({ scenes: [scene], assetManifest });

    expect(context.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("rejects a source excerpt when the scene binding has no narration claim", () => {
    const scene: Scene = {
      id: "scene-binding-missing-claim",
      start: 0,
      end: 4,
      subtitle: "项目目前仍处于早期阶段。",
      images: [],
      layout: "quote",
    };
    const assetManifest: RuntimeAssetManifest = {
      assetManifestVersion: 1,
      generatedAt: "2026-07-13T00:00:00.000Z",
      sourceMode: "dry-run",
      queryTerms: [],
      sourcePages: [],
      evidenceRecords: [{
        id: "binding-missing-claim-evidence",
        kind: "source-excerpt",
        sourceUrl: "https://example.com/source",
        localPath: "/tmp/binding-missing-claim.svg",
        text: scene.subtitle,
        narrationClaim: scene.subtitle,
        verificationMethod: "generated-card",
        capturedAt: "2026-07-13T00:00:00.000Z",
      }],
      assets: [{
        id: "binding-missing-claim-card",
        type: "evidence-card",
        role: "evidence",
        sourceUrl: "https://example.com/source",
        localPath: "/tmp/binding-missing-claim.svg",
        fileName: "binding-missing-claim.svg",
        mimeType: "image/svg+xml",
        attribution: "example.com",
        usageRisk: "low",
      }],
      sceneBindings: [{
        sceneId: scene.id,
        assetIds: ["binding-missing-claim-card"],
        reason: "excerpt binding without narration claim",
      }],
      warnings: [],
    };

    const context = buildSceneSemanticContext({ scenes: [scene], assetManifest });

    expect(context.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("does not fall back to source URL when a record local path mismatches the bound asset", () => {
    const scene: Scene = {
      id: "scene-path-mismatch",
      start: 0,
      end: 4,
      subtitle: "项目目前仍处于早期阶段。",
      images: [],
      layout: "quote",
    };
    const assetManifest: RuntimeAssetManifest = {
      assetManifestVersion: 1,
      generatedAt: "2026-07-13T00:00:00.000Z",
      sourceMode: "dry-run",
      queryTerms: [],
      sourcePages: [],
      evidenceRecords: [{
        id: "different-path-evidence",
        kind: "external-screenshot",
        sourceUrl: "https://example.com/shared-page",
        localPath: "/tmp/unbound-screenshot.png",
        text: scene.subtitle,
        verificationMethod: "browser-capture",
        capturedAt: "2026-07-13T00:00:00.000Z",
      }],
      assets: [{
        id: "bound-screenshot",
        type: "web-screenshot",
        role: "evidence",
        sourceUrl: "https://example.com/shared-page",
        localPath: "/tmp/bound-screenshot.png",
        fileName: "bound-screenshot.png",
        mimeType: "image/png",
        attribution: "example.com",
        usageRisk: "low",
      }],
      sceneBindings: [{
        sceneId: scene.id,
        assetIds: ["bound-screenshot"],
        reason: "different screenshot from the same page",
        narrationClaim: scene.subtitle,
      }],
      warnings: [],
    };

    const context = buildSceneSemanticContext({ scenes: [scene], assetManifest });

    expect(context.sourcesBySceneId[scene.id]).toEqual([]);
  });

  test("rejects source URL association when the URL maps to multiple assets", () => {
    const scene: Scene = {
      id: "scene-ambiguous-url",
      start: 0,
      end: 4,
      subtitle: "项目目前仍处于早期阶段。",
      images: [],
      layout: "quote",
    };
    const assetManifest: RuntimeAssetManifest = {
      assetManifestVersion: 1,
      generatedAt: "2026-07-13T00:00:00.000Z",
      sourceMode: "dry-run",
      queryTerms: [],
      sourcePages: [],
      evidenceRecords: [{
        id: "ambiguous-url-evidence",
        kind: "external-screenshot",
        sourceUrl: "https://example.com/shared-page",
        text: scene.subtitle,
        verificationMethod: "browser-capture",
        capturedAt: "2026-07-13T00:00:00.000Z",
      }],
      assets: [
        {
          id: "bound-shared-screenshot",
          type: "web-screenshot",
          role: "evidence",
          sourceUrl: "https://example.com/shared-page",
          localPath: "/tmp/bound-shared-screenshot.png",
          fileName: "bound-shared-screenshot.png",
          mimeType: "image/png",
          attribution: "example.com",
          usageRisk: "low",
        },
        {
          id: "other-shared-screenshot",
          type: "web-screenshot",
          role: "evidence",
          sourceUrl: "https://example.com/shared-page",
          localPath: "/tmp/other-shared-screenshot.png",
          fileName: "other-shared-screenshot.png",
          mimeType: "image/png",
          attribution: "example.com",
          usageRisk: "low",
        },
      ],
      sceneBindings: [{
        sceneId: scene.id,
        assetIds: ["bound-shared-screenshot"],
        reason: "one of multiple screenshots from the same page",
        narrationClaim: scene.subtitle,
      }],
      warnings: [],
    };

    const context = buildSceneSemanticContext({ scenes: [scene], assetManifest });

    expect(context.sourcesBySceneId[scene.id]).toEqual([]);
  });
});
