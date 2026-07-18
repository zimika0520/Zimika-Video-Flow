import { dirname } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { errorJson, okJson, readJsonBody } from "@/lib/api-response";
import { bindAssetsToScenes, researchAssets } from "@/lib/asset-researcher";
import { writeDirectorReviewArtifacts, writeRuntimeDirectorPlan } from "@/lib/director-plan";
import { generateScenes } from "@/lib/scene-generator";
import {
  parseProviderNativeSubtitleTimeline,
  validateSubtitleTimelineFiles,
  type ProviderNativeSubtitleTimeline,
} from "@/lib/tts-provider";
import { buildRuntimeVideoBrief, writeRuntimeVideoBrief } from "@/lib/video-brief";
import { buildVisualManifestFromScenes, writeRuntimeVisualManifest } from "@/lib/visual-manifest";

const readTextIfPresent = async (filePath?: string): Promise<string | undefined> => {
  if (!filePath) return undefined;
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
};

const readProviderNativeTimeline = async (
  subtitleTimelinePath: string,
): Promise<ProviderNativeSubtitleTimeline> => {
  return parseProviderNativeSubtitleTimeline(
    JSON.parse(await readFile(subtitleTimelinePath, "utf8")),
  );
};

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{
      materialPackPath?: string;
      voiceoverPath?: string;
      subtitleTimelinePath?: string;
      videoBriefPath?: string;
      scenesPath?: string;
      visualManifestPath?: string;
      assetManifestPath?: string;
      directorPlanPath?: string;
      audioSrc?: string;
    }>(request);

    if (
      !body.subtitleTimelinePath
      || !body.voiceoverPath
      || !body.audioSrc
      || !body.scenesPath
      || !body.directorPlanPath
    ) {
      return errorJson("缺少口播音频、确认文案、服务商原生字幕时间轴或 scenes 输出路径");
    }

    const subtitleTimeline = await readProviderNativeTimeline(body.subtitleTimelinePath);
    await validateSubtitleTimelineFiles({
      timeline: subtitleTimeline,
      audioPath: body.audioSrc,
      voiceoverPath: body.voiceoverPath,
    });
    const timelineSegments = subtitleTimeline.segments.map((segment) => ({
      id: segment.id,
      text: segment.text,
      start: segment.start,
      end: segment.end,
    }));
    const result = await generateScenes({
      materialPackPath: body.materialPackPath || undefined,
      voiceoverPath: body.voiceoverPath || undefined,
      timelineSegments,
      scenesPath: body.scenesPath,
      audioSrc: body.audioSrc,
    });
    const videoBrief = buildRuntimeVideoBrief({
      topic: result.creativeBrief?.coreMessage ?? result.scenes[0]?.title ?? "口播视频",
      audience: result.creativeBrief?.audience,
      coreAngle: result.creativeBrief?.coreMessage ?? "用导演镜头讲清楚文章核心变化",
      whyWatch: result.creativeBrief?.purpose ?? "快速看懂这件事的关键事实与判断",
      plainAnswer: result.creativeBrief?.desiredAction ?? "用证据、数据和结构化画面降低理解成本。",
      narrativeArc: {
        opening: result.narrativeLayer?.structure.opening,
        turn: result.narrativeLayer?.structure.turn,
        proof: result.narrativeLayer?.structure.proof,
        reinforcement: result.narrativeLayer?.structure.reinforcement,
        closing: result.narrativeLayer?.structure.closing,
      },
      proofPoints: result.scenes.flatMap((scene) => scene.emphasis ?? []).slice(0, 8),
      assetNeeds: result.materialPackPath ? ["使用素材包中与本段 claim 直接相关的图片或视频"] : ["按主题联网补充证据素材，素材必须能支撑画面 claim"],
      visualDirection: {
        density: "rich",
        mustAvoid: ["PPT化", "主画面复读完整字幕", "复用旧视频模板", "无意义抖动", "默认噪点"],
      },
    });
    const draftVisualManifest = buildVisualManifestFromScenes(result.scenes);
    const articleForResearch =
      (await readTextIfPresent(body.voiceoverPath)) ||
      result.scenes.map((scene) => scene.subtitle).join("\n");
    const assetManifestPath = body.assetManifestPath || `${dirname(body.scenesPath)}/asset-manifest.json`;
    const assetManifest = await researchAssets({
      title: videoBrief.topic,
      article: articleForResearch,
      videoBrief,
      visualManifest: draftVisualManifest,
      scenes: result.scenes,
      assetManifestPath,
    });
    const scenesWithAssets = {
      ...result,
      scenes: bindAssetsToScenes(result.scenes, assetManifest),
      warnings: [...result.warnings, ...assetManifest.warnings],
    };
    await writeFile(body.scenesPath, `${JSON.stringify(scenesWithAssets, null, 2)}\n`, "utf8");

    const visualManifest = buildVisualManifestFromScenes(scenesWithAssets.scenes);

    if (body.videoBriefPath) {
      await writeRuntimeVideoBrief(body.videoBriefPath, videoBrief);
    }
    if (body.visualManifestPath) {
      await writeRuntimeVisualManifest(body.visualManifestPath, visualManifest);
    }

    const enrichedResult = { ...scenesWithAssets, videoBrief, visualManifest, assetManifest };
    const directorPlan = await writeRuntimeDirectorPlan(body.directorPlanPath, enrichedResult);
    const reviewArtifacts = await writeDirectorReviewArtifacts(body.directorPlanPath, enrichedResult);

    return okJson({
      scenesPath: body.scenesPath,
      directorPlanPath: body.directorPlanPath,
      videoBriefPath: body.videoBriefPath,
      visualManifestPath: body.visualManifestPath,
      assetManifestPath,
      directorBriefPath: reviewArtifacts.directorBriefPath,
      directorScriptPath: reviewArtifacts.directorScriptPath,
      duration: scenesWithAssets.duration,
      scenes: scenesWithAssets.scenes,
      videoArchetype: scenesWithAssets.videoArchetype,
      creativeBrief: scenesWithAssets.creativeBrief,
      directorScript: scenesWithAssets.directorScript,
      directorPlan,
      warnings: scenesWithAssets.warnings,
    });
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : "生成场景失败", 500);
  }
}
