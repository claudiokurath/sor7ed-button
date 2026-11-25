import type { Metadata } from "next";
import FeaturedQuizzes from "./_home/FeaturedQuizzes";
import HeroScribble from "./_home/HeroScribble";
import HomeNav from "./_home/HomeNav";
import { Footer } from "./_home/Sections";
import "./_home/home.css";

export const metadata: Metadata = {
 title: "SOR7ED — practical help, without shame",
 description: "Making everyday life easier for brains that work differently. Practical help, clear information and useful tools, without judgement or shame.",
 alternates: { canonical: "https://www.sor7ed.com" },
 openGraph: {
  type: "website",
  url: "https://www.sor7ed.com",
  siteName: "SOR7ED",
  title: "SOR7ED — your starting point",
  description: "Keep useful links. Find practical tools and guidebooks. Return to your saved resources.",
  images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "SOR7ED — your links, tools and member hub." }],
 },
 twitter: {
  card: "summary_large_image",
  title: "SOR7ED — your starting point",
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
              <p className="s7-eyebrow">Making everyday life a little easier.</p>
              <h1 id="hero-title" className="s7-h1">
                Life is hard enough.
                <em>Help without shame.</em>
              </h1>
              <p className="s7-lede">
                SOR7ED exists to make everyday life easier for people whose brains work differently. Practical help, clear information and useful tools — without judgement or shame.
              </p>
              <p className="s7-prose s7-hero-detail">You deserve support that meets you where you are. Small steps, less pressure and room to go at your own pace.</p>
              <div className="s7-ctas">
                <a className="s7-btn s7-btn--primary" href="#choose">Find what helps <span className="s7-start-arrow" aria-hidden="true">↓</span></a>
                <a className="s7-demo-link" href="/about#vision">Our vision <span aria-hidden="true">→</span></a>
              </div>
            </div>
          </section>
          <section id="values" className="s7-wrap s7-hub" aria-labelledby="values-heading">
            <p className="s7-eyebrow">What we stand for</p>
            <h2 className="s7-h2" id="values-heading">More support. Less pressure.</h2>
            <div className="s7-hub-grid">
              <div className="s7-hub-card"><h3>No shame.</h3><p>Getting stuck does not make you lazy or a failure. You deserve useful help, without a lecture.</p></div>
              <div className="s7-hub-card"><h3>Make it easier.</h3><p>Clear information, practical tools and one manageable next step. Less friction in the everyday things.</p></div>
              <div className="s7-hub-card"><h3>Your pace.</h3><p>Different brains need different ways forward. Take what helps, leave what does not, and come back when you are ready.</p></div>
            </div>
          </section>
          <FeaturedQuizzes />
          <section id="choose" className="s7-wrap s7-hub" aria-labelledby="hub-heading">
            <p className="s7-eyebrow">The SOR7ED hub</p>
            <h2 className="s7-h2" id="hub-heading">What would help today?</h2>
            <div className="s7-hub-grid">
              <a className="s7-hub-card" href="/links"><span className="s7-eyebrow">Keep useful links</span><h3>SOR7ED Links</h3><p>Articles, videos and pages worth another look. Keep them in your WhatsApp thread with the Chrome extension.</p><span className="s7-hub-link">Get the extension ↗</span></a>
              <a className="s7-hub-card" href="https://www.planetsorted.com"><span className="s7-eyebrow">Explore freely</span><h3>Planet SOR7ED</h3><p>Practical tools and plain-language guidebooks for brains that work differently. No website account needed.</p><span className="s7-hub-link">Explore tools and guidebooks ↗</span></a>
              <a className="s7-hub-card" href="/account"><span className="s7-eyebrow">Your member space</span><h3>Your SOR7ED account</h3><p>Revisit saved links and protocols. One central account for the Button and extension, with WhatsApp connected.</p><span className="s7-hub-link">Go to your account →</span></a>
            </div>
          </section>
          <section className="s7-section s7-section--yellow" aria-labelledby="member-perks-heading"><div className="s7-wrap s7-hub-perks">
            <p className="s7-eyebrow">A little more when you join</p><h2 className="s7-h2" id="member-perks-heading">Read freely. Keep what helps.</h2>
            <p className="s7-prose">Planet SOR7ED’s guides and tool explanations are open to explore. With a SOR7ED account, you can request supported practical protocols, keep them in WhatsApp and return to your saved resources here.</p>
            <a className="s7-btn s7-btn--primary" href="/signin">Sign in or create your account →</a>
          </div></section>
          <section className="s7-wrap s7-hub-about" aria-labelledby="hub-about-heading"><p className="s7-eyebrow">The company behind it</p><h2 className="s7-h2" id="hub-about-heading">Useful things. Less friction.</h2><p className="s7-prose">We believe help should fit the person, rather than asking everyone to fit the same system. We are building practical support for everyday overwhelm, decisions, money and life admin — so useful things are easier to find, use and return to.</p><a href="/about">About SOR7ED and our vision →</a></section>
        </main>

        <Footer />
      </div>
 );
}
