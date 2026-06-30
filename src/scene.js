import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// =============================================================
//  LA SCENE 3D : un vrai punk 3D (modele Meshy) qui broie
//  les pensees noires dans un broyeur a rouleaux.
// =============================================================

let renderer, scene, camera, clock;
let leftRoller, rightRoller, lever;
let sparks, sparkVel = [];
let shards = [];          // confettis de papier broye
let paper = null;         // la feuille en train de tomber
let grind = 0;            // intensite de broyage 0..1 (decroit)
let shake = 0;            // secousse camera
let reduceMotion = false;

// --- le punk (GLB) ---
let mixer = null;
let idleAction = null;
let punchClip = null;
let punkLoaded = false;

const NEON = [0xc6ff3f, 0xff2d7e, 0xffd400, 0x36e0ff];

// Clip joue au repos / clip joue quand on broie (noms du fichier Meshy)
const IDLE_CLIP = 'Talk_with_Right_Hand_Open';
const GRIND_CLIP = 'Punch_Combo_5';

export function initScene(canvas) {
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0a, 0.05);

  camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  camera.position.set(0.4, 1.9, 7.2);

  // ---- Lumieres ----
  scene.add(new THREE.AmbientLight(0x6a6a78, 1.3));
  scene.add(new THREE.HemisphereLight(0x8899ff, 0x201a15, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
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

// =============================================================
//  LE PUNK 3D (modele GLB Meshy : maillage + 12 animations)
// =============================================================
function loadPunk() {
  const url = (import.meta.env.BASE_URL || './') + 'punk.glb';
  const loader = new GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      scene.add(model);

      // mise a l'echelle automatique : ~1.9 d'unite de haut, pieds au sol
      model.updateWorldMatrix(true, true);
      let box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const s = 1.9 / (size.y || 1);
      model.scale.setScalar(s);
      model.updateWorldMatrix(true, true);
      box = new THREE.Box3().setFromObject(model);

      model.position.x = -2.7;                 // a gauche du broyeur
      model.position.z = 0.7;
      model.position.y -= box.min.y;           // pose les pieds sur le sol
      model.rotation.y = Math.PI * 0.30;       // <-- tourne le punk (ajuste si besoin)

      model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });

      // animations
      mixer = new THREE.AnimationMixer(model);
      const byName = {};
      gltf.animations.forEach((c) => { byName[c.name] = c; });
      const idleClip = byName[IDLE_CLIP] || gltf.animations[0];
      punchClip = byName[GRIND_CLIP] || byName['Seated_Fist_Pump'] || gltf.animations[0];
      if (idleClip) {
        idleAction = mixer.clipAction(idleClip);
        idleAction.play();
      }
      punkLoaded = true;
    },
    undefined,
    (err) => {
      console.warn('Modele punk non charge, fallback simple.', err);
      buildFallbackPunk();
    }
  );
}

// punk de secours si le GLB manque (rare)
function buildFallbackPunk() {
  const p = new THREE.Group();
  p.position.set(-2.7, 0, 0.7);
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

// le punk "frappe" la pensee au moment du broyage
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

function burstSparks() {
  const pos = sparks.geometry.attributes.position.array;
  for (let i = 0; i < pos.length / 3; i++) {
    pos[i * 3] = 0.6 + (Math.random() - 0.5) * 1.2;
    pos[i * 3 + 1] = 1.55;
    pos[i * 3 + 2] = 0.2 + (Math.random() - 0.5) * 0.3;
    sparkVel[i].set((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 2);
  }
  sparks.geometry.attributes.position.needsUpdate = true;
  sparks.material.opacity = 1;
}

// =============================================================
//  BROYER UNE PENSEE
// =============================================================
export function grindThought(text) {
  if (paper) shredPaper();
  paper = makePaper(text);
  paper.userData.t = 0;
  scene.add(paper);
}

function makePaper(text) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 320;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ece7d9';
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.05) + ')';
    ctx.fillRect(Math.random() * cv.width, Math.random() * cv.height, 2, 2);
  }
  ctx.fillStyle = '#111';
  ctx.font = '700 40px "Space Mono", "Courier New", monospace';
  ctx.textAlign = 'center';
  const words = String(text || '').toUpperCase().split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).length > 16) { lines.push(line.trim()); line = w; }
    else line += ' ' + w;
  }
  if (line.trim()) lines.push(line.trim());
  const shown = lines.slice(0, 5);
  const startY = cv.height / 2 - (shown.length - 1) * 26;
  shown.forEach((l, i) => ctx.fillText(l, cv.width / 2, startY + i * 52));
  ctx.strokeStyle = 'rgba(255,45,126,0.85)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(40, 70); ctx.lineTo(cv.width - 50, cv.height - 80);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.94),
    new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 })
  );
  mesh.position.set(0.6, 4.4, 0.55);
  return mesh;
}

function shredPaper() {
  if (!paper) return;
  const baseColor = new THREE.Color(0xece7d9);
  const px = paper.position.x;
  const count = reduceMotion ? 18 : 46;
  for (let i = 0; i < count; i++) {
    const useNeon = Math.random() < 0.22;
    const col = useNeon ? new THREE.Color(NEON[(Math.random() * NEON.length) | 0]) : baseColor;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14 + Math.random() * 0.1, 0.05 + Math.random() * 0.05),
      new THREE.MeshStandardMaterial({
        color: col, side: THREE.DoubleSide, transparent: true, opacity: 1,
        roughness: 0.9, emissive: useNeon ? col : 0x000000, emissiveIntensity: useNeon ? 0.7 : 0
      })
    );
    m.position.set(px + (Math.random() - 0.5) * 0.6, 1.45, 0.2 + (Math.random() - 0.5) * 0.4);
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

  burstSparks();
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

  if (paper) {
    const u = paper.userData;
    u.t += dt;
    const dur = 0.5;
    const k = Math.min(u.t / dur, 1);
    paper.position.y = 4.4 - k * 2.95;
    paper.position.x = 0.6 + (paper.position.x - 0.6) * (1 - dt * 4);
    paper.rotation.z = Math.sin(u.t * 18) * 0.25 * (1 - k);
    paper.rotation.x = k * 0.6;
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

  camera.position.x = 0.4 + (Math.random() - 0.5) * shake;
  camera.position.y = 1.9 + (Math.random() - 0.5) * shake;
  camera.lookAt(0.2, 1.4, 0.2);

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
    const dur = 0.45;
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
