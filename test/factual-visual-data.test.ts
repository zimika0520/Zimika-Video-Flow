import { describe, expect, test } from "vitest";
import {
  factualCandlesFromScene,
  factualChartPointsFromScene,
  factualGaugeValueFromScene,
  factualHeatmapPointsFromScene,
} from "@/lib/factual-visual-data";
import type { Scene, SemanticSourceRef } from "@/lib/types";

const source: SemanticSourceRef = {
  kind: "article",
  text: "收入增长 20%，风险比例为 35%。",
  supportsFacts: true,
};

const scene: Scene = {
  id: "scene-1",
  start: 0,
  end: 4,
  subtitle: "收入增长 20%，风险比例为 35%。",
  images: [],
  layout: "quote",
  semantics: {
    sceneId: "scene-1",
    entities: [],
    metrics: [
      { label: "收入增长", value: "20%", unit: "%", source },
      { label: "风险比例", value: "35%", unit: "%", source },
    ],
    prices: [],
    timelineEvents: [],
    comparisons: [],
    relations: [],
    orderedLayers: [],
    barriers: [],
    questions: [],
    signals: [],
    judgements: [],
    concepts: ["增长", "风险"],
    evidenceRefs: [],
    pauseMarkers: [],
    sources: [source],
    confidence: {
      metrics: 1,
      prices: 0,
      timelineEvents: 0,
      comparisons: 0,
      relations: 0,
      orderedLayers: 0,
      barriers: 0,
      questions: 0,
      signals: 0,
      judgements: 0,
      concepts: 1,
    },
  },
};

describe("factual visual data", () => {
  test("uses only explicit fact-supported numeric values for charts", () => {
    expect(factualChartPointsFromScene(scene)).toEqual([
      { label: "收入增长", value: 20 },
      { label: "风险比例", value: 35 },
    ]);
    expect(
      factualChartPointsFromScene({
        ...scene,
        semantics: {
          ...scene.semantics!,
          metrics: [],
          concepts: ["增长", "风险", "机会"],
        },
      }),
    ).toEqual([]);
  });

  test("derives a gauge only from an explicit supported percentage", () => {
    expect(factualGaugeValueFromScene(scene)).toBeCloseTo(0.2);
    expect(factualGaugeValueFromScene({ ...scene, semantics: undefined })).toBeUndefined();
  });

  test("preserves the sign of sourced percentage values for heatmaps", () => {
    expect(
      factualHeatmapPointsFromScene({
        ...scene,
        semantics: {
          ...scene.semantics!,
          metrics: [
            { label: "上涨板块", value: "+12%", unit: "%", source },
            { label: "下跌板块", value: "-8%", unit: "%", source },
            { label: "成交额", value: "200", unit: "亿元", source },
          ],
        },
      }),
    ).toEqual([
      { label: "上涨板块", value: 12 },
      { label: "下跌板块", value: -8 },
    ]);
  });

  test("does not synthesize K-line candles when no sourced OHLC series exists", () => {
    expect(factualCandlesFromScene(scene)).toEqual([]);
  });

  test("accepts only sourced and internally valid OHLC rows", () => {
    const withMarketSeries: Scene = {
      ...scene,
      content: {
        marketSeries: [
          {
            label: "Day 1",
            open: 10,
            high: 13,
            low: 9,
            close: 12,
            volume: 100,
            source,
          },
        ],
      },
    };

    expect(factualCandlesFromScene(withMarketSeries)).toEqual([
      {
        label: "Day 1",
        open: 10,
        high: 13,
        low: 9,
        close: 12,
        volume: 100,
      },
    ]);
  });
});
