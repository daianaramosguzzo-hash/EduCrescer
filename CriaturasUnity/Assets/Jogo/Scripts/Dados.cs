using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace Criaturas
{
    // Estruturas dos arquivos exportados de js/maps.js e js/data.js (tools/unity/exportar-mapas.mjs).
    // Os nomes dos campos seguem os do jogo original.
    public class Placa { public int x, z; public string text; }
    public class Warp { public int x, z, tx, tz; public string to, dir; }
    public class Saida { public int x, z, tx, tz; public string to; }
    public class Predio { public int x, z, w, d, door; public string style, to, roof, label; }
    public class Movel { public string type; public int x, z, w = 1, d = 1; public bool walk; }
    public class ItemChao { public string id, item; public int x, z, n = 1; }
    public class PontoMapa { public int x, z; }

    public class ComFuncoes
    {
        public List<string> _fn;
        public Dictionary<string, string> _src;
        public bool Tem(string nome) => _fn != null && _fn.Contains(nome);
        public string Fonte(string nome) => _src != null && _src.TryGetValue(nome, out var s) ? s : null;
    }

    public class Gatilho : ComFuncoes { public int x, z; }

    public class NpcDef : ComFuncoes
    {
        public string id, dir = "down", look, creature;
        public int x, z, sight;
        public bool wander, hidden, orb;
        public JObject trainer;
    }

    public class Encontros { public float rate; public JArray list; }

    public class MapaDados
    {
        public string id, name, sky, music, floor, bg;
        public bool interior, dark;
        public List<string> rows;
        public List<Predio> buildings = new();
        public List<Placa> signs = new();
        public List<Warp> warps = new();
        public List<NpcDef> npcs = new();
        public List<Gatilho> triggers = new();
        public List<Movel> furniture = new();
        public List<ItemChao> items = new();
        public List<PontoMapa> pcs = new();
        public Saida exit;
        public Encontros encounters;

        public int W => rows[0].Length;
        public int H => rows.Count;
        public string Clima => sky ?? (dark ? "forest" : "day");
    }

    public class Ceu
    {
        public string top, horizon, bottom, fog, sunGlow, sunLight, hemiSky, hemiGround;
        public string water, waterShallow, waterDeep, cloud, cloudShade, grass, tall;
        public float fogNear, fogFar, sunI, hemiI;
        public float[] sunDir;
        public bool clouds, lightning, butterflies, fireflies, leaves, motes;
    }

    public class Especie
    {
        public string id, name, dex;
        public List<string> types = new();
        public JObject model;
        public bool legendary;
        public StatusBase @base = new();
        public int xp = 50, @catch = 45;
        public Evolucao evo;
        public JArray learn;

        List<(int nivel, string golpe)> aprendizado;
        [JsonIgnore]
        public List<(int nivel, string golpe)> Aprendizado
        {
            get
            {
                if (aprendizado != null) return aprendizado;
                aprendizado = new();
                if (learn != null) foreach (var a in learn) aprendizado.Add(((int)a[0], (string)a[1]));
                return aprendizado;
            }
        }
    }

    public class PessoaInfo { public string lider; public float escala = 1; }
    public class CriaturaInfo { public string glb; public float? altura; public bool flutua; }

    public class Manifesto
    {
        public Dictionary<string, PessoaInfo> pessoas = new();
        public Dictionary<string, CriaturaInfo> criaturas = new();
        public List<string> mapas = new();
    }

    public static class Dados
    {
        public static Dictionary<string, Ceu> Ceus;
        public static Manifesto Manifesto;
        public static Dictionary<string, Especie> Especies = new();
        public static Dictionary<string, string> NomesItens = new();
        public static Dictionary<string, Golpe> Golpes = new();
        public static Dictionary<string, Item> Itens = new();
        public static List<string> OrdemDex = new();
        public static string CodigoMapas; // js/maps.js (roteiros da história)
        public static Golpe Golpe(string id) => Golpes.TryGetValue(id, out var g) ? g : Golpes["investida"];
        public static Item Item(string id) => Itens.TryGetValue(id, out var i) ? i : null;
        static readonly Dictionary<string, MapaDados> mapas = new();

        public static async Task Carregar()
        {
            Ceus = JsonConvert.DeserializeObject<Dictionary<string, Ceu>>(await Arquivos.Texto("Dados/ceus.json"));
            Manifesto = JsonConvert.DeserializeObject<Manifesto>(await Arquivos.Texto("Modelos/manifesto.json"));
            var esp = JObject.Parse(await Arquivos.Texto("Dados/especies.json"));
            foreach (var e in esp["list"]) { var s = e.ToObject<Especie>(); Especies[s.id] = s; OrdemDex.Add(s.id); }
            var itens = JObject.Parse(await Arquivos.Texto("Dados/itens.json"));
            foreach (var i in itens["list"]) { var it = i.ToObject<Item>(); Itens[it.id] = it; NomesItens[it.id] = it.name; }
            var golpes = JObject.Parse(await Arquivos.Texto("Dados/golpes.json"));
            foreach (var g in golpes["list"]) { var gl = g.ToObject<Golpe>(); Golpes[gl.id] = gl; }
            CodigoMapas = await Arquivos.Texto("Dados/maps.js");
        }

        public static string NomeItem(string id) => NomesItens.TryGetValue(id, out var n) ? n : id;

        public static async Task<MapaDados> Mapa(string id)
        {
            if (mapas.TryGetValue(id, out var m)) return m;
            m = JsonConvert.DeserializeObject<MapaDados>(await Arquivos.Texto($"Dados/Mapas/{id}.json"));
            mapas[id] = m;
            return m;
        }

        public static Ceu CeuDe(MapaDados m) => Ceus.TryGetValue(m.Clima, out var c) ? c : Ceus["day"];

        public static Color Cor(string hex, Color padrao = default)
        {
            if (string.IsNullOrEmpty(hex)) return padrao;
            return ColorUtility.TryParseHtmlString(hex, out var c) ? c : padrao;
        }

        // Falas simples tiradas do código das funções (G.say('...', 'Nome')), na ordem em que aparecem.
        static readonly Regex Fala = new(@"G\.say\(\s*(['`])((?:\\.|(?!\1).)*)\1\s*(?:,\s*'([^']*)')?", RegexOptions.Compiled);
        public static List<(string texto, string nome)> Falas(string fonte)
        {
            var r = new List<(string, string)>();
            if (string.IsNullOrEmpty(fonte)) return r;
            foreach (Match m in Fala.Matches(fonte))
            {
                var t = m.Groups[2].Value.Replace("\\'", "'").Replace("\\n", "\n");
                if (t.Contains("${")) continue; // texto montado com variáveis: fica para a próxima etapa
                r.Add((t, m.Groups[3].Success ? m.Groups[3].Value : null));
            }
            return r;
        }
    }
}
