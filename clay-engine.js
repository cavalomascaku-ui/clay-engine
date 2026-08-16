/**
 * =========================================================================
 *  ClayEngine 3D - Pro Procedural Modeling, Texturing & Animation Suite
 *  Versão: 3.6.0 (SDF, Anatomy, Auto-Rig, Procedural Textures & Materials)
 *  Autor: cavalomascaku-ui
 * =========================================================================
 */

(function (global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory(require('three'));
  } else if (typeof define === 'function' && define.amd) {
    define(['three'], factory);
  } else {
    global.ClayEngine = factory(global.THREE);
  }
}(this, function (THREE) {
  'use strict';

  if (!THREE) {
    throw new Error('ClayEngine requer Three.js como dependência.');
  }

  // -----------------------------------------------------------------------
  // 1. MATEMÁTICA & OPERADORES VOLUMÉTRICOS (SDF)
  // -----------------------------------------------------------------------
  function assertPositiveFinite(value, name) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${name} deve ser um número finito maior que zero.`);
    }
    return value;
  }

  function assertPositiveInteger(value, name) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new RangeError(`${name} deve ser um inteiro maior que zero.`);
    }
    return value;
  }

  const MathOps = {
    smin(a, b, k = 0.15) {
      if (k <= 0) return Math.min(a, b);
      const h = Math.max(k - Math.abs(a - b), 0.0) / k;
      return Math.min(a, b) - h * h * k * 0.25;
    },
    smax(a, b, k = 0.05) {
      if (k <= 0) return Math.max(a, b);
      return -MathOps.smin(-a, -b, k);
    },
    sintersect(a, b, k = 0.05) {
      if (k <= 0) return Math.max(a, b);
      const h = Math.max(k - Math.abs(a - b), 0.0) / k;
      return Math.max(a, b) + h * h * k * 0.25;
    },
    onion(d, thickness = 0.02) {
      return Math.abs(d) - thickness;
    },
    length3(x, y, z) { return Math.hypot(x, y, z); },
    length2(x, y) { return Math.hypot(x, y); },
    clamp(v, min = 0, max = 1) { return Math.max(min, Math.min(max, v)); },

    sphere(x, y, z, r) { return MathOps.length3(x, y, z) - r; },
    ellipsoid(x, y, z, rx, ry, rz) {
      assertPositiveFinite(rx, 'rx');
      assertPositiveFinite(ry, 'ry');
      assertPositiveFinite(rz, 'rz');
      const k0 = MathOps.length3(x / rx, y / ry, z / rz);
      const k1 = MathOps.length3(x / (rx * rx), y / (ry * ry), z / (rz * rz));
      return k1 === 0 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1.0) / k1;
    },
    capsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
      const pax = px - ax, pay = py - ay, paz = pz - az;
      const bax = bx - ax, bay = by - ay, baz = bz - az;
      const l2 = bax * bax + bay * bay + baz * baz;
      if (l2 === 0) return MathOps.length3(pax, pay, paz) - r;
      const h = MathOps.clamp((pax * bax + pay * bay + paz * baz) / l2);
      return MathOps.length3(pax - bax * h, pay - bay * h, paz - baz * h) - r;
    },
    roundCone(px, py, pz, ax, ay, az, bx, by, bz, r1, r2) {
      const bax = bx - ax, bay = by - ay, baz = bz - az;
      const l2 = bax * bax + bay * bay + baz * baz;
      const pax = px - ax, pay = py - ay, paz = pz - az;
      if (l2 === 0) return MathOps.length3(pax, pay, paz) - Math.max(r1, r2);
      const y = (pax * bax + pay * bay + paz * baz) / l2;
      const h = MathOps.clamp(y);
      const r = r1 * (1.0 - h) + r2 * h;
      return MathOps.length3(pax - bax * h, pay - bay * h, paz - baz * h) - r;
    },
    box(x, y, z, bx, by, bz) {
      const qx = Math.abs(x) - bx, qy = Math.abs(y) - by, qz = Math.abs(z) - bz;
      return MathOps.length3(Math.max(qx, 0.0), Math.max(qy, 0.0), Math.max(qz, 0.0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0.0);
    },
    cylinder(x, y, z, h, r) {
      const dX = MathOps.length2(x, z) - r, dY = Math.abs(y) - h;
      return Math.min(Math.max(dX, dY), 0.0) + MathOps.length2(Math.max(dX, 0.0), Math.max(dY, 0.0));
    },
    torus(x, y, z, tx, ty) {
      const qx = MathOps.length2(x, z) - tx;
      return MathOps.length2(qx, y) - ty;
    },
    symX(x) { return Math.abs(x); }
  };

  // -----------------------------------------------------------------------
  // 2. MODIFICADORES ORGÂNICOS (ClayEngine.Modifiers)
  // -----------------------------------------------------------------------
  const Modifiers = {
    clayNoise(x, y, z, freq = 28.0, amp = 0.006) {
      return (Math.sin(x * freq) * Math.sin(y * freq) * Math.sin(z * freq)) * amp;
    },
    twistY(x, y, z, strength = 1.0) {
      const angle = y * strength;
      const s = Math.sin(angle), c = Math.cos(angle);
      return { x: c * x - s * z, y: y, z: s * x + c * z };
    },
    bendX(x, y, z, curve = 0.5) {
      const c = Math.cos(curve * y), s = Math.sin(curve * y);
      return { x: c * x - s * y, y: s * x + c * y, z: z };
    },
    radialRepeat(x, z, count = 6) {
      assertPositiveInteger(count, 'count');
      const angle = (Math.PI * 2) / count;
      let a = Math.atan2(z, x) + angle * 0.5;
      const r = Math.hypot(x, z);
      a = ((a % angle) + angle) % angle - angle * 0.5;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r };
    }
  };

  // -----------------------------------------------------------------------
  // 3. ANATOMIA INTELIGENTE (ClayEngine.Anatomy)
  // -----------------------------------------------------------------------
  const Anatomy = {
    eye3D(x, y, z, px, py, pz, radius = 0.045) {
      const dx = x - px, dy = y - py, dz = z - pz;
      const eyeBall = MathOps.sphere(dx, dy, dz, radius);
      const upperLid = MathOps.torus(dx, dy - radius * 0.25, dz - 0.005, radius * 0.95, radius * 0.22);
      return MathOps.smin(eyeBall, upperLid, radius * 0.25);
    },
    mouth3D(x, y, z, px, py, pz, width = 0.06, curve = 0.25) {
      const dx = x - px, dy = y - py, dz = z - pz;
      return MathOps.torus(dx, dy + (dx * dx) * curve, dz, width, 0.008);
    },
    limb3D(x, y, z, ax, ay, az, jx, jy, jz, bx, by, bz, r1 = 0.065, r2 = 0.05) {
      const upper = MathOps.capsule(x, y, z, ax, ay, az, jx, jy, jz, r1);
      const lower = MathOps.capsule(x, y, z, jx, jy, jz, bx, by, bz, r2);
      const joint = MathOps.sphere(x - jx, y - jy, z - jz, r1 * 1.06);
      return MathOps.smin(MathOps.smin(upper, lower, 0.03), joint, 0.03);
    },
    claw3D(x, y, z, ax, ay, az, bx, by, bz, curveX = 0, curveZ = 0.05, r1 = 0.06, r2 = 0.005) {
      const mx = (ax + bx) * 0.5 + curveX, my = (ay + by) * 0.5, mz = (az + bz) * 0.5 + curveZ;
      const seg1 = MathOps.roundCone(x, y, z, ax, ay, az, mx, my, mz, r1, (r1 + r2) * 0.5);
      const seg2 = MathOps.roundCone(x, y, z, mx, my, mz, bx, by, bz, (r1 + r2) * 0.5, r2);
      return MathOps.smin(seg1, seg2, 0.03);
    }
  };

  // -----------------------------------------------------------------------
  // 4. GERADOR DE TEXTURAS PROCEDURAIS (ClayEngine.Textures)
  // -----------------------------------------------------------------------
  const Textures = {
    // Rosto de Anime Vetorial Customizável
    animeFace(options = {}) {
      const {
        irisColor = '#1d4ed8',
        irisGlow = '#38bdf8',
        expression = 'determined', // 'determined' | 'angry' | 'happy' | 'berserker'
        blush = true,
        eyeSpacing = 192
      } = options;

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 512, 512);

      function drawEye(cx, cy, isLeft) {
        ctx.save();
        ctx.translate(cx, cy);

        // Esclera
        ctx.beginPath();
        ctx.ellipse(0, 0, 46, 62, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Íris em Degradê
        const grad = ctx.createLinearGradient(0, -45, 0, 45);
        if (expression === 'berserker') {
          grad.addColorStop(0, '#4a0000');
          grad.addColorStop(0.5, '#dc2626');
          grad.addColorStop(1, '#ff8800');
        } else {
          grad.addColorStop(0, '#0a1936');
          grad.addColorStop(0.5, irisColor);
          grad.addColorStop(1, irisGlow);
        }
        ctx.beginPath();
        ctx.ellipse(0, 2, 34, 50, 0, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Pupila
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 24, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#050a14';
        ctx.fill();

        // Brilhos de Luz Anime
        ctx.beginPath();
        ctx.arc(isLeft ? 12 : 8, -16, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(isLeft ? -10 : -8, 14, 6, 0, Math.PI * 2);
        ctx.fill();

        // Cílios Superiores
        ctx.beginPath();
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#18120c';
        ctx.arc(0, -10, 50, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();

        // Sobrancelha
        ctx.beginPath();
        ctx.lineWidth = 10;
        ctx.strokeStyle = expression === 'berserker' ? '#4a0a0a' : '#22140c';
        if (expression === 'angry' || expression === 'berserker') {
          ctx.moveTo(isLeft ? -50 : 50, -65);
          ctx.lineTo(isLeft ? 50 : -50, -100);
        } else if (expression === 'happy') {
          ctx.arc(0, -75, 45, Math.PI * 1.25, Math.PI * 1.75);
        } else {
          ctx.moveTo(isLeft ? -45 : 45, -75);
          ctx.lineTo(isLeft ? 45 : -45, -92);
        }
        ctx.stroke();

        ctx.restore();
      }

      const centerX = 256;
      drawEye(centerX - eyeSpacing * 0.5, 220, true);
      drawEye(centerX + eyeSpacing * 0.5, 220, false);

      if (blush && expression !== 'berserker') {
        ctx.fillStyle = 'rgba(255, 100, 120, 0.28)';
        ctx.beginPath(); ctx.ellipse(centerX - eyeSpacing * 0.6, 295, 36, 16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(centerX + eyeSpacing * 0.6, 295, 36, 16, 0, 0, Math.PI * 2); ctx.fill();
      }

      // Boca
      ctx.beginPath();
      ctx.lineWidth = 6;
      ctx.strokeStyle = expression === 'berserker' ? '#2a0505' : '#5a2518';
      if (expression === 'berserker') {
        // Boca aberta com presas
        ctx.fillStyle = '#4a0808';
        ctx.ellipse(centerX, 330, 38, 24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (expression === 'happy') {
        ctx.arc(centerX, 305, 36, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      } else {
        ctx.arc(centerX, 310, 30, Math.PI * 0.15, Math.PI * 0.75);
        ctx.stroke();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    },

    // Textura de Listras (Canudos, roupas mágicas, doces)
    stripes(color1 = '#ffffff', color2 = '#dc2626', count = 10) {
      assertPositiveInteger(count, 'count');
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const step = canvas.height / count;
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = i % 2 === 0 ? color1 : color2;
        ctx.fillRect(0, i * step, canvas.width, step);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    },

    // Runas Mágicas / Kanjis Japoneses
    runes(symbols = ["滅", "死", "魂", "血"], glowColor = "#ff2244") {
      if (!Array.isArray(symbols) || symbols.length === 0) {
        throw new RangeError('symbols deve conter ao menos um símbolo.');
      }
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = "bold 95px 'Yu Gothic', serif";
      const spacing = canvas.height / (symbols.length + 1);

      symbols.forEach((char, idx) => {
        const y = spacing * (idx + 1);
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 25;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(char, canvas.width / 2, y);
      });
      return new THREE.CanvasTexture(canvas);
    }
  };

  // -----------------------------------------------------------------------
  // 5. MATERIAIS PROCEDURAIS DE JOGO (ClayEngine.Materials)
  // -----------------------------------------------------------------------
  const Materials = {
    clay(options = {}) {
      const { roughness = 0.65, metalness = 0.05, ...rest } = options || {};
      return new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness,
        metalness,
        ...rest
      });
    },
    glowing(color = 0xff3300, intensity = 1.5) {
      return new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: intensity,
        roughness: 0.1
      });
    },
    liquid(color = 0xffffff, opacity = 0.9) {
      return new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: opacity
      });
    },
    metal(color = 0xd8e4f0, roughness = 0.25, metalness = 0.7) {
      return new THREE.MeshStandardMaterial({
        color: color,
        roughness: roughness,
        metalness: metalness
      });
    }
  };

  // -----------------------------------------------------------------------
  // 6. PALETAS DE CORES AUXILIARES (ClayEngine.Colors)
  // -----------------------------------------------------------------------
  const Colors = {
    skin(ao = 1.0) { return [0.96 * ao, 0.78 * ao, 0.64 * ao]; },
    heroBlue(ao = 1.0) { return [0.18 * ao, 0.44 * ao, 0.82 * ao]; },
    crimsonRed(ao = 1.0) { return [0.88 * ao, 0.20 * ao, 0.16 * ao]; },
    leatherBrown(ao = 1.0) { return [0.42 * ao, 0.26 * ao, 0.15 * ao]; },
    gold(ao = 1.0) { return [0.95 * ao, 0.78 * ao, 0.22 * ao]; },
    steel(ao = 1.0) { return [0.85 * ao, 0.88 * ao, 0.94 * ao]; },
    calcAO(ny = 1.0) { return Math.max(0.45, Math.min(1.0, 0.7 + 0.3 * ny)); }
  };

  // -----------------------------------------------------------------------
  // 7. EXTRATOR SURFACE NETS & RIGGING
  // -----------------------------------------------------------------------
  const CORNERS = [
    [0,0,0], [1,0,0], [0,1,0], [1,1,0],
    [0,0,1], [1,0,1], [0,1,1], [1,1,1]
  ];
  const EDGES = [
    [0,1], [2,3], [4,5], [6,7],
    [0,2], [1,3], [4,6], [5,7],
    [0,4], [1,5], [2,6], [3,7]
  ];

  function extractMesh(sdfFunc, colorFunc, bounds, dims = [46, 48, 46]) {
    if (typeof sdfFunc !== 'function') throw new TypeError('sdfFunc deve ser uma função.');
    if (!bounds || !Object.values(bounds).every(Number.isFinite)) {
      throw new TypeError('bounds deve conter minX, maxX, minY, maxY, minZ e maxZ finitos.');
    }
    const { minX, maxX, minY, maxY, minZ, maxZ } = bounds;
    if (!(maxX > minX && maxY > minY && maxZ > minZ)) {
      throw new RangeError('Cada limite máximo deve ser maior que o limite mínimo correspondente.');
    }
    if (!Array.isArray(dims) || dims.length !== 3 || !dims.every((value) => Number.isInteger(value) && value >= 2)) {
      throw new RangeError('resolution deve conter três inteiros maiores ou iguais a 2.');
    }
    const [nx, ny, nz] = dims;
    const stepX = (maxX - minX) / (nx - 1), stepY = (maxY - minY) / (ny - 1), stepZ = (maxZ - minZ) / (nz - 1);

    const grid = new Float32Array(nx * ny * nz);
    let ptr = 0;
    for (let k = 0; k < nz; k++) {
      const z = minZ + k * stepZ;
      for (let j = 0; j < ny; j++) {
        const y = minY + j * stepY;
        for (let i = 0; i < nx; i++) grid[ptr++] = sdfFunc(minX + i * stepX, y, z);
      }
    }

    const vertices = [], normals = [], colors = [], indices = [];
    const cellMap = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);

    function getNormal(x, y, z) {
      const eps = 0.002;
      const dx = sdfFunc(x + eps, y, z) - sdfFunc(x - eps, y, z);
      const dy = sdfFunc(x, y + eps, z) - sdfFunc(x, y - eps, z);
      const dz = sdfFunc(x, y, z + eps) - sdfFunc(x, y, z - eps);
      const len = Math.hypot(dx, dy, dz) || 1;
      return [dx / len, dy / len, dz / len];
    }

    let vCount = 0;
    for (let k = 0; k < nz - 1; k++) {
      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const cornerValues = new Float32Array(8);
          let mask = 0;
          for (let c = 0; c < 8; c++) {
            const val = grid[(i + CORNERS[c][0]) + nx * ((j + CORNERS[c][1]) + ny * (k + CORNERS[c][2]))];
            cornerValues[c] = val;
            if (val < 0.0) mask |= (1 << c);
          }
          if (mask === 0 || mask === 255) continue;

          let sumX = 0, sumY = 0, sumZ = 0, crossings = 0;
          for (let e = 0; e < 12; e++) {
            const v0 = cornerValues[EDGES[e][0]], v1 = cornerValues[EDGES[e][1]];
            if ((v0 < 0) !== (v1 < 0)) {
              const t = v0 / (v0 - v1);
              const p0 = CORNERS[EDGES[e][0]], p1 = CORNERS[EDGES[e][1]];
              sumX += minX + (i + p0[0] + t * (p1[0] - p0[0])) * stepX;
              sumY += minY + (j + p0[1] + t * (p1[1] - p0[1])) * stepY;
              sumZ += minZ + (k + p0[2] + t * (p1[2] - p0[2])) * stepZ;
              crossings++;
            }
          }
          const vx = sumX / crossings, vy = sumY / crossings, vz = sumZ / crossings;
          vertices.push(vx, vy, vz);
          const [nxV, nyV, nzV] = getNormal(vx, vy, vz);
          normals.push(nxV, nyV, nzV);
          if (colorFunc) {
            const [cr, cg, cb] = colorFunc(vx, vy, vz, nxV, nyV, nzV);
            colors.push(cr, cg, cb);
          } else {
            colors.push(0.5, 0.7, 0.3);
          }
          cellMap[i + (nx - 1) * (j + (ny - 1) * k)] = vCount++;
        }
      }
    }

    const sx = nx - 1, sy = ny - 1;
    for (let k = 1; k < nz - 1; k++) {
      for (let j = 1; j < ny - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const idx = i + nx * (j + ny * k), val = grid[idx];
          if ((val < 0) !== (grid[idx + 1] < 0)) {
            const c0 = cellMap[i + sx * (j + sy * k)], c1 = cellMap[i + sx * ((j - 1) + sy * k)], c2 = cellMap[i + sx * ((j - 1) + sy * (k - 1))], c3 = cellMap[i + sx * (j + sy * (k - 1))];
            if (c0 !== -1 && c1 !== -1 && c2 !== -1 && c3 !== -1) {
              if (val < 0) indices.push(c0, c1, c2, c0, c2, c3); else indices.push(c0, c2, c1, c0, c3, c2);
            }
          }
          if ((val < 0) !== (grid[idx + nx] < 0)) {
            const c0 = cellMap[i + sx * (j + sy * k)], c1 = cellMap[(i - 1) + sx * (j + sy * k)], c2 = cellMap[(i - 1) + sx * (j + sy * (k - 1))], c3 = cellMap[i + sx * (j + sy * (k - 1))];
            if (c0 !== -1 && c1 !== -1 && c2 !== -1 && c3 !== -1) {
              if (val < 0) indices.push(c0, c2, c1, c0, c3, c2); else indices.push(c0, c1, c2, c0, c2, c3);
            }
          }
          if ((val < 0) !== (grid[idx + nx * ny] < 0)) {
            const c0 = cellMap[i + sx * (j + sy * k)], c1 = cellMap[(i - 1) + sx * (j + sy * k)], c2 = cellMap[(i - 1) + sx * ((j - 1) + sy * k)], c3 = cellMap[i + sx * ((j - 1) + sy * k)];
            if (c0 !== -1 && c1 !== -1 && c2 !== -1 && c3 !== -1) {
              if (val < 0) indices.push(c0, c1, c2, c0, c2, c3); else indices.push(c0, c2, c1, c0, c3, c2);
            }
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    return geo;
  }

  const Rig = {
    createBiped(meshGeometry) {
      const bones = [];
      function addBone(name, x, y, z, parent = null) {
        const b = new THREE.Bone();
        b.name = name; b.position.set(x, y, z);
        if (parent) parent.add(b);
        bones.push(b);
        return b;
      }

      const root     = addBone("Bone_Root", 0, 0.55, 0);
      const spine    = addBone("Bone_Spine", 0, 0.35, 0, root);
      const head     = addBone("Bone_Head", 0, 0.35, 0.02, spine);
      const lArm     = addBone("Bone_Arm_L", -0.19, 0.05, 0.0, spine);
      const lForeArm = addBone("Bone_ForeArm_L", -0.08, -0.22, 0.02, lArm);
      const lHand    = addBone("Bone_Hand_L", -0.04, -0.24, 0.02, lForeArm);
      const rArm     = addBone("Bone_Arm_R", 0.19, 0.05, 0.0, spine);
      const rForeArm = addBone("Bone_ForeArm_R", 0.08, -0.22, 0.02, rArm);
      const rHand    = addBone("Bone_Hand_R", 0.04, -0.24, 0.02, rForeArm);
      const lThigh   = addBone("Bone_Thigh_L", -0.09, -0.05, 0.0, root);
      const lShin    = addBone("Bone_Shin_L", 0.0, -0.30, 0.02, lThigh);
      const rThigh   = addBone("Bone_Thigh_R", 0.09, -0.05, 0.0, root);
      const rShin    = addBone("Bone_Shin_R", 0.0, -0.30, 0.02, rThigh);

      const pos = meshGeometry.attributes.position;
      const skinIndices = [], skinWeights = [];

      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        let b1 = 0, w1 = 1.0, b2 = 0, w2 = 0.0;
        if (y > 1.14) { b1 = 2; w1 = 1.0; }
        else if (x < -0.18 && y > 0.40 && y <= 1.12) {
          if (y < 0.58) { b1 = 5; w1 = 1.0; } else { b1 = 3; b2 = 4; w1 = 0.5; w2 = 0.5; }
        } else if (x > 0.18 && y > 0.40 && y <= 1.12) {
          if (y < 0.58) { b1 = 8; w1 = 1.0; } else { b1 = 6; b2 = 7; w1 = 0.5; w2 = 0.5; }
        } else if (y <= 0.48) {
          const isLeft = x < 0; b1 = isLeft ? 9 : 11; b2 = isLeft ? 10 : 12;
          const tLeg = Math.max(0, Math.min(1, (y - 0.10) / 0.28));
          w1 = tLeg; w2 = 1.0 - tLeg;
        } else {
          const tTorso = Math.max(0, Math.min(1, (y - 0.48) / 0.42));
          const smoothT = tTorso * tTorso * (3 - 2 * tTorso);
          b1 = 1; w1 = smoothT; b2 = 0; w2 = 1.0 - smoothT;
        }
        skinIndices.push(b1, b2, 0, 0); skinWeights.push(w1, w2, 0, 0);
      }

      meshGeometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
      meshGeometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

      const skinnedMesh = new THREE.SkinnedMesh(meshGeometry, Materials.clay({ skinning: true }));
      const skeleton = new THREE.Skeleton(bones);
      skinnedMesh.add(root);
      skinnedMesh.bind(skeleton);

      return {
        mesh: skinnedMesh,
        skeleton: skeleton,
        bones: { root, spine, head, lArm, lForeArm, lHand, rArm, rForeArm, rHand, lThigh, lShin, rThigh, rShin }
      };
    }
  };

  const Anim = {
    bipedWalk(bones, time, speed = 4.6) {
      const t = time * speed;
      bones.root.position.set(0, 0.55 + Math.abs(Math.sin(t)) * 0.02, 0);
      bones.root.rotation.set(0, Math.sin(t) * 0.04, Math.sin(t) * 0.015);
      bones.spine.rotation.set(0.04, -Math.sin(t) * 0.04, 0);
      bones.head.rotation.set(0, 0, 0);
      bones.lThigh.rotation.set(Math.sin(t) * 0.50, 0, 0.02);
      bones.lShin.rotation.set(Math.max(0, -Math.sin(t) * 0.65), 0, 0);
      bones.rThigh.rotation.set(Math.sin(t + Math.PI) * 0.50, 0, -0.02);
      bones.rShin.rotation.set(Math.max(0, -Math.sin(t + Math.PI) * 0.65), 0, 0);
      bones.lArm.rotation.set(Math.sin(t + Math.PI) * 0.35, 0.0, -0.05);
      bones.lForeArm.rotation.set(-0.25 + Math.sin(t + Math.PI) * 0.1, 0, 0);
      bones.rArm.rotation.set(0.20 + Math.sin(t) * 0.08, 0.0, 0.06);
      bones.rForeArm.rotation.set(-0.30, 0.0, 0);
      bones.rHand.rotation.set(0.15, 0, 0);
    },
    bipedRun(bones, time, speed = 7.5) {
      const t = time * speed;
      bones.root.position.set(0, 0.53 + Math.abs(Math.sin(t)) * 0.045, 0);
      bones.root.rotation.set(0, Math.sin(t) * 0.06, Math.sin(t) * 0.02);
      bones.spine.rotation.set(0.28, -Math.sin(t) * 0.08, 0);
      bones.head.rotation.set(-0.15, 0, 0);
      bones.lThigh.rotation.set(Math.sin(t) * 0.85, 0, 0.02);
      bones.lShin.rotation.set(Math.max(0, -Math.sin(t) * 1.25), 0, 0);
      bones.rThigh.rotation.set(Math.sin(t + Math.PI) * 0.85, 0, -0.02);
      bones.rShin.rotation.set(Math.max(0, -Math.sin(t + Math.PI) * 1.25), 0, 0);
      bones.lArm.rotation.set(Math.sin(t + Math.PI) * 0.75, 0.0, -0.08);
      bones.lForeArm.rotation.set(-0.55 + Math.sin(t + Math.PI) * 0.2, 0, 0);
      bones.rArm.rotation.set(0.35 + Math.sin(t) * 0.40, 0.0, 0.08);
      bones.rForeArm.rotation.set(-0.45, 0.0, 0);
      bones.rHand.rotation.set(0.25, 0, 0);
    }
  };

  function exportOBJ(geometry, filename = "model.obj") {
    if (!geometry || !geometry.attributes || !geometry.attributes.position) {
      throw new TypeError('geometry deve conter um atributo position.');
    }
    const pos = geometry.attributes.position, norm = geometry.attributes.normal, col = geometry.attributes.color, index = geometry.index;
    let obj = "# ClayEngine 3D Pro Exported Mesh\n";
    for (let i = 0; i < pos.count; i++) {
      const r = col ? col.getX(i).toFixed(3) : "0.5", g = col ? col.getY(i).toFixed(3) : "0.5", b = col ? col.getZ(i).toFixed(3) : "0.5";
      obj += `v ${pos.getX(i).toFixed(4)} ${pos.getY(i).toFixed(4)} ${pos.getZ(i).toFixed(4)} ${r} ${g} ${b}\n`;
    }
    if (norm) {
      for (let i = 0; i < norm.count; i++) obj += `vn ${norm.getX(i).toFixed(4)} ${norm.getY(i).toFixed(4)} ${norm.getZ(i).toFixed(4)}\n`;
    }
    if (index) {
      for (let i = 0; i + 2 < index.count; i += 3) {
        const a = index.getX(i) + 1, b = index.getX(i + 1) + 1, c = index.getX(i + 2) + 1;
        obj += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
      }
    } else {
      for (let i = 0; i + 2 < pos.count; i += 3) {
        const a = i + 1, b = i + 2, c = i + 3;
        obj += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
      }
    }
    if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
      return obj;
    }
    const blob = new Blob([obj], { type: "text/plain" });
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    link.click();
    if (typeof link.remove === 'function') link.remove();
    if (typeof URL.revokeObjectURL === 'function') {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
    return obj;
  }

  // -----------------------------------------------------------------------
  // 8. API PÚBLICA DA CLAYENGINE v3.6.0
  // -----------------------------------------------------------------------
  return {
    version: "3.6.0",
    Math: MathOps,
    Modifiers: Modifiers,
    Anatomy: Anatomy,
    Textures: Textures,
    Materials: Materials,
    Colors: Colors,
    Rig: Rig,
    Anim: Anim,

    createMesh(sdfFunc, colorFunc, bounds, resolution = [46, 48, 46]) {
      return extractMesh(sdfFunc, colorFunc, bounds, resolution);
    },
    exportOBJ(geometry, filename) {
      return exportOBJ(geometry, filename);
    }
  };
}));
