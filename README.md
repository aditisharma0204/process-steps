# Process Steps

A small, self-contained **Cursor-style "thinking log"** animation. Three sentences
play one at a time — each enters with a soft slide-and-scale, shimmers while
"working", then settles with a sparkle → check crossfade and a gentle pop before
exiting and handing the slot to the next line.

```
   ✨ Reading your knowledge base        ← enters, shimmers, ✨ → ✔, exits
   ✨ Drafting agent personality         ← enters, shimmers, ✨ → ✔, exits
   ✨ Connecting your channels           ← enters, shimmers, ✨ → ✔, ends
```

This repo ships **two pieces** you can lift independently:

- **The animation** (`process-steps.{css,js}` + `tokens.css` + the sparkle PNG) —
  ~14KB of vanilla CSS + JS, no deps, no build step. Drop into any prototype
  that has a `<div>` and a stylesheet.
- **The hero block** that the animation transitions out of (`hero.css` + the
  matching markup in `index.html`). The landing's preview-card + title +
  subtitle + Get Started button, plus the uniform 480ms hero exit (lift 10% +
  fade out) that runs before the animation begins. Optional — only useful if
  you want the same "branded landing → process steps" choreography as the
  parent prototype.

The standalone `index.html` wires both together so you can see the full flow:
**hero on a soft branded backdrop → click Get Started → 480ms hero exit →
view swap → process steps animation (8.24s) → bottom-center Replay button**.

## Live demo

Hosted demo: <https://aditisharma0204.github.io/process-steps/>

## Quick start (run the demo locally)

```bash
# from inside this repo
python3 -m http.server 8000
# then open http://localhost:8000 — page loads on the hero, click
# Get Started to play the full flow. Replay button appears bottom-
# center after the animation completes.
```

Any static server works (`npx serve`, `caddy file-server`, etc.). There is no
build step.

## Integration — two paths

### Path A — Lift just the animation

Use this when you want the Cursor-style thinking-log animation inside an
existing screen of your prototype (so the surrounding chrome, hero, navigation,
etc. stays as you've already built it).

1.  **Copy four things** into your prototype:

    ```
    process-steps.css
    process-steps.js
    tokens.css                ← skip if your prototype already defines
                                --color-primary, --font-family-base,
                                --shiny-base, --shiny-shine
    assets/sparkle-sf.png
    ```

2.  **Link them** in your HTML (order matters — tokens first):

    ```html
    <link rel="stylesheet" href="tokens.css" />
    <link rel="stylesheet" href="process-steps.css" />
    <script src="process-steps.js" defer></script>
    ```

3.  **Add a root element** wherever you want the animation to appear. The
    overlay is `position: absolute` and fills its nearest positioned ancestor,
    so wrap it in a `position: relative` (or `fixed`) container if it doesn't
    already have one.

    ```html
    <div class="my-canvas" style="position: relative; width: 100%; height: 100vh;">
      <div id="process-steps-root"></div>
    </div>
    ```

4.  **Mount and play.** `ProcessSteps.mount()` injects the row markup for you,
    so you don't have to paste a snippet of HTML.

    ```html
    <script>
      const root = document.getElementById("process-steps-root");
      const ctrl = ProcessSteps.mount(root, {
        // All optional — defaults match the source prototype.
        // lines: [
        //   "Reading your knowledge base",
        //   "Drafting agent personality",
        //   "Connecting your channels",
        // ],
        // sparkleSrc: "assets/sparkle-sf.png",
      });

      ctrl.onComplete(() => console.log("done"));
      ctrl.play();          // start
      // ctrl.pause();       // pause at current frame
      // ctrl.restart();     // reset to t=0 and play
      // ctrl.scrubTo(2500); // jump to t=2500ms and hold
      // ctrl.destroy();     // tear down and clean up DOM
    </script>
    ```

That's it. The animation works on a blank `<div>` placed anywhere on the page;
no parent state machine or `data-` attributes are required.

### Path B — Lift the hero **and** the animation

Use this when you want the same landing → exit → process-steps choreography
the parent prototype ships: a centered hero block (preview card + title +
subtitle + Get Started button) on a soft purple→blue backdrop, a uniform
480ms hero exit (lift 10% + fade), and a clean view swap into the animation.

1.  **Copy seven things** into your prototype:

    ```
    process-steps.css
    process-steps.js
    hero.css
    tokens.css                ← required for both pieces; carries hero-
                                related vars too (button bg, gradient
                                stops, etc.)
    assets/sparkle-sf.png
    ```

    Plus the hero markup + the ~30-line click-handler glue from
    `index.html` (search for `<!-- VIEW 1 — Landing hero -->` and the
    `(function ()` IIFE at the bottom of the file).

2.  **Link the styles** in your HTML — order matters:

    ```html
    <link rel="stylesheet" href="tokens.css" />
    <link rel="stylesheet" href="hero.css" />
    <link rel="stylesheet" href="process-steps.css" />
    <script src="process-steps.js" defer></script>
    ```

3.  **Match the hero exit timing in JS to the CSS transition.** The hero
    transitions over `480ms`; the click handler waits `500ms` before
    swapping views. If you tweak one, tweak the other:

    ```js
    // hero.css
    .hero { transition: transform 480ms cubic-bezier(0.32, 0.72, 0, 1),
                        opacity   480ms cubic-bezier(0.32, 0.72, 0, 1); }
    .hero.is-leaving { transform: translateY(-10%); opacity: 0; }

    // index.html click handler
    const HERO_EXIT_WAIT = 500;          // 480ms transition + 20ms safety
    hero.classList.add("is-leaving");
    await wait(HERO_EXIT_WAIT);
    showView("animation");
    setTimeout(() => ProcessSteps.mount(root).play(), 0);
    ```

    **Do NOT add per-child stagger to the hero exit.** The whole hero block
    is meant to lift and fade as one beat — the parent prototype explicitly
    reverted a staggered version because it pulled focus off the title
    during the transition.

4.  **Centering the hero.** `.hero` is `position: absolute; inset: 0` with
    flex centering, so it fills its nearest positioned ancestor. In the
    standalone demo, that ancestor is `.hero-stage` (full viewport). In
    your prototype, wrap the hero in a sized container and the hero will
    center inside it.

That's the whole recipe. Total clock time from page load → Step 1 visible
once Get Started is clicked is **~700ms** (480ms hero exit + ~20ms view
swap + Step 1's 340ms entrance, with 340ms of overlap between the swap
and the entrance).

### Controller API

| Method               | What it does                                                                 |
| -------------------- | ---------------------------------------------------------------------------- |
| `play()`             | Start (or resume) playback. No-op if already playing.                        |
| `pause()`            | Pause at the current frame. `play()` resumes from there.                     |
| `restart()`          | Reset to `t = 0` and start playing.                                          |
| `scrubTo(t)`         | Jump to time `t` (ms) and hold. Safe to drive from a scrub bar.              |
| `onComplete(cb)`     | Register a callback fired when `t` reaches `total`.                          |
| `destroy()`          | Cancel rAF, clear inline styles, remove injected markup.                     |
| `total`              | Total timeline length (ms). Currently **8240ms**.                            |
| `marks`              | Array of step start times (ms) for scrub-bar tick marks. `[0, 2820, 5520]`.  |
| `renderAt(t)`        | Lower-level: write the visual state at time `t` without touching playback.   |

### Lower-level access

If you already have your own playback loop, skip `mount()` and use the renderer
directly:

```js
ProcessSteps.applyStateAt(rootElement, t);   // write inline styles at time t
ProcessSteps.reset(rootElement);             // clear inline styles
ProcessSteps.TOTAL;                          // 8240
ProcessSteps.STEP_STARTS;                    // [0, 2820, 5520]
```

You'll still need to provide the row markup yourself. Easiest path: call
`mount()` once, then drive the returned `renderAt(t)`.

## Customization knobs

All tunables live at the top of `process-steps.js` as named constants.
Change them in source — they're not exposed as runtime options.

| Constant                          | Default | What it controls                                                                                          | Sensible range |
| --------------------------------- | ------- | --------------------------------------------------------------------------------------------------------- | -------------- |
| `PROCESS_STEPS_LINE_COUNT`        | `3`     | How many rows the animation expects. If you change this, also pass `lines` of the same length to `mount`. | `1–6`          |
| `PROCESS_STEPS_ENTER`             | `220`   | Default per-row enter duration (ms).                                                                      | `160–400`      |
| `PROCESS_STEPS_WORKING`           | `1800`  | How long each row shimmers before settling (ms). The "actually read this" beat.                           | `1200–3000`    |
| `PROCESS_STEPS_SETTLE`            | `280`   | Sparkle→check crossfade + scale-pop duration (ms).                                                        | `200–400`      |
| `PROCESS_STEPS_EXIT`              | `220`   | Per-row exit duration (ms).                                                                               | `160–360`      |
| `PROCESS_STEPS_STEP1_ENTER`       | `340`   | Step 1's entrance is intentionally longer than steps 2–3 (more deliberate hand-off from a hero exit).     | `220–500`      |
| `PROCESS_STEPS_STEP1_ENTER_TY`    | `80`    | Step 1's enter translateY (px). ~10% of typical viewport height; makes the post-hero text entrance feel deliberate. | `40–120`       |
| `PROCESS_STEPS_ENTER_TY`          | `14`    | Default enter translateY (px) for steps 2+.                                                               | `8–24`         |
| `PROCESS_STEPS_EXIT_TY`           | `14`    | Exit translateY (px).                                                                                     | `8–24`         |
| `PROCESS_STEPS_ENTER_SCALE_FROM`  | `0.985` | Starting scale of the row at the moment of enter.                                                         | `0.95–1.00`    |
| `PROCESS_STEPS_EXIT_SCALE_TO`     | `1.005` | Ending scale of the row at exit (slight "lift-off").                                                      | `1.00–1.02`    |
| `PROCESS_STEPS_GAP`               | `180`   | Dead-air gap between one row's exit ending and the next's enter starting (ms).                            | `80–400`       |
| `PROCESS_STEPS_TAIL`              | `200`   | Trailing buffer after the last row's exit, before `total` is reached (ms).                                | `0–600`        |

The shimmer sweep speed lives in `process-steps.css` as the `2.8s` duration on
the `shiny-sweep` animation. Faster reads more frantic; slower reads more
contemplative.

## Brand tokens

`tokens.css` defines two groups of CSS custom properties. Override them at
`:root` (or on an ancestor) to rebrand without touching this repo's code.

**Animation tokens** (used by `process-steps.css`):

| Token                | Default                          | What it controls                                                                       |
| -------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| `--color-primary`    | `#066AFE`                        | The settled "check" glyph color. Aliased as `--slds-blue-50` for legacy compatibility. |
| `--font-family-base` | Salesforce Sans + system stack   | Row text typeface.                                                                     |
| `--shiny-base`       | `rgba(0, 30, 91, 0.55)`          | Muted text color when the row is at rest (and the gradient stops).                     |
| `--shiny-shine`      | `rgba(255, 255, 255, 0.95)`      | The bright highlight that sweeps across the text during the working phase.             |

**Hero tokens** (used by `hero.css` — only relevant for Path B):

| Token                       | Default     | What it controls                                                       |
| --------------------------- | ----------- | ---------------------------------------------------------------------- |
| `--color-primary-hover`     | `#0250D9`   | Get Started button hover background.                                   |
| `--color-on-surface`        | `#001E5B`   | Hero title + subtitle text color.                                      |
| `--color-surface-card`      | `#FFFFFF`   | Preview card background.                                               |
| `--color-border`            | `#E5E5E5`   | Preview chrome line color.                                             |
| `--color-border-subtle`     | `#F3F3F3`   | Preview card / inner-card hairlines.                                   |
| `--color-blue-90`           | `#D6E6FF`   | Faux content lines + metric chips inside the preview card.             |
| `--radius-full`             | `999px`     | Get Started button (pill) radius.                                      |
| `--hero-bg-start/mid/end`   | soft tints  | The 3-stop landing gradient (purple→blue).                              |
| `--hero-glow-cyan/violet/blue` | brand stops | The 3 radial glows behind the hero. Tweak `.glow { opacity: ... }` in `hero.css` to dial intensity. |

The sparkle PNG carries its own brand gradient (blue → purple → pink) and is
**not** color-controlled by CSS. If you need a different sparkle color, swap
the PNG.

## Customizing the copy

Pass `lines` to `mount()`:

```js
ProcessSteps.mount(root, {
  lines: [
    "Indexing your accounts",
    "Wiring up integrations",
    "Tuning agent personality",
  ],
});
```

**Line length matters.** The stage is `660px` wide and uses `white-space: nowrap`
to keep each line on a single row. At the 30px display size, lines longer than
~32–34 characters in Salesforce Sans will overflow. If you need longer copy,
either:

- shrink the font-size in `process-steps.css` (`.exp-process-row { font-size: ... }`), or
- widen the stage in `process-steps.css` (`.exp-process-stage { width: ... }`), or
- drop `white-space: nowrap` if a wrapped second line is acceptable (note: this
  will throw off the 42px-tall slot; you'll want to bump the stage `height` too).

The `aria-live="polite"` on the stage means screen readers will announce each
line as it enters — fine for English; if you localize, double-check that screen
reader pacing still feels right.

## Browser support

Tested in current Chrome, Safari, Firefox, and Edge. The shimmer uses CSS
`background-clip: text` + `-webkit-text-fill-color: transparent` — supported in
all modern browsers but **not IE11** (the text will simply not shimmer and will
fall back to a solid muted color; the rest of the animation works fine).

If you care about `prefers-reduced-motion`, you'll want to wrap the call to
`controller.play()` and either skip to the final frame or shorten the timeline.
The renderer is happy to be called with any `t`; e.g. `controller.scrubTo(ProcessSteps.TOTAL)`
to jump straight to the end-state.

## Scrub safety

Every visible property (per-row opacity, transform, glyph opacity, glyph scale,
shimmer on/off) is a **pure function of timeline `t`**. There is no retained
state between frames. That means:

- A scrub bar can drive `controller.scrubTo(t)` or `controller.renderAt(t)`
  directly — forward, backward, jump-cut, doesn't matter.
- Pausing and resuming is exact.
- Calling `restart()` mid-animation is safe; no leftover inline styles.

## File map

```
process-steps/
├── README.md             ← you are here
├── index.html            ← standalone demo: hero → exit → animation → replay
├── hero.css              ← landing hero block + exit animation (Path B only)
├── process-steps.css     ← animation styles (self-contained)
├── process-steps.js      ← animation engine + tiny playback driver
├── tokens.css            ← CSS custom properties for the animation AND hero
├── assets/
│   └── sparkle-sf.png    ← the Salesforce brand sparkle glyph
└── .gitignore
```

`hero.css` is **only needed for Path B**. If you're integrating just the
animation (Path A), you can ignore it entirely.

## Credits / origin

Extracted from the **05 — Process Steps** exploration in the
[`cko-demo-motion`](https://github.com/aditisharma0204/cko-demo-motion)
prototype. All easing curves, timings, and the shimmer recipe carry over
unchanged from the source so the visual feel is identical.
