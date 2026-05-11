/* ============================================================ */
/* Process Steps — Animation Engine                              */
/* ------------------------------------------------------------ */
/* Three text rows played in sequence (Cursor-style "thinking    */
/* log"). Each step cycles enter → working (shimmer) → settle    */
/* (sparkle→check pop) → exit, with a small dead-air gap between */
/* steps so each sentence fully clears before the next arrives.  */
/*                                                               */
/* Everything visible is a pure function of `t` (ms). Scrubbing  */
/* forward and backward across step boundaries is exact, because */
/* every row's state is computed solely from                     */
/* dt = t − stepStart with no retained state between frames.     */
/*                                                               */
/* Public API (attached to window.ProcessSteps):                 */
/*   mount(root, options?)  → controller                         */
/*                                                               */
/* The controller exposes play(), pause(), restart(), scrubTo(), */
/* onComplete(cb), destroy(). See README.md for details.         */
/* ============================================================ */
(function () {
  "use strict";

  /* ---------------------------------------------------------- */
  /* Tunables — durations are in milliseconds.                  */
  /* ---------------------------------------------------------- */
  const PROCESS_STEPS_LINE_COUNT = 3;

  // Per-phase durations. Tuned for a deliberate, readable cadence
  // at the 30px type size — the working phase needs enough time to
  // actually read the line.
  const PROCESS_STEPS_ENTER = 220;
  const PROCESS_STEPS_WORKING = 1800;
  const PROCESS_STEPS_SETTLE = 280;
  const PROCESS_STEPS_EXIT = 220;

  // Step 1 (data-step="0") gets a more substantial entrance —
  // matches the deliberate pace of whatever leads into the animation.
  // Step 2 and 3 keep the snappy 220ms enter so they don't feel like
  // full hero entrances every time.
  const PROCESS_STEPS_STEP1_ENTER    = 340;
  const PROCESS_STEPS_STEP1_ENTER_TY = 40;

  // Cross-step gap. After one step's `exit` ends, wait this many ms
  // of dead air before the next step's `enter` begins. Gives the eye
  // a clear "the previous sentence is done" beat and avoids the two
  // rows visually colliding (they share the same absolute slot).
  const PROCESS_STEPS_GAP = 180;

  // Tail buffer after the last step's exit ends, before the timeline
  // is considered complete. Keeps the handoff from feeling cut off.
  const PROCESS_STEPS_TAIL = 200;

  // Translate distances (px) for the default row's enter/exit slide.
  // Step 1 overrides the enter Ty via the helper below.
  const PROCESS_STEPS_ENTER_TY = 14;
  const PROCESS_STEPS_EXIT_TY = 14;

  // Subtle scale companions to the slide. Barely perceptible in
  // isolation; you only feel them in aggregate.
  const PROCESS_STEPS_ENTER_SCALE_FROM = 0.985;
  const PROCESS_STEPS_EXIT_SCALE_TO   = 1.005;

  // Default copy. Override via options.lines when mounting.
  const PROCESS_STEPS_DEFAULT_LINES = [
    "Reading your knowledge base",
    "Drafting agent personality",
    "Connecting your channels",
  ];

  // Per-step enter helpers — keep the rest of the module flat.
  function processStepsEnterDur(i) {
    return i === 0 ? PROCESS_STEPS_STEP1_ENTER : PROCESS_STEPS_ENTER;
  }
  function processStepsEnterTy(i) {
    return i === 0 ? PROCESS_STEPS_STEP1_ENTER_TY : PROCESS_STEPS_ENTER_TY;
  }
  function processStepsStepDur(i) {
    return (
      processStepsEnterDur(i) +
      PROCESS_STEPS_WORKING +
      PROCESS_STEPS_SETTLE +
      PROCESS_STEPS_EXIT
    );
  }

  // Start time (ms, relative to t=0) of each row. Step 2 begins at
  // Step 1's FULL duration + GAP (so Step 1's longer enter doesn't
  // crowd Step 2). Step 3 follows Step 2 at the standard cadence.
  //   step 0: 0
  //   step 1: (340 + 1800 + 280 + 220) + 180 = 2820
  //   step 2: 2820 + (220 + 1800 + 280 + 220) + 180 = 5520
  const PROCESS_STEPS_STARTS = (() => {
    const out = [0];
    for (let i = 1; i < PROCESS_STEPS_LINE_COUNT; i++) {
      out.push(out[i - 1] + processStepsStepDur(i - 1) + PROCESS_STEPS_GAP);
    }
    return out;
  })();

  // Total timeline duration: last step's start + its full duration + tail.
  // 5520 + 2520 + 200 = 8240ms.
  const PROCESS_STEPS_TOTAL =
    PROCESS_STEPS_STARTS[PROCESS_STEPS_LINE_COUNT - 1] +
    processStepsStepDur(PROCESS_STEPS_LINE_COUNT - 1) +
    PROCESS_STEPS_TAIL;

  // Tick marks for a scrub bar — one per row's enter beat.
  const PROCESS_STEPS_STEP_STARTS = [...PROCESS_STEPS_STARTS];

  /* ---------------------------------------------------------- */
  /* Easing — Cubic-bezier evaluator (Newton-Raphson, same      */
  /* approach as CSS). Returns a function that maps x ∈ [0,1]   */
  /* → y for the curve through (0,0), (p1x,p1y), (p2x,p2y),     */
  /* (1,1). Module-level singletons so we don't reallocate on   */
  /* every frame.                                               */
  /* ---------------------------------------------------------- */
  function _psCubicBezier(p1x, p1y, p2x, p2y) {
    const cx = 3 * p1x;
    const bx = 3 * (p2x - p1x) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * p1y;
    const by = 3 * (p2y - p1y) - cy;
    const ay = 1 - cy - by;
    const sampleX  = (t) => ((ax * t + bx) * t + cx) * t;
    const sampleY  = (t) => ((ay * t + by) * t + cy) * t;
    const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const cur = sampleX(t) - x;
        if (Math.abs(cur) < 1e-5) break;
        const dx = sampleDX(t);
        if (Math.abs(dx) < 1e-6) break;
        t -= cur / dx;
      }
      return sampleY(t);
    };
  }

  const _psEaseEnter      = _psCubicBezier(0.32, 0.72, 0,    1);    // iOS-like spring settle
  const _psEaseExit       = _psCubicBezier(0.6,  0,    0.78, 0);    // smooth pull-out
  const _psEasePopUp      = _psCubicBezier(0.34, 1.56, 0.64, 1);    // overshoot
  const _psEasePopBack    = _psCubicBezier(0.4,  0,    0.6,  1);    // smooth come-back
  const _psEaseInOutCubic = _psCubicBezier(0.4,  0,    0.6,  1);    // shared smooth fade

  function _psClamp01(p) {
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  /* ---------------------------------------------------------- */
  /* Renderer — pure function of `t` and the overlay element.   */
  /* Writes inline styles per frame.                            */
  /* ---------------------------------------------------------- */
  function applyProcessStepsStateAt(overlay, t) {
    if (!overlay) return;
    const rows = overlay.querySelectorAll(".exp-process-row");
    if (!rows.length) return;

    rows.forEach((row, i) => {
      const dt = t - PROCESS_STEPS_STARTS[i];

      // Per-step enter overrides. Step 1 (i === 0) slides up further
      // and takes longer; Steps 2–3 keep the original snappy enter.
      const enterDur = processStepsEnterDur(i);
      const enterTy  = processStepsEnterTy(i);

      // Defaults: row hidden, primed below its resting position with a
      // hair of scale-down so the enter animation slides up + grows in.
      let opacity = 0;
      let ty = enterTy;
      let scale = PROCESS_STEPS_ENTER_SCALE_FROM;
      let phase = "idle";
      let shimmer = false;
      let sparkleOpacity = 1;
      let sparkleScale = 1;
      let checkOpacity = 0;
      let checkScale = 1;

      if (dt < 0) {
        // Step hasn't started yet — keep defaults.
      } else if (dt < enterDur) {
        // Enter: opacity 0 → 1, ty +enterTy → 0, scale 0.985 → 1.0.
        const p = _psEaseEnter(dt / enterDur);
        opacity = p;
        ty = enterTy * (1 - p);
        scale = PROCESS_STEPS_ENTER_SCALE_FROM
          + (1 - PROCESS_STEPS_ENTER_SCALE_FROM) * p;
        phase = "enter";
      } else {
        const dt2 = dt - enterDur;
        if (dt2 < PROCESS_STEPS_WORKING) {
          // Working: full opacity, shimmer on, sparkle pulsing gently.
          // Softer ±3% scale at ~0.6 of a full cycle across the phase
          // (1.2 × π) so the pulse doesn't quite complete — reads
          // "ongoing thought", not "looping animation".
          opacity = 1;
          ty = 0;
          scale = 1;
          phase = "working";
          shimmer = true;
          const wp = dt2 / PROCESS_STEPS_WORKING;
          sparkleScale = 1 + 0.03 * Math.sin(wp * Math.PI * 1.2);
          sparkleOpacity = 1;
        } else if (dt2 < PROCESS_STEPS_WORKING + PROCESS_STEPS_SETTLE) {
          // Settle: sparkle fades out (0–70% of settle), check fades
          // in (30–100% of settle); they overlap in the 30–70% middle
          // but neither is at 0% nor 100% opacity simultaneously.
          // Check scale-pop 1.0 → 1.08 → 1.0 with overshoot up and
          // smooth come-back.
          opacity = 1;
          ty = 0;
          scale = 1;
          phase = "settle";
          const sp = (dt2 - PROCESS_STEPS_WORKING) / PROCESS_STEPS_SETTLE;

          // Sparkle fade-out: 0 → 0.70 of settle.
          if (sp < 0.70) {
            const k = sp / 0.70;
            sparkleOpacity = 1 - _psEaseInOutCubic(k);
            sparkleScale   = 1 - 0.30 * k;
          } else {
            sparkleOpacity = 0;
            sparkleScale   = 0.7;
          }

          // Check fade-in: 0.30 → 1.0 of settle.
          if (sp < 0.30) {
            checkOpacity = 0;
          } else {
            const k = (sp - 0.30) / 0.70;
            checkOpacity = _psEaseInOutCubic(k);
          }

          // Check scale-pop on the full settle window: 1.0 → 1.08 → 1.0.
          if (sp < 0.5) {
            const k = sp / 0.5;
            checkScale = 1.0 + 0.08 * _psEasePopUp(k);
          } else {
            const k = (sp - 0.5) / 0.5;
            checkScale = 1.08 - 0.08 * _psEasePopBack(k);
          }
        } else if (
          dt2 <
          PROCESS_STEPS_WORKING + PROCESS_STEPS_SETTLE + PROCESS_STEPS_EXIT
        ) {
          // Exit: opacity 1 → 0, ty 0 → −14, scale 1.0 → 1.005 (slight
          // lift-off feel). Check fades with the row.
          const ep =
            (dt2 - PROCESS_STEPS_WORKING - PROCESS_STEPS_SETTLE) /
            PROCESS_STEPS_EXIT;
          const eo = _psEaseExit(ep);
          opacity = 1 - eo;
          ty = -PROCESS_STEPS_EXIT_TY * eo;
          scale = 1 + (PROCESS_STEPS_EXIT_SCALE_TO - 1) * eo;
          phase = "exit";
          sparkleOpacity = 0;
          sparkleScale = 0.7;
          checkOpacity = 1 - eo;
          checkScale = 1;
        } else {
          // Past the row's full lifecycle.
          opacity = 0;
          ty = -PROCESS_STEPS_EXIT_TY;
          scale = PROCESS_STEPS_EXIT_SCALE_TO;
          phase = "done";
          sparkleOpacity = 0;
          checkOpacity = 0;
          checkScale = 1;
        }
      }

      row.style.opacity = String(opacity);
      row.style.transform = `translateY(${ty}px) scale(${scale})`;
      row.dataset.phase = phase;
      row.classList.toggle("is-shimmer", shimmer);

      const sparkle = row.querySelector(".exp-process-sparkle");
      if (sparkle) {
        sparkle.style.opacity = String(_psClamp01(sparkleOpacity));
        sparkle.style.transform = `scale(${sparkleScale})`;
      }
      const check = row.querySelector(".exp-process-check");
      if (check) {
        check.style.opacity = String(_psClamp01(checkOpacity));
        check.style.transform = `scale(${checkScale})`;
      }
    });
  }

  function resetProcessStepsLines(overlay) {
    if (!overlay) return;
    overlay.querySelectorAll(".exp-process-row").forEach((el) => {
      el.classList.remove("is-shimmer");
      el.style.opacity = "";
      el.style.transform = "";
      el.dataset.phase = "idle";
      el.querySelectorAll(
        ".exp-process-sparkle, .exp-process-check"
      ).forEach((g) => {
        g.style.opacity = "";
        g.style.transform = "";
      });
    });
  }

  /* ---------------------------------------------------------- */
  /* Markup — injected by mount() so callers only need one      */
  /* root <div>. Sparkle path is configurable via options.      */
  /* ---------------------------------------------------------- */
  function buildMarkup(lines, sparkleSrc) {
    const rows = lines
      .map(
        (text, i) => `
        <li class="exp-process-row" data-step="${i}" data-phase="idle">
          <span class="exp-process-glyph" aria-hidden="true">
            <img class="exp-process-sparkle" src="${sparkleSrc}" alt="" />
            <svg class="exp-process-check" viewBox="0 0 14 14"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="m3 7.5 2.6 2.6L11 4.4"/></svg>
          </span>
          <span class="exp-process-text">${text}</span>
        </li>`
      )
      .join("");
    return `
      <ol class="exp-process-stage" aria-live="polite">
        ${rows}
      </ol>`;
  }

  /* ---------------------------------------------------------- */
  /* Tiny playback driver — drives renderAt(t) via rAF.         */
  /* Supports play / pause / restart / scrubTo.                 */
  /* ---------------------------------------------------------- */
  function createPlayback(spec) {
    let rafId = 0;
    let startTs = 0;        // performance.now() of the current play segment start
    let offset = 0;         // accumulated t (ms) carried across pause/resume
    let running = false;
    let completed = false;
    let onCompleteCb = typeof spec.onComplete === "function" ? spec.onComplete : null;

    function fireComplete() {
      if (completed) return;
      completed = true;
      if (onCompleteCb) {
        try { onCompleteCb(); } catch (e) { /* swallow */ }
      }
    }

    function tick(ts) {
      if (!running) return;
      const t = offset + (ts - startTs);
      if (t >= spec.total) {
        spec.renderAt(spec.total);
        running = false;
        rafId = 0;
        offset = spec.total;
        fireComplete();
        return;
      }
      spec.renderAt(t);
      rafId = requestAnimationFrame(tick);
    }

    return {
      play() {
        if (running) return;
        if (completed) {
          completed = false;
          offset = 0;
        }
        running = true;
        startTs = performance.now();
        rafId = requestAnimationFrame(tick);
      },
      pause() {
        if (!running) return;
        cancelAnimationFrame(rafId);
        rafId = 0;
        offset = offset + (performance.now() - startTs);
        if (offset > spec.total) offset = spec.total;
        running = false;
      },
      restart() {
        cancelAnimationFrame(rafId);
        rafId = 0;
        offset = 0;
        completed = false;
        running = true;
        startTs = performance.now();
        spec.renderAt(0);
        rafId = requestAnimationFrame(tick);
      },
      scrubTo(t) {
        cancelAnimationFrame(rafId);
        rafId = 0;
        running = false;
        offset = Math.max(0, Math.min(spec.total, t));
        spec.renderAt(offset);
        completed = offset >= spec.total;
      },
      setOnComplete(cb) {
        onCompleteCb = typeof cb === "function" ? cb : null;
      },
      destroy() {
        cancelAnimationFrame(rafId);
        rafId = 0;
        running = false;
        onCompleteCb = null;
      },
      get total() { return spec.total; },
      get marks() { return spec.marks.slice(); },
    };
  }

  /* ---------------------------------------------------------- */
  /* Public API                                                  */
  /* ---------------------------------------------------------- */
  function mount(root, options) {
    if (!root || !(root instanceof Element)) {
      throw new Error("ProcessSteps.mount: first argument must be a DOM Element");
    }
    const opts = options || {};
    const lines = Array.isArray(opts.lines) && opts.lines.length
      ? opts.lines
      : PROCESS_STEPS_DEFAULT_LINES;
    // Default sparkle path is relative to the page. Most teams will
    // serve the asset from /assets/sparkle-sf.png; override via options.
    const sparkleSrc = opts.sparkleSrc || "assets/sparkle-sf.png";

    root.classList.add("exp-process-steps-overlay");
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = buildMarkup(lines, sparkleSrc);

    const renderAt = (t) => applyProcessStepsStateAt(root, t);

    // Prime to frame 0 so the rows start in their pre-enter pose.
    resetProcessStepsLines(root);
    renderAt(0);

    const playback = createPlayback({
      total: PROCESS_STEPS_TOTAL,
      marks: [...PROCESS_STEPS_STEP_STARTS],
      renderAt,
    });

    return {
      play:    () => playback.play(),
      pause:   () => playback.pause(),
      restart: () => {
        resetProcessStepsLines(root);
        playback.restart();
      },
      scrubTo: (t) => playback.scrubTo(t),
      onComplete: (cb) => playback.setOnComplete(cb),
      destroy: () => {
        playback.destroy();
        resetProcessStepsLines(root);
        root.innerHTML = "";
        root.classList.remove("exp-process-steps-overlay");
      },
      // Exposed for power users / scrub bars.
      total: PROCESS_STEPS_TOTAL,
      marks: [...PROCESS_STEPS_STEP_STARTS],
      renderAt,
    };
  }

  window.ProcessSteps = {
    mount,
    // Lower-level building blocks, in case a host already has its own
    // playback loop and just wants the renderer.
    applyStateAt: applyProcessStepsStateAt,
    reset: resetProcessStepsLines,
    TOTAL: PROCESS_STEPS_TOTAL,
    STEP_STARTS: [...PROCESS_STEPS_STEP_STARTS],
  };
})();
