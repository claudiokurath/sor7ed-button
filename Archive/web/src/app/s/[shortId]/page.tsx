import { redirect } from "next/navigation";
import { headers } from "next/headers";

interface SaveCardPageProps {
  params: Promise<{ shortId: string }>;
}

// Crawlers identify themselves via User-Agent. We must NOT redirect for
// these — the whole point of this route is letting them read our OG tags
// instead of the original site's. Anyone else gets redirected straight through.
const CRAWLER_USER_AGENTS = ["whatsapp", "facebookexternalhit", "facebot", "twitterbot", "slackbot", "telegrambot", "linkedinbot"];

async function isCrawlerRequest(): Promise<boolean> {
  const ua = (await headers()).get("user-agent")?.toLowerCase() ?? "";
  return CRAWLER_USER_AGENTS.some((bot) => ua.includes(bot));
}

interface SaveCardItem {
  title: string;
  description: string | null;
  cachedImageUrl: string | null;
  url: string;
  partnerName: string;
}

async function getItem(shortId: string): Promise<SaveCardItem | null> {
  const base = process.env["API_INTERNAL_URL"] ?? "http://localhost:3001";
  const res = await fetch(`${base}/api/saves/${shortId}`, { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch item: ${res.status}`);
  return res.json() as Promise<SaveCardItem>;
}

// Deliberately separate from getItem above (which is cached via
// revalidate:60 and also served to link-preview crawlers) — this must run
// on every real visit, uncached, and never for a crawler. Best-effort: a
// failed click record must never stop the redirect back to the partner's
// page, so errors are swallowed rather than thrown.
async function recordClick(shortId: string): Promise<void> {
  const base = process.env["API_INTERNAL_URL"] ?? "http://localhost:3001";
  try {
    await fetch(`${base}/api/saves/${shortId}/click`, { method: "POST", cache: "no-store" });
  } catch {
    // Analytics is non-critical — the redirect must proceed either way.
  }
}

export async function generateMetadata({ params }: SaveCardPageProps) {
  const { shortId } = await params;
  const item = await getItem(shortId);
  if (!item) return { title: "Not found" };
  return {
    title: item.title,
    description: item.description ?? `Saved from ${item.partnerName}`,
    openGraph: {
      title: item.title,
      description: item.description ?? `Saved from ${item.partnerName}`,
      images: item.cachedImageUrl ? [{ url: item.cachedImageUrl, width: 1200, height: 630 }] : [],
      type: "article",
    },
  };
}

export default async function SaveCardPage({ params }: SaveCardPageProps) {
  const { shortId } = await params;
  const item = await getItem(shortId);
  if (!item) redirect("/");

  if (!(await isCrawlerRequest())) {
    await recordClick(shortId);
    redirect(item.url);
  }

  return (
    <main style={{ textAlign: "center", padding: 40 }}>
      <p>Redirecting to {item.partnerName}…</p>
      <a href={item.url}>Continue to {item.title}</a>
    </main>
  );
}
