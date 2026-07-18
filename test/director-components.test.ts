import { describe, expect, test } from "vitest";
import { deriveDirectorComponents } from "@/lib/director-components";
import type {
  DirectorSceneContent,
  DirectorSceneType,
} from "@/lib/types";

const validContentByType = {
  Hero: { headline: "开场判断" },
  Timeline: {
    timelineItems: [
      { label: "一年前", title: "开始测试" },
      { label: "目前", title: "正式上线" },
    ],
  },
  SystemMap: { nodes: ["模型", "芯片"] },
  DataExplosion: { metrics: [{ label: "增长", value: "20倍" }] },
  Contrast: {
    comparisons: [
      { label: "训练", value: "一次性投入" },
      { label: "推理", value: "长期成本" },
    ],
  },
  SpecSheet: {
    metrics: [
      { label: "吞吐", value: "20%" },
      { label: "延迟", value: "30%" },
    ],
  },
  Pricing: { metrics: [{ label: "输入", value: "1元" }] },
  Pause: { action: "先停下来想一想" },
  Summary: { summaryItems: ["结论一"] },
  EvidenceHero: {
    evidenceKeywords: ["证据 A"],
    factBoundary: ["仅说明已验证事实"],
  },
  KeywordInvestigation: { keywordTags: ["推理成本"] },
  FinancialMeter: { dataWidgets: ["持续调用", "算力消耗"] },
  SystemStack: {
    layers: ["模型", "API", "芯片"],
    highlight: "芯片",
  },
  DependencyMap: {
    centerNode: "模型",
    leftPath: { node: "英伟达" },
    rightPath: { node: "国产芯片" },
  },
  QuestionPause: { action: "算力命脉掌握在谁手里？" },
  BarrierWall: {
    barriers: [
      { label: "制程" },
      { label: "HBM" },
      { label: "软件生态" },
    ],
  },
  EvidenceReturn: {
    evidenceLabel: "证据 A",
    judgementPanel: ["结论"],
  },
  IndustrySignal: {
    signalSource: "开源发布",
    nodes: ["模型厂商", "芯片厂商"],
  },
  CompetitionLayerStack: { nodes: ["模型", "芯片", "供应链"] },
  FinalJudgement: {
    judgementPanel: ["不想一直等别人发货"],
    judgementTags: ["供应依赖"],
  },
} satisfies Record<DirectorSceneType, DirectorSceneContent>;

const expectedComponentsByType = {
  Hero: ["HeroTitle"],
  Timeline: ["TimelineView", "TimelineRail"],
  SystemMap: ["NodeGraph", "ProductEcosystemMap"],
  DataExplosion: ["MetricCard", "MetricCounter"],
  Contrast: ["RiskMeter"],
  SpecSheet: ["SpecTable", "MetricCard", "EvidenceWall"],
  Pricing: ["PriceCard", "MetricCard", "MetricCounter"],
  Pause: ["PauseScreen"],
  Summary: ["SummaryCard"],
  EvidenceHero: ["EvidenceZoom", "EvidenceCallout", "LogoCornerCompare"],
  KeywordInvestigation: [
    "EvidenceDataSplit",
    "TwoKeywordInvestigation",
    "CautionBadge",
  ],
  FinancialMeter: ["InferenceCostBill", "TokenMeter"],
  SystemStack: ["ModelHardwareStack", "DataPathTrace", "ComputeFlow"],
  DependencyMap: ["SupplyDependencyMap", "RiskTagCallout"],
  QuestionPause: ["ControlQuestionPause"],
  BarrierWall: ["ChipBarrierWall", "MicroSceneTile"],
  EvidenceReturn: ["EvidenceReturnFrame", "DualJudgementPanel"],
  IndustrySignal: ["IndustrySignalRadar", "MarketLayerMap"],
  CompetitionLayerStack: ["CompetitionLayerStack"],
  FinalJudgement: ["FinalJudgementPanel"],
} satisfies Record<DirectorSceneType, string[]>;

describe("deriveDirectorComponents", () => {
  test.each([
    ["Hero", { headline: "---" }],
    [
      "DataExplosion",
      { metrics: [{ label: "///", value: "20%" }] },
    ],
    ["Summary", { summaryItems: ["___"] }],
    [
      "SystemStack",
      {
        layers: ["模型", "API", "芯片"],
        highlight: "***",
      },
    ],
    [
      "DependencyMap",
      {
        centerNode: "模型",
        leftPath: { node: "英伟达", riskTags: ["###"] },
        rightPath: { node: "国产芯片" },
      },
    ],
  ] satisfies Array<[DirectorSceneType, DirectorSceneContent]>)(
    "rejects symbol-only content for %s",
    (directorType, content) => {
      expect(deriveDirectorComponents(directorType, content)).toEqual([]);
    },
  );

  test.each(["模型", "Revenue", "2026", "增长（YoY）!"])(
    "accepts meaningful Unicode component content %s",
    (value) => {
      expect(
        deriveDirectorComponents("Summary", {
          summaryItems: [value],
        }),
      ).toEqual(["SummaryCard"]);
    },
  );

  test("does not let Unicode compatibility variants satisfy layer minimums", () => {
    expect(
      deriveDirectorComponents("SystemStack", {
        layers: ["A", "Ａ", "𝐀"],
        highlight: "A",
      }),
    ).toEqual([]);
  });

  test("treats composed and decomposed text as the same item", () => {
    expect(
      deriveDirectorComponents("SystemMap", {
        nodes: ["é", "e\u0301"],
      }),
    ).toEqual([]);
  });

  test("does not let zero-width format characters escape duplicate checks", () => {
    expect(
      deriveDirectorComponents("SystemMap", {
        nodes: ["模型", "模\u200B型"],
      }),
    ).toEqual([]);
  });

  test("does not let text and emoji variation selectors satisfy layer minimums", () => {
    expect(
      deriveDirectorComponents("SystemStack", {
        layers: ["A", "A\uFE0E", "A\uFE0F"],
        highlight: "A",
      }),
    ).toEqual([]);
  });

  test("removes supplementary variation selectors from item identity", () => {
    expect(
      deriveDirectorComponents("SystemMap", {
        nodes: ["模型", "模\u{E0100}型"],
      }),
    ).toEqual([]);
  });

  test("keeps display text while treating emoji presentation variants as equivalent", () => {
    const nodes = ["航班✈︎", "航班✈️"];

    expect(
      deriveDirectorComponents("SystemMap", { nodes }),
    ).toEqual([]);
    expect(nodes).toEqual(["航班✈︎", "航班✈️"]);
  });

  test("keeps distinct Chinese and English layers derivable", () => {
    expect(
      deriveDirectorComponents("SystemStack", {
        layers: ["模型", "API", "Chip"],
        highlight: "API",
      }),
    ).toEqual(["ModelHardwareStack", "DataPathTrace", "ComputeFlow"]);
  });

  test("does not create data charts without valid metrics", () => {
    expect(
      deriveDirectorComponents("DataExplosion", {
        headline: "抽象判断",
        metrics: [],
      }),
    ).toEqual([]);
    expect(
      deriveDirectorComponents("DataExplosion", {
        metrics: [{ label: " ", value: "20倍" }],
      }),
    ).toEqual([]);
  });

  test("uses metric cards without inferring comparison semantics from matching units", () => {
    expect(
      deriveDirectorComponents("DataExplosion", {
        metrics: [{ label: "增长", value: "20倍" }],
      }),
    ).toEqual(["MetricCard", "MetricCounter"]);

    expect(
      deriveDirectorComponents("DataExplosion", {
        metrics: [
          { label: "输入", value: "1元" },
          { label: "输出", value: "4元" },
        ],
      }),
    ).toEqual(["MetricCard", "MetricCounter"]);

    expect(
      deriveDirectorComponents("DataExplosion", {
        metrics: [
          { label: "采用率", value: "20%" },
          { label: "留存率", value: "30%" },
        ],
      }),
    ).toEqual(["MetricCard", "MetricCounter"]);
  });

  test("does not infer comparability from duplicate or partial unit suffixes", () => {
    expect(
      deriveDirectorComponents("DataExplosion", {
        metrics: [
          { label: "增长", value: "20倍" },
          { label: "增长", value: "20倍" },
        ],
      }),
    ).toEqual([]);

    expect(
      deriveDirectorComponents("DataExplosion", {
        metrics: [
          { label: "输入", value: "约 1 元" },
          { label: "输出", value: "约 4 元" },
        ],
      }),
    ).toEqual(["MetricCard", "MetricCounter"]);
  });

  test.each([
    [
      "Timeline",
      {
        timelineItems: [
          { label: "一年前", title: "开始测试" },
          { label: " 一年前 ", title: "开始测试。" },
        ],
      },
    ],
    ["SystemMap", { nodes: ["模型", " 模型。"] }],
    [
      "Contrast",
      {
        comparisons: [
          { label: "训练", value: "一次性投入" },
          { label: "训练。", value: "一次性投入" },
        ],
      },
    ],
    [
      "SpecSheet",
      {
        metrics: [
          { label: "吞吐", value: "20%" },
          { label: "吞吐。", value: "20%" },
        ],
      },
    ],
    [
      "DataExplosion",
      {
        metrics: [
          { label: "调用量增长", value: "20%" },
          { label: " 调用量增长。", value: "20%" },
        ],
      },
    ],
    [
      "SystemStack",
      {
        layers: ["模型", " 模型。", { label: "模型" }],
        highlight: "模型",
      },
    ],
    [
      "BarrierWall",
      {
        barriers: [
          { label: "制程" },
          { label: " 制程。" },
          { label: "制程" },
        ],
      },
    ],
    [
      "IndustrySignal",
      {
        signalSource: "开源发布",
        nodes: ["模型厂商", " 模型厂商。"],
      },
    ],
    [
      "CompetitionLayerStack",
      { nodes: ["模型", " 模型。", { label: "模型" }] },
    ],
  ] satisfies Array<[DirectorSceneType, DirectorSceneContent]>)(
    "does not let normalized duplicate items satisfy %s minimums",
    (directorType, content) => {
      expect(deriveDirectorComponents(directorType, content)).toEqual([]);
    },
  );

  test("returns no components for malformed known-type content", () => {
    expect(
      deriveDirectorComponents("DataExplosion", {
        metrics: [null],
      } as unknown as DirectorSceneContent),
    ).toEqual([]);
  });

  test.each([
    {
      centerNode: "模型",
      leftPath: null,
      rightPath: { node: "国产芯片" },
    },
    {
      centerNode: "模型",
      leftPath: { node: "英伟达", riskTags: ["供应风险", " 供应风险。"] },
      rightPath: { node: "国产芯片" },
    },
    {
      centerNode: "模型",
      leftPath: { node: "英伟达" },
      rightPath: { node: " 英伟达。" },
    },
  ])(
    "returns no components for invalid DependencyMap structure",
    (content) => {
      expect(
        deriveDirectorComponents(
          "DependencyMap",
          content as unknown as DirectorSceneContent,
        ),
      ).toEqual([]);
    },
  );

  test("keeps valid distinct DependencyMap paths derivable", () => {
    expect(
      deriveDirectorComponents("DependencyMap", {
        centerNode: "模型",
        leftPath: { node: "英伟达", riskTags: ["供应风险"] },
        rightPath: { node: "国产芯片", riskTags: ["替代路线"] },
      }),
    ).toEqual(["SupplyDependencyMap", "RiskTagCallout"]);
  });

  test("keeps abstract financial meters free of price and market components", () => {
    const components = deriveDirectorComponents("FinancialMeter", {
      dataWidgets: ["持续调用", "算力消耗"],
    });

    expect(components).toEqual(["InferenceCostBill", "TokenMeter"]);
    expect(components).not.toEqual(
      expect.arrayContaining(["PriceCard", "KLineChart", "BarRaceChart"]),
    );
    expect(
      deriveDirectorComponents("FinancialMeter", {
        dataWidgets: ["持续调用", " "],
      }),
    ).toEqual([]);
  });

  test.each(
    Object.keys(validContentByType) as DirectorSceneType[],
  )("has an explicit content-driven mapping for %s", (directorType) => {
    const components = deriveDirectorComponents(
      directorType,
      validContentByType[directorType],
    );

    expect(components).toEqual(expectedComponentsByType[directorType]);
    expect(new Set(components).size).toBe(components.length);
    expect(components).not.toContain("KLineChart");
  });

  test("fails closed for unknown runtime director types", () => {
    expect(() =>
      deriveDirectorComponents(
        "UnknownDirectorType" as DirectorSceneType,
        {},
      ),
    ).toThrow("缺少 UnknownDirectorType 的组件派生器");
  });

  test.each(["toString", "constructor", "__proto__"])(
    "rejects inherited object key %s as an unknown runtime director type",
    (directorType) => {
      expect(() =>
        deriveDirectorComponents(directorType as DirectorSceneType, {}),
      ).toThrow(`缺少 ${directorType} 的组件派生器`);
    },
  );
});
