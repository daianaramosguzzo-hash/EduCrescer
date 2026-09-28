# Último Refúgio: Aimorés

Jogo de **sobrevivência pós-apocalíptica em 2,5D** que roda no navegador (e como programa de Windows).
A estrutura de jogo é inspirada nos survivals de celular (coletar, fabricar, construir a base, explorar áreas cada vez mais perigosas), mas o mapa, a história, os personagens, os itens e os modelos são próprios.

**Arthur** acorda sozinho numa Aimorés (MG) abandonada, às margens do Rio Doce. Começa só com uma faca enferrujada e precisa construir a sobrevivência do zero: madeira, uma ferramenta, água, comida e um abrigo. Depois vêm a base, armas melhores, novas áreas, os outros sobreviventes (**Carol**, **Daiana** e **Pablício**) e a verdade sobre o que aconteceu na cidade.

> O jogador controla **um sobrevivente por vez**. Os outros nunca seguem o personagem: ficam na base e a troca é feita no menu 👥 Sobreviventes, dentro da base.

## Como rodar

O jogo usa módulos JavaScript, então precisa ser servido por HTTP (abrir o `index.html` direto do arquivo não funciona):

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Não há etapa de build: o Three.js já está em `lib/`. Para publicar no **GitHub Pages**, escolha a branch e a pasta raiz em *Settings → Pages*.

### Windows (instalável)

```bash
npm install
npm start          # abre o jogo numa janela (Electron)
npm run dist:win   # gera dist/Ultimo-Refugio-Setup-<versão>.exe
```

O fluxo `Instalador Windows` do GitHub Actions também gera o `.exe` (rode pela aba **Actions** ou crie uma tag `v*`). F11 alterna a tela cheia.

## Controles

| Ação | Teclado e mouse | Celular |
|---|---|---|
| Andar / correr | WASD ou setas / Shift | Joystick / 🏃 |
| Atacar (mira automática) | Espaço ou clique | ⚔️ |
| Coletar, abrir, vasculhar, conversar | E | ✋ |
| Curar / recarregar | Q / R | 🩹 / 🔄 |
| Inventário · Crafting · Construção | I · C · B | 🎒 🔨 🧱 |
| Mapa · Missões · Habilidades · Sobreviventes | M · J · K · P | 🗺️ 📜 ⭐ 👥 |
| Construção: girar / construir / sair | R / Enter ou clique / Esc | botões na tela |
| Zoom da câmera | roda do mouse | (menu de pausa) |
| Pausa | Esc | ⚙️ |

## O que já tem nesta primeira versão

- **Arthur em 3D** (modelo rigado com Idle e Walk, `assets/models/arthur.glb`); correr, atacar, cortar, minerar, pegar, vasculhar, comer, beber, curar, equipar, levar dano, morrer e levantar são animações feitas por código sobre o esqueleto (`js/entities/anim.js`). Se o arquivo não carregar, entra um Arthur feito em código.
- **Câmera 2,5D** que acompanha o personagem suavemente, com zoom. Telhados somem e paredes baixam quando se entra numa casa; copas, paredes e telhados entre a câmera e o personagem ficam vazados para ele nunca sumir.
- **Mapa inspirado em Aimorés** com 9 regiões (330 × 330 m): Bairro São José (base), Mata do Córrego, Margem do Rio Doce, Centro (praça com coreto, Igreja Matriz, escola, farmácia, supermercado, lojas), Estação Ferroviária, Avenida do Posto (posto de gasolina, oficina), Posto de Saúde, Fazenda Boa Vista e Pedreira Velha. Cada uma tem nível de perigo (🟢 🟡 🔴) e as trancadas mostram barricadas e o que falta para liberar (nível, missão ou item).
- **Coleta com animação**: árvores (viram toco), pedras e minério (precisam de picareta), galhos, pedras soltas, capim (fibra), pés de goiaba, bananeiras e mangueiras, móveis e carcaças de carro. Tudo volta a crescer com o tempo. A melhor ferramenta do inventário é usada automaticamente.
- **Loot variado**: 15 tipos de recipiente (carros, geladeiras, armários, prateleiras, vagões, caixas militares, corpos...) com sorteio por peso; o conteúdo muda a cada visita.
- **Inventário por espaços** (16 + mochila + habilidades), equipamentos em 7 lugares (arma, cabeça, corpo, pernas, pés, braços, mochila), durabilidade, descartar/usar/equipar, "Inventário cheio." com os itens caindo no chão.
- **Atributos**: vida, energia, fome, sede, defesa, dano, velocidade e carga. Fome e sede caem com o tempo; zeradas, tiram vida. Água do rio pode dar enjoo (ferva na fogueira ou use o cantil).
- **Combate em tempo real**: corpo a corpo (faca, taco, cano, facão, machado, lança...), arco e armas de fogo (pistola, espingarda, rifle) com munição, recarga, alcance, dano, crítico, empurrão, sangue e números de dano. **Barulho atrai zumbis** (tiros, correr, cortar árvore).
- **5 tipos de zumbi + 2 chefes**: errante, corredor, brutamontes, caçador (vê de longe e persegue mais), O Plantonista (grita chamando reforços) e O Colosso (pancada no chão). IA com estados **parado → patrulha → ouvir → detectar → perseguir → atacar → perder o alvo → voltar**, desviando de obstáculos por um campo de fluxo e atacando construções que bloqueiam o caminho.
- **Crafting** com 34 receitas em 5 categorias e 6 estações (mãos, bancada, fogueira, fornalha, oficina, área médica). Receitas são descobertas ao juntar os ingredientes, algumas pedem nível e outras um esquema 📜 achado no loot.
- **Construção da base** em grade: selecionar → prévia verde/vermelha → posicionar → girar → confirmar → gastar materiais. Piso, parede (madeira → reforçada → pedra → avançada), porta, janela, cerca, baú, armazenamento, fogueira, bancada, fornalha, cama, abrigo, oficina, área médica e coletor de chuva. Na base, o crafting usa os baús.
- **Morte**: parte dos itens se perde, o resto fica numa mochila 🎒 no local (marcada no mapa), e o personagem renasce na cama/abrigo.
- **XP e níveis** (matar, coletar, fabricar, construir, explorar, missões) e **árvore de habilidades** com 15 habilidades em Combate, Sobrevivência, Coleta, Crafting e Exploração.
- **Missões e história**: "Sobreviva" (tutorial) → a escola → o supermercado → o resgate de **Carol** na igreja → as pistas do que aconteceu → **Daiana** na oficina → **Pablício** no celeiro → o Posto de Saúde → O Colosso da pedreira.
- **Sobreviventes jogáveis** com atributos, habilidade especial, inventário, nível, XP e equipamentos próprios.
- **Salvamento automático** no navegador (`localStorage`): personagem ativo, posições, inventários, equipamentos, níveis, construções, recursos, recipientes, portas, áreas, missões, sobreviventes e história.
- **Ciclo de dia e noite**, neblina por perigo, fumaça de incêndios ao longe, **sons feitos por código** (passos por tipo de chão, vento, pássaros, grilos, zumbis, golpes, tiros, coleta, baús, construção) e **música ambiente** que fica tensa no perigo.
- **Interface** com HUD, minimapa, bússola para o objetivo, notificações de itens e menus de inventário, crafting, construção, mapa, missões, habilidades, sobreviventes e pausa (volume, qualidade gráfica, zoom). Funciona com teclado/mouse e com toque (joystick virtual).

## Estrutura do código

```
index.html, css/style.css     página e interface
js/main.js                    o jogo (G): laço, título, introdução, morte, salvar
js/core/                      renderizador e câmera, entrada, áudio, texturas, utilidades
js/data/                      itens, receitas e construções, zumbis, personagens, regiões, missões, loot, habilidades
js/world/                     mapa (world.js), construções, objetos, terreno, colisão e navegação
js/entities/                  jogador, zumbi, modelos (Arthur GLB e personagens feitos em código), armas, animações
js/systems/                   estado e inventário, interação e loot, crafting, construção, missões, sobreviventes, zumbis, efeitos, save
js/ui/                        HUD, menus e mapas
```

Quase tudo é orientado a dados: para criar um item, receita, construção, tipo de zumbi, região ou missão basta acrescentar uma entrada no arquivo correspondente em `js/data/`.

## Modelo do Arthur

`assets/models/arthur.glb` é o modelo texturizado e rigado (ossos `hips`, `spine`, `chest`, `upper_chest`, `neck`, `head`, `upper_arm/forearm/hand` e `thigh/shin/foot` L/R) com as animações **Idle** e **Walk**, otimizado com gltfpack (texturas 1024 px, malha simplificada, compressão meshopt):

```bash
npx gltfpack -i arthur_exportado.glb -o assets/models/arthur.glb -si 0.35 -sp -cc -kn
```

Se uma versão futura trouxer animações chamadas **Run**, o jogo passa a usá-las ao correr. A imagem `assets/arthur.png` é usada no título e nos retratos; os retratos dos outros sobreviventes são desenhados a partir dos próprios modelos 3D.
