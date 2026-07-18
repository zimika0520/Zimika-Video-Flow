import React from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { vignette } from "@remotion/effects/vignette";
import { scanlines } from "@remotion/effects/scanlines";
import { chromaticAberration } from "@remotion/effects/chromatic-aberration";
import { wave } from "@remotion/effects/wave";
import { noise } from "@remotion/effects/noise";
import { duotone } from "@remotion/effects/duotone";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { filmBurn } from "@remotion/transitions/film-burn";
import { dissolve } from "@remotion/transitions/dissolve";
import { wipe } from "@remotion/transitions/wipe";
import { ripple } from "@remotion/transitions/ripple";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { directorPlan } from "./director-data";

// ── Types ───────────────────────────────────────────────
type DirPlan = typeof directorPlan;

export type StormScene = {
  id: string;
  start: number;
  end: number;
  subtitle?: string;
  captionText?: string;
  layout?: string;
  [key: string]: unknown;
};

// ── Style System Accessors ──────────────────────────────
const S = directorPlan.styleSystem as any;
const easeIn = Easing.bezier(S.motion.entranceEasing[0], S.motion.entranceEasing[1], S.motion.entranceEasing[2], S.motion.entranceEasing[3]);
const easePop = Easing.bezier(S.motion.emphasisEasing[0], S.motion.emphasisEasing[1], S.motion.emphasisEasing[2], S.motion.emphasisEasing[3]);
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const bounce = Easing.bezier(0.34, 1.56, 0.64, 1);
const fi = (f: number, d: number, dur: number) => interpolate(f, [d, d + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
const TRANS = { dissolve: dissolve, filmBurn: filmBurn, wipe: wipe, ripple: ripple } as const;
const T_TRANS = S.motion.transitionDuration;

// ── Effect Builder ──────────────────────────────────────
const bgFx = (bg: any) => {
  const fx: any[] = [];
  (bg?.effects || []).forEach((e: string) => {
    if (e === "vignette") fx.push((vignette as any)({ amount: S.effects.vignetteAmount }));
    if (e === "scanlines") fx.push((scanlines as any)({ opacity: S.effects.scanlinesOpacity }));
    if (e === "noise") fx.push((noise as any)({ amount: S.effects.noiseAmount }));
    if (e === "chromaticAberration") fx.push((chromaticAberration as any)({ intensity: S.effects.chromaticAberrationIntensity }));
    if (e === "wave") fx.push((wave as any)({ amplitude: 2, frequency: 0.02 }));
    if (e === "duotone") fx.push((duotone as any)({ lightColor: "#0a1628", darkColor: S.palette.alert }));
  });
  return fx;
};

// ── Shared Components ───────────────────────────────────
const Rain = ({ i = 1, w = 0 }: { i?: number; w?: number }) => {
  const f = useCurrentFrame();
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, zIndex: 999, pointerEvents: "none", opacity: 0.7 * i }}>{Array.from({ length: 80 }, (_, n) => { const x = ((n * 137 + 41) % 110) - 5, delay = ((n * 73) % 100) / 10, speed = (2 + (n % 5) * 0.8) * i, y = ((f * speed * 0.4 + delay * 30) % 140) - 20; return <line key={n} x1={x + w * 0.3} y1={y} x2={x + w * 0.8} y2={y + 6 + (n % 6) * 4} stroke={`rgba(148,163,184,${0.04 + (n % 5) * 0.02})`} strokeWidth={0.12} />; })}</svg>;
};

const Caption = ({ text }: { text: string }) => (
  <div style={{ position: "absolute", bottom: S.layout.captionY, left: "50%", transform: "translateX(-50%)", maxWidth: S.layout.captionMaxWidth * 100 + "%", textAlign: "center", zIndex: 1001 }}>
    <span style={{ background: "rgba(0,0,0,0.75)", color: "#ffffff", fontSize: S.typography.captionSize, fontWeight: 700, padding: "10px 28px", borderRadius: 12, lineHeight: 1.55, display: "inline-block", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>{text}</span>
  </div>
);

const AudioBars = ({ path }: { path: string }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const d = useAudioData(staticFile(path)); if (!d) return null;
  return <div style={{ position: "absolute", bottom: 130, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 3, alignItems: "flex-end", height: 60, zIndex: 10, opacity: 0.6, pointerEvents: "none" }}>{visualizeAudio({ fps, frame: f, audioData: d, numberOfSamples: 32 }).slice(0, 16).map((v: number, i: number) => <div key={i} style={{ width: 5, height: Math.max(2, v * 250), background: S.palette.accent, borderRadius: 2 }} />)}</div>;
};

const ShotBackground = ({ bg, f }: { bg: any; f: number }) => (
  <AbsoluteFill><Img src={staticFile(bg?.image || "storm-clouds.jpg")} effects={bgFx(bg)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: bg?.filter || "none" }} /></AbsoluteFill>
);

// ════════════════════════════════════════════════════════
// LAYOUT RENDERERS — driven by scene.layout
// ════════════════════════════════════════════════════════

const renderLayout = (scene: any, frame: number, audioPath: string) => {
  const lt = (scene as any).layout || (scene as any).layoutRecipe || {};
  const raw = typeof lt === "string" ? lt : (lt?.type || "");
  // Direct match - the layout type IS the case label
  const tp = raw || "metric-right";

  switch (tp) {
    case "hero-asymmetric": {
      const y = interpolate(frame, [0, 15], [40, 0], { extrapolateRight: "clamp" });
      const op = fi(frame, 2, 18);
      return (
        <AbsoluteFill>
          <ShotBackground bg={scene.background} f={frame} />
          <Rain i={0.5} />
          <div style={{ position: "absolute", left: S.layout.marginX, bottom: 200, zIndex: 10, opacity: op, transform: `translateY(${y}px)` }}>
            <div style={{ color: S.palette.text, fontSize: lt.titleFontSize || S.typography.heroSize, fontWeight: S.typography.headingWeight, lineHeight: 1.15 }}>{lt.title}</div>
            <div style={{ color: S.palette.textMuted, fontSize: S.typography.bodySize, fontWeight: S.typography.bodyWeight, marginTop: 12 }}>{lt.subtitle}</div>
          </div>
        </AbsoluteFill>
      );
    }

    case "metric-right": {
      const s = spring({ frame: Math.max(0, frame - 3), fps: 30, config: { mass: 0.4, damping: 8 } }) || 0.3;
      return (
        <AbsoluteFill style={{ background: S.palette.bg }}>
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "58%", overflow: "hidden" }}>
            <ShotBackground bg={scene.background} f={frame} />
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(270deg, transparent 25%, ${S.palette.bg} 100%)` }} />
          </div>
          <div style={{ position: "absolute", left: S.layout.marginX, top: "50%", transform: "translateY(-50%)", zIndex: 10 }}>
            <div style={{ color: S.palette.textLabel, fontSize: S.typography.labelSize, fontWeight: S.typography.labelWeight, letterSpacing: 4, opacity: fi(frame, 0, 10) }}>{lt.label}</div>
            <div style={{ color: lt.numberColor || S.palette.accent, fontSize: lt.numberFontSize || S.typography.metricSize, fontWeight: 980, lineHeight: 1, transform: `scale(${Math.min(1.15, 0.5 + s * 0.5)})` }}>{lt.number}</div>
          </div>
          <Rain i={0.6} w={0.5} />
        </AbsoluteFill>
      );
    }

    case "split-compare": {
      const lPct = interpolate(frame, [5, 30], [0, 100], { extrapolateRight: "clamp", easing: easePop });
      const rPct = interpolate(frame, [10, 55], [0, 17], { extrapolateRight: "clamp", easing: easeIn });
      return (
        <AbsoluteFill style={{ background: S.palette.bg }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "45%" }}><ShotBackground bg={scene.background} f={frame} /></div>
          <div style={{ position: "absolute", left: S.layout.marginX, top: 30, color: S.palette.text, fontSize: S.typography.titleSize, fontWeight: S.typography.headingWeight }}>{lt.leftLabel}</div>
          <div style={{ position: "absolute", left: S.layout.marginX, top: 100, color: S.palette.alert, fontSize: 64, fontWeight: 980 }}>{lt.leftValue}</div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "55%", background: S.palette.bg }}>
            <div style={{ position: "absolute", right: S.layout.marginX, top: 40, color: S.palette.textMuted, fontSize: 20, fontWeight: 600 }}>{lt.rightLabel}</div>
            <div style={{ position: "absolute", right: S.layout.marginX, top: 80, color: S.palette.accent, fontSize: 48, fontWeight: 800 }}>{lt.rightValue}</div>
            <div style={{ position: "absolute", left: S.layout.marginX, bottom: 120, width: "60%" }}>
              <div style={{ height: 56, borderRadius: 8, background: S.palette.bgRaise, overflow: "hidden", marginBottom: 16 }}><div style={{ height: "100%", width: `${lPct}%`, background: `linear-gradient(90deg, ${S.palette.alert}, ${S.palette.warning})`, borderRadius: 8 }} /></div>
              <div style={{ height: 56, borderRadius: 8, background: S.palette.bgRaise, overflow: "hidden" }}><div style={{ height: "100%", width: `${rPct}%`, background: S.palette.accent, borderRadius: 8 }} /></div>
            </div>
          </div>
        </AbsoluteFill>
      );
    }

    case "map-path-trace": {
      const progress = interpolate(frame, [0, 70], [0, 1], { extrapolateRight: "clamp", easing: easeIn });
      const tx = 59 + progress * -12, ty = 68 + progress * 3, rs = 1 + Math.sin(frame * 0.15) * 0.3;
      const coast = "M42 15 L50 14 L58 13 L64 12 L68 14 L70 16 Q74 18 76 20 L78 23 L79 26 Q80 30 79 33 L78 36 L77 38 L76 41 L75 44 L74 46 L73 48 L71 50 L70 52 L68 54 L67 56 L66 58 Q65 60 64 62 L62 64 L60 66 L58 68 L55 70 Q50 72 45 70 L42 66 L40 62 L38 58 Q35 52 33 45 L32 38 L33 30 L35 24 L38 18 Z";
      const cities = [{ k: "haikou", n: "海口", x: 59, y: 68 }, { k: "nanning", n: "南宁", x: 55, y: 59 }, { k: "guangzhou", n: "广州", x: 67, y: 59 }, { k: "shenzhen", n: "深圳", x: 70, y: 62 }];
      const ov = scene.overlay as any;
      return (
        <AbsoluteFill style={{ background: "#060e1a" }}>
          <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
            <rect x={0} y={0} width={100} height={100} fill="#060e1a" />
            <path d={coast} fill="#0f1a2e" stroke="#1e3a5f" strokeWidth={0.3} />
            {cities.map(c => <g key={c.k}><circle cx={c.x} cy={c.y} r={0.6} fill={c.k === "nanning" ? S.palette.alert : S.palette.textMuted} opacity={fi(frame, 5, 10)} /><text x={c.x + 1} y={c.y - 1} fill={c.k === "nanning" ? S.palette.alert : S.palette.textMuted} fontSize={2} fontWeight={600} opacity={fi(frame, 5, 10)}>{c.n}</text></g>)}
            <path d="M59 68 Q50 63 47 71" fill="none" stroke={S.palette.alert} strokeWidth={0.8} strokeDasharray="50" strokeDashoffset={50 - progress * 50} opacity={0.8} />
            {frame > 8 && <g transform={`translate(${tx},${ty})`}><circle r={3 * rs} fill="none" stroke={S.palette.alert} strokeWidth={0.4} opacity={0.6} /><circle r={1.8} fill={S.palette.alert} opacity={0.9} /></g>}
            {frame > 12 && Array.from({ length: 6 }, (_, i) => { const a = i / 6 * Math.PI * 2 + frame * 0.02; return <line key={i} x1={tx} y1={ty} x2={tx + Math.cos(a) * 6} y2={ty + Math.sin(a) * 6} stroke={S.palette.alert} strokeWidth={0.15} opacity={0.25} />; })}
          </svg>
          {ov && <div style={{ position: "absolute", left: S.layout.marginX - 30, bottom: 150, zIndex: 10, opacity: fi(frame, 5, 12) }}>
            <div style={{ color: S.palette.textMuted, fontSize: 14, fontWeight: 600, letterSpacing: 3 }}>{ov.subtitle}</div>
            <div style={{ color: S.palette.text, fontSize: 34, fontWeight: 900, marginTop: 6 }}>{ov.title}</div>
            {ov.highlight && <div style={{ color: S.palette.alert, fontSize: 18, fontWeight: 700, marginTop: 8, opacity: fi(frame, 25, 12) }}>{ov.highlight}</div>}
          </div>}
          <Rain i={0.4} w={1} />
        </AbsoluteFill>
      );
    }

    case "alert-fullscreen": {
      const shake = { x: Math.sin(frame * 2.3) * 12 * Math.max(0, 1 - frame / 40), y: Math.cos(frame * 1.7) * 6 * Math.max(0, 1 - frame / 40) };
      const flash = fi(frame, 0, 4);
      const qs = spring({ frame: Math.max(0, frame - 12), fps: 30, config: { mass: 0.3, damping: 6 } }) || 0.2;
      return (
        <AbsoluteFill style={{ transform: `translate(${shake.x}px,${shake.y}px)` }}>
          <ShotBackground bg={scene.background} f={frame} />
          <AbsoluteFill style={{ background: S.palette.alert, opacity: flash * 0.35 }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${interpolate(frame, [0, 8], [-80, 0], { extrapolateRight: "clamp", easing: easePop })}px)`, opacity: fi(frame, 2, 8) }}>
            <div style={{ background: S.palette.alert, color: "#fff", fontSize: 44, fontWeight: 980, padding: "18px 0", textAlign: "center", letterSpacing: 10 }}>⚠ {lt.bannerText} ⚠</div>
          </div>
          <div style={{ position: "absolute", right: S.layout.marginX, top: "40%", opacity: fi(frame, 12, 10), transform: `scale(${Math.max(0.2, qs)})` }}>
            <div style={{ background: `${S.palette.alert}18`, border: `3px solid ${S.palette.alert}`, borderRadius: 20, padding: "30px 50px" }}>
              <div style={{ color: S.palette.alert, fontSize: 56, fontWeight: 980, letterSpacing: 4 }}>{lt.quoteText}</div>
            </div>
          </div>
          <div style={{ position: "absolute", left: S.layout.marginX, bottom: 200, display: "flex", gap: 12, opacity: fi(frame, 18, 12) }}>
            {(lt.keywords || []).map((k: string, i: number) => <span key={k} style={{ padding: "8px 18px", border: `1px solid ${S.palette.alert}50`, borderRadius: 20, color: S.palette.alert, fontSize: 18, fontWeight: 700, opacity: fi(frame, 18 + i * 5, 8) }}>{k}</span>)}
          </div>
          {scene.audioReactive && <AudioBars path={audioPath} />}
          <Rain i={0.8} w={1} />
        </AbsoluteFill>
      );
    }

    case "stat-grid": {
      return (
        <AbsoluteFill style={{ background: S.palette.bg }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "48%" }}>
            <ShotBackground bg={scene.background} f={frame} />
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${S.palette.bg}20 0%, ${S.palette.bg} 100%)` }} />
          </div>
          <div style={{ position: "absolute", right: S.layout.marginX, top: "50%", transform: "translateY(-50%)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, opacity: fi(frame, 0, 15) }}>
            {(lt.cards || []).map((c: any, i: number) => {
              const clr = S.palette[c.color] || c.color || S.palette.accent;
              return <div key={i} style={{ background: S.palette.bgPanel, border: `1px solid ${S.palette.bgRaise}`, borderRadius: 14, padding: "28px 36px", textAlign: "center", transform: `translateY(${interpolate(frame, [i * 4, i * 4 + 12], [24, 0], { extrapolateRight: "clamp" })}px)` }}>
                <div style={{ fontSize: S.typography.metricSize - 60, fontWeight: 980, color: clr, lineHeight: 1.1 }}>{c.value}</div>
                <div style={{ marginTop: 6, fontSize: S.typography.labelSize, color: S.palette.textMuted, fontWeight: 600 }}>{c.label}</div>
              </div>;
            })}
          </div>
          <Rain i={0.4} />
        </AbsoluteFill>
      );
    }

    case "flight-map": {
      const coast = "M42 15 L50 14 L58 13 L64 12 L68 14 L70 16 Q74 18 76 20 L78 23 L79 26 Q80 30 79 33 L78 36 L77 38 L76 41 L75 44 L74 46 L73 48 L71 50 L70 52 L68 54 L67 56 L66 58 Q65 60 64 62 L62 64 L60 66 L58 68 L55 70 Q50 72 45 70 L42 66 L40 62 L38 58 Q35 52 33 45 L32 38 L33 30 L35 24 L38 18 Z";
      const flightPathD = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1} Q${(x1 + x2) / 2} ${(y1 + y2) / 2 - 15} ${x2} ${y2}`;
      const origin = lt.origin;
      const destCities: Record<string, { x: number; y: number }> = { "北京": { x: 65, y: 23 }, "上海": { x: 74, y: 44 }, "广州": { x: 67, y: 59 }, "福州": { x: 72, y: 51 } };
      const routes = (lt.routes || []).map((r: any) => ({ ...r, coords: destCities[r.to] }));
      return (
        <AbsoluteFill style={{ background: "#060e1a" }}>
          <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
            <rect x={0} y={0} width={100} height={100} fill="#060e1a" />
            <path d={coast} fill="#0f1a2e" stroke="#1e3a5f" strokeWidth={0.3} />
            {[{ name: origin.label, x: origin.x, y: origin.y, isOrigin: true }, ...routes.map((r: any) => ({ name: r.to, x: r.coords.x, y: r.coords.y }))].map((c: any) => (
              <g key={c.name}><circle cx={c.x} cy={c.y} r={c.isOrigin ? 1.2 : 0.5} fill={c.isOrigin ? S.palette.alert : S.palette.textMuted} opacity={fi(frame, 2, 8)} /><text x={c.x + 1.5} y={c.y - 1} fill={c.isOrigin ? S.palette.alert : S.palette.textMuted} fontSize={c.isOrigin ? 2.5 : 1.8} fontWeight={c.isOrigin ? 800 : 600} opacity={fi(frame, 2, 8)}>{c.name}{c.isOrigin ? " ✈" : ""}</text></g>
            ))}
            {routes.map((r: any, i: number) => {
              const lf = Math.max(0, frame - i * 6);
              const cf = 50 + i * 6;
              const t = lf < cf ? interpolate(lf, [0, cf], [0, 0.85], { extrapolateRight: "clamp", easing: easeIn }) : 0.85;
              const stopped = r.status === "cancelled" && lf >= cf;
              const mx = (origin.x + r.coords.x) / 2, my = (origin.y + r.coords.y) / 2 - 15;
              const px = (1 - t) * (1 - t) * origin.x + 2 * (1 - t) * t * mx + t * t * r.coords.x;
              const py = (1 - t) * (1 - t) * origin.y + 2 * (1 - t) * t * my + t * t * r.coords.y;
              return <g key={r.to}><path d={flightPathD(origin.x, origin.y, r.coords.x, r.coords.y)} fill="none" stroke={stopped ? S.palette.alert : S.palette.warning} strokeWidth={0.3} strokeDasharray={stopped ? "2 2" : "4 2"} opacity={stopped ? 0.6 : 0.4} />{lf > 0 && <g transform={`translate(${px},${py})`} opacity={fi(frame, i * 6, 6)}><path d="M-2,-1 L2,0 L-2,1 Z" fill={stopped ? S.palette.alert : S.palette.warning} />{stopped && <circle r={1.5} fill="none" stroke={S.palette.alert} strokeWidth={0.2} opacity={0.5} />}</g>}</g>;
            })}
          </svg>
          <div style={{ position: "absolute", left: S.layout.marginX - 30, bottom: 150, zIndex: 10, opacity: fi(frame, 2, 10) }}>
            <div style={{ color: S.palette.textMuted, fontSize: S.typography.labelSize, fontWeight: 600, letterSpacing: 3 }}>{origin.label}机场</div>
            <div style={{ display: "flex", gap: 24, marginTop: 12 }}><div><span style={{ color: S.palette.alert, fontSize: 36, fontWeight: 980 }}>{lt.stats?.cancelled}</span><span style={{ color: S.palette.textMuted, fontSize: 14, marginLeft: 4 }}>取消</span></div><div><span style={{ color: S.palette.warning, fontSize: 36, fontWeight: 980 }}>{lt.stats?.delayed}</span><span style={{ color: S.palette.textMuted, fontSize: 14, marginLeft: 4 }}>延误</span></div></div>
          </div>
          <Rain i={0.4} />
        </AbsoluteFill>
      );
    }

    case "bar-race": {
      const bars = lt.bars || [];
      return (
        <AbsoluteFill style={{ background: S.palette.bg }}>
          <div style={{ position: "absolute", left: S.layout.marginX, top: S.layout.marginTop, color: S.palette.text, fontSize: 30, fontWeight: 800, letterSpacing: 2, opacity: fi(frame, 0, 10) }}>{lt.title}</div>
          <div style={{ position: "absolute", left: S.layout.marginX, right: S.layout.marginX, top: "50%", transform: "translateY(-50%)" }}>
            {bars.map((b: any, i: number) => {
              const d = (lt.animation?.delayPerBar || 7) * i + 5;
              const pct = interpolate(frame, [d, d + (lt.animation?.duration || 28)], [0, b.value / 950 * 100], { extrapolateRight: "clamp", easing: easePop });
              return <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
                <div style={{ width: 120, color: i === 0 ? S.palette.alert : S.palette.textMuted, fontSize: 22, fontWeight: i === 0 ? 900 : 600, textAlign: "right" }}>{b.label}</div>
                <div style={{ flex: 1, height: 48, borderRadius: 8, background: S.palette.bgRaise, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: S.palette[b.color] || b.color, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 18, fontSize: 20, fontWeight: 800, color: S.palette.text }}>{frame > d + 10 && `${b.value}班`}</div></div>
              </div>;
            })}
          </div>
          {lt.highlight && <div style={{ position: "absolute", right: S.layout.marginX, bottom: 180, color: S.palette.alert, fontSize: 26, fontWeight: 800, textAlign: "right", opacity: fi(frame, 35, 15) }}>{lt.highlight.text}</div>}
          <Rain i={0.3} />
        </AbsoluteFill>
      );
    }

    case "dual-threat-map": {
      return (
        <AbsoluteFill style={{ background: "#060e1a" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", borderBottom: `1px solid ${S.palette.bgRaise}` }}>
            <svg viewBox="0 0 100 50" style={{ width: "100%", height: "100%" }}>
              <text x={10} y={15} fill={S.palette.warning} fontSize={3} fontWeight={700}>{lt.upper?.label}</text>
              <path d="M8 35 Q30 28, 55 22 Q78 16, 92 10" fill="none" stroke={S.palette.warning} strokeWidth={0.7} strokeDasharray="4 2" opacity={0.7} />
              {frame > 5 && <circle cx={8 + (frame - 5) * 1.5} cy={35} r={1.5} fill={S.palette.warning} opacity={0.8} />}
              <text x={92} y={18} fill={S.palette.textMuted} fontSize={2.2}>{lt.upper?.direction} →</text>
            </svg>
          </div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%" }}>
            <svg viewBox="0 0 100 50" style={{ width: "100%", height: "100%" }}>
              <text x={10} y={15} fill={S.palette.alert} fontSize={3} fontWeight={700}>{lt.lower?.label}</text>
              <path d="M5 40 Q25 30, 50 22 Q75 14, 90 6" fill="none" stroke={S.palette.alert} strokeWidth={1} strokeDasharray="6 3" opacity={0.8} />
              {frame > 15 && <circle cx={5 + (frame - 15) * 1.8} cy={40} r={2} fill={S.palette.alert} opacity={0.9} />}
              <text x={92} y={12} fill={S.palette.alert} fontSize={2.2}>← {lt.lower?.direction}</text>
            </svg>
          </div>
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", background: S.palette.bg, padding: "8px 20px", color: S.palette.alert, fontSize: 22, fontWeight: 800, letterSpacing: 3, opacity: fi(frame, 10, 10) }}>{lt.centerLabel}</div>
          <Rain i={0.5} />
        </AbsoluteFill>
      );
    }

    case "closing-freeze": {
      const dur = scene.duration * 30;
      return (
        <AbsoluteFill style={{ background: "#000" }}>
          <AbsoluteFill style={{ opacity: interpolate(frame, [0, 40], [0.35, 0], { extrapolateRight: "clamp" }) }}>
            <Img src={staticFile("storm-clouds.jpg")} effects={[vignette({ amount: 0.6 })]} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.3)" }} />
          </AbsoluteFill>
          <div style={{ position: "absolute", left: S.layout.marginX, top: "50%", transform: "translateY(-50%)", opacity: fi(frame, 0, 20) }}>
            <div style={{ color: S.palette.text, fontSize: 52, fontWeight: 900, lineHeight: 1.3 }}>{lt.message}</div>
            <div style={{ marginTop: 20, color: S.palette.textMuted, fontSize: 20, fontWeight: 600 }}>{lt.tagline}</div>
          </div>
          <div style={{ position: "absolute", inset: 0, background: "#000", opacity: interpolate(frame, [dur - 30, dur], [0, 1], { extrapolateRight: "clamp" }) }} />
        </AbsoluteFill>
      );
    }

    case "tech-report": {
      const f = useCurrentFrame();
      const tickerOffset = f * 0.8;
      return (
        <AbsoluteFill style={{ background: "linear-gradient(180deg, #e4eef6 0%, #f0f6fb 40%, #f8fafc 100%)" }}>
          <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(#d0dce8 1px, transparent 1px), linear-gradient(90deg, #d0dce8 1px, transparent 1px)", backgroundSize:"40px 40px", opacity:0.35, pointerEvents:"none" }} />
          <div style={{ position:"absolute", top:28, left:0, right:0, height:36, overflow:"hidden", opacity:fi(f,0,8) }}>
            <div style={{ display:"flex", gap:12, transform:`translateX(${-tickerOffset % 800}px)`, whiteSpace:"nowrap" }}>
              {[...(lt.keywords||[]),...(lt.keywords||[])].map((k:string,i:number) => (
                <span key={i} style={{ padding:"6px 14px", borderRadius:14, background:"#1e293b", color:"#e2e8f0", fontSize:13, fontWeight:600, flexShrink:0 }}>{k}</span>
              ))}
            </div>
          </div>
          <div style={{ position:"absolute", left:50, right:50, top:85, bottom:100, display:"flex", gap:30 }}>
            <div style={{ flex:1.5, background:"#fff", borderRadius:20, padding:"36px 40px", boxShadow:"0 2px 20px rgba(0,0,0,0.06)", opacity:fi(f,3,10), display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
              <div>
                <div style={{ color:"#2563eb", fontSize:14, fontWeight:700, marginBottom:6 }}>2026.7.7 · AI日报</div>
                <div style={{ color:"#dc2626", fontSize:40, fontWeight:900, lineHeight:1.2, marginBottom:6 }}>{lt.title}</div>
                <div style={{ color:"#1a2332", fontSize:18, fontWeight:700 }}>{lt.subtitle}</div>
              </div>
              <div style={{ display:"flex", gap:10, marginTop:18 }}>
                {(lt.signals||[]).map((s:string,i:number) => (
                  <div key={i} style={{ flex:1, background:"#f0f6ff", borderRadius:10, padding:"12px 14px", border:"1px solid #d0dce8", opacity:fi(f,10+i*5,8) }}>
                    <div style={{ color:"#06b6d4", fontSize:11, fontWeight:700, marginBottom:3 }}>SIGNAL {i+1}</div>
                    <div style={{ color:"#1a2332", fontSize:13, fontWeight:600, lineHeight:1.3 }}>{s}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex:0.85, background:lt.brandColor||"#152238", borderRadius:20, padding:"36px 30px", boxShadow:"0 4px 24px rgba(0,0,0,0.15)", opacity:fi(f,6,10), transform:`rotate(${interpolate(f,[0,12],[-2,1],{extrapolateRight:"clamp"})}deg)` }}>
              <div style={{ background:"rgba(255,255,255,0.15)", borderRadius:8, padding:"6px 14px", color:"#fff", fontSize:16, fontWeight:800, letterSpacing:3, display:"inline-block", marginBottom:20 }}>{lt.brand}</div>
              <div style={{ color:"rgba(255,255,255,0.8)", fontSize:14, fontWeight:600, marginBottom:8 }}>{lt.productLabel}</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {(lt.productTags||[]).map((t:string,i:number) => (
                  <span key={i} style={{ padding:"4px 10px", borderRadius:6, background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.7)", fontSize:12, fontWeight:600 }}>{t}</span>
                ))}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4, marginTop:"auto", paddingTop:20 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ height:8, borderRadius:3, background:`rgba(255,255,255,${0.15+i*0.1})`, opacity:fi(f,12+i*5,6) }} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ position:"absolute", bottom:148, left:50, right:50, textAlign:"center", opacity:0.4 }}>
            <span style={{ color:"#0ea5e9", fontSize:13, fontWeight:600 }}>{lt.trend}</span>
          </div>
        </AbsoluteFill>
      );
    }
    case "hero-tech-brand": {
      return (
        <AbsoluteFill style={{ background: "#0b1120" }}>
          <div style={{ position: "absolute", left: S.layout.marginX, bottom: 200, opacity: fi(frame, 2, 15) }}>
            <div style={{ color: "#60a5fa", fontSize: 16, fontWeight: 700, letterSpacing: 3, marginBottom: 8 }}>2026.7.7</div>
            <div style={{ color: "#fff", fontSize: 56, fontWeight: 980, lineHeight: 1.2 }}>{lt.title}</div>
            <div style={{ color: "#64748b", fontSize: 20, fontWeight: 600, marginTop: 8 }}>{lt.subtitle}</div>
          </div>
        </AbsoluteFill>
      );
    }
    case "alert-card": {
      const pulse = Math.sin(frame * 0.08) * 0.5 + 0.5;
      return (
        <AbsoluteFill style={{ background: "#0b1120" }}>
          <div style={{ position: "absolute", left: "12%", right: "12%", top: "50%", transform: "translateY(-55%)", opacity: fi(frame, 0, 12) }}>
            <div style={{ background: "#111827", borderRadius: 16, padding: "40px 50px", borderLeft: "5px solid #ef4444", boxShadow: `0 0 30px rgba(239,68,68,${0.1 + pulse * 0.1})` }}>
              <div style={{ color: "#ef4444", fontSize: 32, fontWeight: 900, marginBottom: 28 }}>⚠ 监管红线</div>
              <div style={{ display: "flex", gap: 24 }}>
                {["ByteDance", "Alibaba"].map((name) => (
                  <div key={name} style={{ flex: 1, textAlign: "center", padding: "24px 20px", borderRadius: 12, background: "#1a1f2e", border: "1px solid #1e293b", filter: "grayscale(1)", opacity: 0.5 }}>
                    <div style={{ color: "#64748b", fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{name}</div>
                    <div style={{ color: "#ef4444", fontSize: 15, fontWeight: 700 }}>已下线</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
                {["情感依赖", "拟人化风险", "7月中旬新规"].map((t, i) => (
                  <span key={t} style={{ padding: "6px 16px", borderRadius: 16, background: "#ef444415", color: "#f87171", fontSize: 14, fontWeight: 600, opacity: fi(frame, 12 + i * 4, 8) }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    case "rank-quote": {
      const s = spring({ frame: Math.max(0, frame - 8), fps: 30, config: { mass: 0.4, damping: 10 } }) || 0.3;
      return (
        <AbsoluteFill style={{ background: "#0b1120" }}>
          <div style={{ position: "absolute", left: "50%", top: "40%", transform: "translate(-50%,-50%)", textAlign: "center", opacity: fi(frame, 0, 10) }}>
            <div style={{ display: "inline-block", padding: "6px 20px", borderRadius: 14, background: "#f0a50020", color: "#f0a500", fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{lt.badge}</div>
            <div style={{ color: "#fff", fontSize: 40, fontWeight: 900 }}>#{lt.rank} {lt.model}</div>
            <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 12, background: "#f59e0b15", color: "#f59e0b", fontSize: 14, fontWeight: 600, marginTop: 12 }}>{lt.controversyTag}</div>
          </div>
          <div style={{ position: "absolute", left: "50%", top: "58%", transform: `translate(-50%,-50%) scale(${Math.min(1.05, s)})`, opacity: fi(frame, 12, 10) }}>
            <div style={{ background: "#111827", borderRadius: 14, padding: "24px 40px", border: "1px solid #1e293b" }}>
              <div style={{ color: "#fff", fontSize: 22, fontWeight: 700, fontStyle: "italic" }}>"{lt.quote}"</div>
              <div style={{ color: "#64748b", fontSize: 14, marginTop: 8 }}>— {lt.quoteAuthor}</div>
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    case "leaderboard-dual": {
      const renderItems = (items: any[], isLeft: boolean) => items.map((item: any, i: number) => {
        const s = spring({ frame: Math.max(0, frame - 8 - i * 6), fps: 30, config: { mass: 0.5, damping: 10 } }) || 0.1;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < items.length - 1 ? "1px solid #1e293b" : "none", opacity: Math.min(1, s * 1.5), transform: `translateX(${(1 - s) * (isLeft ? -15 : 15)}px)` }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: i === 0 ? "#3b82f6" : i === 1 ? "#1e3a5f" : "#111827", display: "flex", alignItems: "center", justifyContent: "center", color: i === 0 ? "#fff" : "#64748b", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{item.rank}</div>
            <div style={{ flex: 1 }}><div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>{item.name}</div></div>
            <div style={{ textAlign: "right" }}><div style={{ color: "#60a5fa", fontSize: 16, fontWeight: 800 }}>{item.value}</div>{item.trend && <div style={{ color: item.trend.startsWith("↑") ? "#10b981" : "#ef4444", fontSize: 12, fontWeight: 700 }}>{item.trend}</div>}</div>
          </div>
        );
      });
      return (
        <AbsoluteFill style={{ background: "#0b1120" }}>
          <div style={{ position: "absolute", left: "5%", right: "5%", top: "50%", transform: "translateY(-50%)", display: "flex", gap: 24 }}>
            <div style={{ flex: 1, background: "#111827", borderRadius: 14, padding: "24px 28px", border: "1px solid #1e293b", opacity: fi(frame, 0, 10) }}>
              <div style={{ color: "#60a5fa", fontSize: 15, fontWeight: 800, marginBottom: 18, letterSpacing: 1 }}>{lt.leftTitle}</div>
              {renderItems(lt.leftItems || [], true)}
            </div>
            <div style={{ flex: 1, background: "#111827", borderRadius: 14, padding: "24px 28px", border: "1px solid #1e293b", opacity: fi(frame, 3, 10) }}>
              <div style={{ color: "#60a5fa", fontSize: 15, fontWeight: 800, marginBottom: 18, letterSpacing: 1 }}>{lt.rightTitle}</div>
              {renderItems(lt.rightItems || [], false)}
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    case "closing-brand": {
      return (
        <AbsoluteFill style={{ background: "#0b1120", justifyContent: "center", alignItems: "center" }}>
          <div style={{ textAlign: "center", opacity: fi(frame, 0, 20) }}>
            <div style={{ color: "#60a5fa", fontSize: 18, fontWeight: 700, letterSpacing: 6, marginBottom: 16 }}>{lt.tagline}</div>
            <div style={{ color: "#fff", fontSize: 64, fontWeight: 980 }}>{lt.message}</div>
          </div>
        </AbsoluteFill>
      );
    }
    case "vs-compare": {
      const barH = 340; // fixed bar max height in pixels
      const leftH = interpolate(frame, [5, 35], [10, barH * 0.89], { extrapolateRight: "clamp", easing: bounce });
      const rightH = interpolate(frame, [10, 40], [10, barH * 0.89], { extrapolateRight: "clamp", easing: bounce });
      const leftNum = Math.round(interpolate(frame, [5, 30], [0, 89.4], { extrapolateRight: "clamp" }));
      const rightNum = Math.round(interpolate(frame, [10, 35], [0, 535], { extrapolateRight: "clamp" }));
      return (
        <AbsoluteFill style={{ background: "#0b1120" }}>
          <div style={{ position: "absolute", top: 80, left: 0, right: 0, textAlign: "center", opacity: fi(frame, 0, 10) }}>
            <div style={{ color: "#94a3b8", fontSize: 16, fontWeight: 600, letterSpacing: 4 }}>营业利润对比 · 2026 Q2</div>
          </div>
          <div style={{ position: "absolute", left: "15%", right: "15%", bottom: 200, top: 160, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 120 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ color: "#fff", fontSize: 48, fontWeight: 900, opacity: fi(frame, 15, 10) }}>{leftNum}<span style={{ fontSize: 20, color: "#94a3b8" }}>万亿</span></div>
              <div style={{ color: "#10b981", fontSize: 24, fontWeight: 700, opacity: fi(frame, 20, 8) }}>↑</div>
              <div style={{ width: 140, height: leftH, background: "linear-gradient(180deg, #3b82f6, #1d4ed8)", borderRadius: "12px 12px 0 0", boxShadow: "0 0 24px rgba(59,130,246,0.3)" }} />
              <div style={{ color: "#60a5fa", fontSize: 28, fontWeight: 900 }}>SAMSUNG</div>
              <div style={{ color: "#64748b", fontSize: 16 }}>韩元</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ color: "#fff", fontSize: 48, fontWeight: 900, opacity: fi(frame, 20, 10) }}>{rightNum}<span style={{ fontSize: 20, color: "#94a3b8" }}>亿</span></div>
              <div style={{ color: "#94a3b8", fontSize: 24, fontWeight: 700, opacity: fi(frame, 25, 8) }}>—</div>
              <div style={{ width: 140, height: rightH, background: "linear-gradient(180deg, #10b981, #047857)", borderRadius: "12px 12px 0 0", boxShadow: "0 0 24px rgba(16,185,129,0.3)" }} />
              <div style={{ color: "#34d399", fontSize: 28, fontWeight: 900 }}>NVIDIA</div>
              <div style={{ color: "#64748b", fontSize: 16 }}>美元</div>
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    case "terminal-panel": {
      // Capability upgrade bars: Codex before vs after GPT-5.6
      const caps = [
        { label: "代码生成", before: 72, after: 95 },
        { label: "调试诊断", before: 58, after: 88 },
        { label: "重构优化", before: 45, after: 82 },
        { label: "测试覆盖", before: 60, after: 90 },
      ];
      return (
        <AbsoluteFill style={{ background: "#0b1120" }}>
          <div style={{ position: "absolute", top: 70, left: 0, right: 0, textAlign: "center", opacity: fi(frame, 0, 10) }}>
            <div style={{ color: "#64748b", fontSize: 14, fontWeight: 600, letterSpacing: 4 }}>Codex 模型升级</div>
            <div style={{ color: "#fff", fontSize: 28, fontWeight: 900, marginTop: 8 }}>GPT-5.6 <span style={{ color: "#60a5fa" }}>Sol Ultra</span></div>
          </div>
          <div style={{ position: "absolute", left: "12%", right: "12%", top: 200, bottom: 180 }}>
            {caps.map((c, i) => {
              const beforeW = interpolate(frame, [8 + i * 6, 28 + i * 6], [0, c.before], { extrapolateRight: "clamp", easing: bounce });
              const afterW = interpolate(frame, [18 + i * 6, 40 + i * 6], [0, c.after], { extrapolateRight: "clamp", easing: bounce });
              return (
                <div key={c.label} style={{ marginBottom: 28 }}>
                  <div style={{ color: "#94a3b8", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{c.label}</div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    {/* Before bar */}
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 28, borderRadius: 6, background: "#1e293b", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${beforeW}%`, background: "#475569", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 10, fontSize: 13, fontWeight: 700, color: "#94a3b8", transition: "width 0.1s linear" }}>{frame > 20 + i * 6 && `${c.before}%`}</div>
                      </div>
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>旧版</div>
                    </div>
                    {/* Arrow */}
                    <div style={{ color: "#60a5fa", fontSize: 20 }}>→</div>
                    {/* After bar */}
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 28, borderRadius: 6, background: "#1e293b", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${afterW}%`, background: "linear-gradient(90deg, #3b82f6, #06b6d4)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 10, fontSize: 13, fontWeight: 700, color: "#fff", boxShadow: "0 0 12px rgba(59,130,246,0.3)", transition: "width 0.1s linear" }}>{frame > 30 + i * 6 && `${c.after}%`}</div>
                      </div>
                      <div style={{ color: "#60a5fa", fontSize: 12, marginTop: 4 }}>GPT-5.6</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", bottom: 120, left: 0, right: 0, textAlign: "center", opacity: fi(frame, 35, 12) }}>
            <div style={{ color: "#64748b", fontSize: 14 }}>最强基础模型 + 代码智能体深度绑定 · 复杂工程任务自动化</div>
          </div>
        </AbsoluteFill>
      );
    }
    case "flip-reveal": {
      const flipFrame = 20;
      const before = frame < flipFrame;
      return (
        <AbsoluteFill style={{ background: "#0b1120" }}>
          <div style={{ position: "absolute", left: "50%", top: "45%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
            {before ? (
              <div style={{ opacity: interpolate(frame, [flipFrame-5, flipFrame], [1, 0], { extrapolateRight: "clamp" }) }}>
                <div style={{ color: "#ef4444", fontSize: 56, fontWeight: 900, textDecoration: "line-through", textDecorationColor: "#ef4444", textDecorationThickness: 4 }}>{lt.before?.text}</div>
                <div style={{ color: "#64748b", fontSize: 16, marginTop: 16, letterSpacing: 2 }}>旧叙事</div>
              </div>
            ) : (
              <div style={{ opacity: interpolate(frame, [flipFrame, flipFrame+8], [0, 1], { extrapolateRight: "clamp" }) }}>
                <div style={{ color: "#60a5fa", fontSize: 56, fontWeight: 900 }}>{lt.after?.text}</div>
                <div style={{ color: "#64748b", fontSize: 16, marginTop: 16, letterSpacing: 2 }}>新叙事</div>
              </div>
            )}
          </div>
          <div style={{ position: "absolute", bottom: 160, left: 0, right: 0, opacity: fi(frame, 15, 12) }}>
            <div style={{ color: "#fff", fontSize: 22, fontWeight: 700, textAlign: "center" }}>{lt.subtitle}</div>
          </div>
          <div style={{ position: "absolute", bottom: 110, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 16, opacity: fi(frame, 20, 10) }}>
            {["Google", "Microsoft", "Meta", "Amazon"].map((ceo, i) => (
              <span key={ceo} style={{ padding: "6px 16px", borderRadius: 16, background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", fontSize: 13, fontWeight: 600, opacity: fi(frame, 22 + i * 4, 8) }}>{ceo}</span>
            ))}
          </div>
        </AbsoluteFill>
      );
    }
    case "alert-card": {
      const pulse = Math.sin(frame * 0.1) * 0.5 + 0.5;
      return (
        <AbsoluteFill style={{ background: S.palette.bgGradient }}>
          <div style={{ position: "absolute", left: S.layout.marginX, right: S.layout.marginX, top: "50%", transform: "translateY(-50%)", opacity: fi(frame, 0, 12) }}>
            <div style={{ background: "#fff", borderRadius: 20, padding: "40px 50px", boxShadow: S.palette.borderGlow, borderLeft: `4px solid ${S.palette.alert}` }}>
              <div style={{ color: S.palette.alert, fontSize: 32, fontWeight: 900, marginBottom: 24 }}>{lt.warningTitle}</div>
              <div style={{ display: "flex", gap: 24 }}>
                {(lt.companies || []).map((c: any, i: number) => (
                  <div key={i} style={{ flex: 1, textAlign: "center", padding: "20px", borderRadius: 12, background: "#f8fafc", opacity: 0.5 }}>
                    <Img src={staticFile(c.logo)} style={{ height: 28, filter: "grayscale(1)", marginBottom: 8 }} />
                    <div style={{ color: S.palette.textMuted, fontSize: 15, fontWeight: 700 }}>{c.name}</div>
                    <div style={{ color: S.palette.alert, fontSize: 13, fontWeight: 600, marginTop: 4 }}>{c.status}</div>
                  </div>
                ))}
              </div>
              {lt.riskTags && <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>{lt.riskTags.map((t: string, i: number) => <span key={t} style={{ padding: "6px 16px", borderRadius: 20, background: `${S.palette.alert}12`, color: S.palette.alert, fontSize: 14, fontWeight: 600, opacity: fi(frame, 10+i*4, 8) }}>{t}</span>)}</div>}
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    case "rank-quote": {
      const s = spring({ frame: Math.max(0, frame - 5), fps: 30, config: { mass: 0.4, damping: 10 } }) || 0.2;
      return (
        <AbsoluteFill style={{ background: S.palette.bgGradient }}>
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", opacity: fi(frame, 0, 10) }}>
            <div style={{ background: "#fff", borderRadius: 20, padding: "40px 60px", boxShadow: S.palette.borderGlow, textAlign: "center" }}>
              <div style={{ display: "inline-block", padding: "4px 16px", borderRadius: 12, background: `${S.palette.gold}20`, color: S.palette.gold, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{lt.badge}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: S.palette.textMuted, marginBottom: 8 }}>#{lt.rank} {lt.model}</div>
              {lt.controversyTag && <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 12, background: `${S.palette.warning}15`, color: S.palette.warning, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{lt.controversyTag}</div>}
              <div style={{ background: `${S.palette.accent}08`, borderRadius: 12, padding: "16px 24px", marginTop: 12, transform: `scale(${Math.min(1.05, s)})` }}>
                <div style={{ color: S.palette.text, fontSize: 24, fontWeight: 700, fontStyle: "italic" }}>"{lt.quote}"</div>
                <div style={{ color: S.palette.textMuted, fontSize: 14, marginTop: 6 }}>— {lt.quoteAuthor}</div>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    default:
      return <AbsoluteFill style={{ background: S.palette.bg, justifyContent: "center", alignItems: "center" }}><div style={{ color: S.palette.text, fontSize: 40 }}>{scene.captionText}</div></AbsoluteFill>;
  }
};

// ════════════════════════════════════════════════════════
// MAIN — Director-Driven Renderer
// ════════════════════════════════════════════════════════
export const StormVideo = ({ audioPath }: { scenes?: any; audioPath: string; fps: number; width: number; height: number }) => {
  const planScenes = directorPlan.scenes as any[];
  const TRANS_MAP: Record<string, any> = { dissolve: dissolve, filmBurn: filmBurn, wipe: wipe, ripple: ripple };
  return (
    <AbsoluteFill style={{ background: S.palette.bg, fontFamily: '"Inter","PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif' }}>
      <Audio src={staticFile(audioPath)} />
      <TransitionSeries>
        {planScenes.map((scene: any, i: number) => {
          const frames = Math.round((scene.end - scene.start) * 30) + T_TRANS;
          const trType = scene.transition || "dissolve";
          return (
            <React.Fragment key={scene.id}>
              {i > 0 && (
                <TransitionSeries.Transition
                  presentation={(TRANS_MAP[trType] as any)?.() || (dissolve as any)()}
                  timing={linearTiming({ durationInFrames: T_TRANS })}
                />
              )}
              <TransitionSeries.Sequence durationInFrames={frames + (i === planScenes.length - 1 ? 30 : 0)}>
                {renderLayout(scene, 0, audioPath)}
                <Caption text={scene.subtitle || scene.captionText || ""} />
              </TransitionSeries.Sequence>
            </React.Fragment>
          );
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
