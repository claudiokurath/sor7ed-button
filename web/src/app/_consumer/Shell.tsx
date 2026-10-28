import type { ReactNode } from "react";
import { BrandLogo } from "../_brand/BrandLogo";
import styles from "./consumer.module.css";
export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root}>
      <header className={styles.nav}>
        <a href="/" className={styles.brand} aria-label="SOR7ED home">
          <BrandLogo />
        </a>
        <nav className={styles.row}>
          <a href="/account">Your account</a>
          <a href="https://www.planetsorted.com">Planet Sorted ↗</a>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
