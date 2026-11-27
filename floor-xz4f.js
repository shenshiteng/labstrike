/* 行政楼 4 层（部门分布示意板建模）
   由 tools/gen_xz4f.py 生成，不要手改；改完重跑脚本。
   几何与门位沿用 3 层基线 gen_xz3f.py（同楼同坐标系，各层可叠合）；
   部门名按 4 层示意板；★ 无南侧进楼正门（EXITS/LAND 为空）。
   房号 XZ4xx 为自造编号，真实门牌见实景门牌（A4xx）。 */
window.FLOOR_DATA_BY_ID = window.FLOOR_DATA_BY_ID || {};
window.FLOOR_DATA_BY_ID["XZ-4"] = {
  "id": "XZ-4",
  "name": "四层",
  "building": "行政楼",
  "image": "../../assets/floors/XZ-4F_rect.png",
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
      "id": "XZ401",
      "name": "纪检监察办公室",
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
      "id": "XZ402",
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
      "id": "XZ403",
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
      "id": "XZ404",
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
      "id": "XZ404B",
      "name": "办公室(拐角)",
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
      "id": "XZ405",
      "name": "科学研究处",
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
      "id": "XZ406",
      "name": "计财处",
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
      "id": "XZ407",
      "name": "科学研究处",
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
      "id": "XZ408",
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
      "id": "XZ409",
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
      "id": "XZ410",
      "name": "党员会议室",
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
      "id": "XZ411",
      "name": "办公室",
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
      "id": "XZ412",
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
      "id": "XZ413",
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
      "id": "XZ414",
      "name": "监事室",
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
      "id": "XZ415",
      "name": "法律顾问办公室",
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
      "id": "XZ416",
      "name": "副董事长 / 董事室 / 校领导办公室",
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
      "id": "XZ417",
      "name": "总会计师",
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
      "id": "XZ418",
      "name": "董事长",
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
      "name": "中列南横廊（电梯/楼梯门前）",
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
      "id": "WR-XZ4-1",
      "x1": 610,
      "y1": 567,
      "x2": 665,
      "y2": 567
    },
    {
      "id": "WR-XZ4-2",
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
  "startName": "四层南横廊（近中部楼梯）",
  "levelInfo": {
    "site": "行政楼 · 4层",
    "floors": [
      {
        "id": "XZ-4",
        "label": "4F",
        "name": "4层",
        "ready": true,
        "theme": "行政楼四层 · 纪检监察/计财/科学研究处 + 董事会序列 · 无进楼正门"
      }
    ]
  }
};
