using System.Collections.Generic;
using System.Threading.Tasks;
using GLTFast;
using GLTFast.Logging;
using GLTFast.Materials;
using GLTFast.Schema;
using UnityEngine;
using UnityEngine.Rendering;

namespace Criaturas
{
    // Converte os materiais dos .glb no material toon do jogo (em vez do PBR padrão do glTFast).
    public class GeradorToon : IMaterialGenerator
    {
        public static readonly int BaseColor = Shader.PropertyToID("_BaseColor");
        public static readonly int BaseMap = Shader.PropertyToID("_BaseMap");
        public static readonly int Emission = Shader.PropertyToID("_EmissionColor");

        public void SetLogger(ICodeLogger logger) { }

        public UnityEngine.Material GetDefaultMaterial(bool pointsSupport = false) => Materiais.NovoToon("padrao");

        public UnityEngine.Material GenerateMaterial(MaterialBase g, IGltfReadable gltf, bool pointsSupport = false)
        {
            var m = Materiais.NovoToon(g.name);
            var cor = Color.white;
            var pbr = g.PbrMetallicRoughness;
            if (pbr != null)
            {
                cor = pbr.BaseColor; // já em espaço linear
                var ti = pbr.BaseColorTexture;
                if (ti != null && ti.index >= 0)
                {
                    var tex = gltf.GetTexture(ti.index);
                    if (tex != null)
                    {
                        m.SetTexture(BaseMap, tex);
                        var tt = ti.Extensions?.KHR_texture_transform;
                        if (tt != null)
                        {
                            float sx = tt.scale?[0] ?? 1, sy = tt.scale?[1] ?? 1;
                            float ox = tt.offset?[0] ?? 0, oy = tt.offset?[1] ?? 0;
                            m.SetTextureScale(BaseMap, new Vector2(sx, sy));
                            m.SetTextureOffset(BaseMap, new Vector2(ox, 1 - oy - sy));
                        }
                    }
                }
            }
            m.SetVector(BaseColor, cor);
            // relevo (normal map), usado pelos modelos feitos no Blender
            var nt = g.NormalTexture;
            if (nt != null && nt.index >= 0)
            {
                var tex = gltf.GetTexture(nt.index);
                if (tex != null) { m.SetTexture("_BumpMap", tex); m.SetFloat("_UseNormal", 1); }
            }
            var e = g.Emissive;
            if (e.maxColorComponent > 0.001f) m.SetVector(Emission, e);
            if (g.Extensions?.KHR_materials_unlit != null) m.SetFloat("_Unlit", 1);
            if (g.doubleSided) m.SetFloat("_Cull", 0);
            if (g.GetAlphaMode() == MaterialBase.AlphaMode.Blend) Materiais.Transparente(m);
            else if (g.GetAlphaMode() == MaterialBase.AlphaMode.Mask) m.SetFloat("_Cutoff", g.alphaCutoff);
            return m;
        }
    }

    public static class Materiais
    {
        static Shader toon, contorno, agua;
        public static Shader Toon => toon ? toon : toon = Shader.Find("Criaturas/Toon");
        public static Shader ContornoShader => contorno ? contorno : contorno = Shader.Find("Criaturas/Contorno");
        public static Shader AguaShader => agua ? agua : agua = Shader.Find("Criaturas/Agua");

        static UnityEngine.Material contornoMat;
        public static UnityEngine.Material Contorno
        {
            get
            {
                if (contornoMat) return contornoMat;
                contornoMat = new UnityEngine.Material(ContornoShader) { name = "contorno", enableInstancing = true };
                return contornoMat;
            }
        }

        public static UnityEngine.Material ContornoInstanciado => Contorno;

        public static UnityEngine.Material NovoToon(string nome)
        {
            var m = new UnityEngine.Material(Toon) { name = nome, enableInstancing = true };
            return m;
        }

        public static void Transparente(UnityEngine.Material m)
        {
            m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
            m.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
            m.SetFloat("_ZWrite", 0);
            m.SetOverrideTag("RenderType", "Transparent");
            m.renderQueue = (int)RenderQueue.Transparent;
        }

        // variante do material que usa a cor de vértice (árvores, capim)
        static readonly Dictionary<UnityEngine.Material, UnityEngine.Material> comCor = new();
        public static UnityEngine.Material ComCorDeVertice(UnityEngine.Material m)
        {
            if (m.GetFloat("_UseVertexColor") > 0.5f) return m;
            if (comCor.TryGetValue(m, out var v)) return v;
            v = new UnityEngine.Material(m) { name = m.name + "_vc" };
            v.SetFloat("_UseVertexColor", 1);
            comCor[m] = v;
            return v;
        }

        // Material URP Lit de um pacote (Ultimate Nature) -> toon do jogo. Folhas recortadas
        // (alpha test) ficam com as duas faces e balançam com o vento; "escala" é o tamanho
        // aplicado ao modelo, para o vento ter a mesma força em metros.
        static readonly Dictionary<(UnityEngine.Material, int), UnityEngine.Material> doPacote = new();
        public static UnityEngine.Material DoPacote(UnityEngine.Material src, float escala)
        {
            int chave = Mathf.RoundToInt(escala * 20);
            if (doPacote.TryGetValue((src, chave), out var m)) return m;
            m = NovoToon(src.name + "_toon");
            if (src.HasProperty("_BaseMap"))
            {
                m.SetTexture(GeradorToon.BaseMap, src.GetTexture("_BaseMap"));
                m.SetTextureScale(GeradorToon.BaseMap, src.GetTextureScale("_BaseMap"));
                m.SetTextureOffset(GeradorToon.BaseMap, src.GetTextureOffset("_BaseMap"));
            }
            if (src.HasProperty("_BaseColor")) m.SetColor(GeradorToon.BaseColor, src.GetColor("_BaseColor"));
            bool recorte = src.IsKeywordEnabled("_ALPHATEST_ON") || (src.HasProperty("_AlphaClip") && src.GetFloat("_AlphaClip") > 0.5f);
            if (recorte)
            {
                m.SetFloat("_Cutoff", src.HasProperty("_Cutoff") ? Mathf.Max(0.3f, src.GetFloat("_Cutoff")) : 0.5f);
                m.SetFloat("_Cull", 0);
                m.SetOverrideTag("RenderType", "TransparentCutout");
                m.renderQueue = (int)RenderQueue.AlphaTest;
                float k = chave / 20f;
                m.SetFloat("_Wind", 0.04f * k);
                m.SetFloat("_WindBase", 0.15f / Mathf.Max(0.05f, k));
                m.SetFloat("_Rim", 0.15f);
            }
            else if (src.HasProperty("_Cull")) m.SetFloat("_Cull", src.GetFloat("_Cull"));
            doPacote[(src, chave)] = m;
            return m;
        }

        // Materiais do "Unity HDRP Terrain | Terrain Sample" (shaders do HDRP, que não rodam no URP):
        // pega a textura de cor e o relevo pelos nomes das propriedades e monta o material do jogo
        // com luz suave (realista). Folhas e capins recortados balançam com o vento.
        static readonly string[] COR = { "_BaseColorMap", "Texture2D_E1B0D043", "Texture2D_589E2359", "_MainTex", "_BaseMap" };
        static readonly string[] RELEVO = { "_NormalMap", "Texture2D_9DCAAA49", "Texture2D_D8D2DDB3", "_BumpMap" };
        static readonly Dictionary<(UnityEngine.Material, int), UnityEngine.Material> doTS = new();
        public static UnityEngine.Material DoTerrainSample(UnityEngine.Material src, float escala)
        {
            int chave = Mathf.RoundToInt(escala * 50);
            if (doTS.TryGetValue((src, chave), out var m)) return m;
            m = NovoToon(src.name + "_ts");
            UnityEngine.Texture Achar(string[] nomes) { foreach (var n in nomes) if (src.HasProperty(n) && src.GetTexture(n)) return src.GetTexture(n); return null; }
            var cor = Achar(COR);
            if (cor) m.SetTexture(GeradorToon.BaseMap, cor);
            var rel = Achar(RELEVO);
            if (rel) { m.SetTexture("_BumpMap", rel); m.SetFloat("_UseNormal", 1); }
            var sh = src.shader ? src.shader.name : "";
            bool capim = sh.Contains("TerrainGrass"), galho = sh.Contains("Branch"), casca = sh.Contains("Bark");
            float k = Mathf.Max(0.01f, chave / 50f);
            if (capim || galho)
            {
                m.SetFloat("_Cutoff", galho ? 0.22f : 0.35f);
                m.SetFloat("_Cull", 0);
                m.SetOverrideTag("RenderType", "TransparentCutout");
                m.renderQueue = (int)RenderQueue.AlphaTest;
            }
            if (capim) { m.SetFloat("_Wind", 0.12f * k); m.SetFloat("_WindBase", 0.03f / k); }
            else if (galho || casca) { m.SetFloat("_Wind", 0.022f * k); m.SetFloat("_WindBase", 1.4f / k); }
            m.SetFloat("_Suave", 1);
            m.SetFloat("_Rim", capim || galho ? 0.1f : 0.05f);
            // as folhas do pacote são escuras para o HDRP (que tem mais luz): clareia um pouco
            m.SetColor(GeradorToon.BaseColor, galho ? new Color(0.78f, 0.95f, 0.72f, 1) : capim ? new Color(0.95f, 1.1f, 0.85f, 1) : Color.white);
            m.enableInstancing = true;
            doTS[(src, chave)] = m;
            return m;
        }

        // variante com balanço de vento (plantas)
        static readonly Dictionary<UnityEngine.Material, UnityEngine.Material> comVento = new();
        public static UnityEngine.Material ComVento(UnityEngine.Material m, float amp, float baseY)
        {
            if (comVento.TryGetValue(m, out var v)) return v;
            v = new UnityEngine.Material(m) { name = m.name + "_vento" };
            v.SetFloat("_Wind", amp);
            v.SetFloat("_WindBase", baseY);
            comVento[m] = v;
            return v;
        }
    }

    // Carrega cada .glb uma vez e cria quantas cópias forem precisas.
    public static class Modelos
    {
        static readonly Dictionary<string, Task<GltfImport>> cache = new();
        static readonly GeradorToon gerador = new();

        static Task<GltfImport> Carregar(string caminho)
        {
            if (cache.TryGetValue(caminho, out var t)) return t;
            t = CarregarAgora(caminho);
            cache[caminho] = t;
            return t;
        }

        static async Task<GltfImport> CarregarAgora(string caminho)
        {
            var g = new GltfImport(null, null, gerador);
            var ok = await g.Load(Arquivos.Url("Modelos/" + caminho), new ImportSettings
            {
                AnimationMethod = AnimationMethod.Legacy,
                GenerateMipMaps = true,
                AnisotropicFilterLevel = 8,
            });
            if (!ok) { Debug.LogWarning("Modelo não carregou: " + caminho); return null; }
            return g;
        }

        public static async Task<bool> Existe(string caminho) => await Carregar(caminho) != null;

        // Cria uma cópia do modelo dentro de "pai". Devolve o objeto raiz (ou null se faltar o arquivo).
        public static async Task<GameObject> Criar(string caminho, Transform pai, string nome = null)
        {
            var g = await Carregar(caminho);
            if (g == null) return null;
            var raiz = new GameObject(nome ?? caminho);
            raiz.transform.SetParent(pai, false);
            await g.InstantiateMainSceneAsync(raiz.transform);
            Preparar(raiz);
            return raiz;
        }

        // Aplica as convenções de nome da exportação (contorno, sem sombra, água).
        static void Preparar(GameObject raiz)
        {
            foreach (var r in raiz.GetComponentsInChildren<Renderer>(true))
            {
                // cópias de malhas instanciadas viram "<malha>_i<n>" dentro do nó original
                var nome = r.gameObject.name + "|" + (r.transform.parent ? r.transform.parent.name : "");
                if (nome.Contains("__contorno"))
                {
                    var mats = r.sharedMaterials;
                    for (int i = 0; i < mats.Length; i++) mats[i] = Materiais.Contorno;
                    r.sharedMaterials = mats;
                    r.shadowCastingMode = ShadowCastingMode.Off;
                    r.receiveShadows = false;
                    continue;
                }
                var mesh = r is SkinnedMeshRenderer smr ? smr.sharedMesh : r.GetComponent<MeshFilter>()?.sharedMesh;
                if (mesh != null && mesh.HasVertexAttribute(VertexAttribute.Color))
                {
                    var mats = r.sharedMaterials;
                    for (int i = 0; i < mats.Length; i++) if (mats[i]) mats[i] = Materiais.ComCorDeVertice(mats[i]);
                    r.sharedMaterials = mats;
                }
                bool transparente = false;
                foreach (var m in r.sharedMaterials) if (m && m.renderQueue >= (int)RenderQueue.Transparent) transparente = true;
                if (nome.Contains("__semsombra") || transparente) r.shadowCastingMode = ShadowCastingMode.Off;
            }
        }

        // Contorno para modelos com esqueleto (herói, Pingolote): casca empurrada pela normal.
        public static void ContornoPorNormal(GameObject raiz, float espessura)
        {
            var mat = new UnityEngine.Material(Materiais.ContornoShader) { name = "contorno_normal" };
            mat.SetFloat("_Extrude", espessura);
            foreach (var smr in raiz.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                if (smr.name.EndsWith("_contorno")) continue;
                var go = new GameObject(smr.name + "_contorno");
                go.transform.SetParent(smr.transform.parent, false);
                go.transform.localPosition = smr.transform.localPosition;
                go.transform.localRotation = smr.transform.localRotation;
                go.transform.localScale = smr.transform.localScale;
                var o = go.AddComponent<SkinnedMeshRenderer>();
                o.sharedMesh = smr.sharedMesh;
                o.bones = smr.bones;
                o.rootBone = smr.rootBone;
                o.localBounds = smr.localBounds;
                var mats = new UnityEngine.Material[smr.sharedMesh.subMeshCount];
                for (int i = 0; i < mats.Length; i++) mats[i] = mat;
                o.sharedMaterials = mats;
                o.shadowCastingMode = ShadowCastingMode.Off;
                o.receiveShadows = false;
                o.updateWhenOffscreen = true;
                smr.updateWhenOffscreen = true;
            }
            foreach (var mr in raiz.GetComponentsInChildren<MeshRenderer>(true))
            {
                if (mr.name.EndsWith("_contorno") || mr.name.Contains("__contorno")) continue;
                var mf = mr.GetComponent<MeshFilter>();
                if (!mf || !mf.sharedMesh) continue;
                var go = new GameObject(mr.name + "_contorno");
                go.transform.SetParent(mr.transform, false);
                go.AddComponent<MeshFilter>().sharedMesh = mf.sharedMesh;
                var o = go.AddComponent<MeshRenderer>();
                var mats = new UnityEngine.Material[mf.sharedMesh.subMeshCount];
                for (int i = 0; i < mats.Length; i++) mats[i] = mat;
                o.sharedMaterials = mats;
                o.shadowCastingMode = ShadowCastingMode.Off;
            }
        }

        // Contorno como no jogo original: cópia da malha um pouco maior, em volta do próprio centro.
        public static Renderer ContornoCasca(Renderer r, float espessuraMundo)
        {
            var mf = r.GetComponent<MeshFilter>();
            if (!mf || !mf.sharedMesh) return null;
            var b = mf.sharedMesh.bounds;
            float raio = Mathf.Max(0.01f, Mathf.Min(b.extents.x, Mathf.Min(b.extents.y, b.extents.z)) * r.transform.lossyScale.x);
            float f = 1 + Mathf.Min(0.25f, espessuraMundo / raio);
            var go = new GameObject(r.name + "__contorno");
            go.transform.SetParent(r.transform, false);
            go.transform.localScale = Vector3.one * f;
            go.transform.localPosition = b.center * (1 - f);
            go.AddComponent<MeshFilter>().sharedMesh = mf.sharedMesh;
            var o = go.AddComponent<MeshRenderer>();
            var mats = new UnityEngine.Material[mf.sharedMesh.subMeshCount];
            for (int i = 0; i < mats.Length; i++) mats[i] = Materiais.Contorno;
            o.sharedMaterials = mats;
            o.shadowCastingMode = ShadowCastingMode.Off;
            o.receiveShadows = false;
            return o;
        }

        public static Transform Achar(Transform t, string prefixo)
        {
            if (t.name.StartsWith(prefixo)) return t;
            foreach (Transform c in t) { var r = Achar(c, prefixo); if (r) return r; }
            return null;
        }

        public static void AcharTodos(Transform t, string prefixo, List<Transform> saida)
        {
            if (t.name.StartsWith(prefixo)) saida.Add(t);
            foreach (Transform c in t) AcharTodos(c, prefixo, saida);
        }

        // altura do modelo pelas malhas visíveis
        public static Bounds Limites(GameObject raiz)
        {
            var rs = raiz.GetComponentsInChildren<Renderer>();
            if (rs.Length == 0) return new Bounds(raiz.transform.position, Vector3.zero);
            var b = rs[0].bounds;
            foreach (var r in rs) b.Encapsulate(r.bounds);
            return b;
        }
    }
}
