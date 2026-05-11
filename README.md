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

No dependencies. No build step. ~14KB of CSS + JS + one PNG. Drop into any
prototype that has a `<div>` and a stylesheet.

## Live demo

Hosted demo: **https://aditisharma0204.github.io/process-steps/**

## Quick start (run the demo locally)

```bash
# from inside this repo
python3 -m http.server 8000
# then open http://localhost:8000 — the animation auto-plays on load.
```

Any static server works (`npx serve`, `caddy file-server`, etc.). There is no
build step.

## Integration into another prototype

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
| `PROCESS_STEPS_STEP1_ENTER_TY`    | `40`    | Step 1's enter translateY (px). Visibly slides up.                                                        | `20–60`        |
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

`tokens.css` defines four CSS custom properties. Override them at `:root` (or
on an ancestor of the animation) to rebrand without touching this repo's code.

| Token                | Default                          | What it controls                                                                       |
| -------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| `--color-primary`    | `#066AFE`                        | The settled "check" glyph color. Aliased as `--slds-blue-50` for legacy compatibility. |
| `--font-family-base` | Salesforce Sans + system stack   | Row text typeface.                                                                     |
| `--shiny-base`       | `rgba(0, 30, 91, 0.55)`          | Muted text color when the row is at rest (and the gradient stops).                     |
| `--shiny-shine`      | `rgba(255, 255, 255, 0.95)`      | The bright highlight that sweeps across the text during the working phase.             |

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
├── index.html            ← minimal standalone demo
├── process-steps.css     ← animation styles (self-contained)
├── process-steps.js      ← animation engine + tiny playback driver
├── tokens.css            ← four CSS custom properties the animation uses
├── assets/
│   └── sparkle-sf.png    ← the Salesforce brand sparkle glyph
└── .gitignore
```

## Credits / origin

Extracted from the **05 — Process Steps** exploration in the
[`cko-demo-motion`](https://github.com/aditisharma0204/cko-demo-motion)
prototype. All easing curves, timings, and the shimmer recipe carry over
unchanged from the source so the visual feel is identical.
