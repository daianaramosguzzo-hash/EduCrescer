using UnityEngine;

namespace Criaturas
{
    // Câmera em terceira pessoa (órbita com o mouse) ou de cima, com as mesmas contas do
    // jogo original. As contas são feitas nas coordenadas do three.js e convertidas no fim.
    public class CameraJogo : MonoBehaviour
    {
        public Mundo mundo;
        public Ator alvo;
        public bool deCima;
        public float yaw, pitch = 0.55f, zoom = 1;
        public bool encaixar = true, resetarYaw = true;

        float yawSuave, dist, pitchSuave;
        Vector3 posJs; // posição da câmera (coordenadas do three.js)
        Camera cam;

        static readonly System.Collections.Generic.Dictionary<string, float> REL = new()
        {
            ["up"] = 0, ["down"] = Mathf.PI, ["left"] = Mathf.PI / 2, ["right"] = -Mathf.PI / 2,
        };

        void Awake() { cam = GetComponent<Camera>(); }

        static Vector3 Js(Vector3 u) => new(-u.x, u.y, u.z);
        static Vector3 Unity(Vector3 j) => new(-j.x, j.y, j.z);

        public void Girar(float dx, float dy)
        {
            if (deCima || !alvo) return;
            yaw -= dx * 0.005f;
            pitch = Mathf.Clamp(pitch + dy * 0.004f, 0.12f, 1.35f);
        }

        public void Aproximar(float delta)
        {
            if (deCima) return;
            zoom = Mathf.Clamp(zoom * (delta > 0 ? 1.1f : 1 / 1.1f), 0.5f, 1.8f);
        }

        // direção do mapa mais perto de "para onde a câmera olha" (+ giro da seta apertada)
        public string Direcao(string relativa)
        {
            if (deCima) return relativa;
            float y = yaw + REL[relativa];
            string melhor = "down"; float md = 9;
            foreach (var kv in Grade.ROT)
            {
                float d = Mathf.Abs(Mathf.Repeat(y - kv.Value + Mathf.PI, Mathf.PI * 2) - Mathf.PI);
                if (d < md) { md = d; melhor = kv.Key; }
            }
            return melhor;
        }

        void LateUpdate()
        {
            if (!alvo || mundo == null || mundo.mapa == null) return;
            float dt = Time.deltaTime;
            var p = Js(alvo.transform.position);
            bool interior = mundo.mapa.interior;
            bool portrait = Screen.width < Screen.height;
            cam.fieldOfView = deCima ? (portrait ? 55 : 45) : (portrait ? 64 : 52);
            if (deCima)
            {
                var off = interior ? new Vector3(0, 7.8f, 6.0f) : new Vector3(0, 8.4f, 7.0f);
                var t = p + off;
                if (encaixar) { posJs = t; encaixar = false; }
                posJs = Vector3.Lerp(posJs, t, Mathf.Min(1, dt * 6));
                transform.position = Unity(posJs);
                transform.LookAt(Unity(new Vector3(posJs.x, p.y + 0.4f, posJs.z - off.z)));
                return;
            }
            if (encaixar)
            {
                if (resetarYaw) yaw = Grade.ROT[alvo.dir];
                resetarYaw = false;
                yawSuave = yaw;
            }
            float d = yaw - yawSuave;
            while (d > Mathf.PI) d -= Mathf.PI * 2;
            while (d < -Mathf.PI) d += Mathf.PI * 2;
            yawSuave += d * Mathf.Min(1, dt * 14);
            float fx = Mathf.Sin(yawSuave), fz = Mathf.Cos(yawSuave);
            // árvore ou parede logo atrás: aproxima e eleva a câmera
            bool parede = false;
            for (int i = 1; i <= 3; i++)
            {
                int tx = Mathf.RoundToInt(p.x - fx * i), tz = Mathf.RoundToInt(p.z - fz * i);
                var t = mundo.Tile(tx, tz);
                if (t == 'T' || t == '#' || mundo.PredioEm(tx, tz) != null) { parede = true; break; }
            }
            float baseR = (interior ? 4.0f : 5.4f) * zoom;
            float R = parede ? Mathf.Min(baseR, interior ? 2.8f : 3.4f) : baseR;
            float pit = parede ? Mathf.Max(pitch, 0.95f) : pitch;
            if (encaixar) { dist = R; pitchSuave = pit; }
            float k = Mathf.Min(1, dt * 5);
            dist += (R - dist) * k;
            pitchSuave += (pit - pitchSuave) * k;
            float horiz = Mathf.Cos(pitchSuave) * dist;
            float up = Mathf.Sin(pitchSuave) * dist + 0.6f;
            float lado = interior ? 0.35f : 0.7f;
            var alvoCam = new Vector3(p.x - fx * horiz + fz * lado, p.y + up, p.z - fz * horiz - fx * lado);
            if (encaixar) { posJs = alvoCam; encaixar = false; }
            posJs = Vector3.Lerp(posJs, alvoCam, Mathf.Min(1, dt * 12));
            transform.position = Unity(posJs);
            float frente = 2.2f * Mathf.Max(0, 1 - pitchSuave / 1.5f);
            transform.LookAt(Unity(new Vector3(p.x + fx * frente + fz * 0.25f, p.y + 0.6f, p.z + fz * frente - fx * 0.25f)));
        }
    }
}
