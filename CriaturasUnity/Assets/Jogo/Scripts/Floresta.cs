using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using Object = UnityEngine.Object;

namespace Criaturas
{
    // Vegetação dos mapas com o "Unity HDRP Terrain | Terrain Sample Project" (convertido para
    // o URP): esconde o terreno, as árvores, o mato, as pedras e as montanhas feitos em código
    // no jogo original e planta pinheiros, coníferas, capins, samambaias, arbustos, urzes e
    // pedras do pacote sobre o Terreno da Unity (Terreno.cs).
    public static class Floresta
    {
        const int PAD = Terreno.PAD;
        static readonly string[] ESCONDER = { "terreno", "chao_fundo", "montanhas", "arvores", "mato_alto", "decoracao", "rochas" };
        static readonly HashSet<string> SECOS = new() { "caatinga", "chapada" };

        public static void Plantar(Mundo mundo, Transform pai, GameObject cenario)
        {
            var nat = Natureza.Atual;
            var mapa = mundo.mapa;
            if (nat == null || nat.pinheiros == null || nat.pinheiros.Length == 0) return;
            foreach (Transform c in cenario.GetComponentsInChildren<Transform>(true))
                foreach (var n in ESCONDER)
                    if (c.name == n || c.name.StartsWith(n + "_") || c.name.StartsWith(n + "|")) { c.gameObject.SetActive(false); break; }

            var raiz = new GameObject("vegetacao (Terrain Sample)").transform;
            raiz.SetParent(pai, false);
            var gpu = raiz.gameObject.AddComponent<FlorestaGPU>();
            var rnd = new System.Random(mapa.id.GetHashCode());
            float R() => (float)rnd.NextDouble();
            bool seco = SECOS.Contains(mapa.Clima);
            int W = mapa.W, H = mapa.H, LIM = PAD + 22;

            for (int z = -LIM; z < H + LIM; z++)
                for (int x = -LIM; x < W + LIM; x++)
                {
                    bool dentro = x >= 0 && z >= 0 && x < W && z < H;
                    int fora = dentro ? 0 : Mathf.Max(Mathf.Max(-x, x - W + 1), Mathf.Max(-z, z - H + 1));
                    var t = mundo.TileExt(x, z);
                    float h = Ruido.Hash(x * 13 + 7, z * 29 + 3);
                    float jx() => x + (R() - 0.5f) * 0.9f;
                    float jz() => z + (R() - 0.5f) * 0.9f;
                    if (dentro && (mundo.PredioEm(x, z) != null || t == 'S')) continue;

                    if (t == 'T')
                    {
                        // floresta: cada vez mais rala montanha acima (a névoa esconde o resto)
                        // árvores mais espaçadas que os quadrados (as do pacote são grandes e cheias)
                        float chance = fora <= 1 ? 0.55f : fora <= PAD ? 0.42f : Mathf.Lerp(0.3f, 0.06f, (fora - PAD) / 22f);
                        if (seco) chance *= 0.35f;
                        if (R() < chance)
                        {
                            float px = x + (Ruido.Hash(x, z * 3) - 0.5f) * 0.8f, pz = z + (Ruido.Hash(x * 3, z) - 0.5f) * 0.8f;
                            bool conifera = nat.coniferas.Length > 0 && R() < 0.55f;
                            var pre = conifera ? Um(nat.coniferas, rnd) : Um(nat.pinheiros, rnd);
                            float alt = (conifera ? 6.2f : 7.0f) * (0.75f + h * 0.5f);
                            Colocar(pre, gpu, mundo, px, pz, alt, R() * 360, -0.08f);
                        }
                        if (fora <= 3)
                        {
                            if (R() < 0.45f) Colocar(Um(nat.samambaias, rnd), gpu, mundo, jx(), jz(), 0.7f + R() * 0.4f, R() * 360, 0, largura: true, distancia: 26);
                            if (R() < 0.18f) Colocar(Um(nat.arbustos, rnd), gpu, mundo, jx(), jz(), 0.8f + R() * 0.4f, R() * 360, 0, largura: true, distancia: 30);
                            if (R() < 0.05f) Colocar(Um(nat.pedras, rnd), gpu, mundo, jx(), jz(), 0.5f + R() * 0.4f, R() * 360, -0.05f, largura: true, distancia: 34);
                        }
                        else if (fora > PAD && R() < 0.04f)
                            Colocar(Um(nat.rochedos, rnd), gpu, mundo, jx(), jz(), 3f + R() * 4f, R() * 360, -0.6f, largura: true);
                    }
                    else if (!dentro) continue;
                    else if (t == 'G')
                    {
                        // mato alto (onde vivem as criaturas): bem cheio e mais alto
                        for (int k = 0; k < 6; k++) Colocar(Um(seco ? nat.capimSeco : nat.capimAlto, rnd), gpu, mundo, jx(), jz(), 0.8f + R() * 0.35f, R() * 360, -0.02f, distancia: 34);
                    }
                    else if (t == 'f')
                    {
                        for (int k = 0; k < 2; k++) Colocar(Um(nat.flores, rnd), gpu, mundo, jx(), jz(), 0.45f + R() * 0.25f, R() * 360, 0, distancia: 30);
                    }
                    else if (t == 'R')
                    {
                        Colocar(Um(nat.pedras, rnd), gpu, mundo, x, z, 1.05f, R() * 360, -0.1f, largura: true);
                    }
                    else if (t == '.' || t == 'F')
                    {
                        // gramado: tufos baixinhos espalhados; mais plantas na beira da floresta
                        int n = seco ? 1 : 2;
                        for (int k = 0; k < n; k++) if (R() < 0.8f) Colocar(Um(seco ? nat.capimSeco : nat.capim, rnd), gpu, mundo, jx(), jz(), 0.22f + R() * 0.15f, R() * 360, 0, distancia: 22);
                        if (Vizinho(mundo, x, z, 'T'))
                        {
                            if (R() < 0.35f) Colocar(Um(nat.samambaias, rnd), gpu, mundo, jx(), jz(), 0.55f + R() * 0.3f, R() * 360, 0, largura: true, distancia: 26);
                            if (R() < 0.12f) Colocar(Um(nat.arbustos, rnd), gpu, mundo, jx(), jz(), 0.6f + R() * 0.3f, R() * 360, 0, largura: true, distancia: 30);
                        }
                        if (R() < 0.03f) Colocar(Um(nat.flores, rnd), gpu, mundo, jx(), jz(), 0.4f, R() * 360, 0, distancia: 26);
                    }
                }
        }
        static bool Vizinho(Mundo m, int x, int z, char t) =>
            m.TileExt(x + 1, z) == t || m.TileExt(x - 1, z) == t || m.TileExt(x, z + 1) == t || m.TileExt(x, z - 1) == t;

        static GameObject Um(GameObject[] l, System.Random rnd) => l == null || l.Length == 0 ? null : l[rnd.Next(l.Length)];

        // ------------------------------------------------ colocar um modelo do pacote
        static readonly Dictionary<GameObject, float> alturas = new(), larguras = new();

        static void Medir(GameObject pre)
        {
            if (alturas.ContainsKey(pre)) return;
            var lg = pre.GetComponentInChildren<LODGroup>();
            var rs = lg ? lg.GetLODs()[0].renderers : pre.GetComponentsInChildren<Renderer>();
            Bounds b = default; bool primeiro = true;
            foreach (var r in rs)
            {
                if (!r) continue;
                var mf = r.GetComponent<MeshFilter>();
                if (!mf || !mf.sharedMesh) continue;
                var mb = mf.sharedMesh.bounds;
                var w = new Bounds(r.transform.TransformPoint(mb.center), Vector3.Scale(mb.size, r.transform.lossyScale));
                if (primeiro) { b = w; primeiro = false; } else b.Encapsulate(w);
            }
            alturas[pre] = Mathf.Max(0.01f, b.size.y);
            larguras[pre] = Mathf.Max(0.01f, Mathf.Max(b.size.x, b.size.z));
        }

        static void Colocar(GameObject pre, FlorestaGPU gpu, Mundo mundo, float x, float z, float tamanho, float giro, float afundar, bool largura = false, float distancia = 0)
        {
            if (!pre) return;
            Medir(pre);
            float k = tamanho / (largura ? larguras[pre] : alturas[pre]);
            var pos = Grade.Pos(x, z, Ruido.Altura(mundo, x, z) + afundar);
            gpu.Adicionar(pre, pos, Quaternion.Euler(0, giro, 0), k, distancia);
        }
    }
    // Mesmas funções de ruído e altura do terreno do jogo original (js/env.js),
    // incluindo os arredondamentos de inteiros de 32 bits do JavaScript.
    public static class Ruido
    {
        static int ToInt32(double d)
        {
            if (double.IsNaN(d) || double.IsInfinity(d)) return 0;
            double t = Math.Truncate(d) % 4294967296.0;
            if (t < 0) t += 4294967296.0;
            return unchecked((int)(uint)t);
        }

        public static float Hash(double x, double z)
        {
            int h = ToInt32(x * 374761393.0 + z * 668265263.0) ^ 0x5bd1e995;
            h = ToInt32((double)(h ^ (int)((uint)h >> 13)) * 1274126177.0);
            uint r = (uint)(h ^ (int)((uint)h >> 16));
            return (float)(r / 4294967295.0);
        }

        public static float VNoise(double x, double z)
        {
            double xi = Math.Floor(x), zi = Math.Floor(z);
            double xf = x - xi, zf = z - zi;
            double u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
            double a = Hash(xi, zi), b = Hash(xi + 1, zi), c = Hash(xi, zi + 1), d = Hash(xi + 1, zi + 1);
            return (float)(a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
        }

        static float Suave(float a, float b, float x) { float t = Mathf.Clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

        // heightAt do terreno: zero dentro do mapa, morros subindo fora dele
        public static float Altura(Mundo m, float vx, float vz)
        {
            const int PAD = 10;
            int W = m.W, H = m.H;
            bool todosAgua = true;
            int ax = Mathf.FloorToInt(vx), az = Mathf.FloorToInt(vz);
            bool ex = Mathf.Abs(vx - Mathf.Round(vx)) < 0.01f, ez = Mathf.Abs(vz - Mathf.Round(vz)) < 0.01f;
            if (ex) ax = Mathf.RoundToInt(vx);
            if (ez) az = Mathf.RoundToInt(vz);
            for (int x = ax; x <= ax + (ex ? 0 : 1) && todosAgua; x++)
                for (int z = az; z <= az + (ez ? 0 : 1); z++)
                    if (m.TileExt(x, z) != 'W') { todosAgua = false; break; }
            float h = todosAgua ? -0.5f - VNoise(vx * 0.7, vz * 0.7) * 0.18f : 0;
            float dx = Mathf.Max(Mathf.Max(-0.5f - vx, vx - (W - 0.5f)), 0), dz = Mathf.Max(Mathf.Max(-0.5f - vz, vz - (H - 0.5f)), 0);
            float fora = Mathf.Sqrt(dx * dx + dz * dz);
            if (fora > 0 && !todosAgua) h += Suave(1.5f, PAD, fora) * (0.7f + VNoise(vx * 0.13 + 5, vz * 0.13 + 9) * 2.8f);
            // versão Unity: montanhas além dos morros (substituem as montanhas desenhadas do jogo original)
            if (fora > PAD - 3 && !todosAgua)
            {
                float serra = VNoise(vx * 0.05 + 3, vz * 0.05 + 7) * 0.65f + VNoise(vx * 0.14 + 11, vz * 0.14 + 2) * 0.35f;
                h += Suave(PAD - 3, PAD + 24, fora) * (3 + serra * 19);
            }
            return h;
        }

        static int[] Perto(float v) => Mathf.Abs(v - Mathf.Round(v)) < 0.01f ? new[] { Mathf.RoundToInt(v) } : new[] { Mathf.FloorToInt(v), Mathf.FloorToInt(v) + 1 };
    }
}
