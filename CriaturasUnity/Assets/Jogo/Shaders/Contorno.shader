// Contorno de desenho ("inverted hull"): a casca é desenhada só por dentro, escura.
// _Extrude > 0 empurra os vértices pela normal (usado nos modelos com esqueleto);
// nas cascas exportadas do jogo original a casca já vem ampliada (_Extrude = 0).
Shader "Criaturas/Contorno"
{
    Properties
    {
        _OutlineColor ("Cor", Color) = (0.1, 0.08, 0.06, 1)
        _Extrude ("Espessura pela normal", Float) = 0
        _Wind ("Vento (amplitude)", Float) = 0
        _WindBase ("Vento (altura da base)", Float) = 0
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }
        Pass
        {
            Name "Contorno"
            Tags { "LightMode"="UniversalForward" }
            Cull Front
            ZWrite On

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            #pragma multi_compile_instancing
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float4 _OutlineColor;
                float _Extrude;
                float _Wind;
                float _WindBase;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float fog : TEXCOORD0; };

            Varyings vert(Attributes v)
            {
                UNITY_SETUP_INSTANCE_ID(v);
                Varyings o;
                float3 p = v.positionOS.xyz + normalize(v.normalOS) * _Extrude;
                float3 ws = TransformObjectToWorld(p);
                if (_Wind > 0)
                {
                    float h = max(0, p.y - _WindBase);
                    float t = _Time.y;
                    float w = sin(t * 1.7 + ws.x * 0.45 + ws.z * 0.3) * 0.6 + sin(t * 3.1 + ws.x * 1.3 - ws.z * 0.9) * 0.25;
                    ws.x += w * _Wind * h;
                    ws.z += w * _Wind * h * 0.6;
                }
                o.positionCS = TransformWorldToHClip(ws);
                o.fog = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                return half4(MixFog(_OutlineColor.rgb, i.fog), 1);
            }
            ENDHLSL
        }
    }
}
