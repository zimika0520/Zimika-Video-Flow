import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RuntimeSubtitleStrategy, RuntimeVideoBrief } from "./types";

export const defaultSubtitleStrategy: RuntimeSubtitleStrategy = {
  timingSource: "provider-native",
  textSource: "voiceover-script",
  alignmentMethod: "map-confirmed-script-to-provider-timestamps",
  lineSubtitles: {
    maxCharsPerLine: 18,
    maxLines: 2,
    keepSentenceComplete: true,
  },
  insightSubtitles: {
    enabled: true,
    policy: "主画面可加入解释性关键词，但不能复读完整口播字幕。",
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
};

export type BuildVideoBriefInput = {
  topic: string;
  audience?: string;
  coreAngle: string;
  whyWatch: string;
  viewerDoubt?: string;
  plainAnswer: string;
  hook?: Partial<RuntimeVideoBrief["hook"]>;
  narrativeArc?: Partial<RuntimeVideoBrief["narrativeArc"]>;
  proofPoints?: string[];
  assetNeeds?: string[];
  visualDirection?: Partial<RuntimeVideoBrief["visualDirection"]>;
  requiredOutputs?: string[];
};

const compact = (value: string | undefined, fallback: string): string => {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
};

export const buildRuntimeVideoBrief = (input: BuildVideoBriefInput): RuntimeVideoBrief => ({
  videoBriefVersion: 1,
  topic: compact(input.topic, "未命名视频主题"),
  audience: compact(input.audience, "中文短视频观众"),
  coreAngle: compact(input.coreAngle, "用清晰口播解释事件的核心变化"),
  whyWatch: compact(input.whyWatch, "快速看懂事件为什么重要"),
  viewerDoubt: compact(input.viewerDoubt, "这件事和我有什么关系？"),
  plainAnswer: compact(input.plainAnswer, "用事实、数据和关系图把核心判断讲清楚。"),
  hook: {
    firstThreeSeconds: compact(input.hook?.firstThreeSeconds, input.coreAngle),
    viewerReasonToContinue: compact(input.hook?.viewerReasonToContinue, input.whyWatch),
  },
  narrativeArc: {
    opening: compact(input.narrativeArc?.opening, "先给出最反常或最值得关注的变化。"),
    turn: compact(input.narrativeArc?.turn, "再解释为什么这不是表面现象。"),
    proof: compact(input.narrativeArc?.proof, "用关键数据、证据或案例证明判断。"),
    reinforcement: compact(input.narrativeArc?.reinforcement, "补充技术、价格、产业链或风险层面的强化信息。"),
    closing: compact(input.narrativeArc?.closing, "最后收束成一句可记住的判断。"),
  },
  proofPoints: input.proofPoints?.filter(Boolean) ?? [],
  assetNeeds: input.assetNeeds?.filter(Boolean) ?? [],
  visualDirection: {
    userPreference: input.visualDirection?.userPreference,
    density: input.visualDirection?.density ?? "rich",
    mustAvoid: input.visualDirection?.mustAvoid ?? ["PPT化", "主画面复读完整字幕", "复用旧视频模板", "无意义抖动", "默认噪点"],
  },
  subtitleStrategy: defaultSubtitleStrategy,
  productionGate: {
    requireVisualManifest: true,
    requireFinalAudioTiming: true,
    requireDirectorPlan: true,
    requireStyleProfile: true,
  },
  requiredOutputs: input.requiredOutputs ?? [
    "视频标题.mp4",
    "口播文案.md",
    "video-brief.json",
    "director-plan.json",
    "visual-manifest.json",
    "style-profile.json",
    "publishing-pack.md",
  ],
});

export const writeRuntimeVideoBrief = async (videoBriefPath: string, brief: RuntimeVideoBrief): Promise<void> => {
  await mkdir(path.dirname(videoBriefPath), { recursive: true });
  await writeFile(videoBriefPath, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
};

export const readRuntimeVideoBrief = async (videoBriefPath: string): Promise<RuntimeVideoBrief> => {
  const brief = JSON.parse(await readFile(videoBriefPath, "utf8")) as RuntimeVideoBrief;
  if (!brief.videoBriefVersion) {
    throw new Error("runtime/video-brief.json 缺少 videoBriefVersion");
  }
  return brief;
};
