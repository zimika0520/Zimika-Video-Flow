import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { generateCustomTtsAudio } from "@/lib/custom-tts";

describe("custom TTS provider", () => {
  const originalEnvironment = {
    endpoint: process.env.CUSTOM_TTS_ENDPOINT,
    apiKey: process.env.CUSTOM_TTS_API_KEY,
    model: process.env.CUSTOM_TTS_MODEL,
    voiceId: process.env.CUSTOM_TTS_VOICE_ID,
  };

  beforeEach(() => {
    process.env.CUSTOM_TTS_ENDPOINT = "https://tts.example.test/v1/generate";
    process.env.CUSTOM_TTS_API_KEY = "custom-secret";
    process.env.CUSTOM_TTS_MODEL = "custom-model";
    process.env.CUSTOM_TTS_VOICE_ID = "custom-voice";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      const environmentKey = {
        endpoint: "CUSTOM_TTS_ENDPOINT",
        apiKey: "CUSTOM_TTS_API_KEY",
        model: "CUSTOM_TTS_MODEL",
        voiceId: "CUSTOM_TTS_VOICE_ID",
      }[key]!;
      if (value === undefined) delete process.env[environmentKey];
      else process.env[environmentKey] = value;
    }
    vi.unstubAllGlobals();
  });

  test("writes audio and the exact confirmed script from a timestamped response", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_input, init) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer custom-secret");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        text: "自定义模型也必须返回原生时间戳。",
        model: "custom-model",
        voice_id: "custom-voice",
        timestamps: true,
      });
      return new Response(JSON.stringify({
        audio_base64: Buffer.from("custom-audio").toString("base64"),
        duration_ms: 1800,
        model: "provider-model",
        voice_id: "provider-voice",
        timings: [
          {
            text: "自定义模型也必须返回原生时间戳",
            start_ms: 0,
            end_ms: 1800,
            kind: "sentence",
          },
        ],
      }), { status: 200 });
    }));

    const outputDir = await mkdtemp(path.join(tmpdir(), "shin-custom-tts-"));
    const result = await generateCustomTtsAudio({
      text: "自定义模型也必须返回原生时间戳。",
      outputDir,
    });

    expect(result).toMatchObject({
      provider: "custom",
      model: "provider-model",
      voiceId: "provider-voice",
      durationMs: 1800,
      timings: [
        {
          text: "自定义模型也必须返回原生时间戳",
          startMs: 0,
          endMs: 1800,
          kind: "sentence",
        },
      ],
    });
    await expect(readFile(result.audioPath, "utf8")).resolves.toBe("custom-audio");
    await expect(readFile(result.voiceoverPath, "utf8")).resolves.toBe("自定义模型也必须返回原生时间戳。\n");
  });

  test("rejects a response that has audio but no provider-native timestamps", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      audio_base64: Buffer.from("custom-audio").toString("base64"),
      duration_ms: 1800,
    }), { status: 200 })));

    const outputDir = await mkdtemp(path.join(tmpdir(), "shin-custom-tts-"));
    await expect(generateCustomTtsAudio({
      text: "没有时间戳不能继续。",
      outputDir,
    })).rejects.toThrow("原生时间戳");
  });

  test("redacts API keys, authorization values, cookies, and signed endpoint URLs from errors", async () => {
    process.env.CUSTOM_TTS_ENDPOINT = "https://tts.example.test/v1/generate?signature=signed-secret";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: "Authorization: Bearer custom-secret; Cookie: session=cookie-secret; https://tts.example.test/v1/generate?signature=signed-secret",
    }), { status: 401 })));

    const outputDir = await mkdtemp(path.join(tmpdir(), "shin-custom-tts-"));
    const error = await generateCustomTtsAudio({
      text: "错误信息必须脱敏。",
      outputDir,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("[REDACTED]");
    expect((error as Error).message).not.toContain("custom-secret");
    expect((error as Error).message).not.toContain("cookie-secret");
    expect((error as Error).message).not.toContain("signed-secret");
  });
});
