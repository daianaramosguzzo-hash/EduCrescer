using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;
using UnityEngine.Rendering;

namespace Criaturas
{
    // O glTFast cria um objeto para cada cópia de malha instanciada (cada tufo de capim,
    // flor, pedrinha...). Aqui as cópias iguais viram desenhos em lote na placa de vídeo
    // (Graphics.RenderMeshInstanced), agrupadas por região do mapa para a câmera poder
    // ignorar as que estão fora da tela.
    public class Instancias : MonoBehaviour
    {
        const float CELULA = 12f;
        const int LOTE = 1023;
        static readonly Regex Copia = new(@"_i\d+$", RegexOptions.Compiled);

        class Grupo
        {
            public Mesh mesh;
            public Material[] mats;
            public ShadowCastingMode sombra;
            public bool recebeSombra;
            public List<Matrix4x4> matrizes = new();
            public Bounds limites;
            public bool temLimites;
            public RenderParams[] rps;
            public Matrix4x4[][] lotes;
        }

        readonly List<Grupo> grupos = new();

        public static Instancias Juntar(GameObject raiz)
        {
            var mapa = new Dictionary<(Mesh, string, ShadowCastingMode, Vector2Int), Grupo>();
            var apagar = new List<GameObject>();
            foreach (var r in raiz.GetComponentsInChildren<MeshRenderer>(false))
            {
                if (!Copia.IsMatch(r.name)) continue;
                var mf = r.GetComponent<MeshFilter>();
                if (!mf || !mf.sharedMesh) continue;
                var mats = r.sharedMaterials;
                string chaveMats = "";
                foreach (var m in mats) chaveMats += (m ? m.GetHashCode() : 0) + ",";
                var p = r.transform.position;
                var cel = new Vector2Int(Mathf.FloorToInt(p.x / CELULA), Mathf.FloorToInt(p.z / CELULA));
                var chave = (mf.sharedMesh, chaveMats, r.shadowCastingMode, cel);
                if (!mapa.TryGetValue(chave, out var g))
                {
                    g = new Grupo { mesh = mf.sharedMesh, mats = mats, sombra = r.shadowCastingMode, recebeSombra = r.receiveShadows };
                    mapa[chave] = g;
                }
                g.matrizes.Add(r.transform.localToWorldMatrix);
                if (!g.temLimites) { g.limites = r.bounds; g.temLimites = true; } else g.limites.Encapsulate(r.bounds);
                apagar.Add(r.gameObject);
            }
            var inst = raiz.AddComponent<Instancias>();
            foreach (var g in mapa.Values)
            {
                g.limites.Expand(1f); // folga para o balanço do vento
                g.rps = new RenderParams[g.mats.Length];
                for (int i = 0; i < g.mats.Length; i++)
                {
                    var m = g.mats[i];
                    if (!m) continue;
                    m.enableInstancing = true;
                    g.rps[i] = new RenderParams(m)
                    {
                        worldBounds = g.limites,
                        shadowCastingMode = g.sombra,
                        receiveShadows = g.recebeSombra,
                        lightProbeUsage = LightProbeUsage.BlendProbes,
                        layer = raiz.layer,
                    };
                }
                int n = (g.matrizes.Count + LOTE - 1) / LOTE;
                g.lotes = new Matrix4x4[n][];
                for (int k = 0; k < n; k++) g.lotes[k] = g.matrizes.GetRange(k * LOTE, Mathf.Min(LOTE, g.matrizes.Count - k * LOTE)).ToArray();
                inst.grupos.Add(g);
            }
            foreach (var go in apagar) Destroy(go);
            return inst;
        }

        public int Quantidade => grupos.Count;

        void LateUpdate()
        {
            foreach (var g in grupos)
                for (int s = 0; s < g.mats.Length && s < g.mesh.subMeshCount; s++)
                {
                    if (!g.mats[s]) continue;
                    foreach (var lote in g.lotes) Graphics.RenderMeshInstanced(g.rps[s], g.mesh, s, lote);
                }
        }
    }
}
