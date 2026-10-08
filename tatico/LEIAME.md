# Força Tática

Tiro tático em primeira pessoa que roda no navegador, com as mecânicas clássicas do gênero (estilo Counter-Strike): dois times, bomba, economia, compra de armas, recuo com padrão de spray e bots. O mapa, os nomes e os modelos são originais.

## Como jogar

Igual ao jogo das Criaturas: sirva a pasta raiz do projeto por HTTP e abra `/tatico/`.

```bash
python3 -m http.server 8000
# depois abra http://localhost:8000/tatico/
```

No GitHub Pages fica em `https://<usuário>.github.io/<repositório>/tatico/`. Precisa de **teclado e mouse**. Clique na tela para prender o mouse e aperte **Esc** para pausar.

No menu dá para escolher o time (Ataque, Defesa, automático ou **Só assistir** os bots), a dificuldade dos bots, quantos jogadores por time (1 a 5), o tamanho da partida, a sensibilidade do mouse, o volume e a voz do rádio. O jogo lembra essas escolhas.

### Controles

| Ação | Tecla |
|---|---|
| Andar | WASD |
| Mirar | Mouse |
| Atirar · plantar a bomba | Botão esquerdo |
| Mira telescópica · facada forte · granada fraca | Botão direito |
| Andar devagar, sem fazer barulho | Shift |
| Agachar | C (ou Ctrl em tela cheia) |
| Pular | Espaço |
| Recarregar | R |
| Principal · pistola · faca · granadas · bomba | 1 · 2 · 3 · 4 · 5 |
| Última arma · trocar arma | Q · rodinha |
| Desarmar a bomba (segurar) · pegar arma do chão | E |
| Largar a arma ou a bomba | G |
| Comprar | B |
| Placar | Tab |

No navegador, **Ctrl+W fecha a aba**. Para agachar com Ctrl sem esse risco, use o botão **Tela cheia** do menu (o jogo trava os atalhos do navegador enquanto está em tela cheia). Fora da tela cheia, use **C**.

## Regras

- **Ataque** vence plantando a bomba no **A** ou no **B** e deixando ela explodir (40 s), ou eliminando a Defesa.
- **Defesa** vence eliminando o Ataque antes da bomba, segurando até o tempo acabar (1:55) ou desarmando a bomba (10 s, ou 5 s com kit).
- A rodada começa com 6 s de congelamento para comprar. Dá para comprar na sua base nos primeiros 20 s da rodada.
- Na metade da partida os times trocam de lado e todos voltam a ter $800.
- Partida rápida (até 5 vitórias), curta (até 9) ou competitiva (até 13).

## Mecânicas

**Economia.** Começa com $800, máximo de $16.000. Vitória dá $3.250 (ou $3.500 se a bomba explodir ou for desarmada). Derrota dá $1.400 e sobe $500 a cada derrota seguida, até $3.400. Cada abate rende o prêmio da arma: $300 com fuzil, $600 com submetralhadora, $900 com escopeta, $100 com a Sniper .338 e $1.500 com a faca. Plantar dá +$300 e, se o Ataque perder depois de plantar, cada atacante ganha +$800. Atacante que sobrevive sem plantar quando o tempo acaba não ganha nada. Abater um aliado custa $300.

**Equipamento.** Quem sobrevive guarda as armas e o colete para a próxima rodada; quem morre volta só com a pistola. Quem morre larga a melhor arma no chão, e dá para pegá-la passando por cima (ou com **E**, trocando pela sua).

**Tiro.**
- Cada arma tem dano, alcance, cadência, pente, tempo de recarga, velocidade de quem carrega e penetração no colete próprios.
- O primeiro tiro parado é preciso. Correndo, pulando ou atirando sem parar, as balas espalham. Andar devagar (Shift) e agachar deixam a mira mais precisa, e a mira na tela abre e fecha mostrando o espalhamento real.
- O spray de cada arma sobe e depois vai para os lados, sempre no mesmo padrão. Puxe o mouse para baixo (e para o lado) para compensar.
- Dano por região: cabeça ×4, barriga ×1,25, peito ×1 e pernas ×0,75. O capacete protege a cabeça e o colete protege o corpo, cada arma atravessando o colete de um jeito. A AK-47 mata com um tiro na cabeça mesmo com capacete; a M4A1 não.
- Quem leva tiro fica mais lento por um instante.
- Balas de fuzil e de sniper atravessam caixas de madeira, perdendo dano; as caixas de metal e as paredes seguram.
- O dano cai com a distância e há fogo amigo reduzido (33%).

**Movimento.** Aceleração e atrito no estilo Source, com controle no ar (dá para fazer curvas no pulo). Pular agachado puxa as pernas e alcança caixas mais altas. Correr faz barulho de passos, e os bots escutam; andar devagar ou agachado é silencioso.

**Granadas.** Explosiva (até 98 de dano), de luz (cega quem estiver olhando, e cega menos quem estiver de lado ou de costas) e de fumaça (18 s, bloqueia a visão dos bots e a sua). As granadas quicam nas paredes.

**Sniper.** Botão direito alterna dois níveis de zoom. Sem zoom ela é muito imprecisa. Depois de cada tiro o zoom sai e volta sozinho.

**Bots.**
- Compram conforme o dinheiro do time (economizam quando falta) e escolhem um bomb por rodada.
- O Ataque segue rotas diferentes (longo, curto, meio, túnel). A Defesa se divide entre A, B e meio e gira para o bomb atacado.
- Os bots reagem a sons de tiros e passos, demoram um tempo de reação para atirar e controlam o recuo. Também pegam a bomba caída, plantam, desarmam (ou fogem se não der tempo), jogam granadas e evitam atirar em aliados.
- A dificuldade muda o tempo de reação, a precisão, a velocidade da mira e a chance de mirar na cabeça.

**Interface.**
- Radar que gira com você e mostra os inimigos que algum aliado está vendo.
- Nome do lugar onde você está, feed de abates com tiro na cabeça (✛) e tiro através de caixa (⇶), e indicador da direção de onde veio o dano.
- Barra de progresso ao plantar e desarmar, placar com histórico das rodadas e tela de fim de partida.
- Quem morre observa os aliados vivos.

## O mapa: Vila Poeira

```
 B ─── Lado B ── Base da Defesa ── Lado A ─── A
 │                    │                       │
Túnel B ─ Conector ─ Meio ─ Curto A ───────── │
 │                    │                    Longo A
 └─ Saída Túnel ─ Base do Ataque ─ Saída Longo ┘
```

## Estrutura

```
tatico/index.html     página, HUD e menus
tatico/css/tatico.css estilos
tatico/js/main.js     renderização, controles, câmera, espectador e loop
tatico/js/game.js     regras: rodadas, economia, tiros, dano, granadas, bomba e armas no chão
tatico/js/agent.js    jogador/bot: movimento, colisão, inventário e hitboxes
tatico/js/bot.js      inteligência dos bots
tatico/js/map.js      mapa, colisão, raycast das balas e navegação (A*)
tatico/js/config.js   armas, preços, recompensas, tempos e dificuldades
tatico/js/models.js   modelos 3D das armas e dos soldados
tatico/js/viewmodel.js arma em primeira pessoa
tatico/js/hud.js      HUD, radar, compra e placar
tatico/js/fx.js       marcas de tiro, partículas, traçantes, clarões e fumaça
tatico/js/audio.js    sons sintetizados (Web Audio) e voz do rádio
tatico/js/textures.js texturas feitas em código
```

Para ver os bots jogando sozinhos numa partida rápida, abra `/tatico/?auto=1`.

Jogo de fã sem fins comerciais, inspirado no gênero de tiro tático. "Counter-Strike" é marca de seu respectivo dono; este projeto não usa nenhum mapa, modelo, som ou nome oficial.
