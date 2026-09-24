# Crescemon — Versão Brasa 3D

Um RPG 3D de capturar e treinar criaturas que roda no navegador. A história segue a estrutura clássica de **Pokémon FireRed**: você sai de casa, escolhe um parceiro no laboratório, enfrenta um rival, vence ginásios, derrota uma equipe vilã e desafia a Liga.
Todas as criaturas, nomes, mapas e músicas são **originais**. O herói é o personagem da ilustração em `assets/heroi.webp`, modelado em 3D: cabelo castanho bagunçado, jaqueta marrom com forro bege, camiseta **CRESCER**, bermuda preta e meias listradas.

## Como jogar

O jogo usa módulos JavaScript (ES modules), então ele precisa ser servido por HTTP. Abrir o `index.html` direto pelo arquivo não funciona.

```bash
# qualquer servidor estático serve, por exemplo:
python3 -m http.server 8000
# depois abra http://localhost:8000
```

Para publicar no **GitHub Pages**, vá em *Settings → Pages*, escolha a branch e a pasta raiz `/`. Não há etapa de build: o Three.js já está incluído em `lib/`.

### Controles

A câmera fica atrás do herói, em terceira pessoa. **Cima** anda para frente, **esquerda/direita** viram e andam, **baixo** dá meia-volta. No menu dá para trocar para a câmera **de cima**, com setas fixas no mapa.

| Ação | Teclado | Celular |
|---|---|---|
| Andar | Setas / WASD | Direcional |
| Interagir / confirmar | Z, Espaço, Enter | A |
| Correr / voltar | X, Shift (segurar para correr) | B |
| Menu | Esc, M | ☰ |

**Crescemon selvagens** aparecem andando pelo mato alto, com nome e nível acima deles. Chegue perto e aperte **A** (ou esbarre neles) para batalhar e tentar capturar. Às vezes eles ficam curiosos e vêm até você.

O jogo salva sozinho a cada troca de mapa. Também dá para salvar pelo menu.

## História (paralelo com FireRed)

| FireRed | Crescemon |
|---|---|
| Pallet Town | **Vila Aurora** |
| Prof. Oak / Blue (neto) | **Prof. Ipê** / **Gael** (neto e rival) |
| Bulbasaur · Charmander · Squirtle | **Capibroto** (capivara, Planta) · **Brasito** (raposa, Fogo) · **Pingolote** (axolote, Água) |
| O Oak te para no mato alto | O Prof. Ipê te para na saída da vila |
| O rival pega o inicial com vantagem de tipo | Igual, e ele te desafia no laboratório |
| Encomenda do Oak → Pokédex + Poké Balls | Encomenda → **Crescedex** + **Cresce-Orbes** |
| Brock (Pedra) | **Líder Basalto**, em Pedra-Verde |
| Viridian Forest + Team Rocket | **Floresta Sussurro** + **Equipe Sombra** |
| Misty (Água) | **Líder Marina**, em Cidade Maré |
| Giovanni | **Chefe Breu**, na Rota Vitória |
| Campeão Blue + Hall of Fame | **Campeão Gael** + Salão dos Campeões + créditos |
| Lendários pós-jogo | A ave lendária **Solaris** aparece depois da Liga |

## Sistemas

- Câmera em terceira pessoa (ou de cima), Crescemon selvagens visíveis no mato alto e treinadores que te veem e vêm batalhar
- Batalhas por turnos em cena 3D com 9 tipos, vantagens, STAB, críticos, precisão, PP e golpes de status (inclusive "Crescer")
- 29 criaturas com evolução por nível, aprendizado de golpes e Exp. Compartilhada
- Captura com orbes animados, equipe de até 6, PC de armazenamento e Crescedex com prévia 3D
- Centro Crescemon, loja, itens (Poção, Super Poção, Reviver, Elixir, orbes) e dinheiro
- Músicas e efeitos chiptune sintetizados com Web Audio
- Controles de toque e layout adaptado para celular

## Estrutura

```
index.html         página e interface
css/style.css      estilos da interface
js/main.js         loop do jogo, API dos roteiros, menus, salvar e carregar
js/world.js        mundo 3D, construção dos mapas, movimento e NPCs
js/battle.js       cena e lógica de batalha
js/maps.js         mapas, personagens e roteiro da história
js/data.js         tipos, golpes, espécies e itens
js/models.js       modelos 3D procedurais (herói, NPCs, criaturas)
js/creature.js     status, experiência e golpes
js/ui.js           diálogos, menus e telas
js/audio.js        efeitos e músicas
js/input.js        teclado e toque
lib/               Three.js (r170)
assets/heroi.webp  ilustração do herói
```

Jogo de fã sem fins comerciais. "Pokémon" e "FireRed" são marcas de seus respectivos donos. Este projeto só se inspira na estrutura da história e não usa nenhum personagem, nome, imagem ou música oficial.
