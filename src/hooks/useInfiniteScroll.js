import { useEffect, useRef } from 'react';

/**
 * Fires `onLoadMore` once when the user scrolls near the bottom of the page.
 * A single listener is registered on mount and cleaned up on unmount.
 * `hasMore` is read through a ref so the handler always sees the latest value
 * without needing to re-register the listener when it changes.
 */
export function useInfiniteScroll(onLoadMore, hasMore) {
  const callbackRef = useRef(onLoadMore);
  callbackRef.current = onLoadMore;

  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  useEffect(() => {
    const handleScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;

      if (nearBottom && hasMoreRef.current) {
        callbackRef.current();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []); // Empty array: register once on mount, clean up on unmount.
}
