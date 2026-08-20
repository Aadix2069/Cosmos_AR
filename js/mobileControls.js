// ─── COSMOS WEBXR — MOBILE TOUCH CONTROLS ──────────────────────
// Pointer Events–based multi-touch layer for mobile devices.
// Writes to the existing InputManager — no duplicate systems.
// COSMOS is exposed on window by main.js — accessed via window.COSMOS

// ─── Device Detection ──────────────────────────────────────────

const isTouchDevice = (
    ("ontouchstart" in window) ||
    (navigator.maxTouchPoints > 0) ||
    (window.matchMedia("(pointer: coarse)").matches)
) && !window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// ─── DOM References (queried after HUD build) ─────────────────

const orientationEl = document.getElementById("mobile-orientation");
const hudEl = document.getElementById("mobile-hud");
const crosshairEl = document.getElementById("crosshair");
const pointerHintEl = document.getElementById("pointer-lock-hint");
const infoPanel = document.getElementById("info-panel");
const controlsToggle = document.getElementById("controls-toggle");
const controlsPanel = document.getElementById("controls-panel");

function el(id) {
    return document.getElementById(id);
}

// ─── State ─────────────────────────────────────────────────────

// Joystick
let joystickPointerId = null;
const joystickCenter = { x: 0, y: 0 };
let joystickRadius = 0;
const joy = { x: 0, y: 0 };

// Camera (right-side look)
let cameraPointerId = null;
const camDrag = {
    lastX: 0,
    lastY: 0,
    active: false
};

// Button states
let boostActive = false;
let vUpActive = false;
let vDownActive = false;

// Help panel
let helpOpen = false;

// Init guard
let initialized = false;

// ─── Constants ─────────────────────────────────────────────────

const DEADZONE = 0.08;

// ─── Initialize ────────────────────────────────────────────────

export function initMobileControls() {
    if (!isTouchDevice || initialized) return;
    if (!window.COSMOS) return;
    initialized = true;

    window.COSMOS._isTouchDevice = true;

    buildHUD();
    setupOrientation();
    setupJoystick();
    setupCameraDrag();
    setupButtons();
    setupHelpToggle();
    setupHUDAutoHide();
    setupDesktopOverrides();

    window.COSMOS.onMobileUpdate = updateMobileInput;
}

// ─── Build HUD HTML ───────────────────────────────────────────

function buildHUD() {
    if (!hudEl) return;

    hudEl.innerHTML = `
        <div class="mobile-top">
            <span class="mobile-status">COSMOS</span>
            <button class="mobile-help-btn" id="mobile-help-btn">?</button>
        </div>

        <div class="mobile-help-panel" id="mobile-help-panel">
            <div class="mobile-help-title">CONTROLS</div>
            <div class="mobile-help-row"><span class="mobile-help-action">MOVE</span><span class="mobile-help-method">Left joystick</span></div>
            <div class="mobile-help-row"><span class="mobile-help-action">LOOK</span><span class="mobile-help-method">Drag right side</span></div>
            <div class="mobile-help-row"><span class="mobile-help-action">SELECT</span><span class="mobile-help-method">Aim + Select</span></div>
            <div class="mobile-help-row"><span class="mobile-help-action">BOOST</span><span class="mobile-help-method">Hold boost</span></div>
            <div class="mobile-help-row"><span class="mobile-help-action">UP / DN</span><span class="mobile-help-method">Vertical buttons</span></div>
        </div>

        <div class="mobile-look-zone" id="mobile-look-zone"></div>

        <div class="mobile-joystick" id="mobile-joystick">
            <div class="joystick-base"></div>
            <div class="joystick-thumb" id="mobile-joystick-thumb"></div>
            <div class="joystick-label">MOVE</div>
        </div>

        <div class="mobile-vertical">
            <button class="mobile-vbtn" id="mobile-vbtn-up">UP</button>
            <button class="mobile-vbtn" id="mobile-vbtn-down">DN</button>
        </div>

        <div class="mobile-right-btns">
            <button class="mobile-select-btn" id="mobile-select-btn">SELECT</button>
            <button class="mobile-boost-btn" id="mobile-boost-btn">BOOST</button>
        </div>
    `;
}

// ─── Orientation ───────────────────────────────────────────────

function setupOrientation() {
    checkOrientation();
    window.addEventListener("orientationchange", checkOrientation);
    window.addEventListener("resize", checkOrientation);
}

function checkOrientation() {
    if (!orientationEl || !hudEl) return;

    let isLandscape = false;

    if (screen.orientation && screen.orientation.type) {
        isLandscape = screen.orientation.type.startsWith("landscape");
    } else if (typeof window.orientation !== "undefined") {
        isLandscape = window.orientation === 90 || window.orientation === -90;
    } else {
        isLandscape = window.innerWidth > window.innerHeight;
    }

    if (isLandscape) {
        orientationEl.classList.remove("visible");
        hudEl.classList.add("active");
    } else {
        orientationEl.classList.add("visible");
        hudEl.classList.remove("active");
    }
}

// ─── Joystick (Pointer Events) ─────────────────────────────────
// LEFT SIDE — movement only, never camera.

function setupJoystick() {
    const joyEl = el("mobile-joystick");
    const thumb = el("mobile-joystick-thumb");
    if (!joyEl || !thumb) return;

    joyEl.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();

        joystickPointerId = e.pointerId;

        const rect = joyEl.getBoundingClientRect();
        joystickCenter.x = rect.left + rect.width / 2;
        joystickCenter.y = rect.top + rect.height / 2;
        joystickRadius = rect.width / 2;

        updateJoystickPosition(e.clientX, e.clientY);
        thumb.classList.add("active");

        try { joyEl.setPointerCapture(e.pointerId); } catch (_) {}
    }, { passive: false });

    joyEl.addEventListener("pointermove", (e) => {
        if (e.pointerId !== joystickPointerId) return;
        e.preventDefault();
        updateJoystickPosition(e.clientX, e.clientY);
    }, { passive: false });

    joyEl.addEventListener("pointerup", (e) => {
        if (e.pointerId !== joystickPointerId) return;
        resetJoystick();
    }, { passive: true });

    joyEl.addEventListener("pointercancel", (e) => {
        if (e.pointerId !== joystickPointerId) return;
        resetJoystick();
    }, { passive: true });

    joyEl.addEventListener("lostpointercapture", (e) => {
        if (e.pointerId !== joystickPointerId) return;
        resetJoystick();
    }, { passive: true });

    // Safety net: if pointer leaves the joystick area while captured
    document.addEventListener("pointermove", (e) => {
        if (e.pointerId !== joystickPointerId) return;
        const joyElNow = el("mobile-joystick");
        if (!joyElNow) return;
        const rect = joyElNow.getBoundingClientRect();
        const inside =
            e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (!inside) {
            updateJoystickPosition(e.clientX, e.clientY);
        }
    }, { passive: true });

    document.addEventListener("pointerup", (e) => {
        if (e.pointerId !== joystickPointerId) return;
        resetJoystick();
    }, { passive: true });

    document.addEventListener("pointercancel", (e) => {
        if (e.pointerId !== joystickPointerId) return;
        resetJoystick();
    }, { passive: true });
}

function updateJoystickPosition(cx, cy) {
    const thumb = el("mobile-joystick-thumb");
    if (!thumb) return;

    let dx = cx - joystickCenter.x;
    let dy = cy - joystickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxR = joystickRadius;

    if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
    }

    const pctX = dx / maxR;
    const pctY = dy / maxR;

    joy.x = Math.abs(pctX) > DEADZONE ? pctX : 0;
    joy.y = Math.abs(pctY) > DEADZONE ? pctY : 0;

    const thumbHalf = thumb.offsetWidth / 2;
    const joyEl = el("mobile-joystick");
    const baseHalf = joyEl ? joyEl.offsetWidth / 2 : maxR;
    const maxTravel = baseHalf - thumbHalf;
    const thumbDx = pctX * maxTravel;
    const thumbDy = pctY * maxTravel;

    thumb.style.transform =
        `translate(calc(-50% + ${thumbDx}px), calc(-50% + ${thumbDy}px))`;
}

function resetJoystick() {
    joystickPointerId = null;
    joy.x = 0;
    joy.y = 0;
    const thumb = el("mobile-joystick-thumb");
    if (thumb) {
        thumb.style.transform = "translate(-50%, -50%)";
        thumb.classList.remove("active");
    }
}

// ─── Camera Drag — Right-side look area (Pointer Events) ───────
// RIGHT SIDE — camera only, never movement.

function setupCameraDrag() {
    const zone = el("mobile-look-zone");
    if (!zone) return;

    zone.addEventListener("pointerdown", (e) => {
        if (cameraPointerId !== null) return;

        // Only accept touches that start on the right half
        if (e.clientX < window.innerWidth * 0.4) return;

        cameraPointerId = e.pointerId;
        camDrag.lastX = e.clientX;
        camDrag.lastY = e.clientY;
        camDrag.active = true;
    }, { passive: true });

    // Document-level move/up to track finger even outside zone
    document.addEventListener("pointermove", (e) => {
        if (e.pointerId !== cameraPointerId || !camDrag.active) return;

        const deltaX = e.clientX - camDrag.lastX;
        const deltaY = e.clientY - camDrag.lastY;

        const IM = window.COSMOS.InputManager;
        IM.lookX += deltaX;
        IM.lookY += deltaY;

        camDrag.lastX = e.clientX;
        camDrag.lastY = e.clientY;
    }, { passive: true });

    document.addEventListener("pointerup", (e) => {
        if (e.pointerId !== cameraPointerId) return;
        cameraPointerId = null;
        camDrag.active = false;
    }, { passive: true });

    document.addEventListener("pointercancel", (e) => {
        if (e.pointerId !== cameraPointerId) return;
        cameraPointerId = null;
        camDrag.active = false;
    }, { passive: true });
}

// ─── Buttons ───────────────────────────────────────────────────

function setupButtons() {
    setupSelectButton();
    setupBoostButton();
    setupVerticalButtons();
}

function setupSelectButton() {
    const btn = el("mobile-select-btn");
    if (!btn) return;

    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add("active");
        try { navigator.vibrate && navigator.vibrate(15); } catch (_) {}
        handleSelect();
    }, { passive: false });

    btn.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        btn.classList.remove("active");
    }, { passive: true });

    btn.addEventListener("pointercancel", () => {
        btn.classList.remove("active");
    }, { passive: true });

    btn.addEventListener("pointerleave", () => {
        btn.classList.remove("active");
    }, { passive: true });
}

function setupBoostButton() {
    const btn = el("mobile-boost-btn");
    if (!btn) return;

    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add("active");
        boostActive = true;
        window.COSMOS.InputManager.boost = 1;
        try { navigator.vibrate && navigator.vibrate(10); } catch (_) {}
    }, { passive: false });

    btn.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        btn.classList.remove("active");
        boostActive = false;
        window.COSMOS.InputManager.boost = 0;
    }, { passive: true });

    btn.addEventListener("pointercancel", () => {
        btn.classList.remove("active");
        boostActive = false;
        window.COSMOS.InputManager.boost = 0;
    }, { passive: true });

    btn.addEventListener("pointerleave", () => {
        btn.classList.remove("active");
        boostActive = false;
        window.COSMOS.InputManager.boost = 0;
    }, { passive: true });
}

function setupVerticalButtons() {
    setupVerticalBtn("mobile-vbtn-up", "up", (active) => {
        vUpActive = active;
        window.COSMOS.InputManager.up = active ? 1 : 0;
    });

    setupVerticalBtn("mobile-vbtn-down", "down", (active) => {
        vDownActive = active;
        window.COSMOS.InputManager.down = active ? 1 : 0;
    });
}

function setupVerticalBtn(id, _dir, onChange) {
    const btn = el(id);
    if (!btn) return;

    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add("active");
        onChange(true);
        try { navigator.vibrate && navigator.vibrate(10); } catch (_) {}
    }, { passive: false });

    btn.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        btn.classList.remove("active");
        onChange(false);
    }, { passive: true });

    btn.addEventListener("pointercancel", () => {
        btn.classList.remove("active");
        onChange(false);
    }, { passive: true });

    btn.addEventListener("pointerleave", () => {
        btn.classList.remove("active");
        onChange(false);
    }, { passive: true });
}

// ─── Selection Handler ─────────────────────────────────────────

function handleSelect() {
    if (!window.COSMOS) return;

    window.COSMOS.CrosshairRaycaster.update();
    const target = window.COSMOS.CrosshairRaycaster.getTargetInfo();
    if (!target) return;

    window.COSMOS.startFlyTo(target.name, target.worldPos, target.radius, target.mesh);
    window.COSMOS.showInfoPanel(target.name);

    window.COSMOS.flyTo.onComplete = () => {
        window.COSMOS.flyTo.following = true;
    };
}

// ─── Help Toggle ───────────────────────────────────────────────

function setupHelpToggle() {
    const hBtn = el("mobile-help-btn");
    const hPanel = el("mobile-help-panel");
    if (!hBtn || !hPanel) return;

    hBtn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        helpOpen = !helpOpen;
        hPanel.classList.toggle("open", helpOpen);
    }, { passive: false });

    document.addEventListener("pointerdown", (e) => {
        if (!helpOpen) return;
        if (e.target.closest("#mobile-help-panel") || e.target.closest("#mobile-help-btn")) return;
        helpOpen = false;
        hPanel.classList.remove("open");
    }, { passive: true });
}

// ─── HUD Auto-Hide ────────────────────────────────────────────

function setupHUDAutoHide() {
    if (!infoPanel || !hudEl) return;

    const observer = new MutationObserver(() => {
        const isOpen = infoPanel.classList.contains("visible");
        hudEl.classList.toggle("dimmed", isOpen);
    });

    observer.observe(infoPanel, {
        attributes: true,
        attributeFilter: ["class"]
    });
}

// ─── Desktop Overrides ─────────────────────────────────────────

function setupDesktopOverrides() {
    if (pointerHintEl) {
        pointerHintEl.classList.add("hidden");
    }

    if (crosshairEl) {
        crosshairEl.classList.add("visible");
    }

    if (controlsToggle) {
        controlsToggle.style.display = "none";
    }
    if (controlsPanel) {
        controlsPanel.style.display = "none";
    }

    const canvas = window.COSMOS.InputManager.domElement;
    if (canvas) {
        canvas.addEventListener("click", (e) => {
            e.stopImmediatePropagation();
        }, true);

        if (canvas.requestPointerLock) {
            canvas.requestPointerLock = () => {};
        }
    }
}

// ─── Input Update (called each frame from animate) ─────────────
// Movement: writes directly to InputManager.
// Camera look: raw pixel deltas pass through to InputManager.lookX/lookY.
//   FlyingController.update() in main.js consumes them with its own
//   lookSensitivity and pitch clamping — we do NOT process or zero them here.

function updateMobileInput() {
    if (!isTouchDevice || !window.COSMOS) return;

    const IM = window.COSMOS.InputManager;

    // ── Movement from joystick (only when no keyboard input active) ──
    if (!IM.forward && !IM.backward && !IM.left && !IM.right) {
        IM.forward = joy.y < -DEADZONE ? Math.abs(joy.y) : 0;
        IM.backward = joy.y > DEADZONE ? Math.abs(joy.y) : 0;
        IM.left = joy.x < -DEADZONE ? Math.abs(joy.x) : 0;
        IM.right = joy.x > DEADZONE ? Math.abs(joy.x) : 0;
    }

    // Camera look: IM.lookX/IM.lookY are set by setupCameraDrag.
    // FlyingController.update() applies its own sensitivity and reads/resets them.
    // We do NOT touch them here.

    // Keep crosshair visible on mobile
    if (crosshairEl && !crosshairEl.classList.contains("visible")) {
        crosshairEl.classList.add("visible");
    }
    if (pointerHintEl && !pointerHintEl.classList.contains("hidden")) {
        pointerHintEl.classList.add("hidden");
    }
}

// ─── Auto-Init ─────────────────────────────────────────────────

if (typeof window !== "undefined") {
    const _initInterval = setInterval(() => {
        if (window.COSMOS && window.COSMOS.InputManager) {
            clearInterval(_initInterval);
            initMobileControls();
        }
    }, 50);

    setTimeout(() => clearInterval(_initInterval), 5000);
}
