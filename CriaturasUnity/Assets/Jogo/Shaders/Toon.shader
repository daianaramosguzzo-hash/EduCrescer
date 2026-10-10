// Sombreamento de desenho animado (toon) para o URP, no estilo do jogo original:
// luz em faixas suaves, luz de borda (rim), sombras do sol, névoa, cor de vértice,
// emissão, transparência opcional e balanço de vento para plantas.
Shader "Criaturas/Toon"
{
    Properties
    {
        _BaseColor ("Cor", Color) = (1,1,1,1)
        _BaseMap ("Textura", 2D) = "white" {}
        [HDR] _EmissionColor ("Emissão", Color) = (0,0,0,0)
        _UseVertexColor ("Usar cor de vértice", Float) = 0
        _Rim ("Luz de borda", Range(0,1)) = 0.3
        _Unlit ("Sem iluminação", Float) = 0
        _Wind ("Vento (amplitude)", Float) = 0
        _WindBase ("Vento (altura da base)", Float) = 0
        _Cutoff ("Corte alfa", Range(0,1)) = 0
        [Normal] _BumpMap ("Relevo (normal map)", 2D) = "bump" {}
        _UseNormal ("Usar relevo", Float) = 0
        _Suave ("Luz suave (realista)", Range(0,1)) = 0
        [HideInInspector] _SrcBlend ("Src", Float) = 1
        [HideInInspector] _DstBlend ("Dst", Float) = 0
        [HideInInspector] _ZWrite ("ZWrite", Float) = 1
        [HideInInspector] _Cull ("Cull", Float) = 2
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }

        HLSLINCLUDE
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

        CBUFFER_START(UnityPerMaterial)
            float4 _BaseColor;
            float4 _BaseMap_ST;
            float4 _EmissionColor;
            float _UseVertexColor;
            float _Rim;
            float _Unlit;
            float _Wind;
            float _WindBase;
            float _Cutoff;
            float _UseNormal;
            float _Suave;
            float4 _BumpMap_ST;
        CBUFFER_END

        TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
        TEXTURE2D(_BumpMap); SAMPLER(sampler_BumpMap);

        // balanço de vento: quanto mais alto no objeto, mais balança
        float3 ApplyWind(float3 positionOS, float3 positionWS)
        {
            if (_Wind <= 0) return positionWS;
            float h = max(0, positionOS.y - _WindBase);
            float t = _Time.y;
            float w = sin(t * 1.7 + positionWS.x * 0.45 + positionWS.z * 0.3) * 0.6
                    + sin(t * 3.1 + positionWS.x * 1.3 - positionWS.z * 0.9) * 0.25;
            positionWS.x += w * _Wind * h;
            positionWS.z += w * _Wind * h * 0.6;
            return positionWS;
        }
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForward" }
            Blend [_SrcBlend] [_DstBlend]
            ZWrite [_ZWrite]
            Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fragment _ _SCREEN_SPACE_OCCLUSION
            #pragma multi_compile_fog
            #pragma multi_compile_instancing

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float4 tangentOS : TANGENT;
                float2 uv : TEXCOORD0;
                float4 color : COLOR;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float2 uv : TEXCOORD0;
                float3 positionWS : TEXCOORD1;
                float3 normalWS : TEXCOORD2;
                float4 color : TEXCOORD3;
                float fog : TEXCOORD4;
                float4 tangentWS : TEXCOORD5;
                UNITY_VERTEX_INPUT_INSTANCE_ID
                UNITY_VERTEX_OUTPUT_STEREO
            };

            Varyings vert(Attributes v)
            {
                Varyings o = (Varyings)0;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_TRANSFER_INSTANCE_ID(v, o);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                float3 ws = ApplyWind(v.positionOS.xyz, TransformObjectToWorld(v.positionOS.xyz));
                o.positionWS = ws;
                o.positionCS = TransformWorldToHClip(ws);
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                o.tangentWS = float4(TransformObjectToWorldDir(v.tangentOS.xyz), v.tangentOS.w * GetOddNegativeScale());
                o.uv = TRANSFORM_TEX(v.uv, _BaseMap);
                o.color = _UseVertexColor > 0.5 ? v.color : float4(1,1,1,1);
                o.fog = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            // quatro faixas de luz como o degradê do jogo original, com bordas suaves
            half Ramp(half x)
            {
                half a = smoothstep(0.08, 0.16, x);
                half b = smoothstep(0.38, 0.46, x);
                half c = smoothstep(0.68, 0.76, x);
                return 0.42 + a * 0.20 + b * 0.21 + c * 0.17;
            }

            half4 frag(Varyings i, bool front : SV_IsFrontFace) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(i);
                half4 tex = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, i.uv);
                half4 albedo = tex * _BaseColor * i.color;
                clip(albedo.a - _Cutoff);
                if (_Unlit > 0.5)
                {
                    half3 c = MixFog(albedo.rgb + _EmissionColor.rgb, i.fog);
                    return half4(c, albedo.a);
                }

                float3 n = normalize(i.normalWS);
                if (!front) n = -n;
                if (_UseNormal > 0.5)
                {
                    float3 t = normalize(i.tangentWS.xyz);
                    float3 b = cross(n, t) * (i.tangentWS.w > 0 ? 1 : -1);
                    half3 nt = UnpackNormal(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, i.uv));
                    n = normalize(nt.x * t + nt.y * b + nt.z * n);
                }
                float3 v = GetWorldSpaceNormalizeViewDir(i.positionWS);
                float4 shadowCoord = TransformWorldToShadowCoord(i.positionWS);
                Light sun = GetMainLight(shadowCoord, i.positionWS, half4(1,1,1,1));

                half ndl = saturate(dot(n, sun.direction));
                half lit = ndl * sun.shadowAttenuation;
                half luz = lerp(Ramp(lit), 0.38 + 0.62 * lit, _Suave);
                half3 diffuse = luz * sun.color * sun.distanceAttenuation;

                // luz ambiente (céu / chão) com um pouco de oclusão da tela
                half3 ambient = SampleSH(n);
                half ao = 1;
                #if defined(_SCREEN_SPACE_OCCLUSION)
                    AmbientOcclusionFactor aof = GetScreenSpaceAmbientOcclusion(GetNormalizedScreenSpaceUV(i.positionCS));
                    ao = aof.indirectAmbientOcclusion;
                    diffuse *= lerp(1, aof.directAmbientOcclusion, 0.5);
                #endif

                // luzes extras (lâmpadas, brilho dos lendários)
                half3 extra = 0;
                #if defined(_ADDITIONAL_LIGHTS)
                    InputData inputData = (InputData)0;
                    inputData.positionWS = i.positionWS;
                    inputData.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(i.positionCS);
                    uint count = GetAdditionalLightsCount();
                    LIGHT_LOOP_BEGIN(count)
                        Light l = GetAdditionalLight(lightIndex, i.positionWS, half4(1,1,1,1));
                        half nl = saturate(dot(n, l.direction));
                        extra += l.color * (l.distanceAttenuation * l.shadowAttenuation) * smoothstep(0.0, 0.3, nl);
                    LIGHT_LOOP_END
                #endif

                half3 color = albedo.rgb * (diffuse * 0.62 + ambient * 0.55 * ao + extra);

                // luz de borda, mais forte nas partes de cima
                half rim = pow(1.0 - saturate(dot(n, v)), 3.0) * smoothstep(-0.2, 0.6, n.y + 0.3);
                color += half3(1.0, 0.96, 0.88) * rim * _Rim * (0.6 + 0.4 * albedo.rgb) * (0.5 + 0.5 * lit);

                color += _EmissionColor.rgb;
                color = MixFog(color, i.fog);
                return half4(color, albedo.a);
            }
            ENDHLSL
        }

        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode"="ShadowCaster" }
            ZWrite On
            ZTest LEqual
            ColorMask 0
            Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"

            float3 _LightDirection;
            float3 _LightPosition;

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; };

            Varyings vert(Attributes v)
            {
                UNITY_SETUP_INSTANCE_ID(v);
                Varyings o;
                float3 ws = ApplyWind(v.positionOS.xyz, TransformObjectToWorld(v.positionOS.xyz));
                float3 nws = TransformObjectToWorldNormal(v.normalOS);
                #if _CASTING_PUNCTUAL_LIGHT_SHADOW
                    float3 ld = normalize(_LightPosition - ws);
                #else
                    float3 ld = _LightDirection;
                #endif
                float4 cs = TransformWorldToHClip(ApplyShadowBias(ws, nws, ld));
                #if UNITY_REVERSED_Z
                    cs.z = min(cs.z, UNITY_NEAR_CLIP_VALUE);
                #else
                    cs.z = max(cs.z, UNITY_NEAR_CLIP_VALUE);
                #endif
                o.positionCS = cs;
                o.uv = TRANSFORM_TEX(v.uv, _BaseMap);
                return o;
            }

            half4 frag(Varyings i) : SV_Target
            {
                half a = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, i.uv).a * _BaseColor.a;
                clip(a - max(_Cutoff, 0.001));
                return 0;
            }
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode"="DepthOnly" }
            ZWrite On
            ColorMask R
            Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; };
            Varyings vert(Attributes v)
            {
                UNITY_SETUP_INSTANCE_ID(v);
                Varyings o;
                o.positionCS = TransformWorldToHClip(ApplyWind(v.positionOS.xyz, TransformObjectToWorld(v.positionOS.xyz)));
                o.uv = TRANSFORM_TEX(v.uv, _BaseMap);
                return o;
            }
            half4 frag(Varyings i) : SV_Target
            {
                if (_Cutoff > 0) clip(SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, i.uv).a * _BaseColor.a - _Cutoff);
                return 0;
            }
            ENDHLSL
        }

        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode"="DepthNormals" }
            ZWrite On
            Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float3 normalWS : TEXCOORD0; float2 uv : TEXCOORD1; };
            Varyings vert(Attributes v)
            {
                UNITY_SETUP_INSTANCE_ID(v);
                Varyings o;
                o.positionCS = TransformWorldToHClip(ApplyWind(v.positionOS.xyz, TransformObjectToWorld(v.positionOS.xyz)));
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                o.uv = TRANSFORM_TEX(v.uv, _BaseMap);
                return o;
            }
            half4 frag(Varyings i, bool front : SV_IsFrontFace) : SV_Target
            {
                if (_Cutoff > 0) clip(SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, i.uv).a * _BaseColor.a - _Cutoff);
                float3 n = normalize(i.normalWS);
                return half4(front ? n : -n, 0);
            }
            ENDHLSL
        }
    }
}
