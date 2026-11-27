/* 行政楼 1 层（部门分布示意板建模）
   由 tools/gen_xz1f.py 生成，不要手改；改完重跑脚本。
   坐标系：assets/floors/XZ-1F_rect.png（1700x1050 矫正图）的像素。
   比例尺 20.0 px/m 为估值（示意板无尺寸标注），量一间房净宽后改 PX_PER_M 重跑。 */
window.FLOOR_DATA_BY_ID = window.FLOOR_DATA_BY_ID || {};
window.FLOOR_DATA_BY_ID["XZ-1"] = {
  "id": "XZ-1",
  "name": "一层",
  "building": "行政楼",
  "image": "../../assets/floors/XZ-1F_rect.png",
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
    "y2": 750
  },
  "wallHeight": 2.6,
  "doorOutPx": 30,
  "land": [
    {
      "id": "XZ-ENTRY",
      "name": "正门外台阶",
      "x1": 470,
      "y1": 700,
      "x2": 610,
      "y2": 748
    }
  ],
  "landFences": [],
  "rooms": [
    {
      "id": "XZ101",
      "name": "资产设备管理处",
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
      "id": "XZ102",
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
      "id": "XZ103",
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
      "id": "XZ104",
      "name": "教务处",
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
      "id": "XZ104B",
      "name": "教务处(拐角)",
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
      "id": "XZ105",
      "name": "资产设备管理",
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
      "id": "XZ106",
      "name": "黄骅海滨培训中心(对外交流合作处)",
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
      "id": "XZ107",
      "name": "教务处(中)",
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
      "id": "XZ108",
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
      "id": "XZ109",
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
      "id": "XZ110",
      "name": "开水间",
      "kind": "service",
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
      "id": "XZ111",
      "name": "招生就业处(北)",
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
      "id": "XZ112",
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
      "id": "XZ113",
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
      "id": "XZ114",
      "name": "招生就业处(中南)",
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
      "id": "XZ115",
      "name": "安全保卫处",
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
      "id": "XZ116",
      "name": "招生就业处",
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
      "id": "XZ117",
      "name": "学生事务一站式服务中心",
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
      "id": "XZ118",
      "name": "收发室",
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
      "name": "中央大厅（柱廊 + 接待台，实景大厅）",
      "x1": 535,
      "y1": 50,
      "x2": 790,
      "y2": 655
    },
    {
      "id": "COR-E",
      "name": "东纵走廊（招生就业处最右列门前）",
      "x1": 890,
      "y1": 40,
      "x2": 970,
      "y2": 655
    },
    {
      "id": "COR-MS",
      "name": "中列南横廊（教务处/电梯/楼梯门前）",
      "x1": 385,
      "y1": 570,
      "x2": 535,
      "y2": 655
    },
    {
      "id": "COR-S",
      "name": "南横廊（各纵廊连通 + 正门门厅）",
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
      "id": "WR-XZ-1",
      "x1": 610,
      "y1": 567,
      "x2": 665,
      "y2": 567
    },
    {
      "id": "WR-XZ-2",
      "x1": 710,
      "y1": 567,
      "x2": 790,
      "y2": 567
    }
  ],
  "perimeterHoles": [
    {
      "x1": 470,
      "y1": 700,
      "x2": 530,
      "y2": 700,
      "side": "S",
      "leaf": 2,
      "swing": "out"
    },
    {
      "x1": 550,
      "y1": 700,
      "x2": 610,
      "y2": 700,
      "side": "S",
      "leaf": 2,
      "swing": "out"
    },
    {
      "x1": 535,
      "y1": 50,
      "x2": 790,
      "y2": 50
    }
  ],
  "extDoors": [
    {
      "x1": 470,
      "y1": 700,
      "x2": 530,
      "y2": 700,
      "side": "S",
      "leaf": 2,
      "swing": "out"
    },
    {
      "x1": 550,
      "y1": 700,
      "x2": 610,
      "y2": 700,
      "side": "S",
      "leaf": 2,
      "swing": "out"
    }
  ],
  "ringSlab": true,
  "fixtures": [],
  "startPx": {
    "x": 540,
    "y": 665
  },
  "startName": "一层正门门厅（南横廊）",
  "levelInfo": {
    "site": "行政楼 · 1层",
    "floors": [
      {
        "id": "XZ-1",
        "label": "1F",
        "name": "1层",
        "ready": true,
        "theme": "行政楼一层 · 部门办公 + 中央大厅 + 正门"
      }
    ]
  }
};
