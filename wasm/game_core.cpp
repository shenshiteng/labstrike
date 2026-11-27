// ============================================================================
// game_core.cpp —— LabStrike 的规则核心（C++ / WebAssembly）
// ----------------------------------------------------------------------------
// 浏览器里的 JS + three.js 只负责渲染、输入采集和音效。
// 玩家物理、弹药节奏、地图碰撞/射线遮挡、任务规则、僵尸 AI 全部在这里。
// 这样"形成游戏的逻辑语言"以 C++ 为主，JS 只剩表现层。
// ============================================================================

#include <emscripten.h>
#include <cmath>
#include <cstring>
#include <algorithm>

namespace {

// ---------- 玩家物理 ----------
const float EYE_HEIGHT   = 1.62f;
const float CROUCH_DROP  = 0.52f;
const float CROUCH_SPEED = 0.85f;
const float WALK_SPEED   = 1.55f;
const float RUN_SPEED    = 3.15f;
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

// ---------- 地图碰撞（每层由 JS 在 buildFloorScene 后上传） ----------
// 矩形语义与页面一致：walk 为可站立区，col 为墙/障碍；free = 在 walk 内且不在 col 内。
const int MAX_RECT = 1024;
float g_walk[MAX_RECT][4];
float g_col[MAX_RECT][4];
int   g_nWalk = 0, g_nCol = 0;
float g_pr = 0.22f;          // 人体半径

int freeAt(float x, float z) {
  int ok = 0;
  for (int i = 0; i < g_nWalk; ++i) {
    const float *w = g_walk[i];
    if (x >= w[0] - 0.22f && x <= w[2] + 0.22f &&
        z >= w[1] - 0.22f && z <= w[3] + 0.22f) { ok = 1; break; }
  }
  if (!ok) return 0;
  for (int i = 0; i < g_nCol; ++i) {
    const float *c = g_col[i];
    if (x > c[0] - g_pr && x < c[2] + g_pr &&
        z > c[1] - g_pr && z < c[3] + g_pr) return 0;
  }
  return 1;
}

// 线段与轴对齐盒求交，返回进入参数 t∈[0,1]，不挡返回 -1
float segBoxT(float x0, float z0, float x1, float z1, const float c[4], float pad) {
  float dx = x1 - x0, dz = z1 - z0, t0 = 0.0f, t1 = 1.0f;
  float minX = c[0] - pad, maxX = c[2] + pad;
  if (std::fabs(dx) < 1e-9f) {
    if (x0 <= minX || x0 >= maxX) return -1.0f;
  } else {
    float a = (minX - x0) / dx, b = (maxX - x0) / dx;
    if (a > b) { float s = a; a = b; b = s; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return -1.0f;
  }
  float minZ = c[1] - pad, maxZ = c[3] + pad;
  if (std::fabs(dz) < 1e-9f) {
    if (z0 <= minZ || z0 >= maxZ) return -1.0f;
  } else {
    float a = (minZ - z0) / dz, b = (maxZ - z0) / dz;
    if (a > b) { float s = a; a = b; b = s; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return -1.0f;
  }
  if (t1 <= 0.0001f || t0 >= 0.9999f) return -1.0f;
  return t0;
}

int shotBlockedAt(float x0, float z0, float x1, float z1) {
  for (int i = 0; i < g_nCol; ++i) {
    if (segBoxT(x0, z0, x1, z1, g_col[i], 0.015f) >= 0.0f) return 1;
  }
  return 0;
}

float rayWallDistAt(float x0, float z0, float dx, float dz, float maxLen) {
  float x1 = x0 + dx * maxLen, z1 = z0 + dz * maxLen, best = maxLen;
  for (int i = 0; i < g_nCol; ++i) {
    float t = segBoxT(x0, z0, x1, z1, g_col[i], 0.015f);
    if (t >= 0.0f && t * maxLen < best) best = t * maxLen;
  }
  return best;
}

// ---------- 任务 / NPC 靶子（旧接口，保留兼容） ----------
const int MAX_TARGETS = 8;
int   g_missionActive = 0, g_missionType = 0;
int   g_missionDone = 0, g_missionFailed = 0;
int   g_targetTotal = 0, g_targetHit = 0, g_sequencePos = 0;
float g_missionTime = 0.0f, g_missionLimit = 0.0f;
int   g_targetAlive[MAX_TARGETS], g_targetHp[MAX_TARGETS], g_targetKind[MAX_TARGETS];
float g_targetX[MAX_TARGETS], g_targetZ[MAX_TARGETS];
float g_targetBaseX[MAX_TARGETS], g_targetBaseZ[MAX_TARGETS], g_targetPhase[MAX_TARGETS];

// ---------- 任务 2.0：页面实际使用的五类任务 ----------
// type 1=清场 2=限时 3=顺序 4=移动靶 5=爆头
const int M2_MAX = 8;
int   g_m2On = 0, g_m2Done = 0, g_m2Failed = 0;
int   g_m2Type = 0, g_m2Total = 0, g_m2HitCount = 0, g_m2Seq = 0;
int   g_m2Move = 0, g_m2Order = 0, g_m2Head = 0;
float g_m2Time = 0.0f, g_m2Limit = 0.0f;
int   g_m2Alive[M2_MAX];
int   g_m2Kind[M2_MAX];
float g_m2X[M2_MAX], g_m2Z[M2_MAX], g_m2BaseX[M2_MAX], g_m2BaseZ[M2_MAX];
float g_m2Phase[M2_MAX], g_m2Speed[M2_MAX];

// ---------- 僵尸波次 AI ----------
// 每波固定的数量/伤害/速度/身体枪数/颜色；超过 5 波按公式外推。
const int Z_WAVE_N = 5;
const int   Z_COUNT[Z_WAVE_N] = { 4, 5, 6, 7, 8 };
const float Z_DMG[Z_WAVE_N]   = { 8.0f, 12.0f, 16.0f, 20.0f, 24.0f };
const float Z_SPEED[Z_WAVE_N] = { 0.72f, 0.88f, 1.02f, 1.16f, 1.30f };
const int   Z_HP[Z_WAVE_N]    = { 1, 1, 2, 2, 3 };
const int   Z_COLOR[Z_WAVE_N] = { 0x6f8f5a, 0x9a9a4a, 0xc98a3c, 0xc2553a, 0x9b3bb5 };

const int MAX_ZOMBIES = 32;
struct Zombie {
  float x, z, hp, dmg, speed, atkT, detour, detourDir, deadT, flash;
  int alive, removed;
};
Zombie g_z[MAX_ZOMBIES];
int   g_zUsed = 0;          // slot 只增不减（除非 reset），保证 JS 模型按 id 对齐
int   g_zOn = 0, g_zWave = 1, g_zKilled = 0;
float g_zBreak = 0.0f, g_zPlayerHp = 100.0f;
int   g_zEvents = 0;        // bit1=需要生成下一波 bit2=波清空 bit4=受击 bit8=玩家死亡

int waveIndex(int n) { return std::min(std::max(n, 1), Z_WAVE_N) - 1; }

int zombieCanStep(float x, float z, int idx) {
  if (!freeAt(x, z)) return 0;
  for (int i = 0; i < g_zUsed; ++i) {
    if (i == idx || !g_z[i].alive) continue;
    float dx = x - g_z[i].x, dz = z - g_z[i].z;
    if (dx * dx + dz * dz < 0.52f * 0.52f) return 0;
  }
  return 1;
}

} // namespace

extern "C" void core_init_world(void);   // 前置声明（core_init 中调用）

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
  core_init_world();
}

// ---------------- 地图碰撞 ----------------
EMSCRIPTEN_KEEPALIVE void core_init_world() {
  g_nWalk = 0; g_nCol = 0;
  g_zUsed = 0; g_zOn = 0; g_zWave = 1; g_zKilled = 0;
  g_zBreak = 0.0f; g_zPlayerHp = 100.0f; g_zEvents = 0;
}
EMSCRIPTEN_KEEPALIVE void core_set_pr(float pr) { g_pr = pr > 0.0f ? pr : 0.22f; }
EMSCRIPTEN_KEEPALIVE void core_add_walk(float x1, float z1, float x2, float z2) {
  if (g_nWalk >= MAX_RECT) return;
  g_walk[g_nWalk][0] = x1; g_walk[g_nWalk][1] = z1;
  g_walk[g_nWalk][2] = x2; g_walk[g_nWalk][3] = z2;
  ++g_nWalk;
}
EMSCRIPTEN_KEEPALIVE void core_add_col(float x1, float z1, float x2, float z2) {
  if (g_nCol >= MAX_RECT) return;
  g_col[g_nCol][0] = x1; g_col[g_nCol][1] = z1;
  g_col[g_nCol][2] = x2; g_col[g_nCol][3] = z2;
  ++g_nCol;
}
EMSCRIPTEN_KEEPALIVE int   core_world_walk_count() { return g_nWalk; }
EMSCRIPTEN_KEEPALIVE int   core_world_col_count()  { return g_nCol; }
EMSCRIPTEN_KEEPALIVE int   core_free(float x, float z) { return freeAt(x, z); }
EMSCRIPTEN_KEEPALIVE int   core_shot_blocked(float x0, float z0, float x1, float z1) {
  return shotBlockedAt(x0, z0, x1, z1);
}
EMSCRIPTEN_KEEPALIVE float core_ray_wall_dist(float x0, float z0, float dx, float dz, float maxLen) {
  return rayWallDistAt(x0, z0, dx, dz, maxLen);
}

// ---------------- 玩家：蹲 / 跳 / 位移 ----------------
EMSCRIPTEN_KEEPALIVE void core_reset_player(float x, float z) {
  (void)x; (void)z;   // 位置由 JS 侧地图决定，这里只重置姿态
  g_crouch = 0.0f; g_jumpZ = 0.0f; g_jumpV = 0.0f;
  g_onGround = 1; g_crouchHeld = 0;
}
EMSCRIPTEN_KEEPALIVE void core_set_crouch(int on) { g_crouchHeld = on ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE void core_jump() {
  if (g_onGround) { g_jumpV = JUMP_IMPULSE; g_onGround = 0; }
}
// 每帧推进玩家状态，返回本帧"期望位移"由 JS 做碰撞检测后落地
EMSCRIPTEN_KEEPALIVE void core_step_player(float dt, float forward, float strafe, int run, float yaw) {
  dt = clampf(dt, 0.0f, MAX_DT);
  float target = g_crouchHeld ? 1.0f : 0.0f;
  float k = 1.0f - std::exp(-dt * 12.0f);
  g_crouch += (target - g_crouch) * k;
  if (std::fabs(g_crouch - target) < 0.001f) g_crouch = target;

  if (!g_onGround) {
    g_jumpZ += g_jumpV * dt;
    g_jumpV -= GRAVITY * dt;
    if (g_jumpZ <= 0.0f) { g_jumpZ = 0.0f; g_jumpV = 0.0f; g_onGround = 1; }
  }

  float len = std::sqrt(forward * forward + strafe * strafe);
  if (len > 0.0001f) {
    float speed = g_crouchHeld ? CROUCH_SPEED : (run ? RUN_SPEED : WALK_SPEED);
    float stepLen = speed * dt / len;
    float fx = std::sin(yaw), fz = -std::cos(yaw);
    float rx = -fz, rz = fx;
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
  g_reloading = 0; g_reloadLeft = 0.0f; g_fireCooldown = 0.0f;
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
// 开火：1=成功击发, 0=冷却中/换弹中, -1=空仓
EMSCRIPTEN_KEEPALIVE int core_fire() {
  if (!validGun(g_weapon) || g_reloading || g_fireCooldown > 0.0f) return 0;
  if (g_mag[g_weapon] <= 0) return -1;
  g_mag[g_weapon]--;
  g_fireCooldown = FIRE_DELAY[g_weapon];
  return 1;
}
EMSCRIPTEN_KEEPALIVE void core_press_trigger() { g_triggerHeld = 1; }
EMSCRIPTEN_KEEPALIVE void core_release_trigger() { g_triggerHeld = 0; }
EMSCRIPTEN_KEEPALIVE int core_reload() {
  if (!validGun(g_weapon) || g_reloading) return 0;
  if (g_mag[g_weapon] >= MAG_CAP[g_weapon] || g_reserve[g_weapon] <= 0) return 0;
  g_reloading = 1; g_reloadWeapon = g_weapon; g_reloadLeft = RELOAD_SEC[g_weapon];
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

// ---------------- 任务 / NPC 靶子（旧接口，保留兼容） ----------------
EMSCRIPTEN_KEEPALIVE void core_mission_start(int type, int count, float limit) {
  if (type < 1 || type > 3) type = 1;
  if (count < 1) count = 1;
  if (count > MAX_TARGETS) count = MAX_TARGETS;
  g_missionType = type; g_targetTotal = count;
  g_targetHit = 0; g_sequencePos = 0;
  g_missionTime = 0.0f; g_missionLimit = limit > 0.0f ? limit : 0.0f;
  g_missionActive = 1; g_missionDone = 0; g_missionFailed = 0;
  for (int i = 0; i < MAX_TARGETS; ++i) {
    g_targetAlive[i] = i < count ? 1 : 0;
    g_targetHp[i] = (type == 1) ? 2 : 1;
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
EMSCRIPTEN_KEEPALIVE int core_target_hit(int id) {
  if (!g_missionActive || id < 0 || id >= MAX_TARGETS || !g_targetAlive[id]) return 0;
  if (g_missionType == 3 && id != g_sequencePos) { g_missionActive = 0; g_missionFailed = 1; return -1; }
  g_targetHp[id]--;
  if (g_targetHp[id] <= 0) {
    g_targetAlive[id] = 0; g_targetHit++;
    if (g_missionType == 3) g_sequencePos++;
  }
  if (g_targetHit >= g_targetTotal) { g_missionActive = 0; g_missionDone = 1; }
  return 1;
}
EMSCRIPTEN_KEEPALIVE void core_mission_update(float dt) {
  if (!g_missionActive) return;
  dt = clampf(dt, 0.0f, MAX_DT);
  g_missionTime += dt;
  if (g_missionLimit > 0.0f && g_missionTime >= g_missionLimit) {
    g_missionActive = 0; g_missionFailed = 1; return;
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

// ---------------- 任务 2.0（页面主路径） ----------------
EMSCRIPTEN_KEEPALIVE void core_m2_start(int type, int count, float limit, int move, int order, int head) {
  if (type < 1 || type > 5) type = 1;
  if (count < 1) count = 1;
  if (count > M2_MAX) count = M2_MAX;
  g_m2Type = type; g_m2Total = count; g_m2HitCount = 0; g_m2Seq = 0;
  g_m2Move = move ? 1 : 0; g_m2Order = order ? 1 : 0; g_m2Head = head ? 1 : 0;
  g_m2Time = 0.0f; g_m2Limit = limit > 0.0f ? limit : 0.0f;
  g_m2On = 1; g_m2Done = 0; g_m2Failed = 0;
  for (int i = 0; i < M2_MAX; ++i) {
    g_m2Alive[i] = i < count ? 1 : 0;
    g_m2Kind[i] = i % 5;
    g_m2X[i] = 0.0f; g_m2Z[i] = 0.0f;
    g_m2BaseX[i] = 0.0f; g_m2BaseZ[i] = 0.0f;
    g_m2Phase[i] = i * 1.7f; g_m2Speed[i] = 0.75f + i * 0.18f;
  }
}
EMSCRIPTEN_KEEPALIVE void core_m2_set_target(int id, float x, float z, int kind, float phase, float speed) {
  if (id < 0 || id >= M2_MAX) return;
  g_m2X[id] = x; g_m2Z[id] = z;
  g_m2BaseX[id] = x; g_m2BaseZ[id] = z;
  g_m2Kind[id] = kind; g_m2Phase[id] = phase; g_m2Speed[id] = speed;
}
EMSCRIPTEN_KEEPALIVE void core_m2_step(float dt) {
  if (!g_m2On) return;
  dt = clampf(dt, 0.0f, MAX_DT);
  g_m2Time += dt;
  if (g_m2Limit > 0.0f && g_m2Time >= g_m2Limit) {
    g_m2On = 0; g_m2Failed = 1; return;
  }
  if (g_m2Move) {
    for (int i = 0; i < g_m2Total; ++i) {
      if (!g_m2Alive[i]) continue;
      float a = g_m2Time * g_m2Speed[i] + g_m2Phase[i];
      g_m2X[i] = g_m2BaseX[i] + std::sin(a) * 0.85f;
      g_m2Z[i] = g_m2BaseZ[i] + std::cos(a * 0.7f) * 0.35f;
    }
  }
}
// 1=有效命中, 0=无效（含爆头高度不够）, -1=顺序错
EMSCRIPTEN_KEEPALIVE int core_m2_hit(int id, int headShot) {
  if (!g_m2On || id < 0 || id >= M2_MAX || !g_m2Alive[id]) return 0;
  if (g_m2Order && id != g_m2Seq) return -1;
  if (g_m2Head && !headShot) return 0;
  g_m2Alive[id] = 0; g_m2HitCount++;
  if (g_m2Order) g_m2Seq++;
  if (g_m2HitCount >= g_m2Total) { g_m2On = 0; g_m2Done = 1; }
  return 1;
}
EMSCRIPTEN_KEEPALIVE int core_m2_active() { return g_m2On; }
EMSCRIPTEN_KEEPALIVE int core_m2_done() { return g_m2Done; }
EMSCRIPTEN_KEEPALIVE int core_m2_failed() { return g_m2Failed; }
EMSCRIPTEN_KEEPALIVE int core_m2_hit_count() { return g_m2HitCount; }
EMSCRIPTEN_KEEPALIVE int core_m2_total() { return g_m2Total; }
EMSCRIPTEN_KEEPALIVE int core_m2_seq() { return g_m2Seq; }
EMSCRIPTEN_KEEPALIVE int core_m2_type() { return g_m2Type; }
EMSCRIPTEN_KEEPALIVE float core_m2_time() { return g_m2Time; }
EMSCRIPTEN_KEEPALIVE float core_m2_time_left() { return g_m2Limit > 0.0f ? (g_m2Limit - g_m2Time) : 0.0f; }
EMSCRIPTEN_KEEPALIVE int core_m2_target_alive(int id) { return id >= 0 && id < M2_MAX ? g_m2Alive[id] : 0; }
EMSCRIPTEN_KEEPALIVE int core_m2_target_kind(int id) { return id >= 0 && id < M2_MAX ? g_m2Kind[id] : 0; }
EMSCRIPTEN_KEEPALIVE float core_m2_target_x(int id) { return id >= 0 && id < M2_MAX ? g_m2X[id] : 0.0f; }
EMSCRIPTEN_KEEPALIVE float core_m2_target_z(int id) { return id >= 0 && id < M2_MAX ? g_m2Z[id] : 0.0f; }

// ---------------- 僵尸波次 AI（页面主路径） ----------------
EMSCRIPTEN_KEEPALIVE void core_z_reset() {
  std::memset(g_z, 0, sizeof(g_z));
  g_zUsed = 0; g_zOn = 1; g_zWave = 1; g_zKilled = 0;
  g_zBreak = 0.0f; g_zPlayerHp = 100.0f; g_zEvents = 0;
}
EMSCRIPTEN_KEEPALIVE void core_z_stop() { g_zOn = 0; g_zEvents = 0; }
EMSCRIPTEN_KEEPALIVE int core_z_wave_count(int n) {
  int i = waveIndex(n), ex = std::max(0, n - Z_WAVE_N);
  int c = Z_COUNT[i] + ex; return c < 10 ? c : 10;
}
EMSCRIPTEN_KEEPALIVE float core_z_wave_dmg(int n) {
  int i = waveIndex(n), ex = std::max(0, n - Z_WAVE_N);
  return Z_DMG[i] + ex * 4.0f;
}
EMSCRIPTEN_KEEPALIVE float core_z_wave_speed(int n) {
  int i = waveIndex(n), ex = std::max(0, n - Z_WAVE_N);
  float s = Z_SPEED[i] + ex * 0.05f; return s < 1.6f ? s : 1.6f;
}
EMSCRIPTEN_KEEPALIVE int core_z_wave_hp(int n) {
  int i = waveIndex(n), ex = std::max(0, n - Z_WAVE_N);
  return Z_HP[i] + ex / 2;
}
EMSCRIPTEN_KEEPALIVE int core_z_wave_color(int n) { return Z_COLOR[waveIndex(n)]; }

EMSCRIPTEN_KEEPALIVE int core_z_add(float x, float z, int hp, float dmg, float speed) {
  if (g_zUsed >= MAX_ZOMBIES) return -1;
  Zombie &b = g_z[g_zUsed];
  b.x = x; b.z = z; b.hp = (float)hp; b.dmg = dmg; b.speed = speed;
  b.atkT = 0.0f; b.detour = 0.0f; b.detourDir = 1.0f;
  b.deadT = 0.0f; b.flash = 0.0f; b.alive = 1; b.removed = 0;
  return g_zUsed++;
}

// 推进全部僵尸：追击 / 绕墙 / 抓人扣血 / 波次推进，事件由 core_z_events 读取
EMSCRIPTEN_KEEPALIVE void core_z_step(float dt, float px, float pz, float atkRange) {
  dt = clampf(dt, 0.0f, MAX_DT);
  g_zEvents = 0;
  if (!g_zOn) return;

  if (g_zBreak > 0.0f) {
    g_zBreak -= dt;
    if (g_zBreak <= 0.0f) { g_zBreak = 0.0f; g_zWave++; g_zEvents |= 1; }
    return;
  }
  int aliveLeft = 0;
  for (int i = 0; i < g_zUsed; ++i) if (g_z[i].alive) aliveLeft++;
  if (g_zUsed > 0 && aliveLeft == 0) {
    g_zBreak = 2.5f;
    g_zPlayerHp = std::min(100.0f, g_zPlayerHp + 15.0f);
    g_zEvents |= 2;
    return;
  }

  for (int i = 0; i < g_zUsed; ++i) {
    Zombie &z = g_z[i];
    if (!z.alive) {
      z.deadT += dt;
      if (z.deadT > 2.2f) z.removed = 1;
      continue;
    }
    if (z.flash > 0.0f) { z.flash -= dt; if (z.flash < 0.0f) z.flash = 0.0f; }

    float dx = px - z.x, dz = pz - z.z;
    float dist = std::sqrt(dx * dx + dz * dz);
    if (dist < 1e-6f) dist = 1e-6f;

    if (dist > atkRange) {
      float ux = dx / dist, uz = dz / dist, sp = z.speed * dt;
      int moved = 0;
      /* 分轴滑动：撞墙沿墙溜，和玩家同款碰撞，绝不穿进墙 */
      if (zombieCanStep(z.x + ux * sp, z.z, i)) { z.x += ux * sp; moved = 1; }
      if (zombieCanStep(z.x, z.z + uz * sp, i)) { z.z += uz * sp; moved = 1; }
      if (!moved) {
        /* 卡墙时朝一侧连续绕行一段时间，单步侧移会被拉回震荡 */
        if (z.detour <= 0.0f) {
          z.detour = 0.8f + (float)(i % 7) * 0.07f;
          z.detourDir = (i % 2) ? 1.0f : -1.0f;
        }
        z.detour -= dt;
        float sx = z.x - uz * sp * z.detourDir, sz = z.z + ux * sp * z.detourDir;
        if (zombieCanStep(sx, z.z, i)) z.x = sx;
        else if (zombieCanStep(z.x, sz, i)) z.z = sz;
        else z.detour = 0.0f;
      }
    } else {
      z.atkT -= dt;
      if (z.atkT <= 0.0f) {
        float cd = 1.35f - 0.08f * (float)g_zWave;
        if (cd < 0.55f) cd = 0.55f;
        z.atkT = cd;
        g_zPlayerHp -= z.dmg;
        g_zEvents |= 4;
        if (g_zPlayerHp <= 0.0f) {
          g_zPlayerHp = 0.0f; g_zOn = 0; g_zEvents |= 8; return;
        }
      }
    }
  }
}

// 命中结算：2=击倒, 1=命中未死, 0=无效
EMSCRIPTEN_KEEPALIVE int core_z_hit(int id, int headShot) {
  if (id < 0 || id >= g_zUsed) return 0;
  Zombie &z = g_z[id];
  if (!z.alive || z.removed) return 0;
  z.flash = 0.12f;
  if (headShot) z.hp = 0.0f; else z.hp -= 1.0f;
  if (z.hp <= 0.0f) { z.alive = 0; g_zKilled++; return 2; }
  return 1;
}

EMSCRIPTEN_KEEPALIVE int   core_z_on() { return g_zOn; }
EMSCRIPTEN_KEEPALIVE int   core_z_wave() { return g_zWave; }
EMSCRIPTEN_KEEPALIVE float core_z_break() { return g_zBreak; }
EMSCRIPTEN_KEEPALIVE int   core_z_killed() { return g_zKilled; }
EMSCRIPTEN_KEEPALIVE float core_z_player_hp() { return g_zPlayerHp; }
EMSCRIPTEN_KEEPALIVE int   core_z_events() { return g_zEvents; }
EMSCRIPTEN_KEEPALIVE int   core_z_used() { return g_zUsed; }
EMSCRIPTEN_KEEPALIVE float core_z_x(int id) { return id >= 0 && id < g_zUsed ? g_z[id].x : 0.0f; }
EMSCRIPTEN_KEEPALIVE float core_z_z(int id) { return id >= 0 && id < g_zUsed ? g_z[id].z : 0.0f; }
EMSCRIPTEN_KEEPALIVE int   core_z_alive(int id) { return id >= 0 && id < g_zUsed ? g_z[id].alive : 0; }
EMSCRIPTEN_KEEPALIVE int   core_z_removed(int id) { return id >= 0 && id < g_zUsed ? g_z[id].removed : 0; }
EMSCRIPTEN_KEEPALIVE int   core_z_hp(int id) { return id >= 0 && id < g_zUsed ? (int)g_z[id].hp : 0; }
EMSCRIPTEN_KEEPALIVE float core_z_flash(int id) { return id >= 0 && id < g_zUsed ? g_z[id].flash : 0.0f; }
EMSCRIPTEN_KEEPALIVE float core_z_yaw(int id, float px, float pz) {
  if (id < 0 || id >= g_zUsed) return 0.0f;
  return std::atan2(g_z[id].x - px, g_z[id].z - pz);
}

} // extern "C"
