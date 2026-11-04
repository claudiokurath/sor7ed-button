"use client";
import { useState } from 'react';
import { openWhatsAppWindow } from '../../lib/whatsapp-window';

export function WhatsAppWindowLink({ url, className }: { url: string; className?: string | undefined }) {
  const [error, setError] = useState('');
  function open() {
    setError('');
    try {
      if (!openWhatsAppWindow(window, url)) {
        setError('Your browser blocked the WhatsApp window. Allow pop-ups for sor7ed.com, then try again.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open WhatsApp. Please try again.'); }
  }
  return <>
    <button type="button" className={className} onClick={open}>Open WhatsApp in another window</button>
    {error ? <p role="alert">{error}</p> : null}
  </>;
}
