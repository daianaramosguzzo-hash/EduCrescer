using System.Threading.Tasks;
using UnityEngine;

namespace Criaturas
{
    // Criatura selvagem andando no mato alto: aparece crescendo, dá pulinhos, chega perto
    // do herói por curiosidade e some depois de um tempo (como no jogo original).
    public class Selvagem : MonoBehaviour
    {
        public Ator ator;
        public string sp;
        public int lvl;
        public float variante;
        public float cooldown;
        Mundo mundo;
        float vida, moveT, spawnT, hopT, escalaBase = 0.95f;
        float? despawn;
        TextMesh rotulo;
        Transform rotuloT;

        public async Task Iniciar(Mundo m, string sp, int lvl, int x, int z, bool instantanea)
        {
            mundo = m; this.sp = sp; this.lvl = lvl;
            variante = Random.value;
            ator = gameObject.AddComponent<Ator>();
            var dirs = new[] { "up", "down", "left", "right" };
            ator.Colocar(x, z, dirs[Random.Range(0, 4)]);
            var modelo = new GameObject("modelo").transform;
            modelo.SetParent(transform, false);
            ator.modelo = modelo;
            var (g, anim) = await Mundo.CriarCriatura(sp, modelo, variante);
            if (!this) return;
            ator.animador = anim;
            Mundo.Sombra(modelo, 0.9f);
            vida = 40 + Random.value * 40;
            moveT = 0.5f + Random.value * 2;
            spawnT = instantanea ? 1 : 0;
            hopT = Random.value * 2;
            float altura = g ? Modelos.Limites(g).size.y : 0.8f;
            CriarRotulo(altura + 0.55f);
            modelo.localScale = Vector3.one * Mathf.Max(0.001f, escalaBase * spawnT);
        }

        void CriarRotulo(float y)
        {
            var go = new GameObject("rotulo");
            rotuloT = go.transform;
            rotuloT.SetParent(transform, false);
            rotuloT.localPosition = new Vector3(0, y, 0);
            rotulo = go.AddComponent<TextMesh>();
            var nome = Dados.Especies.TryGetValue(sp, out var e) ? e.name : sp;
            rotulo.text = $"{nome}  Nv.{lvl}";
            rotulo.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            rotulo.GetComponent<MeshRenderer>().sharedMaterial = rotulo.font.material;
            rotulo.fontSize = 48;
            rotulo.characterSize = 0.045f;
            rotulo.anchor = TextAnchor.MiddleCenter;
            rotulo.alignment = TextAlignment.Center;
            rotulo.color = Color.white;
            // fundo escuro atrás do texto
            var bg = GameObject.CreatePrimitive(PrimitiveType.Quad);
            Destroy(bg.GetComponent<Collider>());
            bg.transform.SetParent(rotuloT, false);
            bg.transform.localPosition = new Vector3(0, 0, 0.01f);
            bg.transform.localScale = new Vector3(0.055f * rotulo.text.Length + 0.2f, 0.32f, 1);
            var mat = Materiais.NovoToon("rotulo");
            mat.SetVector(GeradorToon.BaseColor, new Vector4(0.012f, 0.01f, 0.017f, 0.8f));
            mat.SetFloat("_Unlit", 1);
            Materiais.Transparente(mat);
            mat.renderQueue = 3100;
            var r = bg.GetComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            rotulo.GetComponent<MeshRenderer>().sortingOrder = 10;
            go.SetActive(false);
        }

        public void Atualizar(float dt, bool ocupado)
        {
            if (!ator || !ator.modelo) return;
            var h = mundo.heroi;
            if (spawnT < 1) spawnT = Mathf.Min(1, spawnT + dt * 2.5f);
            float s = despawn.HasValue ? escalaBase * Mathf.Max(0, despawn.Value) : escalaBase * spawnT;
            ator.modelo.localScale = Vector3.one * Mathf.Max(0.001f, s);
            // pulinhos para aparecer acima do mato alto
            hopT += dt;
            float ciclo = hopT % 1.8f;
            float pulo = ciclo < 0.35f ? Mathf.Sin(ciclo / 0.35f * Mathf.PI) * 0.35f : 0;
            var lp = ator.modelo.localPosition;
            ator.modelo.localPosition = new Vector3(lp.x, ator.andando ? Mathf.Sin(ator.Progresso * Mathf.PI) * 0.3f : pulo, lp.z);
            int dist = h ? Mathf.Abs(ator.x - h.x) + Mathf.Abs(ator.z - h.z) : 99;
            if (rotuloT)
            {
                rotuloT.gameObject.SetActive(dist <= 4 && !ocupado);
                var cam = Camera.main;
                if (cam) rotuloT.rotation = Quaternion.LookRotation(rotuloT.position - cam.transform.position);
            }
            if (despawn.HasValue)
            {
                despawn -= dt * 2.5f;
                if (despawn <= 0) mundo.RemoverSelvagem(this);
                return;
            }
            if (ocupado || !h) return;
            if (cooldown > 0) cooldown -= dt;
            vida -= dt;
            if (vida <= 0 && dist > 3 && !ator.andando) { despawn = 1; return; }
            if (ator.andando) return;
            moveT -= dt;
            if (moveT > 0) return;
            moveT = 1 + Random.value * 2.2f;
            string d;
            if (dist <= 3 && Random.value < 0.6f) d = Grade.DirPara(h.x - ator.x, h.z - ator.z);
            else d = new[] { "up", "down", "left", "right" }[Random.Range(0, 4)];
            var v = Grade.DIRS[d];
            int nx = ator.x + v.x, nz = ator.z + v.y;
            if (nx == h.x && nz == h.z)
            {
                ator.Virar(d);
                if (!h.andando && cooldown <= 0) mundo.AoTocarSelvagem?.Invoke(this);
                return;
            }
            if (mundo.EhMato(nx, nz) && !mundo.Bloqueado(nx, nz, ator)) _ = ator.Andar(d, 0.6f);
            else ator.Virar(d);
        }

        public void Sumir() { despawn = 1; }
    }
}
