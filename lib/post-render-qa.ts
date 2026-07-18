import { execFile as execFileCallback } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";
import type {
  QualityIssue,
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

export type BlackSegment = {
  start: number;
  end: number;
  duration: number;
};

export type EvaluatePostRenderQaInput = {
  videoPath: string;
  expectedDurationSeconds: number;
  expectedWidth: number;
  expectedHeight: number;
  probe: VideoProbe;
  blackSegments: BlackSegment[];
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
  blackSegments,
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
  const longBlackSegmentCount = blackSegments.filter(
    (segment) => segment.duration >= 1.5,
  ).length;
  if (longBlackSegmentCount > 0) {
    issues.push(postRenderIssue("render.long-black-frame", "成片包含持续 1.5 秒以上的明显黑帧", "review-frame"));
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
      longBlackSegmentCount,
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

const parseBlackSegments = (stderr: string): BlackSegment[] =>
  [...stderr.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g)].map(
    (match) => ({
      start: Number(match[1]),
      end: Number(match[2]),
      duration: Number(match[3]),
    }),
  );

const detectBlackSegments = async (videoPath: string): Promise<BlackSegment[]> => {
  try {
    const { stderr } = await execFile("ffmpeg", [
      "-hide_banner",
      "-i",
      videoPath,
      "-vf",
      "blackdetect=d=0.5:pix_th=0.10",
      "-an",
      "-f",
      "null",
      "-",
    ]);
    return parseBlackSegments(stderr);
  } catch (error) {
    return parseBlackSegments(String((error as { stderr?: string }).stderr ?? ""));
  }
};

export const runPostRenderQa = async (input: {
  videoPath: string;
  expectedDurationSeconds: number;
  expectedWidth: number;
  expectedHeight: number;
}): Promise<VideoQualityReport> => {
  const probe = await probeVideo(input.videoPath);
  const blackSegments = await detectBlackSegments(input.videoPath);
  return evaluatePostRenderQa({
    ...input,
    probe,
    blackSegments,
  });
};
