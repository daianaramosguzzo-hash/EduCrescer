// Água animada: ondinhas, reflexo do céu nas bordas (fresnel), brilho do sol
// e espuma onde a água encosta na terra (lida da textura _Shore, gerada pelo mapa).
Shader "Criaturas/Agua"
{
    Properties
    {
        _Shallow ("Rasa", Color) = (0.5, 0.82, 0.83, 1)
        _Deep ("Funda", Color) = (0.16, 0.47, 0.67, 1)
        _Sky ("Reflexo do céu", Color) = (0.8, 0.93, 1, 1)
        _Opacity ("Opacidade", Range(0,1)) = 0.84
        _Shore ("Margens (R: 0 água, 1 terra)", 2D) = "black" {}
        _ShoreRect ("Retângulo das margens (x0, z0, largura, altura)", Vector) = (0,0,1,1)
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent-10" "RenderPipeline"="UniversalPipeline" }
        Pass
        {
            Name "Agua"
            Tags { "LightMode"="UniversalForward" }
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off
            Cull Back

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float4 _Shallow;
                float4 _Deep;
                float4 _Sky;
                float _Opacity;
                float4 _ShoreRect;
                float4 _Shore_ST;
            CBUFFER_END
            TEXTURE2D(_Shore); SAMPLER(sampler_Shore);

            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 positionWS : TEXCOORD0; float fog : TEXCOORD1; };

            float wave(float2 p, float t)
            {
                return sin(p.x * 1.6 + t * 1.3) * 0.5 + sin(p.y * 1.9 - t * 1.1) * 0.5 + sin((p.x + p.y) * 3.3 + t * 2.1) * 0.25;
            }

            Varyings vert(Attributes v)
            {
                Varyings o;
                float3 ws = TransformObjectToWorld(v.positionOS.xyz);
                ws.y += wave(ws.xz, _Time.y) * 0.015;
                o.positionWS = ws;
                o.positionCS = TransformWorldToHClip(ws);
                o.fog = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                float t = _Time.y;
                float2 p = i.positionWS.xz;
                // normal das ondinhas pela derivada da função de onda
                float e = 0.05;
                float hx = wave(p + float2(e, 0), t) - wave(p - float2(e, 0), t);
                float hz = wave(p + float2(0, e), t) - wave(p - float2(0, e), t);
                float3 n = normalize(float3(-hx * 0.35, 1, -hz * 0.35));
                float3 v = GetWorldSpaceNormalizeViewDir(i.positionWS);
                Light sun = GetMainLight(TransformWorldToShadowCoord(i.positionWS));

                float2 suv = (p - _ShoreRect.xy) / _ShoreRect.zw;
                float land = SAMPLE_TEXTURE2D(_Shore, sampler_Shore, suv).r;
                float depth = saturate(1 - land * 1.4);
                half3 col = lerp(_Shallow.rgb, _Deep.rgb, depth * 0.85);

                float fres = pow(1 - saturate(dot(n, v)), 4);
                col = lerp(col, _Sky.rgb, fres * 0.6);
                float3 hdir = normalize(sun.direction + v);
                float spec = pow(saturate(dot(n, hdir)), 120) * 1.6 * sun.shadowAttenuation;
                col += sun.color * spec;
                col *= lerp(0.75, 1, sun.shadowAttenuation);

                // espuma animada perto da margem
                float foamBand = smoothstep(0.25, 0.6, land);
                float foamN = sin(p.x * 7 + t * 2) * sin(p.y * 6 - t * 1.6) * 0.5 + 0.5;
                float foam = foamBand * smoothstep(0.35, 0.65, foamN + land * 0.4);
                col = lerp(col, half3(1, 1, 1), foam * 0.75);

                float a = saturate(_Opacity + fres * 0.15 + foam * 0.3);
                col = MixFog(col, i.fog);
                return half4(col, a);
            }
            ENDHLSL
        }
    }
}
