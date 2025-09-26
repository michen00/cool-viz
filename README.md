# Aurora Flow Studio

A fun, lightweight visualization that lives entirely in the browser. Sculpt a shimmering flow field with your cursor or fingertip, switch between neon palettes, and export stills as high-resolution PNGs.

## ✨ Features

- **Responsive flow field** rendered on Canvas with over a thousand particles dancing through a trig-based vector field.
- **Palette playground**: five curated color stories with a single click, each updating the UI chrome automatically.
- **Real-time controls** for velocity and trail persistence, plus quick shortcuts for pausing, shuffling, and saving frames.
- **Pointer physics**: bursts respond to clicks/taps, shuffle pulses, and drift gently with pointer motion; fully touch-friendly.
- **Pages-ready**: deploy the root folder to GitHub Pages or any static host—no build step required.

## 🚀 Quick start

Try it at [michen00.github.io/cool-viz](https://michen00.github.io/cool-viz).

### 📡 Run it locally

Serve the project from the repo root so the Canvas can animate with the controls.

```bash
cd cool-viz
python3 -m http.server 5173
```

Open `http://localhost:5173` and start sculpting. Any static server works (`npx serve`, VS Code Live Server, etc.).

<!-- For a custom domain, point your DNS to GitHub Pages and drop a `CNAME` file in the repo root. -->

## 🎛 Customize it

- **Palettes** live at the top of [`scripts/main.js`](./scripts/main.js). Add new color arrays and they auto-render as gradient chips.
- Tweak motion by adjusting `settings.speed`, `settings.trailAlpha`, or the computed `particleCount` density inside `updateParticleCount`.
- Want a branded hero? Update the HUD copy in [`index.html`](./index.html) and the global styles in [`styles/main.css`](./styles/main.css).
- For a calmer vibe, honor `prefers-reduced-motion` by lowering counts even more or defaulting to slower speeds.

## ⌨️ Controls

| Action                   | Shortcut / Gesture            |
| ------------------------ | ----------------------------- |
| Toggle pause             | `Space`                       |
| Shuffle flow field       | `R`                           |
| Save current frame (PNG) | `S`                           |
| Spark a burst            | Click / tap the canvas        |
| Adjust velocity & trails | Use the control panel sliders |

## 📁 Project structure

```
.
├── index.html         # Canvas, HUD, control panel mount point
├── styles/
│   └── main.css       # Glassmorphism UI & responsive styles
├── scripts/
│   └── main.js        # Flow field engine + UI wiring
└── README.md          # You are here
```

## 🧠 Tech notes

- Vanilla JS + Canvas 2D—no bundlers or dependencies.
- Uses modern pointer events and respects `prefers-reduced-motion`.
- Exports stills with `canvas.toBlob`, so downloads are crisp on retina displays.

Showcase it, fork it, or remix it—it's yours to play with. 💫
