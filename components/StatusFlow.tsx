import type { AppStatus } from "@/lib/types";
import { Check, Loader2 } from "lucide-react";

const steps: Array<{ status: AppStatus; label: string }> = [
  { status: "checking-material-pack", label: "正在检查素材包增强" },
  { status: "generating-audio", label: "正在用 TTS 服务商生成口播音频" },
  { status: "uploading-audio", label: "正在读取音频" },
  { status: "validating-timeline", label: "正在校验服务商原生时间轴" },
  { status: "generating-scenes", label: "正在生成 MG 视频时间轴" },
  { status: "rendering", label: "正在渲染视频预览" },
  { status: "complete", label: "预览已生成" },
];

const order = steps.map((step) => step.status);

export const statusText: Record<AppStatus, string> = {
  idle: "拖入或上传口播音频",
  "checking-material-pack": "正在检查素材包增强",
  "ready-for-audio": "拖入或上传音频开始生成",
  "generating-audio": "正在用 TTS 服务商生成口播音频",
  "uploading-audio": "正在读取音频",
  "validating-timeline": "正在校验服务商原生时间轴",
  "generating-scenes": "正在生成 MG 视频时间轴",
  rendering: "正在渲染视频预览",
  complete: "预览已生成",
  error: "生成失败",
};

export const StatusFlow = ({ status, error }: { status: AppStatus; error?: string }) => {
  const currentIndex = order.indexOf(status);

  return (
    <div className="rounded-lg border border-slate-200 bg-white/78 p-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold text-slate-950">{statusText[status]}</p>
        {status !== "idle" && status !== "ready-for-audio" ? (
          <span className="h-2 w-2 rounded-full bg-[var(--electric)] shadow-[0_0_18px_rgba(22,119,255,0.42)]" />
        ) : null}
      </div>
      <div className="mt-4 grid gap-2">
        {steps.map((step, index) => {
          const active = step.status === status;
          const done = status === "complete" || (currentIndex > -1 && index < currentIndex);
          return (
            <div key={step.status} className="grid grid-cols-[22px_minmax(0,1fr)] items-center gap-2 text-xs">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                  active
                    ? "border-[var(--electric)] bg-[var(--electric-soft)] text-blue-700"
                    : done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-300"
                }`}
              >
                {done ? <Check size={13} /> : active ? <Loader2 size={13} className="animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <span className={active ? "font-medium text-slate-950" : done ? "text-slate-600" : "text-slate-400"}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      {error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
};
