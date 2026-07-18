"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Captions, MonitorPlay, MousePointer2, Radio, ScissorsLineDashed } from "lucide-react";
import type { AppStatus } from "@/lib/types";
import { statusText } from "@/components/StatusFlow";
import {
  animationLabel,
  styleProfiles,
  type EditorAnimation,
  type EditorElement,
  type VideoStyle,
} from "@/lib/editor-types";

type VideoPreviewProps = {
  videoPath?: string;
  status: AppStatus;
  audioFileName?: string;
  elements: EditorElement[];
  selectedElementId: string | null;
  currentTime: number;
  totalDuration: number;
  videoStyle: VideoStyle;
  onSelectElement: (elementId: string) => void;
  onTimeChange: (time: number) => void;
};

const isVisibleAtTime = (element: EditorElement, time: number) => time >= element.start && time <= element.end;

const animationClass: Record<EditorAnimation, string> = {
  fade: "preview-anim-fade",
  "slide-up": "preview-anim-slide-up",
  pop: "preview-anim-pop",
  wipe: "preview-anim-wipe",
  "zoom-in": "preview-anim-zoom-in",
  typewriter: "preview-anim-typewriter",
  "number-tick": "preview-anim-number-tick",
  "underline-sweep": "preview-anim-underline-sweep",
  "pulse-outline": "preview-anim-pulse-outline",
  "camera-push": "preview-anim-camera-push",
  "camera-pull": "preview-anim-camera-pull",
  "flash-cut": "preview-anim-flash-cut",
  "card-flip": "preview-anim-card-flip",
};

const renderElement = (element: EditorElement, selected: boolean, currentTime: number) => {
  const visible = isVisibleAtTime(element, currentTime);
  if (!visible) return null;

  const commonStyle: CSSProperties = {
    width: element.width,
    height: element.height,
    transform: `scale(${element.scale})`,
    transformOrigin: "top left",
    opacity: element.opacity,
    borderRadius: element.radius,
    color: element.color,
    background: element.background,
    zIndex: element.zIndex,
    boxShadow: selected
      ? "0 18px 42px rgba(37,99,235,0.12)"
      : element.shadow
        ? "0 24px 54px rgba(80, 115, 170, 0.18)"
        : "none",
    border: `1px solid ${element.borderColor}`,
    transition: "all 180ms ease",
  };

  if (element.type === "headline") {
    return (
      <div style={commonStyle} className={`pointer-events-none flex items-start bg-transparent ${animationClass[element.animation]}`}>
        <p style={{ fontSize: element.fontSize, fontWeight: element.fontWeight, lineHeight: 1.06 }} className="max-w-full">
          {element.text}
        </p>
      </div>
    );
  }

  if (element.type === "subtitle") {
    return (
      <div style={commonStyle} className={`pointer-events-none flex items-start bg-transparent ${animationClass[element.animation]}`}>
        <p style={{ fontSize: element.fontSize, fontWeight: element.fontWeight, lineHeight: 1.6 }} className="max-w-full">
          {element.text}
        </p>
      </div>
    );
  }

  if (element.type === "metric-card") {
    return (
      <div style={commonStyle} className={`pointer-events-none flex flex-col justify-between p-6 ${animationClass[element.animation]}`}>
        <div>
          <p className="mt-3 text-sm font-medium" style={{ color: element.color, opacity: 0.62 }}>
            {element.text}
          </p>
          <p style={{ fontSize: Math.max(42, element.fontSize + 16), fontWeight: 760, lineHeight: 1 }} className="mt-3">
            {element.value}
          </p>
        </div>
        <p className="text-sm" style={{ color: element.color, opacity: 0.58 }}>
          {element.caption}
        </p>
      </div>
    );
  }

  if (element.type === "image") {
    return (
      <div style={commonStyle} className={`pointer-events-none overflow-hidden p-3 ${animationClass[element.animation]}`}>
        <div className="flex h-full w-full flex-col rounded-[26px] border border-current/10 bg-current/[0.04] p-3 backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-full border border-current/10 bg-current/[0.06] px-2 py-1 text-[11px] font-semibold" style={{ color: element.color }}>
              截图
            </span>
          </div>
          <div
            className="flex-1 rounded-[20px] border border-current/10"
            style={{
              background:
                element.background.includes("15,23,42") || element.color.toLowerCase().includes("e6f0ff")
                  ? "linear-gradient(145deg,rgba(15,23,42,0.92),rgba(30,41,59,0.7))"
                  : "linear-gradient(145deg,#edf5ff,#dfeeff)",
            }}
          />
          <p className="mt-3 text-sm font-medium" style={{ color: element.color, opacity: 0.62 }}>
            {element.caption}
          </p>
        </div>
      </div>
    );
  }

  if (element.type === "badge") {
    return (
      <div style={commonStyle} className={`pointer-events-none inline-flex items-center justify-center px-4 ${animationClass[element.animation]}`}>
        <span style={{ fontSize: element.fontSize, fontWeight: element.fontWeight }}>{element.text}</span>
      </div>
    );
  }

  if (element.type === "highlight") {
    return (
      <div style={commonStyle} className={`pointer-events-none p-5 ${animationClass[element.animation]}`}>
        <div className="h-full rounded-[24px] border-2 border-dashed border-blue-300/90 bg-white/28" />
      </div>
    );
  }

  return <div style={commonStyle} className={`pointer-events-none ${animationClass[element.animation]}`} />;
};

export const VideoPreview = ({
  videoPath,
  status,
  audioFileName,
  elements,
  selectedElementId,
  currentTime,
  totalDuration,
  videoStyle,
  onSelectElement,
  onTimeChange,
}: VideoPreviewProps) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [stageScale, setStageScale] = useState(0.86);
  const profile = styleProfiles[videoStyle];
  const sortedElements = [...elements].sort((left, right) => right.zIndex - left.zIndex);
  const rhythmElements = [...sortedElements].sort((left, right) => {
    if (left.id === selectedElementId) return -1;
    if (right.id === selectedElementId) return 1;
    return left.start - right.start;
  });
  const visibleCount = elements.filter((element) => isVisibleAtTime(element, currentTime)).length;
  const showRenderedVideo = Boolean(videoPath);
  const renderedVideoSrc = videoPath ? `/api/video?path=${encodeURIComponent(videoPath)}` : "";

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateScale = () => {
      const rect = frame.getBoundingClientRect();
      setStageScale(Math.min(rect.width / 1200, rect.height / 675));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex h-full min-h-[560px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-950 text-white">
            <MonitorPlay size={16} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-950">视频预览</h2>
            <p className="truncate text-xs text-slate-500">
              {profile.label} / {audioFileName || statusText[status]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" title="点选当前片段元素" className="tool-button">
            <MousePointer2 size={15} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 bg-[#edf1f7] p-2.5">
        <div className={`relative flex h-[calc(100vh-380px)] min-h-[320px] max-h-[520px] flex-none items-start justify-center overflow-hidden rounded-xl border px-3 pb-3 pt-11 ${profile.previewShellClass}`}>
          <div className={`pointer-events-none absolute left-4 top-3 z-30 flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-medium shadow-sm ${profile.labelClass}`}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: profile.accent }} />
            {showRenderedVideo ? "MP4 预览" : "模拟预览"} / {visibleCount} 个元素
          </div>
          <div className={`pointer-events-none absolute right-4 top-3 z-30 rounded-md border px-2.5 py-1 text-[11px] font-medium shadow-sm ${profile.labelClass}`}>
            {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
          </div>
          <div ref={frameRef} className={`relative aspect-video w-full max-w-[1120px] overflow-hidden rounded-lg border shadow-2xl ${profile.frameClass}`}>
            {showRenderedVideo ? (
              <video
                key={videoPath}
                src={renderedVideoSrc}
                controls
                className="h-full w-full bg-black object-contain"
              />
            ) : (
              <div className={`relative h-full overflow-hidden ${profile.previewClass} ${profile.stageClass}`}>
                <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-current opacity-[0.035]" />
                <div className="pointer-events-none absolute bottom-8 left-8 right-8 h-px bg-current opacity-10" />
                <div className={`pointer-events-none absolute bottom-8 left-8 z-20 flex items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] font-semibold backdrop-blur ${profile.labelClass}`}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: profile.accent }} />
                  {profile.label}
                </div>
                <div className={`pointer-events-none absolute bottom-8 right-8 z-20 rounded-md border px-3 py-1.5 text-[12px] font-medium backdrop-blur ${profile.labelClass}`}>
                  {profile.motion}
                </div>
                <div
                  className="absolute left-1/2 top-1/2 origin-center"
                  style={{
                    width: 1200 * stageScale,
                    height: 675 * stageScale,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div className="relative h-[675px] w-[1200px] origin-top-left" style={{ transform: `scale(${stageScale})` }}>
                    {sortedElements
                      .sort((left, right) => left.zIndex - right.zIndex)
                      .map((element) => {
                        const selected = element.id === selectedElementId;
                        const visible = isVisibleAtTime(element, currentTime);
                        return (
                          <button
                            key={element.id}
                            type="button"
                            aria-label={`选择${element.name}`}
                            onClick={() => onSelectElement(element.id)}
                            className={`absolute cursor-pointer bg-transparent p-0 text-left transition ${
                              visible ? "opacity-100" : "pointer-events-none opacity-0"
                            }`}
                            style={{
                              left: element.x,
                              top: element.y,
                              width: element.width,
                              height: element.height,
                              zIndex: element.zIndex + 10,
                            }}
                          >
                            {renderElement(element, selected, currentTime)}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <ScissorsLineDashed size={14} className="text-slate-500" />
              音频节奏
            </div>
            <div className="text-xs text-slate-500">
              {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
            </div>
          </div>
            <input
              type="range"
              min={0}
              max={totalDuration}
              step={0.1}
              value={currentTime}
              onChange={(event) => onTimeChange(Number(event.target.value))}
            className="mt-2 h-7 w-full accent-blue-600"
            />
          <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
            {rhythmElements.map((element) => {
              const selected = element.id === selectedElementId;
              const visible = isVisibleAtTime(element, currentTime);
              return (
                <button
                  key={element.id}
                  type="button"
                  onClick={() => onSelectElement(element.id)}
                  className={`min-w-28 rounded-md border px-2.5 py-1.5 text-left transition ${
                    selected
                      ? "border-slate-950 bg-slate-950 text-white"
                      : visible
                        ? "border-slate-200 bg-white text-slate-800 hover:border-blue-200"
                        : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                >
                  <p className="truncate text-[11px] font-semibold">{element.name}</p>
                  <p className={`mt-1 text-[11px] ${selected ? "text-slate-300" : "text-slate-400"}`}>
                    {element.start.toFixed(0)}s - {element.end.toFixed(0)}s / {animationLabel[element.animation]}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 hidden grid-cols-12 gap-1 2xl:grid">
              {Array.from({ length: 12 }).map((_, index) => {
                const start = (totalDuration / 12) * index;
                const end = (totalDuration / 12) * (index + 1);
                const count = elements.filter((element) => element.start < end && element.end > start).length;
                return (
                <div key={index} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-1">
                  <p className="text-[10px] font-medium text-slate-400">{start.toFixed(0)}s</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-slate-700">
                    <Radio size={10} />
                    {count}
                  </p>
                  </div>
                );
              })}
            </div>
        </div>
      </div>
    </div>
  );
};
