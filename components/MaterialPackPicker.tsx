"use client";

import { SearchCheck } from "lucide-react";

type MaterialPackPickerProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onCheck: () => void;
};

export const MaterialPackPicker = ({ value, disabled, onChange, onCheck }: MaterialPackPickerProps) => {
  return (
    <div>
      <label className="sr-only" htmlFor="material-pack-path">
        当前素材包路径
      </label>
      <div className="grid gap-2">
        <input
          id="material-pack-path"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onCheck();
          }}
          placeholder="有图片或文章时再粘贴素材包路径"
          className="h-10 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--electric)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        />
        <button
          type="button"
          disabled={disabled || !value.trim()}
          onClick={onCheck}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-950 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
        >
          <SearchCheck size={16} />
          启用素材增强
        </button>
      </div>
    </div>
  );
};
