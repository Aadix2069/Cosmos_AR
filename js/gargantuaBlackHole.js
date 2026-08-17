import * as THREE from "three";

// ============================================================
// VERTEX SHADERS
// ============================================================

export const accretionDiskVertexShader = `
attribute float aRadius;
attribute float aAngle;
attribute float aHeight;

uniform float uTime;
uniform float uDiskRadius;

varying float vRadius;
varying float vAngle;
varying float vHeight;

void main() {
    vRadius = aRadius;
    vAngle = aAngle;
    vHeight = aHeight;
    
    // Disk rotation
    float rotatedAngle = aAngle + uTime * 0.08;
    
    // Parametric disk position
    float x = aRadius * cos(rotatedAngle);
    float z = aRadius * sin(rotatedAngle);
    float y = aHeight;
    
    vec4 modelPosition = vec4(x, y, z, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * modelPosition;
}
`;

export const accretionDiskFragmentShader = `
uniform float uTime;
uniform float uDiskRadius;

varying float vRadius;
varying float vAngle;
varying float vHeight;

// Noise functions
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
    for (int i = 0; i < 4; i++) {
        v += a * vnoise(p);
        p = m * p;
        a *= 0.5;
    }
    return v;
}

void main() {
    // Normalized radius
    float t = vRadius / uDiskRadius;
    t = clamp(t, 0.0, 1.0);
    
    // Heat gradient (inner = hotter)
    float heat = 1.0 - t;
    
    // Procedural noise
    vec2 noiseCoord = vec2(vAngle, uTime * 0.03) * 2.5;
    float n1 = fbm(noiseCoord + vRadius * 0.4);
    float n2 = fbm(noiseCoord * 1.8 + vRadius + uTime * 0.08);
    float turbulence = mix(n1, n2, 0.5);
    
    // Radial bands
    float bands = 0.6 + 0.4 * sin(t * 25.0 + turbulence * 4.0);
    
    // Color temperature gradient
    vec3 color = vec3(0.0);
    
    if (heat > 0.85) {
        // Inner: white-hot
        color = mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 1.0, 1.0), (heat - 0.85) * 6.67);
    } else if (heat > 0.65) {
        // Inner-mid: yellow
        color = mix(vec3(1.0, 0.8, 0.3), vec3(1.0, 0.95, 0.85), (heat - 0.65) * 5.0);
    } else if (heat > 0.45) {
        // Mid: orange
        color = mix(vec3(1.0, 0.5, 0.1), vec3(1.0, 0.8, 0.3), (heat - 0.45) * 5.0);
    } else if (heat > 0.25) {
        // Outer-mid: red-orange
        color = mix(vec3(0.7, 0.15, 0.05), vec3(1.0, 0.5, 0.1), (heat - 0.25) * 5.0);
    } else {
        // Outer: dark red
        color = mix(vec3(0.2, 0.02, 0.0), vec3(0.7, 0.15, 0.05), heat * 4.0);
    }
    
    // Apply variation
    color *= (0.7 + 0.3 * turbulence) * bands;
    
    // Doppler asymmetry
    float dopplerEffect = 1.0 + 0.25 * sin(vAngle);
    color *= dopplerEffect;
    
    // Intensity with Fresnel
    float fresnel = 1.0 - abs(vHeight) * 2.0;
    fresnel = max(0.0, fresnel);
    
    float intensity = heat * fresnel * (0.8 + 0.2 * turbulence) * 2.2;
    
    // Edge falloff
    float edgeFalloff = smoothstep(uDiskRadius * 0.95, uDiskRadius * 1.05, vRadius);
    intensity *= (1.0 - edgeFalloff * 0.5);
    
    gl_FragColor = vec4(color * intensity, intensity * 0.8);
}
`;

// Lensed disk shader
export const lensedDiskVertexShader = `
attribute float aRadius;
attribute float aAngle;

uniform float uTime;
uniform float uDiskRadius;
uniform float uLensingStrength;

varying float vRadius;
varying float vAngle;

void main() {
    vRadius = aRadius;
    vAngle = aAngle;
    
    float rotatedAngle = aAngle + uTime * 0.08;
    
    float x = aRadius * cos(rotatedAngle);
    float z = aRadius * sin(rotatedAngle);
    
    // Strong upward curvature
    float t = (aRadius - uDiskRadius * 0.3) / (uDiskRadius * 0.6);
    t = clamp(t, 0.0, 1.0);
    
    float curvature = uLensingStrength * (1.0 - t * t);
    float y = curvature * 1.2;
    
    vec4 modelPosition = vec4(x, y, z, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * modelPosition;
}
`;

export const lensedDiskFragmentShader = `
uniform float uTime;
uniform float uDiskRadius;

varying float vRadius;
varying float vAngle;

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

void main() {
    float t = vRadius / (uDiskRadius * 0.9);
    t = clamp(t, 0.0, 1.0);
    
    // Noise
    float n = vnoise(vec2(vAngle + uTime * 0.04, vRadius * 1.5));
    
    // Bright lensed image
    vec3 baseColor = mix(
        vec3(1.0, 0.8, 0.3),
        vec3(1.0, 1.0, 0.95),
        t
    );
    
    // Intensity brighter in middle
    float intensity = (1.0 - t * t * 0.5) * (0.75 + 0.25 * n) * 1.8;
    
    gl_FragColor = vec4(baseColor * intensity, intensity * 0.6);
}
`;

// ============================================================
// CONFIGURATION
// ============================================================

export const DEFAULT_GARGANTUA_CONFIG = {
    position: new THREE.Vector3(0, 0, 0),
    horizonRadius: 1.2,
    diskRadius: 5.5,
    diskThickness: 0.07,
    lensingStrength: 1.8
};

// ============================================================
// GEOMETRY CREATION
// ============================================================

function createAccretionDiskGeometry(diskRadius, thickness, radialSegs, angularSegs) {
    const geometry = new THREE.BufferGeometry();
    
    const positions = [];
    const radiusAttr = [];
    const angleAttr = [];
    const heightAttr = [];
    const indices = [];
    
    const innerRadius = diskRadius * 0.15;
    const outerRadius = diskRadius;
    
    for (let i = 0; i <= radialSegs; i++) {
        const r = innerRadius + (outerRadius - innerRadius) * (i / radialSegs);
        
        for (let j = 0; j <= angularSegs; j++) {
            const angle = (j / angularSegs) * Math.PI * 2;
            
            // Two layers for thickness
            for (let layer = 0; layer < 2; layer++) {
                const x = r * Math.cos(angle);
                const z = r * Math.sin(angle);
                const y = (layer === 0 ? -1 : 1) * thickness * 0.5;
                
                positions.push(x, y, z);
                radiusAttr.push(r);
                angleAttr.push(angle);
                heightAttr.push(y / thickness);
            }
        }
    }
    
    // Indices
    const verticesPerRing = (angularSegs + 1) * 2;
    
    for (let i = 0; i < radialSegs; i++) {
        for (let j = 0; j < angularSegs; j++) {
            const base = i * verticesPerRing + j * 2;
            
            indices.push(base, base + 2, base + 1);
            indices.push(base + 1, base + 2, base + 3);
        }
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('aRadius', new THREE.BufferAttribute(new Float32Array(radiusAttr), 1));
    geometry.setAttribute('aAngle', new THREE.BufferAttribute(new Float32Array(angleAttr), 1));
    geometry.setAttribute('aHeight', new THREE.BufferAttribute(new Float32Array(heightAttr), 1));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    
    geometry.computeVertexNormals();
    
    return geometry;
}

function createLensedDiskGeometry(diskRadius, radialSegs, angularSegs, isUpper) {
    const geometry = new THREE.BufferGeometry();
    
    const positions = [];
    const radiusAttr = [];
    const angleAttr = [];
    const indices = [];
    
    const innerRadius = diskRadius * 0.25;
    const outerRadius = diskRadius * 0.95;
    
    for (let i = 0; i <= radialSegs; i++) {
        const r = innerRadius + (outerRadius - innerRadius) * (i / radialSegs);
        const t = (r - innerRadius) / (outerRadius - innerRadius);
        
        for (let j = 0; j <= angularSegs; j++) {
            const angle = (j / angularSegs) * Math.PI * 2;
            
            const x = r * Math.cos(angle);
            const z = r * Math.sin(angle);
            
            const curvature = isUpper ? 1 : -1;
            const y = curvature * (1.0 - t * t) * diskRadius * 0.45;
            
            positions.push(x, y, z);
            radiusAttr.push(r);
            angleAttr.push(angle);
        }
    }
    
    // Indices
    const verticesPerRing = angularSegs + 1;
    
    for (let i = 0; i < radialSegs; i++) {
        for (let j = 0; j < angularSegs; j++) {
            const base = i * verticesPerRing + j;
            
            indices.push(base, base + verticesPerRing + 1, base + 1);
            indices.push(base, base + verticesPerRing, base + verticesPerRing + 1);
        }
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('aRadius', new THREE.BufferAttribute(new Float32Array(radiusAttr), 1));
    geometry.setAttribute('aAngle', new THREE.BufferAttribute(new Float32Array(angleAttr), 1));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    
    geometry.computeVertexNormals();
    
    return geometry;
}

// ============================================================
// MAIN CREATION FUNCTION
// ============================================================

export function createGargantuaBlackHole(config = {}) {
    const settings = { ...DEFAULT_GARGANTUA_CONFIG, ...config };
    
    const group = new THREE.Group();
    group.position.copy(settings.position);
    
    group.userData = {
        type: "black-hole",
        title: "Black Hole",
        description: "Compact black hole with lensed accretion disk",
        note: "Scientifically-inspired visualization"
    };

    // ============================================================
    // 1. EVENT HORIZON (Pure black center)
    // ============================================================
    
    const blackCore = new THREE.Mesh(
        new THREE.SphereGeometry(settings.horizonRadius, 64, 64),
        new THREE.MeshBasicMaterial({
            color: 0x000000,
            side: THREE.FrontSide,
            depthWrite: true,
            depthTest: true
        })
    );
    blackCore.renderOrder = 100;
    group.add(blackCore);

    // ============================================================
    // 2. MAIN ACCRETION DISK
    // ============================================================
    
    const diskGeometry = createAccretionDiskGeometry(
        settings.diskRadius,
        settings.diskThickness,
        96,
        192
    );
    
    const diskUniforms = {
        uTime: { value: 0 },
        uDiskRadius: { value: settings.diskRadius }
    };
    
    const diskMaterial = new THREE.ShaderMaterial({
        uniforms: diskUniforms,
        vertexShader: accretionDiskVertexShader,
        fragmentShader: accretionDiskFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    
    const mainDisk = new THREE.Mesh(diskGeometry, diskMaterial);
    mainDisk.renderOrder = 50;
    group.add(mainDisk);

    // ============================================================
    // 3. UPPER LENSED IMAGE
    // ============================================================
    
    const upperDiskGeometry = createLensedDiskGeometry(
        settings.diskRadius,
        80,
        160,
        true
    );
    
    const upperUniforms = {
        uTime: { value: 0 },
        uDiskRadius: { value: settings.diskRadius },
        uLensingStrength: { value: settings.lensingStrength }
    };
    
    const upperMaterial = new THREE.ShaderMaterial({
        uniforms: upperUniforms,
        vertexShader: lensedDiskVertexShader,
        fragmentShader: lensedDiskFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide
    });
    
    const upperDisk = new THREE.Mesh(upperDiskGeometry, upperMaterial);
    upperDisk.renderOrder = 60;
    group.add(upperDisk);

    // ============================================================
    // 4. LOWER LENSED IMAGE
    // ============================================================
    
    const lowerDiskGeometry = createLensedDiskGeometry(
        settings.diskRadius,
        80,
        160,
        false
    );
    
    const lowerUniforms = {
        uTime: { value: 0 },
        uDiskRadius: { value: settings.diskRadius },
        uLensingStrength: { value: settings.lensingStrength * 0.5 }
    };
    
    const lowerMaterial = new THREE.ShaderMaterial({
        uniforms: lowerUniforms,
        vertexShader: lensedDiskVertexShader,
        fragmentShader: lensedDiskFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide
    });
    
    const lowerDisk = new THREE.Mesh(lowerDiskGeometry, lowerMaterial);
    lowerDisk.scale.y = -1;
    lowerDisk.renderOrder = 40;
    group.add(lowerDisk);

    // Store for animation
    group.userData.materials = [diskMaterial, upperMaterial, lowerMaterial];
    group.userData.uniforms = [diskUniforms, upperUniforms, lowerUniforms];

    return {
        group: group,
        blackCore: blackCore,
        mainDisk: mainDisk,
        upperDisk: upperDisk,
        lowerDisk: lowerDisk,
        settings: settings
    };
}
