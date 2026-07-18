import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { buildRuntimeDirectorPlan } from "@/lib/director-plan";
import { buildDirectorQualityBounds } from "@/lib/director-selector";
import { validateProductionGate } from "@/lib/production-gate";
import type { ProviderNativeSubtitleTimeline } from "@/lib/tts-provider";
import {
  defaultStyleProfile,
  type DirectorQualityTargets,
  type RuntimeAssetManifest,
  type Scene,
} from "@/lib/types";
import { buildRuntimeVideoBrief } from "@/lib/video-brief";
import { buildVisualManifestFromScenes } from "@/lib/visual-manifest";

const semanticSource = (text: string) => ({
  kind: "subtitle" as const,
  text,
  supportsFacts: true,
});

const emptySemantics = (sceneId: string, concepts: string[] = []) => ({
  sceneId,
  entities: [],
  metrics: [],
  prices: [],
  timelineEvents: [],
  comparisons: [],
  relations: [],
  orderedLayers: [],
  barriers: [],
  questions: [],
  signals: [],
  judgements: [],
  concepts,
  evidenceRefs: [],
  pauseMarkers: [],
  sources: [],
  confidence: {
    metrics: 0,
    prices: 0,
    timelineEvents: 0,
    comparisons: 0,
    relations: 0,
    orderedLayers: 0,
    barriers: 0,
    questions: 0,
    signals: 0,
    judgements: 0,
    concepts: concepts.length ? 1 : 0,
  },
});

const scenes: Scene[] = [
  {
    id: "scene-1",
    start: 0,
    end: 3,
    subtitle: "第一句口播字幕。",
    images: [],
    layout: "title",
    sceneType: "impact-hook",
    motionVariant: "scale-pop",
    directorType: "Hero",
    rendererFamily: "hero",
    visualTreatment: "hero-title",
    semantics: emptySemantics("scene-1", ["开场"]),
    content: { headline: "第一句" },
    components: ["HeroTitle"],
    shotStyle: "Burst",
  },
  {
    id: "scene-2",
    start: 3,
    end: 6,
    subtitle: "第二句解释增长 20 倍。",
    images: [],
    layout: "quote",
    sceneType: "data-breakdown",
    motionVariant: "column-wipe",
    directorType: "DataExplosion",
    rendererFamily: "data",
    visualTreatment: "metric-burst",
    semantics: {
      ...emptySemantics("scene-2", ["增长"]),
      metrics: [
        {
          label: "增长",
          value: "20倍",
          unit: "倍",
          source: semanticSource("第二句解释增长 20 倍。"),
        },
      ],
      sources: [semanticSource("第二句解释增长 20 倍。")],
    },
    content: { headline: "增长", metrics: [{ label: "增长", value: "20倍" }] },
    components: ["MetricCard", "MetricCounter"],
    shotStyle: "Reveal",
  },
  {
    id: "scene-3",
    start: 6,
    end: 9,
    subtitle: "第三句解释主体 A 连接主体 B。",
    images: [],
    layout: "split-image",
    sceneType: "relationship-map",
    motionVariant: "line-draw",
    directorType: "SystemMap",
    rendererFamily: "relationship-map",
    visualTreatment: "node-network",
    semantics: {
      ...emptySemantics("scene-3", ["主体关系"]),
      relations: [
        {
          from: "主体 A",
          to: "主体 B",
          relation: "连接",
          source: semanticSource("第三句解释主体 A 连接主体 B。"),
        },
      ],
      sources: [semanticSource("第三句解释主体 A 连接主体 B。")],
    },
    content: {
      headline: "主体关系",
      nodes: [{ label: "主体 A" }, { label: "主体 B" }],
    },
    components: ["NodeGraph"],
    shotStyle: "Flow",
  },
  {
    id: "scene-4",
    start: 9,
    end: 12,
    subtitle: "第四句给出结论。",
    images: [],
    layout: "ending",
    sceneType: "summary-card",
    motionVariant: "type-build",
    directorType: "Summary",
    rendererFamily: "summary",
    visualTreatment: "closing-summary",
    semantics: {
      ...emptySemantics("scene-4", ["结论"]),
      sources: [semanticSource("第四句给出结论。")],
    },
    content: { headline: "结论", summaryItems: ["结论"] },
    components: ["SummaryCard"],
    shotStyle: "Collapse",
  },
];
const existingAudioPath = fileURLToPath(import.meta.url);
const audioFingerprint = createHash("sha256")
  .update(readFileSync(existingAudioPath))
  .digest("hex");
const providerTimelineFixtureDir = mkdtempSync(
  path.join(os.tmpdir(), "shin-production-gate-"),
);

afterAll(() => {
  rmSync(providerTimelineFixtureDir, { recursive: true, force: true });
});

const buildProviderTimelineFixture = (
  inputScenes: Scene[],
): {
  voiceoverPath: string;
  subtitleTimeline: ProviderNativeSubtitleTimeline;
} => {
  const script = inputScenes.map((scene) => scene.subtitle).join("");
  const scriptFingerprint = createHash("sha256")
    .update(script, "utf8")
    .digest("hex");
  const voiceoverPath = path.join(
    providerTimelineFixtureDir,
    `${scriptFingerprint}.md`,
  );
  writeFileSync(voiceoverPath, `${script}\n`, "utf8");

  return {
    voiceoverPath,
    subtitleTimeline: {
      subtitleTimelineVersion: 1,
      source: "provider-native",
      provider: "custom",
      audioFingerprint,
      scriptFingerprint,
      segments: inputScenes.map((scene, index) => ({
        id: `caption-${String(index + 1).padStart(4, "0")}`,
        text: scene.subtitle,
        start: scene.start,
        end: scene.end,
        timingConfidence: 1,
      })),
    },
  };
};

const buildAssetManifest = (inputScenes: Scene[]): RuntimeAssetManifest => ({
  assetManifestVersion: 1,
  generatedAt: "2026-07-10T00:00:00.000Z",
  sourceMode: "web-research",
  queryTerms: ["测试视频"],
  sourcePages: [
    {
      url: "https://example.com/report",
      title: "测试来源",
      domain: "example.com",
      captured: true,
    },
  ],
  evidenceRecords: [
    {
      id: "evidence-001",
      kind: "source-text",
      sourceUrl: "https://example.com/report",
      sourceTitle: "测试来源",
      sourceDomain: "example.com",
      localPath: existingAudioPath,
      text: "这是一段用于测试 production gate 的来源文章证据。",
      verificationMethod: "html-fetch",
      capturedAt: "2026-07-10T00:00:00.000Z",
    },
  ],
  assets: [
    {
      id: "asset-001",
      type: "web-screenshot",
      role: "evidence",
      sourceUrl: "https://example.com/report",
      sourceTitle: "测试来源",
      sourceDomain: "example.com",
      localPath: existingAudioPath,
      fileName: "asset.png",
      mimeType: "image/png",
      attribution: "example.com",
      usageRisk: "unknown",
      capture: {
        method: "headless-chrome",
        viewport: { width: 1440, height: 1100 },
        capturedAt: "2026-07-10T00:00:00.000Z",
      },
    },
  ],
  sceneBindings: inputScenes.map((scene) => ({
    sceneId: scene.id,
    assetIds: ["asset-001"],
    reason: `为 ${scene.id} 绑定测试证据素材`,
    narrationClaim: scene.subtitle,
    targetRegion: {
      coordinateSpace: "normalized_frame",
      description: "主视觉区域",
    },
    layoutZones: {
      reserved: ["header", "evidence", "insight", "subtitle", "callout"],
      overlapChecked: true,
    },
  })),
  warnings: [],
});

const buildGateReport = (
  inputScenes: Scene[],
  assetManifestOverride?: RuntimeAssetManifest,
  qualityTargetsOverride?: DirectorQualityTargets,
) => {
  const bounds = buildDirectorQualityBounds(inputScenes.length);
  const directorQualityTargets = qualityTargetsOverride ?? {
    ...bounds,
    requiredForms: bounds.preferredForms,
    requiredFamilies: bounds.preferredFamilies,
  };
  const videoBrief = buildRuntimeVideoBrief({
    topic: "语义导演测试",
    audience: "测试观众",
    coreAngle: "验证导演类型与语义内容一致",
    whyWatch: "阻止无依据视觉类型进入渲染",
    plainAnswer: "只渲染通过能力契约的场景。",
  });
  const visualManifest = buildVisualManifestFromScenes(inputScenes);
  const assetManifest = assetManifestOverride ?? buildAssetManifest(inputScenes);
  const directorPlan = buildRuntimeDirectorPlan({
    scenes: inputScenes,
    videoBrief,
    visualManifest,
    directorQualityTargets,
  });
  return validateProductionGate({
    scenes: inputScenes,
    captions: inputScenes.map((scene) => ({
      text: scene.subtitle,
      start: scene.start,
      end: scene.end,
    })),
    videoBrief,
    visualManifest,
    assetManifest,
    directorPlan,
    styleProfile: defaultStyleProfile,
    audioPath: existingAudioPath,
    ...buildProviderTimelineFixture(inputScenes),
  });
};

describe("production gate", () => {
  test("passes when brief, manifest, subtitles, director plan and style profile are aligned", () => {
    const report = buildGateReport(scenes);

    expect(report.errors).toEqual([]);
    expect(report.passed).toBe(true);
  });

  test("blocks only missing render-critical inputs", () => {
    const report = validateProductionGate({ scenes: [] });

    expect(report.passed).toBe(false);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        "runtime/scenes.json 没有可渲染 scenes",
        "缺少 runtime/director-plan.json 或 directorPlanVersion",
        "缺少 runtime/style-profile.json 或 styleProfileVersion",
        "缺少最终口播音频，不能渲染",
        "缺少确认后的口播文案，不能渲染",
        "缺少服务商原生 subtitle-timeline.json，不能渲染",
      ]),
    );
  });

  test("blocks a director plan that no longer matches the current scenes", () => {
    const videoBrief = buildRuntimeVideoBrief({
      topic: "导演指纹测试",
      coreAngle: "修改场景后旧导演方案必须失效",
      whyWatch: "避免错误镜头进入渲染",
      plainAnswer: "重新生成导演方案。",
    });
    const visualManifest = buildVisualManifestFromScenes(scenes);
    const directorPlan = buildRuntimeDirectorPlan({ scenes, videoBrief, visualManifest });
    const changedScenes = scenes.map((scene, index) =>
      index === 0 ? { ...scene, subtitle: "已经修改的第一句口播字幕。" } : scene,
    );

    const report = validateProductionGate({
      scenes: changedScenes,
      directorPlan,
      styleProfile: defaultStyleProfile,
      audioPath: existingAudioPath,
      ...buildProviderTimelineFixture(changedScenes),
    });

    expect(report.passed).toBe(false);
    expect(report.errors.join("\n")).toContain(
      "RUN_DIR/director-plan.json 与当前 scenes.json 不匹配",
    );
  });

  test("does not revalidate a missing or stale visual manifest before rendering", () => {
    const videoBrief = buildRuntimeVideoBrief({
      topic: "测试视频",
      coreAngle: "解释一个复杂事件",
      whyWatch: "看懂关键变化",
      plainAnswer: "用数据和关系图解释。",
    });
    const visualManifest = buildVisualManifestFromScenes(scenes.slice(0, 3));
    const directorPlan = buildRuntimeDirectorPlan({ scenes, videoBrief, visualManifest });

    const report = validateProductionGate({
      scenes,
      captions: scenes.map((scene) => ({ text: scene.subtitle, start: scene.start, end: scene.end })),
      videoBrief,
      visualManifest,
      directorPlan,
      styleProfile: defaultStyleProfile,
      audioPath: existingAudioPath,
      ...buildProviderTimelineFixture(scenes),
    });

    expect(report.passed).toBe(true);
    expect(report.errors).toEqual([]);
  });

  test("does not recheck full subtitle duplication before rendering", () => {
    const duplicatedScenes = [
      {
        ...scenes[0],
        content: { headline: scenes[0].subtitle },
      },
      ...scenes.slice(1),
    ];
    const videoBrief = buildRuntimeVideoBrief({
      topic: "测试视频",
      coreAngle: "解释一个复杂事件",
      whyWatch: "看懂关键变化",
      plainAnswer: "用数据和关系图解释。",
    });
    const visualManifest = buildVisualManifestFromScenes(duplicatedScenes);
    const directorPlan = buildRuntimeDirectorPlan({ scenes: duplicatedScenes, videoBrief, visualManifest });

    const report = validateProductionGate({
      scenes: duplicatedScenes,
      captions: duplicatedScenes.map((scene) => ({ text: scene.subtitle, start: scene.start, end: scene.end })),
      videoBrief,
      visualManifest,
      directorPlan,
      styleProfile: defaultStyleProfile,
      audioPath: existingAudioPath,
      ...buildProviderTimelineFixture(duplicatedScenes),
    });

    expect(report.passed).toBe(true);
    expect(report.errors).toEqual([]);
  });

  test("does not block a valid video solely because a scene is long", () => {
    const sparseScenes = [
      {
        ...scenes[0],
        end: 60,
      },
      {
        ...scenes[1],
        start: 60,
        end: 120,
      },
    ];
    const videoBrief = buildRuntimeVideoBrief({
      topic: "测试视频",
      coreAngle: "解释一个复杂事件",
      whyWatch: "看懂关键变化",
      plainAnswer: "用数据和关系图解释。",
    });
    const visualManifest = buildVisualManifestFromScenes(sparseScenes);
    const assetManifest = buildAssetManifest(sparseScenes);
    const directorPlan = buildRuntimeDirectorPlan({ scenes: sparseScenes, videoBrief, visualManifest });

    const report = validateProductionGate({
      scenes: sparseScenes,
      captions: sparseScenes.map((scene) => ({ text: scene.subtitle, start: scene.start, end: scene.end })),
      videoBrief,
      visualManifest,
      assetManifest,
      directorPlan,
      styleProfile: defaultStyleProfile,
      audioPath: existingAudioPath,
      ...buildProviderTimelineFixture(sparseScenes),
    });

    expect(report.errors.join("\n")).not.toContain("镜头密度不足");
    expect(report.errors.join("\n")).not.toContain("镜头时长必须小于 10 秒");
  });

  test("does not add daily review warnings for scene density or duration", () => {
    const longScenes = Array.from({ length: 6 }, (_, index): Scene => ({
      ...scenes[index % scenes.length],
      id: `long-${index + 1}`,
      start: index * 10,
      end: (index + 1) * 10,
      sceneType: ["impact-hook", "news-context", "data-breakdown", "relationship-map", "risk-contrast", "summary-card"][index] as Scene["sceneType"],
      directorType: ["Hero", "Timeline", "DataExplosion", "SystemMap", "Contrast", "Summary"][index] as Scene["directorType"],
    }));
    const videoBrief = buildRuntimeVideoBrief({ topic: "一分钟测试", coreAngle: "检查镜头密度", whyWatch: "避免长镜头", plainAnswer: "增加镜头。" });
    const visualManifest = buildVisualManifestFromScenes(longScenes);
    const assetManifest = buildAssetManifest(longScenes);
    const directorPlan = buildRuntimeDirectorPlan({ scenes: longScenes, videoBrief, visualManifest });

    const report = validateProductionGate({
      scenes: longScenes,
      captions: longScenes.map((scene) => ({ text: scene.subtitle, start: scene.start, end: scene.end })),
      videoBrief,
      visualManifest,
      assetManifest,
      directorPlan,
      styleProfile: defaultStyleProfile,
      audioPath: existingAudioPath,
      ...buildProviderTimelineFixture(longScenes),
    });

    expect(report.errors.join("\n")).not.toContain("60 秒视频至少需要 7 个");
    expect(report.errors.join("\n")).not.toContain("镜头时长必须小于 10 秒");
    expect(report.warnings).toEqual([]);
  });

  test("does not add a production-gate warning for declared visual form repetition", () => {
    const repeatedScenes = Array.from({ length: 8 }, (_, index): Scene => {
      const source = scenes[index % 4];
      return {
        ...source,
        id: `repeat-${index + 1}`,
        start: index * 5,
        end: (index + 1) * 5,
      };
    });
    const report = buildGateReport(repeatedScenes);

    expect(report.errors.join("\n")).not.toContain("视觉形式不足：目标 5 种，当前只有 4 种");
    expect(report.warnings).toEqual([]);
  });

  test("does not count scene type names as distinct forms when the renderer family is the same", () => {
    const repeatedRendererScenes = Array.from({ length: 8 }, (_, index): Scene => ({
      ...scenes[index % scenes.length],
      id: `same-renderer-${index + 1}`,
      start: index * 4,
      end: (index + 1) * 4,
      sceneType: [
        "impact-hook",
        "news-context",
        "data-breakdown",
        "relationship-map",
        "concept-steps",
        "risk-contrast",
        "evidence-zoom",
        "summary-card",
      ][index] as Scene["sceneType"],
      directorType: "DataExplosion",
      rendererFamily: "data",
      visualTreatment: "metric-burst",
      motionVariant: ["scale-pop", "column-wipe", "line-draw", "type-build"][index % 4] as Scene["motionVariant"],
      shotStyle: ["Burst", "Reveal", "Flow", "Collapse"][index % 4] as Scene["shotStyle"],
    }));
    const report = buildGateReport(repeatedRendererScenes);

    expect(report.errors).not.toContain("视觉形式不足：目标 5 种，当前只有 1 种");
    expect(report.errors).not.toContain("same-renderer-2 与前一镜头使用了完全相同的视觉形式");
    expect(report.warnings).toEqual([]);
  });

  test("does not revalidate asset evidence records before rendering", () => {
    const videoBrief = buildRuntimeVideoBrief({
      topic: "AI 概念图门禁测试",
      audience: "科技观众",
      coreAngle: "概念图不能替代事实证据",
      whyWatch: "确认正式模式证据门禁",
      plainAnswer: "AI 概念图只能解释，不能证明。",
    });
    const conceptScenes = scenes.map((scene) => ({
      ...scene,
      images: ["concept.png"],
      primaryVisualAsset: "concept.png",
    }));
    const visualManifest = buildVisualManifestFromScenes(conceptScenes);
    const assetManifest: RuntimeAssetManifest = {
      assetManifestVersion: 1,
      generatedAt: "2026-07-13T00:00:00.000Z",
      sourceMode: "web-research",
      queryTerms: ["AI 概念图"],
      evidenceRecords: [],
      sourcePages: [],
      assets: [
        {
          id: "concept-only",
          type: "ai-generated",
          role: "concept",
          sourceUrl: "shin-video://generated-image/concept-only",
          sourceTitle: "概念图",
          sourceDomain: "ai-generation",
          localPath: existingAudioPath,
          fileName: "concept.png",
          mimeType: "image/png",
          attribution: "AI-generated concept image",
          usageRisk: "medium",
          capture: {
            method: "ai-generation",
            capturedAt: "2026-07-13T00:00:00.000Z",
          },
          metadata: {
            evidenceStatus: "concept-only",
            visualTreatment: "full-screen-cinematic-crop",
          },
        },
      ],
      sceneBindings: conceptScenes.map((scene) => ({
        sceneId: scene.id,
        assetIds: ["concept-only"],
        reason: "仅绑定 AI 概念图",
        narrationClaim: scene.subtitle,
      })),
      warnings: [],
    };
    const directorPlan = buildRuntimeDirectorPlan({ scenes: conceptScenes, videoBrief, visualManifest });

    const report = validateProductionGate({
      scenes: conceptScenes,
      captions: conceptScenes.map((scene) => ({ text: scene.subtitle, start: scene.start, end: scene.end })),
      videoBrief,
      visualManifest,
      assetManifest,
      directorPlan,
      styleProfile: defaultStyleProfile,
      audioPath: existingAudioPath,
      ...buildProviderTimelineFixture(conceptScenes),
    });

    expect(report.passed).toBe(true);
    expect(report.errors).toEqual([]);
  });

  test("does not revalidate scene asset bindings before rendering", () => {
    const videoBrief = buildRuntimeVideoBrief({
      topic: "素材绑定完整性测试",
      coreAngle: "绑定必须指向真实资产",
      whyWatch: "避免运行时空画面",
      plainAnswer: "缺失资产必须阻止渲染。",
    });
    const visualManifest = buildVisualManifestFromScenes(scenes);
    const assetManifest = buildAssetManifest(scenes);
    assetManifest.sceneBindings[0].assetIds = ["missing-asset"];
    const directorPlan = buildRuntimeDirectorPlan({ scenes, videoBrief, visualManifest });

    const report = validateProductionGate({
      scenes,
      captions: scenes.map((scene) => ({ text: scene.subtitle, start: scene.start, end: scene.end })),
      videoBrief,
      visualManifest,
      assetManifest,
      directorPlan,
      styleProfile: defaultStyleProfile,
      audioPath: existingAudioPath,
      ...buildProviderTimelineFixture(scenes),
    });

    expect(report.passed).toBe(true);
    expect(report.errors).toEqual([]);
  });

  test("does not revalidate AI asset metadata before rendering", () => {
    const videoBrief = buildRuntimeVideoBrief({
      topic: "AI 资产边界测试",
      coreAngle: "生成图不能伪装成事实素材",
      whyWatch: "避免错误事实暗示",
      plainAnswer: "AI 图必须明确标记为概念图。",
    });
    const conceptScenes = scenes.map((scene) => ({
      ...scene,
      images: ["generated.png"],
    }));
    const visualManifest = buildVisualManifestFromScenes(conceptScenes);
    const assetManifest = buildAssetManifest(conceptScenes);
    assetManifest.assets.push({
      id: "generated-mask",
      type: "image",
      role: "evidence",
      sourceUrl: "shin-video://generated-image/generated-mask",
      sourceDomain: "ai-generation",
      localPath: existingAudioPath,
      fileName: "generated.png",
      mimeType: "image/png",
      attribution: "generated",
      usageRisk: "medium",
      capture: {
        method: "ai-generation",
        capturedAt: "2026-07-13T00:00:00.000Z",
      },
      metadata: {
        evidenceStatus: "concept-only",
        visualTreatment: "layered-parallax",
      },
    });
    assetManifest.sceneBindings[0].assetIds.unshift("generated-mask");
    const directorPlan = buildRuntimeDirectorPlan({ scenes: conceptScenes, videoBrief, visualManifest });

    const report = validateProductionGate({
      scenes: conceptScenes,
      captions: conceptScenes.map((scene) => ({ text: scene.subtitle, start: scene.start, end: scene.end })),
      videoBrief,
      visualManifest,
      assetManifest,
      directorPlan,
      styleProfile: defaultStyleProfile,
      audioPath: existingAudioPath,
      ...buildProviderTimelineFixture(conceptScenes),
    });

    expect(report.passed).toBe(true);
    expect(report.errors).toEqual([]);
  });

  test("does not revalidate AI concept bindings before rendering", () => {
    const videoBrief = buildRuntimeVideoBrief({
      topic: "概念图运行时完整性测试",
      coreAngle: "清单绑定必须真正进入场景",
      whyWatch: "避免空画面和静默降级",
      plainAnswer: "缺图或缺口径必须阻止渲染。",
    });
    const visualManifest = buildVisualManifestFromScenes(scenes);
    const assetManifest = buildAssetManifest(scenes);
    assetManifest.assets.push({
      id: "partial-concept",
      type: "ai-generated",
      role: "concept",
      sourceUrl: "shin-video://generated-image/partial-concept",
      sourceDomain: "ai-generation",
      localPath: existingAudioPath,
      fileName: "partial-concept.png",
      mimeType: "image/png",
      attribution: "generated concept",
      usageRisk: "medium",
      capture: {
        method: "ai-generation",
        capturedAt: "2026-07-13T00:00:00.000Z",
      },
      metadata: {
        evidenceStatus: "concept-only",
        visualTreatment: "partial-crop-beside-real-evidence",
      },
    });
    assetManifest.sceneBindings[0].assetIds.unshift("partial-concept");
    const directorPlan = buildRuntimeDirectorPlan({ scenes, videoBrief, visualManifest });

    const report = validateProductionGate({
      scenes,
      captions: scenes.map((scene) => ({ text: scene.subtitle, start: scene.start, end: scene.end })),
      videoBrief,
      visualManifest,
      assetManifest,
      directorPlan,
      styleProfile: defaultStyleProfile,
      audioPath: existingAudioPath,
      ...buildProviderTimelineFixture(scenes),
    });

    expect(report.passed).toBe(true);
    expect(report.errors).toEqual([]);
  });

  test("counts the generated concept treatment as the final rendered visual form", () => {
    const conceptScenes = Array.from({ length: 6 }, (_, index): Scene => ({
      ...scenes[index % scenes.length],
      id: `concept-form-${index + 1}`,
      start: index * 4,
      end: (index + 1) * 4,
      images: index < 4 ? ["shared-concept.png"] : [],
      sceneType: ["impact-hook", "news-context", "data-breakdown", "relationship-map", "risk-contrast", "summary-card"][index] as Scene["sceneType"],
      directorType: index < 4 ? "SystemMap" : index === 4 ? "Hero" : "Summary",
      rendererFamily: index < 4 ? "relationship-map" : index === 4 ? "hero" : "summary",
      visualTreatment: index < 4 ? "node-network" : index === 4 ? "hero-title" : "closing-summary",
      motionVariant: ["scale-pop", "column-wipe", "line-draw", "type-build", "split-reveal", "underline-sweep"][index] as Scene["motionVariant"],
      shotStyle: ["Burst", "Reveal", "Flow", "Collapse", "Compare", "Resolve"][index] as Scene["shotStyle"],
    }));
    const videoBrief = buildRuntimeVideoBrief({
      topic: "最终视觉形式测试",
      coreAngle: "声明不同不等于最终画面不同",
      whyWatch: "避免同一种概念图形式重复",
      plainAnswer: "按最终渲染形式计数。",
    });
    const visualManifest = buildVisualManifestFromScenes(conceptScenes);
    const assetManifest = buildAssetManifest(conceptScenes);
    assetManifest.assets.push({
      id: "shared-concept",
      type: "ai-generated",
      role: "concept",
      sourceUrl: "shin-video://generated-image/shared-concept",
      sourceDomain: "ai-generation",
      localPath: existingAudioPath,
      fileName: "shared-concept.png",
      mimeType: "image/png",
      attribution: "generated concept",
      usageRisk: "medium",
      capture: {
        method: "ai-generation",
        capturedAt: "2026-07-13T00:00:00.000Z",
      },
      metadata: {
        evidenceStatus: "concept-only",
        visualTreatment: "layered-parallax",
      },
    });
    assetManifest.sceneBindings.slice(0, 4).forEach((binding) => {
      binding.assetIds.unshift("shared-concept");
    });
    const bounds = buildDirectorQualityBounds(conceptScenes.length);
    const directorPlan = buildRuntimeDirectorPlan({
      scenes: conceptScenes,
      videoBrief,
      visualManifest,
      directorQualityTargets: {
        ...bounds,
        requiredForms: bounds.preferredForms,
        requiredFamilies: bounds.preferredFamilies,
      },
    });

    const report = validateProductionGate({
      scenes: conceptScenes,
      captions: conceptScenes.map((scene) => ({ text: scene.subtitle, start: scene.start, end: scene.end })),
      videoBrief,
      visualManifest,
      assetManifest,
      directorPlan,
      styleProfile: defaultStyleProfile,
      audioPath: existingAudioPath,
      ...buildProviderTimelineFixture(conceptScenes),
    });

    expect(report.errors).not.toContain("视觉形式不足：目标 4 种，当前只有 3 种");
    expect(report.errors).not.toContain("concept-form-2 与前一镜头使用了完全相同的视觉形式");
    expect(report.warnings).toEqual([]);
  });

  test("does not repeat specialized scene contract review before rendering", () => {
    const invalidScenes: Scene[] = scenes.map((scene, index) =>
      index === 1
        ? {
            ...scene,
            subtitle: "制程、HBM、软件生态、流片和量产，每一关都很硬。",
            directorType: "BarrierWall",
            rendererFamily: "barrier-wall",
            visualTreatment: "barrier-grid",
            semantics: {
              ...emptySemantics(scene.id),
              barriers: ["制程", "HBM", "软件生态", "流片", "量产"],
              sources: [semanticSource("制程、HBM、软件生态、流片和量产，每一关都很硬。")],
              confidence: {
                ...emptySemantics(scene.id).confidence,
                barriers: 1,
              },
            },
            content: { barriers: [] },
            components: ["ChipBarrierWall"],
          }
        : scene,
    );

    const report = buildGateReport(invalidScenes);
    expect(report.passed).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.issues).toEqual([]);
  });

  test("counts renderer family and treatment, not director names alone", () => {
    const sameForm = Array.from({ length: 6 }, (_, index): Scene => ({
      ...scenes[index % scenes.length],
      id: `same-form-${index + 1}`,
      start: index * 4,
      end: (index + 1) * 4,
      directorType: index % 2 ? "SystemMap" : "DependencyMap",
      rendererFamily: "relationship-map",
      visualTreatment: "node-network",
    }));

    const report = buildGateReport(sameForm);
    expect(report.errors.join("\n")).not.toContain("当前只有 1 种");
    expect(report.warnings).toEqual([]);
  });

  test("does not block rendering on a persisted renderer-family quota", () => {
    const twoFamilies = scenes.map((scene, index): Scene => ({
      ...scene,
      rendererFamily: index % 2 === 0 ? "hero" : "summary",
      visualTreatment: index % 2 === 0 ? "hero-title" : "closing-summary",
      directorType: index % 2 === 0 ? "Hero" : "Summary",
    }));
    const report = buildGateReport(twoFamilies);
    expect(report.errors.join("\n")).not.toContain("目标 3 个渲染家族");
    expect(report.warnings).toEqual([]);
  });

  test("does not block rendering when a director target differs from a canonical formula", () => {
    const bounds = buildDirectorQualityBounds(scenes.length);
    const report = buildGateReport(scenes, undefined, {
      ...bounds,
      minimumForms: 1,
      requiredForms: 1,
      minimumFamilies: 1,
      requiredFamilies: 1,
    });
    expect(report.errors).not.toEqual(
      expect.arrayContaining([
        "director-plan 的视觉形式推荐值或质量底线与标准公式不一致",
        "director-plan 的渲染家族推荐值或质量底线与标准公式不一致",
      ]),
    );
    expect(report.warnings).toEqual([]);
  });

  test("flags one AI concept image reused as full-screen wallpaper for post-render review", () => {
    const repeatedConcept = scenes.slice(0, 3).map((scene, index) => ({
      ...scene,
      id: `wallpaper-${index + 1}`,
      start: index * 4,
      end: (index + 1) * 4,
      images: ["same-concept.png"],
    }));
    const assetManifest = buildAssetManifest(repeatedConcept);
    assetManifest.assets.push({
      id: "same-concept",
      type: "ai-generated",
      role: "concept",
      sourceUrl: "shin-video://generated-image/same-concept",
      localPath: "/tmp/same-concept.png",
      fileName: "same-concept.png",
      mimeType: "image/png",
      attribution: "AI-generated concept",
      usageRisk: "low",
      metadata: {
        evidenceStatus: "concept-only",
        visualTreatment: "full-screen-cinematic-crop",
      },
    });
    assetManifest.sceneBindings.forEach((binding) =>
      binding.assetIds.unshift("same-concept"),
    );

    const report = buildGateReport(repeatedConcept, assetManifest);
    expect(report.errors.join("\n")).not.toContain("全屏静态壁纸");
    expect(report.warnings).toEqual([]);
  });
});
