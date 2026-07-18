import { execFile as execFileCallback } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { z } from "zod";
import type {
  GeneratedImageManifest,
  GeneratedImageManifestEntry,
  RuntimeAsset,
  RuntimeAssetManifest,
  RuntimeAssetSceneBinding,
  RuntimeEvidenceRecord,
  RuntimeVideoBrief,
  RuntimeVisualManifest,
  Scene,
  VisualModule,
} from "./types";

const execFile = promisify(execFileCallback);

export type ResearchAssetsInput = {
  title: string;
  article: string;
  sourceUrl?: string;
  videoBrief: RuntimeVideoBrief;
  visualManifest: RuntimeVisualManifest;
  scenes: Scene[];
  assetManifestPath: string;
  generatedImageManifestPath?: string;
  dryRun?: boolean;
  maxAssets?: number;
};

const userAgent = "Mozilla/5.0 Shin-video asset researcher";
const screenshotViewport = { width: 1440, height: 1100 };
const chromeCandidates = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "google-chrome",
  "chromium",
  "chromium-browser",
];

const normalize = (value: string): string => value.replace(/\s+/g, " ").trim();

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const domainFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown-source";
  }
};

const safeFilePart = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "asset";

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const generatedImageSizeSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).passthrough();

const generatedImageEntrySchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  model: z.string().min(1),
  prompt: z.string().min(1),
  requestedSize: generatedImageSizeSchema,
  actualSize: generatedImageSizeSchema,
  role: z.string().min(1),
  evidenceStatus: z.literal("concept-only"),
  visualTreatment: z.enum([
    "full-screen-cinematic-crop",
    "foreground-subject-plus-motion-graphics",
    "partial-crop-beside-real-evidence",
    "layered-parallax",
  ]),
  factLabel: z.string().min(1).optional(),
  boundSceneIds: z.array(z.string().min(1)).min(1),
  requestRecord: z.string().min(1),
  responseRecord: z.string().min(1),
}).passthrough().superRefine((entry, context) => {
  if (entry.visualTreatment === "partial-crop-beside-real-evidence" && !entry.factLabel) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["factLabel"],
      message: "partial-crop-beside-real-evidence 必须提供可核对的 factLabel",
    });
  }
  if (new Set(entry.boundSceneIds).size !== entry.boundSceneIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["boundSceneIds"],
      message: "boundSceneIds 不能重复",
    });
  }
});

const generatedImageManifestSchema = z.object({
  images: z.array(generatedImageEntrySchema),
}).passthrough();

type ResolvedGeneratedImage = {
  entry: GeneratedImageManifestEntry;
  localPath: string;
  fileName: string;
};

const mimeTypeFromFileName = (fileName: string): string => {
  switch (path.extname(fileName).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "image/png";
  }
};

const readGeneratedImageManifest = async (
  manifestPath: string,
  scenes: Scene[],
): Promise<{ manifest: GeneratedImageManifest; images: ResolvedGeneratedImage[] }> => {
  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`生成图片清单不存在：${manifestPath}`);
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`生成图片清单不是有效 JSON：${manifestPath}`);
  }

  const result = generatedImageManifestSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`生成图片清单无效：${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("；")}`);
  }

  const manifest = result.data as GeneratedImageManifest;
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const manifestDir = path.dirname(manifestPath);
  const images: ResolvedGeneratedImage[] = [];

  for (const entry of manifest.images) {
    for (const sceneId of entry.boundSceneIds) {
      if (!sceneIds.has(sceneId)) {
        throw new Error(`生成图片 ${entry.id} 绑定的 scene ${sceneId} 不存在于生成后的 scenes`);
      }
    }

    const candidates = path.isAbsolute(entry.fileName)
      ? [entry.fileName]
      : [
          path.join(manifestDir, "images", entry.fileName),
          path.join(manifestDir, entry.fileName),
        ];
    const localPath = (await Promise.all(candidates.map(async (candidate) => (await fileExists(candidate)) ? candidate : undefined)))
      .find(Boolean);
    if (!localPath) {
      throw new Error(`生成图片 ${entry.id} 对应文件不存在：${entry.fileName}`);
    }

    images.push({
      entry,
      localPath,
      fileName: path.basename(entry.fileName),
    });
  }

  return { manifest, images };
};

const mergeGeneratedImages = (
  manifest: RuntimeAssetManifest,
  generatedImages: ResolvedGeneratedImage[],
): RuntimeAssetManifest => {
  const assetIds = new Set(manifest.assets.map((asset) => asset.id));
  const fileNames = new Set(manifest.assets.map((asset) => asset.fileName));
  const generatedAssetIdsByScene = new Map<string, string[]>();

  for (const { entry, localPath, fileName } of generatedImages) {
    if (assetIds.has(entry.id)) {
      throw new Error(`生成图片 id 与现有素材冲突：${entry.id}`);
    }
    if (fileNames.has(fileName)) {
      throw new Error(`生成图片文件名与现有研究素材冲突：${fileName}`);
    }
    assetIds.add(entry.id);
    fileNames.add(fileName);

    manifest.assets.push({
      id: entry.id,
      type: "ai-generated",
      role: "concept",
      sourceUrl: `shin-video://generated-image/${encodeURIComponent(entry.id)}`,
      sourceTitle: entry.role,
      sourceDomain: "ai-generation",
      localPath,
      fileName,
      mimeType: mimeTypeFromFileName(fileName),
      attribution: `AI-generated concept image (${entry.model})`,
      usageRisk: "medium",
      capture: {
        method: "ai-generation",
        capturedAt: new Date().toISOString(),
      },
      metadata: { ...entry },
      notes: "AI 生成概念图，只用于视觉解释，不属于事实证据。",
    });

    for (const sceneId of entry.boundSceneIds) {
      const ids = generatedAssetIdsByScene.get(sceneId) ?? [];
      ids.push(entry.id);
      generatedAssetIdsByScene.set(sceneId, ids);
    }
  }

  for (const binding of manifest.sceneBindings) {
    const generatedAssetIds = generatedAssetIdsByScene.get(binding.sceneId);
    if (!generatedAssetIds?.length) continue;
    binding.assetIds = [...new Set([...generatedAssetIds, ...binding.assetIds])];
  }

  return manifest;
};

const findChrome = async (): Promise<string | undefined> => {
  for (const candidate of chromeCandidates) {
    if (candidate.includes("/")) {
      if (await fileExists(candidate)) return candidate;
      continue;
    }
    try {
      const { stdout } = await execFile("which", [candidate]);
      const resolved = stdout.trim();
      if (resolved) return resolved;
    } catch {
      continue;
    }
  }
  return undefined;
};

export const extractAssetQueries = (title: string, article: string, videoBrief?: RuntimeVideoBrief): string[] => {
  const text = `${title}\n${videoBrief?.topic ?? ""}\n${videoBrief?.coreAngle ?? ""}\n${article}`;
  const english = text.match(/\b[A-Z][A-Za-z0-9.-]{2,}\b/g) ?? [];
  const chineseEntities = text.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,16}(?:公司|模型|芯片|平台|产品|系统|发布|官网|报告|交易所|基金|指数|收入|价格|技术|论文)/g) ?? [];
  const proof = videoBrief?.proofPoints ?? [];
  const base = [title, ...english, ...chineseEntities, ...proof]
    .map((item) => normalize(item).replace(/[，。！？、；:：]/g, ""))
    .filter((item) => item.length >= 2 && item.length <= 40);

  return [...new Set(base)].slice(0, 8);
};

const absoluteUrl = (maybeUrl: string, baseUrl: string): string | undefined => {
  try {
    return new URL(maybeUrl, baseUrl).toString();
  } catch {
    return undefined;
  }
};

const firstMatch = (html: string, patterns: RegExp[]): string | undefined => {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = match?.[1] || match?.[2];
    if (value) return value.trim();
  }
  return undefined;
};

const extractPageMeta = (html: string, pageUrl: string): { title: string; imageUrl?: string } => {
  const title = normalize(
    firstMatch(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    ]) ?? domainFromUrl(pageUrl),
  );
  const image = firstMatch(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ]);
  return {
    title,
    imageUrl: image ? absoluteUrl(image, pageUrl) : undefined,
  };
};

const fetchText = async (url: string): Promise<string | undefined> => {
  try {
    const response = await fetch(url, { headers: { "User-Agent": userAgent } });
    if (!response.ok) return undefined;
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) return undefined;
    return response.text();
  } catch {
    return undefined;
  }
};

const readableTextFromHtml = (html: string): string =>
  normalize(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, "\""),
  );

const splitEvidenceSentences = (text: string): string[] =>
  readableTextFromHtml(text)
    .split(/(?<=[。！？!?；;])|\n/g)
    .map((sentence) => normalize(sentence))
    .filter((sentence) => sentence.length >= 12 && sentence.length <= 120)
    .filter((sentence) => !/^(已关注|关注|重播|分享|赞|关闭|更多|退出全屏|倍速|视频详情)/.test(sentence));

const selectSourceEvidenceExcerpts = (
  article: string,
  scenes: Scene[],
  videoBrief: RuntimeVideoBrief,
  limit = 3,
): Array<{ text: string; narrationClaim?: string }> => {
  const sentences = splitEvidenceSentences(article);
  const claims = scenes.map((scene) => scene.subtitle).filter(Boolean);
  const proofTerms = [...videoBrief.proofPoints, ...videoBrief.assetNeeds, videoBrief.topic]
    .flatMap((term) => term.split(/[、，,/\s]+/g))
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);

  const scored = sentences.map((sentence, index) => {
    let score = Math.max(0, 20 - index * 0.15);
    if (/\d|%|倍|亿|万|美元|元|Token|参数|发布|上线|开源|融资|亏损|收入|成本|价格/i.test(sentence)) score += 8;
    score += proofTerms.filter((term) => sentence.includes(term)).length * 4;
    const narrationClaim = claims.find((claim) => {
      const compactClaim = claim.replace(/\s+/g, "");
      return compactClaim.length >= 8 && sentence.replace(/\s+/g, "").includes(compactClaim.slice(0, Math.min(16, compactClaim.length)));
    });
    if (narrationClaim) score += 8;
    return { text: sentence, narrationClaim, score, index };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map(({ text, narrationClaim }) => ({ text, narrationClaim }));
};

const decodeDuckDuckGoHref = (href: string): string | undefined => {
  const normalizedHref = href.replace(/&amp;/g, "&");
  try {
    const url = new URL(normalizedHref, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : url.toString();
  } catch {
    return undefined;
  }
};

const searchRelatedPages = async (queries: string[], maxPages: number): Promise<string[]> => {
  const urls: string[] = [];
  for (const query of queries.slice(0, 4)) {
    const html = await fetchText(`https://duckduckgo.com/html/?q=${encodeURIComponent(`${query} 官网 新闻 图片`)}`);
    if (!html) continue;
    const matches = html.matchAll(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["']/gi);
    for (const match of matches) {
      const url = decodeDuckDuckGoHref(match[1]);
      if (!url || /duckduckgo\.com|javascript:|mailto:/i.test(url)) continue;
      if (/mp\.weixin\.qq\.com/i.test(url)) continue;
      urls.push(url);
      if ([...new Set(urls)].length >= maxPages) return [...new Set(urls)];
    }
  }
  return [...new Set(urls)].slice(0, maxPages);
};

const captureWebScreenshot = async (
  chromePath: string,
  pageUrl: string,
  assetDir: string,
  index: number,
  sourceTitle: string,
): Promise<RuntimeAsset | undefined> => {
  const fileName = `${String(index).padStart(2, "0")}-${safeFilePart(domainFromUrl(pageUrl))}-screenshot.png`;
  const localPath = path.join(assetDir, fileName);
  try {
    await execFile(chromePath, [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      `--window-size=${screenshotViewport.width},${screenshotViewport.height}`,
      `--screenshot=${localPath}`,
      pageUrl,
    ], { timeout: 25000 });
    if (!(await fileExists(localPath))) return undefined;
    return {
      id: `asset-${String(index).padStart(3, "0")}`,
      type: "web-screenshot",
      role: "evidence",
      sourceUrl: pageUrl,
      sourceTitle,
      sourceDomain: domainFromUrl(pageUrl),
      localPath,
      fileName,
      mimeType: "image/png",
      attribution: `${domainFromUrl(pageUrl)} (${pageUrl})`,
      usageRisk: "unknown",
      capture: {
        method: "headless-chrome",
        viewport: screenshotViewport,
        capturedAt: new Date().toISOString(),
      },
      notes: "自动截取的真实网页证据图。发布前需要复核页面相关性、版权风险和画面可读性。",
    };
  } catch {
    return undefined;
  }
};

const extensionForMime = (mimeType: string): string => {
  if (/png/i.test(mimeType)) return "png";
  if (/webp/i.test(mimeType)) return "webp";
  if (/gif/i.test(mimeType)) return "gif";
  if (/svg/i.test(mimeType)) return "svg";
  return "jpg";
};

const downloadImageAsset = async (
  imageUrl: string,
  assetDir: string,
  index: number,
  sourceUrl: string,
  sourceTitle: string,
): Promise<RuntimeAsset | undefined> => {
  try {
    const response = await fetch(imageUrl, { headers: { "User-Agent": userAgent } });
    if (!response.ok) return undefined;
    const mimeType = response.headers.get("content-type") ?? "image/jpeg";
    if (!/^image\//i.test(mimeType)) return undefined;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1200) return undefined;
    const fileName = `${String(index).padStart(2, "0")}-${safeFilePart(domainFromUrl(sourceUrl))}.${extensionForMime(mimeType)}`;
    const localPath = path.join(assetDir, fileName);
    await writeFile(localPath, bytes);
    return {
      id: `asset-${String(index).padStart(3, "0")}`,
      type: "image",
      role: "evidence",
      sourceUrl,
      sourceTitle,
      sourceDomain: domainFromUrl(sourceUrl),
      localPath,
      fileName,
      mimeType,
      attribution: `${domainFromUrl(sourceUrl)} (${sourceUrl})`,
      usageRisk: "unknown",
      capture: {
        method: "open-graph",
        capturedAt: new Date().toISOString(),
      },
      notes: "自动联网提取的 OpenGraph / Twitter 图片，发布前建议复核版权和相关性。",
    };
  } catch {
    return undefined;
  }
};

const writeSourceCard = async (
  assetDir: string,
  index: number,
  sourceUrl: string,
  sourceTitle: string,
  query: string,
): Promise<RuntimeAsset> => {
  const domain = domainFromUrl(sourceUrl);
  const fileName = `${String(index).padStart(2, "0")}-${safeFilePart(domain)}-source-card.svg`;
  const localPath = path.join(assetDir, fileName);
  const title = escapeXml(sourceTitle.slice(0, 64));
  const safeQuery = escapeXml(query.slice(0, 40));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#0b1220"/>
  <rect x="82" y="78" width="1116" height="564" rx="36" fill="#f8fafc"/>
  <rect x="82" y="78" width="1116" height="86" rx="36" fill="#e2e8f0"/>
  <circle cx="130" cy="121" r="12" fill="#ef4444"/>
  <circle cx="170" cy="121" r="12" fill="#f59e0b"/>
  <circle cx="210" cy="121" r="12" fill="#22c55e"/>
  <text x="118" y="260" font-family="Arial, sans-serif" font-size="38" font-weight="800" fill="#0f172a">${title}</text>
  <text x="118" y="334" font-family="Arial, sans-serif" font-size="28" fill="#475569">关联素材来源：${escapeXml(domain)}</text>
  <text x="118" y="402" font-family="Arial, sans-serif" font-size="28" fill="#2563eb">搜索关键词：${safeQuery}</text>
  <rect x="118" y="470" width="820" height="54" rx="16" fill="#dbeafe"/>
  <text x="146" y="506" font-family="Arial, sans-serif" font-size="24" fill="#1e3a8a">${escapeXml(sourceUrl.slice(0, 82))}</text>
</svg>`;
  await writeFile(localPath, svg, "utf8");
  return {
    id: `asset-${String(index).padStart(3, "0")}`,
    type: "source-card",
    role: "context",
    sourceUrl,
    sourceTitle,
    sourceDomain: domain,
    localPath,
    fileName,
    mimeType: "image/svg+xml",
    attribution: `${domain} (${sourceUrl})`,
    usageRisk: "low",
    capture: {
      method: "generated-card",
      capturedAt: new Date().toISOString(),
    },
    notes: "自动生成的来源卡片，用于在缺少可下载图片时提供画面证据和上下文。",
  };
};

const writeEvidenceExcerptCard = async (
  assetDir: string,
  index: number,
  sourceUrl: string,
  sourceTitle: string,
  excerpt: string,
  narrationClaim?: string,
): Promise<RuntimeAsset> => {
  const domain = domainFromUrl(sourceUrl);
  const fileName = `${String(index).padStart(2, "0")}-${safeFilePart(domain)}-evidence-card.svg`;
  const localPath = path.join(assetDir, fileName);
  const title = escapeXml(sourceTitle.slice(0, 42));
  const lines = excerpt
    .slice(0, 96)
    .replace(/\s+/g, "")
    .match(/.{1,24}/g) ?? [excerpt.slice(0, 24)];
  const claim = narrationClaim ? `对应口播：${narrationClaim.slice(0, 34)}` : "对应口播：原文关键证据";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#07111f"/>
  <rect x="84" y="74" width="1112" height="572" rx="34" fill="#f8fafc"/>
  <text x="126" y="144" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#0f766e">SOURCE EVIDENCE</text>
  <text x="126" y="198" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#0f172a">${title}</text>
  ${lines.map((line, lineIndex) => `<text x="126" y="${292 + lineIndex * 48}" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#111827">${escapeXml(line)}</text>`).join("\n  ")}
  <rect x="126" y="500" width="850" height="58" rx="18" fill="#ccfbf1"/>
  <text x="154" y="538" font-family="Arial, sans-serif" font-size="24" fill="#115e59">${escapeXml(claim)}</text>
  <text x="126" y="604" font-family="Arial, sans-serif" font-size="22" fill="#64748b">${escapeXml(domain)} · 原文证据卡</text>
</svg>`;
  await writeFile(localPath, svg, "utf8");
  return {
    id: `asset-${String(index).padStart(3, "0")}`,
    type: "evidence-card",
    role: "evidence",
    sourceUrl,
    sourceTitle,
    sourceDomain: domain,
    localPath,
    fileName,
    mimeType: "image/svg+xml",
    attribution: `${domain} (${sourceUrl})`,
    usageRisk: "low",
    capture: {
      method: "source-excerpt",
      capturedAt: new Date().toISOString(),
    },
    notes: "从原文关键段落生成的证据卡，不使用公众号配图；用于让画面有可复核的信息锚点。",
  };
};

const captureSourceEvidence = async (input: {
  title: string;
  article: string;
  sourceUrl?: string;
  videoBrief: RuntimeVideoBrief;
  scenes: Scene[];
  assetDir: string;
  startIndex: number;
  dryRun: boolean;
}): Promise<{ assets: RuntimeAsset[]; records: RuntimeEvidenceRecord[]; nextIndex: number; warnings: string[] }> => {
  const warnings: string[] = [];
  const assets: RuntimeAsset[] = [];
  const records: RuntimeEvidenceRecord[] = [];
  const sourceUrl = input.sourceUrl ?? `shin-video://article/${encodeURIComponent(input.title)}`;
  const sourceTitle = input.title;
  let index = input.startIndex;

  const textPath = path.join(input.assetDir, "source-article-text.txt");
  await writeFile(textPath, `${input.article}\n`, "utf8");
  records.push({
    id: "evidence-source-text",
    kind: "source-text",
    sourceUrl,
    sourceTitle,
    sourceDomain: domainFromUrl(sourceUrl),
    localPath: textPath,
    text: input.article.slice(0, 1200),
    coordinateSpace: "source_document",
    verificationMethod: "html-fetch",
    capturedAt: new Date().toISOString(),
    notes: "清洗后的文章正文快照，用于后续口播、字幕和画面证据追溯。",
  });

  if (input.sourceUrl && !input.dryRun) {
    const html = await fetchText(input.sourceUrl);
    if (html) {
      const htmlPath = path.join(input.assetDir, "source-article.html");
      await writeFile(htmlPath, html, "utf8");
      records.push({
        id: "evidence-source-html",
        kind: "source-html",
        sourceUrl: input.sourceUrl,
        sourceTitle,
        sourceDomain: domainFromUrl(input.sourceUrl),
        localPath: htmlPath,
        coordinateSpace: "source_document",
        verificationMethod: "html-fetch",
        capturedAt: new Date().toISOString(),
        notes: "原始 HTML 快照。若运行环境提供 Chrome 集成，应优先用真实浏览器页面补充坐标级截图。",
      });
    } else {
      warnings.push("源文章 HTML 快照抓取失败，已保留清洗正文快照。");
    }
  }

  const excerpts = selectSourceEvidenceExcerpts(input.article, input.scenes, input.videoBrief, 2);
  for (const excerpt of excerpts) {
    const asset = await writeEvidenceExcerptCard(input.assetDir, index, sourceUrl, sourceTitle, excerpt.text, excerpt.narrationClaim);
    assets.push(asset);
    records.push({
      id: `evidence-excerpt-${String(index).padStart(3, "0")}`,
      kind: "source-excerpt",
      sourceUrl,
      sourceTitle,
      sourceDomain: domainFromUrl(sourceUrl),
      localPath: asset.localPath,
      text: excerpt.text,
      targetText: excerpt.text,
      narrationClaim: excerpt.narrationClaim,
      coordinateSpace: "source_document",
      verificationMethod: "generated-card",
      capturedAt: new Date().toISOString(),
      notes: "从原文关键段落生成，给导演和 Remotion 作为可复核证据卡使用。",
    });
    index += 1;
  }

  if (input.sourceUrl && /mp\.weixin\.qq\.com/i.test(input.sourceUrl)) {
    warnings.push("源链接是公众号文章：默认不使用公众号内配图，只保留正文证据快照，并通过外部搜索补充素材。");
  }

  return { assets, records, nextIndex: index, warnings };
};

export const bindAssetsToScenes = (scenes: Scene[], manifest: RuntimeAssetManifest): Scene[] => {
  const assetById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const bindingBySceneId = new Map(manifest.sceneBindings.map((binding) => [binding.sceneId, binding]));
  return scenes.map((scene) => {
    const binding = bindingBySceneId.get(scene.id);
    const boundAssets = binding?.assetIds.map((id) => assetById.get(id)).filter(Boolean) as RuntimeAsset[] | undefined;
    const assetFileNames = boundAssets?.map((asset) => asset.fileName);
    if (!assetFileNames?.length) return scene;
    const evidenceAsset = boundAssets?.find((asset) => asset.role === "evidence")?.fileName;
    return {
      ...scene,
      images: [...new Set([...assetFileNames, ...scene.images])],
      primaryVisualAsset: assetFileNames[0],
      evidenceAsset,
      primaryAsset: assetFileNames[0],
      visualModules: [...new Set<VisualModule>([...(scene.visualModules ?? []), "assets"])],
    };
  });
};

export const researchAssets = async ({
  title,
  article,
  sourceUrl,
  videoBrief,
  visualManifest,
  scenes,
  assetManifestPath,
  generatedImageManifestPath,
  dryRun = false,
  maxAssets = 6,
}: ResearchAssetsInput): Promise<RuntimeAssetManifest> => {
  const generatedImages = generatedImageManifestPath
    ? (await readGeneratedImageManifest(generatedImageManifestPath, scenes)).images
    : [];
  const assetDir = path.join(path.dirname(assetManifestPath), "assets");
  await mkdir(assetDir, { recursive: true });
  const queryTerms = extractAssetQueries(title, article, videoBrief);
  const warnings: string[] = [];
  const assets: RuntimeAsset[] = [];
  const evidenceRecords: RuntimeEvidenceRecord[] = [];

  if (dryRun) {
    warnings.push("dry-run 未联网搜索素材，只生成来源卡片以验证 asset-manifest 结构。");
  }

  const searchPages = dryRun ? [] : await searchRelatedPages(queryTerms, Math.max(maxAssets * 2, 8));
  const pageUrls = [
    ...searchPages,
    ...(sourceUrl && !/mp\.weixin\.qq\.com/i.test(sourceUrl) ? [sourceUrl] : []),
  ].filter(Boolean) as string[];
  const chromePath = dryRun ? undefined : await findChrome();
  if (!dryRun && !chromePath) {
    warnings.push("未找到 Chrome/Chromium，无法截取真实网页截图；将降级为 OpenGraph 图片和来源卡片。");
  }

  let index = 1;
  const sourceEvidence = await captureSourceEvidence({
    title,
    article,
    sourceUrl,
    videoBrief,
    scenes,
    assetDir,
    startIndex: index,
    dryRun,
  });
  assets.push(...sourceEvidence.assets);
  evidenceRecords.push(...sourceEvidence.records);
  warnings.push(...sourceEvidence.warnings);
  index = sourceEvidence.nextIndex;

  const sourcePages: RuntimeAssetManifest["sourcePages"] = [];
  if (sourceEvidence.records.length > 0) {
    const fallbackUrl = sourceUrl ?? `shin-video://article/${encodeURIComponent(title)}`;
    sourcePages.push({
      url: fallbackUrl,
      title,
      domain: domainFromUrl(fallbackUrl),
      captured: sourceEvidence.records.some((record) => record.kind === "source-html" || Boolean(record.localPath)),
    });
  }
  for (const pageUrl of [...new Set(pageUrls)]) {
    if (assets.length >= maxAssets) break;
    const html = await fetchText(pageUrl);
    if (!html) continue;
    const meta = extractPageMeta(html, pageUrl);
    let captured = false;
    if (chromePath) {
      const screenshotAsset = await captureWebScreenshot(chromePath, pageUrl, assetDir, index, meta.title);
      if (screenshotAsset) {
        assets.push(screenshotAsset);
        sourcePages.push({
          url: pageUrl,
          title: meta.title,
          domain: domainFromUrl(pageUrl),
          captured: true,
        });
        evidenceRecords.push({
          id: `evidence-screenshot-${String(index).padStart(3, "0")}`,
          kind: "external-screenshot",
          sourceUrl: pageUrl,
          sourceTitle: meta.title,
          sourceDomain: domainFromUrl(pageUrl),
          localPath: screenshotAsset.localPath,
          coordinateSpace: "normalized_frame",
          verificationMethod: "headless-chrome",
          capturedAt: screenshotAsset.capture?.capturedAt ?? new Date().toISOString(),
          notes: "外部网页截图证据，需在成片抽帧阶段检查可读性和相关性。",
        });
        captured = true;
        index += 1;
        if (assets.length >= maxAssets) break;
      }
    }
    const imageAsset = meta.imageUrl
      ? await downloadImageAsset(meta.imageUrl, assetDir, index, pageUrl, meta.title)
      : undefined;
    if (imageAsset) {
      assets.push(imageAsset);
      if (!captured) {
        sourcePages.push({
          url: pageUrl,
          title: meta.title,
          domain: domainFromUrl(pageUrl),
          captured: false,
        });
      }
      evidenceRecords.push({
        id: `evidence-image-${String(index).padStart(3, "0")}`,
        kind: "external-image",
        sourceUrl: pageUrl,
        sourceTitle: meta.title,
        sourceDomain: domainFromUrl(pageUrl),
        localPath: imageAsset.localPath,
        coordinateSpace: "normalized_frame",
        verificationMethod: "search-result",
        capturedAt: imageAsset.capture?.capturedAt ?? new Date().toISOString(),
        notes: "外部网页 OpenGraph 图片，发布前需复核版权和相关性。",
      });
      index += 1;
      continue;
    }
    if (!captured) {
      assets.push(await writeSourceCard(assetDir, index, pageUrl, meta.title, queryTerms[0] ?? title));
      sourcePages.push({
        url: pageUrl,
        title: meta.title,
        domain: domainFromUrl(pageUrl),
        captured: false,
      });
      evidenceRecords.push({
        id: `evidence-page-${String(index).padStart(3, "0")}`,
        kind: "external-page",
        sourceUrl: pageUrl,
        sourceTitle: meta.title,
        sourceDomain: domainFromUrl(pageUrl),
        localPath: assets.at(-1)?.localPath,
        coordinateSpace: "normalized_frame",
        verificationMethod: "generated-card",
        capturedAt: new Date().toISOString(),
        notes: "外部来源卡片，表示搜索到相关页面但没有可用截图或图片。",
      });
    }
    index += 1;
  }

  if (assets.length === 0) {
    const fallbackUrl = sourceUrl ?? `shin-video://article/${encodeURIComponent(title)}`;
    assets.push(await writeSourceCard(assetDir, index, fallbackUrl, title, queryTerms[0] ?? title));
    sourcePages.push({
      url: fallbackUrl,
      title,
      domain: domainFromUrl(fallbackUrl),
      captured: false,
    });
    warnings.push("未找到可下载的网页图片，已生成本地来源卡片作为画面补充。");
  }

  const reusableAssets = assets
    .sort((a, b) => {
      const rank = (asset: RuntimeAsset) => asset.type === "web-screenshot" ? 0 : asset.type === "image" ? 1 : 2;
      return rank(a) - rank(b);
    })
    .slice(0, maxAssets);
  const sceneBindings: RuntimeAssetSceneBinding[] = scenes.map((scene, sceneIndex) => {
    const asset = reusableAssets[sceneIndex % reusableAssets.length];
    const manifestScene = visualManifest.scenes.find((item) => item.sceneId === scene.id);
    return {
      sceneId: scene.id,
      assetIds: [asset.id],
      reason: manifestScene?.visualGoal ?? `为 ${scene.id} 绑定与主题相关的补充素材。`,
      narrationClaim: manifestScene?.narrationClaim ?? scene.subtitle,
      targetRegion: manifestScene?.targetRegion ?? {
        coordinateSpace: "normalized_frame" as const,
        description: "主证据视觉区域，避开底部字幕。",
      },
      layoutZones: {
        reserved: ["header", "evidence", "insight", "subtitle", "callout"],
        overlapChecked: false,
      },
    };
  });

  let manifest: RuntimeAssetManifest = {
    assetManifestVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceMode: dryRun ? "dry-run" : evidenceRecords.some((record) => record.kind.startsWith("source-")) ? "browser-evidence" : "web-research",
    queryTerms,
    evidenceRecords,
    sourcePages,
    assets: reusableAssets,
    sceneBindings,
    warnings,
  };
  if (generatedImages.length > 0) {
    manifest = mergeGeneratedImages(manifest, generatedImages);
  }
  await writeFile(assetManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
};
