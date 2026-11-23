"use client";

import { useRef } from "react";
import { BrandLogo } from "../_brand/BrandLogo";

/** Shared centred wordmark and icon-only burger layout with Planet SOR7ED. */
export default function HomeNav() {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => menuRef.current?.removeAttribute("open");
  return (
    <header className="s7-nav">
      <a className="s7-brand" href="#top" aria-label="SOR7ED home" onClick={closeMenu}><BrandLogo /></a>
      <details ref={menuRef} className="s7-menu" onKeyDown={event => {
        if (event.key === "Escape") {
          closeMenu();
          menuRef.current?.querySelector("summary")?.focus();
        }
      }}>
        <summary aria-label="Navigation menu"><svg width="22" height="18" viewBox="0 0 22 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M1 2h20M1 9h20M1 16h20" /></svg></summary>
        <nav aria-label="Primary navigation" className="s7-menu-links" onClick={event => {
          if ((event.target as HTMLElement).closest("a")) closeMenu();
        }}>
          <a href="/#choose">SOR7ED hub</a>
          <a href="/links">SOR7ED Links</a>
          <a href="/about">About SOR7ED</a>
          <a href="/about#vision">Our vision</a>
          <a href="#how-it-works">How it works</a>
          <a href="#for-websites">For websites</a>
          <a href="#demo">Try the demo</a>
          <a href="/account">Your SOR7ED account</a>
          <a href="/signin">Member sign-in</a>
          <a href="https://www.planetsorted.com" rel="noopener">PLANET SOR7ED ↗</a>
        </nav>
      </details>
    </header>
  );
}
