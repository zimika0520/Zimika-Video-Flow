import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { validateDirectorContract } from "./director-contract";
import { assertDirectorPlanMatchesScenes, createSourceScenesFingerprint } from "./director-plan";
import { buildDirectorQualityBounds } from "./director-selector";
import {
  parseProviderNativeSubtitleTimeline,
  validateSubtitleTimelineFiles,
  type ProviderNativeSubtitleTimeline,
} from "./tts-provider";
import { directorVisualForm } from "./visual-form";
import type {
  CaptionLine,
  QualityIssue,
  ProductionGateReport,
  RuntimeAssetManifest,
  RuntimeDirectorPlan,
  RuntimeAsset,
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

const normalize = (value: string) => value.replace(/\s+/g, "").trim();

const sceneRepeatsSubtitle = (scene: Scene): boolean => {
  const subtitle = normalize(scene.subtitle);
  if (subtitle.length < 8) return false;
  const visualTexts = [
    scene.title,
    scene.visualBrief?.headline,
    scene.content?.headline,
    scene.content?.sceneTitle,
    scene.content?.centerLabel,
    ...(scene.mainVisualText ?? []),
  ]
    .filter(Boolean)
    .map((value) => normalize(String(value)));

  return visualTexts.some((text) => text === subtitle || (subtitle.length > 16 && text.includes(subtitle)));
};

const generatedVisualTreatments = new Set([
  "full-screen-cinematic-crop",
  "foreground-subject-plus-motion-graphics",
  "partial-crop-beside-real-evidence",
  "layered-parallax",
]);

const isAiGeneratedAsset = (asset: RuntimeAsset): boolean =>
  asset.type === "ai-generated" ||
  asset.capture?.method === "ai-generation" ||
  asset.sourceDomain === "ai-generation" ||
  asset.sourceUrl.startsWith("shin-video://generated-image/");

const sceneHasRuntimeImage = (scene: Scene, fileName: string): boolean =>
  scene.images.some((image) => image === fileName || image.endsWith(`/${fileName}`));

const finalVisualForm = (scene: Scene, assetManifest?: RuntimeAssetManifest): string => {
  const binding = assetManifest?.sceneBindings.find((candidate) => candidate.sceneId === scene.id);
  const concept = binding?.assetIds
    .map((assetId) => assetManifest?.assets.find((asset) => asset.id === assetId))
    .find(
      (asset) =>
        asset?.type === "ai-generated" &&
        asset.role === "concept" &&
        asset.metadata?.evidenceStatus === "concept-only" &&
        typeof asset.metadata.visualTreatment === "string" &&
        generatedVisualTreatments.has(asset.metadata.visualTreatment),
    );

  return concept?.metadata?.visualTreatment
    ? `concept:${scene.rendererFamily ?? "none"}:${concept.metadata.visualTreatment}`
    : directorVisualForm(scene.directorType, scene.rendererFamily, scene.visualTreatment);
};

export const validateProductionGate = (input: ProductionGateInput): ProductionGateReport => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const issues: QualityIssue[] = [];
  const scenes = input.scenes;

  add(errors, scenes.length > 0, "runtime/scenes.json 没有可渲染 scenes");
  add(errors, input.videoBrief?.videoBriefVersion, "缺少 runtime/video-brief.json 或 videoBriefVersion");
  add(errors, input.visualManifest?.visualManifestVersion, "缺少 runtime/visual-manifest.json 或 visualManifestVersion");
  add(errors, input.assetManifest?.assetManifestVersion, "缺少 runtime/asset-manifest.json 或 assetManifestVersion");
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
  const totalDuration = scenes.length > 0 ? Math.max(...scenes.map((scene) => scene.end)) - Math.min(...scenes.map((scene) => scene.start)) : 0;
  const minimumSceneCount = totalDuration > 0 ? Math.max(1, Math.floor(totalDuration / 10) + 1) : 1;
  if (scenes.length < minimumSceneCount) {
    warnings.push(
      `镜头密度建议复核：${Math.round(totalDuration)} 秒视频建议至少 ${minimumSceneCount} 个镜头，当前为 ${scenes.length} 个；以渲染后逐镜头审片结果为准。`,
    );
  }
  scenes.forEach((scene) => {
    const duration = scene.end - scene.start;
    if (duration >= 10) {
      warnings.push(
        `${scene.id} 镜头时长为 ${duration.toFixed(2)} 秒，建议检查镜头内部是否有足够的信息与构图变化。`,
      );
    }
  });

  if (input.videoBrief) {
    ["topic", "audience", "coreAngle", "whyWatch", "plainAnswer"].forEach((key) => {
      add(errors, Boolean(String(input.videoBrief?.[key as keyof RuntimeVideoBrief] ?? "").trim()), `runtime/video-brief.json 缺少 ${key}`);
    });
    add(
      errors,
      input.videoBrief.subtitleStrategy?.textSource === "voiceover-script",
      "字幕正文必须以确认后的口播文案为准",
    );
    add(
      errors,
      input.videoBrief.subtitleStrategy?.timingSource === "provider-native",
      "字幕时间轴必须使用 TTS 服务商原生时间戳",
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

  if (input.visualManifest) {
    const manifestBySceneId = new Map(input.visualManifest.scenes.map((scene) => [scene.sceneId, scene]));
    scenes.forEach((scene) => {
      const visual = manifestBySceneId.get(scene.id);
      add(errors, visual, `visual-manifest 缺少 ${scene.id}`);
      if (!visual) return;
      add(errors, visual.visualGoal.trim(), `${scene.id} 缺少 visualGoal`);
      add(errors, visual.narrationClaim.trim(), `${scene.id} 缺少 narrationClaim`);
      add(errors, visual.safeZones?.subtitle === "bottom", `${scene.id} 必须声明底部字幕安全区`);
      add(errors, visual.safeZones?.mainVisualAvoidsSubtitle, `${scene.id} 必须声明主视觉避让字幕`);
    });

    const fingerprint = createSourceScenesFingerprint(scenes);
    if (input.visualManifest.sourceScenesFingerprint && input.visualManifest.sourceScenesFingerprint !== fingerprint) {
      errors.push("runtime/visual-manifest.json 与当前 scenes.json 不匹配，请重新生成视觉清单");
    }
  }

  if (input.assetManifest) {
    const assetManifest = input.assetManifest;
    add(errors, input.assetManifest.assets.length > 0, "asset-manifest 没有可用素材资产");
    const assetById = new Map(input.assetManifest.assets.map((asset) => [asset.id, asset]));
    const evidenceRecords = input.assetManifest.evidenceRecords ?? [];
    const hasSourceEvidence = evidenceRecords.some((record) => record.kind === "source-text" || record.kind === "source-html" || record.kind === "source-excerpt");
    const hasExternalEvidence = evidenceRecords.some(
      (record) => record.kind === "external-page" || record.kind === "external-screenshot" || record.kind === "external-image",
    );
    if (input.assetManifest.sourceMode !== "dry-run") {
      add(errors, evidenceRecords.length > 0, "asset-manifest 缺少 evidenceRecords，不能证明素材来源");
      add(errors, hasSourceEvidence || hasExternalEvidence, "asset-manifest 缺少来源文章或外部资料证据记录");
    }
    const bindingBySceneId = new Map(input.assetManifest.sceneBindings.map((binding) => [binding.sceneId, binding]));
    scenes.forEach((scene) => {
      const binding = bindingBySceneId.get(scene.id);
      add(errors, binding, `asset-manifest 缺少 ${scene.id} 的素材绑定`);
      add(errors, binding?.assetIds.length, `${scene.id} 没有绑定素材资产`);
      add(errors, scene.images.length > 0 || binding?.assetIds.length, `${scene.id} 主画面缺少素材或证据卡`);
      binding?.assetIds.forEach((assetId) => {
        const asset = assetById.get(assetId);
        add(errors, asset, `${scene.id} 绑定了不存在的素材资产 ${assetId}`);
        if (asset?.type === "ai-generated") {
          add(errors, sceneHasRuntimeImage(scene, asset.fileName), `${scene.id} 绑定的 AI 概念图 ${asset.fileName} 未进入 scene.images`);
        }
      });
    });
    input.assetManifest.assets.filter(isAiGeneratedAsset).forEach((asset) => {
      add(errors, asset.type === "ai-generated", `AI 生成素材 ${asset.id} 必须使用 ai-generated 类型`);
      add(errors, asset.role === "concept", `AI 生成素材 ${asset.id} 必须使用 concept 角色`);
      add(errors, asset.metadata?.evidenceStatus === "concept-only", `AI 生成素材 ${asset.id} 必须标记 evidenceStatus=concept-only`);
      add(
        errors,
        typeof asset.metadata?.visualTreatment === "string" && generatedVisualTreatments.has(asset.metadata.visualTreatment),
        `AI 生成素材 ${asset.id} 缺少合法 visualTreatment`,
      );
      if (asset.metadata?.visualTreatment === "partial-crop-beside-real-evidence") {
        add(
          errors,
          Boolean(asset.metadata.factLabel?.trim()),
          `AI 生成素材 ${asset.id} 使用局部并排形式时必须提供 factLabel`,
        );
      }
      const boundSceneIds = assetManifest.sceneBindings
        .filter((binding) => binding.assetIds.includes(asset.id))
        .map((binding) => binding.sceneId);
      if (
        asset.metadata?.visualTreatment === "full-screen-cinematic-crop" &&
        boundSceneIds.length > 1
      ) {
        warnings.push(
          `AI 概念图 ${asset.id} 被多个镜头绑定为全屏构图，渲染后必须检查实际画面复用程度。`,
        );
      }
    });
    if (input.assetManifest.sourceMode === "dry-run") {
      warnings.push("asset-manifest 来自 dry-run，只能验证结构；正式成片前应联网采集真实证据截图或素材。");
    }
    if (input.assetManifest.sourceMode === "browser-evidence" && !hasExternalEvidence) {
      warnings.push("asset-manifest 已记录来源文章证据，但缺少外部资料页证据；复杂新闻/财经视频建议补充官网、报道或数据页截图。");
    }
    if (input.assetManifest.assets.every((asset) => asset.type === "source-card")) {
      warnings.push("当前素材全部是来源卡片，没有真实网页截图或图片；画面丰富度可能不足。");
    }
  }

  if (input.directorPlan) {
    try {
      assertDirectorPlanMatchesScenes(input.directorPlan, scenes);
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  scenes.forEach((scene, index) => {
    if (!scene.directorType) return;

    add(errors, scene.semantics, `${scene.id} 缺少 semantics`);
    add(errors, scene.content, `${scene.id} 缺少 content`);
    add(errors, scene.rendererFamily, `${scene.id} 缺少 rendererFamily`);
    add(errors, scene.visualTreatment, `${scene.id} 缺少 visualTreatment`);

    if (
      !scene.semantics ||
      !scene.content ||
      !scene.rendererFamily ||
      !scene.visualTreatment
    ) return;

    const contract = validateDirectorContract({
      scene,
      semantics: scene.semantics,
      directorType: scene.directorType,
      content: scene.content,
      components: scene.components ?? [],
      sceneIndex: index,
      sceneCount: scenes.length,
    });

    contract.issues.forEach((issue) => {
      issues.push({
        code: `director.${issue.code}`,
        severity: issue.severity,
        stage: "pre-render",
        message: issue.message,
        sceneId: issue.sceneId,
        suggestedAction: "regenerate-scene",
      });
      if (issue.severity === "error" && !errors.includes(issue.message)) {
        errors.push(issue.message);
      }
    });
  });

  const sceneTypes = new Set(scenes.map((scene) => scene.sceneType).filter(Boolean));
  const visualForms = scenes.map((scene) => finalVisualForm(scene, input.assetManifest));
  const distinctVisualForms = new Set(visualForms);
  const rendererFamilies = new Set(
    scenes.map((scene) => scene.rendererFamily).filter(Boolean),
  );
  const motionCombos = new Set(scenes.map((scene) => `${scene.motionVariant ?? "none"}:${scene.shotStyle ?? "none"}`));
  const minimumVisualRecipes = input.videoBrief?.productionGate?.minimumVisualRecipes ?? 3;
  const minimumDirectorTypes = input.videoBrief?.productionGate?.minimumDirectorTypes ?? 4;

  if (sceneTypes.size < Math.min(minimumVisualRecipes, scenes.length)) {
    warnings.push(
      `声明的视觉表达只有 ${sceneTypes.size} 类，低于建议值 ${Math.min(minimumVisualRecipes, scenes.length)}；最终以逐镜头构图相似度为准。`,
    );
  }
  if (motionCombos.size < Math.min(minimumDirectorTypes, scenes.length)) {
    warnings.push(
      `声明的动效组合只有 ${motionCombos.size} 类，低于建议值 ${Math.min(minimumDirectorTypes, scenes.length)}；最终以渲染结果为准。`,
    );
  }
  const targets = input.directorPlan?.qualityTargets;
  if (!targets) {
    warnings.push("director-plan 缺少语义导演质量目标；不会单独阻止渲染，但必须通过渲染后质量检查。");
  }
  const expectedBounds = buildDirectorQualityBounds(scenes.length);
  if (targets) {
    if (
      targets.preferredForms !== expectedBounds.preferredForms ||
      targets.minimumForms !== expectedBounds.minimumForms ||
      targets.preferredFamilies !== expectedBounds.preferredFamilies ||
      targets.minimumFamilies !== expectedBounds.minimumFamilies
    ) {
      warnings.push("director-plan 的声明质量目标与推荐公式不同；该差异仅供审片参考，不作为渲染阻断条件。");
    }
    if (
      targets.requiredForms < targets.minimumForms ||
      targets.requiredForms > targets.preferredForms ||
      targets.requiredFamilies < targets.minimumFamilies ||
      targets.requiredFamilies > targets.preferredFamilies
    ) {
      warnings.push("director-plan 的声明质量目标超出推荐范围；最终质量以实际渲染检查为准。");
    }
    if (distinctVisualForms.size < targets.requiredForms) {
      warnings.push(
        `声明的视觉形式目标为 ${targets.requiredForms} 种，当前为 ${distinctVisualForms.size} 种；渲染后将检查实际最终构图。`,
      );
    }
    if (rendererFamilies.size < targets.requiredFamilies) {
      warnings.push(
        `声明的渲染家族目标为 ${targets.requiredFamilies} 个，当前为 ${rendererFamilies.size} 个；渲染后将检查主画面差异。`,
      );
    }
  }
  for (let index = 1; index < visualForms.length; index += 1) {
    if (visualForms[index] === visualForms[index - 1]) {
      warnings.push(
        `${scenes[index].id} 与前一镜头声明了相同视觉形式；渲染后必须检查最终构图是否高度相似。`,
      );
    }
  }

  scenes.forEach((scene) => {
    if (sceneRepeatsSubtitle(scene)) {
      const message = `${scene.id} 主画面疑似复读完整字幕`;
      errors.push(message);
      issues.push({
        code: "scene.subtitle-duplication",
        severity: "error",
        stage: "pre-render",
        message,
        sceneId: scene.id,
        suggestedAction: "shorten-copy",
      });
    }
  });

  if (input.visualManifest?.scenes.some((scene) => scene.overlapRisks.length > 0)) {
    warnings.push("visual-manifest 声明了重叠风险，渲染后必须抽帧或 contact sheet 审片");
  }

  const representedMessages = new Set(issues.map((issue) => issue.message));
  errors.forEach((message, index) => {
    if (representedMessages.has(message)) return;
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
  warnings.forEach((message, index) => {
    issues.push({
      code: `workflow.pre-render-warning-${index + 1}`,
      severity: "warning",
      stage: "pre-render",
      message,
      suggestedAction: "review-frame",
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
