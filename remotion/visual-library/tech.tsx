import { interpolate, useCurrentFrame } from "remotion";
import type { GraphNodeItem, TimedVisualProps } from "./types";
import { resolveTheme } from "./types";
import { NodeGraph } from "./relation";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export const ChipArchitecture = ({
  title = "AI 推理芯片",
  modules,
  theme,
  style,
}: TimedVisualProps & {
  title?: string;
  modules: Array<{ label: string; note?: string; tone?: "primary" | "secondary" | "accent" | "warning" | "success" }>;
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily, radius, shadow } = resolveTheme(theme);
  const traceProgress = interpolate(frame, [4, 46], [0, 1], clamp);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", fontFamily, ...style }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "52%",
          height: "58%",
          transform: "translate(-50%, -50%)",
          borderRadius: radius,
          background: `linear-gradient(145deg, ${palette.panel}, #eef6ff)`,
          border: `2px solid ${palette.primary}55`,
          boxShadow: shadow,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 22, border: `1px dashed ${palette.primary}55`, borderRadius: radius * 0.55 }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 26, textAlign: "center", color: palette.text, fontSize: 36, fontWeight: 950 }}>{title}</div>
        <div style={{ position: "absolute", left: "9%", right: "9%", bottom: "10%", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {modules.map((item, index) => {
            const progress = interpolate(frame, [index * 6, index * 6 + 18], [0, 1], clamp);
            const color = item.tone === "warning" ? palette.warning : item.tone === "success" ? palette.success : item.tone === "accent" ? palette.accent : item.tone === "secondary" ? palette.secondary : palette.primary;
            return (
              <div
                key={item.label}
                style={{
                  opacity: progress,
                  transform: `translateY(${(1 - progress) * 18}px)`,
                  background: `${color}13`,
                  border: `1px solid ${color}60`,
                  borderRadius: radius * 0.38,
                  padding: "15px 16px",
                  minHeight: 78,
                }}
              >
                <div style={{ color, fontSize: 22, fontWeight: 900 }}>{item.label}</div>
                {item.note ? <div style={{ color: palette.muted, fontSize: 14, marginTop: 6, lineHeight: 1.25 }}>{item.note}</div> : null}
              </div>
            );
          })}
        </div>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {[22, 36, 64, 78].map((x, index) => (
          <path key={x} d={`M ${x} 18 C ${x + (index % 2 ? -8 : 8)} 35, ${x + (index % 2 ? 8 : -8)} 65, ${x} 82`} fill="none" stroke={palette.secondary} strokeWidth={0.45} opacity={0.35} strokeDasharray="2 2" strokeDashoffset={5 * (1 - traceProgress)} />
        ))}
      </svg>
    </div>
  );
};

export const ComputeFlow = ({
  steps,
  theme,
  style,
}: TimedVisualProps & {
  steps: string[];
}) => {
  const frame = useCurrentFrame();
  const { palette, fontFamily, radius } = resolveTheme(theme);
  return (
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap: 26, alignItems: "center", fontFamily, ...style }}>
      {steps.map((step, index) => {
        const progress = interpolate(frame, [index * 8, index * 8 + 18], [0, 1], clamp);
        return (
          <div key={step} style={{ position: "relative", opacity: progress }}>
            <div
              style={{
                borderRadius: radius * 0.58,
                background: palette.panel,
                border: `1px solid ${palette.line}`,
                padding: "28px 22px",
                minHeight: 140,
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                color: palette.text,
                fontSize: 28,
                fontWeight: 900,
                transform: `translateY(${(1 - progress) * 24}px)`,
              }}
            >
              {step}
            </div>
            {index < steps.length - 1 ? (
              <div
                style={{
                  position: "absolute",
                  right: -26,
                  top: "50%",
                  width: 26,
                  height: 4,
                  background: `linear-gradient(90deg, ${palette.primary}, ${palette.secondary})`,
                  transform: "translateY(-50%)",
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export const ProductEcosystemMap = ({
  company,
  products,
  dependencies,
  theme,
  style,
}: TimedVisualProps & {
  company: string;
  products: string[];
  dependencies: string[];
}) => {
  const nodes: GraphNodeItem[] = [
    { id: "company", label: company, role: "核心公司", x: 50, y: 50, tone: "primary" },
    ...products.map((label, index) => ({ id: `p-${index}`, label, role: "产品", x: 22 + index * (56 / Math.max(products.length - 1, 1)), y: 20, tone: "secondary" as const })),
    ...dependencies.map((label, index) => ({ id: `d-${index}`, label, role: "依赖", x: 22 + index * (56 / Math.max(dependencies.length - 1, 1)), y: 80, tone: "warning" as const })),
  ];
  const edges = [
    ...products.map((_, index) => ({ from: "company", to: `p-${index}` })),
    ...dependencies.map((_, index) => ({ from: `d-${index}`, to: "company" })),
  ];
  return <NodeGraph nodes={nodes} edges={edges} theme={theme} style={style} />;
};
