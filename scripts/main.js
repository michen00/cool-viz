const paletteLibrary = {
  aurora: {
    label: "Aurora",
    blurb: "Electric teals and violets reminiscent of northern skies.",
    colors: ["#00ffc8", "#00a0ff", "#7158ff", "#ff70ff"],
  },
  sunrise: {
    label: "Sunrise",
    blurb: "Warm citrus gradients for a golden-hour glow.",
    colors: ["#ffd166", "#ff8a5c", "#ff5d8f", "#ffb8ff"],
  },
  lagoon: {
    label: "Lagoon",
    blurb: "Tropical blues that shimmer like water.",
    colors: ["#62fff5", "#3dbdff", "#4361ee", "#9f77ff"],
  },
  ember: {
    label: "Ember",
    blurb: "Fiery pink and amber ribbons with bold contrast.",
    colors: ["#ffb347", "#ff5f6d", "#ff2d75", "#ffd166"],
  },
  ultraviolet: {
    label: "Ultraviolet",
    blurb: "Neon magenta and cyan for a club-night vibe.",
    colors: ["#6b73ff", "#1c3cff", "#ff4ecd", "#00f0ff"],
  },
};

const paletteSamplers = Object.fromEntries(
  Object.entries(paletteLibrary).map(([key, data]) => [
    key,
    createPaletteSampler(data.colors),
  ])
);

const reducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");

const settings = {
  paletteKey: "aurora",
  speed: reducedMotionMedia.matches ? 0.7 : 1.05,
  trailAlpha: reducedMotionMedia.matches ? 0.18 : 0.12,
  fieldScale: 0.00055,
  fieldStrength: 0.32,
  running: true,
  seed: Math.random() * 1000,
};

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  strength: 0,
  down: false,
  lastMove: performance.now(),
};

let canvas;
let ctx;
let controlPanel;
let panelToggleButton;
let velocityInput;
let trailInput;
let velocityReadout;
let trailReadout;
let paletteDescription;
let togglePlayButton;
let animationHandle;
let viewWidth = window.innerWidth;
let viewHeight = window.innerHeight;
let dpr = Math.min(2, window.devicePixelRatio || 1);
let particles = [];
let resumeAfterVisibility = false;

class Particle {
  constructor(spawnInside = false) {
    this.reset(spawnInside);
  }

  reset(spawnInside = false) {
    const margin = 80;
    if (spawnInside) {
      this.x = Math.random() * viewWidth;
      this.y = Math.random() * viewHeight;
    } else {
      const edge = Math.random();
      if (edge < 0.25) {
        this.x = -margin;
        this.y = Math.random() * viewHeight;
      } else if (edge < 0.5) {
        this.x = viewWidth + margin;
        this.y = Math.random() * viewHeight;
      } else if (edge < 0.75) {
        this.x = Math.random() * viewWidth;
        this.y = -margin;
      } else {
        this.x = Math.random() * viewWidth;
        this.y = viewHeight + margin;
      }
    }

    this.prevX = this.x;
    this.prevY = this.y;
    this.vx = (Math.random() - 0.5) * 0.6;
    this.vy = (Math.random() - 0.5) * 0.6;
    this.life = Math.random() * 160;
    this.maxLife = 220 + Math.random() * 240;
    this.hueShift = Math.random();
    this.thickness = 0.7 + Math.random() * 1.1;
    this.speedBias = 0.85 + Math.random() * 0.55;
  }

  step(time) {
    const flow = sampleFlow(this.x, this.y, time);
    this.vx += flow.x * settings.fieldStrength * this.speedBias;
    this.vy += flow.y * settings.fieldStrength * this.speedBias;

    const pointerPower = pointer.strength;
    if (pointerPower > 0.001) {
      const dx = pointer.x - this.x;
      const dy = pointer.y - this.y;
      const distSq = dx * dx + dy * dy + 40;
      const maxRadius = 340;
      const influence = Math.max(0, 1 - distSq / (maxRadius * maxRadius));
      const pull = (pointer.down ? 0.0028 : 0.0014) * pointerPower * influence;
      this.vx += dx * pull;
      this.vy += dy * pull;
    }

    this.vx *= 0.962;
    this.vy *= 0.962;

    this.prevX = this.x;
    this.prevY = this.y;

    this.x += this.vx * settings.speed;
    this.y += this.vy * settings.speed;

    this.life += 1;

    if (this.life > this.maxLife || this.isOutOfBounds()) {
      this.reset();
    }
  }

  draw(time) {
    const sampler = paletteSamplers[settings.paletteKey];
    const mixValue = (this.hueShift + this.life / this.maxLife + time * 0.045) % 1;
    const { r, g, b } = sampler(mixValue);

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.78)`;
    ctx.lineWidth = this.thickness;
    ctx.beginPath();
    ctx.moveTo(this.prevX, this.prevY);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
  }

  isOutOfBounds() {
    const margin = 120;
    return (
      this.x < -margin ||
      this.x > viewWidth + margin ||
      this.y < -margin ||
      this.y > viewHeight + margin
    );
  }
}

document.addEventListener("DOMContentLoaded", init);

function init() {
  canvas = document.getElementById("aurora-canvas");
  controlPanel = document.getElementById("control-panel");
  panelToggleButton = document.querySelector(".panel-toggle");

  if (!canvas) {
    console.error("Aurora canvas element missing.");
    return;
  }

  ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("Unable to acquire 2D context.");
    return;
  }

  document.body.dataset.panelOpen = window.innerWidth > 960 ? "true" : "false";
  document.body.dataset.paused = "false";

  resizeCanvas();
  particles = [];
  updateParticleCount(true);

  renderControlPanel();
  attachGlobalListeners();
  applyPaletteAccent(settings.paletteKey);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.fillStyle = "rgba(5, 1, 20, 1)";
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  scheduleFrame();

  if (typeof reducedMotionMedia.addEventListener === "function") {
    reducedMotionMedia.addEventListener("change", handleMotionPreference);
  } else if (typeof reducedMotionMedia.addListener === "function") {
    reducedMotionMedia.addListener(handleMotionPreference);
  }
}

function scheduleFrame() {
  cancelAnimationFrame(animationHandle);
  animationHandle = requestAnimationFrame(renderFrame);
}

function renderFrame(timestamp) {
  animationHandle = requestAnimationFrame(renderFrame);

  const time = timestamp * 0.001;
  updatePointerStrength(timestamp);

  if (!settings.running) {
    return;
  }

  ctx.fillStyle = `rgba(5, 1, 20, ${settings.trailAlpha})`;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < particles.length; i += 1) {
    const particle = particles[i];
    particle.step(time);
    particle.draw(time);
  }
  ctx.restore();
}

function renderControlPanel() {
  if (!controlPanel) return;

  const paletteButtons = Object.entries(paletteLibrary)
    .map(([key, data]) => {
      const [c0, c1, c2, c3] = data.colors;
      const pressed = key === settings.paletteKey;
      return `
				<button
					type="button"
					class="palette-chip"
					data-palette="${key}"
					data-label="${data.label}"
					aria-pressed="${pressed}"
					style="--c0:${c0};--c1:${c1};--c2:${c2};--c3:${c3 || c2 || c0};"
				>
					<span class="sr-only">Activate ${data.label} palette</span>
				</button>
			`;
    })
    .join("");

  controlPanel.innerHTML = `
		<div class="control-section">
			<header>
				<h2>Palette</h2>
				<p id="palette-description">${paletteLibrary[settings.paletteKey].blurb}</p>
			</header>
			<div class="palette-grid" role="list">${paletteButtons}</div>
		</div>
		<div class="control-section">
			<header>
				<h2>Motion</h2>
				<p>Fine-tune flow speed & trails.</p>
			</header>
			<div class="slider-group">
				<div class="slider">
					<label for="velocity">Velocity<span id="velocity-readout">${settings.speed.toFixed(
            2
          )}x</span></label>
					<input id="velocity" type="range" min="0.30" max="2.20" step="0.05" value="${settings.speed.toFixed(
            2
          )}" />
				</div>
				<div class="slider">
					<label for="trail">Trail fade<span id="trail-readout">${settings.trailAlpha.toFixed(
            2
          )}</span></label>
					<input id="trail" type="range" min="0.04" max="0.25" step="0.01" value="${settings.trailAlpha.toFixed(
            2
          )}" />
				</div>
			</div>
		</div>
    <div class="control-section">
      <header>
        <h2>Playground</h2>
        <p>Shuffle the field, freeze a frame, or pause the flow.</p>
      </header>
      <div class="action-row">
        <button type="button" data-action="shuffle">Shuffle field</button>
        <button type="button" data-action="capture">Save still</button>
        <button type="button" data-action="toggle">${
          settings.running ? "Pause" : "Resume"
        }</button>
      </div>
      <p class="action-hint">Tip: click or tap the canvas to spark a burst.</p>
    </div>
		<div class="panel-footer">
			<span>Shortcuts: <kbd>Space</kbd> pause, <kbd>R</kbd> shuffle, <kbd>S</kbd> save.</span>
			<span>Tip: Deploy this folder with GitHub Pages (main branch / root).</span>
		</div>
	`;

  paletteDescription = controlPanel.querySelector("#palette-description");
  velocityInput = controlPanel.querySelector("#velocity");
  trailInput = controlPanel.querySelector("#trail");
  velocityReadout = controlPanel.querySelector("#velocity-readout");
  trailReadout = controlPanel.querySelector("#trail-readout");
  togglePlayButton = controlPanel.querySelector('[data-action="toggle"]');

  wireControlEvents();
}

function wireControlEvents() {
  if (!controlPanel) return;

  controlPanel.querySelectorAll(".palette-chip").forEach((button) => {
    button.addEventListener("click", () => setPalette(button.dataset.palette));
  });

  velocityInput?.addEventListener("input", (event) => {
    const value = Number.parseFloat(event.target.value);
    updateSpeed(value, { fromControl: true });
  });

  trailInput?.addEventListener("input", (event) => {
    const value = Number.parseFloat(event.target.value);
    updateTrail(value, { fromControl: true });
  });

  controlPanel.querySelectorAll("[data-action]").forEach((button) => {
    switch (button.dataset.action) {
      case "shuffle":
        button.addEventListener("click", () => {
          randomizeField();
          createBurst(viewWidth / 2, viewHeight / 2, 1.5);
          pointer.lastMove = performance.now();
          pointer.strength = Math.max(pointer.strength, 0.85);
        });
        break;
      case "capture":
        button.addEventListener("click", captureFrame);
        break;
      case "toggle":
        button.addEventListener("click", togglePlay);
        break;
      default:
        break;
    }
  });
}

function attachGlobalListeners() {
  window.addEventListener("resize", handleResize);

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("pointercancel", handlePointerUp);
  window.addEventListener("pointerout", handlePointerUp);

  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      resumeAfterVisibility = settings.running;
      settings.running = false;
      syncPlayState();
    } else if (resumeAfterVisibility) {
      settings.running = true;
      resumeAfterVisibility = false;
      syncPlayState();
    }
  });

  panelToggleButton?.addEventListener("click", () => {
    const isOpen = document.body.dataset.panelOpen === "true";
    document.body.dataset.panelOpen = isOpen ? "false" : "true";
    panelToggleButton.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });

  if (panelToggleButton) {
    panelToggleButton.setAttribute(
      "aria-expanded",
      document.body.dataset.panelOpen === "true" ? "true" : "false"
    );
  }
}

function handleResize() {
  const previousPanelState = document.body.dataset.panelOpen;
  resizeCanvas();
  updateParticleCount();

  if (window.innerWidth > 960 && previousPanelState === "false") {
    document.body.dataset.panelOpen = "true";
    panelToggleButton?.setAttribute("aria-expanded", "true");
  }
}

function resizeCanvas() {
  viewWidth = window.innerWidth;
  viewHeight = window.innerHeight;
  dpr = Math.min(2, window.devicePixelRatio || 1);

  canvas.width = Math.floor(viewWidth * dpr);
  canvas.height = Math.floor(viewHeight * dpr);
  canvas.style.width = `${viewWidth}px`;
  canvas.style.height = `${viewHeight}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function updateParticleCount(initial = false) {
  const density = reducedMotionMedia.matches ? 0.00018 : 0.00028;
  const target = Math.max(220, Math.floor(viewWidth * viewHeight * density));

  if (particles.length > target) {
    particles.length = target;
    return;
  }

  for (let i = particles.length; i < target; i += 1) {
    particles.push(new Particle(initial));
  }
}

function sampleFlow(x, y, time) {
  const scale = settings.fieldScale;
  const t = time * 0.22;
  const s = settings.seed;

  const sinWave = Math.sin((x * scale + s) * 1.3 + Math.sin(y * scale * 1.2 - t));
  const cosWave = Math.cos(
    (y * scale * 0.85 - s) * 1.1 - Math.cos(x * scale * 0.9 + t * 1.5)
  );
  const swirl = Math.sin((x + y) * scale * 0.4 - t * 1.7 + Math.sin(t * 0.8 + s));

  const angle = sinWave + cosWave + swirl;
  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
  };
}

function setPalette(key) {
  if (!paletteLibrary[key]) return;
  settings.paletteKey = key;
  updatePaletteUI();
  applyPaletteAccent(key);
}

function updatePaletteUI() {
  if (!controlPanel) return;

  controlPanel.querySelectorAll(".palette-chip").forEach((button) => {
    const pressed = button.dataset.palette === settings.paletteKey;
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
  });

  if (paletteDescription) {
    paletteDescription.textContent = paletteLibrary[settings.paletteKey].blurb;
  }
}

function updateSpeed(value, { fromControl = false } = {}) {
  const clamped = clamp(value, 0.3, 2.2);
  settings.speed = clamped;
  if (!fromControl && velocityInput) {
    velocityInput.value = clamped.toFixed(2);
  }
  if (velocityReadout) {
    velocityReadout.textContent = `${clamped.toFixed(2)}x`;
  }
}

function updateTrail(value, { fromControl = false } = {}) {
  const clamped = clamp(value, 0.04, 0.25);
  settings.trailAlpha = clamped;
  if (!fromControl && trailInput) {
    trailInput.value = clamped.toFixed(2);
  }
  if (trailReadout) {
    trailReadout.textContent = clamped.toFixed(2);
  }
}

function randomizeField() {
  settings.seed = Math.random() * 1000;
  settings.fieldScale = 0.00038 + Math.random() * 0.00032;
}

function captureFrame() {
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) {
      console.warn("Unable to export frame.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aurora-flow-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, "image/png");
}

function togglePlay() {
  settings.running = !settings.running;
  syncPlayState();
}

function syncPlayState() {
  document.body.dataset.paused = settings.running ? "false" : "true";
  if (togglePlayButton) {
    togglePlayButton.textContent = settings.running ? "Pause" : "Resume";
  }
}

function handlePointerMove(event) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.lastMove = performance.now();
  pointer.strength = Math.min(1.3, pointer.strength + 0.2);
}

function handlePointerDown(event) {
  pointer.down = true;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.lastMove = performance.now();
  pointer.strength = 1.3;
  createBurst(pointer.x, pointer.y, 1.6);
}

function handlePointerUp() {
  pointer.down = false;
}

function updatePointerStrength(timestamp) {
  if (pointer.down) {
    pointer.strength = Math.min(1.25, pointer.strength * 0.94 + 0.08);
    return;
  }

  const elapsed = timestamp - pointer.lastMove;
  if (elapsed > 140) {
    pointer.strength *= 0.9;
    if (pointer.strength < 0.01) {
      pointer.strength = 0;
    }
  } else {
    pointer.strength = Math.min(1.05, pointer.strength * 0.96 + 0.02);
  }
}

function createBurst(x = viewWidth / 2, y = viewHeight / 2, intensity = 1) {
  const maxDistance = 420;
  for (let i = 0; i < particles.length; i += 1) {
    const particle = particles[i];
    const dx = x - particle.x;
    const dy = y - particle.y;
    const dist = Math.hypot(dx, dy) + 0.001;
    const falloff = Math.max(0, 1 - dist / maxDistance);
    if (falloff <= 0) continue;
    const impulse = falloff * falloff * 3.6 * intensity;
    particle.vx -= (dx / dist) * impulse;
    particle.vy -= (dy / dist) * impulse;
  }
}

function handleKeyDown(event) {
  if (event.code === "Space") {
    event.preventDefault();
    togglePlay();
  } else if (event.code === "KeyR") {
    randomizeField();
    createBurst(viewWidth / 2, viewHeight / 2, 1.5);
    pointer.lastMove = performance.now();
    pointer.strength = Math.max(pointer.strength, 0.85);
  } else if (event.code === "KeyS") {
    captureFrame();
  }
}

function handleMotionPreference(event) {
  if (event.matches) {
    updateSpeed(Math.min(settings.speed, 0.75));
    updateTrail(Math.max(settings.trailAlpha, 0.16));
  } else {
    updateSpeed(Math.max(settings.speed, 1.05));
    updateTrail(Math.min(settings.trailAlpha, 0.14));
  }
}

function applyPaletteAccent(key) {
  const palette = paletteLibrary[key];
  if (!palette) return;

  const root = document.documentElement.style;
  const [c0, c1, c2, c3] = palette.colors;

  root.setProperty("--accent", c1 || c0);
  root.setProperty("--accent-strong", c0);
  root.setProperty("--bg-spot-a", hexToRgbaString(c0, 0.38));
  root.setProperty("--bg-spot-b", hexToRgbaString(c2 || c1 || c0, 0.32));
  root.setProperty("--bg-spot-paused-a", hexToRgbaString(c3 || c2 || c0, 0.35));
  root.setProperty("--bg-spot-paused-b", hexToRgbaString(c1 || c0, 0.28));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createPaletteSampler(colors) {
  const stops = colors.map((hex) => hexToRgb(hex));
  const total = stops.length;
  return (t) => {
    const wrapped = ((t % 1) + 1) % 1;
    const scaled = wrapped * total;
    const index = Math.floor(scaled) % total;
    const next = (index + 1) % total;
    const localT = scaled - Math.floor(scaled);
    return {
      r: Math.round(lerp(stops[index].r, stops[next].r, localT)),
      g: Math.round(lerp(stops[index].g, stops[next].g, localT)),
      b: Math.round(lerp(stops[index].b, stops[next].b, localT)),
    };
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const sanitized = hex.replace("#", "").trim();
  const value =
    sanitized.length === 3
      ? sanitized
          .split("")
          .map((char) => char + char)
          .join("")
      : sanitized;

  const intVal = Number.parseInt(value, 16);
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  };
}

function hexToRgbaString(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
