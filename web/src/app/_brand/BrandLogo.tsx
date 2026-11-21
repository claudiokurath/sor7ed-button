import styles from "./BrandLogo.module.css";

/** The supplied SORTED wordmark, including the tangle inside the O. */
export function BrandLogo() {
  return (
    <img
      className={styles.wordmark}
      src="/static/sor7ed-logo-white.png"
      alt="SORTED"
      width={1832}
      height={430}
    />
  );
}
