/* game_core_bridge.js —— 把 C++/WASM 核心包装成页面可直接调用的 JS API
   来源：wasm/game_core.cpp（Emscripten 编译，SINGLE_FILE 内嵌 wasm，file:// 可直接加载） */
(function () {
  'use strict';

  var api = { ready: false, mod: null, fns: {} };
  var SIGNATURES = {
    core_init:             [null, []],
    core_reset_player:     [null, ['number', 'number']],
    core_set_crouch:       [null, ['number']],
    core_jump:             [null, []],
    core_step_player:      [null, ['number', 'number', 'number', 'number', 'number']],
    core_last_dx:          ['number', []],
    core_last_dz:          ['number', []],
    core_player_eye:       ['number', []],
    core_player_crouch:    ['number', []],
    core_player_jump:      ['number', []],
    core_player_ground:    ['number', []],
    core_set_weapon:       ['number', ['number']],
    core_get_weapon:       ['number', []],
    core_get_mode:         ['number', []],
    core_set_mode:         ['number', ['number']],
    core_toggle_mode:      ['number', []],
    core_can_auto:         ['number', ['number']],
    core_fire_delay:       ['number', ['number']],
    core_ammo_mag:         ['number', []],
    core_ammo_reserve:     ['number', []],
    core_ammo_capacity:    ['number', []],
    core_reloading:        ['number', []],
    core_reload_duration:  ['number', []],
    core_fire:             ['number', []],
    core_press_trigger:    [null, []],
    core_release_trigger:  [null, []],
    core_reload:           ['number', []],
    core_step_weapon:      ['number', ['number']],
    core_mission_start:    [null, ['number', 'number', 'number']],
    core_target_set_pos:   [null, ['number', 'number', 'number']],
    core_target_hit:       ['number', ['number']],
    core_mission_update:   [null, ['number']],
    core_mission_active:   ['number', []],
    core_mission_type:     ['number', []],
    core_mission_done:     ['number', []],
    core_mission_failed:   ['number', []],
    core_mission_hit:      ['number', []],
    core_mission_total:    ['number', []],
    core_mission_time:     ['number', []],
    core_mission_time_left:['number', []],
    core_target_alive:     ['number', ['number']],
    core_target_hp:        ['number', ['number']],
    core_target_kind:      ['number', ['number']],
    core_target_x:         ['number', ['number']],
    core_target_z:         ['number', ['number']]
  };

  api.init = function () {
    if (api.ready) return Promise.resolve(api);
    if (typeof GameCoreFactory !== 'function') {
      return Promise.reject(new Error('GameCoreFactory 未加载：缺少 wasm/game_core.js'));
    }
    return GameCoreFactory().then(function (mod) {
      api.mod = mod;
      for (var name in SIGNATURES) {
        if (!SIGNATURES.hasOwnProperty(name)) continue;
        api.fns[name] = mod.cwrap(name, SIGNATURES[name][0], SIGNATURES[name][1]);
      }
      api.fns.core_init();
      api.ready = true;
      return api;
    });
  };

  /* ---------- 玩家 ---------- */
  api.resetPlayer = function () { if (api.ready) api.fns.core_reset_player(0, 0); };
  api.setCrouch = function (on) { if (api.ready) api.fns.core_set_crouch(on ? 1 : 0); };
  api.jump = function () { if (api.ready) api.fns.core_jump(); };
  api.stepPlayer = function (dt, f, s, run, yaw) {
    if (!api.ready) return null;
    api.fns.core_step_player(dt, f, s, run ? 1 : 0, yaw);
    return {
      dx: api.fns.core_last_dx(), dz: api.fns.core_last_dz(),
      crouch: api.fns.core_player_crouch(), jumpZ: api.fns.core_player_jump(),
      onGround: !!api.fns.core_player_ground(), eye: api.fns.core_player_eye()
    };
  };
  api.getPlayer = function () {
    if (!api.ready) return null;
    return {
      crouch: api.fns.core_player_crouch(), jumpZ: api.fns.core_player_jump(),
      onGround: !!api.fns.core_player_ground(), eye: api.fns.core_player_eye()
    };
  };

  /* ---------- 武器 ---------- */
  api.setWeapon = function (id) { return api.ready ? !!api.fns.core_set_weapon(id) : false; };
  api.getWeapon = function () { return api.ready ? api.fns.core_get_weapon() : -1; };
  api.getMode = function () { return api.ready && api.fns.core_get_mode() ? 'auto' : 'semi'; };
  api.setMode = function (mode) { return api.ready && api.fns.core_set_mode(mode === 'auto' ? 1 : 0) ? 'auto' : 'semi'; };
  api.toggleMode = function () { return api.ready && api.fns.core_toggle_mode() ? 'auto' : 'semi'; };
  api.canAuto = function (id) { return api.ready && !!api.fns.core_can_auto(id); };
  api.fireDelay = function (id) { return api.ready ? api.fns.core_fire_delay(id) : 0; };
  api.fire = function () { return api.ready ? api.fns.core_fire() : 0; };          // 1 击发 / 0 等待 / -1 空仓
  api.pressTrigger = function () { if (api.ready) api.fns.core_press_trigger(); };
  api.releaseTrigger = function () { if (api.ready) api.fns.core_release_trigger(); };
  api.reload = function () { return api.ready && !!api.fns.core_reload(); };
  api.stepWeapon = function (dt) { return api.ready ? api.fns.core_step_weapon(dt) : 0; };
  api.getAmmo = function () {
    if (!api.ready) return null;
    return {
      mag: api.fns.core_ammo_mag(), reserve: api.fns.core_ammo_reserve(),
      capacity: api.fns.core_ammo_capacity(), reloading: !!api.fns.core_reloading()
    };
  };
  api.reloadDuration = function () { return api.ready ? api.fns.core_reload_duration() : 0; };

  /* ---------- 任务 / NPC 靶子 ---------- */
  api.startMission = function (type, count, limit) {
    if (api.ready) api.fns.core_mission_start(type, count, limit || 0);
  };
  api.setTargetPos = function (id, x, z) {
    if (api.ready) api.fns.core_target_set_pos(id, x, z);
  };
  api.hitTarget = function (id) { return api.ready ? api.fns.core_target_hit(id) : 0; };
  api.stepMission = function (dt) { if (api.ready) api.fns.core_mission_update(dt); };
  api.missionState = function () {
    if (!api.ready) return null;
    return {
      active: !!api.fns.core_mission_active(), type: api.fns.core_mission_type(),
      done: !!api.fns.core_mission_done(), failed: !!api.fns.core_mission_failed(),
      hit: api.fns.core_mission_hit(), total: api.fns.core_mission_total(),
      time: api.fns.core_mission_time(), timeLeft: api.fns.core_mission_time_left()
    };
  };
  api.getTarget = function (id) {
    if (!api.ready) return null;
    return {
      alive: !!api.fns.core_target_alive(id), hp: api.fns.core_target_hp(id),
      kind: api.fns.core_target_kind(id),
      x: api.fns.core_target_x(id), z: api.fns.core_target_z(id)
    };
  };

  window.__GAME_CORE__ = api;
  return api;
})();
