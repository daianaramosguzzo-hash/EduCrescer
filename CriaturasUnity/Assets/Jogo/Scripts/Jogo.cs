using System;
using System.Linq;
using System.Threading.Tasks;
using Newtonsoft.Json;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Criaturas
{
    // Controle principal (o main.js do jogo original): título, herói, movimento em grade,
    // conversas e cenas da história (roteiros do maps.js pelo Jint), batalhas, captura,
    // menus, computador, loja, treinadores e jogo salvo.
    public class Jogo : MonoBehaviour
    {
        enum Modo { Carregando, Titulo, Mundo, Batalha }

        Modo modo = Modo.Carregando;
        Estado estado;
        Mundo mundo;
        Interface ui;
        CameraJogo cam;
        Ator heroi;
        Historia historia;
        Arena arena;
        bool ocupado;
        bool acabouDeAndar;
        float giroEspera, orbita;
        string mapaAtual;
        int qualidade;
        static readonly string[] QUALIDADES = { "ALTA", "MÉDIA", "BAIXA" };

        public Estado Estado => estado;
        public Mundo MundoAtual => mundo;
        public Ator Heroi => heroi;
        public Interface UI => ui;

        // ------------------------------------------------ preparação
        void Awake()
        {
            Application.targetFrameRate = 60;
            var camera = Camera.main;
            if (!camera)
            {
                camera = new GameObject("Câmera").AddComponent<Camera>();
                camera.tag = "MainCamera";
            }
            camera.nearClipPlane = 0.1f;
            camera.farClipPlane = 220;
            var dados = camera.GetUniversalAdditionalCameraData();
            dados.renderPostProcessing = true;
            dados.antialiasing = AntialiasingMode.SubpixelMorphologicalAntiAliasing;
            dados.antialiasingQuality = AntialiasingQuality.High;
            cam = camera.gameObject.AddComponent<CameraJogo>();
            cam.enabled = false;

            foreach (var l in FindObjectsByType<Light>()) if (l.type == LightType.Directional) Destroy(l.gameObject);
            var sol = new GameObject("Sol").AddComponent<Light>();
            sol.type = LightType.Directional;
            sol.shadows = LightShadows.Soft;
            sol.shadowStrength = 0.85f;
            sol.shadowBias = 0.03f;
            sol.shadowNormalBias = 0.3f;

            mundo = new GameObject("Mundo").AddComponent<Mundo>();
            mundo.sol = sol;
            mundo.AoTocarSelvagem = s => { if (modo == Modo.Mundo && !ocupado && !ui.Modal && !heroi.andando) _ = Rodar(() => EncontroSelvagem(s)); };
            mundo.CondicaoNpc = def => historia == null || historia.Condicao(mundo.mapa.id, def.id);
            cam.mundo = mundo;
            gameObject.AddComponent<Controles>();
            ui = gameObject.AddComponent<Interface>();
            gameObject.AddComponent<AudioSource>();
            gameObject.AddComponent<Sintetizador>();
            historia = gameObject.AddComponent<Historia>();
            arena = new GameObject("Arena").AddComponent<Arena>();
            PosProcessamento();
            // placas de vídeo integradas (Intel) começam na qualidade média; a escolha do menu fica salva
            bool integrada = SystemInfo.graphicsDeviceName.Contains("Intel");
            AplicarQualidade(PlayerPrefs.GetInt("qualidade", integrada ? 1 : 0));
            Sintetizador.Ligado = PlayerPrefs.GetInt("som", 1) == 1;
        }

        void PosProcessamento()
        {
            var vol = new GameObject("Pós-processamento").AddComponent<Volume>();
            vol.isGlobal = true;
            vol.priority = 10;
            var p = ScriptableObject.CreateInstance<VolumeProfile>();
            var tm = p.Add<Tonemapping>(true); tm.mode.Override(TonemappingMode.Neutral);
            var bloom = p.Add<Bloom>(true); bloom.intensity.Override(0.45f); bloom.threshold.Override(0.95f); bloom.scatter.Override(0.65f);
            var ca = p.Add<ColorAdjustments>(true); ca.saturation.Override(12); ca.contrast.Override(8); ca.postExposure.Override(0.15f);
            var vg = p.Add<Vignette>(true); vg.intensity.Override(0.2f); vg.smoothness.Override(0.5f);
            var wb = p.Add<WhiteBalance>(true); wb.temperature.Override(4);
            vol.profile = p;
        }

        void AplicarQualidade(int q)
        {
            qualidade = q;
            PlayerPrefs.SetInt("qualidade", q);
            if (GraphicsSettings.currentRenderPipeline is UniversalRenderPipelineAsset urp)
            {
                urp.shadowDistance = q == 2 ? 24 : q == 1 ? 30 : 38;
                urp.shadowCascadeCount = q == 0 ? 2 : 1;
                urp.renderScale = q == 2 ? 0.8f : 1;
                urp.msaaSampleCount = q == 0 ? 4 : 1;
            }
            mundo.sol.shadows = q == 2 ? LightShadows.Hard : LightShadows.Soft;
            FlorestaGPU.Escala = q == 0 ? 1.2f : q == 1 ? 0.9f : 0.6f;
        }

        async void Start()
        {
            ui.carregando = "Carregando...";
            ui.EscuroImediato(true);
            try
            {
                await Dados.Carregar();
                historia.Iniciar(this);
                await mundo.Carregar("aurora", new Estado());
            }
            catch (Exception e)
            {
                ui.carregando = "Erro ao carregar: " + e.Message;
                Debug.LogException(e);
                return;
            }
            ui.carregando = null;
            var save = Estado.Carregar();
            ui.temSave = save != null;
            if (save != null) ui.textoContinuar = $"Continuar ({save.name} · {save.badges.Count} insígnias)";
            ui.AoNovoJogo = () => _ = Comecar(null);
            ui.AoContinuar = () => _ = Comecar(Estado.Carregar());
            ui.titulo = true;
            modo = Modo.Titulo;
            Musica.Tocar("title");
            await ui.Escurecer(false);
        }

        // ------------------------------------------------ começar
        async Task Comecar(Estado salvo)
        {
            if (modo != Modo.Titulo) return;
            modo = Modo.Carregando;
            ui.titulo = false;
            await ui.Escurecer(true);
            if (heroi == null) await CriarHeroi();
            if (salvo != null)
            {
                estado = salvo;
                ui.nomeJogador = estado.name;
                cam.deCima = estado.camMode == "cima";
                await IrPara(estado.map, estado.x, estado.z, estado.dir, true);
                modo = Modo.Mundo;
                await ui.Escurecer(false);
                ui.Aviso("Bem-vindo de volta, " + estado.name + "!");
                return;
            }
            var nome = (ui.nomeDigitado ?? "").Trim();
            if (nome.Length == 0) nome = "Cris";
            estado = new Estado { name = nome.Length > 10 ? nome.Substring(0, 10) : nome };
            ui.nomeJogador = estado.name;
            await Abertura();
            ocupado = true;
            await IrPara("casa", 2, 5, "up", true);
            modo = Modo.Mundo;
            await ui.Escurecer(false);
            ui.Lugar("Vila Aurora");
            await Dizer("Seu quarto em Vila Aurora. Hoje é o dia em que tudo começa!", null);
            await Dizer("Controles: clique na tela para controlar a câmera com o mouse. Clique esquerdo = Z (interagir), clique direito = X (correr), rodinha = zoom. As setas (ou WASD) andam para onde você olha. Esc solta o mouse; M abre o menu.", null);
            await Dizer("Criaturas selvagens aparecem no mato alto. Chegue perto de uma e aperte Z (ou esbarre nela) para batalhar e tentar capturar! A câmera pode ser trocada no menu.", null);
            ui.EsconderFala();
            ocupado = false;
        }

        // abertura com o Prof. Ipê na arena, como no intro() do main.js
        async Task Abertura()
        {
            modo = Modo.Batalha;
            arena.Montar("indoor");
            arena.cam = Camera.main;
            cam.enabled = false;
            Camera.main.clearFlags = CameraClearFlags.SolidColor;
            Camera.main.backgroundColor = Dados.Cor("#1a1a2a");
            Musica.Tocar("home");
            var prof = await arena.Pose("prof", 0, 1.4f, -0.15f, 1.5f, false);
            await ui.Escurecer(false);
            string P = "Prof. Ipê";
            await Dizer("Olá, olá! Desculpe a demora. Bem-vindo ao mundo das CRIATURAS IMAGINÁRIAS!", P);
            await Dizer("Meu nome é IPÊ. Todos me chamam de Professor das Criaturas.", P);
            var mon = await arena.Pose("capibroto", 1.6f, 1.8f, -0.6f, 1, true);
            Sons.Tocar("cry");
            await Dizer("Este mundo é habitado por CRIATURAS incríveis, que nascem da imaginação e da natureza!", P);
            await Dizer("Para algumas pessoas, as criaturas são bichinhos de estimação. Outras as treinam para batalhas.", P);
            await Dizer("Eu estudo as criaturas como profissão. E descobri que elas crescem junto com quem cuida deles!", P);
            Destroy(mon.gameObject); Destroy(prof.gameObject);
            var h = new GameObject("heroi").transform;
            h.SetParent(arena.transform, false);
            await ModeloHeroiArena(h);
            h.position = Arena.ORIGEM + new Vector3(0, 0.14f, 1.6f);
            h.rotation = Grade.Giro(-0.2f);
            await Dizer("E você é {N}, certo? De casaco marrom e cheio de energia!", P);
            h.gameObject.SetActive(false);
            var rival = await arena.Pose("rival", 0, 1.6f, 0, 1.5f, false);
            await Dizer("Este é meu neto, GAEL. Ele é seu rival desde que vocês eram pequenos.", P);
            Destroy(rival.gameObject);
            h.gameObject.SetActive(true);
            await Dizer("{N}! Sua própria lenda com as criaturas está prestes a começar!", P);
            await Dizer("Um mundo de sonhos e aventuras com criaturas espera por você! Vamos lá!", P);
            ui.EsconderFala();
            await ui.Escurecer(true);
            Destroy(h.gameObject);
            arena.Desmontar();
            modo = Modo.Carregando;
        }

        GameObject modeloHeroiPrefab;
        async Task CriarHeroi()
        {
            var go = new GameObject("Herói");
            heroi = go.AddComponent<Ator>();
            var modelo = new GameObject("modelo").transform;
            modelo.SetParent(go.transform, false);
            heroi.modelo = modelo;
            var an = await ModeloHeroi(modelo, 1.66f);
            heroi.animador = an;
            Mundo.Sombra(modelo, 0.85f);
            mundo.heroi = heroi;
            cam.alvo = heroi;
            FlorestaGPU.Alvo = heroi.transform;
        }

        // herói novo (mochileiro, feito no Blender); se o arquivo faltar, volta para o Leo
        async Task<IAnimador> ModeloHeroi(Transform pai, float altura)
        {
            var m = await Modelos.Criar("Originais/heroi_mochila.glb", pai) ?? await Modelos.Criar("Originais/leo.glb", pai);
            if (!m) return null;
            var b = Modelos.Limites(m);
            float k = altura / Mathf.Max(0.01f, b.size.y);
            m.transform.localScale = Vector3.one * k;
            m.transform.localPosition = new Vector3(0, -(b.min.y - pai.position.y) * k, 0);
            Modelos.ContornoPorNormal(m, 0.009f / k);
            var an = m.AddComponent<AnimEsqueleto>();
            an.Iniciar(1.3f, 2.1f);
            return an;
        }

        public async Task ModeloHeroiArena(Transform pai)
        {
            var an = await ModeloHeroi(pai, 1.9f);
            if (an != null) pai.gameObject.AddComponent<Arena.Animador>().a = an;
        }

        // ------------------------------------------------ mapas
        async Task IrPara(string id, int x, int z, string dir, bool semEscurecer = false)
        {
            if (!semEscurecer) { Sons.Tocar("door"); await ui.Escurecer(true); }
            mapaAtual = id;
            estado.map = id;
            await mundo.Carregar(id, estado);
            heroi.Colocar(x, z, dir ?? "down");
            estado.x = x; estado.z = z;
            cam.enabled = true;
            cam.encaixar = true;
            cam.resetarYaw = true;
            Musica.Tocar(mundo.mapa.music);
            if (!semEscurecer) await ui.Escurecer(false);
            if (!string.IsNullOrEmpty(mundo.mapa.name) && !mundo.mapa.interior) ui.Lugar(mundo.mapa.name);
            Salvar(true);
        }

        public Task Teleportar(string m, int x, int z, string d, bool semEscurecer) => IrPara(m, x, z, d, semEscurecer);

        void Salvar(bool silencioso)
        {
            if (estado == null || heroi == null) return;
            estado.map = mapaAtual; estado.x = heroi.x; estado.z = heroi.z; estado.dir = heroi.dir;
            estado.camMode = cam.deCima ? "cima" : "terceira";
            estado.Salvar();
            if (!silencioso) ui.Aviso("Jogo salvo!");
        }

        // ------------------------------------------------ chamadas dos roteiros
        public Task Dizer(string texto, string nome) => ui.Dizer(texto, nome);
        public Task<int> Perguntar(string texto, string[] opcoes, string nome) => ui.Perguntar(texto, opcoes, nome);

        public void Insignia(string b) { Sons.Tocar("badge"); ui.Aviso("Nova insígnia: " + b.ToUpperInvariant() + "!"); }

        public async Task CenaCura()
        {
            Sons.Tocar("heal");
            await Arena.Esperar(1300);
            estado.CurarEquipe();
        }

        public async Task Emote(Ator a, string c)
        {
            if (!a) return;
            var go = new GameObject("emote");
            go.transform.SetParent(a.transform, false);
            go.transform.localPosition = new Vector3(0, (a == heroi ? 1.66f : 1.5f) + 0.35f, 0);
            var tm = go.AddComponent<TextMesh>();
            tm.text = c;
            tm.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            go.GetComponent<MeshRenderer>().sharedMaterial = tm.font.material;
            tm.fontSize = 96; tm.characterSize = 0.05f; tm.anchor = TextAnchor.MiddleCenter;
            tm.color = Dados.Cor("#d02020"); tm.fontStyle = FontStyle.Bold;
            Sons.Tocar("select");
            float t0 = Time.time;
            while (Time.time - t0 < 0.8f && go) { var cm = Camera.main; if (cm) go.transform.rotation = Quaternion.LookRotation(go.transform.position - cm.transform.position); await Task.Yield(); }
            if (go) Destroy(go);
        }

        public async Task Loja(string[] lista)
        {
            while (true)
            {
                var ops = lista.Select(id => { var it = Dados.Item(id); return it == null ? id : $"{it.name}  —  ₢{it.price}"; }).Concat(new[] { "SAIR" }).ToArray();
                int r = await ui.Lista($"Dinheiro: ₢{estado.money}", ops);
                if (r < 0 || r >= lista.Length) return;
                var item = Dados.Item(lista[r]);
                if (item == null) continue;
                int q = await ui.Perguntar($"{item.name}: {item.desc} Quantos?", new[] { "1", "5", "10", "Cancelar" }, "Vendedor");
                if (q < 0 || q == 3) continue;
                int n = new[] { 1, 5, 10 }[q];
                if (estado.money < item.price * n) { await Dizer("Você não tem dinheiro suficiente.", "Vendedor"); continue; }
                estado.money -= item.price * n;
                estado.Dar(item.id, n);
                Sons.Tocar("buy");
                await Dizer($"Aqui está! {n}× {item.name}.", "Vendedor");
            }
        }

        public async Task Creditos()
        {
            var equipe = string.Join("\n", estado.party.Select(c => $"{c.Nome} — Nv. {c.lvl}"));
            Musica.Tocar("credits");
            await ui.Creditos($"<b>SALÃO DOS CAMPEÕES</b>\n\n{{N}}\n{equipe}\n\nParabéns por vencer a Liga das Criaturas!\n\n<b>CRIATURAS IMAGINÁRIAS</b>\nCriação: Arthur Guzzo\n\nUm jogo de fã inspirado nas clássicas aventuras de monstrinhos de bolso.\nPersonagens, criaturas, mapas e músicas originais.\n\n<b>Elenco</b>\n{{N}} — Herói\nGael — Rival e Campeão\nProf. Ipê — Pesquisador\nBasalto & Marina — Líderes de Ginásio\nChefe Breu — Equipe Sombra\n\n<b>Feito com</b>\nUnity · Three.js · muito carinho\n\nEduCrescer\n\n<b>Obrigado por jogar!</b>\nContinue explorando... dizem que uma ave lendária foi vista na Rota Vitória.");
            Musica.Tocar(mundo.mapa.music);
            Salvar(true);
        }

        // ------------------------------------------------ batalhas
        string Fundo() => mundo.mapa.bg ?? (mundo.mapa.interior ? "indoor" : "grass");

        async Task<string> RodarBatalha(Func<Batalha, Task<string>> f, bool podePerder = false)
        {
            if (!estado.TemQuemLute()) return "lose";
            var modoAntes = modo;
            Cursor.lockState = CursorLockMode.None;
            Sons.Tocar("encounter");
            Musica.Parar();
            await ui.Piscar();
            await ui.Escurecer(true);
            modo = Modo.Batalha;
            cam.enabled = false;
            arena.cam = Camera.main;
            var b = new Batalha(this, arena, ui);
            var tarefa = f(b);
            await ui.Escurecer(false);
            string r;
            try { r = await tarefa; }
            catch (Exception e) { Debug.LogException(e); r = "fled"; arena.Desmontar(); ui.hud = null; }
            await ui.Escurecer(true);
            modo = modoAntes == Modo.Batalha ? Modo.Mundo : modoAntes;
            cam.enabled = true;
            cam.encaixar = true;
            Camera.main.clearFlags = mundo.mapa.interior ? CameraClearFlags.SolidColor : CameraClearFlags.Skybox;
            Musica.Tocar(mundo.mapa.music);
            if (r == "lose" && !podePerder) await Desmaiou();
            else if (r == "lose") estado.CurarEquipe();
            await ui.Escurecer(false);
            Salvar(true);
            return r;
        }

        public Task<string> BatalhaSelvagem(string sp, int lvl, bool lendario, float? variante)
        {
            var c = Criatura.Nova(sp, lvl);
            c.variant = variante ?? (lendario ? null : UnityEngine.Random.value);
            return RodarBatalha(b => b.Rodar(c, null, lendario, Fundo()));
        }

        public Task<string> BatalhaTreinador(string json)
        {
            var t = JsonConvert.DeserializeObject<Treinador>(json);
            return RodarBatalha(b => b.Rodar(null, t, false, Fundo()), t.canLose);
        }

        // todas as criaturas desmaiaram: volta ao último Centro (ou para casa)
        async Task Desmaiou()
        {
            var lc = estado.lastCenter ?? new Lugar();
            estado.CurarEquipe();
            await IrPara(lc.map, lc.x, lc.z, lc.map == "casa" ? "down" : "up", true);
            await ui.Escurecer(false);
            if (lc.map == "casa") await Dizer("Que susto, {N}! Você e suas criaturas precisam descansar. Pronto, estão novinhos em folha!", "Mãe");
            else await Dizer("Suas criaturas desmaiaram... Nós cuidamos delas. Tome mais cuidado lá fora!", "Enfermeira Clara");
            ui.EsconderFala();
        }

        // ------------------------------------------------ roteiros e conversas
        async Task Rodar(Func<Task> f)
        {
            ocupado = true;
            Cursor.lockState = CursorLockMode.None;
            try { await f(); }
            catch (Exception e) { Debug.LogException(e); }
            finally { ui.EsconderFala(); ui.MostrarCriatura(null); if (mundo.mapa != null) mundo.AtualizarNpcs(); ocupado = false; }
        }

        async Task FalarCom(Ator npc, NpcDef def)
        {
            if (!def.orb && def.creature == null) npc.Virar(Grade.OPOSTO[heroi.dir]);
            var mapa = mundo.mapa.id;
            if (historia.EhTreinador(mapa, def.id)) { await historia.Treinador(mapa, def.id, false); return; }
            if (historia.TemFala(mapa, def.id)) { await historia.Falar(mapa, def.id); return; }
            if (def.creature != null)
            {
                var n = Dados.Especies.TryGetValue(def.creature, out var e) ? e.name : def.creature;
                await Dizer($"{n} olha para você com atenção...", null);
            }
        }

        async Task EncontroSelvagem(Selvagem s)
        {
            if (!estado.TemQuemLute())
            {
                s.cooldown = 8;
                await Dizer("Suas criaturas estão sem energia! Cure-as antes de batalhar.", null);
                return;
            }
            int dx = s.ator.x - heroi.x, dz = s.ator.z - heroi.z;
            if (Mathf.Abs(dx) + Mathf.Abs(dz) == 1)
            {
                heroi.Virar(Grade.DirPara(dx, dz));
                s.ator.Virar(Grade.DirPara(-dx, -dz));
            }
            Sons.Tocar("cry");
            await Emote(s.ator, "!");
            await BatalhaSelvagem(s.sp, s.lvl, false, s.variante);
            mundo.RemoverSelvagem(s);
        }

        async Task Interagir()
        {
            var v = Grade.DIRS[heroi.dir];
            int fx = heroi.x + v.x, fz = heroi.z + v.y;
            var map = mundo.mapa;
            var sel = mundo.SelvagemEm(fx, fz);
            if (sel) { await Rodar(() => EncontroSelvagem(sel)); return; }
            var npc = mundo.NpcEm(fx, fz);
            if (!npc && mundo.Tile(fx, fz) == 'C') npc = mundo.NpcEm(fx + v.x, fz + v.y);
            if (npc) { var def = mundo.DefDe(npc); if (def != null) await Rodar(() => FalarCom(npc, def)); return; }
            var item = map.items.Find(it => it.x == fx && it.z == fz && !estado.Flag("it_" + it.id));
            if (item != null)
            {
                await Rodar(async () =>
                {
                    estado.Marcar("it_" + item.id);
                    estado.Dar(item.item, item.n);
                    mundo.PegarItem(item);
                    Sons.Tocar("fanfare");
                    await Dizer($"{{N}} encontrou {(item.n > 1 ? item.n + "× " : "")}{Dados.NomeItem(item.item)}!", null);
                });
                return;
            }
            if (map.pcs.Exists(c => c.x == fx && c.z == fz)) { await Rodar(Computador); return; }
            var placa = map.signs.Find(s => s.x == fx && s.z == fz);
            if (placa != null) { await Rodar(() => Dizer(placa.text, null)); return; }
            if (mundo.Tile(fx, fz) == 'W') await Rodar(() => Dizer("A água está azul e calma. Seria legal nadar... um dia.", null));
        }

        async Task FimDoPasso()
        {
            var map = mundo.mapa;
            int x = heroi.x, z = heroi.z;
            estado.steps++;
            var wp = map.warps.Find(w => w.x == x && w.z == z);
            if (wp != null) { ocupado = true; await IrPara(wp.to, wp.tx, wp.tz, wp.dir); ocupado = false; return; }
            var porta = mundo.PortaEm(x, z);
            if (porta != null)
            {
                ocupado = true;
                var dentro = await Dados.Mapa(porta.to);
                await IrPara(porta.to, dentro.exit.x, dentro.exit.z - 1, "up");
                ocupado = false;
                return;
            }
            if (map.exit != null && map.exit.x == x && map.exit.z == z && map.exit.to != null)
            {
                ocupado = true;
                await IrPara(map.exit.to, map.exit.tx, map.exit.tz, "down");
                ocupado = false;
                return;
            }
            int g = historia.Gatilho(map.id, x, z);
            if (g >= 0) { await Rodar(() => historia.RodarGatilho(map.id, g)); return; }
            var visto = TreinadorQueViu();
            if (visto != null) await Rodar(() => historia.Treinador(map.id, visto, true));
        }

        // linha de visão dos treinadores (trainerSpotting do world.js)
        string TreinadorQueViu()
        {
            foreach (var kv in mundo.npcs)
            {
                var a = kv.Value;
                if (!a || !a.gameObject.activeSelf || estado.Flag("tr_" + kv.Key)) continue;
                int vista = historia.Visao(mundo.mapa.id, kv.Key);
                if (vista <= 0) continue;
                var d = Grade.DIRS[a.dir];
                for (int i = 1; i <= vista; i++)
                {
                    int x = a.x + d.x * i, z = a.z + d.y * i;
                    if (x == heroi.x && z == heroi.z) return kv.Key;
                    if (mundo.Bloqueado(x, z, a)) break;
                }
            }
            return null;
        }

        // ------------------------------------------------ menus
        async Task Menu()
        {
            ocupado = true;
            Cursor.lockState = CursorLockMode.None;
            int sel = 0;
            while (true)
            {
                var ops = new System.Collections.Generic.List<(string nome, Func<Task> f)>();
                if (estado.Flag("dex")) ops.Add(("CRIATURADEX", Criaturadex));
                if (estado.party.Count > 0) ops.Add(("EQUIPE", MenuEquipe));
                ops.Add(("BOLSA", MenuBolsa));
                ops.Add((estado.name.ToUpperInvariant(), Cartao));
                ops.Add(("SALVAR", async () => { Salvar(false); await Dizer("{N} salvou o jogo.", null); ui.EsconderFala(); }));
                ops.Add(($"SOM: {(Sintetizador.Ligado ? "LIGADO" : "DESLIGADO")}", () => { Sintetizador.Ligado = !Sintetizador.Ligado; PlayerPrefs.SetInt("som", Sintetizador.Ligado ? 1 : 0); return Task.CompletedTask; }));
                ops.Add(($"CÂMERA: {(cam.deCima ? "DE CIMA" : "3ª PESSOA")}", () => { cam.deCima = !cam.deCima; cam.encaixar = true; return Task.CompletedTask; }));
                ops.Add(($"QUALIDADE: {QUALIDADES[qualidade]}", () => { AplicarQualidade((qualidade + 1) % 3); ui.Aviso("Qualidade gráfica: " + QUALIDADES[qualidade]); return Task.CompletedTask; }));
                ops.Add(("FECHAR", null));
                int r = await ui.Lista(null, ops.Select(o => o.nome).ToArray(), sel);
                if (r < 0 || ops[r].f == null) break;
                sel = r;
                await ops[r].f();
            }
            ocupado = false;
        }

        async Task MenuEquipe()
        {
            while (true)
            {
                int i = await ui.TelaEquipe(estado.party, "Equipe", true);
                if (i < 0) return;
                var c = estado.party[i];
                int r = await ui.Lista(c.Nome, new[] { "RESUMO", "MOVER", "CANCELAR" });
                if (r == 0) await Resumo(c);
                else if (r == 1)
                {
                    int j = await ui.TelaEquipe(estado.party, $"Mover {c.Nome} para...", true);
                    if (j >= 0 && j != i) (estado.party[i], estado.party[j]) = (estado.party[j], estado.party[i]);
                }
            }
        }

        async Task Resumo(Criatura c)
        {
            ui.MostrarCriatura(c.sp);
            var tipos = string.Join("/", c.Especie.types.Select(Tipos.Nome));
            var golpes = string.Join("\n", c.moves.Select(m => { var g = Dados.Golpe(m.id); return $"• {g.name} ({Tipos.Nome(g.type)}) PP {m.pp}/{g.pp}"; }));
            await Dizer($"{c.Nome} · Nv. {c.lvl} · {tipos}\nPV {Mathf.CeilToInt(c.hp)}/{c.maxhp} · ATQ {c.atk} · DEF {c.def} · VEL {c.spd} · EXP {c.xp}/{Criatura.XpDoNivel(c.lvl + 1)}", null);
            await Dizer(golpes, null);
            ui.EsconderFala();
            ui.MostrarCriatura(null);
        }

        async Task MenuBolsa()
        {
            while (true)
            {
                var id = await ui.TelaBolsa(estado.bag);
                if (id == null) return;
                var it = Dados.Item(id);
                if (it.use != "heal" && it.use != "revive" && it.use != "pp")
                {
                    await Dizer(it.use == "ball" ? "Use orbes durante uma batalha contra criaturas selvagens!" : it.desc, null);
                    ui.EsconderFala();
                    continue;
                }
                if (estado.party.Count == 0) { await Dizer("Você não tem criaturas.", null); continue; }
                int t = await ui.TelaEquipe(estado.party, $"Usar {it.name} em...", true);
                if (t < 0) continue;
                var c = estado.party[t];
                if (it.use == "heal")
                {
                    if (c.hp <= 0 || c.hp >= c.maxhp) { await Dizer("Não vai ter efeito.", null); continue; }
                    float b = c.hp; c.hp = Mathf.Min(c.maxhp, c.hp + it.amount);
                    Sons.Tocar("heal"); await Dizer($"{c.Nome} recuperou {Mathf.RoundToInt(c.hp - b)} PV!", null);
                }
                else if (it.use == "revive")
                {
                    if (c.hp > 0) { await Dizer("Não vai ter efeito.", null); continue; }
                    c.hp = Mathf.Floor(c.maxhp / 2f); Sons.Tocar("heal"); await Dizer($"{c.Nome} foi reanimado!", null);
                }
                else { foreach (var m in c.moves) m.pp = Dados.Golpe(m.id).pp; Sons.Tocar("heal"); await Dizer($"Os PP de {c.Nome} foram restaurados!", null); }
                estado.Tirar(id);
                ui.EsconderFala();
            }
        }

        async Task Criaturadex()
        {
            var vistas = Dados.OrdemDex.Where(sp => estado.seen.Contains(sp)).ToList();
            if (vistas.Count == 0) { await Dizer("Nenhuma criatura registrada ainda.", null); return; }
            int sel = 0;
            while (true)
            {
                var ops = vistas.Select(sp => (estado.caught.Contains(sp) ? "● " : "○ ") + Dados.Especies[sp].name).ToArray();
                int r = await ui.Lista($"Vistas {estado.seen.Count} · Capturadas {estado.caught.Count}", ops, sel);
                if (r < 0) break;
                sel = r;
                var e = Dados.Especies[vistas[r]];
                ui.MostrarCriatura(e.id);
                await Dizer($"{e.name} · {string.Join("/", e.types.Select(Tipos.Nome))}\n{(estado.caught.Contains(e.id) ? e.dex : "Capture esta criatura para saber mais.")}", null);
                ui.EsconderFala();
                ui.MostrarCriatura(null);
            }
        }

        async Task Cartao()
        {
            int min = Mathf.FloorToInt(estado.playTime / 60);
            await Dizer($"Treinador: {estado.name}\nDinheiro: ₢{estado.money} · Insígnias: {estado.badges.Count}\nCriaturadex: {estado.caught.Count} capturadas, {estado.seen.Count} vistas\nTempo de jogo: {min / 60}h {min % 60:00}min", null);
            ui.EsconderFala();
        }

        async Task Computador()
        {
            Sons.Tocar("select");
            await Dizer("{N} ligou o computador. Sistema de Armazenamento de Criaturas acessado.", null);
            while (true)
            {
                int r = await ui.Lista($"Caixa: {estado.box.Count}", new[] { "RETIRAR", "DEPOSITAR", "SAIR" });
                if (r == 0)
                {
                    if (estado.box.Count == 0) { await Dizer("Não há criaturas guardadas.", null); continue; }
                    if (estado.party.Count >= 6) { await Dizer("Sua equipe está cheia!", null); continue; }
                    int i = await ui.TelaEquipe(estado.box, "Retirar qual?", true);
                    if (i >= 0) { var c = estado.box[i]; estado.box.RemoveAt(i); c.CurarTudo(); estado.party.Add(c); await Dizer($"{c.Nome} entrou na equipe.", null); }
                }
                else if (r == 1)
                {
                    if (estado.party.Count <= 1) { await Dizer("Você precisa ficar com pelo menos uma criatura!", null); continue; }
                    int i = await ui.TelaEquipe(estado.party, "Depositar qual?", true);
                    if (i < 0) continue;
                    if (!estado.party.Where((_, k) => k != i).Any(c => c.hp > 0)) { await Dizer("Você precisa ter uma criatura capaz de lutar na equipe!", null); continue; }
                    var cc = estado.party[i]; estado.party.RemoveAt(i); estado.box.Add(cc);
                    await Dizer($"{cc.Nome} foi guardado no computador.", null);
                }
                else return;
            }
        }

        // ------------------------------------------------ quadro a quadro
        void Update()
        {
            var k = Keyboard.current;
            var m = Mouse.current;
            if (modo == Modo.Titulo)
            {
                // câmera girando devagar sobre a Vila Aurora
                orbita += Time.deltaTime * 0.06f;
                var c = Grade.Pos((mundo.W - 1) / 2f, (mundo.H - 1) / 2f);
                var t = Camera.main.transform;
                t.position = c + new Vector3(Mathf.Sin(orbita) * 15, 14, Mathf.Cos(orbita) * 15);
                t.LookAt(c + Vector3.up * 0.5f);
                return;
            }
            if (modo != Modo.Mundo || heroi == null) return;
            if (estado != null) estado.playTime += Time.deltaTime;
            bool travado = Cursor.lockState == CursorLockMode.Locked;

            if (travado && m != null)
            {
                var d = m.delta.ReadValue();
                cam.Girar(d.x * 0.6f, -d.y * 0.6f);
            }
            if (m != null && !ui.Modal)
            {
                var sc = m.scroll.ReadValue().y;
                if (Mathf.Abs(sc) > 0.01f) cam.Aproximar(-sc);
            }

            bool livre = !ocupado && !ui.Modal;
            if (livre)
            {
                if (m != null && m.leftButton.wasPressedThisFrame && !travado && !cam.deCima)
                {
                    Cursor.lockState = CursorLockMode.Locked;
                    Cursor.visible = false;
                }
                else if (!heroi.andando && Controles.A(incluirClique: travado || cam.deCima))
                    _ = Interagir();
                else if (Controles.Menu())
                {
                    if (travado && k != null && k.escapeKey.wasPressedThisFrame) { Cursor.lockState = CursorLockMode.None; Cursor.visible = true; }
                    else _ = Menu();
                }
            }
            if (!travado) Cursor.visible = true;

            Movimento(Time.deltaTime);
            mundo.AtualizarPasseio(Time.deltaTime, ocupado || ui.Modal);
            mundo.AtualizarSelvagens(Time.deltaTime, ocupado || ui.Modal);
        }

        static string DirSegurada() => Controles.Direcao();
        static bool Correndo() => Controles.Correndo();

        float batidaCd;
        void Movimento(float dt)
        {
            batidaCd -= dt;
            if (ocupado || ui.Modal || heroi.andando) return;
            var rel = DirSegurada();
            if (rel == null) { giroEspera = 0; return; }
            var d = cam.Direcao(rel);
            if (heroi.dir != d && !acabouDeAndar)
            {
                heroi.Virar(d);
                giroEspera = 0.09f;
                return;
            }
            if (giroEspera > 0) { giroEspera -= dt; return; }
            var v = Grade.DIRS[d];
            int nx = heroi.x + v.x, nz = heroi.z + v.y;
            var sel = mundo.SelvagemEm(nx, nz);
            if (sel) { heroi.Virar(d); _ = Rodar(() => EncontroSelvagem(sel)); return; }
            if (mundo.Bloqueado(nx, nz, heroi))
            {
                heroi.Virar(d);
                acabouDeAndar = false;
                if (batidaCd <= 0) { Sons.Tocar("bump"); batidaCd = 0.35f; }
                return;
            }
            acabouDeAndar = true;
            _ = Passo(d, Correndo() ? 1.9f : 1);
        }

        async Task Passo(string d, float vel)
        {
            await heroi.Andar(d, vel);
            await FimDoPasso();
            await Task.Yield();
            if (!heroi.andando) acabouDeAndar = DirSegurada() != null;
        }
    }
}
