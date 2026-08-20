import * as THREE from "three";

const API_URL = "https://api.wheretheiss.at/v1/satellites/25544";
const POLL_INTERVAL = 8000;
const EARTH_RADIUS_KM = 6371;

export function createISSTracker(scene, earthRef, cameraRef) {
    const camera = cameraRef;
    const state = {
        targetPosition: new THREE.Vector3(),
        currentPosition: new THREE.Vector3(),
        altitude: 0,
        velocity: 0,
        latitude: 0,
        longitude: 0,
        visibility: "unknown",
        lastUpdate: null,
        active: false,
        fetchTimer: null
    };

    // ── 3D Marker ──────────────────────────────────────────────
    const marker = new THREE.Group();
    marker.visible = false;

    // Main body
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.04, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xccccdd })
    );
    marker.add(body);

    // Solar panels
    const panelMat = new THREE.MeshBasicMaterial({
        color: 0x2244aa,
        transparent: true,
        opacity: 0.8
    });

    const leftPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 0.04),
        panelMat
    );
    leftPanel.position.set(-0.12, 0, 0);
    leftPanel.rotation.y = Math.PI / 2;
    marker.add(leftPanel);

    const rightPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 0.04),
        panelMat
    );
    rightPanel.position.set(0.12, 0, 0);
    rightPanel.rotation.y = Math.PI / 2;
    marker.add(rightPanel);

    // Glow
    const glowMat = new THREE.SpriteMaterial({
        color: 0x88aaff,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(0.3);
    marker.add(glow);

    scene.add(marker);

    // Register as interactive
    marker.userData = {
        name: "ISS",
        interactive: true,
        celestialType: "satellite",
        celestialRadius: 0.1
    };

    // ── Lat/Lon/Alt → 3D World Position ────────────────────────

    function latLonAltToWorldPosition(lat, lon, altKm) {
        const earth = earthRef.mesh;
        const earthWorldPos = new THREE.Vector3();
        earth.getWorldPosition(earthWorldPos);

        // Convert lat/lon to local Cartesian
        const latRad = lat * (Math.PI / 180);
        const lonRad = lon * (Math.PI / 180);

        const localRadius = 1.1 + (altKm / EARTH_RADIUS_KM) * 1.1;

        const localPos = new THREE.Vector3(
            localRadius * Math.cos(latRad) * Math.cos(lonRad),
            localRadius * Math.sin(latRad),
            localRadius * Math.cos(latRad) * Math.sin(lonRad)
        );

        // Apply Earth's rotation and tilt
        const earthQuat = new THREE.Quaternion();
        earth.getWorldQuaternion(earthQuat);
        localPos.applyQuaternion(earthQuat);

        return earthWorldPos.add(localPos);
    }

    // ── API Fetching ───────────────────────────────────────────

    async function fetchISSData() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(API_URL, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            state.latitude = data.latitude;
            state.longitude = data.longitude;
            state.altitude = data.altitude;
            state.velocity = data.velocity;
            state.visibility = data.visibility || "unknown";
            state.lastUpdate = new Date();

            state.targetPosition.copy(
                latLonAltToWorldPosition(data.latitude, data.longitude, data.altitude)
            );

            state.active = true;
            updateHUD();
        } catch (err) {
            console.warn("ISS fetch failed:", err.message);
        }
    }

    // ── HUD Update ─────────────────────────────────────────────

    function updateHUD() {
        const altEl = document.getElementById("iss-alt");
        const velEl = document.getElementById("iss-vel");
        const visEl = document.getElementById("iss-vis");
        const issHud = document.getElementById("iss-hud");

        if (!altEl || !velEl || !visEl) return;

        if (state.active) {
            issHud.classList.remove("hidden");
            altEl.textContent = `${Math.round(state.altitude)} km`;
            velEl.textContent = `${Math.round(state.velocity)} km/h`;
            visEl.textContent = state.visibility;
        }
    }

    // ── Update Loop (call each frame) ──────────────────────────

    function update(delta) {
        if (!state.active) return;

        // Smooth interpolation toward target
        state.currentPosition.lerp(state.targetPosition, 2.0 * delta);
        marker.position.copy(state.currentPosition);
        marker.visible = true;

        // Billboard the glow toward camera
        glow.lookAt(camera ? camera.position : marker.position);
    }

    // ── Start Polling ──────────────────────────────────────────

    function start() {
        fetchISSData();
        state.fetchTimer = setInterval(fetchISSData, POLL_INTERVAL);
    }

    function stop() {
        if (state.fetchTimer) {
            clearInterval(state.fetchTimer);
            state.fetchTimer = null;
        }
        marker.visible = false;
        state.active = false;
    }

    return {
        marker,
        state,
        update,
        start,
        stop
    };
}
