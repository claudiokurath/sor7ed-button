"use client";

import { useRef } from "react";

// Public campaign reflections, independent of the Notion-published tool catalogue.
const quizzes = [
  { name: "Hidden Strength", href: "https://www.planetsorted.com/hidden-strength", headline: "You have a secret", accent: "weapon.", intro: "What are you great at but never count?", detail: "Five short challenges. A reflection, not a diagnosis.", featured: true },
  { name: "Brain Type", href: "https://www.planetsorted.com/brain-type", headline: "Your brain has a type.", accent: "Meet it.", intro: "Explore how you work, start and recover.", detail: "12 questions · About 2 minutes.", featured: false },
  { name: "Self-Perception Gap", href: "https://www.planetsorted.com/self-perception-gap", headline: "You see you. They see you.", accent: "Mind the gap.", intro: "How well do your predictions match what happens?", detail: "Three tasks · Two rounds. Not a diagnosis.", featured: false },
];

export default function FeaturedQuizzes() {
  const track = useRef<HTMLDivElement>(null);
  function move(direction: number) {
    const item = track.current?.firstElementChild;
    if (!item || !track.current) return;
    track.current.scrollBy({ left: direction * (item.getBoundingClientRect().width + 24), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  return (
    <section className="s7-wrap s7-quiz-section" aria-labelledby="featured-quizzes-heading">
      <p className="s7-eyebrow">A little curiosity. No pressure.</p>
      <div className="s7-quiz-heading">
        <h2 className="s7-h2" id="featured-quizzes-heading">Find your starting point.</h2>
        <div className="s7-quiz-controls" aria-label="Browse quizzes">
          <button type="button" onClick={() => move(-1)} aria-label="Previous quiz" aria-controls="featured-quiz-previews">←</button>
          <button type="button" onClick={() => move(1)} aria-label="Next quiz" aria-controls="featured-quiz-previews">→</button>
        </div>
      </div>
      <div id="featured-quiz-previews" className="s7-quiz-track" ref={track} role="region" aria-label="Quiz previews" tabIndex={0}>
        {quizzes.map(quiz => <a key={quiz.href} className="s7-quiz-card" href={quiz.href}>
          <span className="s7-quiz-question" aria-hidden="true">?</span>
          <div className="s7-quiz-caption">
          <span className="s7-eyebrow">{quiz.name}{quiz.featured ? ' · Featured quiz' : ''}</span>
          <h3>{quiz.headline}<em>{quiz.accent}</em></h3>
          <p>{quiz.intro}</p>
          <span className="s7-quiz-detail">{quiz.detail}</span>
          <span className="s7-quiz-action">Try this reflection <span aria-hidden="true">↗</span></span>
          </div>
        </a>)}
      </div>
      <p className="s7-quiz-detail">Reflections to explore, not diagnostic tests. Go at your own pace.</p>
      <a className="s7-demo-link" href="https://www.planetsorted.com/quizzes-and-tools">All quizzes and tools <span aria-hidden="true">↗</span></a>
    </section>
  );
}
