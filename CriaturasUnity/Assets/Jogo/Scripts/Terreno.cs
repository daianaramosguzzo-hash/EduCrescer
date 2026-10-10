using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Criaturas
{
    // Chão dos mapas como Terreno da Unity, com as camadas do Terrain Sample (grama, mato,
    // musgo, seixos, margem, rocha...). O relevo segue o do jogo original (plano dentro do mapa,
    // água afundada, morros em volta) e ganha montanhas além da borda.
    public static class Terreno
    {
        public const int PAD = 10, EXTRA = 34;
        static readonly HashSet<string> SECOS = new() { "caatinga", "chapada" };

        public static GameObject Criar(Mundo mundo, Transform pai)
        {
            var nat = Natureza.Atual;
            if (nat == null || nat.grama == null) return null;
            var mapa = mundo.mapa;
            int W = mapa.W, H = mapa.H;
            float x0 = -PAD - EXTRA - 0.5f, x1 = W - 1 + PAD + EXTRA + 0.5f;
            float z0 = -PAD - EXTRA - 0.5f, z1 = H - 1 + PAD + EXTRA + 0.5f;
            float largura = x1 - x0, profundidade = z1 - z0;

            // malha em grade (2 vértices por quadrado), coordenadas do jogo original com X espelhado
            int nx = Mathf.CeilToInt(largura * 2), nz = Mathf.CeilToInt(profundidade * 2);
            var alt = new float[nx + 1, nz + 1];
            var verts = new Vector3[(nx + 1) * (nz + 1)];
            var uvs = new Vector2[verts.Length];
            for (int j = 0; j <= nz; j++)
                for (int i = 0; i <= nx; i++)
                {
                    float jx = x0 + i / (float)nx * largura, jz = z0 + j / (float)nz * profundidade;
                    float h = Ruido.Altura(mundo, jx, jz);
                    alt[i, j] = h;
                    int k = j * (nx + 1) + i;
                    verts[k] = new Vector3(-jx, h, jz);
                    uvs[k] = new Vector2(i / (float)nx, j / (float)nz);
                }
            var tris = new int[nx * nz * 6];
            int t = 0;
            for (int j = 0; j < nz; j++)
                for (int i = 0; i < nx; i++)
                {
                    int a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
                    // X espelhado: inverte a ordem para a face ficar para cima
                    tris[t++] = a; tris[t++] = b; tris[t++] = c;
                    tris[t++] = b; tris[t++] = d; tris[t++] = c;
                }
            var mesh = new Mesh { indexFormat = IndexFormat.UInt32, name = "terreno" };
            mesh.vertices = verts; mesh.uv = uvs; mesh.triangles = tris;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();

            // camadas: 0 grama, 1 mato, 2 musgo, 3 terra, 4 seixos, 5 margem, 6 penhasco, 7 urze
            bool seco = SECOS.Contains(mapa.Clima);
            var camadas = new[] { seco ? nat.terra : nat.grama, nat.gramaMato, nat.musgo, nat.terra, nat.seixos, nat.margem, nat.penhasco, nat.urze };
            for (int k = 0; k < camadas.Length; k++) if (!camadas[k]) camadas[k] = nat.grama;
            var tintas = new[] { new Color(0.92f, 1.05f, 0.82f), new Color(0.9f, 1.05f, 0.8f), new Color(0.95f, 1.0f, 0.88f), Color.white, Color.white, Color.white, Color.white, Color.white };
            if (seco) tintas[0] = Color.white;

            // mapas de mistura (4 pixels por quadrado), em coordenadas de UV da malha
            int ares = Mathf.ClosestPowerOfTwo(Mathf.Clamp((int)(Mathf.Max(largura, profundidade) * 4), 128, 1024));
            var m0 = new Color32[ares * ares]; var m1 = new Color32[ares * ares];
            var w = new float[8];
            for (int j = 0; j < ares; j++)
            {
                float v = (j + 0.5f) / ares, jz = z0 + v * profundidade;
                for (int i = 0; i < ares; i++)
                {
                    float u = (i + 0.5f) / ares, jx = x0 + u * largura;
                    System.Array.Clear(w, 0, 8);
                    float ox = (Ruido.VNoise(jx * 1.7, jz * 1.7) - 0.5f) * 0.55f, oz = (Ruido.VNoise(jx * 1.7 + 31, jz * 1.7 + 17) - 0.5f) * 0.55f;
                    Misturar(mundo, jx + ox, jz + oz, w, seco);
                    // encostas íngremes e montanha alta viram rocha
                    int gi = Mathf.Clamp(Mathf.RoundToInt(u * nx), 1, nx - 1), gj = Mathf.Clamp(Mathf.RoundToInt(v * nz), 1, nz - 1);
                    float dx = (alt[gi + 1, gj] - alt[gi - 1, gj]) * nx / largura / 2, dz = (alt[gi, gj + 1] - alt[gi, gj - 1]) * nz / profundidade / 2;
                    float inc = Mathf.Atan(Mathf.Sqrt(dx * dx + dz * dz)) * Mathf.Rad2Deg;
                    float rocha = Mathf.Max(Mathf.InverseLerp(26, 42, inc), Mathf.InverseLerp(9, 16, alt[gi, gj]));
                    float soma = 0;
                    for (int k = 0; k < 8; k++) { w[k] *= 1 - rocha; soma += w[k]; }
                    w[6] += rocha; soma += rocha;
                    if (soma <= 0) { w[0] = 1; soma = 1; }
                    byte B(int k) => (byte)Mathf.RoundToInt(w[k] / soma * 255);
                    m0[j * ares + i] = new Color32(B(0), B(1), B(2), B(3));
                    m1[j * ares + i] = new Color32(B(4), B(5), B(6), B(7));
                }
            }
            Texture2D Tex(Color32[] px) { var tx = new Texture2D(ares, ares, TextureFormat.RGBA32, false, true) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear }; tx.SetPixels32(px); tx.Apply(); return tx; }

            var mat = new Material(Shader.Find("Criaturas/Terreno")) { name = "terreno" };
            mat.SetTexture("_Splat0", Tex(m0));
            mat.SetTexture("_Splat1", Tex(m1));
            var tiles = new float[8];
            for (int k = 0; k < 8; k++)
            {
                mat.SetTexture("_Tex" + k, camadas[k].diffuseTexture);
                mat.SetColor("_Tint" + k, tintas[k]);
                tiles[k] = Mathf.Max(1, camadas[k].tileSize.x);
            }
            mat.SetVector("_Tile0123", new Vector4(tiles[0], tiles[1], tiles[2], tiles[3]));
            mat.SetVector("_Tile4567", new Vector4(tiles[4], tiles[5], tiles[6], tiles[7]));

            var go = new GameObject("terreno (Terrain Sample)");
            go.transform.SetParent(pai, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = ShadowCastingMode.On;
            return go;
        }
        // pesos das camadas no ponto (x, z) do jogo original, misturando os 4 quadrados vizinhos
        static void Misturar(Mundo m, float x, float z, float[] w, bool seco)
        {
            int ix = Mathf.FloorToInt(x), iz = Mathf.FloorToInt(z);
            float fx = x - ix, fz = z - iz;
            // suaviza a transição (mais nítida que linear, sem degraus)
            fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
            Somar(m, ix, iz, (1 - fx) * (1 - fz), w, seco);
            Somar(m, ix + 1, iz, fx * (1 - fz), w, seco);
            Somar(m, ix, iz + 1, (1 - fx) * fz, w, seco);
            Somar(m, ix + 1, iz + 1, fx * fz, w, seco);
        }

        static void Somar(Mundo m, int x, int z, float k, float[] w, bool seco)
        {
            if (k <= 0) return;
            bool dentro = x >= 0 && z >= 0 && x < m.W && z < m.H;
            char t = m.TileExt(x, z);
            if (dentro && m.PredioEm(x, z) != null) { w[3] += k; return; }
            switch (t)
            {
                case 'T': w[2] += k * 0.75f; w[0] += k * 0.25f; break;
                case 'G': w[1] += k; break;
                case ',': w[4] += k * 0.7f; w[3] += k * 0.3f; break;
                case '=': w[3] += k * 0.6f; w[4] += k * 0.4f; break;
                case 'W': w[5] += k; break;
                case 'f': w[0] += k * 0.45f; w[7] += k * 0.55f; break;
                default:
                    if (m.TileExt(x + 1, z) == 'W' || m.TileExt(x - 1, z) == 'W' || m.TileExt(x, z + 1) == 'W' || m.TileExt(x, z - 1) == 'W') { w[5] += k * 0.55f; w[0] += k * 0.45f; }
                    else if (seco) { w[0] += k * 0.6f; w[1] += k * 0.4f; }
                    else w[0] += k;
                    break;
            }
        }
    }
}
