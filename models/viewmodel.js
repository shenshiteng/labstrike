/* =========================================================================
   nav3d/models/viewmodel.js —— 第一人称持枪/持刀视图模型（本对话专属）
   -------------------------------------------------------------------------
     1) 程序化双手 + 前臂，握住枪柄 / 托枪身 / 握刀
     2) 加载 Poly Pizza 网站 GLB 枪模与刀具，挂相机 -> 视角跟随
     3) 开火：后坐力 + 星芒火光 + 曳光 + 抛壳；刀具为挥砍
     4) 单发 / 连发模式；红点 / 全息 / 3倍 / 7~10倍可调瞄具 + 开镜缩放
     5) 加载状态机（token 防竞态 + 缓存 + 回调），提示不闪烁
     -> 联机时同步 getState() 即可，不必改本模块
   ========================================================================= */
(function () {
  'use strict';

  var T = window.THREE;
  if (!T) { console.error('[viewmodel] THREE 未加载'); return; }

  var api = {};

  /* C++ / WebAssembly 核心：存在且就绪时，弹药/射击节奏/换弹由 C++ 说了算 */
  var WEAPON_ID = { AssaultRifle: 0, Pistol: 1, Shotgun: 2, Glock: 3 };
  function core() { var c = window.__GAME_CORE__; return c && c.ready ? c : null; }
  var coreSynced = false;   // C++ 核心若晚于本模块就绪，首帧补一次武器同步

  /* yaw: 模型自带朝向修正（绕 Y 轴），确保枪口/刀尖朝 -Z（前方）
     auto: 是否支持连发；delay: 连发间隔秒
     mag: 弹匣容量；reserve: 备用子弹；reload: 换弹秒数；shells: 一次击发数(霰弹枪多颗) */
  var WEAPON_DEFS = {
    AssaultRifle:  { file: 'models/AssaultRifle.glb',  type: 'gun',   len: 0.62, label: '突击步枪', yaw: 0,          auto: true,  delay: 0.10, mag: 45, reserve: 180, reload: 2.2, shells: 1 },
    Pistol:        { file: 'models/Pistol.glb',        type: 'gun',   len: 0.30, label: '手枪',     yaw: 0,          auto: false, delay: 0,    mag: 10, reserve: 60,  reload: 1.5, shells: 1 },
    Shotgun:       { file: 'models/Shotgun.glb',       type: 'gun',   len: 0.58, label: '霰弹枪',   yaw: 0,          auto: false, delay: 0,    mag: 6,  reserve: 36,  reload: 2.8, shells: 1 },
    Glock:         { file: 'models/Rigged_Glock.glb',  type: 'gun',   len: 0.28, label: 'Glock',    yaw: Math.PI,    auto: false, delay: 0,    mag: 12, reserve: 72,  reload: 1.5, shells: 1 },
    Knife_Kabar:   { file: 'models/Knife_Kabar.glb',   type: 'knife', len: 0.34, label: 'Kabar 军刀', yaw: 0,          auto: false, delay: 0 },
    Knife_Bayonet: { file: 'models/Knife_Bayonet.glb', type: 'knife', len: 0.30, label: '刺刀',     yaw: Math.PI/2, auto: false, delay: 0 },
    Knife_Dagger:  { file: 'models/Knife_Dagger.glb',  type: 'knife', len: 0.26, label: '匕首',     yaw: 0,          auto: false, delay: 0 }
  };
  var ORDER = ['AssaultRifle', 'Pistol', 'Shotgun', 'Glock',
               'Knife_Kabar', 'Knife_Bayonet', 'Knife_Dagger'];

  var camera = null, scene = null;
  var rig = null, gunPivot = null, gunWrap = null;
  var muzzle = null, tracer = null, bullet = null;
  var handsGroup = null, leftArm = null;
  var shells = [], shellIdx = 0;
  var current = 'AssaultRifle', ready = false;

  /* 加载状态机 */
  var loadState = { status: 'idle', name: null };
  var loadToken = 0, cache = {}, loadCallbacks = [];

  function getLoadState() {
    var d = WEAPON_DEFS[loadState.name] || WEAPON_DEFS[current] || {};
    return { status: loadState.status, name: loadState.name || current,
             label: d.label || loadState.name || current, type: d.type || 'gun', weapon: current };
  }
  function emitLoad() {
    for (var i = 0; i < loadCallbacks.length; i++) {
      try { loadCallbacks[i](getLoadState()); } catch (e) { console.warn('[viewmodel] load cb', e); }
    }
  }

  var recoilImpulse = 0, recoil = 0, flashT = 0;
  var TRACER_LIFE = 0.18, tracerT = 0, swingT = 0, tracerMax = 1.8;
  var lastYaw = 0, lastPitch = 0;
  var swayX = 0, swayY = 0, swayRX = 0, swayRY = 0;
  var crouchAmt = 0, jumpAmt = 0;   // 蹲/跳时枪身随动（由页面传入）
  var muzzleZ = -0.315;

  /* ---------- 程序化音效（Web Audio 合成，不依赖任何音频文件） ---------- */
  var audioCtx = null, masterGain = null, soundOn = true, noiseBuf = null;
  function getAudio() {
    if (!soundOn) return null;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!audioCtx) {
        audioCtx = new AC();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.62;   // 总输出限幅，多层叠加不爆音
        masterGain.connect(audioCtx.destination);
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (e) { return null; }
  }
  function noise(ctx) {
    if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
      var n = Math.floor(ctx.sampleRate * 0.45);
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  var GUN_SOUND = {
    AssaultRifle: { dur: 0.17, vol: 0.52, low: 150, lowEnd: 60, hz: 3200, endHz: 600, crack: 2400, body: 0.70 },
    Pistol:       { dur: 0.14, vol: 0.55, low: 170, lowEnd: 55, hz: 3400, endHz: 600, crack: 2800, body: 0.70 },
    Glock:        { dur: 0.13, vol: 0.52, low: 180, lowEnd: 60, hz: 3600, endHz: 650, crack: 3000, body: 0.70 },
    /* 霰弹枪：低沉厚重的"砰——"，高频起音压低、低通压到 700Hz、尾音拉长 */
    Shotgun:      { dur: 0.42, vol: 0.90, low: 105, lowEnd: 38, hz: 700,  endHz: 180, crack: 1100, body: 1.15 }
  };
  function playShot(name) {
    var ctx = getAudio(); if (!ctx || !masterGain) return;
    var c = GUN_SOUND[name] || GUN_SOUND.AssaultRifle, t = ctx.currentTime;
    /* 1) 爆裂瞬态：极短高通噪声 = 起音"啪"（霰弹枪这层刻意压低，避免邦邦的金属感） */
    var s1 = ctx.createBufferSource(); s1.buffer = noise(ctx);
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = c.crack;
    var g1 = ctx.createGain();
    g1.gain.setValueAtTime(c.vol * 0.5, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    s1.connect(hp); hp.connect(g1); g1.connect(masterGain);
    s1.start(t); s1.stop(t + 0.035);
    /* 2) 主体爆音：低通噪声 = "砰"的核心 */
    var s2 = ctx.createBufferSource(); s2.buffer = noise(ctx);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(c.hz, t);
    lp.frequency.exponentialRampToValueAtTime(c.endHz, t + c.dur);
    var g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.001, t);
    g2.gain.linearRampToValueAtTime(c.vol, t + 0.004);
    g2.gain.exponentialRampToValueAtTime(0.001, t + c.dur);
    s2.connect(lp); lp.connect(g2); g2.connect(masterGain);
    s2.start(t); s2.stop(t + c.dur);
    /* 3) 低频轰鸣：下坠正弦 = "砰——"的厚重尾音 */
    var osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(c.low, t);
    osc.frequency.exponentialRampToValueAtTime(c.lowEnd, t + c.dur);
    var g3 = ctx.createGain();
    g3.gain.setValueAtTime(c.vol * c.body, t);
    g3.gain.exponentialRampToValueAtTime(0.001, t + c.dur);
    osc.connect(g3); g3.connect(masterGain);
    osc.start(t); osc.stop(t + c.dur);
  }
  function playSwing() {
    var ctx = getAudio(); if (!ctx) return;
    var t = ctx.currentTime;
    var src = ctx.createBufferSource(); src.buffer = noise(ctx);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(320, t);
    bp.frequency.exponentialRampToValueAtTime(1600, t + 0.14);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(bp); bp.connect(g); g.connect(masterGain || ctx.destination);
    src.start(t); src.stop(t + 0.24);
  }
  /* 换弹机械声：两声短促的"咔、哒"（拔匣 + 上膛） */
  function playReloadClick(delay, freq, vol) {
    var ctx = getAudio(); if (!ctx || !masterGain) return;
    var t = ctx.currentTime + delay;
    var src = ctx.createBufferSource(); src.buffer = noise(ctx);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.2; bp.frequency.value = freq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(bp); bp.connect(g); g.connect(masterGain);
    src.start(t); src.stop(t + 0.10);
  }

  /* 射击模式 */
  var fireMode = 'auto';       // 'auto' | 'semi'
  var triggerHeld = false;
  var lastShotT = 0;

  /* 弹药：每把枪独立计数，切换武器不共用 */
  var ammo = {};
  (function initAmmo() {
    for (var k in WEAPON_DEFS) if (WEAPON_DEFS.hasOwnProperty(k)) {
      var d = WEAPON_DEFS[k];
      if (d.type === 'gun') ammo[k] = { mag: d.mag, reserve: d.reserve };
    }
  })();
  var reloading = false, reloadStartT = 0, reloadEndT = 0, reloadDur = 0, reloadToken = 0;
  var ammoCallbacks = [];

  /* 瞄具系统 */
  var OPTICS = {
    iron:  { label: '机械瞄具', zoom: 1 },
    red:   { label: '红点',     zoom: 1.15 },
    holo:  { label: '全息',     zoom: 1.2 },
    scope3:{ label: '3倍镜',    zoom: 3 },
    scopeZ:{ label: '可调倍镜', zoom: 8 }   // 7~10 可调
  };
  var OPTIC_ORDER = ['iron', 'red', 'holo', 'scope3', 'scopeZ'];
  var optic = 'iron';
  var aiming = false;
  var baseFov = 70;
  var fovNow = 70;
  var opticMount = null;       // 挂在 gunPivot 下，装当前瞄具
  var opticGroups = {};        // kind -> Group

  var MUZZLE_Z = { AssaultRifle: -0.315, Pistol: -0.155, Shotgun: -0.305, Glock: -0.150 };
  var SHELL_POS = {
    AssaultRifle: { x: 0.052, y: 0.018, z: 0.055 }, Pistol: { x: 0.038, y: 0.012, z: 0.040 },
    Shotgun: { x: 0.052, y: 0.018, z: 0.060 }, Glock: { x: 0.036, y: 0.012, z: 0.038 }
  };
  var HAND_POSE = {
    AssaultRifle: { x: 0, y: 0,     z: 0,      s: 1.00 },
    Shotgun:      { x: 0, y: 0,     z: 0.004,  s: 1.00 },
    Pistol:       { x: 0, y: 0.012, z: -0.035, s: 0.85 },
    Glock:        { x: 0, y: 0.012, z: -0.030, s: 0.83 },
    Knife_Kabar:   { x: 0, y: 0.020, z: -0.030, s: 0.90 },
    Knife_Bayonet: { x: 0, y: 0.020, z: -0.028, s: 0.88 },
    Knife_Dagger:  { x: 0, y: 0.020, z: -0.024, s: 0.86 }
  };
  var pose = HAND_POSE.AssaultRifle;

  /* 换弹动画：弹匣位置 / 弹挂位置 / 左手掌心基准点（gunPivot 局部坐标） */
  var MAG_POS = {
    AssaultRifle: { x: 0.020, y: -0.075, z: 0.035, w: 0.046, h: 0.115, d: 0.054, tilt: 0.10 },
    Pistol:       { x: 0.035, y: -0.078, z: 0.105, w: 0.036, h: 0.086, d: 0.048, tilt: -0.06 },
    Shotgun:      { x: 0.018, y: -0.070, z: 0.070, w: 0.040, h: 0.100, d: 0.050, tilt: 0.04 },
    Glock:        { x: 0.034, y: -0.078, z: 0.100, w: 0.035, h: 0.082, d: 0.047, tilt: -0.06 }
  };
  var POUCH_POS = { x: 0.30, y: -0.36, z: 0.22 };   // 右下弹挂
  var LEFT_C = { x: -0.062, y: -0.088, z: -0.075 }; // 左手掌心默认中心
  var magOld = null, magNew = null, magPouch = null;

  /* ---------- 材质 ---------- */
  var SKIN = new T.MeshStandardMaterial({ color: 0xd2a07d, roughness: 0.86, metalness: 0 });
  var SLEEVE = new T.MeshStandardMaterial({ color: 0x2b3648, roughness: 0.92, metalness: 0 });
  var OPTIC_BODY = new T.MeshStandardMaterial({ color: 0x23262c, roughness: 0.5, metalness: 0.55 });
  var OPTIC_GLASS = new T.MeshStandardMaterial({ color: 0x1a3a52, roughness: 0.15, metalness: 0.3, emissive: 0x0a1c2a });
  var OPTIC_RED = new T.MeshBasicMaterial({ color: 0xff2b2b });
  var MAG_MAT = new T.MeshStandardMaterial({ color: 0x30343c, roughness: 0.55, metalness: 0.45 });
  var MAG_BASE_MAT = new T.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.70, metalness: 0.30 });
  var ROUND_MAT = new T.MeshStandardMaterial({ color: 0xb08a3c, roughness: 0.35, metalness: 0.80 });
  var POUCH_MAT = new T.MeshStandardMaterial({ color: 0x3a4030, roughness: 0.95, metalness: 0.05 });

  function makeFlashTexture() {
    var cv = document.createElement('canvas'); cv.width = cv.height = 128;
    var ctx = cv.getContext('2d'), cx = 64, cy = 64;
    var g = ctx.createRadialGradient(cx, cy, 19, cx, cy, 62);
    g.addColorStop(0, 'rgba(255,235,170,0.05)');
    g.addColorStop(0.18, 'rgba(255,190,75,0.85)');
    g.addColorStop(0.45, 'rgba(255,120,25,0.40)');
    g.addColorStop(1, 'rgba(255,70,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    ctx.lineCap = 'round';
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3 + 0.12, r0 = 21, r1 = 42 + (i % 2 ? 12 : 0);
      ctx.strokeStyle = i % 2 ? 'rgba(255,220,140,0.55)' : 'rgba(255,235,170,0.8)';
      ctx.lineWidth = i % 2 ? 3 : 4;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
    }
    return new T.CanvasTexture(cv);
  }
  var FLASH_MAT = new T.SpriteMaterial({ map: makeFlashTexture(), transparent: true,
    blending: T.AdditiveBlending, depthWrite: false });
  var TRACER_MAT = new T.MeshBasicMaterial({ color: 0xffcf76, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, depthTest: false });
  var BULLET_MAT = new T.MeshBasicMaterial({ color: 0xfff0b8, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, depthTest: false });
  var BRASS_MAT = new T.MeshStandardMaterial({ color: 0xc9a043, roughness: 0.32, metalness: 0.82, transparent: true, opacity: 1 });

  /* ---------- 工具 ---------- */
  function limb(a, b, r1, r2, mat) {
    var dir = new T.Vector3().subVectors(b, a), len = dir.length();
    var m = new T.Mesh(new T.CylinderGeometry(r1, r2, len, 10, 1), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize());
    return m;
  }
  function boxAt(x, y, z, w, h, d, mat) {
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m;
  }
  function cylAt(x, y, z, r, len, mat, alongZ) {
    var m = new T.Mesh(new T.CylinderGeometry(r, r, len, 16), mat);
    m.position.set(x, y, z); if (alongZ) m.rotation.x = Math.PI / 2; return m;
  }
  function palmAt(x, y, z, w, h, d, mat) {
    var m = new T.Mesh(new T.SphereGeometry(1, 12, 10), mat);
    m.position.set(x, y, z); m.scale.set(w / 2, h / 2, d / 2); return m;
  }

  /* ---------- 双手 ---------- */
  function buildHands(parent) {
    var hands = new T.Group(), left = new T.Group();
    hands.add(palmAt(0.035, -0.085, 0.105, 0.078, 0.11, 0.068, SKIN));
    for (var i = 0; i < 4; i++) {
      var z = 0.128 - i * 0.021;
      var a = new T.Vector3(0.030, -0.045, z), b = new T.Vector3(0.006, -0.078, z - 0.012), c = new T.Vector3(-0.012, -0.104, z - 0.004);
      hands.add(limb(a, b, 0.0095, 0.0085, SKIN)); hands.add(limb(b, c, 0.0085, 0.0075, SKIN));
    }
    hands.add(limb(new T.Vector3(0.072, -0.072, 0.118), new T.Vector3(0.018, -0.048, 0.088), 0.013, 0.010, SKIN));
    hands.add(limb(new T.Vector3(0.065, -0.135, 0.175), new T.Vector3(0.30, -0.36, 0.55), 0.048, 0.060, SKIN));
    hands.add(limb(new T.Vector3(0.145, -0.235, 0.335), new T.Vector3(0.30, -0.36, 0.55), 0.056, 0.068, SLEEVE));
    left.add(palmAt(-0.062, -0.088, -0.075, 0.084, 0.058, 0.108, SKIN));
    for (var j = 0; j < 4; j++) {
      var z2 = -0.035 - j * 0.024;
      var p = new T.Vector3(-0.104, -0.068, z2), q = new T.Vector3(-0.052, -0.098, z2), r = new T.Vector3(-0.006, -0.083, z2);
      left.add(limb(p, q, 0.0095, 0.0085, SKIN)); left.add(limb(q, r, 0.0085, 0.0075, SKIN));
    }
    left.add(limb(new T.Vector3(-0.078, -0.050, -0.125), new T.Vector3(-0.018, -0.038, -0.095), 0.013, 0.010, SKIN));
    left.add(limb(new T.Vector3(-0.100, -0.140, -0.030), new T.Vector3(-0.44, -0.42, 0.45), 0.048, 0.060, SKIN));
    left.add(limb(new T.Vector3(-0.230, -0.260, 0.190), new T.Vector3(-0.44, -0.42, 0.45), 0.056, 0.068, SLEEVE));
    hands.add(left); parent.add(hands);
    return { all: hands, left: left };
  }

  /* ---------- 瞄具几何：红点 / 全息 / 3倍 / 7~10倍可调 ----------
     统一安装点 (0, 0.055, 0)；镜筒沿 Z（朝前 -Z） */
  function buildOptics(parent) {
    opticMount = new T.Group();
    opticMount.position.set(0, 0.055, 0);
    parent.add(opticMount);

    /* 红点：小底座 + 弧形镜片 + 红点 */
    var red = new T.Group();
    red.add(boxAt(0, 0.0, 0, 0.036, 0.012, 0.075, OPTIC_BODY));
    red.add(cylAt(0, 0.030, 0.0, 0.020, 0.045, OPTIC_BODY, true));
    red.add(cylAt(0, 0.030, -0.024, 0.017, 0.004, OPTIC_GLASS, true));
    red.add(new T.Mesh(new T.SphereGeometry(0.0035, 8, 8), OPTIC_RED)).position.set(0, 0.030, -0.026);
    opticGroups.red = red;

    /* 全息：方形框 + 玻璃 + 红色圈 */
    var holo = new T.Group();
    holo.add(boxAt(0, 0.0, 0, 0.040, 0.012, 0.085, OPTIC_BODY));
    var frame = new T.Mesh(new T.BoxGeometry(0.046, 0.040, 0.030), OPTIC_BODY);
    frame.position.set(0, 0.032, -0.005); holo.add(frame);
    var glass = new T.Mesh(new T.BoxGeometry(0.038, 0.032, 0.002), OPTIC_GLASS);
    glass.position.set(0, 0.032, -0.021); holo.add(glass);
    var ring = new T.Mesh(new T.TorusGeometry(0.009, 0.0016, 6, 20), OPTIC_RED);
    ring.position.set(0, 0.032, -0.023); holo.add(ring);
    opticGroups.holo = holo;

    /* 3倍镜：短镜筒 + 前后镜片 */
    var s3 = new T.Group();
    s3.add(boxAt(0, 0.0, 0, 0.036, 0.012, 0.10, OPTIC_BODY));
    s3.add(cylAt(0, 0.040, -0.010, 0.022, 0.115, OPTIC_BODY, true));
    s3.add(cylAt(0, 0.040, -0.068, 0.024, 0.008, OPTIC_GLASS, true));
    s3.add(cylAt(0, 0.040, 0.048, 0.019, 0.006, OPTIC_GLASS, true));
    opticGroups.scope3 = s3;

    /* 7~10倍可调：长镜筒 + 大物镜 + 目镜 + 顶部旋钮 */
    var sz = new T.Group();
    sz.add(boxAt(0, 0.0, 0, 0.038, 0.012, 0.14, OPTIC_BODY));
    sz.add(cylAt(0, 0.052, -0.020, 0.028, 0.19, OPTIC_BODY, true));
    sz.add(cylAt(0, 0.052, -0.115, 0.033, 0.010, OPTIC_GLASS, true));   // 大物镜
    sz.add(cylAt(0, 0.052, 0.075, 0.022, 0.010, OPTIC_GLASS, true));    // 目镜
    sz.add(cylAt(0, 0.082, 0.010, 0.012, 0.022, OPTIC_BODY, false));    // 倍率旋钮
    opticGroups.scopeZ = sz;

    for (var k in opticGroups) { opticGroups[k].visible = false; opticMount.add(opticGroups[k]); }
    applyOptic();
  }

  function applyOptic() {
    for (var k in opticGroups) if (opticGroups.hasOwnProperty(k)) opticGroups[k].visible = (k === optic);
    if (opticMount) {
      /* 高倍镜开镜时隐藏镜筒几何（避免实心镜筒挡住屏幕中心），准星改用页面 HTML 覆盖层 */
      var hideForAds = aiming && (optic === 'scope3' || optic === 'scopeZ');
      opticMount.visible = (optic !== 'iron') && !isKnife(current) && !hideForAds;
    }
  }

  function buildMuzzle(parent) {
    var s = new T.Sprite(FLASH_MAT); s.scale.set(0.18, 0.18, 1);
    s.position.set(0, 0.006, muzzleZ - 0.04); s.visible = false; parent.add(s); return s;
  }
  function buildTracer(parent) {
    var geo = new T.CylinderGeometry(0.0055, 0.0055, 1, 6, 1, true); geo.rotateX(Math.PI / 2);
    var line = new T.Mesh(geo, TRACER_MAT); line.visible = false; parent.add(line);
    var head = new T.Mesh(new T.SphereGeometry(0.011, 8, 6), BULLET_MAT); head.visible = false; parent.add(head);
    return { line: line, head: head };
  }
  function buildShells(parent) {
    var geo = new T.CylinderGeometry(0.0048, 0.0055, 0.018, 8);
    for (var i = 0; i < 10; i++) {
      var m = new T.Mesh(geo, BRASS_MAT.clone()); m.visible = false;
      m.userData = { life: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0 };
      parent.add(m); shells.push(m);
    }
  }

  /* ---------- 弹匣 / 弹挂：换弹动画道具 ---------- */
  function buildMagazine() {
    var g = new T.Group();
    var body = new T.Mesh(new T.BoxGeometry(1, 1, 1), MAG_MAT);
    body.position.y = -0.5; g.add(body);
    var base = new T.Mesh(new T.BoxGeometry(1.12, 0.085, 1.08), MAG_BASE_MAT);
    base.position.y = -1.04; g.add(base);
    var top = new T.Mesh(new T.BoxGeometry(0.92, 0.05, 0.86), ROUND_MAT);
    top.position.y = -0.025; g.add(top);
    g.visible = false; return g;
  }
  function buildPouch(parent) {
    var g = new T.Group();
    g.add(boxAt(0, 0, 0, 0.13, 0.16, 0.09, POUCH_MAT));
    g.add(boxAt(0, 0.082, -0.005, 0.14, 0.035, 0.10, MAG_BASE_MAT));  // 翻盖
    g.add(boxAt(0.055, 0, 0, 0.012, 0.10, 0.095, MAG_BASE_MAT));      // 侧扣
    g.position.set(POUCH_POS.x, POUCH_POS.y, POUCH_POS.z);
    g.rotation.set(0.12, -0.25, -0.10);
    g.visible = false; parent.add(g); return g;
  }
  function buildReloadProps(parent) {
    magOld = buildMagazine(); magNew = buildMagazine();
    parent.add(magOld); parent.add(magNew);
    magPouch = buildPouch(parent);
  }
  function applyMagazine() {
    var gun = (WEAPON_DEFS[current] || {}).type === 'gun';
    var p = MAG_POS[current] || MAG_POS.AssaultRifle;
    if (!gun || !magOld || !magNew) {
      if (magOld) magOld.visible = false;
      if (magNew) magNew.visible = false;
      if (magPouch) magPouch.visible = false;
      return;
    }
    magOld.scale.set(p.w, p.h, p.d);
    magNew.scale.set(p.w, p.h, p.d);
    magOld.position.set(p.x, p.y, p.z);
    magNew.position.set(p.x, p.y, p.z);
    magOld.rotation.set(p.tilt || 0, 0, 0);
    magNew.rotation.set(p.tilt || 0, 0, 0);
    magOld.visible = true; magNew.visible = false;
    if (magPouch) magPouch.visible = true;
  }
  function resetReloadAnim() {
    if (leftArm) {
      leftArm.visible = !isSingle(current);
      leftArm.position.set(0, 0, 0);
      leftArm.rotation.set(0, 0, 0);
    }
    applyMagazine();
  }

  function hideGunFx() {
    if (muzzle) muzzle.visible = false;
    if (tracer) { tracer.line.visible = false; tracer.head.visible = false; }
    flashT = 0; tracerT = 0;
    for (var i = 0; i < shells.length; i++) shells[i].visible = false;
  }
  function ejectShell() {
    if (!shells.length) return;
    var s = shells[shellIdx % shells.length]; shellIdx++;
    var p = SHELL_POS[current] || SHELL_POS.AssaultRifle;
    s.position.set(p.x, p.y, p.z);
    s.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    s.userData.vx = 0.55 + Math.random() * 0.30; s.userData.vy = 0.32 + Math.random() * 0.22;
    s.userData.vz = 0.06 + Math.random() * 0.14;
    s.userData.rx = 7 + Math.random() * 8; s.userData.ry = 5 + Math.random() * 6; s.userData.rz = 6 + Math.random() * 7;
    s.userData.life = 0.6; s.material.opacity = 1; s.visible = true;
  }
  function updateShells(dt) {
    for (var i = 0; i < shells.length; i++) {
      var s = shells[i], u = s.userData;
      if (!s.visible || u.life <= 0) continue;
      u.life -= dt; if (u.life <= 0) { s.visible = false; continue; }
      u.vy -= 3.2 * dt;
      s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
      s.rotation.x += u.rx * dt; s.rotation.y += u.ry * dt; s.rotation.z += u.rz * dt;
      s.material.opacity = Math.min(1, u.life / 0.2);
    }
  }
  function fireTracer() {
    tracerT = TRACER_LIFE; if (tracer) { tracer.line.visible = true; tracer.head.visible = true; }
  }
  function updateTracer(dt) {
    if (!tracer || tracerT <= 0) return;
    tracerT -= dt;
    if (tracerT <= 0) { tracer.line.visible = false; tracer.head.visible = false; return; }
    var prog = 1 - tracerT / TRACER_LIFE;
    var len = Math.max(0.02, Math.min(0.10 + prog * 1.7, tracerMax)), startZ = muzzleZ - 0.01;
    tracer.line.scale.z = len; tracer.line.position.set(0.006, 0.014, startZ - len / 2);
    tracer.line.material.opacity = 0.95 * Math.min(1, tracerT / 0.04);
    tracer.head.position.set(0.006, 0.014, startZ - len); tracer.head.material.opacity = tracer.line.material.opacity;
  }

  /* ---------- 换弹动画：拔匣 → 丢掉 → 弹挂掏新匣 → 装入 → 拍实 ---------- */
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function smooth01(v) { v = clamp01(v); return v * v * (3 - 2 * v); }
  function seg(p, a, b) { return smooth01((p - a) / (b - a)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function mix3(a, b, t) { return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), z: mix(a.z, b.z, t) }; }

  /* 按真实时间推进，低帧率也不会卡在某一帧；返回枪身应叠加的姿态偏移 */
  function updateReloadAnim() {
    var out = { dx: 0, dy: 0, dz: 0, rx: 0, rz: 0 };
    if (!reloading || !magOld || !magNew) return out;
    var p = clamp01((Date.now() - reloadStartT) / (reloadDur * 1000));
    var m = MAG_POS[current] || MAG_POS.AssaultRifle;

    var pull    = seg(p, 0.00, 0.12);
    var detach  = seg(p, 0.12, 0.30);
    var toPouch = seg(p, 0.32, 0.50);
    var draw    = seg(p, 0.50, 0.64);
    var insert  = seg(p, 0.64, 0.84);
    var seat    = seg(p, 0.84, 0.94);
    var settle  = seg(p, 0.94, 1.00);

    /* 旧弹匣：向下抽出，脱手后翻滚掉落 */
    var dropT = clamp01((p - 0.28) / 0.34);
    magOld.position.set(m.x + detach * 0.045 + dropT * 0.24,
                        m.y - detach * 0.17 - dropT * dropT * 0.52,
                        m.z + detach * 0.02 + dropT * 0.10);
    magOld.rotation.set((m.tilt || 0) + detach * 0.22 + dropT * 1.5,
                        dropT * 0.6, -detach * 0.14 + dropT * 0.8);
    magOld.visible = p < 0.62;

    /* 新弹匣：从弹挂取出 → 送到握持位 → 推入弹匣井 → 拍实 */
    var hold = { x: m.x + 0.055, y: m.y - 0.045, z: m.z + 0.035 };
    var from = { x: POUCH_POS.x - 0.02, y: POUCH_POS.y + 0.05, z: POUCH_POS.z };
    var np = (p < 0.64) ? mix3(from, hold, draw)
                        : mix3(hold, { x: m.x, y: m.y, z: m.z }, insert);
    magNew.position.set(np.x, np.y, np.z);
    magNew.rotation.set((m.tilt || 0) + (1 - draw) * 0.40 + (1 - insert) * 0.22,
                        0, (1 - draw) * 0.25);
    magNew.visible = p >= 0.48 && p < 0.995;
    if (seat > 0) magNew.position.y -= Math.sin(seat * Math.PI) * 0.012;

    /* 左手：握旧匣 → 松手 → 伸进弹挂 → 握新匣 → 推入 → 回护木 */
    var oldGrip   = { x: m.x - LEFT_C.x + 0.010, y: m.y - 0.055 - LEFT_C.y, z: m.z + 0.020 - LEFT_C.z };
    var oldFall   = { x: oldGrip.x + 0.05, y: oldGrip.y - 0.16, z: oldGrip.z + 0.02 };
    var pouchGrip = { x: POUCH_POS.x - LEFT_C.x - 0.010, y: POUCH_POS.y + 0.05 - LEFT_C.y, z: POUCH_POS.z - LEFT_C.z };
    var newGrip   = { x: m.x - LEFT_C.x + 0.015, y: m.y - 0.045 - LEFT_C.y, z: m.z + 0.015 - LEFT_C.z };
    var zero = { x: 0, y: 0, z: 0 }, h, hrx = 0, hrz = 0;
    if (p < 0.12) {
      h = mix3(zero, oldGrip, pull); hrz = -0.28 * pull;
    } else if (p < 0.30) {
      h = mix3(oldGrip, oldFall, detach); hrx = 0.12 * detach; hrz = -0.28 + 0.46 * detach;
    } else if (p < 0.50) {
      h = mix3(oldFall, pouchGrip, toPouch);
      hrx = 0.12 * (1 - toPouch) + 0.24 * toPouch; hrz = 0.18 - 0.45 * toPouch;
    } else if (p < 0.64) {
      h = pouchGrip; hrx = 0.24 + Math.sin(draw * Math.PI) * 0.06; hrz = -0.27;
    } else if (p < 0.84) {
      h = mix3(pouchGrip, newGrip, insert); hrx = 0.24 * (1 - insert); hrz = -0.27 + 0.24 * insert;
    } else if (p < 0.94) {
      h = mix3(newGrip, { x: newGrip.x, y: newGrip.y - 0.02, z: newGrip.z }, Math.sin(seat * Math.PI));
      hrz = -0.03 - 0.12 * seat;
    } else {
      h = mix3(newGrip, zero, settle); hrz = -0.15 * (1 - settle);
    }
    if (leftArm) {
      leftArm.visible = true;   // 手枪/霰弹也临时露出左手换弹
      /* 换算到 handsGroup 局部坐标（handsGroup 自身有 pose 平移与缩放） */
      var hs = handsGroup && handsGroup.scale.x ? handsGroup.scale.x : 1;
      var px = (pose && pose.x) || 0, py = (pose && pose.y) || 0, pz = (pose && pose.z) || 0;
      leftArm.position.set((h.x + LEFT_C.x - px) / hs - LEFT_C.x,
                           (h.y + LEFT_C.y - py) / hs - LEFT_C.y,
                           (h.z + LEFT_C.z - pz) / hs - LEFT_C.z);
      leftArm.rotation.set(hrx, 0, hrz);
    }

    /* 枪身略向右前倾，让弹匣井露出来；装入后回正 */
    var tiltAmt = p < 0.12 ? pull
                : p < 0.32 ? (1 - detach * 0.15)
                : p < 0.64 ? 1
                : p < 0.84 ? (1 - insert * 0.55)
                : (1 - settle);
    out.rx = -0.075 * tiltAmt;
    out.rz = 0.135 * tiltAmt;
    out.dx = 0.018 * tiltAmt;
    out.dy = -0.024 * tiltAmt;
    return out;
  }

  /* ---------- 归一化：最长轴对齐 Z + 按武器 yaw 修正朝向 ---------- */
  function normalizeGun(model, name) {
    var box = new T.Box3().setFromObject(model);
    var size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    model.position.sub(center);
    var def = WEAPON_DEFS[name] || WEAPON_DEFS.AssaultRifle;
    var wrap = new T.Group(); wrap.add(model);
    wrap.scale.setScalar(def.len / maxDim);
    if (size.x >= size.z && size.x >= size.y) wrap.rotation.y = Math.PI / 2;
    else if (size.y >= size.z && size.y >= size.x) wrap.rotation.x = Math.PI / 2;
    wrap.rotation.y += (def.yaw || 0);                 // 关键：修正枪口/刀尖朝向
    if (def.type === 'knife') wrap.rotation.z += -0.15;
    return wrap;
  }

  function fallbackGun(name) {
    var g = new T.Group();
    var dark = new T.MeshStandardMaterial({ color: 0x333a44, roughness: 0.6, metalness: 0.3 });
    if ((WEAPON_DEFS[name] || {}).type === 'knife') {
      g.add(boxAt(0, 0, -0.06, 0.012, 0.045, 0.22, dark)); g.add(boxAt(0, -0.03, 0.08, 0.03, 0.03, 0.10, dark));
    } else {
      g.add(boxAt(0, 0, 0, 0.075, 0.075, 0.42, dark)); g.add(boxAt(0, 0.012, -0.28, 0.038, 0.038, 0.26, dark));
      g.add(boxAt(0, -0.085, 0.10, 0.055, 0.14, 0.07, dark)); g.add(boxAt(0, -0.075, -0.10, 0.06, 0.11, 0.09, dark));
    }
    return g;
  }

  function isKnife(name) { return (WEAPON_DEFS[name] || {}).type === 'knife'; }
  function isSingle(name) { var d = WEAPON_DEFS[name] || {}; return d.type === 'knife' || d.auto === false; }
  function supportsAuto(name) { return !!(WEAPON_DEFS[name] || {}).auto; }

  function applyHands() {
    if (leftArm) leftArm.visible = !isSingle(current);
    pose = HAND_POSE[current] || HAND_POSE.AssaultRifle;
    var def = WEAPON_DEFS[current] || {};
    if (def.type === 'gun') { muzzleZ = MUZZLE_Z[current] || MUZZLE_Z.AssaultRifle; if (muzzle) muzzle.position.z = muzzleZ - 0.04; }
    applyMagazine();
    applyOptic();
    /* 切到不支持连发的武器时，模式回到 semi 显示一致 */
    if (!supportsAuto(current) && fireMode === 'auto') fireMode = 'semi';
  }

  function mount(name) {
    var wrap = cache[name]; if (!wrap) return;
    if (gunWrap && gunPivot) gunPivot.remove(gunWrap);
    gunWrap = wrap; if (gunPivot) gunPivot.add(gunWrap);
    current = name; ready = true; reloading = false; reloadEndT = 0; reloadToken++;
    var c = core();
    if (c) { c.releaseTrigger(); c.setWeapon(WEAPON_ID[name] === undefined ? -1 : WEAPON_ID[name]); }
    applyHands();
    if (leftArm) { leftArm.position.set(0, 0, 0); leftArm.rotation.set(0, 0, 0); }
  }

  function startLoad(name) {
    if (!WEAPON_DEFS[name]) return;
    var token = ++loadToken;
    if (cache[name]) {
      hideGunFx(); mount(name); loadState = { status: 'ready', name: name }; emitLoad(); return;
    }
    hideGunFx(); loadState = { status: 'loading', name: name }; emitLoad();
    var def = WEAPON_DEFS[name];
    if (!T.GLTFLoader) {
      if (token !== loadToken) return;
      cache[name] = fallbackGun(name); mount(name); loadState = { status: 'ready', name: name }; emitLoad(); return;
    }
    var loader = new T.GLTFLoader();
    loader.load(def.file, function (gltf) {
      if (token !== loadToken) return;
      cache[name] = normalizeGun(gltf.scene, name);
      if (token !== loadToken) return;
      mount(name); loadState = { status: 'ready', name: name }; emitLoad();
    }, undefined, function (err) {
      console.warn('[viewmodel] 模型加载失败，用兜底几何体：', name, err);
      if (token !== loadToken) return;
      cache[name] = fallbackGun(name); mount(name); loadState = { status: 'ready', name: name }; emitLoad();
    });
  }

  /* ---------- 对外接口 ---------- */
  api.init = function (cam, sc) {
    camera = cam; scene = sc;
    if (scene && camera.parent !== scene) scene.add(camera);
    if (camera) { baseFov = camera.fov || 70; fovNow = baseFov; }
    rig = new T.Group(); camera.add(rig);
    gunPivot = new T.Group(); gunPivot.position.set(0.16, -0.19, -0.52); rig.add(gunPivot);
    var built = buildHands(gunPivot); handsGroup = built.all; leftArm = built.left;
    muzzle = buildMuzzle(gunPivot);
    var tr = buildTracer(gunPivot); tracer = { line: tr.line, head: tr.head };
    buildShells(gunPivot);
    buildReloadProps(gunPivot);
    buildOptics(gunPivot);
    lastYaw = 0; lastPitch = 0;
    loadState = { status: 'loading', name: current }; emitLoad(); startLoad(current);
    return api;
  };

  api.setWeapon = function (name) {
    if (!WEAPON_DEFS[name]) return false;
    if (name === current && loadState.status !== 'loading') return true;
    api.setAim(false); startLoad(name); return true;
  };
  api.nextWeapon = function (dir) {
    var i = ORDER.indexOf(current), n = (i + (dir > 0 ? 1 : -1) + ORDER.length) % ORDER.length;
    api.setWeapon(ORDER[n]); return ORDER[n];
  };
  api.onLoadChange = function (cb) { if (typeof cb !== 'function') return; loadCallbacks.push(cb); cb(getLoadState()); };
  api.getLoadState = getLoadState;
  api.weapons = function () { return ORDER.slice(); };
  api.weaponInfo = function () {
    var out = [];
    for (var i = 0; i < ORDER.length; i++) { var d = WEAPON_DEFS[ORDER[i]]; out.push({ id: ORDER[i], label: d.label, type: d.type, auto: !!d.auto }); }
    return out;
  };
  api.currentWeapon = function () { return current; };
  api.isReady = function () { return ready; };

  /* ---------- 射击模式 ---------- */
  api.setFireMode = function (mode) {
    if (mode !== 'auto' && mode !== 'semi') return fireMode;
    var c = core();
    if (c) { fireMode = c.setMode(mode); return fireMode; }
    if (mode === 'auto' && !supportsAuto(current)) return fireMode;   // 手枪/霰弹/刀不支持连发
    fireMode = mode; return fireMode;
  };
  api.toggleFireMode = function () {
    var c = core();
    if (c) { fireMode = c.toggleMode(); return fireMode; }
    return api.setFireMode(fireMode === 'auto' ? 'semi' : 'auto');
  };
  api.getFireMode = function () { var c = core(); return c ? c.getMode() : fireMode; };
  api.canAuto = function () {
    var c = core();
    return c ? c.canAuto(WEAPON_ID[current] === undefined ? -1 : WEAPON_ID[current]) : supportsAuto(current);
  };

  /* 扳机：页面 mousedown/mouseup 调用；连发由 C++ stepWeapon 或 JS update 驱动 */
  api.pressTrigger = function () {
    triggerHeld = true;
    var c = core();
    if (c) c.pressTrigger();
    /* 单发/连发都立即打第一发；连发后续由 update 按间隔驱动。
       旧版连发只设标记等下一帧，快速单击会丢火。 */
    api.fire();
  };
  api.releaseTrigger = function () { triggerHeld = false; var c = core(); if (c) c.releaseTrigger(); };

  /* ---------- 瞄具 ---------- */
  api.setOptic = function (kind) {
    if (!OPTICS[kind]) return optic;
    optic = kind; applyOptic(); return optic;
  };
  api.cycleOptic = function (dir) {
    var i = OPTIC_ORDER.indexOf(optic), n = (i + (dir > 0 ? 1 : -1) + OPTIC_ORDER.length) % OPTIC_ORDER.length;
    optic = OPTIC_ORDER[n]; applyOptic(); return optic;
  };
  api.getOptic = function () { return { id: optic, label: OPTICS[optic].label, zoom: OPTICS[optic].zoom }; };
  api.opticList = function () { var o = []; for (var k in OPTICS) if (OPTICS.hasOwnProperty(k)) o.push({ id: k, label: OPTICS[k].label }); return o; };
  api.setAim = function (on) { aiming = !!on && !isKnife(current); applyOptic(); return aiming; };
  api.isAiming = function () { return aiming; };
  /* 可调倍镜：7~10，仅开镜且当前为 scopeZ 时有效 */
  api.adjustZoom = function (delta) {
    if (optic !== 'scopeZ') return OPTICS.scopeZ.zoom;
    OPTICS.scopeZ.zoom = Math.max(7, Math.min(10, +(OPTICS.scopeZ.zoom + delta).toFixed(1)));
    return OPTICS.scopeZ.zoom;
  };
  api.getZoom = function () { return aiming ? ((optic === 'iron') ? 1.25 : OPTICS[optic].zoom) : 1; };

  /* ---------- 弹药 / 换弹 ---------- */
  api.getAmmo = function () {
    var c = core();
    if (c) {
      var ca = c.getAmmo() || { mag: 0, reserve: 0, capacity: 0, reloading: false };
      return { weapon: current, mag: ca.mag, reserve: ca.reserve, capacity: ca.capacity,
               reloading: reloading || ca.reloading, isKnife: isKnife(current) };
    }
    var a = ammo[current] || null;
    return { weapon: current, mag: a ? a.mag : 0, reserve: a ? a.reserve : 0,
             capacity: (WEAPON_DEFS[current] || {}).mag || 0, reloading: reloading,
             isKnife: isKnife(current) };
  };
  api.reload = function () {
    if (!rig || isKnife(current) || reloading) return false;
    var c = core(), def = WEAPON_DEFS[current] || {};
    if (c) {
      if (!c.reload()) return false;
      reloadDur = c.reloadDuration() || def.reload || 1.8;
    } else {
      var a = ammo[current];
      if (!a || a.mag >= def.mag || a.reserve <= 0) return false;
      reloadDur = def.reload || 1.8;
    }
    reloading = true; reloadStartT = Date.now(); reloadEndT = reloadStartT + reloadDur * 1000;
    if (aiming) { aiming = false; applyOptic(); }   // 换弹时退镜，动作才看得见
    var token = ++reloadToken, weaponAtStart = current;
    /* C++ 核心在 stepWeapon(dt) 里结算换弹；仅纯 JS 兜底时才用 setTimeout */
    if (!c) setTimeout(function () {
      if (token !== reloadToken || !reloading || current !== weaponAtStart) return;
      var ra2 = ammo[weaponAtStart], rd2 = WEAPON_DEFS[weaponAtStart] || {};
      if (ra2) { var need2 = (rd2.mag || 0) - ra2.mag, take2 = Math.min(need2, ra2.reserve); ra2.mag += take2; ra2.reserve -= take2; }
      reloading = false; reloadEndT = 0;
      resetReloadAnim();
      for (var ci = 0; ci < ammoCallbacks.length; ci++) { try { ammoCallbacks[ci](api.getAmmo()); } catch (e) {} }
    }, reloadDur * 1000);
    /* 不强制清 triggerHeld：fire() 内已拦截换弹期间开火，换弹完按住左键可继续连发 */
    playReloadClick(0.02, 820, 0.30);                  // 解锁、拔匣
    playReloadClick(reloadDur * 0.30, 520, 0.26);      // 旧匣落地
    playReloadClick(reloadDur * 0.52, 950, 0.18);      // 从弹挂抽出
    playReloadClick(reloadDur * 0.72, 1250, 0.30);     // 新匣入井
    playReloadClick(reloadDur * 0.90, 1600, 0.24);     // 拍实
    return true;
  };
  api.isReloading = function () { return reloading; };
  api.onAmmoChange = function (cb) { if (typeof cb === 'function') ammoCallbacks.push(cb); };

  /* 开火 / 挥砍：视觉表现留在 JS，是否真的打出去由 C++ 核心裁决 */
  function fireVisual() {
    lastShotT = Date.now();
    recoilImpulse = Math.min(1.0, recoilImpulse + 0.9);
    flashT = 0.075; if (muzzle) muzzle.visible = true;
    fireTracer(); ejectShell(); playShot(current);
  }
  function dryFire() {
    playReloadClick(0, 1700, 0.22);
    lastShotT = Date.now() + 250;               // 空仓节流，避免连发疯狂咔哒
    var a = api.getAmmo();
    if (triggerHeld && !a.isKnife && a.reserve > 0) {
      var aa = current;
      setTimeout(function () {
        if (current === aa && !reloading && api.getAmmo().mag <= 0) api.reload();
      }, 380);
    }
  }
  api.fire = function () {
    if (!rig || reloading) return null;
    if (isKnife(current)) { swingT = 1; playSwing(); return api.getState(); }
    var c = core();
    if (c) {
      var r = c.fire();                         // 1=击发 0=冷却/换弹中 -1=空仓
      if (r === 1) fireVisual();
      else if (r === -1) dryFire();
      return api.getState();
    }
    var a = ammo[current];
    if (a && a.mag <= 0) { dryFire(); return api.getState(); }
    if (a) a.mag--;
    fireVisual();
    return api.getState();
  };
  api.setSound = function (on) { soundOn = !!on; return soundOn; };
  api.isSoundOn = function () { return soundOn; };

  api.update = function (dt, s) {
    if (!rig) return;
    s = s || {}; dt = Math.max(0, Math.min(dt || 0, 0.06));
    if (typeof s.wallDist === 'number' && s.wallDist > 0.05) tracerMax = Math.min(1.8, s.wallDist);
    var yaw = s.yaw || 0, pitch = s.pitch || 0;
    var dyaw = Math.max(-0.25, Math.min(0.25, yaw - lastYaw)), dpitch = Math.max(-0.25, Math.min(0.25, pitch - lastPitch));
    lastYaw = yaw; lastPitch = pitch;
    var k = 1 - Math.exp(-dt * 11);
    swayX += (-dyaw * 0.16 - swayX) * k; swayY += (dpitch * 0.13 - swayY) * k;
    swayRX += (-dpitch * 0.18 - swayRX) * k; swayRY += (-dyaw * 0.22 - swayRY) * k;

    /* 规则层：C++ 核心按 dt 结算换弹 / 连发；纯 JS 兜底才走定时器 + 时间戳 */
    var c = core();
    if (c) {
      if (!coreSynced) { c.setWeapon(WEAPON_ID[current] === undefined ? -1 : WEAPON_ID[current]); coreSynced = true; }
      var ev = c.stepWeapon(dt);
      if (ev & 1) {                              // 换弹完成
        reloading = false; reloadEndT = 0;
        resetReloadAnim();
        for (var ci2 = 0; ci2 < ammoCallbacks.length; ci2++) {
          try { ammoCallbacks[ci2](api.getAmmo()); } catch (e2) {}
        }
      }
      if (ev & 2) fireVisual();                  // 自动模式击发
      fireMode = c.getMode();
    } else if (triggerHeld && fireMode === 'auto' && supportsAuto(current) && !isKnife(current)) {
      var now = Date.now(), interval = (WEAPON_DEFS[current].delay || 0.1) * 1000;
      if (now - lastShotT >= interval) api.fire();
    }

    recoilImpulse *= Math.exp(-dt * 13); if (recoilImpulse < 0.001) recoilImpulse = 0;
    var kUp = 1 - Math.exp(-dt * 50), kDown = 1 - Math.exp(-dt * 11);
    recoil += (recoilImpulse - recoil) * (recoilImpulse > recoil ? kUp : kDown);
    if (recoil < 0.0005) recoil = 0;

    if (flashT > 0) { flashT -= dt; if (flashT <= 0 && muzzle) muzzle.visible = false; }
    updateTracer(dt); updateShells(dt);
    if (swingT > 0) { swingT -= dt * 4.6; if (swingT < 0) swingT = 0; }
    var sw = swingT > 0 ? Math.sin((1 - swingT) * Math.PI) : 0;

    if (handsGroup) {
      var pk = 1 - Math.exp(-dt * 10);
      handsGroup.position.x += (pose.x - handsGroup.position.x) * pk;
      handsGroup.position.y += (pose.y - handsGroup.position.y) * pk;
      handsGroup.position.z += (pose.z - handsGroup.position.z) * pk;
      var ns = handsGroup.scale.x + (pose.s - handsGroup.scale.x) * pk;
      handsGroup.scale.setScalar(ns);
    }

    /* 换弹姿态按真实时间推进（低帧率不卡帧），返回枪身要叠加的偏移 */
    var ra = updateReloadAnim();

    /* 开镜 ADS：枪移到视野中线、瞄具对准准星；FOV 按倍率收窄 */
    if (gunPivot) {
      var gk = 1 - Math.exp(-dt * 12);
      var tx = 0.16, ty = -0.19, tz = -0.52, rx = 0, rz = 0;
      if (isKnife(current)) {
        tx = 0.16 - sw * 0.13; ty = -0.19 + sw * 0.09; rx = -0.32 - sw * 0.45; rz = -0.20 - sw * 1.15;
      } else if (aiming) {
        /* 红点/全息：瞄具靠近中心；机械/高倍镜：枪身下移让开，准星由 HTML 覆盖层画 */
        if (optic === 'scope3' || optic === 'scopeZ' || optic === 'iron') { tx = 0.02; ty = -0.30; tz = -0.42; }
        else { tx = 0.0; ty = -0.09; tz = -0.36; }
      }
      if (reloading) {   // 换弹姿态压过 ADS，枪身略倾斜露出弹匣井
        tx += ra.dx; ty += ra.dy; tz += ra.dz;
        rx += ra.rx; rz += ra.rz;
      }
      gunPivot.position.x += (tx - gunPivot.position.x) * gk;
      gunPivot.position.y += (ty - gunPivot.position.y) * gk;
      gunPivot.position.z += (tz - gunPivot.position.z) * gk;
      gunPivot.rotation.x += (rx - gunPivot.rotation.x) * gk;
      gunPivot.rotation.z += (rz - gunPivot.rotation.z) * gk;
    }
    var adsZoom = (optic === 'iron') ? 1.25 : OPTICS[optic].zoom;  // 机械瞄具开镜也轻微放大，给明确反馈
    var targetFov = aiming ? Math.max(12, baseFov / adsZoom) : baseFov;
    fovNow += (targetFov - fovNow) * (1 - Math.exp(-dt * 12));
    if (camera && Math.abs(camera.fov - fovNow) > 0.01) { camera.fov = fovNow; camera.updateProjectionMatrix(); }

    var bob = s.bob || 0, moving = !!s.moving;
    var by = Math.sin(bob) * (moving ? 0.010 : 0.003) * (aiming ? 0.3 : 1);
    var bx = Math.cos(bob * 0.5) * (moving ? 0.008 : 0.002) * (aiming ? 0.3 : 1);
    /* 蹲下/跳跃时枪身轻微随动：蹲下下沉+抬头，跳起上抬+压枪 */
    var cr = clamp01(s.crouch || 0), jp = clamp01((s.jump || 0) / 0.8);
    crouchAmt += (cr - crouchAmt) * (1 - Math.exp(-dt * 10));
    jumpAmt += (jp - jumpAmt) * (1 - Math.exp(-dt * 14));
    rig.position.set(bx + swayX + recoil * 0.002,
                     by + swayY - recoil * 0.010 - crouchAmt * 0.012 + jumpAmt * 0.010,
                     recoil * 0.026);
    rig.rotation.set(swayRX - recoil * 0.042 + crouchAmt * 0.045 - jumpAmt * 0.035,
                     swayRY + recoil * 0.006, -recoil * 0.004);
  };

  api.getState = function () {
    var p = null;
    if (muzzle) { var v = new T.Vector3(); muzzle.getWorldPosition(v); p = { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) }; }
    return {
      weapon: current, type: (WEAPON_DEFS[current] || {}).type || 'gun',
      yaw: +lastYaw.toFixed(4), pitch: +lastPitch.toFixed(4),
      recoil: +recoil.toFixed(3), firing: flashT > 0 || tracerT > 0 || swingT > 0,
      fireMode: fireMode, optic: optic, zoom: +OPTICS[optic].zoom.toFixed(2), aiming: aiming,
      ammo: api.getAmmo(), reloading: reloading,
      reloadProgress: reloading ? +clamp01((Date.now() - reloadStartT) / (reloadDur * 1000)).toFixed(2) : 0,
      crouch: +crouchAmt.toFixed(3), jump: +jumpAmt.toFixed(3),
      muzzle: p, t: Date.now()
    };
  };

  var remoteState = null;
  api.applyRemoteState = function (state) { if (state) remoteState = state; };
  api.getRemoteState = function () { return remoteState; };

  api.__debugFx = function () {
    var wp = function (o) { var v = new T.Vector3(); o.getWorldPosition(v); return [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]; };
    var liveShells = 0; for (var i = 0; i < shells.length; i++) if (shells[i].visible) liveShells++;
    return { load: getLoadState(), cache: Object.keys(cache), weapon: current,
      fireMode: fireMode, optic: optic, zoom: OPTICS[optic].zoom, aiming: aiming, fov: fovNow,
      muzzle: muzzle ? { visible: muzzle.visible, pos: wp(muzzle) } : null,
      tracer: tracer ? { lineVisible: tracer.line.visible, opacity: tracer.line.material.opacity } : null,
      shellsLive: liveShells, swingT: +swingT.toFixed(3), flashT: +flashT.toFixed(3),
      tracerT: +tracerT.toFixed(3), recoil: +recoil.toFixed(3),
      triggerHeld: triggerHeld, lastShotT: lastShotT, delay: (WEAPON_DEFS[current]||{}).delay,
      ammo: api.getAmmo(), reloadT: reloading ? +((Date.now() - reloadStartT) / 1000).toFixed(2) : 0,
      reloadProgress: reloading ? +clamp01((Date.now() - reloadStartT) / (reloadDur * 1000)).toFixed(2) : 0,
      magOld: magOld ? { visible: magOld.visible, pos: wp(magOld) } : null,
      magNew: magNew ? { visible: magNew.visible, pos: wp(magNew) } : null,
      leftArm: leftArm ? { pos: [+leftArm.position.x.toFixed(3), +leftArm.position.y.toFixed(3), +leftArm.position.z.toFixed(3)],
                           rot: [+leftArm.rotation.x.toFixed(3), +leftArm.rotation.y.toFixed(3), +leftArm.rotation.z.toFixed(3)] } : null,
      audio: { on: soundOn, state: audioCtx ? audioCtx.state : 'none' } };
  };

  window.__VIEWMODEL__ = api;
})();
