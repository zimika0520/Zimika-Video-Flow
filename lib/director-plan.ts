import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  DirectorPlanScene,
  RemotionExecutionContract,
  RenderInput,
  RuntimeDirectorPlan,
  RuntimeDirectorScript,
  RuntimeVideoBrief,
  RuntimeVisualManifest,
  VideoDirectorWorkflow,
  Scene,
} from "./types";

const defaultCreativeBrief = {
  archetype: "news-commentary",
  purpose: "将文章口播升级为有镜头语言、节奏曲线和字幕安全区的视频",
  audience: "中文短视频观众",
  coreMessage: "主画面只解释、强化、可视化，不重复完整字幕",
  desiredAction: "看懂核心变化与关键证据",
  durationSeconds: 0,
  estimatedSceneCount: 0,
  emotionalArc: "吸引 -> 展开 -> 强化 -> 收束",
  creativeDirection: {
    tone: "measured",
    pacing: "layered",
    visualStrategy: "优先关键词、结构图、数据卡和关系图，而不是整屏文案。",
    subtitlePolicy: "字幕跟随音频，主画面不重复完整字幕。",
    evidencePolicy: "有数字用数字卡，有关系用关系图，有时间进展用时间线。",
  },
} as const;

export const videoDirectorWorkflow: VideoDirectorWorkflow = {
  sourceSkill: "bayramannakov/remotion-video-director",
  adaptedPhases: ["Think", "Design", "Build", "Review"],
  sceneFocusRule: "one-scene-one-idea",
  archetypeMapping: {
    upstream: ["Product Launch", "Recurring Data Report", "Narrative Intro", "Technical Demo", "Growth Marketing"],
    shinVideo: ["news-commentary", "finance-explainer", "event-breakdown", "tech-demo", "narrative-explainer"],
  },
  expertReviewProtocol: [
    "director",
    "information-design",
    "motion-design",
    "caption-safety",
    "audience-comprehension",
  ],
};

export const remotionExecutionContract: RemotionExecutionContract = {
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
  remotionRules: [
    "frame-driven-animation",
    "clamped-interpolation",
    "sequence-based-timing",
    "component-reuse",
    "text-measurement",
    "no-css-transition-timeline",
  ],
};

const directorFingerprintPayload = (scenes: Scene[]) =>
  scenes.map((scene) => ({
    id: scene.id,
    start: scene.start,
    end: scene.end,
    subtitle: scene.subtitle,
    title: scene.title,
    images: scene.images,
    sceneType: scene.sceneType,
    visualIntent: scene.visualIntent,
    rendererFamily: scene.rendererFamily,
    visualTreatment: scene.visualTreatment,
    layoutRecipe: scene.layoutRecipe,
    motionVariant: scene.motionVariant,
    transition: scene.transition,
    visualModules: scene.visualModules,
  }));

export const createSourceScenesFingerprint = (scenes: Scene[]): string =>
  createHash("sha256").update(JSON.stringify(directorFingerprintPayload(scenes))).digest("hex");

export const buildRuntimeDirectorPlan = (
  renderInput: Pick<
    RenderInput,
    "scenes" | "narrativeLayer" | "videoArchetype" | "creativeBrief" | "directorScript" | "videoBrief" | "visualManifest" | "directorQualityTargets"
  >,
): RuntimeDirectorPlan => ({
  directorPlanVersion: 2,
  sourceScenesFingerprint: createSourceScenesFingerprint(renderInput.scenes),
  qualityTargets: renderInput.directorQualityTargets,
  videoDirectorWorkflow,
  remotionExecutionContract,
  videoArchetype: renderInput.videoArchetype,
  creativeBrief: renderInput.creativeBrief ?? { ...defaultCreativeBrief },
  videoBrief: renderInput.videoBrief
    ? {
        topic: renderInput.videoBrief.topic,
        audience: renderInput.videoBrief.audience,
        coreAngle: renderInput.videoBrief.coreAngle,
        whyWatch: renderInput.videoBrief.whyWatch,
        visualDirection: renderInput.videoBrief.visualDirection,
        subtitleStrategy: renderInput.videoBrief.subtitleStrategy,
      }
    : undefined,
  visualManifestSummary: renderInput.visualManifest
    ? {
        totalScenes: renderInput.visualManifest.scenes.length,
        scenesWithEvidenceAssets: renderInput.visualManifest.scenes.filter((scene) => scene.evidenceAsset).length,
        declaredOverlapRisks: renderInput.visualManifest.scenes.reduce((total, scene) => total + scene.overlapRisks.length, 0),
      }
    : undefined,
  narrativeArc: renderInput.narrativeLayer?.structure,
  attentionCurve: renderInput.narrativeLayer?.attentionCurve ?? [],
  peakMoments: renderInput.narrativeLayer?.peakMoments ?? [],
  globalRules: {
    requireShotVariety: true,
    requireCameraMotion: true,
    subtitleSafeArea: true,
    noFullSubtitleDuplicationInMainVisual: true,
  },
  directorScriptSummary: renderInput.directorScript
    ? {
        totalScenes: renderInput.directorScript.scenes.length,
        reviewChecklist: renderInput.directorScript.reviewChecklist,
      }
    : undefined,
  scenes: renderInput.scenes.map(
    (scene): DirectorPlanScene => ({
      id: scene.id,
      directorType: scene.directorType,
      rendererFamily: scene.rendererFamily,
      visualTreatment: scene.visualTreatment,
      layout: scene.layout,
      layoutRecipe: scene.layoutRecipe,
      narrativeRole: scene.narrativeRole,
      importance: scene.importance,
      role: scene.role,
      shotStyle: scene.shotStyle,
      visualPriority: scene.visualPriority,
      motionStyle: scene.motionStyle,
      animation: scene.animation,
      background: scene.background,
      components: scene.components,
      content: scene.content,
      visualBrief: scene.visualBrief,
      images: scene.images,
    }),
  ),
});

export const writeRuntimeDirectorPlan = async (
  directorPlanPath: string,
  renderInput: Pick<
    RenderInput,
    "scenes" | "narrativeLayer" | "videoArchetype" | "creativeBrief" | "directorScript" | "videoBrief" | "visualManifest" | "directorQualityTargets"
  >,
): Promise<RuntimeDirectorPlan> => {
  const plan = buildRuntimeDirectorPlan(renderInput);
  await mkdir(path.dirname(directorPlanPath), { recursive: true });
  await writeFile(directorPlanPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  return plan;
};

const createDirectorScriptMarkdown = (directorScript: RuntimeDirectorScript): string => {
  const lines = [
    "# Shin-video 导演审阅稿",
    "",
    `- 视频原型：${directorScript.videoArchetype}`,
    `- 核心目标：${directorScript.creativeBrief.purpose}`,
    `- 核心信息：${directorScript.creativeBrief.coreMessage}`,
    `- 视觉策略：${directorScript.creativeBrief.creativeDirection.visualStrategy}`,
    "",
    "## remotion-video-director 方法",
    "",
    `- 来源：${videoDirectorWorkflow.sourceSkill}`,
    `- 四阶段：${videoDirectorWorkflow.adaptedPhases.join(" -> ")}`,
    "- 场景原则：每个 scene 只表达一个核心 idea",
    `- 专家审片：${videoDirectorWorkflow.expertReviewProtocol.join(" / ")}`,
    "- Remotion 执行：按 director-plan 执行，字幕独立跟音频，主画面只解释/强化/可视化",
    "",
    "## 审阅清单",
    ...directorScript.reviewChecklist.map((item) => `- ${item}`),
    "",
    "## 分段导演稿",
    "",
  ];

  directorScript.scenes.forEach((scene, index) => {
    lines.push(`### ${index + 1}. ${scene.timeRange} · ${scene.coreIdea}`);
    lines.push(`- 用途：${scene.purpose}`);
    lines.push(`- 信息功能：${scene.informationFunction}`);
    lines.push(`- 镜头类型：${scene.directorType} / ${scene.shotStyle}`);
    lines.push(`- 主画面职责：${scene.mainVisualRole}`);
    lines.push(`- 画面关键词：${scene.onScreenKeywords.join(" / ") || "无"}`);
    lines.push(`- 动效建议：${scene.motionSuggestion || "保持克制过渡"}`);
    lines.push(`- 禁止事项：${scene.avoid}`);
    lines.push("");
  });

  return `${lines.join("\n")}\n`;
};

const createProductionContextMarkdown = (
  videoBrief?: RuntimeVideoBrief,
  visualManifest?: RuntimeVisualManifest,
): string[] => {
  const lines: string[] = [];
  if (videoBrief) {
    lines.push("## Creative Brief");
    lines.push("");
    lines.push(`- 主题：${videoBrief.topic}`);
    lines.push(`- 观众：${videoBrief.audience}`);
    lines.push(`- 核心角度：${videoBrief.coreAngle}`);
    lines.push(`- 为什么值得看：${videoBrief.whyWatch}`);
    lines.push(`- 字幕策略：${videoBrief.subtitleStrategy.textSource} + ${videoBrief.subtitleStrategy.timingSource}`);
    lines.push("");
  }
  if (visualManifest) {
    lines.push("## Asset Binding / Visual Manifest");
    lines.push("");
    lines.push(`- 绑定镜头数：${visualManifest.scenes.length}`);
    lines.push(`- 有素材证据的镜头：${visualManifest.scenes.filter((scene) => scene.evidenceAsset).length}`);
    lines.push("- 每个镜头必须声明 visualGoal、narrationClaim、safeZones 和 overlapRisks。");
    lines.push("");
  }
  return lines;
};

export const writeDirectorReviewArtifacts = async (
  directorPlanPath: string,
  renderInput: Pick<RenderInput, "videoArchetype" | "creativeBrief" | "directorScript" | "videoBrief" | "visualManifest">,
): Promise<{ directorBriefPath: string; directorScriptPath: string }> => {
  const runtimeDir = path.dirname(directorPlanPath);
  const directorBriefPath = path.join(runtimeDir, "director-brief.json");
  const directorScriptPath = path.join(runtimeDir, "director-script.md");

  await mkdir(runtimeDir, { recursive: true });

  const brief = {
    videoArchetype: renderInput.videoArchetype,
    videoDirectorWorkflow,
    remotionExecutionContract,
    creativeBrief: renderInput.creativeBrief ?? { ...defaultCreativeBrief },
    videoBrief: renderInput.videoBrief,
    visualManifestSummary: renderInput.visualManifest
      ? {
          totalScenes: renderInput.visualManifest.scenes.length,
          scenesWithEvidenceAssets: renderInput.visualManifest.scenes.filter((scene) => scene.evidenceAsset).length,
          declaredOverlapRisks: renderInput.visualManifest.scenes.reduce((total, scene) => total + scene.overlapRisks.length, 0),
        }
      : undefined,
    directorScriptSummary: renderInput.directorScript
      ? {
          totalScenes: renderInput.directorScript.scenes.length,
          reviewChecklist: renderInput.directorScript.reviewChecklist,
        }
      : {
          totalScenes: 0,
          reviewChecklist: [],
        },
  };

  await writeFile(directorBriefPath, `${JSON.stringify(brief, null, 2)}\n`, "utf8");

  if (renderInput.directorScript) {
    const context = createProductionContextMarkdown(renderInput.videoBrief, renderInput.visualManifest);
    await writeFile(directorScriptPath, `${context.join("\n")}${createDirectorScriptMarkdown(renderInput.directorScript)}`, "utf8");
  } else {
    await writeFile(directorScriptPath, "# Shin-video 导演审阅稿\n\n暂未生成导演稿。\n", "utf8");
  }

  return { directorBriefPath, directorScriptPath };
};

export const readRuntimeDirectorPlan = async (directorPlanPath: string): Promise<RuntimeDirectorPlan> => {
  let raw: string;

  try {
    raw = await readFile(directorPlanPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("RUN_DIR/director-plan.json 缺失，停止渲染，请先运行 Remotion 视频导演");
    }
    throw error;
  }

  const plan = JSON.parse(raw) as RuntimeDirectorPlan;

  if (!plan.directorPlanVersion) {
    throw new Error("RUN_DIR/director-plan.json 缺少 directorPlanVersion，停止渲染");
  }

  if (!Array.isArray(plan.scenes) || plan.scenes.length === 0) {
    throw new Error("RUN_DIR/director-plan.json 缺少可渲染 scenes，停止渲染");
  }

  return {
    ...plan,
    videoDirectorWorkflow: {
      ...videoDirectorWorkflow,
      ...plan.videoDirectorWorkflow,
      expertReviewProtocol:
        plan.videoDirectorWorkflow?.expertReviewProtocol
        ?? videoDirectorWorkflow.expertReviewProtocol,
    },
    remotionExecutionContract: plan.remotionExecutionContract ?? remotionExecutionContract,
  };
};

export const assertDirectorPlanMatchesScenes = (directorPlan: RuntimeDirectorPlan, scenes: Scene[]): void => {
  if (!directorPlan.sourceScenesFingerprint) {
    throw new Error("RUN_DIR/director-plan.json 缺少 scenes 指纹，停止渲染，请重新生成导演方案");
  }

  const currentFingerprint = createSourceScenesFingerprint(scenes);
  if (directorPlan.sourceScenesFingerprint !== currentFingerprint) {
    throw new Error("RUN_DIR/director-plan.json 与当前 scenes.json 不匹配，停止渲染，请先根据当前口播、素材和时间轴重新生成导演视觉系统");
  }
};
