"use client";

import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "../_brand/BrandLogo";

export default function HomeNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const visible = scrolled || keyboardOpen;

  useEffect(() => {
    const update = () => {
      const pastTop = window.scrollY > 80;
      setScrolled(pastTop);
      if (!pastTop) { setMenuOpen(false); setKeyboardOpen(false); }
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    if (keyboardOpen) headerRef.current?.focus();
  }, [keyboardOpen]);

  return <>
    <button className="s7-nav-reveal" type="button" onClick={() => setKeyboardOpen(true)}>Show navigation</button>
    <header ref={headerRef} tabIndex={-1} aria-hidden={!visible}
      className={`s7-nav${visible ? ' s7-nav--visible' : ''}${menuOpen ? ' s7-nav--open' : ''}`}
      onKeyDown={event => {
        if (event.key === 'Escape' && menuOpen) {
          setMenuOpen(false);
          toggleRef.current?.focus();
        }
      }}>
      <div className="s7-wrap s7-nav-inner">
        <a className="s7-brand" href="#top" aria-label="SOR7ED home" onClick={() => setMenuOpen(false)}><BrandLogo /></a>
        <button ref={toggleRef} className="s7-nav-toggle" type="button" aria-expanded={menuOpen}
          aria-controls="home-navigation" onClick={() => setMenuOpen(open => !open)}>
          {menuOpen ? 'Close' : 'Menu'} <span aria-hidden="true">{menuOpen ? '−' : '+'}</span>
        </button>
        <nav id="home-navigation" aria-label="Main" className="s7-navlinks" onClick={event => {
          if ((event.target as HTMLElement).closest('a')) setMenuOpen(false);
        }}>
          <a className="s7-navlink" href="#how-it-works">How it works</a>
          <a className="s7-navlink" href="#for-websites">For websites</a>
          <a className="s7-navlink" href="#demo">Try the demo</a>
          <a className="s7-navlink s7-navlink--signin" href="/signin">Sign in</a>
          <a className="s7-navlink s7-navlink--muted" href="https://www.planetsorted.com" rel="noopener">PLANET SOR7ED <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 12 12 4M4 4h8v8" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg></a>
        </nav>
      </div>
    </header>
  </>;
}
