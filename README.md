# 🌌 COSMOS WEBXR

### Interactive Solar System & Deep-Space Edutainment Experience

**COSMOS WEBXR** is an interactive WebXR-based educational experience that allows users—especially children—to explore a visually immersive representation of our Solar System and selected deep-space phenomena directly from the web.

The project combines **HTML, CSS, JavaScript, Three.js, procedural materials, astronomical textures, animation, and WebXR** to create a lightweight browser-based space exploration experience.

The primary objective is not to create a physically perfect astronomical simulator, but to create a **scientifically grounded, visually convincing, interactive educational environment** that makes astronomical concepts easy and exciting to explore.

---

## 🚀 Project Vision

Traditional educational diagrams of the Solar System are static and difficult to understand spatially.

COSMOS attempts to change that by allowing users to:

* Explore the Solar System in 3D.
* Observe all eight planets.
* Understand relative planetary positions.
* Explore moons and other Solar System objects.
* Learn about planets and astronomical phenomena.
* Interact with celestial objects.
* Explore a distant black hole.
* Eventually use WebXR to experience the environment in immersive AR/VR.

The project deliberately uses **compressed spatial distances**.

Actual astronomical distances are enormous and impossible to represent literally in an interactive educational scene.

Therefore, COSMOS uses a **nonlinear visual distance system** that preserves the perception and ordering of astronomical distances while keeping the environment explorable.

---

# ✨ Current Features

## ☀️ Solar System

The main environment contains:

* Sun
* Mercury
* Venus
* Earth
* Mars
* Jupiter
* Saturn
* Uranus
* Neptune

Each planet uses astronomical surface textures and individually configurable:

* radius
* orbital distance
* orbital speed
* rotation speed
* texture
* material
* label
* metadata

---

## 🌍 Planetary Textures

The project currently contains high-resolution astronomical textures including:

```text
8k_sun.jpg
8k_mercury.jpg
8k_venus_atmosphere.jpg
8k_earth_daymap.jpg
8k_earth_nightmap.jpg
8k_mars.jpg
8k_jupiter.jpg
8k_saturn.jpg
8k_saturn_ring_alpha.png
8k_uranus.jpg
2k_neptune.jpg
```

These textures are mapped onto Three.js spherical geometry to create the planetary surfaces.

Earth additionally has:

* Day texture
* Night texture

Saturn additionally has:

* Ring texture with transparency

---

# 🌌 Space Environment

The project contains multiple space/background assets.

Current star-field assets include:

```text
8k_stars.jpg
8k_stars_milky_way.jpg
```

The background is designed to provide a deep-space environment surrounding the Solar System.

The Milky Way background provides the primary large-scale astronomical backdrop.

---

# 🪐 Dwarf Planets

The project also contains textures for several dwarf planets:

```text
4k_ceres_fictional.jpg
4k_makemake_fictional.jpg
2k_eris_fictional.jpg
2k_haumea_fictional.jpg
```

These are used as visual representations rather than claims of scientifically accurate surface imagery.

The project explicitly distinguishes between:

* scientifically sourced planetary textures
* artistic/fictional textures
* procedural visualizations

This distinction is important for an educational application.

---

# ☄️ Extended Solar System

The long-term Solar System representation includes more than the eight planets.

The scene architecture is designed to support:

### Natural Satellites

Representative major moons:

* Moon
* Phobos
* Deimos
* Io
* Europa
* Ganymede
* Callisto
* Titan
* Enceladus
* Rhea
* Iapetus
* Titania
* Oberon
* Ariel
* Umbriel
* Miranda
* Triton

The architecture is intentionally extensible so additional moons can be added later.

---

### 💍 Planetary Rings

Ring systems are represented according to the actual planets that possess them:

* Saturn
* Jupiter
* Uranus
* Neptune

Saturn receives the most visually prominent ring system.

The other planetary ring systems remain significantly more subtle.

---

### ☄️ Asteroid Belt

A procedural asteroid population is planned between:

**Mars → Jupiter**

The asteroid belt is intentionally represented as a sparse population rather than a dense wall of rocks.

For performance, the implementation should prefer:

* `THREE.InstancedMesh`
* `THREE.Points`

over thousands of individual meshes.

---

### 🌑 Kuiper Belt

The outer Solar System includes a conceptual Kuiper Belt beyond Neptune.

It is represented as a sparse population of distant icy objects.

---

### 🌌 Oort Cloud

The Oort Cloud is represented conceptually as an extremely distant, sparse spherical distribution surrounding the Solar System.

Because its true scale is enormous, the visualization is intentionally compressed.

---

### ☄️ Comets

The project architecture supports representative comets consisting of:

* nucleus
* coma
* tail

The tail direction can be procedurally oriented away from the Sun.

---

# 📏 Astronomical Distance Illusion

One of the core design decisions in COSMOS is **not using literal Solar System scale**.

For example, if literal distances were used, the planets would become either:

* impossible to navigate,
* invisible from useful viewing distances,
* or visually meaningless.

Instead, COSMOS separates:

### Physical Data

Real astronomical values are retained as source information.

### Visual Distance

A nonlinear compression function converts those values into interactive scene coordinates.

Conceptually:

```text
Real astronomical distance
            ↓
Distance compression function
            ↓
Interactive visual distance
```

This allows the user to perceive:

```text
Sun
 ↓
Mercury
 ↓
Venus
 ↓
Earth
 ↓
Mars
 ↓
Asteroid Belt
 ↓
Jupiter
 ↓
Saturn
 ↓
Uranus
 ↓
Neptune
 ↓
Kuiper Belt
```

without requiring a physically impossible scene size.

The purpose is **perceptual accuracy**, not literal scale accuracy.

---

# ☀️ Solar Lighting

The Sun acts as the primary illumination source for the planetary system.

The intended lighting relationship is:

```text
SUN
 │
 ├── Mercury
 ├── Venus
 ├── Earth
 ├── Mars
 ├── Jupiter
 ├── Saturn
 ├── Uranus
 └── Neptune
```

The implementation uses a central solar light rather than independently illuminating each planet.

The lighting system is tuned so that sunlight visually reaches the outer planets while maintaining a believable brightness hierarchy.

The outer planets should not appear artificially bright.

---

# 🏷️ Celestial Object Labels

The Solar System includes a reusable label architecture.

Current/planned labels include:

```text
SUN
MERCURY
VENUS
EARTH
MARS
JUPITER
SATURN
URANUS
NEPTUNE
```

Labels are designed to be:

* small
* readable
* unobtrusive
* camera-facing
* reusable
* compatible with future WebXR interaction

The labels are intentionally not large UI cards because the celestial objects should remain the primary visual focus.

---

# 🕳️ Black Hole

One of the major visual features of COSMOS is a distant black-hole visualization.

The black hole is intentionally positioned far away from the Solar System using the same compressed-distance philosophy.

It is an educational visualization inspired by scientifically grounded black-hole imagery.

It is **not intended to represent a specific real black hole**.

---

## Black Hole Visual Structure

The black hole consists of:

```text
BlackHoleSystem
│
├── Black Hole Shadow
├── Main Accretion Disk
├── Upper Lensed Disk
├── Lower Lensed Disk
├── Inner Hot Plasma
├── Glow Layers
├── Plasma Shader
└── Label
```

The defining visual structure is:

```text
                     BRIGHT UPPER ARC
                  ___________________
               __/                   \__
             _/                         \_
            /                             \
           |                               |
           |        BLACK HOLE SHADOW      |
           |                               |
            \                             /
             \_                         _/
               \__                   __/
                  \_________________/

================================================
                 MAIN ACCRETION DISK
================================================
```

The visual effect represents a simplified approximation of gravitational lensing.

---

# 🔥 Accretion Disk

The accretion disk uses a procedural temperature gradient.

The intended progression is:

```text
WHITE
  ↓
YELLOW-WHITE
  ↓
YELLOW
  ↓
ORANGE
  ↓
DEEP ORANGE
  ↓
RED
  ↓
DARK RED
  ↓
TRANSPARENT
```

The inner region is extremely bright and hot.

The outer region becomes progressively darker and thinner.

The disk also uses procedural variation to avoid looking like a flat geometric ring.

---

# 🌀 Gravitational Lensing

The black hole uses a real-time visual approximation of gravitational lensing.

It does **not** attempt to perform a complete general-relativistic ray-tracing simulation.

Instead, the effect is created through:

* curved disk geometry
* upper lensed disk
* lower lensed disk
* central black-hole shadow
* controlled occlusion
* procedural plasma
* emissive materials
* brightness gradients

The purpose is to communicate the concept visually while remaining suitable for WebXR.

---

# 🌐 3D Black Hole Development

The black-hole system is being developed as a true 3D structure rather than a flat image.

The intended architecture is:

```text
BlackHoleSystem
│
├── BlackHoleCore
├── EventHorizon
├── PhotonSphereApproximation
├── AccretionDisk3D
│   ├── InnerDisk
│   ├── MiddleDisk
│   └── OuterDisk
├── LensedDisk3D
│   ├── UpperLensedStructure
│   ├── LowerLensedStructure
│   └── SideLensingStructures
├── PlasmaVolume
├── GlowLayers
└── Label
```

The important design principle is:

> The black hole should look the same from the primary viewing direction while actually existing in three-dimensional space.

This allows future users to move around the black hole in WebXR and perceive:

* real disk thickness
* 3D plasma
* depth
* perspective changes
* spatial curvature
* different viewing angles

---

# 🧪 Scientific Accuracy Philosophy

COSMOS follows a simple rule:

> **Use scientifically accurate data wherever practical, and clearly identify visual approximations where physical simulation would be impractical.**

Examples:

### Accurate / Data-Based

* Planet order
* Planet identities
* Major planetary textures
* Relative orbital relationships
* Solar System hierarchy
* Existence of moons
* Existence of asteroid belt
* Kuiper Belt
* Basic black-hole concepts

### Visual Approximation

* Compressed planetary distances
* Oort Cloud scale
* Asteroid distribution
* Black-hole gravitational lensing
* Solar wind visualization
* Heliosphere visualization
* Relativistic brightness approximation

This distinction prevents the project from presenting artistic visualization as exact scientific simulation.

---

# 🛠️ Technology Stack

COSMOS is intentionally lightweight.

## Frontend

```text
HTML5
CSS3
JavaScript
```

## 3D / WebXR

```text
Three.js
WebXR APIs
WebGL
```

## Rendering

```text
THREE.WebGLRenderer
THREE.Scene
THREE.PerspectiveCamera
THREE.Mesh
THREE.BufferGeometry
THREE.ShaderMaterial
THREE.MeshStandardMaterial
THREE.MeshBasicMaterial
THREE.PointLight
THREE.InstancedMesh
THREE.Points
```

The project does not depend on React, React Three Fiber, or other frontend frameworks.

---

# 📁 Current Project Structure

```text
COSMOS_WEBXR/
│
├── assets/
│   │
│   ├── space/
│   │
│   ├── sun/
│   │
│   ├── textures/
│   │   ├── 2k_eris_fictional.jpg
│   │   ├── 2k_haumea_fictional.jpg
│   │   ├── 2k_neptune.jpg
│   │   ├── 4k_ceres_fictional.jpg
│   │   ├── 4k_makemake_fictional.jpg
│   │   ├── 8k_earth_daymap.jpg
│   │   ├── 8k_earth_nightmap.jpg
│   │   ├── 8k_jupiter.jpg
│   │   ├── 8k_mars.jpg
│   │   ├── 8k_mercury.jpg
│   │   ├── 8k_saturn.jpg
│   │   ├── 8k_saturn_ring_alpha.png
│   │   ├── 8k_stars.jpg
│   │   ├── 8k_stars_milky_way.jpg
│   │   ├── 8k_sun.jpg
│   │   ├── 8k_uranus.jpg
│   │   └── 8k_venus_atmosphere.jpg
│   │
│   └── ...
│
├── css/
│   └── style.css
│
├── js/
│   └── main.js
│
└── index.html
```

The project intentionally keeps:

```text
HTML
CSS
JavaScript
Assets
```

separated.

---

# 🎮 Interaction Philosophy

COSMOS is being designed primarily for children and educational exploration.

The interface should therefore prioritize:

* immediate visual understanding
* simple controls
* minimal interface clutter
* large interactive targets
* clear labels
* smooth movement
* visual feedback
* exploration rather than complicated menus

The user should be able to understand the environment without reading a technical manual.

---

# 🥽 WebXR Direction

The project is designed to eventually support immersive exploration.

Planned WebXR interaction includes:

### Planet Selection

Users will be able to select planets.

### Planet Grabbing

Users will eventually be able to:

* grab planets
* bring them closer
* inspect their surfaces
* rotate them
* learn about them

The original Solar System scene remains the foundation for these interactions.

---

# 🧠 Educational Interaction

Future educational interactions will allow users to discover:

* planet names
* planet composition
* atmosphere
* temperature
* gravity
* moons
* orbital characteristics
* historical discoveries
* interesting facts
* astronomical phenomena

The goal is to turn astronomical exploration into an interactive learning experience.

---

# ⚡ Performance Philosophy

WebXR requires stable rendering performance.

Therefore COSMOS prioritizes:

```text
Visual Quality
      +
Scientific Meaning
      +
Performance
```

rather than maximum graphical complexity.

Optimization strategies include:

* instancing
* GPU-friendly shaders
* procedural materials
* limited transparent layers
* optimized geometry
* compressed visual distances
* lightweight particle systems
* avoiding unnecessary meshes

The target is stable real-time rendering suitable for XR hardware.

---

# 🎨 Design Philosophy

COSMOS should feel:

* cinematic
* educational
* futuristic
* calm
* immersive
* understandable
* scientifically inspired

It should NOT feel like:

* a generic 3D demo
* a game menu
* a science textbook
* a random collection of planets
* a heavy enterprise dashboard

The celestial objects should always remain the primary focus.

---

# 🧭 Development Roadmap

## Phase 1 — Solar System Foundation

* [x] Three.js scene
* [x] Camera
* [x] Star background
* [x] Sun
* [x] Eight planets
* [x] Planet textures
* [x] Basic orbital system
* [x] Distance illusion
* [x] Solar lighting

## Phase 2 — Solar System Expansion

* [ ] Planetary moons
* [ ] Planetary rings
* [ ] Asteroid Belt
* [ ] Trojan asteroids
* [ ] Dwarf planets
* [ ] Kuiper Belt
* [ ] Comets
* [ ] Oort Cloud
* [ ] Solar wind
* [ ] Heliosphere

## Phase 3 — Deep Space

* [x] Distant black-hole concept
* [x] Black-hole shadow
* [x] Accretion disk
* [x] Upper gravitational-lensing structure
* [x] Lower gravitational-lensing structure
* [x] Plasma visualization
* [ ] Full 3D black-hole refinement
* [ ] Camera-dependent lensing approximation
* [ ] Improved star-field distortion

## Phase 4 — Interaction

* [ ] Planet selection
* [ ] Planet highlighting
* [ ] Planet grabbing
* [ ] Planet inspection
* [ ] Object information panels
* [ ] Educational facts
* [ ] Smooth camera transitions

## Phase 5 — WebXR

* [ ] WebXR session
* [ ] VR controller support
* [ ] Hand interaction
* [ ] Object grabbing
* [ ] XR labels
* [ ] Spatial UI
* [ ] Immersive navigation

## Phase 6 — Educational Experience

* [ ] Planet history
* [ ] Discovery timeline
* [ ] Interactive comparisons
* [ ] Planet size comparison
* [ ] Gravity comparison
* [ ] Temperature comparison
* [ ] Guided exploration
* [ ] Child-friendly educational mode

---

# 📚 Educational Goal

COSMOS is ultimately intended to answer questions such as:

> What does our Solar System actually look like?

> How far apart are the planets?

> Why does the Sun illuminate the planets?

> What exists beyond Neptune?

> What are planetary rings made of?

> How do moons orbit planets?

> What happens around a black hole?

> How does gravity bend light?

Instead of presenting these concepts only through text, COSMOS attempts to make them **visually explorable**.

---

# ⚠️ Scientific Visualization Disclaimer

COSMOS is an educational visualization.

It does not attempt to reproduce the complete physical behavior of the Solar System or black holes.

In particular:

* planetary distances are compressed
* object sizes may be visually exaggerated
* orbital speeds may be accelerated
* distant structures are represented conceptually
* black-hole lensing is an approximation
* plasma behavior is procedurally simulated
* some available textures are artistic/fictional

Where exact physical simulation would prevent effective interaction, the project prioritizes **conceptual accuracy and educational clarity**.

---

# 🔭 Long-Term Vision

The long-term goal is to turn COSMOS into a browser-based **interactive astronomical museum**.

A user should be able to enter the experience and progressively move from:

```text
Earth
  ↓
Solar System
  ↓
Outer Solar System
  ↓
Deep Space
  ↓
Black Holes
  ↓
Galaxies
  ↓
The Larger Universe
```

without requiring a traditional application installation.

The core idea is simple:

> **Don't just teach the Solar System. Let the user explore it.**

---

# 👨‍💻 Project Status

**Current Status:** Active Development

**Platform:** Web

**Primary Technologies:** HTML, CSS, JavaScript, Three.js, WebGL, WebXR

**Project Type:** Educational / Edutainment / Interactive 3D

**Target Audience:** Students, children, educators, and anyone interested in astronomy.

---

# 📄 License & Asset Attribution

Before publishing the repository publicly, verify the individual licenses and attribution requirements of every external texture, model, font, sound, and other asset used by the project.

In particular, distinguish between:

* original project code
* third-party textures
* public-domain assets
* Creative Commons assets
* fictional/artistic textures
* other externally sourced materials

Do not assume that an asset being freely downloadable means it is unrestricted for redistribution.

---

# 🌌 COSMOS

### Explore. Interact. Understand the Universe.

```text
             ✦        .        ✦
        .         ☀          .
             \    /   \    /
        ✦      \ /     \ /       ✦
                🪐
          .              .
             🌍    🔴
        ✦          .          ✦

             C O S M O S
```
