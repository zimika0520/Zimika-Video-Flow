import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { GraphEdgeItem, GraphNodeItem, TimedVisualProps } from "./types";
import { resolveTheme, toneColor } from "./types";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const nodePosition = (node: GraphNodeItem, index: number, total: number) => {
  if (typeof node.x === "number" && typeof node.y === "number") return { x: node.x, y: node.y };
  const angle = -Math.PI / 2 + (index / Math.max(1, total)) * Math.PI * 2;
  return { x: 50 + Math.cos(angle) * 34, y: 50 + Math.sin(angle) * 30 };
};

export const NodeGraph = ({
  nodes,
  edges,
  theme,
  style,
}: TimedVisualProps & {
  nodes: GraphNodeItem[];
  edges: GraphEdgeItem[];
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily, radius, shadow } = resolveTheme(theme);
  const positions = new Map(nodes.map((node, index) => [node.id, nodePosition(node, index, nodes.length)]));

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", fontFamily, ...style }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {edges.map((edge, index) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          const progress = interpolate(frame, [index * 4, index * 4 + 20], [0, 1], clamp);
          if (!from || !to) return null;
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={palette.primary}
              strokeWidth={0.7}
              opacity={0.24 + progress * 0.42}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - progress}
            />
          );
        })}
      </svg>
      {edges.map((edge, index) => {
        if (!edge.label) return null;
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) return null;
        const progress = interpolate(frame, [index * 4 + 10, index * 4 + 24], [0, 1], clamp);
        const x = (from.x + to.x) / 2;
        const y = (from.y + to.y) / 2;
        return (
          <div
            key={`${edge.from}-${edge.to}-label-${index}`}
            data-edge-label={edge.label}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%, -50%) scale(${0.94 + progress * 0.06})`,
              opacity: progress,
              maxWidth: 170,
              padding: "6px 10px",
              borderRadius: radius * 0.32,
              background: palette.bg,
              border: `1px solid ${palette.line}`,
              color: palette.muted,
              fontSize: 14,
              fontWeight: 780,
              lineHeight: 1.15,
              textAlign: "center",
              zIndex: 1,
            }}
          >
            {edge.label}
          </div>
        );
      })}
      {nodes.map((node, index) => {
        const pos = positions.get(node.id) ?? { x: 50, y: 50 };
        const progress = interpolate(frame, [index * 4, index * 4 + 18], [0, 1], clamp);
        const color = toneColor(palette, node.tone);
        return (
          <div
            key={node.id}
            style={{
              position: "absolute",
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: node.role ? 190 : 156,
              minHeight: node.role ? 98 : 74,
              transform: `translate(-50%, -50%) scale(${0.88 + progress * 0.12})`,
              opacity: progress,
              borderRadius: radius * 0.58,
              background: palette.panel,
              border: `1px solid ${color}55`,
              boxShadow: shadow,
              display: "grid",
              placeItems: "center",
              padding: 16,
              textAlign: "center",
            }}
          >
            <div style={{ color, fontSize: 24, fontWeight: 920, lineHeight: 1.12 }}>{node.label}</div>
            {node.role ? <div style={{ color: palette.muted, fontSize: 15, fontWeight: 650, marginTop: 7 }}>{node.role}</div> : null}
          </div>
        );
      })}
    </div>
  );
};

export const SupplyChainMap = ({
  center,
  upstream,
  downstream,
  theme,
  style,
}: TimedVisualProps & {
  center: string;
  upstream: string[];
  downstream: string[];
}) => {
  const nodes: GraphNodeItem[] = [
    { id: "center", label: center, role: "核心节点", x: 50, y: 50, tone: "primary" },
    ...upstream.map((label, index) => ({ id: `u-${index}`, label, role: "上游", x: 18, y: 22 + index * (56 / Math.max(upstream.length - 1, 1)), tone: "secondary" as const })),
    ...downstream.map((label, index) => ({ id: `d-${index}`, label, role: "下游", x: 82, y: 22 + index * (56 / Math.max(downstream.length - 1, 1)), tone: "success" as const })),
  ];
  const edges: GraphEdgeItem[] = [
    ...upstream.map((_, index) => ({ from: `u-${index}`, to: "center" })),
    ...downstream.map((_, index) => ({ from: "center", to: `d-${index}` })),
  ];
  return <NodeGraph nodes={nodes} edges={edges} theme={theme} style={style} />;
};

export const DecisionTree = ({
  root,
  branches,
  theme,
  style,
}: TimedVisualProps & {
  root: string;
  branches: Array<{ label: string; outcome: string; tone?: GraphNodeItem["tone"] }>;
}) => {
  const nodes: GraphNodeItem[] = [
    { id: "root", label: root, x: 50, y: 18, tone: "primary" },
    ...branches.map((branch, index) => ({ id: `branch-${index}`, label: branch.label, role: branch.outcome, x: 22 + index * (56 / Math.max(branches.length - 1, 1)), y: 72, tone: branch.tone })),
  ];
  const edges = branches.map((_, index) => ({ from: "root", to: `branch-${index}` }));
  return <NodeGraph nodes={nodes} edges={edges} theme={theme} style={style} />;
};

export const CausalMap = NodeGraph;
