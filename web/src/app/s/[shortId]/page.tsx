import { notFound } from "next/navigation";
import Shell from "../../_consumer/Shell";
import { destination, getSaveCard } from "../../../lib/save-card";
interface Props {
  params: Promise<{ shortId: string }>;
}
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props) {
  const { shortId } = await params;
  const item = await getSaveCard(shortId);
  if (!item)
    return {
      title: "Saved link not found | SOR7ED",
      robots: { index: false, follow: false },
    };
  const host = destination(item.url)!.hostname;
  const title =
    `${host} — ${item.title.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "")}`.slice(
      0,
      240,
    );
  return {
    title,
    description: null,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      siteName: "SOR7ED",
      type: "article",
      // External artwork is often cropped, text-heavy or missing. Keep the
      // card consistent; the real destination and saved title stay below it.
      images: [{ url: '/whatsapp-card-v2.png', width: 1200, height: 630, alt: 'SOR7ED scribble on black' }],
    },
  };
}
export default async function SavedLinkPage({ params }: Props) {
  const { shortId } = await params;
  const item = await getSaveCard(shortId);
  if (!item) notFound();
  const url = destination(item.url)!;
  return (
    <Shell>
      <section
        style={{
          maxWidth: 620,
          margin: "48px auto",
          padding: 24,
          overflowWrap: "anywhere",
        }}
      >
        <p style={{ fontSize: 13, color: "#FFD400" }}>SAVED WITH SOR7ED</p>
        <h1 style={{ fontSize: "clamp(30px,6vw,46px)", lineHeight: 1.1 }}>
          Continue to this website?
        </h1>
        <p style={{ fontSize: 22, fontWeight: 600 }}>{url.hostname}</p>
        <p>{item.title}</p>
        <p style={{ lineHeight: 1.6 }}>
          This link was saved by a user. Check the website address before you
          continue.
        </p>
        <p style={{ fontSize: 14, color: "#d4d4d4" }}>{url.href}</p>
        <form
          method="post"
          action={`/s/${encodeURIComponent(shortId)}/continue`}
        >
          <button
            type="submit"
            style={{
              minHeight: 52,
              background: "#FFD400",
              color: "#000",
              border: 0,
              padding: "14px 24px",
              fontWeight: 600,
              cursor: "pointer",
              maxWidth: "100%",
              overflowWrap: "anywhere",
            }}
          >
            Continue to {url.hostname} →
          </button>
        </form>
        <p style={{ marginTop: 24 }}>
          <a href="/account">Back to your saved links</a>
        </p>
      </section>
    </Shell>
  );
}
