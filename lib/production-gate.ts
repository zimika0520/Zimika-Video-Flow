import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { assertDirectorPlanMatchesScenes } from "./director-plan";
import {
  parseProviderNativeSubtitleTimeline,
  validateSubtitleTimelineFiles,
  type ProviderNativeSubtitleTimeline,
} from "./tts-provider";
import type {
  CaptionLine,
  QualityIssue,
  ProductionGateReport,
  RuntimeAssetManifest,
  RuntimeDirectorPlan,
  RuntimeStyleProfile,
  RuntimeVideoBrief,
  RuntimeVisualManifest,
  Scene,
} from "./types";

export type ProductionGateInput = {
  scenes: Scene[];
  captions?: CaptionLine[];
  videoBrief?: RuntimeVideoBrief;
  visualManifest?: RuntimeVisualManifest;
  assetManifest?: RuntimeAssetManifest;
  directorPlan?: RuntimeDirectorPlan;
  styleProfile?: RuntimeStyleProfile;
  audioPath?: string;
  voiceoverPath?: string;
  subtitleTimeline?: ProviderNativeSubtitleTimeline;
};

const add = (items: string[], condition: unknown, message: string): void => {
  if (!condition) items.push(message);
};

export const validateProductionGate = (input: ProductionGateInput): ProductionGateReport => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const issues: QualityIssue[] = [];
  const scenes = input.scenes;

  add(errors, scenes.length > 0, "runtime/scenes.json 没有可渲染 scenes");
  add(errors, input.directorPlan?.directorPlanVersion, "缺少 runtime/director-plan.json 或 directorPlanVersion");
  add(errors, input.styleProfile?.styleProfileVersion, "缺少 runtime/style-profile.json 或 styleProfileVersion");
  add(errors, input.audioPath && existsSync(input.audioPath), "缺少最终口播音频，不能渲染");
  add(errors, input.voiceoverPath && existsSync(input.voiceoverPath), "缺少确认后的口播文案，不能渲染");
  add(errors, input.subtitleTimeline, "缺少服务商原生 subtitle-timeline.json，不能渲染");
  if (input.subtitleTimeline) {
    add(
      errors,
      input.subtitleTimeline.source === "provider-native",
      "字幕时间轴必须来自 TTS 服务商原生时间戳",
    );
  }

  const captions = input.subtitleTimeline?.segments ?? input.captions;
  if (captions) {
    add(errors, captions.length > 0, "缺少以最终音频对齐的 subtitle-timeline/captions");
    captions.forEach((caption, index) => {
      add(errors, caption.end > caption.start, `字幕第 ${index + 1} 条时间轴无效`);
      add(errors, caption.text.trim().length > 0, `字幕第 ${index + 1} 条正文为空`);
    });
  } else {
    errors.push("缺少字幕时间轴，不能渲染");
  }

  if (input.directorPlan) {
    try {
      assertDirectorPlanMatchesScenes(input.directorPlan, scenes);
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  errors.forEach((message, index) => {
    const sceneId = scenes.find((scene) => message.includes(scene.id))?.id;
    issues.push({
      code: sceneId ? "scene.pre-render-invalid" : `workflow.pre-render-${index + 1}`,
      severity: "error",
      stage: "pre-render",
      message,
      sceneId,
      suggestedAction: sceneId ? "regenerate-scene" : "rerender",
    });
  });

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    issues,
    checkedAt: new Date().toISOString(),
  };
};

export const validateProductionGateFiles = async (
  input: ProductionGateInput,
): Promise<ProductionGateReport> => {
  let subtitleTimeline = input.subtitleTimeline;
  try {
    if (subtitleTimeline) {
      subtitleTimeline = parseProviderNativeSubtitleTimeline(subtitleTimeline);
    }
  } catch (error) {
    const report = validateProductionGate({ ...input, subtitleTimeline: undefined });
    const message = error instanceof Error ? error.message : "服务商原生字幕时间轴无效";
    if (!report.errors.includes(message)) report.errors.push(message);
    report.issues.push({
      code: "workflow.subtitle-timeline-invalid",
      severity: "error",
      stage: "pre-render",
      message,
      suggestedAction: "regenerate-subtitles",
    });
    report.passed = false;
    return report;
  }

  const report = validateProductionGate({ ...input, subtitleTimeline });
  if (!subtitleTimeline || !input.audioPath || !input.voiceoverPath) {
    return report;
  }

  try {
    await validateSubtitleTimelineFiles({
      timeline: subtitleTimeline,
      audioPath: input.audioPath,
      voiceoverPath: input.voiceoverPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "字幕时间轴文件校验失败";
    if (!report.errors.includes(message)) report.errors.push(message);
    report.issues.push({
      code: "workflow.subtitle-timeline-fingerprint-invalid",
      severity: "error",
      stage: "pre-render",
      message,
      suggestedAction: "regenerate-subtitles",
    });
    report.passed = false;
  }

  return report;
};

export const readJsonIfExists = async <T>(filePath: string): Promise<T | undefined> => {
  if (!existsSync(filePath)) return undefined;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
};
