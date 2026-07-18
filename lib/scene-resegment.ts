import type { Scene, TimelineSegment } from "./types";

const MAX_SCENE_COUNT = 240;
const MAX_TIMELINE_SEGMENT_COUNT = 20_000;
const MAX_NATURAL_RESEGMENT_CANDIDATES = 512;
const EPSILON = 0.05;
const unsafeKeys = new Set(["__proto__", "prototype", "constructor"]);
const sceneLayouts = new Set([
  "title",
  "single-image",
  "split-image",
  "quote",
  "ending",
]);

class ResegmentInputError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSafeIdentifier = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0;

const assertDenseArray: (
  value: unknown,
  label: string,
  maximumLength: number,
) => asserts value is unknown[] = (value, label, maximumLength) => {
  if (!Array.isArray(value)) {
    throw new ResegmentInputError(`${label}输入无效：必须是数组`);
  }
  if (value.length > maximumLength) {
    throw new ResegmentInputError(
      `${label}输入无效：数量超过 ${maximumLength}`,
    );
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      throw new ResegmentInputError(`${label}输入无效：数组不得稀疏`);
    }
  }
};

const hasUnsafeOwnKey = (value: Record<string, unknown>): boolean =>
  Object.keys(value).some((key) => unsafeKeys.has(key));

const assertSafeRecord: (
  value: unknown,
  label: string,
) => asserts value is Record<string, unknown> = (value, label) => {
  if (!isRecord(value)) {
    throw new ResegmentInputError(`${label}输入无效：每项必须是对象`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    hasUnsafeOwnKey(value)
  ) {
    throw new ResegmentInputError(`${label}输入无效：包含恶意字段`);
  }
};

const assertScenes: (value: unknown) => asserts value is Scene[] = (value) => {
  assertDenseArray(value, "镜头", MAX_SCENE_COUNT);
  for (let index = 0; index < value.length; index += 1) {
    const current = value[index];
    const label = `镜头[${index}]`;
    assertSafeRecord(current, label);
    if (!isSafeIdentifier(current.id)) {
      throw new ResegmentInputError(`${label}.id 输入无效：必须是非空字符串`);
    }
    if (typeof current.subtitle !== "string") {
      throw new ResegmentInputError(`${label}.subtitle 输入无效：必须是字符串`);
    }
    if (
      typeof current.start !== "number" ||
      !Number.isFinite(current.start) ||
      current.start < 0
    ) {
      throw new ResegmentInputError(`${label}.start 输入无效：必须是非负有限数`);
    }
    if (
      typeof current.end !== "number" ||
      !Number.isFinite(current.end) ||
      current.end <= current.start
    ) {
      throw new ResegmentInputError(`${label}.end 输入无效：必须晚于 start`);
    }
    assertDenseArray(
      current.images,
      `${label}.images`,
      MAX_TIMELINE_SEGMENT_COUNT,
    );
    if (!current.images.every((item) => typeof item === "string")) {
      throw new ResegmentInputError(`${label}.images 输入无效：图片路径必须是字符串`);
    }
    if (
      typeof current.layout !== "string" ||
      !sceneLayouts.has(current.layout)
    ) {
      throw new ResegmentInputError(`${label}.layout 输入无效：未知布局`);
    }
    if (index > 0) {
      const previous = value[index - 1] as Scene;
      if (current.start < previous.end) {
        throw new ResegmentInputError(
          `${label}.start 输入无效：时间必须有序且不得与前一镜头重叠`,
        );
      }
    }
  }
};

const assertTimelineSegments: (
  value: unknown,
) => asserts value is TimelineSegment[] = (value) => {
  assertDenseArray(value, "TTS 时间轴", MAX_TIMELINE_SEGMENT_COUNT);
  for (let index = 0; index < value.length; index += 1) {
    const current = value[index];
    const label = `Timeline[${index}]`;
    assertSafeRecord(current, label);
    if (!isSafeIdentifier(current.id)) {
      throw new ResegmentInputError(`${label}.id 输入无效：必须是非空字符串`);
    }
    if (typeof current.text !== "string") {
      throw new ResegmentInputError(`${label}.text 输入无效：必须是字符串`);
    }
    if (
      typeof current.start !== "number" ||
      !Number.isFinite(current.start) ||
      current.start < 0
    ) {
      throw new ResegmentInputError(`${label}.start 输入无效：必须是非负有限数`);
    }
    if (
      typeof current.end !== "number" ||
      !Number.isFinite(current.end) ||
      current.end <= current.start
    ) {
      throw new ResegmentInputError(`${label}.end 输入无效：必须晚于 start`);
    }
    if (index > 0) {
      const previous = value[index - 1] as TimelineSegment;
      if (current.start < previous.end) {
        throw new ResegmentInputError(
          `${label}.start 输入无效：时间必须有序且不得与前一段重叠`,
        );
      }
    }
  }
};

const resegmentError = (error: unknown): never => {
  if (error instanceof ResegmentInputError) throw error;
  throw new ResegmentInputError(
    `重组输入无效：${
      error instanceof Error ? error.message : "无法安全读取运行时字段"
    }`,
  );
};

const dedupeImages = (images: string[]): string[] => [...new Set(images)];

const resetDirection = (scene: Scene): Scene => ({
  ...scene,
  semantics: undefined,
  directorType: undefined,
  rendererFamily: undefined,
  visualTreatment: undefined,
  directorContractIssues: undefined,
  content: undefined,
  components: undefined,
});

const renumberScenes = (scenes: Scene[]): Scene[] =>
  scenes.map((scene, index) => ({
    ...scene,
    id: `scene-${String(index + 1).padStart(4, "0")}`,
  }));

const isRhetoricalContinuation = (
  left: string,
  right: string,
): boolean => {
  const continuation = right.trimStart();
  return (
    (/核心不是|不是为了|不是要/.test(left) &&
      continuation.startsWith("而是")) ||
    (left.includes("训练是") && continuation.startsWith("推理是")) ||
    (left.includes("一条是") &&
      (continuation.startsWith("一条是") ||
        continuation.startsWith("另一条是")))
  );
};

const mergePair = (left: Scene, right: Scene): Scene =>
  resetDirection({
    ...left,
    id: `${left.id}+${right.id}`,
    end: right.end,
    subtitle: `${left.subtitle}${right.subtitle}`,
    images: dedupeImages([...left.images, ...right.images]),
  });

const collectSubtitleBoundaryIndexes = (
  text: string,
  pattern: RegExp,
): number[] => {
  const indexes: number[] = [];
  for (const match of text.matchAll(pattern)) {
    const index = (match.index ?? 0) + match[0].length;
    if (
      index > 0 &&
      index < text.length &&
      text.slice(0, index).length > 0 &&
      text.slice(index).length > 0
    ) {
      indexes.push(index);
    }
  }
  return [...new Set(indexes)];
};

const subtitleBoundaryIndexes = (text: string): number[] => {
  const sentenceBoundaries = collectSubtitleBoundaryIndexes(
    text,
    /[。！？!?；;]+[ \t]*(?:\r?\n[ \t]*)*/gu,
  );
  if (sentenceBoundaries.length > 0) return sentenceBoundaries;
  return collectSubtitleBoundaryIndexes(
    text,
    /[，,：:]+[ \t]*(?:\r?\n[ \t]*)*/gu,
  );
};

const recursiveSubtitleBoundaryIndexes = (text: string): number[] => [
  ...new Set([
    ...collectSubtitleBoundaryIndexes(
      text,
      /[。！？!?；;]+[ \t]*(?:\r?\n[ \t]*)*/gu,
    ),
    ...collectSubtitleBoundaryIndexes(
      text,
      /[，,：:]+[ \t]*(?:\r?\n[ \t]*)*/gu,
    ),
  ]),
];

const splitSubtitleAtBoundary = (
  text: string,
  boundaryIndex: number,
  segmentCount: number,
  indexes = subtitleBoundaryIndexes(text),
): [string, string] | null => {
  if (indexes.length === 0) return null;

  const unitCount = indexes.length + 1;
  const splitUnit = Math.max(
    1,
    Math.min(
      indexes.length,
      Math.round((unitCount * boundaryIndex) / segmentCount),
    ),
  );
  const splitIndex = indexes[splitUnit - 1];
  const left = text.slice(0, splitIndex);
  const right = text.slice(splitIndex);
  return left.length > 0 && right.length > 0 ? [left, right] : null;
};

type TimelineBoundary = {
  boundaryIndex: number;
  segmentCount: number;
  splitAt: number;
};

const timelineBoundariesInside = (
  scene: Scene,
  timelineSegments: TimelineSegment[],
): TimelineBoundary[] => {
  const inside = timelineSegments.filter(
    (segment) =>
      segment.start >= scene.start - EPSILON &&
      segment.end <= scene.end + EPSILON,
  );
  if (inside.length < 2) return [];

  const boundaries: TimelineBoundary[] = [];
  for (let index = 1; index < inside.length; index += 1) {
    boundaries.push({
      boundaryIndex: index,
      segmentCount: inside.length,
      splitAt: inside[index].start,
    });
  }
  return boundaries;
};

const splitOptionsForScene = (
  scene: Scene,
  timelineSegments: TimelineSegment[],
  maximumOptions = MAX_NATURAL_RESEGMENT_CANDIDATES,
): Array<{ boundary: TimelineBoundary; parts: [Scene, Scene] }> => {
  const parentDuration = scene.end - scene.start;
  const subtitleIndexes = subtitleBoundaryIndexes(scene.subtitle);
  if (subtitleIndexes.length === 0) return [];

  const options: Array<{
    boundary: TimelineBoundary;
    parts: [Scene, Scene];
  }> = [];
  for (const boundary of timelineBoundariesInside(
    scene,
    timelineSegments,
  )) {
    const leftDuration = boundary.splitAt - scene.start;
    const rightDuration = scene.end - boundary.splitAt;
    if (
      leftDuration < 1 ||
      rightDuration < 1 ||
      leftDuration >= parentDuration - EPSILON ||
      rightDuration >= parentDuration - EPSILON
    ) {
      continue;
    }

    const subtitleParts = splitSubtitleAtBoundary(
      scene.subtitle,
      boundary.boundaryIndex,
      boundary.segmentCount,
      subtitleIndexes,
    );
    if (!subtitleParts) continue;
    if (options.length >= maximumOptions) {
      throw new ResegmentInputError(
        `${scene.id} 的自然拆分候选超过安全上限 ${maximumOptions}`,
      );
    }

    options.push({
      boundary,
      parts: [
        resetDirection({
          ...scene,
          id: `${scene.id}-left-${boundary.splitAt}`,
          end: boundary.splitAt,
          subtitle: subtitleParts[0],
        }),
        resetDirection({
          ...scene,
          id: `${scene.id}-right-${boundary.splitAt}`,
          start: boundary.splitAt,
          subtitle: subtitleParts[1],
        }),
      ],
    });
  }
  return options;
};

export const mergeRhetoricalContinuations = (
  scenes: Scene[],
  minimumSceneCount: number,
): Scene[] => {
  try {
    assertScenes(scenes);
    if (
      !Number.isInteger(minimumSceneCount) ||
      minimumSceneCount < 0
    ) {
      throw new ResegmentInputError(
        "minimumSceneCount 输入无效：必须是非负整数",
      );
    }

    const result: Scene[] = [];
    let index = 0;
    while (index < scenes.length) {
      const left = scenes[index];
      const right = scenes[index + 1];
      const projectedCount =
        result.length + 1 + Math.max(0, scenes.length - index - 2);
      if (
        right !== undefined &&
        projectedCount >= minimumSceneCount &&
        Math.abs(right.start - left.end) <= EPSILON &&
        right.end - left.start < 10 &&
        isRhetoricalContinuation(left.subtitle, right.subtitle)
      ) {
        result.push(mergePair(left, right));
        index += 2;
      } else {
        result.push(resetDirection(left));
        index += 1;
      }
    }
    return renumberScenes(result);
  } catch (error) {
    return resegmentError(error);
  }
};

export const buildNaturalResegmentCandidates = (
  scenes: Scene[],
  timelineSegments: TimelineSegment[],
): Scene[][] => {
  try {
    assertScenes(scenes);
    assertTimelineSegments(timelineSegments);

    const candidates: Scene[][] = [];
    scenes.forEach((current, sceneIndex) => {
      for (const option of splitOptionsForScene(
        current,
        timelineSegments,
        MAX_NATURAL_RESEGMENT_CANDIDATES - candidates.length,
      )) {
        candidates.push(
          renumberScenes([
            ...scenes
              .slice(0, sceneIndex)
              .map((item) => resetDirection(item)),
            ...option.parts,
            ...scenes
              .slice(sceneIndex + 1)
              .map((item) => resetDirection(item)),
          ]),
        );
      }
    });
    return candidates;
  } catch (error) {
    return resegmentError(error);
  }
};

export const splitLongScenesAtTimelineBoundaries = (
  scenes: Scene[],
  timelineSegments: TimelineSegment[],
): Scene[] => {
  try {
    assertScenes(scenes);
    assertTimelineSegments(timelineSegments);
    const memo = new Map<string, Scene[] | null>();
    const solve = (current: Scene): Scene[] | null => {
      const currentDuration = current.end - current.start;
      if (currentDuration < 10) return [current];

      const key = `${current.start}\u0000${current.end}\u0000${current.subtitle}`;
      const cached = memo.get(key);
      if (cached !== undefined) return cached;

      const maximumLeafCount = Math.min(
        recursiveSubtitleBoundaryIndexes(current.subtitle).length + 1,
        timelineBoundariesInside(current, timelineSegments).length + 1,
      );
      if (currentDuration >= maximumLeafCount * 10) {
        memo.set(key, null);
        return null;
      }

      const options = splitOptionsForScene(current, timelineSegments)
        .sort((left, right) => {
          const leftMaximum = Math.max(
            ...left.parts.map((part) => part.end - part.start),
          );
          const rightMaximum = Math.max(
            ...right.parts.map((part) => part.end - part.start),
          );
          return (
            leftMaximum - rightMaximum ||
            left.boundary.splitAt - right.boundary.splitAt
          );
        });

      for (const option of options) {
        const left = solve(option.parts[0]);
        if (!left) continue;
        const right = solve(option.parts[1]);
        if (!right) continue;
        const solution = [...left, ...right];
        memo.set(key, solution);
        return solution;
      }

      memo.set(key, null);
      return null;
    };

    const result: Scene[] = [];
    for (const scene of scenes) {
      const reset = resetDirection(scene);
      const solution = solve(reset);
      if (!solution) {
        const timeBoundaries = timelineBoundariesInside(
          reset,
          timelineSegments,
        );
        const subtitleBoundaries = subtitleBoundaryIndexes(reset.subtitle);
        const detail =
          timeBoundaries.length === 0
            ? "没有完整包含的相邻服务商原生时间边界"
            : subtitleBoundaries.length === 0
              ? "字幕没有可保持原文的标点边界"
              : "所有完整拆分方案均无法让每个子镜头短于 10 秒";
        throw new ResegmentInputError(
          `${reset.id} 时长达到 ${(reset.end - reset.start).toFixed(2)} 秒，但没有可用且能缩短镜头的服务商原生时间边界：${detail}`,
        );
      }
      result.push(...solution);
    }

    return renumberScenes(result);
  } catch (error) {
    return resegmentError(error);
  }
};
