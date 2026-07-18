import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateTtsAudio: vi.fn(),
  buildSubtitleTimeline: vi.fn(),
  generateScenes: vi.fn(),
  researchAssets: vi.fn(),
  bindAssetsToScenes: vi.fn(),
  writeRuntimeDirectorPlan: vi.fn(),
  writeDirectorReviewArtifacts: vi.fn(),
  buildRuntimeVideoBrief: vi.fn(),
  writeRuntimeVideoBrief: vi.fn(),
  buildVisualManifestFromScenes: vi.fn(),
  writeRuntimeVisualManifest: vi.fn(),
}));

vi.mock("@/lib/tts-dispatcher", () => ({
  generateTtsAudio: mocks.generateTtsAudio,
}));

vi.mock("@/lib/tts-provider", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/tts-provider")>();
  return {
    ...original,
    buildSubtitleTimeline: mocks.buildSubtitleTimeline,
  };
});

vi.mock("@/lib/scene-generator", () => ({
  generateScenes: mocks.generateScenes,
}));

vi.mock("@/lib/asset-researcher", () => ({
  researchAssets: mocks.researchAssets,
  bindAssetsToScenes: mocks.bindAssetsToScenes,
}));

vi.mock("@/lib/director-plan", () => ({
  writeRuntimeDirectorPlan: mocks.writeRuntimeDirectorPlan,
  writeDirectorReviewArtifacts: mocks.writeDirectorReviewArtifacts,
}));

vi.mock("@/lib/video-brief", () => ({
  buildRuntimeVideoBrief: mocks.buildRuntimeVideoBrief,
  writeRuntimeVideoBrief: mocks.writeRuntimeVideoBrief,
}));

vi.mock("@/lib/visual-manifest", () => ({
  buildVisualManifestFromScenes: mocks.buildVisualManifestFromScenes,
  writeRuntimeVisualManifest: mocks.writeRuntimeVisualManifest,
}));

import { POST as archiveProject } from "@/app/api/archive-project/route";
import { POST as generateScenes } from "@/app/api/generate-scenes/route";
import { POST as generateVoiceoverAudio } from "@/app/api/generate-voiceover-audio/route";
import {
  createAudioFingerprint,
  createScriptFingerprint,
} from "@/lib/tts-provider";

const jsonRequest = (body: unknown) =>
  new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const writeTimelineFixture = async (
  outputDir: string,
  script: string,
  source: "provider-native" | "synthetic-dry-run" = "provider-native",
) => {
  const audioPath = path.join(outputDir, "口播音频.mp3");
  const voiceoverPath = path.join(outputDir, "口播文案.md");
  const subtitleTimelinePath = path.join(outputDir, "subtitle-timeline.json");
  await writeFile(audioPath, "provider-native-audio");
  await writeFile(voiceoverPath, `${script}\n`, "utf8");
  const timeline = {
    subtitleTimelineVersion: 1,
    source,
    provider: "minimax",
    audioFingerprint: await createAudioFingerprint(audioPath),
    scriptFingerprint: createScriptFingerprint(script),
    segments: [{
      id: "caption-0001",
      text: script,
      start: 0,
      end: 2,
      timingConfidence: 0.9,
    }],
  };
  await writeFile(subtitleTimelinePath, `${JSON.stringify(timeline)}\n`, "utf8");

  return {
    audioPath,
    voiceoverPath,
    subtitleTimelinePath,
    timeline,
  };
};

describe("provider-native timeline API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateScenes.mockResolvedValue({
      duration: 2,
      scenes: [{
        id: "scene-1",
        start: 0,
        end: 2,
        subtitle: "原生时间轴。",
        images: [],
        emphasis: [],
      }],
      warnings: [],
      materialPackPath: "",
      videoArchetype: "knowledge-explainer",
      creativeBrief: {
        coreMessage: "原生时间轴",
        audience: "测试观众",
        purpose: "验证接口",
        desiredAction: "继续",
      },
      narrativeLayer: {
        structure: {
          opening: "开头",
          turn: "转折",
          proof: "证明",
          reinforcement: "强化",
          closing: "收束",
        },
      },
      directorScript: {},
    });
    mocks.buildRuntimeVideoBrief.mockReturnValue({ topic: "原生时间轴" });
    mocks.buildVisualManifestFromScenes.mockReturnValue({ scenes: [] });
    mocks.researchAssets.mockResolvedValue({ warnings: [], assets: [] });
    mocks.bindAssetsToScenes.mockImplementation((scenes) => scenes);
    mocks.writeRuntimeDirectorPlan.mockResolvedValue({ scenes: [] });
    mocks.writeDirectorReviewArtifacts.mockResolvedValue({
      directorBriefPath: "/tmp/director-brief.md",
      directorScriptPath: "/tmp/director-script.md",
    });
  });

  test("voiceover generation writes and returns the provider-native subtitle timeline", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "shin-api-audio-"));
    const audioResult = {
      provider: "volcengine",
      model: "seed-tts-2.0",
      voiceId: "voice-1",
      audioPath: path.join(outputDir, "口播音频.mp3"),
      voiceoverPath: path.join(outputDir, "口播文案.md"),
      durationMs: 1200,
      timings: [{ text: "原生时间轴", startMs: 0, endMs: 1200, kind: "word" }],
      audioFingerprint: "audio-sha",
      scriptFingerprint: "script-sha",
    };
    const timeline = {
      subtitleTimelineVersion: 1,
      source: "provider-native",
      provider: "volcengine",
      audioFingerprint: "audio-sha",
      scriptFingerprint: "script-sha",
      segments: [{
        id: "caption-0001",
        text: "原生时间轴。",
        start: 0,
        end: 1.2,
        timingConfidence: 0.9,
      }],
    };
    mocks.generateTtsAudio.mockResolvedValue(audioResult);
    mocks.buildSubtitleTimeline.mockResolvedValue(timeline);

    const response = await generateVoiceoverAudio(jsonRequest({
      provider: "volcengine",
      text: "原生时间轴。",
      outputDir,
      voiceId: "voice-1",
    }));
    const body = await response.json();
    const subtitleTimelinePath = path.join(outputDir, "subtitle-timeline.json");

    expect(response.status).toBe(200);
    expect(mocks.generateTtsAudio).toHaveBeenCalledWith({
      provider: "volcengine",
      text: "原生时间轴。",
      outputDir,
      voiceId: "voice-1",
    });
    expect(mocks.buildSubtitleTimeline).toHaveBeenCalledWith({
      provider: "volcengine",
      audioPath: audioResult.audioPath,
      voiceoverPath: audioResult.voiceoverPath,
      timings: audioResult.timings,
    });
    expect(body).toMatchObject({
      provider: "volcengine",
      subtitleTimelinePath,
      subtitleTimeline: timeline,
    });
    await expect(readFile(subtitleTimelinePath, "utf8")).resolves.toBe(
      `${JSON.stringify(timeline, null, 2)}\n`,
    );
  });

  test("scene generation accepts only a complete provider-native timeline", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "shin-api-scenes-"));
    const scenesPath = path.join(outputDir, "scenes.json");
    const directorPlanPath = path.join(outputDir, "director-plan.json");
    const {
      audioPath,
      voiceoverPath,
      subtitleTimelinePath,
    } = await writeTimelineFixture(outputDir, "原生时间轴。");

    const response = await generateScenes(jsonRequest({
      audioSrc: audioPath,
      voiceoverPath,
      subtitleTimelinePath,
      scenesPath,
      directorPlanPath,
    }));

    expect(response.status).toBe(200);
    expect(mocks.generateScenes).toHaveBeenCalledWith(expect.objectContaining({
      timelineSegments: [{
        id: "caption-0001",
        text: "原生时间轴。",
        start: 0,
        end: 2,
      }],
    }));
  });

  test("scene generation rejects a non-provider timeline before generating scenes", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "shin-api-invalid-"));
    const {
      audioPath,
      voiceoverPath,
      subtitleTimelinePath,
    } = await writeTimelineFixture(outputDir, "不能进入正式链路。", "synthetic-dry-run");

    const response = await generateScenes(jsonRequest({
      audioSrc: audioPath,
      voiceoverPath,
      subtitleTimelinePath,
      scenesPath: path.join(outputDir, "scenes.json"),
      directorPlanPath: path.join(outputDir, "director-plan.json"),
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("服务商原生");
    expect(mocks.generateScenes).not.toHaveBeenCalled();
  });

  test("project archive allows a draft with an empty audio package", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "shin-api-archive-"));
    const response = await archiveProject(jsonRequest({
      projectName: "空草稿",
      runPaths: {
        runDir: outputRoot,
      },
    }));
    const body = await response.json();
    const archive = JSON.parse(await readFile(body.archivePath, "utf8"));

    expect(response.status).toBe(200);
    expect(archive).toMatchObject({
      audioPath: "",
      voiceoverPath: "",
      subtitleTimelinePath: "",
    });
  });

  test("project archive persists the complete provider-native audio package", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "shin-api-archive-"));
    const response = await archiveProject(jsonRequest({
      projectName: "原生时间轴存档",
      runPaths: {
        runDir: outputRoot,
      },
      audioPath: "/tmp/audio.mp3",
      voiceoverPath: "/tmp/voiceover.md",
      subtitleTimelinePath: "/tmp/subtitle-timeline.json",
    }));
    const body = await response.json();
    const archive = JSON.parse(await readFile(body.archivePath, "utf8"));

    expect(response.status).toBe(200);
    expect(archive).toMatchObject({
      audioPath: "/tmp/audio.mp3",
      voiceoverPath: "/tmp/voiceover.md",
      subtitleTimelinePath: "/tmp/subtitle-timeline.json",
    });
  });

  test.each([
    { audioPath: "/tmp/audio.mp3" },
    { voiceoverPath: "/tmp/voiceover.md" },
    { subtitleTimelinePath: "/tmp/subtitle-timeline.json" },
    { audioPath: "/tmp/audio.mp3", voiceoverPath: "/tmp/voiceover.md" },
    { audioPath: "/tmp/audio.mp3", subtitleTimelinePath: "/tmp/subtitle-timeline.json" },
    { voiceoverPath: "/tmp/voiceover.md", subtitleTimelinePath: "/tmp/subtitle-timeline.json" },
  ])("project archive rejects a partial provider-native audio package: %o", async (partialPackage) => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "shin-api-archive-partial-"));
    const response = await archiveProject(jsonRequest({
      projectName: "不完整存档",
      runPaths: {
        runDir: outputRoot,
      },
      ...partialPackage,
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("口播音频、确认文案和服务商原生字幕时间轴必须同时提供");
  });
});
