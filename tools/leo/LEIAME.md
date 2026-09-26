# Modelo do herói (Leo)

O herói do jogo é o `Leo_FINAL_SKIN_PESOS.glb` (texturizado e rigado no Blender,
com as animações Idle, Walk, Run, Jump e Attack). O arquivo original tem 30 MB;
o `assets/models/leo.glb` do jogo é a versão otimizada (1,7 MB):

- texturas de 2048 px em PNG reduzidas para 1024 px em JPEG
  (cor e relevo; a textura de metal/rugosidade sai, a rugosidade fica fixa em 0,8);
- malha simplificada de 122 mil para ~45 mil triângulos, mantendo esqueleto,
  pesos e animações, e comprimida com meshopt.

## Como gerar de novo (depois de mexer no Blender)

1. Exporte o GLB do Blender e coloque-o nesta pasta como `Leo_FINAL_SKIN_PESOS.glb`.
2. Na raiz do projeto, suba um servidor (ex.: `python3 -m http.server 8000`).
3. Abra `http://localhost:8000/tools/leo/convert.html` e baixe o `leo_raw.glb`.
4. Simplifique e comprima com o gltfpack:

```bash
npx gltfpack -i leo_raw.glb -o assets/models/leo.glb -si 0.35 -sp -cc -kn
```

O jogo acha as animações pelo nome, em português ou em inglês
(Idle, Walk/Andar, Run/Correr, Jump/Pular, Attack/Atacar); novas animações com
esses nomes passam a ser usadas automaticamente.
