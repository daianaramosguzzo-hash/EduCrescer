using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Rendering;
using Random = UnityEngine.Random;

namespace Criaturas
{
    // Cena 3D das batalhas (BattleScene do js/battle.js). Fica longe do mapa, em ORIGEM;
    // as posições usam as coordenadas do jogo original (x espelhado, como no resto da Unity).
    public class Arena : MonoBehaviour
    {
        public static readonly Vector3 ORIGEM = new(0, 0, -3000);
        static readonly Vector3 ALIADO = new(-1.5f, 0, 2.0f), INIMIGO = new(1.6f, 0, -1.3f);
        const float ROT_ALIADO = 2.55f, ROT_INIMIGO = -0.55f;

        public Camera cam;
        Transform raiz, fx;
        public Transform aliado, inimigo, treinador, heroi;
        float escAliado = 1, escInimigo = 1;
        float tremor;
        readonly List<(Transform t, Vector3 v, float vida)> particulas = new();
        Vector3 camBase = new(0.2f, 1.9f, 6.4f), camAlvo = new(0.3f, 0.7f, 0);

        static Vector3 P(Vector3 js) => ORIGEM + new Vector3(-js.x, js.y, js.z);
        static Vector3 P(float x, float y, float z) => P(new Vector3(x, y, z));

        // ------------------------------------------------ montagem
        public void Montar(string fundo)
        {
            Limpar();
            if (raiz) Destroy(raiz.gameObject);
            raiz = new GameObject("arena").transform;
            raiz.position = ORIGEM;
            fx = new GameObject("efeitos").transform;
            fx.SetParent(raiz, false);
            bool fora = fundo is "grass" or "forest" or "beach";
            var nat = Natureza.Atual;
            if (fora)
            {
                var chao = Disco(60, nat && nat.grama ? nat.grama.diffuseTexture : null, fundo == "beach" ? Dados.Cor("#f0dca0") : Color.white, 18);
                chao.transform.position = ORIGEM;
                if (nat && nat.pinheiros != null && nat.pinheiros.Length > 0)
                {
                    var gpu = raiz.gameObject.AddComponent<FlorestaGPU>();
                    for (int i = 0; i < 46; i++)
                    {
                        float a = -2.5f + i / 45f * 5 + (Ruido.Hash(i, 3) - 0.5f) * 0.1f;
                        float r = 11 + Ruido.Hash(i, 7) * 9 + (Mathf.Abs(a) > 1.4f ? -2 : 0);
                        float x = Mathf.Sin(a) * r, z = -Mathf.Cos(a) * r * 0.75f - 3;
                        var pre = Ruido.Hash(i, 13) < 0.5f && nat.coniferas.Length > 0 ? nat.coniferas[i % nat.coniferas.Length] : nat.pinheiros[i % nat.pinheiros.Length];
                        Adicionar(gpu, pre, x, z, 6 + Ruido.Hash(i, 1) * 3, Ruido.Hash(i, 2) * 360, false, 0);
                    }
                    for (int i = 0; i < 140; i++)
                    {
                        float x = (Ruido.Hash(i, 21) - 0.5f) * 22, z = (Ruido.Hash(i, 37) - 0.5f) * 16 - 1;
                        if (Vector2.Distance(new Vector2(x, z), new Vector2(ALIADO.x, ALIADO.z)) < 1.6f || Vector2.Distance(new Vector2(x, z), new Vector2(INIMIGO.x, INIMIGO.z)) < 1.5f || z > 0.8f) continue;
                        var lista = i % 9 == 0 ? nat.flores : i % 5 == 0 ? nat.samambaias : nat.capim;
                        if (lista == null || lista.Length == 0) continue;
                        Adicionar(gpu, lista[i % lista.Length], x, z, i % 5 == 0 ? 0.8f : 0.3f, Ruido.Hash(i, 9) * 360, i % 5 == 0, 40);
                    }
                }
            }
            else
            {
                var cor = fundo switch { "pool" => "#bcd8ee", "liga" => "#c89a4a", "cave" => "#4a4c5a", "gym" => "#9a9084", _ => "#c8b89a" };
                var chao = Disco(30, nat && nat.seixos ? nat.seixos.diffuseTexture : null, Dados.Cor(cor), 10);
                chao.transform.position = ORIGEM;
                var parede = GameObject.CreatePrimitive(PrimitiveType.Cube);
                Destroy(parede.GetComponent<Collider>());
                parede.transform.SetParent(raiz, false);
                parede.transform.position = P(0, 4.5f, -11);
                parede.transform.localScale = new Vector3(40, 9, 1);
                parede.GetComponent<Renderer>().sharedMaterial = Liso(Dados.Cor(fundo == "liga" ? "#b84a4a" : fundo == "cave" ? "#4a4c5c" : "#9a9084"));
            }
            foreach (var (pos, r) in new[] { (ALIADO, 1.25f), (INIMIGO, 1.15f) })
            {
                var borda = Cilindro(r + 0.06f, 0.12f, Color.white);
                borda.position = P(pos.x, 0.06f, pos.z);
                var plat = Cilindro(r, 0.14f, fora ? Dados.Cor("#8ad070") * 0.9f : Dados.Cor("#d8d0c4"));
                plat.position = P(pos.x, 0.07f, pos.z);
            }
        }

        void Adicionar(FlorestaGPU gpu, GameObject pre, float x, float z, float tamanho, float giro, bool largura, float dist)
        {
            if (!pre) return;
            var lg = pre.GetComponentInChildren<LODGroup>();
            var rs = lg ? lg.GetLODs()[0].renderers : pre.GetComponentsInChildren<Renderer>();
            Bounds b = default; bool primeiro = true;
            foreach (var r in rs)
            {
                var mf = r ? r.GetComponent<MeshFilter>() : null;
                if (!mf || !mf.sharedMesh) continue;
                var w = new Bounds(r.transform.TransformPoint(mf.sharedMesh.bounds.center), Vector3.Scale(mf.sharedMesh.bounds.size, r.transform.lossyScale));
                if (primeiro) { b = w; primeiro = false; } else b.Encapsulate(w);
            }
            float k = tamanho / Mathf.Max(0.01f, largura ? Mathf.Max(b.size.x, b.size.z) : b.size.y);
            gpu.Adicionar(pre, P(x, -0.05f, z), Quaternion.Euler(0, giro, 0), k, dist);
        }

        GameObject Disco(float raio, Texture tex, Color cor, float repetir)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Destroy(go.GetComponent<Collider>());
            go.name = "chão";
            go.transform.SetParent(raiz, false);
            go.transform.localScale = new Vector3(raio * 2, 0.01f, raio * 2);
            var m = Materiais.NovoToon("chao_arena");
            if (tex) { m.SetTexture(GeradorToon.BaseMap, tex); m.SetTextureScale(GeradorToon.BaseMap, Vector2.one * repetir); }
            m.SetColor(GeradorToon.BaseColor, cor);
            m.SetFloat("_Suave", 1);
            m.SetFloat("_Rim", 0);
            var r = go.GetComponent<Renderer>();
            r.sharedMaterial = m;
            r.shadowCastingMode = ShadowCastingMode.Off;
            return go;
        }

        static Material Liso(Color c)
        {
            var m = Materiais.NovoToon("liso");
            m.SetColor(GeradorToon.BaseColor, c);
            return m;
        }

        Transform Cilindro(float r, float h, Color c)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(raiz, false);
            go.transform.localScale = new Vector3(r * 2, h / 2, r * 2);
            go.GetComponent<Renderer>().sharedMaterial = Liso(c);
            return go.transform;
        }

        public void Limpar()
        {
            foreach (var t in new[] { aliado, inimigo, treinador, heroi }) if (t) Destroy(t.gameObject);
            aliado = inimigo = treinador = heroi = null;
            if (fx) foreach (Transform c in fx) Destroy(c.gameObject);
            particulas.Clear();
        }

        public void Desmontar()
        {
            Limpar();
            if (raiz) Destroy(raiz.gameObject);
        }

        // ------------------------------------------------ quadro a quadro
        void LateUpdate()
        {
            if (!cam || !raiz) return;
            float dt = Time.deltaTime;
            var b = camBase;
            if (tremor > 0)
            {
                tremor = Mathf.Max(0, tremor - dt);
                b += new Vector3((Random.value - 0.5f) * tremor * 0.5f, (Random.value - 0.5f) * tremor * 0.3f, 0);
            }
            cam.transform.position = P(b);
            cam.transform.LookAt(P(camAlvo));
            cam.fieldOfView = 40;
            for (int i = particulas.Count - 1; i >= 0; i--)
            {
                var (t, v, vida) = particulas[i];
                vida -= dt;
                if (!t || vida <= 0) { if (t) Destroy(t.gameObject); particulas.RemoveAt(i); continue; }
                t.position += v * dt;
                t.localScale = Vector3.one * 0.12f * Mathf.Clamp01(vida / 0.8f);
                particulas[i] = (t, v, vida);
            }
        }

        // ------------------------------------------------ utilidades de animação
        public static async Task Animar(float ms, Action<float> f)
        {
            float t0 = Time.time, dur = ms / 1000f;
            while (true)
            {
                float k = Mathf.Clamp01((Time.time - t0) / dur);
                f(k);
                if (k >= 1) break;
                await Task.Yield();
            }
        }

        public static async Task Esperar(float ms)
        {
            float t0 = Time.time;
            while (Time.time - t0 < ms / 1000f) await Task.Yield();
        }

        static float Suave(float t) => t < 0.5f ? 2 * t * t : 1 - Mathf.Pow(-2 * t + 2, 2) / 2;

        static readonly Dictionary<Color, Material> matsFx = new();
        Transform Bolinha(Color cor, float tam)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(fx, false);
            go.transform.localScale = Vector3.one * tam;
            if (!matsFx.TryGetValue(cor, out var m))
            {
                m = Materiais.NovoToon("fx");
                m.SetColor(GeradorToon.BaseColor, cor);
                m.SetFloat("_Unlit", 1);
                m.SetColor(GeradorToon.Emission, cor * 0.8f);
                matsFx[cor] = m;
            }
            var r = go.GetComponent<Renderer>();
            r.sharedMaterial = m;
            r.shadowCastingMode = ShadowCastingMode.Off;
            return go.transform;
        }

        public void Explosao(Vector3 posJs, Color cor, int n = 10, bool sobe = false)
        {
            for (int i = 0; i < n; i++)
            {
                var b = Bolinha(cor, 0.12f);
                b.position = P(posJs);
                var v = sobe ? new Vector3((Random.value - 0.5f) * 0.8f, 1.5f + Random.value, (Random.value - 0.5f) * 0.8f)
                             : new Vector3((Random.value - 0.5f) * 3, Random.value * 2.5f, (Random.value - 0.5f) * 3);
                particulas.Add((b, v, 0.8f));
            }
        }

        // ------------------------------------------------ personagens e criaturas
        public async Task<Transform> ColocarCriatura(bool doAliado, Criatura c)
        {
            var t = doAliado ? aliado : inimigo;
            if (t) Destroy(t.gameObject);
            var go = new GameObject(doAliado ? "aliado" : "inimigo");
            go.transform.SetParent(raiz, false);
            var pos = doAliado ? ALIADO : INIMIGO;
            go.transform.position = P(pos.x, 0.14f, pos.z);
            go.transform.rotation = Grade.Giro(doAliado ? ROT_ALIADO : ROT_INIMIGO);
            var (m, anim) = await Mundo.CriarCriatura(c.sp, go.transform, c.variant);
            if (anim != null) go.AddComponent<Animador>().a = anim;
            float h = m ? Mathf.Max(0.2f, Modelos.Limites(m).size.y) : 1;
            float esc = doAliado ? Mathf.Min(0.95f, 1.9f / h) : Mathf.Min(1.25f, 2.2f / h);
            esc = Mathf.Max(esc, doAliado ? 0.85f : 1f) * (h < 0.9f ? 1.2f : 1);
            go.transform.localScale = Vector3.one * esc;
            if (doAliado) { aliado = go.transform; escAliado = esc; } else { inimigo = go.transform; escInimigo = esc; }
            return go.transform;
        }

        // faz o modelo animado continuar se mexendo na arena
        public class Animador : MonoBehaviour { public IAnimador a; void Update() => a?.Atualizar(Time.deltaTime, false, 1); }

        public async Task EntrarTreinador(string look)
        {
            var go = new GameObject("treinador");
            go.transform.SetParent(raiz, false);
            var (_, an) = await Mundo.CriarPessoa(look, go.transform);
            if (an != null) go.AddComponent<Animador>().a = an;
            go.transform.localScale = Vector3.one * Mundo.EscalaArena(look, 1.25f);
            go.transform.rotation = Grade.Giro(-0.4f);
            treinador = go.transform;
            await Animar(500, k => go.transform.position = P(INIMIGO.x + 0.2f + 6 * (1 - Suave(k)), 0.14f, INIMIGO.z));
        }

        public async Task SairTreinador()
        {
            var t = treinador;
            if (!t) return;
            await Animar(400, k => t.position = P(INIMIGO.x + 0.2f + k * 5, 0.14f, INIMIGO.z));
            Destroy(t.gameObject);
            treinador = null;
        }

        public async Task EntrarHeroi(Func<Transform, Task> criarModelo)
        {
            var go = new GameObject("heroi");
            go.transform.SetParent(raiz, false);
            await criarModelo(go.transform);
            go.transform.rotation = Grade.Giro(ROT_ALIADO);
            heroi = go.transform;
            await Animar(450, k => go.transform.position = P(ALIADO.x - 0.3f - 5 * (1 - Suave(k)), 0.14f, ALIADO.z + 0.6f));
        }

        public async Task SairHeroi()
        {
            var h = heroi;
            if (!h) return;
            await Esperar(150);
            await Animar(350, k => h.position = P(ALIADO.x - 0.3f - k * 5, 0.14f, ALIADO.z + 0.6f));
            Destroy(h.gameObject);
            heroi = null;
        }

        async Task<Transform> Orbe(string arquivo = "Objetos/orbe.glb")
        {
            var o = await Modelos.Criar(arquivo, fx, "orbe");
            return o ? o.transform : Bolinha(Dados.Cor("#e03a3a"), 0.25f);
        }

        public async Task Enviar(bool doAliado, Criatura c)
        {
            var p = doAliado ? ALIADO : INIMIGO;
            var orbe = await Orbe();
            var de = doAliado ? new Vector3(p.x - 1.5f, 1.2f, p.z + 1.2f) : new Vector3(p.x + 1.2f, 1.4f, p.z - 0.5f);
            Sons.Tocar("throw");
            await Animar(350, k =>
            {
                var q = Vector3.Lerp(de, new Vector3(p.x, 0.4f, p.z), k);
                q.y += Mathf.Sin(k * Mathf.PI) * 1.2f;
                orbe.position = P(q);
                orbe.rotation = Quaternion.Euler(k * 600, 0, 0);
            });
            Destroy(orbe.gameObject);
            Explosao(new Vector3(p.x, 0.5f, p.z), Color.white, 14);
            var t = await ColocarCriatura(doAliado, c);
            float e = doAliado ? escAliado : escInimigo;
            t.localScale = Vector3.one * 0.01f;
            await Animar(280, k => t.localScale = Vector3.one * Mathf.Max(0.01f, Suave(k) * e));
            Sons.Tocar("cry");
        }

        public async Task Recolher(bool doAliado)
        {
            var t = doAliado ? aliado : inimigo;
            if (!t) return;
            float e = doAliado ? escAliado : escInimigo;
            await Animar(250, k => t.localScale = Vector3.one * Mathf.Max(0.01f, (1 - k) * e));
            Destroy(t.gameObject);
            if (doAliado) aliado = null; else inimigo = null;
        }

        static readonly HashSet<string> PROJETIL = new() { "fogo", "agua", "planta", "eletrico", "sombra", "pedra" };

        public async Task Atacar(bool doAliado, Golpe g)
        {
            var eu = doAliado ? aliado : inimigo;
            if (!eu) return;
            var deJs = doAliado ? ALIADO : INIMIGO;
            var paraJs = doAliado ? INIMIGO : ALIADO;
            Vector3 de = new(deJs.x, 0.14f, deJs.z), para = new(paraJs.x, 0.14f, paraJs.z);
            if (g.Status)
            {
                await Animar(300, k => eu.position = P(de.x, 0.14f + Mathf.Sin(k * Mathf.PI) * 0.3f, de.z));
                return;
            }
            if (PROJETIL.Contains(g.type))
            {
                await Animar(160, k => eu.position = P(Vector3.Lerp(de, Vector3.Lerp(de, para, 0.12f), Mathf.Sin(k * Mathf.PI))));
                var cor = Tipos.Cor(g.type);
                int n = g.pow >= 80 ? 6 : 3;
                var tiros = new List<Transform>();
                for (int i = 0; i < n; i++) tiros.Add(Bolinha(cor, g.type == "pedra" ? 0.3f : 0.26f));
                var ini = de + Vector3.up * 0.6f; var fim = para + Vector3.up * 0.6f;
                await Animar(380, k =>
                {
                    for (int i = 0; i < tiros.Count; i++)
                    {
                        float kk = Mathf.Clamp01(k * 1.3f - i * 0.06f);
                        var q = Vector3.Lerp(ini, fim, kk);
                        q.y += Mathf.Sin(kk * Mathf.PI) * (g.type == "pedra" ? 1 : 0.3f) + Mathf.Sin(i * 2 + k * 20) * 0.08f;
                        tiros[i].position = P(q);
                        tiros[i].gameObject.SetActive(kk > 0 && kk < 1);
                    }
                });
                foreach (var t in tiros) Destroy(t.gameObject);
                Explosao(fim, cor, 12);
            }
            else
                await Animar(260, k => eu.position = P(Vector3.Lerp(de, Vector3.Lerp(de, para, 0.7f), Mathf.Sin(k * Mathf.PI))));
            eu.position = P(de);
        }

        public async Task Atingido(bool doAliado, int forca)
        {
            var t = doAliado ? aliado : inimigo;
            if (!t) return;
            Sons.Tocar(forca == 2 ? "superhit" : forca == 0 ? "weakhit" : "hit");
            tremor = forca == 2 ? 0.5f : 0.25f;
            for (int i = 0; i < 4; i++) { t.gameObject.SetActive(false); await Esperar(60); if (!t) return; t.gameObject.SetActive(true); await Esperar(60); }
        }

        public async Task Desmaiar(bool doAliado)
        {
            var t = doAliado ? aliado : inimigo;
            if (!t) return;
            Sons.Tocar("faint");
            float y0 = t.position.y, e = doAliado ? escAliado : escInimigo;
            await Animar(500, k => { t.position = new Vector3(t.position.x, y0 - k * 1.2f, t.position.z); t.localScale = Vector3.one * Mathf.Max(0.01f, (1 - k * 0.6f) * e); });
            Destroy(t.gameObject);
            if (doAliado) aliado = null; else inimigo = null;
        }

        public async Task Status(bool doAliado, bool sobe)
        {
            var t = doAliado ? aliado : inimigo;
            if (!t) return;
            Sons.Tocar(sobe ? "stat" : "statdown");
            var p = doAliado ? ALIADO : INIMIGO;
            for (int i = 0; i < 3; i++)
            {
                Explosao(new Vector3(p.x, sobe ? 0.2f : 1.5f, p.z), sobe ? Dados.Cor("#ff8a3a") : Dados.Cor("#5a8aff"), 8, sobe);
                await Esperar(120);
            }
        }

        public async Task Cura(bool doAliado)
        {
            Sons.Tocar("heal");
            var p = doAliado ? ALIADO : INIMIGO;
            Explosao(new Vector3(p.x, 0.3f, p.z), Dados.Cor("#7af0a0"), 16, true);
            await Esperar(500);
        }

        // arremesso do orbe de captura: balança "sacudidas" vezes e prende (ou solta) a criatura
        public async Task Capturar(string arquivoOrbe, int sacudidas, bool sucesso)
        {
            var orbe = await Orbe(arquivoOrbe);
            var de = new Vector3(-2.5f, 1, 3.5f);
            var topo = INIMIGO + Vector3.up * 1.2f;
            Sons.Tocar("throw");
            await Animar(500, k =>
            {
                var q = Vector3.Lerp(de, topo, k);
                q.y += Mathf.Sin(k * Mathf.PI) * 1.5f;
                orbe.position = P(q);
                orbe.rotation = Quaternion.Euler(k * 700, 0, 0);
            });
            orbe.rotation = Grade.Giro(ROT_INIMIGO);
            Explosao(topo, Color.white, 16);
            var m = inimigo;
            float e = escInimigo;
            if (m) await Animar(300, k => { m.localScale = Vector3.one * Mathf.Max(0.01f, (1 - k) * e); m.position = P(INIMIGO.x, 0.14f + k * 1.1f, INIMIGO.z); });
            if (m) m.gameObject.SetActive(false);
            await Animar(300, k => orbe.position = P(INIMIGO.x, 1.32f - k * 1.2f + Mathf.Abs(Mathf.Sin(k * Mathf.PI * 2)) * 0.2f * (1 - k), INIMIGO.z));
            for (int i = 0; i < sacudidas; i++)
            {
                await Esperar(350);
                Sons.Tocar("shake");
                await Animar(400, k => orbe.rotation = Grade.Giro(ROT_INIMIGO) * Quaternion.Euler(0, 0, Mathf.Sin(k * Mathf.PI * 2) * 28));
            }
            await Esperar(300);
            if (sucesso)
            {
                Sons.Tocar("catch");
                Explosao(new Vector3(INIMIGO.x, 0.2f, INIMIGO.z), Dados.Cor("#ffe04a"), 12, true);
                await Esperar(600);
                return;
            }
            Destroy(orbe.gameObject);
            Explosao(new Vector3(INIMIGO.x, 0.2f, INIMIGO.z), Color.white, 16);
            if (m)
            {
                m.gameObject.SetActive(true);
                m.position = P(INIMIGO.x, 0.14f, INIMIGO.z);
                await Animar(250, k => m.localScale = Vector3.one * Mathf.Max(0.01f, k * e));
            }
        }

        // evolução: os dois modelos piscam alternando, cada vez mais rápido
        public async Task Evoluir(Criatura antes, string depois)
        {
            Limpar();
            var a = await ColocarCriatura(true, antes);
            var bGo = new GameObject("evolucao");
            bGo.transform.SetParent(raiz, false);
            var (bm, banim) = await Mundo.CriarCriatura(depois, bGo.transform, null);
            if (banim != null) bGo.AddComponent<Animador>().a = banim;
            foreach (var t in new[] { a, bGo.transform }) { t.position = P(0, 0.14f, 1.2f); t.rotation = Grade.Giro(-0.3f); }
            float hb = bm ? Mathf.Max(0.2f, Modelos.Limites(bm).size.y) : 1;
            bGo.transform.localScale = Vector3.one * Mathf.Min(1.2f, 2f / hb);
            bGo.SetActive(false);
            Sons.Tocar("evolve");
            for (int i = 0; i < 14; i++)
            {
                a.gameObject.SetActive(i % 2 == 0); bGo.SetActive(i % 2 != 0);
                if (i % 3 == 0) Explosao(new Vector3(0, 0.9f, 1.2f), Color.white, 6);
                await Esperar(Mathf.Max(60, 320 - i * 20));
            }
            Destroy(a.gameObject);
            aliado = bGo.transform;
            bGo.SetActive(true);
            Explosao(new Vector3(0, 0.9f, 1.2f), Dados.Cor("#ffe060"), 24, true);
            await Esperar(400);
        }

        // abertura (Prof. Ipê e criaturas em pose, como no intro do main.js)
        public async Task<Transform> Pose(string caminho, float x, float z, float giro, float escala, bool criatura)
        {
            var go = new GameObject("pose");
            go.transform.SetParent(raiz, false);
            if (criatura) { var (m, an) = await Mundo.CriarCriatura(caminho, go.transform, null); if (an != null) go.AddComponent<Animador>().a = an; }
            else { var (_, an) = await Mundo.CriarPessoa(caminho, go.transform); if (an != null) go.AddComponent<Animador>().a = an; }
            go.transform.position = P(x, 0.14f, z);
            go.transform.rotation = Grade.Giro(giro);
            go.transform.localScale = Vector3.one * (criatura ? escala : Mundo.EscalaArena(caminho, escala));
            return go.transform;
        }
    }
}
