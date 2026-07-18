import { describe, expect, test } from "vitest";
import {
  buildNaturalResegmentCandidates,
  mergeRhetoricalContinuations,
  splitLongScenesAtTimelineBoundaries,
} from "@/lib/scene-resegment";
import type { Scene, TimelineSegment } from "@/lib/types";

const scene = (
  id: string,
  start: number,
  end: number,
  subtitle: string,
  overrides: Partial<Scene> = {},
): Scene => ({
  id,
  start,
  end,
  subtitle,
  images: [],
  layout: "quote",
  ...overrides,
});

const timeline: TimelineSegment[] = [
  { id: "t1", start: 0, end: 4.2, text: "推理成本持续增加。" },
  { id: "t2", start: 4.2, end: 9, text: "制程、HBM 和量产都是障碍。" },
];

const expectDirectionCleared = (item: Scene) => {
  expect(item).toMatchObject({
    semantics: undefined,
    directorType: undefined,
    rendererFamily: undefined,
    visualTreatment: undefined,
    directorContractIssues: undefined,
    content: undefined,
    components: undefined,
  });
};

describe("mergeRhetoricalContinuations", () => {
  test("merges an explicit not-but continuation without changing source wording", () => {
    const input = [
      scene("a", 0, 4.5, "DeepSeek 这次动手，核心不是要干掉谁。", {
        images: ["a.png", "shared.png"],
      }),
      scene("b", 4.5, 9, "而是它不想再一直等别人发货。", {
        images: ["shared.png", "b.png"],
      }),
    ];

    const result = mergeRhetoricalContinuations(input, 1);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "scene-0001",
      start: 0,
      end: 9,
      subtitle: "DeepSeek 这次动手，核心不是要干掉谁。而是它不想再一直等别人发货。",
      images: ["a.png", "shared.png", "b.png"],
    });
  });

  test.each([
    ["训练是一次性投入。", "推理是长期水电费。"],
    ["一条是英伟达。", "一条是国产替代芯片。"],
    ["一条是英伟达。", "另一条是国产替代芯片。"],
  ])("merges the strict rhetorical pair %s / %s", (left, right) => {
    expect(
      mergeRhetoricalContinuations(
        [scene("a", 0, 4, left), scene("b", 4, 8, right)],
        1,
      ).map((item) => item.subtitle),
    ).toEqual([`${left}${right}`]);
  });

  test("does not merge a generic not-but statement", () => {
    const result = mergeRhetoricalContinuations(
      [
        scene("a", 0, 4, "这并不是偶然。"),
        scene("b", 4, 8, "而是长期积累。"),
      ],
      1,
    );

    expect(result.map((item) => item.subtitle)).toEqual([
      "这并不是偶然。",
      "而是长期积累。",
    ]);
  });

  test("does not merge across a gap in the source timeline", () => {
    const result = mergeRhetoricalContinuations(
      [
        scene("a", 0, 3, "核心不是速度。"),
        scene("b", 5, 8, "而是稳定。"),
      ],
      1,
    );

    expect(result.map((item) => [item.start, item.end, item.subtitle])).toEqual([
      [0, 3, "核心不是速度。"],
      [5, 8, "而是稳定。"],
    ]);
  });

  test("does not merge unrelated neighbors, ten seconds, or below the minimum count", () => {
    expect(
      mergeRhetoricalContinuations(
        [
          scene("a", 0, 4, "推理成本持续增加。"),
          scene("b", 4, 8, "制程和量产都是障碍。"),
        ],
        1,
      ),
    ).toHaveLength(2);

    expect(
      mergeRhetoricalContinuations(
        [
          scene("a", 0, 6, "核心不是速度。"),
          scene("b", 6, 10, "而是稳定。"),
        ],
        1,
      ),
    ).toHaveLength(2);

    expect(
      mergeRhetoricalContinuations(
        [
          scene("a", 0, 4, "核心不是速度。"),
          scene("b", 4, 8, "而是稳定。"),
        ],
        2,
      ),
    ).toHaveLength(2);
  });

  test("recomputes the projected count after each earlier merge", () => {
    const result = mergeRhetoricalContinuations(
      [
        scene("a", 0, 2, "核心不是速度。"),
        scene("b", 2, 4, "而是稳定。"),
        scene("c", 4, 6, "核心不是参数。"),
        scene("d", 6, 8, "而是成本。"),
      ],
      3,
    );

    expect(result.map((item) => item.subtitle)).toEqual([
      "核心不是速度。而是稳定。",
      "核心不是参数。",
      "而是成本。",
    ]);
  });

  test("clears stale direction fields on every output scene", () => {
    const stale = {
      semantics: { stale: true },
      directorType: "Hero",
      rendererFamily: "hero",
      visualTreatment: "hero-title",
      directorContractIssues: [{ stale: true }],
      content: { stale: true },
      components: ["Stale"],
    } as unknown as Partial<Scene>;
    const result = mergeRhetoricalContinuations(
      [
        scene("a", 0, 4, "核心不是速度。", stale),
        scene("b", 4, 8, "而是稳定。", stale),
      ],
      1,
    );

    result.forEach(expectDirectionCleared);
  });

  test("does not throw when the requested minimum exceeds the input count", () => {
    const result = mergeRhetoricalContinuations(
      [
        scene("a", 0, 4, "核心不是速度。"),
        scene("b", 4, 8, "而是稳定。"),
      ],
      3,
    );

    expect(result.map((item) => [item.id, item.subtitle])).toEqual([
      ["scene-0001", "核心不是速度。"],
      ["scene-0002", "而是稳定。"],
    ]);
    result.forEach(expectDirectionCleared);
  });

  test("accepts punctuation-only subtitles and preserves images on unmerged scenes", () => {
    const result = mergeRhetoricalContinuations(
      [
        scene("a", 0, 4, "！！！", {
          images: ["same.png", "same.png"],
        }),
      ],
      1,
    );

    expect(result[0]).toMatchObject({
      id: "scene-0001",
      subtitle: "！！！",
      images: ["same.png", "same.png"],
    });
  });
});

describe("buildNaturalResegmentCandidates", () => {
  test("does not offer unrelated adjacent merges and does offer timeline-boundary splits", () => {
    const unrelated = [
      scene("a", 0, 4.2, "推理成本持续增加。"),
      scene("b", 4.2, 9, "制程、HBM 和量产都是障碍。"),
    ];
    expect(
      buildNaturalResegmentCandidates(unrelated, timeline).some(
        (candidate) => candidate.length === 1,
      ),
    ).toBe(false);

    const combined = [
      scene("combined", 0, 9, "推理成本持续增加。制程、HBM 和量产都是障碍。"),
    ];
    const candidates = buildNaturalResegmentCandidates(combined, timeline);

    expect(
      candidates[0].map((item) => [item.start, item.end, item.subtitle]),
    ).toEqual([
      [0, 4.2, "推理成本持续增加。"],
      [4.2, 9, "制程、HBM 和量产都是障碍。"],
    ]);
  });

  test("uses provider-native timing only and preserves exact spaces and newlines", () => {
    const subtitle = "推理成本持续增加。 \n  芯片制造存在多重障碍。";
    const timeline: TimelineSegment[] = [
      { id: "t1", start: 0, end: 4.2, text: "推理成本一直在增加。" },
      { id: "t2", start: 4.2, end: 9, text: "芯片制造有很多障碍。" },
    ];
    const [candidate] = buildNaturalResegmentCandidates(
      [scene("combined", 0, 9, subtitle)],
      timeline,
    );

    expect(candidate.map((item) => item.subtitle).join("")).toBe(subtitle);
    expect(candidate.map((item) => item.subtitle)).toEqual([
      "推理成本持续增加。 \n  ",
      "芯片制造存在多重障碍。",
    ]);
    candidate.forEach(expectDirectionCleared);
  });

  test("ignores timeline text, including empty and punctuation-only values", () => {
    const input = [
      scene("combined", 0, 9, "推理成本持续增加。芯片制造存在多重障碍。"),
    ];
    const timingOnly: TimelineSegment[] = [
      { id: "t1", start: 0, end: 4.2, text: "" },
      { id: "t2", start: 4.2, end: 9, text: "！！！" },
    ];

    expect(buildNaturalResegmentCandidates(input, timingOnly)).toEqual(
      buildNaturalResegmentCandidates(input, timeline),
    );
  });

  test("uses one continuous boundary between adjacent fully contained timeline segments", () => {
    const input = [
      scene("combined", 0, 10, "第一层解释。第二层解释。"),
    ];
    const segments: TimelineSegment[] = [
      { id: "a", start: 0, end: 4, text: "" },
      { id: "b", start: 5, end: 10, text: "" },
    ];

    const candidates = buildNaturalResegmentCandidates(input, segments);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].map((item) => [item.start, item.end])).toEqual([
      [0, 5],
      [5, 10],
    ]);
    expect(candidates[0][0].start).toBe(input[0].start);
    expect(candidates[0][0].end).toBe(candidates[0][1].start);
    expect(candidates[0][1].end).toBe(input[0].end);
  });

  test("accepts fully contained timeline segments within the 50ms timing tolerance", () => {
    const candidates = buildNaturalResegmentCandidates(
      [scene("combined", 1, 9, "第一层解释。第二层解释。")],
      [
        { id: "a", start: 0.98, end: 5, text: "" },
        { id: "b", start: 5, end: 9.02, text: "" },
      ],
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].map((item) => [item.start, item.end])).toEqual([
      [1, 5],
      [5, 9],
    ]);
  });

  test("does not use a bare newline as a subtitle split boundary", () => {
    expect(
      buildNaturalResegmentCandidates(
        [scene("combined", 0, 8, "第一行\n第二行")],
        [
          { id: "a", start: 0, end: 4, text: "" },
          { id: "b", start: 4, end: 8, text: "" },
        ],
      ),
    ).toEqual([]);
  });

  test("allows non-alphanumeric source text when punctuation provides a legal split", () => {
    const [candidate] = buildNaturalResegmentCandidates(
      [scene("combined", 0, 8, "🔥。💥。")],
      [
        { id: "🔥", start: 0, end: 4, text: "" },
        { id: "💥", start: 4, end: 8, text: "" },
      ],
    );

    expect(candidate.map((item) => item.subtitle)).toEqual(["🔥。", "💥。"]);
  });

  test("does not split from a lone timeline segment crossing the parent scene", () => {
    const candidates = buildNaturalResegmentCandidates(
      [scene("combined", 2, 9, "第一层解释。第二层解释。")],
      [{ id: "crossing", start: 0, end: 5, text: "" }],
    );

    expect(candidates).toEqual([]);
  });

  test("preserves duplicate images on split and unaffected scenes", () => {
    const input = [
      scene("combined", 0, 9, "第一层解释。第二层解释。", {
        images: ["same.png", "same.png"],
      }),
      scene("untouched", 9, 12, "！！！", {
        images: ["other.png", "other.png"],
      }),
    ];
    const [candidate] = buildNaturalResegmentCandidates(input, [
      { id: "a", start: 0, end: 4, text: "" },
      { id: "b", start: 4, end: 9, text: "" },
    ]);

    expect(candidate.map((item) => item.images)).toEqual([
      ["same.png", "same.png"],
      ["same.png", "same.png"],
      ["other.png", "other.png"],
    ]);
  });

  test("offers every legal single-scene split in deterministic order", () => {
    const input = [
      scene("combined", 0, 12, "第一层解释。第二层解释。第三层解释。"),
    ];
    const exactTimeline: TimelineSegment[] = [
      { id: "a", start: 0, end: 3, text: "任意文字一。" },
      { id: "b", start: 3, end: 7, text: "任意文字二。" },
      { id: "c", start: 7, end: 12, text: "任意文字三。" },
    ];

    const first = buildNaturalResegmentCandidates(input, exactTimeline);
    const second = buildNaturalResegmentCandidates(input, exactTimeline);

    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
    expect(first.map((candidate) => candidate[0].end)).toEqual([3, 7]);
    expect(
      first.map((candidate) => candidate.map((item) => item.id)),
    ).toEqual([
      ["scene-0001", "scene-0002"],
      ["scene-0001", "scene-0002"],
    ]);
  });

  test("fails closed before an extreme timeline creates unbounded candidates", () => {
    const segmentCount = 514;
    const input = [
      scene(
        "combined",
        0,
        segmentCount * 2,
        Array.from({ length: segmentCount }, () => "一。").join(""),
      ),
    ];
    const segments = Array.from({ length: segmentCount }, (_, index) => ({
      id: `t${index}`,
      start: index * 2,
      end: (index + 1) * 2,
      text: "",
    }));

    expect(() =>
      buildNaturalResegmentCandidates(input, segments),
    ).toThrow("自然拆分候选超过安全上限 512");
  });
});

describe("splitLongScenesAtTimelineBoundaries", () => {
  test("recursively splits an overlong scene and always makes progress", () => {
    const overlong = [
      scene("overlong", 0, 12, "第一层解释。第二层解释。第三层解释。"),
    ];
    const exactTimeline: TimelineSegment[] = [
      { id: "a", start: 0, end: 4, text: "第一层。" },
      { id: "b", start: 4, end: 8, text: "第二层。" },
      { id: "c", start: 8, end: 12, text: "第三层。" },
    ];

    const result = splitLongScenesAtTimelineBoundaries(
      overlong,
      exactTimeline,
    );

    expect(result.map((item) => [item.start, item.end])).toEqual([
      [0, 4],
      [4, 12],
    ]);
    expect(result.every((item) => item.end - item.start < 10)).toBe(true);
    expect(result.map((item) => item.subtitle).join("")).toBe(
      overlong[0].subtitle,
    );
  });

  test("repeats recursive splitting until every descendant is below ten seconds", () => {
    const input = [
      scene(
        "long",
        0,
        24,
        "第一段。第二段。第三段。第四段。第五段。第六段。",
      ),
    ];
    const exactTimeline = Array.from({ length: 6 }, (_, index) => ({
      id: `t${index + 1}`,
      start: index * 4,
      end: (index + 1) * 4,
      text: `转写${index + 1}`,
    }));

    const result = splitLongScenesAtTimelineBoundaries(
      input,
      exactTimeline,
    );

    expect(result).toHaveLength(4);
    expect(result.every((item) => item.end - item.start < 10)).toBe(true);
    expect(result.map((item) => item.subtitle).join("")).toBe(
      input[0].subtitle,
    );
  });

  test("keeps comma fallback leaves reachable after splitting mixed punctuation", () => {
    const input = [scene("mixed", 0, 24, "甲，乙。丙，丁。")];
    const exactTimeline = Array.from({ length: 4 }, (_, index) => ({
      id: `t${index + 1}`,
      start: index * 6,
      end: (index + 1) * 6,
      text: "",
    }));

    const result = splitLongScenesAtTimelineBoundaries(
      input,
      exactTimeline,
    );

    expect(result.map((item) => [item.start, item.end, item.subtitle])).toEqual([
      [0, 6, "甲，"],
      [6, 12, "乙。"],
      [12, 18, "丙，"],
      [18, 24, "丁。"],
    ]);
    expect(result.every((item) => item.end - item.start < 10)).toBe(true);
    expect(result[0].start).toBe(input[0].start);
    for (let index = 1; index < result.length; index += 1) {
      expect(result[index].start).toBe(result[index - 1].end);
    }
    expect(result.at(-1)?.end).toBe(input[0].end);
    expect(result.map((item) => item.subtitle).join("")).toBe(
      input[0].subtitle,
    );
  });

  test("backtracks when the most balanced first split cannot produce a complete solution", () => {
    const result = splitLongScenesAtTimelineBoundaries(
      [scene("long", 0, 24, "第一段。第二段。第三段。")],
      Array.from({ length: 6 }, (_, index) => ({
        id: `t${index + 1}`,
        start: index * 4,
        end: (index + 1) * 4,
        text: "",
      })),
    );

    expect(result.map((item) => [item.start, item.end, item.subtitle])).toEqual([
      [0, 8, "第一段。"],
      [8, 16, "第二段。"],
      [16, 24, "第三段。"],
    ]);
  });

  test("prunes mathematically impossible long-scene searches", () => {
    const segmentCount = 200;
    const startedAt = performance.now();

    expect(() =>
      splitLongScenesAtTimelineBoundaries(
        [
          scene(
            "impossible",
            0,
            200,
            Array.from({ length: 20 }, () => "一。").join(""),
          ),
        ],
        Array.from({ length: segmentCount }, (_, index) => ({
          id: `t${index}`,
          start: index,
          end: index + 1,
          text: "",
        })),
      ),
    ).toThrow("所有完整拆分方案");
    expect(performance.now() - startedAt).toBeLessThan(1_000);
  });

  test("chooses the legal boundary with the smallest maximum child duration", () => {
    const result = splitLongScenesAtTimelineBoundaries(
      [scene("balanced", 0, 11, "第一段。第二段。第三段。")],
      [
        { id: "a", start: 0, end: 2, text: "一" },
        { id: "b", start: 2, end: 6, text: "二" },
        { id: "c", start: 6, end: 11, text: "三" },
      ],
    );

    expect(result.map((item) => [item.start, item.end])).toEqual([
      [0, 6],
      [6, 11],
    ]);
  });

  test("fails when an overlong scene has no shorter legal split", () => {
    expect(() =>
      splitLongScenesAtTimelineBoundaries(
        [scene("overlong", 0, 12, "单段解释。")],
        [{ id: "single", start: 0, end: 12, text: "单段转写。" }],
      ),
    ).toThrow("没有可用且能缩短镜头的服务商原生时间边界");
  });

  test("rejects zero-progress and sub-one-second boundaries", () => {
    expect(() =>
      splitLongScenesAtTimelineBoundaries(
        [scene("overlong", 0, 12, "第一段。第二段。")],
        [
          { id: "a", start: 0, end: 0.5, text: "" },
          { id: "b", start: 0.5, end: 12, text: "" },
        ],
      ),
    ).toThrow("没有可用且能缩短镜头的服务商原生时间边界");
  });
});

describe("runtime input validation", () => {
  test("fails closed for sparse scene and timeline arrays", () => {
    const sparseScenes = Array<Scene>(2);
    sparseScenes[0] = scene("a", 0, 4, "有效字幕。");
    const sparseTimeline = Array<TimelineSegment>(2);
    sparseTimeline[0] = { id: "t1", start: 0, end: 2, text: "有效转写。" };

    expect(() =>
      mergeRhetoricalContinuations(sparseScenes, 1),
    ).toThrow(/稀疏/);
    expect(() =>
      buildNaturalResegmentCandidates(
        [scene("a", 0, 4, "第一句。第二句。")],
        sparseTimeline,
      ),
    ).toThrow(/稀疏/);
  });

  test.each([
    [
      "non-finite scene time",
      [scene("a", 0, Number.NaN, "字幕。")],
      timeline,
    ],
    [
      "overlapping scenes",
      [
        scene("a", 0, 5, "第一句。"),
        scene("b", 4, 8, "第二句。"),
      ],
      timeline,
    ],
    [
      "unordered timeline",
      [scene("a", 0, 9, "第一句。第二句。")],
      [
        { id: "t2", start: 4, end: 9, text: "二" },
        { id: "t1", start: 0, end: 4, text: "一" },
      ],
    ],
    [
      "overlapping timeline",
      [scene("a", 0, 9, "第一句。第二句。")],
      [
        { id: "t1", start: 0, end: 5, text: "一" },
        { id: "t2", start: 4, end: 9, text: "二" },
      ],
    ],
  ] as const)("rejects %s", (_label, scenes, segments) => {
    expect(() =>
      buildNaturalResegmentCandidates(
        scenes as unknown as Scene[],
        segments as TimelineSegment[],
      ),
    ).toThrow(/输入无效/);
  });

  test.each(["constructor", "prototype", "__proto__"])(
    "accepts %s as an ordinary id value",
    (id) => {
      expect(
        mergeRhetoricalContinuations(
          [scene(id, 0, 4, "正常字幕。")],
          1,
        )[0].subtitle,
      ).toBe("正常字幕。");
    },
  );

  test("rejects malicious own fields independently from id values", () => {
    const malicious = scene("__proto__", 0, 4, "正常字幕。", {
      images: ["ok.png"],
    }) as Scene & Record<string, unknown>;
    Object.defineProperty(malicious, "constructor", {
      value: { polluted: true },
      enumerable: true,
    });

    expect(() =>
      mergeRhetoricalContinuations([malicious], 1),
    ).toThrow(/包含恶意字段/);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
