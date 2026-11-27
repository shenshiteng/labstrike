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
]

def main():
    if not os.path.isfile(EMCC):
        print("找不到 emcc.bat：" + EMCC)
        print("先运行：C:\\Users\\35391\\emsdk-main\\emsdk.bat install latest && emsdk.bat activate latest")
        return 1

    cmd = [
        EMCC, SRC, "-O3", "-std=c++11",
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
