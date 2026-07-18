"use client";

import { AudioWaveform, MousePointerClick, UploadCloud } from "lucide-react";
import type { DragEvent } from "react";
import { useRef } from "react";

type AudioDropzoneProps = {
  disabled?: boolean;
  fileName?: string;
  onFile: (file: File) => void;
};

export const AudioDropzone = ({ disabled, fileName, onFile }: AudioDropzoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) return;
    const file = event.dataTransfer.files.item(0);
    if (file) onFile(file);
  };

  const openFilePicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const bars = [28, 54, 36, 72, 46, 64, 34, 82, 50, 68, 40, 58, 30, 74, 44, 62, 36, 56];

  return (
    <div
      aria-disabled={disabled}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onClick={openFilePicker}
      className={`group relative flex min-h-36 cursor-pointer overflow-hidden rounded-lg border px-3 py-3 transition ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-50/80 text-slate-400"
          : "border-slate-200 bg-white text-slate-900 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/70"
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#2563eb,#0f9f80,#e6a01b)] opacity-80" />
      <div className="flex w-full flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 shadow-sm">
              {fileName ? <AudioWaveform size={18} className="text-[var(--mint)]" /> : <UploadCloud size={18} className={disabled ? "text-slate-300" : "text-[var(--electric)]"} />}
            </div>
            <span className="block break-all text-sm font-semibold text-slate-950">{fileName || "拖入或上传口播音频"}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{disabled ? "正在处理当前任务" : "支持拖拽，也可以点击选择文件"}</span>
          </div>
          <span className={`rounded-md border px-2.5 py-1 text-[11px] font-medium ${disabled ? "border-slate-200 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
            MP3 / WAV
          </span>
        </div>
        <div className="flex h-10 items-end gap-1 rounded-md border border-slate-200/80 bg-slate-50 px-2 py-2">
          {bars.map((height, index) => (
            <span
              key={`${height}-${index}`}
              className={`flex-1 rounded-full transition ${disabled ? "bg-slate-200" : "bg-slate-300 group-hover:bg-[var(--electric)]"}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            openFilePicker();
          }}
          className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold shadow-sm transition ${
            disabled
              ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
              : "border-slate-900 bg-slate-950 text-white hover:bg-slate-800"
          }`}
        >
          <MousePointerClick size={16} />
          {disabled ? "处理中" : "点击上传音频"}
        </button>
      </div>
      <input
        ref={inputRef}
        disabled={disabled}
        type="file"
        accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-m4a"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.item(0);
          if (file) onFile(file);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
};
