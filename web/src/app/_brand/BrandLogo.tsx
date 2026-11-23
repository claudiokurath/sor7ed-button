import styles from "./BrandLogo.module.css";

/** The supplied SOR7ED wordmark, including the tangle inside the O. */
export function BrandLogo() {
  return (
    <img
      className={styles.wordmark}
      src="/static/sor7ed-logo-white.png"
      alt="SOR7ED"
      width={1832}
      height={430}
    />
  );
}
