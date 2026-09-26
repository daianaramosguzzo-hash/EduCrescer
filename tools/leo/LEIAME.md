# Modelo do herói (Leo)

`leo.fbx` é a malha esculpida original (Meshy AI), sem cor, esqueleto nem animações.
Estes scripts transformam essa malha no `assets/models/leo.glb` usado pelo jogo:

- `paint.js`: pinta cada região com as cores da ficha do herói (pele, cabelo,
  jaqueta, camiseta, bermuda, meias, tênis, mochila) e gera a textura do rosto
  (olhos, sobrancelhas, boca), da estampa CRESCER e das listras das meias.
- `rig.js`: esqueleto de 17 ossos, pesos da malha e 8 animações
  (Idle, Andar, Correr, Pular, Interagir, Apontar, Atacar, Acenar).
  Também separa as partes que vêm coladas na malha original (mão no bolso,
  manga na jaqueta), para não esticarem quando o personagem se mexe.
- `build.html`: junta tudo e exporta `leo_raw.glb`.

## Como gerar de novo

1. Na raiz do projeto, suba um servidor (ex.: `python3 -m http.server 8000`).
2. Abra `http://localhost:8000/tools/leo/build.html` e baixe o `leo_raw.glb`.
3. Reduza e comprima com o gltfpack:

```bash
npx gltfpack -i leo_raw.glb -o assets/models/leo.glb -si 0.4 -slb -km -kn -cc
```

Para mudar uma cor, ajuste `PAL` em `paint.js`; para mudar um movimento, a
função da animação em `makeClips()` de `rig.js`.
