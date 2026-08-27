# SOR7ED save button — v9 handoff

Supersedes v8. Same idea: the mark **is** the button, and the tangle resolves
into a tick on save. What changed in v9:

- All motion on the SOR7ED house easing `cubic-bezier(0.16, 1, 0.3, 1)`.
  The v8 `cubic-bezier(.2,.9,.3,1.2)` overshoot is gone (no bounces).
- One JS progress value (`--t`) drives both layers instead of two independent
  CSS transitions, so the tangle's exit and the tick's stroke draw-in are
  locked to the same beat. The tick starts at 28% of the transition.
- Tick is forest green `#2f6b50` (SOR7ED accent), ink is warm `#221e18`.
- Labels tint from muted to green across the transition rather than snapping.
- Labels are JetBrains Mono, 11px, 0.14em, uppercase.

## Files

| File | What it is |
|---|---|
| `sorted-button.html` | The whole component — style block, markup, script. Paste as-is. |
| `tangle.png` | The hand-drawn mark, 1024×1024, alpha-black on transparent. |

Keep `tangle.png` next to the markup or update the `src` on `.sb__tangle`.

## Integrating

1. Paste the `<style>` block into your stylesheet (or keep it scoped as-is).
2. Paste the markup where the save affordance goes.
3. Paste the `<script>` once per page — it wires every `.sb` on the page.
4. Fire your actual save call at the marked line in the click handler.

Remap these six variables on `.sb` to your host tokens:

    --sb-ink       #221e18   the tangle
    --sb-accent    #2f6b50   the tick + confirmed labels
    --sb-muted     #897f6e   rest labels
    --sb-line      #e1d8c6   the hairline rules
    --sb-ease      cubic-bezier(0.16, 1, 0.3, 1)
    --sb-mark      84px      mark size (hit target = mark + 20px)

## Behaviour

`rest → done → rest`. Click toggles. `done` auto-reverts after 2400ms; a second
click before that reverts immediately. Timings live at the top of the script
(`IN 620`, `OUT 420`, `HOLD 2400`, `TICK_AT 0.28`).

`prefers-reduced-motion: reduce` jumps straight to the end state — no animation,
same outcome.

## Notes

- The tangle is raster on purpose. A vector trace was tried and rejected — the
  hand-drawn character does not survive it.
- The tick path is `M -13 1 L -3 11 L 15 -11` in a `-24 -24 48 48` viewBox, with
  `stroke-dasharray: 46`. If you change the coords, recompute the length with
  `path.getTotalLength()` and update the dasharray and the offset `calc()`.
- Accessibility: the button carries `aria-label="Save — SOR7ED"`. Consider
  announcing "saved to your chat" via a polite live region on confirm, since the
  visual change is quiet.
- Porting to React: the only stateful bits are `t` and `done`. Keep `--t`/`--td`
  as inline CSS variables on the wrapper and animate them with `requestAnimationFrame`
  in an effect; the CSS block is unchanged.
