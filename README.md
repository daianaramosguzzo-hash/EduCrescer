# Criaturas Imaginárias

**Criação: Arthur Guzzo**

Um RPG 3D de capturar e treinar criaturas que roda no navegador. A história segue a estrutura clássica de **Pokémon FireRed**: você sai de casa, escolhe um parceiro no laboratório, enfrenta um rival, vence ginásios, derrota uma equipe vilã e desafia a Liga.
Todas as criaturas, nomes, mapas e músicas são **originais**. O herói é o personagem da ilustração em `assets/heroi.webp`: cabelo castanho espetado, olhos grandes, jaqueta marrom com capuz e punhos bege, camiseta **CRESCER**, bermuda cargo preta, meias com listras azuis, tênis branco e preto e mochila preta com losango marrom. O modelo 3D dele é o `assets/models/leo.glb`: texturizado e rigado no Blender, com as animações parado, andar, correr, pular e atacar (usada ao arremessar o orbe). O `tools/leo/` explica como otimizar uma nova versão exportada do Blender. Se o arquivo não carregar, o jogo usa o herói feito em código (`js/hero.js`). A **Pingolote** usa um modelo GLB próprio, `assets/models/pingolote.glb`.

## Como jogar

O jogo usa módulos JavaScript (ES modules), então ele precisa ser servido por HTTP. Abrir o `index.html` direto pelo arquivo não funciona.

```bash
# qualquer servidor estático serve, por exemplo:
python3 -m http.server 8000
# depois abra http://localhost:8000
```

Para publicar no **GitHub Pages**, vá em *Settings → Pages*, escolha a branch e a pasta raiz `/`. Não há etapa de build: o Three.js já está incluído em `lib/`.

### Versão para Windows (instalável)

O projeto também vira um programa de desktop com **Electron**.

- **Instalar:** execute `Criaturas-Imaginarias-Setup-<versão>.exe` e escolha a pasta. O instalador cria atalhos na área de trabalho e no menu Iniciar, e dá para desinstalar pelo Painel de Controle.
- **Tela cheia:** aperte **F11**.
- **Aviso do Windows:** como o instalador não é assinado digitalmente, o Windows pode mostrar *"O Windows protegeu o computador"*. Clique em **Mais informações → Executar assim mesmo**.

Para gerar o instalador você mesmo:

```bash
npm install
npm start            # abre o jogo numa janela de desktop
npm run dist:win     # gera dist/Criaturas-Imaginarias-Setup-<versão>.exe (no Linux precisa do Wine)
```

O fluxo do GitHub Actions `Instalador Windows` também gera o `.exe` numa máquina Windows. Rode-o pela aba **Actions** ou crie uma tag `v*` para publicar o instalador numa Release.

### Controles

A câmera fica atrás do herói, em terceira pessoa. **Clique na tela** para prender o mouse: a partir daí, é só **mexer o mouse** para olhar em volta, sem segurar botão. **Botão esquerdo = Z** (interagir/confirmar), **botão direito = X** (voltar/correr) e a **rodinha** aproxima (nos menus, ela sobe e desce as opções). **Esc** solta o mouse. As setas andam para onde você está olhando. No celular, arraste o dedo na tela para girar e use a pinça para aproximar. No menu dá para trocar para a câmera **de cima**.

| Ação | Teclado | Celular |
|---|---|---|
| Andar | Setas / WASD | Direcional |
| Interagir / confirmar | Z, Espaço, Enter, botão esquerdo | A |
| Correr / voltar | X, Shift, botão direito | B |
| Menu | M, Tab (Esc solta o mouse) | ☰ |
| Olhar em volta | Mexer o mouse (depois de clicar na tela) | Arrastar o dedo |

**Criaturas selvagens** aparecem andando pelo mato alto, com nome e nível acima deles. Chegue perto e aperte **A** (ou esbarre neles) para batalhar e tentar capturar. Às vezes eles ficam curiosos e vêm até você.

O jogo salva sozinho a cada troca de mapa. Também dá para salvar pelo menu.

### Qualidade gráfica

No menu, a opção **QUALIDADE** alterna entre três níveis, e o jogo lembra a escolha:

| Nível | O que muda |
|---|---|
| **ALTA** (padrão no PC) | Pós-processamento completo (antisserrilhado MSAA 4x, brilho suave, correção de cor), sombras 2048 e toda a vegetação |
| **MÉDIA** (padrão no celular) | Pós-processamento sem MSAA, sombras 1024 e 75% da vegetação |
| **BAIXA** | Sem pós-processamento, resolução 1x e 45% da vegetação, para computadores mais fracos |

## História (paralelo com FireRed)

| FireRed | Criaturas Imaginárias |
|---|---|
| Pallet Town | **Vila Aurora** |
| Prof. Oak / Blue (neto) | **Prof. Ipê** / **Gael** (neto e rival) |
| Bulbasaur · Charmander · Squirtle | **Capibroto** (capivara, Planta) · **Brasito** (raposa, Fogo) · **Pingolote** (axolote, Água) |
| O Oak te para no mato alto | O Prof. Ipê te para na saída da vila |
| O rival pega o inicial com vantagem de tipo | Igual, e ele te desafia no laboratório |
| Encomenda do Oak → Pokédex + Poké Balls | Encomenda → **Criaturadex** + **Orbes** |
| Brock (Pedra) | **Líder Basalto**, em Pedra-Verde |
| Viridian Forest + Team Rocket | **Floresta Sussurro** + **Equipe Sombra** |
| Misty (Água) | **Líder Marina**, em Cidade Maré |
| Mais 6 ginásios até a Liga | Mais 4 ginásios no interior: **Fogo**, **Elétrico**, **Planta** e **Sombra** (ver abaixo) |
| Giovanni | **Chefe Breu**, na Rota Vitória |
| Campeão Blue + Hall of Fame | **Campeão Gael** + Salão dos Campeões + créditos |
| Lendários pós-jogo + Ilhas Sevii | A **Rainha Eclipse**, verdadeira líder da Equipe Sombra, tenta capturar os **4 lendários** |

## Os 6 ginásios

| # | Cidade | Bioma | Líder | Tipo | Insígnia |
|---|---|---|---|---|---|
| 1 | Pedra-Verde | Campo | **Basalto** | Pedra | Rocha |
| 2 | Cidade Maré | Praia | **Marina** | Água | Maré |
| 3 | Vila Mandacaru | Caatinga | **Jandira**, a vaqueira das chamas | Fogo | Chama |
| 4 | Cidade Relâmpago | Chapada sob tempestade | **Tião**, o inventor dos trovões | Elétrico | Raio |
| 5 | Vila Igarapé | Amazônia | **Ceci**, a guardiã da floresta | Planta | Folha |
| 6 | Vila Neblina | Pantanal noturno | **Luar**, a voz das sombras | Sombra | Lua |

Depois de Cidade Maré, a Rota Vitória tem uma saída a leste para o interior: **Rota do Sertão → Vila Mandacaru → Rota da Chapada → Cidade Relâmpago → Rota dos Igarapés → Vila Igarapé → Rota do Pantanal → Vila Neblina**. De Vila Neblina, um atalho ao norte volta para a Rota Vitória, perto da Liga. Cada cidade tem Centro de Criaturas, loja, ginásio com dois treinadores e líder. O rival Gael reaparece em Cidade Relâmpago, e a **Liga só aceita quem tiver as 6 insígnias**.

## Vilões — Equipe Sombra

| Vilão | Onde | Papel |
|---|---|---|
| Recrutas Sombra | Pedra-Verde, Floresta, Rota Vitória, Rota do Pantanal e lugares pós-Liga | Soldados da equipe; somem depois de derrotados |
| **Admin Nyx** | Cidade Maré e Gruta Abissal | Procura a serpente Abissal |
| **Chefe Breu** | Rota Vitória | O "chefe" da primeira metade da história |
| **Admin Grafite** | Santuário da Floresta | Brutamontes de pedra que quer Ipêrion |
| **Dr. Vulto** | Pico Trovão | Cientista que quer a energia de Trovonça |
| **Rainha Eclipse** | Rota Vitória, depois da Liga | A verdadeira líder: quer apagar o sol com os 4 lendários |

## Os 4 lendários

| Lendário | Tipo | Onde encontrar (depois de vencer a Liga) |
|---|---|---|
| **Solaris** | Fogo/Voador | Rota Vitória, protegido pela Rainha Eclipse |
| **Abissal** | Água/Sombra | Gruta Abissal, na praia de Cidade Maré |
| **Ipêrion** | Planta/Pedra | Santuário da Floresta, a leste da Floresta Sussurro |
| **Trovonça** | Elétrico | Pico Trovão, a oeste da Rota Vitória |

Cada lendário tem um golpe exclusivo. Se ele não for capturado, continua no lugar para você tentar de novo. Use as **Ultra Orbes**, vendidas nas lojas depois da Liga. Pela campanha mais longa, o pós-jogo (Equipe Sombra, admins e lendários) fica por volta dos níveis 42 a 54.

## Sistemas

- Câmera em terceira pessoa (ou de cima), criaturas selvagens visíveis no mato alto e treinadores que te veem e vêm batalhar
- Batalhas por turnos em cena 3D com 9 tipos, vantagens, STAB, críticos, precisão, PP e golpes de status (inclusive "Crescer")
- 118 criaturas inspiradas na fauna, na flora e no folclore do Brasil (cutia, tucano, lobo-guará, preguiça, peixe-boi, poraquê, Saci, calango, carcará, seriema, bugio, ararajuba, onça-pintada, boto-cor-de-rosa, jacaré, jabuti, anta, quati, piranha, mico-leão-dourado, uirapuru, urutau, mandacaru, vitória-régia, açaí, castanheira, guaraná, orquídea, maracujá, Curupira, Boitatá, Mula sem Cabeça...), com evolução por nível, aprendizado de golpes e Exp. Compartilhada
- Captura com orbes animados, equipe de até 6, PC de armazenamento e Criaturadex com prévia 3D
- Centro de Criaturas, loja, itens (Poção, Super Poção, Reviver, Elixir, orbes) e dinheiro
- Visual 3D estilo desenho: céu com sol e nuvens, duas camadas de montanhas com névoa, terreno com textura de terra, pedrinhas e variação de cor, trilhas de bordas suaves, água animada com espuma na margem, árvores variadas (pinheiros, copas redondas, bétulas, coqueiros, outono) e mato alto balançando ao vento e se abrindo quando o herói passa
- Vegetação espalhada de forma natural: vários tipos de capim, flores, plantinhas, samambaias, arbustos, folhas secas e galhos caídos perto das árvores, pedras com musgo
- Personagens e criaturas com materiais de tecido, couro, cabelo, pele, pelo e escamas, olhos com brilho, sobrancelhas e luz de contorno; cada criatura selvagem tem leve variação de cor e tamanho
- Iluminação com luz de preenchimento, sombras suaves, oclusão de ambiente pintada, correção de cor por clima e brilho discreto
- Herói (Leo) e Pingolote com modelos GLB rigados e animados; o herói feito em código fica de reserva
- Um bioma por lugar: dia nas vilas, floresta escura com vaga-lumes, praia ensolarada, pôr do sol na Rota Vitória, caatinga com mandacarus, chapada sob tempestade elétrica, Amazônia úmida com árvores gigantes e cipós, pantanal noturno com névoa e vaga-lumes
- Pessoas "vivas": respiram, olham em volta e mexem os braços; os líderes de ginásio fazem gestos próprios e têm uma aura do seu tipo (brasas, faíscas, folhas, névoa, pedrinhas ou bolhas)
- Casas com telhado de telhas, chaminé, janelas com floreiras, toldos e postes; interiores com piso de madeira ou azulejo, papel de parede e janelas com cortinas
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
js/env.js          céu, terreno, árvores, vegetação, água e partículas
js/textures.js     texturas procedurais (tecidos, pele, cabelo, pelo, pedra, detalhes do chão)
js/post.js         pós-processamento (MSAA, brilho, correção de cor, vinheta)
js/hero.js         herói de reserva feito em código (ficha de personagem)
js/glb.js          carrega os modelos GLB (Leo e Pingolote) e aplica o estilo desenho
js/creature.js     status, experiência e golpes
js/ui.js           diálogos, menus e telas
js/audio.js        efeitos e músicas
js/input.js        teclado e toque
lib/               Three.js (r170) e addons/ (GLTFLoader, SkeletonUtils, decodificador meshopt)
assets/heroi.webp  ilustração do herói
assets/models/     modelos 3D rigados: leo.glb (herói) e pingolote.glb
tools/leo/         conversor que otimiza o GLB do herói exportado do Blender
desktop/           versão de desktop (Electron): janela, ícone e instalador
```

Jogo de fã sem fins comerciais. "Pokémon" e "FireRed" são marcas de seus respectivos donos. Este projeto só se inspira na estrutura da história e não usa nenhum personagem, nome, imagem ou música oficial.
