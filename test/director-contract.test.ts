import { describe, expect, test } from "vitest";
import { directorCapabilities } from "@/lib/director-capabilities";
import { validateDirectorContract } from "@/lib/director-contract";
import { extractSceneSemantics } from "@/lib/scene-semantics";
import type {
  DirectorSceneContent,
  DirectorSceneType,
  Scene,
  SceneSemantics,
  SemanticSourceRef,
} from "@/lib/types";

const directorSceneTypes = [
  "Hero",
  "Timeline",
  "SystemMap",
  "DataExplosion",
  "Contrast",
  "SpecSheet",
  "Pricing",
  "Pause",
  "Summary",
  "EvidenceHero",
  "KeywordInvestigation",
  "FinancialMeter",
  "SystemStack",
  "DependencyMap",
  "QuestionPause",
  "BarrierWall",
  "EvidenceReturn",
  "IndustrySignal",
  "CompetitionLayerStack",
  "FinalJudgement",
] satisfies DirectorSceneType[];

const sceneFor = (subtitle: string): Scene => ({
  id: "scene-test",
  start: 0,
  end: 4,
  subtitle,
  images: [],
  layout: "quote",
});

const validate = (
  subtitle: string,
  directorType: DirectorSceneType,
  content: DirectorSceneContent,
  components: string[] = [],
) => {
  const scene = sceneFor(subtitle);
  return validateDirectorContract({
    scene,
    semantics: extractSceneSemantics(scene),
    directorType,
    content,
    components,
  });
};

const factualSource = (
  text: string,
  overrides: Partial<SemanticSourceRef> = {},
): SemanticSourceRef => ({
  kind: "article",
  text,
  supportsFacts: true,
  ...overrides,
});

const emptySemantics = (scene: Scene): SceneSemantics => ({
  ...extractSceneSemantics(scene),
  entities: [],
  metrics: [],
  prices: [],
  timelineEvents: [],
  comparisons: [],
  relations: [],
  orderedLayers: [],
  barriers: [],
  questions: [],
  signals: [],
  judgements: [],
  concepts: [],
  evidenceRefs: [],
  pauseMarkers: [],
  sources: [],
});

describe("directorCapabilities", () => {
  test("registers every DirectorSceneType exactly once", () => {
    expect(Object.keys(directorCapabilities).sort()).toEqual(
      [...directorSceneTypes].sort(),
    );

    for (const type of directorSceneTypes) {
      expect(directorCapabilities[type].type).toBe(type);
    }
  });

  test("keeps KLineChart forbidden until market-series semantics exist", () => {
    for (const type of directorSceneTypes) {
      expect(directorCapabilities[type].forbiddenComponents).toContain(
        "KLineChart",
      );
    }
  });
});

describe("validateDirectorContract", () => {
  test.each([
    "核心信息",
    "关键点",
    "结构",
    "影响",
    "最后看结论",
    "背景",
    "节点",
    "变化",
    "结果",
  ])("rejects generic placeholder text used as standalone visual content: %s", (placeholder) => {
    const scene = sceneFor(`这段口播包含真实内容，但主视觉不能只写${placeholder}。`);
    const semantics = emptySemantics(scene);
    semantics.concepts = [placeholder];
    semantics.sources = [factualSource(scene.subtitle)];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "KeywordInvestigation",
      content: {
        headline: placeholder,
        keywordTags: [placeholder],
      },
      components: [],
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "content.generic-placeholder",
          severity: "error",
        }),
      ]),
    );
  });

  test.each([
    "UnknownDirectorType",
    "toString",
    "constructor",
    "__proto__",
  ])(
    "fails closed for unknown runtime director type %s",
    (directorType) => {
      const scene = sceneFor("这是当前镜头的原文。");

      expect(() =>
        validateDirectorContract({
          scene,
          semantics: extractSceneSemantics(scene),
          directorType: directorType as DirectorSceneType,
          content: {},
          components: [],
        }),
      ).not.toThrow();

      const result = validateDirectorContract({
        scene,
        semantics: extractSceneSemantics(scene),
        directorType: directorType as DirectorSceneType,
        content: {},
        components: [],
      });

      expect(result.passed).toBe(false);
      expect(result.issues).toEqual([
        expect.objectContaining({
          code: "director.type-unknown",
          severity: "error",
          field: "directorType",
        }),
      ]);
    },
  );

  test("fails closed for malformed content from external JSON", () => {
    const scene = sceneFor("调用量增长 20%。");
    const result = validateDirectorContract({
      scene,
      semantics: extractSceneSemantics(scene),
      directorType: "DataExplosion",
      content: {
        metrics: [null],
      } as unknown as DirectorSceneContent,
      components: ["MetricCounter"],
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "content.invalid-structure",
          field: "metrics",
          severity: "error",
        }),
      ]),
    );
  });

  test.each([
    ["semantics", null],
    ["metrics", { metrics: null }],
    ["metrics", { metrics: [null] }],
    [
      "metrics.source",
      {
        metrics: [
          {
            label: "调用量增长",
            value: "20%",
            source: null,
          },
        ],
      },
    ],
    [
      "signals.targets",
      {
        signals: [
          {
            sourceLabel: "开源发布",
            targets: null,
            source: factualSource("开源发布影响模型厂商。"),
          },
        ],
      },
    ],
  ])("fails closed for malformed semantic structure at %s", (field, patch) => {
    const scene = sceneFor("调用量增长 20%。");
    const base = extractSceneSemantics(scene);
    const semantics =
      patch === null ? null : { ...base, ...patch };

    expect(() =>
      validateDirectorContract({
        scene,
        semantics: semantics as unknown as SceneSemantics,
        directorType: "DataExplosion",
        content: {
          metrics: [{ label: "调用量增长", value: "20%" }],
        },
        components: ["MetricCounter"],
      }),
    ).not.toThrow();

    const result = validateDirectorContract({
      scene,
      semantics: semantics as unknown as SceneSemantics,
      directorType: "DataExplosion",
      content: {
        metrics: [{ label: "调用量增长", value: "20%" }],
      },
      components: ["MetricCounter"],
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "semantic.invalid-structure",
          field,
          severity: "error",
        }),
      ]),
    );
  });

  test.each([
    [
      "concepts",
      "---",
      (semantics: SceneSemantics) => {
        semantics.concepts = ["---"];
      },
    ],
    [
      "sources",
      "///",
      (semantics: SceneSemantics) => {
        semantics.sources = [factualSource("///")];
      },
    ],
    [
      "metrics",
      "___",
      (semantics: SceneSemantics) => {
        const source = factualSource("调用量达到 20%。");
        semantics.metrics = [
          { label: "___", value: "20%", source },
        ];
        semantics.sources = [source];
      },
    ],
    [
      "signals.targets",
      "***",
      (semantics: SceneSemantics) => {
        const source = factualSource("开源发布影响模型。");
        semantics.signals = [
          {
            sourceLabel: "开源发布",
            targets: ["***"],
            source,
          },
        ];
        semantics.sources = [source];
      },
    ],
    [
      "judgements.evidence",
      "###",
      (semantics: SceneSemantics) => {
        const source = factualSource("交付延期说明供应受限。");
        semantics.judgements = [
          {
            conclusion: "供应受限",
            evidence: ["###"],
            source,
          },
        ];
        semantics.sources = [source];
      },
    ],
  ] as const)(
    "rejects symbol-only semantic text %s in %s",
    (field, _value, configure) => {
      const scene = sceneFor("当前镜头包含可验证文本。");
      const semantics = emptySemantics(scene);
      configure(semantics);

      const result = validateDirectorContract({
        scene,
        semantics,
        directorType: "KeywordInvestigation",
        content: { keywordTags: ["当前镜头"] },
        components: [],
      });

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "semantic.invalid-structure",
            field,
            severity: "error",
          }),
        ]),
      );
    },
  );

  test("rejects Unicode compatibility variants as duplicate semantic layers", () => {
    const scene = sceneFor("A、全角 A 和数学 A 表示同一层。");
    const semantics = emptySemantics(scene);
    semantics.orderedLayers = ["A", "Ａ", "𝐀"];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "KeywordInvestigation",
      content: { keywordTags: ["同一层"] },
      components: [],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "semantic.invalid-structure",
          field: "orderedLayers",
          severity: "error",
        }),
      ]),
    );
  });

  test("treats composed and decomposed structured facts as duplicates", () => {
    const scene = sceneFor("Café 依赖芯片。");
    const source = factualSource(scene.subtitle);
    const semantics = emptySemantics(scene);
    semantics.relations = [
      { from: "Café", to: "芯片", relation: "依赖", source },
      { from: "Cafe\u0301", to: "芯片", relation: "依赖", source },
    ];
    semantics.sources = [source];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "SystemMap",
      content: { nodes: ["Café", "芯片"] },
      components: [],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "semantic.invalid-structure",
          field: "relations",
          severity: "error",
        }),
      ]),
    );
  });

  test("does not let zero-width format characters escape semantic duplicates", () => {
    const scene = sceneFor("模型是当前概念。");
    const semantics = emptySemantics(scene);
    semantics.concepts = ["模型", "模\u200B型"];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "KeywordInvestigation",
      content: { keywordTags: ["模型"] },
      components: [],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "semantic.invalid-structure",
          field: "concepts",
          severity: "error",
        }),
      ]),
    );
  });

  test("rejects text and emoji variation selectors as duplicate semantic layers", () => {
    const scene = sceneFor("A 的展示方式不改变语义身份。");
    const semantics = emptySemantics(scene);
    semantics.orderedLayers = ["A", "A\uFE0E", "A\uFE0F"];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "KeywordInvestigation",
      content: { keywordTags: ["展示方式"] },
      components: [],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "semantic.invalid-structure",
          field: "orderedLayers",
          severity: "error",
        }),
      ]),
    );
  });

  test("rejects supplementary variation selectors as duplicate semantic text", () => {
    const scene = sceneFor("模型是当前概念。");
    const semantics = emptySemantics(scene);
    semantics.concepts = ["模型", "模\u{E0100}型"];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "KeywordInvestigation",
      content: { keywordTags: ["模型"] },
      components: [],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "semantic.invalid-structure",
          field: "concepts",
          severity: "error",
        }),
      ]),
    );
  });

  test("matches source identities across display selectors without mutating text", () => {
    const scene = sceneFor("航班✈️依赖 API。");
    const registeredSource = factualSource(scene.subtitle);
    const embeddedSource = factualSource("航班✈︎依赖 API。");
    const semantics = emptySemantics(scene);
    semantics.relations = [
      {
        from: "航班✈️",
        to: "API",
        relation: "依赖",
        source: embeddedSource,
      },
    ];
    semantics.sources = [registeredSource];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "SystemMap",
      content: { nodes: ["航班✈️", "API"] },
      components: ["NodeGraph"],
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
    expect(registeredSource.text).toBe("航班✈️依赖 API。");
    expect(embeddedSource.text).toBe("航班✈︎依赖 API。");
  });

  test("keeps distinct Chinese and English semantic text valid", () => {
    const scene = sceneFor("模型依赖 API。");
    const source = factualSource(scene.subtitle);
    const semantics = emptySemantics(scene);
    semantics.entities = ["模型", "API"];
    semantics.relations = [
      { from: "模型", to: "API", relation: "依赖", source },
    ];
    semantics.sources = [source];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "SystemMap",
      content: { nodes: ["模型", "API"] },
      components: ["NodeGraph"],
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  test("accepts meaningful Unicode text throughout semantic structure", () => {
    const scene = sceneFor(
      "模型 Revenue 2026，增长（YoY）! 调用量（Revenue）! 为 2026 次/年。",
    );
    const source = factualSource(scene.subtitle, {
      referenceId: "证据-2026",
      matchedClaim: "增长（YoY）!",
    });
    const semantics = emptySemantics(scene);
    semantics.entities = ["模型", "Revenue", "2026", "增长（YoY）!"];
    semantics.concepts = ["模型", "Revenue", "2026", "增长（YoY）!"];
    semantics.metrics = [
      {
        label: "调用量（Revenue）!",
        value: "2026",
        unit: "次/年",
        source,
      },
    ];
    semantics.sources = [source];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "DataExplosion",
      content: {
        metrics: [{ label: "调用量（Revenue）!", value: "2026" }],
      },
      components: ["MetricCard"],
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  test.each(["---", "///", "___", "***", "###"])(
    "rejects symbol-only component name %s",
    (component) => {
      const scene = sceneFor("调用量增长 20%。");
      const result = validateDirectorContract({
        scene,
        semantics: extractSceneSemantics(scene),
        directorType: "DataExplosion",
        content: {
          metrics: [{ label: "调用量增长", value: "20%" }],
        },
        components: [component],
      });

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "component.invalid-structure",
            field: "components",
            severity: "error",
          }),
        ]),
      );
    },
  );

  test("rejects symbol-only structured component content before derivation", () => {
    const scene = sceneFor("调用量增长 20%。");
    const result = validateDirectorContract({
      scene,
      semantics: extractSceneSemantics(scene),
      directorType: "DataExplosion",
      content: {
        metrics: [{ label: "---", value: "20%" }],
      },
      components: ["MetricCounter"],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "content.required-field",
          field: "metrics",
          severity: "error",
        }),
        expect.objectContaining({
          code: "component.not-derived",
          field: "MetricCounter",
          severity: "error",
        }),
      ]),
    );
  });

  test.each([
    ["orderedLayers", { orderedLayers: ["模型", " 模型。", "模型"] }],
    ["orderedLayers", { orderedLayers: ["", " ", "。"] }],
    ["barriers", { barriers: ["制程", " 制程。", "制程"] }],
  ])(
    "rejects blank or normalized duplicate semantic strings in %s",
    (field, patch) => {
      const scene = sceneFor("模型、API、芯片构成系统，制程是障碍。");
      const semantics = {
        ...emptySemantics(scene),
        ...patch,
      };
      const result = validateDirectorContract({
        scene,
        semantics,
        directorType: "KeywordInvestigation",
        content: { keywordTags: ["模型"] },
        components: [],
      });

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "semantic.invalid-structure",
            field,
            severity: "error",
          }),
        ]),
      );
    },
  );

  test.each([
    [{ from: "", to: "芯片", relation: "依赖" }, "relations"],
    [{ from: "模型", to: "", relation: "依赖" }, "relations"],
    [{ from: "模型", to: "芯片", relation: "" }, "relations"],
  ])(
    "rejects a relation with blank semantic text",
    (relation, field) => {
      const scene = sceneFor("模型依赖芯片。");
      const source = factualSource(scene.subtitle);
      const semantics = emptySemantics(scene);
      semantics.relations = [{ ...relation, source }];
      semantics.sources = [source];

      const result = validateDirectorContract({
        scene,
        semantics,
        directorType: "SystemMap",
        content: { nodes: ["模型", "芯片"] },
        components: [],
      });

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "semantic.invalid-structure",
            field,
            severity: "error",
          }),
        ]),
      );
    },
  );

  test.each([
    [
      "signals.targets",
      {
        signals: [
          {
            sourceLabel: "开源发布",
            targets: [],
          },
        ],
      },
    ],
    [
      "signals.targets",
      {
        signals: [
          {
            sourceLabel: "开源发布",
            targets: ["模型", " 模型。"],
          },
        ],
      },
    ],
    [
      "judgements.evidence",
      {
        judgements: [
          {
            conclusion: "供应受限",
            evidence: [],
          },
        ],
      },
    ],
    [
      "judgements.evidence",
      {
        judgements: [
          {
            conclusion: "供应受限",
            evidence: ["交付延期", " 交付延期。"],
          },
        ],
      },
    ],
  ])(
    "rejects empty or normalized duplicate nested semantic strings in %s",
    (field, patch) => {
      const scene = sceneFor("开源发布影响模型，交付延期说明供应受限。");
      const source = factualSource(scene.subtitle);
      const signals =
        "signals" in patch
          ? patch.signals.map((signal) => ({ ...signal, source }))
          : [];
      const judgements =
        "judgements" in patch
          ? patch.judgements.map((judgement) => ({
              ...judgement,
              source,
            }))
          : [];
      const semantics = {
        ...emptySemantics(scene),
        signals,
        judgements,
        sources: [source],
      };

      const result = validateDirectorContract({
        scene,
        semantics,
        directorType: "KeywordInvestigation",
        content: { keywordTags: ["开源发布"] },
        components: [],
      });

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "semantic.invalid-structure",
            field,
            severity: "error",
          }),
        ]),
      );
    },
  );

  test.each([
    [
      "metrics",
      (source: SemanticSourceRef) => ({
        metrics: [
          { label: "调用量", value: "20%", unit: "%", source },
          { label: " 调用量。", value: "20%", unit: "%", source },
        ],
      }),
    ],
    [
      "prices",
      (source: SemanticSourceRef) => ({
        prices: [
          { label: "输入", value: "1元", currency: "CNY", source },
          { label: " 输入。", value: "1元", currency: "CNY", source },
        ],
      }),
    ],
    [
      "timelineEvents",
      (source: SemanticSourceRef) => ({
        timelineEvents: [
          {
            label: "开始测试",
            order: 0,
            timeExpression: "一年前",
            source,
          },
          {
            label: " 开始测试。",
            order: 0,
            timeExpression: " 一年前 ",
            source,
          },
        ],
      }),
    ],
    [
      "comparisons",
      (source: SemanticSourceRef) => ({
        comparisons: [
          { left: "训练", right: "推理", dimension: "成本", source },
          {
            left: " 训练。",
            right: "推理",
            dimension: " 成本。",
            source,
          },
        ],
      }),
    ],
    [
      "relations",
      (source: SemanticSourceRef) => ({
        relations: [
          { from: "模型", to: "芯片", relation: "依赖", source },
          { from: " 模型。", to: "芯片", relation: " 依赖。", source },
        ],
      }),
    ],
    [
      "signals",
      (source: SemanticSourceRef) => ({
        signals: [
          {
            sourceLabel: "开源发布",
            targets: ["模型", "芯片"],
            source,
          },
          {
            sourceLabel: " 开源发布。",
            targets: [" 芯片。", "模型"],
            source,
          },
        ],
      }),
    ],
    [
      "judgements",
      (source: SemanticSourceRef) => ({
        judgements: [
          {
            conclusion: "供应受限",
            evidence: ["交付延期", "价格上涨"],
            source,
          },
          {
            conclusion: " 供应受限。",
            evidence: [" 价格上涨。", "交付延期"],
            source,
          },
        ],
      }),
    ],
  ] as const)(
    "rejects normalized duplicate structured semantic facts in %s",
    (field, buildPatch) => {
      const scene = sceneFor(
        "调用量 20%，输入 1 元，一年前开始测试，训练与推理成本不同，模型依赖芯片，开源发布影响模型和芯片，交付延期与价格上涨说明供应受限。",
      );
      const source = factualSource(scene.subtitle);
      const semantics = {
        ...emptySemantics(scene),
        ...buildPatch(source),
        sources: [source],
      };

      const result = validateDirectorContract({
        scene,
        semantics,
        directorType: "KeywordInvestigation",
        content: { keywordTags: ["模型"] },
        components: [],
      });

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "semantic.invalid-structure",
            field,
            severity: "error",
          }),
        ]),
      );
    },
  );

  test.each([
    ["source text", { text: "" }, "sources"],
    ["source referenceId", { referenceId: " " }, "sources"],
    ["source matchedClaim", { matchedClaim: "。" }, "sources"],
  ])(
    "rejects an invalid %s",
    (_name, sourcePatch, field) => {
      const scene = sceneFor("模型依赖芯片。");
      const semantics = emptySemantics(scene);
      semantics.sources = [
        factualSource(scene.subtitle, sourcePatch),
      ];

      const result = validateDirectorContract({
        scene,
        semantics,
        directorType: "KeywordInvestigation",
        content: { keywordTags: ["模型"] },
        components: [],
      });

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "semantic.invalid-structure",
            field,
            severity: "error",
          }),
        ]),
      );
    },
  );

  test("rejects semantics extracted for a different scene", () => {
    const scene = sceneFor("模型依赖芯片。");
    const semantics = emptySemantics(scene);
    semantics.sceneId = "scene-other";

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "KeywordInvestigation",
      content: { keywordTags: ["模型"] },
      components: [],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "semantic.invalid-structure",
          field: "sceneId",
          severity: "error",
        }),
      ]),
    );
  });

  test.each([
    [
      "metrics",
      (source: SemanticSourceRef) => ({
        metrics: [{ label: "调用量", value: "20%", source }],
      }),
    ],
    [
      "prices",
      (source: SemanticSourceRef) => ({
        prices: [{ label: "输入", value: "1元", source }],
      }),
    ],
    [
      "timelineEvents",
      (source: SemanticSourceRef) => ({
        timelineEvents: [
          {
            label: "开始测试",
            order: 0,
            timeExpression: "一年前",
            source,
          },
        ],
      }),
    ],
    [
      "comparisons",
      (source: SemanticSourceRef) => ({
        comparisons: [
          { left: "训练", right: "推理", dimension: "成本", source },
        ],
      }),
    ],
    [
      "relations",
      (source: SemanticSourceRef) => ({
        relations: [
          { from: "模型", to: "芯片", relation: "依赖", source },
        ],
      }),
    ],
    [
      "signals",
      (source: SemanticSourceRef) => ({
        signals: [
          {
            sourceLabel: "开源发布",
            targets: ["模型"],
            source,
          },
        ],
      }),
    ],
    [
      "judgements",
      (source: SemanticSourceRef) => ({
        judgements: [
          {
            conclusion: "供应受限",
            evidence: ["交付延期"],
            source,
          },
        ],
      }),
    ],
  ] as const)(
    "rejects an unregistered source embedded in %s",
    (field, buildPatch) => {
      const scene = sceneFor("当前镜头的已登记来源。");
      const registeredSource = factualSource(scene.subtitle);
      const unregisteredSource = factualSource("另一个未登记来源。");
      const semantics = {
        ...emptySemantics(scene),
        ...buildPatch(unregisteredSource),
        sources: [registeredSource],
      };

      const result = validateDirectorContract({
        scene,
        semantics,
        directorType: "KeywordInvestigation",
        content: { keywordTags: ["当前镜头"] },
        components: [],
      });

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "semantic.invalid-structure",
            field: `${field}.source`,
            severity: "error",
          }),
        ]),
      );
    },
  );

  test("allows opposite relation directions as distinct facts", () => {
    const scene = sceneFor("甲影响乙，乙也反向影响甲。");
    const source = factualSource(scene.subtitle);
    const semantics = emptySemantics(scene);
    semantics.relations = [
      { from: "甲", to: "乙", relation: "影响", source },
      { from: "乙", to: "甲", relation: "影响", source },
    ];
    semantics.sources = [source];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "SystemMap",
      content: { nodes: ["甲", "乙"] },
      components: [],
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  test("allows opposite comparison directions as distinct facts", () => {
    const scene = sceneFor("甲对乙与乙对甲是两个有向比较。");
    const source = factualSource(scene.subtitle);
    const semantics = emptySemantics(scene);
    semantics.comparisons = [
      { left: "甲", right: "乙", dimension: "方向", source },
      { left: "乙", right: "甲", dimension: "方向", source },
    ];
    semantics.sources = [source];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "Contrast",
      content: {
        comparisons: [
          { label: "方向", value: "甲" },
          { label: "方向", value: "乙" },
        ],
      },
      components: [],
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  test("accepts distinct valid semantic facts after structure validation", () => {
    const scene = sceneFor("模型依赖英伟达和国产芯片。");
    const source = factualSource(scene.subtitle);
    const semantics = emptySemantics(scene);
    semantics.relations = [
      { from: "模型", to: "英伟达", relation: "依赖", source },
      { from: "模型", to: "国产芯片", relation: "依赖", source },
    ];
    semantics.sources = [source];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "DependencyMap",
      content: {
        centerNode: "模型",
        leftPath: { node: "英伟达" },
        rightPath: { node: "国产芯片" },
      },
      components: ["SupplyDependencyMap"],
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  test.each([
    null,
    {},
    "MetricCounter",
    ["MetricCounter", ""],
    ["MetricCounter", null],
    ["MetricCounter", 1],
  ])("fails closed for malformed components %j", (components) => {
    const scene = sceneFor("调用量增长 20%。");

    expect(() =>
      validateDirectorContract({
        scene,
        semantics: extractSceneSemantics(scene),
        directorType: "DataExplosion",
        content: {
          metrics: [{ label: "调用量增长", value: "20%" }],
        },
        components: components as unknown as string[],
      }),
    ).not.toThrow();

    const result = validateDirectorContract({
      scene,
      semantics: extractSceneSemantics(scene),
      directorType: "DataExplosion",
      content: {
        metrics: [{ label: "调用量增长", value: "20%" }],
      },
      components: components as unknown as string[],
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "component.invalid-structure",
          field: "components",
          severity: "error",
        }),
      ]),
    );
  });

  const unsupportedCases: Array<
    [DirectorSceneType, string, DirectorSceneContent, string]
  > = [
    [
      "DataExplosion",
      "没有任何数字。",
      { metrics: [] },
      "semantic.metric-required",
    ],
    [
      "Pricing",
      "推理成本是长期水电费。",
      { metrics: [] },
      "semantic.price-required",
    ],
    [
      "Timeline",
      "这是一条行业判断。",
      { timelineItems: [] },
      "semantic.timeline-required",
    ],
    [
      "SystemStack",
      "模型正在变化。",
      { layers: [] },
      "semantic.layers-required",
    ],
    [
      "DependencyMap",
      "供应很重要。",
      {},
      "semantic.paths-required",
    ],
    [
      "BarrierWall",
      "芯片很难。",
      { barriers: [] },
      "semantic.barriers-required",
    ],
  ];

  test.each(unsupportedCases)(
    "rejects semantically unsupported %s",
    (directorType, subtitle, content, code) => {
      expect(validate(subtitle, directorType, content).issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code, severity: "error" }),
        ]),
      );
    },
  );

  test("rejects required content even when the semantic prerequisite exists", () => {
    const result = validate(
      "输入 1 元每百万 tokens，输出 4 元每百万 tokens。",
      "Pricing",
      { metrics: [] },
    );

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "content.required-field",
          field: "metrics",
        }),
      ]),
    );
  });

  test("does not let one timeline fact be consumed twice", () => {
    const scene = sceneFor("一年前开始测试，目前正式上线。");
    const semantics = extractSceneSemantics(scene);
    const repeatedItem = { label: "一年前", title: "开始测试" };
    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "Timeline",
      content: {
        timelineItems: [
          repeatedItem,
          { label: " 一年前 ", title: "开始测试。" },
        ],
      },
      components: [],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "content.required-field",
          field: "timelineItems",
        }),
      ]),
    );
  });

  test("does not let one metric fact be consumed twice", () => {
    const result = validate(
      "调用量增长 20%。",
      "DataExplosion",
      {
        metrics: [
          { label: "调用量增长", value: "20%" },
          { label: " 调用量增长。", value: "20%" },
        ],
      },
      ["MetricCounter"],
    );

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "content.required-field",
          field: "metrics",
        }),
        expect.objectContaining({
          code: "component.not-derived",
          field: "MetricCounter",
        }),
      ]),
    );
  });

  test("does not let one barrier satisfy a three-item minimum", () => {
    const result = validate(
      "制程、HBM、软件生态，每一关都是障碍。",
      "BarrierWall",
      {
        barriers: [
          { label: "制程" },
          { label: " 制程。" },
          { label: "制程" },
        ],
      },
      ["ChipBarrierWall"],
    );

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "content.required-field",
          field: "barriers",
        }),
        expect.objectContaining({
          code: "component.not-derived",
          field: "ChipBarrierWall",
        }),
      ]),
    );
  });

  test.each([
    [
      {
        centerNode: "模型",
        leftPath: null,
        rightPath: { node: "国产芯片" },
      },
      "leftPath",
    ],
    [
      {
        centerNode: "模型",
        leftPath: {
          node: "英伟达",
          riskTags: ["供应风险", " 供应风险。"],
        },
        rightPath: { node: "国产芯片" },
      },
      "leftPath.riskTags",
    ],
    [
      {
        centerNode: "模型",
        leftPath: { node: "英伟达" },
        rightPath: { node: " 英伟达。" },
      },
      "rightPath",
    ],
  ])(
    "rejects invalid DependencyMap content structure",
    (content, field) => {
      const scene = sceneFor("模型依赖英伟达和国产芯片。");
      const result = validateDirectorContract({
        scene,
        semantics: extractSceneSemantics(scene),
        directorType: "DependencyMap",
        content: content as unknown as DirectorSceneContent,
        components: ["SupplyDependencyMap"],
      });

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field,
            severity: "error",
          }),
        ]),
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "component.not-derived",
            field: "SupplyDependencyMap",
          }),
        ]),
      );
    },
  );

  test("rejects duplicate DependencyMap relations before provenance checks", () => {
    const scene = sceneFor("模型依赖英伟达和国产芯片。");
    const source = factualSource(scene.subtitle);
    const semantics = emptySemantics(scene);
    const repeatedRelation = {
      from: "模型",
      to: "英伟达",
      relation: "依赖",
      source,
    };
    semantics.relations = [repeatedRelation, { ...repeatedRelation }];
    semantics.sources = [source];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "DependencyMap",
      content: {
        centerNode: "模型",
        leftPath: { node: "英伟达" },
        rightPath: { node: "国产芯片" },
      },
      components: ["SupplyDependencyMap"],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "semantic.invalid-structure",
          field: "relations",
        }),
        expect.objectContaining({
          code: "component.not-derived",
          field: "SupplyDependencyMap",
        }),
      ]),
    );
  });

  test("accepts two distinct center-linked relations for DependencyMap", () => {
    const scene = sceneFor("模型依赖英伟达和国产芯片。");
    const source = factualSource(scene.subtitle);
    const semantics = emptySemantics(scene);
    semantics.relations = [
      { from: "模型", to: "英伟达", relation: "依赖", source },
      { from: "模型", to: "国产芯片", relation: "依赖", source },
    ];
    semantics.sources = [source];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "DependencyMap",
      content: {
        centerNode: "模型",
        leftPath: { node: "英伟达" },
        rightPath: { node: "国产芯片" },
      },
      components: ["SupplyDependencyMap"],
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  test("rejects KLineChart even for metric and pricing capabilities", () => {
    const dataResult = validate(
      "调用量增长 20%。",
      "DataExplosion",
      { metrics: [{ label: "调用量增长", value: "20%" }] },
      ["KLineChart"],
    );
    const pricingResult = validate(
      "输入 1 元每百万 tokens。",
      "Pricing",
      { metrics: [{ label: "输入", value: "1元" }] },
      ["KLineChart"],
    );

    for (const result of [dataResult, pricingResult]) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "component.forbidden",
            field: "KLineChart",
          }),
        ]),
      );
    }
  });

  test("allows a subset of components derived from validated content", () => {
    const result = validate(
      "调用量增长 20%。",
      "DataExplosion",
      { metrics: [{ label: "调用量增长", value: "20%" }] },
      ["MetricCounter"],
    );

    expect(result.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "component.not-derived" }),
      ]),
    );
  });

  test("rejects a component that was not derived from validated content", () => {
    const result = validate(
      "调用量增长 20%。",
      "DataExplosion",
      { metrics: [{ label: "调用量增长", value: "20%" }] },
      ["MetricCard", "MetricCounter", "BarRaceChart"],
    );

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "component.not-derived",
          field: "BarRaceChart",
        }),
      ]),
    );
  });

  test("reports a duplicated non-derived component only once", () => {
    const result = validate(
      "调用量增长 20%。",
      "DataExplosion",
      { metrics: [{ label: "调用量增长", value: "20%" }] },
      ["BarRaceChart", "BarRaceChart"],
    );

    expect(
      result.issues.filter(
        (issue) =>
          issue.code === "component.not-derived" &&
          issue.field === "BarRaceChart",
      ),
    ).toHaveLength(1);
  });

  test("rejects content values that cannot be traced to factual semantics or sources", () => {
    const result = validate(
      "输入 1 元每百万 tokens，输出 4 元每百万 tokens。",
      "Pricing",
      { metrics: [{ label: "输入", value: "99元" }] },
      ["PriceCard"],
    );

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "content.untraceable-value",
          field: "metrics",
          sourceText: "99元",
        }),
      ]),
    );
  });

  test("rejects a metric assembled from different factual sources", () => {
    const scene = sceneFor("比较输入和输出价格。");
    const inputSource = factualSource("输入价格是 1 元。");
    const outputSource = factualSource("输出价格是 99 元。");
    const semantics = emptySemantics(scene);
    semantics.prices = [
      {
        label: "输入",
        value: "1元",
        currency: "CNY",
        source: inputSource,
      },
      {
        label: "输出",
        value: "99元",
        currency: "CNY",
        source: outputSource,
      },
    ];
    semantics.sources = [inputSource, outputSource];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "Pricing",
      content: { metrics: [{ label: "输入", value: "99元" }] },
      components: ["PriceCard"],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "content.untraceable-value",
          field: "metrics",
          sourceText: "99元",
        }),
      ]),
    );
  });

  const invalidStructuredContentCases: Array<
    [DirectorSceneType, string, DirectorSceneContent, string]
  > = [
    [
      "SystemStack",
      "请求经过模型、API、推理服务，最后进入芯片执行。",
      { layers: [{}, {}, {}], highlight: "芯片执行" },
      "layers",
    ],
    [
      "SystemMap",
      "DeepSeek 绕不开两条路：一条是英伟达，一条是国产替代芯片。",
      { nodes: ["", { label: " " }] },
      "nodes",
    ],
    [
      "BarrierWall",
      "制程、HBM、软件生态，每一关都是障碍。",
      {
        barriers: [{ label: "" }, { label: " " }, { label: "" }],
      },
      "barriers",
    ],
    [
      "Timeline",
      "一年前开始测试，目前正式上线。",
      {
        timelineItems: [
          { label: "", title: "" },
          { label: " ", title: " " },
        ],
      },
      "timelineItems",
    ],
    [
      "Contrast",
      "训练是一次性投入，推理是长期成本。",
      {
        comparisons: [
          { label: "", value: "" },
          { label: " ", value: " " },
        ],
      },
      "comparisons",
    ],
    [
      "SpecSheet",
      "吞吐提升 20%，延迟下降 30%。",
      {
        metrics: [
          { label: "", value: "" },
          { label: " ", value: " " },
        ],
      },
      "metrics",
    ],
    [
      "DataExplosion",
      "调用量增长 20%。",
      { metrics: [{ label: "", value: "" }] },
      "metrics",
    ],
    [
      "SystemStack",
      "模型、API、芯片构成三层系统。",
      {
        layers: [
          { name: "模型", label: "" },
          "API",
          "芯片",
        ],
        highlight: "芯片",
      },
      "layers",
    ],
    [
      "DependencyMap",
      "模型依赖英伟达，也依赖国产芯片。",
      {
        centerNode: "模型",
        leftPath: { node: "英伟达", riskTags: [""] },
        rightPath: { node: "国产芯片", riskTags: ["供应风险"] },
      },
      "leftPath",
    ],
  ];

  test.each(invalidStructuredContentCases)(
    "rejects structurally empty required elements for %s",
    (directorType, subtitle, content, field) => {
      const result = validate(subtitle, directorType, content);

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "content.required-field",
            field,
          }),
        ]),
      );
    },
  );

  test("does not accept a shorter numeric value by substring matching", () => {
    const result = validate(
      "官方售价是 11 元。",
      "Pricing",
      { metrics: [{ label: "售价", value: "1元" }] },
    );

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "content.untraceable-value",
          sourceText: "1元",
        }),
      ]),
    );
  });

  test("does not trace unstructured text by matching only its numeric token", () => {
    const result = validate(
      "成本是 99 元。",
      "Summary",
      { summaryItems: ["收入 99 元"] },
    );

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "content.untraceable-value",
          field: "summaryItems",
          sourceText: "收入 99 元",
        }),
      ]),
    );
  });

  test.each([
    {
      name: "metric note",
      directorType: "DataExplosion" as const,
      content: {
        metrics: [
          { label: "调用量增长", value: "20%", note: "行业第一" },
        ],
      },
      configure: (semantics: SceneSemantics, source: SemanticSourceRef) => {
        semantics.metrics = [
          {
            label: "调用量增长",
            value: "20%",
            unit: "%",
            source,
          },
        ];
      },
      sourceText: "行业第一",
    },
    {
      name: "timeline note",
      directorType: "Timeline" as const,
      content: {
        timelineItems: [
          { label: "一年前", title: "开始测试", note: "秘密发布" },
          { label: "目前", title: "正式上线" },
        ],
      },
      configure: (semantics: SceneSemantics, source: SemanticSourceRef) => {
        semantics.timelineEvents = [
          {
            label: "开始测试",
            order: 0,
            timeExpression: "一年前",
            source,
          },
          {
            label: "正式上线",
            order: 1,
            timeExpression: "目前",
            source,
          },
        ];
      },
      sourceText: "秘密发布",
    },
    {
      name: "node role",
      directorType: "SystemMap" as const,
      content: {
        nodes: [
          { label: "模型", role: "行业霸主" },
          { label: "芯片" },
        ],
      },
      configure: (semantics: SceneSemantics, source: SemanticSourceRef) => {
        semantics.relations = [
          {
            from: "模型",
            to: "芯片",
            relation: "依赖",
            source,
          },
        ];
      },
      sourceText: "行业霸主",
    },
    {
      name: "barrier visual",
      directorType: "BarrierWall" as const,
      content: {
        barriers: [
          { label: "制程", visual: "金色王冠" },
          { label: "HBM" },
          { label: "软件生态" },
        ],
      },
      configure: (semantics: SceneSemantics) => {
        semantics.barriers = ["制程", "HBM", "软件生态"];
      },
      sourceText: "金色王冠",
    },
    {
      name: "barrier shape",
      directorType: "BarrierWall" as const,
      content: {
        barriers: [
          { label: "制程", shape: "胜利奖杯" },
          { label: "HBM" },
          { label: "软件生态" },
        ],
      },
      configure: (semantics: SceneSemantics) => {
        semantics.barriers = ["制程", "HBM", "软件生态"];
      },
      sourceText: "胜利奖杯",
    },
  ])(
    "rejects an untraceable supplied $name",
    ({ directorType, content, configure, sourceText }) => {
      const scene = sceneFor(
        "一年前开始测试，目前正式上线。模型依赖芯片。制程、HBM、软件生态都是障碍。调用量增长 20%。",
      );
      const source = factualSource(scene.subtitle);
      const semantics = emptySemantics(scene);
      configure(semantics, source);
      semantics.sources = [source];

      const result = validateDirectorContract({
        scene,
        semantics,
        directorType,
        content,
        components: [],
      });

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "content.untraceable-value",
            sourceText,
          }),
        ]),
      );
    },
  );

  test("rejects an extra invalid metric even when another metric is valid", () => {
    const scene = sceneFor("调用量增长 20%。");
    const source = factualSource(scene.subtitle);
    const semantics = emptySemantics(scene);
    semantics.metrics = [
      {
        label: "调用量增长",
        value: "20%",
        unit: "%",
        source,
      },
    ];
    semantics.sources = [source];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "DataExplosion",
      content: {
        metrics: [
          { label: "调用量增长", value: "20%" },
          { label: "伪造", value: "" },
        ],
      },
      components: [],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "content.required-field",
          field: "metrics",
        }),
      ]),
    );
  });

  test.each([
    factualSource("未来收入 99 元。", {
      kind: "ai-concept",
      supportsFacts: true,
    }),
    factualSource("未来收入 99 元。", { supportsFacts: false }),
  ])(
    "rejects fact values backed only by an untrusted source",
    (source) => {
      const scene = sceneFor("讨论未来收入。");
      const semantics = emptySemantics(scene);
      semantics.metrics = [
        { label: "未来收入", value: "99元", unit: "元", source },
      ];
      semantics.sources = [source];

      const result = validateDirectorContract({
        scene,
        semantics,
        directorType: "DataExplosion",
        content: {
          metrics: [{ label: "未来收入", value: "99元" }],
        },
        components: ["MetricCounter"],
      });

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "content.untraceable-value",
            sourceText: "99元",
          }),
        ]),
      );
    },
  );

  test("accepts content values backed by a factual attached source", () => {
    const scene = sceneFor("讨论当前价格。");
    const source = factualSource("当前输入价格是 1 元。");
    const semantics = emptySemantics(scene);
    semantics.prices = [
      {
        label: "输入",
        value: "1元",
        currency: "CNY",
        source,
      },
    ];
    semantics.sources = [source];

    const result = validateDirectorContract({
      scene,
      semantics,
      directorType: "Pricing",
      content: { metrics: [{ label: "输入", value: "1元" }] },
      components: ["PriceCard"],
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  test("rejects a renderer family or treatment not declared by the capability", () => {
    const scene: Scene = {
      ...sceneFor("持续调用会带来算力消耗和推理成本。"),
      id: "scene-treatment",
      rendererFamily: "data",
      visualTreatment: "metric-burst",
    };
    const result = validateDirectorContract({
      scene,
      semantics: extractSceneSemantics(scene),
      directorType: "FinancialMeter",
      content: {
        dataWidgets: ["持续调用", "算力消耗", "推理成本"],
      },
      components: ["InferenceCostBill"],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "renderer.family-mismatch" }),
        expect.objectContaining({
          code: "renderer.treatment-not-allowed",
        }),
      ]),
    );
  });
});
