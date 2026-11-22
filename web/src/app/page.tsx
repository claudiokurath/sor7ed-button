import type { Metadata } from "next";
import HeroDemo from "./_home/HeroDemo";
import HeroScribble from "./_home/HeroScribble";
import HomeNav from "./_home/HomeNav";
import { Footer, Problem, Steps, ForYou, ForWebsites, Faq, Privacy } from "./_home/Sections";
import "./_home/home.css";

export const metadata: Metadata = {
 title: "Sorted — your links, tools and member hub",
 description: "Start with Sorted: keep links in WhatsApp, explore Planet Sorted's tools and guidebooks, or sign in to your central member account.",
 alternates: { canonical: "https://www.sor7ed.com" },
 openGraph: {
  type: "website",
  url: "https://www.sor7ed.com",
  siteName: "SORTED",
  title: "Sorted — your starting point",
  description: "Keep useful links. Find practical tools and guidebooks. Return to your saved resources.",
  images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "SORTED — your links, tools and member hub." }],
 },
 twitter: {
  card: "summary_large_image",
  title: "Sorted — your starting point",
  description: "Links, practical tools, guidebooks and your central member account.",
  images: ["/opengraph-image"],
 },
};

export default function HomePage() {
 return (
      <div className="s7" id="top">
        <link rel="preload" as="image" href="/static/demo-garden.svg" />
        <a className="s7-skip" href="#main">Skip to main content</a>
        <HomeNav />

        <main id="main">
          <section className="s7-wrap s7-hero" aria-labelledby="hero-title">
            <div className="s7-hero-copy">
              <HeroScribble />
              <p className="s7-eyebrow">See it. Send it. Sorted.</p>
              <h1 id="hero-title" className="s7-h1">
                Keep what helps.
                <em>Come back to it.</em>
              </h1>
              <p className="s7-lede">
                Your starting point for useful links, practical tools and guides, and the things you want to keep close.
              </p>
              <p className="s7-prose s7-hero-detail">Explore Planet Sorted freely. Sign in here to keep supported protocols and links in your WhatsApp thread and saved library.</p>
              <div className="s7-ctas">
                <a className="s7-btn s7-btn--primary" href="#choose">Find your starting point <span className="s7-start-arrow" aria-hidden="true">↓</span></a>
                <a className="s7-demo-link" href="/signin">Member sign-in <span aria-hidden="true">→</span></a>
              </div>
            </div>
          </section>
          <section id="choose" className="s7-wrap s7-hub" aria-labelledby="hub-heading">
            <p className="s7-eyebrow">The Sorted hub</p>
            <h2 className="s7-h2" id="hub-heading">What would help today?</h2>
            <div className="s7-hub-grid">
              <a className="s7-hub-card" href="/links"><span className="s7-eyebrow">Keep useful links</span><h3>SOR7ED Links</h3><p>Articles, videos and pages worth another look. Keep them in your WhatsApp thread with the Chrome extension.</p><span className="s7-hub-link">Get the extension ↗</span></a>
              <a className="s7-hub-card" href="https://www.planetsorted.com"><span className="s7-eyebrow">Explore freely</span><h3>Planet Sorted</h3><p>Practical tools and plain-language guidebooks for brains that work differently. No website account needed.</p><span className="s7-hub-link">Explore tools and guidebooks ↗</span></a>
              <a className="s7-hub-card" href="/account"><span className="s7-eyebrow">Your member space</span><h3>Your Sorted account</h3><p>Revisit saved links and protocols. One central account for the Button and extension, with WhatsApp connected.</p><span className="s7-hub-link">Go to your account →</span></a>
            </div>
          </section>
          <section className="s7-section s7-section--yellow" aria-labelledby="member-perks-heading"><div className="s7-wrap s7-hub-perks">
            <p className="s7-eyebrow">A little more when you join</p><h2 className="s7-h2" id="member-perks-heading">Read freely. Keep what helps.</h2>
            <p className="s7-prose">Planet Sorted’s guides and tool explanations are open to explore. With a Sorted account, you can request supported practical protocols, keep them in WhatsApp and return to your saved resources here.</p>
            <a className="s7-btn s7-btn--primary" href="/signin">Sign in or create your account →</a>
          </div></section>
          <section className="s7-wrap s7-hub-about" aria-labelledby="hub-about-heading"><p className="s7-eyebrow">The company behind it</p><h2 className="s7-h2" id="hub-about-heading">Useful things. Less friction.</h2><p className="s7-prose">Our vision is practical support that fits real life, with less pressure and more room to go at your own pace.</p><a href="/about">About Sorted and our vision →</a></section>
          <div id="demo" className="s7-wrap s7-home-demo">
            <HeroDemo />
          </div>

          <Problem />
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
