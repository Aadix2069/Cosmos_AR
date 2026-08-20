// ─── COSMOS WEBXR — MOBILE TOUCH CONTROLS ──────────────────────
// Touch input layer for mobile devices. Writes to the existing
// InputManager and calls existing functions — no duplicate systems.

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

// ─── State ─────────────────────────────────────────────────────

const joystickRadius = { current: 0 };
const joystickCenter = { x: 0, y: 0 };
const joy = { x: 0, y: 0 };
const joySmooth = { x: 0, y: 0 };

let joystickTouchId = null;
let cameraTouchId = null;

const cameraDrag = {
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    active: false
};

let boostActive = false;
let vUpActive = false;
let vDownActive = false;
let helpOpen = false;
let initialized = false;

const JOYSTICK_SMOOTH = 10;
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

    // Start the input update loop (runs every frame via animate)
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
            <div class="mobile-help-row"><span class="mobile-help-action">MOVE</span><span class="mobile-help-method">Joystick</span></div>
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

    // All HUD elements are queried on-demand via el("id") — no static bindings needed
}

function el(id) {
    return document.getElementById(id);
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

    // Use Screen Orientation API if available
    if (screen.orientation && screen.orientation.type) {
        isLandscape = screen.orientation.type.startsWith("landscape");
    } else if (typeof window.orientation !== "undefined") {
        // Legacy orientation API: 0, 90, -90, 180 are landscape-ish
        isLandscape = window.orientation === 90 || window.orientation === -90;
    } else {
        // Fallback: compare dimensions
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

// ─── Joystick ──────────────────────────────────────────────────

function setupJoystick() {
    const joyEl = el("mobile-joystick");
    const thumb = el("mobile-joystick-thumb");
    if (!joyEl || !thumb) return;

    joyEl.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const touch = e.changedTouches[0];
        joystickTouchId = touch.identifier;

        const rect = joyEl.getBoundingClientRect();
        joystickCenter.x = rect.left + rect.width / 2;
        joystickCenter.y = rect.top + rect.height / 2;
        joystickRadius.current = rect.width / 2;

        updateJoystick(touch.clientX, touch.clientY);
        thumb.classList.add("active");
    }, { passive: false });

    document.addEventListener("touchmove", (e) => {
        if (joystickTouchId === null) return;

        for (const touch of e.changedTouches) {
            if (touch.identifier === joystickTouchId) {
                e.preventDefault();
                updateJoystick(touch.clientX, touch.clientY);
                break;
            }
        }
    }, { passive: false });

    document.addEventListener("touchend", (e) => {
        for (const touch of e.changedTouches) {
            if (touch.identifier === joystickTouchId) {
                joystickTouchId = null;
                joy.x = 0;
                joy.y = 0;
                thumb.style.transform = "translate(-50%, -50%)";
                thumb.classList.remove("active");
                break;
            }
        }
    }, { passive: true });

    document.addEventListener("touchcancel", (e) => {
        for (const touch of e.changedTouches) {
            if (touch.identifier === joystickTouchId) {
                joystickTouchId = null;
                joy.x = 0;
                joy.y = 0;
                thumb.style.transform = "translate(-50%, -50%)";
                thumb.classList.remove("active");
                break;
            }
        }
    }, { passive: true });
}

function updateJoystick(cx, cy) {
    const thumb = el("mobile-joystick-thumb");
    if (!thumb) return;

    let dx = cx - joystickCenter.x;
    let dy = cy - joystickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxR = joystickRadius.current;

    if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
    }

    const pctX = dx / maxR;
    const pctY = dy / maxR;

    joy.x = Math.abs(pctX) > DEADZONE ? pctX : 0;
    joy.y = Math.abs(pctY) > DEADZONE ? pctY : 0;

    const thumbHalf = thumb.offsetWidth / 2;
    const baseEl = el("mobile-joystick");
    const baseHalf = baseEl ? baseEl.offsetWidth / 2 : maxR;

    const maxThumbTravel = baseHalf - thumbHalf;
    const thumbDx = pctX * maxThumbTravel;
    const thumbDy = pctY * maxThumbTravel;

    thumb.style.transform = `translate(calc(-50% + ${thumbDx}px), calc(-50% + ${thumbDy}px))`;
}

// ─── Camera Drag (right half) ──────────────────────────────────

function setupCameraDrag() {
    const zone = el("mobile-look-zone");
    if (!zone) return;

    zone.addEventListener("touchstart", (e) => {
        // Only accept the first touch on the right side
        if (cameraTouchId !== null) return;

        const touch = e.changedTouches[0];
        const x = touch.clientX;
        const screenW = window.innerWidth;

        // Only right half of screen
        if (x < screenW * 0.45) return;

        cameraTouchId = touch.identifier;
        cameraDrag.startX = x;
        cameraDrag.startY = touch.clientY;
        cameraDrag.lastX = x;
        cameraDrag.lastY = touch.clientY;
        cameraDrag.active = true;
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
        if (cameraTouchId === null || !cameraDrag.active) return;

        for (const touch of e.changedTouches) {
            if (touch.identifier === cameraTouchId) {
                const dx = touch.clientX - cameraDrag.lastX;
                const dy = touch.clientY - cameraDrag.lastY;

                // Write to existing InputManager
                const IM = window.COSMOS.InputManager;
                IM.lookX += dx;
                IM.lookY += dy;

                cameraDrag.lastX = touch.clientX;
                cameraDrag.lastY = touch.clientY;
                break;
            }
        }
    }, { passive: true });

    document.addEventListener("touchend", (e) => {
        for (const touch of e.changedTouches) {
            if (touch.identifier === cameraTouchId) {
                cameraTouchId = null;
                cameraDrag.active = false;
                break;
            }
        }
    }, { passive: true });

    document.addEventListener("touchcancel", (e) => {
        for (const touch of e.changedTouches) {
            if (touch.identifier === cameraTouchId) {
                cameraTouchId = null;
                cameraDrag.active = false;
                break;
            }
        }
    }, { passive: true });
}

// ─── Buttons ───────────────────────────────────────────────────

function setupButtons() {
    // Select
    const selBtn = el("mobile-select-btn");
    if (selBtn) {
        selBtn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            e.stopPropagation();
            selBtn.classList.add("active");
            handleSelect();
        }, { passive: false });

        selBtn.addEventListener("touchend", (e) => {
            e.stopPropagation();
            selBtn.classList.remove("active");
        }, { passive: true });
    }

    // Boost
    const bstBtn = el("mobile-boost-btn");
    if (bstBtn) {
        bstBtn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            e.stopPropagation();
            bstBtn.classList.add("active");
            boostActive = true;
            window.COSMOS.InputManager.boost = 1;
        }, { passive: false });

        bstBtn.addEventListener("touchend", (e) => {
            e.stopPropagation();
            bstBtn.classList.remove("active");
            boostActive = false;
            window.COSMOS.InputManager.boost = 0;
        }, { passive: true });

        bstBtn.addEventListener("touchcancel", (e) => {
            bstBtn.classList.remove("active");
            boostActive = false;
            window.COSMOS.InputManager.boost = 0;
        }, { passive: true });
    }

    // Vertical Up
    const vUp = el("mobile-vbtn-up");
    if (vUp) {
        vUp.addEventListener("touchstart", (e) => {
            e.preventDefault();
            e.stopPropagation();
            vUp.classList.add("active");
            vUpActive = true;
            window.COSMOS.InputManager.up = 1;
        }, { passive: false });

        vUp.addEventListener("touchend", (e) => {
            e.stopPropagation();
            vUp.classList.remove("active");
            vUpActive = false;
            window.COSMOS.InputManager.up = 0;
        }, { passive: true });

        vUp.addEventListener("touchcancel", () => {
            vUp.classList.remove("active");
            vUpActive = false;
            window.COSMOS.InputManager.up = 0;
        }, { passive: true });
    }

    // Vertical Down
    const vDn = el("mobile-vbtn-down");
    if (vDn) {
        vDn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            e.stopPropagation();
            vDn.classList.add("active");
            vDownActive = true;
            window.COSMOS.InputManager.down = 1;
        }, { passive: false });

        vDn.addEventListener("touchend", (e) => {
            e.stopPropagation();
            vDn.classList.remove("active");
            vDownActive = false;
            window.COSMOS.InputManager.down = 0;
        }, { passive: true });

        vDn.addEventListener("touchcancel", () => {
            vDn.classList.remove("active");
            vDownActive = false;
            window.COSMOS.InputManager.down = 0;
        }, { passive: true });
    }
}

// ─── Selection Handler ─────────────────────────────────────────

function handleSelect() {
    if (!window.COSMOS) return;

    // Update raycaster to get current target
    window.COSMOS.CrosshairRaycaster.update();

    const target = window.COSMOS.CrosshairRaycaster.getTargetInfo();
    if (!target) return;

    window.COSMOS.startFlyTo(target.name, target.worldPos, target.radius, target.mesh);
    window.COSMOS.showInfoPanel(target.name);

    // Set up follow mode after flyTo completes
    window.COSMOS.flyTo.onComplete = () => {
        window.COSMOS.flyTo.following = true;
    };
}

// ─── Help Toggle ───────────────────────────────────────────────

function setupHelpToggle() {
    const hBtn = el("mobile-help-btn");
    const hPanel = el("mobile-help-panel");
    if (!hBtn || !hPanel) return;

    hBtn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
        helpOpen = !helpOpen;
        hPanel.classList.toggle("open", helpOpen);
    }, { passive: false });

    // Close help when tapping elsewhere
    document.addEventListener("touchstart", (e) => {
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
// On mobile, prevent pointer lock and manage crosshair visibility directly

function setupDesktopOverrides() {
    // Hide pointer-lock hint permanently on mobile
    if (pointerHintEl) {
        pointerHintEl.classList.add("hidden");
    }

    // Show crosshair permanently on mobile
    if (crosshairEl) {
        crosshairEl.classList.add("visible");
    }

    // Hide desktop controls toggle on mobile (we have our own ? button)
    if (controlsToggle) {
        controlsToggle.style.display = "none";
    }
    if (controlsPanel) {
        controlsPanel.style.display = "none";
    }

    // Override the canvas click handler to prevent pointer lock on mobile
    const canvas = window.COSMOS.InputManager.domElement;
    if (canvas) {
        canvas.addEventListener("click", (e) => {
            // On mobile, prevent pointer lock request
            e.stopImmediatePropagation();
        }, true); // Capture phase to run before main.js handler
    }

    // Override requestPointerLock on mobile
    if (canvas && canvas.requestPointerLock) {
        canvas.requestPointerLock = () => {};
    }
}

// ─── Input Update (called each frame from animate) ─────────────

function updateMobileInput() {
    if (!isTouchDevice || !window.COSMOS) return;

    // Smooth joystick values
    joySmooth.x += (joy.x - joySmooth.x) * Math.min(1, JOYSTICK_SMOOTH * getDelta());
    joySmooth.y += (joy.y - joySmooth.y) * Math.min(1, JOYSTICK_SMOOTH * getDelta());

    const IM = window.COSMOS.InputManager;

    // Only set movement from joystick if no keyboard input is active
    // (prevents conflicts if a keyboard is connected)
    if (!IM.forward && !IM.backward && !IM.left && !IM.right) {
        IM.forward = joySmooth.y < -DEADZONE ? Math.abs(joySmooth.y) : 0;
        IM.backward = joySmooth.y > DEADZONE ? Math.abs(joySmooth.y) : 0;
        IM.left = joySmooth.x < -DEADZONE ? Math.abs(joySmooth.x) : 0;
        IM.right = joySmooth.x > DEADZONE ? Math.abs(joySmooth.x) : 0;
    }

    // Keep crosshair visible on mobile (override pointerlockchange behavior)
    if (crosshairEl && !crosshairEl.classList.contains("visible")) {
        crosshairEl.classList.add("visible");
    }
    if (pointerHintEl && !pointerHintEl.classList.contains("hidden")) {
        pointerHintEl.classList.add("hidden");
    }
}

// Simple delta tracker (uses performance.now)
let _lastTime = performance.now();
function getDelta() {
    const now = performance.now();
    const dt = (now - _lastTime) / 1000;
    _lastTime = now;
    return Math.min(dt, 0.1); // Clamp to avoid spikes
}

// ─── Auto-Init ─────────────────────────────────────────────────

// Wait for COSMOS to be available, then initialize
if (typeof window !== "undefined") {
    // COSMOS is exposed by main.js after module execution
    // Use a short polling interval to wait for it
    const _initInterval = setInterval(() => {
        if (window.COSMOS && window.COSMOS.InputManager) {
            clearInterval(_initInterval);
            initMobileControls();
        }
    }, 50);

    // Timeout after 5 seconds — don't block forever
    setTimeout(() => clearInterval(_initInterval), 5000);
}
