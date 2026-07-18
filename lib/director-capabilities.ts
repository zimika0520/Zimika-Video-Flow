import type {
  DirectorRendererFamily,
  DirectorSceneContent,
  DirectorSceneType,
  DirectorVisualTreatment,
  SceneSemantics,
  SemanticSourceRef,
} from "./types";

export type DirectorCapability = {
  type: DirectorSceneType;
  rendererFamily: DirectorRendererFamily;
  allowedTreatments: DirectorVisualTreatment[];
  isCompatible: (
    semantics: SceneSemantics,
    sceneIndex: number,
    sceneCount: number,
  ) => boolean;
  validateContent: (content: DirectorSceneContent) => string[];
  provenanceFields: string[];
  forbiddenComponents: string[];
  fallbackTypes: DirectorSceneType[];
};

const isFactualSource = (source: SemanticSourceRef): boolean =>
  source.supportsFacts && source.kind !== "ai-concept";

const has = (value: unknown[] | undefined, minimum = 1): boolean =>
  (value?.length ?? 0) >= minimum;

const isNonBlank = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const hasOnlyValid = <T>(
  value: T[] | undefined,
  predicate: (item: T) => boolean,
  minimum = 1,
): boolean =>
  Boolean(value && value.length >= minimum && value.every(predicate));

const isValidOptionalText = (value: unknown): boolean =>
  value === undefined || isNonBlank(value);

const hasValidStrings = (
  value: string[] | undefined,
  minimum = 1,
): boolean => hasOnlyValid(value, isNonBlank, minimum);

const hasValidMetrics = (
  value: DirectorSceneContent["metrics"],
  minimum = 1,
): boolean =>
  hasOnlyValid(
    value,
    (item) =>
      isNonBlank(item.label) &&
      isNonBlank(item.value) &&
      isValidOptionalText(item.note),
    minimum,
  );

const hasValidTimelineItems = (
  value: DirectorSceneContent["timelineItems"],
  minimum = 1,
): boolean =>
  hasOnlyValid(
    value,
    (item) =>
      isNonBlank(item.label) &&
      isNonBlank(item.title) &&
      isValidOptionalText(item.note),
    minimum,
  );

const hasValidComparisons = (
  value: DirectorSceneContent["comparisons"],
  minimum = 1,
): boolean =>
  hasOnlyValid(
    value,
    (item) => isNonBlank(item.label) && isNonBlank(item.value),
    minimum,
  );

const hasValidNodes = (
  value: DirectorSceneContent["nodes"],
  minimum = 1,
): boolean =>
  hasOnlyValid(
    value,
    (item) =>
      typeof item === "string"
        ? isNonBlank(item)
        : isNonBlank(item.label) && isValidOptionalText(item.role),
    minimum,
  );

const hasValidLayers = (
  value: DirectorSceneContent["layers"],
  minimum = 1,
): boolean =>
  hasOnlyValid(
    value,
    (item) =>
      typeof item === "string"
        ? isNonBlank(item)
        : isValidOptionalText(item.name) &&
          isValidOptionalText(item.label) &&
          isValidOptionalText(item.visual) &&
          isValidOptionalText(item.note) &&
          (isNonBlank(item.name) || isNonBlank(item.label)),
    minimum,
  );

const hasValidBarriers = (
  value: DirectorSceneContent["barriers"],
  minimum = 1,
): boolean =>
  hasOnlyValid(
    value,
    (item) =>
      isNonBlank(item.label) &&
      isValidOptionalText(item.visual) &&
      isValidOptionalText(item.shape),
    minimum,
  );

const hasValidPath = (
  value: DirectorSceneContent["leftPath"] | undefined,
): boolean =>
  Boolean(
    value &&
      isNonBlank(value.node) &&
      (value.riskTags === undefined ||
        hasOnlyValid(value.riskTags, isNonBlank, 0)),
  );

const required = (checks: Array<[string, boolean]>): string[] =>
  checks.filter(([, passed]) => !passed).map(([field]) => field);

const sourceContains = (semantics: SceneSemantics, value: string): boolean =>
  semantics.sources.some(
    (source) => isFactualSource(source) && source.text.includes(value),
  );

const hasFactualMetrics = (
  semantics: SceneSemantics,
  minimum = 1,
): boolean =>
  semantics.metrics.filter((item) => isFactualSource(item.source)).length >=
  minimum;

const hasFactualPrices = (
  semantics: SceneSemantics,
  minimum = 1,
): boolean =>
  semantics.prices.filter((item) => isFactualSource(item.source)).length >=
  minimum;

const hasFactualTimeline = (
  semantics: SceneSemantics,
  minimum = 1,
): boolean =>
  semantics.timelineEvents.filter((item) => isFactualSource(item.source))
    .length >= minimum;

const hasFactualComparisons = (
  semantics: SceneSemantics,
  minimum = 1,
): boolean =>
  semantics.comparisons.filter((item) => isFactualSource(item.source)).length >=
  minimum;

const hasFactualRelations = (
  semantics: SceneSemantics,
  minimum = 1,
): boolean =>
  semantics.relations.filter((item) => isFactualSource(item.source)).length >=
  minimum;

const hasFactualSignals = (semantics: SceneSemantics): boolean =>
  semantics.signals.some(
    (signal) =>
      isFactualSource(signal.source) && signal.targets.length >= 2,
  );

const hasFactualJudgement = (semantics: SceneSemantics): boolean =>
  semantics.judgements.some(
    (item) => isFactualSource(item.source) && item.evidence.length >= 1,
  );

const forbidden = (...components: string[]): string[] => [
  "KLineChart",
  ...components.filter((component) => component !== "KLineChart"),
];

export const directorCapabilities: Record<
  DirectorSceneType,
  DirectorCapability
> = {
  Hero: {
    type: "Hero",
    rendererFamily: "hero",
    allowedTreatments: ["hero-title", "hero-object-focus"],
    isCompatible: (_semantics, sceneIndex) => sceneIndex === 0,
    validateContent: (content) =>
      required([["headline", isNonBlank(content.headline)]]),
    provenanceFields: [],
    forbiddenComponents: forbidden("BarRaceChart"),
    fallbackTypes: ["KeywordInvestigation"],
  },
  Timeline: {
    type: "Timeline",
    rendererFamily: "timeline",
    allowedTreatments: ["ordered-events", "milestone-track"],
    isCompatible: (semantics) => hasFactualTimeline(semantics, 2),
    validateContent: (content) =>
      required([
        ["timelineItems", hasValidTimelineItems(content.timelineItems, 2)],
      ]),
    provenanceFields: ["timelineItems"],
    forbiddenComponents: forbidden(),
    fallbackTypes: ["KeywordInvestigation"],
  },
  SystemMap: {
    type: "SystemMap",
    rendererFamily: "relationship-map",
    allowedTreatments: ["node-network", "relation-paths"],
    isCompatible: (semantics) => hasFactualRelations(semantics),
    validateContent: (content) =>
      required([["nodes", hasValidNodes(content.nodes, 2)]]),
    provenanceFields: ["nodes"],
    forbiddenComponents: forbidden("PriceCard"),
    fallbackTypes: ["KeywordInvestigation"],
  },
  DataExplosion: {
    type: "DataExplosion",
    rendererFamily: "data",
    allowedTreatments: ["metric-burst", "metric-comparison"],
    isCompatible: (semantics) => hasFactualMetrics(semantics),
    validateContent: (content) =>
      hasValidMetrics(content.metrics) ? [] : ["metrics"],
    provenanceFields: ["metrics"],
    forbiddenComponents: forbidden(),
    fallbackTypes: ["KeywordInvestigation"],
  },
  Pricing: {
    type: "Pricing",
    rendererFamily: "data",
    allowedTreatments: ["price-breakdown", "price-comparison"],
    isCompatible: (semantics) => hasFactualPrices(semantics),
    validateContent: (content) =>
      hasValidMetrics(content.metrics) ? [] : ["metrics"],
    provenanceFields: ["metrics"],
    forbiddenComponents: forbidden(),
    fallbackTypes: ["FinancialMeter"],
  },
  FinancialMeter: {
    type: "FinancialMeter",
    rendererFamily: "cost-flow",
    allowedTreatments: ["resource-pressure", "resource-flow"],
    isCompatible: (semantics) =>
      semantics.concepts.some(
        (item) =>
          /成本|消耗|投入|水电费/.test(item) &&
          sourceContains(semantics, item),
      ),
    validateContent: (content) =>
      hasValidStrings(content.dataWidgets) ? [] : ["dataWidgets"],
    provenanceFields: ["dataWidgets"],
    forbiddenComponents: forbidden("PriceCard", "BarRaceChart"),
    fallbackTypes: ["KeywordInvestigation"],
  },
  Contrast: {
    type: "Contrast",
    rendererFamily: "comparison",
    allowedTreatments: ["side-by-side", "split-verdict"],
    isCompatible: (semantics) => hasFactualComparisons(semantics),
    validateContent: (content) =>
      required([
        ["comparisons", hasValidComparisons(content.comparisons, 2)],
      ]),
    provenanceFields: ["comparisons"],
    forbiddenComponents: forbidden("PriceCard"),
    fallbackTypes: ["KeywordInvestigation"],
  },
  SpecSheet: {
    type: "SpecSheet",
    rendererFamily: "specification",
    allowedTreatments: ["spec-table", "spec-callouts"],
    isCompatible: (semantics) => hasFactualMetrics(semantics, 2),
    validateContent: (content) =>
      required([["metrics", hasValidMetrics(content.metrics, 2)]]),
    provenanceFields: ["metrics"],
    forbiddenComponents: forbidden(),
    fallbackTypes: ["DataExplosion", "KeywordInvestigation"],
  },
  Pause: {
    type: "Pause",
    rendererFamily: "pause",
    allowedTreatments: ["question-hold", "question-spotlight"],
    isCompatible: (semantics) =>
      semantics.pauseMarkers.some((item) => sourceContains(semantics, item)),
    validateContent: (content) =>
      required([["action", isNonBlank(content.action)]]),
    provenanceFields: ["action"],
    forbiddenComponents: forbidden("PriceCard", "BarRaceChart"),
    fallbackTypes: ["QuestionPause", "KeywordInvestigation"],
  },
  Summary: {
    type: "Summary",
    rendererFamily: "summary",
    allowedTreatments: ["closing-summary", "closing-stack"],
    isCompatible: (_semantics, sceneIndex, sceneCount) =>
      sceneCount > 0 && sceneIndex === sceneCount - 1,
    validateContent: (content) =>
      required([["summaryItems", hasValidStrings(content.summaryItems)]]),
    provenanceFields: ["summaryItems"],
    forbiddenComponents: forbidden("BarRaceChart"),
    fallbackTypes: ["FinalJudgement", "KeywordInvestigation"],
  },
  EvidenceHero: {
    type: "EvidenceHero",
    rendererFamily: "evidence",
    allowedTreatments: ["evidence-zoom", "evidence-annotated"],
    isCompatible: (semantics) =>
      semantics.evidenceRefs.some((referenceId) =>
        semantics.sources.some(
          (source) =>
            isFactualSource(source) &&
            source.referenceId === referenceId &&
            (source.kind === "evidence-record" ||
              source.kind === "user-asset"),
        ),
      ),
    validateContent: (content) =>
      required([
        [
          "evidenceKeywords",
          hasValidStrings(content.evidenceKeywords),
        ],
        ["factBoundary", hasValidStrings(content.factBoundary)],
      ]),
    provenanceFields: ["evidenceKeywords"],
    forbiddenComponents: forbidden("BarRaceChart"),
    fallbackTypes: ["Hero", "KeywordInvestigation"],
  },
  KeywordInvestigation: {
    type: "KeywordInvestigation",
    rendererFamily: "evidence",
    allowedTreatments: ["keyword-investigation", "keyword-cutaway"],
    isCompatible: (semantics) =>
      semantics.concepts.some((item) => sourceContains(semantics, item)),
    validateContent: (content) =>
      required([["keywordTags", hasValidStrings(content.keywordTags)]]),
    provenanceFields: ["keywordTags"],
    forbiddenComponents: forbidden("PriceCard", "BarRaceChart"),
    fallbackTypes: ["Hero", "Summary"],
  },
  SystemStack: {
    type: "SystemStack",
    rendererFamily: "system-stack",
    allowedTreatments: ["layer-build", "layer-cutaway"],
    isCompatible: (semantics) =>
      has(semantics.orderedLayers.filter((item) => sourceContains(semantics, item)), 3),
    validateContent: (content) =>
      required([
        ["layers", hasValidLayers(content.layers, 3)],
        ["highlight", isNonBlank(content.highlight)],
      ]),
    provenanceFields: ["layers", "highlight"],
    forbiddenComponents: forbidden("PriceCard"),
    fallbackTypes: ["SystemMap", "KeywordInvestigation"],
  },
  DependencyMap: {
    type: "DependencyMap",
    rendererFamily: "dependency-map",
    allowedTreatments: ["dual-supply-path", "supply-lanes"],
    isCompatible: (semantics) => hasFactualRelations(semantics, 2),
    validateContent: (content) =>
      required([
        ["centerNode", isNonBlank(content.centerNode)],
        ["leftPath", hasValidPath(content.leftPath)],
        ["rightPath", hasValidPath(content.rightPath)],
      ]),
    provenanceFields: ["centerNode", "leftPath", "rightPath"],
    forbiddenComponents: forbidden("PriceCard"),
    fallbackTypes: ["SystemMap", "KeywordInvestigation"],
  },
  QuestionPause: {
    type: "QuestionPause",
    rendererFamily: "pause",
    allowedTreatments: ["question-hold", "question-spotlight"],
    isCompatible: (semantics) =>
      semantics.questions.some((item) => sourceContains(semantics, item)),
    validateContent: (content) =>
      required([["action", isNonBlank(content.action)]]),
    provenanceFields: ["action"],
    forbiddenComponents: forbidden("PriceCard", "BarRaceChart"),
    fallbackTypes: ["KeywordInvestigation"],
  },
  BarrierWall: {
    type: "BarrierWall",
    rendererFamily: "barrier-wall",
    allowedTreatments: ["barrier-grid", "barrier-cross-section"],
    isCompatible: (semantics) =>
      has(semantics.barriers.filter((item) => sourceContains(semantics, item)), 3),
    validateContent: (content) =>
      required([["barriers", hasValidBarriers(content.barriers, 3)]]),
    provenanceFields: ["barriers"],
    forbiddenComponents: forbidden("PriceCard"),
    fallbackTypes: ["KeywordInvestigation"],
  },
  EvidenceReturn: {
    type: "EvidenceReturn",
    rendererFamily: "evidence",
    allowedTreatments: ["evidence-return", "evidence-recap"],
    isCompatible: (semantics) =>
      semantics.evidenceRefs.some((referenceId) =>
        semantics.sources.some(
          (source) =>
            isFactualSource(source) && source.referenceId === referenceId,
        ),
      ) &&
      (hasFactualJudgement(semantics) || hasFactualMetrics(semantics)),
    validateContent: (content) =>
      required([
        ["evidenceLabel", isNonBlank(content.evidenceLabel)],
        ["judgementPanel", hasValidStrings(content.judgementPanel)],
      ]),
    provenanceFields: ["evidenceLabel", "judgementPanel"],
    forbiddenComponents: forbidden(),
    fallbackTypes: ["EvidenceHero", "KeywordInvestigation"],
  },
  IndustrySignal: {
    type: "IndustrySignal",
    rendererFamily: "signal-radar",
    allowedTreatments: ["signal-rings", "signal-ripple-map"],
    isCompatible: hasFactualSignals,
    validateContent: (content) =>
      required([
        ["signalSource", isNonBlank(content.signalSource)],
        ["nodes", hasValidNodes(content.nodes, 2)],
      ]),
    provenanceFields: ["signalSource", "nodes"],
    forbiddenComponents: forbidden("PriceCard"),
    fallbackTypes: ["KeywordInvestigation"],
  },
  CompetitionLayerStack: {
    type: "CompetitionLayerStack",
    rendererFamily: "competition-stack",
    allowedTreatments: ["competition-layers", "competition-arena"],
    isCompatible: (semantics) =>
      has(
        semantics.orderedLayers.filter((item) =>
          sourceContains(semantics, item),
        ),
        3,
      ) || hasFactualComparisons(semantics),
    validateContent: (content) =>
      required([["nodes", hasValidNodes(content.nodes, 3)]]),
    provenanceFields: ["nodes"],
    forbiddenComponents: forbidden("PriceCard"),
    fallbackTypes: ["Contrast", "SystemStack", "KeywordInvestigation"],
  },
  FinalJudgement: {
    type: "FinalJudgement",
    rendererFamily: "judgement",
    allowedTreatments: ["final-judgement", "final-proof-stack"],
    isCompatible: hasFactualJudgement,
    validateContent: (content) =>
      required([
        ["judgementPanel", hasValidStrings(content.judgementPanel)],
        ["judgementTags", hasValidStrings(content.judgementTags)],
      ]),
    provenanceFields: ["judgementPanel", "judgementTags"],
    forbiddenComponents: forbidden("PriceCard", "BarRaceChart"),
    fallbackTypes: ["Summary", "KeywordInvestigation"],
  },
};
