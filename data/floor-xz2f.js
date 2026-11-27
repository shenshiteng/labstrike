/* 行政楼 2 层（部门分布示意板建模）
   由 tools/gen_xz2f.py 生成，不要手改；改完重跑脚本。
   几何与门位沿用 1 层基线 gen_xz1f.py（同楼同坐标系，两层可叠合）；
   部门名按 2 层示意板；★ 无南侧进楼正门（EXITS/LAND 为空）。
   房号 XZ2xx 为自造编号，真实门牌见 docs/行政楼2层建模说明.md。 */
window.FLOOR_DATA_BY_ID = window.FLOOR_DATA_BY_ID || {};
window.FLOOR_DATA_BY_ID["XZ-2"] = {
  "id": "XZ-2",
  "name": "二层",
  "building": "行政楼",
  "image": "../../assets/floors/XZ-2F_rect.png",
  "imageWidth": 1700,
  "imageHeight": 1050,
  "pxPerMeter": 20.0,
  "originPx": [
    660,
    375
  ],
  "bounds": {
    "x1": 195,
    "y1": 35,
    "x2": 1125,
    "y2": 705
  },
  "wallHeight": 2.6,
  "doorOutPx": 30,
  "land": [],
  "landFences": [],
  "rooms": [
    {
      "id": "XZ201",
      "name": "人事处",
      "kind": "office",
      "x1": 200,
      "y1": 50,
      "x2": 320,
      "y2": 190,
      "door": "E",
      "doorT": 0.5,
      "doorW": 1.2,
      "swing": "in"
    },
    {
      "id": "XZ202",
      "name": "西侧楼梯",
      "kind": "stair",
      "x1": 200,
      "y1": 190,
      "x2": 320,
      "y2": 310,
      "door": "E",
      "doorT": 0.5,
      "doorW": 1.2,
      "swing": "in"
    },
    {
      "id": "XZ203",
      "name": "卫生间(西)",
      "kind": "toilet",
      "x1": 200,
      "y1": 310,
      "x2": 320,
      "y2": 390,
      "door": "E",
      "doorT": 0.5,
      "doorW": 0.9,
      "swing": "in"
    },
    {
      "id": "XZ204",
      "name": "办公室",
      "kind": "office",
      "x1": 200,
      "y1": 390,
      "x2": 320,
      "y2": 700,
      "door": "",
      "doorT": 0.5,
      "doorW": 1.4,
      "swing": "in",
      "open": [
        {
          "face": "E",
          "from": 590,
          "to": 658
        }
      ]
    },
    {
      "id": "XZ204B",
      "name": "档案馆(拐角)",
      "kind": "office",
      "x1": 320,
      "y1": 590,
      "x2": 385,
      "y2": 700,
      "door": "E",
      "doorT": 0.5,
      "doorW": 1.0,
      "swing": "in",
      "open": [
        "W"
      ]
    },
    {
      "id": "XZ205",
      "name": "人事处(中)",
      "kind": "office",
      "x1": 385,
      "y1": 50,
      "x2": 535,
      "y2": 240,
      "door": "W",
      "doorT": 0.5,
      "doorW": 1.2,
      "swing": "in"
    },
    {
      "id": "XZ206",
      "name": "办学督导办公室·办公室",
      "kind": "office",
      "x1": 385,
      "y1": 240,
      "x2": 535,
      "y2": 490,
      "door": "W",
      "doorT": 0.5,
      "doorW": 1.4,
      "swing": "in"
    },
    {
      "id": "XZ207",
      "name": "教学督导办公室",
      "kind": "office",
      "x1": 385,
      "y1": 490,
      "x2": 490,
      "y2": 570,
      "door": "S",
      "doorT": 0.5,
      "doorW": 1.0,
      "swing": "in"
    },
    {
      "id": "XZ208",
      "name": "电梯",
      "kind": "service",
      "x1": 490,
      "y1": 490,
      "x2": 550,
      "y2": 570,
      "door": "S",
      "doorT": 0.5,
      "doorW": 1.0,
      "swing": "in"
    },
    {
      "id": "XZ209",
      "name": "中部楼梯",
      "kind": "stair",
      "x1": 550,
      "y1": 490,
      "x2": 610,
      "y2": 570,
      "door": "S",
      "doorT": 0.5,
      "doorW": 1.2,
      "swing": "in"
    },
    {
      "id": "XZ210",
      "name": "会议室",
      "kind": "office",
      "x1": 665,
      "y1": 505,
      "x2": 710,
      "y2": 570,
      "door": "S",
      "doorT": 0.5,
      "doorW": 0.9,
      "swing": "in"
    },
    {
      "id": "XZ211",
      "name": "会客室",
      "kind": "office",
      "x1": 790,
      "y1": 50,
      "x2": 890,
      "y2": 260,
      "door": "E",
      "doorT": 0.5,
      "doorW": 1.2,
      "swing": "in"
    },
    {
      "id": "XZ212",
      "name": "东侧楼梯",
      "kind": "stair",
      "x1": 790,
      "y1": 260,
      "x2": 890,
      "y2": 375,
      "door": "E",
      "doorT": 0.5,
      "doorW": 1.2,
      "swing": "in"
    },
    {
      "id": "XZ213",
      "name": "卫生间(东)",
      "kind": "toilet",
      "x1": 790,
      "y1": 375,
      "x2": 890,
      "y2": 470,
      "door": "E",
      "doorT": 0.5,
      "doorW": 0.9,
      "swing": "in"
    },
    {
      "id": "XZ214",
      "name": "党群工作部",
      "kind": "office",
      "x1": 790,
      "y1": 470,
      "x2": 890,
      "y2": 520,
      "door": "E",
      "doorT": 0.5,
      "doorW": 1.0,
      "swing": "in"
    },
    {
      "id": "XZ215",
      "name": "宣传统战部",
      "kind": "office",
      "x1": 790,
      "y1": 520,
      "x2": 890,
      "y2": 570,
      "door": "E",
      "doorT": 0.5,
      "doorW": 1.0,
      "swing": "in"
    },
    {
      "id": "XZ216",
      "name": "校领导办公室",
      "kind": "office",
      "x1": 970,
      "y1": 40,
      "x2": 1120,
      "y2": 560,
      "door": "W",
      "doorT": 0.5,
      "doorW": 1.4,
      "swing": "in"
    },
    {
      "id": "XZ217",
      "name": "学校办公室",
      "kind": "office",
      "x1": 970,
      "y1": 560,
      "x2": 1120,
      "y2": 640,
      "door": "W",
      "doorT": 0.5,
      "doorW": 1.2,
      "swing": "in"
    },
    {
      "id": "XZ218",
      "name": "学校办公室(南)",
      "kind": "office",
      "x1": 970,
      "y1": 640,
      "x2": 1120,
      "y2": 700,
      "door": "W",
      "doorT": 0.5,
      "doorW": 1.2,
      "swing": "in"
    }
  ],
  "corridors": [
    {
      "id": "COR-W",
      "name": "西纵走廊（西列房间门前）",
      "x1": 320,
      "y1": 50,
      "x2": 385,
      "y2": 655
    },
    {
      "id": "COR-C",
      "name": "中央大厅（柱廊 + 接待台）",
      "x1": 535,
      "y1": 50,
      "x2": 790,
      "y2": 655
    },
    {
      "id": "COR-E",
      "name": "东纵走廊（校领导办公室门前）",
      "x1": 890,
      "y1": 40,
      "x2": 970,
      "y2": 655
    },
    {
      "id": "COR-MS",
      "name": "中列南横廊（教学督导/电梯/楼梯门前）",
      "x1": 385,
      "y1": 570,
      "x2": 535,
      "y2": 655
    },
    {
      "id": "COR-S",
      "name": "南横廊（各纵廊连通）",
      "x1": 385,
      "y1": 630,
      "x2": 1120,
      "y2": 700
    }
  ],
  "stairs": [
    {
      "id": "ST-W",
      "name": "西侧楼梯",
      "x1": 200,
      "y1": 190,
      "x2": 320,
      "y2": 260,
      "tread": 8,
      "dir": "NS"
    },
    {
      "id": "ST-M",
      "name": "中部楼梯",
      "x1": 550,
      "y1": 490,
      "x2": 610,
      "y2": 570,
      "tread": 6,
      "dir": "NS"
    },
    {
      "id": "ST-E",
      "name": "东侧楼梯",
      "x1": 790,
      "y1": 260,
      "x2": 890,
      "y2": 375,
      "tread": 8,
      "dir": "NS"
    }
  ],
  "perimeter": [
    {
      "x1": 1120,
      "y1": 40,
      "x2": 890,
      "y2": 40
    },
    {
      "x1": 890,
      "y1": 40,
      "x2": 890,
      "y2": 50
    },
    {
      "x1": 890,
      "y1": 50,
      "x2": 200,
      "y2": 50
    },
    {
      "x1": 200,
      "y1": 50,
      "x2": 200,
      "y2": 700
    },
    {
      "x1": 200,
      "y1": 700,
      "x2": 1120,
      "y2": 700
    },
    {
      "x1": 1120,
      "y1": 700,
      "x2": 1120,
      "y2": 40
    }
  ],
  "rings": [
    [
      {
        "x1": 1120,
        "y1": 40
      },
      {
        "x1": 890,
        "y1": 40
      },
      {
        "x1": 890,
        "y1": 50
      },
      {
        "x1": 200,
        "y1": 50
      },
      {
        "x1": 200,
        "y1": 700
      },
      {
        "x1": 1120,
        "y1": 700
      }
    ]
  ],
  "wallRuns": [
    {
      "id": "WR-XZ2-1",
      "x1": 610,
      "y1": 567,
      "x2": 665,
      "y2": 567
    },
    {
      "id": "WR-XZ2-2",
      "x1": 710,
      "y1": 567,
      "x2": 790,
      "y2": 567
    }
  ],
  "perimeterHoles": [
    {
      "x1": 535,
      "y1": 50,
      "x2": 790,
      "y2": 50
    }
  ],
  "extDoors": [],
  "ringSlab": true,
  "fixtures": [],
  "startPx": {
    "x": 540,
    "y": 665
  },
  "startName": "二层南横廊（近中部楼梯）",
  "levelInfo": {
    "site": "行政楼 · 2层",
    "floors": [
      {
        "id": "XZ-2",
        "label": "2F",
        "name": "2层",
        "ready": true,
        "theme": "行政楼二层 · 人事/督导/党务 + 校领导办公室 · 无进楼正门"
      }
    ]
  }
};
