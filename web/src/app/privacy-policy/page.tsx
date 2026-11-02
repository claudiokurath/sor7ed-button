import { BrandLogo } from "../_brand/BrandLogo";
import type { Metadata } from "next";
import "../_home/home.css";

export const metadata: Metadata = {
  title: "Button privacy policy — SOR7ED",
  description: "How the SOR7ED Button handles account details, saved pages, WhatsApp messages and your data rights.",
  alternates: { canonical: "https://www.sor7ed.com/privacy-policy" },
};

export default function PrivacyPolicy() {
  return (
    <div className="s7">
      <a className="s7-skip" href="#main">Skip to privacy policy</a>
      <header className="s7-nav"><div className="s7-wrap s7-nav-inner"><a className="s7-brand" href="/" aria-label="SOR7ED home"><BrandLogo /></a></div></header>
      <main className="s7-wrap s7-policy" id="main">
        <p className="s7-eyebrow">Updated 24 October 2026</p>
        <h1 className="s7-h1">Button privacy policy</h1>
        <p className="s7-prose">SOR7ED LIMITED operates the SOR7ED Button at sor7ed.com. This notice covers the Button, its partner widget, account and browser-extension features when available. PlanetSorted is a separate content website with its own privacy notice. Live saving and partner accounts are not currently open; the homepage demo runs locally in your browser and does not send or save a message.</p>

        <h2 className="s7-h2">What we collect and why</h2>
        <ul className="s7-facts">
          <li><strong>Account and connection details:</strong> a WhatsApp number, account identifier, connection status and opt-out preference. Where Google sign-in is offered, we also receive your Google account ID, email address. These identify your account, connect the correct thread and protect access.</li>
          <li><strong>Pages you choose to save:</strong> the address, title, description and preview-image link provided by a participating website or captured after an explicit extension action. Saved items are associated with your account and, for partner saves, the originating website. Avoid saving confidential links, private documents or addresses containing access tokens.</li>
          <li><strong>Delivery and connection records:</strong> message identifiers, send status, last inbound-message time and short-lived verification records. These support delivery, prevent duplicate or unauthorised actions and enforce WhatsApp's conversation rules. An accepted send is not confirmation that a message arrived.</li>
          <li><strong>Partner administration:</strong> team membership, invited email addresses, allowed domains, keys, quotas and usage records support website administration and abuse prevention.</li>
          <li><strong>Saved-link opens:</strong> opening a SOR7ED card link can record an event against the saved item and originating website. Known preview crawlers are excluded. Partner reports include aggregated save and open counts; an open is not proof of a unique visitor or sale.</li>
          <li><strong>Technical records:</strong> hosting and API services may process IP addresses, browser information and request or error logs for delivery, security and troubleshooting.</li>
        </ul>

        <h2 className="s7-h2">Browser extension and public previews</h2>
        <p className="s7-prose">The extension, when released, reads the selected page's address, title and preview metadata when you use its toolbar or context-menu action. It does not continuously collect browsing history or read your login cookies. You review the page in the save window before sending. Temporary capture details may be held in that browser tab's session storage while you sign in. SOR7ED card links are shareable: anyone with one may see its preview and open the original address. They are not a private document vault. Preview images hosted by another website can cause that website to receive a request when the image loads.</p>

        <h2 className="s7-h2">Providers and sharing</h2>
        <p className="s7-prose">Meta's WhatsApp Cloud API processes the recipient number and message content to connect your thread and deliver requested messages. Your use of WhatsApp is also subject to Meta's own terms and privacy notices. Vercel hosts the web service and Neon provides the Button's Postgres database. Google processes sign-in where that option is enabled. The widget and marketing page use fonts hosted by SOR7ED; loading the widget does not request a font from Google. To limit false open counts, the service uses a keyed digest of the visitor network address to count at most one continuation of a saved link per address per day. These counts are estimates, not verified unique people.</p>
        <p className="s7-prose">The lean launch configuration does not use AI enrichment, a background reminder worker or separate image uploads. If full-mode AI enrichment is enabled, page titles and descriptions are sent to OpenAI to generate summaries and tags; preview content may also be fetched and images cached. We will update this notice before materially changing the processing described here. Service providers may process data outside the UK; applicable transfer safeguards must be in place where required. We may disclose information when legally required or necessary to protect the service and its users.</p>

        <h2 className="s7-h2">Legal bases and messages</h2>
        <p className="s7-prose">We process information needed to provide requested account, save and delivery functions to perform our service agreement with you. Security, duplicate prevention and proportionate usage reporting rely on legitimate interests, balanced against your rights. Legal record-keeping relies on legal obligations. Where consent is required for optional marketing or non-essential tracking, we will ask separately; connecting WhatsApp is not permission for unrelated marketing. Send STOP in the thread to pause messaging and START to resume. WhatsApp may require you to reopen the conversation before we can send another requested item.</p>

        <h2 className="s7-h2">Storage, security and retention</h2>
        <p className="s7-prose">Account and saved-item records are kept while needed to provide your account and history. Verification records expire according to their purpose; security, opt-out and legally required records may need to be retained separately. We limit access and use protected server-side credentials and session cookies. No online service can guarantee absolute security. Removing an item or account from SOR7ED does not remove messages already delivered to WhatsApp or copies held by recipients.</p>

        <h2 className="s7-h2">Your choices and rights</h2>
        <p className="s7-prose">When account controls are available, you can remove saved history, edit supported profile details, pause messages and request account deletion. You can also request access, correction, erasure, restriction or portability of your personal data, object to processing based on legitimate interests and withdraw consent where it applies. We may need to verify your identity before acting. Contact SOR7ED LIMITED through the <a href="https://www.planetsorted.com/contact">contact page</a>, stating that your request concerns the Button. You can complain to the UK's <a href="https://ico.org.uk/make-a-complaint/">Information Commissioner's Office</a>.</p>
        <p className="s7-prose">We use essential session cookies to maintain sign-in. The demo does not require an account. This service is intended for adults. Changes to this notice will be published here with an updated date.</p>
        <p className="s7-prose"><a href="/">← Back to SOR7ED</a></p>
      </main>
    </div>
  );
}
