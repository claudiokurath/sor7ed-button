import { BrandLogo } from "../_brand/BrandLogo";

  const EMBED = `<!-- Optional: where the button should appear -->
<div data-sor7ed data-title="Page title" data-url="https://example.com/page"></div>

<!-- Once per page -->
<script
  src="https://www.sor7ed.com/widget.js"
  data-api-key="YOUR_PARTNER_KEY"
  data-label="Save this piece"
  data-color="#25D366"
  async
><\/script>`;

  export function Problem() {
    return (
      <section className="s7-section s7-section--yellow" aria-labelledby="problem-title">
        <div className="s7-wrap s7-editorial-grid">
          <div><p className="s7-eyebrow">The problem</p><h2 id="problem-title" className="s7-h2">Good finds get lost in open tabs and bookmarks.</h2></div>
          <div className="s7-editorial-copy"><p className="s7-prose">Articles, videos and guides pile up. Another app to manage can make it harder to come back to them.</p><div className="s7-short-rule" /><p className="s7-prose">Keep the good ones in one WhatsApp thread, ready to open later.</p></div>
        </div>
      </section>
    );
  }

  export function Steps() {
    const items = [
      { n: '01', h: 'Find something worth keeping.', p: 'An article, a video, a guide: anything useful on a website that has the Button.' },
      { n: '02', h: 'Press SOR7ED on a participating website.', p: 'Look for the tangle mark. The first time, a small window lets you sign in with WhatsApp.' },
      { n: '03', h: 'Receive the link in your WhatsApp thread once connected.', p: 'We send the link to your connected WhatsApp thread. You can see whether the request was accepted or needs attention; acceptance does not confirm arrival on your phone.' },
    ];
    return (
      <section id="how-it-works" className="s7-section" aria-labelledby="how-title">
        <div className="s7-wrap">
          <p className="s7-eyebrow">How it works</p>
          <h2 id="how-title" className="s7-h2">Find it. Press SOR7ED. Keep it.</h2>
          <ol className="s7-steps">
            {items.map((s) => (
              <li key={s.n} className="s7-step">
                <span className="s7-num">{s.n}</span>
                <h3 className="s7-h3">{s.h}</h3>
                <p>{s.p}</p>
              </li>
            ))}
          </ol>
          <p className="s7-prose">
            First time only: open WhatsApp and send the prepared sign-in message. Enter the
            six-digit reply in the save window to verify your number. No Google account needed.
          </p>
          <p className="s7-note">The demo above is a simulation. <a href="/signin">Sign in with WhatsApp</a> to save pages to your own account.</p>
        </div>
      </section>
    );
  }

  export function ForYou() {
    return (
      <section className="s7-section s7-section--yellow" aria-labelledby="you-title">
        <div className="s7-wrap">
          <p className="s7-eyebrow">For you</p>
          <h2 id="you-title" className="s7-h2">A familiar place for useful things.</h2>
          <p className="s7-prose">
            WhatsApp is already open on your phone. A page saved there sits next to your other
            conversations, so useful things stay easy to return to, with no other app to install
            or manage.
          </p>
          <h3 className="s7-h3" id="extension">The browser extension</h3>
          <p className="s7-prose">The desktop extension preview lets you choose a page in Chrome or Edge and open its SOR7ED save window. One click saves the selected page when you are signed in and your WhatsApp conversation is active. It does not continuously read your browsing history.</p>
          <p className="s7-prose"><a href="/downloads/send-to-sorted-extension.zip" download>Download the extension preview (ZIP)</a></p>
          <ol className="s7-facts">
            <li>Extract the ZIP into a folder.</li>
            <li>Open your browser's Extensions settings and enable Developer mode.</li>
            <li>Choose Load unpacked, then select the extracted folder.</li>
            <li>Open a web page and press the scribble or choose Save with SOR7ED from the right-click menu.</li>
          </ol>
          <p className="s7-note">Preview version 0.1.0 for desktop Chrome and Edge. This is an unpacked test build, not a browser-store release. Sign in once at sor7ed.com; no Google account is required.</p>
        </div>
      </section>
    );
  }

  export function ForWebsites() {
    return (
      <section id="for-websites" className="s7-section" aria-labelledby="owners-title">
        <div className="s7-wrap">
          <p className="s7-eyebrow">For website owners</p>
          <h2 id="owners-title" className="s7-h2">Your content. Ready to come back to.</h2>
          <p className="s7-prose">
            Add the Button to a page and visitors can send it to their own WhatsApp thread. If you
            leave out the placeholder, the Button is added at the end of the page. Without the
            optional attributes it reads your page's Open Graph tags, title and address. Optional
            placeholder attributes: <code>data-title</code>, <code>data-url</code>,{' '}
            <code>data-description</code>, <code>data-image</code>.
          </p>
          <pre className="s7-code"><code>{EMBED}</code></pre>
          <ul className="s7-facts">
            <li>The key is visible in your page source. Verify ownership of your website domain before enabling saves. An empty list disables the key.</li>
            <li>Registered domains include their subdomains; www is treated the same as the bare domain.</li>
            <li>The dashboard includes saves, distinct savers, top pages and opens of saved links. Forwarded links can also count as opens; an open is not necessarily a unique returning visitor.</li>
            <li>The partner dashboard includes monthly save limits and key rotation. Sign in to create your website account, then verify your domain.</li>
            <li>The Button’s font is hosted by SOR7ED. It does not request Google Fonts on your visitors’ browsers.</li>
          </ul>
          <div className="s7-partner-metrics"><div><p className="s7-eyebrow">Saves</p><h3 className="s7-h3">See what readers keep.</h3><p className="s7-prose">The partner dashboard records saves from your website.</p></div><div><p className="s7-eyebrow">Opens</p><h3 className="s7-h3">See what gets reopened.</h3><p className="s7-prose">Track opens of saved links. These are link opens, not verified unique return visits.</p></div></div>
          <h3 className="s7-h3">Setting up</h3>
          <ol className="s7-facts">
            <li>Create a partner account and copy your key.</li>
            <li>Verify your website domain with the DNS TXT record shown in the dashboard.</li>
            <li>Paste the snippet into your page, with your key in place of the placeholder.</li>
          </ol>
          <p className="s7-note">Website accounts start with saves disabled. Verify your domain before using a live key.</p>
        </div>
      </section>
    );
  }

  const FAQ = [
    { q: 'How does WhatsApp get connected?', a: 'The first time, send the prepared sign-in message in WhatsApp and enter the six-digit reply in the save window. It expires after ten minutes and locks after five wrong codes. On phones the save flow uses the current tab; desktop browsers use a small window when allowed.' },
    { q: 'What gets saved?', a: 'The address, title, description and preview image that the website provides for the page you pressed SOR7ED on, linked to your account.' },
    { q: 'Which websites take part?', a: 'Website owners can add the Button to their pages. The optional desktop extension preview also lets you choose pages on other websites, without requiring the publisher to add a button. Some restricted or private pages do not provide a usable public image. Those cards use the SOR7ED scribble instead.' },
    { q: 'What happens to my data?', a: 'The privacy summary below explains the main points. The footer links to the Button privacy policy for details about saved links, WhatsApp, service providers and your rights.' },
    { q: 'What is the difference between the demo and live saving?', a: 'The demo on this page runs in your browser. It sends nothing, saves nothing and contacts no service. Live saving signs you in, connects WhatsApp and asks WhatsApp to send the card. The save window shows whether the request was accepted or needs attention. Delivery to your phone can take a moment. If the conversation has become inactive, you may need to reopen it before a message can be sent.' },
  ];

  export function Faq() {
    return (
      <section id="faq" className="s7-section" aria-labelledby="faq-title">
        <div className="s7-wrap">
          <p className="s7-eyebrow">FAQ</p>
          <h2 id="faq-title" className="s7-h2">Questions</h2>
          <div className="s7-faq">
            {FAQ.map((item) => (
              <details key={item.q} className="s7-faq-item" open={item.q === 'How does WhatsApp get connected?'}>
                <summary className="s7-faq-q">{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    );
  }

  export function Privacy() {
    return (
      <section id="privacy" className="s7-section s7-section--yellow" aria-labelledby="privacy-title">
        <div className="s7-wrap">
          <p className="s7-eyebrow">Privacy</p>
          <h2 id="privacy-title" className="s7-h2">Privacy summary</h2>
          <ul className="s7-facts">
            <li>WhatsApp sign-in verifies your number using a single-use code. If Google sign-in is enabled, it also provides your email address and Google ID.</li>
            <li>WhatsApp (Meta's WhatsApp Cloud API) connects your number and sends the card. Sending the connection message shares your number with SOR7ED.</li>
            <li>Saved items keep the page address, title, description and image link against your account, together with the send status and any WhatsApp message ID returned.</li>
            <li>SOR7ED keeps your WhatsApp opt-out status and the time of your last message to determine whether the conversation is active.</li>
            <li>Public preview images may be fetched and fitted to the card without stretching. Missing, small or unusable images use SOR7ED artwork. Where AI enrichment is enabled, page titles and descriptions are sent to OpenAI for summaries and tags.</li>
            <li>New saved cards open the original website directly. Older SOR7ED links may record a continuation after you choose to open the destination; these counts are estimates, not verified unique visitors.</li>
          </ul>
          <p className="s7-prose">Read the <a href="/privacy-policy">Button privacy policy</a> for more detail and how to contact us about your data.</p>
        </div>
      </section>
    );
  }

  export function Footer() {
    return (
      <footer className="s7-footer">
        <div className="s7-wrap s7-footer-inner">
          <p className="s7-brandline">
            <BrandLogo />
          </p>
          <nav aria-label="Footer" className="s7-footerlinks">
            <a href="#demo">Try the demo</a>
            <a href="#for-websites">For website owners</a>
            <a href="#how-it-works">How it works</a>
            <a href="/account">Your account</a>
            <a href="#privacy">Privacy summary</a>
            <a href="/privacy-policy">Privacy policy</a>
            <a href="/button-terms">Button terms</a>
            <a href="https://www.planetsorted.com" rel="noopener">PLANET SOR7ED: neurodivergent support and content ↗</a>
          </nav>
        </div>
      </footer>
    );
  }

