import { performance } from "node:perf_hooks";
import { describe, expect, test } from "vitest";
import { directorCapabilities } from "@/lib/director-capabilities";
import { validateDirectorContract } from "@/lib/director-contract";
import {
  buildDirectorCandidates,
  buildDirectorQualityBounds,
  selectDirectorPlan,
} from "@/lib/director-selector";
import * as directorSelectorModule from "@/lib/director-selector";
import { extractSceneSemantics } from "@/lib/scene-semantics";
import type {
  DirectorVisualTreatment,
  Scene,
  SceneSemantics,
} from "@/lib/types";

const scene = (id: string, subtitle: string, start: number): Scene => ({
  id,
  start,
  end: start + 4,
  subtitle,
  images: [],
  layout: "quote",
});

const formOf = (item: {
  rendererFamily?: string;
  visualTreatment?: DirectorVisualTreatment;
}): string => `${item.rendererFamily}:${item.visualTreatment}`;

const structureOf = (item: {
  rendererFamily?: string;
  components?: string[];
}): string =>
  `${item.rendererFamily}:${[...new Set(item.components ?? [])].sort().join(",")}`;

const highCandidateSubtitle =
  "DeepSeek 绕不开两条路：一条是英伟达，一条是国产替代芯片。" +
  "制程、HBM、软件生态、流片和量产，每一关都很硬。" +
  "持续调用会带来算力消耗和推理成本。" +
  "请求经过模型、API、推理服务，最后进入芯片执行。" +
  "一家模型公司，能不能一直把算力命脉交给别人？";
const highCandidateSearchBudgetMs = 6_000;
const highCandidateWallLimitMs = 8_000;

describe("buildDirectorCandidates", () => {
  test("never offers unsupported data, pricing or timeline semantics", () => {
    const input = scene("abstract", "它更像一个值得关注的行业信号。", 0);
    const types = buildDirectorCandidates(
      input,
      extractSceneSemantics(input),
      1,
      3,
    ).map((candidate) => candidate.type);

    expect(types).not.toEqual(
      expect.arrayContaining(["DataExplosion", "Pricing", "Timeline"]),
    );
  });

  test("offers the semantic DeepSeek candidates", () => {
    const cases = [
      ["推理是长期水电费。", "FinancialMeter"],
      ["请求经过模型、API、推理服务，最后进入芯片执行。", "SystemStack"],
      [
        "DeepSeek 绕不开两条路：一条是英伟达，一条是国产替代芯片。",
        "DependencyMap",
      ],
      ["制程、HBM、软件生态、流片和量产，每一关都很硬。", "BarrierWall"],
    ] as const;

    for (const [subtitle, expected] of cases) {
      const input = scene(expected, subtitle, 4);
      expect(
        buildDirectorCandidates(
          input,
          extractSceneSemantics(input),
          1,
          3,
        ).map((candidate) => candidate.type),
      ).toContain(expected);
    }
  });

  test("keeps distinct treatments in stable registry order", () => {
    const input = scene(
      "cost",
      "持续调用会带来算力消耗和推理成本。",
      4,
    );
    const candidates = buildDirectorCandidates(
      input,
      extractSceneSemantics(input),
      1,
      3,
    ).filter((candidate) => candidate.type === "FinancialMeter");

    expect(candidates.map((candidate) => candidate.visualTreatment)).toEqual([
      "resource-pressure",
      "resource-flow",
    ]);
    expect(new Set(candidates.map(formOf)).size).toBe(candidates.length);
  });

  test("fails closed for malformed runtime semantics", () => {
    const input = scene("malformed", "正常字幕", 0);
    const malformed = {
      ...extractSceneSemantics(input),
      concepts: "__proto__",
    } as unknown as SceneSemantics;

    expect(() =>
      buildDirectorCandidates(input, malformed, 0, 1),
    ).not.toThrow();
    expect(buildDirectorCandidates(input, malformed, 0, 1)).toEqual([]);
  });
});

describe("buildDirectorQualityBounds", () => {
  test.each([
    [0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
    [2, 2, 2, 2, 2],
    [12, 7, 5, 3, 2],
    [60, 31, 24, 3, 2],
  ])(
    "derives canonical bounds for %i scenes",
    (
      count,
      preferredForms,
      minimumForms,
      preferredFamilies,
      minimumFamilies,
    ) => {
      expect(buildDirectorQualityBounds(count)).toEqual({
        preferredForms,
        minimumForms,
        preferredFamilies,
        minimumFamilies,
      });
    },
  );
});

describe("selectDirectorPlan", () => {
  test("does not collide an unsaturated form mask with the saturated state", () => {
    const buildStateKey = (
      directorSelectorModule as unknown as {
        buildDirectorSearchStateKey: (
          index: number,
          previousFormIndex: number,
          usedForms: bigint,
          usedFamilies: bigint,
          requiredForms: number,
          requiredFamilies: number,
          formUniverseSize: number,
          familyUniverseSize: number,
        ) => bigint;
      }
    ).buildDirectorSearchStateKey;

    expect(typeof buildStateKey).toBe("function");
    expect(
      buildStateKey(5, 4, 28n, 3n, 4, 2, 5, 3),
    ).not.toBe(
      buildStateKey(5, 4, 29n, 3n, 4, 2, 5, 3),
    );
  });

  test("does not collide an unsaturated family mask with the saturated state", () => {
    const buildStateKey = (
      directorSelectorModule as unknown as {
        buildDirectorSearchStateKey: (
          index: number,
          previousFormIndex: number,
          usedForms: bigint,
          usedFamilies: bigint,
          requiredForms: number,
          requiredFamilies: number,
          formUniverseSize: number,
          familyUniverseSize: number,
        ) => bigint;
      }
    ).buildDirectorSearchStateKey;

    expect(typeof buildStateKey).toBe("function");
    expect(
      buildStateKey(5, 4, 3n, 28n, 2, 4, 3, 5),
    ).not.toBe(
      buildStateKey(5, 4, 3n, 29n, 2, 4, 3, 5),
    );
  });

  test("keeps recent visual structures distinct in the search memo key", () => {
    const buildStateKey = (
      directorSelectorModule as unknown as {
        buildDirectorSearchStateKey: (
          index: number,
          previousFormIndex: number,
          usedForms: bigint,
          usedFamilies: bigint,
          requiredForms: number,
          requiredFamilies: number,
          formUniverseSize: number,
          familyUniverseSize: number,
          previousStructureIndex?: number,
          penultimateStructureIndex?: number,
          structureUniverseSize?: number,
        ) => bigint;
      }
    ).buildDirectorSearchStateKey;

    expect(
      buildStateKey(5, 4, 3n, 3n, 2, 2, 5, 5, 2, 1, 4),
    ).not.toBe(
      buildStateKey(5, 4, 3n, 3n, 2, 2, 5, 5, 2, 0, 4),
    );
  });

  test("filters candidates through generated content, components and contract", () => {
    const originalValidateContent =
      directorCapabilities.KeywordInvestigation.validateContent;
    directorCapabilities.KeywordInvestigation.validateContent = () => [
      "forced-test-rejection",
    ];

    try {
      const result = selectDirectorPlan([
        scene("first", "这是第一个抽象判断。", 0),
        scene("middle", "这是中间的抽象判断。", 4),
        scene("last", "这是最后的抽象判断。", 8),
      ]);

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected contract-filtered failure");
      expect(
        result.diagnostics.constrainedScenes.find(
          (item) => item.sceneId === "middle",
        )?.legalForms,
      ).toEqual([]);
    } finally {
      directorCapabilities.KeywordInvestigation.validateContent =
        originalValidateContent;
    }
  });

  test("selects deterministically, avoids adjacent forms and persists exact output", () => {
    const scenes = Array.from({ length: 12 }, (_, index) =>
      scene(
        `adaptive-${index}`,
        index === 4
          ? "持续调用会带来算力消耗和推理成本。"
          : index === 7
            ? "一家模型公司，能不能一直把算力命脉交给别人？"
            : "这是同一种抽象判断。",
        index * 4,
      ),
    );

    const first = selectDirectorPlan(scenes);
    const second = selectDirectorPlan(scenes);
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.errors.join("\n"));

    expect(first.targets).toEqual({
      preferredForms: 7,
      minimumForms: 5,
      requiredForms: 6,
      preferredFamilies: 3,
      minimumFamilies: 2,
      requiredFamilies: 3,
    });

    const forms = first.scenes.map(formOf);
    expect(new Set(forms).size).toBeGreaterThanOrEqual(
      first.targets.requiredForms,
    );
    expect(
      new Set(first.scenes.map((item) => item.rendererFamily)).size,
    ).toBeGreaterThanOrEqual(first.targets.requiredFamilies);
    for (let index = 1; index < forms.length; index += 1) {
      expect(forms[index]).not.toBe(forms[index - 1]);
    }

    first.scenes.forEach((selected, index) => {
      expect(selected.semantics?.sceneId).toBe(selected.id);
      expect(selected.directorType).toBeDefined();
      expect(selected.rendererFamily).toBeDefined();
      expect(selected.visualTreatment).toBeDefined();
      expect(selected.content).toBeDefined();
      expect(selected.components?.length).toBeGreaterThan(0);
      expect(
        validateDirectorContract({
          scene: selected,
          semantics: selected.semantics!,
          directorType: selected.directorType!,
          content: selected.content!,
          components: selected.components!,
          sceneIndex: index,
          sceneCount: first.scenes.length,
        }).passed,
      ).toBe(true);
    });
  });

  test("maximizes semantic score before narrative score for each target pair", () => {
    const inputs = [
      scene("optimal-1", "持续调用会带来算力消耗和推理成本。", 0),
      scene("optimal-2", "持续调用会带来算力消耗和推理成本。", 4),
      scene("optimal-3", "这是同一种抽象判断。", 8),
      scene(
        "optimal-4",
        "一家模型公司，能不能一直把算力命脉交给别人？",
        12,
      ),
      scene(
        "optimal-5",
        "一家模型公司，能不能一直把算力命脉交给别人？",
        16,
      ),
      scene(
        "optimal-6",
        "请求经过模型、API、推理服务，最后进入芯片执行。",
        20,
      ),
    ];

    const first = selectDirectorPlan(inputs);
    const second = selectDirectorPlan(inputs);
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.errors.join("\n"));

    const scores = first.scenes.map((selected, index) => {
      const candidate = buildDirectorCandidates(
        inputs[index],
        extractSceneSemantics(inputs[index]),
        index,
        inputs.length,
      ).find(
        (item) =>
          item.type === selected.directorType &&
          item.rendererFamily === selected.rendererFamily &&
          item.visualTreatment === selected.visualTreatment,
      );
      if (!candidate) throw new Error(`missing selected candidate at ${index}`);
      return candidate;
    });

    expect(new Set(first.scenes.map(formOf)).size).toBe(6);
    expect(
      new Set(first.scenes.map((item) => item.rendererFamily)).size,
    ).toBe(4);
    expect(
      first.scenes.slice(0, 2).map((item) => [
        item.directorType,
        item.visualTreatment,
      ]),
    ).toEqual([
      ["FinancialMeter", "resource-pressure"],
      ["FinancialMeter", "resource-flow"],
    ]);
    expect(scores.reduce((sum, item) => sum + item.semanticScore, 0)).toBe(86);
    expect(scores.reduce((sum, item) => sum + item.narrativeScore, 0)).toBe(-2);
  });

  test("keeps two renderer families for a two-scene video", () => {
    const result = selectDirectorPlan([
      scene("short-1", "这是第一个抽象判断。", 0),
      scene("short-2", "这是第二个抽象判断。", 4),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.targets.requiredFamilies).toBe(2);
    expect(new Set(result.scenes.map((item) => item.rendererFamily)).size).toBe(
      2,
    );
  });

  test("fails closed when the full timeline does not meet scene density", () => {
    const result = selectDirectorPlan([
      scene("density-1", "这是第一个抽象判断。", 0),
      scene("density-2", "这是第二个抽象判断。", 100),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected scene-density failure");
    expect(result.errors.join("\n")).toContain(
      "镜头密度不足：104 秒视频至少需要 11 个镜头，当前只有 2 个",
    );
  });

  test("uses timeline span rather than requiring a zero start or no gaps", () => {
    const result = selectDirectorPlan([
      scene("offset-1", "这是第一个抽象判断。", 10),
      scene("offset-2", "这是第二个抽象判断。", 16),
    ]);

    expect(result.ok).toBe(true);
  });

  test.each([
    [
      "out-of-order scenes",
      [
        scene("later", "这是后面的抽象判断。", 4),
        scene("earlier", "这是前面的抽象判断。", 0),
      ],
    ],
    [
      "overlapping scenes",
      [
        scene("overlap-1", "这是第一个抽象判断。", 0),
        scene("overlap-2", "这是第二个抽象判断。", 2),
      ],
    ],
  ])("rejects %s as an invalid timeline", (_label, scenes) => {
    const result = selectDirectorPlan(scenes);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected timeline-order failure");
    expect(result.errors.join("\n")).toContain("时间轴");
  });

  test("fails structurally without throwing for a sparse Scene array", () => {
    const sparse = Array<Scene>(2);
    sparse[0] = scene("sparse-1", "这是第一个抽象判断。", 0);

    expect(() => selectDirectorPlan(sparse)).not.toThrow();
    const result = selectDirectorPlan(sparse);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected sparse-array failure");
    expect(result.errors.join("\n")).toContain("稀疏");
  });

  test("fails explicitly when strict semantics cannot reach the quality floor", () => {
    const repeated = Array.from({ length: 20 }, (_, index) =>
      scene(
        `repeat-${index}`,
        "这是同一种抽象判断。",
        index * 4,
      ),
    );
    const result = selectDirectorPlan(repeated);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a quality-floor failure");
    expect(result.errors.join("\n")).toContain("严格语义下的可达视觉形式");
    expect(result.diagnostics.reachableForms).toBeLessThan(
      result.diagnostics.minimumForms,
    );
    expect(result.diagnostics.reachableFamilies).toBeGreaterThanOrEqual(1);
    expect(result.diagnostics.constrainedScenes.length).toBeGreaterThan(0);
    expect(
      result.diagnostics.constrainedScenes.every(
        (item) =>
          item.sceneId.startsWith("repeat-") &&
          item.legalForms.every(
            (form) =>
              !form.startsWith("data:") &&
              !form.startsWith("timeline:"),
          ),
      ),
    ).toBe(true);
  });

  test.each([
    ["empty scenes", []],
    [
      "duplicate ids",
      [
        scene("duplicate", "第一段。", 0),
        scene("duplicate", "第二段。", 4),
      ],
    ],
    [
      "non-finite time",
      [{ ...scene("nan", "字幕。", 0), end: Number.NaN }],
    ],
    [
      "reversed time",
      [{ ...scene("reverse", "字幕。", 4), end: 3 }],
    ],
    [
      "unknown runtime layout",
      [{ ...scene("layout", "字幕。", 0), layout: "__proto__" }],
    ],
    [
      "malicious runtime director value",
      [{ ...scene("director", "字幕。", 0), directorType: "constructor" }],
    ],
  ])("fails closed without throwing for %s", (_label, value) => {
    expect(() => selectDirectorPlan(value as Scene[])).not.toThrow();
    const result = selectDirectorPlan(value as Scene[]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected invalid-input failure");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test(
    "handles 60 scenes with repeated candidate sets within a bounded time",
    () => {
      const repeated = Array.from({ length: 60 }, (_, index) =>
        scene(
          `performance-${index}`,
          "持续调用会带来算力消耗和推理成本。",
          index * 4,
        ),
      );
      const startedAt = performance.now();
      const result = selectDirectorPlan(repeated);
      const elapsedMs = performance.now() - startedAt;

      expect(result.ok).toBe(false);
      expect(elapsedMs).toBeLessThan(1_500);
    },
    3_000,
  );

  test.each([
    ["reachable", 14],
    ["near-limit", 16],
  ] as const)(
    "completes a %s high-candidate search with %i scenes",
    (_caseLabel, sceneCount) => {
      const inputs = Array.from({ length: sceneCount }, (_, index) =>
        scene(`dense-${sceneCount}-${index}`, highCandidateSubtitle, index * 4),
      );
      const startedAt = performance.now();
      const result = selectDirectorPlan(inputs, undefined, {
        maxSearchMilliseconds: highCandidateSearchBudgetMs,
      });
      const elapsedMs = performance.now() - startedAt;

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.errors.join("\n"));
      expect(new Set(result.scenes.map(formOf)).size).toBeGreaterThanOrEqual(
        result.targets.requiredForms,
      );
      expect(elapsedMs).toBeLessThan(highCandidateWallLimitMs);
    },
    10_000,
  );

  test("completes a common high-candidate search under the default budget", () => {
    const inputs = Array.from({ length: 12 }, (_, index) =>
      scene(`default-budget-${index}`, highCandidateSubtitle, index * 4),
    );

    const result = selectDirectorPlan(inputs);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    const structures = result.scenes.map(structureOf);
    for (let index = 2; index < structures.length; index += 1) {
      expect([
        structures[index - 2],
        structures[index - 1],
        structures[index],
      ]).not.toEqual([
        structures[index],
        structures[index],
        structures[index],
      ]);
    }
  });

  test("fails closed without lowering targets when the search budget is exhausted", () => {
    const inputs = Array.from({ length: 12 }, (_, index) =>
      scene(`budget-${index}`, highCandidateSubtitle, index * 4),
    );
    const selectWithBudget = selectDirectorPlan as unknown as (
      value: Scene[],
      context: undefined,
      options: {
        maxSearchStates: number;
        maxSearchMilliseconds: number;
      },
    ) => ReturnType<typeof selectDirectorPlan>;

    const result = selectWithBudget(inputs, undefined, {
      maxSearchStates: 10,
      maxSearchMilliseconds: 10_000,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected search-budget failure");
    expect(result.errors.join("\n")).toContain("搜索预算耗尽");
    expect(result.errors.join("\n")).not.toContain("严格语义下");
    expect(
      (
        result.diagnostics as typeof result.diagnostics & {
          searchBudget: {
            status: string;
            targetForms: number;
            targetFamilies: number;
          };
        }
      ).searchBudget,
    ).toMatchObject({
      status: "BUDGET_EXHAUSTED",
      targetForms: result.diagnostics.preferredForms,
      targetFamilies: result.diagnostics.preferredFamilies,
    });
  });

  test(
    "rejects an oversized valid scene array without spreading it into Math.max",
    () => {
      const oversized = Array.from({ length: 200_000 }, (_, index) => ({
        id: `oversized-${index}`,
        start: index * 0.01,
        end: index * 0.01 + 0.005,
        subtitle: "这是一个合法镜头。",
        images: [],
        layout: "quote" as const,
      }));

      expect(() => selectDirectorPlan(oversized)).not.toThrow();
      const result = selectDirectorPlan(oversized);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected scene-count limit failure");
      expect(result.errors.join("\n")).toContain("镜头数量超过上限");
    },
    10_000,
  );
});
