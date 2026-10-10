using System.Collections.Generic;
using UnityEditor.Build;
using UnityEditor.Rendering;
using UnityEngine;
using UnityEngine.Rendering;

namespace Criaturas.Editor
{
    // Os modelos dos pacotes (Ultimate Nature, Terrain Sample) chegam com materiais URP Lit e
    // Shader Graphs do HDRP, mas o jogo troca todos pelos shaders próprios (Criaturas/*) ao rodar.
    // Compilar esses shaders só deixaria a versão final horas mais lenta para gerar: são pulados.
    class PularShaders : IPreprocessShaders
    {
        public int callbackOrder => 0;

        static bool Pular(string nome) =>
            nome == "Universal Render Pipeline/Lit" ||
            nome == "Universal Render Pipeline/Simple Lit" ||
            nome.StartsWith("HDRP/") ||
            nome.StartsWith("Shader Graphs/") ||
            nome.StartsWith("Universal Render Pipeline/Terrain/") ||
            nome.StartsWith("Hidden/Universal Render Pipeline/Terrain/") ||
            nome.StartsWith("Hidden/TerrainEngine/");

        public void OnProcessShader(Shader shader, ShaderSnippetData snippet, IList<ShaderCompilerData> data)
        {
            if (shader && Pular(shader.name)) data.Clear();
        }
    }
}
