using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Criaturas
{
    // Golpe de uma criatura (id + PP restantes)
    [Serializable]
    public class GolpeSlot { public string id; public int pp; }

    // Uma criatura do jogador ou de um treinador (igual a js/creature.js)
    [Serializable]
    public class Criatura
    {
        static int proximoUid = 1;
        public int uid;
        public string sp;
        public int lvl, xp;
        public List<GolpeSlot> moves = new();
        public string nick;
        public float hp;
        public int maxhp, atk, def, spd;
        public float? variant;

        public static int XpDoNivel(int l) => l <= 1 ? 0 : (int)Math.Floor(l * l * l * 0.8);

        static int Calc(int b, int lvl, bool pv)
        {
            int v = (int)Math.Floor(b * 2.0 * lvl / 100.0);
            return pv ? v + lvl + 10 : v + 5;
        }

        public static Criatura Nova(string sp, int lvl)
        {
            var e = Dados.Especies[sp];
            var c = new Criatura { uid = proximoUid++, sp = sp, lvl = lvl, xp = XpDoNivel(lvl) };
            var aprende = e.Aprendizado.Where(a => a.nivel <= lvl).Select(a => a.golpe).Distinct().ToList();
            foreach (var id in aprende.Skip(Math.Max(0, aprende.Count - 4)))
                c.moves.Add(new GolpeSlot { id = id, pp = Dados.Golpe(id).pp });
            c.Recalcular();
            c.hp = c.maxhp;
            return c;
        }

        public void Recalcular()
        {
            var b = Dados.Especies[sp].@base;
            int antigo = maxhp;
            maxhp = Calc(b.hp, lvl, true);
            atk = Calc(b.atk, lvl, false);
            def = Calc(b.def, lvl, false);
            spd = Calc(b.spd, lvl, false);
            if (antigo > 0 && hp > 0) hp = Math.Min(maxhp, hp + (maxhp - antigo));
        }

        [JsonIgnore] public string Nome => !string.IsNullOrEmpty(nick) ? nick : Dados.Especies[sp].name;
        [JsonIgnore] public Especie Especie => Dados.Especies[sp];

        public void CurarTudo()
        {
            hp = maxhp;
            foreach (var m in moves) m.pp = Dados.Golpe(m.id).pp;
        }

        public static List<string> GolpesNoNivel(string sp, int lvl) =>
            Dados.Especies[sp].Aprendizado.Where(a => a.nivel == lvl).Select(a => a.golpe).ToList();

        // depois de carregar um jogo salvo, os novos uids continuam depois dos antigos
        public static void Reservar(int uid) { if (uid >= proximoUid) proximoUid = uid + 1; }
    }

    public class StatusBase { public int hp, atk, def, spd; }
    public class Evolucao { public int lvl; public string to; }
    public class Efeito { public string stat, who; public int n; }

    public class Golpe
    {
        public string id, name, type, cat;
        public int pow, acc = 100, pp, pri;
        public float heal, drain, recoil;
        public Efeito eff;
        public bool Status => cat == "status";
    }

    public class Item
    {
        public string id, name, desc, use;
        public int price, amount;
        public float bonus = 1;
    }

    public static class Tipos
    {
        public static readonly Dictionary<string, (string nome, string cor)> INFO = new()
        {
            ["normal"] = ("Normal", "#a8a878"), ["fogo"] = ("Fogo", "#f08030"), ["agua"] = ("Água", "#6890f0"),
            ["planta"] = ("Planta", "#78c850"), ["inseto"] = ("Inseto", "#a8b820"), ["voador"] = ("Voador", "#a890f0"),
            ["pedra"] = ("Pedra", "#b8a038"), ["eletrico"] = ("Elétrico", "#e8c020"), ["sombra"] = ("Sombra", "#705898"),
        };

        // multiplicadores atacante -> defensor (padrão 1), iguais a js/data.js
        static readonly Dictionary<string, Dictionary<string, float>> TABELA = new()
        {
            ["normal"] = new() { ["pedra"] = 0.5f, ["sombra"] = 0.5f },
            ["fogo"] = new() { ["planta"] = 2, ["inseto"] = 2, ["agua"] = 0.5f, ["pedra"] = 0.5f, ["fogo"] = 0.5f },
            ["agua"] = new() { ["fogo"] = 2, ["pedra"] = 2, ["planta"] = 0.5f, ["agua"] = 0.5f },
            ["planta"] = new() { ["agua"] = 2, ["pedra"] = 2, ["fogo"] = 0.5f, ["planta"] = 0.5f, ["inseto"] = 0.5f, ["voador"] = 0.5f },
            ["inseto"] = new() { ["planta"] = 2, ["sombra"] = 2, ["fogo"] = 0.5f, ["voador"] = 0.5f },
            ["voador"] = new() { ["planta"] = 2, ["inseto"] = 2, ["pedra"] = 0.5f, ["eletrico"] = 0.5f },
            ["pedra"] = new() { ["fogo"] = 2, ["voador"] = 2, ["inseto"] = 2 },
            ["eletrico"] = new() { ["agua"] = 2, ["voador"] = 2, ["planta"] = 0.5f, ["eletrico"] = 0.5f, ["pedra"] = 0.5f },
            ["sombra"] = new() { ["sombra"] = 2, ["normal"] = 0.5f, ["inseto"] = 0.5f },
        };

        public static float Mult(string atk, IEnumerable<string> defs)
        {
            float m = 1;
            foreach (var d in defs) if (TABELA.TryGetValue(atk, out var t) && t.TryGetValue(d, out var v)) m *= v;
            return m;
        }

        public static string Nome(string t) => INFO.TryGetValue(t, out var i) ? i.nome : t;
        public static UnityEngine.Color Cor(string t) => Dados.Cor(INFO.TryGetValue(t, out var i) ? i.cor : "#888888");
    }
}
