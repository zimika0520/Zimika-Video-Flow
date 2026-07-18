"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  AudioWaveform,
  Check,
  ChevronLeft,
  Download,
  FileAudio2,
  FolderOpen,
  MessageSquareText,
  MonitorPlay,
  PencilLine,
  PlayCircle,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import { AudioDropzone } from "@/components/AudioDropzone";
import { MaterialPackPicker } from "@/components/MaterialPackPicker";
import { SegmentEffectPanel } from "@/components/SegmentEffectPanel";
import { StatusFlow, statusText } from "@/components/StatusFlow";
import {
  editorSeedElements,
  styleElementPatch,
  styleProfiles,
  videoStyleDescription,
  videoStyleLabel,
  type EditorElement,
  type VideoStyle,
} from "@/lib/editor-types";
import type { AppStatus, VideoQualityReport } from "@/lib/types";
import type { RunPaths } from "@/lib/paths";

type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  referencedImages: string[];
  audioPath?: string;
  kind?: "generic" | "template-project";
  templateProjectPath?: string;
};

type SelectMaterialPackResponse = {
  validation: ValidationResult;
  runPaths: RunPaths;
};

type CreateAudioRunResponse = {
  runPaths: RunPaths;
};

type GenerateScenesResponse = {
  duration: number;
  assetManifestPath?: string;
};

type GenerateStyleProfileResponse = {
  styleProfilePath: string;
};

type GenerateVoiceoverAudioResponse = {
  audioPath: string;
  fileName: string;
  voiceoverPath: string;
  subtitleTimelinePath: string;
  durationMs?: number;
  model: string;
};

type UploadAudioPackageResponse = {
  audioPath: string;
  fileName: string;
  voiceoverPath: string;
  subtitleTimelinePath: string;
};

type ArchiveProjectResponse = {
  archivePath: string;
  runPaths: RunPaths;
};

type WizardStep = 0 | 1 | 2 | 3 | 4;
type AspectRatio = "9:16" | "16:9";

const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data as T;
};

const wizardSteps: Array<{ step: Exclude<WizardStep, 0>; label: string }> = [
  { step: 1, label: "文案" },
  { step: 2, label: "音频" },
  { step: 3, label: "风格" },
  { step: 4, label: "编辑导出" },
];

const projectSeeds = [
  { id: "default-video", name: "未命名口播视频", meta: "90 秒 · 文案中" },
  { id: "ai-browser", name: "AI 浏览器大战", meta: "75 秒 · 科技解释 · 草稿" },
  { id: "minimax-audio", name: "MiniMax 音频模型", meta: "60 秒 · 工具介绍 · 待处理" },
];

const voiceOptions = [
  {
    id: "reliable-executive",
    name: "沉稳高管",
    tag: "稳",
    voiceId: "Chinese (Mandarin)_Reliable_Executive",
    description: "低沉厚实、磁性从容，适合财经评论、商业解读和高端叙事。",
  },
  {
    id: "warm-girl",
    name: "温和女声",
    tag: "柔",
    voiceId: "Chinese (Mandarin)_Warm_Girl",
    description: "亲和自然，适合知识讲解和轻量科普。",
  },
];

const defaultVoiceover = `这条口播视频，先从一个核心问题开始。

它真正值得关注的，不只是表面信息，而是背后的结构变化、关键数据和实际影响。

我们会先把事实讲清楚，再拆解原因，最后给出一个可以被观众记住的结论。

所以这条视频不追求堆信息，而是用清晰的口播、字幕和画面，把复杂内容讲得更容易理解。`;

export default function HomePage() {
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [projectName, setProjectName] = useState("未命名口播视频");
  const [activeProjectId, setActiveProjectId] = useState(projectSeeds[0].id);
  const [projectSearch, setProjectSearch] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: "ai", text: "把文章、链接或主题发给我，我会整理成只包含“要念出来的话”的口播稿。" },
    { role: "me", text: "做一条 90 秒财经评论视频，语气直接一点。" },
    { role: "ai", text: "已生成初版文案。你可以继续让我改，也可以在右侧直接编辑。" },
  ]);
  const [selectedVoice, setSelectedVoice] = useState(voiceOptions[0].id);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [materialPackPath, setMaterialPackPath] = useState("");
  const [checkedMaterialPackPath, setCheckedMaterialPackPath] = useState("");
  const [runPaths, setRunPaths] = useState<RunPaths | null>(null);
  const [status, setStatus] = useState<AppStatus>("idle");
  const [error, setError] = useState("");
  const [audioPath, setAudioPath] = useState("");
  const [audioFileName, setAudioFileName] = useState("");
  const [voiceoverPath, setVoiceoverPath] = useState("");
  const [subtitleTimelinePath, setSubtitleTimelinePath] = useState("");
  const [externalAudioFile, setExternalAudioFile] = useState<File | null>(null);
  const [externalSubtitleTimelineFile, setExternalSubtitleTimelineFile] = useState<File | null>(null);
  const [videoPath, setVideoPath] = useState("");
  const [archivePath, setArchivePath] = useState("");
  const [materialPackKind, setMaterialPackKind] = useState<"generic" | "template-project">("generic");
  const [editorElements, setEditorElements] = useState<EditorElement[]>(editorSeedElements);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(editorSeedElements[0]?.id ?? null);
  const [currentTime, setCurrentTime] = useState(8.4);
  const [videoStyle, setVideoStyle] = useState<VideoStyle>("light-finance-mg");
  const [generatedDuration, setGeneratedDuration] = useState<number | null>(null);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [draftProjectName, setDraftProjectName] = useState("");
  const [voiceoverText, setVoiceoverText] = useState(defaultVoiceover);
  const [toastMessage, setToastMessage] = useState("");
  const [qualityReport, setQualityReport] = useState<VideoQualityReport | null>(null);

  const busy = useMemo(
    () => ["checking-material-pack", "generating-audio", "uploading-audio", "validating-timeline", "generating-scenes", "rendering"].includes(status),
    [status],
  );
  const selectedElement = useMemo(
    () => editorElements.find((element) => element.id === selectedElementId) ?? null,
    [editorElements, selectedElementId],
  );
  const totalDuration = useMemo(
    () => generatedDuration ?? Math.max(1, ...editorElements.map((element) => element.end)),
    [editorElements, generatedDuration],
  );
  const profile = styleProfiles[videoStyle];
  const renderedVideoSrc = videoPath ? `/api/video?path=${encodeURIComponent(videoPath)}` : "";
  const selectedVoiceOption = voiceOptions.find((voice) => voice.id === selectedVoice) ?? voiceOptions[0];
  const selectedVoiceLabel = selectedVoiceOption.name;
  const audioPackageReady = Boolean(audioPath && voiceoverPath && subtitleTimelinePath);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 1500);
  };

  const fail = (message: string) => {
    setError(message);
    setStatus("error");
  };

  const goStep = (step: WizardStep) => {
    setWizardStep(step);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const clearFinalizedAudioPackage = () => {
    setAudioPath("");
    setAudioFileName("");
    setVoiceoverPath("");
    setSubtitleTimelinePath("");
    setVideoPath("");
    setGeneratedDuration(null);
    setQualityReport(null);
  };

  const updateVoiceoverText = (nextText: string) => {
    if (nextText !== voiceoverText && (audioPath || voiceoverPath || subtitleTimelinePath)) {
      clearFinalizedAudioPackage();
    }
    setVoiceoverText(nextText);
  };

  const checkMaterialPack = async () => {
    setError("");
    setVideoPath("");
    setStatus("checking-material-pack");

    try {
      if (!materialPackPath.trim()) {
        fail("素材包是可选增强；如果不使用素材包，直接上传口播音频即可");
        return;
      }

      const result = await postJson<SelectMaterialPackResponse>("/api/select-material-pack", { materialPackPath });
      if (!result.validation.ok) {
        fail(result.validation.errors[0] ?? "素材包检查失败");
        return;
      }

      setRunPaths(result.runPaths);
      setCheckedMaterialPackPath(materialPackPath.trim());
      setMaterialPackKind(result.validation.kind ?? "generic");
      setStatus("ready-for-audio");
      showToast(result.validation.audioPath ? "素材包已启用；其中的音频需补齐原生时间轴后单独导入" : "素材包增强已启用");
    } catch (caught) {
      fail(caught instanceof Error ? caught.message : "素材包检查失败");
    }
  };

  const runPipeline = async () => {
    setError("");
    setVideoPath("");
    setGeneratedDuration(null);
    setQualityReport(null);

    try {
      const activeRunPaths = runPaths;
      const currentAudioPath = audioPath;
      const currentVoiceoverPath = voiceoverPath;
      const currentSubtitleTimelinePath = subtitleTimelinePath;

      if (!currentAudioPath || !currentVoiceoverPath || !currentSubtitleTimelinePath) {
        fail("音频包不完整，请先准备音频、确认口播文案和服务商原生时间轴");
        return;
      }

      if (!activeRunPaths) {
        fail("缺少运行目录，请重新上传音频");
        return;
      }

      setStatus("validating-timeline");
      const scenes = await postJson<GenerateScenesResponse>("/api/generate-scenes", {
        materialPackPath: checkedMaterialPackPath || undefined,
        voiceoverPath: currentVoiceoverPath,
        subtitleTimelinePath: currentSubtitleTimelinePath,
        videoBriefPath: activeRunPaths.videoBriefPath,
        scenesPath: activeRunPaths.scenesPath,
        visualManifestPath: activeRunPaths.visualManifestPath,
        assetManifestPath: activeRunPaths.assetManifestPath,
        directorPlanPath: activeRunPaths.directorPlanPath,
        audioSrc: currentAudioPath,
      });
      setGeneratedDuration(scenes.duration);
      setCurrentTime(0);

      await postJson<GenerateStyleProfileResponse>("/api/generate-style-profile", {
        style: videoStyle,
        aspectRatio,
        styleProfilePath: activeRunPaths.styleProfilePath,
      });

      setStatus("rendering");
      const render = await postJson<{ videoPath: string; qualityReport: VideoQualityReport }>("/api/render-preview", {
        materialPackPath: checkedMaterialPackPath || undefined,
        audioPath: currentAudioPath,
        voiceoverPath: currentVoiceoverPath,
        subtitleTimelinePath: currentSubtitleTimelinePath,
        videoBriefPath: activeRunPaths.videoBriefPath,
        visualManifestPath: activeRunPaths.visualManifestPath,
        assetManifestPath: activeRunPaths.assetManifestPath,
        scenesPath: activeRunPaths.scenesPath,
        directorPlanPath: activeRunPaths.directorPlanPath,
        styleProfilePath: activeRunPaths.styleProfilePath,
        productionGateReportPath: activeRunPaths.productionGateReportPath,
        qualityReportPath: activeRunPaths.qualityReportPath,
        qualityFramesDir: activeRunPaths.qualityFramesDir,
        previewPath: activeRunPaths.previewPath,
        publicRuntimeDir: activeRunPaths.publicRuntimeDir,
        publicRuntimeBase: activeRunPaths.publicRuntimeBase,
      });

      setVideoPath(render.videoPath);
      setQualityReport(render.qualityReport);
      setStatus("complete");
      goStep(4);
    } catch (caught) {
      fail(caught instanceof Error ? caught.message : "生成失败");
    }
  };

  const selectExternalAudioFile = (file: File) => {
    clearFinalizedAudioPackage();
    setExternalAudioFile(file);
    setAudioFileName(file.name);
    setStatus("ready-for-audio");
  };

  const selectExternalSubtitleTimelineFile = (file: File | null) => {
    clearFinalizedAudioPackage();
    setExternalSubtitleTimelineFile(file);
    setAudioFileName(externalAudioFile?.name ?? "");
    setStatus("ready-for-audio");
  };

  const uploadExternalAudioPackage = async () => {
    setError("");
    setVideoPath("");
    setGeneratedDuration(null);

    try {
      if (!externalAudioFile || !externalSubtitleTimelineFile || !voiceoverText.trim()) {
        fail("外部音频必须同时提供音频文件、subtitle-timeline.json 和确认后的口播文案");
        return;
      }

      let activeRunPaths = runPaths;
      if (!activeRunPaths) {
        const created = await postJson<CreateAudioRunResponse>("/api/create-audio-run", {
          fileName: externalAudioFile.name,
          projectName,
        });
        activeRunPaths = created.runPaths;
        setRunPaths(created.runPaths);
      }

      setStatus("uploading-audio");
      const form = new FormData();
      form.append("audio", externalAudioFile);
      form.append("subtitleTimeline", externalSubtitleTimelineFile);
      form.append("voiceoverText", voiceoverText);
      form.append("runDir", activeRunPaths.runDir);
      const uploadResponse = await fetch("/api/upload-audio", { method: "POST", body: form });
      const uploadData = await uploadResponse.json() as UploadAudioPackageResponse & { error?: string };
      if (!uploadResponse.ok) throw new Error(uploadData.error || "音频读取失败");

      setAudioPath(uploadData.audioPath);
      setAudioFileName(uploadData.fileName || externalAudioFile.name);
      setVoiceoverPath(uploadData.voiceoverPath);
      setSubtitleTimelinePath(uploadData.subtitleTimelinePath);
      setStatus("ready-for-audio");
      showToast("外部音频、文案和原生时间轴已通过校验");
    } catch (caught) {
      fail(caught instanceof Error ? caught.message : "外部音频包上传失败");
    }
  };

  const generateVoiceoverAudio = async () => {
    setError("");
    setVideoPath("");
    setGeneratedDuration(null);

    try {
      if (!voiceoverText.trim()) {
        fail("请先确认口播文案，再用 MiniMax 生成音频");
        return;
      }

      let activeRunPaths = runPaths;
      if (!activeRunPaths) {
        const created = await postJson<CreateAudioRunResponse>("/api/create-audio-run", {
          fileName: "口播音频.mp3",
          projectName,
        });
        activeRunPaths = created.runPaths;
        setRunPaths(created.runPaths);
      }

      setStatus("generating-audio");
      const generated = await postJson<GenerateVoiceoverAudioResponse>("/api/generate-voiceover-audio", {
        text: voiceoverText,
        outputDir: activeRunPaths.runDir,
        materialPackPath: checkedMaterialPackPath || undefined,
        voiceId: selectedVoiceOption.voiceId,
      });

      setAudioPath(generated.audioPath);
      setAudioFileName(generated.fileName || "口播音频.mp3");
      setVoiceoverPath(generated.voiceoverPath);
      setSubtitleTimelinePath(generated.subtitleTimelinePath);
      setExternalAudioFile(null);
      setExternalSubtitleTimelineFile(null);
      setStatus("ready-for-audio");
      showToast("音频和服务商原生时间轴已生成");
    } catch (caught) {
      fail(caught instanceof Error ? caught.message : "MiniMax 生成口播音频失败");
    }
  };

  const exportVideo = async () => {
    if (!runPaths || !audioPath || !voiceoverPath || !subtitleTimelinePath) return;
    setStatus("rendering");
    setError("");

    try {
      const result = await postJson<{ videoPath: string; qualityReport: VideoQualityReport }>("/api/export-video", {
        materialPackPath: checkedMaterialPackPath || undefined,
        audioPath,
        voiceoverPath,
        subtitleTimelinePath,
        videoBriefPath: runPaths.videoBriefPath,
        visualManifestPath: runPaths.visualManifestPath,
        assetManifestPath: runPaths.assetManifestPath,
        scenesPath: runPaths.scenesPath,
        directorPlanPath: runPaths.directorPlanPath,
        styleProfilePath: runPaths.styleProfilePath,
        productionGateReportPath: runPaths.productionGateReportPath,
        qualityReportPath: runPaths.qualityReportPath,
        qualityFramesDir: runPaths.qualityFramesDir,
        finalPath: runPaths.finalPath,
        publicRuntimeDir: runPaths.publicRuntimeDir,
        publicRuntimeBase: runPaths.publicRuntimeBase,
      });
      setVideoPath(result.videoPath);
      setQualityReport(result.qualityReport);
      setStatus("complete");
      showToast("已导出 MP4");
    } catch (caught) {
      fail(caught instanceof Error ? caught.message : "导出 MP4 失败");
    }
  };

  const openFolder = async () => {
    if (!runPaths) return;
    await postJson("/api/open-folder", { folderPath: runPaths.finalDir });
  };

  const archiveProject = async () => {
    setError("");

    try {
      const result = await postJson<ArchiveProjectResponse>("/api/archive-project", {
        projectName,
        runPaths,
        materialPackPath: checkedMaterialPackPath || materialPackPath || undefined,
        audioPath,
        voiceoverPath,
        subtitleTimelinePath,
        videoPath,
        videoStyle,
        currentTime,
        totalDuration,
        elements: editorElements,
      });
      setRunPaths(result.runPaths);
      setArchivePath(result.archivePath);
      setStatus((current) => (current === "error" ? "idle" : current));
      showToast("进度已保存");
    } catch (caught) {
      fail(caught instanceof Error ? caught.message : "项目存档失败");
    }
  };

  const confirmNewProject = () => {
    const cleanName = draftProjectName.trim() || "未命名视频";

    setProjectName(cleanName);
    setActiveProjectId(`local-${Date.now()}`);
    setProjectSearch("");
    setMaterialPackPath("");
    setCheckedMaterialPackPath("");
    setRunPaths(null);
    setStatus("idle");
    setError("");
    setAudioPath("");
    setAudioFileName("");
    setVoiceoverPath("");
    setSubtitleTimelinePath("");
    setExternalAudioFile(null);
    setExternalSubtitleTimelineFile(null);
    setVideoPath("");
    setArchivePath("");
    setMaterialPackKind("generic");
    setEditorElements(
      editorSeedElements.map((element) =>
        element.id === "headline-main"
          ? { ...element, text: cleanName, name: "主标题" }
          : element.id === "subtitle-main"
            ? { ...element, text: "确认文案和音频后，Shin-video 会按时间轴生成这条视频。" }
            : element,
      ),
    );
    setSelectedElementId(editorSeedElements[0]?.id ?? null);
    setCurrentTime(0);
    setGeneratedDuration(null);
    setQualityReport(null);
    setVoiceoverText("");
    setChatMessages([{ role: "ai", text: "新项目已创建。把文章、链接或主题发给我，我来生成口播稿。" }]);
    setShowNewProjectDialog(false);
    goStep(1);
  };

  const updateEditorElement = (elementId: string, patch: Partial<EditorElement>) => {
    setEditorElements((current) => current.map((element) => (element.id === elementId ? { ...element, ...patch } : element)));
  };

  const changeVideoStyle = (nextStyle: VideoStyle) => {
    setVideoStyle(nextStyle);
    const stylePatch = styleElementPatch[nextStyle];
    const nextProfile = styleProfiles[nextStyle];
    setEditorElements((current) =>
      current.map((element) => ({
        ...element,
        text:
          element.id === "headline-main"
            ? nextProfile.sampleTitle
            : element.id === "subtitle-main"
              ? nextProfile.sampleSubtitle
              : element.text,
        value: element.id === "metric-main" ? nextProfile.sampleMetricValue : element.value,
        caption: element.id === "metric-main" ? nextProfile.sampleMetricCaption : element.caption,
        color: element.type === "subtitle" ? (nextStyle === "dark-data-analysis" ? "#cbd5e1" : stylePatch.color) : stylePatch.color,
        background:
          element.type === "headline" || element.type === "subtitle" || element.type === "connector"
            ? element.background
            : stylePatch.background,
        borderColor: stylePatch.borderColor,
        accent: stylePatch.accent,
      })),
    );
  };

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatMessages((current) => [
      ...current,
      { role: "me", text },
      { role: "ai", text: "收到，我会按这个方向调整右侧口播文案。当前版本可以继续编辑，也可以确认后进入音频。" },
    ]);
    setVoiceoverText((current) => (current.trim() ? current : defaultVoiceover));
    setChatInput("");
  };

  const resetCurrentRun = () => {
    setRunPaths(null);
    setAudioPath("");
    setAudioFileName("");
    setVoiceoverPath("");
    setSubtitleTimelinePath("");
    setExternalAudioFile(null);
    setExternalSubtitleTimelineFile(null);
    setVideoPath("");
    setGeneratedDuration(null);
    setError("");
    setStatus("idle");
    showToast("已清空当前运行");
  };

  const filteredProjects = projectSeeds.filter((project) => project.name.toLowerCase().includes(projectSearch.toLowerCase()));

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_18%_6%,rgba(37,99,235,0.12),transparent_28rem),radial-gradient(circle_at_88%_12%,rgba(14,165,166,0.14),transparent_28rem),linear-gradient(180deg,#fff_0%,#f6f8fb_48%,#edf4f8_100%)] text-slate-950">
      <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white/76 px-5 backdrop-blur-xl lg:px-8">
        <button type="button" onClick={() => goStep(0)} className="flex items-center gap-3 text-left">
          <img src="/thinkai-news-logo.png" alt="THINKAI News" className="h-[40px] w-auto object-contain" />
        </button>
        {wizardStep > 0 ? (
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 sm:inline-flex">
              {statusText[status]}
            </span>
            <button
              type="button"
              onClick={resetCurrentRun}
              disabled={busy}
              className="hidden h-10 items-center rounded-[14px] bg-slate-100 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-45 sm:inline-flex"
            >
              清空当前运行
            </button>
            <button
              type="button"
              onClick={archiveProject}
              disabled={busy}
              className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-45"
            >
              <Archive size={16} />
              保存进度
            </button>
          </div>
        ) : null}
      </header>

      <div className="min-h-[calc(100vh-72px)] p-4 lg:p-6">
        {wizardStep === 0 ? (
          <section className="grid min-h-[calc(100vh-120px)] place-items-center">
            <div className="grid min-h-[520px] w-full max-w-[720px] place-items-center rounded-[38px] border border-slate-200/90 bg-white/86 p-8 text-center shadow-[0_24px_70px_rgba(17,24,39,0.12)] backdrop-blur-xl">
              <div>
                <h1 className="whitespace-nowrap text-[clamp(42px,5vw,72px)] font-black leading-none tracking-normal text-slate-950">
                  定制你的Ai视频
                </h1>
                <button
                  type="button"
                  onClick={() => goStep(1)}
                  className="mt-9 h-[68px] rounded-[22px] bg-slate-950 px-11 text-xl font-black text-white shadow-2xl shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  开始制作视频
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="mx-auto grid h-[calc(100vh-120px)] max-w-[1500px] grid-cols-1 gap-4 min-[1120px]:grid-cols-[280px_minmax(0,1fr)]">
            <ProjectSidebar
              activeProjectId={activeProjectId}
              projectSearch={projectSearch}
              projects={filteredProjects}
              onSearch={setProjectSearch}
              onNewProject={() => {
                setDraftProjectName("");
                setShowNewProjectDialog(true);
              }}
              onSelect={(project) => {
                setActiveProjectId(project.id);
                setProjectName(project.name);
                setChatMessages([{ role: "ai", text: `已打开项目：${project.name}。你可以继续修改这条视频的口播文案。` }]);
                showToast(`已切换项目：${project.name}`);
              }}
            />

            <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
              <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                {wizardSteps.map(({ step, label }) => {
                  const active = wizardStep === step;
                  const done = wizardStep > step;
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => goStep(step)}
                      className={`flex h-[52px] items-center justify-center gap-2 rounded-[17px] border text-sm font-black transition ${
                        active
                          ? "border-transparent bg-[linear-gradient(135deg,#2563eb,#0ea5a6)] text-white shadow-lg shadow-blue-500/20"
                          : done
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white/76 text-slate-500 hover:border-blue-200"
                      }`}
                    >
                      <span className={`grid h-7 w-7 place-items-center rounded-[10px] text-xs ${active ? "bg-white/20" : done ? "bg-emerald-100" : "bg-slate-100"}`}>
                        {done ? <Check size={14} /> : step}
                      </span>
                      {label}
                    </button>
                  );
                })}
              </div>

              {wizardStep === 1 ? (
                <WizardPanel
                  title="文案工作台"
                  subtitle="一个项目对应一条视频。左侧项目栏可随时切换，中间对话，右侧确认口播文案。"
                  action={
                    <button
                      type="button"
                      onClick={() => {
                        setDraftProjectName("");
                        setShowNewProjectDialog(true);
                      }}
                      className="inline-flex h-12 items-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#2563eb,#0ea5a6)] px-5 text-sm font-black text-white shadow-lg shadow-blue-500/20"
                    >
                      <Plus size={17} />
                      新建项目
                    </button>
                  }
                >
                  <div className="grid h-full min-h-0 grid-cols-1 min-[1220px]:grid-cols-[minmax(0,1fr)_360px]">
                    <section className="grid min-h-0 grid-rows-[1fr_auto] bg-white">
                      <div className="flex min-h-0 flex-col gap-3 overflow-auto p-6">
                        {chatMessages.map((message, index) => (
                          <div
                            key={`${message.role}-${index}`}
                            className={`max-w-[78%] rounded-[20px] px-4 py-3 text-sm leading-7 ${
                              message.role === "me" ? "ml-auto bg-slate-950 text-white" : "bg-blue-50 text-blue-900"
                            }`}
                          >
                            {message.text}
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-slate-200 bg-slate-50/70 p-4">
                        <div className="grid grid-cols-[1fr_auto] gap-3 rounded-[18px] border border-slate-200 bg-white p-2">
                          <input
                            value={chatInput}
                            onChange={(event) => setChatInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") sendChat();
                            }}
                            placeholder="继续修改文案，例如：开头更抓人一点..."
                            className="min-w-0 border-0 px-3 text-sm outline-none"
                          />
                          <button
                            type="button"
                            onClick={sendChat}
                            className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#2563eb,#0ea5a6)] px-4 text-sm font-black text-white"
                          >
                            <Send size={16} />
                            发送
                          </button>
                        </div>
                      </div>
                    </section>

                    <aside className="grid min-h-0 grid-rows-[auto_1fr_auto] gap-3 border-t border-slate-200 bg-slate-50/70 p-4 min-[1220px]:border-l min-[1220px]:border-t-0">
                      <p className="text-sm font-black text-slate-500">当前项目口播文案</p>
                      <textarea
                        value={voiceoverText}
                        onChange={(event) => updateVoiceoverText(event.target.value)}
                        className="min-h-[300px] resize-none rounded-[22px] border border-slate-200 bg-white p-4 text-base leading-8 text-slate-800 outline-none focus:border-blue-300"
                      />
                      <div className="grid gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            updateVoiceoverText(defaultVoiceover);
                            showToast("已重写当前文案");
                          }}
                          className="h-12 rounded-[16px] bg-blue-50 text-sm font-black text-blue-800 transition hover:bg-blue-100"
                        >
                          AI 重写当前文案
                        </button>
                        <button
                          type="button"
                          onClick={() => goStep(2)}
                          disabled={!voiceoverText.trim()}
                          className="h-12 rounded-[16px] bg-slate-950 text-sm font-black text-white transition hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
                        >
                          确认文案，下一步
                        </button>
                      </div>
                    </aside>
                  </div>
                </WizardPanel>
              ) : null}

              {wizardStep === 2 ? (
                <WizardPanel
                  title="选择音色并生成音频"
                  subtitle="TTS 会同时生成音频和原生时间轴；导入外部音频时，必须同时提供匹配的 subtitle-timeline.json 和确认口播文案。"
                  action={
                    <button
                      type="button"
                      onClick={generateVoiceoverAudio}
                      disabled={busy || !voiceoverText.trim()}
                      className="inline-flex h-12 items-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#2563eb,#0ea5a6)] px-5 text-sm font-black text-white shadow-lg shadow-blue-500/20 disabled:opacity-45"
                    >
                      <Sparkles size={17} />
                      生成音频
                    </button>
                  }
                  footer={
                    <>
                      <button type="button" onClick={() => goStep(1)} className="h-11 rounded-[14px] bg-slate-100 px-5 text-sm font-bold text-slate-700">
                        上一步
                      </button>
                      <button
                        type="button"
                        onClick={() => goStep(3)}
                        disabled={!audioPackageReady}
                        className="h-12 rounded-[16px] bg-slate-950 px-7 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        确认音频，下一步
                      </button>
                    </>
                  }
                >
                  <div className="h-full overflow-auto p-6">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {voiceOptions.map((voice) => (
                        <button
                          key={voice.id}
                          type="button"
                          onClick={() => setSelectedVoice(voice.id)}
                          className={`grid min-h-[196px] content-between gap-4 rounded-[22px] border bg-white p-4 text-left transition ${
                            selectedVoice === voice.id
                              ? "border-sky-300 bg-[linear-gradient(180deg,#f0f9ff,#fff)] shadow-lg shadow-sky-100"
                              : "border-slate-200 hover:border-sky-200"
                          }`}
                        >
                          <span>
                            <span className="grid h-14 w-14 place-items-center rounded-[19px] bg-[linear-gradient(135deg,#2563eb,#0ea5a6)] text-2xl font-black text-white">
                              {voice.tag}
                            </span>
                            <span className="mt-3 block text-lg font-black">{voice.name}</span>
                            <span className="mt-2 block text-sm leading-6 text-slate-500">{voice.description}</span>
                          </span>
                          <span
                            onClick={(event) => {
                              event.stopPropagation();
                              showToast(`试听：${voice.name}`);
                            }}
                            className="w-fit rounded-full bg-sky-100 px-3 py-1.5 text-xs font-black text-sky-800"
                          >
                            试听
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-4 rounded-[24px] bg-slate-950 p-5 text-white lg:grid-cols-[180px_1fr_auto] lg:items-center">
                      <div>
                        <p className="text-sm font-bold text-slate-300">{audioFileName ? "当前音频" : selectedVoiceLabel}</p>
                        <p className="mt-1 text-4xl font-black">{generatedDuration ? `${Math.round(generatedDuration)}s` : "01:32"}</p>
                      </div>
                      <div className="h-[76px] rounded-[18px] bg-[linear-gradient(90deg,transparent_0_5%,rgba(255,255,255,.50)_5%_6%,transparent_6%_11%,rgba(45,212,191,.75)_11%_14%,transparent_14%_21%,rgba(147,197,253,.68)_21%_24%,transparent_24%_32%,rgba(255,255,255,.42)_32%_34%,transparent_34%_42%,rgba(45,212,191,.80)_42%_46%,transparent_46%_56%,rgba(147,197,253,.72)_56%_59%,transparent_59%_68%,rgba(255,255,255,.46)_68%_70%,transparent_70%_78%,rgba(45,212,191,.82)_78%_82%,transparent_82%),rgba(255,255,255,.07)]" />
                      <button type="button" onClick={() => showToast("播放音频预览")} className="h-12 rounded-[16px] bg-white px-5 text-sm font-black text-slate-950">
                        播放
                      </button>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="grid gap-3">
                        <AudioDropzone
                          disabled={busy}
                          fileName={externalAudioFile?.name || audioFileName}
                          onFile={selectExternalAudioFile}
                        />
                        <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                          <div className="flex items-start gap-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-sky-50 text-sky-700">
                              <FileAudio2 size={18} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-800">外部音频完整包</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                使用当前已确认的口播文案，并校验音频、文案与服务商原生时间轴是否属于同一次生成。
                              </p>
                            </div>
                          </div>
                          <label className="mt-4 block">
                            <span className="mb-2 block text-xs font-bold text-slate-500">服务商原生时间轴 JSON</span>
                            <input
                              type="file"
                              accept=".json,application/json"
                              disabled={busy}
                              onChange={(event) => {
                                selectExternalSubtitleTimelineFile(event.target.files?.item(0) ?? null);
                              }}
                              className="block w-full rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 file:mr-3 file:rounded-[9px] file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
                            />
                          </label>
                          <p className="mt-2 break-all text-[11px] leading-5 text-slate-400">
                            {subtitleTimelinePath
                              ? `已就绪：${subtitleTimelinePath}`
                              : externalSubtitleTimelineFile
                                ? `待校验：${externalSubtitleTimelineFile.name}`
                                : "请选择 subtitle-timeline.json"}
                          </p>
                          <button
                            type="button"
                            onClick={uploadExternalAudioPackage}
                            disabled={busy || !externalAudioFile || !externalSubtitleTimelineFile || !voiceoverText.trim()}
                            className="mt-3 h-11 w-full rounded-[14px] bg-slate-950 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400"
                          >
                            校验并导入外部音频包
                          </button>
                        </div>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <p className="text-sm font-black text-slate-700">可选素材包增强</p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">没有素材包也能做视频。素材包只用于后续增强画面，不是必填项。</p>
                        <div className="mt-4">
                          <MaterialPackPicker
                            value={materialPackPath}
                            disabled={busy}
                            onChange={(value) => {
                              setMaterialPackPath(value);
                              setCheckedMaterialPackPath("");
                            }}
                            onCheck={checkMaterialPack}
                          />
                        </div>
                        <p className="mt-3 break-all text-[11px] leading-5 text-slate-400">
                          {checkedMaterialPackPath ? `已启用：${checkedMaterialPackPath}` : "当前按纯音频工作流生成。"}
                        </p>
                      </div>
                    </div>
                  </div>
                </WizardPanel>
              ) : null}

              {wizardStep === 3 ? (
                <WizardPanel
                  title="选择视频风格和比例"
                  subtitle="先选 Remotion 风格库和画面比例，再生成预览。"
                  action={
                    <button
                      type="button"
                      onClick={() => runPipeline()}
                      disabled={!audioPackageReady || !runPaths || busy}
                      className="inline-flex h-12 items-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#2563eb,#0ea5a6)] px-5 text-sm font-black text-white shadow-lg shadow-blue-500/20 disabled:opacity-45"
                    >
                      <MonitorPlay size={17} />
                      生成视频预览
                    </button>
                  }
                  footer={
                    <>
                      <button type="button" onClick={() => goStep(2)} className="h-11 rounded-[14px] bg-slate-100 px-5 text-sm font-bold text-slate-700">
                        上一步
                      </button>
                      <button
                        type="button"
                        onClick={() => goStep(4)}
                        disabled={!videoPath}
                        className="h-12 rounded-[16px] bg-slate-950 px-7 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        进入视频编辑器
                      </button>
                    </>
                  }
                >
                  <div className="grid h-full gap-5 overflow-auto p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <section>
                      <div className="mb-4 grid grid-cols-2 gap-3">
                        {(["9:16", "16:9"] as AspectRatio[]).map((ratio) => (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() => setAspectRatio(ratio)}
                            className={`min-h-[94px] rounded-[22px] border bg-white p-4 text-left transition ${
                              aspectRatio === ratio ? "border-sky-300 bg-sky-50 shadow-lg shadow-sky-100" : "border-slate-200"
                            }`}
                          >
                            <span className="block text-lg font-black">{ratio === "9:16" ? "9:16 竖屏" : "16:9 横屏"}</span>
                            <span className="mt-2 block text-sm leading-6 text-slate-500">
                              {ratio === "9:16" ? "抖音、小红书、视频号优先。" : "B 站、YouTube、课程页优先。"}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {(Object.keys(videoStyleLabel) as VideoStyle[]).map((style) => (
                          <button
                            key={style}
                            type="button"
                            disabled={busy}
                            onClick={() => changeVideoStyle(style)}
                            className={`rounded-[22px] border bg-white p-4 text-left transition ${
                              videoStyle === style
                                ? "border-sky-300 bg-[linear-gradient(180deg,#f0f9ff,#fff)] shadow-lg shadow-sky-100"
                                : "border-slate-200 hover:border-sky-200"
                            }`}
                          >
                            <span className="flex items-center justify-between gap-3">
                              <span className="text-base font-black">{videoStyleLabel[style]}</span>
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: styleProfiles[style].accent }} />
                            </span>
                            <span className="mt-2 block text-sm leading-6 text-slate-500">{videoStyleDescription[style]}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                    <aside className="rounded-[24px] border border-slate-200 bg-white p-5">
                      <PreviewFrame aspectRatio={aspectRatio} videoStyle={videoStyle} videoPath="" />
                      <button
                        type="button"
                        onClick={() => runPipeline()}
                        disabled={!audioPackageReady || !runPaths || busy}
                        className="mt-4 h-12 w-full rounded-[16px] bg-slate-950 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        生成视频预览
                      </button>
                    </aside>
                  </div>
                </WizardPanel>
              ) : null}

              {wizardStep === 4 ? (
                <WizardPanel title="视频预览与质量检查" subtitle="自动检查问题镜头和实际成片，确认通过后直接导出 MP4。">
                  <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[250px_minmax(0,1fr)_300px]">
                    <aside className="overflow-auto border-b border-slate-200 bg-slate-50/70 p-4 xl:border-b-0 xl:border-r">
                      <p className="mb-3 text-sm font-black text-slate-500">质量问题</p>
                      {qualityReport ? (
                        <>
                          <div className={`mb-4 rounded-[14px] border p-3 ${qualityReport.passed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                            <p className="text-sm font-black">{qualityReport.passed ? "自动检查通过" : `${qualityReport.issues.length} 个问题待处理`}</p>
                            <p className="mt-1 text-xs">{qualityReport.render ? `${qualityReport.render.width}x${qualityReport.render.height} · ${qualityReport.render.durationSeconds.toFixed(1)} 秒` : "渲染前检查未通过"}</p>
                          </div>
                          {qualityReport.issues.map((issue) => (
                            <button
                              key={`${issue.code}-${issue.sceneId ?? "video"}`}
                              type="button"
                              onClick={() => showToast(issue.sceneId ? `定位：${issue.sceneId}` : "这是整条视频的问题")}
                              className="mb-2 w-full rounded-[14px] border border-slate-200 bg-white p-3 text-left"
                            >
                              <span className="block text-xs font-black text-slate-900">{issue.sceneId ?? "整条视频"}</span>
                              <span className="mt-1 block text-xs leading-5 text-slate-600">{issue.message}</span>
                            </button>
                          ))}
                        </>
                      ) : (
                        <p className="rounded-[14px] border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-500">生成预览后，这里会显示具体问题镜头和修复建议。</p>
                      )}
                    </aside>

                    <section className="grid min-h-[640px] grid-rows-[1fr_82px] gap-4 bg-slate-100 p-4">
                      <div className="grid min-h-0 place-items-center">
                        {videoPath ? (
                          <div className={`${aspectRatio === "9:16" ? "h-full max-h-[560px] aspect-[9/16]" : "w-full max-w-[760px] aspect-video"} overflow-hidden rounded-[30px] border-[9px] border-slate-950 bg-black shadow-2xl shadow-slate-950/20`}>
                            <video key={videoPath} src={renderedVideoSrc} controls className="h-full w-full object-contain" />
                          </div>
                        ) : (
                          <PreviewFrame aspectRatio={aspectRatio} videoStyle={videoStyle} videoPath="" large />
                        )}
                      </div>
                      <div className="grid grid-cols-[72px_1fr_90px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4">
                        <strong className="text-sm">00:{String(Math.round(currentTime)).padStart(2, "0")}</strong>
                        <input
                          aria-label="当前时间"
                          type="range"
                          min={0}
                          max={Math.max(1, totalDuration)}
                          step={0.1}
                          value={Math.min(currentTime, totalDuration)}
                          onChange={(event) => setCurrentTime(Number(event.target.value))}
                          className="accent-blue-600"
                        />
                        <button type="button" onClick={() => showToast("播放预览")} className="h-9 rounded-full bg-sky-100 text-xs font-black text-sky-800">
                          播放
                        </button>
                      </div>
                    </section>

                    <aside className="overflow-auto border-t border-slate-200 bg-slate-50/70 xl:border-l xl:border-t-0">
                      <div className="p-4">
                        <p className="text-sm font-black text-slate-700">代表帧</p>
                        <div className="mt-3 grid gap-2">
                          {qualityReport?.render?.framePaths.map((framePath, index) => (
                            <img
                              key={framePath}
                              src={`/api/video?path=${encodeURIComponent(framePath)}`}
                              alt={`代表帧 ${index + 1}`}
                              className="aspect-video w-full rounded-[10px] border border-slate-200 bg-slate-950 object-cover"
                            />
                          ))}
                          {!qualityReport?.render?.framePaths.length ? <p className="text-xs leading-5 text-slate-500">预览完成后自动抽取开头、中段和结尾画面。</p> : null}
                        </div>
                      </div>
                      <div className="space-y-2 border-t border-slate-200 p-4">
                        <button type="button" onClick={() => goStep(3)} className="h-11 w-full rounded-[14px] bg-slate-100 text-sm font-bold text-slate-700">
                          上一步
                        </button>
                        <button
                          type="button"
                          onClick={() => runPipeline()}
                          disabled={!audioPackageReady || !runPaths || busy}
                          className="h-11 w-full rounded-[14px] bg-[linear-gradient(135deg,#2563eb,#0ea5a6)] text-sm font-black text-white disabled:opacity-45"
                        >
                          重新生成预览
                        </button>
                        <button
                          type="button"
                          onClick={exportVideo}
                          disabled={status !== "complete" || !qualityReport?.passed || !runPaths || !audioPackageReady || busy}
                          className="h-12 w-full rounded-[16px] bg-slate-950 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-400"
                        >
                          导出 MP4
                        </button>
                        <button
                          type="button"
                          onClick={openFolder}
                          disabled={!runPaths}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-white text-sm font-bold text-slate-600 disabled:text-slate-300"
                        >
                          <FolderOpen size={16} />
                          打开文件夹
                        </button>
                      </div>
                    </aside>
                  </div>
                </WizardPanel>
              ) : null}
            </div>
          </section>
        )}
      </div>

      {wizardStep > 0 && (busy || status === "complete" || status === "error" || Boolean(error)) ? (
        <div className="fixed bottom-4 left-4 z-40 w-[min(420px,calc(100vw-32px))]">
          <StatusFlow status={status} error={error} />
          {archivePath ? <p className="mt-2 truncate rounded-full bg-white/80 px-3 py-2 text-xs text-slate-500 shadow-sm">已存档：{archivePath}</p> : null}
          {materialPackKind === "template-project" ? <p className="mt-2 rounded-full bg-white/80 px-3 py-2 text-xs text-slate-500 shadow-sm">当前启用素材模板</p> : null}
        </div>
      ) : null}

      {showNewProjectDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-950/10">
            <h2 className="text-lg font-black text-slate-950">新建视频项目</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">输入这条视频的主题名称，当前运行状态会被重置。</p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-bold text-slate-500">项目名称</span>
              <input
                autoFocus
                value={draftProjectName}
                onChange={(event) => setDraftProjectName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") confirmNewProject();
                  if (event.key === "Escape") setShowNewProjectDialog(false);
                }}
                placeholder="例如：腾讯混元 Hy3 发布解读"
                className="h-11 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewProjectDialog(false)}
                className="inline-flex h-10 items-center rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmNewProject}
                className="inline-flex h-10 items-center rounded-[14px] bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800"
              >
                新建
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`fixed bottom-6 left-1/2 z-50 flex h-11 -translate-x-1/2 items-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-2xl shadow-slate-950/20 transition ${
          toastMessage ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {toastMessage}
      </div>
    </main>
  );
}

const WizardPanel = ({
  title,
  subtitle,
  action,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) => (
  <div className="grid min-h-0 overflow-hidden rounded-[30px] border border-slate-200/90 bg-white/88 shadow-[0_24px_70px_rgba(17,24,39,0.12)] backdrop-blur-xl" style={{ gridTemplateRows: footer ? "auto minmax(0,1fr) auto" : "auto minmax(0,1fr)" }}>
    <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h2 className="text-3xl font-black tracking-normal text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-7 text-slate-500">{subtitle}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
    <div className="min-h-0 overflow-hidden">{children}</div>
    {footer ? <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4">{footer}</div> : null}
  </div>
);

const ProjectSidebar = ({
  activeProjectId,
  projectSearch,
  projects,
  onSearch,
  onNewProject,
  onSelect,
}: {
  activeProjectId: string;
  projectSearch: string;
  projects: typeof projectSeeds;
  onSearch: (value: string) => void;
  onNewProject: () => void;
  onSelect: (project: (typeof projectSeeds)[number]) => void;
}) => (
  <aside className="grid min-h-[220px] grid-rows-[auto_auto_1fr] gap-3 overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_24px_70px_rgba(17,24,39,0.12)]">
    <div className="p-4 pb-0">
      <p className="mb-2 text-sm font-black text-slate-500">项目</p>
      <input
        value={projectSearch}
        onChange={(event) => onSearch(event.target.value)}
        placeholder="搜索项目"
        className="h-11 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
      />
    </div>
    <div className="px-4">
      <button
        type="button"
        onClick={onNewProject}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[15px] bg-slate-950 text-sm font-black text-white"
      >
        <Plus size={16} />
        新建视频项目
      </button>
    </div>
    <div className="grid content-start gap-2 overflow-auto p-4 pt-0">
      {projects.map((project) => (
        <button
          key={project.id}
          type="button"
          onClick={() => onSelect(project)}
          className={`rounded-[16px] border p-3 text-left transition ${
            activeProjectId === project.id ? "border-sky-300 bg-sky-100" : "border-slate-200 bg-white hover:border-sky-200"
          }`}
        >
          <span className="block text-[15px] font-black text-slate-950">{project.name}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">{project.meta}</span>
        </button>
      ))}
    </div>
  </aside>
);

const PreviewFrame = ({
  aspectRatio,
  videoStyle,
  videoPath,
  large,
}: {
  aspectRatio: AspectRatio;
  videoStyle: VideoStyle;
  videoPath: string;
  large?: boolean;
}) => {
  const profile = styleProfiles[videoStyle];
  const dark = videoStyle === "dark-data-analysis" || videoStyle === "fast-short-video";
  const frameSize =
    aspectRatio === "9:16"
      ? large
        ? "h-full max-h-[560px] aspect-[9/16]"
        : "mx-auto h-[420px] aspect-[9/16]"
      : large
        ? "w-full max-w-[760px] aspect-video"
        : "h-[235px] w-full aspect-video";

  if (videoPath) {
    return (
      <div className={`${frameSize} overflow-hidden rounded-[30px] border-[9px] border-slate-950 bg-black shadow-2xl shadow-slate-950/20`}>
        <video src={`/api/video?path=${encodeURIComponent(videoPath)}`} controls className="h-full w-full object-contain" />
      </div>
    );
  }

  return (
    <div className={`${frameSize} overflow-hidden rounded-[30px] border-[9px] border-slate-950 p-5 shadow-2xl shadow-slate-950/20 ${profile.previewClass} ${profile.stageClass}`}>
      <div className="flex h-full flex-col justify-between">
        <span className={`w-fit rounded-full px-3 py-2 text-xs font-black ${dark ? "bg-white/10 text-white" : "bg-sky-100 text-sky-800"}`}>
          {profile.label}
        </span>
        <div>
          <h3 className="text-[28px] font-black leading-tight tracking-normal">{profile.sampleTitle}</h3>
          <p className={`mt-3 text-sm leading-6 ${dark ? "text-slate-300" : "text-slate-600"}`}>{profile.sampleSubtitle}</p>
        </div>
        <div className={`w-[82%] rounded-[20px] border p-4 shadow-lg ${profile.cardClass}`}>
          <strong className="text-sm">{profile.sampleMetricLabel}</strong>
          <p className="mt-2 text-3xl font-black" style={{ color: profile.accent }}>{profile.sampleMetricValue}</p>
          <div className="mt-3 space-y-2">
            <span className="block h-2 rounded-full bg-sky-200" />
            <span className="block h-2 w-2/3 rounded-full bg-teal-200" />
          </div>
        </div>
        <p className={`font-black ${dark ? "text-slate-200" : "text-slate-700"}`}>{profile.sampleMetricCaption}</p>
      </div>
    </div>
  );
};
