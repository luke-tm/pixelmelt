import { useEffect, useRef } from 'react';

/**
 * Fires `onLoadMore` when the user scrolls near the bottom of the page.
 *
 * BUG: the effect has no dependency array, so it runs after *every* render.
 * Each run registers a brand-new scroll listener without removing the old one.
 * After a handful of renders (e.g. during photo upload + processing state
 * changes) there are multiple listeners active simultaneously, and each one
 * calls onLoadMore independently – producing duplicate pages on every scroll.
 */
export function useInfiniteScroll(onLoadMore, hasMore) {
  const callbackRef = useRef(onLoadMore);
  callbackRef.current = onLoadMore;

  // Missing dependency array → runs on every render, stacking up listeners.
  useEffect(() => {
    const handleScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;

      if (nearBottom && hasMore) {
        callbackRef.current();
      }
    };

    window.addEventListener('scroll', handleScroll);
    // Missing cleanup → old listeners are never removed.
  });
}
