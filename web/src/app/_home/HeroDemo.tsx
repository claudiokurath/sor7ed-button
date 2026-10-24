"use client";

import { useEffect, useRef, useState } from "react";

  const IN = 620, OUT = 420, TICK_AT = 0.28;
  const ease = (p: number) => 1 - Math.pow(1 - p, 3.2); // ≈ cubic-bezier(.16,1,.3,1)

  export default function HeroDemo() {
    const rootRef = useRef<HTMLElement>(null);
    const tRef = useRef(0);
    const rafRef = useRef(0);
    const [previewing, setPreviewing] = useState(false);
    const [status, setStatus] = useState('');

    const paint = (v: number) => {
      tRef.current = v;
      const td = Math.min(1, Math.max(0, (v - TICK_AT) / (1 - TICK_AT)));
      const el = rootRef.current;
      if (!el) return;
      el.style.setProperty('--t', v.toFixed(3));
      el.style.setProperty('--td', td.toFixed(3));
    };

    const run = (to: number) => {
      cancelAnimationFrame(rafRef.current);
      // Re-read the preference on every run, so changing it mid-session is honoured.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { paint(to); return; }
      const from = tRef.current;
      const duration = to > from ? IN : OUT;
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, Math.max(0, (now - start) / duration));
        paint(from + (to - from) * ease(p));
        if (p < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    };

    useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

    function onPress() {
      const next = !previewing;
      setPreviewing(next);
      setStatus(next
        ? 'Card preview shown. This is a demo and no message was sent.'
        : 'Demo reset. Nothing was sent.');
      run(next ? 1 : 0);
    }

    return (
      <section className="hd" ref={rootRef} aria-labelledby="hd-heading">
        <h2 id="hd-heading" className="hd-sr">Interactive demonstration</h2>
        <p className="hd-notice">Interactive demo — no message is sent.</p>

        <div className="hd-page">
          <p className="hd-eyebrow">A useful page</p>
          <h3 className="hd-title">A beginner's guide to composting at home</h3>
          <p className="hd-url">example.com/composting-guide</p>

          <div className="hd-row">
            <span className="hd-label hd-label--lead">
              {previewing ? 'Preview ready' : 'Press Sorted'}
            </span>

            <button
              type="button"
              className="hd-btn"
              onClick={onPress}
              aria-label={previewing ? 'Preview ready: reset the demo' : 'Press Sorted: preview this page as a WhatsApp card'}
              aria-pressed={previewing}
              aria-controls="hd-preview"
            >
              <span className="hd-mark">
                <img className="hd-tangle" src="/static/tangle-white.png" alt="" draggable="false" />
                <svg className="hd-tick" viewBox="-24 -24 48 48" aria-hidden="true" focusable="false">
                  <path d="M -13 1 L -3 11 L 15 -11" pathLength="100" />
                </svg>
              </span>
            </button>

            <span className="hd-label">{previewing ? 'tap to reset' : 'tap the mark'}</span>
          </div>
        </div>

        <div className="hd-slot" id="hd-preview">
            <p className={`hd-empty${previewing ? ' hd-empty--hidden' : ''}`}>Your card preview appears here.</p>
            <div className={`hd-card${previewing ? ' hd-card--visible' : ''}`}>
              <p className="hd-caption">Illustration of a WhatsApp card</p>
              <div className="hd-bubble">
                <div className="hd-thumb" aria-hidden="true">
                  <img src="/static/demo-garden.svg" alt="" width="46" height="46" />
                </div>
                <div className="hd-cardtext">
                  <p className="hd-cardtitle">A beginner's guide to composting at home</p>
                  <p className="hd-cardlink">example.com/composting-guide</p>
                </div>
              </div>
            </div>
        </div>

        <p role="status" aria-live="polite" className="hd-sr">{status}</p>
      </section>
    );
  }

