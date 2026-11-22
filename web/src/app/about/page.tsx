import type { Metadata } from "next";
import styles from "../links/links.module.css";

export const metadata: Metadata = {
  title: "About Sorted — Our company and vision",
  description:
    "Why Sorted exists: practical support for everyday life, and a simpler way to keep useful things close.",
  alternates: { canonical: "https://www.sor7ed.com/about" },
};

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#about-main">
        Skip to content
      </a>
      <header className={styles.header}>
        <a href="/" aria-label="Sorted home">
          <img
            src="/static/sor7ed-logo-white.png"
            alt="SOR7ED"
            width="1832"
            height="430"
          />
        </a>
        <nav aria-label="About navigation">
          <a href="/links">SOR7ED Links</a>
          <a href="/signin">Member sign-in</a>
        </nav>
      </header>
      <main id="about-main">
        <section className={styles.hero} aria-labelledby="about-heading">
          <p className={styles.eyebrow}>About Sorted</p>
          <h1
            id="about-heading"
            style={{
              fontFamily: "LinksAnton, Impact, sans-serif",
              fontWeight: 400,
              fontSize: "clamp(44px,7vw,76px)",
              lineHeight: 1.1,
              margin: "0 0 28px",
            }}
          >
            Useful things.
            <br />
            Less friction.
          </h1>
          <p className={styles.intro}>
            Sorted brings our products and your member account together in one
            place. We make practical tools and ways to keep useful information
            close, so it’s easier to return to what helps.
          </p>
        </section>
        <section
          className={styles.stepsSection}
          id="vision"
          aria-labelledby="vision-heading"
        >
          <div className={styles.inner}>
            <p className={styles.eyebrow}>Our vision</p>
            <h2 id="vision-heading">Support that fits real life.</h2>
            <p style={{ maxWidth: 760, fontSize: 22 }}>
              Finding something helpful should lead to a useful next step. Our
              aim is to make that step easier: less searching, less pressure,
              and practical support you can come back to in your own time.
            </p>
            <p style={{ maxWidth: 760, fontSize: 20 }}>
              We build with people whose brains work differently in mind. Clear
              language, space to go at your own pace, and everyday usefulness
              guide what we make.
            </p>
          </div>
        </section>
        <section className={styles.details} aria-labelledby="products-heading">
          <div>
            <p className={styles.eyebrow}>One hub. Different ways to help.</p>
            <h2 id="products-heading">Choose what helps today.</h2>
            <p>
              <a href="/links">SOR7ED Links</a> keeps useful web links in your
              WhatsApp thread, with a backup in your Sorted account.
            </p>
            <p>
              <a href="https://www.planetsorted.com">Planet Sorted</a> is our
              public website for practical tools and guidebooks across Mind,
              Wealth, Body, Tech, Connection, Impression and Growth.
            </p>
          </div>
          <div>
            <h2>A little more when you join.</h2>
            <p>
              Members sign in here on sor7ed.com to request supported practical
              protocols, keep them in WhatsApp and revisit their saved
              resources. The same central account supports the Button and
              extension.
            </p>
            <p>
              Planet Sorted is public. There is no separate Planet Sorted login
              to read its guidebooks or explore tool explanations.
            </p>
            <a className={styles.primary} href="/signin">
              Sign in or create your account <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <a href="/">Sorted hub</a>
        <a href="/links">SOR7ED Links</a>
        <a href="/privacy-policy">Privacy</a>
        <a href="/button-terms">Terms</a>
      </footer>
    </div>
  );
}
