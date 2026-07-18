import { directorCapabilities } from "./director-capabilities";
import type {
  DirectorSceneContent,
  DirectorSceneType,
} from "./types";

type ComponentDeriver = (content: DirectorSceneContent) => string[];

export type DirectorContentStructureIssue = {
  code: "content.invalid-structure" | "content.required-field";
  field: string;
};

type ArrayRule = {
  field: keyof DirectorSceneContent;
  minimum: number;
  hasValidShape: (item: unknown) => boolean;
  identity: (item: unknown) => string | undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const canonicalizeText = (value: string): string =>
  value
    .normalize("NFKC")
    .replace(/\p{Default_Ignorable_Code_Point}/gu, "");

const hasMeaningfulText = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const canonical = canonicalizeText(value);
  return canonical.trim().length > 0 && /[\p{L}\p{N}]/u.test(canonical);
};

const isNonBlank = hasMeaningfulText;

const normalizeIdentity = (value: string): string =>
  canonicalizeText(value)
    .trim()
    .toLowerCase()
    .replace(/[\s，。；：、,.!?！？"'“”‘’()[\]{}]/g, "");

const optionalNonBlank = (value: unknown): boolean =>
  value === undefined || isNonBlank(value);

const optionalString = (value: unknown): boolean =>
  value === undefined || typeof value === "string";

const stringIdentity = (item: unknown): string | undefined =>
  isNonBlank(item) ? normalizeIdentity(item) : undefined;

const isMetricShape = (item: unknown): boolean =>
  isRecord(item) &&
  optionalString(item.label) &&
  optionalString(item.value) &&
  optionalString(item.note);

const metricIdentity = (item: unknown): string | undefined => {
  if (
    !isRecord(item) ||
    !isNonBlank(item.label) ||
    !isNonBlank(item.value) ||
    !optionalNonBlank(item.note)
  ) {
    return undefined;
  }
  return `${normalizeIdentity(item.label)}\0${normalizeIdentity(item.value)}`;
};

const isTimelineShape = (item: unknown): boolean =>
  isRecord(item) &&
  optionalString(item.label) &&
  optionalString(item.title) &&
  optionalString(item.note);

const timelineIdentity = (item: unknown): string | undefined => {
  if (
    !isRecord(item) ||
    !isNonBlank(item.label) ||
    !isNonBlank(item.title) ||
    !optionalNonBlank(item.note)
  ) {
    return undefined;
  }
  return `${normalizeIdentity(item.label)}\0${normalizeIdentity(item.title)}`;
};

const isComparisonShape = (item: unknown): boolean =>
  isRecord(item) &&
  optionalString(item.label) &&
  optionalString(item.value);

const comparisonIdentity = (item: unknown): string | undefined => {
  if (
    !isRecord(item) ||
    !isNonBlank(item.label) ||
    !isNonBlank(item.value)
  ) {
    return undefined;
  }
  return `${normalizeIdentity(item.label)}\0${normalizeIdentity(item.value)}`;
};

const isNodeShape = (item: unknown): boolean =>
  typeof item === "string" ||
  (isRecord(item) &&
    optionalString(item.label) &&
    optionalString(item.role));

const nodeIdentity = (item: unknown): string | undefined => {
  if (typeof item === "string") return stringIdentity(item);
  if (
    !isRecord(item) ||
    !isNonBlank(item.label) ||
    !optionalNonBlank(item.role)
  ) {
    return undefined;
  }
  return normalizeIdentity(item.label);
};

const isLayerShape = (item: unknown): boolean =>
  typeof item === "string" ||
  (isRecord(item) &&
    optionalString(item.name) &&
    optionalString(item.label) &&
    optionalString(item.visual) &&
    optionalString(item.note));

const layerIdentity = (item: unknown): string | undefined => {
  if (typeof item === "string") return stringIdentity(item);
  if (
    !isRecord(item) ||
    !optionalNonBlank(item.name) ||
    !optionalNonBlank(item.label) ||
    !optionalNonBlank(item.visual) ||
    !optionalNonBlank(item.note)
  ) {
    return undefined;
  }

  const label = isNonBlank(item.name) ? item.name : item.label;
  return isNonBlank(label) ? normalizeIdentity(label) : undefined;
};

const isBarrierShape = (item: unknown): boolean =>
  isRecord(item) &&
  optionalString(item.label) &&
  optionalString(item.visual) &&
  optionalString(item.shape);

const barrierIdentity = (item: unknown): string | undefined => {
  if (
    !isRecord(item) ||
    !isNonBlank(item.label) ||
    !optionalNonBlank(item.visual) ||
    !optionalNonBlank(item.shape)
  ) {
    return undefined;
  }
  return normalizeIdentity(item.label);
};

const validateDependencyPath = (
  field: "leftPath" | "rightPath",
  value: unknown,
): DirectorContentStructureIssue[] => {
  if (value === undefined) return [];
  if (
    !isRecord(value) ||
    !optionalString(value.node) ||
    (value.riskTags !== undefined && !Array.isArray(value.riskTags))
  ) {
    return [{ code: "content.invalid-structure", field }];
  }

  if (value.node !== undefined && !isNonBlank(value.node)) {
    return [{ code: "content.required-field", field }];
  }

  if (value.riskTags === undefined) return [];
  if (!value.riskTags.every((tag) => typeof tag === "string")) {
    return [
      {
        code: "content.invalid-structure",
        field: `${field}.riskTags`,
      },
    ];
  }

  const identities = value.riskTags
    .map(stringIdentity)
    .filter((identity): identity is string => identity !== undefined);
  if (
    identities.length !== value.riskTags.length ||
    new Set(identities).size !== identities.length
  ) {
    return [
      {
        code: "content.required-field",
        field: `${field}.riskTags`,
      },
    ];
  }
  return [];
};

const validateDependencyMapStructure = (
  content: Record<string, unknown>,
): DirectorContentStructureIssue[] => {
  const issues: DirectorContentStructureIssue[] = [];
  issues.push(...validateDependencyPath("leftPath", content.leftPath));
  issues.push(...validateDependencyPath("rightPath", content.rightPath));

  const leftPath = isRecord(content.leftPath) ? content.leftPath : undefined;
  const rightPath = isRecord(content.rightPath)
    ? content.rightPath
    : undefined;
  if (
    isNonBlank(leftPath?.node) &&
    isNonBlank(rightPath?.node) &&
    normalizeIdentity(leftPath.node) === normalizeIdentity(rightPath.node)
  ) {
    issues.push({
      code: "content.required-field",
      field: "rightPath",
    });
  }
  return issues;
};

const requiredTextFields: Record<DirectorSceneType, string[]> = {
  Hero: ["headline"],
  Timeline: [],
  SystemMap: [],
  DataExplosion: [],
  Contrast: [],
  SpecSheet: [],
  Pricing: [],
  Pause: ["action"],
  Summary: [],
  EvidenceHero: [],
  KeywordInvestigation: [],
  FinancialMeter: [],
  SystemStack: ["highlight"],
  DependencyMap: ["centerNode"],
  QuestionPause: ["action"],
  BarrierWall: [],
  EvidenceReturn: ["evidenceLabel"],
  IndustrySignal: ["signalSource"],
  CompetitionLayerStack: [],
  FinalJudgement: [],
};

const arrayRules: Record<DirectorSceneType, ArrayRule[]> = {
  Hero: [],
  Timeline: [
    {
      field: "timelineItems",
      minimum: 2,
      hasValidShape: isTimelineShape,
      identity: timelineIdentity,
    },
  ],
  SystemMap: [
    {
      field: "nodes",
      minimum: 2,
      hasValidShape: isNodeShape,
      identity: nodeIdentity,
    },
  ],
  DataExplosion: [
    {
      field: "metrics",
      minimum: 1,
      hasValidShape: isMetricShape,
      identity: metricIdentity,
    },
  ],
  Contrast: [
    {
      field: "comparisons",
      minimum: 2,
      hasValidShape: isComparisonShape,
      identity: comparisonIdentity,
    },
  ],
  SpecSheet: [
    {
      field: "metrics",
      minimum: 2,
      hasValidShape: isMetricShape,
      identity: metricIdentity,
    },
  ],
  Pricing: [
    {
      field: "metrics",
      minimum: 1,
      hasValidShape: isMetricShape,
      identity: metricIdentity,
    },
  ],
  Pause: [],
  Summary: [
    {
      field: "summaryItems",
      minimum: 1,
      hasValidShape: (item) => typeof item === "string",
      identity: stringIdentity,
    },
  ],
  EvidenceHero: [
    {
      field: "evidenceKeywords",
      minimum: 1,
      hasValidShape: (item) => typeof item === "string",
      identity: stringIdentity,
    },
    {
      field: "factBoundary",
      minimum: 1,
      hasValidShape: (item) => typeof item === "string",
      identity: stringIdentity,
    },
  ],
  KeywordInvestigation: [
    {
      field: "keywordTags",
      minimum: 1,
      hasValidShape: (item) => typeof item === "string",
      identity: stringIdentity,
    },
  ],
  FinancialMeter: [
    {
      field: "dataWidgets",
      minimum: 1,
      hasValidShape: (item) => typeof item === "string",
      identity: stringIdentity,
    },
  ],
  SystemStack: [
    {
      field: "layers",
      minimum: 3,
      hasValidShape: isLayerShape,
      identity: layerIdentity,
    },
  ],
  DependencyMap: [],
  QuestionPause: [],
  BarrierWall: [
    {
      field: "barriers",
      minimum: 3,
      hasValidShape: isBarrierShape,
      identity: barrierIdentity,
    },
  ],
  EvidenceReturn: [
    {
      field: "judgementPanel",
      minimum: 1,
      hasValidShape: (item) => typeof item === "string",
      identity: stringIdentity,
    },
  ],
  IndustrySignal: [
    {
      field: "nodes",
      minimum: 2,
      hasValidShape: isNodeShape,
      identity: nodeIdentity,
    },
  ],
  CompetitionLayerStack: [
    {
      field: "nodes",
      minimum: 3,
      hasValidShape: isNodeShape,
      identity: nodeIdentity,
    },
  ],
  FinalJudgement: [
    {
      field: "judgementPanel",
      minimum: 1,
      hasValidShape: (item) => typeof item === "string",
      identity: stringIdentity,
    },
    {
      field: "judgementTags",
      minimum: 1,
      hasValidShape: (item) => typeof item === "string",
      identity: stringIdentity,
    },
  ],
};

export const validateDirectorContentStructure = (
  directorType: DirectorSceneType,
  content: unknown,
): DirectorContentStructureIssue[] => {
  if (!isRecord(content)) {
    return [{ code: "content.invalid-structure", field: "content" }];
  }

  const issues: DirectorContentStructureIssue[] = [];
  for (const field of requiredTextFields[directorType]) {
    const value = content[field];
    if (value === undefined) continue;
    if (typeof value !== "string") {
      issues.push({ code: "content.invalid-structure", field });
    } else if (!isNonBlank(value)) {
      issues.push({ code: "content.required-field", field });
    }
  }

  if (directorType === "DependencyMap") {
    issues.push(...validateDependencyMapStructure(content));
  }

  for (const rule of arrayRules[directorType]) {
    const value = content[rule.field];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      issues.push({
        code: "content.invalid-structure",
        field: rule.field,
      });
      continue;
    }

    if (!value.every(rule.hasValidShape)) {
      issues.push({
        code: "content.invalid-structure",
        field: rule.field,
      });
      continue;
    }

    const identities = value
      .map(rule.identity)
      .filter((identity): identity is string => identity !== undefined);
    const uniqueIdentityCount = new Set(identities).size;
    if (
      identities.length !== value.length ||
      uniqueIdentityCount < rule.minimum ||
      uniqueIdentityCount < identities.length
    ) {
      issues.push({
        code: "content.required-field",
        field: rule.field,
      });
    }
  }

  return issues;
};

const componentDerivers: Record<DirectorSceneType, ComponentDeriver> = {
  Hero: () => ["HeroTitle"],
  Timeline: () => ["TimelineView", "TimelineRail"],
  SystemMap: () => ["NodeGraph", "ProductEcosystemMap"],
  DataExplosion: () => ["MetricCard", "MetricCounter"],
  Contrast: () => ["RiskMeter"],
  SpecSheet: () => ["SpecTable", "MetricCard", "EvidenceWall"],
  Pricing: () => ["PriceCard", "MetricCard", "MetricCounter"],
  Pause: () => ["PauseScreen"],
  Summary: () => ["SummaryCard"],
  EvidenceHero: () => [
    "EvidenceZoom",
    "EvidenceCallout",
    "LogoCornerCompare",
  ],
  KeywordInvestigation: () => [
    "EvidenceDataSplit",
    "TwoKeywordInvestigation",
    "CautionBadge",
  ],
  FinancialMeter: () => ["InferenceCostBill", "TokenMeter"],
  SystemStack: () => [
    "ModelHardwareStack",
    "DataPathTrace",
    "ComputeFlow",
  ],
  DependencyMap: () => ["SupplyDependencyMap", "RiskTagCallout"],
  QuestionPause: () => ["ControlQuestionPause"],
  BarrierWall: () => ["ChipBarrierWall", "MicroSceneTile"],
  EvidenceReturn: () => ["EvidenceReturnFrame", "DualJudgementPanel"],
  IndustrySignal: () => ["IndustrySignalRadar", "MarketLayerMap"],
  CompetitionLayerStack: () => ["CompetitionLayerStack"],
  FinalJudgement: () => ["FinalJudgementPanel"],
};

export const deriveDirectorComponents = (
  directorType: DirectorSceneType,
  content: DirectorSceneContent,
): string[] => {
  if (
    !Object.prototype.hasOwnProperty.call(componentDerivers, directorType) ||
    !Object.prototype.hasOwnProperty.call(directorCapabilities, directorType)
  ) {
    throw new Error(`缺少 ${directorType} 的组件派生器`);
  }

  const capability = directorCapabilities[directorType];
  if (
    validateDirectorContentStructure(directorType, content).length > 0 ||
    capability.validateContent(content).length > 0
  ) {
    return [];
  }

  return [...new Set(componentDerivers[directorType](content))];
};
