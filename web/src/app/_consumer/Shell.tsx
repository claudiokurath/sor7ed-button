import type { ReactNode } from "react";
import styles from "./consumer.module.css";
export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root}>
      <header className={styles.nav}>
        <a href="/" className={styles.brand}>
          <img src="/static/tangle.png" alt="" />
          SOR7ED
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
