// How each fixed screenshot of the project belt (frontend/public/projects/*.webp) is taken.
// Keys are repo names in lower case, the same as THUMBS in
// frontend/src/components/work/project-conveyor.tsx. A project in THUMBS with no entry here is
// captured with DEFAULTS (the first view of its live demo), so a new one works without this file;
// add an entry only to frame it differently.
//
//   url           the page to capture. Leave it out: the project's live demo link from the portfolio
//                 API is used, so a new demo address is followed by itself.
//   viewport      browser window, CSS px (default 1280×800)
//   reducedMotion true = ask the site for its calm version (prefers-reduced-motion)
//   steps         done in order after the page has loaded:
//                   { click: "css", optional: true }   optional = skip when it is not there
//                   { press: "Escape" } · { wait: 1500 } · { waitFor: "css" }
//   hide          css selectors taken out of the picture (display: none), e.g. a notice bar
//   videoAt       pause every <video> at this second, so a playing hero gives the same frame every day
//   animationsAt  pause every CSS animation at this millisecond of its run, for parts that never stop
//                 moving (floating cards); finished entrance animations stay finished
//   settleMs      wait before the picture is taken (entrance animations)
//   clip          { x, y, width, height } of the viewport to keep; must be 16:10, it is scaled to 960×600
//   expectText    a word the page must show (default: the first word of the project's title);
//                 false = no such check
//   pinned        "why": never captured, the committed picture stays

export const DEFAULTS = {
  viewport: { width: 1280, height: 800 },
  reducedMotion: false,
  steps: [],
  hide: [],
  videoAt: null,
  animationsAt: null,
  settleMs: 4000,
  clip: null,
};

export const LIMITS = {
  // a colour counts as moved when a channel differs by more than this (of 255) on the 240×150 comparison copy
  step: 40,
  // replace the committed picture only when more of it than this has moved
  changeShare: 0.02,
  // … or when this much of one of its 6 × 5 parts has moved: a change in one corner (a redrawn side
  // menu, a new logo) is small in the whole picture. Today's captures: real redesign of a side menu 26%,
  // a looping hero video 8%, the rest under 3%
  changeTile: 0.2,
  // two captures taken in a row must agree this closely, or the page is still moving and nothing is replaced
  stableShare: 0.01,
  stableTile: 0.05,
};

export const PROJECTS = {
  // the hero of the home page once its entrance video has ended: the wordmark and the three animals
  jeparla: {
    settleMs: 9000,
    clip: { x: 420, y: 280, width: 832, height: 520 },
  },
  // the first view without the announcement bar and the side rail: the listing cards, the wordmark, the search.
  // Its cards float all the time: held at one moment of the loop, so every day gives the same picture.
  // Renamed Kirayla → Share (2026-11-22): the page says "share" whatever title the record has
  "share-rental": {
    animationsAt: 2500,
    clip: { x: 96, y: 72, width: 1152, height: 720 },
    expectText: "share",
  },
  // the same project under its old repo name, until that record is hidden (same picture file)
  "kirayla-rental": {
    animationsAt: 2500,
    clip: { x: 96, y: 72, width: 1152, height: 720 },
    expectText: "share",
  },
  // without the "demo mode" note: hidden, not clicked, because the site now often loads it
  // already faded out (opacity 0, inert), where a click is blocked and the run fails
  "food-wagon-delivery-figma": {
    viewport: { width: 1440, height: 900 },
    hide: ['[role="note"]:has(button[aria-label="Hide demo mode note"])'],
    expectText: "foodwagon",
  },
  // the open menu book
  "ember-olive-menu": { viewport: { width: 1440, height: 900 } },
  // its hero is a looping video
  "ecommerse-app": { videoAt: 1, expectText: "hue" },
  // the English page, without the "demo version" bar above it
  "codelady-skills": {
    url: "https://codelady-ship.github.io/codelady-skills/en/",
    hide: ['body > [role="note"]'],
    expectText: "codelady",
  },
  hypedomino: {
    pinned: "a frame of the game's video on its IdeyaNest campaign page (someone else's site; the game has no web demo)",
  },
};
