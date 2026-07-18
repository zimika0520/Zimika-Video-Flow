import type {
  RuntimeAsset,
  RuntimeAssetSceneBinding,
  RuntimeAssetManifest,
  RuntimeEvidenceRecord,
  Scene,
  SceneSemanticContext,
  SceneSemantics,
  SemanticConfidenceCategory,
  SemanticSourceRef,
} from "./types";

const subtitleSource = (text: string): SemanticSourceRef => ({
  kind: "subtitle",
  text,
  supportsFacts: true,
});

const clean = (value: string): string =>
  value.replace(/^[，。；：、\s]+|[，。；：、\s]+$/g, "");

const stripSourceLead = (value: string): string =>
  clean(
    value.replace(
      /^(?:(?:根据|依据|据)(?:官方|行业)?(?:价格|资料|分析|报告|页面|数据|结论)(?:显示|指出|表明)?|(?:官方|行业)(?:价格|资料|分析|报告|页面|数据|结论)?(?:显示|指出|表明)|(?:资料|数据|报告|分析|页面)(?:显示|指出|表明))[，,:：\s]*/,
      "",
    ),
  );

const unique = (values: string[]): string[] =>
  [...new Set(values.map(clean).filter(Boolean))];

const normalizeFactKey = (value: string | undefined): string =>
  stripSourceLead(value ?? "").toLowerCase().replace(/\s+/g, "");

const uniqueBy = <T>(items: T[], keyFor: (item: T) => string): T[] => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = keyFor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const sourcePriority: Record<SemanticSourceRef["kind"], number> = {
  subtitle: 0,
  article: 1,
  "user-asset": 2,
  "evidence-record": 3,
  "ai-concept": 4,
};

const metricClausePrefix = (text: string, metricIndex: number): string =>
  text
    .slice(0, metricIndex)
    .split(/[，,。；;：:]/)
    .at(-1) ?? "";

const metricLabel = (text: string, metricIndex: number): string => {
  const clausePrefix = metricClausePrefix(text, metricIndex);
  const businessRole = [...clausePrefix.matchAll(/输入|输出/g)].at(-1)?.[0];
  if (businessRole) return businessRole;
  const priceRole = [...clausePrefix.matchAll(/售价|定价/g)].at(-1)?.[0];
  if (priceRole) return priceRole;
  if (clausePrefix.includes("价格")) return "价格";

  return (
    text
      .slice(Math.max(0, metricIndex - 8), metricIndex)
      .replace(/[，。；：]/g, "")
      .trim() || "指标"
  );
};

const productModelIdentifier = (value: string): string | undefined =>
  value
    .match(/[A-Za-z0-9]+(?:[\s_-]+[A-Za-z0-9]+)*/g)
    ?.map((candidate) => candidate.replace(/[\s_-]+/g, "").toLowerCase())
    .filter((candidate) => /[a-z]/.test(candidate) && /\d/.test(candidate))
    .at(-1);

const chineseVersionIdentifier = (value: string): string | undefined =>
  normalizeFactKey(value)
    .match(
      /(?:标准|基础|入门|专业|旗舰|高配|低配|青春|尊享|豪华|普通|升级|典藏|纪念|限量)(?:版|款)(?:plus|pro|max)?/g,
    )
    ?.at(-1);

const canonicalProductIdentity = (value: string): string => {
  const modelIdentifier = productModelIdentifier(value);
  if (modelIdentifier) return modelIdentifier;

  const versionIdentifier = chineseVersionIdentifier(value);
  if (versionIdentifier) return versionIdentifier;

  const parts = value
    .replace(/(?:当前|目前)?的?$/g, "")
    .split(/的|\s+/)
    .map((part) => normalizeFactKey(part))
    .filter(Boolean);
  return parts.at(-1) ?? "";
};

const metricEntity = (
  text: string,
  metricIndex: number,
  role: string,
): string => {
  const clausePrefix = metricClausePrefix(text, metricIndex);
  if (/^(?:售价|定价|价格)$/.test(role)) {
    return canonicalProductIdentity(
      clausePrefix.replace(
        /(?:的)?(?:(?:官方|建议零售|建议|零售)\s*)*(?:售价|价格|定价)(?:为|是|约为?|达到|达)?\s*$/,
        "",
      ),
    );
  }

  const roleIndex = clausePrefix.lastIndexOf(role);
  if (roleIndex < 0) return "";

  return canonicalProductIdentity(clausePrefix.slice(0, roleIndex));
};

type ParsedMetricToken = {
  index: number;
  value: string;
  unit: string;
  canonicalValue: string;
  canonicalUnit: string;
};

const chineseDigits: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const parseChineseSection = (value: string): number | undefined => {
  if (!value) return 0;
  if ([...value].every((character) => character in chineseDigits)) {
    return Number([...value].map((character) => chineseDigits[character]).join(""));
  }

  const unitValues: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
  let total = 0;
  let digit: number | undefined;

  for (const character of value) {
    if (character in chineseDigits) {
      digit = chineseDigits[character];
      continue;
    }

    const unit = unitValues[character];
    if (!unit) return undefined;
    total += (digit ?? 1) * unit;
    digit = undefined;
  }

  return total + (digit ?? 0);
};

const parseChineseInteger = (value: string): number | undefined => {
  if ([...value].every((character) => character in chineseDigits)) {
    return Number([...value].map((character) => chineseDigits[character]).join(""));
  }

  const yiIndex = value.indexOf("亿");
  if (yiIndex >= 0) {
    const left = parseChineseInteger(value.slice(0, yiIndex) || "一");
    const right = parseChineseInteger(value.slice(yiIndex + 1));
    if (left === undefined || right === undefined) return undefined;
    return left * 100_000_000 + right;
  }

  const wanIndex = value.indexOf("万");
  if (wanIndex >= 0) {
    const left = parseChineseSection(value.slice(0, wanIndex) || "一");
    const right = parseChineseSection(value.slice(wanIndex + 1));
    if (left === undefined || right === undefined) return undefined;
    return left * 10_000 + right;
  }

  return parseChineseSection(value);
};

const parseChineseNumber = (value: string): number | undefined => {
  const [integerText, decimalText, ...rest] = value.split("点");
  if (rest.length > 0) return undefined;

  const integer = parseChineseInteger(integerText);
  if (integer === undefined) return undefined;
  if (decimalText === undefined) return integer;
  if (!decimalText || ![...decimalText].every((character) => character in chineseDigits)) {
    return undefined;
  }

  return Number(
    `${integer}.${[...decimalText]
      .map((character) => chineseDigits[character])
      .join("")}`,
  );
};

const canonicalNumber = (value: number): string =>
  Number(value.toPrecision(15)).toString();

const cnyMultiplier = (unit: string): number | undefined => {
  if (unit === "元") return 1;
  if (unit === "万元") return 10_000;
  if (unit === "亿元") return 100_000_000;
  return undefined;
};

const parseMetricTokens = (text: string): ParsedMetricToken[] => {
  const tokens: ParsedMetricToken[] = [];
  const occupiedRanges: Array<[number, number]> = [];
  const addToken = (
    match: RegExpMatchArray,
    value: string,
    unit: string,
    canonicalValue: number,
    canonicalUnit = unit.toUpperCase(),
  ) => {
    const index = match.index!;
    const end = index + match[0].length;
    if (occupiedRanges.some(([start, occupiedEnd]) => index < occupiedEnd && end > start)) {
      return;
    }
    occupiedRanges.push([index, end]);
    tokens.push({
      index,
      value,
      unit,
      canonicalValue: canonicalNumber(canonicalValue),
      canonicalUnit,
    });
  };

  for (const match of text.matchAll(
    /(\d+(?:\.\d+)?)\s*(亿元|万元|TOPS|GB|MB|TB|ms|%|倍|K|B|亿|万|元|°)/gi,
  )) {
    const multiplier = cnyMultiplier(match[2]);
    addToken(
      match,
      `${match[1]}${match[2]}`,
      multiplier === undefined ? match[2] : "元",
      Number(match[1]) * (multiplier ?? 1),
      multiplier === undefined ? match[2].toUpperCase() : "CNY",
    );
  }

  const chineseNumber =
    "[零〇一二两三四五六七八九十百千万亿]+(?:点[零〇一二两三四五六七八九]+)?";
  for (const match of text.matchAll(new RegExp(`百分之(${chineseNumber})`, "g"))) {
    const canonicalValue = parseChineseNumber(match[1]);
    if (canonicalValue !== undefined) {
      addToken(match, match[0], "%", canonicalValue);
    }
  }

  for (const match of text.matchAll(
    new RegExp(`(${chineseNumber})\\s*(亿元|万元|TOPS|GB|MB|TB|ms|倍|K|B|亿|万|元|°)`, "gi"),
  )) {
    if (match[1] === "百" && text[match.index! - 1] === "每") continue;
    const canonicalValue = parseChineseNumber(match[1]);
    if (canonicalValue !== undefined) {
      const multiplier = cnyMultiplier(match[2]);
      addToken(
        match,
        `${match[1]}${match[2]}`,
        multiplier === undefined ? match[2] : "元",
        canonicalValue * (multiplier ?? 1),
        multiplier === undefined ? match[2].toUpperCase() : "CNY",
      );
    }
  }

  for (const match of text.matchAll(
    /([零〇一二两三四五六七八九十百千万亿]+点[零〇一二两三四五六七八九]+)/g,
  )) {
    if (!/均分|得分|评分|分数/.test(text)) continue;
    const canonicalValue = parseChineseNumber(match[1]);
    if (canonicalValue !== undefined) {
      addToken(match, match[1], "", canonicalValue);
    }
  }

  return tokens.sort((left, right) => left.index - right.index);
};

const extractMetrics = (
  text: string,
  source: SemanticSourceRef,
): SceneSemantics["metrics"] => {
  const factualText = stripSourceLead(text);

  return parseMetricTokens(factualText)
    .map((token) => ({
      label: metricLabel(factualText, token.index),
      value: token.value,
      ...(token.unit ? { unit: token.unit } : {}),
      source,
    }));
};

const extractPrices = (
  text: string,
  source: SemanticSourceRef,
): SceneSemantics["prices"] => {
  if (!/价格|输入|输出|每百万|售价|定价/.test(text)) return [];

  return extractMetrics(text, source)
    .filter((metric) => metric.unit === "元")
    .map((metric) => ({
      label: metric.label,
      value: metric.value,
      currency: "CNY",
      source: metric.source,
    }));
};

const extractOrderedLayers = (text: string): string[] => {
  if (/请求经过模型、API、推理服务，最后进入芯片执行/.test(text)) {
    return ["模型", "API", "推理服务", "芯片执行"];
  }
  if (/用户请求、模型层、推理服务层、芯片执行层/.test(text)) {
    return ["用户请求", "模型层", "推理服务层", "芯片执行层"];
  }
  return [];
};

const extractBarriers = (text: string): string[] => {
  if (!/每一关|障碍|难点|门槛|没那么容易/.test(text)) return [];

  return unique(
    ["制程", "HBM", "高带宽内存", "软件生态", "流片", "量产"].filter((item) =>
      text.includes(item),
    ),
  );
};

const extractRelations = (
  text: string,
  source: SemanticSourceRef,
): SceneSemantics["relations"] => {
  const sharedOutcome = stripSourceLead(text).match(
    /^(.+?)(?:[，,])?\s*共同决定(.+?)[。；]?$/,
  );
  if (sharedOutcome) {
    const contributors = unique(
      sharedOutcome[1]
        .replace(/[，,\s]+$/g, "")
        .split(/、|和|以及/)
        .map(clean),
    );
    const outcome = clean(sharedOutcome[2]);

    if (contributors.length >= 2 && outcome) {
      return contributors.map((from) => ({
        from,
        to: outcome,
        relation: "共同决定",
        source,
      }));
    }
  }

  const match = stripSourceLead(text).match(
    /^(.+?)绕不开两条路：一条是(.+?)，一条是(.+?)[。；]?$/,
  );
  if (!match) return [];

  const center = clean(match[1]);
  return [
    {
      from: center,
      to: clean(match[2]),
      relation: "依赖路径",
      source,
    },
    {
      from: center,
      to: clean(match[3]),
      relation: "依赖路径",
      source,
    },
  ];
};

const extractComparisons = (
  text: string,
  source: SemanticSourceRef,
): SceneSemantics["comparisons"] => {
  if (/训练.+推理/.test(text)) {
    return [{
      left: "训练",
      right: "推理",
      dimension: "投入持续性",
      source,
    }];
  }

  const notBut = text.match(/不是(.+?)[，,]?\s*而是(.+?)[。；]?$/);
  if (!notBut) return [];

  return [{
    left: clean(notBut[1]),
    right: clean(notBut[2]),
    dimension: "原文对照",
    source,
  }];
};

const extractQuestions = (text: string): string[] => {
  const factualText = stripSourceLead(text);
  return /[？?]/.test(factualText) ? [factualText] : [];
};

const extractSignals = (
  text: string,
  source: SemanticSourceRef,
): SceneSemantics["signals"] => {
  const targetText =
    text.match(/(?:开始进入|进入)(?:：|，|在)?(.+?)[。；]?$/)?.[1] ??
    text.match(/信号(?:：|，)\s*(.+?)[。；]?$/)?.[1];
  if (!targetText || !/芯片|供应链|推理成本|推理调用/.test(targetText)) return [];

  const targets = unique(
    targetText
      .split(/、|和|以及|，/)
      .map((item) => item.replace(/^.*?(?=芯片|供应链|推理成本|推理调用)/, ""))
      .filter((item) => /芯片|供应链|成本|调用/.test(item)),
  );

  return targets.length >= 2
    ? [{ sourceLabel: "行业信号", targets, source }]
    : [];
};

const extractJudgements = (
  text: string,
  source: SemanticSourceRef,
): SceneSemantics["judgements"] => {
  const match = text.match(/核心不是(.+?)[，,。；;]?\s*而是(.+?)[。；]?$/);
  if (!match) return [];

  return [{
    conclusion: clean(match[2]),
    evidence: [clean(match[1])],
    source,
  }];
};

const extractTimelineEvents = (
  text: string,
  source: SemanticSourceRef,
): SceneSemantics["timelineEvents"] => {
  const timeExpressionPattern =
    /((?:今年)?[一二三四五六七八九十]{1,3}月(?:[一二三四五六七八九十]{1,3}日|底|初|中旬|下旬)?|一年前|目前|早期阶段|随后|之后|最终|最后)/g;
  const events = stripSourceLead(text)
    .split(/[，,。！？!?；;]/)
    .map(clean)
    .filter(Boolean)
    .flatMap((clause) =>
      [...clause.matchAll(timeExpressionPattern)]
        .map((match) => ({
          label: clause,
          timeExpression: match[1],
        })),
    );
  if (events.length < 2) return [];

  return events.map((event, order) => ({
    ...event,
    order,
    source,
  }));
};

const timelineFactIdentity = (label: string): string =>
  normalizeFactKey(
    label
      .replace(
        /(?:今年)?[一二三四五六七八九十]{1,3}月(?:[一二三四五六七八九十]{1,3}日|底|初|中旬|下旬)?|一年前|目前|早期阶段|随后|之后|最终|最后/g,
        "",
      )
      .replace(/仍然|仍|已经|正在|正|还在|还|将会|将|会/g, ""),
  );

const extractConcepts = (text: string): string[] => {
  const factualText = stripSourceLead(text);
  const concepts = [
    "推理成本",
    "算力控制权",
    "算力消耗",
    "持续调用",
    "API 调用",
    "推理算力",
    "供应链",
    "软件生态",
    "模型参数",
  ].filter((item) => factualText.includes(item));

  const resourceConsumption = factualText.match(/消耗[^，,。；;！？!?]{0,8}算力/)?.[0];
  if (resourceConsumption) concepts.push(resourceConsumption);
  if (concepts.length > 0) return unique(concepts);

  return [clean(factualText.split(/[，。！？；：]/)[0]).slice(0, 18)].filter(Boolean);
};

const buildConfidence = (
  semantics: Omit<SceneSemantics, "confidence">,
): Record<SemanticConfidenceCategory, number> => ({
  metrics: semantics.metrics.length > 0 ? 1 : 0,
  prices: semantics.prices.length > 0 ? 1 : 0,
  timelineEvents: semantics.timelineEvents.length > 0 ? 1 : 0,
  comparisons: semantics.comparisons.length > 0 ? 1 : 0,
  relations: semantics.relations.length > 0 ? 1 : 0,
  orderedLayers: semantics.orderedLayers.length > 0 ? 1 : 0,
  barriers: semantics.barriers.length > 0 ? 1 : 0,
  questions: semantics.questions.length > 0 ? 1 : 0,
  signals: semantics.signals.length > 0 ? 1 : 0,
  judgements: semantics.judgements.length > 0 ? 1 : 0,
  concepts: semantics.concepts.length > 0 ? 1 : 0,
});

export const extractSceneSemantics = (
  scene: Scene,
  context: SceneSemanticContext = { sourcesBySceneId: {} },
): SceneSemantics => {
  const subtitle = scene.subtitle.trim();
  const sources = [
    subtitleSource(subtitle),
    ...(context.sourcesBySceneId[scene.id] ?? []),
  ];
  const factualSources = sources
    .map((source, index) => ({ source, index }))
    .filter(
      ({ source }) => source.supportsFacts && source.kind !== "ai-concept",
    )
    .sort(
      (left, right) =>
        sourcePriority[left.source.kind] - sourcePriority[right.source.kind] ||
        left.index - right.index,
    )
    .map(({ source }) => source);

  const semantics: Omit<SceneSemantics, "confidence"> = {
    sceneId: scene.id,
    entities: unique(
      ["DeepSeek", "英伟达", "国产替代芯片", "模型", "API", "推理服务", "芯片"].filter(
        (entity) => factualSources.some((source) => source.text.includes(entity)),
      ),
    ),
    metrics: uniqueBy(
      factualSources.flatMap((source) => extractMetrics(source.text, source)),
      (item) =>
        [
          normalizeFactKey(item.label),
          normalizeFactKey(item.value),
          normalizeFactKey(item.unit),
        ].join("|"),
    ),
    prices: uniqueBy(
      factualSources.flatMap((source) => extractPrices(source.text, source)),
      (item) =>
        [
          normalizeFactKey(item.label),
          normalizeFactKey(item.value),
          normalizeFactKey(item.currency),
        ].join("|"),
    ),
    timelineEvents: uniqueBy(
      factualSources.flatMap((source) =>
        extractTimelineEvents(source.text, source),
      ),
      (item) =>
        [
          normalizeFactKey(item.timeExpression),
          timelineFactIdentity(item.label),
        ].join("|"),
    ).map((item, order) => ({ ...item, order })),
    comparisons: uniqueBy(
      factualSources.flatMap((source) =>
        extractComparisons(source.text, source),
      ),
      (item) =>
        [
          normalizeFactKey(item.left),
          normalizeFactKey(item.right),
          normalizeFactKey(item.dimension),
        ].join("|"),
    ),
    relations: uniqueBy(
      factualSources.flatMap((source) =>
        extractRelations(source.text, source),
      ),
      (item) =>
        [
          normalizeFactKey(item.from),
          normalizeFactKey(item.to),
          normalizeFactKey(item.relation),
        ].join("|"),
    ),
    orderedLayers: unique(
      factualSources.flatMap((source) => extractOrderedLayers(source.text)),
    ),
    barriers: unique(factualSources.flatMap((source) => extractBarriers(source.text))),
    questions: unique(factualSources.flatMap((source) => extractQuestions(source.text))),
    signals: uniqueBy(
      factualSources.flatMap((source) => extractSignals(source.text, source)),
      (item) =>
        [
          normalizeFactKey(item.sourceLabel),
          [...item.targets].map(normalizeFactKey).sort().join(","),
        ].join("|"),
    ),
    judgements: uniqueBy(
      factualSources.flatMap((source) => extractJudgements(source.text, source)),
      (item) =>
        [
          normalizeFactKey(item.conclusion),
          [...item.evidence].map(normalizeFactKey).sort().join(","),
        ].join("|"),
    ),
    concepts: unique(factualSources.flatMap((source) => extractConcepts(source.text))),
    evidenceRefs: unique(
      factualSources
        .filter(
          (source) =>
            (source.kind === "evidence-record" || source.kind === "user-asset") &&
            source.referenceId,
        )
        .map((source) => source.referenceId!),
    ),
    pauseMarkers: /先停一下|停一下|换个角度/.test(subtitle) ? [subtitle] : [],
    sources,
  };

  return {
    ...semantics,
    confidence: buildConfidence(semantics),
  };
};

const bigrams = (value: string): Set<string> => {
  const compact = value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (compact.length < 2) return new Set();

  return new Set(
    Array.from({ length: compact.length - 1 }, (_, index) =>
      compact.slice(index, index + 2),
    ),
  );
};

const sourceRelevance = (claim: string, sourceText: string): number => {
  const claimTerms = bigrams(claim);
  if (claimTerms.size === 0) return 0;

  const sourceTerms = bigrams(sourceText);
  const shared = [...claimTerms].filter((term) => sourceTerms.has(term)).length;
  return shared / Math.max(claimTerms.size, sourceTerms.size, 1);
};

const hasNegativePolarity = (text: string): boolean =>
  /已经不|并非|不是|不能|无法|从未|不再|没有|尚未|未曾|未能|未(?!来)|不/.test(
    text.replace(/不得不|不得已|不仅|不但|不止|不光/g, ""),
  );

const contrastDirection = (
  text: string,
): { rejected: string; asserted: string } | undefined => {
  const match = text.match(
    /(?:并非|不是)(.+?)(?:[，,。；;]\s*)?而是(.+?)[。；;]?$/,
  );
  if (!match) return undefined;

  return {
    rejected: clean(match[1]),
    asserted: clean(match[2]),
  };
};

const directionalClaimsMatch = (left: string, right: string): boolean => {
  const leftDirection = contrastDirection(left);
  const rightDirection = contrastDirection(right);

  if (leftDirection && rightDirection) {
    return (
      sourceRelevance(leftDirection.rejected, rightDirection.rejected) >= 0.55 &&
      sourceRelevance(leftDirection.asserted, rightDirection.asserted) >= 0.55
    );
  }

  const direction = leftDirection ?? rightDirection;
  if (direction) {
    const plainClaim = leftDirection ? right : left;
    const assertedScore = sourceRelevance(direction.asserted, plainClaim);
    const rejectedScore = sourceRelevance(direction.rejected, plainClaim);
    return assertedScore >= 0.55 && assertedScore > rejectedScore;
  }

  return hasNegativePolarity(left) === hasNegativePolarity(right);
};

const numericSignatures = (
  text: string,
): Array<{ entity: string; role: string; unit: string; value: string }> => {
  const factualText = stripSourceLead(text);

  return parseMetricTokens(factualText)
    .map((token) => {
      const rawRole = metricLabel(factualText, token.index);
      const role = normalizeFactKey(rawRole);

      return {
        entity: metricEntity(factualText, token.index, rawRole),
        role:
          token.canonicalUnit === "CNY" && /^(?:售价|定价|价格)$/.test(role)
            ? "价格"
            : role,
        unit: token.canonicalUnit,
        value: token.canonicalValue,
      };
    });
};

type AtomicComparison = "none" | "compatible" | "conflict";

type PolarityAtom = {
  object: string;
  group: "trend" | "status" | "support";
  polarity: "positive" | "negative";
  sequence?: number;
};

type AcquisitionAtom = {
  subject: string;
  object: string;
};

type CalendarValue = {
  kind: "date" | "time" | "other";
  value: string;
  year?: string;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
};

type TimelineEventIdentity = {
  action: string;
  objectTokens: string[];
};

type CalendarAtom = CalendarValue & TimelineEventIdentity;

type AtomicFactSignatures = {
  directions: PolarityAtom[];
  supports: PolarityAtom[];
  acquisitions: AcquisitionAtom[];
  numerics: ReturnType<typeof numericSignatures>;
  calendar: CalendarAtom[];
  contrast: ReturnType<typeof contrastDirection>;
};

const splitAtomicClauses = (text: string): string[] =>
  stripSourceLead(text)
    .replace(/但是/g, "但")
    .split(/[，,。！？!?；;、]|(?<!不)但|同时|而(?!是|且)/)
    .map(clean)
    .filter(Boolean);

const normalizeDirectionObject = (value: string): string =>
  normalizeFactKey(
    value.replace(
      /(?:已经|已|正在|正|持续|明显|大幅|快速|仍在|还在|开始)+$/g,
      "",
    ),
  );

const directionPredicates = [
  { predicate: "上涨", group: "trend", polarity: "positive" },
  { predicate: "上升", group: "trend", polarity: "positive" },
  { predicate: "增长", group: "trend", polarity: "positive" },
  { predicate: "增加", group: "trend", polarity: "positive" },
  { predicate: "下降", group: "trend", polarity: "negative" },
  { predicate: "下滑", group: "trend", polarity: "negative" },
  { predicate: "减少", group: "trend", polarity: "negative" },
  { predicate: "上线", group: "status", polarity: "positive" },
  { predicate: "下线", group: "status", polarity: "negative" },
] as const;

const directionAtoms = (text: string): PolarityAtom[] => {
  const trendPattern = "(上涨|上升|增长|增加|下降|下滑|减少)";

  return splitAtomicClauses(text).flatMap((clause) => {
    const orderedTrend = clause.match(
      new RegExp(`^(.+?)先${trendPattern}(?:再|后)${trendPattern}$`),
    );
    if (orderedTrend) {
      const object = normalizeDirectionObject(orderedTrend[1]);
      if (!object) return [];

      return [orderedTrend[2], orderedTrend[3]].map((predicate, sequence) => {
        const signature = directionPredicates.find(
          (candidate) => candidate.predicate === predicate,
        )!;
        return {
          object,
          group: signature.group,
          polarity: signature.polarity,
          sequence,
        };
      });
    }

    const matchedPredicate = directionPredicates.find(({ predicate }) =>
      clause.includes(predicate)
    );
    if (!matchedPredicate) return [];

    const predicateIndex = clause.indexOf(matchedPredicate.predicate);
    const object = normalizeDirectionObject(clause.slice(0, predicateIndex));
    if (!object) return [];

    return [{
      object,
      group: matchedPredicate.group,
      polarity: matchedPredicate.polarity,
    }];
  });
};

const supportAtoms = (text: string): PolarityAtom[] =>
  splitAtomicClauses(text).flatMap((clause) => {
    const match = clause.match(/(不支持|支持)(.+)$/);
    if (!match) return [];

    const object = normalizeFactKey(match[2]);
    if (!object) return [];

    return [{
      object,
      group: "support",
      polarity: match[1] === "不支持" ? "negative" : "positive",
    }];
  });

const stripAcquisitionModifiers = (value: string): string =>
  normalizeFactKey(value.replace(/(?:宣布|计划|将|拟)+$/g, ""));

const acquisitionParties = (
  text: string,
): { subject: string; object: string } | undefined => {
  const factualText = stripSourceLead(text);
  const passiveMatch = factualText.match(/^(.+?)被(.+?)收购[。；;]?$/);
  if (passiveMatch) {
    return {
      subject: stripAcquisitionModifiers(passiveMatch[2]),
      object: normalizeFactKey(passiveMatch[1]),
    };
  }

  const activeMatch = factualText.match(/^(.+?)收购(.+?)[。；;]?$/);
  if (!activeMatch) return undefined;

  return {
    subject: stripAcquisitionModifiers(activeMatch[1]),
    object: normalizeFactKey(activeMatch[2]),
  };
};

const calendarExpressionPatternSource = [
  "(?:(?:今年|(?:\\d{4}|[零〇一二两三四五六七八九]{4})年))?",
  "(?:\\d{1,2}|[一二两三四五六七八九十]{1,3})月",
  "(?:(?:\\d{1,2}|[一二两三四五六七八九十]{1,3})日)?",
  "|\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}",
  "|\\d{1,2}[:：]\\d{2}",
].join("");

const calendarExpressionPattern = new RegExp(
  `(${calendarExpressionPatternSource})`,
  "g",
);

const parseCalendarNumber = (value: string): number | undefined =>
  /^\d+$/.test(value) ? Number(value) : parseChineseInteger(value);

const parseCalendarExpression = (value: string): CalendarValue => {
  const compact = value.replace(/\s+/g, "");
  const iso = compact.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    return {
      kind: "date",
      value: compact,
      year: String(Number(iso[1])),
      month: Number(iso[2]),
      day: Number(iso[3]),
    };
  }

  const clock = compact.match(/^(\d{1,2})[:：](\d{2})$/);
  if (clock) {
    return {
      kind: "time",
      value: compact,
      hour: Number(clock[1]),
      minute: Number(clock[2]),
    };
  }

  const calendar = compact.match(
    /^(?:(今年|(?:\d{4}|[零〇一二两三四五六七八九]{4})年))?(.+?)月(?:(.+?)日)?$/,
  );
  if (!calendar) {
    return {
      kind: "other",
      value: normalizeFactKey(compact),
    };
  }

  const year = calendar[1]
    ? calendar[1] === "今年"
      ? "this-year"
      : String(parseCalendarNumber(calendar[1].replace(/年$/, "")))
    : "";
  const month = parseCalendarNumber(calendar[2]);
  const day = calendar[3] ? parseCalendarNumber(calendar[3]) : undefined;
  if (month === undefined || (calendar[3] && day === undefined)) {
    return {
      kind: "other",
      value: normalizeFactKey(compact),
    };
  }

  return {
    kind: "date",
    value: compact,
    ...(year ? { year } : {}),
    month,
    ...(day !== undefined ? { day } : {}),
  };
};

const timelineEventIdentity = (clause: string): TimelineEventIdentity => {
  const eventText = clause.replace(
    new RegExp(`(${calendarExpressionPatternSource})`, "g"),
    "",
  );
  const action = /发布|推出/.test(eventText)
    ? "release"
    : /上线|投入使用/.test(eventText)
      ? "activate"
      : `other:${normalizeFactKey(
        eventText
          .replace(/[A-Za-z][A-Za-z0-9_-]*/g, "")
          .replace(/它|先|再|又|随后|在|于|正式|完成/g, ""),
      )}`;
  const objectTokens = unique(
    eventText
      .replace(/投入使用|上线|发布|推出/g, " ")
      .replace(/经过[^，,。！？!?；;]*?后/g, " ")
      .split(/[^\u3400-\u9fffA-Za-z0-9_-]+/)
      .filter(
        (token) =>
          !/^(?:它|其|该|本|先|再|又|随后|然后|接着|在|于|正式|完成|已经|已|开始|最终|将|会)+$/.test(
            token,
          ),
      )
      .map((token) => token.toLowerCase()),
  ).sort();

  return { action, objectTokens };
};

const calendarAtoms = (text: string): CalendarAtom[] =>
  splitAtomicClauses(text).flatMap((clause) => {
    const matches = [...clause.matchAll(
      new RegExp(`(${calendarExpressionPatternSource})`, "g"),
    )];
    if (matches.length === 0) return [];
    const eventIdentity = timelineEventIdentity(clause);

    return matches.map((match) => ({
      ...parseCalendarExpression(match[1]),
      ...eventIdentity,
    }));
  });

const valuesByKey = (
  entries: Array<{ key: string; value: string }>,
): Map<string, Set<string>> => {
  const result = new Map<string, Set<string>>();

  for (const entry of entries) {
    const values = result.get(entry.key) ?? new Set<string>();
    values.add(entry.value);
    result.set(entry.key, values);
  }

  return result;
};

const compareValueSets = (
  left: Map<string, Set<string>>,
  right: Map<string, Set<string>>,
): AtomicComparison => {
  let foundComparableKey = false;

  for (const [key, leftValues] of left) {
    const rightValues = right.get(key);
    if (!rightValues) continue;
    foundComparableKey = true;

    if (
      leftValues.size !== rightValues.size ||
      [...leftValues].some((value) => !rightValues.has(value))
    ) {
      return "conflict";
    }
  }

  return foundComparableKey ? "compatible" : "none";
};

const comparePolarityAtoms = (
  left: PolarityAtom[],
  right: PolarityAtom[],
): AtomicComparison => {
  const groupByKey = (atoms: PolarityAtom[]) => {
    const result = new Map<string, PolarityAtom[]>();
    for (const atom of atoms) {
      const key = `${atom.group}|${atom.object}`;
      result.set(key, [...(result.get(key) ?? []), atom]);
    }
    return result;
  };
  const leftByKey = groupByKey(left);
  const rightByKey = groupByKey(right);
  let foundComparableKey = false;

  for (const [key, leftAtoms] of leftByKey) {
    const rightAtoms = rightByKey.get(key);
    if (!rightAtoms) continue;
    foundComparableKey = true;

    const leftOrdered = leftAtoms.filter((atom) => atom.sequence !== undefined);
    const rightOrdered = rightAtoms.filter((atom) => atom.sequence !== undefined);
    if (leftOrdered.length > 0 && rightOrdered.length > 0) {
      const orderedValues = (atoms: PolarityAtom[]) =>
        atoms
          .sort((a, b) => a.sequence! - b.sequence!)
          .map((atom) => atom.polarity);
      const leftValues = orderedValues(leftOrdered);
      const rightValues = orderedValues(rightOrdered);
      if (
        leftValues.length !== rightValues.length ||
        leftValues.some((value, index) => value !== rightValues[index])
      ) {
        return "conflict";
      }
      continue;
    }

    const leftValues = new Set(leftAtoms.map((atom) => atom.polarity));
    const rightValues = new Set(rightAtoms.map((atom) => atom.polarity));
    if (
      leftValues.size !== rightValues.size ||
      [...leftValues].some((value) => !rightValues.has(value))
    ) {
      return "conflict";
    }
  }

  return foundComparableKey ? "compatible" : "none";
};

const compareAcquisitions = (
  left: AcquisitionAtom[],
  right: AcquisitionAtom[],
): AtomicComparison => {
  const toEntries = (atoms: AcquisitionAtom[]) =>
    atoms.map((atom) => ({
      key: [atom.subject, atom.object].sort().join("|"),
      value: `${atom.subject}->${atom.object}`,
    }));

  return compareValueSets(
    valuesByKey(toEntries(left)),
    valuesByKey(toEntries(right)),
  );
};

const compareExactNumerics = (
  left: ReturnType<typeof numericSignatures>,
  right: ReturnType<typeof numericSignatures>,
): AtomicComparison => {
  const leftRoleUnits = new Set(left.map((signature) =>
    `${signature.role}|${signature.unit}`,
  ));
  const rightRoleUnits = new Set(right.map((signature) =>
    `${signature.role}|${signature.unit}`,
  ));
  const sharedRoleUnits = new Set(
    [...leftRoleUnits].filter((roleUnit) => rightRoleUnits.has(roleUnit)),
  );
  const specificIdentityKeys = (
    signatures: ReturnType<typeof numericSignatures>,
  ) => new Set(
    signatures
      .filter((signature) =>
        signature.entity &&
        sharedRoleUnits.has(`${signature.role}|${signature.unit}`),
      )
      .map((signature) =>
        `${signature.entity}|${signature.role}|${signature.unit}`,
      ),
  );
  const leftIdentityKeys = specificIdentityKeys(left);
  const rightIdentityKeys = specificIdentityKeys(right);

  if (
    leftIdentityKeys.size > 0 &&
    rightIdentityKeys.size > 0 &&
    (
      leftIdentityKeys.size !== rightIdentityKeys.size ||
      [...leftIdentityKeys].some((key) => !rightIdentityKeys.has(key))
    )
  ) {
    return "conflict";
  }

  return compareValueSets(
    valuesByKey(left.map((signature) => ({
      key: `${signature.entity}|${signature.role}|${signature.unit}`,
      value: signature.value,
    }))),
    valuesByKey(right.map((signature) => ({
      key: `${signature.entity}|${signature.role}|${signature.unit}`,
      value: signature.value,
    }))),
  );
};

const metricEntitiesCompatible = (left: string, right: string): boolean => {
  return left === right;
};

const compareCnyNumerics = (
  left: ReturnType<typeof numericSignatures>,
  right: ReturnType<typeof numericSignatures>,
): AtomicComparison => {
  if (left.length === 0 || right.length === 0) return "none";
  if (left.length !== right.length) return "conflict";

  const leftRoles = new Set(left.map((signature) => signature.role));
  const rightRoles = new Set(right.map((signature) => signature.role));
  if (
    leftRoles.size !== rightRoles.size ||
    [...leftRoles].some((role) => !rightRoles.has(role))
  ) {
    return "conflict";
  }

  for (const role of leftRoles) {
    const leftGroup = left.filter((signature) => signature.role === role);
    const rightGroup = right.filter((signature) => signature.role === role);
    if (leftGroup.length !== rightGroup.length) return "conflict";

    const matchedLeftByRight = Array<number>(rightGroup.length).fill(-1);
    const assign = (leftIndex: number, seenRight: Set<number>): boolean => {
      for (let rightIndex = 0; rightIndex < rightGroup.length; rightIndex += 1) {
        if (seenRight.has(rightIndex)) continue;
        const leftSignature = leftGroup[leftIndex];
        const rightSignature = rightGroup[rightIndex];
        if (
          leftSignature.value !== rightSignature.value ||
          !metricEntitiesCompatible(
            leftSignature.entity,
            rightSignature.entity,
          )
        ) {
          continue;
        }

        seenRight.add(rightIndex);
        if (
          matchedLeftByRight[rightIndex] < 0 ||
          assign(matchedLeftByRight[rightIndex], seenRight)
        ) {
          matchedLeftByRight[rightIndex] = leftIndex;
          return true;
        }
      }
      return false;
    };

    if (
      leftGroup.some((_, leftIndex) => !assign(leftIndex, new Set<number>()))
    ) {
      return "conflict";
    }
  }

  return "compatible";
};

const compareNumerics = (
  left: ReturnType<typeof numericSignatures>,
  right: ReturnType<typeof numericSignatures>,
): AtomicComparison => {
  const comparisons = [
    compareCnyNumerics(
      left.filter((signature) => signature.unit === "CNY"),
      right.filter((signature) => signature.unit === "CNY"),
    ),
    compareExactNumerics(
      left.filter((signature) => signature.unit !== "CNY"),
      right.filter((signature) => signature.unit !== "CNY"),
    ),
  ];

  if (comparisons.includes("conflict")) return "conflict";
  return comparisons.includes("compatible") ? "compatible" : "none";
};

const calendarAtomsCompatible = (
  left: CalendarAtom,
  right: CalendarAtom,
): boolean => {
  if (
    left.action !== right.action ||
    left.objectTokens.length !== right.objectTokens.length ||
    left.objectTokens.some((token, index) => token !== right.objectTokens[index])
  ) {
    return false;
  }
  if (left.kind !== right.kind) return false;
  if (left.kind === "other") return left.value === right.value;

  const sharedFields: Array<keyof CalendarAtom> =
    left.kind === "date"
      ? ["year", "month", "day"]
      : ["hour", "minute"];

  return sharedFields.every((field) =>
    left[field] === undefined ||
    right[field] === undefined ||
    left[field] === right[field]
  );
};

const compareCalendar = (
  left: CalendarAtom[],
  right: CalendarAtom[],
): AtomicComparison => {
  if (left.length === 0 || right.length === 0) return "none";
  if (left.length !== right.length) return "conflict";

  return left.every((leftAtom, index) =>
      calendarAtomsCompatible(leftAtom, right[index])
    )
    ? "compatible"
    : "conflict";
};

const compareContrasts = (
  left: ReturnType<typeof contrastDirection>,
  right: ReturnType<typeof contrastDirection>,
): AtomicComparison => {
  if (!left || !right) return "none";

  const sameDirection =
    sourceRelevance(left.rejected, right.rejected) >= 0.55 &&
    sourceRelevance(left.asserted, right.asserted) >= 0.55;
  if (sameDirection) return "compatible";

  const reversedDirection =
    sourceRelevance(left.rejected, right.asserted) >= 0.55 &&
    sourceRelevance(left.asserted, right.rejected) >= 0.55;
  return reversedDirection ? "conflict" : "none";
};

const atomicFactSignatures = (text: string): AtomicFactSignatures => {
  const acquisition = acquisitionParties(text);

  return {
    directions: directionAtoms(text),
    supports: supportAtoms(text),
    acquisitions: acquisition ? [acquisition] : [],
    numerics: numericSignatures(text),
    calendar: calendarAtoms(text),
    contrast: contrastDirection(text),
  };
};

const compareAtomicFactSignatures = (
  left: AtomicFactSignatures,
  right: AtomicFactSignatures,
): AtomicComparison => {
  const comparisons = [
    comparePolarityAtoms(left.directions, right.directions),
    comparePolarityAtoms(left.supports, right.supports),
    compareAcquisitions(left.acquisitions, right.acquisitions),
    compareNumerics(left.numerics, right.numerics),
    compareCalendar(left.calendar, right.calendar),
    compareContrasts(left.contrast, right.contrast),
  ];

  if (comparisons.includes("conflict")) return "conflict";
  return comparisons.includes("compatible") ? "compatible" : "none";
};

const claimsMatch = (left: string, right: string): boolean => {
  const atomicComparison = compareAtomicFactSignatures(
    atomicFactSignatures(left),
    atomicFactSignatures(right),
  );
  if (atomicComparison === "conflict") return false;
  if (atomicComparison === "compatible") return true;

  return (
    sourceRelevance(left, right) >= 0.55 &&
    directionalClaimsMatch(left, right)
  );
};

const claimUnits = (text: string): string[] => {
  const units: string[] = [];
  let unitStart = 0;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (!/[。！？!?；;\n]/.test(character)) continue;

    const currentUnit = text.slice(unitStart, index + 1);
    const remainder = text.slice(index + 1);
    const continuesContrast =
      /(?:不是|并非)/.test(currentUnit) &&
      /^\s*而是/.test(remainder);
    if (continuesContrast) continue;

    const unit = currentUnit.trim();
    if (unit) units.push(unit);
    unitStart = index + 1;
  }

  const finalUnit = text.slice(unitStart).trim();
  if (finalUnit) units.push(finalUnit);

  return units;
};

const sourceExcerptMatchesBinding = (
  record: RuntimeEvidenceRecord,
  scene: Scene,
  binding: RuntimeAssetSceneBinding,
): boolean => {
  if (record.kind !== "source-excerpt") return true;
  if (!record.narrationClaim) return false;
  if (!binding.narrationClaim) return false;
  if (!claimsMatch(scene.subtitle, record.narrationClaim)) return false;
  if (!claimsMatch(scene.subtitle, binding.narrationClaim)) return false;

  return claimsMatch(binding.narrationClaim, record.narrationClaim);
};

const evidenceRecordBelongsToScene = (
  record: RuntimeEvidenceRecord,
  scene: Scene,
  binding: RuntimeAssetSceneBinding | undefined,
  boundAssets: RuntimeAsset[],
  allAssets: RuntimeAsset[],
): boolean => {
  if (!binding) return false;

  const evidenceAssets = boundAssets.filter(
    (asset) => asset.role === "evidence" && asset.type !== "ai-generated",
  );
  if (evidenceAssets.length === 0) return false;

  if (record.localPath) {
    const localPathMatch = evidenceAssets.some(
      (asset) => asset.localPath === record.localPath,
    );
    return localPathMatch && sourceExcerptMatchesBinding(record, scene, binding);
  }

  if (!record.sourceUrl) return false;

  const assetsAtSourceUrl = allAssets.filter(
    (asset) => asset.sourceUrl === record.sourceUrl,
  );
  if (assetsAtSourceUrl.length !== 1) return false;

  const uniqueSourceAsset = assetsAtSourceUrl[0];
  const sourceUrlMatch =
    uniqueSourceAsset.type !== "source-card" &&
    evidenceAssets.some((asset) => asset.id === uniqueSourceAsset.id);

  return sourceUrlMatch && sourceExcerptMatchesBinding(record, scene, binding);
};

export const buildSceneSemanticContext = (input: {
  scenes: Scene[];
  articleText?: string;
  assetManifest?: RuntimeAssetManifest;
  userAssetSourcesBySceneId?: Record<string, SemanticSourceRef[]>;
}): SceneSemanticContext => {
  const articleClaims = claimUnits(input.articleText ?? "");
  const evidenceRecords = input.assetManifest?.evidenceRecords ?? [];
  const allAssets = input.assetManifest?.assets ?? [];
  const assetsById = new Map(
    allAssets.map((asset) => [asset.id, asset]),
  );
  const bindingsBySceneId = new Map(
    (input.assetManifest?.sceneBindings ?? []).map((binding) => [
      binding.sceneId,
      binding,
    ]),
  );

  return {
    sourcesBySceneId: Object.fromEntries(
      input.scenes.map((scene) => {
        const binding = bindingsBySceneId.get(scene.id);
        const boundAssets = (binding?.assetIds ?? [])
          .map((assetId) => assetsById.get(assetId))
          .filter((asset): asset is RuntimeAsset => Boolean(asset));
        const articleMatch = articleClaims
          .map((text, index) => ({
            text,
            index,
            score: sourceRelevance(scene.subtitle, text),
          }))
          .filter((candidate) => claimsMatch(scene.subtitle, candidate.text))
          .sort((left, right) => right.score - left.score)[0];

        const recordSources: SemanticSourceRef[] = evidenceRecords
          .filter((record) =>
            evidenceRecordBelongsToScene(
              record,
              scene,
              binding,
              boundAssets,
              allAssets,
            ),
          )
          .flatMap((record) =>
            claimUnits(
              record.targetText ??
                record.narrationClaim ??
                record.text ??
                "",
            ).map((text) => ({ record, text })),
          )
          .filter(
            ({ text }) =>
              text.length > 0 && claimsMatch(scene.subtitle, text),
          )
          .map(({ record, text }) => ({
            kind: "evidence-record",
            referenceId: record.id,
            text,
            supportsFacts: true,
            matchedClaim: scene.subtitle,
          }));

        const conceptSources: SemanticSourceRef[] = boundAssets
          .filter((asset) => asset?.type === "ai-generated")
          .map((asset) => ({
            kind: "ai-concept",
            referenceId: asset!.id,
            text: asset!.metadata?.prompt ?? asset!.attribution,
            supportsFacts: false,
          }));

        const articleSources: SemanticSourceRef[] = articleMatch
          ? [{
              kind: "article",
              referenceId: `article-claim-${articleMatch.index + 1}`,
              text: articleMatch.text,
              supportsFacts: true,
              matchedClaim: scene.subtitle,
            }]
          : [];

        return [
          scene.id,
          [
            ...articleSources,
            ...recordSources,
            ...(input.userAssetSourcesBySceneId?.[scene.id] ?? []),
            ...conceptSources,
          ],
        ];
      }),
    ),
  };
};
