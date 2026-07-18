import type { DirectorSceneContent, Scene, SemanticSourceRef } from "./types";

export type FactualChartPoint = {
  label: string;
  value: number;
};

export type FactualCandlePoint = {
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

const parseNumericValue = (value: string): number | undefined => {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isFactSupported = (source?: SemanticSourceRef): boolean =>
  source?.supportsFacts === true;

export const factualChartPointsFromScene = (
  scene: Scene,
): FactualChartPoint[] => {
  const values = [
    ...(scene.semantics?.metrics ?? []),
    ...(scene.semantics?.prices ?? []),
  ];

  return values
    .filter((item) => isFactSupported(item.source))
    .map((item) => {
      const value = parseNumericValue(item.value);
      return value === undefined
        ? undefined
        : {
            label: item.label.slice(0, 12),
            value: Math.abs(value),
          };
    })
    .filter((item): item is FactualChartPoint => Boolean(item));
};

export const factualGaugeValueFromScene = (
  scene: Scene,
): number | undefined => {
  const percentage = (scene.semantics?.metrics ?? []).find(
    (item) =>
      isFactSupported(item.source) &&
      (item.unit === "%" || item.value.includes("%")),
  );
  if (!percentage) return undefined;
  const numeric = parseNumericValue(percentage.value);
  if (numeric === undefined) return undefined;
  return Math.max(0, Math.min(1, numeric / 100));
};

export const factualHeatmapPointsFromScene = (
  scene: Scene,
): FactualChartPoint[] =>
  (scene.semantics?.metrics ?? [])
    .filter(
      (item) =>
        isFactSupported(item.source) &&
        (item.unit === "%" || item.value.includes("%")),
    )
    .map((item) => {
      const value = parseNumericValue(item.value);
      return value === undefined
        ? undefined
        : {
            label: item.label.slice(0, 12),
            value,
          };
    })
    .filter((item): item is FactualChartPoint => Boolean(item));

const isValidCandle = (
  candle: NonNullable<DirectorSceneContent["marketSeries"]>[number],
): boolean =>
  isFactSupported(candle.source) &&
  [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) &&
  candle.high >= Math.max(candle.open, candle.close) &&
  candle.low <= Math.min(candle.open, candle.close) &&
  candle.high >= candle.low;

export const factualCandlesFromScene = (
  scene: Scene,
): FactualCandlePoint[] =>
  (scene.content?.marketSeries ?? [])
    .filter(isValidCandle)
    .map(({ source: _source, ...candle }) => candle);
