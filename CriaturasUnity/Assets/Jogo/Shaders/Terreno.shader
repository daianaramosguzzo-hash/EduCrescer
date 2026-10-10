// Chão dos mapas: mistura até 8 texturas (camadas do Terrain Sample) com dois mapas de
// mistura RGBA, com luz suave, sombras do sol, oclusão de ambiente e névoa. Shader próprio e
// leve, para a versão final ficar igual ao editor (o shader de terreno do URP tem variantes
// demais para incluir inteiro).
Shader "Criaturas/Terreno"
{
    Properties
    {
        _Splat0 ("Mistura 0-3", 2D) = "red" {}
        _Splat1 ("Mistura 4-7", 2D) = "black" {}
        _Tex0 ("Camada 0", 2D) = "white" {} _Tex1 ("Camada 1", 2D) = "white" {}
        _Tex2 ("Camada 2", 2D) = "white" {} _Tex3 ("Camada 3", 2D) = "white" {}
        _Tex4 ("Camada 4", 2D) = "white" {} _Tex5 ("Camada 5", 2D) = "white" {}
        _Tex6 ("Camada 6", 2D) = "white" {} _Tex7 ("Camada 7", 2D) = "white" {}
        _Tile0123 ("Repetição 0-3 (metros)", Vector) = (10,10,10,10)
        _Tile4567 ("Repetição 4-7 (metros)", Vector) = (10,10,10,10)
        _Tint0 ("Cor 0", Color) = (1,1,1,1) _Tint1 ("Cor 1", Color) = (1,1,1,1)
        _Tint2 ("Cor 2", Color) = (1,1,1,1) _Tint3 ("Cor 3", Color) = (1,1,1,1)
        _Tint4 ("Cor 4", Color) = (1,1,1,1) _Tint5 ("Cor 5", Color) = (1,1,1,1)
        _Tint6 ("Cor 6", Color) = (1,1,1,1) _Tint7 ("Cor 7", Color) = (1,1,1,1)
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }

        HLSLINCLUDE
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
        CBUFFER_START(UnityPerMaterial)
            float4 _Splat0_ST, _Splat1_ST;
            float4 _Tile0123, _Tile4567;
            float4 _Tint0, _Tint1, _Tint2, _Tint3, _Tint4, _Tint5, _Tint6, _Tint7;
        CBUFFER_END
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForward" }
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #pragma multi_compile_fragment _ _SCREEN_SPACE_OCCLUSION
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            TEXTURE2D(_Splat0); SAMPLER(sampler_Splat0);
            TEXTURE2D(_Splat1);
            TEXTURE2D(_Tex0); SAMPLER(sampler_Tex0);
            TEXTURE2D(_Tex1); TEXTURE2D(_Tex2); TEXTURE2D(_Tex3);
            TEXTURE2D(_Tex4); TEXTURE2D(_Tex5); TEXTURE2D(_Tex6); TEXTURE2D(_Tex7);

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; float3 positionWS : TEXCOORD1; float3 normalWS : TEXCOORD2; float fog : TEXCOORD3; };

            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionWS = TransformObjectToWorld(v.positionOS.xyz);
                o.positionCS = TransformWorldToHClip(o.positionWS);
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                o.uv = v.uv;
                o.fog = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            half3 Camada(TEXTURE2D_PARAM(t, s), float2 xz, float tile, float4 tint)
            {
                return SAMPLE_TEXTURE2D(t, s, xz / tile).rgb * tint.rgb;
            }

            half4 frag(Varyings i) : SV_Target
            {
                half4 a = SAMPLE_TEXTURE2D(_Splat0, sampler_Splat0, i.uv);
                half4 b = SAMPLE_TEXTURE2D(_Splat1, sampler_Splat0, i.uv);
                float2 xz = i.positionWS.xz;
                half3 c = 0;
                if (a.r > 0.003) c += a.r * Camada(TEXTURE2D_ARGS(_Tex0, sampler_Tex0), xz, _Tile0123.x, _Tint0);
                if (a.g > 0.003) c += a.g * Camada(TEXTURE2D_ARGS(_Tex1, sampler_Tex0), xz, _Tile0123.y, _Tint1);
                if (a.b > 0.003) c += a.b * Camada(TEXTURE2D_ARGS(_Tex2, sampler_Tex0), xz, _Tile0123.z, _Tint2);
                if (a.a > 0.003) c += a.a * Camada(TEXTURE2D_ARGS(_Tex3, sampler_Tex0), xz, _Tile0123.w, _Tint3);
                if (b.r > 0.003) c += b.r * Camada(TEXTURE2D_ARGS(_Tex4, sampler_Tex0), xz, _Tile4567.x, _Tint4);
                if (b.g > 0.003) c += b.g * Camada(TEXTURE2D_ARGS(_Tex5, sampler_Tex0), xz, _Tile4567.y, _Tint5);
                if (b.b > 0.003) c += b.b * Camada(TEXTURE2D_ARGS(_Tex6, sampler_Tex0), xz, _Tile4567.z, _Tint6);
                if (b.a > 0.003) c += b.a * Camada(TEXTURE2D_ARGS(_Tex7, sampler_Tex0), xz, _Tile4567.w, _Tint7);
                c /= max(0.001, dot(a, 1) + dot(b, 1));

                float3 n = normalize(i.normalWS);
                Light sun = GetMainLight(TransformWorldToShadowCoord(i.positionWS));
                half lit = saturate(dot(n, sun.direction)) * sun.shadowAttenuation;
                half ao = 1;
                #if defined(_SCREEN_SPACE_OCCLUSION)
                    ao = GetScreenSpaceAmbientOcclusion(GetNormalizedScreenSpaceUV(i.positionCS)).indirectAmbientOcclusion;
                #endif
                half3 cor = c * ((0.38 + 0.62 * lit) * sun.color * 0.62 + SampleSH(n) * 0.55 * ao);
                return half4(MixFog(cor, i.fog), 1);
            }
            ENDHLSL
        }

        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode"="ShadowCaster" }
            ZWrite On ColorMask 0
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
            float3 _LightDirection;
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
            float4 vert(Attributes v) : SV_POSITION
            {
                float3 ws = TransformObjectToWorld(v.positionOS.xyz);
                float4 cs = TransformWorldToHClip(ApplyShadowBias(ws, TransformObjectToWorldNormal(v.normalOS), _LightDirection));
                #if UNITY_REVERSED_Z
                    cs.z = min(cs.z, UNITY_NEAR_CLIP_VALUE);
                #else
                    cs.z = max(cs.z, UNITY_NEAR_CLIP_VALUE);
                #endif
                return cs;
            }
            half4 frag() : SV_Target { return 0; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode"="DepthNormals" }
            ZWrite On
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 n : TEXCOORD0; };
            Varyings vert(Attributes v) { Varyings o; o.positionCS = TransformObjectToHClip(v.positionOS.xyz); o.n = TransformObjectToWorldNormal(v.normalOS); return o; }
            half4 frag(Varyings i) : SV_Target { return half4(normalize(i.n), 0); }
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode"="DepthOnly" }
            ZWrite On ColorMask R
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            float4 vert(float4 p : POSITION) : SV_POSITION { return TransformObjectToHClip(p.xyz); }
            half4 frag() : SV_Target { return 0; }
            ENDHLSL
        }
    }
}
