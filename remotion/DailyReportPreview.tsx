import { AbsoluteFill, Audio, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const fullDuration = 95.3;

const captions = [
  { start: 0.191, end: 4.384, text: "今天 AI 圈最值得看的，不是哪个模型又刷榜了。" },
  { start: 4.384, end: 5.146, text: "是三星。" },
  { start: 5.146, end: 8.767, text: "7 月 7 日，三星电子公布二季度业绩预告，" },
  { start: 8.767, end: 11.816, text: "营业利润预计约 89.4 万亿韩元。" },
  { start: 11.816, end: 13.341, text: "按现在的汇率算，" },
  { start: 13.341, end: 18.677, text: "已经高过英伟达上一季度大约 535.36 亿美元的营业利润。" },
  { start: 18.677, end: 20.392, text: "这个数字有点反常。" },
  { start: 20.392, end: 24.584, text: "过去两年，大家讲 AI 硬件，基本都盯着 GPU。" },
  { start: 24.584, end: 28.205, text: "英伟达是主角，算力是主线，故事也很顺。" },
  { start: 28.205, end: 31.826, text: "但 AI 数据中心不是只靠 GPU 跑起来的。" },
  { start: 31.826, end: 37.734, text: "GPU 要吃数据，要靠高带宽内存，也要靠高性能 DRAM 扛住吞吐。" },
  { start: 37.734, end: 43.832, text: "训练模型、跑推理、扩数据中心，最后都会把需求传到存储芯片这一层。" },
  { start: 43.832, end: 48.787, text: "所以三星这次业绩预期冲上来，背后不是单纯的周期反弹。" },
  { start: 48.787, end: 54.695, text: "HBM 需求在涨，高性能 DRAM 需求在涨，存储芯片价格也在回升。" },
  { start: 54.695, end: 59.459, text: "AI 基建这条链路里，存储环节开始分到更大一块蛋糕。" },
  { start: 59.459, end: 63.461, text: "再看今天其他消息，也基本都在同一个方向上。" },
  { start: 63.461, end: 68.607, text: "Codex 继续接入更强模型，AI 抢工作的话题开始降温，" },
  { start: 68.607, end: 73.181, text: "AI 伴侣功能被平台收紧，GLM 榜单争议还在发酵，" },
  { start: 73.181, end: 75.849, text: "Token 消耗榜也在换位置。" },
  { start: 75.849, end: 80.232, text: "模型还重要，但单靠模型已经讲不完 AI 的故事了。" },
  { start: 80.232, end: 86.521, text: "下一阶段，真正要看的，是应用、算力、存储、监管和成本怎么一起变化。" },
  { start: 86.521, end: 89.189, text: "今天这条新闻的重点就一句话：" },
  { start: 89.189, end: 91.857, text: "GPU 还是焦点，但存储芯片，" },
  { start: 91.857, end: 95.287, text: "正在成为 AI 基建周期里新的受益位置。" },
];

const useSceneFrame = (offsetSeconds: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return Math.max(0, frame - offsetSeconds * fps);
};

const useSceneOpacity = (start: number, end: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  const fade = 0.55;
  return Math.min(
    interpolate(seconds, [start, start + fade], [0, 1], clamp),
    interpolate(seconds, [end - fade, end], [1, 0], clamp),
  );
};

const MoneyCounter = ({
  value,
  suffix,
  delay = 0,
  color,
}: {
  value: number;
  suffix: string;
  delay?: number;
  color: string;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay * fps,
    fps,
    config: { damping: 32, stiffness: 85, mass: 0.7 },
  });
  const shown = Math.max(0, value * progress).toFixed(value > 100 ? 2 : 1);

  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span style={{ color, fontSize: 72, fontWeight: 860, letterSpacing: 0 }}>{shown}</span>
      <span style={{ color, fontSize: 28, fontWeight: 760 }}>{suffix}</span>
    </div>
  );
};

const Subtitle = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  const current = captions.find((caption) => seconds >= caption.start && seconds < caption.end);
  const opacity = current ? interpolate(seconds, [current.start, current.start + 0.18], [0, 1], clamp) : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: 250,
        right: 250,
        bottom: 54,
        height: 98,
        borderRadius: 24,
        background: "rgba(9, 20, 43, 0.82)",
        boxShadow: "0 22px 60px rgba(15, 23, 42, 0.24)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 44px",
        opacity,
        zIndex: 40,
      }}
    >
      <div style={{ fontSize: 34, lineHeight: 1.25, fontWeight: 720, textAlign: "center", letterSpacing: 0 }}>{current?.text ?? ""}</div>
    </div>
  );
};

const Background = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 450], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #eff7ff 0%, #f9fcff 48%, #e8f2ff 100%)", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(37,99,235,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.08) 1px, transparent 1px)",
          backgroundSize: "74px 74px",
          transform: `translate(${drift * -18}px, ${drift * 12}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 880,
          height: 520,
          right: -210,
          top: -160,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(20,184,166,0.22), rgba(37,99,235,0.06) 52%, transparent 72%)",
          transform: `translateY(${drift * 24}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 680,
          height: 420,
          left: -120,
          bottom: 80,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245,158,11,0.14), rgba(37,99,235,0.05) 55%, transparent 76%)",
          transform: `translateX(${drift * 18}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

const MarketTicker = () => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 450], [0, -260], clamp);
  const items = ["HBM demand +", "DRAM price rebound", "AI data center capex", "memory cycle", "GPU supply chain"];

  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 42, overflow: "hidden", height: 44 }}>
      <div style={{ display: "flex", gap: 14, transform: `translateX(${x}px)` }}>
        {[...items, ...items].map((item, index) => (
          <div
            key={`${item}-${index}`}
            style={{
              flex: "0 0 auto",
              border: "1px solid rgba(37,99,235,0.20)",
              background: "rgba(255,255,255,0.62)",
              color: "#1d4ed8",
              borderRadius: 999,
              padding: "9px 18px",
              fontSize: 18,
              fontWeight: 760,
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};

const SectionTitle = ({ eyebrow, title, right }: { eyebrow: string; title: string; right?: string }) => (
  <div style={{ position: "absolute", left: 92, top: 74, right: 92, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <div>
      <div style={{ color: "#2563eb", fontSize: 22, fontWeight: 900, letterSpacing: 0 }}>{eyebrow}</div>
      <div style={{ color: "#101827", fontSize: 48, fontWeight: 900, marginTop: 8, letterSpacing: 0 }}>{title}</div>
    </div>
    {right ? <div style={{ borderRadius: 999, background: "rgba(255,255,255,0.76)", border: "1px solid rgba(37,99,235,0.18)", color: "#475569", padding: "13px 22px", fontSize: 20, fontWeight: 800 }}>{right}</div> : null}
  </div>
);

const MiniRack = ({ x, y, progress, color }: { x: number; y: number; progress: number; color: string }) => (
  <div style={{ position: "absolute", left: x, top: y, width: 104, height: 158 }}>
    {[0, 1, 2, 3].map((i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: 0,
          top: i * 36,
          width: 104,
          height: 26,
          borderRadius: 7,
          background: "rgba(255,255,255,0.78)",
          border: `1px solid ${color}55`,
          transform: `translateX(${(1 - progress) * (16 + i * 4)}px)`,
          opacity: Math.max(0.2, progress),
        }}
      >
        <div style={{ width: `${28 + progress * (46 + i * 7)}%`, height: 6, margin: "9px 10px", borderRadius: 999, background: color }} />
      </div>
    ))}
  </div>
);

const EventOpen = () => {
  const frame = useSceneFrame(0);
  const { fps } = useVideoConfig();
  const titleIn = interpolate(frame, [0.25 * fps, 1.15 * fps], [34, 0], { ...clamp, easing: ease });
  const titleOpacity = interpolate(frame, [0.15 * fps, 0.95 * fps], [0, 1], { ...clamp, easing: ease });
  const panelIn = spring({ frame: frame - 0.55 * fps, fps, config: { damping: 30, stiffness: 90 } });
  const chipIn = spring({ frame: frame - 1.05 * fps, fps, config: { damping: 28, stiffness: 80 } });
  const lineProgress = interpolate(frame, [2.1 * fps, 5.8 * fps], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ opacity: interpolate(frame, [7 * fps, 8 * fps], [1, 0], clamp) }}>
      <MarketTicker />

      <div
        style={{
          position: "absolute",
          left: 112,
          top: 142,
          width: 1010,
          height: 610,
          borderRadius: 38,
          background: "rgba(255,255,255,0.78)",
          border: "1px solid rgba(37,99,235,0.20)",
          boxShadow: "0 32px 92px rgba(30, 64, 175, 0.15)",
          transform: `translateY(${(1 - panelIn) * 54}px) scale(${0.96 + panelIn * 0.04})`,
          opacity: panelIn,
          padding: 48,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 34 }}>
          <div style={{ background: "#2563eb", color: "white", borderRadius: 16, padding: "10px 18px", fontSize: 24, fontWeight: 820 }}>2026.7.7</div>
          <div style={{ color: "#0f172a", fontSize: 25, fontWeight: 760 }}>AI 日报主事件</div>
          <div style={{ height: 2, flex: 1, background: "linear-gradient(90deg, rgba(37,99,235,0.45), transparent)" }} />
        </div>

        <div style={{ transform: `translateY(${titleIn}px)`, opacity: titleOpacity }}>
          <div style={{ color: "#ef4444", fontSize: 74, lineHeight: 1.03, fontWeight: 900, letterSpacing: 0 }}>三星利润超越英伟达？</div>
          <div style={{ marginTop: 26, color: "#101827", fontSize: 40, lineHeight: 1.28, fontWeight: 760, width: 820 }}>
            AI 硬件红利正在从 GPU 扩散到存储芯片
          </div>
        </div>

        <div style={{ position: "absolute", left: 48, right: 48, bottom: 42, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
          {["二季度业绩预告", "AI产业链利润分配", "存储芯片红利"].map((label, index) => {
            const cardIn = spring({ frame: frame - (1.6 + index * 0.25) * fps, fps, config: { damping: 26, stiffness: 110 } });
            return (
              <div
                key={label}
                style={{
                  borderRadius: 22,
                  border: "1px solid rgba(20,184,166,0.24)",
                  background: "linear-gradient(180deg, rgba(240,253,250,0.9), rgba(255,255,255,0.78))",
                  padding: "24px 24px",
                  transform: `translateY(${(1 - cardIn) * 24}px)`,
                  opacity: cardIn,
                }}
              >
                <div style={{ color: "#14b8a6", fontSize: 18, fontWeight: 820 }}>SIGNAL {index + 1}</div>
                <div style={{ color: "#111827", fontSize: 27, fontWeight: 840, marginTop: 8 }}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 110,
          top: 170,
          width: 560,
          height: 520,
          transform: `translateX(${(1 - chipIn) * 70}px) scale(${0.88 + chipIn * 0.12})`,
          opacity: chipIn,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 44,
            background: "linear-gradient(145deg, rgba(15,23,42,0.95), rgba(30,64,175,0.88))",
            boxShadow: "0 34px 90px rgba(15,23,42,0.28)",
            transform: "rotate(-2deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 58,
            top: 54,
            width: 230,
            height: 70,
            borderRadius: 12,
            background: "rgba(255,255,255,0.96)",
            color: "#1d4ed8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            fontWeight: 920,
            letterSpacing: 5,
          }}
        >
          SAMSUNG
        </div>
        <div style={{ position: "absolute", left: 58, top: 152, color: "white", fontSize: 42, fontWeight: 880 }}>Memory Stack</div>
        <div style={{ position: "absolute", left: 58, top: 216, color: "rgba(255,255,255,0.68)", fontSize: 25, lineHeight: 1.34, width: 360 }}>
          HBM / DRAM / AI Data Center
        </div>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 72 + i * 92,
              bottom: 74 + i * 14,
              width: 210,
              height: 58,
              borderRadius: 14,
              background: `rgba(${20 + i * 30}, ${184 - i * 18}, ${166 + i * 20}, 0.78)`,
              border: "1px solid rgba(255,255,255,0.32)",
              transform: `translateY(${(1 - interpolate(lineProgress, [i * 0.18, i * 0.18 + 0.38], [0, 1], clamp)) * 24}px)`,
            }}
          />
        ))}
      </div>

      <svg style={{ position: "absolute", left: 112, top: 784, width: 1680, height: 116, overflow: "visible" }}>
        <path d="M0 58 C260 22, 430 76, 650 42 S1030 34, 1240 72 S1500 38, 1680 52" fill="none" stroke="#2563eb" strokeWidth="5" strokeLinecap="round" opacity="0.2" />
        <path
          d="M0 58 C260 22, 430 76, 650 42 S1030 34, 1240 72 S1500 38, 1680 52"
          fill="none"
          stroke="#14b8a6"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${lineProgress * 2200} 2200`}
        />
      </svg>
    </AbsoluteFill>
  );
};

const ComparisonBar = ({ label, value, max, color, delay }: { label: string; value: string; max: number; color: string; delay: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay * fps, fps, config: { damping: 35, stiffness: 95 } });
  const height = 32 + max * progress;

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 360, gap: 16 }}>
      <div
        style={{
          height,
          width: 112,
          borderRadius: "30px 30px 18px 18px",
          background: `linear-gradient(180deg, ${color}, rgba(255,255,255,0.86))`,
          boxShadow: `0 26px 54px ${color}33`,
          border: "1px solid rgba(255,255,255,0.72)",
        }}
      />
      <div style={{ color: "#0f172a", fontSize: 18, fontWeight: 820, textAlign: "center" }}>{label}</div>
      <div style={{ color, fontSize: 16, fontWeight: 850, textAlign: "center" }}>{value}</div>
    </div>
  );
};

const ProfitComparison = () => {
  const frame = useSceneFrame(8);
  const { fps } = useVideoConfig();
  const sceneIn = useSceneOpacity(8, 24);
  const scan = interpolate(frame, [1.3 * fps, 6.5 * fps], [-280, 1120], clamp);

  return (
    <AbsoluteFill style={{ opacity: sceneIn }}>
      <div
        style={{
          position: "absolute",
          left: 92,
          top: 124,
          right: 92,
          bottom: 178,
          borderRadius: 42,
          background: "rgba(255,255,255,0.82)",
          border: "1px solid rgba(37,99,235,0.22)",
          boxShadow: "0 34px 100px rgba(30,64,175,0.16)",
          overflow: "hidden",
          transform: `scale(${0.96 + sceneIn * 0.04}) translateY(${(1 - sceneIn) * 38}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 240,
            left: scan,
            background: "linear-gradient(90deg, transparent, rgba(20,184,166,0.18), transparent)",
            transform: "skewX(-12deg)",
          }}
        />
        <div style={{ position: "absolute", left: 48, top: 42, right: 48, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#2563eb", fontSize: 22, fontWeight: 900 }}>PROFIT SIGNAL</div>
            <div style={{ color: "#101827", fontSize: 48, fontWeight: 900, marginTop: 8 }}>营业利润反常对比</div>
          </div>
          <div style={{ borderRadius: 999, background: "#fff7ed", color: "#c2410c", padding: "14px 22px", fontSize: 22, fontWeight: 850 }}>市场讨论点，不做财务归一化结论</div>
        </div>

        <div style={{ position: "absolute", left: 56, top: 166, width: 690, height: 470, borderRadius: 32, background: "linear-gradient(180deg, rgba(239,246,255,0.92), rgba(255,255,255,0.74))", border: "1px solid rgba(37,99,235,0.16)", padding: 34 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Img src={staticFile("thinkai/samsung.svg")} style={{ width: 210, height: 56, objectFit: "contain" }} />
            <div style={{ color: "#64748b", fontSize: 20, fontWeight: 760 }}>2026 Q2 预告</div>
          </div>
          <div style={{ marginTop: 74 }}>
            <MoneyCounter value={89.4} suffix="万亿韩元" color="#2563eb" delay={8.5} />
            <div style={{ marginTop: 22, color: "#334155", fontSize: 28, fontWeight: 760 }}>AI 存储需求推动盈利弹性</div>
          </div>
          <div style={{ position: "absolute", left: 34, right: 34, bottom: 32, display: "flex", gap: 12 }}>
            {["HBM", "DRAM", "PRICE"].map((tag) => (
              <div key={tag} style={{ borderRadius: 999, background: "rgba(37,99,235,0.10)", color: "#1d4ed8", padding: "12px 18px", fontSize: 19, fontWeight: 850 }}>{tag}</div>
            ))}
          </div>
        </div>

        <div style={{ position: "absolute", right: 56, top: 166, width: 690, height: 470, borderRadius: 32, background: "linear-gradient(180deg, rgba(248,250,252,0.94), rgba(255,255,255,0.74))", border: "1px solid rgba(15,23,42,0.14)", padding: 34 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Img src={staticFile("thinkai/nvidia.svg")} style={{ width: 210, height: 56, objectFit: "contain" }} />
            <div style={{ color: "#64748b", fontSize: 20, fontWeight: 760 }}>上一季度</div>
          </div>
          <div style={{ marginTop: 74 }}>
            <MoneyCounter value={535.36} suffix="亿美元" color="#16a34a" delay={9.0} />
            <div style={{ marginTop: 22, color: "#334155", fontSize: 28, fontWeight: 760 }}>GPU 仍是 AI 算力中心</div>
          </div>
          <div style={{ position: "absolute", left: 34, right: 34, bottom: 32, height: 10, borderRadius: 999, background: "#e2e8f0" }}>
            <div style={{ width: `${interpolate(frame, [1.2 * fps, 4.2 * fps], [0, 86], clamp)}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #16a34a, #84cc16)" }} />
          </div>
        </div>

        <div style={{ position: "absolute", left: 790, top: 638, width: 300, height: 170, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 30 }}>
          <ComparisonBar label="Samsung" value="89.4T KRW" max={92} color="#2563eb" delay={9.1} />
          <ComparisonBar label="NVIDIA" value="53.536B USD" max={72} color="#16a34a" delay={9.4} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const InfraTimeline = () => {
  const opacity = useSceneOpacity(24, 40);
  const frame = useSceneFrame(24);
  const { fps } = useVideoConfig();
  const progress = interpolate(frame, [0.5 * fps, 14 * fps], [0, 1], clamp);
  const nodes = [
    { label: "算力需求", sub: "GPU 扩张", x: 190, color: "#2563eb" },
    { label: "数据中心", sub: "机柜上量", x: 560, color: "#14b8a6" },
    { label: "HBM / DRAM", sub: "吞吐瓶颈", x: 930, color: "#f59e0b" },
    { label: "存储价格", sub: "曲线回升", x: 1300, color: "#ef4444" },
  ];

  return (
    <AbsoluteFill style={{ opacity }}>
      <SectionTitle eyebrow="INFRA TIMELINE" title="红利从算力传导到存储" right="时间线解释，不复读字幕" />
      <div style={{ position: "absolute", left: 92, top: 190, right: 92, bottom: 178, borderRadius: 42, background: "rgba(255,255,255,0.78)", border: "1px solid rgba(37,99,235,0.20)", boxShadow: "0 34px 100px rgba(30,64,175,0.14)", overflow: "hidden" }}>
        <svg style={{ position: "absolute", left: 120, top: 250, width: 1480, height: 220, overflow: "visible" }}>
          <path d="M0 90 C230 28, 360 150, 540 86 S860 58, 1110 112 S1320 64, 1480 90" fill="none" stroke="rgba(37,99,235,0.16)" strokeWidth="18" strokeLinecap="round" />
          <path d="M0 90 C230 28, 360 150, 540 86 S860 58, 1110 112 S1320 64, 1480 90" fill="none" stroke="url(#timelineGradient)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${progress * 2300} 2300`} />
          <defs>
            <linearGradient id="timelineGradient" x1="0" x2="1">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="52%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
        </svg>
        {nodes.map((node, index) => {
          const active = interpolate(progress, [index * 0.22, index * 0.22 + 0.18], [0, 1], clamp);
          return (
            <div key={node.label} style={{ position: "absolute", left: node.x, top: index % 2 === 0 ? 128 : 455, width: 260, transform: `translateY(${(1 - active) * 28}px)`, opacity: active }}>
              <div style={{ width: 94, height: 94, borderRadius: 26, background: `linear-gradient(145deg, ${node.color}, rgba(255,255,255,0.78))`, boxShadow: `0 24px 58px ${node.color}3d`, display: "grid", placeItems: "center", color: "white", fontSize: 36, fontWeight: 920 }}>{index + 1}</div>
              <div style={{ marginTop: 18, color: "#0f172a", fontSize: 34, fontWeight: 900 }}>{node.label}</div>
              <div style={{ marginTop: 8, color: "#64748b", fontSize: 23, fontWeight: 760 }}>{node.sub}</div>
            </div>
          );
        })}
        <MiniRack x={505} y={266} progress={interpolate(progress, [0.2, 0.48], [0, 1], clamp)} color="#14b8a6" />
        <MiniRack x={950} y={266} progress={interpolate(progress, [0.45, 0.72], [0, 1], clamp)} color="#f59e0b" />
        <svg style={{ position: "absolute", right: 155, top: 312, width: 300, height: 160, overflow: "visible" }}>
          <path d="M20 118 C80 114, 92 86, 138 92 S202 78, 244 34" fill="none" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${interpolate(progress, [0.7, 0.95], [0, 460], clamp)} 460`} />
          <circle cx={244} cy={34} r={12} fill="#ef4444" opacity={interpolate(progress, [0.88, 0.96], [0, 1], clamp)} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

const GraphNode = ({ label, x, y, color, active }: { label: string; x: number; y: number; color: string; active: number }) => (
  <div style={{ position: "absolute", left: x, top: y, width: 210, height: 112, borderRadius: 28, background: "rgba(255,255,255,0.86)", border: `1px solid ${color}55`, boxShadow: `0 24px 70px ${color}24`, transform: `scale(${0.88 + active * 0.12})`, opacity: active }}>
    <div style={{ position: "absolute", left: 22, top: 18, width: 18, height: 18, borderRadius: 999, background: color }} />
    <div style={{ position: "absolute", left: 22, right: 22, bottom: 24, color: "#101827", fontSize: 26, fontWeight: 900 }}>{label}</div>
  </div>
);

const SupplyChainMap = () => {
  const opacity = useSceneOpacity(40, 58);
  const frame = useSceneFrame(40);
  const { fps } = useVideoConfig();
  const progress = interpolate(frame, [0.5 * fps, 16 * fps], [0, 1], clamp);
  const nodes = [
    { label: "AI应用需求", x: 155, y: 230, color: "#2563eb" },
    { label: "数据中心", x: 455, y: 150, color: "#14b8a6" },
    { label: "GPU", x: 805, y: 258, color: "#16a34a" },
    { label: "HBM", x: 1120, y: 150, color: "#f59e0b" },
    { label: "高性能DRAM", x: 1260, y: 405, color: "#f97316" },
    { label: "三星盈利", x: 1530, y: 285, color: "#ef4444" },
  ];

  return (
    <AbsoluteFill style={{ opacity }}>
      <SectionTitle eyebrow="SUPPLY CHAIN MAP" title="AI 红利传导链" right="从需求到利润弹性" />
      <div style={{ position: "absolute", left: 92, top: 190, right: 92, bottom: 178, borderRadius: 42, background: "linear-gradient(135deg, rgba(240,249,255,0.86), rgba(255,255,255,0.86))", border: "1px solid rgba(20,184,166,0.22)", boxShadow: "0 34px 100px rgba(20,184,166,0.13)", overflow: "hidden" }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {nodes.slice(0, -1).map((node, i) => {
            const next = nodes[i + 1];
            const draw = interpolate(progress, [i * 0.13, i * 0.13 + 0.22], [0, 1], clamp);
            return (
              <path
                key={`${node.label}-${next.label}`}
                d={`M${node.x + 105} ${node.y + 56} C${node.x + 230} ${node.y + 10}, ${next.x - 80} ${next.y + 100}, ${next.x} ${next.y + 56}`}
                fill="none"
                stroke="#2563eb"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${draw * 600} 600`}
                opacity={0.45 + draw * 0.35}
              />
            );
          })}
        </svg>
        {nodes.map((node, index) => (
          <GraphNode key={node.label} {...node} active={interpolate(progress, [index * 0.1, index * 0.1 + 0.18], [0, 1], clamp)} />
        ))}
        <div style={{ position: "absolute", left: 640, top: 462, width: 460, height: 160, borderRadius: 34, background: "rgba(15,23,42,0.92)", color: "white", padding: 30, boxShadow: "0 30px 80px rgba(15,23,42,0.26)" }}>
          <div style={{ fontSize: 20, fontWeight: 850, color: "#93c5fd" }}>KEY INSIGHT</div>
          <div style={{ marginTop: 12, fontSize: 34, fontWeight: 920, lineHeight: 1.18 }}>GPU 不是终点，内存吞吐才是下一层瓶颈</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const EvidenceCards = () => {
  const opacity = useSceneOpacity(58, 72);
  const frame = useSceneFrame(58);
  const { fps } = useVideoConfig();
  const cards = [
    { title: "HBM", signal: "需求走强", color: "#2563eb", bars: [70, 94, 128, 166] },
    { title: "高性能 DRAM", signal: "吞吐上升", color: "#14b8a6", bars: [58, 88, 118, 152] },
    { title: "存储价格", signal: "曲线回升", color: "#f59e0b", bars: [46, 62, 102, 148] },
  ];

  return (
    <AbsoluteFill style={{ opacity }}>
      <SectionTitle eyebrow="MARKET EVIDENCE" title="三条证据支撑存储红利" right="需求 / 吞吐 / 价格" />
      <div style={{ position: "absolute", left: 92, top: 190, right: 92, bottom: 178, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 28 }}>
        {cards.map((card, index) => {
          const active = spring({ frame: frame - (0.4 + index * 0.25) * fps, fps, config: { damping: 30, stiffness: 95 } });
          const chart = interpolate(frame, [(1.0 + index * 0.2) * fps, (4.6 + index * 0.25) * fps], [0, 1], clamp);
          return (
            <div key={card.title} style={{ position: "relative", borderRadius: 40, background: "rgba(255,255,255,0.82)", border: `1px solid ${card.color}44`, boxShadow: `0 32px 90px ${card.color}20`, overflow: "hidden", transform: `translateY(${(1 - active) * 50}px)`, opacity: active }}>
              <div style={{ position: "absolute", right: -90, top: -80, width: 300, height: 300, borderRadius: "50%", background: `${card.color}22` }} />
              <div style={{ padding: 38 }}>
                <div style={{ color: card.color, fontSize: 24, fontWeight: 900 }}>{card.title}</div>
                <div style={{ color: "#101827", fontSize: 44, fontWeight: 920, marginTop: 14 }}>{card.signal}</div>
                <div style={{ marginTop: 70, height: 230, display: "flex", alignItems: "flex-end", gap: 22 }}>
                  {card.bars.map((height, barIndex) => (
                    <div key={barIndex} style={{ width: 68, height: 40 + height * chart, borderRadius: "22px 22px 10px 10px", background: `linear-gradient(180deg, ${card.color}, rgba(255,255,255,0.85))`, boxShadow: `0 20px 50px ${card.color}2e` }} />
                  ))}
                </div>
                <div style={{ marginTop: 28, height: 12, borderRadius: 999, background: "#e2e8f0" }}>
                  <div style={{ width: `${Math.min(96, 28 + chart * 68)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${card.color}, #67e8f9)` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const NewsWall = () => {
  const opacity = useSceneOpacity(72, 84);
  const frame = useSceneFrame(72);
  const { fps } = useVideoConfig();
  const cards = [
    { tag: "MODEL", title: "Codex 接入更强模型", color: "#2563eb" },
    { tag: "JOBS", title: "AI 抢工作叙事降温", color: "#14b8a6" },
    { tag: "SAFETY", title: "AI 伴侣监管收紧", color: "#f59e0b" },
    { tag: "RANK", title: "GLM 榜单争议发酵", color: "#ef4444" },
    { tag: "TOKEN", title: "消耗榜换位置", color: "#7c3aed" },
  ];
  const rail = interpolate(frame, [0.3 * fps, 9.8 * fps], [130, -70], clamp);

  return (
    <AbsoluteFill style={{ opacity }}>
      <SectionTitle eyebrow="AI NEWS CONTEXT" title="其他消息指向同一个方向" right="行业背景快讯墙" />
      <div style={{ position: "absolute", left: 92, top: 196, right: 92, bottom: 178, borderRadius: 42, background: "rgba(15,23,42,0.92)", overflow: "hidden", boxShadow: "0 34px 100px rgba(15,23,42,0.22)" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(148,163,184,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.13) 1px, transparent 1px)", backgroundSize: "84px 84px", transform: `translateX(${rail * 0.2}px)` }} />
        <div style={{ position: "absolute", left: rail, top: 122, display: "flex", gap: 28 }}>
          {cards.map((card, index) => {
            const active = interpolate(frame, [(index * 1.2 + 0.5) * fps, (index * 1.2 + 1.8) * fps], [0, 1], clamp);
            return (
              <div key={card.title} style={{ width: 390, height: 420, borderRadius: 36, background: "rgba(255,255,255,0.92)", padding: 34, transform: `translateY(${(1 - active) * 42}px)`, opacity: 0.55 + active * 0.45 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 999, background: card.color }} />
                  <div style={{ color: card.color, fontSize: 22, fontWeight: 920 }}>{card.tag}</div>
                </div>
                <div style={{ marginTop: 54, color: "#101827", fontSize: 42, lineHeight: 1.12, fontWeight: 920 }}>{card.title}</div>
                <div style={{ position: "absolute", left: 34, right: 34, bottom: 34, height: 12, borderRadius: 999, background: "#e2e8f0" }}>
                  <div style={{ width: `${interpolate(frame, [(index + 0.5) * fps, (index + 3.2) * fps], [0, 100], clamp)}%`, height: "100%", borderRadius: 999, background: card.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const RankingBars = ({ title, data, color, startDelay }: { title: string; data: Array<{ label: string; value: number; display: string }>; color: string; startDelay: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const max = Math.max(...data.map((item) => item.value));

  return (
    <div style={{ borderRadius: 34, background: "rgba(255,255,255,0.84)", border: `1px solid ${color}3f`, padding: 30, boxShadow: `0 28px 74px ${color}18` }}>
      <div style={{ color, fontSize: 24, fontWeight: 920 }}>{title}</div>
      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 18 }}>
        {data.map((item, index) => {
          const grow = spring({ frame: frame - (startDelay + index * 0.12) * fps, fps, config: { damping: 36, stiffness: 92 } });
          return (
            <div key={item.label}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#101827", fontSize: 23, fontWeight: 850 }}>
                <span>{item.label}</span>
                <span style={{ color }}>{item.display}</span>
              </div>
              <div style={{ marginTop: 8, height: 18, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                <div style={{ width: `${(item.value / max) * grow * 100}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${color}, #67e8f9)` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TokenRankings = () => {
  const opacity = useSceneOpacity(84, 94);
  return (
    <AbsoluteFill style={{ opacity }}>
      <SectionTitle eyebrow="TOKEN RANKINGS" title="竞争从模型扩散到应用和基建" right="动态排行，不做长段文字" />
      <div style={{ position: "absolute", left: 92, top: 196, right: 92, bottom: 178, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 34 }}>
        <RankingBars
          title="AI Model Token"
          color="#2563eb"
          startDelay={84.5}
          data={[
            { label: "DeepSeek V4 Flash", value: 5.36, display: "5.36T" },
            { label: "MiMo-V2.5", value: 4.43, display: "4.43T" },
            { label: "MiniMax M3", value: 4.17, display: "4.17T" },
            { label: "GLM 5.2", value: 2.8, display: "2.80T" },
          ]}
        />
        <RankingBars
          title="AI App Token"
          color="#14b8a6"
          startDelay={85.2}
          data={[
            { label: "Hermes Agent", value: 842, display: "842B" },
            { label: "Claude Code", value: 338, display: "338B" },
            { label: "Kilo Code", value: 254, display: "254B" },
            { label: "OpenClaw", value: 169, display: "169B" },
            { label: "Cline", value: 86, display: "86B" },
          ]}
        />
      </div>
    </AbsoluteFill>
  );
};

const ClosingConclusion = () => {
  const opacity = useSceneOpacity(94, fullDuration);
  const frame = useSceneFrame(94);
  const { fps } = useVideoConfig();
  const hit = spring({ frame: frame - 0.05 * fps, fps, config: { damping: 22, stiffness: 115 } });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", left: 250, top: 210, right: 250, height: 560, borderRadius: 52, background: "linear-gradient(145deg, rgba(15,23,42,0.95), rgba(30,64,175,0.90))", color: "white", boxShadow: "0 44px 120px rgba(15,23,42,0.30)", display: "grid", placeItems: "center", transform: `scale(${0.88 + hit * 0.12})` }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#67e8f9", fontSize: 26, fontWeight: 900 }}>FINAL TAKEAWAY</div>
          <div style={{ marginTop: 30, fontSize: 76, lineHeight: 1.04, fontWeight: 950 }}>存储芯片正在被重新定价</div>
          <div style={{ marginTop: 34, display: "flex", justifyContent: "center", gap: 16 }}>
            {["GPU仍是焦点", "HBM/DRAM接棒", "三星受益"].map((item) => (
              <div key={item} style={{ borderRadius: 999, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.20)", padding: "14px 22px", fontSize: 22, fontWeight: 850 }}>{item}</div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const DailyReportPreview = () => {
  return (
    <AbsoluteFill style={{ fontFamily: "Inter, SF Pro Display, Arial, sans-serif", color: "#101827" }}>
      <Background />
      <Audio src={staticFile("runtime/ai-daily-0707-voiceover.mp3")} endAt={Math.ceil(fullDuration * 30)} />
      <EventOpen />
      <ProfitComparison />
      <InfraTimeline />
      <SupplyChainMap />
      <EvidenceCards />
      <NewsWall />
      <TokenRankings />
      <ClosingConclusion />
      <Subtitle />
    </AbsoluteFill>
  );
};
