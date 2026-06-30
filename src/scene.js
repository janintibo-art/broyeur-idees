import * as THREE from 'three';

// =============================================================
//  LA SCENE 3D : un punk qui actionne un broyeur a pensees.
//  Aucun fichier externe (modele, font) : tout est construit
//  avec des primitives -> ca marche hors-ligne dans l'APK.
// =============================================================

let renderer, scene, camera, clock;
let leftRoller, rightRoller, lever;
let punk = {};
let sparks, sparkVel = [];
let shards = [];          // confettis de papier broye, vivants
let paper = null;         // la feuille en train de tomber
let grind = 0;            // intensite de broyage 0..1 (decroit)
let shake = 0;            // secousse camera
let reduceMotion = false;

const NEON = [0xc6ff3f, 0xff2d7e, 0xffd400, 0x36e0ff];

export function initScene(canvas) {
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0a, 0.055);

  camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  camera.position.set(0.4, 1.9, 7.2);

  // ---- Lumieres ----
  scene.add(new THREE.AmbientLight(0x5a5a66, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(4, 9, 6);
  scene.add(key);
  const glowG = new THREE.PointLight(0xc6ff3f, 30, 26, 2);
  glowG.position.set(-4, 3, 1);
  scene.add(glowG);
  const glowM = new THREE.PointLight(0xff2d7e, 30, 26, 2);
  glowM.position.set(4.5, 2.2, -1);
  scene.add(glowM);

  buildFloor();
  buildGrinder();
  buildPunk();
  buildSparks();

  clock = new THREE.Clock();
  resize();
  window.addEventListener('resize', resize);
  renderer.setAnimationLoop(tick);
}

// ---------- decors ----------
function buildFloor() {
  const grid = new THREE.GridHelper(60, 60, 0x2a2f35, 0x14171b);
  grid.position.y = 0;
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

  // Entonnoir (cylindre a 4 faces, ouvert)
  const funnel = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 0.75, 1.5, 4, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x2b2f35, metalness: 0.8, roughness: 0.5, side: THREE.DoubleSide })
  );
  funnel.position.y = 3.0;
  funnel.rotation.y = Math.PI / 4;
  g.add(funnel);

  // Caisson
  const housing = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.25, 1.5), metalDark());
  housing.position.y = 1.55;
  g.add(housing);

  // Bande "danger" jaune et noir
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.52, 0.22, 1.52),
    new THREE.MeshStandardMaterial({ color: 0xffd400, metalness: 0.2, roughness: 0.6, emissive: 0x3a2f00, emissiveIntensity: 0.4 })
  );
  stripe.position.y = 2.05;
  g.add(stripe);

  // Deux rouleaux dentes contrarotatifs
  leftRoller = makeRoller(metalRoller());
  leftRoller.position.set(-0.42, 1.55, 0.15);
  g.add(leftRoller);
  rightRoller = makeRoller(metalRoller());
  rightRoller.position.set(0.42, 1.55, 0.15);
  g.add(rightRoller);

  // Goulotte de sortie
  const chute = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x191c20, metalness: 0.6, roughness: 0.7, side: THREE.DoubleSide })
  );
  chute.position.set(0, 0.75, 0.95);
  chute.rotation.x = -Math.PI / 3.1;
  g.add(chute);

  // Levier (le punk tire dessus)
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
  lever.position.set(-1.5, 1.4, 0.2);
  g.add(lever);

  scene.add(g);
}

function makeRoller(mat) {
  const r = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 2.0, 18), mat);
  cyl.rotation.z = Math.PI / 2; // couche le cylindre le long de X
  r.add(cyl);
  // dents
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

// ---------- le punk ----------
function buildPunk() {
  const p = new THREE.Group();
  p.position.set(-2.6, 0, 0.7);
  p.rotation.y = 0.5; // tourne vers le broyeur

  const skin = new THREE.MeshStandardMaterial({ color: 0xe7b48d, roughness: 0.8, metalness: 0 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.55, metalness: 0.25 });
  const denim = new THREE.MeshStandardMaterial({ color: 0x1d2733, roughness: 0.85 });
  const stud = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, metalness: 1, roughness: 0.25, emissive: 0x222222, emissiveIntensity: 0.3 });

  // jambes
  const legGeo = new THREE.BoxGeometry(0.26, 1.0, 0.28);
  const legL = new THREE.Mesh(legGeo, denim); legL.position.set(-0.18, 0.5, 0); p.add(legL);
  const legR = new THREE.Mesh(legGeo, denim); legR.position.set(0.18, 0.5, 0); p.add(legR);
  // bottes
  const bootGeo = new THREE.BoxGeometry(0.3, 0.22, 0.42);
  const bL = new THREE.Mesh(bootGeo, leather); bL.position.set(-0.18, 0.11, 0.06); p.add(bL);
  const bR = new THREE.Mesh(bootGeo, leather); bR.position.set(0.18, 0.11, 0.06); p.add(bR);

  // torse (perfecto)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.8, 0.4), leather);
  torso.position.y = 1.4;
  p.add(torso);
  // clous d'epaule
  for (let i = -1; i <= 1; i += 2) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), stud);
    s.position.set(i * 0.28, 1.74, 0.18); p.add(s);
  }

  // bras
  const armGeo = new THREE.BoxGeometry(0.18, 0.62, 0.2);
  punk.armL = new THREE.Group();
  const armLmesh = new THREE.Mesh(armGeo, leather); armLmesh.position.y = -0.31;
  punk.armL.add(armLmesh);
  punk.armL.position.set(-0.42, 1.7, 0.05);
  p.add(punk.armL);

  punk.armR = new THREE.Group();
  const armRmesh = new THREE.Mesh(armGeo, leather); armRmesh.position.y = -0.31;
  punk.armR.add(armRmesh);
  punk.armR.position.set(0.42, 1.7, 0.05);
  p.add(punk.armR);

  // tete
  punk.head = new THREE.Group();
  punk.head.position.y = 1.98;
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.42), skin);
  punk.head.add(headMesh);
  // lunettes noires
  const shades = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.1, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.3, metalness: 0.4 })
  );
  shades.position.set(0, 0.03, 0.22);
  punk.head.add(shades);
  // crete (mohawk) : rangee de cones neon
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.34 - Math.abs(i - 2) * 0.04, 8),
      new THREE.MeshStandardMaterial({
        color: NEON[i % NEON.length],
        emissive: NEON[i % NEON.length],
        emissiveIntensity: 0.9,
        roughness: 0.5
      })
    );
    c.position.set(0, 0.42, -0.16 + i * 0.08);
    punk.head.add(c);
  }
  p.add(punk.head);

  scene.add(p);
  punk.group = p;
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
//  BROYER UNE PENSEE  (appelee depuis main.js)
// =============================================================
export function grindThought(text) {
  if (paper) shredPaper();          // s'il restait une feuille, on la broie direct
  paper = makePaper(text);
  paper.userData.t = 0;
  scene.add(paper);
}

function makePaper(text) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 320;
  const ctx = cv.getContext('2d');
  // fond papier
  ctx.fillStyle = '#ece7d9';
  ctx.fillRect(0, 0, cv.width, cv.height);
  // taches / grain
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.05) + ')';
    ctx.fillRect(Math.random() * cv.width, Math.random() * cv.height, 2, 2);
  }
  // texte noir, facon machine a ecrire
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
  // rature rouge punk
  ctx.strokeStyle = 'rgba(255,45,126,0.85)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(40, 70); ctx.lineTo(cv.width - 50, cv.height - 80);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(cv);
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
  // confettis
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
  // dispose feuille
  paper.geometry.dispose();
  paper.material.map?.dispose();
  paper.material.dispose();
  scene.remove(paper);
  paper = null;

  burstSparks();
  grind = 1;
  shake = reduceMotion ? 0.04 : 0.16;
  playGrindSound();
}

// =============================================================
//  BOUCLE D'ANIMATION
// =============================================================
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  // rotation des rouleaux (lente au repos, rapide en broyage)
  const spin = 1.2 + grind * 26;
  if (leftRoller) leftRoller.rotation.x += spin * dt;
  if (rightRoller) rightRoller.rotation.x -= spin * dt;

  // punk : respiration + headbang
  if (punk.group) {
    punk.group.position.y = Math.sin(time * 2) * 0.02;
    const bang = grind > 0.05 ? Math.sin(time * 22) * 0.5 : Math.sin(time * 2.5) * 0.06;
    punk.head.rotation.x = bang;
    punk.armR.rotation.x = -0.6 + (grind > 0.05 ? Math.sin(time * 22) * 0.5 : 0);
    punk.armL.rotation.x = -0.3 + Math.sin(time * 2) * 0.05;
  }
  if (lever) lever.rotation.x = (grind > 0.05 ? Math.sin(time * 22) * 0.35 : 0) - 0.1;

  // feuille qui tombe dans l'entonnoir
  if (paper) {
    const u = paper.userData;
    u.t += dt;
    const dur = 0.5;
    const k = Math.min(u.t / dur, 1);
    paper.position.y = 4.4 - k * 2.95;     // 4.4 -> ~1.45
    paper.position.x = 0.6 + (paper.position.x - 0.6) * (1 - dt * 4);
    paper.rotation.z = Math.sin(u.t * 18) * 0.25 * (1 - k);
    paper.rotation.x = k * 0.6;
    paper.material.opacity = 1;
    if (k >= 1) shredPaper();
  }

  // confettis
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    const u = s.userData;
    u.vel.y -= 6 * dt;                      // gravite
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

  // etincelles
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

  // decroissance broyage + secousse
  grind = Math.max(grind - dt * 1.1, 0);
  shake = Math.max(shake - dt * 0.6, 0);

  camera.position.x = 0.4 + (Math.random() - 0.5) * shake;
  camera.position.y = 1.9 + (Math.random() - 0.5) * shake;
  camera.lookAt(0.6, 1.5, 0.2);

  renderer.render(scene, camera);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// petit son de broyage synthetise (Web Audio), sans fichier
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
