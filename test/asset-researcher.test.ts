import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { bindAssetsToScenes, extractAssetQueries, researchAssets } from "@/lib/asset-researcher";
import type { RuntimeVideoBrief, RuntimeVisualManifest, Scene } from "@/lib/types";

const tempDirs: string[] = [];

const makeTempDir = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "shin-video-assets-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const brief: RuntimeVideoBrief = {
  videoBriefVersion: 1,
  topic: "DeepSeek 自主造芯片",
  audience: "科技财经短视频观众",
  coreAngle: "模型公司开始向算力底层延伸",
  whyWatch: "看懂 AI 公司为什么要碰芯片",
  viewerDoubt: "这件事到底是不是噱头？",
  plainAnswer: "重点不是芯片本身，而是算力成本和产业分工。",
  hook: {
    firstThreeSeconds: "DeepSeek 自主造芯片，让 AI 基础设施再次成为焦点。",
    viewerReasonToContinue: "后面拆解它的产业含义。",
  },
  narrativeArc: {
    opening: "事件出现",
    turn: "从模型转向算力",
    proof: "成本、生态和供应链验证",
    reinforcement: "系统竞争",
    closing: "看长期兑现",
  },
  proofPoints: ["AI", "芯片", "算力"],
  assetNeeds: ["公司标识", "芯片示意", "产业链关系图"],
  visualDirection: {
    density: "rich",
    mustAvoid: ["PPT化", "主画面复读字幕"],
  },
  subtitleStrategy: {
    timingSource: "provider-native",
    textSource: "voiceover-script",
    alignmentMethod: "map-confirmed-script-to-provider-timestamps",
    lineSubtitles: {
      maxCharsPerLine: 18,
      maxLines: 2,
      keepSentenceComplete: true,
    },
    safeZones: {
      position: "bottom",
      bottomPaddingPx: 72,
      avoidMainVisualOverlap: true,
    },
    qa: [
      "provider-timestamps-do-not-rewrite-subtitle-text",
      "audio-change-invalidates-subtitle-timeline",
      "subtitle-follows-audio-not-scene-card",
      "complete-sentence-before-cut",
    ],
  },
  productionGate: {
    requireVisualManifest: true,
    requireFinalAudioTiming: true,
    requireDirectorPlan: true,
    requireStyleProfile: true,
    minimumVisualRecipes: 3,
    minimumDirectorTypes: 4,
  },
  requiredOutputs: ["final-video", "publishing-pack"],
};

const scenes: Scene[] = [
  {
    id: "scene-001",
    start: 0,
    end: 5,
    subtitle: "DeepSeek 自主造芯片，让 AI 基础设施再次成为焦点。",
    images: [],
    layout: "title",
  },
  {
    id: "scene-002",
    start: 5,
    end: 10,
    subtitle: "这件事的重点，是模型公司开始向算力底层延伸。",
    images: [],
    layout: "single-image",
  },
];

const visualManifest: RuntimeVisualManifest = {
  visualManifestVersion: 1,
  scenes: scenes.map((scene) => ({
    sceneId: scene.id,
    visualGoal: `为 ${scene.id} 提供可视化证据`,
    narrationClaim: scene.subtitle,
    targetRegion: {
      coordinateSpace: "normalized_frame",
      description: "主视觉区域",
    },
    safeZones: {
      subtitle: "bottom",
      mainVisualAvoidsSubtitle: true,
    },
    overlapRisks: ["字幕遮挡主视觉"],
    forbiddenReuse: ["同一版式连续复用"],
    whyThisVisual: "用于解释口播观点，而不是复读字幕。",
  })),
};

describe("asset researcher", () => {
  test("extracts topic and proof-point queries", () => {
    expect(extractAssetQueries("DeepSeek 自主造芯片", "AI 芯片 算力 成本", brief)).toEqual(
      expect.arrayContaining(["DeepSeek 自主造芯片", "AI", "芯片"]),
    );
  });

  test("creates a dry-run asset manifest and binds assets to scenes", async () => {
    const dir = await makeTempDir();
    const manifestPath = path.join(dir, "asset-manifest.json");

    const manifest = await researchAssets({
      title: "DeepSeek 自主造芯片",
      article: "DeepSeek 自主造芯片，AI 算力和供应链成为焦点。",
      sourceUrl: "https://example.com/deepseek-chip",
      videoBrief: brief,
      visualManifest,
      scenes,
      assetManifestPath: manifestPath,
      dryRun: true,
    });

    expect(manifest.assetManifestVersion).toBe(1);
    expect(manifest.sourceMode).toBe("dry-run");
    expect(manifest.evidenceRecords?.some((record) => record.kind === "source-text")).toBe(true);
    expect(manifest.evidenceRecords?.some((record) => record.kind === "source-excerpt")).toBe(true);
    expect(manifest.assets.length).toBeGreaterThan(0);
    expect(manifest.assets.some((asset) => asset.type === "evidence-card")).toBe(true);
    expect(manifest.sourcePages.length).toBeGreaterThan(0);
    expect(manifest.sceneBindings).toHaveLength(scenes.length);
    const firstSvgAsset = manifest.assets.find((asset) => asset.mimeType === "image/svg+xml");
    expect(firstSvgAsset).toBeTruthy();
    await expect(readFile(firstSvgAsset?.localPath ?? "", "utf8")).resolves.toContain("<svg");
    await expect(readFile(manifestPath, "utf8")).resolves.toContain("assetManifestVersion");
    await expect(readFile(manifestPath, "utf8")).resolves.toContain("evidenceRecords");

    const boundScenes = bindAssetsToScenes(scenes, manifest);
    expect(boundScenes[0].images.length).toBeGreaterThan(0);
    expect(boundScenes[0].visualModules).toContain("assets");
    expect(boundScenes[0].primaryAsset).toBe(manifest.assets[0].fileName);
  });

  test("merges concept images and binds them only to declared scenes without creating evidence", async () => {
    const dir = await makeTempDir();
    const manifestPath = path.join(dir, "generated-image-manifest.json");
    const imageDir = path.join(dir, "images");
    const assetManifestPath = path.join(dir, "runtime", "asset-manifest.json");
    await mkdir(imageDir, { recursive: true });
    await writeFile(path.join(imageDir, "chip-concept.png"), "concept-image");
    await writeFile(
      manifestPath,
      JSON.stringify({
        manifestVersion: 1,
        sampleId: "deepseek-chip",
        images: [
          {
            id: "chip-concept",
            fileName: "chip-concept.png",
            model: "gpt-image-2",
            prompt: "A concept image of an inference chip.",
            requestedSize: { width: 1920, height: 1088, preset: "1k" },
            actualSize: { width: 1672, height: 941 },
            role: "opening-concept",
            evidenceStatus: "concept-only",
            visualTreatment: "layered-parallax",
            boundSceneIds: ["scene-002"],
            requestRecord: "generation-records/chip.request.json",
            responseRecord: "generation-records/chip.response.json",
            acceptanceStatus: "accepted",
          },
        ],
      }),
      "utf8",
    );

    const manifest = await researchAssets({
      title: "DeepSeek 自主造芯片",
      article: "DeepSeek 自主造芯片，AI 算力和供应链成为焦点。",
      videoBrief: brief,
      visualManifest,
      scenes,
      assetManifestPath,
      generatedImageManifestPath: manifestPath,
      dryRun: true,
    });

    const conceptAsset = manifest.assets.find((asset) => asset.id === "chip-concept");
    expect(conceptAsset).toMatchObject({
      type: "ai-generated",
      role: "concept",
      fileName: "chip-concept.png",
      capture: {
        method: "ai-generation",
      },
      metadata: {
        model: "gpt-image-2",
        prompt: "A concept image of an inference chip.",
        requestedSize: { width: 1920, height: 1088, preset: "1k" },
        actualSize: { width: 1672, height: 941 },
        evidenceStatus: "concept-only",
        visualTreatment: "layered-parallax",
        acceptanceStatus: "accepted",
      },
    });
    expect(manifest.evidenceRecords?.some((record) => record.id === "chip-concept")).toBe(false);
    expect(manifest.sceneBindings.find((binding) => binding.sceneId === "scene-001")?.assetIds).not.toContain("chip-concept");
    expect(manifest.sceneBindings.find((binding) => binding.sceneId === "scene-002")?.assetIds[0]).toBe("chip-concept");

    const boundScenes = bindAssetsToScenes(scenes, manifest);
    expect(boundScenes[0].images).not.toContain("chip-concept.png");
    expect(boundScenes[1].images[0]).toBe("chip-concept.png");
    expect(boundScenes[1].images.length).toBeGreaterThan(1);
    expect(boundScenes[1].primaryVisualAsset).toBe("chip-concept.png");
    expect(boundScenes[1].evidenceAsset).not.toBe("chip-concept.png");
  });

  test("rejects generated images with duplicate ids", async () => {
    const dir = await makeTempDir();
    const manifestPath = path.join(dir, "generated-image-manifest.json");
    await mkdir(path.join(dir, "images"), { recursive: true });
    await writeFile(path.join(dir, "images", "first.png"), "first");
    await writeFile(path.join(dir, "images", "second.png"), "second");
    await writeFile(
      manifestPath,
      JSON.stringify({
        images: [
          {
            id: "duplicate-concept",
            fileName: "first.png",
            model: "gpt-image-2",
            prompt: "First concept.",
            requestedSize: { width: 1920, height: 1088 },
            actualSize: { width: 1672, height: 941 },
            role: "concept",
            evidenceStatus: "concept-only",
            visualTreatment: "layered-parallax",
            boundSceneIds: ["scene-001"],
            requestRecord: "first.request.json",
            responseRecord: "first.response.json",
          },
          {
            id: "duplicate-concept",
            fileName: "second.png",
            model: "gpt-image-2",
            prompt: "Second concept.",
            requestedSize: { width: 1920, height: 1088 },
            actualSize: { width: 1672, height: 941 },
            role: "concept",
            evidenceStatus: "concept-only",
            visualTreatment: "layered-parallax",
            boundSceneIds: ["scene-002"],
            requestRecord: "second.request.json",
            responseRecord: "second.response.json",
          },
        ],
      }),
      "utf8",
    );

    await expect(
      researchAssets({
        title: "重复 id",
        article: "测试重复生成图片 id。",
        videoBrief: brief,
        visualManifest,
        scenes,
        assetManifestPath: path.join(dir, "runtime", "asset-manifest.json"),
        generatedImageManifestPath: manifestPath,
        dryRun: true,
      }),
    ).rejects.toThrow(/id.*冲突.*duplicate-concept/);
  });

  test("rejects generated images with duplicate file names", async () => {
    const dir = await makeTempDir();
    const manifestPath = path.join(dir, "generated-image-manifest.json");
    await mkdir(path.join(dir, "images"), { recursive: true });
    await writeFile(path.join(dir, "images", "duplicate.png"), "concept");
    await writeFile(
      manifestPath,
      JSON.stringify({
        images: [
          {
            id: "first-concept",
            fileName: "duplicate.png",
            model: "gpt-image-2",
            prompt: "First concept.",
            requestedSize: { width: 1920, height: 1088 },
            actualSize: { width: 1672, height: 941 },
            role: "concept",
            evidenceStatus: "concept-only",
            visualTreatment: "layered-parallax",
            boundSceneIds: ["scene-001"],
            requestRecord: "first.request.json",
            responseRecord: "first.response.json",
          },
          {
            id: "second-concept",
            fileName: "duplicate.png",
            model: "gpt-image-2",
            prompt: "Second concept.",
            requestedSize: { width: 1920, height: 1088 },
            actualSize: { width: 1672, height: 941 },
            role: "concept",
            evidenceStatus: "concept-only",
            visualTreatment: "layered-parallax",
            boundSceneIds: ["scene-002"],
            requestRecord: "second.request.json",
            responseRecord: "second.response.json",
          },
        ],
      }),
      "utf8",
    );

    await expect(
      researchAssets({
        title: "重复文件名",
        article: "测试重复生成图片文件名。",
        videoBrief: brief,
        visualManifest,
        scenes,
        assetManifestPath: path.join(dir, "runtime", "asset-manifest.json"),
        generatedImageManifestPath: manifestPath,
        dryRun: true,
      }),
    ).rejects.toThrow(/文件名.*冲突.*duplicate\.png/);
  });

  test("rejects generated images that are not concept-only", async () => {
    const dir = await makeTempDir();
    const manifestPath = path.join(dir, "generated-image-manifest.json");
    await mkdir(path.join(dir, "images"), { recursive: true });
    await writeFile(path.join(dir, "images", "invalid.png"), "invalid-image");
    await writeFile(
      manifestPath,
      JSON.stringify({
        images: [
          {
            id: "invalid-evidence",
            fileName: "invalid.png",
            model: "gpt-image-2",
            prompt: "Invalid factual image.",
            requestedSize: { width: 1920, height: 1088 },
            actualSize: { width: 1672, height: 941 },
            role: "evidence",
            evidenceStatus: "verified",
            visualTreatment: "full-screen-cinematic-crop",
            boundSceneIds: ["scene-001"],
            requestRecord: "invalid.request.json",
            responseRecord: "invalid.response.json",
          },
        ],
      }),
      "utf8",
    );

    await expect(
      researchAssets({
        title: "DeepSeek 自主造芯片",
        article: "DeepSeek 自主造芯片，AI 算力和供应链成为焦点。",
        videoBrief: brief,
        visualManifest,
        scenes,
        assetManifestPath: path.join(dir, "runtime", "asset-manifest.json"),
        generatedImageManifestPath: manifestPath,
        dryRun: true,
      }),
    ).rejects.toThrow(/evidenceStatus.*concept-only/);
  });

  test("rejects generated image bindings to unknown scenes", async () => {
    const dir = await makeTempDir();
    const manifestPath = path.join(dir, "generated-image-manifest.json");
    await mkdir(path.join(dir, "images"), { recursive: true });
    await writeFile(path.join(dir, "images", "unknown-scene.png"), "concept-image");
    await writeFile(
      manifestPath,
      JSON.stringify({
        images: [
          {
            id: "unknown-scene-concept",
            fileName: "unknown-scene.png",
            model: "gpt-image-2",
            prompt: "Concept image.",
            requestedSize: { width: 1920, height: 1088 },
            actualSize: { width: 1672, height: 941 },
            role: "concept",
            evidenceStatus: "concept-only",
            visualTreatment: "foreground-subject-plus-motion-graphics",
            boundSceneIds: ["scene-999"],
            requestRecord: "unknown.request.json",
            responseRecord: "unknown.response.json",
          },
        ],
      }),
      "utf8",
    );

    await expect(
      researchAssets({
        title: "DeepSeek 自主造芯片",
        article: "DeepSeek 自主造芯片，AI 算力和供应链成为焦点。",
        videoBrief: brief,
        visualManifest,
        scenes,
        assetManifestPath: path.join(dir, "runtime", "asset-manifest.json"),
        generatedImageManifestPath: manifestPath,
        dryRun: true,
      }),
    ).rejects.toThrow(/scene-999.*不存在/);
  });
});
