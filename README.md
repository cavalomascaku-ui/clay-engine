# 🏺 ClayEngine 3D
> Micro-framework em JavaScript para modelagem procedural e escultura orgânica estilo "massinha" no Three.js.

## 🚀 Como Usar via CDN
Adicione no seu HTML:
\`\`\`html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/SEU_USUARIO/clay-engine@main/clay-engine.js"></script>
\`\`\`

## 💻 Exemplo Rápido
\`\`\`javascript
const { Math: CMath, createMesh, exportOBJ } = ClayEngine;

// 1. Defina o modelo com fusão de massinha (SDF)
function myModel(x, y, z) {
  const head = CMath.sphere(x, y, z, 1.0);
  const nose = CMath.capsule(x, y, z, 0, 0, 0.8, 0, -0.3, 1.6, 0.2);
  return CMath.smin(head, nose, 0.2); // Funde suavemente!
}

// 2. Gere a malha Three.js
const geometry = createMesh(myModel, null, { minX: -2, maxX: 2, minY: -2, maxY: 2, minZ: -2, maxZ: 2 });
const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true }));
scene.add(mesh);

// 3. Exporte para Blender/Unity
exportOBJ(geometry, "meu_modelo.obj");
\`\`\`
