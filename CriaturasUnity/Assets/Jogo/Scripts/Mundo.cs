using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Rendering;

namespace Criaturas
{
    // Mapa atual: cenário exportado do jogo original + luz, céu, água, personagens,
    // itens e criaturas selvagens. Também responde as perguntas de colisão em grade.
    public class Mundo : MonoBehaviour
    {
        static readonly HashSet<char> BLOQUEIA = new() { 'T', 'W', 'F', 'S', '#', 'C', 'R' };
        const int PAD = 10;

        public MapaDados mapa;
        public Ceu ceu;
        public Light sol;
        public Ator heroi;
        public readonly Dictionary<string, Ator> npcs = new();
        public readonly List<Selvagem> selvagens = new();
        public System.Action<Selvagem> AoTocarSelvagem;
        public System.Func<NpcDef, bool> CondicaoNpc; // condição do roteiro (cond do maps.js)

        Transform raiz;
        Light luzSala;
        Material ceuMat;
        readonly HashSet<Vector2Int> bloqueioExtra = new();
        readonly Dictionary<ItemChao, GameObject> itens = new();
        readonly List<Vector2Int> mato = new();
        float timerSelvagem;
        Estado estado;

        public int W => mapa.W;
        public int H => mapa.H;

        // ------------------------------------------------ carregar
        public async Task Carregar(string id, Estado e)
        {
            estado = e;
            mapa = await Dados.Mapa(id);
            if (raiz) Destroy(raiz.gameObject);
            foreach (var n in npcs.Values) if (n) Destroy(n.gameObject);
            npcs.Clear();
            foreach (var s in selvagens) if (s) Destroy(s.gameObject);
            selvagens.Clear();
            bloqueioExtra.Clear();
            itens.Clear();

            raiz = new GameObject("Mapa " + id).transform;
            raiz.SetParent(transform, false);
            Iluminar();
            var cenario = await Modelos.Criar($"Mapas/{id}.glb", raiz, "cenario");
            if (cenario)
            {
                PrepararCenario(cenario);
                if (!mapa.interior && Terreno.Criar(this, raiz) != null) Floresta.Plantar(this, raiz, cenario);
                Instancias.Juntar(cenario);
            }

            var tarefas = new List<Task>();
            foreach (var def in mapa.npcs) tarefas.Add(CriarNpc(def));
            foreach (var it in mapa.items)
            {
                if (e.Flag("it_" + it.id)) continue;
                bloqueioExtra.Add(new Vector2Int(it.x, it.z));
                tarefas.Add(CriarItem(it));
            }
            await Task.WhenAll(tarefas);
            AtualizarNpcs();
            IniciarSelvagens();
        }

        void Iluminar()
        {
            var cam = Camera.main;
            if (!mapa.interior)
            {
                ceu = Dados.CeuDe(mapa);
                RenderSettings.fog = true;
                RenderSettings.fogMode = FogMode.Linear;
                RenderSettings.fogColor = Dados.Cor(ceu.fog);
                RenderSettings.fogStartDistance = ceu.fogNear;
                RenderSettings.fogEndDistance = ceu.fogFar * 1.25f;
                RenderSettings.ambientMode = AmbientMode.Trilight;
                var hs = Dados.Cor(ceu.hemiSky) * ceu.hemiI;
                var hg = Dados.Cor(ceu.hemiGround) * ceu.hemiI;
                RenderSettings.ambientSkyColor = hs;
                RenderSettings.ambientEquatorColor = Color.Lerp(hs, hg, 0.5f);
                RenderSettings.ambientGroundColor = hg;
                var sd = new Vector3(ceu.sunDir[0], Mathf.Max(0.35f, ceu.sunDir[1]), ceu.sunDir[2]).normalized;
                // direção do three.js -> Unity (x espelhado); a luz aponta do sol para o chão
                sol.transform.rotation = Quaternion.LookRotation(-new Vector3(-sd.x, sd.y, sd.z));
                sol.color = Dados.Cor(ceu.sunLight);
                sol.intensity = ceu.sunI;
                if (!ceuMat) ceuMat = new Material(Shader.Find("Criaturas/Ceu"));
                ceuMat.SetColor("_Top", Dados.Cor(ceu.top));
                ceuMat.SetColor("_Horizon", Dados.Cor(ceu.horizon));
                ceuMat.SetColor("_Bottom", Dados.Cor(ceu.bottom));
                ceuMat.SetColor("_SunGlow", Dados.Cor(ceu.sunGlow));
                ceuMat.SetVector("_SunDir", new Vector3(-ceu.sunDir[0], ceu.sunDir[1], ceu.sunDir[2]));
                ceuMat.SetColor("_Cloud", Dados.Cor(ceu.cloud, Color.white));
                ceuMat.SetColor("_CloudShade", Dados.Cor(ceu.cloudShade, Color.gray));
                ceuMat.SetFloat("_Clouds", ceu.clouds ? 0.55f : 0);
                RenderSettings.skybox = ceuMat;
                if (cam) cam.clearFlags = CameraClearFlags.Skybox;
                if (luzSala) luzSala.enabled = false;
            }
            else
            {
                ceu = null;
                RenderSettings.fog = false;
                RenderSettings.skybox = null;
                RenderSettings.ambientMode = AmbientMode.Trilight;
                var hs = Dados.Cor("#fff6ea") * 1.05f;
                var hg = Dados.Cor("#8a7a6a") * 1.05f;
                var luz = Dados.Cor("#ffe2b8");
                float li = 9;
                sol.intensity = 1.0f;
                sol.color = Dados.Cor("#fff0dc");
                if (mapa.floor == "cave")
                {
                    hs = Dados.Cor("#8aa0d0") * 0.7f; hg = Dados.Cor("#2a2a3a") * 0.7f;
                    sol.intensity = 0.5f; luz = Dados.Cor("#6ac8ff"); li = 14;
                }
                var gym = mapa.floor switch
                {
                    "lava" => ("#ffa060", 12f), "metal" => ("#c8d4ff", 11f), "jungle" => ("#e0ffc8", 10f), "dark" => ("#b080ff", 12f), _ => (null, 0f),
                };
                if (gym.Item1 != null) { luz = Dados.Cor(gym.Item1); li = gym.Item2; }
                if (mapa.floor == "dark") { hs = Dados.Cor("#8a7ac8") * 0.6f; hg = Dados.Cor("#1a1428") * 0.6f; sol.intensity = 0.45f; }
                RenderSettings.ambientSkyColor = hs;
                RenderSettings.ambientEquatorColor = Color.Lerp(hs, hg, 0.5f);
                RenderSettings.ambientGroundColor = hg;
                sol.transform.rotation = Quaternion.LookRotation(-new Vector3(-0.45f, 0.85f, 0.35f));
                if (cam) { cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = Dados.Cor("#0e0c12"); }
                if (!luzSala)
                {
                    luzSala = new GameObject("Luz da sala").AddComponent<Light>();
                    luzSala.type = LightType.Point;
                    luzSala.shadows = LightShadows.None;
                }
                luzSala.enabled = true;
                luzSala.transform.position = Grade.Pos((W - 1) / 2f, (H - 1) / 2f, 2.8f);
                luzSala.color = luz;
                luzSala.intensity = li * 0.16f;
                luzSala.range = 18;
            }
            DynamicGI.UpdateEnvironment();
        }

        void PrepararCenario(GameObject cenario)
        {
            Texture2D margens = mapa.interior ? null : TexturaMargens();
            foreach (var r in cenario.GetComponentsInChildren<Renderer>(true))
            {
                var nome = r.name + "|" + (r.transform.parent ? r.transform.parent.name : "");
                if (nome.StartsWith("agua") || nome.Contains("|agua"))
                {
                    var m = new Material(Materiais.AguaShader);
                    var c = ceu;
                    m.SetColor("_Shallow", Dados.Cor(c?.waterShallow, Dados.Cor("#7fd0d4")));
                    m.SetColor("_Deep", Dados.Cor(c?.waterDeep, Dados.Cor("#2a78ac")));
                    m.SetColor("_Sky", Dados.Cor(c?.horizon, Color.white));
                    if (margens)
                    {
                        m.SetTexture("_Shore", margens);
                        m.SetVector("_ShoreRect", new Vector4(PAD + 0.5f, -PAD - 0.5f, -(W + 2 * PAD), H + 2 * PAD));
                    }
                    else m.SetVector("_ShoreRect", new Vector4(0, 0, 1, 1));
                    r.sharedMaterial = m;
                    r.shadowCastingMode = ShadowCastingMode.Off;
                    continue;
                }
                if (nome.Contains("terreno")) { r.shadowCastingMode = ShadowCastingMode.Off; continue; }
                if (mapa.interior || nome.Contains("__contorno")) continue;
                // plantas (malhas com cor de vértice): balançam com o vento
                var mf = r.GetComponent<MeshFilter>();
                if (!mf || !mf.sharedMesh || !mf.sharedMesh.HasVertexAttribute(VertexAttribute.Color)) continue;
                var alta = mf.sharedMesh.bounds.size.y > 1.2f;
                var mats = r.sharedMaterials;
                for (int i = 0; i < mats.Length; i++)
                    if (mats[i]) mats[i] = Materiais.ComVento(mats[i], alta ? 0.035f : 0.12f, alta ? 0.7f : 0f);
                r.sharedMaterials = mats;
            }
        }

        // mapa de proximidade da terra para a espuma da água (como no jogo original)
        Texture2D TexturaMargens()
        {
            int tw = W + 2 * PAD, th = H + 2 * PAD;
            var tex = new Texture2D(tw, th, TextureFormat.R8, false, true) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            var px = new byte[tw * th];
            for (int z = -PAD; z < H + PAD; z++)
                for (int x = -PAD; x < W + PAD; x++)
                {
                    var t = TileExt(x, z);
                    byte v = (byte)(t == 'W' ? 0 : 255);
                    if (t == 'W' && (TileExt(x + 1, z) != 'W' || TileExt(x - 1, z) != 'W' || TileExt(x, z + 1) != 'W' || TileExt(x, z - 1) != 'W')) v = 90;
                    px[(z + PAD) * tw + (x + PAD)] = v;
                }
            tex.SetPixelData(px, 0);
            tex.Apply();
            return tex;
        }

        // ------------------------------------------------ personagens
        async Task CriarNpc(NpcDef def)
        {
            var go = new GameObject("npc " + def.id);
            go.transform.SetParent(transform, false);
            var a = go.AddComponent<Ator>();
            a.Colocar(def.x, def.z, def.dir ?? "down");
            npcs[def.id] = a;
            var modelo = new GameObject("modelo").transform;
            modelo.SetParent(go.transform, false);
            a.modelo = modelo;
            if (def.orb)
            {
                var o = await Modelos.Criar("Objetos/orbe.glb", modelo);
                if (o) o.transform.localPosition = new Vector3(0, 0.92f, 0);
            }
            else if (!string.IsNullOrEmpty(def.creature))
            {
                var (m, anim) = await CriarCriatura(def.creature, modelo);
                a.animador = anim;
                if (Dados.Especies.TryGetValue(def.creature, out var esp) && esp.legendary) Lendario(modelo);
            }
            else
            {
                var (_, an) = await CriarPessoa(def.look, modelo);
                a.animador = an;
            }
            Sombra(modelo, def.creature != null ? 1.6f : 0.85f);
            if (def.hidden) a.Mostrar(false);
        }

        // Modelos 3D novos (feitos no Blender) que substituem os desenhados em código
        static readonly Dictionary<string, (string arquivo, float altura)> PESSOAS_NOVAS = new()
        {
            ["mae"] = ("Originais/mae_do_heroi.glb", 1.6f),
            ["prof"] = ("Originais/professor.glb", 1.68f),
        };
        static readonly Dictionary<string, (string arquivo, float altura)> CRIATURAS_NOVAS = new()
        {
            ["ratitu"] = ("Originais/ratitu.glb", 0.7f),
            ["pingolote"] = ("Originais/pingolote_novo.glb", 0.8f),
        };

        // os modelos novos já vêm em tamanho real; os feitos em código são menores e são ampliados na arena
        public static float EscalaArena(string look, float padrao) => look != null && PESSOAS_NOVAS.ContainsKey(look) ? 1.05f : padrao;

        public static async Task<(GameObject, IAnimador)> CriarPessoa(string look, Transform pai)
        {
            look = string.IsNullOrEmpty(look) ? "garoto" : look;
            if (PESSOAS_NOVAS.TryGetValue(look, out var novo))
            {
                var r = await CriarEsqueleto(novo.arquivo, pai, novo.altura, 0.009f);
                if (r.Item1) return r;
            }
            var m = await Modelos.Criar($"Pessoas/{look}.glb", pai);
            if (!m) return (null, null);
            var an = m.AddComponent<AnimPessoa>();
            Dados.Manifesto.pessoas.TryGetValue(look, out var info);
            an.Iniciar(info?.lider);
            return (m, an);
        }

        // modelo com esqueleto: ajusta a altura, apoia no chão, põe contorno e animações do arquivo
        public static async Task<(GameObject, IAnimador)> CriarEsqueleto(string arquivo, Transform pai, float altura, float contorno)
        {
            var g = await Modelos.Criar(arquivo, pai);
            if (!g) return (null, null);
            var b = Modelos.Limites(g);
            var k = altura / Mathf.Max(0.01f, b.size.y);
            g.transform.localScale = Vector3.one * k;
            g.transform.localPosition = new Vector3(0, -(b.min.y - pai.position.y) * k, 0);
            Modelos.ContornoPorNormal(g, contorno / k);
            var an = g.AddComponent<AnimEsqueleto>();
            an.Iniciar(1.3f, 1.3f);
            return (g, an);
        }

        public static async Task<(GameObject, IAnimador)> CriarCriatura(string sp, Transform pai, float? variante = null)
        {
            float v = variante.HasValue ? 0.94f + variante.Value * 0.12f : 1;
            Dados.Manifesto.criaturas.TryGetValue(sp, out var info);
            if (CRIATURAS_NOVAS.TryGetValue(sp, out var nova))
            {
                var r = await CriarEsqueleto(nova.arquivo, pai, (info?.altura ?? nova.altura) * v, 0.011f);
                if (r.Item1) return r;
            }
            if (info?.glb != null)
            {
                // Pingolote antigo: altura 0.8 no jogo original
                var r = await CriarEsqueleto($"Originais/{info.glb}.glb", pai, 0.8f * v, 0.011f);
                if (r.Item1) return r;
            }
            var m = await Modelos.Criar($"Criaturas/{sp}.glb", pai);
            if (!m) return (null, null);
            if (variante.HasValue) m.transform.localScale = Vector3.one * (0.94f + variante.Value * 0.12f);
            var ac = m.AddComponent<AnimCriatura>();
            ac.Iniciar();
            return (m, ac);
        }

        static Material sombraMat;
        public static void Sombra(Transform pai, float tamanho)
        {
            // sombra arredondada embaixo do personagem (além da sombra real do sol)
            if (!sombraMat)
            {
                var tex = new Texture2D(64, 64, TextureFormat.RGBA32, false);
                for (int y = 0; y < 64; y++)
                    for (int x = 0; x < 64; x++)
                    {
                        float d = Vector2.Distance(new Vector2(x, y), new Vector2(31.5f, 31.5f)) / 32f;
                        tex.SetPixel(x, y, new Color(0, 0, 0, Mathf.Clamp01(1 - d) * Mathf.Clamp01(1 - d) * 0.5f));
                    }
                tex.Apply();
                sombraMat = Materiais.NovoToon("sombra");
                sombraMat.SetTexture("_BaseMap", tex);
                sombraMat.SetFloat("_Unlit", 1);
                Materiais.Transparente(sombraMat);
                sombraMat.renderQueue = 2990;
            }
            var q = GameObject.CreatePrimitive(PrimitiveType.Quad);
            Destroy(q.GetComponent<Collider>());
            q.name = "sombra";
            q.transform.SetParent(pai, false);
            q.transform.localPosition = new Vector3(0, 0.015f, 0);
            q.transform.localRotation = Quaternion.Euler(90, 0, 0);
            q.transform.localScale = Vector3.one * tamanho;
            var r = q.GetComponent<MeshRenderer>();
            r.sharedMaterial = sombraMat;
            r.shadowCastingMode = ShadowCastingMode.Off;
        }

        void Lendario(Transform modelo)
        {
            var l = new GameObject("brilho").AddComponent<Light>();
            l.type = LightType.Point;
            l.color = Dados.Cor("#ffe8a0");
            l.range = 5;
            l.intensity = 2.5f;
            l.transform.SetParent(modelo, false);
            l.transform.localPosition = new Vector3(0, 1.2f, 0);
        }

        async Task CriarItem(ItemChao it)
        {
            var caminho = it.item == "superorbe" ? "Objetos/superorbe.glb" : "Objetos/orbe.glb";
            var o = await Modelos.Criar(caminho, raiz, "item " + it.id);
            if (!o) return;
            o.transform.position = Grade.Pos(it.x, it.z, 0.14f);
            itens[it] = o;
        }

        public void PegarItem(ItemChao it)
        {
            if (itens.TryGetValue(it, out var o) && o) Destroy(o);
            itens.Remove(it);
            bloqueioExtra.Remove(new Vector2Int(it.x, it.z));
        }

        public void AtualizarNpcs()
        {
            foreach (var def in mapa.npcs)
            {
                if (!npcs.TryGetValue(def.id, out var a) || !a) continue;
                if (def.Tem("cond") && CondicaoNpc != null) a.Mostrar(CondicaoNpc(def));
            }
        }

        // ------------------------------------------------ perguntas sobre a grade
        public char Tile(int x, int z) => x < 0 || z < 0 || x >= W || z >= H ? 'T' : mapa.rows[z][x];

        public char TileExt(int x, int z)
        {
            if (x >= 0 && z >= 0 && x < W && z < H) return Tile(x, z);
            var t = mapa.rows[Mathf.Clamp(z, 0, H - 1)][Mathf.Clamp(x, 0, W - 1)];
            return t is '.' or 'G' or 'f' or 'S' or 'F' or 'R' ? 'T' : t;
        }

        public Predio PredioEm(int x, int z)
        {
            foreach (var b in mapa.buildings) if (x >= b.x && x < b.x + b.w && z >= b.z && z < b.z + b.d) return b;
            return null;
        }

        public Predio PortaEm(int x, int z)
        {
            var b = PredioEm(x, z);
            return b != null && b.to != null && x == b.x + b.door && z == b.z + b.d - 1 ? b : null;
        }

        public Ator NpcEm(int x, int z)
        {
            foreach (var a in npcs.Values) if (a && a.gameObject.activeSelf && a.x == x && a.z == z) return a;
            return null;
        }

        public NpcDef DefDe(Ator a)
        {
            foreach (var kv in npcs) if (kv.Value == a) return mapa.npcs.Find(d => d.id == kv.Key);
            return null;
        }

        public Selvagem SelvagemEm(int x, int z)
        {
            foreach (var s in selvagens) if (s && s.ator.x == x && s.ator.z == z) return s;
            return null;
        }

        public bool Bloqueado(int x, int z, Ator eu = null)
        {
            var m = mapa;
            if (m.exit != null && m.exit.x == x && m.exit.z == z) return false;
            if (x < 0 || z < 0 || x >= W || z >= H) return true;
            if (BLOQUEIA.Contains(Tile(x, z))) return true;
            if (PredioEm(x, z) != null && PortaEm(x, z) == null) return true;
            foreach (var f in m.furniture)
            {
                if (f.walk) continue;
                if (x >= f.x && x < f.x + f.w && z >= f.z && z < f.z + f.d) return true;
            }
            if (bloqueioExtra.Contains(new Vector2Int(x, z))) return true;
            var n = NpcEm(x, z);
            if (n && n != eu) return true;
            var s = SelvagemEm(x, z);
            if (s && s.ator != eu) return true;
            if (eu && eu != heroi && heroi && heroi.x == x && heroi.z == z) return true;
            return false;
        }

        // ------------------------------------------------ NPCs que passeiam
        readonly Dictionary<Ator, float> passeio = new();
        public void AtualizarPasseio(float dt, bool ocupado)
        {
            if (ocupado) return;
            foreach (var def in mapa.npcs)
            {
                if (!def.wander || !npcs.TryGetValue(def.id, out var a) || !a || !a.gameObject.activeSelf || a.andando) continue;
                if (!passeio.TryGetValue(a, out var t)) t = 1 + Random.value * 3;
                t -= dt;
                if (t <= 0)
                {
                    t = 1.5f + Random.value * 3;
                    var dirs = new[] { "up", "down", "left", "right" };
                    var d = dirs[Random.Range(0, 4)];
                    var v = Grade.DIRS[d];
                    int nx = a.x + v.x, nz = a.z + v.y;
                    if (Random.value < 0.5f && Mathf.Abs(nx - def.x) <= 2 && Mathf.Abs(nz - def.z) <= 2 && !Bloqueado(nx, nz, a) && Tile(nx, nz) != 'G' && PortaEm(nx, nz) == null)
                        _ = a.Andar(d, 0.7f);
                    else a.Virar(d);
                }
                passeio[a] = t;
            }
        }

        // ------------------------------------------------ criaturas selvagens
        void IniciarSelvagens()
        {
            mato.Clear();
            if (mapa.encounters?.list == null) return;
            for (int z = 0; z < H; z++) for (int x = 0; x < W; x++) if (Tile(x, z) == 'G') mato.Add(new Vector2Int(x, z));
            timerSelvagem = 0.3f;
            int n = Mathf.Min(3, Limite());
            for (int i = 0; i < n; i++) _ = NovaSelvagem(true);
        }

        int Limite() => Mathf.Min(7, Mathf.Max(2, mato.Count / 10));

        async Task NovaSelvagem(bool instantanea)
        {
            var enc = mapa.encounters.list;
            for (int tent = 0; tent < 25; tent++)
            {
                var p = mato[Random.Range(0, mato.Count)];
                if (heroi && Mathf.Abs(p.x - heroi.x) + Mathf.Abs(p.y - heroi.z) < 3) continue;
                if (Bloqueado(p.x, p.y)) continue;
                float total = 0;
                foreach (var e in enc) total += (float)e[3];
                float r = Random.value * total;
                var esc = enc[0];
                foreach (var e in enc) { r -= (float)e[3]; if (r <= 0) { esc = e; break; } }
                string sp = (string)esc[0];
                int lvl = (int)esc[1] + Random.Range(0, (int)esc[2] - (int)esc[1] + 1);
                var go = new GameObject("selvagem " + sp);
                go.transform.SetParent(raiz, false);
                var s = go.AddComponent<Selvagem>();
                await s.Iniciar(this, sp, lvl, p.x, p.y, instantanea);
                if (!s) return;
                selvagens.Add(s);
                return;
            }
        }

        public void RemoverSelvagem(Selvagem s)
        {
            selvagens.Remove(s);
            if (s) Destroy(s.gameObject);
        }

        public void AtualizarSelvagens(float dt, bool ocupado)
        {
            if (mato.Count == 0) return;
            if (!ocupado)
            {
                timerSelvagem -= dt;
                if (timerSelvagem <= 0)
                {
                    timerSelvagem = 2 + Random.value * 4;
                    if (selvagens.Count < Limite()) _ = NovaSelvagem(false);
                }
            }
            foreach (var s in selvagens.ToArray()) if (s) s.Atualizar(dt, ocupado);
        }

        public bool EhMato(int x, int z) => Tile(x, z) == 'G';
    }
}
