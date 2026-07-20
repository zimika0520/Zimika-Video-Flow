import { mkdtempSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { assertDirectorPlanMatchesScenes, buildRuntimeDirectorPlan, readRuntimeDirectorPlan, writeDirectorReviewArtifacts, writeRuntimeDirectorPlan } from "@/lib/director-plan";
import type { Scene } from "@/lib/types";
import { buildVisualManifestFromScenes } from "@/lib/visual-manifest";

describe("runtime director plans", () => {
  const baseScene: Scene = {
    id: "scene-1",
    start: 0,
    end: 4,
    subtitle: "第一段",
    images: [],
    layout: "title",
  };

  test("rejects rendering when RUN_DIR/director-plan.json is missing", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-director-missing-"));

    await expect(readRuntimeDirectorPlan(join(root, "runtime", "director-plan.json"))).rejects.toThrow(
      "RUN_DIR/director-plan.json 缺失",
    );
  });

  test("reads Remotion director fields from RUN_DIR/director-plan.json", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-director-"));
    const directorPlanPath = join(root, "runtime", "director-plan.json");
    await mkdir(join(root, "runtime"), { recursive: true });
    await writeFile(
      directorPlanPath,
      JSON.stringify(
        {
          directorPlanVersion: 1,
          creativeBrief: { topic: "Hy3", promise: "解释真实升级" },
          narrativeArc: { opening: "开场", proof: "证明", closing: "收束" },
          attentionCurve: [{ range: "0-10", label: "吸引", intensity: 88 }],
          peakMoments: [{ sceneId: "scene-1", reason: "记忆帧", intensity: 90 }],
          scenes: [
            {
              id: "scene-1",
              directorType: "Hero",
              shotStyle: "Reveal",
              importance: 10,
              animation: { cameraMotion: "dollyIn" },
            },
          ],
        },
        null,
        2,
      ),
    );

    const plan = await readRuntimeDirectorPlan(directorPlanPath);

    expect(plan.directorPlanVersion).toBe(1);
    expect(plan.videoDirectorWorkflow).toMatchObject({
      sourceSkill: "bayramannakov/remotion-video-director",
      adaptedPhases: ["Think", "Design", "Build", "Review"],
      sceneFocusRule: "one-scene-one-idea",
      expertReviewProtocol: [
        "director",
        "information-design",
        "motion-design",
        "caption-safety",
        "audience-comprehension",
      ],
    });
    expect(plan.remotionExecutionContract).toMatchObject({
      rendererRole: "execute-director-plan",
      subtitleSystem: "audio-timeline-independent",
      mainVisualPolicy: "explain-not-repeat-caption",
      requiredInputs: [
        "RUN_DIR/video-brief.json",
        "RUN_DIR/scenes.json",
        "RUN_DIR/asset-manifest.json",
        "RUN_DIR/visual-manifest.json",
        "RUN_DIR/director-plan.json",
        "RUN_DIR/style-profile.json",
        "RUN_DIR/subtitle-timeline.json",
        "口播音频.mp3",
      ],
      requiredOutputs: ["<项目目录>/<视频标题>.mp4"],
    });
    expect(plan.scenes[0]).toMatchObject({
      id: "scene-1",
      directorType: "Hero",
      shotStyle: "Reveal",
      importance: 10,
      animation: { cameraMotion: "dollyIn" },
    });
  });

  test("writes director review artifacts alongside runtime director plan", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-director-artifacts-"));
    const directorPlanPath = join(root, "runtime", "director-plan.json");

    await writeRuntimeDirectorPlan(directorPlanPath, {
      scenes: [
        {
          id: "scene-1",
          start: 0,
          end: 4,
          subtitle: "第一段",
          images: [],
          layout: "title",
          directorType: "Hero",
          shotStyle: "Burst",
          importance: 10,
          narrativeRole: "opening",
          role: "memory",
          animation: {
            entranceAnimation: "kineticPop",
            emphasisAnimation: "pulseGlow",
            transitionAnimation: "flowMerge",
            cameraMotion: "dollyIn",
          },
          background: {
            backgroundType: "Gradient",
            backgroundMotion: "slowDrift",
            backgroundRole: "emotional",
          },
          components: ["HeroTitle"],
          content: { headline: "开场重点", keywords: ["重点"] },
        },
      ],
      narrativeLayer: {
        structure: {
          opening: "开场重点",
          turn: "过渡",
          proof: "证明",
          reinforcement: "强化",
          closing: "收束",
        },
        attentionCurve: [{ range: "0-10", label: "吸引", intensity: 88 }],
        peakMoments: [{ sceneId: "scene-1", reason: "记忆帧", intensity: 5 }],
      },
      videoArchetype: "event-breakdown",
      creativeBrief: {
        archetype: "event-breakdown",
        purpose: "解释事件升级点",
        audience: "短视频观众",
        coreMessage: "开场 -> 证明 -> 收束",
        desiredAction: "看懂事件",
        durationSeconds: 4,
        estimatedSceneCount: 1,
        emotionalArc: "吸引 -> 收束",
        creativeDirection: {
          tone: "urgent",
          pacing: "dynamic",
          visualStrategy: "开场抓重点",
          subtitlePolicy: "字幕跟随音频",
          evidencePolicy: "优先事实",
        },
      },
      directorScript: {
        directorScriptVersion: 1,
        videoArchetype: "event-breakdown",
        creativeBrief: {
          archetype: "event-breakdown",
          purpose: "解释事件升级点",
          audience: "短视频观众",
          coreMessage: "开场 -> 证明 -> 收束",
          desiredAction: "看懂事件",
          durationSeconds: 4,
          estimatedSceneCount: 1,
          emotionalArc: "吸引 -> 收束",
          creativeDirection: {
            tone: "urgent",
            pacing: "dynamic",
            visualStrategy: "开场抓重点",
            subtitlePolicy: "字幕跟随音频",
            evidencePolicy: "优先事实",
          },
        },
        reviewChecklist: ["不要重复字幕"],
        scenes: [
          {
            id: "scene-1",
            start: 0,
            end: 4,
            duration: 4,
            timeRange: "0.00s - 4.00s",
            purpose: "抓住注意力",
            coreIdea: "开场重点",
            informationFunction: "hook",
            directorType: "Hero",
            shotStyle: "Burst",
            mainVisualRole: "建立记忆帧",
            onScreenKeywords: ["重点"],
            motionSuggestion: "kineticPop + pulseGlow + dollyIn",
            avoid: "不要重复整句字幕",
          },
        ],
      },
    });

    const artifacts = await writeDirectorReviewArtifacts(directorPlanPath, {
      videoArchetype: "event-breakdown",
      creativeBrief: {
        archetype: "event-breakdown",
        purpose: "解释事件升级点",
        audience: "短视频观众",
        coreMessage: "开场 -> 证明 -> 收束",
        desiredAction: "看懂事件",
        durationSeconds: 4,
        estimatedSceneCount: 1,
        emotionalArc: "吸引 -> 收束",
        creativeDirection: {
          tone: "urgent",
          pacing: "dynamic",
          visualStrategy: "开场抓重点",
          subtitlePolicy: "字幕跟随音频",
          evidencePolicy: "优先事实",
        },
      },
      directorScript: {
        directorScriptVersion: 1,
        videoArchetype: "event-breakdown",
        creativeBrief: {
          archetype: "event-breakdown",
          purpose: "解释事件升级点",
          audience: "短视频观众",
          coreMessage: "开场 -> 证明 -> 收束",
          desiredAction: "看懂事件",
          durationSeconds: 4,
          estimatedSceneCount: 1,
          emotionalArc: "吸引 -> 收束",
          creativeDirection: {
            tone: "urgent",
            pacing: "dynamic",
            visualStrategy: "开场抓重点",
            subtitlePolicy: "字幕跟随音频",
            evidencePolicy: "优先事实",
          },
        },
        reviewChecklist: ["不要重复字幕"],
        scenes: [
          {
            id: "scene-1",
            start: 0,
            end: 4,
            duration: 4,
            timeRange: "0.00s - 4.00s",
            purpose: "抓住注意力",
            coreIdea: "开场重点",
            informationFunction: "hook",
            directorType: "Hero",
            shotStyle: "Burst",
            mainVisualRole: "建立记忆帧",
            onScreenKeywords: ["重点"],
            motionSuggestion: "kineticPop + pulseGlow + dollyIn",
            avoid: "不要重复整句字幕",
          },
        ],
      },
    });

    const brief = JSON.parse(await readFile(artifacts.directorBriefPath, "utf8"));
    const script = await readFile(artifacts.directorScriptPath, "utf8");

    expect(brief.videoArchetype).toBe("event-breakdown");
    expect(brief.creativeBrief.purpose).toBe("解释事件升级点");
    expect(brief.videoDirectorWorkflow.sourceSkill).toBe("bayramannakov/remotion-video-director");
    expect(script).toContain("Shin-video 导演审阅稿");
    expect(script).toContain("remotion-video-director 方法");
    expect(script).toContain("不要重复整句字幕");
  });

  test("binds director plan to the current scenes before rendering", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-director-fingerprint-"));
    const directorPlanPath = join(root, "runtime", "director-plan.json");
    const plan = await writeRuntimeDirectorPlan(directorPlanPath, {
      scenes: [baseScene],
    });

    expect(plan.sourceScenesFingerprint).toBeTruthy();
    expect(() => assertDirectorPlanMatchesScenes(plan, [baseScene])).not.toThrow();
    expect(() =>
      assertDirectorPlanMatchesScenes(plan, [
        {
          ...baseScene,
          subtitle: "这是一段已经变化的口播字幕",
        },
      ]),
    ).toThrow("请先根据当前口播、素材和时间轴重新生成导演视觉系统");
  });

  test("does not count a concept-only primary visual as an evidence scene", () => {
    const conceptScene: Scene = {
      ...baseScene,
      images: ["concept.png"],
      primaryVisualAsset: "concept.png",
    };
    const visualManifest = buildVisualManifestFromScenes([conceptScene]);
    const plan = buildRuntimeDirectorPlan({
      scenes: [conceptScene],
      visualManifest,
    });

    expect(visualManifest.scenes[0].primaryVisualAsset).toBe("concept.png");
    expect(visualManifest.scenes[0].evidenceAsset).toBeUndefined();
    expect(plan.visualManifestSummary?.scenesWithEvidenceAssets).toBe(0);
  });

  test("passes visual-manifest safe zones into the matching director scene", () => {
    const visualManifest = buildVisualManifestFromScenes([baseScene]);
    visualManifest.scenes[0].safeZones = {
      subtitle: "bottom",
      mainVisualAvoidsSubtitle: true,
    };

    const plan = buildRuntimeDirectorPlan({
      scenes: [baseScene],
      visualManifest,
    });

    expect(plan.scenes[0].safeZones).toEqual(
      visualManifest.scenes[0].safeZones,
    );
  });
});
