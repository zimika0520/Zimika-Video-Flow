import { existsSync, readFileSync } from "node:fs";

const files = {
  director: [
    "plugins/shin-video/skills/shin-video/SKILL.md",
  ],
  style: [
    "plugins/shin-video/references/工作流模块/视觉风格确认.md",
  ],
  preset: [
    "plugins/shin-video/references/工作流模块/动画与风格系统.md",
  ],
  scene: [
    "plugins/shin-video/references/工作流模块/场景与节奏.md",
  ],
  renderer: [
    "plugins/shin-video/references/工作流模块/Remotion渲染.md",
  ],
};

const checks = [
  {
    group: "director",
    pattern: /必须暂停并询问用户视觉风格/,
    message: "总导演必须把渲染前风格询问写成硬性暂停步骤",
  },
  {
    group: "director",
    pattern: /没有 RUN_DIR\/style-profile\.json，不允许渲染/,
    message: "总导演必须禁止缺少 style-profile 时直接渲染",
  },
  {
    group: "director",
    pattern: /sceneType[\s\S]*motionVariant[\s\S]*visualModules/,
    message: "总导演必须要求 scenes.json 写入分段视觉字段",
  },
  {
    group: "style",
    pattern: /不要直接进入渲染/,
    message: "视觉风格选择必须阻断直接渲染",
  },
  {
    group: "style",
    pattern: /不设置默认风格/,
    message: "视觉风格选择必须禁止隐藏默认风格",
  },
  {
    group: "preset",
    pattern: /Remotion Designing visuals/,
    message: "动画预设必须引用 Remotion Designing visuals",
  },
  {
    group: "preset",
    pattern: /assets[\s\S]*layers[\s\S]*transitions[\s\S]*effects[\s\S]*fonts/,
    message: "动画预设必须覆盖 Designing visuals 的 assets/layers/transitions/effects/fonts",
  },
  {
    group: "preset",
    pattern: /measuring items[\s\S]*randomness[\s\S]*maps[\s\S]*animation math/,
    message: "动画预设必须覆盖 Designing visuals 的测量、随机、地图和动画数学能力",
  },
  {
    group: "preset",
    pattern: /posterization[\s\S]*html-in-canvas[\s\S]*noise visualization[\s\S]*shaders[\s\S]*light leaks[\s\S]*starburst/,
    message: "动画预设必须覆盖 Designing visuals 的扩展视觉能力",
  },
  {
    group: "preset",
    pattern: /opacity[\s\S]*scale[\s\S]*translate[\s\S]*rotate[\s\S]*skew/,
    message: "动画预设必须覆盖 transforms 基础能力",
  },
  {
    group: "preset",
    pattern: /makeTransform\(\)/,
    message: "动画预设必须要求 makeTransform 组合 transform",
  },
  {
    group: "preset",
    pattern: /interpolateColors\(\)/,
    message: "动画预设必须覆盖颜色动画",
  },
  {
    group: "preset",
    pattern: /styleProfileVersion/,
    message: "动画预设必须输出结构化 style-profile schema",
  },
  {
    group: "preset",
    pattern: /recipeSystem[\s\S]*motionModules[\s\S]*transitionModules[\s\S]*effectModules/,
    message: "动画预设必须输出 recipeSystem 和模块库",
  },
  {
    group: "preset",
    pattern: /不允许把 0-60 秒全部套同一个画面模板/,
    message: "动画预设必须禁止整条视频套同一个模板",
  },
  {
    group: "scene",
    pattern: /sceneType[\s\S]*layoutRecipe[\s\S]*motionVariant[\s\S]*transition[\s\S]*visualModules[\s\S]*pace/,
    message: "视频场景生成必须输出新视觉编排字段",
  },
  {
    group: "scene",
    pattern: /输出的 `RUN_DIR\/scenes\.json` 要给 Remotion 模板直接读取/,
    message: "视频场景生成必须禁止 Remotion 靠正则猜画面",
  },
  {
    group: "renderer",
    pattern: /渲染前检查/,
    message: "Remotion 渲染必须有渲染前检查",
  },
  {
    group: "renderer",
    pattern: /缺少 RUN_DIR\/style-profile\.json/,
    message: "Remotion 渲染必须拒绝缺少 style-profile 的输入",
  },
  {
    group: "renderer",
    pattern: /scene\.sceneType -> 对应场景组件/,
    message: "Remotion 渲染必须按 sceneType 分发组件",
  },
  {
    group: "renderer",
    pattern: /motionVariant -> 对应入场、镜头、卡片、关键词动画/,
    message: "Remotion 渲染必须读取 motionVariant",
  },
  {
    group: "renderer",
    pattern: /visualModules -> 启用 transforms/,
    message: "Remotion 渲染必须读取 visualModules",
  },
];

let failures = 0;

for (const check of checks) {
  for (const file of files[check.group]) {
    if (!existsSync(file)) {
      failures += 1;
      console.error(`FAIL ${file}: official plugin skill is missing`);
      continue;
    }
    const text = readFileSync(file, "utf8");
    if (!check.pattern.test(text)) {
      failures += 1;
      console.error(`FAIL ${file}: ${check.message}`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} skill visual gate checks failed.`);
  process.exit(1);
}

console.log("All skill visual gate checks passed.");
