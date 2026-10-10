// Céu em degradê (topo, horizonte, base), com brilho do sol e nuvens procedurais.
// Usado como Skybox; as cores vêm do clima do mapa (ceus.json).
Shader "Criaturas/Ceu"
{
    Properties
    {
        _Top ("Topo", Color) = (0.25, 0.56, 0.9, 1)
        _Horizon ("Horizonte", Color) = (0.81, 0.93, 1, 1)
        _Bottom ("Base", Color) = (0.72, 0.87, 0.94, 1)
        _SunGlow ("Brilho do sol", Color) = (1, 0.95, 0.82, 1)
        _SunDir ("Direção do sol", Vector) = (0.55, 0.78, 0.35, 0)
        _Cloud ("Nuvem", Color) = (1,1,1,1)
        _CloudShade ("Sombra da nuvem", Color) = (0.66, 0.77, 0.88, 1)
        _Clouds ("Quantidade de nuvens", Range(0,1)) = 0.5
    }
    SubShader
    {
        Tags { "Queue"="Background" "RenderType"="Background" "PreviewType"="Skybox" "RenderPipeline"="UniversalPipeline" }
        Cull Off ZWrite Off
        Pass
        {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float4 _Top, _Horizon, _Bottom, _SunGlow, _SunDir, _Cloud, _CloudShade;
                float _Clouds;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 dir : TEXCOORD0; };

            Varyings vert(Attributes v)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(v.positionOS.xyz);
                o.dir = v.positionOS.xyz;
                return o;
            }

            float hash(float2 p) { return frac(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
            float noise(float2 p)
            {
                float2 i = floor(p), f = frac(p);
                f = f * f * (3 - 2 * f);
                return lerp(lerp(hash(i), hash(i + float2(1, 0)), f.x), lerp(hash(i + float2(0, 1)), hash(i + float2(1, 1)), f.x), f.y);
            }
            float fbm(float2 p)
            {
                float s = 0, a = 0.5;
                for (int k = 0; k < 5; k++) { s += noise(p) * a; p *= 2.03; a *= 0.5; }
                return s;
            }

            half4 frag(Varyings i) : SV_Target
            {
                float3 d = normalize(i.dir);
                float y = d.y;
                half3 col = y > 0 ? lerp(_Horizon.rgb, _Top.rgb, pow(saturate(y), 0.55)) : lerp(_Horizon.rgb, _Bottom.rgb, saturate(-y * 4));
                float3 s = normalize(_SunDir.xyz);
                float sd = saturate(dot(d, s));
                col += _SunGlow.rgb * (pow(sd, 400) * 3 + pow(sd, 18) * 0.35 + pow(sd, 4) * 0.12);
                if (_Clouds > 0 && y > 0.02)
                {
                    float2 uv = d.xz / (y + 0.12) * 1.3 + float2(_Time.y * 0.004, 0);
                    float c = fbm(uv);
                    float cov = smoothstep(0.62 - _Clouds * 0.2, 0.85, c) * smoothstep(0.02, 0.2, y);
                    float shade = smoothstep(0.55, 0.9, fbm(uv + 0.15));
                    half3 cc = lerp(_CloudShade.rgb, _Cloud.rgb, shade * 0.7 + 0.3 + sd * 0.2);
                    col = lerp(col, cc, cov * 0.9);
                }
                return half4(col, 1);
            }
            ENDHLSL
        }
    }
}
