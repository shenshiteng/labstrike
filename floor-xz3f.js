/* 行政楼 3 层（部门分布示意板建模）
   由 tools/gen_xz2f.py 生成，不要手改；改完重跑脚本。
   几何与门位沿用 1 层基线 gen_xz2f.py（同楼同坐标系，两层可叠合）；
   部门名按 2 层示意板；★ 无南侧进楼正门（EXITS/LAND 为空）。
   房号 XZ3xx 为自造编号，真实门牌见实景门牌（A3xx）。 */
window.FLOOR_DATA_BY_ID = window.FLOOR_DATA_BY_ID || {};
window.FLOOR_DATA_BY_ID["XZ-3"] = {
  "id": "XZ-3",
  "name": "三层",
  "building": "行政楼",
  "image": "../../assets/floors/XZ-3F_rect.png",
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
      "id": "XZ301",
      "name": "专业负责人办公室",
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
      "id": "XZ302",
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
      "id": "XZ303",
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
      "id": "XZ304",
      "name": "金融工程专业教研室",
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
      "id": "XZ304B",
      "name": "学生工作办公室·经济管理学院(拐角)",
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
      "id": "XZ305",
      "name": "专业负责人办公室(中)",
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
      "id": "XZ306",
      "name": "工商管理专业教研室",
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
      "id": "XZ307",
      "name": "财务管理专业教研室",
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
      "id": "XZ308",
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
      "id": "XZ309",
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
      "id": "XZ310",
      "name": "保密室",
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
      "id": "XZ311",
      "name": "专业负责人办公室",
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
      "id": "XZ312",
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
      "id": "XZ313",
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
      "id": "XZ314",
      "name": "教研室",
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
      "id": "XZ315",
      "name": "经济管理学院副院长办公室",
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
      "id": "XZ316",
      "name": "经济管理学院专业教研室（酒店/旅游/物流/工程管理）",
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
      "id": "XZ317",
      "name": "经济管理学院院长办公室",
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
      "id": "XZ318",
      "name": "经济管理学院会议室",
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
      "name": "东纵走廊（经济管理学院办公室门前）",
      "x1": 890,
      "y1": 40,
      "x2": 970,
      "y2": 655
    },
    {
      "id": "COR-MS",
      "name": "中列南横廊（财务管理/电梯/楼梯门前）",
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
      "id": "WR-XZ3-1",
      "x1": 610,
      "y1": 567,
      "x2": 665,
      "y2": 567
    },
    {
      "id": "WR-XZ3-2",
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
  "startName": "三层南横廊（近中部楼梯）",
  "levelInfo": {
    "site": "行政楼 · 3层",
    "floors": [
      {
        "id": "XZ-3",
        "label": "3F",
        "name": "3层",
        "ready": true,
        "theme": "行政楼三层 · 经济管理学院 / 金融·工商·财务管理教研室 · 无进楼正门"
      }
    ]
  }
};
