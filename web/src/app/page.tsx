import type { Metadata } from "next";
import HeroDemo from "./_home/HeroDemo";
import { Nav, Footer, Steps, ForYou, ForWebsites, Faq, Privacy } from "./_home/Sections";
import "./_home/home.css";

export const metadata: Metadata = {
 title: "SOR7ED — keep useful things in WhatsApp",
 description: "Found something useful? Send it to yourself. Explore the SOR7ED Button with an interactive, no-signup preview.",
 alternates: { canonical: "https://www.sor7ed.com" },
 openGraph: {
  type: "website",
  url: "https://www.sor7ed.com",
  siteName: "SOR7ED",
  title: "SOR7ED — keep useful things in WhatsApp",
  description: "Found something useful? Send it to yourself. Try the interactive preview of the SOR7ED Button.",
  images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "SOR7ED — Found something useful? Send it to yourself." }],
 },
 twitter: {
  card: "summary_large_image",
  title: "SOR7ED — keep useful things in WhatsApp",
  description: "Found something useful? Send it to yourself. Try the interactive preview of the SOR7ED Button.",
  images: ["/opengraph-image"],
 },
};

export default function HomePage() {
 return (
      <div className="s7" id="top">
        <link rel="preload" as="image" href="/static/demo-garden.svg" />
        <a className="s7-skip" href="#main">Skip to main content</a>
        <Nav />

        <main id="main">
          <section className="s7-wrap s7-hero" aria-labelledby="hero-title">
            <div>
              <h1 id="hero-title" className="s7-h1">
                Found something useful?
                <em>Send it to yourself.</em>
              </h1>
              <p className="s7-lede">
                Keep useful articles, videos and resources in one familiar WhatsApp thread.
                Come back when you're ready.
              </p>
              <div className="s7-ctas">
                <a className="s7-btn s7-btn--primary" href="/signin">Start with WhatsApp</a>
                <a className="s7-btn s7-btn--secondary" href="#for-websites">For website owners</a>
              </div>
            </div>
            <div id="demo" style={{ display: 'flex', justifyContent: 'center', scrollMarginTop: 16 }}>
              <HeroDemo />
            </div>
          </section>

          <Steps />
          <ForYou />
          <ForWebsites />
          <Faq />
          <Privacy />
        </main>

        <Footer />
      </div>
 );
}
