import { directorCapabilities } from "./director-capabilities";
import { deriveDirectorComponents } from "./director-components";
import { buildDirectorContent } from "./director-content";
import { validateDirectorContract } from "./director-contract";
import { extractSceneSemantics } from "./scene-semantics";
import type {
  DirectorCandidate,
  DirectorQualityTargets,
  DirectorRendererFamily,
  DirectorSceneContent,
  DirectorSceneType,
  DirectorVisualTreatment,
  Scene,
  SceneSemanticContext,
  SceneSemantics,
} from "./types";

const semanticPriority: DirectorSceneType[] = [
  "QuestionPause",
  "BarrierWall",
  "DependencyMap",
  "SystemStack",
  "IndustrySignal",
  "CompetitionLayerStack",
  "FinalJudgement",
  "Pricing",
  "DataExplosion",
  "FinancialMeter",
  "Contrast",
  "Timeline",
  "EvidenceHero",
  "KeywordInvestigation",
  "EvidenceReturn",
  "SpecSheet",
  "SystemMap",
  "Hero",
  "Summary",
  "Pause",
];

const sceneLayouts = new Set([
  "title",
  "single-image",
  "split-image",
  "quote",
  "ending",
]);
const rendererFamilies = new Set(
  Object.values(directorCapabilities).map(
    (capability) => capability.rendererFamily,
  ),
);
const visualTreatments = new Set(
  Object.values(directorCapabilities).flatMap(
    (capability) => capability.allowedTreatments,
  ),
);
const unsafeRecordKeys = new Set(["__proto__", "prototype", "constructor"]);
// At the production density floor this still covers roughly 40 minutes.
export const MAX_DIRECTOR_SCENE_COUNT = 240;
const DEFAULT_MAX_SEARCH_STATES = 1_000_000;
const DEFAULT_MAX_SEARCH_MILLISECONDS = 2_500;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDenseArray = (value: unknown): boolean => {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
};

const isMeaningfulText = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  /[\p{L}\p{N}]/u.test(value.normalize("NFKC"));

const isSceneSemanticsLike = (
  value: unknown,
): value is SceneSemantics => {
  if (!isRecord(value) || !isMeaningfulText(value.sceneId)) return false;
  for (const field of [
    "entities",
    "metrics",
    "prices",
    "timelineEvents",
    "comparisons",
    "relations",
    "orderedLayers",
    "barriers",
    "questions",
    "signals",
    "judgements",
    "concepts",
    "evidenceRefs",
    "pauseMarkers",
    "sources",
  ]) {
    if (!isDenseArray(value[field])) return false;
  }
  return isRecord(value.confidence);
};

const isKnownDirectorType = (
  value: unknown,
): value is DirectorSceneType =>
  typeof value === "string" &&
  Object.prototype.hasOwnProperty.call(directorCapabilities, value);

const isValidRuntimeScene = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (
    !isMeaningfulText(value.id) ||
    unsafeRecordKeys.has(value.id) ||
    !isMeaningfulText(value.subtitle) ||
    typeof value.start !== "number" ||
    typeof value.end !== "number" ||
    !Number.isFinite(value.start) ||
    !Number.isFinite(value.end) ||
    value.start < 0 ||
    value.end <= value.start ||
    value.end - value.start >= 10 ||
    !Array.isArray(value.images) ||
    !isDenseArray(value.images) ||
    !value.images.every((item) => typeof item === "string") ||
    typeof value.layout !== "string" ||
    !sceneLayouts.has(value.layout)
  ) {
    return false;
  }
  if (
    value.directorType !== undefined &&
    !isKnownDirectorType(value.directorType)
  ) {
    return false;
  }
  if (
    value.rendererFamily !== undefined &&
    (typeof value.rendererFamily !== "string" ||
      !rendererFamilies.has(value.rendererFamily as DirectorRendererFamily))
  ) {
    return false;
  }
  if (
    value.visualTreatment !== undefined &&
    (typeof value.visualTreatment !== "string" ||
      !visualTreatments.has(
        value.visualTreatment as DirectorVisualTreatment,
      ))
  ) {
    return false;
  }
  return true;
};

export const buildDirectorCandidates = (
  scene: Scene,
  semantics: SceneSemantics,
  sceneIndex: number,
  sceneCount: number,
): DirectorCandidate[] => {
  if (
    !isValidRuntimeScene(scene) ||
    !isSceneSemanticsLike(semantics) ||
    semantics.sceneId !== scene.id ||
    !Number.isInteger(sceneIndex) ||
    !Number.isInteger(sceneCount) ||
    sceneCount <= 0 ||
    sceneIndex < 0 ||
    sceneIndex >= sceneCount
  ) {
    return [];
  }

  return semanticPriority.flatMap((type, priorityIndex) => {
    const capability = directorCapabilities[type];
    try {
      if (!capability.isCompatible(semantics, sceneIndex, sceneCount)) {
        return [];
      }
    } catch {
      return [];
    }

    return capability.allowedTreatments.map(
      (visualTreatment, treatmentIndex) => ({
        type,
        rendererFamily: capability.rendererFamily,
        visualTreatment,
        semanticScore: semanticPriority.length - priorityIndex,
        narrativeScore:
          (type === "Hero" && sceneIndex === 0 ? 10 : 0) +
          (type === "Summary" && sceneIndex === sceneCount - 1 ? 10 : 0) -
          treatmentIndex,
        evidence: semantics.sources
          .filter(
            (item) =>
              isRecord(item) &&
              item.supportsFacts === true &&
              item.kind !== "ai-concept" &&
              typeof item.text === "string",
          )
          .map((item) =>
            typeof item.referenceId === "string"
              ? item.referenceId
              : item.text,
          ),
      }),
    );
  });
};

export type DirectorSelectionDiagnostics = {
  preferredForms: number;
  minimumForms: number;
  reachableForms: number;
  preferredFamilies: number;
  minimumFamilies: number;
  reachableFamilies: number;
  constrainedScenes: Array<{
    sceneId: string;
    legalForms: string[];
  }>;
  searchBudget?: {
    status: "BUDGET_EXHAUSTED";
    targetForms: number;
    targetFamilies: number;
    visitedStates: number;
    maxStates: number;
    elapsedMilliseconds: number;
    maxMilliseconds: number;
  };
};

export type DirectorSelectionOptions = {
  maxSearchStates?: number;
  maxSearchMilliseconds?: number;
};

export type DirectorSelectionResult =
  | {
      ok: true;
      scenes: Scene[];
      errors: [];
      targets: DirectorQualityTargets;
    }
  | {
      ok: false;
      scenes: [];
      errors: string[];
      diagnostics: DirectorSelectionDiagnostics;
    };

export const buildDirectorQualityBounds = (sceneCount: number) => {
  const count =
    Number.isFinite(sceneCount) && sceneCount > 0
      ? Math.floor(sceneCount)
      : 0;
  const preferredForms = Math.floor(count / 2) + (count > 0 ? 1 : 0);
  return {
    preferredForms,
    minimumForms: Math.min(
      preferredForms,
      count,
      Math.max(Math.min(3, count), Math.ceil(count * 0.4)),
    ),
    preferredFamilies: Math.min(3, count),
    minimumFamilies: Math.min(2, count),
  };
};

const visualForm = (candidate: DirectorCandidate): string =>
  `${candidate.rendererFamily}:${candidate.visualTreatment}`;

const visualStructure = (
  candidate: Pick<DirectorCandidate, "rendererFamily"> & {
    components: string[];
  },
): string =>
  `${candidate.rendererFamily}:${[
    ...new Set(candidate.components),
  ].sort().join(",")}`;

type LegalCandidate = DirectorCandidate & {
  content: DirectorSceneContent;
  components: string[];
  formIndex: number;
  familyIndex: number;
  structureIndex: number;
};

const bitCount = (value: bigint): number => {
  let remaining = value;
  let count = 0;
  while (remaining > 0n) {
    remaining &= remaining - 1n;
    count += 1;
  }
  return count;
};

export const buildDirectorSearchStateKey = (
  index: number,
  previousFormIndex: number,
  usedForms: bigint,
  usedFamilies: bigint,
  requiredForms: number,
  requiredFamilies: number,
  formUniverseSize: number,
  familyUniverseSize: number,
  previousStructureIndex = -1,
  penultimateStructureIndex = -1,
  structureUniverseSize = 0,
): bigint => {
  const formState =
    bitCount(usedForms) >= requiredForms
      ? 1n << BigInt(formUniverseSize)
      : usedForms;
  const familyState =
    bitCount(usedFamilies) >= requiredFamilies
      ? 1n << BigInt(familyUniverseSize)
      : usedFamilies;
  let key =
    BigInt(index) * BigInt(formUniverseSize + 1) +
    BigInt(previousFormIndex + 1);
  key =
    (key << BigInt(formUniverseSize + 1)) |
    formState;
  key =
    (key << BigInt(familyUniverseSize + 1)) |
    familyState;
  if (structureUniverseSize > 0) {
    const structureBase = BigInt(structureUniverseSize + 1);
    key =
      key * structureBase +
      BigInt(previousStructureIndex + 1);
    key =
      key * structureBase +
      BigInt(penultimateStructureIndex + 1);
  }
  return key;
};

const invalidSelection = (
  sceneCount: number,
  errors: string[],
  constrainedScenes: DirectorSelectionDiagnostics["constrainedScenes"] = [],
): DirectorSelectionResult => {
  const bounds = buildDirectorQualityBounds(sceneCount);
  return {
    ok: false,
    scenes: [],
    errors,
    diagnostics: {
      ...bounds,
      reachableForms: 0,
      reachableFamilies: 0,
      constrainedScenes,
    },
  };
};

export const selectDirectorPlan = (
  scenes: Scene[],
  context: SceneSemanticContext = { sourcesBySceneId: {} },
  options: DirectorSelectionOptions = {},
): DirectorSelectionResult => {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return invalidSelection(0, ["导演选择至少需要一个有效镜头"]);
  }
  if (scenes.length > MAX_DIRECTOR_SCENE_COUNT) {
    return invalidSelection(scenes.length, [
      `镜头数量超过上限：最多支持 ${MAX_DIRECTOR_SCENE_COUNT} 个镜头，当前为 ${scenes.length} 个`,
    ]);
  }
  if (!isDenseArray(scenes)) {
    return invalidSelection(
      scenes.length,
      ["Scene[] 是稀疏数组，镜头索引必须连续且每项都存在"],
    );
  }
  if (!scenes.every(isValidRuntimeScene)) {
    return invalidSelection(
      scenes.length,
      ["镜头输入包含未知字段值、非有限时间或无效时长"],
    );
  }

  const ids = scenes.map((scene) => scene.id);
  if (new Set(ids).size !== ids.length) {
    return invalidSelection(
      scenes.length,
      ["镜头 ID 必须唯一，检测到重复 scene id"],
      ids.map((sceneId) => ({ sceneId, legalForms: [] })),
    );
  }
  let minimumStart = Number.POSITIVE_INFINITY;
  let maximumEnd = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < scenes.length; index += 1) {
    const current = scenes[index];
    minimumStart = Math.min(minimumStart, current.start);
    maximumEnd = Math.max(maximumEnd, current.end);
    if (
      index > 0 &&
      current.start < scenes[index - 1].end
    ) {
      return invalidSelection(
        scenes.length,
        [
          `镜头时间轴必须按顺序且不得重叠：${current.id} 从 ${current.start} 秒开始，早于上一镜头 ${scenes[index - 1].id} 的 ${scenes[index - 1].end} 秒结束时间`,
        ],
      );
    }
  }

  const totalDuration = maximumEnd - minimumStart;
  const minimumSceneCount =
    totalDuration > 0
      ? Math.max(1, Math.floor(totalDuration / 10) + 1)
      : 1;
  if (scenes.length < minimumSceneCount) {
    return invalidSelection(
      scenes.length,
      [
        `镜头密度不足：${Math.round(totalDuration)} 秒视频至少需要 ${minimumSceneCount} 个镜头，当前只有 ${scenes.length} 个`,
      ],
    );
  }
  if (
    !isRecord(context) ||
    !isRecord(context.sourcesBySceneId)
  ) {
    return invalidSelection(scenes.length, ["语义上下文结构无效"]);
  }
  if (
    !isRecord(options) ||
    (options.maxSearchStates !== undefined &&
      (!Number.isInteger(options.maxSearchStates) ||
        options.maxSearchStates <= 0)) ||
    (options.maxSearchMilliseconds !== undefined &&
      (!Number.isFinite(options.maxSearchMilliseconds) ||
        options.maxSearchMilliseconds <= 0))
  ) {
    return invalidSelection(scenes.length, ["导演搜索预算配置无效"]);
  }

  let semantics: SceneSemantics[];
  try {
    semantics = scenes.map((scene) =>
      extractSceneSemantics(scene, context),
    );
  } catch (error) {
    return invalidSelection(scenes.length, [
      `语义提取失败：${error instanceof Error ? error.message : String(error)}`,
    ]);
  }
  if (
    semantics.some(
      (item, index) =>
        !isSceneSemanticsLike(item) || item.sceneId !== scenes[index].id,
    )
  ) {
    return invalidSelection(scenes.length, ["语义提取结果结构无效"]);
  }

  const rawCandidateSets = scenes.map((scene, index) => {
    const seenForms = new Set<string>();
    return buildDirectorCandidates(
      scene,
      semantics[index],
      index,
      scenes.length,
    ).flatMap((candidate) => {
      const form = visualForm(candidate);
      if (seenForms.has(form)) return [];

      try {
        const content = buildDirectorContent(
          scene,
          semantics[index],
          candidate.type,
        );
        const components = deriveDirectorComponents(
          candidate.type,
          content,
          candidate.visualTreatment,
        );
        const contract = validateDirectorContract({
          scene: {
            ...scene,
            rendererFamily: candidate.rendererFamily,
            visualTreatment: candidate.visualTreatment,
          },
          semantics: semantics[index],
          directorType: candidate.type,
          content,
          components,
          sceneIndex: index,
          sceneCount: scenes.length,
        });
        if (!contract.passed) return [];
        seenForms.add(form);
        return [{ ...candidate, content, components }];
      } catch {
        return [];
      }
    });
  });

  const allForms = [
    ...new Set(rawCandidateSets.flatMap((set) => set.map(visualForm))),
  ];
  const allFamilies = [
    ...new Set(
      rawCandidateSets.flatMap((set) =>
        set.map((candidate) => candidate.rendererFamily),
      ),
    ),
  ];
  const formIndexes = new Map(
    allForms.map((form, index) => [form, index]),
  );
  const familyIndexes = new Map(
    allFamilies.map((family, index) => [family, index]),
  );
  const allStructures = [
    ...new Set(
      rawCandidateSets.flatMap((set) =>
        set.map((candidate) => visualStructure(candidate)),
      ),
    ),
  ];
  const structureIndexes = new Map(
    allStructures.map((structure, index) => [structure, index]),
  );
  const candidateSets: LegalCandidate[][] = rawCandidateSets.map((set) =>
    set.map((candidate) => ({
      ...candidate,
      formIndex: formIndexes.get(visualForm(candidate))!,
      familyIndex: familyIndexes.get(candidate.rendererFamily)!,
      structureIndex: structureIndexes.get(visualStructure(candidate))!,
    })),
  );

  const suffixFormMasks = Array<bigint>(scenes.length + 1).fill(0n);
  const suffixFamilyMasks = Array<bigint>(scenes.length + 1).fill(0n);
  const suffixSemanticUpperBounds = Array<number>(scenes.length + 1).fill(0);
  const suffixNarrativeUpperBounds = Array<number>(scenes.length + 1).fill(0);
  for (let index = scenes.length - 1; index >= 0; index -= 1) {
    suffixFormMasks[index] = candidateSets[index].reduce(
      (mask, candidate) => mask | (1n << BigInt(candidate.formIndex)),
      suffixFormMasks[index + 1],
    );
    suffixFamilyMasks[index] = candidateSets[index].reduce(
      (mask, candidate) => mask | (1n << BigInt(candidate.familyIndex)),
      suffixFamilyMasks[index + 1],
    );
    suffixSemanticUpperBounds[index] =
      Math.max(...candidateSets[index].map((item) => item.semanticScore), 0) +
      suffixSemanticUpperBounds[index + 1];
    suffixNarrativeUpperBounds[index] =
      Math.max(...candidateSets[index].map((item) => item.narrativeScore), 0) +
      suffixNarrativeUpperBounds[index + 1];
  }

  type FoundMemoEntry = {
    status: "FOUND";
    semanticScore: number;
    narrativeScore: number;
    choiceIndex: number;
  };
  type MemoEntry =
    | FoundMemoEntry
    | { status: "PROVEN_UNREACHABLE" };
  type SearchOutcome =
    | { status: "FOUND"; candidates: LegalCandidate[] }
    | { status: "PROVEN_UNREACHABLE" }
    | { status: "BUDGET_EXHAUSTED" };

  const maxSearchStates =
    options.maxSearchStates ?? DEFAULT_MAX_SEARCH_STATES;
  const maxSearchMilliseconds =
    options.maxSearchMilliseconds ?? DEFAULT_MAX_SEARCH_MILLISECONDS;
  const searchStartedAt = Date.now();
  const searchDeadline = searchStartedAt + maxSearchMilliseconds;
  const firstFeasibleOnly = scenes.length >= 15;
  let visitedStates = 0;
  const searchCache = new Map<string, SearchOutcome>();
  const provenUnreachable = {
    status: "PROVEN_UNREACHABLE",
  } as const;
  const budgetExhausted = {
    status: "BUDGET_EXHAUSTED",
  } as const;

  const search = (
    requiredForms: number,
    requiredFamilies: number,
  ): SearchOutcome => {
    const cacheKey = `${requiredForms}:${requiredFamilies}`;
    const cached = searchCache.get(cacheKey);
    if (cached) return cached;
    if (
      requiredForms < 1 ||
      requiredFamilies < 1 ||
      candidateSets.some((set) => set.length === 0)
    ) {
      searchCache.set(cacheKey, provenUnreachable);
      return provenUnreachable;
    }

    const memo = new Map<bigint, MemoEntry>();
    const visit = (
      index: number,
      previousFormIndex: number,
      usedForms: bigint,
      usedFamilies: bigint,
      previousStructureIndex: number,
      penultimateStructureIndex: number,
    ): MemoEntry | typeof budgetExhausted => {
      if (Date.now() >= searchDeadline) return budgetExhausted;

      const usedFormCount = bitCount(usedForms);
      const usedFamilyCount = bitCount(usedFamilies);
      if (index === scenes.length) {
        return usedFormCount >= requiredForms &&
          usedFamilyCount >= requiredFamilies
          ? {
              status: "FOUND",
              semanticScore: 0,
              narrativeScore: 0,
              choiceIndex: -1,
            }
          : provenUnreachable;
      }

      const remainingSceneCount = scenes.length - index;
      if (
        Math.min(
          usedFormCount + remainingSceneCount,
          bitCount(usedForms | suffixFormMasks[index]),
        ) < requiredForms ||
        Math.min(
          usedFamilyCount + remainingSceneCount,
          bitCount(usedFamilies | suffixFamilyMasks[index]),
        ) < requiredFamilies
      ) {
        return provenUnreachable;
      }

      const stateKey = buildDirectorSearchStateKey(
        index,
        previousFormIndex,
        usedForms,
        usedFamilies,
        requiredForms,
        requiredFamilies,
        allForms.length,
        allFamilies.length,
        previousStructureIndex,
        penultimateStructureIndex,
        allStructures.length,
      );
      const cachedState = memo.get(stateKey);
      if (cachedState) return cachedState;
      if (visitedStates >= maxSearchStates) return budgetExhausted;
      visitedStates += 1;

      let best: FoundMemoEntry | null = null;
      for (
        let choiceIndex = 0;
        choiceIndex < candidateSets[index].length;
        choiceIndex += 1
      ) {
        const candidate = candidateSets[index][choiceIndex];
        if (candidate.formIndex === previousFormIndex) continue;
        if (
          candidate.structureIndex === previousStructureIndex &&
          candidate.structureIndex === penultimateStructureIndex
        ) {
          continue;
        }
        const semanticUpperBound =
          candidate.semanticScore + suffixSemanticUpperBounds[index + 1];
        const narrativeUpperBound =
          candidate.narrativeScore + suffixNarrativeUpperBounds[index + 1];
        if (
          best &&
          (semanticUpperBound < best.semanticScore ||
            (semanticUpperBound === best.semanticScore &&
              narrativeUpperBound < best.narrativeScore))
        ) {
          continue;
        }

        const suffix = visit(
          index + 1,
          candidate.formIndex,
          usedForms | (1n << BigInt(candidate.formIndex)),
          usedFamilies | (1n << BigInt(candidate.familyIndex)),
          candidate.structureIndex,
          previousStructureIndex,
        );
        if (suffix.status === "BUDGET_EXHAUSTED") return suffix;
        if (suffix.status === "PROVEN_UNREACHABLE") continue;

        const semanticScore =
          candidate.semanticScore + suffix.semanticScore;
        const narrativeScore =
          candidate.narrativeScore + suffix.narrativeScore;
        if (
          !best ||
          semanticScore > best.semanticScore ||
          (semanticScore === best.semanticScore &&
            narrativeScore > best.narrativeScore)
        ) {
          best = {
            status: "FOUND",
            semanticScore,
            narrativeScore,
            choiceIndex,
          };
          if (
            firstFeasibleOnly ||
            best.semanticScore === suffixSemanticUpperBounds[index] &&
            best.narrativeScore === suffixNarrativeUpperBounds[index]
          ) {
            break;
          }
        }
      }

      const result = best ?? provenUnreachable;
      memo.set(stateKey, result);
      return result;
    };

    const root = visit(0, -1, 0n, 0n, -1, -1);
    if (root.status === "BUDGET_EXHAUSTED") return budgetExhausted;
    if (root.status === "PROVEN_UNREACHABLE") {
      searchCache.set(cacheKey, provenUnreachable);
      return provenUnreachable;
    }

    const candidates: LegalCandidate[] = [];
    let entry = root;
    let previousFormIndex = -1;
    let usedForms = 0n;
    let usedFamilies = 0n;
    let previousStructureIndex = -1;
    let penultimateStructureIndex = -1;
    for (let index = 0; index < scenes.length; index += 1) {
      const candidate = candidateSets[index][entry.choiceIndex];
      candidates.push(candidate);
      previousFormIndex = candidate.formIndex;
      usedForms |= 1n << BigInt(candidate.formIndex);
      usedFamilies |= 1n << BigInt(candidate.familyIndex);
      penultimateStructureIndex = previousStructureIndex;
      previousStructureIndex = candidate.structureIndex;
      if (index === scenes.length - 1) break;

      const nextKey = buildDirectorSearchStateKey(
        index + 1,
        previousFormIndex,
        usedForms,
        usedFamilies,
        requiredForms,
        requiredFamilies,
        allForms.length,
        allFamilies.length,
        previousStructureIndex,
        penultimateStructureIndex,
        allStructures.length,
      );
      const nextEntry = memo.get(nextKey);
      if (!nextEntry || nextEntry.status !== "FOUND") {
        return budgetExhausted;
      }
      entry = nextEntry;
    }

    const outcome = { status: "FOUND", candidates } as const;
    searchCache.set(cacheKey, outcome);
    return outcome;
  };

  const bounds = buildDirectorQualityBounds(scenes.length);
  let selected: LegalCandidate[] | null = null;
  let requiredForms = 0;
  let requiredFamilies = 0;
  const legalFormsByScene = scenes.map((scene, index) => ({
    sceneId: scene.id,
    legalForms: [...new Set(candidateSets[index].map(visualForm))],
  }));
  const constrainedScenes = (): DirectorSelectionDiagnostics["constrainedScenes"] => {
    const smallestCandidateCount = Math.min(
      ...legalFormsByScene.map((item) => item.legalForms.length),
    );
    return legalFormsByScene.filter(
      (item) =>
        item.legalForms.length === smallestCandidateCount ||
        item.legalForms.length <= 2,
    );
  };
  const budgetFailure = (
    targetForms: number,
    targetFamilies: number,
  ): DirectorSelectionResult => ({
    ok: false,
    scenes: [],
    errors: [
      `导演搜索预算耗尽：未证明 ${targetForms} 种视觉形式、${targetFamilies} 个渲染家族不可达，因此未降低质量目标`,
    ],
    diagnostics: {
      ...bounds,
      reachableForms: 0,
      reachableFamilies: 0,
      constrainedScenes: constrainedScenes(),
      searchBudget: {
        status: "BUDGET_EXHAUSTED",
        targetForms,
        targetFamilies,
        visitedStates,
        maxStates: maxSearchStates,
        elapsedMilliseconds: Date.now() - searchStartedAt,
        maxMilliseconds: maxSearchMilliseconds,
      },
    },
  });

  for (
    let formTarget = bounds.preferredForms;
    formTarget >= bounds.minimumForms && !selected;
    formTarget -= 1
  ) {
    for (
      let familyTarget = bounds.preferredFamilies;
      familyTarget >= bounds.minimumFamilies;
      familyTarget -= 1
    ) {
      const result = search(formTarget, familyTarget);
      if (result.status === "BUDGET_EXHAUSTED") {
        return budgetFailure(formTarget, familyTarget);
      }
      if (result.status === "PROVEN_UNREACHABLE") continue;
      selected = result.candidates;
      requiredForms = formTarget;
      requiredFamilies = familyTarget;
      break;
    }
  }

  if (!selected) {
    let reachableForms = 0;
    let reachableFamilies = 0;
    for (
      let target = Math.min(allForms.length, scenes.length);
      target >= 1;
      target -= 1
    ) {
      const result = search(target, 1);
      if (result.status === "BUDGET_EXHAUSTED") {
        return budgetFailure(target, 1);
      }
      if (result.status === "PROVEN_UNREACHABLE") continue;
      reachableForms = target;
      break;
    }
    for (
      let target = Math.min(allFamilies.length, scenes.length);
      target >= 1;
      target -= 1
    ) {
      const result = search(1, target);
      if (result.status === "BUDGET_EXHAUSTED") {
        return budgetFailure(1, target);
      }
      if (result.status === "PROVEN_UNREACHABLE") continue;
      reachableFamilies = target;
      break;
    }

    return {
      ok: false,
      scenes: [],
      errors: [
        `严格语义下的可达视觉形式不足：首选 ${bounds.preferredForms} 种，质量底线 ${bounds.minimumForms} 种，当前最多可达 ${reachableForms} 种；渲染家族首选 ${bounds.preferredFamilies} 个，底线 ${bounds.minimumFamilies} 个，当前最多可达 ${reachableFamilies} 个`,
      ],
      diagnostics: {
        ...bounds,
        reachableForms,
        reachableFamilies,
        constrainedScenes: constrainedScenes(),
      },
    };
  }

  return {
    ok: true,
    errors: [],
    targets: {
      ...bounds,
      requiredForms,
      requiredFamilies,
    },
    scenes: scenes.map((scene, index) => {
      const candidate = selected[index];
      return {
        ...scene,
        semantics: semantics[index],
        directorType: candidate.type,
        rendererFamily: candidate.rendererFamily,
        visualTreatment: candidate.visualTreatment,
        content: candidate.content,
        components: candidate.components,
      };
    }),
  };
};
