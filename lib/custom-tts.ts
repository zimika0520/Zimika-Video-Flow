import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createAudioFingerprint,
  createScriptFingerprint,
  type TtsGenerationResult,
  type TtsTimingUnit,
  validateTtsTimingUnits,
} from "./tts-provider";

type GenerateCustomTtsAudioInput = {
  text: string;
  outputDir: string;
  fileName?: string;
  voiceId?: string;
};

type CustomTimingPayload = {
  text?: unknown;
  start_ms?: unknown;
  startMs?: unknown;
  end_ms?: unknown;
  endMs?: unknown;
  kind?: unknown;
};

type CustomTtsPayload = {
  audio_base64?: unknown;
  audioBase64?: unknown;
  duration_ms?: unknown;
  durationMs?: unknown;
  model?: unknown;
  voice_id?: unknown;
  voiceId?: unknown;
  timings?: unknown;
  error?: unknown;
  message?: unknown;
  detail?: unknown;
};

const secretPatterns = [
  /authorization\s*:\s*[^\s;,]+(?:\s+[^\s;,]+)?/giu,
  /cookie\s*:\s*[^;\n]+/giu,
  /set-cookie\s*:\s*[^;\n]+/giu,
  /https?:\/\/[^\s"'<>]+[?&][^\s"'<>]+/giu,
];

const redactProviderMessage = (
  message: string,
  secrets: Array<string | undefined>,
): string => {
  let redacted = message;
  secrets
    .filter((secret): secret is string => Boolean(secret))
    .forEach((secret) => {
      redacted = redacted.split(secret).join("[REDACTED]");
    });
  secretPatterns.forEach((pattern) => {
    redacted = redacted.replace(pattern, "[REDACTED]");
  });
  return redacted;
};

const safeError = (
  cause: unknown,
  secrets: Array<string | undefined>,
  fallback: string,
): Error => {
  const message = cause instanceof Error && cause.message.trim()
    ? cause.message
    : fallback;
  return new Error(redactProviderMessage(message, secrets));
};

const getPayloadMessage = (payload: CustomTtsPayload | undefined): string | undefined => {
  const candidate = payload?.error ?? payload?.message ?? payload?.detail;
  return typeof candidate === "string" && candidate.trim() ? candidate : undefined;
};

const readNumber = (primary: unknown, fallback: unknown): number | undefined => {
  const value = primary ?? fallback;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const normalizeTimings = (value: unknown): TtsTimingUnit[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("自定义 TTS 没有返回原生时间戳，无法继续生成视频");
  }

  const timings = value.map((raw, index): TtsTimingUnit => {
    const timing = raw as CustomTimingPayload;
    const startMs = readNumber(timing.start_ms, timing.startMs);
    const endMs = readNumber(timing.end_ms, timing.endMs);
    const kind = timing.kind;
    if (
      typeof timing.text !== "string"
      || startMs === undefined
      || endMs === undefined
      || (kind !== "character" && kind !== "word" && kind !== "sentence")
    ) {
      throw new Error(`自定义 TTS 原生时间戳无效：第 ${index + 1} 个时间单元`);
    }
    return {
      text: timing.text,
      startMs,
      endMs,
      kind,
    };
  });

  validateTtsTimingUnits(timings);
  return timings;
};

const decodeBase64Audio = (value: unknown): Buffer => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("自定义 TTS 没有返回有效音频");
  }
  const normalized = value.replace(/\s+/gu, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(normalized)) {
    throw new Error("自定义 TTS 返回的音频不是有效 Base64");
  }
  const audio = Buffer.from(normalized, "base64");
  if (
    audio.length === 0
    || audio.toString("base64").replace(/=+$/u, "") !== normalized.replace(/=+$/u, "")
  ) {
    throw new Error("自定义 TTS 返回的音频不是有效 Base64");
  }
  return audio;
};

export const generateCustomTtsAudio = async ({
  text,
  outputDir,
  fileName = "口播音频.mp3",
  voiceId: requestedVoiceId,
}: GenerateCustomTtsAudioInput): Promise<TtsGenerationResult> => {
  const endpoint = process.env.CUSTOM_TTS_ENDPOINT?.trim();
  const apiKey = process.env.CUSTOM_TTS_API_KEY?.trim();
  if (!endpoint) throw new Error("缺少 CUSTOM_TTS_ENDPOINT，请先配置自定义 TTS 接口地址");
  if (!apiKey) throw new Error("缺少 CUSTOM_TTS_API_KEY，请先配置自定义 TTS API Key");

  let endpointUrl: URL;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    throw new Error("CUSTOM_TTS_ENDPOINT 不是有效 URL");
  }
  if (endpointUrl.protocol !== "https:" && endpointUrl.protocol !== "http:") {
    throw new Error("CUSTOM_TTS_ENDPOINT 只支持 HTTP 或 HTTPS");
  }

  const cleanText = text.trim();
  if (!cleanText) throw new Error("口播文案不能为空");

  const configuredModel = process.env.CUSTOM_TTS_MODEL?.trim() || "custom";
  const configuredVoiceId = requestedVoiceId?.trim()
    || process.env.CUSTOM_TTS_VOICE_ID?.trim()
    || "custom";
  const secrets = [apiKey, endpoint, endpointUrl.search];

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: cleanText,
        model: configuredModel,
        voice_id: configuredVoiceId,
        timestamps: true,
        audio_format: "mp3",
      }),
    });
  } catch (cause) {
    throw safeError(cause, secrets, "自定义 TTS 请求失败");
  }

  const payload = await response.json().catch(() => undefined) as CustomTtsPayload | undefined;
  if (!response.ok || !payload) {
    throw safeError(
      new Error(getPayloadMessage(payload) || `自定义 TTS 请求失败：HTTP ${response.status}`),
      secrets,
      "自定义 TTS 请求失败",
    );
  }

  let audio: Buffer;
  let timings: TtsTimingUnit[];
  try {
    audio = decodeBase64Audio(payload.audio_base64 ?? payload.audioBase64);
    timings = normalizeTimings(payload.timings);
  } catch (cause) {
    throw safeError(cause, secrets, "自定义 TTS 返回内容无效");
  }

  const durationMs = readNumber(payload.duration_ms, payload.durationMs)
    ?? timings.at(-1)?.endMs;
  if (durationMs === undefined || durationMs <= 0) {
    throw new Error("自定义 TTS 没有返回有效音频时长");
  }
  validateTtsTimingUnits(timings, { durationMs });

  const model = typeof payload.model === "string" && payload.model.trim()
    ? payload.model
    : configuredModel;
  const voiceId = typeof (payload.voice_id ?? payload.voiceId) === "string"
    && String(payload.voice_id ?? payload.voiceId).trim()
    ? String(payload.voice_id ?? payload.voiceId)
    : configuredVoiceId;

  await mkdir(outputDir, { recursive: true });
  const audioPath = path.join(outputDir, fileName);
  const voiceoverPath = path.join(outputDir, "口播文案.md");
  await writeFile(audioPath, audio);
  await writeFile(voiceoverPath, `${cleanText}\n`, "utf8");

  return {
    provider: "custom",
    model,
    voiceId,
    audioPath,
    voiceoverPath,
    durationMs,
    timings,
    audioFingerprint: await createAudioFingerprint(audioPath),
    scriptFingerprint: createScriptFingerprint(cleanText),
  };
};
