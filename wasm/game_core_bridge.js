/* game_core_bridge.js —— 把 C++/WASM 核心包装成页面可直接调用的 JS API
   来源：wasm/game_core.cpp（Emscripten 编译，SINGLE_FILE 内嵌 wasm，file:// 可直接加载）
   JS 这里只做参数打包/解包，不含游戏规则。 */
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
    core_target_z:         ['number', ['number']],

    /* 地图碰撞 / 射线遮挡 */
    core_init_world:       [null, []],
    core_set_pr:           [null, ['number']],
    core_add_walk:         [null, ['number', 'number', 'number', 'number']],
    core_add_col:          [null, ['number', 'number', 'number', 'number']],
    core_world_walk_count: ['number', []],
    core_world_col_count:  ['number', []],
    core_free:             ['number', ['number', 'number']],
    core_shot_blocked:     ['number', ['number', 'number', 'number', 'number']],
    core_ray_wall_dist:    ['number', ['number', 'number', 'number', 'number']],

    /* 楼层数据（C++ 持有；JS data/floor-*.js 只是运行时镜像） */
    core_floor_count:      ['number', []],
    core_floor_id:         ['string', ['number']],
    core_floor_file:       ['string', ['number']],
    core_floor_script:     ['string', ['number']],

    /* 任务 2.0 */
    core_m2_start:         [null, ['number', 'number', 'number', 'number', 'number', 'number']],
    core_m2_set_target:    [null, ['number', 'number', 'number', 'number', 'number', 'number']],
    core_m2_step:          [null, ['number']],
    core_m2_hit:           ['number', ['number', 'number']],
    core_m2_active:        ['number', []],
    core_m2_done:          ['number', []],
    core_m2_failed:        ['number', []],
    core_m2_hit_count:     ['number', []],
    core_m2_total:         ['number', []],
    core_m2_seq:           ['number', []],
    core_m2_type:          ['number', []],
    core_m2_time:          ['number', []],
    core_m2_time_left:     ['number', []],
    core_m2_target_alive:  ['number', ['number']],
    core_m2_target_kind:   ['number', ['number']],
    core_m2_target_x:      ['number', ['number']],
    core_m2_target_z:      ['number', ['number']],

    /* 僵尸波次 AI */
    core_z_reset:          [null, []],
    core_z_stop:           [null, []],
    core_z_wave_count:     ['number', ['number']],
    core_z_wave_dmg:       ['number', ['number']],
    core_z_wave_speed:     ['number', ['number']],
    core_z_wave_hp:        ['number', ['number']],
    core_z_wave_color:     ['number', ['number']],
    core_z_add:            ['number', ['number', 'number', 'number', 'number', 'number']],
    core_z_step:           [null, ['number', 'number', 'number', 'number']],
    core_z_hit:            ['number', ['number', 'number']],
    core_z_on:             ['number', []],
    core_z_wave:           ['number', []],
    core_z_break:          ['number', []],
    core_z_killed:         ['number', []],
    core_z_player_hp:      ['number', []],
    core_z_events:         ['number', []],
    core_z_used:           ['number', []],
    core_z_x:              ['number', ['number']],
    core_z_z:              ['number', ['number']],
    core_z_alive:          ['number', ['number']],
    core_z_removed:        ['number', ['number']],
    core_z_hp:             ['number', ['number']],
    core_z_flash:          ['number', ['number']],
    core_z_yaw:            ['number', ['number', 'number', 'number']]
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

  /* ---------- 地图：切层后由页面上传本层可走区与墙盒 ---------- */
  api.beginWorld = function (pr) {
    if (!api.ready) return;
    api.fns.core_init_world();
    api.fns.core_set_pr(pr || 0.22);
  };
  api.addWalk = function (x1, z1, x2, z2) {
    if (api.ready) api.fns.core_add_walk(x1, z1, x2, z2);
  };
  api.addCol = function (x1, z1, x2, z2) {
    if (api.ready) api.fns.core_add_col(x1, z1, x2, z2);
  };
  api.worldCounts = function () {
    if (!api.ready) return null;
    return { walk: api.fns.core_world_walk_count(), col: api.fns.core_world_col_count() };
  };
  /* null = 核心未就绪，调用方应走 JS 兜底 */
  api.free = function (x, z) {
    return api.ready ? !!api.fns.core_free(x, z) : null;
  };
  api.shotBlocked = function (x0, z0, x1, z1) {
    return api.ready ? !!api.fns.core_shot_blocked(x0, z0, x1, z1) : null;
  };
  api.rayWallDist = function (x0, z0, dx, dz, maxLen) {
    return api.ready ? api.fns.core_ray_wall_dist(x0, z0, dx, dz, maxLen) : null;
  };

  /* ---------- 楼层数据（C++ 唯一源） ---------- */
  api.floorCount = function () { return api.ready ? api.fns.core_floor_count() : 0; };
  api.floorAt = function (i) {
    if (!api.ready) return null;
    return { id: api.fns.core_floor_id(i), file: api.fns.core_floor_file(i),
             script: api.fns.core_floor_script(i) };
  };
  /* 从 C++ 取回全部楼层脚本，页面可据此重建 FLOORS（线上无 data/ 目录时用） */
  api.floorRegistry = function () {
    var out = {};
    if (!api.ready) return out;
    for (var i = 0; i < api.fns.core_floor_count(); i++) {
      out[api.fns.core_floor_id(i)] = api.fns.core_floor_script(i);
    }
    return out;
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
  api.fire = function () { return api.ready ? api.fns.core_fire() : 0; };
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

  /* ---------- 任务（旧接口，保留） ---------- */
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

  /* ---------- 任务 2.0（页面主路径） ---------- */
  api.m2Start = function (type, count, limit, move, order, head) {
    if (api.ready) api.fns.core_m2_start(type, count, limit || 0, move ? 1 : 0, order ? 1 : 0, head ? 1 : 0);
  };
  api.m2SetTarget = function (id, x, z, kind, phase, speed) {
    if (api.ready) api.fns.core_m2_set_target(id, x, z, kind, phase, speed);
  };
  api.m2Step = function (dt) { if (api.ready) api.fns.core_m2_step(dt); };
  api.m2Hit = function (id, headShot) { return api.ready ? api.fns.core_m2_hit(id, headShot ? 1 : 0) : 0; };
  api.m2State = function () {
    if (!api.ready) return null;
    return {
      active: !!api.fns.core_m2_active(), done: !!api.fns.core_m2_done(),
      failed: !!api.fns.core_m2_failed(), hit: api.fns.core_m2_hit_count(),
      total: api.fns.core_m2_total(), seq: api.fns.core_m2_seq(),
      type: api.fns.core_m2_type(), time: api.fns.core_m2_time(),
      timeLeft: api.fns.core_m2_time_left()
    };
  };
  api.m2Target = function (id) {
    if (!api.ready) return null;
    return {
      alive: !!api.fns.core_m2_target_alive(id), kind: api.fns.core_m2_target_kind(id),
      x: api.fns.core_m2_target_x(id), z: api.fns.core_m2_target_z(id)
    };
  };

  /* ---------- 僵尸波次 AI（页面主路径） ---------- */
  api.zReset = function () { if (api.ready) api.fns.core_z_reset(); };
  api.zStop = function () { if (api.ready) api.fns.core_z_stop(); };
  api.zWaveCount = function (n) { return api.ready ? api.fns.core_z_wave_count(n) : 0; };
  api.zWaveDmg = function (n) { return api.ready ? api.fns.core_z_wave_dmg(n) : 0; };
  api.zWaveSpeed = function (n) { return api.ready ? api.fns.core_z_wave_speed(n) : 0; };
  api.zWaveHp = function (n) { return api.ready ? api.fns.core_z_wave_hp(n) : 0; };
  api.zWaveColor = function (n) { return api.ready ? api.fns.core_z_wave_color(n) : 0; };
  api.zAdd = function (x, z, hp, dmg, speed) {
    return api.ready ? api.fns.core_z_add(x, z, hp, dmg, speed) : -1;
  };
  api.zStep = function (dt, px, pz, atkRange) {
    if (!api.ready) return 0;
    api.fns.core_z_step(dt, px, pz, atkRange);
    return api.fns.core_z_events();
  };
  api.zHit = function (id, headShot) { return api.ready ? api.fns.core_z_hit(id, headShot ? 1 : 0) : 0; };
  api.zState = function () {
    if (!api.ready) return null;
    return {
      on: !!api.fns.core_z_on(), wave: api.fns.core_z_wave(),
      breakT: api.fns.core_z_break(), killed: api.fns.core_z_killed(),
      hp: api.fns.core_z_player_hp(), used: api.fns.core_z_used(),
      events: api.fns.core_z_events()
    };
  };
  api.zGet = function (id) {
    if (!api.ready) return null;
    return {
      x: api.fns.core_z_x(id), z: api.fns.core_z_z(id),
      alive: !!api.fns.core_z_alive(id), removed: !!api.fns.core_z_removed(id),
      hp: api.fns.core_z_hp(id), flash: api.fns.core_z_flash(id)
    };
  };
  api.zYaw = function (id, px, pz) { return api.ready ? api.fns.core_z_yaw(id, px, pz) : 0; };

  window.__GAME_CORE__ = api;
  return api;
})();
