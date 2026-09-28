# Aimorés dos Mortos

Jogo de sobrevivência zumbi em **2,5D com câmera isométrica**, que se passa em **Aimorés, Minas Gerais**. É em **tempo real**, no estilo dos jogos de sobrevivência para celular: você escolhe **um sobrevivente por vez**, sai da base, anda livremente, luta na hora, coleta madeira, pedra e sucata, volta para fabricar e construir, troca de sobrevivente e sai de novo, e segue a história e as escolhas da turma. O visual é de desenho animado adulto e irreverente, com traço grosso, olhos grandes e humor, e todo o estilo é original.

Os quatro protagonistas, **Arthur, Carol, Daiana e Pablício**, foram desenhados a partir das ilustrações de referência. Cada um mantém o próprio rosto, cabelo, tom de pele, corpo e roupas, e dá para reconhecer todos durante o jogo.

## Como jogar

O jogo usa módulos JavaScript e precisa ser servido por HTTP, igual ao Crescemon. Rode o servidor na **raiz do repositório**, porque o Three.js fica em `lib/`:

```bash
python3 -m http.server 8000
# abra http://localhost:8000/aimores/
```

Não há etapa de build. No GitHub Pages, o jogo fica em `…/aimores/`.

Atalhos de URL, úteis para testar: `?novo=normal` começa um jogo direto (`facil`, `normal` ou `dificil`), `&heroi=carol` escolhe quem começa (`arthur`, `carol`, `daiana` ou `pablicio`) e `&semente=123` fixa o sorteio do mapa e do saque.

## Versão para Windows (instalável)

O jogo também vem como um programa de desktop, feito com Electron, que funciona offline.

- **Baixar:** na página [Releases](https://github.com/daianaramosguzzo-hash/EduCrescer/releases), abra **Aimorés dos Mortos** e baixe `Aimores-dos-Mortos-Setup-<versão>.exe`.
- **Instalar:** dê dois cliques no arquivo e escolha a pasta. O instalador cria atalhos na área de trabalho e no menu Iniciar, e o jogo pode ser desinstalado pelo Painel de Controle.
- **Aviso do Windows:** o instalador não é assinado digitalmente, então o Windows pode mostrar *"O Windows protegeu o computador"*. Clique em **Mais informações → Executar assim mesmo**.
- **Tela cheia:** aperte **F11** ou **Alt+Enter**. A janela abre maximizada, e o botão **Sair** fica na tela de título e no menu.
- **Salvamentos:** ficam em `%APPDATA%\AimoresDosMortos` e são separados dos do navegador.

O instalador é gerado sozinho pelo GitHub Actions (fluxo *Instalador Windows — Aimorés dos Mortos*) sempre que algo do jogo muda, e publicado na Release `aimores-v<versão>`. A versão fica em `aimores/desktop/electron-builder.json` (`extraMetadata.version`): suba o número para criar uma Release nova. Para gerar o instalador numa máquina Windows:

```bash
npm install
npm run start:aimores      # abre o jogo numa janela de desktop
npm run dist:win:aimores   # gera dist-aimores/Aimores-dos-Mortos-Setup-2.1.0.exe
```

No Linux e no Mac, o último passo precisa do Wine.

## Controles

| Ação | Teclado e mouse | Toque |
|---|---|---|
| Andar | `W` `A` `S` `D` / setas, ou clique no chão | Joystick (canto esquerdo) ou toque no chão |
| Correr | Segurar `Shift` | 🏃 |
| Agachar (furtivo) | `C` | 🥷 |
| Atacar o inimigo mais perto | Segurar `Espaço`, ou clique no zumbi | ⚔️ (segurar) |
| Esquivar (pulo rápido sem levar golpe) | `Q` | 💨 |
| Interagir (vasculhar, abrir, pegar, conversar, coletar; caído: levantar com atadura) | `E`, ou clique no objeto | ✋ |
| Todas as opções do lugar | Clique direito | Segurar o dedo |
| Recarregar · lanterna | `R` · `F` | Barra de ações |
| Inventário · fabricar · construir | `I` · `B` · `N` | Botões |
| Ficha · diário · mapa e viagem | `K` · `J` · `M` | Botões |
| Trocar de sobrevivente (só na base) | `T`, `Tab`, `1`–`4`, 👥 ou clique em quem descansa | Retratos à esquerda, 👥 |
| Girar a câmera · zoom | `Z` / `X` · rodinha | ⟲ ⟳ · pinça |
| Paredes baixas (ver o lado de dentro) | `V` ou 🧱 (passar o mouse sobre um prédio também mostra) | 🧱 |
| Salvar / carregar rápido | `F5` / `F9` (só em Aimorés) | Menu 💾 |

## Sistemas

**Um sobrevivente por vez.** No começo aparece a tela **Escolha seu sobrevivente**, com os quatro cartões (retrato, atributos, descrição, especialidade e o botão JOGAR). Só quem você escolhe fica em campo e controlável; os outros ficam **descansando na Casa da Turma**, a base, onde recuperam energia e vida e os zumbis não os atacam. Todos estão no **mesmo mundo e no mesmo save**, mas cada um tem **mochila, equipamento, nível e experiência próprios**: a experiência de um nunca passa para outro. Para trocar, volte para a base e use **Trocar sobrevivente** (`T` ou 👥): quem assume sai de onde estava descansando, com as coisas dele. Itens passam de um para o outro pelos **baús e o armário da base**, que são de todos. Se o sobrevivente em campo cair, dá para se levantar com uma atadura ou um kit médico; se morrer, as coisas ficam onde caiu e você escolhe outro da base. O jogo só acaba se a turma inteira morrer.

O ciclo é: base → escolher sobrevivente → explorar → coletar, lutar e saquear → voltar → fabricar, construir e organizar → escolher outro → explorar de novo.

**Especialidades.** Ninguém é obrigatório, mas cada um rende mais numa coisa:

| Personagem | Especialidade | Efeito |
|---|---|---|
| Arthur | Duro na Queda | +25 de vida máxima, 15% menos dano, mordidas infectam menos |
| Carol | Enfermeira da Turma | Remédios curam 50% a mais, levanta sozinha mais rápido, remédios em dobro na área médica |
| Daiana | Olho de Professora | Mais itens ao vasculhar, planta dos prédios, +15% de experiência, fabrica gastando menos material |
| Pablício | Burro de Carga | +10 kg de carga, constrói com 25% menos material, peças 50% mais fortes, conserta em dobro |

**Tempo real.** Zumbis vagam, ouvem barulho, caçam, arrombam portas e quebram janelas ao mesmo tempo que você age. Um dia em Aimorés dura 24 minutos. O jogo pausa sozinho com janelas, conversas e a escolha de sobrevivente abertas. A **energia** cai devagar com as horas (andar e correr não gastam); dormir e descansar na base recuperam.

**Coleta.** Árvores dão madeira (e viram toco, que rebrota), pedras e entulho dão pedra, carros abandonados dão sucata (com pé de cabra, martelo ou ferramentas) e arbustos dão fibra e ervas. Machado e picareta aceleram. Coletar faz barulho e atrai zumbis.

**Fabricação.** Receitas na mão (corda, tábuas, machado de pedra, picareta, lança, curativo...), no fogo (fogão, churrasqueira ou fogueira: marmita, chá de ervas, manga assada), na bancada de trabalho (pregos, clava, facão, colete de sucata, machado, munição, mochila), na **bancada de armas** (lança com ponta de metal, cartuchos, balas de rifle, reforço de arma) e na **área médica** (ataduras, soro caseiro, remédio de ervas, kit médico). Receitas novas liberam com o nível de quem fabrica.

**Base.** A Casa da Turma é o centro seguro. No terreno dela (`N`): paredes de madeira, pedra e metal, portão, fogueira (cozinha e ilumina), baú e armário de estoque (compartilhados), cama, bancada de trabalho, bancada de armas, área médica (maca que trata ferimentos), horta (plante sementes, regue e colha hortaliças), estacas e coletor de água da chuva. Zumbis atacam as peças; dá para consertar e desmontar. Os materiais saem da mochila de quem constrói e dos baús da base.

**Mapa e perigo.** A cidade é dividida em regiões com nível de perigo — a base (segura), tranquilas (Rua do Bar, Área rural, Beira do Rio), perigosas (Escola, Unidade de Saúde, Bairro Alto, Comércio, Rua do Mercadinho, Estação, Ferro-velho, Rádio) e muito perigosas (Centro, Supermercado, Oficina e Posto, AgroNova). O mapa (`M`) mostra as regiões coloridas, e um aviso aparece ao entrar em cada uma.

**Zonas.** No mapa (`M`), aba Região, só quem está em campo viaja (a turma fica na base) para para a Mata do Rio Doce (verde), a Serra do Sossego e a Fazenda Boa Esperança (amarelas), a Pedreira Abandonada e o Posto Militar Abandonado (vermelhas). Cada visita gera a zona de novo. Viajar **não gasta energia**: só passa o tempo da caminhada. O jogo salva antes de sair da cidade, e dentro das zonas não dá para salvar.

**Combate.** Os zumbis dão um bote antes de morder: a **esquiva** (`Q`) é um pulo rápido que evita o golpe. Golpes corpo a corpo fazem o zumbi cambalear. A chance de acerto considera distância, precisão, cobertura (muros, carros, balcões), arma, luz, condição do personagem e se o alvo percebeu você. Ataque furtivo contra um zumbi distraído é crítico. Cada arma tem seu ritmo de ataque e alcance (a lança alcança duas casas). Armas brancas gastam durabilidade, armas de fogo gastam munição, recarregam sozinhas quando o pente acaba e fazem muito barulho. Dá também para distrair com pedrinhas e arremessar molotov ou rojão.

**Zumbis.** São sete tipos, cada um com vida, dano, velocidade, visão, audição e IA própria (parado, vagando, investigando barulho, caçando):

| Tipo | Destaque |
|---|---|
| Comum | Lento e fraco, mas nunca anda sozinho |
| Corredor | Muito rápido |
| Bombado | Muita vida, empurra e derruba portas |
| Espreitador | Fica invisível no escuro e embosca |
| Pamonheiro | O megafone chama todos os zumbis da região |
| Inchado | Explode em gás tóxico ao morrer |
| A Matriz | Chefe final no galpão da AgroNova |

Dá para passar sem ser visto: vá agachado, fique no escuro, use cortinas e armários, evite correr e jogue pedrinhas para desviar a atenção.

**Sobreviventes.** Tem uns 20 personagens com comportamentos diferentes: comerciantes (Seu Zé, com trocas e preços), gente assustada, saqueadores (Lobos do Asfalto), gente desesperada, recrutáveis (viram aliados e seguem o grupo), quem dá missões, quem mente e quem arma emboscada. As escolhas mudam relações e desfechos.

**Inventário.** O peso é limitado pela Força e pela mochila. Os itens se dividem em armas, munição, comida e bebida, medicamentos, sobrevivência, materiais, equipamento (mãos, corpo, costas, cabeça) e itens especiais de missão. Cada sobrevivente tem a própria mochila; os baús e o armário da base são de todos. Dá para cozinhar no fogão e fabricar molotov, ataduras, taco com pregos e armadura de revista.

**Atributos e progressão.** Vida, Força, Velocidade, Precisão, Resistência, Furtividade, Inteligência e Sorte. A experiência vem de combate, missões, exploração e conversas. Cada nível dá pontos de atributo, pontos de habilidade e, a cada dois níveis, uma vantagem.

| Personagem | Papel | Habilidades únicas |
|---|---|---|
| Arthur | Batedor resistente | Sombra Mirim, Olho de Gamer, Estilingada Certeira |
| Carol | Cuidadora do grupo | Mãos que Curam, Fé Inabalável, Coração Acolhedor |
| Daiana | Líder e estrategista | Voz de Comando, Plano de Aula, Negociadora |
| Pablício | Força bruta e gambiarras | Surto Nervoso, Mão na Graxa, Couro Grosso |

**Relacionamento.** Cada par tem uma afinidade que muda com as escolhas nos diálogos (a interface mostra quem gosta e quem não gosta de cada resposta), com salvamentos e com quedas. O grupo conversa sozinho: tem piada, briga, momentos engraçados e emocionantes e decisões em grupo. A afinidade influencia o moral e os epílogos.

**Sobrevivência.** Vida, fome, sede, energia, sangramento, ferimentos, infecção (mordida vira zumbi se não tratar), moral e pânico, temperatura (o calorão de Aimorés, a chuva, a noite) e descanso. Só dá para dormir num lugar seguro (a Casa da Turma, a Igreja depois que ela vira refúgio, ou a base com uma cama construída) e sem zumbi por perto. O HUD mostra vida, fome, sede, energia, nível, barra de experiência, arma equipada e munição, com botões de inventário, interação e troca de sobrevivente.

**Dia e noite.** A luz muda ao longo do dia. À noite a visão diminui, os zumbis ficam mais ativos, os postes e o fogo iluminam e a lanterna gasta pilha.

**Eventos aleatórios.** São 19: hordas, saqueadores, sobreviventes feridos, alarme de carro, incêndio, chuva, calorão, helicóptero, apagão, o cachorro Caramelo e outros.

**Missões.** A missão principal é descobrir a origem do surto (o fertilizante experimental CRESCE+ da AgroNova) e sair da cidade antes do bombardeio, no dia 6 às 06h00. Há três saídas, cada uma com final próprio: a ponte com o Opala do Seu Valdir, a locomotiva da estação e o helicóptero chamado pela rádio. Também há um final ruim e os epílogos mudam conforme quem sobreviveu, quem foi salvo, a cura e as relações. Além disso, há 10 missões secundárias: a insulina do Seu Arlindo, o gato Bolinho da Dona Cotinha, a caderneta do fiado do Seu Zé, o pedágio dos Lobos do Asfalto, o Juninho do rádio, a febre do Seu Valdir, o Zumbi Pamonheiro, a família Oliveira, uma entrega especial e uma noite de defesa na Matriz.

**Salvamento.** Há três espaços manuais e um automático, que salva a cada período do dia, ao concluir missões e antes de viajar. Dá também para exportar e importar o jogo como arquivo `.json`.

## O mapa de Aimorés

A cidade tem 124 × 104 casas, com a Avenida Rio Doce, a Rua Sete de Setembro, a Rua da Estação, a Rua do Comércio, a Rua Minas Gerais e a Rua da Ponte. Os lugares são:

- **Casa da Turma**, a base e esconderijo da turma
- **Unidade de Saúde** (nos jogos começados a partir da versão 2.1): recepção, consultório e enfermaria, com remédios
- **Escola Estadual Rio Doce**: salas, secretaria, sala dos professores, biblioteca, cozinha, banheiros, pátio, quadra, corredores e depósito
- **Supermercado**: corredores, caixas, estoque, freezer, depósito, escritório e estacionamento
- **Praça da Matriz**: calçadão, coreto, chafariz, bancos, ipês, banca e ponto de ônibus
- **Igreja**, com campanário
- **Lojas**: farmácia, roupas, ferramentas, mercadinho, oficina, eletrônicos, restaurante, posto com conveniência e bar
- **Casas** abandonadas, ocupadas, infestadas, com armadilhas, recursos raros e pistas
- **Outros lugares**: estação e ferrovia, ferro-velho, rádio, AgroNova, campinho, prainha do Rio Doce e a ponte bloqueada pelo exército

Pelas ruas tem postes com fiação, placas, carros e motos abandonados, muros, calçadas, árvores, lixo, portas arrombadas e janelas quebradas.

## Sprites

Todos os personagens são **pintados proceduralmente** (`js/sprites/painter.js`): um boneco 2,5D com esqueleto 3D projetado, contorno de desenho animado e 8 direções. Cada visual tem estas animações: parado, andando, correndo, esgueirando, agachado, mirando, atacando, usando arma, recebendo dano, comemorando, assustado, interagindo, pegando item, comendo, medicamento, morrendo, caído, entrando e saindo do veículo.

- **Galeria de sprites** (na tela de título): mostra qualquer personagem em qualquer animação, direção e arma. Dali dá para baixar a folha completa (PNG + JSON), só uma animação ou o retrato.
- **Folhas prontas dos protagonistas** em `assets/sprites/` (`<nome>-spritesheet.png` e `.json`). Cada linha é uma animação numa direção e cada coluna é um quadro. O JSON diz o tamanho do quadro, o ponto do pé, os fps e em que linha fica cada animação e direção. Os retratos pintados estão em `<nome>-retrato-2d5.png`, e a arte original, em `assets/retratos/` e `assets/arte/`.
- Para gerar as folhas de novo, use `node aimores/tools/exportar-sprites.mjs http://localhost:8123 0.75`, com o servidor rodando na raiz e o Playwright instalado. As folhas do repositório foram reduzidas para 256 cores.

## Estrutura

```
aimores/
  index.html, css/game.css
  js/main.js          título, novo jogo/carregar, laço de quadros
  js/audio.js         efeitos e trilhas sintetizados (WebAudio)
  js/sprites/         pintor procedural, visuais, cache de tiras, sprite sheets
  js/world/           pisos/estruturas/móveis, plantas dos prédios, gerador da cidade e das zonas (zones.js),
                      regiões da cidade com nível de perigo (regions.js)
  js/render/          cena Three.js: câmera isométrica, cidade 3D, névoa de guerra, personagens
  js/game/            regras: tempo real (realtime.js), IA, ações, combate, visão, caminhos, sobrevivência,
                      coleta e base (base.js), viagem (travel.js), história, salvamento
  js/data/            heróis, itens, zumbis, NPCs, missões, diálogos, eventos, conversas do grupo
  js/ui/              HUD, janelas, escolha de sobrevivente (picker.js), galeria, entrada (mouse/teclado/toque)
  assets/             retratos, arte e sprite sheets
  desktop/            app de Windows (Electron): janela, ícone e configuração do instalador
  tools/              páginas de teste e exportador de sprites
```

Este é um jogo de fã, sem fins comerciais. Aimorés é uma cidade real de Minas Gerais, mas tudo o que acontece no jogo é ficção.
