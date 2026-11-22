import type { Metadata } from "next";
import styles from "./links.module.css";

const storeUrl =
  "https://chromewebstore.google.com/detail/plljajhlkagokdjdmajiichjcjhmnhef";

export const metadata: Metadata = {
  title: "SOR7ED Links (Sorted Links) — Save to WhatsApp",
  description:
    "That article you meant to read. That video worth another look. Keep useful links in WhatsApp with SOR7ED Links, pronounced Sorted Links.",
  alternates: { canonical: "https://www.sor7ed.com/links" },
  openGraph: {
    type: "website",
    url: "https://www.sor7ed.com/links",
    title: "SOR7ED Links — See it. Send it. SOR7ED.",
    description:
      "Give useful links a place you'll remember to check: your WhatsApp thread.",
    images: [
      {
        url: "/links-preview.png",
        width: 1200,
        height: 630,
        alt: "White scribble beside yellow LINKS. See it. Send it. SOR7ED.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SOR7ED Links — Save to WhatsApp",
    images: ["/links-preview.png"],
  },
};

export default function LinksPage() {
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#links-main">
        Skip to content
      </a>
      <header className={styles.header}>
        <a href="/" aria-label="Sorted home">
          <img
            src="/static/sor7ed-logo-white.png"
            width="1832"
            height="430"
            alt="SOR7ED"
          />
        </a>
        <nav aria-label="Links navigation">
          <a href="/about">About Sorted</a>
          <a href="/signin">Member sign-in</a>
        </nav>
      </header>
      <main id="links-main">
        <section className={styles.hero} aria-labelledby="links-heading">
          <h1
            className={styles.lockup}
            id="links-heading"
            aria-label="SOR7ED Links, pronounced Sorted Links"
          >
            <img
              className={styles.scribble}
              src="/static/tangle-white.png"
              alt=""
              width="724"
              height="748"
            />
            <span className={styles.logoText}>
              <span className={styles.links}>LINKS</span>
              <span className={styles.tagline}>
                See it. Send it.{" "}
                <img
                  src="/static/sor7ed-logo-white.png"
                  alt="SOR7ED."
                  width="1832"
                  height="430"
                />
              </span>
            </span>
          </h1>
          <h2>Keep the good stuff.</h2>
          <p className={styles.intro}>
            That article you meant to read. That video worth another look. Give
            it a place you’ll remember to check: your WhatsApp thread.
          </p>
          <a className={styles.primary} href={storeUrl}>
            Add to Chrome <span aria-hidden="true">↗</span>
          </a>
          <p className={styles.requirements}>
            For desktop Chrome. A Sorted account and WhatsApp connection are
            required.
          </p>
        </section>

        <section className={styles.stepsSection} aria-labelledby="how-heading">
          <div className={styles.inner}>
            <p className={styles.eyebrow}>
              Keep it now. Come back when you’re ready.
            </p>
            <h2 id="how-heading">Three small steps.</h2>
            <ol className={styles.steps}>
              <li>
                <span aria-hidden="true">01</span>
                <h3>See something useful.</h3>
                <p>
                  An article, a video, a page you want to keep. Stay on the
                  website you’re browsing.
                </p>
              </li>
              <li>
                <span aria-hidden="true">02</span>
                <h3>Press the scribble.</h3>
                <p>
                  Click the extension or right-click the link. Sign in and
                  connect WhatsApp when prompted.
                </p>
              </li>
              <li>
                <span aria-hidden="true">03</span>
                <h3>Find it in your thread.</h3>
                <p>
                  Receive the link in WhatsApp. Your Sorted account keeps a
                  backup history too.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className={styles.details} aria-labelledby="yours-heading">
          <div>
            <p className={styles.eyebrow}>Your thread. Your links.</p>
            <h2 id="yours-heading">Less “where did I put that?”</h2>
            <p>
              Keep the useful things that otherwise disappear into open tabs,
              screenshots and “I’ll find it later”. Revisit or remove saved
              links from your central Sorted account.
            </p>
            <a className={styles.secondary} href="/account">
              Go to your account <span aria-hidden="true">→</span>
            </a>
          </div>
          <div className={styles.questions}>
            <details>
              <summary>Do I need an account?</summary>
              <p>
                Yes. Sign in to Sorted and connect WhatsApp when prompted. You
                may occasionally need to reconnect before sending. Planet
                Sorted’s tools and guidebooks website has no separate member
                sign-in.
              </p>
            </details>
            <details>
              <summary>Will every link have an image?</summary>
              <p>
                Link previews depend on the original website and WhatsApp.
                Private pages and missing images can prevent a preview from
                appearing.
              </p>
            </details>
            <details>
              <summary>Does it watch everything I browse?</summary>
              <p>
                No. The extension captures the page or link you choose when you
                click it. It does not continuously monitor your browsing
                history. Read the privacy policy for details about saved-link
                data.
              </p>
            </details>
            <details>
              <summary>Can I install it on my phone?</summary>
              <p>
                This extension is for desktop Chrome. Once a link is sent, you
                can open it in WhatsApp on your phone.
              </p>
            </details>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <a href="/">Sorted hub</a>
        <a href="/privacy-policy">Privacy</a>
        <a href="/button-terms">Terms</a>
        <a href="https://www.planetsorted.com">Planet Sorted ↗</a>
      </footer>
    </div>
  );
}
