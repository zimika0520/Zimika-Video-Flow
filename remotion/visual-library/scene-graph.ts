import type { Scene } from "../../lib/types";
import type { GraphEdgeItem, GraphNodeItem } from "./types";

const normalizeLabel = (value: string) =>
  value.normalize("NFKC").replace(/\s+/g, " ").trim();

const fallbackEdges = (nodes: GraphNodeItem[]): GraphEdgeItem[] => {
  if (nodes.length <= 1) return [];
  const center = nodes[0].id;
  return nodes.slice(1).map((node) => ({ from: center, to: node.id }));
};

export const buildSceneGraph = (
  scene: Pick<Scene, "semantics">,
  fallbackNodes: GraphNodeItem[],
): { nodes: GraphNodeItem[]; edges: GraphEdgeItem[] } => {
  const relations = scene.semantics?.relations ?? [];
  if (relations.length === 0) {
    return {
      nodes: fallbackNodes,
      edges: fallbackEdges(fallbackNodes),
    };
  }

  const labels = relations
    .flatMap((relation) => [relation.from, relation.to])
    .map(normalizeLabel)
    .filter(Boolean);
  const uniqueLabels = [...new Set(labels)].slice(0, 6);
  const idByLabel = new Map(
    uniqueLabels.map((label, index) => [label, `semantic-node-${index}`]),
  );
  const tones = [
    "primary",
    "secondary",
    "accent",
    "warning",
    "success",
    "danger",
  ] as const;
  const nodes: GraphNodeItem[] = uniqueLabels.map((label, index) => ({
    id: idByLabel.get(label)!,
    label,
    tone: tones[index % tones.length],
  }));
  const edges = relations.flatMap<GraphEdgeItem>((relation) => {
    const from = idByLabel.get(normalizeLabel(relation.from));
    const to = idByLabel.get(normalizeLabel(relation.to));
    if (!from || !to) return [];
    const label = normalizeLabel(relation.relation);
    return [{ from, to, ...(label ? { label } : {}) }];
  });

  return { nodes, edges };
};
