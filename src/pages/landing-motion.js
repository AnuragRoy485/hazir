/* Landing-page scroll motion: Lenis + GSAP (ScrollTrigger + SplitText), all
   timings and distances from ./motion-config.js (MOTION).
   html.fx is added only when GSAP loaded and the user has not asked for
   reduced motion; every hidden initial state in site.css is gated behind
   html.fx, so no-JS, missing-library and reduced-motion readers always see
   the full content immediately. Only transform, opacity and a light blur
   filter (<= 4px) are ever animated. */
import { MOTION } from './motion-config.js?v=20261101-5';

(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !window.gsap || !window.ScrollTrigger || !window.SplitText) return;
  gsap.registerPlugin(ScrollTrigger, SplitText);
  document.documentElement.classList.add('fx');

  const PIN_MIN = '(min-width: ' + MOTION.breakpoints.pinMin + 'px)';
  const MOBILE = '(max-width: ' + (MOTION.breakpoints.mobile - 1) + 'px)';
  const blurPx = () => (matchMedia(MOBILE).matches ? MOTION.wordFill.blurMobile : MOTION.wordFill.blurDesktop) + 'px';
  const sideX = () => matchMedia(MOBILE).matches ? MOTION.slides.xMobile : (matchMedia(PIN_MIN).matches ? MOTION.slides.x : MOTION.slides.xTablet);

  // Lenis on desktop pointers only, synced with ScrollTrigger; gsap.ticker
  // drives lenis.raf. Mobile keeps native touch scrolling.
  let lenis = null;
  if (window.Lenis && matchMedia(PIN_MIN).matches && matchMedia('(pointer: fine)').matches) {
    lenis = new Lenis({ lerp: MOTION.lenis.lerp });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const splits = [];
  const splitWords = el => { const s = SplitText.create(el, { type: 'words', wordsClass: 'wf-w' }); splits.push(s); return s; };
  const splitLines = el => { const s = SplitText.create(el, { type: 'lines', linesClass: 'kl-line', mask: 'lines' }); splits.push(s); return s; };

  // ---------- Effect 1: sentences load word by word, scrubbed ----------
  // Only transform, opacity and the light blur filter are ever animated.
  // The palette is strictly monochrome, so the "accent" on the three question
  // phrases is the site's existing emphasis style (italic <em>) plus a higher
  // opacity floor while filling: they read stronger from the first word and
  // land on the same solid black as everything else. No colour is introduced.
  const fillWordsInto = (el, tl, pos = 0) => {
    const split = splitWords(el);
    gsap.set(split.words, { opacity: MOTION.wordFill.fromOpacity, filter: 'blur(' + blurPx() + ')' });
    const accent = [...el.querySelectorAll('.q')].flatMap(q => [...q.querySelectorAll('.wf-w')]);
    if (accent.length) gsap.set(accent, { opacity: MOTION.wordFill.accentFromOpacity });
    tl.to(split.words, { opacity: 1, filter: 'blur(0px)', ease: 'none', stagger: MOTION.wordFill.stagger }, pos);
    return split;
  };
  // No pinning: the sentence fills as it crosses the middle of the screen.
  const fillOnPass = (sel, start = 'top 58%', end = 'bottom 42%') => {
    $$(sel).forEach(el => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start, end, scrub: MOTION.scrub } });
      fillWordsInto(el, tl);
    });
  };

  // "The problem": pin briefly (about 1 viewport) while the sentence fills;
  // the stat counters below count up naturally as they enter after the pin.
  const problemPin = () => {
    const el = $('.pinhead h2'); if (!el) return;
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '.pinhead', start: 'top top', end: '+=' + MOTION.pins.problem * 100 + '%',
        pin: true, scrub: MOTION.scrub, anticipatePin: 1,
      },
    });
    fillWordsInto(el, tl);
  };

  // ---------- Effect 2: masked-line headings, italic words land last ----------
  const headingIn = (h, tl, pos = 0) => {
    const split = splitLines(h);
    const ems = [...h.querySelectorAll('em')];
    tl.fromTo(split.lines, { yPercent: 114 }, {
      yPercent: 0, duration: MOTION.headings.duration, ease: MOTION.ease.main, stagger: MOTION.headings.stagger,
    }, pos);
    if (ems.length) {
      tl.set(ems, { y: MOTION.headings.emLift, opacity: 0 }, pos);
      tl.to(ems, {
        y: 0, opacity: 1, duration: MOTION.headings.duration * 0.7, ease: MOTION.ease.main, stagger: 0.06,
      }, pos + (split.lines.length - 1) * MOTION.headings.stagger + MOTION.headings.emDelay);
    }
    return split;
  };
  const headings = includeSceneH2s => {
    $$('h2.kl').forEach(h => {
      if (h.closest('.pinhead')) return; // word-fill owns this one
      if (!includeSceneH2s && (h.closest('.cta-end') || h.closest('.occ'))) return; // owned by their pinned scenes on desktop
      const tl = gsap.timeline({ scrollTrigger: { trigger: h, start: 'top 86%', toggleActions: 'play none none reverse' } });
      headingIn(h, tl);
    });
  };

  // ---------- Effect 3: moving sideways ----------
  // Occasions marquee: two rows in opposite directions, speed follows scroll
  // velocity, direction reverses on scroll up, slight skew while fast.
  const marquee = () => {
    const tracks = $$('.ticker .track');
    if (tracks.length < 2) return;
    const rows = tracks.map((track, r) => {
      const spans = [...track.children];
      const half = spans.length > 1 ? spans[spans.length / 2].offsetLeft - spans[0].offsetLeft : track.scrollWidth / 2;
      return { track, half: half || 1, x: 0, dir: r === 0 ? -1 : 1 };
    });
    let vel = 0, boost = 0;
    ScrollTrigger.create({
      trigger: document.body, start: 0, end: 'max',
      onUpdate: self => { vel = self.getVelocity() * self.direction; },
    });
    gsap.ticker.add((t, dtMs) => {
      const dt = Math.min(50, dtMs) / 1000;
      boost += (vel - boost) * MOTION.marquee.smooth;
      vel -= vel * Math.min(1, dt * 6);
      const skew = gsap.utils.clamp(-MOTION.marquee.skewMax, MOTION.marquee.skewMax, boost / 240);
      rows.forEach(row => {
        const speed = row.dir * (MOTION.marquee.base + boost * MOTION.marquee.velocityBoost);
        row.x = gsap.utils.wrap(-row.half, 0, row.x + speed * dt);
        row.track.style.transform = 'translate3d(' + row.x.toFixed(2) + 'px,0,0) skewX(' + skew.toFixed(2) + 'deg)';
      });
    });
  };

  // Cards/elements slide in from their side of the screen.
  const slideIn = (el, fromLeft, delay = 0, scrub = false) => {
    const vars = {
      x: 0, opacity: 1, ease: scrub ? 'none' : MOTION.ease.main,
      scrollTrigger: scrub
        ? { trigger: el, start: 'top 92%', end: 'top 55%', scrub: MOTION.scrub }
        : { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
    };
    if (!scrub) { vars.duration = MOTION.slides.duration; vars.delay = delay; }
    gsap.fromTo(el, { x: (fromLeft ? -1 : 1) * sideX(), opacity: 0 }, vars);
  };
  // "For hosts": left column from the left, right column from the right.
  const hostSlides = cols => {
    $$('.features .feat').forEach((f, i) => slideIn(f, (i % cols) < cols / 2, (i % cols) * MOTION.slides.stagger));
  };

  // Final CTA: the huge outline word drifts as you scroll past, and each
  // letter progressively fills to black (user-requested effect, Nov 8).
  // The container is aria-hidden, so the letter spans need no SR treatment.
  const ghost = () => {
    const g = $('.cta-ghost'); if (!g) return;
    let letters = Array.from(g.querySelectorAll('.cta-ghost-l'));
    if (!letters.length) {
      const text = g.textContent; g.textContent = '';
      letters = Array.from(text).map(ch => {
        const s = document.createElement('span');
        s.className = 'cta-ghost-l'; s.textContent = ch; g.appendChild(s); return s;
      });
    }
    const st = { trigger: '.cta-end', start: 'top bottom', end: 'bottom top', scrub: MOTION.scrub };
    gsap.fromTo(g, { xPercent: MOTION.ghost.fromX }, { xPercent: MOTION.ghost.toX, ease: 'none', scrollTrigger: st });
    // Fill is measured on the word itself, so it runs while the word travels
    // from the lower edge to mid-viewport and completes while fully in view.
    gsap.to(letters, {
      color: '#000', ease: 'none',
      duration: MOTION.ghost.fillDuration, stagger: MOTION.ghost.fillStagger,
      scrollTrigger: { trigger: g, start: 'top 95%', end: 'top 45%', scrub: MOTION.scrub },
    });
  };

  // ---------- Desktop pinned scenes ----------
  const heroPin = () => {
    const sec = $('.hero'); if (!sec) return;
    const text = $('.hero-text'), plx = sec.querySelector('.plx-wrap');
    const tl = gsap.timeline({
      scrollTrigger: { trigger: sec, start: 'top top', end: '+=' + MOTION.pins.hero * 100 + '%', pin: true, scrub: MOTION.scrub, anticipatePin: 1 },
    });
    tl.to(text, { y: -48, opacity: 0.08, ease: 'none' }, 0);
    if (plx) tl.to(plx, { y: -120, ease: 'none' }, 0);
  };
  // The hero tagline sits above the fold, so its word-fill plays once on load
  // (there is no scroll room above it to scrub through).
  const heroFineFill = () => {
    const el = $('.hero .fine'); if (!el) return;
    const split = splitWords(el);
    gsap.set(split.words, { opacity: MOTION.wordFill.fromOpacity, filter: 'blur(' + blurPx() + ')' });
    gsap.to(split.words, {
      opacity: 1, filter: 'blur(0px)', ease: MOTION.ease.alt, stagger: MOTION.wordFill.stagger, duration: 0.6, delay: 1.1,
    });
  };
  const heroDrift = () => {
    const text = $('.hero-text'); if (!text) return;
    gsap.to(text, {
      y: -30, opacity: 0.1, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: '80% top', scrub: MOTION.scrub },
    });
  };

  const NS = 'http://www.w3.org/2000/svg';
  const howPin = () => {
    const sec = $('.how'); if (!sec) return null;
    const steps = [...sec.querySelectorAll('.step')];
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'how-draw'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(NS, 'path'); path.setAttribute('pathLength', '1'); path.setAttribute('class', 'how-line'); svg.append(path);
    const nodes = steps.map(() => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '5'); c.setAttribute('class', 'how-node'); svg.append(c); return c; });
    sec.append(svg);
    const measure = () => {
      // offsetLeft/offsetTop are layout coordinates: transforms on the steps
      // (their side-slide animation) never pollute the path geometry.
      const pts = steps.map(s => {
        const n = s.querySelector('.n'); if (!n) return null;
        // Walk the offsetParent chain up to the section: transforms on the
        // steps (their side-slide animation) never pollute the path geometry.
        let x = 0, y = 0, el = n;
        while (el && el !== sec) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
        return { x: x + Math.min(18, n.offsetWidth / 2), y: y + n.offsetHeight / 2 };
      }).filter(Boolean);
      if (pts.length < 2) return;
      path.setAttribute('d', 'M ' + pts.map(p => p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' L '));
      nodes.forEach((c, i) => { if (pts[i]) { c.setAttribute('cx', pts[i].x.toFixed(1)); c.setAttribute('cy', pts[i].y.toFixed(1)); } });
    };
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sec, start: 'top top', end: '+=' + MOTION.pins.how * 100 + '%',
        pin: true, scrub: MOTION.scrub, anticipatePin: 1, onRefresh: measure,
      },
    });
    gsap.set(path, { strokeDashoffset: 1 });
    tl.to(path, { strokeDashoffset: 0, ease: 'none', duration: 0.68 }, 0.06);
    nodes.forEach((c, i) => tl.fromTo(c, { opacity: 0 }, { opacity: 1, ease: 'none', duration: 0.05 }, 0.1 + i * 0.17));
    steps.forEach((s, i) => tl.fromTo(s,
      { x: (i % 2 ? 1 : -1) * MOTION.slides.x, opacity: 0 },
      { x: 0, opacity: 1, ease: 'none', duration: 0.16 }, 0.05 + i * 0.18));
    measure();
    return () => svg.remove();
  };

  const occPin = () => {
    const sec = $('.occ'); if (!sec) return null;
    const grid = sec.querySelector('.grid'); if (!grid) return null;
    const rail = document.createElement('div'); rail.className = 'occ-rail';
    const lead = document.createElement('div'); lead.className = 'occ-lead';
    const eyebrow = sec.querySelector('.eyebrow'), h2 = sec.querySelector('h2');
    lead.append(eyebrow, h2); rail.append(lead);
    const tiles = [...grid.children];
    tiles.forEach(t => rail.append(t));
    grid.replaceWith(rail);
    const travel = () => Math.max(0, rail.scrollWidth - sec.clientWidth + 60);
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sec, start: 'top top', end: '+=' + MOTION.pins.occasions * 100 + '%',
        pin: true, scrub: MOTION.scrub, anticipatePin: 1, invalidateOnRefresh: true,
      },
    });
    tl.fromTo(lead, { opacity: 0, y: 24 }, { opacity: 1, y: 0, ease: 'none', duration: 0.14 }, 0);
    tl.fromTo(rail, { x: 0 }, { x: () => -travel(), ease: 'none', duration: 1 }, 0);
    // The heading stays fixed on the left while the cards move sideways beneath it.
    tl.fromTo(lead, { x: 0 }, { x: () => travel(), ease: 'none', duration: 1 }, 0);
    tiles.forEach((t, i) => tl.fromTo(t, { opacity: 0.5, y: 18 }, { opacity: 1, y: 0, ease: 'none', duration: 0.15 }, 0.04 + i * 0.1));
    return () => { sec.insertBefore(eyebrow, rail); sec.insertBefore(h2, rail); tiles.forEach(t => grid.append(t)); rail.replaceWith(grid); };
  };

  const ctaPin = () => {
    const sec = $('.cta-end'); if (!sec) return;
    const h = sec.querySelector('h2.kl');
    const lead = sec.querySelector('.lead'), btns = sec.querySelector('.cta');
    const tl = gsap.timeline({
      scrollTrigger: { trigger: sec, start: 'top top', end: '+=' + MOTION.pins.cta * 100 + '%', pin: true, scrub: MOTION.scrub, anticipatePin: 1 },
    });
    if (h) {
      const split = splitLines(h);
      const ems = [...h.querySelectorAll('em')];
      tl.fromTo(split.lines, { yPercent: 114 }, { yPercent: 0, ease: 'none', stagger: 0.14 }, 0.05);
      if (ems.length) { tl.set(ems, { y: MOTION.headings.emLift, opacity: 0 }, 0.05); tl.to(ems, { y: 0, opacity: 1, ease: 'none' }, 0.6); }
    }
    if (lead) tl.fromTo(lead, { opacity: 0, y: 20 }, { opacity: 1, y: 0, ease: 'none', duration: 0.18 }, 0.5);
    if (btns) tl.fromTo(btns, { opacity: 0, y: 20 }, { opacity: 1, y: 0, ease: 'none', duration: 0.18 }, 0.72);
  };

  // ---------- Nav anchors land correctly inside/after pinned scenes ----------
  const anchors = () => {
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1), t = id && document.getElementById(id);
      if (!t) return;
      e.preventDefault();
      let y;
      if (id === 'top') y = 0;
      else {
        const st = ScrollTrigger.getAll().find(s => s.pin && s.trigger && (s.trigger === t || s.trigger.contains(t)));
        if (st) y = st.start + (st.end - st.start) * (MOTION.anchors[id] ?? MOTION.anchors.default);
        else y = t.getBoundingClientRect().top + scrollY - 84;
      }
      if (lenis) lenis.scrollTo(y, { duration: 1.4 }); else window.scrollTo({ top: y, behavior: 'smooth' });
      history.replaceState(null, '', '#' + id);
    }));
  };

  // ---------- Build everything per breakpoint; rebuild cleanly on resize ----------
  const mm = gsap.matchMedia();
  const build = () => {
    mm.add({ pinDesk: PIN_MIN, small: '(max-width: 899px)' }, ctx => {
      const { pinDesk } = ctx.conditions;
      const cleanups = [];
      // Shared scenes (all screens): word fills, masked headings, marquee,
      // side slides, ghost drift.
      fillOnPass('.why .story p:nth-of-type(1)');
      fillOnPass('.why .story p:nth-of-type(2)');
      fillOnPass('.why .story p:nth-of-type(4)', 'top 60%', 'bottom 45%'); // the "three questions" line
      heroFineFill();
      headings(!pinDesk);
      marquee();
      hostSlides(pinDesk ? 4 : 2);
      if (pinDesk) {
        heroPin(); problemPin();
        const unHow = howPin(), unOcc = occPin();
        if (unHow) cleanups.push(unHow);
        if (unOcc) cleanups.push(unOcc);
        ctaPin();
      } else {
        heroDrift();
        fillOnPass('.pinhead h2', 'top 60%', 'bottom 40%');
        $$('.how .step').forEach((s, i) => slideIn(s, i % 2 === 0));
        $$('.occ .tile').forEach((t, i) => slideIn(t, i % 2 === 0));
      }
      // Ghost last: its scroll range must be measured with all pin-spacers
      // already in place, or the letters fill long before the CTA is reached.
      ghost();
      anchors();
      return () => { cleanups.forEach(fn => fn()); splits.splice(0).forEach(s => s.revert()); };
    });
  };
  build();

  // Re-split on resize (debounced), then refresh ScrollTrigger.
  let rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { mm.revert(); build(); ScrollTrigger.refresh(); }, 300);
  });
})();
