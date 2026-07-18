import type { StormScene } from "./StormVideo";

export const stormScenes: StormScene[] = [
  {
    "id": "scene-0001",
    "start": 0.0,
    "end": 3.0,
    "subtitle": "你见过一天下一整年雨的地方吗？",
    "layout": "quote",
    "emphasis": [
      "一天下一整年雨"
    ],
    "sceneType": "impact-hook",
    "visualIntent": "provoke-curiosity",
    "layoutRecipe": "centered-question",
    "motionVariant": "slow-reveal",
    "transition": "fade-in",
    "visualModules": [
      "fonts",
      "effects",
      "transforms"
    ],
    "pace": "slow",
    "directorType": "QuestionHook",
    "importance": 9,
    "role": "hook",
    "shotStyle": "SlowReveal",
    "animation": {
      "entrance": "typewriterReveal",
      "emphasis": "subtlePulse",
      "transition": "dissolve",
      "camera": "static"
    },
    "background": {
      "type": "DarkRain",
      "motion": "ambient",
      "noise": false
    },
    "components": [
      "TitleCard"
    ],
    "content": {
      "mainMessage": "一天，一整年",
      "keywords": [
        "暴雨",
        "一整年"
      ],
      "visualMetaphor": "雨滴密集坠落背景，白色大字浮现"
    }
  },
  {
    "id": "scene-0002",
    "start": 3.0,
    "end": 9.5,
    "subtitle": "广西南宁，7月5号到6号，24小时，637毫米。",
    "layout": "data",
    "emphasis": [
      "637毫米",
      "24小时"
    ],
    "sceneType": "data-breakdown",
    "visualIntent": "shock-with-number",
    "layoutRecipe": "stacked-data-cards",
    "motionVariant": "scale-burst",
    "transition": "wipe",
    "visualModules": [
      "measuring",
      "transforms",
      "animation-math",
      "color-interpolation"
    ],
    "pace": "medium",
    "directorType": "DataExplosion",
    "importance": 10,
    "role": "spike",
    "shotStyle": "Burst",
    "animation": {
      "entrance": "scaleIn",
      "emphasis": "kineticCounter",
      "transition": "pushLeft",
      "camera": "dollyIn"
    },
    "background": {
      "type": "DataField",
      "motion": "reactive",
      "noise": false
    },
    "components": [
      "MetricCard",
      "TimelineBar"
    ],
    "content": {
      "mainMessage": "637mm",
      "keywords": [
        "637毫米",
        "24小时",
        "南宁"
      ],
      "visualMetaphor": "数字从0飞速跳到637，配合进度条一天跑完"
    }
  },
  {
    "id": "scene-0003",
    "start": 9.5,
    "end": 14.5,
    "subtitle": "什么概念？北京一年的降雨量，也就600出头。人家一天给你下完了。",
    "layout": "comparison",
    "emphasis": [
      "600出头",
      "一天下完"
    ],
    "sceneType": "concept-steps",
    "visualIntent": "compare-scale",
    "layoutRecipe": "split-compare",
    "motionVariant": "parallel-slide",
    "transition": "morph",
    "visualModules": [
      "transforms",
      "measuring",
      "svg-path",
      "color-interpolation"
    ],
    "pace": "medium",
    "directorType": "ScaleContrast",
    "importance": 8,
    "role": "bridge",
    "shotStyle": "SplitScreen",
    "animation": {
      "entrance": "splitReveal",
      "emphasis": "barFill",
      "transition": "morphDissolve",
      "camera": "panAcross"
    },
    "background": {
      "type": "SplitField",
      "motion": "static-compare",
      "noise": false
    },
    "components": [
      "ComparisonBar",
      "LabelTag"
    ],
    "content": {
      "mainMessage": "南宁1天 = 北京1年",
      "keywords": [
        "637mm vs 600mm",
        "一天 vs 一年"
      ],
      "visualMetaphor": "左侧进度条1天跑满，右侧进度条365天慢慢爬"
    }
  },
  {
    "id": "scene-0004",
    "start": 14.5,
    "end": 23.0,
    "subtitle": "台风美莎克，今年第一个登陆中国的台风。7月3号在海南上岸，两天后在越南二次登陆。没减弱，变本加厉。",
    "layout": "timeline",
    "emphasis": [
      "第一个登陆",
      "海南越南",
      "变本加厉"
    ],
    "sceneType": "news-context",
    "visualIntent": "track-path",
    "layoutRecipe": "map-path-trace",
    "motionVariant": "path-trace",
    "transition": "zoom-out",
    "visualModules": [
      "svg-path",
      "transforms",
      "effects",
      "animation-math"
    ],
    "pace": "fast",
    "directorType": "PathTracker",
    "importance": 7,
    "role": "context",
    "shotStyle": "MapTrace",
    "animation": {
      "entrance": "fadeIn",
      "emphasis": "pathDraw",
      "transition": "swipeLeft",
      "camera": "overheadTrack"
    },
    "background": {
      "type": "MapField",
      "motion": "tracking",
      "noise": false
    },
    "components": [
      "MapTrace",
      "EventMarker",
      "LabelTag"
    ],
    "content": {
      "mainMessage": "海南 - 越南 - 更强",
      "keywords": [
        "美莎克",
        "7月3日海南",
        "7月5日越南"
      ],
      "visualMetaphor": "台风眼从海南沿路径移动到越南，强度圈不减反增"
    }
  },
  {
    "id": "scene-0005",
    "start": 23.0,
    "end": 29.0,
    "subtitle": "宾阳县更离谱，同一个24小时，713毫米。",
    "layout": "data",
    "emphasis": [
      "713毫米"
    ],
    "sceneType": "data-breakdown",
    "visualIntent": "double-shock",
    "layoutRecipe": "number-explode",
    "motionVariant": "impact-shatter",
    "transition": "crash-cut",
    "visualModules": [
      "transforms",
      "measuring",
      "effects",
      "animation-math"
    ],
    "pace": "fast",
    "directorType": "DataExplosion",
    "importance": 10,
    "role": "spike",
    "shotStyle": "Shatter",
    "animation": {
      "entrance": "crashZoom",
      "emphasis": "numberPulse",
      "transition": "glitchCut",
      "camera": "crashZoom"
    },
    "background": {
      "type": "DataField",
      "motion": "chaotic",
      "noise": false
    },
    "components": [
      "MetricCard",
      "ShockLabel"
    ],
    "content": {
      "mainMessage": "713",
      "keywords": [
        "713毫米",
        "宾阳",
        "更离谱"
      ],
      "visualMetaphor": "637到713数字跳变，屏幕震感"
    }
  },
  {
    "id": "scene-0006",
    "start": 29.0,
    "end": 38.0,
    "subtitle": "三座水库直接扛不住，漫顶的漫顶，溃坝的溃坝。社交平台上的视频里，有人对着洪水冲垮的堤坝喊：坝塌了！坝塌了！",
    "layout": "evidence",
    "emphasis": [
      "三座水库",
      "溃坝",
      "坝塌了"
    ],
    "sceneType": "evidence-zoom",
    "visualIntent": "show-catastrophe",
    "layoutRecipe": "headline-stack",
    "motionVariant": "shake-collapse",
    "transition": "shake-cut",
    "visualModules": [
      "effects",
      "transforms",
      "layers"
    ],
    "pace": "urgent",
    "directorType": "CrisisMontage",
    "importance": 9,
    "role": "climax",
    "shotStyle": "ShakyCam",
    "animation": {
      "entrance": "slamIn",
      "emphasis": "screenShake",
      "transition": "redFlash",
      "camera": "handheldShake"
    },
    "background": {
      "type": "CrisisField",
      "motion": "violent",
      "noise": false
    },
    "components": [
      "AlertBanner",
      "QuoteBubble",
      "KeywordCluster"
    ],
    "content": {
      "mainMessage": "坝塌了！",
      "keywords": [
        "溃坝",
        "三座水库",
        "坝塌了"
      ],
      "visualMetaphor": "红色警报条加引号气泡闪现"
    }
  },
  {
    "id": "scene-0007",
    "start": 38.0,
    "end": 46.0,
    "subtitle": "南宁市55000人受灾，48000人连夜转移。防汛响应拉到最高级别。截至今天，台风美莎克已经在华南和华中带走至少15条人命。",
    "layout": "stats",
    "emphasis": [
      "55000人",
      "48000人转移",
      "15条人命"
    ],
    "sceneType": "risk-contrast",
    "visualIntent": "show-toll",
    "layoutRecipe": "stat-grid",
    "motionVariant": "counter-rise",
    "transition": "fade-through-black",
    "visualModules": [
      "measuring",
      "transforms",
      "fonts",
      "color-interpolation"
    ],
    "pace": "medium",
    "directorType": "CasualtyCounter",
    "importance": 9,
    "role": "gravity",
    "shotStyle": "GridCount",
    "animation": {
      "entrance": "fadeIn",
      "emphasis": "numberCountUp",
      "transition": "fadeToBlack",
      "camera": "slowDollyIn"
    },
    "background": {
      "type": "StatField",
      "motion": "solemn",
      "noise": false
    },
    "components": [
      "StatCard",
      "NumberCounter",
      "LabelTag"
    ],
    "content": {
      "mainMessage": "55000 - 48000 - 15",
      "keywords": [
        "55000受灾",
        "48000转移",
        "15人死亡",
        "一级响应"
      ],
      "visualMetaphor": "三张卡片依次弹出，数字跳动到最终值"
    }
  },
  {
    "id": "scene-0008",
    "start": 46.0,
    "end": 55.5,
    "subtitle": "深圳呢？不是台风中心，但连续暴雨没停过。宝安国际机场，一天之内14架航班取消，784架延误。",
    "layout": "data",
    "emphasis": [
      "14架取消",
      "784架延误"
    ],
    "sceneType": "risk-contrast",
    "visualIntent": "localize-impact",
    "layoutRecipe": "location-pin-explode",
    "motionVariant": "pin-drop-ripple",
    "transition": "ripple-cut",
    "visualModules": [
      "transforms",
      "measuring",
      "effects",
      "svg-path"
    ],
    "pace": "fast",
    "directorType": "DataExplosion",
    "importance": 10,
    "role": "spike",
    "shotStyle": "PinDrop",
    "animation": {
      "entrance": "pinDrop",
      "emphasis": "rippleNumber",
      "transition": "rippleOut",
      "camera": "topDownDrop"
    },
    "background": {
      "type": "MapField",
      "motion": "ripple",
      "noise": false
    },
    "components": [
      "MapPin",
      "MetricCard",
      "FlightIcon"
    ],
    "content": {
      "mainMessage": "14取消 784延误",
      "keywords": [
        "深圳",
        "宝安机场",
        "14",
        "784"
      ],
      "visualMetaphor": "地图上深圳定位点落下，波纹扩散出两组数字"
    }
  },
  {
    "id": "scene-0009",
    "start": 55.5,
    "end": 66.0,
    "subtitle": "北京首都机场、上海浦东、广州白云，同一天也都在扛，但深圳的数据，太扎眼了。",
    "layout": "comparison",
    "emphasis": [
      "深圳最扎眼"
    ],
    "sceneType": "relationship-map",
    "visualIntent": "rank-compare",
    "layoutRecipe": "bar-race",
    "motionVariant": "bar-race",
    "transition": "slide-up",
    "visualModules": [
      "measuring",
      "transforms",
      "animation-math",
      "color-interpolation"
    ],
    "pace": "fast",
    "directorType": "BarRace",
    "importance": 8,
    "role": "contrast",
    "shotStyle": "BarChart",
    "animation": {
      "entrance": "slideUp",
      "emphasis": "barExtend",
      "transition": "highlightTop",
      "camera": "panRight"
    },
    "background": {
      "type": "ChartField",
      "motion": "racing",
      "noise": false
    },
    "components": [
      "BarChart",
      "CityLabel",
      "HighlightMarker"
    ],
    "content": {
      "mainMessage": "深圳 784",
      "keywords": [
        "北京",
        "上海",
        "广州",
        "深圳784"
      ],
      "visualMetaphor": "四大城市条形图竞速，深圳柱条冲出屏幕右边框"
    }
  },
  {
    "id": "scene-0010",
    "start": 66.0,
    "end": 74.5,
    "subtitle": "更麻烦的是，这还没结束。美莎克的残余环流还在往华南灌雨。",
    "layout": "timeline",
    "emphasis": [
      "还没结束",
      "残余环流"
    ],
    "sceneType": "timeline",
    "visualIntent": "foreshadow-threat",
    "layoutRecipe": "dual-path-forecast",
    "motionVariant": "dual-track-advance",
    "transition": "split-reveal",
    "visualModules": [
      "svg-path",
      "transforms",
      "effects",
      "animation-math"
    ],
    "pace": "medium-fast",
    "directorType": "DualThreatTracker",
    "importance": 9,
    "role": "tension",
    "shotStyle": "DualTrack",
    "animation": {
      "entrance": "splitOpen",
      "emphasis": "dualTrace",
      "transition": "mergeForward",
      "camera": "widePull"
    },
    "background": {
      "type": "MapField",
      "motion": "tracking",
      "noise": false
    },
    "components": [
      "PathTrace",
      "StormIcon",
      "LabelTag"
    ],
    "content": {
      "mainMessage": "还没结束",
      "keywords": [
        "残余环流",
        "华南",
        "灌雨"
      ],
      "visualMetaphor": "双轨地图：上方残留环流继续灌雨，下方巴威从关岛逼近"
    }
  },
  {
    "id": "scene-0011",
    "start": 74.5,
    "end": 81.5,
    "subtitle": "下一个超强台风巴威，已经在关岛那边升到五级了，正朝东南沿海过来。",
    "layout": "alert",
    "emphasis": [
      "五级",
      "超强台风"
    ],
    "sceneType": "risk-contrast",
    "visualIntent": "warn-scale",
    "layoutRecipe": "alert-overlay",
    "motionVariant": "pulse-warn",
    "transition": "zoom-in",
    "visualModules": [
      "effects",
      "transforms",
      "color-interpolation",
      "fonts"
    ],
    "pace": "slow-tension",
    "directorType": "ThreatScale",
    "importance": 8,
    "role": "warning",
    "shotStyle": "AlertZoom",
    "animation": {
      "entrance": "zoomIn",
      "emphasis": "redPulse",
      "transition": "holdFlash",
      "camera": "slowZoomIn"
    },
    "background": {
      "type": "AlertField",
      "motion": "pulsing",
      "noise": false
    },
    "components": [
      "AlertOverlay",
      "StormScale",
      "DirectionArrow"
    ],
    "content": {
      "mainMessage": "五级",
      "keywords": [
        "五级",
        "超强台风",
        "巴威"
      ],
      "visualMetaphor": "红色警告覆盖，五级风暴图标脉冲放大"
    }
  },
  {
    "id": "scene-0012",
    "start": 81.5,
    "end": 85.3,
    "subtitle": "这个7月，南方的天，没打算给人喘息的机会。",
    "layout": "quote",
    "emphasis": [
      "没打算给人喘息"
    ],
    "sceneType": "summary-card",
    "visualIntent": "leave-impact",
    "layoutRecipe": "centered-punchline",
    "motionVariant": "freeze-frame",
    "transition": "freeze-to-black",
    "visualModules": [
      "fonts",
      "effects",
      "transforms"
    ],
    "pace": "slow",
    "directorType": "FinalPunchline",
    "importance": 10,
    "role": "closing",
    "shotStyle": "FreezeHold",
    "animation": {
      "entrance": "fadeIn",
      "emphasis": "freezeHold",
      "transition": "fadeToBlack",
      "camera": "pullBackSlow"
    },
    "background": {
      "type": "RainSilhouette",
      "motion": "freeze",
      "noise": false
    },
    "components": [
      "TitleCard",
      "RainOverlay"
    ],
    "content": {
      "mainMessage": "南方的天，没打算喘息",
      "keywords": [
        "7月",
        "南方",
        "喘息"
      ],
      "visualMetaphor": "黑底白字，雨幕渐停，文字定格，缓缓黑屏"
    }
  }
];
