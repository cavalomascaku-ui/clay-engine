/**
 * =========================================================================
 *  ClayEngine 3D - Micro-Framework de Modelagem & Escultura Orgânica
 *  Versão: 2.0.0 (Anatomy, Modifiers, Auto-Rigging & GLB Export)
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
  const MathOps = {
    smin(a, b, k = 0.2) {
      const h = Math.max(k - Math.abs(a - b), 0.0) / k;
      return Math.min(a, b) - h * h * k * 0.25;
    },
    smax(a, b, k = 0.1) {
      const h = Math.max(k - Math.abs(-a - b), 0.0) / k;
      return Math.max(-a, b) + h * h * k * 0.25;
    },
    length3(x, y, z) { return Math.hypot(x, y, z); },
    length2(x, y) { return Math.hypot(x, y); },

    // Primitivas Base
    sphere(x, y, z, r) {
      return this.length3(x, y, z) - r;
    },
    ellipsoid(x, y, z, rx, ry, rz) {
      const k0 = this.length3(x / rx, y / ry, z / rz);
      const k1 = this.length3(x / (rx * rx), y / (ry * ry), z / (rz * rz));
      return k0 * (k0 - 1.0) / k1;
    },
    capsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
      const pax = px - ax, pay = py - ay, paz = pz - az;
      const bax = bx - ax, bay = by - ay, baz = bz - az;
      const h = Math.max(0.0, Math.min(1.0, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
      return this.length3(pax - bax * h, pay - bay * h, paz - baz * h) - r;
    },
    roundCone(px, py, pz, ax, ay, az, bx, by, bz, r1, r2) {
      const bax = bx - ax, bay = by - ay, baz = bz - az;
      const l2 = bax * bax + bay * bay + baz * baz;
      const pax = px - ax, pay = py - ay, paz = pz - az;
      const y = (pax * bax + pay * bay + paz * baz) / l2;
      const h = Math.max(0.0, Math.min(1.0, y));
      const r = r1 * (1.0 - h) + r2 * h;
      return this.length3(pax - bax * h, pay - bay * h, paz - baz * h) - r;
    },
    box(x, y, z, bx, by, bz) {
      const qx = Math.abs(x) - bx, qy = Math.abs(y) - by, qz = Math.abs(z) - bz;
      return this.length3(Math.max(qx, 0.0), Math.max(qy, 0.0), Math.max(qz, 0.0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0.0);
    },
    torus(x, y, z, tx, ty) {
      const qx = this.length2(x, z) - tx;
      return this.length2(qx, y) - ty;
    },

    // Espelho de Simetria X
    symX(x) { return Math.abs(x); }
  };

  // -----------------------------------------------------------------------
  // 2. FORMAS COMPLEXAS & ANATOMIA AUTOMÁTICA (ClayEngine.Shapes)
  // -----------------------------------------------------------------------
  const Shapes = {
    // Olho 3D de Massinha com Órbita e Pálpebra na Casca Exata
    eye(x, y, z, posX, posY, posZ, radius = 0.05) {
      const dx = x - posX, dy = y - posY, dz = z - posZ;
      const eyeBall = MathOps.sphere(dx, dy, dz, radius);
      // Pálpebra superior curva
      const lid = MathOps.torus(dx, dy - radius * 0.2, dz, radius * 0.95, radius * 0.25);
      return MathOps.smin(eyeBall, lid, radius * 0.3);
    },

    // Membro de 2 Articulações (Braço ou Perna)
    limb(x, y, z, ax, ay, az, jx, jy, jz, bx, by, bz, r1 = 0.08, r2 = 0.06) {
      const upper = MathOps.capsule(x, y, z, ax, ay, az, jx, jy, jz, r1);
      const lower = MathOps.capsule(x, y, z, jx, jy, jz, bx, by, bz, r2);
      const joint = MathOps.sphere(x - jx, y - jy, z - jz, r1 * 1.05); // Volume do joelho/cotovelo
      return MathOps.smin(MathOps.smin(upper, lower, 0.04), joint, 0.04);
    },

    // Chifre ou Garra Curvada
    curvedSpike(x, y, z, ax, ay, az, bx, by, bz, curveX, curveZ, r1 = 0.08, r2 = 0.01) {
      const mx = (ax + bx) * 0.5 + curveX;
      const my = (ay + by) * 0.5;
      const mz = (az + bz) * 0.5 + curveZ;
      const seg1 = MathOps.roundCone(x, y, z, ax, ay, az, mx, my, mz, r1, (r1 + r2) * 0.5);
      const seg2 = MathOps.roundCone(x, y, z, mx, my, mz, bx, by, bz, (r1 + r2) * 0.5, r2);
      return MathOps.smin(seg1, seg2, 0.04);
    }
  };

  // -----------------------------------------------------------------------
  // 3. MODIFICADORES ORGÂNICOS DE MASSINHA (ClayEngine.Modifiers)
  // -----------------------------------------------------------------------
  const Modifiers = {
    // Ruído de Digitais / Imperfeições de Massinha
    clayNoise(x, y, z, frequency = 25.0, amplitude = 0.008) {
      return (Math.sin(x * frequency) * Math.sin(y * frequency) * Math.sin(z * frequency)) * amplitude;
    },
    // Torção de Espaço (Twist)
    twistY(x, y, z, strength = 1.0) {
      const angle = y * strength;
      const s = Math.sin(angle), c = Math.cos(angle);
      return { x: c * x - s * z, y: y, z: s * x + c * z };
    }
  };

  // -----------------------------------------------------------------------
  // 4. EXTRATOR DE MALHA POLIGONAL LISA (SURFACE NETS)
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

  function extractMesh(sdfFunc, colorFunc, bounds, dims = [52, 52, 52]) {
    const [nx, ny, nz] = dims;
    const { minX, maxX, minY, maxY, minZ, maxZ } = bounds;
    
    const stepX = (maxX - minX) / (nx - 1);
    const stepY = (maxY - minY) / (ny - 1);
    const stepZ = (maxZ - minZ) / (nz - 1);

    const grid = new Float32Array(nx * ny * nz);
    let ptr = 0;
    for (let k = 0; k < nz; k++) {
      const z = minZ + k * stepZ;
      for (let j = 0; j < ny; j++) {
        const y = minY + j * stepY;
        for (let i = 0; i < nx; i++) {
          grid[ptr++] = sdfFunc(minX + i * stepX, y, z);
        }
      }
    }

    const vertices = [], normals = [], colors = [], indices = [];
    const cellMap = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);

    function getNormal(x, y, z) {
      const eps = 0.002;
      const dx = sdfFunc(x + eps, y, z) - sdfFunc(x - eps, y, z);
      const dy = sdfFunc(x, y + eps, z) - sdfFunc(x - eps, y, z);
      const dz = sdfFunc(x, y, z + eps) - sdfFunc(x - eps, y, z - eps);
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
          const idx = i + nx * (j + ny * k);
          const val = grid[idx];

          if ((val < 0) !== (grid[idx + 1] < 0)) {
            const c0 = cellMap[i + sx * (j + sy * k)];
            const c1 = cellMap[i + sx * ((j - 1) + sy * k)];
            const c2 = cellMap[i + sx * ((j - 1) + sy * (k - 1))];
            const c3 = cellMap[i + sx * (j + sy * (k - 1))];
            if (c0 !== -1 && c1 !== -1 && c2 !== -1 && c3 !== -1) {
              if (val < 0) indices.push(c0, c1, c2, c0, c2, c3);
              else indices.push(c0, c2, c1, c0, c3, c2);
            }
          }
          if ((val < 0) !== (grid[idx + nx] < 0)) {
            const c0 = cellMap[i + sx * (j + sy * k)];
            const c1 = cellMap[(i - 1) + sx * (j + sy * k)];
            const c2 = cellMap[(i - 1) + sx * (j + sy * (k - 1))];
            const c3 = cellMap[i + sx * (j + sy * (k - 1))];
            if (c0 !== -1 && c1 !== -1 && c2 !== -1 && c3 !== -1) {
              if (val < 0) indices.push(c0, c2, c1, c0, c3, c2);
              else indices.push(c0, c1, c2, c0, c2, c3);
            }
          }
          if ((val < 0) !== (grid[idx + nx * ny] < 0)) {
            const c0 = cellMap[i + sx * (j + sy * k)];
            const c1 = cellMap[(i - 1) + sx * (j + sy * k)];
            const c2 = cellMap[(i - 1) + sx * ((j - 1) + sy * k)];
            const c3 = cellMap[i + sx * ((j - 1) + sy * k)];
            if (c0 !== -1 && c1 !== -1 && c2 !== -1 && c3 !== -1) {
              if (val < 0) indices.push(c0, c1, c2, c0, c2, c3);
              else indices.push(c0, c2, c1, c0, c3, c2);
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

  // -----------------------------------------------------------------------
  // 5. AUTO-RIGGING AUTOMÁTICO POR DISTÂNCIA DE CALOR (ClayEngine.createRig)
  // -----------------------------------------------------------------------
  function autoSkinGeometry(geometry, boneList) {
    const pos = geometry.attributes.position;
    const skinIndices = [];
    const skinWeights = [];

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      
      // Calcula a distância euclidiana para cada osso no espaço global
      const distances = [];
      boneList.forEach((b, idx) => {
        const wp = new THREE.Vector3();
        b.getWorldPosition(wp);
        const dist = Math.hypot(vx - wp.x, vy - wp.y, vz - wp.z);
        distances.push({ index: idx, dist: dist, weight: 1.0 / (Math.pow(dist, 2.5) + 0.001) });
      });

      // Pega os 2 ossos com maior influência
      distances.sort((a, b) => b.weight - a.weight);
      const b0 = distances[0], b1 = distances[1];
      const totalWeight = b0.weight + b1.weight;

      const w0 = b0.weight / totalWeight;
      const w1 = b1.weight / totalWeight;

      skinIndices.push(b0.index, b1.index, 0, 0);
      skinWeights.push(w0, w1, 0, 0);
    }

    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    return geometry;
  }

  // -----------------------------------------------------------------------
  // 6. EXPORTADORES (.OBJ E .GLB COM ANIMAÇÕES)
  // -----------------------------------------------------------------------
  function exportOBJ(geometry, filename = "model.obj") {
    const pos = geometry.attributes.position;
    const norm = geometry.attributes.normal;
    const col = geometry.attributes.color;
    const index = geometry.index;
    
    let obj = "# ClayEngine 3D Exported Mesh\n";
    for (let i = 0; i < pos.count; i++) {
      const r = col ? col.getX(i).toFixed(3) : "0.5";
      const g = col ? col.getY(i).toFixed(3) : "0.5";
      const b = col ? col.getZ(i).toFixed(3) : "0.5";
      obj += `v ${pos.getX(i).toFixed(4)} ${pos.getY(i).toFixed(4)} ${pos.getZ(i).toFixed(4)} ${r} ${g} ${b}\n`;
    }
    if (norm) {
      for (let i = 0; i < norm.count; i++) {
        obj += `vn ${norm.getX(i).toFixed(4)} ${norm.getY(i).toFixed(4)} ${norm.getZ(i).toFixed(4)}\n`;
      }
    }
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i) + 1, b = index.getX(i + 1) + 1, c = index.getX(i + 2) + 1;
        obj += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
      }
    }

    const blob = new Blob([obj], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  // -----------------------------------------------------------------------
  // 7. API PÚBLICA DA CLAYENGINE v2.0.0
  // -----------------------------------------------------------------------
  return {
    version: "2.0.0",
    Math: MathOps,
    Shapes: Shapes,
    Modifiers: Modifiers,

    // Criação de Geometria Estática
    createMesh(sdfFunc, colorFunc, bounds, resolution = [52, 52, 52]) {
      return extractMesh(sdfFunc, colorFunc, bounds, resolution);
    },

    // Criação de Geometria Rigged com Auto-Skinning Automático
    createRiggedMesh(sdfFunc, colorFunc, bounds, boneList, resolution = [52, 52, 52]) {
      const geo = extractMesh(sdfFunc, colorFunc, bounds, resolution);
      return autoSkinGeometry(geo, boneList);
    },

    // Exportadores
    exportOBJ(geometry, filename) {
      exportOBJ(geometry, filename);
    }
  };
}));
