import { directorCapabilities } from "./director-capabilities";
import {
  deriveDirectorComponents,
  validateDirectorContentStructure,
} from "./director-components";
import type {
  DirectorContractIssue,
  DirectorSceneContent,
  DirectorSceneType,
  Scene,
  SceneSemantics,
  SemanticSourceRef,
} from "./types";

export type ValidateDirectorContractInput = {
  scene: Scene;
  semantics: SceneSemantics;
  directorType: DirectorSceneType;
  content: DirectorSceneContent;
  components: string[];
  sceneIndex?: number;
  sceneCount?: number;
};

type StructureIssue = {
  code: "semantic.invalid-structure" | "component.invalid-structure";
  field: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const canonicalizeText = (value: string): string =>
  value
    .normalize("NFKC")
    .replace(/\p{Default_Ignorable_Code_Point}/gu, "");

const normalize = (value: string): string =>
  canonicalizeText(value)
    .toLowerCase()
    .replace(/[\s，。；：、,.!?！？"'“”‘’()[\]{}]/g, "");

const isFactualSource = (source: SemanticSourceRef): boolean =>
  source.supportsFacts && source.kind !== "ai-concept";

const hasMeaningfulText = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const canonical = canonicalizeText(value);
  return canonical.trim().length > 0 && /[\p{L}\p{N}]/u.test(canonical);
};

const isNonBlank = hasMeaningfulText;
const isSemanticText = hasMeaningfulText;

const isSemanticUnit = (value: unknown): value is string =>
  isSemanticText(value) ||
  (typeof value === "string" &&
    canonicalizeText(value).trim() === "%");

const hasOptionalSemanticText = (
  value: Record<string, unknown>,
  field: string,
): boolean =>
  value[field] === undefined || isSemanticText(value[field]);

const hasOptionalSemanticUnit = (
  value: Record<string, unknown>,
  field: string,
): boolean =>
  value[field] === undefined || isSemanticUnit(value[field]);

const semanticTextArrayIdentity = (
  value: unknown,
  minimum = 0,
): string[] | undefined => {
  if (
    !Array.isArray(value) ||
    value.length < minimum ||
    !value.every(isSemanticText)
  ) {
    return undefined;
  }

  const identities = value.map(normalize);
  return new Set(identities).size === identities.length
    ? identities
    : undefined;
};

const sourceKinds = new Set([
  "subtitle",
  "article",
  "user-asset",
  "evidence-record",
  "ai-concept",
]);

const isSemanticSource = (value: unknown): value is SemanticSourceRef =>
  isRecord(value) &&
  typeof value.kind === "string" &&
  sourceKinds.has(value.kind) &&
  isSemanticText(value.text) &&
  typeof value.supportsFacts === "boolean" &&
  (value.referenceId === undefined ||
    isSemanticText(value.referenceId)) &&
  (value.matchedClaim === undefined ||
    isSemanticText(value.matchedClaim));

const sourceIdentity = (source: SemanticSourceRef): string =>
  JSON.stringify([
    source.kind,
    normalize(source.text),
    source.referenceId === undefined
      ? ""
      : normalize(source.referenceId),
    source.supportsFacts,
    source.matchedClaim === undefined
      ? ""
      : normalize(source.matchedClaim),
  ]);

const validateFactArray = (
  semantics: Record<string, unknown>,
  field: string,
  validateFact: (fact: Record<string, unknown>) => boolean,
  identity: (fact: Record<string, unknown>) => string,
  registeredSourceIdentities: ReadonlySet<string> | undefined,
): StructureIssue[] => {
  const value = semantics[field];
  if (!Array.isArray(value)) {
    return [{ code: "semantic.invalid-structure", field }];
  }

  const identities = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) {
      return [{ code: "semantic.invalid-structure", field }];
    }
    if (!validateFact(item)) {
      return [{ code: "semantic.invalid-structure", field }];
    }
    if (!isSemanticSource(item.source)) {
      return [
        {
          code: "semantic.invalid-structure",
          field: `${field}.source`,
        },
      ];
    }
    if (
      registeredSourceIdentities &&
      !registeredSourceIdentities.has(sourceIdentity(item.source))
    ) {
      return [
        {
          code: "semantic.invalid-structure",
          field: `${field}.source`,
        },
      ];
    }
    const factIdentity = identity(item);
    if (identities.has(factIdentity)) {
      return [{ code: "semantic.invalid-structure", field }];
    }
    identities.add(factIdentity);
  }
  return [];
};

const validateStringArrayField = (
  semantics: Record<string, unknown>,
  field: string,
): StructureIssue[] =>
  semanticTextArrayIdentity(semantics[field]) !== undefined
    ? []
    : [{ code: "semantic.invalid-structure", field }];

const validateNestedStringArrayFactArray = (
  semantics: Record<string, unknown>,
  field: "signals" | "judgements",
  nestedField: "targets" | "evidence",
  validateFact: (fact: Record<string, unknown>) => boolean,
  identity: (
    fact: Record<string, unknown>,
    nestedIdentity: string[],
  ) => string,
  registeredSourceIdentities: ReadonlySet<string> | undefined,
): StructureIssue[] => {
  const value = semantics[field];
  if (!Array.isArray(value)) {
    return [{ code: "semantic.invalid-structure", field }];
  }

  const identities = new Set<string>();
  for (const item of value) {
    if (!isRecord(item) || !validateFact(item)) {
      return [{ code: "semantic.invalid-structure", field }];
    }
    const nestedIdentity = semanticTextArrayIdentity(
      item[nestedField],
      1,
    );
    if (!nestedIdentity) {
      return [
        {
          code: "semantic.invalid-structure",
          field: `${field}.${nestedField}`,
        },
      ];
    }
    if (!isSemanticSource(item.source)) {
      return [
        {
          code: "semantic.invalid-structure",
          field: `${field}.source`,
        },
      ];
    }
    if (
      registeredSourceIdentities &&
      !registeredSourceIdentities.has(sourceIdentity(item.source))
    ) {
      return [
        {
          code: "semantic.invalid-structure",
          field: `${field}.source`,
        },
      ];
    }
    const factIdentity = identity(item, nestedIdentity);
    if (identities.has(factIdentity)) {
      return [{ code: "semantic.invalid-structure", field }];
    }
    identities.add(factIdentity);
  }
  return [];
};

const optionalIdentity = (
  value: Record<string, unknown>,
  field: string,
): string =>
  value[field] === undefined ? "" : normalize(value[field] as string);

const directedPairIdentity = (left: unknown, right: unknown): string =>
  [normalize(left as string), normalize(right as string)].join("\0");

const validateSemanticsStructure = (
  value: unknown,
  expectedSceneId: string,
): StructureIssue[] => {
  if (!isRecord(value)) {
    return [{ code: "semantic.invalid-structure", field: "semantics" }];
  }

  const issues: StructureIssue[] = [];
  if (
    !isSemanticText(value.sceneId) ||
    value.sceneId !== expectedSceneId
  ) {
    issues.push({
      code: "semantic.invalid-structure",
      field: "sceneId",
    });
  }

  let registeredSourceIdentities: Set<string> | undefined;
  if (
    !Array.isArray(value.sources) ||
    !value.sources.every(isSemanticSource)
  ) {
    issues.push({
      code: "semantic.invalid-structure",
      field: "sources",
    });
  } else {
    registeredSourceIdentities = new Set(
      value.sources.map(sourceIdentity),
    );
  }

  for (const field of [
    "entities",
    "orderedLayers",
    "barriers",
    "questions",
    "concepts",
    "evidenceRefs",
    "pauseMarkers",
  ]) {
    issues.push(...validateStringArrayField(value, field));
  }

  issues.push(
    ...validateFactArray(
      value,
      "metrics",
      (fact) =>
        isSemanticText(fact.label) &&
        isSemanticText(fact.value) &&
        hasOptionalSemanticUnit(fact, "unit"),
      (fact) =>
        [
          normalize(fact.label as string),
          normalize(fact.value as string),
          optionalIdentity(fact, "unit"),
        ].join("\0"),
      registeredSourceIdentities,
    ),
    ...validateFactArray(
      value,
      "prices",
      (fact) =>
        isSemanticText(fact.label) &&
        isSemanticText(fact.value) &&
        hasOptionalSemanticUnit(fact, "currency"),
      (fact) =>
        [
          normalize(fact.label as string),
          normalize(fact.value as string),
          optionalIdentity(fact, "currency"),
        ].join("\0"),
      registeredSourceIdentities,
    ),
    ...validateFactArray(
      value,
      "timelineEvents",
      (fact) =>
        isSemanticText(fact.label) &&
        typeof fact.order === "number" &&
        Number.isFinite(fact.order) &&
        hasOptionalSemanticText(fact, "timeExpression"),
      (fact) =>
        [
          normalize(fact.label as string),
          optionalIdentity(fact, "timeExpression"),
        ].join("\0"),
      registeredSourceIdentities,
    ),
    ...validateFactArray(
      value,
      "comparisons",
      (fact) =>
        isSemanticText(fact.left) &&
        isSemanticText(fact.right) &&
        hasOptionalSemanticText(fact, "dimension"),
      (fact) =>
        [
          directedPairIdentity(fact.left, fact.right),
          optionalIdentity(fact, "dimension"),
        ].join("\0"),
      registeredSourceIdentities,
    ),
    ...validateFactArray(
      value,
      "relations",
      (fact) =>
        isSemanticText(fact.from) &&
        isSemanticText(fact.to) &&
        isSemanticText(fact.relation),
      (fact) =>
        [
          directedPairIdentity(fact.from, fact.to),
          normalize(fact.relation as string),
        ].join("\0"),
      registeredSourceIdentities,
    ),
    ...validateNestedStringArrayFactArray(
      value,
      "signals",
      "targets",
      (fact) => isSemanticText(fact.sourceLabel),
      (fact, targets) =>
        [
          normalize(fact.sourceLabel as string),
          [...targets].sort().join("\0"),
        ].join("\0"),
      registeredSourceIdentities,
    ),
    ...validateNestedStringArrayFactArray(
      value,
      "judgements",
      "evidence",
      (fact) => isSemanticText(fact.conclusion),
      (fact, evidence) =>
        [
          normalize(fact.conclusion as string),
          [...evidence].sort().join("\0"),
        ].join("\0"),
      registeredSourceIdentities,
    ),
  );

  return issues;
};

const validateComponentsStructure = (
  value: unknown,
): { components?: string[]; issues: StructureIssue[] } => {
  if (!Array.isArray(value) || !value.every(isNonBlank)) {
    return {
      issues: [
        {
          code: "component.invalid-structure",
          field: "components",
        },
      ],
    };
  }
  return { components: [...new Set(value)], issues: [] };
};

const isSameValue = (
  left: string | undefined,
  right: string | undefined,
): boolean =>
  isNonBlank(left) &&
  isNonBlank(right) &&
    normalize(left) === normalize(right);

const genericStandaloneVisualText = new Set(
  [
    "核心信息",
    "关键点",
    "结构",
    "影响",
    "最后看结论",
    "背景",
    "节点",
    "变化",
    "结果",
  ].map(normalize),
);

const genericPlaceholderValues = (
  content: DirectorSceneContent,
): Array<{ field: string; value: string }> => {
  const values: Array<{ field: string; value: string }> = [];
  const visit = (field: string, value: unknown): void => {
    if (typeof value === "string") {
      if (genericStandaloneVisualText.has(normalize(value))) {
        values.push({ field, value });
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(`${field}[${index}]`, item));
      return;
    }
    if (isRecord(value)) {
      for (const [key, nested] of Object.entries(value)) {
        visit(`${field}.${key}`, nested);
      }
    }
  };

  for (const [field, value] of Object.entries(content)) {
    visit(field, value);
  }
  return values;
};

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
    if (!expectedNumbers.every((token) => sourceNumbers.has(token))) {
      return false;
    }

    const semanticContext = expectedNumbers.reduce(
      (context, token) => context.replace(token, ""),
      normalizedValue,
    );
    return (
      semanticContext.length === 0 ||
      normalize(sourceText).includes(semanticContext)
    );
  }

  return normalize(sourceText).includes(normalizedValue);
};

const contentValues = (
  content: DirectorSceneContent,
  field: string,
): string[] => {
  if (field === "metrics") {
    return (content.metrics ?? []).flatMap((item) => [
      item.label,
      item.value,
    ]);
  }
  if (field === "timelineItems") {
    return (content.timelineItems ?? []).flatMap((item) => [
      item.label,
      item.title,
    ]);
  }
  if (field === "comparisons") {
    return (content.comparisons ?? []).flatMap((item) => [
      item.label,
      item.value,
    ]);
  }
  if (field === "nodes") {
    return (content.nodes ?? []).flatMap((item) =>
      typeof item === "string"
        ? [item]
        : [item.label, item.role].filter(
            (value): value is string => typeof value === "string",
          ),
    );
  }
  if (field === "barriers") {
    return (content.barriers ?? []).flatMap((item) =>
      [item.label, item.visual, item.shape].filter(
        (value): value is string => typeof value === "string",
      ),
    );
  }
  if (field === "leftPath") {
    return [
      content.leftPath?.node,
      ...(content.leftPath?.riskTags ?? []),
    ].filter((value): value is string => Boolean(value));
  }
  if (field === "rightPath") {
    return [
      content.rightPath?.node,
      ...(content.rightPath?.riskTags ?? []),
    ].filter((value): value is string => Boolean(value));
  }

  const value = content[field as keyof DirectorSceneContent];
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) {
    if (value && typeof value === "object") {
      return Object.values(value).flatMap((item) => {
        if (typeof item === "string") return [item];
        if (!item || typeof item !== "object") return [];
        return Object.values(item).filter(
          (nested): nested is string => typeof nested === "string",
        );
      });
    }
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (!item || typeof item !== "object") return [];
    return Object.values(item).filter(
      (nested): nested is string => typeof nested === "string",
    );
  });
};

const metricRecordFailure = (
  item: NonNullable<DirectorSceneContent["metrics"]>[number],
  semantics: SceneSemantics,
  directorType: DirectorSceneType,
): string | undefined => {
  const facts =
    directorType === "Pricing" ? semantics.prices : semantics.metrics;

  const fact = facts.find(
    (fact) =>
      isFactualSource(fact.source) &&
      isSameValue(item.label, fact.label) &&
      isSameValue(item.value, fact.value),
  );
  if (!fact) return item.value;
  if (
    isNonBlank(item.note) &&
    !sourceContainsValue(fact.source.text, item.note)
  ) {
    return item.note;
  }
  return undefined;
};

const timelineRecordFailure = (
  item: NonNullable<DirectorSceneContent["timelineItems"]>[number],
  semantics: SceneSemantics,
): string | undefined => {
  const event = semantics.timelineEvents.find(
    (event) =>
      isFactualSource(event.source) &&
      isSameValue(item.title, event.label) &&
      isSameValue(item.label, event.timeExpression ?? event.label),
  );
  if (!event) return item.title;
  if (
    isNonBlank(item.note) &&
    !sourceContainsValue(event.source.text, item.note)
  ) {
    return item.note;
  }
  return undefined;
};

const isComparisonRecordTraceable = (
  item: NonNullable<DirectorSceneContent["comparisons"]>[number],
  semantics: SceneSemantics,
): boolean =>
  semantics.comparisons.some((comparison) => {
    if (!isFactualSource(comparison.source)) return false;

    const leftLabel = comparison.dimension ?? "对比左侧";
    const rightLabel = comparison.dimension ?? "对比右侧";
    return (
      (isSameValue(item.label, leftLabel) &&
        isSameValue(item.value, comparison.left)) ||
      (isSameValue(item.label, rightLabel) &&
        isSameValue(item.value, comparison.right))
    );
  });

const structuredProvenanceFailures = (
  content: DirectorSceneContent,
  field: string,
  semantics: SceneSemantics,
  directorType: DirectorSceneType,
): string[] | undefined => {
  if (field === "metrics") {
    return (content.metrics ?? [])
      .filter(
        (item) =>
          isNonBlank(item.label) &&
          isNonBlank(item.value) &&
          (item.note === undefined || isNonBlank(item.note)),
      )
      .map((item) => metricRecordFailure(item, semantics, directorType))
      .filter((value): value is string => value !== undefined);
  }
  if (field === "timelineItems") {
    return (content.timelineItems ?? [])
      .filter(
        (item) =>
          isNonBlank(item.label) &&
          isNonBlank(item.title) &&
          (item.note === undefined || isNonBlank(item.note)),
      )
      .map((item) => timelineRecordFailure(item, semantics))
      .filter((value): value is string => value !== undefined);
  }
  if (field === "comparisons") {
    return (content.comparisons ?? [])
      .filter((item) => isNonBlank(item.label) && isNonBlank(item.value))
      .filter((item) => !isComparisonRecordTraceable(item, semantics))
      .map((item) => item.value);
  }
  return undefined;
};

const relationIdentity = (
  relation: SceneSemantics["relations"][number],
): string =>
  `${normalize(relation.from)}\0${normalize(relation.to)}\0${normalize(relation.relation)}`;

const relationConnects = (
  relation: SceneSemantics["relations"][number],
  centerNode: string,
  pathNode: string,
): boolean => {
  const from = normalize(relation.from);
  const to = normalize(relation.to);
  const center = normalize(centerNode);
  const path = normalize(pathNode);
  return (
    (from === center && to === path) ||
    (from === path && to === center)
  );
};

const dependencyRelationFailures = (
  content: DirectorSceneContent,
  semantics: SceneSemantics,
): Array<{ field: "leftPath" | "rightPath"; value: string }> => {
  if (
    !isNonBlank(content.centerNode) ||
    !isNonBlank(content.leftPath?.node) ||
    !isNonBlank(content.rightPath?.node)
  ) {
    return [];
  }

  const usedRelations = new Set<string>();
  const failures: Array<{
    field: "leftPath" | "rightPath";
    value: string;
  }> = [];
  for (const [field, pathNode] of [
    ["leftPath", content.leftPath.node],
    ["rightPath", content.rightPath.node],
  ] as const) {
    const relation = semantics.relations.find(
      (candidate) =>
        isFactualSource(candidate.source) &&
        !usedRelations.has(relationIdentity(candidate)) &&
        relationConnects(candidate, content.centerNode!, pathNode),
    );
    if (!relation) {
      failures.push({ field, value: pathNode });
      continue;
    }
    usedRelations.add(relationIdentity(relation));
  }
  return failures;
};

const sourcedSemanticAtoms = (semantics: SceneSemantics): string[] => [
  ...semantics.metrics
    .filter((item) => isFactualSource(item.source))
    .flatMap((item) => [item.label, item.value, item.unit ?? ""]),
  ...semantics.prices
    .filter((item) => isFactualSource(item.source))
    .flatMap((item) => [item.label, item.value, item.currency ?? ""]),
  ...semantics.timelineEvents
    .filter((item) => isFactualSource(item.source))
    .flatMap((item) => [item.label, item.timeExpression ?? ""]),
  ...semantics.comparisons
    .filter((item) => isFactualSource(item.source))
    .flatMap((item) => [item.left, item.right, item.dimension ?? ""]),
  ...semantics.relations
    .filter((item) => isFactualSource(item.source))
    .flatMap((item) => [item.from, item.to, item.relation]),
  ...semantics.signals
    .filter((item) => isFactualSource(item.source))
    .flatMap((item) => [item.sourceLabel, ...item.targets]),
  ...semantics.judgements
    .filter((item) => isFactualSource(item.source))
    .flatMap((item) => [item.conclusion, ...item.evidence]),
  ...semantics.evidenceRefs.filter((referenceId) =>
    semantics.sources.some(
      (source) =>
        isFactualSource(source) && source.referenceId === referenceId,
    ),
  ),
].filter(Boolean);

const isTraceable = (value: string, semantics: SceneSemantics): boolean => {
  const normalized = normalize(value);
  if (!normalized) return true;

  if (
    sourcedSemanticAtoms(semantics).some(
      (atom) => normalize(atom) === normalized,
    )
  ) {
    return true;
  }

  return semantics.sources
    .filter(isFactualSource)
    .some((source) => sourceContainsValue(source.text, value));
};

const semanticIssueCodes: Record<DirectorSceneType, string> = {
  Hero: "semantic.hero-position-required",
  Timeline: "semantic.timeline-required",
  SystemMap: "semantic.relation-required",
  DataExplosion: "semantic.metric-required",
  Contrast: "semantic.comparison-required",
  SpecSheet: "semantic.metrics-required",
  Pricing: "semantic.price-required",
  Pause: "semantic.pause-required",
  Summary: "semantic.summary-position-required",
  EvidenceHero: "semantic.evidence-required",
  KeywordInvestigation: "semantic.concept-required",
  FinancialMeter: "semantic.cost-concept-required",
  SystemStack: "semantic.layers-required",
  DependencyMap: "semantic.paths-required",
  QuestionPause: "semantic.question-required",
  BarrierWall: "semantic.barriers-required",
  EvidenceReturn: "semantic.evidence-judgement-required",
  IndustrySignal: "semantic.signal-required",
  CompetitionLayerStack: "semantic.competition-layers-required",
  FinalJudgement: "semantic.judgement-required",
};

export const validateDirectorContract = (
  input: ValidateDirectorContractInput,
): { passed: boolean; issues: DirectorContractIssue[] } => {
  const issues: DirectorContractIssue[] = [];
  const receivedDirectorType = input.directorType as unknown;
  if (
    typeof receivedDirectorType !== "string" ||
    !Object.prototype.hasOwnProperty.call(
      directorCapabilities,
      receivedDirectorType,
    ) ||
    !Object.prototype.hasOwnProperty.call(
      semanticIssueCodes,
      receivedDirectorType,
    )
  ) {
    issues.push({
      code: "director.type-unknown",
      severity: "error",
      sceneId: input.scene.id,
      directorType: input.directorType,
      field: "directorType",
      message: `${input.scene.id} 的导演类型 ${String(receivedDirectorType)} 未注册`,
    });
    return { passed: false, issues };
  }

  const directorType = receivedDirectorType as DirectorSceneType;
  const capability = directorCapabilities[directorType];
  const componentStructure = validateComponentsStructure(input.components);
  const semanticStructureIssues = validateSemanticsStructure(
    input.semantics,
    input.scene.id,
  );
  const structureIssues = validateDirectorContentStructure(
    directorType,
    input.content,
  );
  for (const issue of [
    ...componentStructure.issues,
    ...semanticStructureIssues,
  ]) {
    issues.push({
      code: issue.code,
      severity: "error",
      sceneId: input.scene.id,
      directorType,
      field: issue.field,
      message: `${input.scene.id} 的 ${issue.field} 结构无效`,
    });
  }
  for (const issue of structureIssues) {
    issues.push({
      code: issue.code,
      severity: "error",
      sceneId: input.scene.id,
      directorType,
      field: issue.field,
      message:
        issue.code === "content.invalid-structure"
          ? `${input.scene.id} 的 ${issue.field} 结构无效`
          : `${input.scene.id} 的 ${directorType} 缺少足够的唯一 ${issue.field}`,
    });
  }
  if (
    componentStructure.issues.length > 0 ||
    semanticStructureIssues.length > 0 ||
    structureIssues.some(
      (issue) => issue.code === "content.invalid-structure",
    )
  ) {
    if (componentStructure.components) {
      for (const component of componentStructure.components) {
        issues.push({
          code: "component.not-derived",
          severity: "error",
          sceneId: input.scene.id,
          directorType,
          field: component,
          message: `${input.scene.id} 的 ${component} 不是由已验证内容派生`,
        });
      }
    }
    return { passed: false, issues };
  }
  const components = componentStructure.components!;

  const sceneIndex = input.sceneIndex ?? 0;
  const sceneCount = input.sceneCount ?? 1;

  if (!capability.isCompatible(input.semantics, sceneIndex, sceneCount)) {
    issues.push({
      code: semanticIssueCodes[directorType],
      severity: "error",
      sceneId: input.scene.id,
      directorType,
      message: `${input.scene.id} 的语义不支持 ${directorType}`,
      sourceText: input.scene.subtitle,
    });
  }

  if (
    input.scene.rendererFamily &&
    input.scene.rendererFamily !== capability.rendererFamily
  ) {
    issues.push({
      code: "renderer.family-mismatch",
      severity: "error",
      sceneId: input.scene.id,
      directorType,
      field: "rendererFamily",
      message: `${input.scene.id} 的 rendererFamily 不属于 ${directorType}`,
      sourceText: input.scene.rendererFamily,
    });
  }

  if (
    input.scene.visualTreatment &&
    !capability.allowedTreatments.includes(input.scene.visualTreatment)
  ) {
    issues.push({
      code: "renderer.treatment-not-allowed",
      severity: "error",
      sceneId: input.scene.id,
      directorType,
      field: "visualTreatment",
      message: `${input.scene.id} 的 visualTreatment 未由 ${directorType} 实现`,
      sourceText: input.scene.visualTreatment,
    });
  }

  for (const field of capability.validateContent(input.content)) {
    issues.push({
      code: "content.required-field",
      severity: "error",
      sceneId: input.scene.id,
      directorType,
      field,
      message: `${input.scene.id} 的 ${directorType} 缺少 ${field}`,
    });
  }

  for (const placeholder of genericPlaceholderValues(input.content)) {
    issues.push({
      code: "content.generic-placeholder",
      severity: "error",
      sceneId: input.scene.id,
      directorType,
      field: placeholder.field,
      message: `${input.scene.id} 的主视觉内容不能只写“${placeholder.value}”这类空泛占位词`,
      sourceText: placeholder.value,
    });
  }

  for (const field of capability.provenanceFields) {
    const structuredFailures = structuredProvenanceFailures(
      input.content,
      field,
      input.semantics,
      directorType,
    );
    if (structuredFailures) {
      for (const value of structuredFailures) {
        issues.push({
          code: "content.untraceable-value",
          severity: "error",
          sceneId: input.scene.id,
          directorType,
          field,
          message: `${input.scene.id} 的 ${field} 值“${value}”无法追溯到同一条已验证语义事实`,
          sourceText: value,
        });
      }
      continue;
    }

    for (const value of contentValues(input.content, field)) {
      if (isTraceable(value, input.semantics)) continue;
      issues.push({
        code: "content.untraceable-value",
        severity: "error",
        sceneId: input.scene.id,
        directorType,
        field,
        message: `${input.scene.id} 的 ${field} 值“${value}”无法追溯到已验证来源`,
        sourceText: value,
      });
    }
  }

  if (directorType === "DependencyMap") {
    for (const failure of dependencyRelationFailures(
      input.content,
      input.semantics,
    )) {
      issues.push({
        code: "content.untraceable-value",
        severity: "error",
        sceneId: input.scene.id,
        directorType,
        field: failure.field,
        message: `${input.scene.id} 的 ${failure.field} 未对应一条独立且可验证的中心关系`,
        sourceText: failure.value,
      });
    }
  }

  const hasUnverifiedContent = issues.some(
    (issue) =>
      issue.code.startsWith("semantic.") ||
      issue.code.startsWith("content."),
  );
  const derivedComponents = new Set(
    hasUnverifiedContent
      ? []
      : deriveDirectorComponents(
          directorType,
          input.content,
          input.scene.visualTreatment,
        ),
  );
  for (const component of components) {
    if (derivedComponents.has(component)) continue;
    issues.push({
      code: "component.not-derived",
      severity: "error",
      sceneId: input.scene.id,
      directorType,
      field: component,
      message: `${input.scene.id} 的 ${component} 不是由已验证内容派生`,
    });
  }

  for (const component of components) {
    if (!capability.forbiddenComponents.includes(component)) continue;
    issues.push({
      code: "component.forbidden",
      severity: "error",
      sceneId: input.scene.id,
      directorType,
      field: component,
      message: `${input.scene.id} 的 ${directorType} 禁止使用 ${component}`,
    });
  }

  return {
    passed: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
};
