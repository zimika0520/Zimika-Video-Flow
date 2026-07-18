"use client";

import { Archive, FolderOpen, Plus, RefreshCw, Upload, Video } from "lucide-react";

type ActionBarProps = {
  canRegenerate: boolean;
  canExport: boolean;
  canOpenFolder: boolean;
  canArchive: boolean;
  busy?: boolean;
  onNewProject: () => void;
  onArchive: () => void;
  onChangePack: () => void;
  onRegenerate: () => void;
  onExport: () => void;
  onOpenFolder: () => void;
};

export const ActionBar = ({
  canRegenerate,
  canExport,
  canOpenFolder,
  canArchive,
  busy,
  onNewProject,
  onArchive,
  onChangePack,
  onRegenerate,
  onExport,
  onOpenFolder,
}: ActionBarProps) => {
  return (
    <footer>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onNewProject}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          <Plus size={16} />
          新建
        </button>
        <button
          type="button"
          disabled={!canArchive || busy}
          onClick={onArchive}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200"
        >
          <Archive size={16} />
          存档
        </button>
        <button
          type="button"
          disabled={busy}
          title="清空本次音频、转写和预览结果"
          onClick={onChangePack}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200"
        >
          <FolderOpen size={16} />
          清空当前运行
        </button>
        <button
          type="button"
          disabled={!canRegenerate || busy}
          onClick={onRegenerate}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200"
        >
          <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
          重新生成
        </button>
        <button
          type="button"
          disabled={!canExport || busy}
          onClick={onExport}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
        >
          <Video size={16} />
          导出 MP4
        </button>
        <button
          type="button"
          disabled={!canOpenFolder}
          onClick={onOpenFolder}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200"
        >
          <Upload size={16} />
          打开文件夹
        </button>
      </div>
    </footer>
  );
};
