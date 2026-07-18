import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export type TtsProviderName = "minimax" | "volcengine" | "custom";

export type TtsTimingUnit = {
  text: string;
  startMs: number;
  endMs: number;
  kind: "character" | "word" | "sentence";
  sourceStart?: number;
  sourceEnd?: number;
};

export type TtsGenerationResult = {
  provider: TtsProviderName;
  model: string;
  voiceId: string;
  audioPath: string;
  voiceoverPath: string;
  durationMs: number;
  timings: TtsTimingUnit[];
  audioFingerprint: string;
  scriptFingerprint: string;
};

export type SubtitleTimelineSegment = {
  id: string;
  text: string;
  start: number;
  end: number;
  timingConfidence: number;
};

export type ProviderNativeSubtitleTimeline = {
  subtitleTimelineVersion: number;
  source: "provider-native";
  provider: TtsProviderName;
  audioFingerprint: string;
  scriptFingerprint: string;
  segments: SubtitleTimelineSegment[];
};

const providerNames = new Set<TtsProviderName>(["minimax", "volcengine", "custom"]);

export const parseProviderNativeSubtitleTimeline = (
  value: unknown,
): ProviderNativeSubtitleTimeline => {
  if (!value || typeof value !== "object") {
    throw new Error("字幕时间轴无效，必须提供服务商原生时间戳 JSON");
  }

  const timeline = value as Partial<ProviderNativeSubtitleTimeline>;
  if (timeline.subtitleTimelineVersion !== 1) {
    throw new Error("字幕时间轴版本无效");
  }
  if (timeline.source !== "provider-native") {
    throw new Error("字幕时间轴来源无效，必须使用服务商原生时间戳");
  }
  if (!timeline.provider || !providerNames.has(timeline.provider)) {
    throw new Error("字幕时间轴服务商无效");
  }
  if (
    typeof timeline.audioFingerprint !== "string"
    || timeline.audioFingerprint.length === 0
    || typeof timeline.scriptFingerprint !== "string"
    || timeline.scriptFingerprint.length === 0
  ) {
    throw new Error("字幕时间轴缺少音频或文案指纹");
  }
  if (!Array.isArray(timeline.segments) || timeline.segments.length === 0) {
    throw new Error("字幕时间轴缺少服务商原生时间段");
  }

  let previousEnd = 0;
  timeline.segments.forEach((segment, index) => {
    if (
      !segment
      || typeof segment.id !== "string"
      || segment.id.length === 0
      || typeof segment.text !== "string"
      || segment.text.length === 0
    ) {
      throw new Error(`服务商原生字幕时间轴无效：第 ${index + 1} 段`);
    }
    if (
      !Number.isFinite(segment.start)
      || !Number.isFinite(segment.end)
      || segment.start < 0
      || segment.end <= segment.start
    ) {
      throw new Error(`服务商原生字幕时间轴时间区间无效：第 ${index + 1} 段`);
    }
    if (index > 0 && segment.start < previousEnd) {
      throw new Error(`服务商原生字幕时间轴未递增：第 ${index + 1} 段`);
    }
    if (
      !Number.isFinite(segment.timingConfidence)
      || segment.timingConfidence < 0
      || segment.timingConfidence > 1
    ) {
      throw new Error(`服务商原生字幕时间轴置信度无效：第 ${index + 1} 段`);
    }
    previousEnd = segment.end;
  });

  return timeline as ProviderNativeSubtitleTimeline;
};

type BuildSubtitleTimelineInput = {
  provider: TtsProviderName;
  audioPath: string;
  voiceoverPath: string;
  timings: TtsTimingUnit[];
};

type ValidateSubtitleTimelineFilesInput = {
  timeline: ProviderNativeSubtitleTimeline;
  audioPath: string;
  voiceoverPath: string;
};

type CharacterTiming = {
  startMs: number;
  endMs: number;
  confidence: number;
};

const timingConfidence = (kind: TtsTimingUnit["kind"]): number => {
  if (kind === "character") return 1;
  if (kind === "word") return 0.9;
  return 0.75;
};

const canonicalizeConfirmedScript = (text: string): string =>
  text.replace(/^\uFEFF/, "").replace(/(?:\r?\n)+$/, "");

const comparisonCharacters = (text: string): string[] =>
  Array.from(text.normalize("NFKC").toLocaleLowerCase("en-US"))
    .filter((character) => /[\p{L}\p{N}]/u.test(character));

const normalizeForComparison = (text: string): string =>
  comparisonCharacters(text).join("");

const sentenceRanges = (script: string): Array<{ text: string; normalizedLength: number }> => {
  const ranges: Array<{ text: string; normalizedLength: number }> = [];
  let current = "";
  let reachedSentenceBoundary = false;

  for (const character of Array.from(script)) {
    if (reachedSentenceBoundary && comparisonCharacters(character).length > 0) {
      ranges.push({
        text: current,
        normalizedLength: comparisonCharacters(current).length,
      });
      current = "";
      reachedSentenceBoundary = false;
    }

    current += character;
    if (/[。！？!?；;]/u.test(character)) {
      reachedSentenceBoundary = true;
    }
  }

  if (current) {
    ranges.push({
      text: current,
      normalizedLength: comparisonCharacters(current).length,
    });
  }

  return ranges.filter((range) => range.text.length > 0);
};

export const validateTtsTimingUnits = (
  timings: TtsTimingUnit[],
  options: { durationMs?: number } = {},
): void => {
  let previousEndMs = 0;
  let previousSourceEnd: number | undefined;

  timings.forEach((timing, index) => {
    if (
      typeof timing.text !== "string"
      || timing.text.length === 0
      || !Number.isFinite(timing.startMs)
      || !Number.isFinite(timing.endMs)
      || timing.startMs < 0
      || timing.endMs <= timing.startMs
    ) {
      throw new Error(`TTS 原生时间戳无效：第 ${index + 1} 个时间单元`);
    }

    if (index > 0 && timing.startMs < previousEndMs) {
      throw new Error(`TTS 原生时间戳未全局递增：第 ${index + 1} 个时间单元发生倒退或重叠`);
    }

    if (
      options.durationMs !== undefined
      && (!Number.isFinite(options.durationMs) || options.durationMs <= 0)
    ) {
      throw new Error("TTS 服务商返回的音频时长无效");
    }
    if (options.durationMs !== undefined && timing.endMs > options.durationMs) {
      throw new Error(`TTS 原生时间戳超过音频时长：第 ${index + 1} 个时间单元`);
    }

    const hasSourceStart = timing.sourceStart !== undefined;
    const hasSourceEnd = timing.sourceEnd !== undefined;
    if (hasSourceStart !== hasSourceEnd) {
      throw new Error(`TTS 原生时间戳源位置无效：第 ${index + 1} 个时间单元`);
    }
    const sourceStart = timing.sourceStart;
    const sourceEnd = timing.sourceEnd;
    if (sourceStart !== undefined && sourceEnd !== undefined) {
      if (
        !Number.isInteger(sourceStart)
        || !Number.isInteger(sourceEnd)
        || sourceStart < 0
        || sourceEnd <= sourceStart
      ) {
        throw new Error(`TTS 原生时间戳源位置无效：第 ${index + 1} 个时间单元`);
      }
      if (previousSourceEnd !== undefined && sourceStart < previousSourceEnd) {
        throw new Error(`TTS 原生时间戳源位置未递增：第 ${index + 1} 个时间单元`);
      }
      previousSourceEnd = sourceEnd;
    }

    previousEndMs = timing.endMs;
  });
};

const buildCharacterTimings = (timings: TtsTimingUnit[]): {
  normalizedText: string;
  characters: CharacterTiming[];
} => {
  const normalizedParts: string[] = [];
  const characters: CharacterTiming[] = [];

  validateTtsTimingUnits(timings);

  for (const timing of timings) {
    const normalized = comparisonCharacters(timing.text);
    if (normalized.length === 0) continue;

    const duration = timing.endMs - timing.startMs;
    normalizedParts.push(normalized.join(""));
    normalized.forEach((_character, index) => {
      characters.push({
        startMs: timing.startMs + (duration * index) / normalized.length,
        endMs: timing.startMs + (duration * (index + 1)) / normalized.length,
        confidence: timingConfidence(timing.kind),
      });
    });
  }

  return {
    normalizedText: normalizedParts.join(""),
    characters,
  };
};

export const createAudioFingerprint = async (audioPath: string): Promise<string> =>
  createHash("sha256").update(await readFile(audioPath)).digest("hex");

export const createScriptFingerprint = (script: string): string =>
  createHash("sha256").update(canonicalizeConfirmedScript(script), "utf8").digest("hex");

export const buildSubtitleTimeline = async ({
  provider,
  audioPath,
  voiceoverPath,
  timings,
}: BuildSubtitleTimelineInput): Promise<ProviderNativeSubtitleTimeline> => {
  if (timings.length === 0) {
    throw new Error("TTS 服务商没有返回可用时间戳");
  }

  const script = canonicalizeConfirmedScript(await readFile(voiceoverPath, "utf8"));
  if (!script) throw new Error("确认后的口播文案不能为空");

  const normalizedScript = normalizeForComparison(script);
  const providerTiming = buildCharacterTimings(timings);
  if (!normalizedScript || providerTiming.normalizedText !== normalizedScript) {
    throw new Error("TTS 时间戳文本无法映射回确认后的口播文案");
  }

  const ranges = sentenceRanges(script);
  const segments: SubtitleTimelineSegment[] = [];
  let normalizedOffset = 0;

  ranges.forEach((range, index) => {
    if (range.normalizedLength === 0) return;

    const startCharacter = providerTiming.characters[normalizedOffset];
    const endCharacter = providerTiming.characters[normalizedOffset + range.normalizedLength - 1];
    if (!startCharacter || !endCharacter) {
      throw new Error("TTS 时间戳文本无法映射回确认后的口播文案");
    }

    segments.push({
      id: `caption-${String(index + 1).padStart(4, "0")}`,
      text: range.text,
      start: startCharacter.startMs / 1000,
      end: endCharacter.endMs / 1000,
      timingConfidence: Math.min(
        ...providerTiming.characters
          .slice(normalizedOffset, normalizedOffset + range.normalizedLength)
          .map((character) => character.confidence),
      ),
    });
    normalizedOffset += range.normalizedLength;
  });

  if (segments.length === 0 || normalizedOffset !== providerTiming.characters.length) {
    throw new Error("TTS 时间戳文本无法映射回确认后的口播文案");
  }

  return {
    subtitleTimelineVersion: 1,
    source: "provider-native",
    provider,
    audioFingerprint: await createAudioFingerprint(audioPath),
    scriptFingerprint: createScriptFingerprint(script),
    segments,
  };
};

export const validateSubtitleTimelineFiles = async ({
  timeline,
  audioPath,
  voiceoverPath,
}: ValidateSubtitleTimelineFilesInput): Promise<void> => {
  const validTimeline = parseProviderNativeSubtitleTimeline(timeline);

  const currentAudioFingerprint = await createAudioFingerprint(audioPath);
  if (validTimeline.audioFingerprint !== currentAudioFingerprint) {
    throw new Error("字幕时间轴的音频指纹已失效，请重新生成时间轴");
  }

  const script = canonicalizeConfirmedScript(await readFile(voiceoverPath, "utf8"));
  const currentScriptFingerprint = createScriptFingerprint(script);
  if (validTimeline.scriptFingerprint !== currentScriptFingerprint) {
    throw new Error("字幕时间轴的文案指纹已失效，请重新生成时间轴");
  }

  if (
    validTimeline.segments.map((segment) => segment.text).join("") !== script
  ) {
    throw new Error("字幕文本无法完整重建确认后的口播文案");
  }
};
