import { describe, expect, test } from "vitest";
import { buildDirectorContent } from "@/lib/director-content";
import { validateDirectorContract } from "@/lib/director-contract";
import { extractSceneSemantics } from "@/lib/scene-semantics";
import type {
  DirectorSceneType,
  Scene,
  SceneSemanticContext,
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
  id: "scene-content",
  start: 0,
  end: 4,
  subtitle,
  images: [],
  layout: "quote",
});

const build = (
  subtitle: string,
  directorType: DirectorSceneType,
  context?: SceneSemanticContext,
) => {
  const scene = sceneFor(subtitle);
  return buildDirectorContent(
    scene,
    extractSceneSemantics(scene, context),
    directorType,
  );
};

const validateBuiltContent = (
  subtitle: string,
  directorType: DirectorSceneType,
) => {
  const scene = sceneFor(subtitle);
  const semantics = extractSceneSemantics(scene);
  const content = buildDirectorContent(scene, semantics, directorType);

  return validateDirectorContract({
    scene,
    semantics,
    directorType,
    content,
    components: [],
  });
};

const factualSource = (
  text: string,
  referenceId: string,
): SemanticSourceRef => ({
  kind: "article",
  text,
  referenceId,
  supportsFacts: true,
});

const withRelations = (
  scene: Scene,
  relations: SceneSemantics["relations"],
  sources: SemanticSourceRef[],
): SceneSemantics => ({
  ...extractSceneSemantics(scene),
  relations,
  sources,
});

describe("buildDirectorContent", () => {
  test("uses explanatory display copy instead of repeating the narration sentence", () => {
    const subtitle = "月亮没变小，是手机的广角镜头把整片天空一起装进了画面。";
    const content = build(subtitle, "Hero");

    expect(content.headline).toBeTruthy();
    expect(content.headline).not.toBe(
      subtitle.replace(/[。！？!?]$/, ""),
    );
    expect(content.headline).not.toContain("整片天空一起装进了画面");
  });

  test.each([
    [
      "这款智能体在五月二十日深夜上线。两天后，第一批用户开始测试。",
      "这款智能体在五月二十日深夜上线",
    ],
    [
      "找发票、查照片、清理磁盘、诊断软件故障，这些动作都可以在本地完成。",
      "找发票、查照片、清理磁盘",
    ],
    [
      "简单而高频的动作留在本地。复杂规划交给云端模型。",
      "简单而高频的动作留在本地",
    ],
  ])("keeps Chinese display headlines on complete phrase boundaries", (subtitle, expected) => {
    const content = build(subtitle, "Hero");

    expect(content.headline).toBe(expected);
    expect(content.headline).not.toBe(subtitle.replace(/[。！？!?]$/, ""));
  });

  test("builds explicit system layers without decorative labels", () => {
    const content = build(
      "请求经过模型、API、推理服务，最后进入芯片执行。",
      "SystemStack",
    );

    expect(content).toMatchObject({
      layers: ["模型", "API", "推理服务", "芯片执行"],
      highlight: "芯片执行",
    });
    expect(JSON.stringify(content)).not.toMatch(/第\s*\d+\s*层/);
    expect(
      validateBuiltContent(
        "请求经过模型、API、推理服务，最后进入芯片执行。",
        "SystemStack",
      ).passed,
    ).toBe(true);
  });

  test("builds two real dependency paths", () => {
    const subtitle =
      "DeepSeek 绕不开两条路：一条是英伟达，一条是国产替代芯片。";
    const content = build(subtitle, "DependencyMap");

    expect(content).toMatchObject({
      centerNode: "DeepSeek",
      leftPath: { node: "英伟达" },
      rightPath: { node: "国产替代芯片" },
    });
    expect(validateBuiltContent(subtitle, "DependencyMap").passed).toBe(true);
  });

  test("does not combine dependency paths from different source identities", () => {
    const scene = sceneFor("DeepSeek 有两条依赖路径。");
    const leftSource = factualSource(
      "DeepSeek 依赖英伟达。",
      "article-left",
    );
    const rightSource = factualSource(
      "DeepSeek 依赖国产替代芯片。",
      "article-right",
    );
    const semantics = withRelations(
      scene,
      [
        {
          from: "DeepSeek",
          to: "英伟达",
          relation: "依赖路径",
          source: leftSource,
        },
        {
          from: "DeepSeek",
          to: "国产替代芯片",
          relation: "依赖路径",
          source: rightSource,
        },
      ],
      [leftSource, rightSource],
    );

    const content = buildDirectorContent(scene, semantics, "DependencyMap");

    expect(
      content.centerNode &&
        content.leftPath?.node &&
        content.rightPath?.node,
    ).toBeFalsy();
  });

  test("combines dependency paths from the same stable source identity", () => {
    const scene = sceneFor("DeepSeek 有两条依赖路径。");
    const source = factualSource(
      "DeepSeek 绕不开两条路：一条是英伟达，一条是国产替代芯片。",
      "article-paths",
    );
    const semantics = withRelations(
      scene,
      [
        {
          from: "DeepSeek",
          to: "英伟达",
          relation: "依赖路径",
          source,
        },
        {
          from: "DeepSeek",
          to: "国产替代芯片",
          relation: "依赖路径",
          source: { ...source },
        },
      ],
      [source],
    );

    expect(
      buildDirectorContent(scene, semantics, "DependencyMap"),
    ).toMatchObject({
      centerNode: "DeepSeek",
      leftPath: { node: "英伟达" },
      rightPath: { node: "国产替代芯片" },
    });
  });

  test("matches traceable values across spacing punctuation and case", () => {
    const scene = sceneFor("API 调用会带来推理成本。");
    const source: SemanticSourceRef = {
      kind: "subtitle",
      text: "api，调用会带来推理成本。",
      supportsFacts: true,
    };
    const semantics: SceneSemantics = {
      ...extractSceneSemantics(scene),
      concepts: ["API 调用"],
      sources: [source],
    };

    expect(
      buildDirectorContent(scene, semantics, "KeywordInvestigation")
        .keywordTags,
    ).toEqual(["API 调用"]);
  });

  test("does not expand normalized matching into fuzzy semantics", () => {
    const scene = sceneFor("API 请求会带来推理成本。");
    const source: SemanticSourceRef = {
      kind: "subtitle",
      text: scene.subtitle,
      supportsFacts: true,
    };
    const semantics: SceneSemantics = {
      ...extractSceneSemantics(scene),
      concepts: ["API 调用"],
      sources: [source],
    };

    expect(
      buildDirectorContent(scene, semantics, "KeywordInvestigation")
        .keywordTags,
    ).toEqual([]);
  });

  test.each([
    {
      sourceText: "调用量增长120倍。",
      value: "20倍",
    },
    {
      sourceText: "价格是100元。",
      value: "0元",
    },
  ])(
    "does not match numeric token $value inside a larger source number",
    ({ sourceText, value }) => {
      const scene = sceneFor(sourceText);
      const source: SemanticSourceRef = {
        kind: "subtitle",
        text: sourceText,
        supportsFacts: true,
      };
      const semantics: SceneSemantics = {
        ...extractSceneSemantics(scene),
        concepts: [value],
        sources: [source],
      };

      expect(
        buildDirectorContent(scene, semantics, "KeywordInvestigation")
          .keywordTags,
      ).toEqual([]);
    },
  );

  test("matches a complete numeric token with its non-numeric context", () => {
    const scene = sceneFor("API 调用增长20倍。");
    const source: SemanticSourceRef = {
      kind: "subtitle",
      text: "api调用增长20倍。",
      supportsFacts: true,
    };
    const semantics: SceneSemantics = {
      ...extractSceneSemantics(scene),
      concepts: ["调用增长 20 倍"],
      sources: [source],
    };

    expect(
      buildDirectorContent(scene, semantics, "KeywordInvestigation")
        .keywordTags,
    ).toEqual(["调用增长 20 倍"]);
  });

  test("rejects a matching numeric token with different text context", () => {
    const scene = sceneFor("成本下降20倍。");
    const source: SemanticSourceRef = {
      kind: "subtitle",
      text: scene.subtitle,
      supportsFacts: true,
    };
    const semantics: SceneSemantics = {
      ...extractSceneSemantics(scene),
      concepts: ["收入增长20倍"],
      sources: [source],
    };

    expect(
      buildDirectorContent(scene, semantics, "KeywordInvestigation")
        .keywordTags,
    ).toEqual([]);
  });

  test.each([
    "收入增长，成本下降20倍。",
    "收入增长,成本下降20倍。",
    "收入增长；成本下降20倍。",
    "收入增长;成本下降20倍。",
    "收入增长但成本下降20倍。",
    "收入增长但是成本下降20倍。",
    "收入增长同时成本下降20倍。",
  ])(
    "does not recombine numeric tokens and context across atomic facts: %s",
    (sourceText) => {
      const scene = sceneFor(sourceText);
      const source: SemanticSourceRef = {
        kind: "subtitle",
        text: sourceText,
        supportsFacts: true,
      };
      const semantics: SceneSemantics = {
        ...extractSceneSemantics(scene),
        concepts: ["收入增长20倍"],
        sources: [source],
      };

      expect(
        buildDirectorContent(scene, semantics, "KeywordInvestigation")
          .keywordTags,
      ).toEqual([]);
    },
  );

  test("matches numeric tokens and context within one atomic fact", () => {
    const scene = sceneFor("收入增长20倍，同时成本下降。");
    const source: SemanticSourceRef = {
      kind: "subtitle",
      text: scene.subtitle,
      supportsFacts: true,
    };
    const semantics: SceneSemantics = {
      ...extractSceneSemantics(scene),
      concepts: ["收入增长 20 倍"],
      sources: [source],
    };

    expect(
      buildDirectorContent(scene, semantics, "KeywordInvestigation")
        .keywordTags,
    ).toEqual(["收入增长 20 倍"]);
  });

  test.each([
    "收入增长并且成本下降20倍。",
    "收入增长而且成本下降20倍。",
    "收入增长与成本下降20倍。",
    "收入增长：成本下降20倍。",
    "收入增长:成本下降20倍。",
  ])(
    "requires the complete numeric value to remain continuous: %s",
    (sourceText) => {
      const scene = sceneFor(sourceText);
      const source: SemanticSourceRef = {
        kind: "subtitle",
        text: sourceText,
        supportsFacts: true,
      };
      const semantics: SceneSemantics = {
        ...extractSceneSemantics(scene),
        concepts: ["收入增长20倍"],
        sources: [source],
      };

      expect(
        buildDirectorContent(scene, semantics, "KeywordInvestigation")
          .keywordTags,
      ).toEqual([]);
    },
  );

  test("matches a continuous numeric value ignoring only whitespace and case", () => {
    const scene = sceneFor("API 调用增长 20 倍。");
    const source: SemanticSourceRef = {
      kind: "subtitle",
      text: scene.subtitle,
      supportsFacts: true,
    };
    const semantics: SceneSemantics = {
      ...extractSceneSemantics(scene),
      concepts: ["api调用增长20倍"],
      sources: [source],
    };

    expect(
      buildDirectorContent(scene, semantics, "KeywordInvestigation")
        .keywordTags,
    ).toEqual(["api调用增长20倍"]);
  });

  test("does not invent before and after comparisons", () => {
    const content = build("它更像一个行业信号。", "Contrast");

    expect(content.comparisons ?? []).toEqual([]);
    expect(JSON.stringify(content)).not.toMatch(/升级前|升级后|旧状态|新结果/);
  });

  test("builds abstract cost widgets without fake money", () => {
    const subtitle = "持续调用会带来算力消耗和推理成本。";
    const content = build(subtitle, "FinancialMeter");

    expect(content.dataWidgets).toEqual(
      expect.arrayContaining(["持续调用", "算力消耗", "推理成本"]),
    );
    expect(JSON.stringify(content)).not.toMatch(/\d+\s*元|价格冲击/);
    expect(validateBuiltContent(subtitle, "FinancialMeter").passed).toBe(true);
  });

  test("uses only semantic comparison values and labels", () => {
    const content = build(
      "训练是一次性投入，推理是长期水电费。",
      "CompetitionLayerStack",
    );

    expect(content.nodes).toEqual([
      "训练",
      "推理",
      "投入持续性",
    ]);
    expect(JSON.stringify(content)).not.toMatch(/竞争维度|判断轴|第\s*\d+\s*层/);
  });

  test("does not add a synthetic center label to final judgements", () => {
    const content = build(
      "核心不是干掉谁，而是不想一直等别人发货。",
      "FinalJudgement",
    );

    expect(content).toMatchObject({
      judgementPanel: ["不想一直等别人发货"],
      judgementTags: ["干掉谁"],
    });
    expect(content.centerNode).toBeUndefined();
    expect(JSON.stringify(content)).not.toContain("最终判断");
  });

  test.each(directorSceneTypes)(
    "has a runtime builder for %s",
    (directorType) => {
      expect(() =>
        build("这是当前镜头的原文。", directorType),
      ).not.toThrow();
    },
  );

  test("rejects an unknown runtime director type", () => {
    const scene = sceneFor("这是当前镜头的原文。");
    const semantics = extractSceneSemantics(scene);

    expect(() =>
      buildDirectorContent(
        scene,
        semantics,
        "UnknownDirectorType" as DirectorSceneType,
      ),
    ).toThrow("缺少 UnknownDirectorType 的内容生成器");
  });

  test.each(["toString", "constructor", "__proto__"])(
    "rejects inherited object key %s as an unknown runtime director type",
    (directorType) => {
      const scene = sceneFor("这是当前镜头的原文。");
      const semantics = extractSceneSemantics(scene);

      expect(() =>
        buildDirectorContent(
          scene,
          semantics,
          directorType as DirectorSceneType,
        ),
      ).toThrow(`缺少 ${directorType} 的内容生成器`);
    },
  );
});
