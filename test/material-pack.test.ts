import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { validateMaterialPack } from "@/lib/material-pack";

const createPack = async () => {
  const root = mkdtempSync(join(tmpdir(), "shin-pack-"));
  await mkdir(join(root, "images"));
  await writeFile(join(root, "article.cleaned.md"), "正文 [[图片 3｜位置：这里]]");
  await writeFile(join(root, "image-list.md"), "# 图片清单\n\n## 1.jpg\n位置：开场");
  await writeFile(join(root, "voiceover.md"), "开场\n\n【画面：2.jpg，展示下载入口】\n继续");
  await writeFile(join(root, "video-prompt.md"), "视频比例：16:9 横屏");
  await writeFile(join(root, "images", "1.jpg"), "fake");
  await writeFile(join(root, "images", "2.jpg"), "fake");
  return root;
};

describe("validateMaterialPack", () => {
  test("accepts Chinese single-video project folders with voiceover audio", async () => {
    const root = mkdtempSync(join(tmpdir(), "shin-clean-pack-"));
    await writeFile(join(root, "文章.md"), "正文");
    await writeFile(join(root, "口播文案.md"), "口播\n\n【画面：1.jpg】");
    await writeFile(join(root, "图文位置.md"), "正文\n\n<!-- image_1: 1.jpg -->");
    await writeFile(join(root, "图片清单.json"), "[]");
    await mkdir(join(root, "images"));
    await writeFile(join(root, "images", "1.jpg"), "fake");
    await writeFile(join(root, "口播音频.mp3"), "fake-audio");

    const result = await validateMaterialPack(root);

    expect(result.ok).toBe(true);
    expect(result.audioPath).toBe(join(root, "口播音频.mp3"));
    expect(result.referencedImages).toEqual(["1.jpg"]);
  });

  test("reports missing required markdown file", async () => {
    const root = await createPack();
    await writeFile(join(root, "voiceover.md"), "");
    await import("node:fs/promises").then(({ rm }) => rm(join(root, "voiceover.md")));

    const result = await validateMaterialPack(root);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("素材包缺少 voiceover.md");
  });

  test("reports missing images folder", async () => {
    const root = await createPack();
    await import("node:fs/promises").then(({ rm }) => rm(join(root, "images"), { recursive: true }));

    const result = await validateMaterialPack(root);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("素材包缺少 images/");
  });

  test("reports missing referenced image", async () => {
    const root = await createPack();

    const result = await validateMaterialPack(root);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("素材包缺少 images/3.jpg");
    expect(result.referencedImages).toEqual(["1.jpg", "2.jpg", "3.jpg"]);
  });
});
