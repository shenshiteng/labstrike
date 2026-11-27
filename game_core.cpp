// ============================================================================
// game_core.cpp —— 第一人称射击小游戏的核心规则层（C++ / WebAssembly）
// ----------------------------------------------------------------------------
// 浏览器里的 JS + three.js 只负责渲染、输入采集和音效；
// 玩家移动、蹲跳、弹药、射击节奏、换弹结算等游戏规则全部在这里。
// 这样"形成游戏的逻辑语言"以 C++ 为主，而不是把 C++ 只当作摆设。
// ============================================================================

#include <emscripten.h>
#include <cmath>

namespace {

// ---------- 玩家物理 ----------
const float EYE_HEIGHT   = 1.62f;
const float CROUCH_DROP  = 0.52f;
const float CROUCH_SPEED = 0.85f;
const float WALK_SPEED   = 1.55f;
const float RUN_SPEED    = 3.15f;
const float TURN_SPEED   = 1.85f;
const float JUMP_IMPULSE = 4.30f;
const float GRAVITY      = 11.50f;
const float MAX_DT       = 0.06f;

float g_crouch = 0.0f;      // 0=站立, 1=完全蹲下
float g_jumpZ = 0.0f;       // 离地高度
float g_jumpV = 0.0f;       // 垂直速度
int   g_onGround = 1;
int   g_crouchHeld = 0;
float g_lastDX = 0.0f, g_lastDZ = 0.0f;

inline float clampf(float v, float lo, float hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

// ---------- 武器 / 弹药 ----------
// 0=突击步枪 1=手枪 2=霰弹枪 3=Glock，-1=刀（不参与弹药系统）
const int WEAPON_COUNT = 4;
const int MAG_CAP[WEAPON_COUNT]      = { 45, 10, 6, 12 };
const int MAG_RESERVE[WEAPON_COUNT]  = { 180, 60, 36, 72 };
const float RELOAD_SEC[WEAPON_COUNT] = { 2.2f, 1.5f, 2.8f, 1.5f };
const float FIRE_DELAY[WEAPON_COUNT] = { 0.10f, 0.28f, 0.65f, 0.26f };
const int AUTO_OK[WEAPON_COUNT]      = { 1, 0, 0, 0 };

int g_weapon = 0;
int g_mag[WEAPON_COUNT];
int g_reserve[WEAPON_COUNT];
int g_fireMode = 1;          // 0=半自动, 1=全自动
int g_triggerHeld = 0;
float g_fireCooldown = 0.0f;
int g_reloading = 0;
float g_reloadLeft = 0.0f;
int g_reloadWeapon = 0;

inline int validGun(int w) { return w >= 0 && w < WEAPON_COUNT; }

// ---------- 任务 / NPC 靶子 ----------
// 任务类型：1=清场（固定靶） 2=限时反应（移动靶） 3=顺序击打（红→蓝→黄）
const int MAX_TARGETS = 8;
int   g_missionActive = 0, g_missionType = 0;
int   g_missionDone = 0, g_missionFailed = 0;
int   g_targetTotal = 0, g_targetHit = 0, g_sequencePos = 0;
float g_missionTime = 0.0f, g_missionLimit = 0.0f;
int   g_targetAlive[MAX_TARGETS], g_targetHp[MAX_TARGETS], g_targetKind[MAX_TARGETS];
float g_targetX[MAX_TARGETS], g_targetZ[MAX_TARGETS];
float g_targetBaseX[MAX_TARGETS], g_targetBaseZ[MAX_TARGETS], g_targetPhase[MAX_TARGETS];

} // namespace

extern "C" {

// ---------------- 生命周期 ----------------
EMSCRIPTEN_KEEPALIVE void core_init() {
  g_crouch = 0.0f; g_jumpZ = 0.0f; g_jumpV = 0.0f;
  g_onGround = 1; g_crouchHeld = 0;
  g_lastDX = 0.0f; g_lastDZ = 0.0f;
  g_weapon = 0; g_fireMode = 1; g_triggerHeld = 0;
  g_fireCooldown = 0.0f; g_reloading = 0; g_reloadLeft = 0.0f;
  for (int i = 0; i < WEAPON_COUNT; ++i) {
    g_mag[i] = MAG_CAP[i];
    g_reserve[i] = MAG_RESERVE[i];
  }
}

// ---------------- 玩家：蹲 / 跳 / 位移 ----------------
EMSCRIPTEN_KEEPALIVE void core_reset_player(float x, float z) {
  (void)x; (void)z;   // 位置由 JS 侧地图决定，这里只重置姿态
  g_crouch = 0.0f; g_jumpZ = 0.0f; g_jumpV = 0.0f;
  g_onGround = 1; g_crouchHeld = 0;
}

EMSCRIPTEN_KEEPALIVE void core_set_crouch(int on) { g_crouchHeld = on ? 1 : 0; }

EMSCRIPTEN_KEEPALIVE void core_jump() {
  if (g_onGround) {
    g_jumpV = JUMP_IMPULSE;
    g_onGround = 0;
  }
}

// 每帧推进玩家状态，返回本帧"期望位移"由 JS 做碰撞检测后落地
EMSCRIPTEN_KEEPALIVE void core_step_player(float dt, float forward, float strafe, int run, float yaw) {
  dt = clampf(dt, 0.0f, MAX_DT);

  // 蹲下平滑过渡
  float target = g_crouchHeld ? 1.0f : 0.0f;
  float k = 1.0f - std::exp(-dt * 12.0f);
  g_crouch += (target - g_crouch) * k;
  if (std::fabs(g_crouch - target) < 0.001f) g_crouch = target;

  // 跳跃重力积分
  if (!g_onGround) {
    g_jumpZ += g_jumpV * dt;
    g_jumpV -= GRAVITY * dt;
    if (g_jumpZ <= 0.0f) {
      g_jumpZ = 0.0f; g_jumpV = 0.0f; g_onGround = 1;
    }
  }

  // 平面位移：与页面 dirOf(yaw) 保持一致的朝向定义
  float len = std::sqrt(forward * forward + strafe * strafe);
  if (len > 0.0001f) {
    float speed = g_crouchHeld ? CROUCH_SPEED : (run ? RUN_SPEED : WALK_SPEED);
    float stepLen = speed * dt / len;
    float fx = std::sin(yaw), fz = -std::cos(yaw);
    float rx = -fz, rz = fx;              // 右手方向
    g_lastDX = (fx * forward + rx * strafe) * stepLen;
    g_lastDZ = (fz * forward + rz * strafe) * stepLen;
  } else {
    g_lastDX = 0.0f; g_lastDZ = 0.0f;
  }
}

EMSCRIPTEN_KEEPALIVE float core_last_dx() { return g_lastDX; }
EMSCRIPTEN_KEEPALIVE float core_last_dz() { return g_lastDZ; }
EMSCRIPTEN_KEEPALIVE float core_player_eye() { return EYE_HEIGHT - g_crouch * CROUCH_DROP + g_jumpZ; }
EMSCRIPTEN_KEEPALIVE float core_player_crouch() { return g_crouch; }
EMSCRIPTEN_KEEPALIVE float core_player_jump() { return g_jumpZ; }
EMSCRIPTEN_KEEPALIVE int   core_player_ground() { return g_onGround; }

// ---------------- 武器：模式 / 弹药 / 换弹 ----------------
EMSCRIPTEN_KEEPALIVE int core_set_weapon(int w) {
  if (w < -1 || w >= WEAPON_COUNT) return 0;
  g_weapon = w;
  g_reloading = 0; g_reloadLeft = 0.0f;
  g_fireCooldown = 0.0f;
  if (validGun(w) && !AUTO_OK[w]) g_fireMode = 0;
  return 1;
}
EMSCRIPTEN_KEEPALIVE int core_get_weapon() { return g_weapon; }

EMSCRIPTEN_KEEPALIVE int core_get_mode() { return g_fireMode; }
EMSCRIPTEN_KEEPALIVE int core_set_mode(int mode) {
  if (mode == 1 && validGun(g_weapon) && !AUTO_OK[g_weapon]) return g_fireMode;
  g_fireMode = mode ? 1 : 0;
  return g_fireMode;
}
EMSCRIPTEN_KEEPALIVE int core_toggle_mode() {
  if (validGun(g_weapon) && !AUTO_OK[g_weapon]) { g_fireMode = 0; return g_fireMode; }
  g_fireMode = g_fireMode ? 0 : 1;
  return g_fireMode;
}
EMSCRIPTEN_KEEPALIVE int core_can_auto(int w) { return validGun(w) ? AUTO_OK[w] : 0; }
EMSCRIPTEN_KEEPALIVE float core_fire_delay(int w) { return validGun(w) ? FIRE_DELAY[w] : 0.0f; }

EMSCRIPTEN_KEEPALIVE int core_ammo_mag()     { return validGun(g_weapon) ? g_mag[g_weapon] : 0; }
EMSCRIPTEN_KEEPALIVE int core_ammo_reserve() { return validGun(g_weapon) ? g_reserve[g_weapon] : 0; }
EMSCRIPTEN_KEEPALIVE int core_ammo_capacity(){ return validGun(g_weapon) ? MAG_CAP[g_weapon] : 0; }
EMSCRIPTEN_KEEPALIVE int core_reloading()    { return g_reloading; }
EMSCRIPTEN_KEEPALIVE float core_reload_duration() { return validGun(g_weapon) ? RELOAD_SEC[g_weapon] : 0.0f; }

// 开火：1=成功击发, 0=冷却中/换弹中, -1=空仓（供 JS 播干涩咔哒）
EMSCRIPTEN_KEEPALIVE int core_fire() {
  if (!validGun(g_weapon) || g_reloading || g_fireCooldown > 0.0f) return 0;
  if (g_mag[g_weapon] <= 0) return -1;
  g_mag[g_weapon]--;
  g_fireCooldown = FIRE_DELAY[g_weapon];
  return 1;
}

EMSCRIPTEN_KEEPALIVE void core_press_trigger() { g_triggerHeld = 1; }
EMSCRIPTEN_KEEPALIVE void core_release_trigger() { g_triggerHeld = 0; }

// 换弹：定时器完全在 C++ 里按 dt 结算，不依赖 requestAnimationFrame 帧率
EMSCRIPTEN_KEEPALIVE int core_reload() {
  if (!validGun(g_weapon) || g_reloading) return 0;
  if (g_mag[g_weapon] >= MAG_CAP[g_weapon] || g_reserve[g_weapon] <= 0) return 0;
  g_reloading = 1;
  g_reloadWeapon = g_weapon;
  g_reloadLeft = RELOAD_SEC[g_weapon];
  return 1;
}

// 返回事件位：1=换弹完成, 2=自动模式击发一发
EMSCRIPTEN_KEEPALIVE int core_step_weapon(float dt) {
  dt = clampf(dt, 0.0f, MAX_DT);
  int events = 0;

  if (g_fireCooldown > 0.0f) {
    g_fireCooldown -= dt;
    if (g_fireCooldown < 0.0f) g_fireCooldown = 0.0f;
  }

  if (g_reloading) {
    g_reloadLeft -= dt;
    if (g_reloadLeft <= 0.0f) {
      int w = g_reloadWeapon;
      if (validGun(w)) {
        int need = MAG_CAP[w] - g_mag[w];
        int take = need < g_reserve[w] ? need : g_reserve[w];
        g_mag[w] += take; g_reserve[w] -= take;
      }
      g_reloading = 0; g_reloadLeft = 0.0f;
      events |= 1;
    }
  }

  if (!g_reloading && g_triggerHeld && g_fireMode == 1 &&
      validGun(g_weapon) && AUTO_OK[g_weapon] && g_fireCooldown <= 0.0f) {
    if (core_fire() == 1) events |= 2;
  }
  return events;
}

// ---------------- 任务 / NPC 靶子 ----------------
// type: 1=清场 2=限时 3=顺序；count 最多 8；limit<=0 表示不限时
EMSCRIPTEN_KEEPALIVE void core_mission_start(int type, int count, float limit) {
  if (type < 1 || type > 3) type = 1;
  if (count < 1) count = 1;
  if (count > MAX_TARGETS) count = MAX_TARGETS;
  g_missionType = type;
  g_targetTotal = count;
  g_targetHit = 0; g_sequencePos = 0;
  g_missionTime = 0.0f; g_missionLimit = limit > 0.0f ? limit : 0.0f;
  g_missionActive = 1; g_missionDone = 0; g_missionFailed = 0;

  for (int i = 0; i < MAX_TARGETS; ++i) {
    g_targetAlive[i] = i < count ? 1 : 0;
    g_targetHp[i] = (type == 1) ? 2 : 1;   // 清场靶要打两发，其余一发
    g_targetKind[i] = (type == 2) ? 1 : ((type == 3) ? (i % 3) : 0);
    g_targetX[i] = 0.0f; g_targetZ[i] = 0.0f;
    g_targetBaseX[i] = 0.0f; g_targetBaseZ[i] = 0.0f;
    g_targetPhase[i] = i * 0.85f;
  }
}

EMSCRIPTEN_KEEPALIVE void core_target_set_pos(int id, float x, float z) {
  if (id < 0 || id >= MAX_TARGETS) return;
  g_targetX[id] = x; g_targetZ[id] = z;
  g_targetBaseX[id] = x; g_targetBaseZ[id] = z;
}

// 命中：1=有效命中, 0=无效, -1=顺序错导致失败
EMSCRIPTEN_KEEPALIVE int core_target_hit(int id) {
  if (!g_missionActive || id < 0 || id >= MAX_TARGETS || !g_targetAlive[id]) return 0;

  if (g_missionType == 3 && id != g_sequencePos) {
    g_missionActive = 0; g_missionFailed = 1;
    return -1;
  }

  g_targetHp[id]--;
  if (g_targetHp[id] <= 0) {
    g_targetAlive[id] = 0;
    g_targetHit++;
    if (g_missionType == 3) g_sequencePos++;
  }
  if (g_targetHit >= g_targetTotal) {
    g_missionActive = 0; g_missionDone = 1;
  }
  return 1;
}

// 每帧推进任务计时 + 移动靶位置；JS 读坐标去更新 NPC 模型
EMSCRIPTEN_KEEPALIVE void core_mission_update(float dt) {
  if (!g_missionActive) return;
  dt = clampf(dt, 0.0f, MAX_DT);
  g_missionTime += dt;
  if (g_missionLimit > 0.0f && g_missionTime >= g_missionLimit) {
    g_missionActive = 0; g_missionFailed = 1;
    return;
  }
  if (g_missionType == 2) {
    for (int i = 0; i < g_targetTotal; ++i) {
      if (!g_targetAlive[i]) continue;
      float a = g_missionTime * 1.25f + g_targetPhase[i];
      g_targetX[i] = g_targetBaseX[i] + std::sin(a) * 0.55f;
      g_targetZ[i] = g_targetBaseZ[i] + std::cos(a * 0.8f) * 0.55f;
    }
  }
}

EMSCRIPTEN_KEEPALIVE int core_mission_active() { return g_missionActive; }
EMSCRIPTEN_KEEPALIVE int core_mission_type() { return g_missionType; }
EMSCRIPTEN_KEEPALIVE int core_mission_done() { return g_missionDone; }
EMSCRIPTEN_KEEPALIVE int core_mission_failed() { return g_missionFailed; }
EMSCRIPTEN_KEEPALIVE int core_mission_hit() { return g_targetHit; }
EMSCRIPTEN_KEEPALIVE int core_mission_total() { return g_targetTotal; }
EMSCRIPTEN_KEEPALIVE float core_mission_time() { return g_missionTime; }
EMSCRIPTEN_KEEPALIVE float core_mission_time_left() {
  return g_missionLimit > 0.0f ? (g_missionLimit - g_missionTime) : 0.0f;
}
EMSCRIPTEN_KEEPALIVE int core_target_alive(int id) { return id >= 0 && id < MAX_TARGETS ? g_targetAlive[id] : 0; }
EMSCRIPTEN_KEEPALIVE int core_target_hp(int id) { return id >= 0 && id < MAX_TARGETS ? g_targetHp[id] : 0; }
EMSCRIPTEN_KEEPALIVE int core_target_kind(int id) { return id >= 0 && id < MAX_TARGETS ? g_targetKind[id] : 0; }
EMSCRIPTEN_KEEPALIVE float core_target_x(int id) { return id >= 0 && id < MAX_TARGETS ? g_targetX[id] : 0.0f; }
EMSCRIPTEN_KEEPALIVE float core_target_z(int id) { return id >= 0 && id < MAX_TARGETS ? g_targetZ[id] : 0.0f; }

} // extern "C"
