import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { generateVolcengineAudio, normalizeVolcengineUtterances } from "@/lib/volcengine-tts";

describe("Volcengine TTS provider", () => {
  const originalApiKey = process.env.VOLCENGINE_TTS_API_KEY;
  const originalEndpoint = process.env.VOLCENGINE_TTS_ENDPOINT;

  beforeEach(() => {
    process.env.VOLCENGINE_TTS_API_KEY = "volc-secret";
    delete process.env.VOLCENGINE_TTS_ENDPOINT;
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.VOLCENGINE_TTS_API_KEY;
    else process.env.VOLCENGINE_TTS_API_KEY = originalApiKey;
    if (originalEndpoint === undefined) delete process.env.VOLCENGINE_TTS_ENDPOINT;
    else process.env.VOLCENGINE_TTS_ENDPOINT = originalEndpoint;
    vi.unstubAllGlobals();
  });

  const rawEventStreamResponse = (stream: string) => {
    const encoded = new TextEncoder().encode(stream);
    const splitAt = Math.max(1, Math.floor(encoded.length / 2));

    return new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded.slice(0, splitAt));
        controller.enqueue(encoded.slice(splitAt));
        controller.close();
      },
    }), {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };

  const eventStreamResponse = (frames: Array<{ event: number; data: unknown }>) =>
    rawEventStreamResponse(frames.map(({ event, data }) => [
      `event: ${event}`,
      `data: ${JSON.stringify(data)}`,
      "",
    ].join("\n")).join("\n"));

  test("normalizes event 351 sentence words into provider-neutral millisecond timings", () => {
    expect(normalizeVolcengineUtterances([
      { word: "你好", startTime: 0, endTime: 0.5 },
      { word: "世界", startTime: 0.5, endTime: 1.1 },
    ])).toEqual([
      { text: "你好", startMs: 0, endMs: 500, kind: "word" },
      { text: "世界", startMs: 500, endMs: 1100, kind: "word" },
    ]);
  });

  test("writes audio and confirmed script without exposing the API key", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      expect(String(input)).toBe("https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse");
      expect((init?.headers as Record<string, string>)["X-Api-Key"]).toBe("volc-secret");
      const body = JSON.parse(String(init?.body));
      expect(body.request).toBeUndefined();
      expect(body.user).toEqual({ uid: "shin-video" });
      expect(body.req_params.text).toBe("火山引擎原生时间轴。");
      expect(body.req_params.speaker).toBe("zh_female_xiaohe_uranus_bigtts");
      expect(body.req_params.audio_params).toEqual({
        format: "mp3",
        sample_rate: 24000,
        enable_subtitle: true,
      });
      expect(body.req_params.audio_params.enable_subtitle).toBe(true);
      return eventStreamResponse([
        {
          event: 352,
          data: {
            code: 0,
            data: Buffer.from("volc-").toString("base64"),
          },
        },
        {
          event: 999,
          data: {
            code: 0,
            data: null,
          },
        },
        {
          event: 352,
          data: {
            code: 0,
            data: Buffer.from("audio").toString("base64"),
          },
        },
        {
          event: 351,
          data: {
            code: 0,
            data: null,
            sentence: {
              text: "火山引擎原生时间轴。",
              words: [
                { word: "火山引擎", startTime: 0, endTime: 0.8 },
                { word: "原生时间轴", startTime: 0.8, endTime: 1.6 },
              ],
            },
          },
        },
        {
          event: 152,
          data: {
            code: 20000000,
            message: "OK",
            data: null,
          },
        },
      ]);
    }));

    const outputDir = await mkdtemp(join(tmpdir(), "shin-volc-"));
    const result = await generateVolcengineAudio({
      text: "火山引擎原生时间轴。",
      outputDir,
    });

    await expect(readFile(result.audioPath, "utf8")).resolves.toBe("volc-audio");
    await expect(readFile(result.voiceoverPath, "utf8")).resolves.toBe("火山引擎原生时间轴。\n");
    expect(JSON.stringify(result)).not.toContain("volc-secret");
    expect(result.provider).toBe("volcengine");
    expect(result.timings).toHaveLength(2);
  });

  test("uses the endpoint environment override when configured", async () => {
    process.env.VOLCENGINE_TTS_ENDPOINT = "https://example.test/custom-volcengine-sse";
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      expect(String(input)).toBe("https://example.test/custom-volcengine-sse");
      return eventStreamResponse([
        {
          event: 352,
          data: { code: 0, data: Buffer.from("audio").toString("base64") },
        },
        {
          event: 351,
          data: {
            code: 0,
            sentence: {
              words: [{ word: "覆盖地址", startTime: 0, endTime: 1 }],
            },
          },
        },
        { event: 152, data: { code: 20000000, message: "OK" } },
      ]);
    }));

    const outputDir = await mkdtemp(join(tmpdir(), "shin-volc-"));
    await expect(generateVolcengineAudio({
      text: "覆盖地址",
      outputDir,
    })).resolves.toMatchObject({ durationMs: 1000 });
  });

  test("accepts sentence-level event 351 timestamps when words are absent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => eventStreamResponse([
      {
        event: 352,
        data: { code: 0, data: Buffer.from("audio").toString("base64") },
      },
      {
        event: 351,
        data: {
          code: 0,
          sentence: {
            text: "句级时间戳。",
            startTime: 0,
            endTime: 1.25,
          },
        },
      },
      { event: 152, data: { code: 20000000, message: "OK" } },
    ])));

    const outputDir = await mkdtemp(join(tmpdir(), "shin-volc-"));
    await expect(generateVolcengineAudio({
      text: "句级时间戳。",
      outputDir,
    })).resolves.toMatchObject({
      durationMs: 1250,
      timings: [
        { text: "句级时间戳。", startMs: 0, endMs: 1250, kind: "sentence" },
      ],
    });
  });

  test("ignores unknown events without data or with non-JSON data", async () => {
    const validFrames = [
      {
        event: 352,
        data: { code: 0, data: Buffer.from("audio").toString("base64") },
      },
      {
        event: 351,
        data: {
          code: 0,
          sentence: {
            words: [{ word: "忽略未知事件", startTime: 0, endTime: 1 }],
          },
        },
      },
      { event: 152, data: { code: 20000000, message: "OK" } },
    ].map(({ event, data }) => [
      `event: ${event}`,
      `data: ${JSON.stringify(data)}`,
      "",
    ].join("\n")).join("\n");

    vi.stubGlobal("fetch", vi.fn(async () => rawEventStreamResponse([
      "event: 999",
      "",
      "event: 998",
      "data: not-json",
      "",
      validFrames,
    ].join("\n"))));

    const outputDir = await mkdtemp(join(tmpdir(), "shin-volc-"));
    await expect(generateVolcengineAudio({
      text: "忽略未知事件",
      outputDir,
    })).resolves.toMatchObject({ durationMs: 1000 });
  });

  test.each([
    { event: 351, frame: "event: 351\n\n" },
    { event: 352, frame: "event: 352\ndata: not-json\n\n" },
    { event: 152, frame: "event: 152\n\n" },
    { event: 153, frame: "event: 153\ndata: not-json\n\n" },
  ])("strictly parses known Event $event frames", async ({ event, frame }) => {
    vi.stubGlobal("fetch", vi.fn(async () => rawEventStreamResponse(frame)));

    const outputDir = await mkdtemp(join(tmpdir(), "shin-volc-"));
    await expect(generateVolcengineAudio({
      text: "已知事件必须严格解析。",
      outputDir,
    })).rejects.toThrow(String(event));
  });

  test("fails when Event 153 appears after Event 152", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => eventStreamResponse([
      {
        event: 352,
        data: { code: 0, data: Buffer.from("audio").toString("base64") },
      },
      {
        event: 351,
        data: {
          code: 0,
          sentence: {
            words: [{ word: "完成后失败", startTime: 0, endTime: 1 }],
          },
        },
      },
      { event: 152, data: { code: 20000000, message: "OK" } },
      { event: 153, data: { code: 500, message: "late provider failure" } },
    ])));

    const outputDir = await mkdtemp(join(tmpdir(), "shin-volc-"));
    await expect(generateVolcengineAudio({
      text: "完成后失败",
      outputDir,
    })).rejects.toThrow("late provider failure");
  });

  test("redacts the API key from network error messages", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network rejected credential volc-secret");
    }));

    const outputDir = await mkdtemp(join(tmpdir(), "shin-volc-"));
    const error = await generateVolcengineAudio({
      text: "网络错误不能泄漏密钥。",
      outputDir,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("[REDACTED]");
    expect((error as Error).message).not.toContain("volc-secret");
  });

  test.each([351, 352])("redacts the API key from Event %s error messages", async (event) => {
    vi.stubGlobal("fetch", vi.fn(async () => eventStreamResponse([
      {
        event,
        data: {
          code: 401,
          message: `invalid credential: volc-secret in Event ${event}`,
        },
      },
    ])));

    const outputDir = await mkdtemp(join(tmpdir(), "shin-volc-"));
    const error = await generateVolcengineAudio({
      text: "事件错误不能泄漏密钥。",
      outputDir,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("[REDACTED]");
    expect((error as Error).message).not.toContain("volc-secret");
  });

  test("redacts the API key from provider error messages", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => eventStreamResponse([
      {
        event: 153,
        data: {
          code: 401,
          message: "invalid credential: volc-secret",
        },
      },
    ])));

    const outputDir = await mkdtemp(join(tmpdir(), "shin-volc-"));
    const error = await generateVolcengineAudio({
      text: "错误信息不能泄漏密钥。",
      outputDir,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain("volc-secret");
  });

  test.each([
    {
      label: "Event 352 without an audio chunk",
      frames: [
        { event: 352, data: { code: 0, data: null } },
        { event: 152, data: { code: 20000000, message: "OK", data: null } },
      ],
      expected: "Event 352",
    },
    {
      label: "Event 351 without subtitle words",
      frames: [
        {
          event: 352,
          data: { code: 0, data: Buffer.from("audio").toString("base64") },
        },
        {
          event: 351,
          data: { code: 0, data: null, sentence: { text: "缺少词级时间戳。" } },
        },
        { event: 152, data: { code: 20000000, message: "OK", data: null } },
      ],
      expected: "Event 351",
    },
  ])("rejects malformed confirmed event frames: $label", async ({ frames, expected }) => {
    vi.stubGlobal("fetch", vi.fn(async () => eventStreamResponse(frames)));

    const outputDir = await mkdtemp(join(tmpdir(), "shin-volc-"));
    await expect(generateVolcengineAudio({
      text: "事件字段必须完整。",
      outputDir,
    })).rejects.toThrow(expected);
  });

  test("requires the confirmed Event 152 completion frame", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => eventStreamResponse([
      {
        event: 352,
        data: { code: 0, data: Buffer.from("audio").toString("base64") },
      },
      {
        event: 351,
        data: {
          code: 0,
          data: null,
          sentence: {
            text: "必须完整结束。",
            words: [
              { word: "必须完整结束", startTime: 0, endTime: 1 },
            ],
          },
        },
      },
    ])));

    const outputDir = await mkdtemp(join(tmpdir(), "shin-volc-"));
    await expect(generateVolcengineAudio({
      text: "必须完整结束。",
      outputDir,
    })).rejects.toThrow("Event 152");
  });

  test("fails when the stream has no audio", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => eventStreamResponse([
      {
        event: 351,
        data: {
          code: 0,
          data: null,
          sentence: {
            text: "没有音频。",
            words: [
              { word: "没有音频", startTime: 0, endTime: 1 },
            ],
          },
        },
      },
      { event: 152, data: { code: 20000000, message: "OK", data: null } },
    ])));

    const outputDir = await mkdtemp(join(tmpdir(), "shin-volc-"));
    await expect(generateVolcengineAudio({
      text: "没有音频。",
      outputDir,
    })).rejects.toThrow("没有返回有效音频");
  });

  test("fails when the stream has no provider-native timings", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => eventStreamResponse([
      {
        event: 352,
        data: { code: 0, data: Buffer.from("audio").toString("base64") },
      },
      { event: 152, data: { code: 20000000, message: "OK", data: null } },
    ])));

    const outputDir = await mkdtemp(join(tmpdir(), "shin-volc-"));
    await expect(generateVolcengineAudio({
      text: "没有时间戳。",
      outputDir,
    })).rejects.toThrow("没有返回原生时间戳");
  });
});
