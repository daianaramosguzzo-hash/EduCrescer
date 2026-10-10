using System;
using System.Collections.Generic;
using UnityEngine;

namespace Criaturas
{
    // Sintetizador chiptune (port do js/audio.js): ondas quadrada, triangular e dente-de-serra
    // com decaimento exponencial, ruído, efeitos e músicas originais, gerados em tempo real.
    [RequireComponent(typeof(AudioSource))]
    public class Sintetizador : MonoBehaviour
    {
        public static Sintetizador Atual;
        public static bool Ligado = true;
        int taxa;
        double tempo; // segundos de áudio já gerados (relógio do sintetizador)

        struct Voz { public double ini, dur; public float freq, slide, vol; public int onda; public bool musica; public uint semente; }
        readonly List<Voz> vozes = new();
        readonly List<Voz> novas = new();
        readonly object trava = new();

        void Awake()
        {
            Atual = this;
            taxa = AudioSettings.outputSampleRate;
            var src = GetComponent<AudioSource>();
            src.playOnAwake = true;
            src.spatialBlend = 0;
            src.loop = true;
            src.Play();
        }

        public double Agora { get { lock (trava) return tempo; } }

        // onda: 0 quadrada, 1 triangular, 2 dente-de-serra, 3 ruído
        public void Tom(float freq, double em, float dur, int onda, float vol, float slide = 0, bool musica = false)
        {
            lock (trava) novas.Add(new Voz { freq = freq, ini = em, dur = dur, onda = onda, vol = vol, slide = slide, musica = musica, semente = (uint)UnityEngine.Random.Range(1, int.MaxValue) });
        }

        void OnAudioFilterRead(float[] dados, int canais)
        {
            lock (trava) { vozes.AddRange(novas); novas.Clear(); }
            int n = dados.Length / canais;
            double dt = 1.0 / taxa;
            float mestre = Ligado ? 0.5f : 0;
            for (int i = 0; i < n; i++)
            {
                double t = tempo + i * dt;
                float s = 0;
                for (int v = 0; v < vozes.Count; v++)
                {
                    var vz = vozes[v];
                    double k = t - vz.ini;
                    if (k < 0 || k > vz.dur + 0.02) continue;
                    float p = (float)(k / vz.dur);
                    float f = vz.slide > 0 ? vz.freq * Mathf.Pow(Mathf.Max(0.01f, vz.slide), p) : vz.freq;
                    // decaimento exponencial até ~0.0008 (como exponentialRampToValueAtTime)
                    float amp = vz.vol * Mathf.Pow(0.0008f / Mathf.Max(0.0001f, vz.vol), Mathf.Clamp01(p));
                    float fase = (float)(k * f % 1.0);
                    float o;
                    switch (vz.onda)
                    {
                        case 0: o = fase < 0.5f ? 1 : -1; break;
                        case 1: o = 1 - 4 * Mathf.Abs(fase - 0.5f); break;
                        case 2: o = 2 * fase - 1; break;
                        default:
                            vz.semente ^= vz.semente << 13; vz.semente ^= vz.semente >> 17; vz.semente ^= vz.semente << 5;
                            vozes[v] = vz;
                            o = (vz.semente / (float)uint.MaxValue * 2 - 1) * (1 - p);
                            amp = vz.vol;
                            break;
                    }
                    s += o * amp * (vz.musica ? 0.55f : 1);
                }
                s = Mathf.Clamp(s * mestre, -1, 1);
                for (int c = 0; c < canais; c++) dados[i * canais + c] = s;
            }
            lock (trava)
            {
                tempo += n * dt;
                vozes.RemoveAll(v => tempo > v.ini + v.dur + 0.05);
            }
        }

        void Update() => Musica.Atualizar();
    }

    public static class Sons
    {
        static float Hz(int n) => 440f * Mathf.Pow(2, (n - 69) / 12f);

        public static void Tocar(string nome)
        {
            var s = Sintetizador.Atual;
            if (!s || !Sintetizador.Ligado) return;
            double t = s.Agora + 0.03;
            void T(float f, double em, float d, int onda, float v, float sl = 0) => s.Tom(f, em, d, onda, v, sl);
            void R(double em, float d, float v) => s.Tom(0, em, d, 3, v);
            switch (nome)
            {
                case "text": T(1400, t, 0.02f, 0, 0.015f); break;
                case "move": T(900, t, 0.04f, 0, 0.04f); break;
                case "select": T(1200, t, 0.05f, 0, 0.05f); T(1800, t + 0.04, 0.06f, 0, 0.04f); break;
                case "back": T(700, t, 0.06f, 0, 0.05f); break;
                case "bump": T(120, t, 0.08f, 0, 0.08f); break;
                case "door": R(t, 0.12f, 0.08f); T(300, t, 0.12f, 1, 0.1f, 0.5f); break;
                case "hit": R(t, 0.15f, 0.25f); T(200, t, 0.12f, 0, 0.1f, 0.4f); break;
                case "superhit": R(t, 0.3f, 0.35f); T(300, t, 0.25f, 2, 0.12f, 0.3f); break;
                case "weakhit": R(t, 0.08f, 0.12f); break;
                case "faint": T(600, t, 0.6f, 0, 0.08f, 0.2f); break;
                case "throw": T(500, t, 0.3f, 1, 0.1f, 2.5f); break;
                case "shake": T(220, t, 0.08f, 0, 0.08f); T(180, t + 0.1, 0.08f, 0, 0.08f); break;
                case "catch": { var ns = new[] { 72, 76, 79, 84 }; for (int i = 0; i < ns.Length; i++) T(Hz(ns[i]), t + i * 0.1, 0.15f, 0, 0.07f); break; }
                case "stat": { var ns = new[] { 60, 64, 67 }; for (int i = 0; i < 3; i++) T(Hz(ns[i] + 12), t + i * 0.05, 0.08f, 0, 0.05f); break; }
                case "statdown": { var ns = new[] { 67, 64, 60 }; for (int i = 0; i < 3; i++) T(Hz(ns[i]), t + i * 0.05, 0.08f, 0, 0.05f); break; }
                case "heal": { var ns = new[] { 72, 76, 79, 76, 84 }; for (int i = 0; i < ns.Length; i++) T(Hz(ns[i]), t + i * 0.13, 0.2f, 1, 0.1f); break; }
                case "levelup": { var ns = new[] { 67, 71, 74, 79 }; for (int i = 0; i < 4; i++) T(Hz(ns[i]), t + i * 0.09, 0.14f, 0, 0.06f); T(Hz(83), t + 0.36, 0.4f, 0, 0.06f); break; }
                case "fanfare": { var ns = new[] { 60, 64, 67, 72, 67, 72, 76 }; for (int i = 0; i < ns.Length; i++) T(Hz(ns[i] + 7), t + i * 0.12, 0.2f, 0, 0.06f); break; }
                case "badge": { var ns = new[] { 72, 72, 72, 76, 79, 76, 79, 84 }; for (int i = 0; i < ns.Length; i++) T(Hz(ns[i]), t + i * 0.14, 0.22f, 0, 0.06f); break; }
                case "encounter": for (int i = 0; i < 8; i++) T(Hz(60 + (i % 2 == 1 ? 7 : 0) + i), t + i * 0.05, 0.06f, 0, 0.05f); break;
                case "run": R(t, 0.2f, 0.1f); break;
                case "buy": T(1500, t, 0.08f, 0, 0.05f); T(2000, t + 0.08, 0.12f, 0, 0.05f); break;
                case "evolve": for (int i = 0; i < 12; i++) T(Hz(60 + i * 2), t + i * 0.08, 0.1f, 1, 0.08f); break;
                case "thunder": R(t, 1.4f, 0.3f); T(60, t, 1.2f, 2, 0.08f, 0.5f); break;
                case "cry": T(500 + UnityEngine.Random.value * 400, t, 0.25f, 2, 0.06f, 0.6f); T(700, t + 0.12, 0.2f, 0, 0.04f, 1.4f); break;
            }
        }
    }

    // Músicas: cada tema tem bpm, melodia e baixo em notas MIDI (0 = pausa); um passo = colcheia
    public static class Musica
    {
        const int R = 0;
        class Tema { public int bpm; public int[] mel, bass; }
        static readonly Dictionary<string, Tema> TEMAS = new()
        {
            ["title"] = new Tema { bpm = 112, mel = new[] { 67, R, 72, 74, 76, R, 74, 72, 74, R, 67, R, 69, 71, 72, R, 64, R, 69, 71, 72, R, 71, 69, 71, R, 74, R, 72, R, R, R }, bass = new[] { 48, 55, 48, 55, 43, 50, 43, 50, 45, 52, 45, 52, 43, 50, 43, 50 } },
            ["home"] = new Tema { bpm = 96, mel = new[] { 72, R, 76, R, 79, R, 76, R, 77, R, 74, R, 72, R, R, R, 69, R, 72, R, 76, R, 74, R, 72, R, 71, R, 72, R, R, R }, bass = new[] { 48, R, 55, R, 53, R, 55, R, 45, R, 52, R, 43, R, 50, R } },
            ["town"] = new Tema { bpm = 104, mel = new[] { 76, 79, 84, 79, 81, 79, 76, R, 77, 81, 86, 81, 79, R, R, R, 76, 79, 84, 88, 86, 84, 81, R, 77, 76, 74, 76, 72, R, R, R }, bass = new[] { 48, R, 55, R, 45, R, 52, R, 41, R, 48, R, 43, R, 50, R } },
            ["route"] = new Tema { bpm = 132, mel = new[] { 72, 72, 79, R, 77, 76, 74, R, 76, 77, 79, 81, 79, R, 74, R, 72, 72, 79, R, 81, 79, 77, 76, 74, 76, 77, 74, 72, R, R, R }, bass = new[] { 48, 55, 48, 55, 41, 48, 41, 48, 43, 50, 43, 50, 48, 55, 43, 47 } },
            ["city"] = new Tema { bpm = 118, mel = new[] { 79, R, 76, 77, 79, R, 84, R, 83, 81, 79, R, 76, R, R, R, 77, R, 74, 76, 77, R, 81, R, 79, 77, 76, 74, 72, R, R, R }, bass = new[] { 48, 52, 55, 52, 48, 52, 55, 52, 43, 47, 50, 47, 43, 47, 50, 47 } },
            ["forest"] = new Tema { bpm = 100, mel = new[] { 69, R, 72, R, 76, 74, 72, R, 71, R, 74, R, 72, R, 69, R, 67, R, 71, R, 74, 72, 71, R, 69, R, R, R, R, R, R, R }, bass = new[] { 45, R, 52, R, 45, R, 52, R, 43, R, 50, R, 45, R, 40, R } },
            ["center"] = new Tema { bpm = 100, mel = new[] { 79, 76, 72, 76, 79, R, 84, R, 81, 77, 74, 77, 79, R, R, R, 79, 76, 72, 76, 79, R, 84, 86, 84, 83, 81, 79, 84, R, R, R }, bass = new[] { 48, R, 52, R, 53, R, 55, R, 48, R, 52, R, 55, R, 48, R } },
            ["lab"] = new Tema { bpm = 108, mel = new[] { 72, 74, 76, R, 79, R, 76, R, 74, 76, 77, R, 81, R, 77, R, 76, 77, 79, R, 84, R, 79, R, 77, 76, 74, R, 72, R, R, R }, bass = new[] { 48, R, 48, R, 53, R, 53, R, 50, R, 50, R, 55, R, 55, R } },
            ["gym"] = new Tema { bpm = 140, mel = new[] { 69, 69, 72, 69, 74, 69, 76, 74, 72, 72, 76, 72, 77, 76, 74, 72, 69, 69, 72, 69, 74, 69, 76, 79, 77, 76, 74, 72, 71, 72, 74, 76 }, bass = new[] { 45, 45, 57, 45, 45, 57, 45, 57, 41, 41, 53, 41, 43, 43, 55, 44 } },
            ["liga"] = new Tema { bpm = 126, mel = new[] { 72, R, 72, 74, 76, R, 79, R, 77, R, 76, 74, 72, R, R, R, 74, R, 74, 76, 77, R, 81, R, 79, R, 77, 76, 79, R, R, R }, bass = new[] { 48, 48, 55, 55, 53, 53, 55, 55, 50, 50, 57, 57, 55, 55, 43, 43 } },
            ["battle"] = new Tema { bpm = 168, mel = new[] { 76, 75, 76, 79, 76, 75, 76, 72, 74, 73, 74, 77, 74, 73, 74, 71, 72, 71, 72, 76, 79, 81, 79, 76, 77, 79, 77, 76, 74, 72, 71, 74 }, bass = new[] { 45, 57, 45, 57, 43, 55, 43, 55, 41, 53, 41, 53, 40, 52, 44, 56 } },
            ["trainer"] = new Tema { bpm = 176, mel = new[] { 69, 72, 76, 81, 80, 81, 76, 72, 71, 74, 77, 83, 81, 79, 77, 74, 72, 76, 79, 84, 83, 81, 79, 76, 77, 76, 74, 72, 71, 72, 74, 71 }, bass = new[] { 45, 45, 52, 45, 50, 50, 57, 50, 48, 48, 55, 48, 52, 52, 56, 52 } },
            ["victory"] = new Tema { bpm = 120, mel = new[] { 72, 76, 79, 84, R, 79, 84, R, 81, 77, 81, 86, R, 84, 83, 84, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R }, bass = new[] { 48, R, 55, R, 53, R, 55, R, 48, R, R, R, R, R, R, R } },
            ["credits"] = new Tema { bpm = 96, mel = new[] { 76, R, 79, 81, 84, R, 81, 79, 77, R, 76, 74, 76, R, R, R, 74, R, 76, 77, 79, R, 84, 83, 84, R, 86, R, 84, R, R, R }, bass = new[] { 48, R, 55, R, 45, R, 52, R, 41, R, 48, R, 43, R, 47, R } },
        };

        static string atual;
        static int passo;
        static double proximo;

        public static void Tocar(string nome)
        {
            if (atual == nome) return;
            atual = nome;
            passo = 0;
            var s = Sintetizador.Atual;
            proximo = s ? s.Agora + 0.1 : 0;
        }

        public static void Parar() => atual = null;

        public static void Atualizar()
        {
            var s = Sintetizador.Atual;
            if (!s || atual == null || !TEMAS.TryGetValue(atual, out var th)) return;
            double durPasso = 60.0 / th.bpm / 2;
            double agora = s.Agora;
            if (proximo < agora) proximo = agora + 0.05;
            while (proximo < agora + 0.3)
            {
                int m = th.mel[passo % th.mel.Length];
                if (m > 0) s.Tom(440f * Mathf.Pow(2, (m - 69) / 12f), proximo, (float)(durPasso * 0.9), 0, 0.045f, 0, true);
                if (passo % 2 == 0)
                {
                    int b = th.bass[(passo / 2) % th.bass.Length];
                    if (b > 0) s.Tom(440f * Mathf.Pow(2, (b - 69) / 12f), proximo, (float)(durPasso * 1.8), 1, 0.11f, 0, true);
                }
                if ((atual == "battle" || atual == "trainer" || atual == "gym") && passo % 4 == 2) s.Tom(0, proximo, 0.04f, 3, 0.05f, 0, true);
                proximo += durPasso;
                passo++;
                if (atual == "victory" && passo >= th.mel.Length) { atual = null; return; }
            }
        }
    }
}
