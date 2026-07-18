import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type {
  QualityIssue,
  Scene,
  VideoQualityReport,
} from "./types";

const execFile = promisify(execFileCallback);

export type VideoProbe = {
  durationSeconds: number;
  width: number;
  height: number;
  sizeBytes: number;
  hasAudioStream: boolean;
};

export type QualitySampleCapture = {
  label: "opening" | "peak" | "ending";
  timestampSeconds: number;
  framePath: string;
};

export type EvaluatePostRenderQaInput = {
  videoPath: string;
  expectedDurationSeconds: number;
  expectedWidth: number;
  expectedHeight: number;
  probe: VideoProbe;
  sampledFrameCount: number;
};

const postRenderIssue = (
  code: string,
  message: string,
  suggestedAction: QualityIssue["suggestedAction"],
  severity: QualityIssue["severity"] = "error",
  sceneId?: string,
): QualityIssue => ({
  code,
  message,
  severity,
  stage: "post-render",
  suggestedAction,
  sceneId,
});

export const evaluatePostRenderQa = ({
  videoPath,
  expectedDurationSeconds,
  expectedWidth,
  expectedHeight,
  probe,
  sampledFrameCount,
}: EvaluatePostRenderQaInput): VideoQualityReport => {
  const issues: QualityIssue[] = [];
  if (probe.sizeBytes <= 0 || probe.durationSeconds <= 0) {
    issues.push(postRenderIssue("render.invalid-media", "渲染文件为空或没有有效视频时长", "rerender"));
  }
  if (Math.abs(probe.durationSeconds - expectedDurationSeconds) > Math.max(1, expectedDurationSeconds * 0.08)) {
    issues.push(
      postRenderIssue(
        "render.duration-mismatch",
        `成片时长 ${probe.durationSeconds.toFixed(2)} 秒与预期 ${expectedDurationSeconds.toFixed(2)} 秒不一致`,
        "rerender",
      ),
    );
  }
  if (probe.width !== expectedWidth || probe.height !== expectedHeight) {
    issues.push(
      postRenderIssue(
        "render.dimension-mismatch",
        `成片尺寸为 ${probe.width}x${probe.height}，预期为 ${expectedWidth}x${expectedHeight}`,
        "rerender",
      ),
    );
  }
  if (!probe.hasAudioStream) {
    issues.push(postRenderIssue("render.audio-missing", "成片缺少可播放的音频轨道", "rerender"));
  }
  if (sampledFrameCount < 3) {
    issues.push(postRenderIssue("render.samples-missing", "未能解码开头、重点和结尾的成片抽检帧", "rerender"));
  }

  const warnings = issues
    .filter((issue) => issue.severity === "warning")
    .map((issue) => issue.message);
  return {
    passed: issues.every((issue) => issue.severity !== "error"),
    errors: issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.message),
    warnings,
    issues,
    checkedAt: new Date().toISOString(),
    render: {
      videoPath,
      durationSeconds: probe.durationSeconds,
      width: probe.width,
      height: probe.height,
      sizeBytes: probe.sizeBytes,
      hasAudioStream: probe.hasAudioStream,
      sampledFrameCount,
    },
  };
};

const probeVideo = async (videoPath: string): Promise<VideoProbe> => {
  const [{ stdout }, file] = await Promise.all([
    execFile("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,width,height:format=duration",
      "-of",
      "json",
      videoPath,
    ]),
    stat(videoPath),
  ]);
  const data = JSON.parse(stdout) as {
    streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    format?: { duration?: string };
  };
  const videoStream = data.streams?.find((stream) => stream.codec_type === "video");
  return {
    durationSeconds: Number(data.format?.duration ?? 0),
    width: Number(videoStream?.width ?? 0),
    height: Number(videoStream?.height ?? 0),
    sizeBytes: file.size,
    hasAudioStream: data.streams?.some((stream) => stream.codec_type === "audio") ?? false,
  };
};

const clampTimestamp = (
  timestampSeconds: number,
  durationSeconds: number,
): number => Math.max(0, Math.min(timestampSeconds, Math.max(0, durationSeconds - 0.05)));

export const planQualitySampleCaptures = (
  scenes: Scene[],
  durationSeconds: number,
  frameDir: string,
): QualitySampleCapture[] => {
  const peakScene = scenes.reduce<Scene | undefined>((selected, scene) => {
    if (!selected || (scene.importance ?? 0) > (selected.importance ?? 0)) return scene;
    return selected;
  }, undefined);
  const peakTimestamp = peakScene
    ? peakScene.start + (peakScene.end - peakScene.start) / 2
    : durationSeconds * 0.5;

  return [
    {
      label: "opening",
      timestampSeconds: clampTimestamp(durationSeconds * 0.08, durationSeconds),
      framePath: path.join(frameDir, "opening.jpg"),
    },
    {
      label: "peak",
      timestampSeconds: clampTimestamp(peakTimestamp, durationSeconds),
      framePath: path.join(frameDir, "peak.jpg"),
    },
    {
      label: "ending",
      timestampSeconds: clampTimestamp(durationSeconds * 0.9, durationSeconds),
      framePath: path.join(frameDir, "ending.jpg"),
    },
  ];
};

const extractQualitySampleFrames = async (
  videoPath: string,
  captures: QualitySampleCapture[],
): Promise<number> => {
  if (captures.length === 0) return 0;
  for (const capture of captures) {
    await execFile("ffmpeg", [
      "-y",
      "-ss",
      capture.timestampSeconds.toFixed(3),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      capture.framePath,
    ]);
  }
  return captures.length;
};

export const runPostRenderQa = async (input: {
  videoPath: string;
  expectedDurationSeconds: number;
  expectedWidth: number;
  expectedHeight: number;
  scenes?: Scene[];
}): Promise<VideoQualityReport> => {
  const probe = await probeVideo(input.videoPath);
  const frameDir = await mkdtemp(path.join(tmpdir(), "shin-video-qa-"));
  try {
    const captures = planQualitySampleCaptures(
      input.scenes ?? [],
      probe.durationSeconds,
      frameDir,
    );
    const sampledFrameCount = await extractQualitySampleFrames(input.videoPath, captures);
    return evaluatePostRenderQa({
      ...input,
      probe,
      sampledFrameCount,
    });
  } finally {
    await rm(frameDir, { recursive: true, force: true });
  }
};
