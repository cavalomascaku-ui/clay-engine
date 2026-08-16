# ClayEngine

**ClayEngine** é um micro-framework JavaScript para modelagem procedural e escultura orgânica com funções de distância assinadas (SDF) no Three.js. A biblioteca pode ser carregada por CDN ou usada como módulo CommonJS em projetos que já fornecem o pacote `three`.

## Uso via CDN

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/cavalomascaku-ui/clay-engine@main/clay-engine.js"></script>
```

A API fica disponível como `ClayEngine` no escopo global.

## Exemplo rápido

```javascript
const { Math: CMath, createMesh, exportOBJ, Materials } = ClayEngine;

function myModel(x, y, z) {
  const head = CMath.sphere(x, y, z, 1.0);
  const nose = CMath.capsule(x, y, z, 0, 0, 0.8, 0, -0.3, 1.6, 0.2);
  return CMath.smin(head, nose, 0.2);
}

const geometry = createMesh(
  myModel,
  (x, y, z, nx, ny, nz) => [
    0.35 + 0.25 * Math.max(0, ny),
    0.20 + 0.20 * Math.max(0, nz),
    0.12 + 0.15 * Math.max(0, nx)
  ],
  { minX: -2, maxX: 2, minY: -2, maxY: 2, minZ: -2, maxZ: 2 },
  [46, 48, 46]
);

const mesh = new THREE.Mesh(geometry, Materials.clay());
scene.add(mesh);

// Em navegadores, inicia o download. Também retorna o texto OBJ gerado.
const objText = exportOBJ(geometry, "meu_modelo.obj");
```

## API principal

| Área | Funções | Observações |
| --- | --- | --- |
| `ClayEngine.Math` | `sphere`, `ellipsoid`, `capsule`, `roundCone`, `box`, `cylinder`, `torus` | Primitivas SDF e operações auxiliares. `smin`, `smax` e `sintersect` aceitam suavização configurável. |
| `ClayEngine.Modifiers` | `clayNoise`, `twistY`, `bendX`, `radialRepeat` | Modificadores para deformação e repetição radial. `radialRepeat` exige uma contagem inteira positiva. |
| `ClayEngine.Anatomy` | `eye3D`, `mouth3D`, `limb3D`, `claw3D` | Composição de elementos anatômicos a partir de SDFs. |
| `ClayEngine.Textures` | `animeFace`, `stripes`, `runes` | Geração de `THREE.CanvasTexture`; requer um ambiente com `document` e Canvas 2D. |
| `ClayEngine.Materials` | `clay`, `glowing`, `liquid`, `metal` | Fábricas de materiais Three.js. Valores explícitos como `roughness: 0` são preservados. |
| `ClayEngine.Rig` e `ClayEngine.Anim` | `createBiped`, `bipedWalk`, `bipedRun` | Rigging esquelético e animações básicas para malhas geradas. |
| `ClayEngine.exportOBJ` | `exportOBJ(geometry, filename)` | No navegador baixa o arquivo; fora do DOM retorna o texto OBJ sem tentar acessar APIs do navegador. |

## Geração de malha

`createMesh` recebe uma função SDF, uma função opcional de cor, os limites espaciais e a resolução `[nx, ny, nz]`. Cada componente da resolução deve ser um inteiro maior ou igual a `2`, e os limites máximos devem ser maiores que os mínimos correspondentes. As normais são calculadas numericamente a partir do gradiente central do SDF.

A função de cor opcional recebe `x`, `y`, `z` e os componentes da normal; ela deve retornar um vetor `[r, g, b]` com os valores de cor usados no atributo `color` da geometria.

## Uso como pacote CommonJS

```bash
npm install three
```

```javascript
const ClayEngine = require("clay-engine");
const geometry = ClayEngine.createMesh(
  (x, y, z) => ClayEngine.Math.sphere(x, y, z, 1),
  null,
  { minX: -1.5, maxX: 1.5, minY: -1.5, maxY: 1.5, minZ: -1.5, maxZ: 1.5 }
);

const objText = ClayEngine.exportOBJ(geometry);
```

## Desenvolvimento

As dependências de desenvolvimento e o script de validação estão declarados no `package.json`. Para executar os testes:

```bash
npm install
npm test
```

A suíte cobre as operações SDF, entradas degeneradas, validação de parâmetros, materiais, normais de malha, exportação OBJ e fábricas de textura.
