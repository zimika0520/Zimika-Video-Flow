import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createAudioFingerprint,
  createScriptFingerprint,
  type TtsGenerationResult,
  type TtsTimingUnit,
  validateTtsTimingUnits,
} from "./tts-provider";

type GenerateMiniMaxAudioInput = {
  text: string;
  outputDir: string;
  fileName?: string;
  voiceId?: string;
};

type GenerateMiniMaxAudioResult = TtsGenerationResult & {
  audioPath: string;
  fileName: string;
};

const minimaxApiBase = "https://api.minimax.chat/v1/t2a_v2";
const defaultModel = "speech-2.8-hd";
const fallbackVoiceId = "Chinese (Mandarin)_Reliable_Executive";

const buildMiniMaxUrl = () => {
  const endpoint = process.env.MINIMAX_TTS_ENDPOINT || minimaxApiBase;
  const groupId = process.env.MINIMAX_GROUP_ID?.trim();
  if (!groupId || endpoint.includes("GroupId=")) return endpoint;

  const url = new URL(endpoint);
  url.searchParams.set("GroupId", groupId);
  return url.toString();
};

const getHexAudio = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== "object") return undefined;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return undefined;
  const audio = (data as { audio?: unknown }).audio;
  return typeof audio === "string" && audio.length > 0 ? audio : undefined;
};

const getErrorMessage = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== "object") return undefined;
  const baseResp = (payload as { base_resp?: unknown }).base_resp;
  if (!baseResp || typeof baseResp !== "object") return undefined;
  const statusMsg = (baseResp as { status_msg?: unknown }).status_msg;
  return typeof statusMsg === "string" && statusMsg ? statusMsg : undefined;
};

const getDurationMs = (payload: unknown): number | undefined => {
  if (!payload || typeof payload !== "object") return undefined;
  const extraInfo = (payload as { extra_info?: unknown }).extra_info;
  if (!extraInfo || typeof extraInfo !== "object") return undefined;
  const audioLength = (extraInfo as { audio_length?: unknown }).audio_length;
  return typeof audioLength === "number" ? audioLength : undefined;
};

const getSubtitleFileUrl = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== "object") return undefined;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return undefined;
  const subtitleFile = (data as { subtitle_file?: unknown }).subtitle_file;
  return typeof subtitleFile === "string" && subtitleFile.length > 0 ? subtitleFile : undefined;
};

const getRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

const getMiniMaxSubtitleItems = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;

  const root = getRecord(payload);
  if (!root) return [];
  if (Array.isArray(root.subtitles)) return root.subtitles;
  if (Array.isArray(root.data)) return root.data;

  const data = getRecord(root.data);
  if (Array.isArray(data?.subtitles)) return data.subtitles;
  return [];
};

const normalizeMiniMaxSubtitles = (payload: unknown): TtsTimingUnit[] => {
  const subtitles = getMiniMaxSubtitleItems(payload);
  if (subtitles.length === 0) return [];

  const timings = subtitles.flatMap((subtitle, index): TtsTimingUnit[] => {
    if (!subtitle || typeof subtitle !== "object") {
      throw new Error(`MiniMax 原生时间戳无效：第 ${index + 1} 个单元`);
    }
    const item = subtitle as {
      text?: unknown;
      start_time?: unknown;
      end_time?: unknown;
      timestamped_words?: unknown;
    };

    if (Array.isArray(item.timestamped_words) && item.timestamped_words.length > 0) {
      return item.timestamped_words.map((word, wordIndex): TtsTimingUnit => {
        const wordItem = getRecord(word);
        const text = wordItem?.word;
        const startMs = wordItem?.time_begin;
        const endMs = wordItem?.time_end;
        const sourceStart = wordItem?.word_begin;
        const sourceEnd = wordItem?.word_end;
        if (
          typeof text !== "string"
          || text.length === 0
          || typeof startMs !== "number"
          || typeof endMs !== "number"
          || typeof sourceStart !== "number"
          || typeof sourceEnd !== "number"
        ) {
          throw new Error(
            `MiniMax 原生时间戳无效：第 ${index + 1} 段第 ${wordIndex + 1} 个单元`,
          );
        }

        return {
          text,
          startMs,
          endMs,
          kind: sourceEnd - sourceStart === 1 ? "character" : "word",
          sourceStart,
          sourceEnd,
        };
      });
    }

    if (
      typeof item.text !== "string"
      || item.text.length === 0
      || typeof item.start_time !== "number"
      || typeof item.end_time !== "number"
    ) {
      throw new Error(`MiniMax 原生时间戳无效：第 ${index + 1} 个单元`);
    }

    return [{
      text: item.text,
      startMs: item.start_time,
      endMs: item.end_time,
      kind: "word",
    }];
  });

  validateTtsTimingUnits(timings);
  return timings;
};

const redactSecret = (message: string, secret: string): string =>
  message.split(secret).join("[REDACTED]");

const toSafeProviderError = (cause: unknown, apiKey: string, fallback: string): Error => {
  const message = cause instanceof Error && cause.message.trim()
    ? cause.message
    : fallback;
  return new Error(redactSecret(message, apiKey));
};

export const generateMiniMaxAudio = async ({
  text,
  outputDir,
  fileName = "口播音频.mp3",
  voiceId: requestedVoiceId,
}: GenerateMiniMaxAudioInput): Promise<GenerateMiniMaxAudioResult> => {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  if (!apiKey) throw new Error("缺少 MINIMAX_API_KEY，请先写入 .env.local");

  const cleanText = text.trim();
  if (!cleanText) throw new Error("口播文案不能为空");

  const model = process.env.MINIMAX_TTS_MODEL || defaultModel;
  const voiceId = requestedVoiceId?.trim() || process.env.MINIMAX_VOICE_ID || fallbackVoiceId;

  let response: Response;
  try {
    response = await fetch(buildMiniMaxUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        text: cleanText,
        stream: false,
        language_boost: "Chinese",
        output_format: "hex",
        subtitle_enable: true,
        subtitle_type: "word",
        voice_setting: {
          voice_id: voiceId,
          speed: Number(process.env.MINIMAX_TTS_SPEED || 1),
          vol: Number(process.env.MINIMAX_TTS_VOLUME || 1),
          pitch: Number(process.env.MINIMAX_TTS_PITCH || 0),
        },
        audio_setting: {
          sample_rate: Number(process.env.MINIMAX_TTS_SAMPLE_RATE || 32000),
          bitrate: Number(process.env.MINIMAX_TTS_BITRATE || 128000),
          format: "mp3",
          channel: 1,
        },
      }),
    });
  } catch (cause) {
    throw toSafeProviderError(cause, apiKey, "MiniMax 口播音频请求失败");
  }

  const payload = await response.json().catch(() => undefined);
  const audioHex = getHexAudio(payload);

  if (!response.ok || !audioHex) {
    throw toSafeProviderError(
      new Error(getErrorMessage(payload) || "MiniMax 口播音频生成失败"),
      apiKey,
      "MiniMax 口播音频生成失败",
    );
  }

  const subtitleFileUrl = getSubtitleFileUrl(payload);
  if (!subtitleFileUrl) {
    throw new Error("MiniMax 没有返回原生时间戳，无法继续生成视频");
  }

  let subtitleResponse: Response;
  try {
    subtitleResponse = await fetch(subtitleFileUrl);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    const redacted = redactSecret(message, apiKey);
    throw new Error(
      redacted === message
        ? "MiniMax 原生时间戳下载失败"
        : "MiniMax 原生时间戳下载失败：[REDACTED]",
    );
  }
  const subtitlePayload = await subtitleResponse.json().catch(() => undefined);
  const timings = normalizeMiniMaxSubtitles(subtitlePayload);
  if (!subtitleResponse.ok || timings.length === 0) {
    throw new Error("MiniMax 原生时间戳下载或解析失败");
  }
  const reportedDurationMs = getDurationMs(payload);
  if (reportedDurationMs !== undefined) {
    validateTtsTimingUnits(timings, { durationMs: reportedDurationMs });
  }

  await mkdir(outputDir, { recursive: true });
  const audioPath = path.join(outputDir, fileName);
  const voiceoverPath = path.join(outputDir, "口播文案.md");
  await writeFile(audioPath, Buffer.from(audioHex, "hex"));
  await writeFile(voiceoverPath, `${cleanText}\n`, "utf8");
  const durationMs = reportedDurationMs ?? timings.at(-1)?.endMs;
  if (durationMs === undefined) {
    throw new Error("MiniMax 没有返回有效音频时长");
  }

  return {
    provider: "minimax",
    audioPath,
    fileName,
    voiceoverPath,
    durationMs,
    model,
    voiceId,
    timings,
    audioFingerprint: await createAudioFingerprint(audioPath),
    scriptFingerprint: createScriptFingerprint(cleanText),
  };
};
