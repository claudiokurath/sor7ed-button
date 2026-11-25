import type { Metadata } from "next";
import HomeNav from "../_home/HomeNav";
import HeroScribble from "../_home/HeroScribble";
import HeroDemo from "../_home/HeroDemo";
import "../_home/home.css";
import styles from "./links.module.css";

const storeUrl =
  "https://chromewebstore.google.com/detail/plljajhlkagokdjdmajiichjcjhmnhef";

export const metadata: Metadata = {
  title: "SOR7ED Links — Save to WhatsApp",
  description:
    "That article you meant to read. That video worth another look. Keep useful links in WhatsApp with SOR7ED Links.",
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
    <div className={`${styles.page} s7`} id="top">
      <a className={styles.skip} href="#links-main">
        Skip to content
      </a>
      <HomeNav linksPage />
      <main id="links-main">
        <section className={styles.hero} aria-labelledby="links-heading">
          <HeroScribble />
          <p className={styles.eyebrow}>SOR7ED Links</p>
          <h1 className={styles.heading} id="links-heading">
            <span>Keep the good stuff.</span>
            <span>In your <em>WhatsApp.</em></span>
          </h1>
          <p className={styles.intro}>
            That article you meant to read. That video worth another look. Give
            it a place you’ll remember to check: your WhatsApp thread.
          </p>
          <a className={styles.primary} href={storeUrl}>
            Add to Chrome <span className={styles.arrow} aria-hidden="true">↗</span>
          </a>
          <p className={styles.requirements}>
            For desktop Chrome. A SOR7ED account and WhatsApp connection are
            required.
          </p>
        </section>

        <section id="how-it-works" className={styles.stepsSection} aria-labelledby="how-heading">
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
                  Receive the link in WhatsApp. Your SOR7ED account keeps a
                  backup history too.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section id="demo" className="s7-wrap s7-home-demo" aria-label="Try saving a sample link">
          <HeroDemo />
        </section>
        <section className={styles.details} aria-labelledby="yours-heading">
          <div>
            <p className={styles.eyebrow}>Your thread. Your links.</p>
            <h2 id="yours-heading">Less “where did I put that?”</h2>
            <p>
              Keep the useful things that otherwise disappear into open tabs,
              screenshots and “I’ll find it later”. Revisit or remove saved
              links from your central SOR7ED account.
            </p>
            <a className={styles.secondary} href="/account">
              Go to your account <span aria-hidden="true">→</span>
            </a>
          </div>
          <div className={styles.questions}>
            <details>
              <summary>Do I need an account?</summary>
              <p>
                Yes. Sign in to SOR7ED and connect WhatsApp when prompted. You
                may occasionally need to reconnect before sending. Planet
                SOR7ED’s tools and guidebooks website has no separate member
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
        <a href="/">SOR7ED hub</a>
        <a href="/privacy-policy">Privacy</a>
        <a href="/button-terms">Terms</a>
        <a href="https://www.planetsorted.com">Planet SOR7ED ↗</a>
      </footer>
    </div>
  );
}
