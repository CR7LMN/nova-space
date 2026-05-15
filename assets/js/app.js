/* ============================================================
 *  APP.JS — Aplikasi Utama Tata Surya Interaktif (ES Module)
 *  ----------------------------------------------------------
 *  File ini berisi semua logika Three.js:
 *    - Setup scene, camera, renderer
 *    - Pencahayaan (lighting)
 *    - Pembuatan objek (Matahari + 8 planet utama)
 *    - Interaksi (hover, klik, scroll sinematik)
 *    - Animation loop
 * ============================================================ */

(async function init() {

  /* -----------------------------------------------
   *  1. INISIALISASI GSAP & SCROLLTRIGGER
   *  GSAP digunakan untuk animasi kamera yang halus
   *  saat berpindah fokus antar planet.
   * ----------------------------------------------- */
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (gsap && ScrollTrigger) {
    try {
      gsap.registerPlugin(ScrollTrigger);
    } catch (e) {
      console.warn("ScrollTrigger:", e);
    }
  }

  /* -----------------------------------------------
   *  2. REFERENSI ELEMEN DOM
   *  Mengambil elemen-elemen HTML yang akan
   *  dimanipulasi oleh JavaScript.
   * ----------------------------------------------- */
  const wrap = document.getElementById("canvas-wrap");
  const phaseLabel = document.getElementById("phase-label");

  if (!wrap) {
    console.error("canvas-wrap tidak ditemukan");
    return;
  }

  if (window.location.protocol === "file:") {
    if (typeof window.__hideIntroFallback === "function")
      window.__hideIntroFallback();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div style="position:fixed;inset:0;z-index:220;display:flex;align-items:center;justify-content:center;background:#0b1020;color:#e6efff;padding:24px;font-family:system-ui;text-align:center">' +
      "<div><strong>Mode file:// diblokir browser</strong><br>Buka project lewat <strong>http://localhost/solarsystem2/</strong><br><small>Jalankan Apache di XAMPP dulu.</small></div></div>"
    );
    return;
  }

  /* -----------------------------------------------
   *  3. IMPORT THREE.JS & ORBITCONTROLS
   *  Menggunakan dynamic import agar mendukung
   *  importmap. Jika gagal, tampilkan pesan error.
   * ----------------------------------------------- */
  let THREE;
  let OrbitControls;
  let GLTFLoader;
  try {
    THREE = await import("three");
    const oc = await import(
      "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js"
    );
    OrbitControls = oc.OrbitControls;
    const gltfMod = await import(
      "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js"
    );
    GLTFLoader = gltfMod.GLTFLoader;
  } catch (err) {
    console.error(err);
    if (typeof window.__hideIntroFallback === "function")
      window.__hideIntroFallback();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div style="position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:#111;color:#eee;padding:24px;font-family:system-ui;text-align:center">' +
      "<div><strong>Gagal memuat Three.js</strong><br>Buka lewat <strong>http://localhost/...</strong> (Live Server / XAMPP), jangan file://<br><small>" +
      String(err && err.message ? err.message : err) +
      "</small></div></div>"
    );
    return;
  }

  /* -----------------------------------------------
   *  4. SETUP SCENE, CAMERA, RENDERER
   *  Membuat scene 3D, kamera perspektif, dan
   *  WebGL renderer dengan konfigurasi kualitas tinggi.
   * ----------------------------------------------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020208); // Biru-hitam sangat gelap

  // FOV responsif: lebih lebar di mobile agar planet terlihat lebih besar
  function getResponsiveFov() {
    return window.innerWidth < 600 ? 80 : window.innerWidth < 900 ? 70 : 60;
  }

  const camera = new THREE.PerspectiveCamera(
    getResponsiveFov(),
    window.innerWidth / window.innerHeight,
    0.05,
    40000
  );

  // Renderer WebGL dengan anti-aliasing dan tone mapping sinematik
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  const maxPR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(maxPR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2.15;
  wrap.appendChild(renderer.domElement);

  /* -----------------------------------------------
   *  5. ORBIT CONTROLS
   *  Memungkinkan user memutar, zoom, dan pan
   *  pandangan kamera menggunakan mouse/touch.
   * ----------------------------------------------- */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;     // Efek inersia saat memutar
  controls.dampingFactor = 0.06;
  controls.minDistance = 2;          // Jarak zoom minimum
  controls.maxDistance = 10000;       // Jarak zoom maksimum
  controls.maxPolarAngle = Math.PI * 0.495; // Batas rotasi vertikal

  /* -----------------------------------------------
   *  6. PENCAHAYAAN (LIGHTING)
   *  Kombinasi beberapa sumber cahaya untuk
   *  menciptakan iluminasi yang realistis.
   * ----------------------------------------------- */

  // Ambient light: cahaya merata dari segala arah
  const ambient = new THREE.AmbientLight(0xd5e3ff, 1.2);
  scene.add(ambient);

  // Hemisphere light: simulasi cahaya langit (atas) dan pantulan (bawah)
  const hemi = new THREE.HemisphereLight(0xaac8ff, 0x0f1326, 0.8);
  scene.add(hemi);

  // Point light di posisi Matahari: sumber cahaya utama
  const sunLight = new THREE.PointLight(0xfff2df, 120, 0, 2);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  // Directional light: sinar Matahari searah (untuk shadow-like effect)
  const sunRay = new THREE.DirectionalLight(0xffffff, 1.5);
  sunRay.position.set(-1, 0.35, 0.15);
  scene.add(sunRay);

  // Fill light: cahaya pengisi agar sisi gelap planet tidak terlalu hitam
  const dirFill = new THREE.DirectionalLight(0xb7d3ff, 0.6);
  dirFill.position.set(-30, 20, 40);
  scene.add(dirFill);

  /* -----------------------------------------------
   *  7. STARFIELD (BINTANG LATAR BELAKANG)
   *  Membuat ribuan titik bintang yang tersebar
   *  secara acak di bola besar mengelilingi scene.
   * ----------------------------------------------- */
  function makeStarfield(count, size, palette) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 15000 + Math.random() * 20000;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);

      // Pilih warna acak dari palette
      const col = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const starSpriteCanvas = document.createElement("canvas");
    starSpriteCanvas.width = 64;
    starSpriteCanvas.height = 64;
    const starCtx = starSpriteCanvas.getContext("2d");
    if (starCtx) {
      const grad = starCtx.createRadialGradient(32, 32, 3, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.4, "rgba(255,255,255,0.6)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      starCtx.fillStyle = grad;
      starCtx.fillRect(0, 0, 64, 64);
    }
    const starSprite = new THREE.CanvasTexture(starSpriteCanvas);

    const mat = new THREE.PointsMaterial({
      size: size,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
      map: starSprite,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Points(geo, mat);
  }

  // Tambahkan beberapa lapisan bintang dengan ukuran dan warna berbeda ke dalam satu grup
  const starfieldGroup = new THREE.Group();
  starfieldGroup.name = "starfield";
  const starPalette = [0xffffff, 0x55aaff, 0xffff66, 0xff9944, 0x8888ff, 0xffffff];
  starfieldGroup.add(makeStarfield(9000, 30.0, starPalette));  // Bintang kecil
  starfieldGroup.add(makeStarfield(2500, 45.0, starPalette));  // Bintang sedang
  starfieldGroup.add(makeStarfield(200, 65.0, [0xffffff, 0xffaa77, 0x6699ff])); // Bintang besar/terang
  scene.add(starfieldGroup);

  /* -----------------------------------------------
   *  8. TEXTURE (PETA PERMUKAAN PLANET)
   *  Memuat texture realistis dari file lokal agar
   *  tetap stabil dan tidak tergantung CDN eksternal.
   * ----------------------------------------------- */
  const texLoader = new THREE.TextureLoader();
  function loadLocalTexture(path, fallbackHex) {
    const texture = texLoader.load(
      path,
      undefined,
      undefined,
      () => {
        // Fallback warna jika file gagal dimuat.
        const c = document.createElement("canvas");
        c.width = 2;
        c.height = 2;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#" + fallbackHex.toString(16).padStart(6, "0");
          ctx.fillRect(0, 0, 2, 2);
          texture.image = c;
          texture.needsUpdate = true;
        }
      }
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    return texture;
  }

  const TEX_BASE = "assets/textures/planets";
  const planetTextureMaps = {
    mercury: loadLocalTexture(`${TEX_BASE}/mercury.jpg`, 0x9b9b9b),
    venus: loadLocalTexture(`${TEX_BASE}/venus.jpg`, 0xe2c496),
    earth: loadLocalTexture(`${TEX_BASE}/earth.jpg`, 0x5d8fd8),
    mars: loadLocalTexture(`${TEX_BASE}/mars.jpg`, 0xc36a4f),
    jupiter: loadLocalTexture(`${TEX_BASE}/jupiter.jpg`, 0xd8b892),
    saturn: loadLocalTexture(`${TEX_BASE}/saturn.jpg`, 0xe5d3ab),
    uranus: loadLocalTexture(`${TEX_BASE}/uranus.jpg`, 0xa8dbe8),
    neptune: loadLocalTexture(`${TEX_BASE}/neptune.jpg`, 0x6e8ee5),
    moon: loadLocalTexture(`${TEX_BASE}/moon.jpg`, 0x9d9d9d),
    saturnRing: loadLocalTexture(`${TEX_BASE}/saturn-rings.png`, 0xd7c39a),
  };

  /* -----------------------------------------------
   *  9. KONSTANTA UKURAN & ORBIT
   *  Menentukan skala visual proporsional:
   *  urutan planet dari yang paling dekat hingga
   *  paling jauh dari Matahari.
   * ----------------------------------------------- */
  const SUN_RADIUS = 8.0; // Matahari raksasa
  const PLANET_SCALE = 0.45;
  const PLANET_SPECS = [
    { key: "mercury", name: "Merkurius", radius: 0.383 * PLANET_SCALE, orbit: 31.0, color: 0xf2f2f2, spin: 0.012, orbitSpeed: 0.19, map: planetTextureMaps.mercury, emissive: 0x060606, emissiveIntensity: 0.035, orbitColor: 0xb0b8c8 },
    { key: "venus", name: "Venus", radius: 0.949 * PLANET_SCALE, orbit: 57.8, color: 0xfff0d7, spin: 0.008, orbitSpeed: 0.12, map: planetTextureMaps.venus, emissive: 0x090602, emissiveIntensity: 0.03, orbitColor: 0xe8c87a },
    { key: "earth", name: "Bumi", radius: 1.0 * PLANET_SCALE, orbit: 80.0, color: 0xf5faff, spin: 0.09, orbitSpeed: 0.1, map: planetTextureMaps.earth, emissive: 0x040912, emissiveIntensity: 0.045, orbitColor: 0x4fa8e8 },
    { key: "mars", name: "Mars", radius: 0.532 * PLANET_SCALE, orbit: 121.8, color: 0xffddcd, spin: 0.085, orbitSpeed: 0.08, map: planetTextureMaps.mars, emissive: 0x090302, emissiveIntensity: 0.035, orbitColor: 0xe05a3a },
    { key: "jupiter", name: "Jupiter", radius: 11.21 * PLANET_SCALE, orbit: 416.3, color: 0xfff0e1, spin: 0.2, orbitSpeed: 0.045, map: planetTextureMaps.jupiter, emissive: 0x090602, emissiveIntensity: 0.03, orbitColor: 0xd49a6a },
    { key: "saturn", name: "Saturnus", radius: 9.45 * PLANET_SCALE, orbit: 764.7, color: 0xfff3dc, spin: 0.18, orbitSpeed: 0.03, map: planetTextureMaps.saturn, emissive: 0x090602, emissiveIntensity: 0.028, orbitColor: 0xe8d080 },
    { key: "uranus", name: "Uranus", radius: 4.01 * PLANET_SCALE, orbit: 1534.7, color: 0xecffff, spin: 0.13, orbitSpeed: 0.021, map: planetTextureMaps.uranus, emissive: 0x02070a, emissiveIntensity: 0.028, orbitColor: 0x60d8e0 },
    { key: "neptune", name: "Neptunus", radius: 3.88 * PLANET_SCALE, orbit: 2406.4, color: 0xeaf2ff, spin: 0.125, orbitSpeed: 0.016, map: planetTextureMaps.neptune, emissive: 0x03060c, emissiveIntensity: 0.03, orbitColor: 0x4060e8 },
  ];
  const MOON_RADIUS = 0.137;
  const MOON_ORBIT_R = 2.5;


  function makeSunTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, "#ff9a2f");
    grad.addColorStop(0.35, "#ffc847");
    grad.addColorStop(0.7, "#ffb13c");
    grad.addColorStop(1, "#ff8c28");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Granulasi sederhana untuk memberi detail permukaan matahari.
    for (let i = 0; i < 3800; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const w = 8 + Math.random() * 32;
      const h = 3 + Math.random() * 18;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,150,50,0.22)" : "rgba(255,245,170,0.16)";
      ctx.fillRect(x, y, w, h);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }
  const sunMap = makeSunTexture();

  /* -----------------------------------------------
   *  10. MATAHARI (SUN)
   *  Terdiri dari 3 mesh:
   *  - Core: bola kuning solid
   *  - Glow inner: efek cahaya orange transparan
   *  - Glow outer: efek corona merah transparan
   * ----------------------------------------------- */
  const sunGroup = new THREE.Group();
  scene.add(sunGroup);

  // Inti matahari — warna kuning keemasan dengan tekstur.
  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS, 48, 48),
    new THREE.MeshStandardMaterial({
      color: 0xffd276,
      map: sunMap,
      emissive: 0xff9a33,
      emissiveIntensity: 0.62,
      roughness: 0.78,
      metalness: 0,
    })
  );
  sunGroup.add(sunCore);

  // Glow dalam — efek cahaya orange dengan additive blending
  const glowInner = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS * 1.15, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  sunGroup.add(glowInner);

  // Glow luar — efek corona merah, lebih transparan
  const glowOuter = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS * 1.42, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff7a2d,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  sunGroup.add(glowOuter);

  // Tandai semua mesh Matahari sebagai selectable (untuk raycasting)
  [sunCore, glowInner, glowOuter].forEach((m) => {
    m.userData.selectable = true;
    m.userData.body = "sun";
  });

  /* -----------------------------------------------
   *  11. PLANET
   *  Setiap planet punya orbit group sendiri agar
   *  bisa berputar mengelilingi Matahari.
   * ----------------------------------------------- */
  const planetSystems = PLANET_SPECS.map((spec) => {
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);

    const planetGroup = new THREE.Group();
    planetGroup.position.set(spec.orbit, 0, 0);
    orbitGroup.add(planetGroup);

    let mesh;

    const glbPlanets = ["earth", "jupiter", "mars", "mercury", "venus"];

    if (glbPlanets.includes(spec.key)) {
      // Gunakan model 3D (.glb)
      mesh = new THREE.Group();

      const loader = new GLTFLoader();
      loader.load(`./assets/models/${spec.key}.glb`, (gltf) => {
        const model = gltf.scene;

        // Dapatkan ukuran asli model
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // Skala agar sesuai dengan radius planet yang ditentukan (diameter = radius * 2)
        const scale = (spec.radius * 2) / maxDim;
        model.scale.setScalar(scale);

        // Pusatkan model
        box.setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        // Tambahkan ke grup mesh
        mesh.add(model);
      }, undefined, (error) => {
        console.error(`Gagal memuat ./assets/models/${spec.key}.glb:`, error);
      });

    } else if (spec.key === "saturn") {
      // Untuk Saturnus, gunakan model 3D (saturn.glb)
      mesh = new THREE.Group();

      const loader = new GLTFLoader();
      loader.load("./assets/models/saturn.glb", (gltf) => {
        const saturnModel = gltf.scene;

        // Dapatkan ukuran asli model
        const box = new THREE.Box3().setFromObject(saturnModel);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // Skala agar sesuai. Karena model saturnus kemungkinan mencakup cincin,
        // kita kalikan dengan faktor yang sesuai agar ukuran planet intinya tetap benar.
        // Asumsi diameter cincin adalah ~4.4x radius planet.
        const scale = (spec.radius * 4.4) / maxDim;
        saturnModel.scale.setScalar(scale);

        // Pusatkan model
        box.setFromObject(saturnModel);
        const center = box.getCenter(new THREE.Vector3());
        saturnModel.position.sub(center);

        // Tambahkan ke grup mesh
        mesh.add(saturnModel);
      }, undefined, (error) => {
        console.error("Gagal memuat assets/models/saturn.glb:", error);
      });

    } else {
      // Planet lainnya tetap menggunakan SphereGeometry
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(spec.radius, 48, 48),
        new THREE.MeshStandardMaterial({
          color: spec.color,
          map: spec.map || null,
          roughness: 0.86,
          metalness: 0.01,
          emissive: spec.emissive || 0x0a1018,
          emissiveIntensity: spec.emissiveIntensity ?? 0.16,
        })
      );
    }

    mesh.userData.selectable = true;
    mesh.userData.body = spec.key;
    const latLines = makeLatitudeLines(spec.radius);
    mesh.add(latLines);
    mesh.userData.latLines = latLines;
    planetGroup.add(mesh);

    return {
      spec,
      orbitGroup,
      planetGroup,
      mesh,
      orbitAngle: Math.random() * Math.PI * 2,
      spinAngle: Math.random() * Math.PI * 2,
    };
  });

  // Buat garis orbit dengan warna unik per planet (256 segments = lebih smooth)
  function makeOrbitGuide(radius, color = 0xd7deea) {
    const points = [];
    const segments = 256;
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(t) * radius,
        0,
        Math.sin(t) * radius
      ));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });
    const orbitLine = new THREE.LineLoop(geo, mat);
    orbitLine.visible = false; // default off, toggle via checkbox
    orbitLine.userData.selectable = false;
    scene.add(orbitLine);
    return orbitLine;
  }

  // Setiap planet dapat warna orbit unik dari PLANET_SPECS.orbitColor
  const orbitGuides = PLANET_SPECS.map((spec) => makeOrbitGuide(spec.orbit, spec.orbitColor));

  const earthSystem = planetSystems.find((planet) => planet.spec.key === "earth");
  const moonOrbitGroup = new THREE.Group();
  const moonMesh = new THREE.Group();

  const moonLoader = new GLTFLoader();
  moonLoader.load("./assets/models/moon.glb", (gltf) => {
    const moonModel = gltf.scene;

    // Dapatkan ukuran asli model
    const box = new THREE.Box3().setFromObject(moonModel);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Skala agar sesuai dengan MOON_RADIUS
    const scale = (MOON_RADIUS * 2) / maxDim;
    moonModel.scale.setScalar(scale);

    // Pusatkan model
    box.setFromObject(moonModel);
    const center = box.getCenter(new THREE.Vector3());
    moonModel.position.sub(center);

    moonMesh.add(moonModel);
  }, undefined, (error) => {
    console.error("Gagal memuat ./assets/models/moon.glb:", error);
  });
  moonMesh.userData.selectable = true;
  moonMesh.userData.body = "moon";
  const moonLatLines = makeLatitudeLines(MOON_RADIUS, 0xc7d7e9);
  moonMesh.add(moonLatLines);
  moonMesh.userData.latLines = moonLatLines;
  moonMesh.position.set(MOON_ORBIT_R, 0, 0);
  if (earthSystem) {
    earthSystem.planetGroup.add(moonOrbitGroup);
    moonOrbitGroup.add(moonMesh);
  }

  /* -----------------------------------------------
   *  13. HIT SPHERES (BOLA DETEKSI KLIK)
   *  Bola transparan yang lebih besar dari planet
   *  aslinya, memudahkan user mengklik planet kecil.
   * ----------------------------------------------- */
  function makePlanetHitSphere(radius, bodyKey) {
    const geo = new THREE.SphereGeometry(radius, 28, 28);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,          // Tidak terlihat
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.body = bodyKey;
    mesh.userData.selectable = true;
    mesh.userData.isHitProxy = true;
    mesh.name = "hit_" + bodyKey;
    mesh.renderOrder = 999;
    return mesh;
  }

  const sunHit = makePlanetHitSphere(
    Math.max(SUN_RADIUS * 1.2, 5.15), "sun"
  );
  sunGroup.add(sunHit);

  const planetHits = planetSystems.map((planet) => {
    const hit = makePlanetHitSphere(
      Math.max(planet.spec.radius * 4.3, 1.2),
      planet.spec.key
    );
    planet.planetGroup.add(hit);
    return hit;
  });
  const moonHit = makePlanetHitSphere(
    Math.max(MOON_RADIUS * 8, 1.1),
    "moon"
  );
  moonHit.position.set(MOON_ORBIT_R, 0, 0);
  moonOrbitGroup.add(moonHit);

  /* -----------------------------------------------
   *  14. VARIABEL STATE ANIMASI & KAMERA
   *  Menyimpan state orbit, posisi kamera, dan
   * ----------------------------------------------- */
  let moonOrbitAngle = 0;
  let moonSpin = 0;
  let sunSpin = 0;

  // Posisi dan target kamera default (tampilan overview)
  const solarOffset = new THREE.Vector3(0, 1000, 3200);
  const solarTarget = new THREE.Vector3(0, -3, 0);

  // Set posisi kamera awal
  camera.position.copy(solarOffset);
  controls.target.copy(solarTarget);
  controls.update();

  // --- State: Auto-Follow & Smooth Zoom ---
  let autoFollowEnabled = false;  // apakah auto-follow aktif
  let zoomVelocity = 0;        // kecepatan zoom saat ini (inertia)
  const ZOOM_DAMPING = 0.88;     // pelambatan inersia (0–1)
  const ZOOM_SPEED = 0.6;      // sensitivitas scroll basis (nanti dikali jarak)

  /* -----------------------------------------------
   *  15. RAYCASTER (DETEKSI OBJEK DIBAWAH KURSOR)
   *  Menentukan planet mana yang sedang di-hover
   *  atau di-klik oleh user.
   * ----------------------------------------------- */
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line = { threshold: 0.12 };
  raycaster.params.Points = { threshold: 0.15 };
  const pointerNdc = new THREE.Vector2(); // Koordinat mouse (-1..1)
  const pickables = [sunHit, ...planetHits, moonHit];

  /* -----------------------------------------------
   *  16. REFERENSI ELEMEN UI
   * ----------------------------------------------- */
  const tooltipEl = document.getElementById("planet-tooltip");
  const detailPanel = document.getElementById("detail-panel");
  const detailTitle = document.getElementById("detail-title");
  const detailMeta = document.getElementById("detail-meta");
  const detailBody = document.getElementById("detail-body");
  const detailClose = document.getElementById("detail-close");
  const overviewHint = document.getElementById("overview-hint");
  const floatingMenu = document.getElementById("floating-menu");
  const menuToggleBtn = document.getElementById("menu-toggle");
  const menuDropdown = document.getElementById("menu-dropdown");
  const btnLayers = document.getElementById("btn-layers");
  const layersPanel = document.getElementById("layers-panel");
  const btnCloseLayers = document.getElementById("btn-close-layers");
  const latitudeToggle = document.getElementById("toggle-latitude-lines");
  const orbitLinesToggle = document.getElementById("toggle-orbit-lines");
  const starfieldToggle = document.getElementById("toggle-starfield");
  const autoFollowToggle = document.getElementById("toggle-auto-follow");
  const planetLabelsToggle = document.getElementById("toggle-planet-labels");
  const planetLabelsContainer = document.getElementById("planet-labels-container");

  const btnCollapseDetail = document.getElementById("btn-collapse-detail");
  const btnExpandDetail = document.getElementById("btn-expand-detail");

  /* -----------------------------------------------
   *  17. PLANET LABELS INITIALIZATION
   * ----------------------------------------------- */
  const planetLabelEls = [];
  function createPlanetLabels() {
    if (!planetLabelsContainer) return;
    planetLabelsContainer.innerHTML = "";

    // Gabungkan Matahari, planet, dan Bulan untuk label
    const allBodies = [
      { key: "sun", name: "Matahari" },
      ...PLANET_SPECS,
      { key: "moon", name: "Bulan" }
    ];

    allBodies.forEach(spec => {
      const div = document.createElement("div");
      div.className = "planet-label";
      div.textContent = spec.name;
      planetLabelsContainer.appendChild(div);
      planetLabelEls.push({ el: div, key: spec.key });
    });
  }
  createPlanetLabels();

  function updatePlanetLabels() {
    if (!planetLabelsToggle || !planetLabelsToggle.checked) {
      if (planetLabelsContainer) planetLabelsContainer.style.display = "none";
      return;
    }
    if (planetLabelsContainer) planetLabelsContainer.style.display = "block";

    // Sembunyikan semua label saat sedang fokus ke objek tertentu
    // atau saat kamera sedang transisi kembali ke overview
    if (focusBody || labelsSuppressed) {
      planetLabelEls.forEach(item => { item.el.style.opacity = "0"; });
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const widthHalf = vw / 2;
    const heightHalf = vh / 2;
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);

    const PAD = 10;
    const LABEL_W = 70;
    const LABEL_H = 28;

    const labelPositions = [];
    planetLabelEls.forEach((item, idx) => {
      let mesh, radius, maxVisibleDist, minVisibleDist;

      // Ambil data mesh dan jarak pandang untuk Matahari, Bulan, atau Planet
      if (item.key === "sun") {
        mesh = sunCore;
        radius = SUN_RADIUS;
        maxVisibleDist = 12000; // Selalu terlihat kecuali sangat jauh
        minVisibleDist = radius * 2;
      } else if (item.key === "moon") {
        mesh = moonMesh;
        radius = MOON_RADIUS;
        maxVisibleDist = 80; // Hanya terlihat jika zoom dekat ke Bumi
        minVisibleDist = radius * 3;
      } else {
        const sys = planetSystems.find(p => p.spec.key === item.key);
        if (!sys) { item.el.style.opacity = "0"; labelPositions.push(null); return; }
        mesh = sys.mesh;
        radius = sys.spec.radius;
        maxVisibleDist = sys.spec.orbit * 12;
        minVisibleDist = radius * 3;
      }

      const pos = new THREE.Vector3();
      mesh.getWorldPosition(pos);
      const camDist = camera.position.distanceTo(pos);

      // 1. Cek Frustum (Apakah objek ada di layar?)
      if (!frustum.containsPoint(pos)) {
        item.el.style.opacity = "0";
        labelPositions.push(null);
        return;
      }

      // 2. Cek jarak visibilitas (zoom level)
      if (camDist > maxVisibleDist || camDist < minVisibleDist) {
        item.el.style.opacity = "0";
        labelPositions.push(null);
        return;
      }

      // 3. Cek Oklusi: Apakah tertutup oleh Matahari? (Hanya untuk planet & bulan)
      if (item.key !== "sun") {
        const dirToPlanet = new THREE.Vector3().subVectors(pos, camera.position);
        const distToPlanet = dirToPlanet.length();
        dirToPlanet.normalize();

        // Vektor dari kamera ke pusat Matahari (0,0,0)
        const toSun = new THREE.Vector3().copy(camera.position).negate();
        const t = toSun.dot(dirToPlanet);

        // Jika Matahari ada di antara kamera dan planet
        if (t > 0 && t < distToPlanet) {
          const closestDistSq = toSun.lengthSq() - t * t;
          // Cek apakah sinar ray menembus bola Matahari
          if (closestDistSq < (SUN_RADIUS * 1.05) * (SUN_RADIUS * 1.05)) {
            item.el.style.opacity = "0";
            labelPositions.push(null);
            return;
          }
        }
      }

      pos.project(camera);
      let x = (pos.x * widthHalf) + widthHalf;
      let y = -(pos.y * heightHalf) + heightHalf;

      let opacity = 1;
      if (camDist > maxVisibleDist * 0.7) {
        opacity = 1 - ((camDist - maxVisibleDist * 0.7) / (maxVisibleDist * 0.3));
      }

      const fovRad = camera.fov * Math.PI / 180;
      const visibleHeightAtDist = 2 * Math.tan(fovRad / 2) * camDist;
      const apparentRadiusPx = (radius / visibleHeightAtDist) * vh;

      const labelY = y - (apparentRadiusPx + 16);

      const cx = Math.max(PAD + LABEL_W / 2, Math.min(vw - PAD - LABEL_W / 2, x));
      const cy = Math.max(PAD + LABEL_H / 2, Math.min(vh - PAD - LABEL_H - 60, labelY));

      labelPositions.push({ x: cx, y: cy, idx, opacity: Math.max(0, Math.min(1, opacity)) });
    });

    // Pass 2 & 3: Collision avoidance & hide overlap disabled
    // Sesuai permintaan: biarkan saja label bersatu (overlap), tidak perlu saling menghindar.

    // Pass 4: Terapkan posisi final
    planetLabelEls.forEach((item, idx) => {
      const lp = labelPositions[idx];
      if (!lp) { item.el.style.opacity = "0"; return; }
      item.el.style.left = `${lp.x}px`;
      item.el.style.top = `${lp.y}px`;
      item.el.style.opacity = String(lp.opacity);
    });
  }

  function makeLatitudeLines(radius, color = 0xaed0ff) {
    const group = new THREE.Group();
    const latStep = 22.5;
    for (let lat = -67.5; lat <= 67.5; lat += latStep) {
      if (Math.abs(lat) < 1e-6) continue;
      const latRad = THREE.MathUtils.degToRad(lat);
      const ringRadius = Math.cos(latRad) * radius * 1.012;
      const y = Math.sin(latRad) * radius;
      if (ringRadius <= 0.001) continue;

      const points = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(
          Math.cos(t) * ringRadius,
          y,
          Math.sin(t) * ringRadius
        ));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      });
      group.add(new THREE.Line(geo, mat));
    }
    group.visible = false;
    return group;
  }

  /* -----------------------------------------------
   *  17. DATA INFORMASI PLANET
   *  Nama tampilan dan deskripsi setiap objek langit.
   * ----------------------------------------------- */
  const BODY_NAMES = PLANET_SPECS.reduce(
    (acc, planet) => {
      acc[planet.key] = planet.name;
      return acc;
    },
    { sun: "Matahari", moon: "Bulan" }
  );

  const PLANET_INFO = {
    sun: {
      meta: "Bintang · G2V · pusat tata surya",
      title: "Matahari",
      text: "Matahari adalah bintang di pusat tata surya kita. Energinya muncul dari fusi inti hidrogen menjadi helium, memancarkan cahaya dan panas yang membuat kehidupan di Bumi mungkin. Massanya sekitar 330.000 kali massa Bumi.",
    },
    mercury: {
      meta: "Planet 1 · terdekat dari Matahari",
      title: "Merkurius",
      text: "Merkurius adalah planet batuan terkecil dan terdekat dari Matahari. Permukaannya dipenuhi kawah dan perbedaan suhu siang-malamnya sangat ekstrem karena atmosfernya sangat tipis.",
    },
    venus: {
      meta: "Planet 2 · planet terpanas",
      title: "Venus",
      text: "Venus memiliki ukuran mirip Bumi tetapi atmosfer karbon dioksida yang sangat tebal menyebabkan efek rumah kaca ekstrem. Arah rotasinya berlawanan dengan mayoritas planet lain.",
    },
    earth: {
      meta: "Planet 3 · zona layak huni",
      title: "Bumi",
      text: "Bumi adalah planet batuan dengan atmosfer nitrogen-oksigen, air cair melimpah, dan kondisi yang mendukung kehidupan. Medan magnetnya membantu melindungi dari partikel berenergi tinggi Matahari.",
    },
    moon: {
      meta: "Satelit alami Bumi",
      title: "Bulan",
      text: "Bulan adalah satelit alami Bumi yang mengorbit planet kita dan ikut memengaruhi pasang surut laut. Permukaannya dipenuhi kawah dan hamparan dataran basalt gelap.",
    },
    mars: {
      meta: "Planet 4 · planet merah",
      title: "Mars",
      text: "Mars memiliki permukaan berdebu kaya oksida besi yang memberi warna kemerahan. Planet ini menyimpan jejak geologi masa lalu yang menunjukkan kemungkinan pernah memiliki air cair.",
    },
    jupiter: {
      meta: "Planet 5 · raksasa gas terbesar",
      title: "Jupiter",
      text: "Jupiter adalah planet terbesar di tata surya, tersusun terutama dari hidrogen dan helium. Badai raksasa seperti Bintik Merah Besar menunjukkan atmosfernya yang sangat dinamis.",
    },
    saturn: {
      meta: "Planet 6 · raksasa gas bercincin",
      title: "Saturnus",
      text: "Saturnus terkenal dengan sistem cincin spektakulernya yang tersusun dari partikel es dan batuan. Meski ukurannya besar, kerapatannya rendah dibandingkan banyak planet lain.",
    },
    uranus: {
      meta: "Planet 7 · raksasa es",
      title: "Uranus",
      text: "Uranus adalah raksasa es dengan warna kebiruan akibat metana di atmosfer atas. Sumbu rotasinya sangat miring sehingga tampak seperti berputar sambil 'menggelinding' saat mengorbit.",
    },
    neptune: {
      meta: "Planet 8 · terjauh dari Matahari",
      title: "Neptunus",
      text: "Neptunus adalah planet besar terluar dengan angin atmosfer tercepat di tata surya. Warnanya biru karena kandungan metana, dan dinamika cuacanya sangat aktif meski jauh dari Matahari.",
    },
  };

  /* -----------------------------------------------
   *  18. FOKUS PLANET — STATE & FUNGSI
   *  Mengatur transisi kamera saat user mengklik
   *  planet untuk melihat dari dekat.
   * ----------------------------------------------- */
  let focusBody = null;        // Planet yang sedang difokuskan (null = overview)
  let focusTweening = false;   // true jika kamera sedang dalam animasi transisi
  let _activeFocusTween = null; // Referensi tween GSAP aktif dari focusPlanet
  let labelsSuppressed = false; // true saat label harus disembunyikan (transisi kembali)

  // Simpan posisi kamera sebelum masuk mode fokus
  let savedOverviewCam = new THREE.Vector3();
  let savedOverviewTarget = new THREE.Vector3();

  /**
   * computeFocusPose(bodyKey)
   * Menghitung posisi kamera dan target yang ideal
   * untuk melihat planet tertentu dari dekat.
   */
  function computeFocusPose(bodyKey) {
    const target = new THREE.Vector3();
    const cam = new THREE.Vector3();
    if (bodyKey === "sun") {
      target.set(0, 0, 0);
      // Mendekati Matahari dari samping, bukan dari atas
      cam.set(35, 8, 55);
    } else if (bodyKey === "moon") {
      moonMesh.getWorldPosition(target);
      const outward = target.clone().normalize();
      if (outward.lengthSq() < 1e-8) outward.set(1, 0.24, 0).normalize();
      cam.copy(target)
        .add(outward.multiplyScalar(2.1))
        .add(new THREE.Vector3(0, 0.12, 0));  // Sangat sedikit elevasi
    } else {
      const planet = planetSystems.find((p) => p.spec.key === bodyKey);
      if (!planet) {
        target.set(0, 0, 0);
        cam.set(40, 10, 65);
        return { cam, target };
      }
      planet.mesh.getWorldPosition(target);
      const outward = target.clone().normalize();
      if (outward.lengthSq() < 1e-8) outward.set(1, 0.22, 0).normalize();
      const idealDistance = Math.max(planet.spec.radius * 8, 3.2);
      // Kamera mendekati dari samping planet (outward) dengan sedikit elevasi
      cam.copy(target)
        .add(outward.multiplyScalar(idealDistance))
        .add(new THREE.Vector3(0, Math.max(planet.spec.radius * 0.35, 0.18), 0));
    }
    return { cam, target };
  }

  /* -----------------------------------------------
   *  19. ORBIT LIMITS
   *  Mengatur batas zoom/rotasi OrbitControls
   *  sesuai konteks: overview vs fokus planet.
   * ----------------------------------------------- */
  const overviewOrbitLimits = {
    minDistance: 8,
    maxDistance: 10000,  // Memungkinkan mundur lebih jauh (disesuaikan dengan skala tata surya baru)
    maxPolarAngle: Math.PI * 0.495,
    enablePan: true,
  };

  /** Terapkan batas orbit saat fokus ke planet tertentu */
  function applyFocusOrbitLimits(bodyKey) {
    controls.enableRotate = true;
    controls.enableZoom = false;   // Nonaktifkan zoom saat fokus
    controls.enablePan = false;    // Nonaktifkan pan saat fokus
    if (bodyKey === "sun") {
      controls.minDistance = 20;
      controls.maxDistance = 800;
    } else if (bodyKey === "moon") {
      controls.minDistance = 0.8;
      controls.maxDistance = 8;
    } else {
      const planet = planetSystems.find((p) => p.spec.key === bodyKey);
      const radius = planet ? planet.spec.radius : 1;
      controls.minDistance = Math.max(radius * 2.2, 1.2);
      controls.maxDistance = Math.max(radius * 14, 12);
    }
    controls.maxPolarAngle = Math.PI - 0.06;

    // Aktifkan auto-rotate halus agar tampilan terasa hidup
    // saat fokus ke planet (kamera berputar perlahan)
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;  // Sangat lambat, subtle
  }

  /** Kembalikan batas orbit ke mode overview */
  function restoreOverviewOrbitLimits() {
    controls.minDistance = overviewOrbitLimits.minDistance;
    controls.maxDistance = overviewOrbitLimits.maxDistance;
    controls.maxPolarAngle = overviewOrbitLimits.maxPolarAngle;
    controls.minPolarAngle = 0;    // Reset batas bawah rotasi vertikal
    controls.enablePan = overviewOrbitLimits.enablePan;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.autoRotate = false;   // Matikan auto-rotate di mode overview

    // Paksa polar angle kembali ke batas yang benar jika terlanjur melewati limit
    // (bisa terjadi jika returnToOverview dipanggil saat transisi)
    const currentPolar = controls.getPolarAngle();
    if (currentPolar > overviewOrbitLimits.maxPolarAngle) {
      // Geser kamera ke posisi yang valid secara vertikal
      const spherical = new THREE.Spherical().setFromVector3(
        camera.position.clone().sub(controls.target)
      );
      spherical.phi = overviewOrbitLimits.maxPolarAngle - 0.01;
      camera.position.copy(
        new THREE.Vector3().setFromSpherical(spherical).add(controls.target)
      );
    }
  }

  /* -----------------------------------------------
   *  20. DETAIL PANEL — BUKA & TUTUP
   *  Mengelola panel informasi planet di sisi kanan.
   * ----------------------------------------------- */

  /** Buka panel detail dan tampilkan info planet */
  function openPlanetDetail(bodyKey) {
    const info = PLANET_INFO[bodyKey] || {
      meta: "Objek Angkasa",
      title: bodyKey,
      text: "Data deskripsi tidak tersedia."
    };

    detailMeta.textContent = info.meta;
    detailTitle.textContent = info.title;
    detailBody.textContent = info.text;

    detailPanel.classList.add("open");
    detailPanel.classList.remove("collapsed");
    if (btnExpandDetail) btnExpandDetail.classList.remove("visible");

    detailPanel.setAttribute("aria-hidden", "false");
    overviewHint.classList.add("visible");
    document.body.classList.add("detail-open");
  }

  /** Tutup panel detail */
  function closePlanetDetail() {
    detailPanel.classList.remove("open");
    detailPanel.classList.remove("collapsed");
    if (btnExpandDetail) btnExpandDetail.classList.remove("visible");
    detailPanel.setAttribute("aria-hidden", "true");
    overviewHint.classList.remove("visible");
    // Kembalikan menu & HUD
    document.body.classList.remove("detail-open");
  }

  /* -----------------------------------------------
   *  21. FOKUS & KEMBALI KE OVERVIEW
   *  Animasi kamera menuju planet (focusPlanet)
   *  dan kembali ke tampilan luas (returnToOverview).
   * ----------------------------------------------- */

  /** Fokus kamera ke planet yang diklik */
  function focusPlanet(bodyKey) {
    if (focusTweening) return;

    if (!focusBody) {
      savedOverviewCam.copy(camera.position);
      savedOverviewTarget.copy(controls.target);
    }

    focusBody = bodyKey;

    const { cam, target } = computeFocusPose(bodyKey);
    openPlanetDetail(bodyKey);
    controls.enabled = false;

    const onDone = () => {
      // Guard: jika returnToOverview sudah dipanggil saat tween berjalan,
      // jangan timpa orbit limits yang sudah di-restore
      if (focusBody !== bodyKey) return;
      focusTweening = false;
      applyFocusOrbitLimits(bodyKey);
      controls.enabled = true;
    };

    // Animasi smooth ke posisi fokus menggunakan GSAP
    if (gsap) {
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(controls.target);
      if (_activeFocusTween) { _activeFocusTween.kill(); _activeFocusTween = null; }
      focusTweening = true;

      const startCam = camera.position.clone();
      const startTarget = controls.target.clone();
      const proxy = { t: 0 };

      _activeFocusTween = gsap.to(proxy, {
        t: 1,
        duration: 3.5,
        ease: "power3.inOut",
        onUpdate: () => {
          // Guard: jika returnToOverview sudah dipanggil, hentikan update
          if (focusBody !== bodyKey) return;
          // Hitung ulang target dinamis di setiap frame karena planet mungkin sedang bergerak
          const currentPose = computeFocusPose(bodyKey);
          camera.position.lerpVectors(startCam, currentPose.cam, proxy.t);
          controls.target.lerpVectors(startTarget, currentPose.target, proxy.t);
          controls.update();
        },
        onComplete: () => {
          _activeFocusTween = null;
          // Pastikan posisi final tepat di target
          const finalPose = computeFocusPose(bodyKey);
          camera.position.copy(finalPose.cam);
          controls.target.copy(finalPose.target);
          controls.update();
          onDone();
        }
      });
    } else {
      // Fallback tanpa GSAP: langsung pindah
      camera.position.copy(cam);
      controls.target.copy(target);
      controls.update();
      focusTweening = false;
      applyFocusOrbitLimits(bodyKey);
      controls.enabled = true;
    }
  }

  /**
   * returnToOverview()
   * Mengembalikan kamera ke posisi awal (solarOffset)
   * dengan animasi halus. Dipanggil saat tombol close
   * diklik, Escape ditekan, atau scroll wheel saat fokus.
   */
  let returnCooldown = false;  // Guard: mencegah klik planet langsung setelah return

  function returnToOverview() {
    // Guard: cegah double-return atau return tanpa fokus
    if (!focusBody && !focusTweening && !detailPanel.classList.contains("open")) return;
    if (gsap) {
      // Kill tween proxy dari focusPlanet agar onUpdate-nya tidak lanjut
      if (_activeFocusTween) { _activeFocusTween.kill(); _activeFocusTween = null; }
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(controls.target);
    }

    // Set focusBody ke null SEGERA agar guard di focusPlanet tween berhenti
    focusBody = null;

    // Matikan auto-rotate dan set state SEBELUM menutup panel
    // agar tidak ada event klik yang tembus ke canvas
    controls.autoRotate = false;
    focusTweening = true;
    controls.enabled = false;

    // Baru tutup panel setelah state terproteksi
    // Eksekusi pemulihan batas orbit SECARA LANGSUNG sebelum animasi
    // dimulai. Jika tidak, OrbitControls akan menahan/mem-blok (clamp)
    // kamera agar tidak bisa mundur lebih jauh dari planet yang difokuskan.
    restoreOverviewOrbitLimits();

    closePlanetDetail();

    // Sembunyikan label selama transisi kembali
    labelsSuppressed = true;

    const end = () => {
      focusTweening = false;
      controls.enabled = true;

      // Cooldown: blokir klik planet selama 600ms setelah kembali
      // agar kamera tidak langsung fokus ke Matahari
      returnCooldown = true;
      setTimeout(() => { returnCooldown = false; }, 600);

      // Tampilkan label kembali setelah jeda 1.5 detik
      setTimeout(() => { labelsSuppressed = false; }, 1500);
    };

    // Animasi kamera kembali ke posisi awal (overview tata surya)
    if (gsap) {
      gsap
        .timeline({ onUpdate: () => controls.update(), onComplete: end })
        .to(camera.position, {
          x: savedOverviewCam.x, y: savedOverviewCam.y, z: savedOverviewCam.z,
          duration: 3.5, ease: "power3.inOut",
        }, 0)
        .to(controls.target, {
          x: savedOverviewTarget.x, y: savedOverviewTarget.y, z: savedOverviewTarget.z,
          duration: 3.5, ease: "power3.inOut",
        }, 0);
    } else {
      camera.position.copy(savedOverviewCam);
      controls.target.copy(savedOverviewTarget);
      controls.update();
      end();
    }
  }

  /* -----------------------------------------------
   *  22. PICKING / RAYCASTING — EVENT HANDLER
   *  Mendeteksi planet mana yang ada di bawah
   *  kursor mouse untuk hover tooltip dan klik.
   * ----------------------------------------------- */

  /** Konversi posisi mouse ke koordinat NDC (-1..1) */
  function updatePickPointerFromEvent(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * resolvePickHit(rawHits)
   * Prioritaskan hit Bumi/Bulan di atas Matahari karena
   * hit sphere Matahari sangat besar dan sering memotong
   * sinar ke planet lain.
   */
  function resolvePickHit(rawHits) {
    if (!rawHits || rawHits.length === 0) return null;
    const outer = rawHits.filter((h) => {
      const b = h.object.userData.body;
      return b !== "sun";
    });
    const pool = outer.length ? outer : rawHits;
    pool.sort((a, b) => a.distance - b.distance);
    return pool[0];
  }

  function setLatitudeLinesVisible(visible) {
    planetSystems.forEach((planet) => {
      if (planet.mesh.userData.latLines) {
        planet.mesh.userData.latLines.visible = visible;
      }
    });
    if (moonMesh.userData.latLines) {
      moonMesh.userData.latLines.visible = visible;
    }
  }

  function setOrbitGuidesVisible(visible) {
    orbitGuides.forEach((line) => {
      line.visible = visible;
    });
  }

  let hoveredBody = null;

  /** Handler: mouse bergerak di atas canvas */
  function onCanvasPointerMove(event) {
    updatePickPointerFromEvent(event);
    hoveredBody = null;
    if (focusBody) {
      tooltipEl.classList.remove("visible");
      wrap.style.cursor = focusTweening ? "wait" : "grab";
      return;
    }


    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    const chosen = resolvePickHit(hits);
    if (chosen) {
      const body = chosen.object.userData.body;
      if (body) {
        hoveredBody = body;

        // JIKA label planet sedang aktif, jangan munculkan tooltip (agar tidak dobel)
        if (planetLabelsToggle && planetLabelsToggle.checked) {
          tooltipEl.classList.remove("visible");
        } else {
          tooltipEl.textContent = BODY_NAMES[body] || body;
          tooltipEl.style.left = event.clientX + "px";
          tooltipEl.style.top = event.clientY + "px";
          tooltipEl.classList.add("visible");
        }

        wrap.style.cursor = "pointer";
        return;
      }
    }
    tooltipEl.classList.remove("visible");
    wrap.style.cursor = "default";
  }

  /** Handler: klik pada canvas untuk fokus ke planet atau kembali ke overview */
  function onCanvasClick(event) {
    if (event.button !== 0) return;        // Hanya klik kiri
    if (focusTweening) return;             // Sedang animasi transisi (termasuk return)
    if (returnCooldown) return;            // Baru saja kembali, tunggu sebentar

    // Jika sedang fokus ke planet, klik di mana saja = kembali ke overview
    if (focusBody) {
      returnToOverview();
      return;
    }

    updatePickPointerFromEvent(event);
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    const chosen = resolvePickHit(hits);
    if (chosen) {
      const body = chosen.object.userData.body;
      if (body) focusPlanet(body);
    }
  }

  /* -----------------------------------------------
   *  22.5. TIME CONTROLS LOGIC (CURVED SLIDER)
   * ----------------------------------------------- */
  let globalTimeScale = 0.0;
  let isPaused = true;
  let simulatedDate = new Date("2049-12-31T06:59:59");

  const timeControlsWrapper = document.getElementById("time-controls-wrapper");
  const timePanel = document.getElementById("time-panel");
  const timeToggleBtn = document.getElementById("time-toggle-btn");
  const tcStatus = document.getElementById("tc-status");
  const customSlider = document.getElementById("custom-slider");
  const customThumb = document.getElementById("custom-thumb");
  const tcDate = document.getElementById("tc-date");
  const tcTime = document.getElementById("tc-time");

  function updateTimeDisplay() {
    const d = simulatedDate;
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    if (tcDate) tcDate.textContent = `${months[d.getMonth()]} ${d.getDate().toString().padStart(2, '0')}, ${d.getFullYear()}`;

    if (tcTime) {
      let h = d.getHours();
      let ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      const m = d.getMinutes().toString().padStart(2, '0');
      const s = d.getSeconds().toString().padStart(2, '0');
      tcTime.textContent = `${h.toString().padStart(2, '0')}:${m}:${s} ${ampm}`;
    }
  }

  updateTimeDisplay();

  if (customSlider && customThumb) {
    let isDragging = false;

    function setThumbPosition(clientX) {
      const rect = customSlider.getBoundingClientRect();
      if (rect.width === 0) return;

      let x = clientX - rect.left;
      x = Math.max(0, Math.min(x, rect.width));
      const t = x / rect.width;

      // Calculate Y on bezier: P0=35, P1=5, P2=35
      const y = Math.pow(1 - t, 2) * 35 + 2 * (1 - t) * t * 5 + Math.pow(t, 2) * 35;

      customThumb.style.left = `${x}px`;
      customThumb.style.top = `${y}px`;

      // Map to timescale: t=0 -> -5x, t=0.5 -> 0x, t=1 -> +5x
      globalTimeScale = (t - 0.5) * 10;

      // Snap to center (PAUSED) if close
      if (Math.abs(globalTimeScale) < 0.4) {
        globalTimeScale = 0;
        customThumb.style.left = `50%`;
        customThumb.style.top = `5px`;
      }

      isPaused = (globalTimeScale === 0);

      if (isPaused) {
        tcStatus.textContent = "PAUSED";
        tcStatus.className = "time-status status-paused";
      } else {
        tcStatus.textContent = globalTimeScale > 0 ? `+${globalTimeScale.toFixed(1)}X` : `${globalTimeScale.toFixed(1)}X`;
        tcStatus.className = "time-status status-play";
      }
    }

    customSlider.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      isDragging = true;
      customThumb.classList.add("active");
      setThumbPosition(e.clientX);
    });

    window.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      setThumbPosition(e.clientX);
    });

    window.addEventListener("pointerup", () => {
      if (isDragging) {
        isDragging = false;
        customThumb.classList.remove("active");
      }
    });

    window.addEventListener("resize", () => {
      if (isPaused) {
        customThumb.style.left = `50%`;
        customThumb.style.top = `5px`;
      }
    });
  }

  if (timeToggleBtn && timePanel) {
    timeToggleBtn.addEventListener("click", () => {
      timePanel.classList.toggle("collapsed");
      timeToggleBtn.classList.toggle("collapsed");
    });
    timeToggleBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  /* -----------------------------------------------
   *  23. EVENT LISTENERS
   *  Mendaftarkan semua event handler untuk
   *  interaksi user.
   * ----------------------------------------------- */

  // --- Drag detection: bedakan klik murni vs drag-rotate ---
  // Saat user drag untuk rotate di mode fokus, jangan anggap sebagai klik.
  let _pointerDownPos = { x: 0, y: 0 };
  let _pointerDownTime = 0;
  const DRAG_THRESHOLD = 6;  // piksel — jika mouse bergerak lebih dari ini, itu drag

  renderer.domElement.addEventListener("pointerdown", (e) => {
    _pointerDownPos.x = e.clientX;
    _pointerDownPos.y = e.clientY;
    _pointerDownTime = performance.now();
  });

  // Hover dan klik pada canvas
  renderer.domElement.addEventListener("pointermove", onCanvasPointerMove);
  renderer.domElement.addEventListener("click", (event) => {
    // Hitung jarak pointer dari posisi mousedown
    const dx = event.clientX - _pointerDownPos.x;
    const dy = event.clientY - _pointerDownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Jika pointer bergerak cukup jauh → itu drag, bukan klik
    if (dist > DRAG_THRESHOLD) return;

    onCanvasClick(event);
  });

  // Floating menu: buka/tutup submenu (Sliders)
  if (menuToggleBtn && menuDropdown) {
    menuToggleBtn.addEventListener("click", () => {
      const open = menuDropdown.classList.toggle("open");
      menuToggleBtn.setAttribute("aria-expanded", String(open));
      menuDropdown.setAttribute("aria-hidden", String(!open));
      menuToggleBtn.classList.toggle("active", open);

      // Jika menu utama ditutup, tutup juga panel layers
      if (!open && layersPanel) {
        layersPanel.classList.remove("open");
        layersPanel.setAttribute("aria-hidden", "true");
        if (btnLayers) {
          btnLayers.setAttribute("aria-expanded", "false");
          btnLayers.classList.remove("active");
          btnLayers.classList.remove("hidden");
        }
      }
    });
  }

  // Layers panel toggle
  if (btnLayers && layersPanel) {
    btnLayers.addEventListener("click", () => {
      const open = layersPanel.classList.toggle("open");
      btnLayers.setAttribute("aria-expanded", String(open));
      layersPanel.setAttribute("aria-hidden", String(!open));
      btnLayers.classList.toggle("active", open);

      if (open) {
        btnLayers.classList.add("hidden");
      }
    });
  }

  // Tutup layers panel dari header "Layers >"
  if (btnCloseLayers && layersPanel && btnLayers) {
    btnCloseLayers.addEventListener("click", () => {
      layersPanel.classList.remove("open");
      layersPanel.setAttribute("aria-hidden", "true");
      btnLayers.setAttribute("aria-expanded", "false");
      btnLayers.classList.remove("active");
      btnLayers.classList.remove("hidden");
    });
  }

  // Opsi: garis lintang planet
  if (latitudeToggle) {
    latitudeToggle.addEventListener("change", () => {
      setLatitudeLinesVisible(latitudeToggle.checked);
    });
  }

  // Opsi: garis orbit warna-warni
  if (orbitLinesToggle) {
    orbitLinesToggle.addEventListener("change", () => {
      setOrbitGuidesVisible(orbitLinesToggle.checked);
    });
  }

  // Detail Panel Listeners
  if (detailClose) {
    detailClose.addEventListener("click", returnToOverview);
  }

  if (btnCollapseDetail && btnExpandDetail && detailPanel) {
    // Sembunyikan/Munculkan panel (collapse/expand toggle)
    btnCollapseDetail.addEventListener("click", (e) => {
      e.stopPropagation();
      const isCollapsed = detailPanel.classList.toggle("collapsed");

      // Hanya munculkan tombol >> di desktop jika sedang collapsed
      if (window.innerWidth > 1024) {
        if (isCollapsed) {
          btnExpandDetail.classList.add("visible");
        } else {
          btnExpandDetail.classList.remove("visible");
        }
      }
    });

    // Munculkan kembali (expand) - tombol desktop
    btnExpandDetail.addEventListener("click", () => {
      detailPanel.classList.remove("collapsed");
      btnExpandDetail.classList.remove("visible");
    });

    // Klik area panel/header untuk expand (khusus mobile/tablet)
    detailPanel.addEventListener("click", () => {
      if (detailPanel.classList.contains("collapsed")) {
        detailPanel.classList.remove("collapsed");
        if (btnExpandDetail) btnExpandDetail.classList.remove("visible");
      }
    });

    // Mobile handle toggle
    const mobileHandle = detailPanel.querySelector(".mobile-drag-handle");
    if (mobileHandle) {
      mobileHandle.addEventListener("click", (e) => {
        e.stopPropagation();
        detailPanel.classList.toggle("collapsed");
      });
    }
  }

  // Opsi: tampilkan bintang (starfield)
  let starfieldObj = scene.getObjectByName("starfield");

  if (starfieldToggle && starfieldObj) {
    starfieldToggle.addEventListener("change", () => {
      starfieldObj.visible = starfieldToggle.checked;
    });
  }

  // Opsi: auto-follow planet
  if (autoFollowToggle) {
    autoFollowToggle.addEventListener("change", () => {
      autoFollowEnabled = autoFollowToggle.checked;
    });
  }

  // Sinkronisasi state awal checkbox dengan scene
  if (latitudeToggle) setLatitudeLinesVisible(latitudeToggle.checked);
  if (orbitLinesToggle) setOrbitGuidesVisible(orbitLinesToggle.checked);
  if (starfieldToggle && starfieldObj) starfieldObj.visible = starfieldToggle.checked;
  if (autoFollowToggle) autoFollowEnabled = autoFollowToggle.checked;
  if (planetLabelsToggle) updatePlanetLabels();

  // Hentikan propagasi klik di dalam layersPanel agar tidak memicu window pointerdown
  if (layersPanel) {
    layersPanel.addEventListener("pointerdown", (e) => e.stopPropagation());
    layersPanel.addEventListener("click", (e) => e.stopPropagation());
  }

  // Klik di luar menu akan menutup dropdown dan panel layers.
  window.addEventListener("pointerdown", (event) => {
    if (!floatingMenu) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (floatingMenu.contains(target)) return;
    if (layersPanel && layersPanel.contains(target)) return;

    if (menuDropdown) {
      menuDropdown.classList.remove("open");
      menuDropdown.setAttribute("aria-hidden", "true");
    }
    if (menuToggleBtn) {
      menuToggleBtn.setAttribute("aria-expanded", "false");
      menuToggleBtn.classList.remove("active");
    }
    if (layersPanel) {
      layersPanel.classList.remove("open");
      layersPanel.setAttribute("aria-hidden", "true");
    }
    if (btnLayers) {
      btnLayers.setAttribute("aria-expanded", "false");
      btnLayers.classList.remove("active");
      btnLayers.classList.remove("hidden");
    }
  });

  // Scroll wheel — smooth zoom di overview, kembali ke overview saat fokus
  renderer.domElement.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Abaikan scroll sepenuhnya saat kamera sedang transisi (tween)
      // agar tidak memicu returnToOverview sebelum sampai tujuan
      if (focusTweening) return;
      if (focusBody) {
        returnToOverview();
        return;
      }
      // Smooth zoom dengan kecepatan dinamis berdasarkan jarak
      const dist = camera.position.distanceTo(controls.target);
      const distFactor = Math.max(0.1, dist / 500); // Semakin jauh kamera, semakin cepat zoom-nya
      zoomVelocity += (e.deltaY > 0 ? 1 : -1) * ZOOM_SPEED * distFactor;
    },
    { passive: false, capture: true }
  );

  // Tombol tutup panel detail — stopPropagation mencegah
  // klik "tembus" ke canvas di belakang panel
  detailClose.addEventListener("click", (e) => {
    e.stopPropagation();
    returnToOverview();
  });

  // Tombol Escape → kembali ke overview
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && focusBody) returnToOverview();
  });

  // ---- MOBILE: Cegah browser bounce/scroll/zoom saat touch di canvas ----
  document.addEventListener("touchmove", (e) => {
    // Izinkan scroll di dalam detail panel content
    if (e.target.closest && e.target.closest(".detail-content")) return;
    if (e.target.closest && e.target.closest(".layers-panel")) return;
    e.preventDefault();
  }, { passive: false });

  // Cegah context menu (long-press) di mobile
  renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());


  /* -----------------------------------------------
   *  25. INTRO ANIMATION
   *  Animasi pembuka: garis melebar, lalu fade-out.
   * ----------------------------------------------- */
  /** Tampilkan UI (HUD + floating menu) setelah intro selesai */
  function showUIAfterIntro() {
    const hudEl = document.getElementById("hud");
    const menuEl = document.getElementById("floating-menu");
    const timeEl = document.getElementById("time-controls-wrapper");
    if (hudEl) hudEl.classList.add("ui-ready");
    if (menuEl) menuEl.classList.add("ui-ready");
    if (timeEl) timeEl.classList.add("ui-ready");
  }

  function introAnimation() {
    if (gsap) {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.to("#intro .line", { width: "min(280px, 70vw)", duration: 1.4 }, 0.2)
        .to("#intro", { opacity: 0, duration: 1.5, delay: 0.4 })
        .add(() => {
          if (typeof window.__hideIntroFallback === "function")
            window.__hideIntroFallback();
          // Tampilkan HUD & menu setelah intro fade-out
          showUIAfterIntro();
        })
        .set("#intro", { display: "none" });
      return tl;
    }
    if (typeof window.__hideIntroFallback === "function")
      window.__hideIntroFallback();
    // Tanpa GSAP, langsung tampilkan
    showUIAfterIntro();
    return null;
  }
  introAnimation();

  /* -----------------------------------------------
   *  26. RESIZE HANDLER
   *  Menyesuaikan ukuran renderer dan aspek kamera
   *  saat ukuran window berubah.
   * ----------------------------------------------- */
  // Background click untuk kembali ke overview sudah diintegrasikan ke onCanvasClick()

  window.addEventListener("resize", () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.fov = getResponsiveFov(); // FOV responsif saat resize

    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  });

  /* -----------------------------------------------
   *  24. ANIMATION LOOP
   *  Fungsi utama yang dipanggil setiap frame (~60fps).
   *  Menangani:
   *  - Rotasi orbit & aksial planet
   *  - Mode fokus (klik planet) & free orbit
   *  - Rendering scene
   * ----------------------------------------------- */

  // Vektor bantu reusable untuk auto-follow (hindari alokasi tiap frame)
  const _followWorldPos = new THREE.Vector3();
  const _followCamTarget = new THREE.Vector3();

  function animate() {
    requestAnimationFrame(animate);

    const dt = 1 / 60;
    const simDt = dt * globalTimeScale * (isPaused ? 0 : 1);

    // Orbit & spin — berjalan terus saat auto-follow, berhenti saat fokus biasa
    const pauseOrbit = focusBody && !autoFollowEnabled;

    // Update jam virtual simulasi
    if (!isPaused && !pauseOrbit) {
      // Misal 1.0x setara dengan 1 jam (3600 dtk) berlalu dalam 1 detik real-time
      simulatedDate = new Date(simulatedDate.getTime() + (dt * globalTimeScale * 3600000));
      updateTimeDisplay();
    }

    if (!pauseOrbit) {
      planetSystems.forEach((planet) => {
        planet.orbitAngle += simDt * planet.spec.orbitSpeed;
        planet.spinAngle += simDt * planet.spec.spin;
      });
      moonOrbitAngle += simDt * 0.34;
      moonSpin += simDt * 0.045;
      sunSpin += simDt * 0.02;
    }

    // Terapkan rotasi
    planetSystems.forEach((planet) => {
      planet.orbitGroup.rotation.y = planet.orbitAngle;
      planet.mesh.rotation.y = planet.spinAngle;
    });
    moonOrbitGroup.rotation.y = moonOrbitAngle;
    moonMesh.rotation.y = moonSpin;
    sunCore.rotation.y = sunSpin;
    if (sunMap) sunMap.offset.x = (sunMap.offset.x + simDt * 0.0045) % 1;

    // Smooth zoom dengan inertia (hanya di mode overview)
    if (!focusBody && Math.abs(zoomVelocity) > 0.001) {
      const dir = new THREE.Vector3()
        .subVectors(controls.target, camera.position)
        .normalize();
      const newPos = camera.position.clone().addScaledVector(dir, zoomVelocity * 4.5);
      const dist = newPos.distanceTo(controls.target);
      if (dist > controls.minDistance && dist < controls.maxDistance) {
        camera.position.copy(newPos);
      }
      zoomVelocity *= ZOOM_DAMPING;
      if (Math.abs(zoomVelocity) < 0.001) zoomVelocity = 0;
    }

    // Auto-follow: kamera mengikuti planet yang bergerak mengorbit
    if (autoFollowEnabled && focusBody && !focusTweening) {
      const sys = planetSystems.find((p) => p.spec.key === focusBody);
      if (sys) {
        sys.mesh.getWorldPosition(_followWorldPos);
        const outward = _followWorldPos.clone().normalize();
        if (outward.lengthSq() < 1e-8) outward.set(1, 0, 0);
        const dist = Math.max(sys.spec.radius * 8, 3.2);
        _followCamTarget
          .copy(_followWorldPos)
          .addScaledVector(outward, dist)
          .add(new THREE.Vector3(0, Math.max(sys.spec.radius * 1.4, 0.6), 0));
        camera.position.lerp(_followCamTarget, 0.055);
        controls.target.lerp(_followWorldPos, 0.055);
        controls.update();
      }
    } else if (focusBody) {
      // Fokus planet normal
      if (focusTweening) {
        controls.enabled = false;
      } else {
        controls.enabled = true;
        controls.enableZoom = false;
        controls.enableRotate = true;
        controls.update();
      }
    } else {
      // Free orbit
      controls.enabled = true;
      controls.update();
    }

    // Update planet labels
    updatePlanetLabels();

    renderer.render(scene, camera);
  }

  animate();

})().catch((err) => {
  /* -----------------------------------------------
   *  ERROR HANDLER
   *  Menampilkan pesan error jika terjadi masalah
   *  fatal saat inisialisasi.
   * ----------------------------------------------- */
  console.error(err);
  if (typeof window.__hideIntroFallback === "function")
    window.__hideIntroFallback();
  document.body.insertAdjacentHTML(
    "beforeend",
    '<div style="position:fixed;bottom:12px;left:12px;right:12px;z-index:300;max-width:560px;margin:0 auto;background:#4a1515;color:#fff;padding:12px 14px;font-family:system-ui;font-size:13px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.4)">' +
    "<strong>Runtime error.</strong> Buka konsol (F12). " +
    String(err && err.message ? err.message : err) +
    "</div>"
  );
});
