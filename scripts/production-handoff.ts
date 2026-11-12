import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { inspectProductionHandoff } from "@/lib/production-handoff";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=")];
  }),
);

const requiredArg = (key: string): string => {
  const value = args.get(key);
  if (!value) {
    throw new Error(`缺少参数 --${key}=...`);
  }
  return value;
};

const main = async () => {
  const runDir = path.resolve(requiredArg("run-dir"));
  const reportPath =
    args.get("report") ??
    path.join(runDir, "production-handoff-brief.json");
  const brief = await inspectProductionHandoff({
    runDir,
    audioPath: args.get("audio"),
    voiceoverPath: args.get("voiceover"),
  });
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    `${JSON.stringify(brief, null, 2)}\n`,
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: brief.readiness.canRender,
        reportPath,
        recommendedAction: brief.recommendedAction,
        counts: brief.counts,
      },
      null,
      2,
    ),
  );
  if (!brief.readiness.canRender) process.exit(1);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
