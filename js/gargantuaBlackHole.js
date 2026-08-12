import * as THREE from "three";

export const blackHoleVertexShader = `
varying vec3 vWorldPosition;

void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const blackHoleFragmentShader = `
uniform float uTime;
uniform vec3 uCenter;
uniform float uHorizonRadius;
uniform float uPhotonRadius;
uniform float uInnerRadius;
uniform float uOuterRadius;
uniform float uInfluenceRadius;
uniform float uStepSize;
uniform float uBendStrength;
uniform float uDiskSpin;
uniform float uDiskBrightness;
uniform float uDiskThickness;
uniform float uPhotonBrightness;
uniform float uDoppler;
uniform float uGlowIntensity;
uniform float uSpikeStrength;
uniform float uAuraRadius;
uniform vec3 uInnerColor;
uniform vec3 uOuterColor;
uniform float uPass;

varying vec3 vWorldPosition;

const int MAX_STEPS = 200;

float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
        f.y
    );
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) {
        v += a * vnoise(p);
        p = m * p;
        a *= 0.5;
    }
    return v;
}

vec3 diskColor(float r, float angle) {
    float t = clamp((r - uInnerRadius) / (uOuterRadius - uInnerRadius), 0.0, 1.0);
    float heat = 1.0 - t;

    float omega = uTime * uDiskSpin * pow(uInnerRadius / r, 1.5);
    float a = angle + omega;

    vec2 q = vec2(cos(a), sin(a)) * r;

    float f1 = fbm(q * 0.55);
    float f2 = fbm(q * 1.7 + 7.13);
    float f3 = fbm(q * 5.1 + 13.7);

    float bands = 0.55 + 0.45 * sin(t * 40.0 + f2 * 7.0);
    float dust = 0.55 + 0.75 * f3;

    vec3 col = mix(uOuterColor, vec3(1.0, 0.47, 0.0), smoothstep(0.0, 0.35, heat));
    col = mix(col, vec3(1.0, 0.85, 0.35), smoothstep(0.3, 0.65, heat));
    col = mix(col, uInnerColor, smoothstep(0.6, 0.95, heat));

    float bright = pow(heat, 1.4);

    float rim = exp(-pow(t * 16.0, 2.0));
    col = mix(col, uInnerColor, min(rim * 1.2, 1.0));

    float edgeIn = smoothstep(uInnerRadius, uInnerRadius * 1.15, r);
    float edgeOut = 1.0 - smoothstep(uOuterRadius * 0.82, uOuterRadius, r);
    float falloff = edgeIn * edgeOut;

    vec3 point = vec3(cos(angle) * r, uCenter.y, sin(angle) * r);
    vec2 tangent = vec2(-sin(angle), cos(angle));
    vec3 toCam = normalize(cameraPosition - point);
    float approach = dot(vec3(tangent.x, 0.0, tangent.y), toCam);
    float doppler = 1.0 + uDoppler * approach;
    col *= doppler;
    col += uInnerColor * max(approach, 0.0) * uDoppler * 0.5;

    float intensity = (bright * 0.85 + rim * 4.0) * (0.7 + 0.5 * f1) * (0.5 + 0.6 * bands) * (0.5 + 0.6 * dust) * falloff;
    return col * intensity * uDiskBrightness;
}

void main() {
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWorldPosition - cameraPosition);
    vec3 center = uCenter;

    vec3 oc = center - ro;
    float b = dot(rd, oc);
    float c = dot(oc, oc) - uInfluenceRadius * uInfluenceRadius;
    float disc = b * b - c;

    float periapsis = length(cross(oc, rd));

    vec3 col = vec3(0.0);
    float alpha = 0.0;

    float ringBoost = 0.0;
    float ringMix = 0.0;
    float glow = 0.0;
    bool hitHole = false;
    bool diskHit = false;
    vec3 diskCol = vec3(0.0);

    if (disc > 0.0) {
        float tEnter = max(0.0, b - sqrt(disc));
        vec3 p = ro + rd * tEnter;
        vec3 dir = rd;
        float minDist = 1e20;

        for (int i = 0; i < MAX_STEPS; i++) {
            float d = length(p - center);
            minDist = min(minDist, d);

            if (d < uHorizonRadius) {
                hitHole = true;
                break;
            }

            if (d < uInfluenceRadius) {
                vec3 g = (center - p) / d;
                float w = uHorizonRadius / d;
                float defl = min(w * w * uStepSize * uBendStrength, 0.6);
                dir = normalize(dir + g * defl);
            }

            float h = abs(p.y - center.y);
            float rr2 = length(p.xz - center.xz);
            if (rr2 > uInnerRadius * 0.9 && rr2 < uOuterRadius * 1.15 && h < uDiskThickness * 6.0) {
                glow += exp(-h / uDiskThickness) * uStepSize;
            }

            if (uPass < 0.5) {
                float prevH = p.y - center.y;
                vec3 pn = p + dir * uStepSize;
                float nextH = pn.y - center.y;

                if (prevH * nextH <= 0.0 && abs(prevH - nextH) > 1e-6) {
                    float f = clamp(prevH / (prevH - nextH), 0.0, 1.0);
                    vec3 xp = p + dir * (uStepSize * f);
                    float rr = length(xp.xz - center.xz);
                    if (rr > uInnerRadius * 0.9 && rr < uOuterRadius * 1.15) {
                        float ang = atan(xp.z - center.z, xp.x - center.x);
                        diskCol = diskColor(rr, ang);
                        diskHit = true;
                        break;
                    }
                }
                p = pn;
            } else {
                p += dir * uStepSize;
            }

            if (length(p - center) > uInfluenceRadius) {
                break;
            }
        }

        if (!hitHole) {
            float gd = (minDist - uPhotonRadius) / (uPhotonRadius * 0.35);
            ringBoost = exp(-gd * gd) * uPhotonBrightness;
            ringMix = smoothstep(uPhotonRadius, uPhotonRadius * 2.2, minDist);
        }
    }

    if (uPass < 0.5) {
        vec3 glowColor = vec3(1.0, 0.55, 0.2);
        if (hitHole) {
            col = vec3(0.0);
            alpha = 1.0;
        } else if (diskHit) {
            col = diskCol + glow * glowColor * uDiskBrightness * 0.25;
            alpha = 1.0;
        } else if (glow > 0.001) {
            col = glow * glowColor * uDiskBrightness * 0.25;
            alpha = 1.0;
        } else {
            alpha = 0.0;
        }
    } else {
        if (!hitHole) {
            vec3 ringCol = mix(uInnerColor, uOuterColor, ringMix) * ringBoost;

            vec3 diskGlowCol = vec3(1.0, 0.5, 0.15) * glow * uDiskBrightness * 0.35;

            float shadowMask = smoothstep(uPhotonRadius * 1.02, uPhotonRadius * 1.5, periapsis);
            float aura = exp(-pow((periapsis - uHorizonRadius) / uAuraRadius, 2.0));
            vec3 auraCol = mix(uOuterColor, uInnerColor, smoothstep(uPhotonRadius, uPhotonRadius * 2.5, periapsis));
            auraCol *= aura * shadowMask * 0.8;

            float spike = 0.0;
            if (periapsis < uAuraRadius * 1.5) {
                vec3 holeDir = normalize(center - ro);
                vec3 right = normalize(cross(holeDir, vec3(0.0, 1.0, 0.0)) + 1e-6);
                vec3 up = normalize(cross(right, holeDir));
                float ang = max(acos(clamp(dot(holeDir, rd), -1.0, 1.0)), 1e-4);
                vec2 off = vec2(dot(rd, right), dot(rd, up)) / ang;
                spike = pow(max(0.0, 1.0 - abs(off.x)), 6.0) * pow(max(0.0, 1.0 - abs(off.y)), 6.0);
            }

            col = (ringCol + diskGlowCol + auraCol) * uGlowIntensity;
            col += uInnerColor * spike * aura * uSpikeStrength * uGlowIntensity;

            alpha = 1.0;
            if (max(col.r, max(col.g, col.b)) <= 0.001) {
                alpha = 0.0;
            }
        } else {
            alpha = 0.0;
        }
    }

    if (alpha <= 0.001) {
        discard;
    }

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

export const DEFAULT_GARGANTUA_CONFIG = {
    blackHoleDistance: 300,
    blackHoleScale: 6,
    direction: new THREE.Vector3(-0.7, 0.12, -0.75).normalize(),
    domeRadius: 2000,
    horizonRadius: 6,
    photonRadius: 9,
    innerRadius: 14.4,
    outerRadius: 31.2,
    influenceRadius: 48,
    stepSize: 0.9,
    bendStrength: 1.2,
    diskSpin: 0.22,
    diskBrightness: 1.7,
    diskThickness: 0.5,
    photonBrightness: 5.0,
    doppler: 0.55,
    glowIntensity: 1.25,
    spikeStrength: 0.5,
    auraRadius: 18,
    innerColor: new THREE.Color(1.0, 1.0, 1.0),
    outerColor: new THREE.Color(1.0, 0.133, 0.0)
};

export function createGargantuaBlackHole(config = {}) {
    const settings = { ...DEFAULT_GARGANTUA_CONFIG, ...config };
    settings.innerColor = new THREE.Color(settings.innerColor);
    settings.outerColor = new THREE.Color(settings.outerColor);

    const group = new THREE.Group();
    group.position.copy(
        settings.direction.clone().multiplyScalar(settings.blackHoleDistance)
    );
    group.userData = {
        type: "black-hole",
        title: "Black Hole",
        description:
            "A Gargantua-style black hole rendered with GPU raymarching: gravitational lensing bends the accretion disk light over and under the event horizon.",
        note: "Cinematic visualization based on a simplified Schwarzschild light-bending model."
    };

    const uniforms = {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uHorizonRadius: { value: settings.horizonRadius },
        uPhotonRadius: { value: settings.photonRadius },
        uInnerRadius: { value: settings.innerRadius },
        uOuterRadius: { value: settings.outerRadius },
        uInfluenceRadius: { value: settings.influenceRadius },
        uStepSize: { value: settings.stepSize },
        uBendStrength: { value: settings.bendStrength },
        uDiskSpin: { value: settings.diskSpin },
        uDiskBrightness: { value: settings.diskBrightness },
        uDiskThickness: { value: settings.diskThickness },
        uPhotonBrightness: { value: settings.photonBrightness },
        uDoppler: { value: settings.doppler },
        uGlowIntensity: { value: settings.glowIntensity },
        uSpikeStrength: { value: settings.spikeStrength },
        uAuraRadius: { value: settings.auraRadius },
        uInnerColor: { value: settings.innerColor },
        uOuterColor: { value: settings.outerColor }
    };

    uniforms.uCenter.value.copy(group.position);

    const coreMaterial = new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uPass: { value: 0.0 } },
        vertexShader: blackHoleVertexShader,
        fragmentShader: blackHoleFragmentShader,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending
    });

    const glowMaterial = new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uPass: { value: 1.0 } },
        vertexShader: blackHoleVertexShader,
        fragmentShader: blackHoleFragmentShader,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const geometry = new THREE.SphereGeometry(settings.domeRadius, 48, 32);

    const dome = new THREE.Mesh(geometry, coreMaterial);
    dome.frustumCulled = false;
    dome.renderOrder = 5;

    const glowDome = new THREE.Mesh(geometry, glowMaterial);
    glowDome.frustumCulled = false;
    glowDome.renderOrder = 6;

    group.add(dome);
    group.add(glowDome);

    return {
        group: group,
        dome: dome,
        glowDome: glowDome,
        material: coreMaterial,
        glowMaterial: glowMaterial,
        uniforms: uniforms,
        time: uniforms.uTime,
        settings: settings
    };
}
