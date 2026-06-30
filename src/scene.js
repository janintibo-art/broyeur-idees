import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// =============================================================
//  LA SCENE 3D : un punk 3D (Meshy) qui broie lentement un
//  parchemin sur lequel s'affiche la pensee noire ecrite.
// =============================================================

let renderer, scene, camera, clock;
let leftRoller, rightRoller, lever;
let sparks, sparkVel = [];
let shards = [];
let paper = null;
let grind = 0;
let shake = 0;
let reduceMotion = false;

// --- le punk (GLB) ---
let mixer = null;
let idleAction = null;
let punchClip = null;

// --- le parchemin (image) ---
let parchmentImg = null;
let parchmentReady = false;

const NEON = [0xc6ff3f, 0xff2d7e, 0xffd400, 0x36e0ff];

// Animations Meshy : repos / quand on broie
const IDLE_CLIP = 'Talk_with_Right_Hand_Open';
const GRIND_CLIP = 'Punch_Combo_5';

// --- cadrage camera (regle ici si besoin) ---
const CAM = { x: -0.3, y: 2.2, z: 9.5 };
const LOOK = { x: -0.3, y: 1.4, z: 0.5 };

// duree de descente du parchemin (en secondes) -> plus grand = plus lent
const DROP_DURATION = 2.6;

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
  glowG.position.set(-4, 3, 1);
  scene.add(glowG);
  const glowM = new THREE.PointLight(0xff2d7e, 26, 26, 2);
  glowM.position.set(4.5, 2.2, -1);
  scene.add(glowM);

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

// ---------- decors ----------
function buildFloor() {
  const grid = new THREE.GridHelper(60, 60, 0x2a2f35, 0x14171b);
  scene.add(grid);
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x0d0f12, metalness: 0.1, roughness: 0.95 })
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.y = -0.01;
  scene.add(slab);
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
  funnel.position.y = 3.0;
  funnel.rotation.y = Math.PI / 4;
  g.add(funnel);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.25, 1.5), metalDark());
  housing.position.y = 1.55;
  g.add(housing);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.52, 0.22, 1.52),
    new THREE.MeshStandardMaterial({ color: 0xffd400, metalness: 0.2, roughness: 0.6, emissive: 0x3a2f00, emissiveIntensity: 0.4 })
  );
  stripe.position.y = 2.05;
  g.add(stripe);

  leftRoller = makeRoller(metalRoller());
  leftRoller.position.set(-0.42, 1.55, 0.15);
  g.add(leftRoller);
  rightRoller = makeRoller(metalRoller());
  rightRoller.position.set(0.42, 1.55, 0.15);
  g.add(rightRoller);

  const chute = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x191c20, metalness: 0.6, roughness: 0.7, side: THREE.DoubleSide })
  );
  chute.position.set(0, 0.75, 0.95);
  chute.rotation.x = -Math.PI / 3.1;
  g.add(chute);

  lever = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 10), metalRoller());
  arm.position.y = 0.65;
  lever.add(arm);
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xff2d7e, emissive: 0xff2d7e, emissiveIntensity: 0.5, roughness: 0.4 })
  );
  knob.position.y = 1.3;
  lever.add(knob);
  lever.position.set(1.5, 1.4, 0.2);
  g.add(lever);

  scene.add(g);
}

function makeRoller(mat) {
  const r = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 2.0, 18), mat);
  cyl.rotation.z = Math.PI / 2;
  r.add(cyl);
  const tooth = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  for (let i = 0; i < 9; i++) {
    for (let a = 0; a < 6; a++) {
      const t = new THREE.Mesh(tooth, mat);
      const ang = (a / 6) * Math.PI * 2 + (i % 2) * 0.5;
      const rad = 0.4;
      t.position.set(-0.95 + i * 0.22, Math.cos(ang) * rad, Math.sin(ang) * rad);
      t.rotation.x = ang;
      r.add(t);
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

// ---------- le punk (GLB) ----------
function loadPunk() {
  const url = (import.meta.env.BASE_URL || './') + 'punk.glb';
  const loader = new GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      scene.add(model);

      model.updateWorldMatrix(true, true);
      let box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const s = 1.9 / (size.y || 1);
      model.scale.setScalar(s);
      model.updateWorldMatrix(true, true);
      box = new THREE.Box3().setFromObject(model);

      model.position.x = -1.6;                 // a gauche du broyeur, dans le cadre
      model.position.z = 1.0;
      model.position.y -= box.min.y;           // pieds au sol
      model.rotation.y = Math.PI * 0.30;       // <-- oriente le punk (ajuste si besoin ; +Math.PI le retourne)

      model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });

      mixer = new THREE.AnimationMixer(model);
      const byName = {};
      gltf.animations.forEach((c) => { byName[c.name] = c; });
      const idleClip = byName[IDLE_CLIP] || gltf.animations[0];
      punchClip = byName[GRIND_CLIP] || byName['Seated_Fist_Pump'] || gltf.animations[0];
      if (idleClip) {
        idleAction = mixer.clipAction(idleClip);
        idleAction.play();
      }
    },
    undefined,
    (err) => {
      console.warn('Modele punk non charge, fallback simple.', err);
      buildFallbackPunk();
    }
  );
}

function buildFallbackPunk() {
  const p = new THREE.Group();
  p.position.set(-1.6, 0, 1.0);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.6 })
  );
  body.position.y = 1.1;
  p.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.46, 0.42),
    new THREE.MeshStandardMaterial({ color: 0xe7b48d, roughness: 0.8 })
  );
  head.position.y = 2.0;
  p.add(head);
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: NEON[i % NEON.length], emissive: NEON[i % NEON.length], emissiveIntensity: 0.9 })
    );
    c.position.set(0, 2.4, -0.16 + i * 0.08);
    p.add(c);
  }
  scene.add(p);
}

function punkPunch() {
  if (!mixer || !punchClip || !idleAction) return;
  const a = mixer.clipAction(punchClip);
  a.reset();
  a.setLoop(THREE.LoopOnce, 1);
  a.clampWhenFinished = true;
  a.enabled = true;
  a.fadeIn(0.12);
  a.play();
  idleAction.fadeOut(0.12);
  const onFinished = (e) => {
    if (e.action === a) {
      mixer.removeEventListener('finished', onFinished);
      idleAction.reset();
      idleAction.fadeIn(0.25);
      idleAction.play();
      a.fadeOut(0.25);
    }
  };
  mixer.addEventListener('finished', onFinished);
}

// ---------- etincelles ----------
function buildSparks() {
  const N = 70;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xfff3b0, size: 0.09, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  sparks = new THREE.Points(geo, mat);
  scene.add(sparks);
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
//  BROYER : on cree le parchemin avec le texte, il descend
//  lentement, puis il est broye.
// =============================================================
export function grindThought(text) {
  if (paper) shredPaper();
  paper = makePaper(text);
  paper.userData.t = 0;
  scene.add(paper);
}

// choisit la plus grande taille de police qui rentre, et renvoie les lignes
function fitText(ctx, text, maxW, maxH, maxFont, minFont) {
  for (let fs = maxFont; fs >= minFont; fs -= 2) {
    ctx.font = '700 ' + fs + 'px Georgia, "Times New Roman", serif';
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    const lh = fs * 1.2;
    if (lines.length * lh <= maxH) return { fs, lines, lh };
  }
  ctx.font = '700 ' + minFont + 'px Georgia, serif';
  return { fs: minFont, lines: [text], lh: minFont * 1.2 };
}

function makePaper(text) {
  const W = 820, H = 910;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  if (parchmentReady) {
    ctx.drawImage(parchmentImg, 0, 0, W, H);
  } else {
    // secours : rectangle parchemin si l'image n'est pas prete
    ctx.fillStyle = '#d9c79c';
    ctx.fillRect(W * 0.1, H * 0.08, W * 0.8, H * 0.84);
  }

  // zone d'ecriture (interieur du parchemin, hors enroulements)
  const x0 = W * 0.18, x1 = W * 0.82;
  const y0 = H * 0.20, y1 = H * 0.80;
  const innerW = x1 - x0, innerH = y1 - y0;

  const t = String(text || '').trim();
  const { lines, lh } = fitText(ctx, t, innerW, innerH, 78, 30);

  ctx.fillStyle = '#2c1c08';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = (x0 + x1) / 2;
  const startY = (y0 + y1) / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lh));

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const PW = 1.55, PH = PW * (H / W);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PW, PH),
    new THREE.MeshStandardMaterial({
      map: tex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.3,
      roughness: 0.95, metalness: 0
    })
  );
  mesh.position.set(0.45, 3.9, 1.1);
  return mesh;
}

function shredPaper() {
  if (!paper) return;
  const tans = [0xcdb78a, 0xb59a68, 0xe2d3a8];
  const px = paper.position.x;
  const count = reduceMotion ? 18 : 50;
  for (let i = 0; i < count; i++) {
    const useNeon = Math.random() < 0.16;
    const col = new THREE.Color(useNeon ? NEON[(Math.random() * NEON.length) | 0] : tans[(Math.random() * tans.length) | 0]);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15 + Math.random() * 0.12, 0.06 + Math.random() * 0.06),
      new THREE.MeshStandardMaterial({
        color: col, side: THREE.DoubleSide, transparent: true, opacity: 1,
        roughness: 0.9, emissive: useNeon ? col : 0x000000, emissiveIntensity: useNeon ? 0.7 : 0
      })
    );
    m.position.set(px + (Math.random() - 0.5) * 0.7, 1.5, 0.2 + (Math.random() - 0.5) * 0.4);
    m.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 3.2, -Math.random() * 1.5 - 0.5, (Math.random() - 0.5) * 3.2 + 1.2);
    m.userData.rot = new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12);
    m.userData.life = 1;
    scene.add(m);
    shards.push(m);
  }
  paper.geometry.dispose();
  if (paper.material.map) paper.material.map.dispose();
  paper.material.dispose();
  scene.remove(paper);
  paper = null;

  burstSparks(px);
  grind = 1;
  shake = reduceMotion ? 0.04 : 0.16;
  punkPunch();
  playGrindSound();
}

// =============================================================
//  BOUCLE D'ANIMATION
// =============================================================
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (mixer) mixer.update(dt);

  const spin = 1.2 + grind * 26;
  if (leftRoller) leftRoller.rotation.x += spin * dt;
  if (rightRoller) rightRoller.rotation.x -= spin * dt;
  if (lever) lever.rotation.x = (grind > 0.05 ? Math.sin(time * 22) * 0.22 : 0) - 0.05;

  // parchemin : descente lente et lisible, puis broyage
  if (paper) {
    const u = paper.userData;
    u.t += dt;
    const k = Math.min(u.t / DROP_DURATION, 1);
    const yTop = 3.9, yRollers = 1.75;
    paper.position.y = yTop - (yTop - yRollers) * k;
    paper.rotation.z = Math.sin(time * 1.6) * 0.05 * (1 - k * 0.5);
    paper.rotation.x = k > 0.8 ? (k - 0.8) / 0.2 * 0.7 : 0; // s'incline en entrant dans les rouleaux
    if (k >= 1) shredPaper();
  }

  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    const u = s.userData;
    u.vel.y -= 6 * dt;
    s.position.addScaledVector(u.vel, dt);
    s.rotation.x += u.rot.x * dt;
    s.rotation.y += u.rot.y * dt;
    s.rotation.z += u.rot.z * dt;
    u.life -= dt * 0.8;
    s.material.opacity = Math.max(u.life, 0);
    if (u.life <= 0 || s.position.y < -1) {
      s.geometry.dispose(); s.material.dispose(); scene.remove(s);
      shards.splice(i, 1);
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
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

let audioCtx = null;
function playGrindSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    const dur = 0.5;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5);
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass';
    filter.frequency.value = 220; filter.Q.value = 0.7;
    const gain = ctx.createGain(); gain.gain.value = 0.35;
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start();
  } catch (e) { /* pas de son, pas grave */ }
}
