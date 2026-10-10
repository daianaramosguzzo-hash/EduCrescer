using UnityEngine;
using UnityEngine.InputSystem;

namespace Criaturas
{
    // Botões do jogo (A = interagir, B = voltar/correr, menu e direções), juntando teclado,
    // mouse e botões virtuais (toque na tela ou automação de testes).
    [DefaultExecutionOrder(-100)]
    public class Controles : MonoBehaviour
    {
        static bool aPend, bPend, menuPend;
        static bool aAgora, bAgora, menuAgora;
        public static string DirVirtual;
        public static bool CorrerVirtual;

        public static void ApertarA() => aPend = true;
        public static void ApertarB() => bPend = true;
        public static void ApertarMenu() => menuPend = true;

        void Update()
        {
            aAgora = aPend; bAgora = bPend; menuAgora = menuPend;
            aPend = bPend = menuPend = false;
        }

        public static bool A(bool incluirClique = true)
        {
            var k = Keyboard.current; var m = Mouse.current;
            return aAgora
                || (k != null && (k.zKey.wasPressedThisFrame || k.spaceKey.wasPressedThisFrame || k.enterKey.wasPressedThisFrame || k.numpadEnterKey.wasPressedThisFrame))
                || (incluirClique && m != null && m.leftButton.wasPressedThisFrame);
        }

        public static bool B()
        {
            var k = Keyboard.current; var m = Mouse.current;
            return bAgora
                || (k != null && (k.xKey.wasPressedThisFrame || k.escapeKey.wasPressedThisFrame || k.backspaceKey.wasPressedThisFrame))
                || (m != null && m.rightButton.wasPressedThisFrame);
        }

        public static bool Menu()
        {
            var k = Keyboard.current;
            return menuAgora || (k != null && (k.escapeKey.wasPressedThisFrame || k.mKey.wasPressedThisFrame));
        }

        public static string Direcao()
        {
            var k = Keyboard.current;
            if (k != null)
            {
                if (k.upArrowKey.isPressed || k.wKey.isPressed) return "up";
                if (k.downArrowKey.isPressed || k.sKey.isPressed) return "down";
                if (k.leftArrowKey.isPressed || k.aKey.isPressed) return "left";
                if (k.rightArrowKey.isPressed || k.dKey.isPressed) return "right";
            }
            return DirVirtual;
        }

        public static bool Correndo()
        {
            var k = Keyboard.current; var m = Mouse.current;
            return CorrerVirtual || (k != null && (k.xKey.isPressed || k.leftShiftKey.isPressed)) || (m != null && m.rightButton.isPressed);
        }
    }
}
