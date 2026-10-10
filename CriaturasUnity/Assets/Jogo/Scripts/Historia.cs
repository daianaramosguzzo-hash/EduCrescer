using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Jint;
using Jint.Native;
using UnityEngine;

namespace Criaturas
{
    // Roteiros da história: o próprio js/maps.js do jogo original roda aqui, no interpretador
    // Jint, com um objeto G igual ao do main.js. As funções que demoram (falas, batalhas,
    // caminhadas) viram promessas JavaScript resolvidas pela Unity quando terminam.
    public class Historia : MonoBehaviour
    {
        Engine js;
        HostJs host;
        readonly Queue<(int id, object valor)> prontos = new();
        readonly Dictionary<int, TaskCompletionSource<string>> fins = new();
        int proximo;

        public void Iniciar(Jogo jogo)
        {
            host = new HostJs(jogo, this);
            js = new Engine(o => o.LimitRecursion(256));
            js.SetValue("host", host);
            js.Modules.Add("maps", Dados.CodigoMapas);
            var ns = js.Modules.Import("maps");
            js.SetValue("MAPS", ns.Get("MAPS"));
            js.SetValue("rivalFinalParty", ns.Get("rivalFinalParty"));
            js.SetValue("STARTER_LINE", ns.Get("STARTER_LINE"));
            js.Execute(PRELUDIO);
        }

        // ---------------------------------------------- promessas
        public int Esperar(Task<object> t)
        {
            int id = ++proximo;
            Acompanhar(id, t);
            return id;
        }

        public int Esperar(Task t) => Esperar(Embrulhar(t));
        static async Task<object> Embrulhar(Task t) { await t; return null; }

        async void Acompanhar(int id, Task<object> t)
        {
            object v = null;
            try { v = await t; }
            catch (Exception e) { Debug.LogException(e); }
            prontos.Enqueue((id, v));
        }

        void Update()
        {
            if (js == null) return;
            int n = 0;
            while (prontos.Count > 0 && n++ < 64)
            {
                var (id, v) = prontos.Dequeue();
                try { js.Invoke("__resolver", id, v ?? JsValue.Undefined); }
                catch (Exception e) { Debug.LogException(e); }
            }
            try { js.Advanced.ProcessTasks(); }
            catch (Exception e) { Debug.LogException(e); }
        }

        internal void Terminou(int id, string erro)
        {
            if (!string.IsNullOrEmpty(erro)) Debug.LogError("[Historia] " + erro);
            if (fins.TryGetValue(id, out var t)) { fins.Remove(id); t.TrySetResult(erro); }
        }

        Task Rodar(string chamada)
        {
            int id = ++proximo;
            var t = new TaskCompletionSource<string>();
            fins[id] = t;
            try { js.Execute(chamada.Replace("$ID", id.ToString())); js.Advanced.ProcessTasks(); }
            catch (Exception e) { Debug.LogException(e); t.TrySetResult(e.Message); }
            return t.Task;
        }

        static string Txt(string s) => "'" + (s ?? "").Replace("\\", "\\\\").Replace("'", "\\'") + "'";

        // ---------------------------------------------- chamadas usadas pelo jogo
        public bool TemFala(string mapa, string npc) => js.Invoke("__temTalk", mapa, npc).AsBoolean();
        public bool Condicao(string mapa, string npc) => js.Invoke("__cond", mapa, npc).AsBoolean();
        public bool ItemCondicao(string mapa, string id) => true;
        public int Gatilho(string mapa, int x, int z) => (int)js.Invoke("__gatilho", mapa, x, z).AsNumber();
        public Task Falar(string mapa, string npc) => Rodar($"__rodarNpc({Txt(mapa)}, {Txt(npc)}, $ID)");
        public Task RodarGatilho(string mapa, int i) => Rodar($"__rodarGatilho({Txt(mapa)}, {i}, $ID)");
        public Task Treinador(string mapa, string npc, bool visto) => Rodar($"__treinador({Txt(mapa)}, {Txt(npc)}, {(visto ? "true" : "false")}, $ID)");
        public bool EhTreinador(string mapa, string npc) => js.Invoke("__ehTreinador", mapa, npc).AsBoolean();
        public int Visao(string mapa, string npc) => (int)js.Invoke("__visao", mapa, npc).AsNumber();

        // ------------------------------------------------------------ objeto G (igual ao main.js)
        const string PRELUDIO = @"
const __pend = {};
function __esperar(id) { return new Promise((res, rej) => { __pend[id] = [res, rej]; }); }
function __resolver(id, v) { const p = __pend[id]; if (p) { delete __pend[id]; p[0](v); } }
function __npcObj(id) {
  return {
    get x() { return host.NpcX(id); }, get z() { return host.NpcZ(id); }, get dir() { return host.NpcDir(id); },
    walk: (d) => __esperar(host.NpcWalk(id, d.join(','))),
    startMove: (d) => __esperar(host.NpcWalk(id, d)),
    face: (d) => { host.NpcFace(id, d); return Promise.resolve(); },
    place: (x, z, d) => host.NpcPlace(id, x, z, d || ''),
    show: () => host.NpcShow(id, true), hide: () => host.NpcShow(id, false),
    emote: (c) => __esperar(host.NpcEmote(id, c || '!')),
  };
}
const G = {
  state: {
    get starter() { return host.GetS('starter'); }, set starter(v) { host.SetS('starter', v); },
    get rivalStarter() { return host.GetS('rivalStarter'); }, set rivalStarter(v) { host.SetS('rivalStarter', v); },
    get rivalCol() { return host.GetN('rivalCol'); }, set rivalCol(v) { host.SetN('rivalCol', v); },
    get money() { return host.GetN('money'); }, set money(v) { host.SetN('money', v); },
    get badges() { return JSON.parse(host.BadgesJson()); },
    get lastCenter() { return JSON.parse(host.LastCenterJson()); },
    set lastCenter(v) { host.SetLastCenter(v.map, v.x, v.z); },
    get party() { return JSON.parse(host.PartyJson()); },
  },
  get name() { return host.Nome(); },
  say: (t, n, s) => __esperar(host.Say(String(t), n == null ? '' : String(n), s || '')),
  ask: (t, o, n) => __esperar(host.Ask(String(t), o.join('\u0001'), n == null ? '' : String(n))),
  flag: (f) => host.Flag(String(f)),
  set: (f, v = true) => host.SetFlag(String(f), !!v),
  hasBadge: (b) => host.HasBadge(b),
  addBadge: (b) => host.AddBadge(b),
  giveItem: (id, n = 1) => host.GiveItem(id, n),
  takeItem: (id, n = 1) => host.TakeItem(id, n),
  seen: (sp) => host.Seen(sp), caught: (sp) => host.Caught(sp),
  seenCount: () => host.SeenCount(), caughtCount: () => host.CaughtCount(),
  speciesName: (sp) => host.SpeciesName(sp),
  giveCreature: (sp, lvl) => host.GiveCreature(sp, lvl),
  healParty: () => host.HealParty(),
  healScene: () => __esperar(host.HealScene()),
  npc: (id) => __npcObj(id),
  player: {
    get x() { return host.PX(); }, get z() { return host.PZ(); },
    face: (d) => { host.PFace(d); return Promise.resolve(); },
    emote: (c) => __esperar(host.PEmote(c || '!')),
    walk: (d) => __esperar(host.PWalk(d.join(','))),
  },
  refresh: () => host.Refresh(),
  wait: (ms) => __esperar(host.Wait(ms)),
  cry: () => host.Cry(),
  fade: async (fn) => { await __esperar(host.Fade(true)); await fn(); await __esperar(host.Fade(false)); },
  warp: (m, x, z, d, nf) => __esperar(host.Warp(m, x, z, d || 'down', !!nf)),
  shop: (list) => __esperar(host.Shop(list.join(','))),
  showCreature: (sp) => { host.ShowCreature(sp); return Promise.resolve(); },
  hideCreature: () => host.ShowCreature(''),
  wildBattle: (sp, lvl, o = {}) => __esperar(host.WildBattle(sp, lvl, !!o.legendary, o.variant == null ? -1 : o.variant)),
  trainerBattle: async (t) => {
    if (t.intro) await G.say(t.intro, t.name);
    const spec = t.party === 'rivalFinal' ? rivalFinalParty(G) : typeof t.party === 'function' ? t.party(G) : t.party;
    const r = await __esperar(host.TrainerBattle(JSON.stringify({
      name: t.name, look: t.look || '', party: spec, money: t.money || 100, lose: t.lose || '', winText: t.winText || '',
      canLose: !!t.canLose, leader: !!t.leader, rival: !!t.rival })));
    return r === 'win';
  },
  credits: () => __esperar(host.Credits()),
  isBusy: () => false,
};
function __acharNpc(mapa, id) { return ((MAPS[mapa] || {}).npcs || []).find(n => n.id === id); }
function __temTalk(mapa, id) { const d = __acharNpc(mapa, id); return !!(d && typeof d.talk === 'function'); }
function __ehTreinador(mapa, id) { const d = __acharNpc(mapa, id); return !!(d && d.trainer); }
function __visao(mapa, id) { const d = __acharNpc(mapa, id); return d && d.trainer && d.sight ? d.sight : 0; }
function __cond(mapa, id) { const d = __acharNpc(mapa, id); return !d || typeof d.cond !== 'function' ? true : !!d.cond(G); }
function __gatilho(mapa, x, z) {
  const ts = (MAPS[mapa] || {}).triggers || [];
  for (let i = 0; i < ts.length; i++) { const t = ts[i]; if (t.x === x && t.z === z && (!t.cond || t.cond(G))) return i; }
  return -1;
}
function __rodar(fn, id) {
  Promise.resolve().then(() => fn(G)).then(() => host.Fim(id, ''), (e) => host.Fim(id, String((e && e.stack) || e)));
}
function __rodarNpc(mapa, npc, id) { const d = __acharNpc(mapa, npc); __rodar((g) => d.talk(g), id); }
function __rodarGatilho(mapa, i, id) { __rodar(MAPS[mapa].triggers[i].run, id); }
const __DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const __OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
// conversa ou desafio de treinador (trainerFlow / talkTo do main.js)
function __treinador(mapa, id, visto, fim) {
  __rodar(async (g) => {
    const def = __acharNpc(mapa, id);
    const npc = g.npc(id);
    if (!visto && g.flag('tr_' + id)) { await g.say(def.trainer.after || def.trainer.lose || '...', def.trainer.name); return; }
    if (visto) {
      await npc.emote('!');
      const dist = Math.abs(g.player.x - npc.x) + Math.abs(g.player.z - npc.z);
      for (let i = 1; i < dist; i++) await npc.startMove(npc.dir);
      await g.player.face(__OPP[npc.dir]);
    }
    const won = await g.trainerBattle({ ...def.trainer, look: def.look });
    if (won) {
      g.set('tr_' + id);
      if (def.trainer.onWin) await def.trainer.onWin(g);
    }
  }, fim);
}
";
    }

    // Funções que os roteiros chamam (via objeto G). Números do JavaScript chegam como double.
    public class HostJs
    {
        readonly Jogo jogo;
        readonly Historia h;
        public HostJs(Jogo j, Historia hist) { jogo = j; h = hist; }
        Estado E => jogo.Estado;
        Mundo M => jogo.MundoAtual;

        public void Fim(double id, string erro) => h.Terminou((int)id, erro);

        // estado
        public string GetS(string k) => k == "starter" ? E.starter : k == "rivalStarter" ? E.rivalStarter : null;
        public void SetS(string k, string v) { if (k == "starter") E.starter = v; else if (k == "rivalStarter") E.rivalStarter = v; }
        public double GetN(string k) => k == "rivalCol" ? E.rivalCol : k == "money" ? E.money : 0;
        public void SetN(string k, double v) { if (k == "rivalCol") E.rivalCol = (int)v; else if (k == "money") E.money = (int)v; }
        public string BadgesJson() => Newtonsoft.Json.JsonConvert.SerializeObject(E.badges);
        public string LastCenterJson() => Newtonsoft.Json.JsonConvert.SerializeObject(E.lastCenter);
        public void SetLastCenter(string m, double x, double z) => E.lastCenter = new Lugar { map = m, x = (int)x, z = (int)z };
        public string PartyJson() => Newtonsoft.Json.JsonConvert.SerializeObject(E.party.ConvertAll(c => new { c.sp, c.lvl, c.hp }));
        public string Nome() => E.name;
        public bool Flag(string f) => E.Flag(f);
        public void SetFlag(string f, bool v) => E.Marcar(f, v);
        public bool HasBadge(string b) => E.badges.Contains(b);
        public void AddBadge(string b) { if (!E.badges.Contains(b)) { E.badges.Add(b); jogo.Insignia(b); } }
        public void GiveItem(string id, double n) => E.Dar(id, (int)n);
        public void TakeItem(string id, double n) => E.Tirar(id, (int)n);
        public void Seen(string sp) => E.seen.Add(sp);
        public void Caught(string sp) { E.seen.Add(sp); E.caught.Add(sp); }
        public double SeenCount() => E.seen.Count;
        public double CaughtCount() => E.caught.Count;
        public string SpeciesName(string sp) => Dados.Especies.TryGetValue(sp, out var e) ? e.name : sp;
        public string GiveCreature(string sp, double lvl) => E.Adicionar(Criatura.Nova(sp, (int)lvl));
        public void HealParty() => E.CurarEquipe();
        public void Refresh() => M.AtualizarNpcs();
        public void Cry() => Sons.Tocar("cry");
        public void ShowCreature(string sp) => jogo.UI.MostrarCriatura(string.IsNullOrEmpty(sp) ? null : sp);

        // falas e escolhas
        public int Say(string t, string nome, string som)
        {
            if (!string.IsNullOrEmpty(som)) Sons.Tocar(som);
            return h.Esperar(jogo.Dizer(t, string.IsNullOrEmpty(nome) ? null : nome));
        }
        public int Ask(string t, string ops, string nome) => h.Esperar(Caixa(jogo.Perguntar(t, ops.Split('\u0001'), string.IsNullOrEmpty(nome) ? null : nome)));
        static async Task<object> Caixa(Task<int> t) => (double)await t;
        static async Task<object> CaixaS(Task<string> t) => await t;
        public int Wait(double ms) => h.Esperar(Task.Delay((int)ms));
        public int HealScene() => h.Esperar(jogo.CenaCura());
        public int Fade(bool on) => h.Esperar(jogo.UI.Escurecer(on));
        public int Warp(string m, double x, double z, string d, bool semEscurecer) => h.Esperar(jogo.Teleportar(m, (int)x, (int)z, d, semEscurecer));
        public int Shop(string lista) => h.Esperar(jogo.Loja(lista.Split(',')));
        public int Credits() => h.Esperar(jogo.Creditos());
        public int WildBattle(string sp, double lvl, bool lendario, double variante) =>
            h.Esperar(CaixaS(jogo.BatalhaSelvagem(sp, (int)lvl, lendario, variante < 0 ? null : (float?)variante)));
        public int TrainerBattle(string json) => h.Esperar(CaixaS(jogo.BatalhaTreinador(json)));

        // personagens
        Ator Npc(string id) => M.npcs.TryGetValue(id, out var a) ? a : null;
        public double NpcX(string id) => Npc(id)?.x ?? 0;
        public double NpcZ(string id) => Npc(id)?.z ?? 0;
        public string NpcDir(string id) => Npc(id)?.dir ?? "down";
        public void NpcFace(string id, string d) => Npc(id)?.Virar(d);
        public void NpcPlace(string id, double x, double z, string d) => Npc(id)?.Colocar((int)x, (int)z, string.IsNullOrEmpty(d) ? null : d);
        public void NpcShow(string id, bool v) => Npc(id)?.Mostrar(v);
        public int NpcWalk(string id, string dirs) => h.Esperar(Andar(Npc(id), dirs));
        public int NpcEmote(string id, string c) => h.Esperar(jogo.Emote(Npc(id), c));
        public double PX() => jogo.Heroi.x;
        public double PZ() => jogo.Heroi.z;
        public void PFace(string d) => jogo.Heroi.Virar(d);
        public int PEmote(string c) => h.Esperar(jogo.Emote(jogo.Heroi, c));
        public int PWalk(string dirs) => h.Esperar(Andar(jogo.Heroi, dirs));

        static async Task Andar(Ator a, string dirs)
        {
            if (!a) return;
            foreach (var d in dirs.Split(',')) if (d.Length > 0) await a.Andar(d.Trim());
        }
    }
}
