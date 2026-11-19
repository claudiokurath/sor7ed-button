"use client";
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Shell from '../_consumer/Shell';
import { request, ApiError } from '../_consumer/api';

function Resource() {
  const params = useSearchParams();
  const slug = params.get('slug') ?? '';
  const context = params.get('context') ?? '';
  const [resource, setResource] = useState<{ title: string; openUrl: string; embedded: boolean } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setResource(null); setError('');
    if (!/^[a-z0-9-]{1,100}$/.test(slug) || !['tool', 'article'].includes(context)) { setError('This resource link is incomplete.'); return; }
    const query = new URLSearchParams({ slug, context });
    void request<{ title: string; openUrl: string; embedded: boolean }>(`/api/planet-sorted/resource?${query}`).then(value => { if (!cancelled) setResource(value); }).catch((failure: unknown) => {
      if (cancelled) return;
      if (failure instanceof ApiError && failure.status === 401) {
        location.replace(`/signin?next=${encodeURIComponent(`/resource?${query}`)}`); return;
      }
      setError('This resource is unavailable. It may no longer be published.');
    });
    return () => { cancelled = true; };
  }, [slug, context]);
  return <Shell><h1>{resource?.title ?? 'Your requested resource'}</h1>{error ? <p role="alert">{error}</p> : !resource ? <p>Checking your Button account…</p> : resource.embedded ? <iframe src={resource.openUrl} title={resource.title} allow="fullscreen" referrerPolicy="no-referrer" style={{ width: '100%', minHeight: '80vh', border: 0 }} /> : <a href={resource.openUrl}>Open your resource</a>}</Shell>;
}
export default function ResourcePage() { return <Suspense fallback={<p>Loading your resource…</p>}><Resource /></Suspense>; }
