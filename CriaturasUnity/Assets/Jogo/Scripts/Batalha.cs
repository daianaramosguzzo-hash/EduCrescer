using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using UnityEngine;
using Random = UnityEngine.Random;

namespace Criaturas
{
    // Dados do treinador adversário (vindos do roteiro em JSON)
    public class Treinador
    {
        public string name, look, lose, winText;
        public List<List<object>> party;
        public int money = 100;
        public bool canLose, leader, rival;
    }

    // Informações que a interface desenha durante a batalha (barras de PV etc.)
    public class HudBatalha
    {
        public Criatura aliado, inimigo;
        public bool mostraAliado, mostraInimigo;
        public float pvAliado, pvInimigo; // PV animados
        public List<Criatura> equipeInimiga; // bolinhas do treinador
        public bool capturado;
    }

    // Batalha por turnos (classe Battle do js/battle.js)
    public class Batalha
    {
        readonly Jogo jogo;
        readonly Arena arena;
        readonly Interface ui;
        Estado E => jogo.Estado;
        Treinador treinador;
        bool lendario;
        List<Criatura> equipeInimiga, equipe;
        Criatura aliado, inimigo;
        readonly Dictionary<bool, Dictionary<string, int>> estagios = new();
        HashSet<Criatura> participantes = new();
        int fugas, ultimaAcao;
        string resultadoFinal;
        readonly HashSet<int> evolucoes = new();
        readonly HudBatalha hud = new();

        static readonly Dictionary<string, string> NOME_STATUS = new() { ["atk"] = "O ATAQUE", ["def"] = "A DEFESA", ["spd"] = "A VELOCIDADE" };
        static float Estagio(int s) => s >= 0 ? (2 + s) / 2f : 2f / (2 - s);

        public Batalha(Jogo j, Arena a, Interface u) { jogo = j; arena = a; ui = u; }

        Task Msg(string t, string nome = null) => ui.Dizer(t, nome);
        void Hud()
        {
            hud.aliado = aliado; hud.inimigo = inimigo;
            hud.equipeInimiga = treinador != null ? equipeInimiga : null;
            hud.capturado = inimigo != null && treinador == null && E.caught.Contains(inimigo.sp);
            ui.hud = hud;
        }

        string Prefixo(bool doAliado, Criatura c) => doAliado ? c.Nome : treinador != null ? $"{c.Nome} inimigo" : $"{c.Nome} selvagem";

        // ---------------------------------------------- começo e fim
        public async Task<string> Rodar(Criatura selvagem, Treinador t, bool lend, string fundo)
        {
            treinador = t;
            lendario = lend;
            equipeInimiga = t != null ? t.party.Select(p => Criatura.Nova(Convert.ToString(p[0]), Convert.ToInt32(p[1]))).ToList() : new List<Criatura> { selvagem };
            inimigo = equipeInimiga[0];
            equipe = E.party;
            aliado = equipe.First(c => c.hp > 0);
            estagios[true] = NovosEstagios(); estagios[false] = NovosEstagios();
            hud.mostraAliado = hud.mostraInimigo = false;
            Hud();
            arena.Montar(fundo);
            Musica.Tocar(t != null ? (t.leader || t.rival ? "gym" : "trainer") : "battle");

            if (t != null)
            {
                if (t.leader || t.rival || System.Text.RegularExpressions.Regex.IsMatch(t.name, "Chefe|Admin|Rainha|Campeão"))
                    await ui.Versus(t.name, t.leader ? "LÍDER DE GINÁSIO" : t.rival ? "RIVAL" : t.name.Contains("Campeão") ? "CAMPEÃO DA LIGA" : "EQUIPE SOMBRA");
                await arena.EntrarTreinador(t.look);
                await arena.EntrarHeroi(jogo.ModeloHeroiArena);
                await Msg($"{t.name} quer batalhar!");
                await arena.SairTreinador();
                await Msg($"{t.name} enviou {inimigo.Nome}!");
                await arena.Enviar(false, inimigo);
            }
            else
            {
                await arena.ColocarCriatura(false, inimigo);
                Sons.Tocar("cry");
                await arena.EntrarHeroi(jogo.ModeloHeroiArena);
                await Msg(lendario ? $"O lendário {inimigo.Nome} apareceu!" : $"Um {inimigo.Nome} selvagem apareceu!");
            }
            E.seen.Add(inimigo.sp);
            hud.pvInimigo = inimigo.hp; hud.mostraInimigo = true; Hud();
            await Msg($"Vai, {aliado.Nome}!");
            await arena.SairHeroi();
            await arena.Enviar(true, aliado);
            hud.pvAliado = aliado.hp; hud.mostraAliado = true; Hud();
            participantes.Add(aliado);

            string r = null;
            while (r == null) r = await Turno();
            ui.EsconderFala();
            await Final(r);
            hud.mostraAliado = hud.mostraInimigo = false;
            ui.hud = null;
            arena.Desmontar();
            return r;
        }

        static Dictionary<string, int> NovosEstagios() => new() { ["atk"] = 0, ["def"] = 0, ["spd"] = 0 };

        async Task Final(string r)
        {
            var t = treinador;
            if (r == "win" && t != null)
            {
                Musica.Tocar("victory");
                await arena.EntrarTreinador(t.look);
                await Msg($"Você venceu {t.name}!");
                if (!string.IsNullOrEmpty(t.lose)) await Msg(t.lose, t.name);
                E.money += t.money;
                await Msg($"{{N}} ganhou ₢{t.money} pela vitória!");
            }
            else if (r == "win") Musica.Tocar("victory");
            else if (r == "lose")
            {
                if (t != null && !string.IsNullOrEmpty(t.winText)) await Msg(t.winText, t.name);
                if (!(t != null && t.canLose))
                {
                    await Msg("{N} não tem mais criaturas em condições de lutar!");
                    int perdeu = E.money / 2;
                    E.money -= perdeu;
                    await Msg($"{{N}} entrou em pânico e perdeu ₢{perdeu}... Tudo ficou escuro!");
                }
            }
            foreach (var c in equipe.ToList())
            {
                if (c.hp <= 0) continue;
                var evo = c.Especie.evo;
                if (evo != null && c.lvl >= evo.lvl && evolucoes.Contains(c.uid)) await Evoluir(c, evo.to);
            }
        }

        async Task Evoluir(Criatura c, string para)
        {
            hud.mostraAliado = hud.mostraInimigo = false; Hud();
            string antigo = c.Nome;
            await Msg($"O quê? {antigo} está evoluindo!");
            await arena.Evoluir(c, para);
            c.sp = para;
            c.Recalcular();
            E.seen.Add(para); E.caught.Add(para);
            Sons.Tocar("fanfare");
            await Msg($"Parabéns! {antigo} evoluiu para {Dados.Especies[para].name}!");
            foreach (var g in Criatura.GolpesNoNivel(para, c.lvl)) await Aprender(c, g);
        }

        // ---------------------------------------------- turno
        async Task<string> Turno()
        {
            var acao = await EscolherAcao();
            if (acao.tipo == "fugir")
            {
                if (treinador != null) { await Msg("Não dá para fugir de uma batalha de treinador!"); return null; }
                fugas++;
                float chance = lendario ? 0.5f : (aliado.spd * 32f / Mathf.Max(1, inimigo.spd) + 30 * fugas) / 255f + 0.35f;
                if (Random.value < chance) { Sons.Tocar("run"); await Msg("Você fugiu em segurança!"); return "fled"; }
                await Msg("Não conseguiu fugir!");
                return await SoInimigo();
            }
            if (acao.tipo == "trocar")
            {
                await Msg($"{aliado.Nome}, volte!");
                await arena.Recolher(true);
                aliado = acao.alvo;
                estagios[true] = NovosEstagios();
                participantes.Add(aliado);
                hud.pvAliado = aliado.hp; Hud();
                await Msg($"Vai, {aliado.Nome}!");
                await arena.Enviar(true, aliado);
                return await SoInimigo();
            }
            if (acao.tipo == "item")
            {
                var r = await UsarItem(acao.item, acao.alvo);
                if (r != null) return r;
                return await SoInimigo();
            }
            var golpeInimigo = IA();
            var ga = Dados.Golpe(acao.golpe); var gi = Dados.Golpe(golpeInimigo);
            float va = aliado.spd * Estagio(estagios[true]["spd"]), vi = inimigo.spd * Estagio(estagios[false]["spd"]);
            bool primeiro = ga.pri != gi.pri ? ga.pri > gi.pri : va != vi ? va > vi : Random.value < 0.5f;
            var ordem = primeiro ? new[] { (true, acao.golpe), (false, golpeInimigo) } : new[] { (false, golpeInimigo), (true, acao.golpe) };
            foreach (var (lado, g) in ordem)
            {
                var quem = lado ? aliado : inimigo;
                if (quem.hp <= 0) continue;
                await UsarGolpe(lado, g);
                var r = await Desmaios();
                if (r == "fim") return resultadoFinal;
                if (r == "trocou") break;
            }
            return null;
        }

        async Task<string> SoInimigo()
        {
            await UsarGolpe(false, IA());
            var r = await Desmaios();
            return r == "fim" ? resultadoFinal : null;
        }

        struct Acao { public string tipo, golpe, item; public Criatura alvo; }

        async Task<Acao> EscolherAcao()
        {
            while (true)
            {
                ui.EsconderFala();
                int r = await ui.Grade($"O que {aliado.Nome} vai fazer?", new[] { "LUTAR", "BOLSA", "EQUIPE", "FUGIR" }, 2, ultimaAcao, false);
                ultimaAcao = Mathf.Max(0, r);
                if (r == 0)
                {
                    if (!aliado.moves.Any(m => m.pp > 0)) { await Msg($"{aliado.Nome} não tem mais PP!"); return new Acao { tipo = "golpe", golpe = "desesperada" }; }
                    var nomes = aliado.moves.Select(m => { var g = Dados.Golpe(m.id); return $"{g.name}\n<size=20>{Tipos.Nome(g.type)} · PP {m.pp}/{g.pp}</size>"; }).ToArray();
                    var cores = aliado.moves.Select(m => Tipos.Cor(Dados.Golpe(m.id).type)).ToArray();
                    var desab = aliado.moves.Select(m => m.pp <= 0).ToArray();
                    int mi = await ui.Grade("Escolha um golpe", nomes, 2, 0, true, cores, desab, i =>
                    {
                        var g = Dados.Golpe(aliado.moves[i].id);
                        if (g.Status) return $"{Tipos.Nome(g.type)} · golpe de status";
                        float ef = Tipos.Mult(g.type, inimigo.Especie.types);
                        return $"{Tipos.Nome(g.type)} · Poder {g.pow} · Precisão {g.acc}%" + (ef > 1 ? "  SUPER EFICAZ!" : ef < 1 ? "  pouco eficaz" : "");
                    });
                    if (mi < 0) continue;
                    var slot = aliado.moves[mi];
                    slot.pp--;
                    ui.EsconderFala();
                    return new Acao { tipo = "golpe", golpe = slot.id };
                }
                if (r == 1)
                {
                    var id = await ui.TelaBolsa(E.bag, i => i.use != "key");
                    if (id == null) continue;
                    var it = Dados.Item(id);
                    if (it.use == "ball")
                    {
                        if (treinador != null) { await Msg("Não é possível capturar a criatura de outro treinador!"); continue; }
                        return new Acao { tipo = "item", item = id };
                    }
                    int t = await ui.TelaEquipe(equipe, $"Usar {it.name} em...", true);
                    if (t < 0) continue;
                    var alvo = equipe[t];
                    if (it.use == "heal" && (alvo.hp <= 0 || alvo.hp >= alvo.maxhp)) { await Msg("Não vai ter efeito."); continue; }
                    if (it.use == "revive" && alvo.hp > 0) { await Msg("Não vai ter efeito."); continue; }
                    return new Acao { tipo = "item", item = id, alvo = alvo };
                }
                if (r == 2)
                {
                    int t = await ui.TelaEquipe(equipe, "Trocar criatura", true);
                    if (t < 0) continue;
                    var c = equipe[t];
                    if (c == aliado) { await Msg($"{c.Nome} já está lutando!"); continue; }
                    if (c.hp <= 0) { await Msg($"{c.Nome} não tem energia para lutar!"); continue; }
                    return new Acao { tipo = "trocar", alvo = c };
                }
                if (r == 3) return new Acao { tipo = "fugir" };
            }
        }

        async Task<string> UsarItem(string id, Criatura alvo)
        {
            var it = Dados.Item(id);
            E.Tirar(id);
            if (it.use == "ball")
            {
                await Msg($"{{N}} jogou uma {it.name}!");
                var f = inimigo;
                float taxa = f.Especie.@catch;
                float a = (3 * f.maxhp - 2 * f.hp) * taxa * it.bonus / (3f * f.maxhp);
                float p = Mathf.Min(1, a / 255f);
                bool ok = Random.value < p;
                int sac = ok ? 3 : Mathf.FloorToInt(Random.value * (p > 0.3f ? 4 : 2));
                var arq = id == "superorbe" ? "Objetos/superorbe.glb" : "Objetos/orbe.glb";
                hud.mostraInimigo = false; Hud();
                await arena.Capturar(arq, Mathf.Min(3, sac), ok);
                if (ok)
                {
                    await Msg($"Isso! {f.Nome} foi capturado!");
                    E.caught.Add(f.sp);
                    await GanharXp();
                    var onde = E.Adicionar(f);
                    if (onde == "box") await Msg($"Sua equipe está cheia. {f.Nome} foi enviado para o computador.");
                    return "caught";
                }
                hud.mostraInimigo = true; Hud();
                var frases = new[] { "Ah, não! Ele escapou!", "Quase! Parecia que tinha pegado!", "Droga! Foi por pouco!", "Aaah! Estava quase!" };
                await Msg(frases[Mathf.Min(sac, 3)]);
                return null;
            }
            if (it.use == "heal")
            {
                float antes = alvo.hp;
                if (alvo == aliado) { await AnimarPv(alvo, alvo.hp + it.amount); await arena.Cura(true); }
                else alvo.hp = Mathf.Min(alvo.maxhp, alvo.hp + it.amount);
                await Msg($"{alvo.Nome} recuperou {Mathf.RoundToInt(alvo.hp - antes)} PV!");
            }
            else if (it.use == "revive") { alvo.hp = Mathf.Floor(alvo.maxhp / 2f); await Msg($"{alvo.Nome} foi reanimado!"); }
            else if (it.use == "pp") { foreach (var m in alvo.moves) m.pp = Dados.Golpe(m.id).pp; await Msg($"Os PP de {alvo.Nome} foram restaurados!"); }
            return null;
        }

        string IA()
        {
            var f = inimigo;
            var disp = f.moves.Where(m => m.pp > 0).ToList();
            if (disp.Count == 0) return "desesperada";
            var tiposAliado = aliado.Especie.types;
            bool esperto = treinador != null;
            GolpeSlot melhor = null; float pontos = -1;
            foreach (var m in disp)
            {
                var g = Dados.Golpe(m.id);
                float s;
                if (g.Status)
                {
                    if (g.heal > 0) s = f.hp < f.maxhp * 0.4f ? 120 : 0;
                    else if (g.eff != null)
                    {
                        bool emMim = g.eff.who == "self";
                        int atual = estagios[!emMim ? true : false][g.eff.stat];
                        s = Mathf.Abs(atual) >= 2 ? 5 : 35;
                    }
                    else s = 10;
                }
                else
                {
                    float stab = f.Especie.types.Contains(g.type) ? 1.5f : 1;
                    s = g.pow * Tipos.Mult(g.type, tiposAliado) * stab * g.acc / 100f;
                }
                s *= esperto ? 0.8f + Random.value * 0.4f : 0.3f + Random.value * 1.4f;
                if (s > pontos) { pontos = s; melhor = m; }
            }
            melhor.pp--;
            return melhor.id;
        }

        async Task AnimarPv(Criatura c, float para)
        {
            float de = c.hp;
            para = Mathf.Clamp(para, 0, c.maxhp);
            float ms = Mathf.Min(900, 200 + Mathf.Abs(de - para) * 25);
            bool doAliado = c == aliado;
            await Arena.Animar(ms, k => { c.hp = de + (para - de) * k; if (doAliado) hud.pvAliado = c.hp; else hud.pvInimigo = c.hp; });
            c.hp = Mathf.Round(para);
            if (doAliado) hud.pvAliado = c.hp; else hud.pvInimigo = c.hp;
        }

        async Task UsarGolpe(bool lado, string id)
        {
            var user = lado ? aliado : inimigo;
            var alvo = lado ? inimigo : aliado;
            var g = Dados.Golpe(id);
            var pre = Prefixo(lado, user);
            await Msg($"{pre} usou {g.name}!");
            if (Random.value * 100 >= g.acc) { await Msg($"{pre} errou o ataque!"); return; }
            await arena.Atacar(lado, g);
            if (g.Status)
            {
                if (g.heal > 0)
                {
                    if (user.hp >= user.maxhp) { await Msg("Mas não teve efeito!"); return; }
                    await AnimarPv(user, user.hp + user.maxhp * g.heal);
                    await arena.Cura(lado);
                    await Msg($"{pre} recuperou energia!");
                    return;
                }
                var e = g.eff;
                if (e == null) return;
                bool emQuem = e.who == "self" ? lado : !lado;
                var c = e.who == "self" ? user : alvo;
                string nome = Prefixo(emQuem, c);
                int atual = estagios[emQuem][e.stat];
                int novo = Mathf.Clamp(atual + e.n, -6, 6);
                if (novo == atual) { await Msg($"{NOME_STATUS[e.stat]} de {nome} não vai mais {(e.n > 0 ? "aumentar" : "diminuir")}!"); return; }
                estagios[emQuem][e.stat] = novo;
                await arena.Status(emQuem, e.n > 0);
                await Msg($"{NOME_STATUS[e.stat]} de {nome} {(e.n > 0 ? "aumentou" : "diminuiu")}{(Mathf.Abs(e.n) > 1 ? " muito" : "")}!");
                return;
            }
            float ef = Tipos.Mult(g.type, alvo.Especie.types);
            if (ef == 0) { await Msg($"Não afeta {alvo.Nome}..."); return; }
            float A = user.atk * Estagio(estagios[lado]["atk"]);
            float D = alvo.def * Estagio(estagios[!lado]["def"]);
            float dano = Mathf.Floor(Mathf.Floor((2 * user.lvl / 5f + 2) * g.pow * A / D) / 50f) + 2;
            if (user.Especie.types.Contains(g.type)) dano *= 1.5f;
            dano *= ef;
            bool critico = Random.value < 1 / 16f;
            if (critico) dano *= 1.5f;
            dano *= 0.85f + Random.value * 0.15f;
            dano = Mathf.Max(1, Mathf.Floor(dano));
            float pv0 = alvo.hp;
            await arena.Atingido(!lado, ef > 1 ? 2 : ef < 1 ? 0 : 1);
            await AnimarPv(alvo, alvo.hp - dano);
            float causado = pv0 - alvo.hp;
            if (critico) await Msg("Um golpe crítico!");
            if (ef > 1) await Msg("É super eficaz!");
            else if (ef < 1) await Msg("Não é muito eficaz...");
            if (g.drain > 0 && causado > 0 && user.hp < user.maxhp)
            {
                await AnimarPv(user, user.hp + Mathf.Max(1, Mathf.Floor(causado * g.drain)));
                await Msg($"{alvo.Nome} teve a energia drenada!");
            }
            if (g.recoil > 0)
            {
                await AnimarPv(user, user.hp - Mathf.Max(1, Mathf.Floor(user.maxhp * g.recoil)));
                await Msg($"{pre} se machucou com o impacto!");
            }
        }

        // "fim" | "trocou" | null
        async Task<string> Desmaios()
        {
            bool trocou = false;
            if (inimigo.hp <= 0)
            {
                await arena.Desmaiar(false);
                await Msg(treinador != null ? $"{inimigo.Nome} inimigo desmaiou!" : $"{inimigo.Nome} selvagem desmaiou!");
                hud.mostraInimigo = false; Hud();
                if (aliado.hp > 0) await GanharXp();
                var prox = equipeInimiga.FirstOrDefault(c => c.hp > 0);
                if (prox == null)
                {
                    resultadoFinal = aliado.hp <= 0 && !E.TemQuemLute() ? "lose" : "win";
                    return "fim";
                }
                inimigo = prox;
                estagios[false] = NovosEstagios();
                participantes = new HashSet<Criatura>(aliado.hp > 0 ? new[] { aliado } : Array.Empty<Criatura>());
                if (aliado.hp > 0) await Msg($"{treinador.name} vai enviar {prox.Nome}.");
                await arena.Enviar(false, prox);
                E.seen.Add(prox.sp);
                hud.pvInimigo = prox.hp; hud.mostraInimigo = true; Hud();
                trocou = true;
            }
            if (aliado.hp <= 0)
            {
                await arena.Desmaiar(true);
                await Msg($"{aliado.Nome} desmaiou!");
                hud.mostraAliado = false; Hud();
                participantes.Remove(aliado);
                if (!E.TemQuemLute()) { resultadoFinal = "lose"; return "fim"; }
                if (treinador == null)
                {
                    int r = await ui.Perguntar("Usar a próxima criatura?", new[] { "Sim", "Fugir" }, null);
                    if (r == 1)
                    {
                        float chance = (aliado.spd * 32f / Mathf.Max(1, inimigo.spd) + 30) / 255f + 0.3f;
                        if (Random.value < chance) { await Msg("Você fugiu em segurança!"); resultadoFinal = "fled"; return "fim"; }
                        await Msg("Não conseguiu fugir!");
                    }
                }
                int idx = -1;
                while (idx < 0 || equipe[idx].hp <= 0) idx = await ui.TelaEquipe(equipe, "Escolha a próxima criatura", false);
                aliado = equipe[idx];
                estagios[true] = NovosEstagios();
                participantes.Add(aliado);
                await Msg($"Vai, {aliado.Nome}!");
                await arena.Enviar(true, aliado);
                hud.pvAliado = aliado.hp; hud.mostraAliado = true; Hud();
                trocou = true;
            }
            return trocou ? "trocou" : null;
        }

        async Task GanharXp()
        {
            var f = inimigo;
            int baseXp = Mathf.FloorToInt(f.Especie.xp * f.lvl / 6f * (treinador != null ? 1.5f : 1));
            var parts = participantes.Where(c => c.hp > 0).ToList();
            int parte = Mathf.Max(1, baseXp / Mathf.Max(1, parts.Count));
            foreach (var c in parts)
            {
                await Msg($"{c.Nome} ganhou {parte} pontos de experiência!");
                await AdicionarXp(c, parte);
            }
            var outros = equipe.Where(c => c.hp > 0 && !parts.Contains(c)).ToList();
            if (outros.Count > 0)
            {
                int metade = Mathf.Max(1, baseXp / 2);
                foreach (var c in outros) await AdicionarXp(c, metade);
                await Msg($"O resto da equipe ganhou {metade} de experiência com a Exp. Compartilhada!");
            }
        }

        async Task AdicionarXp(Criatura c, int qtd)
        {
            c.xp += qtd;
            while (c.lvl < 100 && c.xp >= Criatura.XpDoNivel(c.lvl + 1))
            {
                c.lvl++;
                c.Recalcular();
                if (c == aliado) hud.pvAliado = c.hp;
                Sons.Tocar("levelup");
                await Msg($"{c.Nome} subiu para o nível {c.lvl}!");
                if (c.hp <= 0) c.hp = 0;
                foreach (var g in Criatura.GolpesNoNivel(c.sp, c.lvl)) await Aprender(c, g);
                var evo = c.Especie.evo;
                if (evo != null && c.lvl >= evo.lvl) evolucoes.Add(c.uid);
            }
        }

        public async Task Aprender(Criatura c, string id)
        {
            if (c.moves.Any(m => m.id == id)) return;
            var g = Dados.Golpe(id);
            if (c.moves.Count < 4)
            {
                c.moves.Add(new GolpeSlot { id = id, pp = g.pp });
                Sons.Tocar("fanfare");
                await Msg($"{c.Nome} aprendeu {g.name}!");
                return;
            }
            await Msg($"{c.Nome} quer aprender {g.name}, mas já conhece 4 golpes.");
            int r = await ui.Perguntar($"Esquecer um golpe para aprender {g.name}?", new[] { "Sim", "Não" }, null);
            if (r == 0)
            {
                var ops = c.moves.Select(m => Dados.Golpe(m.id).name).Concat(new[] { $"Não aprender {g.name}" }).ToArray();
                int i = await ui.Lista("Esquecer qual golpe?", ops);
                if (i >= 0 && i < 4)
                {
                    var velho = Dados.Golpe(c.moves[i].id).name;
                    c.moves[i] = new GolpeSlot { id = id, pp = g.pp };
                    await Msg($"1, 2 e... Pronto! {c.Nome} esqueceu {velho} e aprendeu {g.name}!");
                    return;
                }
            }
            await Msg($"{c.Nome} não aprendeu {g.name}.");
        }
    }
}
