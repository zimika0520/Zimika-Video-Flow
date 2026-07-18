import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { runShinVideoLite } from "@/lib/shin-video-lite";
import { createAudioFingerprint, createScriptFingerprint } from "@/lib/tts-provider";

const tempDirs: string[] = [];

const makeTempDir = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "shin-video-lite-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("shin-video lite one-shot workflow", () => {
  test("preserves an explicitly supplied voiceover file", async () => {
    const outputRoot = await makeTempDir();
    const inputRoot = await makeTempDir();
    const voiceoverPath = path.join(inputRoot, "口播文案.md");
    const exactVoiceover = "这是已经完成配音的口播文案，系统必须逐字保留，不能再次摘要。";
    await writeFile(voiceoverPath, `${exactVoiceover}\n`, "utf8");

    const result = await runShinVideoLite({
      title: "现成口播测试",
      outputRoot,
      dryRun: true,
      article: "这是一篇用于提供背景事实和素材方向的文章，内容不应替换已经配音的口播。",
      voiceoverPath,
      skipRender: true,
    });

    await expect(readFile(result.voiceoverPath, "utf8")).resolves.toBe(`${exactVoiceover}\n`);
  });

  test("creates a complete dry-run production package from article text", async () => {
    const outputRoot = await makeTempDir();
    const result = await runShinVideoLite({
      title: "DeepSeek 自主造芯片",
      outputRoot,
      dryRun: true,
      article: [
        "DeepSeek 自主造芯片的消息，让国产 AI 基础设施再次成为焦点。",
        "这件事真正值得看的地方，不只是芯片本身，而是模型公司开始向算力底层延伸。",
        "如果推理成本继续下降，企业部署大模型的门槛会被重新计算。",
        "但芯片设计、制造、生态适配和供应链验证都不是短期能解决的问题。",
        "所以这条新闻的重点，是国产 AI 公司正在从模型竞争走向系统竞争。",
      ].join(""),
      skipRender: true,
    });

    await expect(readFile(result.voiceoverPath, "utf8")).resolves.toContain("DeepSeek");
    await expect(readFile(result.videoBriefPath, "utf8")).resolves.toContain("videoBriefVersion");
    await expect(readFile(result.scenesPath, "utf8")).resolves.toContain("directorType");
    await expect(readFile(result.scenesPath, "utf8")).resolves.toContain("primaryAsset");
    const subtitleTimeline = JSON.parse(await readFile(result.subtitleTimelinePath, "utf8"));
    expect(subtitleTimeline).toMatchObject({
      subtitleTimelineVersion: 1,
      source: "synthetic-dry-run",
    });
    expect(subtitleTimeline.segments.map((segment: { text: string }) => segment.text).join("")).toContain("DeepSeek");
    await expect(readFile(result.visualManifestPath, "utf8")).resolves.toContain("visualManifestVersion");
    await expect(readFile(result.assetManifestPath, "utf8")).resolves.toContain("assetManifestVersion");
    await expect(readFile(result.assetManifestPath, "utf8")).resolves.not.toContain('"url": "inline-article"');
    await expect(readFile(result.directorPlanPath, "utf8")).resolves.toContain("directorPlanVersion");
    await expect(readFile(result.styleProfilePath, "utf8")).resolves.toContain("styleProfileVersion");
    await expect(readFile(result.productionGateReportPath, "utf8")).resolves.toContain("dry-run");
    await expect(readFile(result.publishingPackPath, "utf8")).resolves.toContain("发布标题");
    await expect(readFile(result.publishingPackPath, "utf8")).resolves.toContain("素材清单");
    const scenes = JSON.parse(await readFile(result.scenesPath, "utf8"));
    expect(scenes.scenes.every((scene: {
      semantics?: { sources: Array<{ kind: string; supportsFacts: boolean }> };
    }) =>
      scene.semantics?.sources.every((source) =>
        source.kind !== "ai-concept" || source.supportsFacts === false,
      ),
    )).toBe(true);
    const evidenceBackedScenes = scenes.scenes.filter(
      (scene: { semantics?: { evidenceRefs: string[] } }) =>
        (scene.semantics?.evidenceRefs.length ?? 0) > 0,
    );
    expect(evidenceBackedScenes.length).toBeGreaterThan(0);
    expect(evidenceBackedScenes.every((scene: {
      semantics?: { sources: Array<{ kind: string; supportsFacts: boolean }> };
    }) =>
      scene.semantics?.sources.some((source) =>
        source.kind === "evidence-record" && source.supportsFacts,
      ),
    )).toBe(true);
    expect(result.finalPath).toBeUndefined();
  });

  test("rejects an external audio file without a matching provider-native timeline", async () => {
    const outputRoot = await makeTempDir();
    const inputRoot = await makeTempDir();
    const audioPath = path.join(inputRoot, "voice.mp3");
    const voiceoverPath = path.join(inputRoot, "口播文案.md");
    await writeFile(audioPath, "audio-v1");
    await writeFile(voiceoverPath, "外部音频也必须携带同次 TTS 返回的时间轴。\n", "utf8");

    await expect(runShinVideoLite({
      title: "外部音频缺时间轴",
      outputRoot,
      article: "这是一篇用于验证外部音频门禁的文章。",
      voiceoverPath,
      audioPath,
      skipRender: true,
    })).rejects.toThrow("时间轴");
  });

  test("rejects a stale external timeline whose audio fingerprint does not match", async () => {
    const outputRoot = await makeTempDir();
    const inputRoot = await makeTempDir();
    const audioPath = path.join(inputRoot, "voice.mp3");
    const voiceoverPath = path.join(inputRoot, "口播文案.md");
    const subtitleTimelinePath = path.join(inputRoot, "subtitle-timeline.json");
    const script = "外部音频和时间轴必须来自同一次 TTS 请求。";
    await writeFile(audioPath, "audio-v1");
    await writeFile(voiceoverPath, `${script}\n`, "utf8");
    await writeFile(
      subtitleTimelinePath,
      `${JSON.stringify({
        subtitleTimelineVersion: 1,
        source: "provider-native",
        provider: "custom",
        audioFingerprint: await createAudioFingerprint(audioPath),
        scriptFingerprint: createScriptFingerprint(script),
        segments: [
          {
            id: "caption-0001",
            text: script,
            start: 0,
            end: 1,
            timingConfidence: 0.75,
          },
        ],
      }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(audioPath, "audio-v2");

    await expect(runShinVideoLite({
      title: "外部时间轴失效",
      outputRoot,
      article: "这是一篇用于验证时间轴指纹的文章。",
      voiceoverPath,
      audioPath,
      subtitleTimelinePath,
      skipRender: true,
    })).rejects.toThrow("音频指纹");
  });

  test("threads a generated image manifest through dry-run artifacts without treating a local article path as a URL", async () => {
    const outputRoot = await makeTempDir();
    const inputRoot = await makeTempDir();
    const articlePath = path.join(inputRoot, "article.md");
    const generatedImageManifestPath = path.join(inputRoot, "generated-image-manifest.json");
    await mkdir(path.join(inputRoot, "images"), { recursive: true });
    await writeFile(
      articlePath,
      [
        "# DeepSeek 芯片概念图接入测试",
        "DeepSeek 自主造芯片的消息，让国产 AI 基础设施再次成为焦点。",
        "真正值得看的，是模型公司开始向算力底层延伸。",
      ].join("\n"),
      "utf8",
    );
    await writeFile(path.join(inputRoot, "images", "opening-concept.png"), "concept-image");
    await writeFile(
      generatedImageManifestPath,
      JSON.stringify({
        manifestVersion: 1,
        images: [
          {
            id: "opening-concept",
            fileName: "opening-concept.png",
            model: "gpt-image-2",
            prompt: "A cinematic concept image for an AI inference chip.",
            requestedSize: { width: 1920, height: 1088, preset: "1k" },
            actualSize: { width: 1672, height: 941 },
            role: "opening-concept",
            evidenceStatus: "concept-only",
            visualTreatment: "full-screen-cinematic-crop",
            boundSceneIds: ["scene-0001", "scene-0002"],
            requestRecord: "generation-records/opening.request.json",
            responseRecord: "generation-records/opening.response.json",
          },
        ],
      }),
      "utf8",
    );

    const result = await runShinVideoLite({
      title: "DeepSeek 芯片概念图接入测试",
      outputRoot,
      dryRun: true,
      articlePath,
      generatedImageManifestPath,
      skipRender: true,
    });

    const assetManifest = JSON.parse(await readFile(result.assetManifestPath, "utf8"));
    const scenes = JSON.parse(await readFile(result.scenesPath, "utf8"));
    const visualManifest = JSON.parse(await readFile(result.visualManifestPath, "utf8"));
    const directorPlan = JSON.parse(await readFile(result.directorPlanPath, "utf8"));

    expect(assetManifest.assets).toContainEqual(expect.objectContaining({
      id: "opening-concept",
      type: "ai-generated",
      role: "concept",
    }));
    expect(assetManifest.evidenceRecords).not.toContainEqual(expect.objectContaining({ id: "opening-concept" }));
    expect(assetManifest.sourcePages[0].url).toMatch(/^shin-video:\/\/article\//);
    expect(assetManifest.sourcePages[0].url).not.toBe(articlePath);
    expect(scenes.scenes.slice(0, 2).every((scene: { images: string[] }) =>
      scene.images[0] === "opening-concept.png"
      && scene.images.some((image) => image !== "opening-concept.png"),
    )).toBe(true);
    expect(visualManifest.scenes[0].primaryVisualAsset).toBe("opening-concept.png");
    expect(visualManifest.scenes[0].evidenceAsset).not.toBe("opening-concept.png");
    expect(directorPlan.scenes[0].images[0]).toBe("opening-concept.png");
    expect(scenes.scenes.every((scene: {
      semantics?: { sources: Array<{ kind: string; supportsFacts: boolean }> };
    }) =>
      scene.semantics?.sources.every((source) =>
        source.kind !== "ai-concept" || source.supportsFacts === false,
      ),
    )).toBe(true);
    const conceptBackedScenes = scenes.scenes.filter(
      (scene: {
        semantics?: { sources: Array<{ kind: string; supportsFacts: boolean }> };
      }) => scene.semantics?.sources.some((source) => source.kind === "ai-concept"),
    );
    expect(conceptBackedScenes.length).toBeGreaterThan(0);
    expect(conceptBackedScenes.every((scene: {
      semantics?: { sources: Array<{ kind: string; supportsFacts: boolean }> };
    }) =>
      scene.semantics?.sources.some((source) =>
        source.kind === "ai-concept" && source.supportsFacts === false,
      ),
    )).toBe(true);
  });
});
