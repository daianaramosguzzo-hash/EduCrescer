using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace Criaturas
{
    public interface IAnimador
    {
        void Atualizar(float dt, bool andando, float velocidade);
        void Gesto(string nome);
    }

    // Peça animada por código: guarda os ângulos originais (do three.js, vindos no nome
    // "peca@x,y,z") e recompõe a rotação trocando só os eixos que a animação muda.
    // Conversão three.js -> Unity (eixo X espelhado): (x, y, z) graus -> (x, -y, -z).
    public class Peca
    {
        public readonly Transform t;
        public readonly Vector3 eulerJs; // radianos, ordem XYZ do three.js
        public readonly Vector3 pos0, escala0;

        public Peca(Transform t)
        {
            this.t = t;
            pos0 = t.localPosition;
            escala0 = t.localScale;
            var i = t.name.IndexOf('@');
            if (i >= 0)
            {
                var p = t.name.Substring(i + 1).Split(',');
                float f(int k) => k < p.Length && float.TryParse(p[k], NumberStyles.Float, CultureInfo.InvariantCulture, out var v) ? v : 0;
                eulerJs = new Vector3(f(0), f(1), f(2));
            }
        }

        // ângulos no padrão do three.js (null = mantém o original)
        public void Rot(float? x = null, float? y = null, float? z = null)
        {
            float ax = x ?? eulerJs.x, ay = y ?? eulerJs.y, az = z ?? eulerJs.z;
            t.localRotation = Quaternion.AngleAxis(ax * Mathf.Rad2Deg, Vector3.right)
                            * Quaternion.AngleAxis(-ay * Mathf.Rad2Deg, Vector3.up)
                            * Quaternion.AngleAxis(-az * Mathf.Rad2Deg, Vector3.forward);
        }

        public static Peca Achar(Transform raiz, string prefixo)
        {
            var t = Modelos.Achar(raiz, prefixo);
            return t ? new Peca(t) : null;
        }
    }

    // Pessoas feitas em código (makeHuman): balanço de braços e pernas, respiração,
    // olhar em volta e gestos dos líderes, iguais ao jogo original.
    public class AnimPessoa : MonoBehaviour, IAnimador
    {
        Peca corpo, cabeca;
        readonly Peca[] pernas = new Peca[2], bracos = new Peca[2];
        float fase, vida, olharT, olharPara;
        string lider, gesto;
        float gT, proxG;
        const float G_LEN = 1.8f;
        static readonly Dictionary<string, string[]> GESTOS = new()
        {
            ["pedra"] = new[] { "cross", "flex" }, ["agua"] = new[] { "wave", "twirl" }, ["fogo"] = new[] { "fist", "head" },
            ["eletrico"] = new[] { "point", "head" }, ["planta"] = new[] { "wide", "bow" }, ["sombra"] = new[] { "wide", "point" },
        };

        public void Iniciar(string lider)
        {
            this.lider = lider;
            corpo = Peca.Achar(transform, "corpo");
            cabeca = Peca.Achar(transform, "cabeca");
            for (int i = 0; i < 2; i++) { pernas[i] = Peca.Achar(transform, "perna_" + i); bracos[i] = Peca.Achar(transform, "braco_" + i); }
            vida = Random.value * 10;
            proxG = 2 + Random.value * 3;
        }

        public void Atualizar(float dt, bool andando, float vel)
        {
            if (corpo == null || pernas[0] == null || bracos[0] == null) return;
            if (andando) fase += dt * 11 * vel; else fase *= 0.8f;
            float s = Mathf.Sin(fase), amp = andando ? 0.65f : 0;
            vida += dt;
            float idle = andando ? 0 : 1, breath = Mathf.Sin(vida * 2.1f);
            float corpoY = andando ? Mathf.Abs(Mathf.Cos(fase)) * 0.04f : 0;
            float corpoRx = 0, corpoRy = 0, corpoRz = Mathf.Sin(vida * 0.7f) * 0.025f * idle;
            float braco0x = -s * amp * 0.9f, braco1x = s * amp * 0.9f;
            float braco0z = -0.08f - (0.03f + breath * 0.02f) * idle, braco1z = 0.08f + (0.03f + breath * 0.02f) * idle;
            olharT -= dt;
            if (olharT <= 0) { olharPara = (Random.value - 0.5f) * (lider != null ? 1.1f : 0.8f); olharT = 1.6f + Random.value * 3; }
            cabecaY += (olharPara * idle - cabecaY) * Mathf.Min(1, dt * 3);
            float cabecaX = Mathf.Sin(vida * 1.3f) * 0.04f * idle;

            if (lider != null && GESTOS.TryGetValue(lider, out var lista))
            {
                if (andando) gesto = null;
                else if (gesto == null) { proxG -= dt; if (proxG <= 0) { gesto = lista[Random.Range(0, lista.Length)]; gT = 0; } }
                if (gesto != null)
                {
                    gT += dt;
                    float k = gT / G_LEN, e = Mathf.Min(1, Mathf.Min(k / 0.2f, (1 - k) / 0.2f));
                    switch (gesto)
                    {
                        case "wave": braco1z = 0.08f + 2.4f * e + Mathf.Sin(gT * 14) * 0.35f * e; break;
                        case "fist": braco1x = -2.8f * e; corpoY += Mathf.Abs(Mathf.Sin(gT * 9)) * 0.05f * e; break;
                        case "cross": braco0x = -1.3f * e; braco1x = -1.3f * e; braco0z = -0.08f + 0.75f * e; braco1z = 0.08f - 0.75f * e; break;
                        case "flex": braco0z = -0.08f - 1.5f * e; braco1z = 0.08f + 1.5f * e; braco0x = -0.5f * e; braco1x = -0.5f * e; break;
                        case "wide": braco0z = -0.08f - 1.25f * e; braco1z = 0.08f + 1.25f * e; cabecaX = -0.2f * e; break;
                        case "point": braco1x = -3.0f * e; cabecaX = -0.3f * e; break;
                        case "head": braco1x = -2.3f * e; braco1z = 0.08f - 0.55f * e; break;
                        case "bow": corpoRx = 0.38f * e; braco0x = 0.3f * e; braco1x = 0.3f * e; break;
                        case "twirl": corpoRy = Mathf.PI * 2 * Mathf.Clamp01((k - 0.15f) / 0.7f); braco1z = 0.08f + 1.2f * e; braco0z = -0.08f - 1.2f * e; break;
                    }
                    if (gT >= G_LEN) { gesto = null; proxG = 3 + Random.value * 4; }
                }
                if (lider == "sombra") corpoY += (0.06f + Mathf.Sin(vida * 1.6f) * 0.04f) * idle;
            }
            if (pose == "throw") braco1x = -2.6f;
            else if (pose == "fist") { braco1x = -1.2f; braco1z = 0.9f; }

            pernas[0].Rot(x: s * amp, y: 0, z: 0);
            pernas[1].Rot(x: -s * amp, y: 0, z: 0);
            bracos[0].Rot(x: braco0x, y: 0, z: braco0z);
            bracos[1].Rot(x: braco1x, y: 0, z: braco1z);
            corpo.t.localPosition = new Vector3(corpo.pos0.x, corpo.pos0.y + corpoY, corpo.pos0.z);
            corpo.t.localScale = new Vector3(corpo.escala0.x, corpo.escala0.y * (1 + breath * 0.014f * idle), corpo.escala0.z);
            corpo.Rot(x: corpoRx, y: corpoRy, z: corpoRz);
            cabeca?.Rot(x: cabecaX, y: cabecaY, z: 0);
        }

        float cabecaY;
        string pose;
        public void Gesto(string nome) { pose = nome == "rest" ? null : nome; }
    }

    // Criaturas feitas em código (makeCreature): respiração, flutuar, chamas, asas e cauda.
    public class AnimCriatura : MonoBehaviour, IAnimador
    {
        Peca interno, giro, brilho;
        Peca cauda;
        readonly List<(Peca p, float lado, string tipo)> asas = new();
        readonly List<Peca> chamas = new(), segmentos = new(), redemoinhos = new();
        readonly List<float> sementes = new();
        bool flutua;
        float t, escala;

        public void Iniciar()
        {
            t = Random.value * 10;
            var raiz = Modelos.Achar(transform, "criatura_");
            if (raiz && raiz.childCount > 0) interno = new Peca(raiz.GetChild(0));
            if (interno == null) return;
            flutua = interno.t.name.StartsWith("interno_flutua");
            escala = interno.escala0.x;
            cauda = Peca.Achar(transform, "cauda");
            giro = Peca.Achar(transform, "giro");
            brilho = Peca.Achar(transform, "brilho");
            var l = new List<Transform>();
            foreach (var tipo in new[] { "asa_", "garra_", "borboleta_" })
            {
                l.Clear(); Modelos.AcharTodos(transform, tipo, l);
                foreach (var a in l) asas.Add((new Peca(a), a.name.StartsWith(tipo + "d") ? 1 : -1, tipo));
            }
            l.Clear(); Modelos.AcharTodos(transform, "chama", l);
            foreach (var c in l) { chamas.Add(new Peca(c)); sementes.Add(Random.value * 10); }
            l.Clear(); Modelos.AcharTodos(transform, "segmento_", l);
            foreach (var c in l) segmentos.Add(new Peca(c));
            l.Clear(); Modelos.AcharTodos(transform, "redemoinho_", l);
            foreach (var c in l) redemoinhos.Add(new Peca(c));
        }

        public void Atualizar(float dt, bool andando, float vel)
        {
            if (interno == null) return;
            t += dt;
            float baseY = flutua ? 0.12f : 0;
            var p = interno.pos0;
            interno.t.localPosition = new Vector3(p.x, baseY + (flutua ? Mathf.Sin(t * 2.4f) * 0.07f : 0), p.z);
            interno.t.localScale = new Vector3(escala, escala * (1 + Mathf.Sin(t * 3) * 0.02f), escala);
            for (int i = 0; i < chamas.Count; i++)
            {
                float sd = sementes[i];
                chamas[i].t.localScale = Vector3.Scale(chamas[i].escala0, new Vector3(1 + Mathf.Sin(t * 20 + sd) * 0.08f, 1 + Mathf.Sin(t * 17 + sd) * 0.15f, 1 + Mathf.Cos(t * 19 + sd) * 0.08f));
            }
            foreach (var (a, lado, tipo) in asas)
            {
                if (tipo == "garra_") a.Rot(z: Mathf.Sin(t * 3) * 0.2f * lado);
                else if (tipo == "borboleta_") a.Rot(y: lado * Mathf.Sin(t * 8) * 0.6f);
                else a.Rot(z: lado * (0.2f + Mathf.Sin(t * (flutua ? 14 : 4)) * 0.4f));
            }
            cauda?.Rot(y: Mathf.Sin(t * 4) * 0.25f);
            giro?.Rot(z: Mathf.Sin(t * 1.5f) * 0.4f);
            for (int i = 0; i < segmentos.Count; i++)
            {
                var s = segmentos[i];
                int idx = int.TryParse(s.t.name.Substring(9).Split('@')[0], out var k) ? k : i;
                s.t.localPosition = new Vector3(-Mathf.Sin(t * 2.6f + idx * 0.9f) * 0.16f, s.pos0.y, s.pos0.z);
            }
            if (brilho != null) brilho.t.localScale = brilho.escala0 * (1 + Mathf.Max(0, Mathf.Sin(t * 4)) * 0.6f);
            for (int i = 0; i < redemoinhos.Count; i++) redemoinhos[i].Rot(z: t * (4 + i));
        }

        public void Gesto(string nome) { }
    }

    // Modelos com esqueleto e animações (herói Leo, Pingolote): Idle / Walk / Run do arquivo.
    public class AnimEsqueleto : MonoBehaviour, IAnimador
    {
        Animation anim;
        string idle, andar, correr;
        float velAndar = 1.55f, velCorrer = 2.4f;
        string atual;

        // ossos e suas posições originais: alguns quadros das animações comprimidas (gltfpack)
        // chegam com valores absurdos depois de descompactados; esses quadros são corrigidos
        Transform[] ossos;
        Vector3[] posOriginal;

        public void Iniciar(float velAndar, float velCorrer)
        {
            this.velAndar = velAndar;
            this.velCorrer = velCorrer;
            var smr = GetComponentInChildren<SkinnedMeshRenderer>();
            if (smr)
            {
                ossos = smr.bones;
                posOriginal = new Vector3[ossos.Length];
                for (int i = 0; i < ossos.Length; i++) if (ossos[i]) posOriginal[i] = ossos[i].localPosition;
            }
            anim = GetComponentInChildren<Animation>();
            if (!anim) return;
            foreach (AnimationState st in anim)
            {
                var n = st.name.ToLowerInvariant();
                if (n.Contains("pose")) continue; // pose de referência do Blender (A_Pose)
                if (n.Contains("idle") && n.Contains("varia")) { variacao ??= st.name; st.wrapMode = WrapMode.Once; continue; }
                if (n.Contains("idle")) idle ??= st.name;
                else if (n.Contains("walk") || n.Contains("andar")) andar ??= st.name;
                else if (n.Contains("run") || n.Contains("correr")) correr ??= st.name;
                st.wrapMode = WrapMode.Loop;
            }
            Tocar(idle, 0);
            if (idle != null) anim[idle].time = Random.value * 3;
        }

        void Tocar(string clip, float fade = 0.2f)
        {
            if (clip == null || clip == atual) return;
            atual = clip;
            if (fade <= 0) anim.Play(clip); else anim.CrossFade(clip, fade);
        }

        // de tempos em tempos, parado, faz a variação do idle (olhar em volta, ajeitar a mochila...)
        string variacao;
        float proxVariacao = 6, variando;

        public void Atualizar(float dt, bool andando, float vel)
        {
            if (!anim) return;
            bool corre = andando && vel > 1.3f;
            if (!andando && variacao != null)
            {
                if (variando > 0) { variando -= dt; if (variando > 0) return; atual = null; }
                else if ((proxVariacao -= dt) <= 0)
                {
                    proxVariacao = 8 + Random.value * 10;
                    variando = anim[variacao].length;
                    atual = variacao;
                    anim.CrossFade(variacao, 0.25f);
                    return;
                }
            }
            else variando = 0;
            var quer = andando ? (corre && correr != null ? correr : andar) : idle;
            Tocar(quer ?? idle);
            if (andar != null) anim[andar].speed = corre && correr == null ? velCorrer : velAndar;
            else Balancar(dt, andando, vel);
        }

        // sem animação de andar no arquivo: pulinhos e balanço por código enquanto se move
        float faseBalanco; float? y0;
        void Balancar(float dt, bool andando, float vel)
        {
            y0 ??= transform.localPosition.y;
            if (andando) faseBalanco += dt * 11 * vel; else faseBalanco = Mathf.MoveTowards(faseBalanco, Mathf.Round(faseBalanco / Mathf.PI) * Mathf.PI, dt * 8);
            var p = transform.localPosition;
            transform.localPosition = new Vector3(p.x, y0.Value + Mathf.Abs(Mathf.Sin(faseBalanco)) * 0.06f, p.z);
            transform.localRotation = Quaternion.Euler(0, 0, Mathf.Sin(faseBalanco) * 4f);
        }

        void LateUpdate()
        {
            if (ossos == null) return;
            for (int i = 0; i < ossos.Length; i++)
            {
                var o = ossos[i];
                if (!o) continue;
                var p = o.localPosition;
                if (float.IsNaN(p.x + p.y + p.z) || (p - posOriginal[i]).sqrMagnitude > 4) o.localPosition = posOriginal[i];
                var q = o.localRotation;
                if (float.IsNaN(q.x + q.y + q.z + q.w)) o.localRotation = Quaternion.identity;
            }
        }

        public void Gesto(string nome) { }
    }
}
