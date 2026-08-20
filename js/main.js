import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";

import { createGargantuaBlackHole } from "./gargantuaBlackHole.js";
import { createISSTracker } from "./issTracker.js";
import { celestialHistory } from "./historyData.js";






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

renderer.toneMappingExposure = 0.6;

document.body.appendChild(renderer.domElement);






// ─── Input Manager (Unified Desktop + XR) ────────────────────────

const InputManager = {
    // Movement (1 = active, 0 = inactive)
    forward: 0,
    backward: 0,
    left: 0,
    right: 0,
    up: 0,
    down: 0,
    boost: 0,

    // Look (radians per frame, populated by mouse or XR)
    lookX: 0,
    lookY: 0,

    // Select action (triggered by click or XR trigger)
    select: false,

    // Pointer lock state
    isLocked: false,
    domElement: renderer.domElement,
};

// ─── Pointer Lock (Desktop) ──────────────────────────────────────

function requestPointerLock() {
    if (!InputManager.isLocked) {
        InputManager.domElement.requestPointerLock();
    }
}

document.addEventListener("pointerlockchange", () => {
    InputManager.isLocked =
        document.pointerLockElement === InputManager.domElement;

    const crosshair = document.getElementById("crosshair");
    const hint = document.getElementById("pointer-lock-hint");

    if (InputManager.isLocked) {
        crosshair.classList.add("visible");
        hint.classList.add("hidden");
    } else {
        crosshair.classList.remove("visible");
        if (!infoPanel.classList.contains("visible")) {
            hint.classList.remove("hidden");
        }
    }

    const existingHistory = infoPanelInner.querySelector(".info-history");
    if (InputManager.isLocked && currentInfoName && infoPanel.classList.contains("visible") && !existingHistory) {
        const data = CELESTIAL_DATA[currentInfoName];
        if (data) {
            const historyDiv = document.createElement("div");
            historyDiv.className = "info-history";
            historyDiv.innerHTML = `<h3>History &amp; Discovery</h3><p>${data.history}</p>`;
            const dismiss = infoPanelInner.querySelector(".info-dismiss");
            if (dismiss) dismiss.before(historyDiv);
        }
    } else if (!InputManager.isLocked && existingHistory) {
        existingHistory.remove();
    }
});

// Mouse movement → look input
document.addEventListener("mousemove", (event) => {
    if (!InputManager.isLocked) return;

    InputManager.lookX += event.movementX;
    InputManager.lookY += event.movementY;
});

// Keyboard → movement state
document.addEventListener("keydown", (event) => {
    switch (event.code) {
        case "KeyW":
        case "ArrowUp":
            InputManager.forward = 1;
            break;
        case "KeyS":
        case "ArrowDown":
            InputManager.backward = 1;
            break;
        case "KeyA":
        case "ArrowLeft":
            InputManager.left = 1;
            break;
        case "KeyD":
        case "ArrowRight":
            InputManager.right = 1;
            break;
        case "Space":
            InputManager.up = 1;
            event.preventDefault();
            break;
        case "ShiftLeft":
        case "ShiftRight":
            InputManager.down = 1;
            break;
        case "ControlLeft":
        case "ControlRight":
            break;
        case "KeyX":
            InputManager.boost = 1;
            break;
    }
});

document.addEventListener("keyup", (event) => {
    switch (event.code) {
        case "KeyW":
        case "ArrowUp":
            InputManager.forward = 0;
            break;
        case "KeyS":
        case "ArrowDown":
            InputManager.backward = 0;
            break;
        case "KeyA":
        case "ArrowLeft":
            InputManager.left = 0;
            break;
        case "KeyD":
        case "ArrowRight":
            InputManager.right = 0;
            break;
        case "Space":
            InputManager.up = 0;
            break;
        case "ShiftLeft":
        case "ShiftRight":
            InputManager.down = 0;
            break;
        case "ControlLeft":
        case "ControlRight":
            break;
        case "KeyX":
            InputManager.boost = 0;
            break;
    }
});

// ─── Flying Controller (Acceleration + Damping) ──────────────────

const FlyingController = {
    enabled: true,

    // Configurable parameters
    moveSpeed: 35,
    boostSpeed: 100,
    acceleration: 6.0,
    damping: 4.0,
    lookSensitivity: 0.002,
    maxVerticalLook: Math.PI / 2 - 0.01,

    // Internal state
    velocity: new THREE.Vector3(),
    euler: new THREE.Euler(0, 0, 0, "YXZ"),
    _targetVelocity: new THREE.Vector3(),
    _forward: new THREE.Vector3(),
    _right: new THREE.Vector3(),
    _up: new THREE.Vector3(),

    update(delta) {
        if (!this.enabled) return;

        // ── Apply look input ──
        if (InputManager.lookX !== 0 || InputManager.lookY !== 0) {
            this.euler.setFromQuaternion(camera.quaternion);

            this.euler.y -= InputManager.lookX * this.lookSensitivity;
            this.euler.x -= InputManager.lookY * this.lookSensitivity;

            this.euler.x = Math.max(
                -this.maxVerticalLook,
                Math.min(this.maxVerticalLook, this.euler.x)
            );

            camera.quaternion.setFromEuler(this.euler);

            InputManager.lookX = 0;
            InputManager.lookY = 0;
        }

        // ── Compute desired velocity ──
        this._forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
        this._right.set(1, 0, 0).applyQuaternion(camera.quaternion);
        this._up.set(0, 1, 0).applyQuaternion(camera.quaternion);

        this._targetVelocity.set(0, 0, 0);

        if (InputManager.forward) this._targetVelocity.add(this._forward);
        if (InputManager.backward) this._targetVelocity.sub(this._forward);
        if (InputManager.right) this._targetVelocity.add(this._right);
        if (InputManager.left) this._targetVelocity.sub(this._right);
        if (InputManager.up) this._targetVelocity.add(this._up);
        if (InputManager.down) this._targetVelocity.sub(this._up);

        const hasInput = this._targetVelocity.lengthSq() > 0;

        if (hasInput) {
            this._targetVelocity.normalize();
            const speed = InputManager.boost ? this.boostSpeed : this.moveSpeed;
            this._targetVelocity.multiplyScalar(speed);
        }

        // ── Smooth acceleration / deceleration ──
        const lerpFactor = hasInput
            ? 1 - Math.exp(-this.acceleration * delta)
            : 1 - Math.exp(-this.damping * delta);

        this.velocity.lerp(this._targetVelocity, lerpFactor);

        // ── Apply to camera position ──
        camera.position.addScaledVector(this.velocity, delta);
    },

    // Check if user is actively providing movement input
    hasMovementInput() {
        return (
            InputManager.forward ||
            InputManager.backward ||
            InputManager.left ||
            InputManager.right ||
            InputManager.up ||
            InputManager.down
        );
    },

    // Stop all movement (for transitions)
    stopMovement() {
        this.velocity.set(0, 0, 0);
    },
};


// ─── WebXR Setup ────────────────────────────────────────────────

renderer.xr.enabled = true;

// Add VR button for WebXR sessions
const vrButton = VRButton.createButton(renderer);


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

scene.fog = new THREE.FogExp2(0x000008, 0.0018);











const SOLAR_LIGHT = {
    color: 0xfff4e0,
    intensity: 30,
    distance: 0,
    decay: 0.45
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
    0.04
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

sun.userData = { name: "Sun", type: "star" };

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
    inner: {
        power: 0.65,
        scale: 8.5,
        offset: 0.18,
        bias: 0
    },
    asteroid: {
        power: 0.7,
        scale: 10.8,
        offset: 0.8,
        bias: 28
    },
    outer: {
        power: 0.74,
        scale: 9.2,
        offset: 1.4,
        bias: 58
    },
    deep: {
        power: 0.8,
        scale: 8.6,
        offset: 2.4,
        bias: 122
    }
};


function getZoneForAU(au) {

    if (au < 2) return "inner";
    if (au < 5) return "asteroid";
    if (au < 30) return "outer";
    return "deep";
}


function compressedDistance(au, zone = getZoneForAU(au)) {

    const { power, scale, offset, bias = 0 } =
        DISTANCE_COMPRESSION[zone] ||
        DISTANCE_COMPRESSION.outer;

    return bias + scale * Math.pow(au + offset, power);
}


function minimumGap(radiusA, radiusB, extraSpacing = 1.5) {

    return radiusA + radiusB + extraSpacing;
}


function computeOrbitDistance(data, previousPlanet) {

    const zone = getZoneForAU(data.distanceAU);
    const baseDistance = compressedDistance(data.distanceAU, zone);

    if (!previousPlanet) {
        return baseDistance;
    }

    const zoneBoost =
        zone === "inner" ? 4.2 :
        zone === "asteroid" ? 7.5 :
        zone === "outer" ? 10.5 : 16;

    const safetyGap = minimumGap(
        previousPlanet.data.radius,
        data.radius,
        zoneBoost
    );

    return Math.max(
        baseDistance,
        previousPlanet.data.visualDistance + safetyGap
    );
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

    const fontPx = 34;

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
        data.visualDistance ?? compressedDistance(data.distanceAU, getZoneForAU(data.distanceAU));


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
        distance: visualDistance,
        type: "planet"
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

            const moonLabelBaseHeight =
                THREE.MathUtils.clamp(
                    moonData.radius * 0.5 + 0.2,
                    0.3,
                    0.5
                );

            const moonLabel =
                createLabel(moonData.name, moonLabelBaseHeight);

            moonLabel.position.set(
                moonData.distance,
                moonData.radius + moonLabelBaseHeight * 0.6,
                0
            );

            moonOrbit.add(moonLabel);

            registerLabel(moonLabel);

            moons.push({
                orbit: moonOrbit,
                mesh: moon,
                data: moonData
            });
        }
    }


    
    
    

    const labelBaseHeight =
        THREE.MathUtils.clamp(
            data.radius * 0.55 + 0.5,
            0.8,
            1.5
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
let previousPlanet = null;

for (const data of PLANET_DATA) {

    const isInner =
        data.distanceAU < 2;

    data.visualDistance =
        computeOrbitDistance(data, previousPlanet);

    const planet = createPlanet(
        data,
        isInner ? InnerSolarSystem : OuterSolarSystem
    );

    planets.push(planet);
    previousPlanet = planet;
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




const marsPlanet = planets.find(
    (planet) => planet.data.name === "Mars"
);

const jupiterPlanet = planets.find(
    (planet) => planet.data.name === "Jupiter"
);

const asteroidInner = Math.max(
    compressedDistance(2.3, "asteroid"),
    marsPlanet
        ? marsPlanet.data.visualDistance + marsPlanet.data.radius + 2.5
        : 0
);

const asteroidOuter = jupiterPlanet
    ? Math.min(
        compressedDistance(3.5, "asteroid"),
        jupiterPlanet.data.visualDistance - jupiterPlanet.data.radius - 6.5
    )
    : compressedDistance(3.5, "asteroid");

const asteroidStart = Math.min(
    asteroidInner,
    asteroidOuter - 2.5
);

const asteroidEnd = Math.max(
    asteroidStart + 5.5,
    asteroidOuter
);

const asteroidBelt = createAsteroidBelt({
    count: 2200,
    inner: asteroidStart,
    outer: asteroidEnd,
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
    dwarf.mesh.position.x =
        compressedDistance(dwarf.data.distanceAU, getZoneForAU(dwarf.data.distanceAU));
    dwarf.mesh.userData.distance = dwarf.mesh.position.x;
}



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


const neptunePlanet = planets.find(
    (planet) => planet.data.name === "Neptune"
);

const kuiperInner = Math.max(
    compressedDistance(44, "deep"),
    neptunePlanet
        ? neptunePlanet.data.visualDistance + neptunePlanet.data.radius + 9.5
        : 0
);

const kuiperOuterCap = compressedDistance(74, "deep");

const kuiperOuter = Math.max(
    kuiperInner + 16,
    Math.min(kuiperOuterCap, kuiperInner + 26)
);

const kuiperBelt = createKuiperBelt({
    count: 4500,
    inner: kuiperInner,
    outer: kuiperOuter,
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
    position: new THREE.Vector3(290, 72, 220),
    horizonRadius: 1.2,
    diskRadius: 5.5,
    diskThickness: 0.07,
    lensingStrength: 1.8,
    scale: 2.2
};








const blackHoleSystem = createGargantuaBlackHole(BLACK_HOLE_CONFIG);

// Apply uniform scaling to make black hole appear larger while maintaining proportions
blackHoleSystem.group.scale.setScalar(BLACK_HOLE_CONFIG.scale);

scene.add(blackHoleSystem.group);

const blackHoleLabel = createLabel("BLACK HOLE", 2.0);

blackHoleLabel.position.set(
    0,
    5.5,
    0
);

// Compensate label scale so it remains proportional to black hole
blackHoleLabel.scale.setScalar(1 / BLACK_HOLE_CONFIG.scale);

blackHoleSystem.group.add(blackHoleLabel);

registerLabel(blackHoleLabel);






const sunLabel = createLabel("Sun", 1.8);

sunLabel.position.set(0, SUN_RADIUS + 2.0, 0);

SunSystem.add(sunLabel);

registerLabel(sunLabel);


// ─── Celestial Body Data ───────────────────────────────────────────

const CELESTIAL_DATA = {
    Sun: {
        type: "Star",
        category: "G-type Main-Sequence Star",
        age: "4.6 billion years",
        diameter: "1,391,000 km",
        temperature: "5,500°C (surface)",
        summary: "The Sun is the star at the center of our solar system. It is a nearly perfect ball of hot plasma, heated to incandescence by nuclear fusion reactions in its core, radiating energy as light, ultraviolet, and infrared radiation.",
        history: "The Sun formed about 4.6 billion years ago from the gravitational collapse of a region within a large molecular cloud. Most of the matter gathered in the center, while the rest flattened into a protoplanetary disk. The Sun has been fusing hydrogen into helium for roughly half its main-sequence lifetime. In about 5 billion years, it will exhaust its hydrogen fuel, expand into a red giant, shed its outer layers, and eventually become a white dwarf."
    },
    Mercury: {
        type: "Planet",
        category: "Terrestrial Planet",
        distanceFromSun: "57.9 million km",
        orbitalPeriod: "88 days",
        dayLength: "59 Earth days",
        moons: 0,
        summary: "Mercury is the smallest planet in the solar system and the closest to the Sun. Its orbit around the Sun takes 87.97 Earth days, the shortest of all the planets. It has no atmosphere and its surface is heavily cratered, resembling Earth's Moon.",
        history: "Mercury has been known since at least 3000 BC. The Sumerians knew it as Nergal, the god of war. Galileo observed its phases in 1610, proving it orbited the Sun. NASA's Mariner 10 flew by Mercury in 1974-75, mapping about 45% of its surface. MESSENGER orbited from 2011-2015, revealing a surprisingly complex geological history, including evidence of past volcanic activity and a massive iron core that makes up 85% of the planet's radius."
    },
    Venus: {
        type: "Planet",
        category: "Terrestrial Planet",
        distanceFromSun: "108.2 million km",
        orbitalPeriod: "225 days",
        dayLength: "243 Earth days (retrograde)",
        moons: 0,
        summary: "Venus is the second planet from the Sun. It is sometimes called Earth's 'sister planet' because of their similar size, mass, and proximity. However, Venus has a thick toxic atmosphere filled with carbon dioxide and clouds of sulfuric acid, with surface temperatures reaching 465°C — the hottest of any planet.",
        history: "Venus was observed by Babylonian astronomers as early as 1600 BC. It was known as the morning and evening star. Galileo first observed its phases in 1610. The Soviet Venera missions (1961-1984) were the first to land on Venus, transmitting data from the surface for up to 120 minutes. The surface is dominated by volcanic features — over 1,600 major volcanoes — and vast basaltic plains. Venus rotates backwards compared to most planets, and a day on Venus is longer than its year."
    },
    Earth: {
        type: "Planet",
        category: "Terrestrial Planet",
        distanceFromSun: "149.6 million km",
        orbitalPeriod: "365.25 days",
        dayLength: "24 hours",
        moons: 1,
        summary: "Earth is the third planet from the Sun and the only known celestial body to harbor life. About 71% of its surface is covered by water. It has a protective magnetic field and atmosphere that shield it from harmful solar radiation.",
        history: "Earth formed approximately 4.54 billion years ago from the solar nebula. The Moon likely formed from debris after a Mars-sized body (Theia) collided with early Earth. Life appeared within the first billion years. The Great Oxidation Event 2.4 billion years ago transformed the atmosphere. Plate tectonics have shaped the surface continuously. Humans evolved in Africa about 300,000 years ago and have since developed complex civilizations across every continent."
    },
    Mars: {
        type: "Planet",
        category: "Terrestrial Planet",
        distanceFromSun: "227.9 million km",
        orbitalPeriod: "687 days",
        dayLength: "24.6 hours",
        moons: 2,
        summary: "Mars is the fourth planet from the Sun, often called the 'Red Planet' due to iron oxide (rust) on its surface. It has the tallest volcano (Olympus Mons) and the deepest canyon (Valles Marineris) in the solar system.",
        history: "Mars has been observed since ancient times. The Babylonians recorded its wandering motion. In 1877, Giovanni Schiaparelli mapped 'canali' (channels), which Percival Lowell interpreted as artificial canals, sparking speculation about Martian civilization. NASA's Viking 1 and 2 (1976) were the first successful Mars landers. The rover Spirit (2004-2010) and Opportunity (2004-2018) found evidence of ancient water. Curiosity (2011-present) and Perseverance (2021-present) are searching for signs of past microbial life and collecting samples for future return to Earth."
    },
    Jupiter: {
        type: "Planet",
        category: "Gas Giant",
        distanceFromSun: "778.5 million km",
        orbitalPeriod: "11.86 years",
        dayLength: "9.93 hours",
        moons: 95,
        summary: "Jupiter is the largest planet in the solar system — more than twice as massive as all other planets combined. Its iconic Great Red Spot is a storm larger than Earth that has been raging for at least 350 years. Jupiter acts as a gravitational shield, deflecting asteroids away from the inner solar system.",
        history: "Jupiter has been known since antiquity, named after the king of the Roman gods. Galileo discovered its four largest moons (Io, Europa, Ganymede, Callisto) in 1610, providing key evidence for the heliocentric model. Pioneer 10 (1973) and Voyager 1 & 2 (1979) revealed Jupiter's complex atmosphere and ring system. The Galileo orbiter (1995-2003) studied Jupiter for eight years and released a probe into its atmosphere. Juno (2016-present) is currently mapping Jupiter's interior structure, revealing that its core may be a 'fuzzy' mix of hydrogen and heavy elements rather than a solid ball."
    },
    Saturn: {
        type: "Planet",
        category: "Gas Giant",
        distanceFromSun: "1.434 billion km",
        orbitalPeriod: "29.46 years",
        dayLength: "10.7 hours",
        moons: 146,
        summary: "Saturn is the sixth planet from the Sun, famous for its spectacular ring system made of ice and rock particles. It is the least dense planet — it could float in water. Saturn's rings extend up to 282,000 km from the planet but are only about 10 meters thick.",
        history: "Saturn was known to the ancients — the Babylonians identified it around the 7th century BC. Galileo observed its rings in 1610 but couldn't resolve them. Christiaan Huygens correctly identified them as a ring in 1655. Cassini discovered the division between the rings in 1675. Voyager 1 & 2 (1980-81) revealed detailed ring structure. The Cassini-Huygens mission (2004-2017) was one of humanity's greatest achievements: it orbited Saturn for 13 years, discovered geysers on Enceladus, a subsurface ocean on Titan, and revealed the complex dynamics of the ring system before deliberately plunging into Saturn's atmosphere."
    },
    Uranus: {
        type: "Planet",
        category: "Ice Giant",
        distanceFromSun: "2.871 billion km",
        orbitalPeriod: "84 years",
        dayLength: "17.2 hours",
        moons: 28,
        summary: "Uranus is the seventh planet from the Sun and the first discovered with a telescope. It rotates on its side with an axial tilt of 98°, likely due to a massive ancient collision. Its atmosphere contains methane, giving it a distinctive blue-green color.",
        history: "William Herschel discovered Uranus on March 13, 1781, making it the first planet found using a telescope. It was originally named 'Georgium Sidus' after King George III before being renamed after the Greek sky god. Voyager 2 flyby in 1986 revealed a relatively featureless atmosphere and 11 known rings. Recent observations from Hubble and ground-based telescopes have revealed more atmospheric dynamics, including massive storms. Uranus has 27 known moons, all named after characters from Shakespeare and Alexander Pope."
    },
    Neptune: {
        type: "Planet",
        category: "Ice Giant",
        distanceFromSun: "4.495 billion km",
        orbitalPeriod: "165 years",
        dayLength: "16.1 hours",
        moons: 16,
        summary: "Neptune is the eighth and farthest known planet from the Sun. It has the strongest winds in the solar system, reaching speeds of 2,100 km/h. Neptune's vivid blue color comes from methane in its atmosphere absorbing red light.",
        history: "Neptune was the first planet found through mathematical prediction rather than direct observation. Urbain Le Verrier and John Couch Adams independently predicted its position in 1846 based on irregularities in Uranus's orbit. Johann Galle observed it at the predicted location on September 23, 1846. Voyager 2's flyby in 1989 revealed the Great Dark Spot (a storm since disappeared), bright cloud features, and geysers on its moon Triton — the first active geysers seen beyond Earth. Triton orbits retrograde, suggesting it was a Kuiper Belt object captured by Neptune's gravity."
    },
    Ceres: {
        type: "Dwarf Planet",
        category: "Dwarf Planet (Asteroid Belt)",
        distanceFromSun: "413.7 million km",
        diameter: "946 km",
        summary: "Ceres is the largest object in the asteroid belt between Mars and Jupiter and the only dwarf planet in the inner solar system. NASA's Dawn spacecraft revealed bright spots of sodium carbonate on its surface, indicating recent geological activity.",
        history: "Ceres was discovered by Giuseppe Piazzi on January 1, 1801. It was initially classified as a planet, then reclassified as an asteroid, and finally as a dwarf planet in 2006. Dawn orbited Ceres from 2015-2018, revealing the mysterious bright spots in Occator Crater, which are deposits of sodium carbonate — minerals that suggest a subsurface ocean may still exist. Ceres may have formed at the same time as the other planets but was prevented from growing larger by Jupiter's gravitational influence."
    },
    Pluto: {
        type: "Dwarf Planet",
        category: "Dwarf Planet (Kuiper Belt)",
        distanceFromSun: "5.906 billion km",
        diameter: "2,377 km",
        summary: "Pluto is the most famous dwarf planet, reclassified from planet status in 2006. It has a heart-shaped nitrogen glacier (Tombaugh Regio) and a thin atmosphere that freezes and collapses as it moves farther from the Sun in its elliptical orbit.",
        history: "Pluto was discovered by Clyde Tombaugh on February 18, 1930, at Lowell Observatory. It was classified as the ninth planet until 2006, when the International Astronomical Union reclassified it as a dwarf planet. NASA's New Horizons flew by Pluto on July 14, 2015, revealing stunning terrain including towering ice mountains, a heart-shaped plain, and a thin blue atmosphere. Data from New Horizons showed Pluto has five known moons, with Charon so large that the Pluto-Charon system is sometimes considered a double dwarf planet."
    },
    Haumea: {
        type: "Dwarf Planet",
        category: "Dwarf Planet (Kuiper Belt)",
        distanceFromSun: "6.45 billion km",
        diameter: "1,632 × 1,048 km",
        summary: "Haumea is an egg-shaped dwarf planet in the Kuiper Belt, elongated by its rapid rotation (one day lasts only 4 hours). It has two moons and a ring — the first ring discovered around a Kuiper Belt object.",
        history: "Haumea was discovered in 2004 by a team led by Mike Brown at Caltech, though the Spanish team of José Luis Ortiz claimed discovery shortly after, leading to a controversy. It was named after the Hawaiian goddess of fertility. Haumea's extreme shape is caused by its fast spin — it completes a rotation in just 3.9 hours, making it one of the fastest-rotating large objects in the solar system. In 2017, stellar occultation observations confirmed a ring around Haumea, making it the first known ring system around a TNO."
    },
    Makemake: {
        type: "Dwarf Planet",
        category: "Dwarf Planet (Kuiper Belt)",
        distanceFromSun: "6.85 billion km",
        diameter: "1,430 km",
        summary: "Makemake is the second-brightest Kuiper Belt object after Pluto and the third-largest known dwarf planet. Its surface is covered in methane, ethane, and possibly nitrogen ices.",
        history: "Makemake was discovered on March 31, 2005 by Mike Brown's team at Palomar Observatory. It was initially designated 2005 FY9 and given the nickname 'Easterbunny' due to its discovery date near Easter. It was officially named after the creation god of the Rapa Nui (Easter Island) people. Makemake has one known moon, MK2 (nicknamed 'Moonikin'), discovered in 2016 via the Hubble Space Telescope. The discovery of MK2 allowed astronomers to better determine Makemake's mass and density."
    },
    Eris: {
        type: "Dwarf Planet",
        category: "Dwarf Planet (Scattered Disc)",
        distanceFromSun: "10.12 billion km",
        diameter: "2,326 km",
        summary: "Eris is the most massive known dwarf planet, slightly more massive than Pluto. Its discovery directly led to the reclassification of Pluto and the creation of the 'dwarf planet' category in 2006.",
        history: "Eris was discovered on January 5, 2005 by Mike Brown's team at Palomar Observatory. It was initially called 'the tenth planet' until its mass was measured, showing it was actually more massive than Pluto. This discovery forced the IAU to formally define 'planet' for the first time, resulting in Pluto's reclassification. Eris was named after the Greek goddess of discord and strife. Its moon Dysnomia was discovered in 2005, and its orbit was used to calculate Eris's mass. Eris takes 557 years to complete one orbit around the Sun."
    },
    "BLACK HOLE": {
        type: "Supermassive Black Hole",
        category: "Gargantua (Fictional / Interstellar-inspired)",
        mass: "~100 million solar masses (estimated)",
        eventHorizonDiameter: "~600 million km",
        summary: "This is a supermassive black hole inspired by the fictional Gargantua from the film Interstellar. In reality, supermassive black holes sit at the centers of most galaxies, including our own Milky Way (Sagittarius A*, ~4 million solar masses).",
        history: "Black holes were first predicted by Einstein's General Theory of Relativity (1915). Karl Schwarzschild derived the first exact solution in 1916, describing the event horizon. The term 'black hole' was popularized by John Wheeler in 1967. Cygnus X-1, discovered in 1964, was the first strong black hole candidate. In 2019, the Event Horizon Telescope captured the first-ever image of a black hole — the supermassive black hole at the center of galaxy M87. In 2022, they released an image of Sagittarius A*, the black hole at the center of our own Milky Way. Stephen Hawking showed that black holes emit radiation (Hawking radiation) and can eventually evaporate over immense timescales."
    },
    "ISS": {
        type: "Satellite",
        category: "International Space Station",
        orbiting: "Earth",
        altitude: "~420 km",
        orbitalPeriod: "~92 minutes",
        speed: "~27,600 km/h",
        summary: "The International Space Station is a modular space station in low Earth orbit. It is a multinational collaborative project involving NASA, Roscosmos, JAXA, ESA, and CSA. The ISS orbits Earth every 90 minutes at about 420 km altitude.",
        history: "The ISS was first launched in 1998 and has been continuously inhabited since November 2000. It serves as a microgravity and space environment research laboratory where scientific research is conducted in astrobiology, astronomy, meteorology, physics, and other fields. The station can be seen from Earth with the naked eye and is one of the brightest artificial objects in the sky."
    }
};


// ─── Raycaster + Interactive Objects Registry ────────────────────

const raycaster = new THREE.Raycaster();
raycaster.far = 500;

const interactiveObjects = [];

function walkUpToObject(object) {
    let current = object;
    while (current) {
        if (current.userData && current.userData.interactive) {
            return current;
        }
        current = current.parent;
    }
    return null;
}

function registerInteractiveObject(mesh, meta) {
    mesh.userData.interactive = true;
    mesh.userData.celestialName = meta.name;
    mesh.userData.celestialType = meta.type;
    mesh.userData.celestialRadius = meta.radius || 1;
    interactiveObjects.push(mesh);
}

// Register planets
for (const planet of planets) {
    registerInteractiveObject(planet.mesh, {
        name: planet.data.name,
        type: "planet",
        radius: planet.data.radius
    });
}

// Register sun
registerInteractiveObject(sun, {
    name: "Sun",
    type: "star",
    radius: SUN_RADIUS
});

// Black hole click target (invisible sphere)
const bhClickTarget = new THREE.Mesh(
    new THREE.SphereGeometry(4, 16, 16),
    new THREE.MeshBasicMaterial({ visible: false })
);
bhClickTarget.userData = { name: "BLACK HOLE", type: "blackhole" };
blackHoleSystem.group.add(bhClickTarget);
registerInteractiveObject(bhClickTarget, {
    name: "BLACK HOLE",
    type: "blackhole",
    radius: 5.5
});

// Register dwarf planets
for (const dwarf of dwarfPlanets) {
    registerInteractiveObject(dwarf.mesh, {
        name: dwarf.data.name,
        type: "dwarf",
        radius: dwarf.data.radius
    });
}

// ─── Crosshair Raycaster ────────────────────────────────────────

const CrosshairRaycaster = {
    currentTarget: null,
    currentTargetMesh: null,
    _direction: new THREE.Vector3(),
    _origin: new THREE.Vector3(),

    update() {
        camera.getWorldDirection(this._direction);
        this._origin.copy(camera.position);

        raycaster.set(this._origin, this._direction);
        const intersects = raycaster.intersectObjects(interactiveObjects, false);

        const nameEl = document.getElementById("crosshair-name");
        const crosshairEl = document.getElementById("crosshair");

        if (intersects.length > 0) {
            const hit = intersects[0].object;
            const name = hit.userData.celestialName;

            if (this.currentTarget !== name) {
                this.currentTarget = name;
                this.currentTargetMesh = hit;

                crosshairEl.classList.add("targeting");
                if (nameEl) {
                    nameEl.textContent = name;
                    nameEl.classList.add("visible");
                }
            }
        } else {
            if (this.currentTarget !== null) {
                this.currentTarget = null;
                this.currentTargetMesh = null;
                crosshairEl.classList.remove("targeting");
                if (nameEl) {
                    nameEl.classList.remove("visible");
                }
            }
        }
    },

    getTargetInfo() {
        if (!this.currentTargetMesh) return null;
        const mesh = this.currentTargetMesh;
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);
        return {
            name: mesh.userData.celestialName,
            type: mesh.userData.celestialType,
            radius: mesh.userData.celestialRadius,
            worldPos: worldPos,
            mesh: mesh
        };
    }
};


// ─── Camera Fly-To System ───────────────────────────────────────

const flyTo = {
    active: false,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startLook: new THREE.Vector3(),
    endLook: new THREE.Vector3(),
    progress: 0,
    duration: 2.5,
    targetName: null,
    onComplete: null,

    following: false,
    followMesh: null,
    followOffset: new THREE.Vector3(),
    followLookOffset: new THREE.Vector3()
};

function startFlyTo(bodyName, worldPos, bodyRadius, hitMesh) {
    flyTo.active = true;
    flyTo.progress = 0;
    flyTo.targetName = bodyName;
    flyTo.following = false;
    flyTo.startPos.copy(camera.position);
    flyTo.startLook.copy(
        camera.position.clone().add(
            new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
        )
    );

    // Safe viewing distance: scales with object size
    const viewDist = Math.max(bodyRadius * 4, 8);
    const dir = camera.position.clone().sub(worldPos).normalize();
    flyTo.endPos.copy(worldPos).add(dir.multiplyScalar(viewDist));
    flyTo.endLook.copy(worldPos);

    flyTo.followMesh = hitMesh;
    flyTo.followOffset.copy(flyTo.endPos).sub(worldPos);
    flyTo.followLookOffset.copy(flyTo.endLook).sub(worldPos);

    FlyingController.stopMovement();
    FlyingController.enabled = false;
    document.exitPointerLock();
}

function stopFollow() {
    flyTo.following = false;
    flyTo.followMesh = null;
}

function breakFollow() {
    if (flyTo.following) {
        stopFollow();
        FlyingController.enabled = true;
    }
}

// ─── Click Handler (Crosshair-Based Selection) ──────────────────

renderer.domElement.addEventListener("click", (event) => {
    if (flyTo.active) return;

    // First click: request pointer lock
    if (!InputManager.isLocked) {
        requestPointerLock();
        return;
    }

    const target = CrosshairRaycaster.getTargetInfo();
    if (!target) return;

    startFlyTo(target.name, target.worldPos, target.radius, target.mesh);

    // Show info panel immediately on selection
    showInfoPanel(target.name);

    flyTo.onComplete = () => {
        flyTo.following = true;
    };
});

const infoPanel = document.getElementById("info-panel");
const infoPanelInner = document.getElementById("info-panel-inner");
let currentInfoName = null;

function showInfoPanel(name) {
    const data = CELESTIAL_DATA[name];
    const history = celestialHistory[name];
    if (!data && !history) return;
    currentInfoName = name;

    const h = history || {};
    const typeLabel = h.type || data.type || "";
    const tagline = h.tagline || "";
    const description = h.description || data.summary || "";

    const typeColors = {
        "Star": "#FDB813",
        "Terrestrial Planet": "#4FC3F7",
        "Gas Giant": "#FF8A65",
        "Ice Giant": "#80DEEA",
        "Dwarf Planet": "#CE93D8",
        "Supermassive Black Hole": "#EF5350",
        "Satellite": "#81D4FA"
    };
    const accentColor = typeColors[typeLabel] || "#ffffff";

    const facts = h.quickFacts || {};
    const factsHTML = Object.entries(facts).map(([k, v]) =>
        `<div class="dash-stat"><span class="dash-stat-label">${k}</span><span class="dash-stat-value">${v}</span></div>`
    ).join("");

    const didYouKnow = h.didYouKnow || [];
    const didYouKnowHTML = didYouKnow.map(f =>
        `<li>${f}</li>`
    ).join("");

    const moons = h.moons || [];
    const moonsHTML = moons.map(m =>
        `<div class="dash-moon"><h4 class="dash-moon-name">${m.name}</h4><p class="dash-moon-desc">${m.description}</p></div>`
    ).join("");

    infoPanelInner.innerHTML = `
        <button id="info-close">&times;</button>
        <div class="dash-header">
            <span class="dash-type" style="border-color:${accentColor}; color:${accentColor}">${typeLabel}</span>
            <h2 class="dash-name">${h.name || name}</h2>
            <p class="dash-tagline">${tagline}</p>
        </div>
        <p class="dash-description">${description}</p>
        ${factsHTML ? `<div class="dash-section"><h3 class="dash-section-title">Quick Facts</h3><div class="dash-stats">${factsHTML}</div></div>` : ""}
        ${moonsHTML ? `<div class="dash-section"><h3 class="dash-section-title">Moons</h3><div class="dash-moons">${moonsHTML}</div></div>` : ""}
        ${h.discover ? `<div class="dash-section"><h3 class="dash-section-title">Discover</h3><p class="dash-body">${h.discover}</p></div>` : ""}
        ${h.history ? `<div class="dash-section"><h3 class="dash-section-title">History &amp; Discovery</h3><p class="dash-body">${h.history}</p></div>` : ""}
        ${h.special ? `<div class="dash-section"><h3 class="dash-section-title">What Makes It Special</h3><p class="dash-body">${h.special}</p></div>` : ""}
        ${h.exploration ? `<div class="dash-section"><h3 class="dash-section-title">Exploration</h3><p class="dash-body">${h.exploration}</p></div>` : ""}
        ${didYouKnowHTML ? `<div class="dash-section"><h3 class="dash-section-title">Did You Know?</h3><ul class="dash-list">${didYouKnowHTML}</ul></div>` : ""}
        <div class="dash-dismiss">Press <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to continue exploring</div>
    `;

    infoPanel.classList.add("visible");

    document.getElementById("pointer-lock-hint").classList.add("hidden");

    document.getElementById("info-close").addEventListener("click", closeInfoPanel);
}

function closeInfoPanel() {
    infoPanel.classList.remove("visible");
    currentInfoName = null;
    breakFollow();

    if (!InputManager.isLocked) {
        document.getElementById("pointer-lock-hint").classList.remove("hidden");
    }
}


// ─── Hover Highlight (Crosshair-Based) ──────────────────────────

const hoverHighlight = {
    current: null,
    originalColor: null
};

function updateHoverHighlight() {
    if (flyTo.active) return;

    // Reset previous highlight
    if (hoverHighlight.current && hoverHighlight.current.material && hoverHighlight.current.material.emissive) {
        hoverHighlight.current.material.emissive.setHex(hoverHighlight.originalColor || 0x000000);
    }

    const target = CrosshairRaycaster.getTargetInfo();
    if (target && target.mesh && target.mesh.material && target.mesh.material.emissive) {
        hoverHighlight.originalColor = target.mesh.material.emissive.getHex();
        target.mesh.material.emissive.setHex(0x222244);
        hoverHighlight.current = target.mesh;
    } else {
        hoverHighlight.current = null;
    }
}


// ─── ISS Tracker ────────────────────────────────────────────────

const earthPlanet = planets.find(p => p.data.name === "Earth");
const issTracker = createISSTracker(scene, earthPlanet, camera);
if (issTracker.marker) {
    interactiveObjects.push(issTracker.marker);
}
issTracker.start();


const clock =
    new THREE.Clock();

const _vectorA = new THREE.Vector3();


function animate() {

    const delta = clock.getDelta();

    const elapsed = clock.elapsedTime;

    // ── XR Controller Input (when in XR session) ──
    if (renderer.xr.isPresenting) {
        const session = renderer.xr.getSession();
        if (session) {
            for (const source of session.inputSources) {
                if (source.gamepad) {
                    const gp = source.gamepad;
                    const thumbstickX = gp.axes[2] || 0;
                    const thumbstickY = gp.axes[3] || 0;
                    const leftX = gp.axes[0] || 0;
                    const leftY = gp.axes[1] || 0;

                    if (source.handedness === "left") {
                        InputManager.forward = leftY < -0.1 ? 1 : 0;
                        InputManager.backward = leftY > 0.1 ? 1 : 0;
                        InputManager.left = leftX < -0.1 ? 1 : 0;
                        InputManager.right = leftX > 0.1 ? 1 : 0;
                    }

                    if (source.handedness === "right") {
                        InputManager.lookX = thumbstickX * 200;
                        InputManager.lookY = thumbstickY * 200;

                        if (gp.buttons[0] && gp.buttons[0].pressed) {
                            InputManager.select = true;
                        }
                    }
                }
            }
        }
    }

    // Update black hole shader time uniforms
    if (blackHoleSystem.group.userData.uniforms) {
        for (const uniforms of blackHoleSystem.group.userData.uniforms) {
            if (uniforms.uTime) {
                uniforms.uTime.value += delta;
            }
        }
    }

    
    
    

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


    
    
    

    // Fly-to camera animation
    if (flyTo.active) {
        flyTo.progress += delta / flyTo.duration;
        const t = THREE.MathUtils.smoothstep(flyTo.progress, 0, 1);

        camera.position.lerpVectors(flyTo.startPos, flyTo.endPos, t);

        const lookTarget = new THREE.Vector3().lerpVectors(flyTo.startLook, flyTo.endLook, t);
        camera.lookAt(lookTarget);

        if (flyTo.progress >= 1) {
            flyTo.active = false;
            FlyingController.enabled = true;
            camera.lookAt(flyTo.endLook);

            if (flyTo.onComplete) {
                flyTo.onComplete();
                flyTo.onComplete = null;
            }
        }
    }

    // Follow mode — camera tracks the planet as it orbits
    if (flyTo.following && flyTo.followMesh) {
        // Break follow if user inputs movement
        if (FlyingController.hasMovementInput()) {
            breakFollow();
        } else {
            const targetWorldPos = new THREE.Vector3();
            flyTo.followMesh.getWorldPosition(targetWorldPos);

            const desiredPos = targetWorldPos.clone().add(flyTo.followOffset);
            camera.position.lerp(desiredPos, 4.0 * delta);

            const lookTarget = targetWorldPos.clone().add(flyTo.followLookOffset);
            camera.lookAt(lookTarget);
        }
    }

    // Crosshair raycasting + hover highlight
    CrosshairRaycaster.update();
    updateHoverHighlight();

    // ISS tracker update
    issTracker.update(delta);

    FlyingController.update(flyTo.active ? 0 : delta);

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


// ─── Controls Panel Toggle ──────────────────────────────────────

const controlsToggle = document.getElementById("controls-toggle");
const controlsPanel = document.getElementById("controls-panel");
const controlsClose = document.getElementById("controls-close");

controlsToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    controlsPanel.classList.toggle("hidden");
});

controlsClose.addEventListener("click", (e) => {
    e.stopPropagation();
    controlsPanel.classList.add("hidden");
});


renderer.setAnimationLoop(animate);