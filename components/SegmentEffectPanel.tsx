import { useState } from "react";
import { Captions, ChevronDown, Clapperboard, Gauge, MousePointer2, Sparkles, Subtitles, Type, Video } from "lucide-react";
import {
  animationLabel,
  editorTypeLabel,
  type EditorAnimation,
  type EditorElement,
} from "@/lib/editor-types";

type SegmentEffectPanelProps = {
  element: EditorElement | null;
  currentTime: number;
  totalDuration: number;
  onUpdate: (elementId: string, patch: Partial<EditorElement>) => void;
};

const panelBlock = "border-t border-slate-200 px-3 py-3";

const SectionTitle = ({ icon: Icon, title }: { icon: typeof Sparkles; title: string }) => (
  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
    <Icon size={14} />
    {title}
  </div>
);

const OptionButton = ({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint?: string;
  active?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`min-h-10 rounded-md border px-2.5 py-2 text-left transition ${
      active
        ? "border-slate-950 bg-slate-950 text-white"
        : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
    }`}
  >
    <span className="block text-[11px] font-semibold">{label}</span>
    {hint ? <span className={`mt-1 block text-[11px] leading-4 ${active ? "text-slate-300" : "text-slate-400"}`}>{hint}</span> : null}
  </button>
);

const animationOptions: Array<{ label: string; value: EditorAnimation }> = [
  { label: "柔和淡入", value: "fade" },
  { label: "上移入场", value: "slide-up" },
  { label: "弹出强调", value: "pop" },
  { label: "擦入揭示", value: "wipe" },
  { label: "镜头推近", value: "camera-push" },
  { label: "快速闪切", value: "flash-cut" },
];

type EffectOption = {
  label: string;
  hint?: string;
  active: boolean;
  onClick: () => void;
};

const EffectGroup = ({
  id,
  icon: Icon,
  title,
  summary,
  open,
  onToggle,
  options,
}: {
  id: string;
  icon: typeof Sparkles;
  title: string;
  summary: string;
  open: boolean;
  onToggle: (id: string) => void;
  options: EffectOption[];
}) => {
  const quickOptions = options.slice(0, 2);

  return (
    <div className="border-t border-slate-200 px-3 py-2.5">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon size={14} className="shrink-0 text-slate-500" />
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-slate-800">{title}</span>
            <span className="mt-0.5 block truncate text-[11px] text-slate-400">{summary}</span>
          </span>
        </span>
        <ChevronDown size={15} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {quickOptions.map((option) => (
          <OptionButton key={option.label} {...option} />
        ))}
      </div>
      {open ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {options.slice(2).map((option) => (
            <OptionButton key={option.label} {...option} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const SegmentEffectPanel = ({
  element,
  currentTime,
  totalDuration,
  onUpdate,
}: SegmentEffectPanelProps) => {
  const [openGroup, setOpenGroup] = useState("title");

  if (!element) {
    return (
      <section className="p-3">
        <SectionTitle icon={MousePointer2} title="当前片段效果" />
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">等待选择片段</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">点选预览里的标题、字幕或数据卡后，在这里切换视觉效果。</p>
        </div>
      </section>
    );
  }

  const patch = (next: Partial<EditorElement>) => onUpdate(element.id, next);
  const isTextLike = element.type === "headline" || element.type === "subtitle" || element.type === "badge";
  const isMetric = element.type === "metric-card";
  const toggleGroup = (id: string) => setOpenGroup((current) => (current === id ? "" : id));

  const titleOptions: EffectOption[] = [
    { label: "稳重标题", hint: "财经分析", active: element.fontWeight < 720, onClick: () => patch({ fontSize: 52, fontWeight: 680, animation: "slide-up" }) },
    { label: "大字冲击", hint: "短视频开场", active: element.fontSize >= 66, onClick: () => patch({ fontSize: 70, fontWeight: 800, animation: "pop" }) },
    { label: "下划线扫过", hint: "强调关键词", active: element.animation === "underline-sweep", onClick: () => patch({ animation: "underline-sweep", fontWeight: 760 }) },
    { label: "打字机揭示", hint: "解释概念", active: element.animation === "typewriter", onClick: () => patch({ animation: "typewriter", fontWeight: 650 }) },
  ];
  const subtitleOptions: EffectOption[] = [
    { label: "清爽正文", hint: "无底色阅读", active: element.background === "rgba(255,255,255,0)", onClick: () => patch({ background: "rgba(255,255,255,0)", color: "#5b667a", fontSize: 26, radius: 18, shadow: false }) },
    { label: "底部字幕条", hint: "成片字幕", active: element.background.includes("15,23,42"), onClick: () => patch({ background: "rgba(15,23,42,0.78)", color: "#ffffff", fontSize: 27, radius: 18, shadow: true }) },
    { label: "关键词加粗", hint: "信息抓力", active: element.fontWeight >= 760, onClick: () => patch({ fontWeight: 780, color: "#111827", accent: "#2563eb" }) },
    { label: "柔和高亮底", hint: "解释风", active: element.background.includes("239,246,255"), onClick: () => patch({ background: "rgba(239,246,255,0.92)", color: "#10213a", radius: 22, shadow: false }) },
  ];
  const metricOptions: EffectOption[] = [
    { label: "数字跳动", hint: "强化金额", active: element.animation === "number-tick", onClick: () => patch({ animation: "number-tick", fontSize: 24, fontWeight: 760 }) },
    { label: "卡片弹出", hint: "轻 MG", active: element.animation === "pop", onClick: () => patch({ animation: "pop", shadow: true, radius: 30 }) },
    { label: "白底数据卡", hint: "财经默认", active: element.background.includes("255,255,255"), onClick: () => patch({ background: "rgba(255,255,255,0.94)", borderColor: "rgba(37,99,235,0.16)", shadow: true }) },
    { label: "新闻信息块", hint: "评论风", active: element.borderColor.includes("220,38,38"), onClick: () => patch({ background: "rgba(255,255,255,0.96)", borderColor: "rgba(220,38,38,0.22)", accent: "#dc2626", radius: 12 }) },
  ];
  const cameraOptions: EffectOption[] = [
    { label: "轻微推近", hint: "增强关注", active: element.animation === "camera-push", onClick: () => patch({ animation: "camera-push" }) },
    { label: "轻微拉远", hint: "收出信息", active: element.animation === "camera-pull", onClick: () => patch({ animation: "camera-pull" }) },
    { label: "缩放入场", hint: "截图位", active: element.animation === "zoom-in", onClick: () => patch({ animation: "zoom-in" }) },
    { label: "保持稳定", hint: "长字幕", active: element.animation === "fade", onClick: () => patch({ animation: "fade" }) },
  ];
  const transitionOptions: EffectOption[] = animationOptions.map((option) => ({
    label: option.label,
    hint: option.value === "flash-cut" ? "强节奏" : option.value === "wipe" ? "信息揭示" : "常规过渡",
    active: element.animation === option.value,
    onClick: () => patch({ animation: option.value }),
  }));

  return (
    <section className="min-h-full">
      <div className="px-3 py-3">
        <SectionTitle icon={Sparkles} title="当前片段效果" />
        <h3 className="truncate text-base font-semibold text-slate-950">{element.name}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {editorTypeLabel[element.type]} / 当前 {currentTime.toFixed(1)}s / 视频 {totalDuration.toFixed(1)}s
        </p>
      </div>

      <div className="overflow-visible pb-3">
        {"text" in element && element.text !== undefined ? (
          <div className={panelBlock}>
            <SectionTitle icon={Captions} title="当前字幕内容" />
            <textarea
              value={element.text}
              onChange={(event) => patch({ text: event.target.value })}
              className="min-h-[88px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-300"
            />
          </div>
        ) : null}

        {isTextLike ? (
          <>
            <EffectGroup id="title" icon={Type} title="标题强调方式" summary={animationLabel[element.animation]} open={openGroup === "title"} onToggle={toggleGroup} options={titleOptions} />
            <EffectGroup id="subtitle" icon={Subtitles} title="字幕样式" summary={`${element.fontSize}px / ${element.fontWeight}`} open={openGroup === "subtitle"} onToggle={toggleGroup} options={subtitleOptions} />
          </>
        ) : null}

        {isMetric ? (
          <EffectGroup id="metric" icon={Gauge} title="数字卡片样式" summary={animationLabel[element.animation]} open={openGroup === "metric"} onToggle={toggleGroup} options={metricOptions} />
        ) : null}

        <EffectGroup id="camera" icon={Clapperboard} title="镜头运动" summary={animationLabel[element.animation]} open={openGroup === "camera"} onToggle={toggleGroup} options={cameraOptions} />
        <EffectGroup id="transition" icon={Video} title="转场与节奏" summary={animationLabel[element.animation]} open={openGroup === "transition"} onToggle={toggleGroup} options={transitionOptions} />

        <div className="border-t border-slate-200 px-4 py-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold text-slate-700">当前动效：{animationLabel[element.animation]}</p>
          </div>
        </div>
      </div>
    </section>
  );
};
