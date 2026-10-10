using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Criaturas
{
    // Desenha a vegetação e as pedras do Terrain Sample em lote na placa de vídeo
    // (Graphics.RenderMeshInstanced), escolhendo o nível de detalhe (LOD) pela distância
    // até a câmera. Muito mais leve que um objeto com LODGroup para cada planta.
    public class FlorestaGPU : MonoBehaviour
    {
        // multiplicador das distâncias, ajustado pela qualidade gráfica
        public static float Escala = 1f;
        // herói: as plantas entre a câmera e ele não são desenhadas (para não tapar a visão)
        public static Transform Alvo;
        static readonly float[] DIST = { 14, 28, 50 };

        class Peca
        {
            public Mesh mesh;
            public int sub;
            public Material mat;
            public Matrix4x4 local;
            public bool sombra;
        }

        class Modelo { public List<Peca>[] lods; public float raio; }

        struct Copia { public int modelo; public Matrix4x4 m; public Vector3 pos; public float raio, maxDist; }

        readonly List<Modelo> modelos = new();
        readonly Dictionary<GameObject, int> indice = new();
        readonly List<Copia> copias = new();
        readonly Dictionary<(int, int, int), List<Matrix4x4>> listas = new();
        readonly Plane[] planos = new Plane[6];

        // maxDist = 0: sempre desenha (árvores, pedras grandes)
        public void Adicionar(GameObject prefab, Vector3 pos, Quaternion rot, float escala, float maxDist = 0)
        {
            if (!indice.TryGetValue(prefab, out var id))
            {
                id = modelos.Count;
                modelos.Add(Preparar(prefab, escala));
                indice[prefab] = id;
            }
            copias.Add(new Copia { modelo = id, m = Matrix4x4.TRS(pos, rot, Vector3.one * escala), pos = pos, raio = modelos[id].raio * escala, maxDist = maxDist });
        }

        static Modelo Preparar(GameObject prefab, float escalaNominal)
        {
            var mod = new Modelo();
            var lg = prefab.GetComponentInChildren<LODGroup>();
            var niveis = new List<LOD>(lg ? lg.GetLODs() : new[] { new LOD(0, prefab.GetComponentsInChildren<Renderer>()) });
            // o último nível das árvores SpeedTree é um "billboard" que precisa de shader próprio: fica de fora
            while (niveis.Count > 1 && System.Array.Exists(niveis[niveis.Count - 1].renderers, r => r && System.Array.Exists(r.sharedMaterials, m => m && m.name.ToLowerInvariant().Contains("billboard"))))
                niveis.RemoveAt(niveis.Count - 1);
            mod.lods = new List<Peca>[niveis.Count];
            var raizInv = prefab.transform.worldToLocalMatrix;
            float raio = 0.5f;
            for (int n = 0; n < niveis.Count; n++)
            {
                mod.lods[n] = new List<Peca>();
                foreach (var r in niveis[n].renderers)
                {
                    if (!r) continue;
                    var mf = r.GetComponent<MeshFilter>();
                    if (!mf || !mf.sharedMesh) continue;
                    var mesh = mf.sharedMesh;
                    var local = raizInv * r.transform.localToWorldMatrix;
                    raio = Mathf.Max(raio, mesh.bounds.extents.magnitude * r.transform.lossyScale.x);
                    var mats = r.sharedMaterials;
                    for (int s = 0; s < mesh.subMeshCount && s < mats.Length; s++)
                    {
                        if (!mats[s]) continue;
                        var mt = Materiais.DoTerrainSample(mats[s], escalaNominal);
                        mod.lods[n].Add(new Peca { mesh = mesh, sub = s, mat = mt, local = local, sombra = n < 2 });
                    }
                }
            }
            mod.raio = raio;
            return mod;
        }

        void LateUpdate()
        {
            var cam = Camera.main;
            if (!cam || copias.Count == 0) return;
            GeometryUtility.CalculateFrustumPlanes(cam, planos);
            var cp = cam.transform.position;
            foreach (var l in listas.Values) l.Clear();
            // segmento câmera -> herói, no plano do chão
            bool corta = Alvo && Alvo.gameObject.activeInHierarchy;
            Vector2 a = new(cp.x, cp.z), b = corta ? new Vector2(Alvo.position.x, Alvo.position.z) : a;
            Vector2 ab = b - a; float abLen2 = Mathf.Max(0.0001f, ab.sqrMagnitude);
            foreach (var c in copias)
            {
                float d = Vector3.Distance(cp, c.pos);
                if (c.maxDist > 0 && d > c.maxDist * Escala) continue;
                if (corta && c.raio > 0.6f)
                {
                    var p = new Vector2(c.pos.x, c.pos.z);
                    float t = Vector2.Dot(p - a, ab) / abLen2;
                    if (t > -0.15f && t < 0.92f && (a + ab * Mathf.Clamp01(t) - p).sqrMagnitude < 1.8f * 1.8f) continue;
                }
                if (!GeometryUtility.TestPlanesAABB(planos, new Bounds(c.pos + Vector3.up * c.raio * 0.5f, Vector3.one * (c.raio * 2 + 4)))) continue;
                var mod = modelos[c.modelo];
                int n = 0;
                while (n < mod.lods.Length - 1 && n < DIST.Length && d > DIST[n] * Escala) n++;
                var pecas = mod.lods[n];
                for (int p = 0; p < pecas.Count; p++)
                {
                    var chave = (c.modelo, n, p);
                    if (!listas.TryGetValue(chave, out var lista)) listas[chave] = lista = new List<Matrix4x4>();
                    lista.Add(c.m * pecas[p].local);
                }
            }
            var limites = new Bounds(cp, Vector3.one * 500);
            foreach (var kv in listas)
            {
                if (kv.Value.Count == 0) continue;
                var (mi, n, p) = kv.Key;
                var pc = modelos[mi].lods[n][p];
                var rp = new RenderParams(pc.mat)
                {
                    worldBounds = limites,
                    shadowCastingMode = pc.sombra ? ShadowCastingMode.On : ShadowCastingMode.Off,
                    receiveShadows = true,
                    lightProbeUsage = LightProbeUsage.BlendProbes,
                };
                for (int i = 0; i < kv.Value.Count; i += 1023)
                    Graphics.RenderMeshInstanced(rp, pc.mesh, pc.sub, kv.Value, Mathf.Min(1023, kv.Value.Count - i), i);
            }
        }

        public int Total => copias.Count;
    }
}
