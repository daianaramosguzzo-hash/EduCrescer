using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using UnityEngine;

namespace Criaturas
{
    [Serializable]
    public class Lugar { public string map = "casa"; public int x = 4, z = 5; }

    // Progresso do jogador (o "state" do jogo original), salvo em JSON.
    [Serializable]
    public class Estado
    {
        public string name = "Cris";
        [SerializeField] public Dictionary<string, object> flags = new();
        public List<string> badges = new();
        [SerializeField] public Dictionary<string, int> bag = new();
        public int money = 3000;
        public string map = "casa";
        public int x = 2, z = 5;
        public string dir = "up";
        public float playTime;
        public int steps;
        public string camMode = "terceira";
        public List<Criatura> party = new();
        public List<Criatura> box = new();
        public HashSet<string> seen = new(), caught = new();
        public string starter, rivalStarter;
        public int rivalCol;
        public Lugar lastCenter = new();

        public bool Flag(string f) => flags.TryGetValue(f, out var v) && v switch { bool b => b, null => false, string s => s.Length > 0, _ => true };
        public void Marcar(string f, bool v = true) => flags[f] = v;

        public int Qtd(string item) => bag.TryGetValue(item, out var n) ? n : 0;
        public void Dar(string item, int n = 1) => bag[item] = Qtd(item) + n;
        public void Tirar(string item, int n = 1) => bag[item] = Math.Max(0, Qtd(item) - n);

        // equipe cheia (6) vai para a caixa do computador
        public string Adicionar(Criatura c)
        {
            c.hp = Mathf.Clamp(Mathf.Round(c.hp), 0, c.maxhp);
            seen.Add(c.sp); caught.Add(c.sp);
            if (party.Count < 6) { party.Add(c); return "party"; }
            box.Add(c); return "box";
        }

        public void CurarEquipe() { foreach (var c in party) c.CurarTudo(); }
        public bool TemQuemLute() => party.Exists(c => c.hp > 0);

        const string CHAVE = "criaturas-unity-save-v2";
        public void Salvar() { PlayerPrefs.SetString(CHAVE, JsonConvert.SerializeObject(this)); PlayerPrefs.Save(); }
        public static Estado Carregar()
        {
            var s = PlayerPrefs.GetString(CHAVE, null);
            if (string.IsNullOrEmpty(s)) return null;
            try
            {
                var e = JsonConvert.DeserializeObject<Estado>(s);
                foreach (var c in e.party) Criatura.Reservar(c.uid);
                foreach (var c in e.box) Criatura.Reservar(c.uid);
                return e;
            }
            catch { return null; }
        }
    }
}
