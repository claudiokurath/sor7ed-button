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

  export function Nav() {
    return (
      <header className="s7-nav">
        <div className="s7-wrap s7-nav-inner">
          <a className="s7-brand" href="#top" aria-label="SOR7ED home">
            <img src="/static/tangle-white.png" alt="" />
            <span>SOR7ED</span>
          </a>
          <nav aria-label="Main" className="s7-navlinks">
            <a className="s7-navlink" href="#how-it-works">How it works</a>
            <a className="s7-navlink" href="#for-websites">For websites</a>
            <a className="s7-navlink" href="#demo">Try the demo</a>
            <a className="s7-navlink s7-navlink--muted" href="https://www.planetsorted.com" rel="noopener">Planet Sorted ↗</a>
          </nav>
        </div>
      </header>
    );
  }

  export function Steps() {
    const items = [
      { n: '01', h: 'Find something worth keeping.', p: 'An article, a video, a guide: anything useful on a website that has the Button.' },
      { n: '02', h: 'Press Sorted on a participating website.', p: 'Look for the tangle mark. The first time, a small window lets you sign in with WhatsApp.' },
      { n: '03', h: 'Receive the link in your WhatsApp thread once connected.', p: 'When live saving is available, SOR7ED asks WhatsApp to send the card. The Button distinguishes an accepted send from a pending, failed, not-sent or unconfirmed request. Acceptance does not confirm arrival on your phone.' },
    ];
    return (
      <section id="how-it-works" className="s7-section" aria-labelledby="how-title">
        <div className="s7-wrap">
          <p className="s7-eyebrow">How it works</p>
          <h2 id="how-title" className="s7-h2">Three steps, then you are done.</h2>
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
          <p className="s7-note">Live saving is not switched on yet. The demo above is a simulation.</p>
        </div>
      </section>
    );
  }

  export function ForYou() {
    return (
      <section className="s7-section" aria-labelledby="you-title">
        <div className="s7-wrap">
          <p className="s7-eyebrow">For you</p>
          <h2 id="you-title" className="s7-h2">Keep it where you already look.</h2>
          <p className="s7-prose">
            WhatsApp is already open on your phone. A page saved there sits next to your other
            conversations, so useful things stay easy to return to, with no other app to install
            or manage.
          </p>
        </div>
      </section>
    );
  }

  export function ForWebsites() {
    return (
      <section id="for-websites" className="s7-section" aria-labelledby="owners-title">
        <div className="s7-wrap">
          <p className="s7-eyebrow">For website owners</p>
          <h2 id="owners-title" className="s7-h2">One script. Your visitors take your content with them.</h2>
          <p className="s7-prose">
            Add the Button to a page and visitors can send it to their own WhatsApp thread. If you
            leave out the placeholder, the Button is added at the end of the page. Without the
            optional attributes it reads your page's Open Graph tags, title and address. Optional
            placeholder attributes: <code>data-title</code>, <code>data-url</code>,{' '}
            <code>data-description</code>, <code>data-image</code>.
          </p>
          <pre className="s7-code"><code>{EMBED}</code></pre>
          <ul className="s7-facts">
            <li>The key is visible in your page source. Register your domains to restrict which page addresses it can save. Leaving the list empty allows any page domain.</li>
            <li>Registered domains include their subdomains; www is treated the same as the bare domain.</li>
            <li>The dashboard includes saves, distinct savers, top pages and opens of saved links. Forwarded links can also count as opens; an open is not necessarily a unique returning visitor.</li>
            <li>The partner dashboard includes monthly save limits and key rotation. Live partner sign-in is not available yet.</li>
            <li>The Button loads one web font from Google Fonts. Mention this in your own privacy notice.</li>
          </ul>
          <h3 className="s7-h3">Setting up</h3>
          <ol className="s7-facts">
            <li>Create a partner account and copy your key.</li>
            <li>List the domains that may use the key.</li>
            <li>Paste the snippet into your page, with your key in place of the placeholder.</li>
          </ol>
          <p className="s7-note">Partner accounts are not open yet. Use the placeholder key only to see how it fits.</p>
        </div>
      </section>
    );
  }

  const FAQ = [
    { q: 'How does WhatsApp get connected?', a: 'The first time, send the prepared sign-in message in WhatsApp and enter the six-digit reply in the save window. It expires after ten minutes and locks after five wrong codes. On phones the save flow uses the current tab; desktop browsers use a small window when allowed.' },
    { q: 'What gets saved?', a: 'The address, title, description and preview image that the website provides for the page you pressed Sorted on, linked to your account.' },
    { q: 'Which websites take part?', a: 'Only websites whose owners have added the Button. It does not appear anywhere else. A browser extension is planned but not available.' },
    { q: 'What happens to my data?', a: 'See the privacy summary on this page. It is a plain-language summary, not a full privacy policy.' },
    { q: 'What is the difference between the demo and live saving?', a: 'The demo on this page runs in your browser. It sends nothing, saves nothing and contacts no service. Live saving signs you in, connects WhatsApp and asks WhatsApp to send the card. WhatsApp accepting a message is not proof it arrived, so the Button also shows when sending is pending, failed, not sent or unconfirmed. If the conversation has become inactive, you may need to reopen it before a message can be sent.' },
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
      <section id="privacy" className="s7-section" aria-labelledby="privacy-title">
        <div className="s7-wrap">
          <p className="s7-eyebrow">Privacy</p>
          <h2 id="privacy-title" className="s7-h2">Privacy summary</h2>
          <ul className="s7-facts">
            <li>Google sign-in identifies your account using your email address and Google ID.</li>
            <li>WhatsApp (Meta's WhatsApp Cloud API) connects your number and sends the card. Sending the connection message shares your number with SOR7ED.</li>
            <li>Saved items keep the page address, title, description and image link against your account, together with the send status and any WhatsApp message ID returned.</li>
            <li>SOR7ED keeps your WhatsApp opt-out status and the time of your last message to determine whether the conversation is active.</li>
            <li>Public page previews may be fetched and preview images cached at public addresses. Where AI enrichment is enabled, page titles and descriptions are sent to OpenAI for summaries and tags.</li>
            <li>Card links pass through a SOR7ED link that records opens against the saved item and originating website. Known preview crawlers are excluded; an open is not proof of a unique return visit.</li>
          </ul>
          <p className="s7-prose">This is a plain-language summary, not a full privacy policy.</p>
        </div>
      </section>
    );
  }

  export function Footer() {
    return (
      <footer className="s7-footer">
        <div className="s7-wrap s7-footer-inner">
          <p className="s7-brandline">
            <img src="/static/tangle-white.png" alt="" />
            SOR7ED
          </p>
          <nav aria-label="Footer" className="s7-footerlinks">
            <a href="#demo">Try the demo</a>
            <a href="#for-websites">For website owners</a>
            <a href="#how-it-works">How it works</a>
            <a href="#privacy">Privacy summary</a>
            <a href="https://www.planetsorted.com" rel="noopener">Planet Sorted: neurodivergent support and content ↗</a>
          </nav>
        </div>
      </footer>
    );
  }

