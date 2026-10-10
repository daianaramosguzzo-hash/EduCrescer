using System.IO;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

namespace Criaturas
{
    // Leitura dos arquivos em StreamingAssets (funciona no Windows e na versão para navegador).
    public static class Arquivos
    {
        public static string Url(string relativo)
        {
            var p = Path.Combine(Application.streamingAssetsPath, relativo).Replace('\\', '/');
            return p.Contains("://") ? p : "file:///" + p.TrimStart('/');
        }

        public static async Task<string> Texto(string relativo)
        {
            using var req = UnityWebRequest.Get(Url(relativo));
            await Enviar(req);
            if (req.result != UnityWebRequest.Result.Success)
                throw new IOException($"Não consegui ler {relativo}: {req.error}");
            return req.downloadHandler.text;
        }

        static Task Enviar(UnityWebRequest req)
        {
            var tcs = new TaskCompletionSource<bool>();
            req.SendWebRequest().completed += _ => tcs.TrySetResult(true);
            return tcs.Task;
        }
    }
}
