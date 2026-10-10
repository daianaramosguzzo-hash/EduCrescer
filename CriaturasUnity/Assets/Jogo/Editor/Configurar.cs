using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;

namespace Criaturas.Editor
{
    // Menu "Criaturas > Configurar projeto": cria a cena do jogo, inclui os shaders na
    // versão final e ajusta nome, resolução e qualidade. Pode ser rodado de novo sem problema.
    public static class Configurar
    {
        const string CENA = "Assets/Scenes/Jogo.unity";
        // shaders criados só durante o jogo (a Unity não os vê nas cenas e os cortaria da versão final)
        static readonly string[] SHADERS = {
            "Criaturas/Toon", "Criaturas/Contorno", "Criaturas/Agua", "Criaturas/Ceu", "Criaturas/Terreno",
        };
        // shaders que versões anteriores incluíam e agora saem (o do terreno do URP tem variantes demais)
        static readonly string[] REMOVER = {
            "Universal Render Pipeline/Terrain/Lit",
            "Hidden/Universal Render Pipeline/Terrain/Lit (Add Pass)",
        };

        // Menu "Criaturas > Gerar versão Windows" (ou pela linha de comando: -executeMethod Criaturas.Editor.Configurar.ConstruirWindows)
        [MenuItem("Criaturas/Gerar versão Windows")]
        public static void ConstruirWindows()
        {
            Tudo();
            var r = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { CENA },
                locationPathName = "Build/Windows/CriaturasImaginarias.exe",
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None,
            });
            Debug.Log($"[Criaturas] Versão Windows: {r.summary.result}, {r.summary.totalSize / 1048576} MB, {r.summary.totalErrors} erros");
            if (Application.isBatchMode) EditorApplication.Exit(r.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded ? 0 : 1);
        }

        [MenuItem("Criaturas/Configurar projeto")]
        public static void Tudo()
        {
            Shaders();
            ConsertarMateriais();
            Natureza();
            Jogador();
            Cena();
            Qualidade();
            AssetDatabase.SaveAssets();
            Debug.Log("[Criaturas] Projeto configurado.");
        }

        static void Shaders()
        {
            var gs = AssetDatabase.LoadAssetAtPath<GraphicsSettings>("ProjectSettings/GraphicsSettings.asset");
            var so = new SerializedObject(gs);
            var arr = so.FindProperty("m_AlwaysIncludedShaders");
            for (int i = arr.arraySize - 1; i >= 0; i--)
            {
                var s = arr.GetArrayElementAtIndex(i).objectReferenceValue as Shader;
                if (s && REMOVER.Contains(s.name)) { arr.GetArrayElementAtIndex(i).objectReferenceValue = null; arr.DeleteArrayElementAtIndex(i); }
            }
            foreach (var nome in SHADERS)
            {
                var sh = Shader.Find(nome);
                if (!sh) { Debug.LogWarning("[Criaturas] Shader não encontrado (ignorado): " + nome); continue; }
                bool tem = false;
                for (int i = 0; i < arr.arraySize; i++) if (arr.GetArrayElementAtIndex(i).objectReferenceValue == sh) tem = true;
                if (tem) continue;
                arr.InsertArrayElementAtIndex(arr.arraySize);
                arr.GetArrayElementAtIndex(arr.arraySize - 1).objectReferenceValue = sh;
            }
            // tudo é montado durante o jogo (terreno, plantas em lote, névoa): sem isto a versão final
            // perde as variantes de desenho em lote (instancing) e de névoa e fica sem árvores e sem chão
            void Int(string nome, int v) { var p = so.FindProperty(nome); if (p != null) p.intValue = v; }
            void Bool(string nome, bool v) { var p = so.FindProperty(nome); if (p != null) p.boolValue = v; }
            Int("m_InstancingStripping", 2);   // manter todas
            Int("m_FogStripping", 1);          // personalizado
            Bool("m_FogKeepLinear", true); Bool("m_FogKeepExp", true); Bool("m_FogKeepExp2", true);
            Int("m_LightmapStripping", 1);
            so.ApplyModifiedProperties();
            // URP: manter a limpeza de variantes sem uso ligada (sem ela a Unity compila horas de variantes internas)
            foreach (var guid in AssetDatabase.FindAssets("t:UniversalRenderPipelineGlobalSettings"))
            {
                var gso = new SerializedObject(AssetDatabase.LoadMainAssetAtPath(AssetDatabase.GUIDToAssetPath(guid)));
                var it = gso.GetIterator();
                while (it.Next(true))
                    if (it.propertyType == SerializedPropertyType.Boolean && it.name.ToLowerInvariant().Contains("stripunused")) it.boolValue = true;
                gso.ApplyModifiedProperties();
            }
        }

        // Materiais do Terrain Sample cujo shader do HDRP não existe no URP (pedras, horizonte):
        // passam para o URP Lit, com as texturas salvas copiadas para as propriedades certas.
        static void ConsertarMateriais()
        {
            var lit = Shader.Find("Universal Render Pipeline/Lit");
            int n = 0;
            foreach (var guid in AssetDatabase.FindAssets("t:Material", new[] { "Assets/TerrainDemoScene_HDRP" }))
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                var m = AssetDatabase.LoadAssetAtPath<Material>(path);
                if (!m || (m.shader && m.shader.name != "Hidden/InternalErrorShader" && m.shader.isSupported)) continue;
                var so = new SerializedObject(m);
                var texs = so.FindProperty("m_SavedProperties.m_TexEnvs");
                Texture Salva(params string[] nomes)
                {
                    for (int i = 0; i < texs.arraySize; i++)
                    {
                        var e = texs.GetArrayElementAtIndex(i);
                        var nome = e.FindPropertyRelative("first").stringValue;
                        var t = e.FindPropertyRelative("second.m_Texture").objectReferenceValue as Texture;
                        if (t && nomes.Contains(nome)) return t;
                    }
                    return null;
                }
                var cor = Salva("_BaseColorMap", "_MainTex");
                var rel = Salva("_NormalMap", "_BumpMap");
                m.shader = lit;
                if (cor) m.SetTexture("_BaseMap", cor);
                if (rel) { m.SetTexture("_BumpMap", rel); m.EnableKeyword("_NORMALMAP"); }
                EditorUtility.SetDirty(m);
                n++;
            }
            if (n > 0) Debug.Log($"[Criaturas] {n} materiais do Terrain Sample convertidos para URP Lit.");
        }

        // lista dos modelos e camadas do "Unity HDRP Terrain | Terrain Sample Project"
        static void Natureza()
        {
            const string PASTA = "Assets/Jogo/Resources", ARQ = PASTA + "/Natureza.asset";
            if (!AssetDatabase.IsValidFolder(PASTA)) AssetDatabase.CreateFolder("Assets/Jogo", "Resources");
            var n = AssetDatabase.LoadAssetAtPath<Criaturas.Natureza>(ARQ);
            if (!n) { n = ScriptableObject.CreateInstance<Criaturas.Natureza>(); AssetDatabase.CreateAsset(n, ARQ); }
            const string RAIZ = "Assets/TerrainDemoScene_HDRP";
            T Um<T>(string nome, string tipo) where T : Object => AssetDatabase.FindAssets(nome + " t:" + tipo, new[] { RAIZ })
                .Select(AssetDatabase.GUIDToAssetPath)
                .Where(p => System.IO.Path.GetFileNameWithoutExtension(p) == nome)
                .Select(AssetDatabase.LoadAssetAtPath<T>).FirstOrDefault();
            GameObject[] P(params string[] nomes) => nomes.Select(x => Um<GameObject>(x, "Prefab")).Where(x => x).ToArray();
            TerrainLayer L(string nome) => Um<TerrainLayer>(nome, "TerrainLayer");
            n.pinheiros = P("Pine_A", "Pine_B", "Pine_C", "Pine_D");
            n.coniferas = P("Conifer", "Cypress");
            n.capim = P("Grass_A", "GrassDry_C", "GrassDry_D");
            n.capimAlto = P("Grass_C", "Grass_D");
            n.capimSeco = P("GrassDry_A", "GrassDry_B", "BushDry_A", "BushDry_B");
            n.samambaias = P("Fern_A", "Fern_B", "Fern_C");
            n.arbustos = P("Bush_A", "Bush_B", "Shrub", "Bush_Twig");
            n.flores = P("Heather_A", "Heather_B");
            n.pedras = P("Rock_A_01", "Rock_B_01", "Rock_B_02", "Rock_C_01");
            n.rochedos = P("Rock_Overgrown_A", "Rock_Overgrown_B", "Rock_Overgrown_C", "Rock_Overgrown_D", "Rock_D", "Rock_A_02", "Rock_C_02");
            n.grama = L("Grass_A"); n.gramaMato = L("Grass_B"); n.musgo = L("Grass_Moss_A"); n.terra = L("Grass_Soil_A");
            n.seixos = L("Pebbles_B"); n.margem = L("Tidal_Pools_B"); n.penhasco = L("Cliff_Mossy_E"); n.urze = L("Heather_A");
            n.areiaEscura = L("Black_Sand_A");
            EditorUtility.SetDirty(n);
            if (n.pinheiros.Length == 0) Debug.LogWarning("[Criaturas] Terrain Sample não encontrado em " + RAIZ + ".");
            else Debug.Log($"[Criaturas] Natureza: {n.pinheiros.Length + n.coniferas.Length} árvores, {n.capim.Length + n.capimAlto.Length} capins, {n.samambaias.Length} samambaias, {n.pedras.Length + n.rochedos.Length} pedras, camadas: {(n.grama ? "ok" : "faltando")}.");
        }
        static void Jogador()
        {
            PlayerSettings.productName = "Criaturas Imaginárias";
            PlayerSettings.companyName = "EduCrescer";
            PlayerSettings.defaultScreenWidth = 1600;
            PlayerSettings.defaultScreenHeight = 900;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.runInBackground = true;
        }

        static void Cena()
        {
            var cena = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var camGo = new GameObject("Câmera", typeof(Camera), typeof(AudioListener), typeof(UniversalAdditionalCameraData));
            camGo.tag = "MainCamera";
            camGo.transform.position = new Vector3(-10, 10, -6);
            var jogo = new GameObject("Jogo");
            jogo.AddComponent<Criaturas.Jogo>();
            EditorSceneManager.SaveScene(cena, CENA);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(CENA, true) };
        }

        static void Qualidade()
        {
            // sombras suaves e oclusão de ambiente (SSAO) no perfil de PC
            foreach (var guid in AssetDatabase.FindAssets("t:UniversalRenderPipelineAsset"))
            {
                var urp = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(AssetDatabase.GUIDToAssetPath(guid));
                if (!urp) continue;
                urp.shadowDistance = 45;
                urp.supportsHDR = true;
                EditorUtility.SetDirty(urp);
            }
            foreach (var guid in AssetDatabase.FindAssets("t:UniversalRendererData"))
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                var data = AssetDatabase.LoadAssetAtPath<UniversalRendererData>(path);
                if (!data || !path.Contains("PC")) continue;
                if (!data.rendererFeatures.Any(f => f && f.GetType().Name.Contains("ScreenSpaceAmbientOcclusion")))
                    Debug.Log("[Criaturas] O renderizador de PC não tem SSAO; adicione em " + path + " se quiser.");
            }
        }
    }
}
