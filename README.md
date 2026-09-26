# Crescemon — Versão Brasa 3D

Um RPG 3D de capturar e treinar criaturas que roda no navegador. A história segue a estrutura clássica de **Pokémon FireRed**: você sai de casa, escolhe um parceiro no laboratório, enfrenta um rival, vence ginásios, derrota uma equipe vilã e desafia a Liga.
Todas as criaturas, nomes, mapas e músicas são **originais**. O herói é o personagem da ilustração em `assets/heroi.webp`, com cabelo castanho bagunçado, jaqueta marrom, camiseta clara, bermuda escura e tênis brancos. O modelo 3D dele fica em `assets/models/heroi.glb` (com esqueleto e animações). A **Pingolote** também usa um modelo próprio, `assets/models/pingolote.glb`.

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

- **Instalar:** execute `Crescemon-Brasa-3D-Setup-1.1.0.exe` e escolha a pasta. O instalador cria atalhos na área de trabalho e no menu Iniciar, e dá para desinstalar pelo Painel de Controle.
- **Tela cheia:** aperte **F11**.
- **Aviso do Windows:** como o instalador não é assinado digitalmente, o Windows pode mostrar *"O Windows protegeu o computador"*. Clique em **Mais informações → Executar assim mesmo**.

Para gerar o instalador você mesmo:

```bash
npm install
npm start            # abre o jogo numa janela de desktop
npm run dist:win     # gera dist/Crescemon-Brasa-3D-Setup-1.1.0.exe (no Linux precisa do Wine)
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

**Crescemon selvagens** aparecem andando pelo mato alto, com nome e nível acima deles. Chegue perto e aperte **A** (ou esbarre neles) para batalhar e tentar capturar. Às vezes eles ficam curiosos e vêm até você.

O jogo salva sozinho a cada troca de mapa. Também dá para salvar pelo menu.

### Qualidade gráfica

No menu, a opção **QUALIDADE** alterna entre três níveis, e o jogo lembra a escolha:

| Nível | O que muda |
|---|---|
| **ALTA** (padrão no PC) | Pós-processamento completo (antisserrilhado MSAA 4x, brilho suave, correção de cor), sombras 2048 e toda a vegetação |
| **MÉDIA** (padrão no celular) | Pós-processamento sem MSAA, sombras 1024 e 75% da vegetação |
| **BAIXA** | Sem pós-processamento, resolução 1x e 45% da vegetação, para computadores mais fracos |

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
| Lendários pós-jogo + Ilhas Sevii | A **Rainha Eclipse**, verdadeira líder da Equipe Sombra, tenta capturar os **4 lendários** |

## Vilões — Equipe Sombra

| Vilão | Onde | Papel |
|---|---|---|
| Recrutas Sombra | Pedra-Verde, Floresta, Rota Vitória e lugares pós-Liga | Soldados da equipe; somem depois de derrotados |
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

Cada lendário tem um golpe exclusivo. Se ele não for capturado, continua no lugar para você tentar de novo. Use as **Ultra Orbes**, vendidas nas lojas depois da Liga.

## Sistemas

- Câmera em terceira pessoa (ou de cima), Crescemon selvagens visíveis no mato alto e treinadores que te veem e vêm batalhar
- Batalhas por turnos em cena 3D com 9 tipos, vantagens, STAB, críticos, precisão, PP e golpes de status (inclusive "Crescer")
- 65 criaturas (muitas inspiradas na fauna e no folclore do Brasil: cutia, tucano, lobo-guará, beija-flor, preguiça, peixe-boi, ariranha, tamanduá, poraquê, Saci...) com evolução por nível, aprendizado de golpes e Exp. Compartilhada
- Captura com orbes animados, equipe de até 6, PC de armazenamento e Crescedex com prévia 3D
- Centro Crescemon, loja, itens (Poção, Super Poção, Reviver, Elixir, orbes) e dinheiro
- Visual 3D estilo desenho: céu com sol e nuvens, duas camadas de montanhas com névoa, terreno com textura de terra, pedrinhas e variação de cor, trilhas de bordas suaves, água animada com espuma na margem, árvores variadas (pinheiros, copas redondas, bétulas, coqueiros, outono) e mato alto balançando ao vento e se abrindo quando o herói passa
- Vegetação espalhada de forma natural: vários tipos de capim, flores, plantinhas, samambaias, arbustos, folhas secas e galhos caídos perto das árvores, pedras com musgo
- Personagens e criaturas com materiais de tecido, couro, cabelo, pele, pelo e escamas, olhos com brilho, sobrancelhas e luz de contorno; cada Crescemon selvagem tem leve variação de cor e tamanho
- Iluminação com luz de preenchimento, sombras suaves, oclusão de ambiente pintada, correção de cor por clima e brilho discreto
- Herói e Pingolote com modelos GLB rigados (andar, correr e atacar animados); se o arquivo não carregar, o jogo usa o modelo procedural
- Um clima por lugar: dia nas vilas, floresta escura com vaga-lumes e folhas caindo, praia ensolarada e pôr do sol na Rota Vitória
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
js/glb.js          carrega os modelos GLB (herói e Pingolote) e aplica o estilo desenho
js/creature.js     status, experiência e golpes
js/ui.js           diálogos, menus e telas
js/audio.js        efeitos e músicas
js/input.js        teclado e toque
lib/               Three.js (r170) e addons/ (GLTFLoader, SkeletonUtils)
assets/heroi.webp  ilustração do herói
assets/models/     modelos 3D rigados: heroi.glb e pingolote.glb
desktop/           versão de desktop (Electron): janela, ícone e instalador
```

Jogo de fã sem fins comerciais. "Pokémon" e "FireRed" são marcas de seus respectivos donos. Este projeto só se inspira na estrutura da história e não usa nenhum personagem, nome, imagem ou música oficial.
