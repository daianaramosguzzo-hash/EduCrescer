using UnityEngine;

namespace Criaturas
{
    // Modelos e camadas de terreno do pacote "Unity HDRP Terrain | Terrain Sample Project"
    // (convertidos para o URP do jogo). O arquivo Resources/Natureza.asset é preenchido pelo
    // menu "Criaturas > Configurar projeto".
    [CreateAssetMenu(menuName = "Criaturas/Natureza")]
    public class Natureza : ScriptableObject
    {
        [Header("Árvores")]
        public GameObject[] pinheiros;    // Pine_A..D
        public GameObject[] coniferas;    // Conifer, Cypress
        [Header("Plantas")]
        public GameObject[] capim;        // Grass_A, GrassDry_C/D (baixinho, barato)
        public GameObject[] capimAlto;    // Grass_C, Grass_D (mato alto das criaturas)
        public GameObject[] capimSeco;    // GrassDry_A/B, BushDry_A/B
        public GameObject[] samambaias;   // Fern_A..C
        public GameObject[] arbustos;     // Bush_A, Bush_B, Shrub, Bush_Twig
        public GameObject[] flores;       // Heather_A/B (urze roxa)
        [Header("Pedras")]
        public GameObject[] pedras;       // Rock_A_01, Rock_B_01/02, Rock_C_01
        public GameObject[] rochedos;     // Rock_Overgrown_A..D, Rock_D, Rock_A_02, Rock_C_02
        [Header("Terreno (camadas)")]
        public TerrainLayer grama, gramaMato, musgo, terra, seixos, margem, penhasco, urze, areiaEscura;

        static Natureza carregada;
        static bool tentou;
        public static Natureza Atual
        {
            get
            {
                if (!tentou) { carregada = Resources.Load<Natureza>("Natureza"); tentou = true; }
                return carregada;
            }
        }
    }
}
