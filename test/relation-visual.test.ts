import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { Scene, SemanticSourceRef } from "@/lib/types";
import { buildSceneGraph } from "@/remotion/visual-library/scene-graph";
import { NodeGraph } from "@/remotion/visual-library/relation";

vi.mock("remotion", () => ({
  interpolate: (
    value: number,
    input: [number, number],
    output: [number, number],
  ) => {
    const progress = Math.max(
      0,
      Math.min(1, (value - input[0]) / Math.max(1, input[1] - input[0])),
    );
    return output[0] + (output[1] - output[0]) * progress;
  },
  useCurrentFrame: () => 30,
}));

const source: SemanticSourceRef = {
  kind: "article",
  text: "长焦镜头缩小视场，因此月亮在画面中占比更大。",
  supportsFacts: true,
};

const scene: Scene = {
  id: "scene-optics",
  start: 0,
  end: 4,
  subtitle: source.text,
  images: [],
  layout: "quote",
  semantics: {
    sceneId: "scene-optics",
    entities: ["长焦镜头", "视场", "月亮占比"],
    metrics: [],
    prices: [],
    timelineEvents: [],
    comparisons: [],
    relations: [
      {
        from: "长焦镜头",
        to: "视场",
        relation: "缩小",
        source,
      },
      {
        from: "视场",
        to: "月亮占比",
        relation: "放大画面占比",
        source,
      },
    ],
    orderedLayers: [],
    barriers: [],
    questions: [],
    signals: [],
    judgements: [],
    concepts: ["光学取景"],
    evidenceRefs: [],
    pauseMarkers: [],
    sources: [source],
    confidence: {
      metrics: 0,
      prices: 0,
      timelineEvents: 0,
      comparisons: 0,
      relations: 1,
      orderedLayers: 0,
      barriers: 0,
      questions: 0,
      signals: 0,
      judgements: 0,
      concepts: 1,
    },
  },
};

describe("semantic relation visuals", () => {
  test("builds the graph from actual scene relations instead of center spokes", () => {
    const graph = buildSceneGraph(scene, [
      { id: "fallback-0", label: "错误中心" },
      { id: "fallback-1", label: "错误分支" },
    ]);

    expect(graph.nodes.map((node) => node.label)).toEqual([
      "长焦镜头",
      "视场",
      "月亮占比",
    ]);
    expect(graph.edges).toEqual([
      {
        from: graph.nodes[0].id,
        to: graph.nodes[1].id,
        label: "缩小",
      },
      {
        from: graph.nodes[1].id,
        to: graph.nodes[2].id,
        label: "放大画面占比",
      },
    ]);
  });

  test("falls back to center spokes only when the scene has no relation semantics", () => {
    const fallbackNodes = [
      { id: "center", label: "中心" },
      { id: "left", label: "左侧" },
      { id: "right", label: "右侧" },
    ];
    const graph = buildSceneGraph({ ...scene, semantics: undefined }, fallbackNodes);

    expect(graph.nodes).toEqual(fallbackNodes);
    expect(graph.edges).toEqual([
      { from: "center", to: "left" },
      { from: "center", to: "right" },
    ]);
  });

  test("renders relation labels on their connecting lines", () => {
    const graph = buildSceneGraph(scene, []);
    const markup = renderToStaticMarkup(
      createElement(NodeGraph, { nodes: graph.nodes, edges: graph.edges }),
    );

    expect(markup).toContain("data-edge-label=\"缩小\"");
    expect(markup).toContain("data-edge-label=\"放大画面占比\"");
  });

  test("routes Remotion graph scenes through semantic graph data", async () => {
    const sourceText = await readFile(
      new URL("../remotion/Video.tsx", import.meta.url),
      "utf8",
    );

    expect(sourceText).toContain('from "./visual-library/scene-graph"');
    expect(sourceText).toContain("buildSceneGraph(scene,");
  });
});
