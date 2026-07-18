import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createAudioFingerprint,
  createScriptFingerprint,
  type TtsGenerationResult,
  type TtsTimingUnit,
  validateTtsTimingUnits,
} from "./tts-provider";

type VolcengineUtterance = {
  word?: unknown;
  startTime?: unknown;
  endTime?: unknown;
};

type VolcengineSentence = {
  text?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  words?: unknown;
};

type GenerateVolcengineAudioInput = {
  text: string;
  outputDir: string;
  fileName?: string;
  voiceId?: string;
};

const defaultEndpoint = "https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse";
const defaultResourceId = "seed-tts-2.0";
const defaultVoiceId = "zh_female_xiaohe_uranus_bigtts";

export const normalizeVolcengineUtterances = (
  utterances: VolcengineUtterance[],
): TtsTimingUnit[] => {
  const timings = utterances.map((utterance, index): TtsTimingUnit => {
    if (
      typeof utterance.word !== "string"
      || utterance.word.length === 0
      || typeof utterance.startTime !== "number"
      || typeof utterance.endTime !== "number"
    ) {
      throw new Error(`火山引擎字幕时间戳无效：第 ${index + 1} 个单元`);
    }

    return {
      text: utterance.word,
      startMs: utterance.startTime * 1000,
      endMs: utterance.endTime * 1000,
      kind: "word",
    };
  });

  validateTtsTimingUnits(timings);
  return timings;
};

type VolcengineEvent = {
  event: number;
  data: unknown;
};

const knownEventCodes = new Set([152, 153, 351, 352]);

const parseEventFrame = (frame: string): VolcengineEvent | undefined => {
  let event: number | undefined;
  const dataLines: string[] = [];
  let hasProtocolField = false;

  for (const line of frame.split(/\r?\n/u)) {
    if (!line || line.startsWith(":")) continue;
    hasProtocolField = true;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const rawValue = separator === -1 ? "" : line.slice(separator + 1);
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;

    if (field.toLocaleLowerCase("en-US") === "event") {
      const parsed = Number(value);
      if (Number.isInteger(parsed)) event = parsed;
    } else if (field.toLocaleLowerCase("en-US") === "data") {
      dataLines.push(value);
    }
  }

  if (!hasProtocolField) return undefined;
  if (event === undefined) throw new Error("火山引擎事件帧缺少有效 Event 编号");
  if (!knownEventCodes.has(event)) return { event, data: undefined };
  if (dataLines.length === 0) throw new Error(`火山引擎 Event ${event} 缺少 data 字段`);
  const rawData = dataLines.join("\n");

  try {
    return { event, data: JSON.parse(rawData) };
  } catch {
    throw new Error(`火山引擎返回了无法解析的事件 ${event}`);
  }
};

const readEventStream = async (response: Response): Promise<VolcengineEvent[]> => {
  if (!response.body) throw new Error("火山引擎没有返回事件流");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: VolcengineEvent[] = [];
  let buffer = "";

  const consumeFrames = (flush: boolean) => {
    let boundary = buffer.match(/\r?\n\r?\n/u);
    while (boundary?.index !== undefined) {
      const frame = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      const parsed = parseEventFrame(frame);
      if (parsed) events.push(parsed);
      boundary = buffer.match(/\r?\n\r?\n/u);
    }

    if (flush && buffer.trim()) {
      const parsed = parseEventFrame(buffer);
      if (parsed) events.push(parsed);
      buffer = "";
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    consumeFrames(false);
  }

  buffer += decoder.decode();
  consumeFrames(true);
  return events;
};

const getErrorMessage = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== "object") return undefined;
  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : undefined;
};

const redactSecret = (message: string, secret: string): string =>
  message.split(secret).join("[REDACTED]");

const toSafeProviderError = (cause: unknown, apiKey: string, fallback: string): Error => {
  const message = cause instanceof Error && cause.message.trim()
    ? cause.message
    : fallback;
  return new Error(redactSecret(message, apiKey));
};

const getRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object"
    ? value as Record<string, unknown>
    : undefined;

const getAudioChunk = (payload: unknown): string | undefined => {
  const record = getRecord(payload);
  if (!record) return undefined;
  const data = record.data;
  return typeof data === "string" && data.length > 0 ? data : undefined;
};

const getSubtitleWords = (payload: unknown): VolcengineUtterance[] => {
  const record = getRecord(payload);
  const sentence = getRecord(record?.sentence) as VolcengineSentence | undefined;
  const words = sentence?.words;
  return Array.isArray(words) ? words as VolcengineUtterance[] : [];
};

const getSubtitleTimings = (payload: unknown): TtsTimingUnit[] => {
  const words = getSubtitleWords(payload);
  if (words.length > 0) return normalizeVolcengineUtterances(words);

  const record = getRecord(payload);
  const sentence = getRecord(record?.sentence) as VolcengineSentence | undefined;
  if (
    typeof sentence?.text !== "string"
    || sentence.text.length === 0
    || typeof sentence.startTime !== "number"
    || typeof sentence.endTime !== "number"
  ) {
    throw new Error("火山引擎 Event 351 缺少有效字幕时间戳");
  }

  const timings: TtsTimingUnit[] = [{
    text: sentence.text,
    startMs: sentence.startTime * 1000,
    endMs: sentence.endTime * 1000,
    kind: "sentence",
  }];
  validateTtsTimingUnits(timings);
  return timings;
};

const requireEventCode = (
  payload: unknown,
  event: number,
  expectedCode: number,
  apiKey: string,
): Record<string, unknown> => {
  const record = getRecord(payload);
  if (!record || record.code !== expectedCode) {
    const providerMessage = getErrorMessage(payload);
    throw toSafeProviderError(
      new Error(
        providerMessage
          ? `火山引擎 Event ${event} 执行失败：${providerMessage}`
          : `火山引擎 Event ${event} 返回码无效`,
      ),
      apiKey,
      `火山引擎 Event ${event} 执行失败`,
    );
  }
  return record;
};

const decodeAudioChunk = (payload: unknown, event: number): Buffer => {
  const audioChunk = getAudioChunk(payload)?.replace(/\s+/gu, "");
  if (!audioChunk || !/^[A-Za-z0-9+/]*={0,2}$/u.test(audioChunk)) {
    throw new Error(`火山引擎 Event ${event} 缺少有效音频分片`);
  }

  const decoded = Buffer.from(audioChunk, "base64");
  const normalizedInput = audioChunk.replace(/=+$/u, "");
  const normalizedOutput = decoded.toString("base64").replace(/=+$/u, "");
  if (decoded.length === 0 || normalizedOutput !== normalizedInput) {
    throw new Error(`火山引擎 Event ${event} 音频分片不是有效 Base64`);
  }
  return decoded;
};

export const generateVolcengineAudio = async ({
  text,
  outputDir,
  fileName = "口播音频.mp3",
  voiceId: requestedVoiceId,
}: GenerateVolcengineAudioInput): Promise<TtsGenerationResult> => {
  const apiKey = process.env.VOLCENGINE_TTS_API_KEY?.trim();
  if (!apiKey) throw new Error("缺少 VOLCENGINE_TTS_API_KEY，请先写入 .env.local");

  const cleanText = text.trim();
  if (!cleanText) throw new Error("口播文案不能为空");

  const endpoint = process.env.VOLCENGINE_TTS_ENDPOINT || defaultEndpoint;
  const model = process.env.VOLCENGINE_TTS_RESOURCE_ID || defaultResourceId;
  const voiceId = requestedVoiceId?.trim() || process.env.VOLCENGINE_TTS_VOICE_ID || defaultVoiceId;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        "X-Api-Resource-Id": model,
        "X-Api-Request-Id": randomUUID(),
      },
      body: JSON.stringify({
        user: {
          uid: "shin-video",
        },
        req_params: {
          speaker: voiceId,
          audio_params: {
            format: "mp3",
            sample_rate: 24000,
            enable_subtitle: true,
          },
          text: cleanText,
        },
      }),
    });
  } catch (cause) {
    throw toSafeProviderError(cause, apiKey, "火山引擎口播音频请求失败");
  }

  let events: VolcengineEvent[];
  try {
    events = await readEventStream(response);
  } catch (cause) {
    throw toSafeProviderError(cause, apiKey, "火山引擎事件流解析失败");
  }

  const audioChunks: Buffer[] = [];
  const timings: TtsTimingUnit[] = [];
  let completed = false;

  for (const frame of events) {
    if (frame.event === 153) {
      throw toSafeProviderError(
        new Error(getErrorMessage(frame.data) || "火山引擎口播音频生成失败"),
        apiKey,
        "火山引擎口播音频生成失败",
      );
    }
    if (completed) continue;

    if (frame.event === 352) {
      requireEventCode(frame.data, frame.event, 0, apiKey);
      audioChunks.push(decodeAudioChunk(frame.data, frame.event));
    } else if (frame.event === 351) {
      requireEventCode(frame.data, frame.event, 0, apiKey);
      timings.push(...getSubtitleTimings(frame.data));
    } else if (frame.event === 152) {
      requireEventCode(frame.data, frame.event, 20000000, apiKey);
      completed = true;
    }
  }

  if (!response.ok) {
    throw new Error("火山引擎口播音频生成失败");
  }
  if (audioChunks.length === 0) {
    throw new Error("火山引擎没有返回有效音频");
  }
  if (timings.length === 0) {
    throw new Error("火山引擎没有返回原生时间戳，无法继续生成视频");
  }
  if (!completed) {
    throw new Error("火山引擎事件流缺少 Event 152 完成帧");
  }
  validateTtsTimingUnits(timings);

  await mkdir(outputDir, { recursive: true });
  const audioPath = path.join(outputDir, fileName);
  const voiceoverPath = path.join(outputDir, "口播文案.md");
  await writeFile(audioPath, Buffer.concat(audioChunks));
  await writeFile(voiceoverPath, `${cleanText}\n`, "utf8");

  const durationMs = timings.at(-1)?.endMs;
  if (durationMs === undefined) {
    throw new Error("火山引擎没有返回有效音频时长");
  }

  return {
    provider: "volcengine",
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
