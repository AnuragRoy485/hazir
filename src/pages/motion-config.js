/* Hazir landing motion config: every timing, distance and easing used by the
   scroll animations lives here. Tune the whole page from this one object. */
export const MOTION = {
  // Lenis smooth scroll (desktop pointers only; mobile keeps native touch).
  lenis: { lerp: 0.09 },
  // One easing family everywhere.
  ease: { main: 'expo.out', alt: 'power3.out' },
  // Scrubbed animations glide behind the scroll position (0.6-1 range).
  scrub: 0.8,
  // Pinned scroll length per section, in viewport heights of extra scroll.
  // Total stays under 3 viewports: 0.3 + 0.95 + 0.4 + 0.95 + 0.3 = 2.9.
  pins: { hero: 0.3, problem: 0.95, how: 0.4, occasions: 0.95, cta: 0.3 },
  // Effect 1: sentences load word by word (opacity floor + light blur, max 4px).
  wordFill: { fromOpacity: 0.15, accentFromOpacity: 0.45, blurDesktop: 3, blurMobile: 2, stagger: 0.06 },
  // Effect 2: section headings, masked lines, italic words land last.
  headings: { duration: 0.9, stagger: 0.08, emDelay: 0.12, emLift: 14 },
  // Effect 3: elements move in from the sides.
  slides: { x: 120, xTablet: 80, xMobile: 40, duration: 0.9, stagger: 0.08 },
  // Occasions marquee: base drift, scroll-velocity boost, skew while fast.
  marquee: { base: 26, velocityBoost: 1.1, skewMax: 5, smooth: 0.08 },
  // Final CTA: outline word drifts horizontally (percent of its width; small
  // enough that the full word always fits) while each letter fills to black.
  ghost: { fromX: -8, toX: 8, fillDuration: 0.55, fillStagger: 0.09 },
  // Existing stat counters (hero dots + problem figures), retimed here.
  counters: { duration: 1400 },
  // Layout rules: pins only on wide screens, shorter distances on phones.
  breakpoints: { pinMin: 900, mobile: 768 },
  // Where nav anchors land inside pinned sections (fraction of the pin).
  anchors: { how: 0.45, occasions: 0.15, default: 0.3 },
};
