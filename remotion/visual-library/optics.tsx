import type { CSSProperties, ReactNode } from "react";
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { TimedVisualProps } from "./types";
import { resolveTheme } from "./types";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const reveal = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

const settle = (frame: number, fps: number, delay = 0) =>
  spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 20, stiffness: 105, mass: 0.8 },
    durationInFrames: 28,
  });

const labelStyle = (color: string): CSSProperties => ({
  color,
  fontSize: 24,
  fontWeight: 850,
  lineHeight: 1.1,
  letterSpacing: 0,
});

const Stage = ({
  children,
  theme,
  style,
}: TimedVisualProps & { children: ReactNode }) => {
  const { palette, fontFamily } = resolveTheme(theme);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 560,
        overflow: "hidden",
        color: palette.text,
        fontFamily,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Moon = ({
  size,
  left,
  top,
  opacity = 1,
  scale = 1,
  glow = true,
  style,
}: {
  size: number;
  left: string | number;
  top: string | number;
  opacity?: number;
  scale?: number;
  glow?: boolean;
  style?: CSSProperties;
}) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      width: size,
      height: size,
      borderRadius: "50%",
      opacity,
      transform: `translate(-50%, -50%) scale(${scale})`,
      background:
        "radial-gradient(circle at 38% 34%, #fffde7 0 11%, #f6e7ab 33%, #d7bd73 70%, #9a7d3e 100%)",
      boxShadow: glow
        ? "0 0 32px rgba(255,244,188,0.82), 0 0 92px rgba(255,214,96,0.38)"
        : "0 8px 20px rgba(15,23,42,0.22)",
      overflow: "hidden",
      ...style,
    }}
  >
    <div
      style={{
        position: "absolute",
        width: "24%",
        height: "18%",
        borderRadius: "50%",
        left: "19%",
        top: "24%",
        background: "rgba(116,91,45,0.18)",
        transform: "rotate(-18deg)",
      }}
    />
    <div
      style={{
        position: "absolute",
        width: "17%",
        height: "13%",
        borderRadius: "50%",
        right: "20%",
        top: "45%",
        background: "rgba(116,91,45,0.2)",
        transform: "rotate(28deg)",
      }}
    />
    <div
      style={{
        position: "absolute",
        width: "28%",
        height: "13%",
        borderRadius: "50%",
        left: "31%",
        bottom: "17%",
        background: "rgba(116,91,45,0.14)",
        transform: "rotate(10deg)",
      }}
    />
  </div>
);

const CitySilhouette = ({
  color,
  opacity = 1,
  style,
}: {
  color: string;
  opacity?: number;
  style?: CSSProperties;
}) => (
  <svg
    viewBox="0 0 1000 220"
    preserveAspectRatio="none"
    style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 210, opacity, ...style }}
  >
    <path
      d="M0 210V165H60V116H102V158H148V80H198V146H232V126H274V173H318V95H366V137H402V56H458V151H500V112H548V176H588V134H626V89H680V148H726V119H772V164H820V72H878V144H922V104H970V167H1000V210Z"
      fill={color}
    />
    <path d="M0 210H1000" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
  </svg>
);

const TreeLine = ({ color, opacity = 1 }: { color: string; opacity?: number }) => (
  <svg
    viewBox="0 0 1000 180"
    preserveAspectRatio="none"
    style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 170, opacity }}
  >
    <path
      d="M0 180V140L38 98L58 130L91 70L121 132L156 88L193 139L232 61L269 129L304 84L340 135L376 66L412 128L451 77L488 142L526 58L563 132L601 92L639 140L682 64L719 130L761 82L802 137L843 59L884 131L925 88L963 136L1000 74V180Z"
      fill={color}
    />
  </svg>
);

const PhoneFrame = ({
  children,
  border,
  background,
  style,
}: {
  children: ReactNode;
  border: string;
  background: string;
  style?: CSSProperties;
}) => (
  <div
    style={{
      position: "relative",
      border: `8px solid ${border}`,
      borderRadius: 42,
      overflow: "hidden",
      background,
      boxShadow: "0 28px 80px rgba(15,23,42,0.22)",
      ...style,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 12,
        width: 92,
        height: 18,
        borderRadius: 999,
        transform: "translateX(-50%)",
        background: border,
        zIndex: 5,
      }}
    />
    {children}
  </div>
);

const CornerTicks = ({ color }: { color: string }) => (
  <>
    {([
      { position: { left: 22, top: 22 }, borderLeft: true, borderTop: true },
      { position: { right: 22, top: 22 }, borderRight: true, borderTop: true },
      { position: { left: 22, bottom: 22 }, borderLeft: true, borderBottom: true },
      { position: { right: 22, bottom: 22 }, borderRight: true, borderBottom: true },
    ] as const).map((tick, index) => (
      <div
        key={index}
        style={{
          position: "absolute",
          width: 48,
          height: 48,
          borderLeft: "borderLeft" in tick ? `4px solid ${color}` : undefined,
          borderRight: "borderRight" in tick ? `4px solid ${color}` : undefined,
          borderTop: "borderTop" in tick ? `4px solid ${color}` : undefined,
          borderBottom: "borderBottom" in tick ? `4px solid ${color}` : undefined,
          ...tick.position,
        }}
      />
    ))}
  </>
);

export const MoonPerceptionFrame = ({
  theme,
  mode = "compare",
  style,
}: TimedVisualProps & { mode?: "compare" | "closing" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette } = resolveTheme(theme);
  const leftEnter = settle(frame, fps, 0);
  const rightEnter = settle(frame, fps, 8);
  const lineProgress = reveal(frame, 12, 38);

  if (mode === "closing") {
    const moonEnter = settle(frame, fps, 4);
    const orbitProgress = reveal(frame, 15, 38);
    const controls = [
      { label: "焦距", x: 18, y: 30, color: palette.primary },
      { label: "构图", x: 79, y: 28, color: palette.secondary },
      { label: "参照物", x: 74, y: 76, color: palette.accent },
    ];
    return (
      <Stage theme={theme} style={style}>
        <div
          style={{
            position: "absolute",
            inset: 34,
            borderRadius: 28,
            background: "linear-gradient(180deg, #11233e 0%, #24466d 66%, #8ca5b5 100%)",
            overflow: "hidden",
          }}
        >
          <Moon size={310} left="50%" top="43%" scale={0.82 + moonEnter * 0.18} />
          <CitySilhouette color="#101925" style={{ height: 170 }} />
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 1600 700">
            <circle
              cx="800"
              cy="300"
              r="236"
              fill="none"
              stroke={palette.primary}
              strokeWidth="3"
              strokeDasharray="9 12"
              opacity={orbitProgress * 0.8}
            />
            {controls.map((control, index) => {
              const x = (control.x / 100) * 1600;
              const y = (control.y / 100) * 700;
              const local = reveal(frame, 18 + index * 7, 36 + index * 7);
              return (
                <g key={control.label} opacity={local}>
                  <line x1={x} y1={y} x2="800" y2="300" stroke={control.color} strokeWidth="3" opacity="0.7" />
                  <circle cx={x} cy={y} r="56" fill="rgba(8,18,34,0.82)" stroke={control.color} strokeWidth="4" />
                  <text x={x} y={y + 9} textAnchor="middle" fill="#ffffff" fontSize="27" fontWeight="850">
                    {control.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 42,
              transform: "translateX(-50%)",
              color: "#ffffff",
              fontSize: 30,
              fontWeight: 900,
              opacity: reveal(frame, 30, 48),
              textShadow: "0 4px 18px rgba(0,0,0,0.55)",
            }}
          >
            把大月亮拍回来
          </div>
        </div>
      </Stage>
    );
  }

  return (
    <Stage theme={theme} style={style}>
      <div
        style={{
          position: "absolute",
          left: 20,
          top: 28,
          bottom: 28,
          width: "54%",
          borderRadius: 30,
          overflow: "hidden",
          background: "linear-gradient(180deg, #172d4c 0%, #315b7a 68%, #a9b6b8 100%)",
          opacity: leftEnter,
          transform: `translateX(${(1 - leftEnter) * -48}px)`,
        }}
      >
        <div style={{ position: "absolute", left: 34, top: 30, ...labelStyle("#f8fafc") }}>肉眼感受</div>
        <Moon size={270} left="57%" top="37%" scale={0.82 + leftEnter * 0.18} />
        <CitySilhouette color="#101925" />
        <TreeLine color="#172331" opacity={0.92} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 20,
          top: 52,
          bottom: 52,
          width: "38%",
          opacity: rightEnter,
          transform: `translateX(${(1 - rightEnter) * 54}px)`,
        }}
      >
        <PhoneFrame border="#111827" background="#18304e" style={{ width: "100%", height: "100%" }}>
          <div style={{ position: "absolute", left: 26, top: 34, ...labelStyle("#f8fafc") }}>手机广角</div>
          <Moon size={38} left="52%" top="38%" glow={false} />
          <CitySilhouette color="#0b1320" style={{ height: 130 }} />
          <CornerTicks color="rgba(255,255,255,0.72)" />
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 22,
              width: 62,
              height: 62,
              borderRadius: "50%",
              transform: "translateX(-50%)",
              border: "5px solid rgba(255,255,255,0.9)",
              boxShadow: "inset 0 0 0 3px rgba(255,255,255,0.3)",
            }}
          />
        </PhoneFrame>
      </div>
      <div
        style={{
          position: "absolute",
          left: "55.7%",
          top: "16%",
          bottom: "16%",
          width: 3,
          background: `linear-gradient(180deg, transparent, ${palette.primary}, transparent)`,
          transform: `scaleY(${lineProgress})`,
          transformOrigin: "top",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 42,
          transform: "translateX(-50%)",
          color: palette.text,
          fontSize: 27,
          fontWeight: 900,
          opacity: reveal(frame, 26, 44),
          background: `${palette.panel}e8`,
          border: `1px solid ${palette.line}`,
          borderRadius: 999,
          padding: "12px 24px",
        }}
      >
        月亮没变，画面占比变了
      </div>
    </Stage>
  );
};

export const ReferenceScaleFrame = ({ theme, style }: TimedVisualProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette } = resolveTheme(theme);
  const worldEnter = settle(frame, fps, 0);
  const referenceEnter = settle(frame, fps, 12);
  const compare = reveal(frame, 28, 54);

  return (
    <Stage theme={theme} style={style}>
      <div
        style={{
          position: "absolute",
          inset: "22px 28px 34px",
          borderRadius: 30,
          overflow: "hidden",
          background: "linear-gradient(180deg, #10233d 0%, #345d78 62%, #b4b9a7 100%)",
          opacity: worldEnter,
        }}
      >
        <Moon size={238} left="51%" top="31%" scale={0.86 + worldEnter * 0.14} />
        <div
          style={{
            position: "absolute",
            left: 64,
            top: 54,
            color: "#ffffff",
            fontSize: 31,
            fontWeight: 900,
          }}
        >
          大脑不是单独看月亮
        </div>
        <div
          style={{
            position: "absolute",
            right: 56,
            top: 54,
            color: "#d9f4ff",
            fontSize: 24,
            fontWeight: 800,
            opacity: referenceEnter,
          }}
        >
          它会自动寻找比例参照
        </div>
        <CitySilhouette color="#121a25" opacity={referenceEnter} />
        <TreeLine color="#172331" opacity={referenceEnter * 0.95} />
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 1600 700">
          <g opacity={referenceEnter}>
            <line x1="610" y1="224" x2="610" y2="575" stroke={palette.secondary} strokeWidth="4" strokeDasharray="12 10" />
            <path d="M592 242L610 224L628 242M592 557L610 575L628 557" fill="none" stroke={palette.secondary} strokeWidth="4" />
            <text x="642" y="408" fill="#d9f4ff" fontSize="28" fontWeight="850">楼房高度</text>
            <line x1="822" y1="118" x2="1047" y2="118" stroke="#ffd86b" strokeWidth="4" />
            <path d="M840 101L822 118L840 135M1029 101L1047 118L1029 135" fill="none" stroke="#ffd86b" strokeWidth="4" />
            <text x="934" y="91" textAnchor="middle" fill="#fff1b5" fontSize="28" fontWeight="850">月亮直径</text>
          </g>
          <g opacity={compare}>
            <rect x="1190" y="200" width="310" height="250" rx="26" fill="rgba(8,18,34,0.78)" stroke="rgba(255,255,255,0.22)" />
            <circle cx="1345" cy="298" r="56" fill="#ead38b" />
            <line x1="1236" y1="390" x2="1454" y2="390" stroke="rgba(255,255,255,0.45)" strokeWidth="3" />
            <text x="1345" y="424" textAnchor="middle" fill="#ffffff" fontSize="25" fontWeight="800">没有参照时，震撼感下降</text>
          </g>
        </svg>
      </div>
    </Stage>
  );
};

export const AttentionFieldFrame = ({ theme, style }: TimedVisualProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette } = resolveTheme(theme);
  const eyeEnter = settle(frame, fps, 0);
  const focus = reveal(frame, 14, 46);
  const thoughtEnter = settle(frame, fps, 28);

  return (
    <Stage theme={theme} style={style}>
      <div
        style={{
          position: "absolute",
          left: 50,
          top: 40,
          bottom: 50,
          width: "40%",
          opacity: eyeEnter,
          transform: `translateX(${(1 - eyeEnter) * -40}px)`,
        }}
      >
        <svg viewBox="0 0 620 560" style={{ width: "100%", height: "100%" }}>
          <path
            d="M52 278C154 112 447 100 568 278C446 452 158 451 52 278Z"
            fill={`${palette.panel}ee`}
            stroke={palette.primary}
            strokeWidth="7"
          />
          <circle cx="310" cy="278" r="112" fill="#d7eef8" stroke={palette.secondary} strokeWidth="8" />
          <circle cx="310" cy="278" r={72 - focus * 18} fill="#16263c" />
          <circle cx="286" cy="252" r="18" fill="#ffffff" opacity="0.88" />
          <path d="M310 390C360 430 400 462 466 488" fill="none" stroke={palette.primary} strokeWidth="6" strokeDasharray="12 10" />
          <text x="310" y="66" textAnchor="middle" fill={palette.text} fontSize="34" fontWeight="900">注意力自动收窄</text>
        </svg>
      </div>
      <div
        style={{
          position: "absolute",
          right: 40,
          top: 28,
          bottom: 42,
          width: "54%",
          borderRadius: 34,
          overflow: "hidden",
          background: "linear-gradient(180deg, #172d4c 0%, #315b7a 68%, #a9b6b8 100%)",
          opacity: thoughtEnter,
          transform: `translateX(${(1 - thoughtEnter) * 44}px)`,
        }}
      >
        <Moon size={225} left="55%" top="40%" scale={0.78 + focus * 0.22} />
        <CitySilhouette color="#101925" />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 55% 40%, transparent ${14 + focus * 9}%, rgba(7,16,29,${0.64 - focus * 0.18}) ${29 + focus * 8}%, rgba(7,16,29,0.82) 72%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "55%",
            top: "40%",
            width: 290 + focus * 90,
            height: 290 + focus * 90,
            borderRadius: "50%",
            border: `3px solid rgba(255,226,129,${0.35 + focus * 0.45})`,
            transform: "translate(-50%, -50%)",
          }}
        />
        <div style={{ position: "absolute", left: 38, bottom: 34, color: "#9fb4c9", fontSize: 25, fontWeight: 800 }}>
          背景降权
        </div>
        <div style={{ position: "absolute", right: 38, top: 34, color: "#fff0aa", fontSize: 27, fontWeight: 900 }}>
          月亮提权
        </div>
      </div>
    </Stage>
  );
};

export const FieldOfViewFrame = ({
  theme,
  mode = "wide",
  style,
}: TimedVisualProps & { mode?: "wide" | "narrow" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette } = resolveTheme(theme);
  const cameraEnter = settle(frame, fps, 0);
  const cone = reveal(frame, 8, 38);
  const targetEnter = settle(frame, fps, 20);
  const narrow = mode === "narrow";
  const upper = narrow ? 250 : 95;
  const lower = narrow ? 450 : 605;
  const moonRadius = narrow ? 96 : 30;

  return (
    <Stage theme={theme} style={style}>
      <svg viewBox="0 0 1600 700" style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id={`fov-cone-${mode}`} x1="0" x2="1">
            <stop offset="0" stopColor={palette.primary} stopOpacity="0.12" />
            <stop offset="1" stopColor={palette.secondary} stopOpacity="0.34" />
          </linearGradient>
        </defs>
        <g opacity={cameraEnter} transform={`translate(${(1 - cameraEnter) * -55} 0)`}>
          <rect x="82" y="236" width="258" height="226" rx="34" fill={palette.panel} stroke={palette.line} strokeWidth="5" />
          <rect x="252" y="275" width="122" height="150" rx="26" fill={palette.text} />
          <circle cx="315" cy="350" r="48" fill="#233b5c" stroke={palette.secondary} strokeWidth="5" />
          <circle cx="315" cy="350" r="21" fill="#081321" />
          <rect x="128" y="194" width="104" height="52" rx="16" fill={palette.text} />
          <text x="211" y="500" textAnchor="middle" fill={palette.text} fontSize="30" fontWeight="900">手机镜头</text>
        </g>
        <path
          d={`M374 316 L${420 + cone * 900} ${350 - (350 - upper) * cone} L${420 + cone * 900} ${350 + (lower - 350) * cone} L374 384 Z`}
          fill={`url(#fov-cone-${mode})`}
          stroke={palette.primary}
          strokeWidth="4"
          opacity={cone}
        />
        <line x1="374" y1="350" x2={420 + cone * 900} y2="350" stroke={palette.muted} strokeWidth="3" strokeDasharray="12 10" opacity={cone} />
        <g opacity={targetEnter}>
          <rect x="1318" y="76" width="210" height="548" rx="30" fill="#17304d" stroke={palette.line} strokeWidth="4" />
          <circle cx="1423" cy="350" r={moonRadius} fill="#ead38b" />
          <path d="M1334 550H1512" stroke="#0d1928" strokeWidth="44" />
          <path d="M1365 550V470M1415 550V435M1470 550V490" stroke="#0d1928" strokeWidth="30" />
        </g>
        <g opacity={reveal(frame, 25, 48)}>
          <path
            d={narrow ? "M705 256A190 190 0 0 1 705 444" : "M610 112A330 330 0 0 1 610 588"}
            fill="none"
            stroke={palette.warning}
            strokeWidth="7"
          />
          <text x={narrow ? 770 : 705} y="335" fill={palette.warning} fontSize="38" fontWeight="950">
            {narrow ? "更窄视场" : "几十度视野"}
          </text>
          <text x={narrow ? 770 : 705} y="382" fill={palette.muted} fontSize="26" fontWeight="800">
            {narrow ? "同一月亮，占比变大" : "大量天空同时进入画面"}
          </text>
        </g>
      </svg>
    </Stage>
  );
};

export const AngularDiameterFrame = ({ theme, style }: TimedVisualProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette } = resolveTheme(theme);
  const scaleEnter = settle(frame, fps, 0);
  const angleProgress = reveal(frame, 10, 42);
  const pixelReveal = reveal(frame, 30, 58);
  const cells = Array.from({ length: 48 }, (_, index) => index);

  return (
    <Stage theme={theme} style={style}>
      <svg viewBox="0 0 1600 700" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <g opacity={scaleEnter}>
          <circle cx="540" cy="350" r="238" fill="none" stroke={palette.line} strokeWidth="3" />
          {Array.from({ length: 36 }, (_, index) => {
            const angle = (index * 10 - 90) * (Math.PI / 180);
            const x1 = 540 + Math.cos(angle) * 218;
            const y1 = 350 + Math.sin(angle) * 218;
            const x2 = 540 + Math.cos(angle) * (index % 3 === 0 ? 238 : 229);
            const y2 = 350 + Math.sin(angle) * (index % 3 === 0 ? 238 : 229);
            return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke={palette.muted} strokeWidth={index % 3 === 0 ? 4 : 2} />;
          })}
          <circle cx="540" cy="350" r="17" fill={palette.text} />
          <line x1="540" y1="350" x2="1170" y2={348 - angleProgress * 18} stroke={palette.primary} strokeWidth="5" />
          <line x1="540" y1="350" x2="1170" y2={352 + angleProgress * 18} stroke={palette.primary} strokeWidth="5" />
          <path d="M790 342A252 252 0 0 1 790 358" fill="none" stroke={palette.warning} strokeWidth="8" />
          <text x="815" y="318" fill={palette.warning} fontSize="54" fontWeight="960">≈ 0.5°</text>
          <text x="814" y="366" fill={palette.muted} fontSize="26" fontWeight="800">月亮的角直径</text>
          <circle cx="1170" cy="350" r="43" fill="#ead38b" stroke="#fff2bc" strokeWidth="4" />
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          right: 48,
          top: 82,
          width: 360,
          height: 480,
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gridTemplateRows: "repeat(8, 1fr)",
          gap: 5,
          opacity: pixelReveal,
          transform: `translateX(${(1 - pixelReveal) * 38}px)`,
        }}
      >
        {cells.map((cell) => {
          const row = Math.floor(cell / 6);
          const col = cell % 6;
          const isMoon = (row === 3 || row === 4) && (col === 2 || col === 3);
          return (
            <div
              key={cell}
              style={{
                borderRadius: 5,
                background: isMoon ? "#ead38b" : `${palette.primary}12`,
                border: `1px solid ${isMoon ? "#fff0a7" : palette.line}`,
              }}
            />
          );
        })}
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: -52,
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            color: palette.text,
            fontSize: 26,
            fontWeight: 900,
          }}
        >
          整张照片里，只占少量像素
        </div>
      </div>
    </Stage>
  );
};

export const DistanceMythFrame = ({ theme, style }: TimedVisualProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette } = resolveTheme(theme);
  const pathProgress = reveal(frame, 2, 38);
  const personEnter = settle(frame, fps, 6);
  const verdict = settle(frame, fps, 30);
  const positions = [250, 410, 570, 730];

  return (
    <Stage theme={theme} style={style}>
      <svg viewBox="0 0 1600 700" style={{ width: "100%", height: "100%" }}>
        <path d="M90 570H1510" stroke={palette.line} strokeWidth="8" strokeLinecap="round" />
        <path
          d={`M230 530H${230 + 560 * pathProgress}`}
          stroke={palette.primary}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="16 14"
        />
        <g opacity={personEnter}>
          {positions.map((x, index) => {
            const local = reveal(frame, 8 + index * 6, 22 + index * 6);
            return (
              <g key={x} opacity={local}>
                <circle cx={x} cy="438" r="24" fill={palette.text} />
                <path d={`M${x} 464V520M${x} 480L${x - 34} 506M${x} 480L${x + 36} 502M${x} 520L${x - 28} 558M${x} 520L${x + 31} 558`} stroke={palette.text} strokeWidth="12" strokeLinecap="round" />
                <rect x={x + 38} y="447" width="24" height="43" rx="6" fill={palette.primary} />
              </g>
            );
          })}
          <text x="480" y="625" textAnchor="middle" fill={palette.muted} fontSize="27" fontWeight="850">向前走几步</text>
        </g>
        <g>
          <circle cx="1360" cy="182" r="112" fill="#ead38b" stroke="#fff0aa" strokeWidth="5" />
          <line x1="250" y1="438" x2="1348" y2="220" stroke={palette.secondary} strokeWidth="3" opacity="0.55" />
          <line x1="730" y1="438" x2="1348" y2="220" stroke={palette.secondary} strokeWidth="3" opacity="0.55" />
          <path d="M1196 220A170 170 0 0 1 1198 258" fill="none" stroke={palette.warning} strokeWidth="6" />
          <text x="1090" y="182" textAnchor="middle" fill={palette.warning} fontSize="32" fontWeight="950">角度几乎不变</text>
        </g>
        <g opacity={verdict} transform={`translate(${(1 - verdict) * 48} 0)`}>
          <rect x="872" y="404" width="600" height="150" rx="30" fill={palette.panel} stroke={palette.primary} strokeWidth="4" />
          <text x="924" y="458" fill={palette.muted} fontSize="24" fontWeight="850">真正有效的动作</text>
          <text x="924" y="510" fill={palette.text} fontSize="42" fontWeight="960">缩小取景范围</text>
          <path d="M1320 456L1405 456M1376 427L1405 456L1376 485" fill="none" stroke={palette.primary} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </Stage>
  );
};

export const ZoomCropFrame = ({ theme, style }: TimedVisualProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette } = resolveTheme(theme);
  const frames = [
    { label: "广角", moon: 42, color: palette.muted, delay: 0 },
    { label: "光学变焦", moon: 116, color: palette.primary, delay: 10 },
    { label: "后期裁切", moon: 176, color: palette.accent, delay: 20 },
  ];

  return (
    <Stage theme={theme} style={style}>
      <div
        style={{
          position: "absolute",
          inset: "36px 34px 58px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          alignItems: "center",
          gap: 0,
        }}
      >
        {frames.map((item, index) => {
          const enter = settle(frame, fps, item.delay);
          const zoom = reveal(frame, item.delay + 10, item.delay + 36);
          return (
            <div
              key={item.label}
              style={{
                position: "relative",
                height: 480,
                opacity: enter,
                transform: `translateY(${(1 - enter) * 42}px) rotate(${(index - 1) * 1.6}deg)`,
                transformOrigin: "center",
                zIndex: index + 1,
                marginLeft: index === 0 ? 0 : -28,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  border: `7px solid ${item.color}`,
                  borderRadius: 28,
                  overflow: "hidden",
                  background: "linear-gradient(180deg, #16304f 0%, #315b7a 68%, #a9b6b8 100%)",
                  boxShadow: "0 24px 58px rgba(15,23,42,0.2)",
                }}
              >
                <Moon size={item.moon} left="54%" top="39%" scale={0.84 + zoom * 0.16} />
                <CitySilhouette color="#101925" style={{ height: 122 + index * 12 }} />
                {index === 2 ? <CornerTicks color="rgba(255,255,255,0.82)" /> : null}
                <div
                  style={{
                    position: "absolute",
                    left: 24,
                    top: 24,
                    color: "#ffffff",
                    fontSize: 27,
                    fontWeight: 920,
                    textShadow: "0 3px 12px rgba(0,0,0,0.5)",
                  }}
                >
                  {item.label}
                </div>
              </div>
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: -52,
                  transform: "translateX(-50%)",
                  color: item.color,
                  fontSize: 25,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                画面占比 {index === 0 ? "小" : index === 1 ? "变大" : "最大"}
              </div>
            </div>
          );
        })}
      </div>
      <svg viewBox="0 0 1600 700" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <path d="M490 345H610M575 314L610 345L575 376" fill="none" stroke={palette.secondary} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity={reveal(frame, 18, 36)} />
        <path d="M1000 345H1120M1085 314L1120 345L1085 376" fill="none" stroke={palette.secondary} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity={reveal(frame, 29, 47)} />
      </svg>
    </Stage>
  );
};

export const MoonCompositionFrame = ({
  theme,
  mode = "reframe",
  style,
}: TimedVisualProps & { mode?: "reframe" | "controls" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette } = resolveTheme(theme);
  const wideEnter = settle(frame, fps, 0);
  const crop = reveal(frame, 15, 48);

  if (mode === "controls") {
    const items = [
      { label: "焦距", note: "缩小视场", color: palette.primary, angle: -145 },
      { label: "构图", note: "控制占比", color: palette.secondary, angle: -35 },
      { label: "参照物", note: "建立尺度", color: palette.accent, angle: 86 },
    ];
    return (
      <Stage theme={theme} style={style}>
        <Moon size={260} left="50%" top="42%" scale={0.84 + settle(frame, fps, 4) * 0.16} />
        <svg viewBox="0 0 1600 700" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <circle cx="800" cy="290" r="238" fill="none" stroke={palette.line} strokeWidth="3" strokeDasharray="10 12" />
          {items.map((item, index) => {
            const rad = item.angle * (Math.PI / 180);
            const x = 800 + Math.cos(rad) * 360;
            const y = 290 + Math.sin(rad) * 250;
            const enter = settle(frame, fps, 14 + index * 8);
            return (
              <g key={item.label} opacity={enter} transform={`translate(${(1 - enter) * (x < 800 ? -36 : 36)} 0)`}>
                <line x1={x} y1={y} x2="800" y2="290" stroke={item.color} strokeWidth="4" opacity="0.7" />
                <circle cx={x} cy={y} r="74" fill={palette.panel} stroke={item.color} strokeWidth="5" />
                <text x={x} y={y - 4} textAnchor="middle" fill={palette.text} fontSize="31" fontWeight="950">{item.label}</text>
                <text x={x} y={y + 31} textAnchor="middle" fill={palette.muted} fontSize="20" fontWeight="800">{item.note}</text>
              </g>
            );
          })}
          <path d="M170 580H1430" stroke={palette.text} strokeWidth="32" strokeLinecap="round" />
          <path d="M230 580V500M420 580V456M1180 580V478M1380 580V520" stroke={palette.text} strokeWidth="34" />
        </svg>
      </Stage>
    );
  }

  return (
    <Stage theme={theme} style={style}>
      <div
        style={{
          position: "absolute",
          inset: "32px 34px 42px",
          borderRadius: 30,
          overflow: "hidden",
          background: "linear-gradient(180deg, #162e4c 0%, #315b7a 68%, #a9b6b8 100%)",
          opacity: wideEnter,
        }}
      >
        <Moon size={94 + crop * 142} left="52%" top="39%" />
        <CitySilhouette color="#101925" style={{ height: 150 + crop * 34 }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${crop * 22}%`,
            background: "rgba(4,10,18,0.86)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: `${crop * 22}%`,
            background: "rgba(4,10,18,0.86)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${crop * 22}%`,
            right: `${crop * 22}%`,
            top: 0,
            bottom: 0,
            borderLeft: `4px solid rgba(255,255,255,${crop * 0.72})`,
            borderRight: `4px solid rgba(255,255,255,${crop * 0.72})`,
          }}
        />
        <div style={{ position: "absolute", left: 34, top: 28, color: "#ffffff", fontSize: 27, fontWeight: 900 }}>
          取景范围
        </div>
        <div
          style={{
            position: "absolute",
            right: 34,
            top: 28,
            color: "#fff0aa",
            fontSize: 28,
            fontWeight: 920,
            opacity: reveal(frame, 28, 48),
          }}
        >
          天空变窄，月亮自然变大
        </div>
      </div>
    </Stage>
  );
};
