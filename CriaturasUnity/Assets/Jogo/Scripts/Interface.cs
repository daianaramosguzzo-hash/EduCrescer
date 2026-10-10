using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Criaturas
{
    // Interface da primeira etapa (IMGUI, sem arquivos extras): diálogo com efeito de
    // máquina de escrever, escolhas, menu, avisos, nome do lugar, escurecer e título.
    public partial class Interface : MonoBehaviour
    {
        public string nomeJogador = "Cris";

        // diálogo
        string falaNome, falaTexto;
        float falaLetras;
        TaskCompletionSource<bool> falaTcs;
        // escolhas
        string[] opcoes; string opcoesTitulo; int opcaoSel;
        TaskCompletionSource<int> opcoesTcs;
        // avisos
        string aviso; float avisoT;
        string lugar; float lugarT;
        float escuro, escuroAlvo;
        public string carregando;
        // título
        public bool titulo;
        public string nomeDigitado = "";
        public bool temSave;
        public string textoContinuar;
        public System.Action AoNovoJogo, AoContinuar;
        bool confirmarApagar;

        GUIStyle sCaixa, sTexto, sNome, sOpcao, sOpcaoSel, sTitulo, sSub, sBotao, sCampo, sAviso, sLugar, sAjuda;
        Texture2D tBranco;

        public bool Modal => falaTcs != null || opcoesTcs != null || TelaAberta;

        static bool Confirmar() => Controles.A();
        static bool Cancelar() => Controles.B();

        string Fmt(string t) => t.Replace("{N}", nomeJogador).Replace("{R}", "Gael");

        public Task Dizer(string texto, string nome = null)
        {
            falaTcs?.TrySetResult(true);
            falaTexto = Fmt(texto);
            falaNome = nome;
            falaLetras = 0;
            falaTcs = new TaskCompletionSource<bool>();
            esperarSoltar = true;
            return falaTcs.Task;
        }

        public Task<int> Perguntar(string texto, string[] ops, string nome = null)
        {
            falaTexto = Fmt(texto); falaNome = nome; falaLetras = 9999;
            opcoes = ops; opcoesTitulo = null; opcaoSel = 0;
            opcoesTcs = new TaskCompletionSource<int>();
            esperarSoltar = true;
            return opcoesTcs.Task;
        }

        public Task<int> Lista(string titulo, string[] ops, int inicio = 0)
        {
            falaTexto = null;
            opcoes = ops; opcoesTitulo = titulo; opcaoSel = Mathf.Clamp(inicio, 0, ops.Length - 1);
            opcoesTcs = new TaskCompletionSource<int>();
            esperarSoltar = true;
            return opcoesTcs.Task;
        }

        public void EsconderFala() { falaTexto = null; }
        public void Aviso(string t) { aviso = t; avisoT = 2.6f; }
        public void Lugar(string t) { lugar = t; lugarT = 3.2f; }

        public async Task Escurecer(bool sim)
        {
            escuroAlvo = sim ? 1 : 0;
            while (!Mathf.Approximately(escuro, escuroAlvo)) await Task.Yield();
        }
        public void EscuroImediato(bool sim) { escuro = escuroAlvo = sim ? 1 : 0; }

        bool esperarSoltar;

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            escuro = Mathf.MoveTowards(escuro, escuroAlvo, dt * 3.2f);
            if (avisoT > 0) avisoT -= dt;
            if (lugarT > 0) lugarT -= dt;
            // ignora o mesmo aperto que abriu a caixa
            if (esperarSoltar) { esperarSoltar = false; return; }
            if (AtualizarTelas()) return;
            if (opcoesTcs != null)
            {
                var k = Keyboard.current;
                var dv = Controles.DirVirtual; Controles.DirVirtual = null;
                if (dv == "up" || (k != null && (k.upArrowKey.wasPressedThisFrame || k.wKey.wasPressedThisFrame))) opcaoSel = (opcaoSel + opcoes.Length - 1) % opcoes.Length;
                if (dv == "down" || (k != null && (k.downArrowKey.wasPressedThisFrame || k.sKey.wasPressedThisFrame))) opcaoSel = (opcaoSel + 1) % opcoes.Length;
                var sc = Mouse.current?.scroll.ReadValue().y ?? 0;
                if (sc > 0) opcaoSel = (opcaoSel + opcoes.Length - 1) % opcoes.Length;
                if (sc < 0) opcaoSel = (opcaoSel + 1) % opcoes.Length;
                if (Confirmar()) { var t = opcoesTcs; opcoesTcs = null; opcoes = null; falaTexto = null; t.TrySetResult(opcaoSel); }
                else if (Cancelar()) { var t = opcoesTcs; opcoesTcs = null; opcoes = null; falaTexto = null; t.TrySetResult(-1); }
                return;
            }
            if (falaTcs != null)
            {
                falaLetras += dt * 60;
                if (Confirmar() || Cancelar())
                {
                    if (falaLetras < falaTexto.Length) falaLetras = falaTexto.Length;
                    else { var t = falaTcs; falaTcs = null; t.TrySetResult(true); }
                }
            }
        }

        void Estilos()
        {
            if (sCaixa != null) return;
            tBranco = Texture2D.whiteTexture;
            Texture2D Fundo(Color c, Color borda)
            {
                var t = new Texture2D(16, 16) { filterMode = FilterMode.Bilinear };
                for (int y = 0; y < 16; y++) for (int x = 0; x < 16; x++)
                {
                    bool b = x < 2 || y < 2 || x > 13 || y > 13;
                    t.SetPixel(x, y, b ? borda : c);
                }
                t.Apply();
                return t;
            }
            var caixa = Fundo(new Color(0.98f, 0.97f, 0.94f, 1f), new Color(0.16f, 0.13f, 0.2f));
            sCaixa = new GUIStyle { normal = { background = caixa }, border = new RectOffset(4, 4, 4, 4), padding = new RectOffset(28, 28, 22, 22) };
            sTexto = new GUIStyle { fontSize = 30, wordWrap = true, normal = { textColor = new Color(0.16f, 0.13f, 0.2f) } };
            sNome = new GUIStyle { fontSize = 24, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter, normal = { background = Fundo(new Color(0.91f, 0.45f, 0.23f), new Color(0.16f, 0.13f, 0.2f)), textColor = Color.white }, border = new RectOffset(4, 4, 4, 4), padding = new RectOffset(14, 14, 4, 4) };
            sOpcao = new GUIStyle(sTexto) { fontSize = 28, padding = new RectOffset(36, 12, 6, 6) };
            sOpcaoSel = new GUIStyle(sOpcao) { fontStyle = FontStyle.Bold, normal = { textColor = new Color(0.85f, 0.32f, 0.12f) } };
            sTitulo = new GUIStyle { fontSize = 96, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter, normal = { textColor = new Color(1f, 0.82f, 0.25f) } };
            sSub = new GUIStyle { fontSize = 34, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter, normal = { textColor = Color.white } };
            sBotao = new GUIStyle { fontSize = 32, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter, normal = { background = Fundo(new Color(0.91f, 0.45f, 0.23f), new Color(0.35f, 0.15f, 0.08f)), textColor = Color.white }, hover = { background = Fundo(new Color(1f, 0.55f, 0.3f), new Color(0.35f, 0.15f, 0.08f)), textColor = Color.white }, border = new RectOffset(4, 4, 4, 4) };
            sCampo = new GUIStyle(GUI.skin.textField) { fontSize = 32, alignment = TextAnchor.MiddleCenter, normal = { background = caixa, textColor = new Color(0.16f, 0.13f, 0.2f) }, focused = { background = caixa, textColor = new Color(0.16f, 0.13f, 0.2f) }, border = new RectOffset(4, 4, 4, 4) };
            sAviso = new GUIStyle { fontSize = 26, alignment = TextAnchor.MiddleCenter, normal = { background = Fundo(new Color(0.1f, 0.08f, 0.13f, 0.88f), new Color(0.1f, 0.08f, 0.13f, 0.88f)), textColor = Color.white }, padding = new RectOffset(20, 20, 10, 10) };
            sLugar = new GUIStyle { fontSize = 34, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleLeft, normal = { background = Fundo(new Color(0.98f, 0.97f, 0.94f, 0.95f), new Color(0.16f, 0.13f, 0.2f)), textColor = new Color(0.16f, 0.13f, 0.2f) }, border = new RectOffset(4, 4, 4, 4), padding = new RectOffset(24, 24, 8, 8) };
            sAjuda = new GUIStyle { fontSize = 22, alignment = TextAnchor.MiddleCenter, wordWrap = true, normal = { textColor = new Color(1, 1, 1, 0.85f) } };
        }

        void OnGUI()
        {
            Estilos();
            // tudo desenhado numa tela virtual de 1920 de largura
            float s = Screen.width / 1920f;
            float h = Screen.height / s;
            GUI.matrix = Matrix4x4.Scale(new Vector3(s, s, 1));

            if (titulo) Titulo(h);
            DesenharTelas(h);
            if (lugarT > 0)
            {
                float a = Mathf.Clamp01(lugarT * 2) * Mathf.Clamp01((3.2f - lugarT) * 3);
                GUI.color = new Color(1, 1, 1, a);
                GUI.Box(new Rect(40 - (1 - a) * 60, 40, 560, 70), lugar, sLugar);
                GUI.color = Color.white;
            }
            if (avisoT > 0)
            {
                GUI.color = new Color(1, 1, 1, Mathf.Clamp01(avisoT * 3));
                var sz = sAviso.CalcSize(new GUIContent(aviso));
                GUI.Box(new Rect(960 - sz.x / 2, 40, sz.x, 56), aviso, sAviso);
                GUI.color = Color.white;
            }
            if (falaTexto != null)
            {
                var r = new Rect(160, h - 250, 1600, 210);
                GUI.Box(r, GUIContent.none, sCaixa);
                int n = Mathf.Min(falaTexto.Length, (int)falaLetras);
                GUI.Label(new Rect(r.x + 32, r.y + 34, r.width - 64, r.height - 50), falaTexto.Substring(0, n), sTexto);
                if (!string.IsNullOrEmpty(falaNome))
                {
                    var sz = sNome.CalcSize(new GUIContent(falaNome));
                    GUI.Box(new Rect(r.x + 30, r.y - 22, sz.x, 42), falaNome, sNome);
                }
                if (n >= falaTexto.Length && falaTcs != null && Mathf.Repeat(Time.time, 0.8f) < 0.5f)
                    GUI.Label(new Rect(r.xMax - 60, r.yMax - 56, 40, 40), "▼", sTexto);
            }
            if (opcoes != null)
            {
                float lh = 52, w = 520;
                float hh = opcoes.Length * lh + 44 + (opcoesTitulo != null ? 50 : 0);
                var r = falaTexto != null ? new Rect(1760 - w, h - 270 - hh, w, hh) : new Rect(1880 - w, 40, w, hh);
                GUI.Box(r, GUIContent.none, sCaixa);
                float y = r.y + 22;
                if (opcoesTitulo != null) { GUI.Label(new Rect(r.x + 28, y, w - 56, 44), opcoesTitulo, new GUIStyle(sTexto) { fontStyle = FontStyle.Bold }); y += 50; }
                for (int i = 0; i < opcoes.Length; i++)
                {
                    var lr = new Rect(r.x + 10, y + i * lh, w - 20, lh);
                    if (lr.Contains(Event.current.mousePosition) && Event.current.type == EventType.MouseMove) opcaoSel = i;
                    GUI.Label(lr, (i == opcaoSel ? "▶ " : "   ") + opcoes[i], i == opcaoSel ? sOpcaoSel : sOpcao);
                }
            }
            if (!string.IsNullOrEmpty(carregando))
                GUI.Label(new Rect(0, h - 90, 1880, 60), carregando, new GUIStyle(sSub) { alignment = TextAnchor.MiddleRight });
            if (escuro > 0.001f)
            {
                GUI.color = new Color(0, 0, 0, escuro);
                GUI.DrawTexture(new Rect(0, 0, 1920, h), tBranco);
                GUI.color = Color.white;
            }
        }

        void Titulo(float h)
        {
            GUI.color = new Color(0, 0, 0, 0.25f);
            GUI.DrawTexture(new Rect(0, 0, 1920, h), tBranco);
            GUI.color = Color.white;
            float y = h * 0.12f;
            var sombra = new GUIStyle(sTitulo) { normal = { textColor = new Color(0.25f, 0.1f, 0.05f) } };
            GUI.Label(new Rect(6, y + 6, 1920, 110), "CRIATURAS", sombra);
            GUI.Label(new Rect(0, y, 1920, 110), "CRIATURAS", sTitulo);
            GUI.Label(new Rect(4, y + 104, 1920, 80), "IMAGINÁRIAS", new GUIStyle(sombra) { fontSize = 64 });
            GUI.Label(new Rect(0, y + 100, 1920, 80), "IMAGINÁRIAS", new GUIStyle(sTitulo) { fontSize = 64 });
            GUI.Label(new Rect(0, y + 180, 1920, 50), "criação Arthur Guzzo", sSub);
            GUI.Label(new Rect(0, y + 228, 1920, 40), "versão Unity · etapa 1", new GUIStyle(sAjuda) { fontSize = 24 });

            float cy = Mathf.Min(h * 0.55f, h - 430);
            GUI.Label(new Rect(0, cy, 1920, 44), "Nome do herói", sSub);
            GUI.SetNextControlName("nome");
            nomeDigitado = GUI.TextField(new Rect(760, cy + 50, 400, 64), nomeDigitado, 10, sCampo);
            if (GUI.Button(new Rect(760, cy + 140, 400, 72), confirmarApagar ? "Apagar save? Clique de novo" : "Novo Jogo", sBotao))
            {
                if (temSave && !confirmarApagar) confirmarApagar = true;
                else AoNovoJogo?.Invoke();
            }
            if (temSave && GUI.Button(new Rect(660, cy + 232, 600, 72), textoContinuar ?? "Continuar", sBotao)) AoContinuar?.Invoke();
            GUI.Label(new Rect(360, h - 100, 1200, 60), "Setas/WASD: andar · Z/Espaço/clique: interagir · X/botão direito: correr · Esc: menu · mouse: girar a câmera", sAjuda);
        }
    }
}
