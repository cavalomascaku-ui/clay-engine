const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const ClayEngine = require('../clay-engine.js');

const bounds = {
  minX: -1,
  maxX: 1,
  minY: -1,
  maxY: 1,
  minZ: -1,
  maxZ: 1
};

function closeTo(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `esperado ${expected}, obtido ${actual}`);
}

test('expõe uma versão semântica e a API matemática', () => {
  assert.match(ClayEngine.version, /^\d+\.\d+\.\d+$/);
  const { sphere, capsule } = ClayEngine.Math;
  closeTo(sphere(0, 0, 0, 1), -1);
  closeTo(capsule(1, 0, 0, 0, 0, 0, 0, 0, 0, 0.25), 0.75);
});

test('smax calcula o máximo suave e trata k não positivo', () => {
  const { smax, smin } = ClayEngine.Math;
  for (const [a, b, k] of [[0.1, -0.05, 0.2], [-0.1, 0.05, 0.2], [-0.1, -0.05, 0.2]]) {
    closeTo(smax(a, b, k), -smin(-a, -b, k));
  }
  assert.equal(smax(-2, 1, 0), 1);
});

test('primitivas degeneradas permanecem finitas', () => {
  assert.equal(Number.isFinite(ClayEngine.Math.capsule(1, 2, 3, 0, 0, 0, 0, 0, 0, 0.5)), true);
  assert.equal(Number.isFinite(ClayEngine.Math.roundCone(1, 2, 3, 0, 0, 0, 0, 0, 0, 0.5, 0.2)), true);
  assert.equal(Number.isFinite(ClayEngine.Math.ellipsoid(0, 0, 0, 1, 2, 3)), true);
});

test('rejeita parâmetros inválidos nos modificadores e no gerador', () => {
  assert.throws(() => ClayEngine.Modifiers.radialRepeat(1, 0, 0), RangeError);
  assert.throws(() => ClayEngine.Modifiers.radialRepeat(1, 0, 2.5), RangeError);
  assert.throws(() => ClayEngine.createMesh(() => 1, null, bounds, [1, 8, 8]), RangeError);
  assert.throws(() => ClayEngine.createMesh(() => 1, null, { ...bounds, maxX: -1 }, [8, 8, 8]), RangeError);
  assert.throws(() => ClayEngine.createMesh(null, null, bounds, [8, 8, 8]), TypeError);
});

test('preserva valores explícitos zero nos materiais', () => {
  const material = ClayEngine.Materials.clay({ roughness: 0, metalness: 0 });
  assert.equal(material.roughness, 0);
  assert.equal(material.metalness, 0);
});

test('extrai malha com normais alinhadas ao gradiente do SDF', () => {
  const geometry = ClayEngine.createMesh(
    (x, y, z) => ClayEngine.Math.sphere(x, y, z, 0.75),
    (x, y, z, nx, ny, nz) => [Math.abs(nx), Math.abs(ny), Math.abs(nz)],
    bounds,
    [18, 18, 18]
  );
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const color = geometry.attributes.color;
  assert.ok(position.count > 0);
  assert.equal(normal.count, position.count);
  assert.equal(color.count, position.count);

  let minimumDot = 1;
  for (let i = 0; i < position.count; i++) {
    const px = position.getX(i), py = position.getY(i), pz = position.getZ(i);
    const length = Math.hypot(px, py, pz);
    const dot = (px * normal.getX(i) + py * normal.getY(i) + pz * normal.getZ(i)) / length;
    minimumDot = Math.min(minimumDot, dot);
  }
  assert.ok(minimumDot > 0.98, `normais desalinhadas; menor produto escalar: ${minimumDot}`);
});

test('exportOBJ retorna conteúdo em ambientes sem DOM', () => {
  const geometry = ClayEngine.createMesh(
    (x, y, z) => ClayEngine.Math.sphere(x, y, z, 0.75),
    null,
    bounds,
    [10, 10, 10]
  );
  const obj = ClayEngine.exportOBJ(geometry, 'sphere.obj');
  assert.match(obj, /^# ClayEngine 3D Pro Exported Mesh/m);
  assert.match(obj, /^v /m);
  assert.match(obj, /^vn /m);
  assert.match(obj, /^f /m);
});

test('exportOBJ também escreve faces de geometrias não indexadas', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0
  ], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1
  ], 3));
  const obj = ClayEngine.exportOBJ(geometry);
  assert.match(obj, /^f 1\/\/1 2\/\/2 3\/\/3$/m);
});

test('fábricas de textura rejeitam entradas vazias antes de acessar o DOM', () => {
  assert.throws(() => ClayEngine.Textures.stripes('#fff', '#000', 0), RangeError);
  assert.throws(() => ClayEngine.Textures.runes([]), RangeError);
});
