import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { readRuntimeDirectorPlan } from "./director-plan";
import {
  validateProductionGateFiles,
  type ProductionGateInput,
} from "./production-gate";
import { readRuntimeStyleProfile } from "./style-profile";
import {
  parseProviderNativeSubtitleTimeline,
  type ProviderNativeSubtitleTimeline,
} from "./tts-provider";
import type {
  ProductionGateReport,
  RuntimeAssetManifest,
  RuntimeDirectorPlan,
  RuntimeStyleProfile,
  RuntimeVideoBrief,
  RuntimeVisualManifest,
  Scene,
} from "./types";

export type ProductionHandoffArtifactKey =
  | "videoBrief"
  | "scenes"
  | "visualManifest"
  | "assetManifest"
  | "directorPlan"
  | "styleProfile"
  | "subtitleTimeline"
  | "audio"
  | "voiceover";

export type ProductionHandoffArtifact = {
  key: ProductionHandoffArtifactKey;
  label: string;
  path: string;
  required: boolean;
  exists: boolean;
  valid: boolean;
  sizeBytes?: number;
  error?: string;
};

export type ProductionHandoffActionKind =
  | "complete_artifact"
  | "repair_artifact"
  | "resolve_gate_blocker"
  | "render_video";

export type ProductionHandoffBrief = {
  product: "Zimika Video Flow";
  briefVersion: 1;
  schemaVersion: 1;
  generatedAt: string;
  runDir: string;
  readiness: {
    canRender: boolean;
    blocked: boolean;
    requiredArtifactCount: number;
    readyArtifactCount: number;
  };
  recommendedAction: {
    kind: ProductionHandoffActionKind;
    summary: string;
    target: string | null;
    requiresHuman: boolean;
  };
  counts: {
    artifactCount: number;
    missingArtifactCount: number;
    invalidArtifactCount: number;
    gateErrorCount: number;
    gateWarningCount: number;
  };
  artifacts: ProductionHandoffArtifact[];
  gateReport: ProductionGateReport | null;
};

type BuildHandoffBriefInput = {
  runDir: string;
  artifacts: ProductionHandoffArtifact[];
  gateReport?: ProductionGateReport | null;
};

const missingArtifact = (
  artifact: ProductionHandoffArtifact,
  action: "complete_artifact" | "repair_artifact",
): ProductionHandoffBrief["recommendedAction"] => ({
  kind: action,
  summary:
    action === "repair_artifact"
      ? "关键制品存在但无法解析，先修复或重新生成该文件，再进行 Production Gate。"
      : "关键制品尚未生成，先补齐该文件，不能直接渲染。",
  target: artifact.key,
  requiresHuman: true,
});

export const buildProductionHandoffBrief = ({
  runDir,
  artifacts,
  gateReport = null,
}: BuildHandoffBriefInput): ProductionHandoffBrief => {
  const required = artifacts.filter((artifact) => artifact.required);
  const invalid = required.find(
    (artifact) => artifact.exists && !artifact.valid,
  );
  const missing = required.find((artifact) => !artifact.exists);

  let recommendedAction: ProductionHandoffBrief["recommendedAction"];
  if (invalid) {
    recommendedAction = missingArtifact(invalid, "repair_artifact");
  } else if (missing) {
    recommendedAction = missingArtifact(missing, "complete_artifact");
  } else if (gateReport && !gateReport.passed) {
    recommendedAction = {
      kind: "resolve_gate_blocker",
      summary:
        "所有文件都在，但 Production Gate 仍有阻断项；先修复第一条错误，再重新生成接手摘要。",
      target: gateReport.issues[0]?.code ?? "production-gate",
      requiresHuman: false,
    };
  } else if (gateReport?.passed) {
    recommendedAction = {
      kind: "render_video",
      summary:
        "关键制品完整且 Production Gate 已通过，可以进入 Remotion 最终渲染。",
      target: null,
      requiresHuman: false,
    };
  } else {
    recommendedAction = {
      kind: "resolve_gate_blocker",
      summary:
        "文件盘点完成，但尚未形成可执行的 Production Gate 报告；先修复解析或输入错误。",
      target: "production-gate",
      requiresHuman: true,
    };
  }

  const readyArtifactCount = required.filter(
    (artifact) => artifact.exists && artifact.valid,
  ).length;
  const canRender =
    readyArtifactCount === required.length && gateReport?.passed === true;

  return {
    product: "Zimika Video Flow",
    briefVersion: 1,
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    runDir,
    readiness: {
      canRender,
      blocked: !canRender,
      requiredArtifactCount: required.length,
      readyArtifactCount,
    },
    recommendedAction,
    counts: {
      artifactCount: artifacts.length,
      missingArtifactCount: required.filter(
        (artifact) => !artifact.exists,
      ).length,
      invalidArtifactCount: required.filter(
        (artifact) => artifact.exists && !artifact.valid,
      ).length,
      gateErrorCount: gateReport?.errors.length ?? 0,
      gateWarningCount: gateReport?.warnings.length ?? 0,
    },
    artifacts,
    gateReport,
  };
};

const inspectFile = async (
  key: ProductionHandoffArtifactKey,
  label: string,
  filePath: string,
): Promise<ProductionHandoffArtifact> => {
  if (!existsSync(filePath)) {
    return {
      key,
      label,
      path: filePath,
      required: true,
      exists: false,
      valid: false,
    };
  }
  try {
    const metadata = await stat(filePath);
    return {
      key,
      label,
      path: filePath,
      required: true,
      exists: true,
      valid: true,
      sizeBytes: metadata.size,
    };
  } catch (error) {
    return {
      key,
      label,
      path: filePath,
      required: true,
      exists: true,
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const readJsonArtifact = async <T>(
  key: ProductionHandoffArtifactKey,
  label: string,
  filePath: string,
): Promise<{
  artifact: ProductionHandoffArtifact;
  value?: T;
}> => {
  const artifact = await inspectFile(key, label, filePath);
  if (!artifact.exists || !artifact.valid) return { artifact };
  try {
    return {
      artifact,
      value: JSON.parse(await readFile(filePath, "utf8")) as T,
    };
  } catch (error) {
    return {
      artifact: {
        ...artifact,
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
};

const firstExistingPath = (
  candidates: string[],
): string => candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];

const findNamedFile = async (
  directory: string,
  extensions: string[],
): Promise<string> => {
  if (!existsSync(directory)) {
    return path.join(directory, `口播音频${extensions[0]}`);
  }
  const entries = await readdir(directory, { withFileTypes: true });
  const match = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort()
    .find(
      (name) =>
        name.startsWith("口播音频")
        && extensions.some((extension) => name.endsWith(extension)),
    );
  return path.join(directory, match ?? `口播音频${extensions[0]}`);
};

export const inspectProductionHandoff = async (input: {
  runDir: string;
  audioPath?: string;
  voiceoverPath?: string;
}): Promise<ProductionHandoffBrief> => {
  const runDir = path.resolve(input.runDir);
  const projectDir = path.resolve(runDir, "../..");
  const audioSearchDirs = [runDir, projectDir];
  const audioPath =
    input.audioPath ??
    firstExistingPath(
      (await Promise.all(
        audioSearchDirs.map((directory) =>
          findNamedFile(directory, [".mp3", ".wav", ".m4a", ".aac"]),
        ),
      )).filter(Boolean),
    );
  const voiceoverPath =
    input.voiceoverPath ??
    firstExistingPath([
      path.join(runDir, "口播文案.md"),
      path.join(projectDir, "口播文案.md"),
    ]);

  const videoBrief = await readJsonArtifact<RuntimeVideoBrief>(
    "videoBrief",
    "视频 Brief",
    path.join(runDir, "video-brief.json"),
  );
  const scenes = await readJsonArtifact<{
    scenes: Scene[];
  }>("scenes", "分镜场景", path.join(runDir, "scenes.json"));
  const visualManifest = await readJsonArtifact<RuntimeVisualManifest>(
    "visualManifest",
    "视觉清单",
    path.join(runDir, "visual-manifest.json"),
  );
  const assetManifest = await readJsonArtifact<RuntimeAssetManifest>(
    "assetManifest",
    "素材清单",
    path.join(runDir, "asset-manifest.json"),
  );
  const directorPlan = await readJsonArtifact<RuntimeDirectorPlan>(
    "directorPlan",
    "导演方案",
    path.join(runDir, "director-plan.json"),
  );
  const styleProfile = await readJsonArtifact<RuntimeStyleProfile>(
    "styleProfile",
    "视觉风格",
    path.join(runDir, "style-profile.json"),
  );
  const subtitleTimeline =
    await readJsonArtifact<ProviderNativeSubtitleTimeline>(
      "subtitleTimeline",
      "服务商原生字幕时间轴",
      path.join(runDir, "subtitle-timeline.json"),
    );
  const audio = await inspectFile("audio", "最终口播音频", audioPath);
  const voiceover = await inspectFile("voiceover", "确认后的口播文案", voiceoverPath);
  const artifacts = [
    videoBrief.artifact,
    scenes.artifact,
    visualManifest.artifact,
    assetManifest.artifact,
    directorPlan.artifact,
    styleProfile.artifact,
    subtitleTimeline.artifact,
    audio,
    voiceover,
  ];

  let gateReport: ProductionGateReport | null = null;
  if (artifacts.every((artifact) => artifact.exists && artifact.valid)) {
    try {
      const gateInput: ProductionGateInput = {
        scenes: scenes.value?.scenes ?? [],
        captions: subtitleTimeline.value?.segments,
        subtitleTimeline: parseProviderNativeSubtitleTimeline(
          subtitleTimeline.value,
        ),
        videoBrief: videoBrief.value,
        visualManifest: visualManifest.value,
        assetManifest: assetManifest.value,
        directorPlan: await readRuntimeDirectorPlan(
          directorPlan.artifact.path,
        ),
        styleProfile: await readRuntimeStyleProfile(
          styleProfile.artifact.path,
        ),
        audioPath,
        voiceoverPath,
      };
      gateReport = await validateProductionGateFiles(gateInput);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      gateReport = {
        passed: false,
        errors: [message],
        warnings: [],
        issues: [
          {
            code: "workflow.handoff-input-invalid",
            severity: "error",
            stage: "pre-render",
            message,
            suggestedAction: "rerender",
          },
        ],
        checkedAt: new Date().toISOString(),
      };
    }
  }

  return buildProductionHandoffBrief({
    runDir,
    artifacts,
    gateReport,
  });
};
