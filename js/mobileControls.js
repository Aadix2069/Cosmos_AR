// ─── COSMOS WEBXR — MOBILE TOUCH CONTROLS ──────────────────────
// Pointer Events–based multi-touch layer for mobile devices.
// Single authoritative input state — no conflicting copies.
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

// ─── Authoritative Input State (single source of truth) ───────

const mobileInput = {
    joystick: {
        active: false,
        pointerId: null,
        x: 0,
        y: 0
    },
    look: {
        active: false,
        pointerId: null,
        lastX: 0,
        lastY: 0,
        deltaX: 0,
        deltaY: 0
    },
    boost: false,
    vUp: false,
    vDown: false
};

// Joystick center/radius (computed on pointerdown)
const joystickCenter = { x: 0, y: 0 };
let joystickRadius = 0;

// Help panel
let helpOpen = false;

// Init guard
let initialized = false;

// ─── Constants ─────────────────────────────────────────────────

const DEADZONE = 0.08;
const LOOK_LEFT_CUTOFF = 0.4; // right 60% of screen for camera

// ─── Reset Functions (centralized) ────────────────────────────

function resetJoystick() {
    mobileInput.joystick.active = false;
    mobileInput.joystick.pointerId = null;
    mobileInput.joystick.x = 0;
    mobileInput.joystick.y = 0;

    const thumb = el("mobile-joystick-thumb");
    if (thumb) {
        thumb.style.transform = "translate(-50%, -50%)";
        thumb.classList.remove("active");
    }
}

function resetLook() {
    mobileInput.look.active = false;
    mobileInput.look.pointerId = null;
    mobileInput.look.lastX = 0;
    mobileInput.look.lastY = 0;
    mobileInput.look.deltaX = 0;
    mobileInput.look.deltaY = 0;
}

function resetButtons() {
    mobileInput.boost = false;
    mobileInput.vUp = false;
    mobileInput.vDown = false;

    const IM = window.COSMOS ? window.COSMOS.InputManager : null;
    if (IM) {
        IM.boost = 0;
        IM.up = 0;
        IM.down = 0;
    }

    ["mobile-select-btn", "mobile-boost-btn", "mobile-vbtn-up", "mobile-vbtn-down"]
        .forEach(id => {
            const btn = el(id);
            if (btn) btn.classList.remove("active");
        });
}

function resetAllMobileInput() {
    resetJoystick();
    resetLook();
    resetButtons();
}

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
    setupEmergencyReset();

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

// ─── Emergency Reset ───────────────────────────────────────────

function setupEmergencyReset() {
    window.addEventListener("blur", resetAllMobileInput);

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) resetAllMobileInput();
    });

    document.addEventListener("pointercancel", resetAllMobileInput);
    document.addEventListener("touchcancel", resetAllMobileInput);

    window.addEventListener("orientationchange", () => {
        setTimeout(resetAllMobileInput, 100);
    });
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

        mobileInput.joystick.active = true;
        mobileInput.joystick.pointerId = e.pointerId;

        const rect = joyEl.getBoundingClientRect();
        joystickCenter.x = rect.left + rect.width / 2;
        joystickCenter.y = rect.top + rect.height / 2;
        joystickRadius = rect.width / 2;

        updateJoystickPosition(e.clientX, e.clientY);
        thumb.classList.add("active");

        try { joyEl.setPointerCapture(e.pointerId); } catch (_) {}
    }, { passive: false });

    joyEl.addEventListener("pointermove", (e) => {
        if (e.pointerId !== mobileInput.joystick.pointerId) return;
        if (!mobileInput.joystick.active) return;
        e.preventDefault();
        updateJoystickPosition(e.clientX, e.clientY);
    }, { passive: false });

    joyEl.addEventListener("pointerup", (e) => {
        if (e.pointerId !== mobileInput.joystick.pointerId) return;
        resetJoystick();
    }, { passive: true });

    joyEl.addEventListener("pointercancel", (e) => {
        if (e.pointerId !== mobileInput.joystick.pointerId) return;
        resetJoystick();
    }, { passive: true });

    joyEl.addEventListener("lostpointercapture", (e) => {
        if (e.pointerId !== mobileInput.joystick.pointerId) return;
        resetJoystick();
    }, { passive: true });

    // Safety net: track pointer even when it leaves the joystick element
    document.addEventListener("pointermove", (e) => {
        if (!mobileInput.joystick.active) return;
        if (e.pointerId !== mobileInput.joystick.pointerId) return;
        updateJoystickPosition(e.clientX, e.clientY);
    }, { passive: true });

    document.addEventListener("pointerup", (e) => {
        if (e.pointerId !== mobileInput.joystick.pointerId) return;
        resetJoystick();
    }, { passive: true });

    document.addEventListener("pointercancel", (e) => {
        if (e.pointerId !== mobileInput.joystick.pointerId) return;
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

    mobileInput.joystick.x = Math.abs(pctX) > DEADZONE ? pctX : 0;
    mobileInput.joystick.y = Math.abs(pctY) > DEADZONE ? pctY : 0;

    const thumbHalf = thumb.offsetWidth / 2;
    const joyEl = el("mobile-joystick");
    const baseHalf = joyEl ? joyEl.offsetWidth / 2 : maxR;
    const maxTravel = baseHalf - thumbHalf;
    const thumbDx = pctX * maxTravel;
    const thumbDy = pctY * maxTravel;

    thumb.style.transform =
        `translate(calc(-50% + ${thumbDx}px), calc(-50% + ${thumbDy}px))`;
}

// ─── Camera Drag — Right-side look area (Pointer Events) ───────
// RIGHT SIDE — camera only, never movement.
// Uses its own independent pointerId.

function setupCameraDrag() {
    const zone = el("mobile-look-zone");
    if (!zone) return;

    zone.addEventListener("pointerdown", (e) => {
        if (mobileInput.look.active) return;
        if (e.clientX < window.innerWidth * LOOK_LEFT_CUTOFF) return;

        mobileInput.look.active = true;
        mobileInput.look.pointerId = e.pointerId;
        mobileInput.look.lastX = e.clientX;
        mobileInput.look.lastY = e.clientY;
        mobileInput.look.deltaX = 0;
        mobileInput.look.deltaY = 0;

        try { zone.setPointerCapture(e.pointerId); } catch (_) {}
    }, { passive: true });

    zone.addEventListener("pointermove", (e) => {
        if (e.pointerId !== mobileInput.look.pointerId) return;
        if (!mobileInput.look.active) return;

        mobileInput.look.deltaX += e.clientX - mobileInput.look.lastX;
        mobileInput.look.deltaY += e.clientY - mobileInput.look.lastY;
        mobileInput.look.lastX = e.clientX;
        mobileInput.look.lastY = e.clientY;
    }, { passive: true });

    zone.addEventListener("pointerup", (e) => {
        if (e.pointerId !== mobileInput.look.pointerId) return;
        resetLook();
    }, { passive: true });

    zone.addEventListener("pointercancel", (e) => {
        if (e.pointerId !== mobileInput.look.pointerId) return;
        resetLook();
    }, { passive: true });

    zone.addEventListener("lostpointercapture", (e) => {
        if (e.pointerId !== mobileInput.look.pointerId) return;
        resetLook();
    }, { passive: true });

    // Safety net on document level
    document.addEventListener("pointermove", (e) => {
        if (!mobileInput.look.active) return;
        if (e.pointerId !== mobileInput.look.pointerId) return;

        mobileInput.look.deltaX += e.clientX - mobileInput.look.lastX;
        mobileInput.look.deltaY += e.clientY - mobileInput.look.lastY;
        mobileInput.look.lastX = e.clientX;
        mobileInput.look.lastY = e.clientY;
    }, { passive: true });

    document.addEventListener("pointerup", (e) => {
        if (e.pointerId !== mobileInput.look.pointerId) return;
        resetLook();
    }, { passive: true });

    document.addEventListener("pointercancel", (e) => {
        if (e.pointerId !== mobileInput.look.pointerId) return;
        resetLook();
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
        mobileInput.boost = true;
        window.COSMOS.InputManager.boost = 1;
        try { navigator.vibrate && navigator.vibrate(10); } catch (_) {}
    }, { passive: false });

    btn.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        btn.classList.remove("active");
        mobileInput.boost = false;
        window.COSMOS.InputManager.boost = 0;
    }, { passive: true });

    btn.addEventListener("pointercancel", () => {
        btn.classList.remove("active");
        mobileInput.boost = false;
        window.COSMOS.InputManager.boost = 0;
    }, { passive: true });

    btn.addEventListener("pointerleave", () => {
        btn.classList.remove("active");
        mobileInput.boost = false;
        window.COSMOS.InputManager.boost = 0;
    }, { passive: true });
}

function setupVerticalButtons() {
    setupVerticalBtn("mobile-vbtn-up", (active) => {
        mobileInput.vUp = active;
        window.COSMOS.InputManager.up = active ? 1 : 0;
    });

    setupVerticalBtn("mobile-vbtn-down", (active) => {
        mobileInput.vDown = active;
        window.COSMOS.InputManager.down = active ? 1 : 0;
    });
}

function setupVerticalBtn(id, onChange) {
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

// ─── Frame-Safe Input Update (called each frame from animate) ──
// ALWAYS writes current mobile input state to InputManager.
// No guards on previous InputManager values — that was the sticking bug.

function updateMobileInput() {
    if (!isTouchDevice || !window.COSMOS) return;

    const IM = window.COSMOS.InputManager;

    // ── Movement: ALWAYS write from mobileInput.joystick ──
    const jx = mobileInput.joystick.x;
    const jy = mobileInput.joystick.y;

    IM.forward = jy < -DEADZONE ? Math.abs(jy) : 0;
    IM.backward = jy > DEADZONE ? Math.abs(jy) : 0;
    IM.left = jx < -DEADZONE ? Math.abs(jx) : 0;
    IM.right = jx > DEADZONE ? Math.abs(jx) : 0;

    // ── Camera look: consume accumulated deltas, then clear ──
    if (mobileInput.look.deltaX !== 0 || mobileInput.look.deltaY !== 0) {
        IM.lookX += mobileInput.look.deltaX;
        IM.lookY += mobileInput.look.deltaY;
        mobileInput.look.deltaX = 0;
        mobileInput.look.deltaY = 0;
    }

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
