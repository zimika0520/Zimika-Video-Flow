import type {
  DirectorSceneContent,
  DirectorSceneType,
  Scene,
  SceneSemantics,
  SemanticSourceRef,
} from "./types";

type ContentBuilder = (
  scene: Scene,
  semantics: SceneSemantics,
) => DirectorSceneContent;

const isFactualSource = (source: SemanticSourceRef): boolean =>
  source.supportsFacts && source.kind !== "ai-concept";

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[\s，。；：、,.!?！？"'“”‘’()[\]{}]/g, "");

const normalizeContinuousValue = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, "");

const numericTokens = (value: string): string[] =>
  [...value.matchAll(/\d+(?:\.\d+)?\s*(?:%|倍|K|B|亿|万|元)/gi)].map(
    (match) => normalize(match[0]),
  );

const sourceContainsValue = (sourceText: string, value: string): boolean => {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return true;

  const expectedNumbers = numericTokens(value);
  if (expectedNumbers.length > 0) {
    const sourceNumbers = new Set(numericTokens(sourceText));
    return (
      expectedNumbers.every((token) => sourceNumbers.has(token)) &&
      normalizeContinuousValue(sourceText).includes(
        normalizeContinuousValue(value),
      )
    );
  }

  return normalize(sourceText).includes(normalizedValue);
};

const sourceContains = (
  semantics: SceneSemantics,
  value: string,
): boolean => {
  if (!normalize(value)) return true;

  return semantics.sources.some(
    (source) =>
      isFactualSource(source) &&
      sourceContainsValue(source.text, value),
  );
};

const title = (scene: Scene): string =>
  scene.subtitle
    .trim()
    .replace(/[。！？!?]$/, "")
    .split(/[，：；,;:]/)[0]
    .slice(0, 18);

const factualMetrics = (semantics: SceneSemantics) =>
  semantics.metrics.filter((item) => isFactualSource(item.source));

const factualPrices = (semantics: SceneSemantics) =>
  semantics.prices.filter((item) => isFactualSource(item.source));

const factualTimeline = (semantics: SceneSemantics) =>
  semantics.timelineEvents.filter((item) => isFactualSource(item.source));

const factualComparisons = (semantics: SceneSemantics) =>
  semantics.comparisons.filter((item) => isFactualSource(item.source));

const factualRelations = (semantics: SceneSemantics) =>
  semantics.relations.filter((item) => isFactualSource(item.source));

const factualSignals = (semantics: SceneSemantics) =>
  semantics.signals.filter((item) => isFactualSource(item.source));

const factualJudgements = (semantics: SceneSemantics) =>
  semantics.judgements.filter((item) => isFactualSource(item.source));

const traceableValues = (
  semantics: SceneSemantics,
  values: string[],
): string[] => values.filter((value) => sourceContains(semantics, value));

const sourceIdentity = (source: SemanticSourceRef): string =>
  JSON.stringify([
    source.kind,
    source.text,
    source.referenceId ?? null,
    source.matchedClaim ?? null,
    source.supportsFacts,
  ]);

const dependencyPaths = (semantics: SceneSemantics) => {
  const relations = factualRelations(semantics);
  const groups = new Map<string, typeof relations>();

  for (const relation of relations) {
    const key = JSON.stringify([
      relation.from,
      sourceIdentity(relation.source),
    ]);
    groups.set(key, [...(groups.get(key) ?? []), relation]);
  }

  const paths = [...groups.values()]
    .map((group) =>
      group.filter(
        (relation, index) =>
          group.findIndex((candidate) => candidate.to === relation.to) ===
          index,
      ),
    )
    .find((group) => group.length >= 2)
    ?.slice(0, 2) ?? [];
  const centerNode = paths[0]?.from;

  return {
    centerNode,
    leftPath: paths[0] ? { node: paths[0].to } : undefined,
    rightPath: paths[1] ? { node: paths[1].to } : undefined,
  };
};

const builders: Record<DirectorSceneType, ContentBuilder> = {
  Hero: (scene, semantics) => ({
    headline: title(scene),
    keywords: traceableValues(semantics, semantics.concepts).slice(0, 4),
  }),
  Timeline: (scene, semantics) => ({
    headline: title(scene),
    timelineItems: factualTimeline(semantics).map((item) => ({
      label: item.timeExpression ?? item.label,
      title: item.label,
    })),
  }),
  SystemMap: (scene, semantics) => ({
    headline: title(scene),
    nodes: [
      ...new Set(
        factualRelations(semantics).flatMap((item) => [item.from, item.to]),
      ),
    ],
  }),
  DataExplosion: (scene, semantics) => ({
    headline: title(scene),
    metrics: factualMetrics(semantics).map(({ label, value }) => ({
      label,
      value,
    })),
  }),
  Pricing: (scene, semantics) => ({
    headline: title(scene),
    metrics: factualPrices(semantics).map(({ label, value }) => ({
      label,
      value,
    })),
  }),
  FinancialMeter: (scene, semantics) => ({
    headline: title(scene),
    dataWidgets: traceableValues(semantics, semantics.concepts)
      .filter((item) => /调用|算力|成本|水电费|投入|消耗/.test(item))
      .slice(0, 4),
  }),
  Contrast: (scene, semantics) => ({
    headline: title(scene),
    comparisons: factualComparisons(semantics).flatMap((item) =>
      item.dimension
        ? [
            { label: item.dimension, value: item.left },
            { label: item.dimension, value: item.right },
          ]
        : [],
    ),
  }),
  SpecSheet: (scene, semantics) => ({
    headline: title(scene),
    metrics: factualMetrics(semantics).map(({ label, value }) => ({
      label,
      value,
    })),
  }),
  Pause: (scene, semantics) => ({
    headline: title(scene),
    action: semantics.pauseMarkers.find((item) =>
      sourceContains(semantics, item),
    ),
  }),
  Summary: (scene, semantics) => {
    const concepts = traceableValues(semantics, semantics.concepts).slice(0, 3);

    return {
      headline: title(scene),
      summaryItems: concepts.length > 0 ? concepts : [title(scene)].filter(Boolean),
    };
  },
  EvidenceHero: (scene, semantics) => ({
    sceneTitle: title(scene),
    headline: title(scene),
    evidenceKeywords: semantics.evidenceRefs.filter((referenceId) =>
      semantics.sources.some(
        (source) =>
          isFactualSource(source) && source.referenceId === referenceId,
      ),
    ).slice(0, 3),
    factBoundary: ["概念画面不替代来源证据"],
  }),
  KeywordInvestigation: (scene, semantics) => ({
    headline: title(scene),
    keywordTags: traceableValues(semantics, semantics.concepts).slice(0, 2),
  }),
  SystemStack: (scene, semantics) => {
    const layers = traceableValues(semantics, semantics.orderedLayers);

    return {
      headline: title(scene),
      layers,
      highlight: layers.at(-1),
    };
  },
  DependencyMap: (scene, semantics) => ({
    headline: title(scene),
    ...dependencyPaths(semantics),
  }),
  BarrierWall: (scene, semantics) => ({
    headline: title(scene),
    barriers: traceableValues(semantics, semantics.barriers).map((label) => ({
      label,
    })),
  }),
  QuestionPause: (scene, semantics) => ({
    headline: title(scene),
    action: traceableValues(semantics, semantics.questions)[0],
  }),
  EvidenceReturn: (scene, semantics) => {
    const judgement = factualJudgements(semantics)[0];

    return {
      headline: title(scene),
      evidenceLabel: semantics.evidenceRefs.find((referenceId) =>
        semantics.sources.some(
          (source) =>
            isFactualSource(source) && source.referenceId === referenceId,
        ),
      ),
      judgementPanel: judgement
        ? [judgement.conclusion, ...judgement.evidence]
        : factualMetrics(semantics).flatMap((item) => [
            item.label,
            item.value,
          ]),
    };
  },
  IndustrySignal: (scene, semantics) => {
    const signal = factualSignals(semantics)[0];

    return {
      headline: title(scene),
      signalSource: signal?.sourceLabel,
      nodes: signal?.targets,
    };
  },
  CompetitionLayerStack: (scene, semantics) => {
    const layers = traceableValues(semantics, semantics.orderedLayers);
    const comparisonNodes = factualComparisons(semantics).flatMap((item) =>
      item.dimension ? [item.left, item.right, item.dimension] : [],
    );

    return {
      headline: title(scene),
      nodes: layers.length >= 3 ? layers : comparisonNodes,
    };
  },
  FinalJudgement: (scene, semantics) => {
    const judgement = factualJudgements(semantics)[0];

    return {
      headline: title(scene),
      judgementPanel: judgement ? [judgement.conclusion] : [],
      judgementTags: judgement?.evidence ?? [],
    };
  },
};

export const buildDirectorContent = (
  scene: Scene,
  semantics: SceneSemantics,
  directorType: DirectorSceneType,
): DirectorSceneContent => {
  if (!Object.prototype.hasOwnProperty.call(builders, directorType)) {
    throw new Error(`缺少 ${directorType} 的内容生成器`);
  }

  const builder = builders[directorType];
  return builder(scene, semantics);
};
