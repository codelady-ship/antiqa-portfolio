"use client";

import { useEffect, type ReactNode } from "react";

const NOINDEX = 'meta[name="robots"][content="noindex"]';
const NOT_FOUND = "[data-not-found]";
// a 404 view on screen; a page left by client-side navigation stays in the DOM, hidden (display: none)
const onNotFound = () => [...document.querySelectorAll(NOT_FOUND)].some((el) => el.getClientRects().length > 0);

/**
 * #85: removes the `<meta name="robots" content="noindex">` that Next.js streamed with a 404 once the
 * browser has left the 404 by client-side navigation. Renders only its children (the page), so it adds no
 * HTML and does not shift React's generated ids (a sibling element would).
 *
 * The in-locale 404 throws notFound() inside <Suspense> (#82), so besides the noindex React renders for the
 * 404, Next writes one more into the HTML stream itself (getServerInsertedHTML), outside React. Unless React
 * happens to adopt that tag during hydration (timing-dependent), React never removes it, and after leaving
 * the 404 it stays on every page. Before #82 the 404 was a recovery shell that React rendered from scratch,
 * which cleared <head>.
 *
 * Only a page loaded as a 404 can carry that tag, so nothing is watched on other pages. Every navigation
 * changes <head>; when no 404 view is on screen, React has already removed every noindex it renders (they
 * only exist on a 404; admin uses "noindex, nofollow"), so a "noindex" still there is the stale streamed one.
 * Lives in the layout, not the 404 view: a click before the 404 view hydrates navigates away without
 * ever running the 404 view's effects.
 */
export function DropStaleNoindex({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!document.querySelector(NOT_FOUND) && !document.querySelector(NOINDEX)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      // after the navigation's commit has settled
      timer = setTimeout(() => {
        if (onNotFound()) return; // still (or again) on a 404: its noindex stays
        for (const meta of document.querySelectorAll(NOINDEX)) meta.remove();
        observer.disconnect();
      });
    });
    // subtree: a navigation may only change the <title> text
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);
  return children;
}
