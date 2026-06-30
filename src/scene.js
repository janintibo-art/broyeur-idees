import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// =============================================================
//  SCENE 3D : un punk 3D (Meshy) a DROITE pres du levier, qui
//  broie lentement un parchemin -> explosion de smileys colores.
// =============================================================

let renderer, scene, camera, clock;
let leftRoller, rightRoller, lever;
let sparks, sparkVel = [];
let shards = [];           // smileys colores en vol
let paper = null;
let grind = 0, shake = 0;
let reduceMotion = false;

let mixer = null, idleAction = null, punchClip = null, fallbackPunk = null;
let punkRoot = null, analyser = null, freqData = null, beat = 0;
let parchmentImg = null, parchmentReady = false;
let SMILEY_TEX = [];

const NEON = [0xc6ff3f, 0xff2d7e, 0xffd400, 0x36e0ff];
const IDLE_CLIP = 'Talk_with_Right_Hand_Open';
const GRIND_CLIP = 'Punch_Combo_5';

// --- reglages ---
const CAM = { x: 1.0, y: 2.4, z: 9.3 };
const LOOK = { x: 1.0, y: 1.8, z: 0.5 };
const PUNK = { x: 2.4, y: 0, z: 0.9, ry: -Math.PI * 0.30 }; // a droite du levier ; ry = orientation (+Math.PI le retourne) ; y = hauteur
const DROP_DURATION = 2.6;

const SMILEY_COLORS = ['#ff4d4d', '#ff9f1c', '#ffd400', '#5cd85c', '#36e0ff',
  '#4d79ff', '#b15cff', '#ff2d7e', '#c6ff3f', '#ff5cf0', '#ff7a00', '#00e6a8'];

export function initScene(canvas) {
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0a, 0.028);

  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(CAM.x, CAM.y, CAM.z);

  scene.add(new THREE.AmbientLight(0x6a6a78, 1.3));
  scene.add(new THREE.HemisphereLight(0x8899ff, 0x201a15, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.7);
  key.position.set(4, 9, 6);
  scene.add(key);
  const glowG = new THREE.PointLight(0xc6ff3f, 26, 26, 2);
  glowG.position.set(-4, 3, 1); scene.add(glowG);
  const glowM = new THREE.PointLight(0xff2d7e, 26, 26, 2);
  glowM.position.set(4.5, 2.2, -1); scene.add(glowM);

  // projecteur braque sur le punk + halo vert punk
  const punkSpot = new THREE.SpotLight(0xffffff, 120, 16, Math.PI / 6, 0.6, 1.0);
  punkSpot.position.set(PUNK.x + 1.0, 5.0, PUNK.z + 3.0);
  punkSpot.target.position.set(PUNK.x, 1.0, PUNK.z);
  scene.add(punkSpot); scene.add(punkSpot.target);
  const punkRim = new THREE.PointLight(0xc6ff3f, 14, 9, 2);
  punkRim.position.set(PUNK.x - 0.8, 1.7, PUNK.z + 0.6);
  scene.add(punkRim);

  buildSmileys();
  buildFloor();
  buildGrinder();
  buildSparks();
  loadParchment();
  loadPunk();

  clock = new THREE.Clock();
  resize();
  window.addEventListener('resize', resize);
  renderer.setAnimationLoop(tick);
}

// reçoit l'analyseur audio (depuis main.js) pour faire headbanguer le punk en rythme
export function setAudioAnalyser(a) {
  analyser = a;
  freqData = new Uint8Array(a.frequencyBinCount);
}

// ---------- smileys (textures dessinees) ----------
function buildSmileys() {
  SMILEY_TEX = SMILEY_COLORS.map((hex) => {
    const S = 128;
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const c = cv.getContext('2d');
    c.fillStyle = hex;
    c.beginPath(); c.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2); c.fill();
    c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.stroke();
    c.fillStyle = '#141414';
    c.beginPath(); c.arc(S * 0.38, S * 0.44, S * 0.07, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(S * 0.62, S * 0.44, S * 0.07, 0, Math.PI * 2); c.fill();
    c.lineWidth = 8; c.strokeStyle = '#141414'; c.lineCap = 'round';
    c.beginPath(); c.arc(S / 2, S * 0.52, S * 0.22, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  });
}

// ---------- decors ----------
function buildFloor() {
  const grid = new THREE.GridHelper(60, 60, 0x2a2f35, 0x14171b);
  scene.add(grid);
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x0d0f12, metalness: 0.1, roughness: 0.95 })
  );
  slab.rotation.x = -Math.PI / 2; slab.position.y = -0.01; scene.add(slab);
}

const metalDark = () => new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0.85, roughness: 0.45 });
const metalRoller = () => new THREE.MeshStandardMaterial({ color: 0x70767e, metalness: 1, roughness: 0.3 });

function buildGrinder() {
  const g = new THREE.Group();
  g.position.set(0.6, 0, 0);

  const funnel = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 0.75, 1.5, 4, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x2b2f35, metalness: 0.8, roughness: 0.5, side: THREE.DoubleSide })
  );
  funnel.position.y = 3.0; funnel.rotation.y = Math.PI / 4; g.add(funnel);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.25, 1.5), metalDark());
  housing.position.y = 1.55; g.add(housing);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.52, 0.22, 1.52),
    new THREE.MeshStandardMaterial({ color: 0xffd400, metalness: 0.2, roughness: 0.6, emissive: 0x3a2f00, emissiveIntensity: 0.4 })
  );
  stripe.position.y = 2.05; g.add(stripe);

  leftRoller = makeRoller(metalRoller()); leftRoller.position.set(-0.42, 1.55, 0.15); g.add(leftRoller);
  rightRoller = makeRoller(metalRoller()); rightRoller.position.set(0.42, 1.55, 0.15); g.add(rightRoller);

  const chute = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x191c20, metalness: 0.6, roughness: 0.7, side: THREE.DoubleSide })
  );
  chute.position.set(0, 0.75, 0.95); chute.rotation.x = -Math.PI / 3.1; g.add(chute);

  lever = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 10), metalRoller());
  arm.position.y = 0.65; lever.add(arm);
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xff2d7e, emissive: 0xff2d7e, emissiveIntensity: 0.5, roughness: 0.4 })
  );
  knob.position.y = 1.3; lever.add(knob);
  lever.position.set(1.5, 1.4, 0.2); g.add(lever);

  scene.add(g);
}

function makeRoller(mat) {
  const r = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 2.0, 18), mat);
  cyl.rotation.z = Math.PI / 2; r.add(cyl);
  const tooth = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  for (let i = 0; i < 9; i++) {
    for (let a = 0; a < 6; a++) {
      const t = new THREE.Mesh(tooth, mat);
      const ang = (a / 6) * Math.PI * 2 + (i % 2) * 0.5;
      t.position.set(-0.95 + i * 0.22, Math.cos(ang) * 0.4, Math.sin(ang) * 0.4);
      t.rotation.x = ang; r.add(t);
    }
  }
  return r;
}

// ---------- parchemin ----------
function loadParchment() {
  const url = (import.meta.env.BASE_URL || './') + 'parchment.png';
  parchmentImg = new Image();
  parchmentImg.onload = () => { parchmentReady = true; };
  parchmentImg.onerror = () => { parchmentReady = false; };
  parchmentImg.src = url;
}

// ---------- punk (GLB) ----------
function loadPunk() {
  fallbackPunk = buildFallbackPunk(); // cubes visibles pendant le chargement / si echec
  punkRoot = fallbackPunk;

  const url = (import.meta.env.BASE_URL || './') + 'punk.glb';
  const loader = new GLTFLoader();
  loader.load(url, (gltf) => {
    try {
      const model = gltf.scene;
      // Le modele est DEJA a la bonne echelle (~1,70 m) dans le fichier. On ne le
      // redimensionne PAS (l'auto-echelle echoue a cause du squelette anime,
      // scale interne 0.01). On le place, point. Ajuste PUNK.y s'il flotte/s'enfonce.
      const root = new THREE.Group();
      root.add(model);
      root.position.set(PUNK.x, PUNK.y, PUNK.z);
      root.rotation.y = PUNK.ry;
      scene.add(root);
      model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      punkRoot = root;

      if (fallbackPunk) { scene.remove(fallbackPunk); fallbackPunk = null; } // le vrai punk remplace les cubes

      mixer = new THREE.AnimationMixer(model);
      const byName = {};
      gltf.animations.forEach((c) => { byName[c.name] = c; });
      const idleClip = byName[IDLE_CLIP] || gltf.animations[0];
      punchClip = byName[GRIND_CLIP] || byName['Seated_Fist_Pump'] || gltf.animations[0];
      if (idleClip) { idleAction = mixer.clipAction(idleClip); idleAction.play(); }
    } catch (e) {
      console.warn('Erreur init punk (on garde les cubes).', e);
    }
  }, undefined, (err) => {
    console.warn('Modele punk non charge (on garde les cubes).', err);
  });
}

function buildFallbackPunk() {
  const p = new THREE.Group();
  p.position.set(PUNK.x, 0, PUNK.z);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.6 }));
  body.position.y = 1.1; p.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.42),
    new THREE.MeshStandardMaterial({ color: 0xe7b48d, roughness: 0.8 }));
  head.position.y = 2.0; p.add(head);
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: NEON[i % NEON.length], emissive: NEON[i % NEON.length], emissiveIntensity: 0.9 }));
    c.position.set(0, 2.4, -0.16 + i * 0.08); p.add(c);
  }
  scene.add(p);
  return p;
}

function punkPunch() {
  if (!mixer || !punchClip || !idleAction) return;
  const a = mixer.clipAction(punchClip);
  a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.enabled = true;
  a.fadeIn(0.12); a.play(); idleAction.fadeOut(0.12);
  const onFinished = (e) => {
    if (e.action === a) {
      mixer.removeEventListener('finished', onFinished);
      idleAction.reset(); idleAction.fadeIn(0.25); idleAction.play(); a.fadeOut(0.25);
    }
  };
  mixer.addEventListener('finished', onFinished);
}

// ---------- etincelles ----------
function buildSparks() {
  const N = 70;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const mat = new THREE.PointsMaterial({ color: 0xfff3b0, size: 0.09, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  sparks = new THREE.Points(geo, mat); scene.add(sparks);
  for (let i = 0; i < N; i++) sparkVel.push(new THREE.Vector3());
}

function burstSparks(px) {
  const pos = sparks.geometry.attributes.position.array;
  for (let i = 0; i < pos.length / 3; i++) {
    pos[i * 3] = px + (Math.random() - 0.5) * 1.2;
    pos[i * 3 + 1] = 1.55;
    pos[i * 3 + 2] = 0.2 + (Math.random() - 0.5) * 0.3;
    sparkVel[i].set((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 2);
  }
  sparks.geometry.attributes.position.needsUpdate = true;
  sparks.material.opacity = 1;
}

// =============================================================
//  BROYER
// =============================================================
export function grindThought(text) {
  if (paper) shredPaper();
  paper = makePaper(text);
  paper.userData.t = 0;
  scene.add(paper);
}

function fitText(ctx, text, maxW, maxH, maxFont, minFont) {
  for (let fs = maxFont; fs >= minFont; fs -= 2) {
    ctx.font = '700 ' + fs + 'px Georgia, "Times New Roman", serif';
    const words = text.split(/\s+/).filter(Boolean);
    const lines = []; let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    const lh = fs * 1.2;
    if (lines.length * lh <= maxH) return { lines, lh };
  }
  ctx.font = '700 ' + minFont + 'px Georgia, serif';
  return { lines: [text], lh: minFont * 1.2 };
}

function makePaper(text) {
  const W = 820, H = 910;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  if (parchmentReady) ctx.drawImage(parchmentImg, 0, 0, W, H);
  else { ctx.fillStyle = '#d9c79c'; ctx.fillRect(W * 0.1, H * 0.08, W * 0.8, H * 0.84); }

  const x0 = W * 0.18, x1 = W * 0.82, y0 = H * 0.20, y1 = H * 0.80;
  const { lines, lh } = fitText(ctx, String(text || '').trim(), x1 - x0, y1 - y0, 78, 30);
  ctx.fillStyle = '#2c1c08'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cx = (x0 + x1) / 2, startY = (y0 + y1) / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lh));

  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const PW = 1.55, PH = PW * (H / W);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PW, PH),
    new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.3, roughness: 0.95 })
  );
  mesh.position.set(0.45, 3.9, 1.1);
  return mesh;
}

function shredPaper() {
  if (!paper) return;
  const px = paper.position.x;
  const count = reduceMotion ? 16 : 42;
  for (let i = 0; i < count; i++) {
    const tex = SMILEY_TEX[(Math.random() * SMILEY_TEX.length) | 0];
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 1 });
    const sp = new THREE.Sprite(mat);
    const sc = 0.22 + Math.random() * 0.2;
    sp.scale.set(sc, sc, 1);
    sp.position.set(px + (Math.random() - 0.5) * 0.7, 1.6, 0.2 + (Math.random() - 0.5) * 0.4);
    sp.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3.5 + 1.2, (Math.random() - 0.5) * 3 + 1);
    sp.userData.spin = (Math.random() - 0.5) * 7;
    sp.userData.life = 1;
    scene.add(sp); shards.push(sp);
  }
  paper.geometry.dispose();
  if (paper.material.map) paper.material.map.dispose();
  paper.material.dispose();
  scene.remove(paper); paper = null;

  burstSparks(px);
  grind = 1;
  shake = reduceMotion ? 0.04 : 0.16;
  punkPunch();
  playGrindSound();
}

// =============================================================
//  BOUCLE
// =============================================================
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (mixer) mixer.update(dt);

  const spin = 1.2 + grind * 26;
  if (leftRoller) leftRoller.rotation.x += spin * dt;
  if (rightRoller) rightRoller.rotation.x -= spin * dt;
  if (lever) lever.rotation.x = -0.05 - grind * 0.7 + (grind > 0.1 ? Math.sin(time * 30) * 0.05 : 0); // tire d'un coup quand on broie

  // le punk headbangue en rythme avec la musique (analyse audio en direct)
  if (punkRoot) {
    let bass = 0;
    if (analyser && freqData) {
      analyser.getByteFrequencyData(freqData);
      let sum = 0; const n = 8;
      for (let i = 1; i <= n; i++) sum += freqData[i];
      bass = sum / (n * 255);
    }
    beat += (bass - beat) * 0.25;
    const idle = Math.sin(time * 3) * 0.02;
    const energy = beat + grind * 0.4;
    punkRoot.position.y = PUNK.y + idle + energy * 0.16;            // rebond sur le beat
    punkRoot.rotation.x = -energy * 0.22;                            // penche la tete (headbang)
    punkRoot.rotation.z = Math.sin(time * 7) * 0.02 * (0.3 + energy);
  }

  if (paper) {
    const u = paper.userData; u.t += dt;
    const k = Math.min(u.t / DROP_DURATION, 1);
    const yTop = 3.9, yRollers = 1.75;
    paper.position.y = yTop - (yTop - yRollers) * k;
    paper.rotation.z = Math.sin(time * 1.6) * 0.05 * (1 - k * 0.5);
    paper.rotation.x = k > 0.8 ? (k - 0.8) / 0.2 * 0.7 : 0;
    if (k >= 1) shredPaper();
  }

  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i], u = s.userData;
    u.vel.y -= 6 * dt;
    s.position.addScaledVector(u.vel, dt);
    if (s.material) s.material.rotation += u.spin * dt;
    u.life -= dt * 0.5;
    s.material.opacity = Math.max(u.life, 0);
    if (u.life <= 0 || s.position.y < -1) {
      scene.remove(s); s.material.dispose(); shards.splice(i, 1);
    }
  }

  if (sparks.material.opacity > 0) {
    const pos = sparks.geometry.attributes.position.array;
    for (let i = 0; i < pos.length / 3; i++) {
      sparkVel[i].y -= 9 * dt;
      pos[i * 3] += sparkVel[i].x * dt;
      pos[i * 3 + 1] += sparkVel[i].y * dt;
      pos[i * 3 + 2] += sparkVel[i].z * dt;
    }
    sparks.geometry.attributes.position.needsUpdate = true;
    sparks.material.opacity = Math.max(sparks.material.opacity - dt * 2.2, 0);
  }

  grind = Math.max(grind - dt * 1.1, 0);
  shake = Math.max(shake - dt * 0.6, 0);

  camera.position.x = CAM.x + (Math.random() - 0.5) * shake;
  camera.position.y = CAM.y + (Math.random() - 0.5) * shake;
  camera.position.z = CAM.z;
  camera.lookAt(LOOK.x, LOOK.y, LOOK.z);

  renderer.render(scene, camera);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

let audioCtx = null;
function playGrindSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx, dur = 0.5;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 220; filter.Q.value = 0.7;
    const gain = ctx.createGain(); gain.gain.value = 0.3;
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination); src.start();
  } catch (e) { /* pas de son, pas grave */ }
}
