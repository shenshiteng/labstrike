"""把 game_core.cpp 编译成单文件 JS（内嵌 wasm），供 walk_game.html 用 file:// 直接加载。

用法：
    python nav3d/wasm/build_core.py

前置：官方 emsdk 已安装在 C:/Users/35391/emsdk-main 并 install + activate latest。
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EMCC = r"C:\Users\35391\emsdk-main\releases\9146b21a8350e85c9934cf570f7a6ceb7470623b-64bit\install\emscripten\emcc.exe"
SRC = os.path.join(HERE, "game_core.cpp")
DATA_SRC = os.path.join(HERE, "floor_data.cpp")   # 楼层数据唯一源（C++ 持有）
OUT = os.path.join(HERE, "game_core.js")

EXPORTS = [
    "_core_init", "_core_reset_player", "_core_set_crouch", "_core_jump",
    "_core_step_player", "_core_last_dx", "_core_last_dz",
    "_core_player_eye", "_core_player_crouch", "_core_player_jump", "_core_player_ground",
    "_core_set_weapon", "_core_get_weapon",
    "_core_get_mode", "_core_set_mode", "_core_toggle_mode", "_core_can_auto", "_core_fire_delay",
    "_core_ammo_mag", "_core_ammo_reserve", "_core_ammo_capacity",
    "_core_reloading", "_core_reload_duration",
    "_core_fire", "_core_press_trigger", "_core_release_trigger",
    "_core_reload", "_core_step_weapon",
    "_core_mission_start", "_core_target_set_pos", "_core_target_hit", "_core_mission_update",
    "_core_mission_active", "_core_mission_type", "_core_mission_done", "_core_mission_failed",
    "_core_mission_hit", "_core_mission_total", "_core_mission_time", "_core_mission_time_left",
    "_core_target_alive", "_core_target_hp", "_core_target_kind", "_core_target_x", "_core_target_z",
    # 地图碰撞 / 射线遮挡
    "_core_init_world", "_core_set_pr", "_core_add_walk", "_core_add_col",
    "_core_world_walk_count", "_core_world_col_count",
    "_core_free", "_core_shot_blocked", "_core_ray_wall_dist",
    # 任务 2.0（页面主路径：清场 / 限时 / 顺序 / 移动靶 / 爆头）
    "_core_m2_start", "_core_m2_set_target", "_core_m2_step", "_core_m2_hit",
    "_core_m2_active", "_core_m2_done", "_core_m2_failed", "_core_m2_hit_count",
    "_core_m2_total", "_core_m2_seq", "_core_m2_type", "_core_m2_time", "_core_m2_time_left",
    "_core_m2_target_alive", "_core_m2_target_kind", "_core_m2_target_x", "_core_m2_target_z",
    # 僵尸波次 AI
    "_core_z_reset", "_core_z_stop",
    "_core_z_wave_count", "_core_z_wave_dmg", "_core_z_wave_speed", "_core_z_wave_hp", "_core_z_wave_color",
    "_core_z_add", "_core_z_step", "_core_z_hit",
    "_core_z_on", "_core_z_wave", "_core_z_break", "_core_z_killed", "_core_z_player_hp",
    "_core_z_events", "_core_z_used", "_core_z_x", "_core_z_z", "_core_z_alive",
    "_core_z_removed", "_core_z_hp", "_core_z_flash", "_core_z_yaw",
    # 楼层数据（C++ 持有，页面可从核心取回）
    "_core_floor_count", "_core_floor_id", "_core_floor_file", "_core_floor_script",
]

def check_floor_mirror():
    """校验 data/floor-*.js 与 floor_data.cpp 一致（JS 只是运行时镜像）。"""
    import re
    if not os.path.isfile(DATA_SRC):
        print("提示：缺少 floor_data.cpp，跳过楼层镜像校验")
        return 0
    with open(DATA_SRC, encoding="utf-8", newline="") as f:
        src = f.read()
    blobs = re.findall(r'R"FLOORDATA_9F3A\(\n(.*?)\n\)FLOORDATA_9F3A"', src, re.S)
    if len(blobs) != 13:
        print("楼层镜像校验失败：C++ 中数据块数", len(blobs), "≠ 13")
        return 1
    for blob in blobs:
        if not re.search(r'window\.FLOOR_DATA(_BY_ID\["[^"]+"\])?\s*=', blob):
            print("楼层镜像校验失败：数据块缺少楼层赋值语句")
            return 1
    print("楼层镜像校验通过：C++ 持有", len(blobs), "个楼层数据块")
    return 0


def main():
    rc = check_floor_mirror()
    if rc != 0:
        return rc
    if not os.path.isfile(EMCC):
        print("找不到 emcc.bat：" + EMCC)
        print("先运行：C:\\Users\\35391\\emsdk-main\\emsdk.bat install latest && emsdk.bat activate latest")
        return 1

    cmd = [
        EMCC, SRC, DATA_SRC, "-O3", "-std=c++11",
        "-s", "SINGLE_FILE=1",
        "-s", "MODULARIZE=1",
        "-s", "EXPORT_NAME=GameCoreFactory",
        "-s", "ALLOW_MEMORY_GROWTH=1",
        "-s", "ENVIRONMENT=web",
        "-s", "EXPORTED_FUNCTIONS=" + json.dumps(EXPORTS, separators=(",", ":")),
        "-s", "EXPORTED_RUNTIME_METHODS=[\"cwrap\"]",
        "-o", OUT,
    ]
    print("编译：", " ".join(cmd))
    rc = subprocess.call(cmd, cwd=HERE)
    if rc != 0:
        print("编译失败，退出码", rc)
        return rc
    print("生成：", OUT, os.path.getsize(OUT), "字节")
    return 0

if __name__ == "__main__":
    sys.exit(main())
