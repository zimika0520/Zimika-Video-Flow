export const directorPlan = {
  "directorPlanVersion": 3,
  "styleSystem": {
    "preset": "TechReport",
    "rationale": "多层信息卡设计：浅蓝白网格底+主题词条滚动+主事件卡+品牌产品卡+趋势曲线+分析信号。信息密度对标Bloomberg/FT数据新闻，风格简洁科技不花哨。",
    "palette": {
      "bg": "#e8f0f8",
      "bgGrid": "#d0dce8",
      "cardBg": "#ffffff",
      "cardDark": "#152238",
      "text": "#1a2332",
      "textMuted": "#5b6e8c",
      "accent": "#2563eb",
      "accent2": "#06b6d4",
      "red": "#dc2626",
      "green": "#10b981",
      "amber": "#f59e0b",
      "wave": "#0ea5e9",
      "tickerBg": "#1e293b"
    },
    "typography": {
      "heroSize": 44,
      "titleSize": 32,
      "metricSize": 56,
      "bodySize": 18,
      "labelSize": 14,
      "captionSize": 28
    },
    "motion": {
      "transitionDuration": 15,
      "staggerDelay": 4,
      "tickerSpeed": 0.8,
      "waveSpeed": 0.03,
      "entranceEasing": [
        0.16,
        1,
        0.3,
        1
      ],
      "emphasisEasing": [
        0.34,
        1.56,
        0.64,
        1
      ]
    },
    "layout": {
      "marginX": 50,
      "captionY": 48,
      "tickerY": 30
    }
  },
  "scenes": [
    {
      "id": "scene-0001",
      "start": 0,
      "end": 3,
      "duration": 3,
      "directorType": "Hero",
      "captionText": "今日AI快讯，7月7日。",
      "layout": {
        "type": "hero-tech-brand",
        "title": "AI日报",
        "subtitle": "2026.7.7",
        "dateLabel": ""
      }
    },
    {
      "id": "scene-0002",
      "start": 3,
      "end": 16,
      "duration": 13,
      "captionText": "",
      "directorType": "TechReport",
      "layout": {
        "type": "tech-report",
        "title": "三星利润超越英伟达？",
        "subtitle": "AI硬件红利从GPU扩散到存储芯片",
        "brand": "SAMSUNG",
        "brandColor": "#2563eb",
        "signals": [
          "Q2营业利润89.4万亿韩元",
          "AI产业链利润重新分配",
          "HBM/DRAM存储景气红利"
        ],
        "keywords": [
          "DRAM价格反弹",
          "AI数据中心Capex",
          "存储周期",
          "GPU供应链",
          "HBM需求↑"
        ],
        "trend": "存储价格周期反弹",
        "productLabel": "Memory Stack",
        "productTags": [
          "HBM",
          "DRAM",
          "AI Data Center"
        ]
      }
    },
    {
      "id": "scene-0003",
      "start": 16,
      "end": 28.5,
      "duration": 12.5,
      "captionText": "",
      "directorType": "TechReport",
      "layout": {
        "type": "tech-report",
        "title": "Codex × GPT-5.6 Sol Ultra",
        "subtitle": "代码智能体深度绑定最强模型",
        "brand": "OpenAI",
        "brandColor": "#000",
        "signals": [
          "旗舰模型GPT-5.6接入",
          "复杂工程任务自动化",
          "代码生成能力大幅提升"
        ],
        "keywords": [
          "Sol Ultra",
          "Agentic Coding",
          "Model Upgrade",
          "Automation",
          "OpenAI"
        ],
        "trend": "代码能力持续攀升",
        "productLabel": "Codex Pipeline",
        "productTags": [
          "Code Gen",
          "Debug",
          "Refactor",
          "Test"
        ]
      }
    },
    {
      "id": "scene-0004",
      "start": 28.5,
      "end": 38.5,
      "duration": 10.0,
      "captionText": "",
      "directorType": "TechReport",
      "layout": {
        "type": "tech-report",
        "title": "AI替代→增效",
        "subtitle": "科技巨头CEO集体转向乐观",
        "brand": "BIG TECH",
        "brandColor": "#1a2332",
        "signals": [
          "替代岗位叙事降温",
          "AI=生产力工具",
          "企业落地更务实"
        ],
        "keywords": [
          "Google",
          "Microsoft",
          "Meta",
          "Amazon",
          "就业叙事"
        ],
        "trend": "CEO表态从替代转向增效",
        "productLabel": "Narrative Shift",
        "productTags": [
          "替代→增效",
          "生产力",
          "务实"
        ]
      }
    },
    {
      "id": "scene-0005",
      "start": 38.5,
      "end": 47,
      "duration": 8.5,
      "captionText": "",
      "directorType": "TechReport",
      "layout": {
        "type": "tech-report",
        "title": "AI伴侣监管红线",
        "subtitle": "字节阿里下线功能避新规",
        "brand": "REGULATORY",
        "brandColor": "#dc2626",
        "signals": [
          "7月中旬新规生效",
          "情感依赖与拟人化风险",
          "自定义功能收缩"
        ],
        "keywords": [
          "ByteDance",
          "Alibaba",
          "合规",
          "情感依赖",
          "拟人化"
        ],
        "trend": "监管收紧趋势",
        "productLabel": "Policy Impact",
        "productTags": [
          "下线",
          "避雷",
          "拟人化禁令"
        ]
      }
    },
    {
      "id": "scene-0006",
      "start": 47,
      "end": 60,
      "duration": 13,
      "captionText": "",
      "directorType": "TechReport",
      "layout": {
        "type": "tech-report",
        "title": "GLM-5.2登顶争议",
        "subtitle": "基准作者回应：没有蒸馏",
        "brand": "GLM-5.2",
        "brandColor": "#f0a500",
        "signals": [
          "PostTrainBench #1",
          "遭遇刷榜质疑",
          "官方轨迹核查通过"
        ],
        "keywords": [
          "蒸馏争议",
          "基准澄清",
          "Open Source",
          "透明度"
        ],
        "trend": "基准排名走势",
        "productLabel": "Benchmark",
        "productTags": [
          "#1 Rank",
          "澄清",
          "轨迹核查"
        ]
      }
    },
    {
      "id": "scene-0007",
      "start": 60,
      "end": 74,
      "duration": 14,
      "captionText": "",
      "directorType": "TechReport",
      "layout": {
        "type": "tech-report",
        "title": "Token消耗双榜",
        "subtitle": "DeepSeek V4 Flash领跑，Hermes第一",
        "brand": "LEADERBOARD",
        "brandColor": "#2563eb",
        "signals": [
          "DeepSeek 5.36T ↑14%",
          "Hermes Agent 842B",
          "MiMo/MiniMax紧随"
        ],
        "keywords": [
          "DeepSeek",
          "Hermes",
          "Claude Code",
          "Token",
          "Ranking"
        ],
        "trend": "双榜排名动态",
        "productLabel": "Rankings",
        "productTags": [
          "消耗榜",
          "应用榜",
          "5.36T",
          "842B"
        ]
      }
    },
    {
      "id": "scene-0008",
      "start": 74,
      "end": 84.9,
      "duration": 10.9,
      "directorType": "Summary",
      "captionText": "AI新风向，尽在Think AI。",
      "layout": {
        "type": "closing-brand",
        "message": "Think AI",
        "tagline": "AI新风向，尽在 Think AI"
      }
    }
  ]
};
