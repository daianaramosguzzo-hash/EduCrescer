using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;

namespace Criaturas
{
    // Coordenadas: o mapa do jogo original usa (x, z) em quadrados. Na Unity o eixo X
    // é espelhado (o glTF vira mão esquerda), então o quadrado (x, z) fica em (-x, 0, z).
    public static class Grade
    {
        public static readonly Dictionary<string, Vector2Int> DIRS = new()
        {
            ["up"] = new Vector2Int(0, -1), ["down"] = new Vector2Int(0, 1),
            ["left"] = new Vector2Int(-1, 0), ["right"] = new Vector2Int(1, 0),
        };
        // ângulo do three.js para cada direção (modelo olhando para +z quando 0)
        public static readonly Dictionary<string, float> ROT = new()
        {
            ["down"] = 0, ["up"] = Mathf.PI, ["left"] = -Mathf.PI / 2, ["right"] = Mathf.PI / 2,
        };
        public static readonly Dictionary<string, string> OPOSTO = new()
        {
            ["up"] = "down", ["down"] = "up", ["left"] = "right", ["right"] = "left",
        };

        public static Vector3 Pos(float x, float z, float y = 0) => new(-x, y, z);
        public static Quaternion Giro(float anguloJs) => Quaternion.Euler(0, -anguloJs * Mathf.Rad2Deg, 0);

        public static string DirPara(int dx, int dz) =>
            Mathf.Abs(dx) > Mathf.Abs(dz) ? (dx > 0 ? "right" : "left") : (dz > 0 ? "down" : "up");
    }

    // Personagem que anda em grade (herói, NPCs, criaturas selvagens), como o Actor do jogo.
    public class Ator : MonoBehaviour
    {
        public const float STEP_TIME = 0.24f;
        public int x, z;
        public string dir = "down";
        public bool andando;
        public float velocidade = 1;
        public float alturaModelo = 1.6f;
        public IAnimador animador;
        public Transform modelo; // filho com o modelo (pulinhos, escala)

        Vector2 de, para;
        float t;
        float anguloAlvo, anguloAtual;
        TaskCompletionSource<bool> passo;

        public void Colocar(int x, int z, string d = null)
        {
            this.x = x; this.z = z;
            transform.position = Grade.Pos(x, z, transform.position.y);
            if (d != null) { dir = d; anguloAlvo = anguloAtual = Grade.ROT[d]; transform.rotation = Grade.Giro(anguloAtual); }
        }

        public void Virar(string d) { dir = d; anguloAlvo = Grade.ROT[d]; }

        public Task Andar(string d, float vel = 1)
        {
            var v = Grade.DIRS[d];
            Virar(d);
            de = new Vector2(x, z);
            x += v.x; z += v.y;
            para = new Vector2(x, z);
            t = 0; andando = true; velocidade = vel;
            passo = new TaskCompletionSource<bool>();
            return passo.Task;
        }

        public async Task Caminhar(IEnumerable<string> dirs)
        {
            foreach (var d in dirs) await Andar(d);
        }

        public void Mostrar(bool sim) => gameObject.SetActive(sim);

        void Update()
        {
            float dt = Time.deltaTime;
            float d = anguloAlvo - anguloAtual;
            while (d > Mathf.PI) d -= Mathf.PI * 2;
            while (d < -Mathf.PI) d += Mathf.PI * 2;
            anguloAtual += d * Mathf.Min(1, dt * 18);
            transform.rotation = Grade.Giro(anguloAtual);
            if (andando)
            {
                t += dt / (STEP_TIME / velocidade);
                if (t >= 1)
                {
                    t = 1; andando = false;
                    transform.position = Grade.Pos(para.x, para.y, transform.position.y);
                    var p = passo; passo = null;
                    p?.TrySetResult(true);
                }
                else
                {
                    var q = Vector2.Lerp(de, para, t);
                    transform.position = Grade.Pos(q.x, q.y, transform.position.y);
                }
            }
            animador?.Atualizar(dt, andando, velocidade);
        }

        public float Progresso => andando ? t : 0;
    }
}
