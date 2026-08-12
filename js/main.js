import * as THREE from "three";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { VRButton } from "three/addons/webxr/VRButton.js";

import { createGargantuaBlackHole } from "./gargantuaBlackHole.js";






const scene = new THREE.Scene();






const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    5000
);

camera.position.set(0, 45, 95);






const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.toneMapping = THREE.ACESFilmicToneMapping;

renderer.toneMappingExposure = 1.1;

document.body.appendChild(renderer.domElement);






const controls = new OrbitControls(
    camera,
    renderer.domElement
);

controls.enableDamping = true;

controls.dampingFactor = 0.05;

controls.minDistance = 8;

controls.maxDistance = 500;

controls.target.set(0, 0, 0);

renderer.xr.enabled = true;

renderer.xr.addEventListener("sessionstart", () => {
    controls.enabled = false;
});

renderer.xr.addEventListener("sessionend", () => {
    controls.enabled = true;
});

document.body.appendChild(VRButton.createButton(renderer));








const SunSystem = new THREE.Group();
scene.add(SunSystem);

const InnerSolarSystem = new THREE.Group();
scene.add(InnerSolarSystem);

const OuterSolarSystem = new THREE.Group();
scene.add(OuterSolarSystem);

const DwarfPlanetsGroup = new THREE.Group();
scene.add(DwarfPlanetsGroup);

const KuiperBeltGroup = new THREE.Group();
scene.add(KuiperBeltGroup);

const OortCloudGroup = new THREE.Group();
scene.add(OortCloudGroup);

const SolarWindGroup = new THREE.Group();
scene.add(SolarWindGroup);






const loadingStatus =
    document.querySelector("#loading-screen p");

const minLoadingTime = 700;

const loadStartTime = performance.now();


function hideLoadingScreen() {

    const elapsed =
        performance.now() - loadStartTime;

    const wait =
        Math.max(0, minLoadingTime - elapsed);

    setTimeout(() => {

        const loadingScreen =
            document.getElementById("loading-screen");

        loadingScreen.classList.add("hidden");

    }, wait);
}


const loadingManager =
    new THREE.LoadingManager();

loadingManager.onProgress = (url, loaded, total) => {

    if (loadingStatus) {

        loadingStatus.textContent =
            `Loading Solar System... ` +
            `${Math.round((loaded / total) * 100)}%`;
    }
};

loadingManager.onLoad = () => {

    hideLoadingScreen();
};

loadingManager.onError = (url) => {

    console.error("Failed to load asset:", url);
};


setTimeout(hideLoadingScreen, 12000);


const textureLoader =
    new THREE.TextureLoader(loadingManager);






const milkyWayTexture = textureLoader.load(
    "../assets/space/stars_milky_way.jpg"
);

milkyWayTexture.colorSpace = THREE.SRGBColorSpace;

milkyWayTexture.mapping =
    THREE.EquirectangularReflectionMapping;

milkyWayTexture.anisotropy =
    renderer.capabilities.getMaxAnisotropy();

scene.background = milkyWayTexture;











const SOLAR_LIGHT = {
    color: 0xfff4e0,
    intensity: 12,
    distance: 0,
    decay: 0.8
};

const sunLight = new THREE.PointLight(
    SOLAR_LIGHT.color,
    SOLAR_LIGHT.intensity,
    SOLAR_LIGHT.distance,
    SOLAR_LIGHT.decay
);

sunLight.position.set(0, 0, 0);

SunSystem.add(sunLight);




const ambientLight = new THREE.AmbientLight(
    0xffffff,
    0.15
);

scene.add(ambientLight);






const SUN_RADIUS = 5;


const sunTexture = textureLoader.load(
    "../assets/sun/sun.jpg"
);

sunTexture.colorSpace = THREE.SRGBColorSpace;

sunTexture.anisotropy =
    renderer.capabilities.getMaxAnisotropy();


const sun = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS, 64, 64),
    new THREE.MeshBasicMaterial({
        map: sunTexture
    })
);

SunSystem.add(sun);






const corona = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS * 1.22, 48, 48),
    new THREE.MeshBasicMaterial({
        color: 0xffa040,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    })
);

SunSystem.add(corona);






function createGlowTexture() {

    const size = 256;

    const canvas = document.createElement("canvas");

    canvas.width = size;

    canvas.height = size;

    const ctx = canvas.getContext("2d");

    const gradient =
        ctx.createRadialGradient(
            size / 2, size / 2, 0,
            size / 2, size / 2, size / 2
        );

    gradient.addColorStop(0.0, "rgba(255, 225, 160, 1)");
    gradient.addColorStop(0.25, "rgba(255, 180, 80, 0.8)");
    gradient.addColorStop(0.55, "rgba(255, 130, 40, 0.35)");
    gradient.addColorStop(1.0, "rgba(255, 110, 20, 0)");

    ctx.fillStyle = gradient;

    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}


function createGlowSprite(scale, opacity) {

    const material = new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        opacity: opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const sprite = new THREE.Sprite(material);

    sprite.scale.setScalar(scale);

    SunSystem.add(sprite);

    return sprite;
}


const glowTexture = createGlowTexture();

const SUN_GLOW_BASE = 26;

const SUN_HALO_BASE = 50;

const sunGlow = createGlowSprite(SUN_GLOW_BASE, 0.9);

const sunHalo = createGlowSprite(SUN_HALO_BASE, 0.32);









const ORBIT_AU = {

    Mercury: 0.387,
    Venus: 0.723,
    Earth: 1.0,
    Mars: 1.524,
    Jupiter: 5.203,
    Saturn: 9.537,
    Uranus: 19.191,
    Neptune: 30.07

};

const MAX_AU =
    Math.max(...Object.values(ORBIT_AU));












const DISTANCE_COMPRESSION = {
    power: 0.45,
    maxVisualDistance: 57
};


function compressedDistance(au) {

    const { power, maxVisualDistance } =
        DISTANCE_COMPRESSION;

    const scale =
        maxVisualDistance /
        Math.pow(MAX_AU, power);

    return scale * Math.pow(au, power);
}









const PLANET_DATA = [

    {
        name: "Mercury",
        radius: 0.7,
        orbitSpeed: 0.12,
        rotationSpeed: 0.25,
        axialTilt: 0.03,
        startAngle: 0.6,
        distanceAU: 0.387,
        texturePath: "../assets/textures/mercury.jpg"
    },

    {
        name: "Venus",
        radius: 1.0,
        orbitSpeed: 0.09,
        rotationSpeed: 0.2,
        axialTilt: 177.4,
        startAngle: 1.8,
        distanceAU: 0.723,
        texturePath: "../assets/textures/venus_surface.jpg",
        atmosphere: {
            texturePath: "../assets/textures/venus_atmosphere.jpg",
            scale: 1.05,
            opacity: 0.3
        }
    },

    {
        name: "Earth",
        radius: 1.1,
        orbitSpeed: 0.075,
        rotationSpeed: 0.6,
        axialTilt: 23.44,
        startAngle: 3.0,
        distanceAU: 1.0,
        texturePath: "../assets/textures/earth_daymap.jpg",
        nightLights: {
            texturePath: "../assets/textures/earth_nightmap.jpg",
            scale: 1.005,
            opacity: 0.75
        },
        moons: [
            {
                name: "Moon",
                distance: 2.9,
                radius: 0.28,
                orbitSpeed: 0.7,
                color: 0xbbbbbb
            }
        ]
    },

    {
        name: "Mars",
        radius: 0.85,
        orbitSpeed: 0.06,
        rotationSpeed: 0.5,
        axialTilt: 25.19,
        startAngle: 4.2,
        distanceAU: 1.524,
        texturePath: "../assets/textures/mars.jpg",
        moons: [
            {
                name: "Phobos",
                distance: 1.85,
                radius: 0.09,
                orbitSpeed: 1.6,
                color: 0x8a6f5e
            },
            {
                name: "Deimos",
                distance: 2.7,
                radius: 0.06,
                orbitSpeed: 0.9,
                color: 0x8b8076
            }
        ]
    },

    {
        name: "Jupiter",
        radius: 3.0,
        orbitSpeed: 0.045,
        rotationSpeed: 1.2,
        axialTilt: 3.13,
        startAngle: 5.4,
        distanceAU: 5.203,
        texturePath: "../assets/textures/jupiter.jpg",
        rings: {
            inner: 3.5,
            outer: 4.5,
            color: 0x9aa2aa,
            opacity: 0.12
        },
        moons: [
            {
                name: "Io",
                distance: 5.4,
                radius: 0.17,
                orbitSpeed: 1.3,
                color: 0xd8b25a
            },
            {
                name: "Europa",
                distance: 6.1,
                radius: 0.14,
                orbitSpeed: 1.0,
                color: 0xcbc4ac
            },
            {
                name: "Ganymede",
                distance: 7.3,
                radius: 0.23,
                orbitSpeed: 0.8,
                color: 0x9c8f7c
            },
            {
                name: "Callisto",
                distance: 8.5,
                radius: 0.2,
                orbitSpeed: 0.6,
                color: 0x6f6559
            }
        ]
    },

    {
        name: "Saturn",
        radius: 2.5,
        orbitSpeed: 0.035,
        rotationSpeed: 1.0,
        axialTilt: 26.73,
        startAngle: 0.9,
        distanceAU: 9.537,
        texturePath: "../assets/textures/saturn.jpg",
        rings: {
            inner: 3.2,
            outer: 5.0,
            texturePath: "../assets/textures/saturn_ring_alpha.png"
        },
        moons: [
            {
                name: "Enceladus",
                distance: 4.0,
                radius: 0.08,
                orbitSpeed: 1.5,
                color: 0xe3eaee
            },
            {
                name: "Rhea",
                distance: 4.9,
                radius: 0.12,
                orbitSpeed: 1.2,
                color: 0xb8b8b0
            },
            {
                name: "Titan",
                distance: 5.3,
                radius: 0.2,
                orbitSpeed: 1.1,
                color: 0xd9a84e
            },
            {
                name: "Iapetus",
                distance: 7.5,
                radius: 0.12,
                orbitSpeed: 0.7,
                color: 0x9a8c78
            }
        ]
    },

    {
        name: "Uranus",
        radius: 1.7,
        orbitSpeed: 0.028,
        rotationSpeed: 0.7,
        axialTilt: 97.77,
        startAngle: 2.4,
        distanceAU: 19.191,
        texturePath: "../assets/textures/uranus.jpg",
        rings: {
            inner: 1.8,
            outer: 2.25,
            color: 0x8fb0cc,
            opacity: 0.1
        },
        moons: [
            {
                name: "Miranda",
                distance: 4.4,
                radius: 0.06,
                orbitSpeed: 1.6,
                color: 0x9a938c
            },
            {
                name: "Ariel",
                distance: 5.2,
                radius: 0.09,
                orbitSpeed: 1.3,
                color: 0x8f8a86
            },
            {
                name: "Umbriel",
                distance: 5.5,
                radius: 0.09,
                orbitSpeed: 1.2,
                color: 0x7a7572
            },
            {
                name: "Titania",
                distance: 7.0,
                radius: 0.13,
                orbitSpeed: 0.9,
                color: 0x96918c
            },
            {
                name: "Oberon",
                distance: 7.9,
                radius: 0.12,
                orbitSpeed: 0.8,
                color: 0x8b857f
            }
        ]
    },

    {
        name: "Neptune",
        radius: 1.65,
        orbitSpeed: 0.022,
        rotationSpeed: 0.7,
        axialTilt: 28.32,
        startAngle: 3.8,
        distanceAU: 30.07,
        texturePath: "../assets/textures/neptune.jpg",
        rings: {
            inner: 1.8,
            outer: 2.05,
            color: 0x8fa8c8,
            opacity: 0.07
        },
        moons: [
            {
                name: "Triton",
                distance: 4.1,
                radius: 0.17,
                orbitSpeed: 0.9,
                color: 0xcbbfa4
            }
        ]
    }

];











const DWARF_PLANET_DATA = [

    {
        name: "Ceres",
        radius: 0.3,
        distanceAU: 2.77,
        orbitSpeed: 0.05,
        rotationSpeed: 0.06,
        startAngle: 1.1,
        texturePath: "../assets/4k_ceres_fictional.jpg"
    },

    {
        name: "Pluto",
        radius: 0.42,
        distanceAU: 39.5,
        orbitSpeed: 0.018,
        rotationSpeed: 0.04,
        startAngle: 4.3,
        color: 0xc9b29a
    },

    {
        name: "Haumea",
        radius: 0.35,
        distanceAU: 43.1,
        orbitSpeed: 0.015,
        rotationSpeed: 0.05,
        startAngle: 0.4,
        texturePath: "../assets/2k_haumea_fictional.jpg",
        stretch: 2.0
    },

    {
        name: "Makemake",
        radius: 0.32,
        distanceAU: 45.8,
        orbitSpeed: 0.014,
        rotationSpeed: 0.05,
        startAngle: 2.7,
        texturePath: "../assets/4k_makemake_fictional.jpg"
    },

    {
        name: "Eris",
        radius: 0.42,
        distanceAU: 67.7,
        orbitSpeed: 0.01,
        rotationSpeed: 0.04,
        startAngle: 5.1,
        texturePath: "../assets/2k_eris_fictional.jpg"
    }

];










function roundedRectPath(ctx, x, y, w, h, r) {

    ctx.beginPath();

    ctx.moveTo(x + r, y);

    ctx.arcTo(x + w, y, x + w, y + h, r);

    ctx.arcTo(x + w, y + h, x, y + h, r);

    ctx.arcTo(x, y + h, x, y, r);

    ctx.arcTo(x, y, x + w, y, r);

    ctx.closePath();
}


function createLabelTexture(text) {

    const fontPx = 56;

    const font =
        `600 ${fontPx}px "Segoe UI", Arial, sans-serif`;

    const canvas = document.createElement("canvas");

    const ctx = canvas.getContext("2d");

    ctx.font = font;

    const textWidth =
        Math.ceil(ctx.measureText(text).width);

    const padX = Math.ceil(fontPx * 0.65);

    const padY = Math.ceil(fontPx * 0.3);

    const w = textWidth + padX * 2;

    const h = fontPx + padY * 2;

    canvas.width = w;

    canvas.height = h;

    ctx.font = font;

    ctx.textAlign = "center";

    ctx.textBaseline = "middle";

    ctx.fillStyle = "rgba(8, 10, 26, 0.55)";

    roundedRectPath(ctx, 0, 0, w, h, h / 2);

    ctx.fill();

    ctx.shadowColor = "rgba(120, 180, 255, 0.8)";

    ctx.shadowBlur = 10;

    ctx.fillStyle = "#ffffff";

    ctx.fillText(text, w / 2, h / 2 + 1);

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}


function createLabel(name, baseHeight) {

    const texture = createLabelTexture(name);

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
    });

    const sprite = new THREE.Sprite(material);

    const aspect =
        texture.image.width / texture.image.height;

    sprite.scale.set(
        baseHeight * aspect,
        baseHeight,
        1
    );

    sprite.userData.aspect = aspect;

    sprite.userData.baseHeight = baseHeight;

    sprite.renderOrder = 30;

    return sprite;
}






const labelRegistry = [];

const LABEL_REFERENCE_DISTANCE = 70;


function registerLabel(sprite) {

    labelRegistry.push(sprite);
}


function updateLabelScales() {

    for (const sprite of labelRegistry) {

        sprite.getWorldPosition(_vectorA);

        const distance =
            camera.position.distanceTo(_vectorA);

        const factor =
            THREE.MathUtils.clamp(
                distance / LABEL_REFERENCE_DISTANCE,
                0.6,
                1.6
            );

        const height =
            sprite.userData.baseHeight * factor;

        sprite.scale.set(
            height * sprite.userData.aspect,
            height,
            1
        );
    }
}






function createOrbitLine(radius, color = 0x6688cc, opacity = 0.22) {

    const points = [];

    const segments = 128;

    for (
        let i = 0;
        i <= segments;
        i++
    ) {

        const angle =
            (i / segments) *
            Math.PI *
            2;

        points.push(
            new THREE.Vector3(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            )
        );
    }


    const geometry =
        new THREE.BufferGeometry()
            .setFromPoints(points);


    const material =
        new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity
        });


    const orbit =
        new THREE.LineLoop(
            geometry,
            material
        );

    scene.add(orbit);

    return orbit;
}


















function createPlanet(data, parentGroup) {

    const orbit = new THREE.Group();

    orbit.rotation.y = data.startAngle;

    parentGroup.add(orbit);


    const visualDistance =
        compressedDistance(data.distanceAU);


    const pivot = new THREE.Group();

    pivot.position.x = visualDistance;

    orbit.add(pivot);


    const tilt = new THREE.Group();

    tilt.rotation.z =
        THREE.MathUtils.degToRad(data.axialTilt);

    pivot.add(tilt);


    const texture = textureLoader.load(data.texturePath);

    texture.colorSpace = THREE.SRGBColorSpace;

    texture.anisotropy =
        renderer.capabilities.getMaxAnisotropy();


    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(data.radius, 48, 48),
        new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.9,
            metalness: 0.0
        })
    );

    tilt.add(mesh);


    mesh.userData = {
        name: data.name,
        distance: visualDistance
    };


    
    
    

    if (data.atmosphere) {

        const atmosphereTexture =
            textureLoader.load(data.atmosphere.texturePath);

        atmosphereTexture.colorSpace = THREE.SRGBColorSpace;


        const atmosphere = new THREE.Mesh(
            new THREE.SphereGeometry(
                data.radius * data.atmosphere.scale,
                48,
                48
            ),
            new THREE.MeshBasicMaterial({
                map: atmosphereTexture,
                transparent: true,
                opacity: data.atmosphere.opacity,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );

        mesh.add(atmosphere);
    }


    
    
    

    if (data.nightLights) {

        const nightTexture =
            textureLoader.load(data.nightLights.texturePath);

        nightTexture.colorSpace = THREE.SRGBColorSpace;


        const night = new THREE.Mesh(
            new THREE.SphereGeometry(
                data.radius * data.nightLights.scale,
                48,
                48
            ),
            new THREE.MeshBasicMaterial({
                map: nightTexture,
                transparent: true,
                opacity: data.nightLights.opacity,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );

        mesh.add(night);
    }


    
    
    

    if (data.rings) {

        const ringGeometry =
            new THREE.RingGeometry(
                data.rings.inner,
                data.rings.outer,
                128
            );

        let ringMaterial;

        if (data.rings.texturePath) {

            const ringTexture =
                textureLoader.load(data.rings.texturePath);

            ringTexture.colorSpace = THREE.SRGBColorSpace;

            
            
            const ringPosition =
                ringGeometry.attributes.position;

            const ringUv =
                ringGeometry.attributes.uv;

            for (let i = 0; i < ringPosition.count; i++) {

                const x = ringPosition.getX(i);

                const y = ringPosition.getY(i);

                const radius = Math.sqrt(x * x + y * y);

                const angle = Math.atan2(y, x);

                ringUv.setXY(
                    i,
                    (radius - data.rings.inner) /
                        (data.rings.outer - data.rings.inner),
                    (angle + Math.PI) / (Math.PI * 2)
                );
            }

            ringUv.needsUpdate = true;

            ringMaterial =
                new THREE.MeshBasicMaterial({
                    map: ringTexture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    alphaTest: 0.05
                });

        } else {

            ringMaterial =
                new THREE.MeshBasicMaterial({
                    color: data.rings.color,
                    transparent: true,
                    opacity: data.rings.opacity,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });
        }

        const rings =
            new THREE.Mesh(ringGeometry, ringMaterial);

        rings.rotation.x = Math.PI / 2;

        mesh.add(rings);
    }


    
    
    

    const moons = [];

    if (data.moons) {

        for (const moonData of data.moons) {

            const moonOrbit = new THREE.Group();

            tilt.add(moonOrbit);


            const moon = new THREE.Mesh(
                new THREE.SphereGeometry(moonData.radius, 12, 12),
                new THREE.MeshStandardMaterial({
                    color: moonData.color,
                    roughness: 0.95,
                    metalness: 0.0
                })
            );

            moon.position.x = moonData.distance;

            moonOrbit.add(moon);


            moons.push({
                orbit: moonOrbit,
                mesh: moon,
                data: moonData
            });
        }
    }


    
    
    

    const labelBaseHeight =
        THREE.MathUtils.clamp(
            data.radius * 0.9 + 0.8,
            1.3,
            2.4
        );

    const label = createLabel(data.name, labelBaseHeight);

    label.position.set(
        visualDistance,
        data.radius + labelBaseHeight * 0.75,
        0
    );

    orbit.add(label);

    registerLabel(label);


    mesh.userData.label = label;


    return {
        orbit: orbit,
        pivot: pivot,
        tilt: tilt,
        mesh: mesh,
        moons: moons,
        label: label,
        data: data
    };
}


const planets = [];

for (const data of PLANET_DATA) {

    const isInner =
        data.distanceAU < 2;

    const planet = createPlanet(
        data,
        isInner ? InnerSolarSystem : OuterSolarSystem
    );

    planets.push(planet);
}










function createAsteroidBelt({
    count,
    inner,
    outer,
    thickness,
    size,
    color,
    peakedness = 3
}) {

    const geometry =
        new THREE.IcosahedronGeometry(size, 0);

    const material =
        new THREE.MeshStandardMaterial({
            color: color,
            roughness: 1.0,
            metalness: 0.0,
            flatShading: true
        });

    const instanced =
        new THREE.InstancedMesh(geometry, material, count);

    const dummy = new THREE.Object3D();

    
    const radial = () => {
        let t = 0;
        for (let i = 0; i < peakedness; i++) t += Math.random();
        return t / peakedness;
    };

    for (let i = 0; i < count; i++) {

        const angle = Math.random() * Math.PI * 2;

        const radius =
            inner + (outer - inner) * radial();

        dummy.position.set(
            Math.cos(angle) * radius,
            (Math.random() - 0.5) * thickness,
            Math.sin(angle) * radius
        );

        dummy.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );

        const s = 0.6 + Math.random() * 1.6;

        dummy.scale.set(s, s, s);

        dummy.updateMatrix();

        instanced.setMatrixAt(i, dummy.matrix);
    }

    instanced.instanceMatrix.needsUpdate = true;

    return instanced;
}




const asteroidBelt = createAsteroidBelt({
    count: 2200,
    inner: 16.8,
    outer: 24.6,
    thickness: 0.9,
    size: 0.1,
    color: 0x9a8f80
});

scene.add(asteroidBelt);













function createDwarfPlanet(data) {

    const orbit = new THREE.Group();

    orbit.rotation.y = data.startAngle;

    DwarfPlanetsGroup.add(orbit);


    const texture = data.texturePath
        ? textureLoader.load(data.texturePath)
        : null;

    if (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
    }


    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(data.radius, 24, 24),
        new THREE.MeshStandardMaterial({
            color: texture ? 0xffffff : data.color,
            map: texture || null,
            roughness: 0.95,
            metalness: 0.0
        })
    );

    mesh.position.x = compressedDistance(data.distanceAU);

    if (data.stretch) {
        mesh.scale.set(1, 1, data.stretch);
    }

    orbit.add(mesh);


    mesh.userData = {
        name: data.name,
        distance: compressedDistance(data.distanceAU),
        isDwarf: true
    };


    return { orbit, mesh, data };
}


const dwarfPlanets =
    DWARF_PLANET_DATA.map(createDwarfPlanet);



for (const dwarf of dwarfPlanets) {

    if (dwarf.data.distanceAU > 30) {

        createOrbitLine(
            compressedDistance(dwarf.data.distanceAU),
            0x99aacc,
            0.1
        );
    }
}






function createKuiperBelt({
    count,
    inner,
    outer,
    thickness,
    size,
    color,
    opacity
}) {

    const positions =
        new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {

        const angle = Math.random() * Math.PI * 2;

        
        const radius =
            inner + (outer - inner) * Math.pow(Math.random(), 1.6);

        positions[i * 3] = Math.cos(angle) * radius;

        positions[i * 3 + 1] =
            (Math.random() - 0.5) * thickness;

        positions[i * 3 + 2] = Math.sin(angle) * radius;
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
    );

    const material = new THREE.PointsMaterial({
        color: color,
        size: size,
        transparent: true,
        opacity: opacity,
        sizeAttenuation: true,
        depthWrite: false
    });

    return new THREE.Points(geometry, material);
}


const kuiperBelt = createKuiperBelt({
    count: 4500,
    inner: 56,
    outer: 74,
    thickness: 2.2,
    size: 0.5,
    color: 0xa8c6ff,
    opacity: 0.5
});

KuiperBeltGroup.add(kuiperBelt);






function createOortCloud({ count, inner, outer, size, opacity }) {

    const positions =
        new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {

        
        const u = Math.random() * 2 - 1;

        const theta = Math.random() * Math.PI * 2;

        const s = Math.sqrt(1 - u * u);

        const radius =
            inner + (outer - inner) * Math.random();

        positions[i * 3] = s * Math.cos(theta) * radius;

        positions[i * 3 + 1] = u * radius;

        positions[i * 3 + 2] = s * Math.sin(theta) * radius;
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
    );

    const material = new THREE.PointsMaterial({
        color: 0x8fb8e8,
        size: size,
        transparent: true,
        opacity: opacity,
        sizeAttenuation: true,
        depthWrite: false
    });

    return new THREE.Points(geometry, material);
}


const oortCloud = createOortCloud({
    count: 2200,
    inner: 175,
    outer: 230,
    size: 0.8,
    opacity: 0.12
});

OortCloudGroup.add(oortCloud);













function createSolarWind(count) {

    const positions =
        new Float32Array(count * 3);

    const particleData = [];

    const inner = 10;

    const outer = 56;

    for (let i = 0; i < count; i++) {

        const phi = Math.random() * Math.PI * 2;

        const radius = inner + Math.random() * (outer - inner);

        const y = (Math.random() - 0.5) * 1.6;

        positions[i * 3] = Math.cos(phi) * radius;

        positions[i * 3 + 1] = y;

        positions[i * 3 + 2] = Math.sin(phi) * radius;

        particleData.push({
            radius: radius,
            phi: phi,
            y: y,
            speed: 0.6 + Math.random() * 1.2
        });
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
    );

    const material = new THREE.PointsMaterial({
        color: 0xffe9b8,
        size: 0.14,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });

    const points = new THREE.Points(geometry, material);

    return {
        points: points,
        data: particleData,
        inner: inner,
        outer: outer
    };
}


const solarWind = createSolarWind(350);

SolarWindGroup.add(solarWind.points);


function updateSolarWind(delta) {

    const attribute =
        solarWind.points.geometry.attributes.position;

    for (let i = 0; i < solarWind.data.length; i++) {

        const p = solarWind.data[i];

        p.radius += p.speed * delta;

        if (p.radius > solarWind.outer) {

            p.radius = solarWind.inner;

            p.phi = Math.random() * Math.PI * 2;

            p.y = (Math.random() - 0.5) * 1.6;
        }

        attribute.setXYZ(
            i,
            Math.cos(p.phi) * p.radius,
            p.y,
            Math.sin(p.phi) * p.radius
        );
    }

    attribute.needsUpdate = true;
}






const heliosphere = new THREE.Mesh(
    new THREE.SphereGeometry(100, 32, 32),
    new THREE.MeshBasicMaterial({
        color: 0x6a86ff,
        transparent: true,
        opacity: 0.03,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    })
);

scene.add(heliosphere);






const BLACK_HOLE_CONFIG = {
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
    innerColor: 0xffffff,
    outerColor: 0xff2200
};








const blackHoleSystem = createGargantuaBlackHole(BLACK_HOLE_CONFIG);

scene.add(blackHoleSystem.group);

const blackHoleLabel = createLabel("BLACK HOLE", 3.5);

blackHoleLabel.position.set(
    0,
    BLACK_HOLE_CONFIG.blackHoleScale * 3.2,
    0
);

blackHoleSystem.group.add(blackHoleLabel);

registerLabel(blackHoleLabel);






const sunLabel = createLabel("Sun", 3.0);

sunLabel.position.set(0, SUN_RADIUS + 3.2, 0);

SunSystem.add(sunLabel);

registerLabel(sunLabel);






const clock =
    new THREE.Clock();

const _vectorA = new THREE.Vector3();


function animate() {

    const delta = clock.getDelta();

    const elapsed = clock.elapsedTime;

    blackHoleSystem.time.value += delta;


    
    
    

    sun.rotation.y += delta * 0.08;

    corona.rotation.y += delta * 0.02;

    const pulse =
        1 + Math.sin(elapsed * 1.2) * 0.02;

    corona.scale.setScalar(1 + Math.sin(elapsed * 0.8) * 0.02);

    sunGlow.scale.setScalar(SUN_GLOW_BASE * pulse);

    sunHalo.scale.setScalar(SUN_HALO_BASE * pulse);


    
    
    

    for (const planet of planets) {

        planet.orbit.rotation.y +=
            planet.data.orbitSpeed * delta;

        planet.mesh.rotation.y +=
            planet.data.rotationSpeed * delta;

        for (const moon of planet.moons) {

            moon.orbit.rotation.y +=
                moon.data.orbitSpeed * delta;
        }
    }


    
    
    

    for (const dwarf of dwarfPlanets) {

        dwarf.orbit.rotation.y +=
            dwarf.data.orbitSpeed * delta;

        dwarf.mesh.rotation.y +=
            dwarf.data.rotationSpeed * delta;
    }


    
    
    

    KuiperBeltGroup.rotation.y += delta * 0.0006;

    OortCloudGroup.rotation.y += delta * 0.0004;


    
    
    

    updateSolarWind(delta);



    updateLabelScales();


    
    
    

    controls.update();

    renderer.render(scene, camera);
}






window.addEventListener(
    "resize",
    () => {

        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

        renderer.setPixelRatio(
            Math.min(window.devicePixelRatio, 2)
        );
    }
);






renderer.setAnimationLoop(animate);
