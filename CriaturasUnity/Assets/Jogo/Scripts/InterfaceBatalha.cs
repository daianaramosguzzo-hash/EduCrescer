using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Criaturas
{
    // Telas da etapa 2: painéis de PV da batalha, menus em grade, equipe, bolsa,
    // faixa de "VS", prévia 3D de criatura e créditos.
    public partial class Interface
    {
        public HudBatalha hud;

        enum Tela { Nenhuma, Grade, Equipe, Bolsa, Creditos }
        Tela tela;
        int sel;
        string telaTitulo;
        string[] gradeOps; int gradeCols; bool gradeCancela; Color[] gradeCores; bool[] gradeDesab; Func<int, string> gradeDesc;
        List<Criatura> equipeLista;
        List<string> bolsaIds;
        TaskCompletionSource<int> telaTcs;
        string versusNome, versusSub; float versusT;
        string previewNome; RenderTexture previewRt; Camera previewCam; Transform previewRaiz;
        string creditosTexto; float creditosT;

        bool TelaAberta => telaTcs != null;

        Task<int> AbrirTela(Tela t, string titulo, int inicio)
        {
            tela = t; telaTitulo = titulo; sel = inicio;
            telaTcs = new TaskCompletionSource<int>();
            esperarSoltar = true;
            return telaTcs.Task;
        }

        void FecharTela(int r)
        {
            var t = telaTcs; telaTcs = null; tela = Tela.Nenhuma;
            Sons.Tocar(r >= 0 ? "select" : "back");
            t?.TrySetResult(r);
        }

        // ---------------------------------------------- APIs
        public Task<int> Grade(string titulo, string[] ops, int colunas, int inicio, bool cancelavel, Color[] cores = null, bool[] desab = null, Func<int, string> desc = null)
        {
            gradeOps = ops; gradeCols = colunas; gradeCancela = cancelavel; gradeCores = cores; gradeDesab = desab; gradeDesc = desc;
            return AbrirTela(Tela.Grade, titulo, Mathf.Clamp(inicio, 0, ops.Length - 1));
        }

        public Task<int> TelaEquipe(List<Criatura> lista, string titulo, bool cancelavel)
        {
            equipeLista = lista; gradeCancela = cancelavel;
            return AbrirTela(Tela.Equipe, titulo, 0);
        }

        public async Task<string> TelaBolsa(Dictionary<string, int> bolsa, Func<Item, bool> filtro = null)
        {
            bolsaIds = bolsa.Where(kv => kv.Value > 0 && Dados.Item(kv.Key) != null && (filtro == null || filtro(Dados.Item(kv.Key)))).Select(kv => kv.Key).ToList();
            bolsaQtd = bolsa;
            gradeCancela = true;
            int r = await AbrirTela(Tela.Bolsa, "Bolsa", 0);
            return r >= 0 && r < bolsaIds.Count ? bolsaIds[r] : null;
        }
        Dictionary<string, int> bolsaQtd;

        float flash;
        // clarão branco antes da batalha
        public async Task Piscar()
        {
            for (int i = 0; i < 3; i++) { flash = 1; await Arena.Esperar(150); flash = 0; await Arena.Esperar(100); }
        }

        public async Task Versus(string nome, string sub)
        {
            versusNome = nome; versusSub = sub; versusT = 0;
            Sons.Tocar("encounter");
            await Arena.Esperar(1700);
            versusNome = null;
        }

        public async Task Creditos(string texto)
        {
            creditosTexto = texto; creditosT = 0;
            await AbrirTela(Tela.Creditos, "", 0);
            creditosTexto = null;
        }

        // prévia 3D (escolha do parceiro, Criaturadex): câmera própria desenhando numa textura
        public async void MostrarCriatura(string sp)
        {
            previewNome = sp == null ? null : (Dados.Especies.TryGetValue(sp, out var e) ? e.name : sp);
            if (previewRaiz) Destroy(previewRaiz.gameObject);
            if (sp == null) { if (previewCam) previewCam.enabled = false; return; }
            if (!previewRt) previewRt = new RenderTexture(512, 512, 24) { antiAliasing = 4 };
            var origem = new Vector3(0, 0, -4000);
            if (!previewCam)
            {
                previewCam = new GameObject("câmera da prévia").AddComponent<Camera>();
                previewCam.targetTexture = previewRt;
                previewCam.clearFlags = CameraClearFlags.SolidColor;
                previewCam.backgroundColor = Dados.Cor("#eaf4ff");
                previewCam.fieldOfView = 35;
            }
            previewCam.enabled = true;
            previewRaiz = new GameObject("prévia").transform;
            previewRaiz.position = origem;
            var (m, an) = await Mundo.CriarCriatura(sp, previewRaiz, null);
            if (!previewRaiz) return;
            // enquadra pelo tamanho real do modelo: centraliza no eixo de giro e afasta a câmera
            var b = m ? Modelos.Limites(m) : new Bounds(origem + Vector3.up * 0.5f, Vector3.one);
            if (m) m.transform.position += new Vector3(origem.x - b.center.x, 0, origem.z - b.center.z);
            float tam = Mathf.Max(b.size.y, Mathf.Max(b.size.x, b.size.z) * 0.8f, 0.3f);
            var alvo = origem + Vector3.up * (b.center.y - origem.y);
            previewCam.transform.position = alvo + new Vector3(0, tam * 0.35f, tam * 2.6f + 0.6f);
            previewCam.transform.LookAt(alvo);
            previewRaiz.gameObject.AddComponent<Girar>().an = an;
        }

        class Girar : MonoBehaviour
        {
            public IAnimador an;
            void Update() { transform.Rotate(0, -Time.deltaTime * 46, 0); an?.Atualizar(Time.deltaTime, false, 1); }
        }

        // ---------------------------------------------- teclado e mouse das telas
        bool AtualizarTelas()
        {
            if (!TelaAberta) return false;
            var k = Keyboard.current;
            var dv = Controles.DirVirtual;
            bool cima = dv == "up" || (k != null && (k.upArrowKey.wasPressedThisFrame || k.wKey.wasPressedThisFrame));
            bool baixo = dv == "down" || (k != null && (k.downArrowKey.wasPressedThisFrame || k.sKey.wasPressedThisFrame));
            bool esq = dv == "left" || (k != null && (k.leftArrowKey.wasPressedThisFrame || k.aKey.wasPressedThisFrame));
            bool dir = dv == "right" || (k != null && (k.rightArrowKey.wasPressedThisFrame || k.dKey.wasPressedThisFrame));
            if (dv != null) Controles.DirVirtual = null;
            int n = tela switch { Tela.Grade => gradeOps.Length, Tela.Equipe => equipeLista.Count, Tela.Bolsa => bolsaIds.Count + 1, _ => 1 };
            if (tela == Tela.Creditos)
            {
                creditosT += Time.unscaledDeltaTime;
                if (creditosT > 4 && (Controles.A(true) || Controles.B())) FecharTela(0);
                return true;
            }
            int cols = tela == Tela.Grade ? gradeCols : 1;
            int antes = sel;
            if (cima) sel -= cols;
            if (baixo) sel += cols;
            if (cols > 1 && esq) sel -= 1;
            if (cols > 1 && dir) sel += 1;
            sel = (sel % n + n) % n;
            if (sel != antes) Sons.Tocar("move");
            if (Controles.A(false))
            {
                if (tela == Tela.Grade && gradeDesab != null && gradeDesab[sel]) Sons.Tocar("bump");
                else if (tela == Tela.Bolsa && sel == bolsaIds.Count) FecharTela(-1);
                else FecharTela(sel);
            }
            else if (Controles.B() && gradeCancela) FecharTela(-1);
            return true;
        }

        // clique do mouse numa opção
        void Clicar(Rect r, int i)
        {
            var ev = Event.current;
            if (!r.Contains(ev.mousePosition)) return;
            if (ev.type == EventType.MouseMove) sel = i;
            if (ev.type == EventType.MouseDown && ev.button == 0)
            {
                sel = i;
                if (tela == Tela.Grade && gradeDesab != null && gradeDesab[i]) return;
                if (tela == Tela.Bolsa && i == bolsaIds.Count) { FecharTela(-1); ev.Use(); return; }
                FecharTela(i);
                ev.Use();
            }
        }

        // ---------------------------------------------- desenho
        GUIStyle sHud, sHudPeq, sBotaoGrade, sTituloTela;
        Texture2D tPreto;

        void EstilosBatalha()
        {
            if (sHud != null) return;
            sHud = new GUIStyle(sTexto) { fontSize = 30, fontStyle = FontStyle.Bold };
            sHudPeq = new GUIStyle(sTexto) { fontSize = 22 };
            sBotaoGrade = new GUIStyle(sTexto) { fontSize = 30, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleLeft, richText = true, padding = new RectOffset(26, 10, 6, 6) };
            sTituloTela = new GUIStyle(sTexto) { fontSize = 34, fontStyle = FontStyle.Bold };
            tPreto = new Texture2D(1, 1); tPreto.SetPixel(0, 0, Color.white); tPreto.Apply();
        }

        static Color CorPv(float p) => p > 0.5f ? Dados.Cor("#3ad06a") : p > 0.2f ? Dados.Cor("#f0c030") : Dados.Cor("#e84a3a");

        void Barra(Rect r, float p, Color cor)
        {
            GUI.color = new Color(0.16f, 0.13f, 0.2f); GUI.DrawTexture(r, tPreto);
            var i = new Rect(r.x + 3, r.y + 3, r.width - 6, r.height - 6);
            GUI.color = new Color(0.85f, 0.85f, 0.85f); GUI.DrawTexture(i, tPreto);
            GUI.color = cor; GUI.DrawTexture(new Rect(i.x, i.y, i.width * Mathf.Clamp01(p), i.height), tPreto);
            GUI.color = Color.white;
        }

        void DesenharTelas(float h)
        {
            Estilos(); EstilosBatalha();
            if (hud != null)
            {
                if (hud.mostraInimigo && hud.inimigo != null)
                {
                    var r = new Rect(60, 50, 620, 140);
                    GUI.Box(r, GUIContent.none, sCaixa);
                    GUI.Label(new Rect(r.x + 28, r.y + 18, 420, 40), hud.inimigo.Nome + (hud.capturado ? "  <color=#e03a3a>●</color>" : ""), new GUIStyle(sHud) { richText = true });
                    GUI.Label(new Rect(r.xMax - 170, r.y + 18, 150, 40), $"Nv. {hud.inimigo.lvl}", sHud);
                    float p = hud.pvInimigo / Mathf.Max(1, hud.inimigo.maxhp);
                    GUI.Label(new Rect(r.x + 28, r.y + 76, 60, 36), "PV", sHud);
                    Barra(new Rect(r.x + 90, r.y + 82, r.width - 130, 26), p, CorPv(p));
                    if (hud.equipeInimiga != null)
                        for (int i = 0; i < hud.equipeInimiga.Count; i++)
                        {
                            GUI.color = hud.equipeInimiga[i].hp > 0 ? Dados.Cor("#e03a3a") : new Color(0.5f, 0.5f, 0.5f);
                            GUI.DrawTexture(new Rect(r.x + 30 + i * 34, r.yMax + 10, 26, 26), tPreto);
                            GUI.color = Color.white;
                        }
                }
                if (hud.mostraAliado && hud.aliado != null)
                {
                    var c = hud.aliado;
                    var r = new Rect(1240, h - 470, 620, 190);
                    GUI.Box(r, GUIContent.none, sCaixa);
                    GUI.Label(new Rect(r.x + 28, r.y + 16, 420, 40), c.Nome, sHud);
                    GUI.Label(new Rect(r.xMax - 170, r.y + 16, 150, 40), $"Nv. {c.lvl}", sHud);
                    float p = hud.pvAliado / Mathf.Max(1, c.maxhp);
                    GUI.Label(new Rect(r.x + 28, r.y + 70, 60, 36), "PV", sHud);
                    Barra(new Rect(r.x + 90, r.y + 76, r.width - 130, 26), p, CorPv(p));
                    GUI.Label(new Rect(r.xMax - 260, r.y + 108, 230, 36), $"{Mathf.Max(0, Mathf.CeilToInt(hud.pvAliado))} / {c.maxhp}", new GUIStyle(sHud) { alignment = TextAnchor.MiddleRight });
                    int xa = Criatura.XpDoNivel(c.lvl), xb = Criatura.XpDoNivel(c.lvl + 1);
                    Barra(new Rect(r.x + 90, r.y + 150, r.width - 130, 16), (c.xp - xa) / (float)Mathf.Max(1, xb - xa), Dados.Cor("#4aa0f0"));
                }
            }
            if (versusNome != null)
            {
                versusT += Time.unscaledDeltaTime;
                float a = Mathf.Clamp01(versusT * 4);
                GUI.color = new Color(0.1f, 0.06f, 0.14f, 0.88f * a);
                GUI.DrawTexture(new Rect(0, h * 0.32f, 1920, h * 0.36f), tPreto);
                GUI.color = new Color(1, 1, 1, a);
                GUI.Label(new Rect(-400 + 400 * a, h * 0.38f, 1920, 60), versusSub, new GUIStyle(sSub) { fontSize = 34, normal = { textColor = Dados.Cor("#ffd23a") } });
                GUI.Label(new Rect(400 - 400 * a, h * 0.45f, 1920, 110), versusNome, new GUIStyle(sTitulo) { fontSize = 84 });
                GUI.color = Color.white;
            }
            if (previewNome != null && previewRt)
            {
                // à esquerda, para não cobrir as opções de resposta (que ficam à direita)
                var r = new Rect(60, 60, 500, 560);
                GUI.Box(r, GUIContent.none, sCaixa);
                GUI.DrawTexture(new Rect(r.x + 20, r.y + 20, 460, 460), previewRt);
                GUI.Label(new Rect(r.x, r.yMax - 76, r.width, 50), previewNome, new GUIStyle(sTituloTela) { alignment = TextAnchor.MiddleCenter });
            }
            if (flash > 0) { GUI.color = new Color(1, 1, 1, 0.85f); GUI.DrawTexture(new Rect(0, 0, 1920, h), tPreto); GUI.color = Color.white; }
            if (!TelaAberta) { if (creditosTexto != null) Creditos(h); return; }
            switch (tela)
            {
                case Tela.Grade: DesenharGrade(h); break;
                case Tela.Equipe: DesenharEquipe(h); break;
                case Tela.Bolsa: DesenharBolsa(h); break;
                case Tela.Creditos: Creditos(h); break;
            }
        }

        void DesenharGrade(float h)
        {
            int linhas = Mathf.CeilToInt(gradeOps.Length / (float)gradeCols);
            float lh = gradeOps.Any(o => o.Contains("\n")) ? 96 : 70;
            float w = gradeCols == 2 ? 860 : 520;
            var caixa = new Rect(1860 - w, h - 60 - linhas * lh - 40, w, linhas * lh + 40);
            // título (o que fazer?) numa caixa ao lado
            var tit = new Rect(60, caixa.y, 1860 - w - 80, caixa.height);
            GUI.Box(tit, GUIContent.none, sCaixa);
            string texto = telaTitulo;
            if (gradeDesc != null) texto += "\n\n" + gradeDesc(sel);
            GUI.Label(new Rect(tit.x + 32, tit.y + 26, tit.width - 64, tit.height - 40), Fmt(texto), sTexto);
            GUI.Box(caixa, GUIContent.none, sCaixa);
            for (int i = 0; i < gradeOps.Length; i++)
            {
                int c = i % gradeCols, l = i / gradeCols;
                var r = new Rect(caixa.x + 16 + c * ((w - 32) / gradeCols), caixa.y + 20 + l * lh, (w - 32) / gradeCols, lh);
                Clicar(r, i);
                bool des = gradeDesab != null && gradeDesab[i];
                if (gradeCores != null)
                {
                    GUI.color = gradeCores[i] * (des ? 0.5f : 1);
                    GUI.DrawTexture(new Rect(r.x + 4, r.y + 8, 10, r.height - 16), tPreto);
                    GUI.color = Color.white;
                }
                var st = new GUIStyle(sBotaoGrade) { normal = { textColor = des ? new Color(0.6f, 0.6f, 0.6f) : i == sel ? Dados.Cor("#d85020") : new Color(0.16f, 0.13f, 0.2f) } };
                GUI.Label(r, (i == sel ? "▶ " : "   ") + gradeOps[i], st);
            }
        }

        void DesenharEquipe(float h)
        {
            GUI.color = new Color(0, 0, 0, 0.55f); GUI.DrawTexture(new Rect(0, 0, 1920, h), tPreto); GUI.color = Color.white;
            var caixa = new Rect(260, 60, 1400, h - 120);
            GUI.Box(caixa, GUIContent.none, sCaixa);
            GUI.Label(new Rect(caixa.x + 40, caixa.y + 24, 1000, 50), telaTitulo, sTituloTela);
            float lh = Mathf.Min(130, (caixa.height - 140) / 6);
            for (int i = 0; i < equipeLista.Count; i++)
            {
                var c = equipeLista[i];
                var r = new Rect(caixa.x + 40, caixa.y + 100 + i * lh, caixa.width - 80, lh - 12);
                Clicar(r, i);
                GUI.color = i == sel ? Dados.Cor("#ffe8c8") : new Color(0.93f, 0.92f, 0.9f);
                GUI.DrawTexture(r, tPreto); GUI.color = Color.white;
                string tipos = string.Join("/", c.Especie.types.Select(Tipos.Nome));
                GUI.Label(new Rect(r.x + 24, r.y + 10, 600, 44), (i == sel ? "▶ " : "") + c.Nome, sHud);
                GUI.Label(new Rect(r.x + 24, r.y + 52, 600, 36), $"Nv. {c.lvl} · {tipos}" + (c.hp <= 0 ? " · DESMAIADO" : ""), sHudPeq);
                float p = c.hp / Mathf.Max(1, c.maxhp);
                Barra(new Rect(r.x + 640, r.y + 22, 480, 26), p, CorPv(p));
                GUI.Label(new Rect(r.x + 640, r.y + 52, 480, 36), $"PV {Mathf.CeilToInt(c.hp)} / {c.maxhp}", new GUIStyle(sHudPeq) { alignment = TextAnchor.MiddleRight });
            }
            if (gradeCancela) GUI.Label(new Rect(caixa.x + 40, caixa.yMax - 50, 900, 40), "X / botão direito: voltar", sHudPeq);
        }

        void DesenharBolsa(float h)
        {
            GUI.color = new Color(0, 0, 0, 0.55f); GUI.DrawTexture(new Rect(0, 0, 1920, h), tPreto); GUI.color = Color.white;
            var caixa = new Rect(360, 60, 1200, h - 120);
            GUI.Box(caixa, GUIContent.none, sCaixa);
            GUI.Label(new Rect(caixa.x + 40, caixa.y + 24, 1000, 50), "Bolsa", sTituloTela);
            float lh = 62;
            for (int i = 0; i <= bolsaIds.Count; i++)
            {
                var r = new Rect(caixa.x + 40, caixa.y + 100 + i * lh, caixa.width - 80, lh - 8);
                Clicar(r, i);
                string nome = i == bolsaIds.Count ? "FECHAR" : Dados.Item(bolsaIds[i]).name;
                string qtd = i == bolsaIds.Count ? "" : "× " + (bolsaQtd.TryGetValue(bolsaIds[i], out var q) ? q : 0);
                var st = new GUIStyle(sHud) { normal = { textColor = i == sel ? Dados.Cor("#d85020") : new Color(0.16f, 0.13f, 0.2f) } };
                GUI.Label(r, (i == sel ? "▶ " : "   ") + nome, st);
                GUI.Label(r, qtd, new GUIStyle(st) { alignment = TextAnchor.MiddleRight });
            }
            if (sel < bolsaIds.Count)
                GUI.Label(new Rect(caixa.x + 40, caixa.yMax - 110, caixa.width - 80, 90), Dados.Item(bolsaIds[sel]).desc, sTexto);
        }

        void Creditos(float h)
        {
            GUI.color = new Color(0.05f, 0.03f, 0.08f, 0.96f); GUI.DrawTexture(new Rect(0, 0, 1920, h), tPreto); GUI.color = Color.white;
            float y = h - creditosT * 60;
            GUI.Label(new Rect(0, y, 1920, 4000), Fmt(creditosTexto), new GUIStyle(sSub) { fontSize = 36, alignment = TextAnchor.UpperCenter, wordWrap = true, richText = true });
        }
    }
}
