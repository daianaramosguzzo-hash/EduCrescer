# Aimorés dos Mortos

Jogo de sobrevivência zumbi em **2,5D com câmera isométrica**, que se passa em **Aimorés, Minas Gerais**. Mistura exploração com movimento livre, combate tático, gerenciamento de recursos, narrativa e escolhas. O visual é de desenho animado adulto e irreverente, com traço grosso, olhos grandes e humor, e todo o estilo é original.

Os quatro protagonistas, **Arthur, Carol, Daiana e Pablício**, foram desenhados a partir das ilustrações de referência. Cada um mantém o próprio rosto, cabelo, tom de pele, corpo e roupas, e dá para reconhecer todos durante o jogo.

## Como jogar

O jogo usa módulos JavaScript e precisa ser servido por HTTP, igual ao Crescemon. Rode o servidor na **raiz do repositório**, porque o Three.js fica em `lib/`:

```bash
python3 -m http.server 8000
# abra http://localhost:8000/aimores/
```

Não há etapa de build. No GitHub Pages, o jogo fica em `…/aimores/`.

Atalhos de URL, úteis para testar: `?novo=normal` começa um jogo direto (`facil`, `normal` ou `dificil`) e `&semente=123` fixa o sorteio do mapa e do saque.

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
npm run dist:win:aimores   # gera dist-aimores/Aimores-dos-Mortos-Setup-1.1.0.exe
```

No Linux e no Mac, o último passo precisa do Wine.

## Controles

| Ação | Mouse / teclado | Toque |
|---|---|---|
| Andar, atacar, vasculhar, abrir porta, conversar | Clique esquerdo | Toque para ver a prévia e toque de novo para confirmar |
| Todas as opções da célula | Clique direito | Segurar o dedo |
| Mover a câmera | Arrastar ou setas | Arrastar |
| Zoom | Rodinha, `+` e `-` | Pinça |
| Girar a câmera (90°) | `Q` / `E` | Botões ⟲ ⟳ |
| Paredes baixas (ver o lado de dentro) | `V` ou 🧱. Passar o mouse sobre um prédio também mostra o interior | 🧱 |
| Trocar de personagem | `1`–`4`, `Tab` | Retratos à esquerda |
| Esperar (deixar o tempo passar) | `Enter` / `T` | ⏳ Esperar |
| Atacar / mirar / defender / esconder / recarregar | `A` / `G` / `X` / `H` / `R` | Barra de ações |
| Correr (liga e desliga) | `Shift` | 🏃 |
| Lanterna | `F` | 🔦 |
| Inventário, ficha, diário, mapa, fabricar | `I`, `C`, `J`, `M`, `B` | Botões |
| Salvar rápido / carregar rápido | `F5` / `F9` | Menu 💾 |
| Centralizar no personagem | `Espaço` | — |

## Sistemas

**Movimento livre e tempo.** Não há Pontos de Ação na tela. Escolha qualquer personagem (retratos à esquerda ou teclas 1–4) e clique onde quiser: ele anda até lá, a qualquer distância, e vasculha, ataca ou conversa ao chegar. Enquanto vocês agem, o tempo corre, e de tempos em tempos os zumbis e as outras pessoas se mexem. Atacar e correr gastam mais tempo do que andar. Personagens com mais Velocidade fazem mais coisas antes de os zumbis reagirem.

Longe do perigo o jogo fica no **modo exploração**: o grupo segue quem você move, e cada rodada vale 5 minutos. Quando aparece um inimigo, o jogo passa para o **modo combate**: cada personagem age separado, cada rodada vale 1 minuto, e a caminhada para se surgir um zumbi novo, se um inimigo chegar colado ou se o personagem levar dano. O botão **⏳ Esperar** deixa o tempo passar de propósito.

**Combate.** A chance de acerto considera distância, precisão, cobertura (muros, carros, balcões), arma, luz, condição do personagem e se o alvo percebeu você. Ataque furtivo contra um zumbi distraído é crítico. Armas brancas gastam durabilidade, armas de fogo gastam munição e fazem muito barulho. Tem também mirar, defender, esconder, distrair com pedrinhas e arremessar molotov ou rojão.

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

**Inventário.** O peso é limitado pela Força e pela mochila. Os itens se dividem em armas, munição, comida e bebida, medicamentos, sobrevivência, materiais, equipamento (mãos, corpo, costas, cabeça) e itens especiais de missão. Os personagens trocam itens entre si quando estão lado a lado. Dá para cozinhar no fogão e fabricar molotov, ataduras, taco com pregos e armadura de revista.

**Atributos e progressão.** Vida, Força, Velocidade, Precisão, Resistência, Furtividade, Inteligência e Sorte. A experiência vem de combate, missões, exploração e conversas. Cada nível dá pontos de atributo, pontos de habilidade e, a cada dois níveis, uma vantagem.

| Personagem | Papel | Habilidades únicas |
|---|---|---|
| Arthur | Batedor furtivo | Sombra Mirim, Olho de Gamer, Estilingada Certeira |
| Carol | Cuidadora do grupo | Mãos que Curam, Fé Inabalável, Coração Acolhedor |
| Daiana | Líder e estrategista | Voz de Comando, Plano de Aula, Negociadora |
| Pablício | Força bruta e gambiarras | Surto Nervoso, Mão na Graxa, Couro Grosso |

**Relacionamento.** Cada par tem uma afinidade que muda com as escolhas nos diálogos (a interface mostra quem gosta e quem não gosta de cada resposta), com salvamentos e com quedas. O grupo conversa sozinho: tem piada, briga, momentos engraçados e emocionantes e decisões em grupo. A afinidade influencia o moral e os epílogos.

**Sobrevivência.** Fome, sede, energia, vida, sangramento, ferimentos, infecção (mordida vira zumbi se não tratar), moral e pânico, temperatura (o calorão de Aimorés, a chuva, a noite) e descanso. Só dá para dormir com o grupo inteiro num esconderijo (a Casa da Turma ou a Igreja, depois que ela vira refúgio) e sem zumbi por perto.

**Dia e noite.** A luz muda ao longo do dia. À noite a visão diminui, os zumbis ficam mais ativos, os postes e o fogo iluminam e a lanterna gasta pilha.

**Eventos aleatórios.** São 19: hordas, saqueadores, sobreviventes feridos, alarme de carro, incêndio, chuva, calorão, helicóptero, apagão, o cachorro Caramelo e outros.

**Missões.** A missão principal é descobrir a origem do surto (o fertilizante experimental CRESCE+ da AgroNova) e sair da cidade antes do bombardeio, no dia 6 às 06h00. Há três saídas, cada uma com final próprio: a ponte com o Opala do Seu Valdir, a locomotiva da estação e o helicóptero chamado pela rádio. Também há um final ruim e os epílogos mudam conforme quem sobreviveu, quem foi salvo, a cura e as relações. Além disso, há 10 missões secundárias: a insulina do Seu Arlindo, o gato Bolinho da Dona Cotinha, a caderneta do fiado do Seu Zé, o pedágio dos Lobos do Asfalto, o Juninho do rádio, a febre do Seu Valdir, o Zumbi Pamonheiro, a família Oliveira, uma entrega especial e uma noite de defesa na Matriz.

**Salvamento.** Há três espaços manuais e um automático, que salva a cada período do dia, ao dormir e ao concluir missões. Dá também para exportar e importar o jogo como arquivo `.json`.

## O mapa de Aimorés

A cidade tem 124 × 104 casas, com a Avenida Rio Doce, a Rua Sete de Setembro, a Rua da Estação, a Rua do Comércio, a Rua Minas Gerais e a Rua da Ponte. Os lugares são:

- **Casa da Turma**, o esconderijo inicial
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
  js/world/           pisos/estruturas/móveis, plantas dos prédios, gerador da cidade
  js/render/          cena Three.js: câmera isométrica, cidade 3D, névoa de guerra, personagens
  js/game/            regras: turnos, ações, combate, IA, visão, caminhos, sobrevivência, história, salvamento
  js/data/            heróis, itens, zumbis, NPCs, missões, diálogos, eventos, conversas do grupo
  js/ui/              HUD, janelas, galeria, entrada (mouse/teclado/toque)
  assets/             retratos, arte e sprite sheets
  desktop/            app de Windows (Electron): janela, ícone e configuração do instalador
  tools/              páginas de teste e exportador de sprites
```

Este é um jogo de fã, sem fins comerciais. Aimorés é uma cidade real de Minas Gerais, mas tudo o que acontece no jogo é ficção.
