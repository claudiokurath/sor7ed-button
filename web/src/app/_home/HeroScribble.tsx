"use client";

import { useEffect, useRef, useState } from "react";

/** The supplied yellow moving mark, with a still image for reduced motion/autoplay limits. */
export default function HeroScribble() {
  const [motion, setMotion] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(!preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (motion && !playbackFailed) {
      void videoRef.current?.play().catch(() => setPlaybackFailed(true));
    }
  }, [motion, playbackFailed]);

  return (
    <div className="s7-hero-scribble" aria-hidden="true">
      {motion && !playbackFailed ? (
        <video ref={videoRef} autoPlay muted loop playsInline preload="metadata"
          poster="/media/scribble-yellow-loop-poster.jpg" tabIndex={-1} onError={() => setPlaybackFailed(true)}>
          <source src="/media/scribble-yellow-loop.mp4" type="video/mp4" />
        </video>
      ) : <img src="/media/scribble-yellow-loop-poster.jpg" alt="" width={160} height={160} />}
    </div>
  );
}
