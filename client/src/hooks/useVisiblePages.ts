import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useVisiblePages(pageIds: string[], root?: Element | null) {
  const [visiblePageIds, setVisiblePageIds] = useState<Set<string>>(new Set());
  const elementMapRef = useRef<Map<string, Element>>(new Map());
  const refCallbackMapRef = useRef<Map<string, (el: HTMLElement | null) => void>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observerRoot = useMemo(() => root ?? null, [root]);

  const createObserver = useCallback(() => {
    return new IntersectionObserver(
      (entries) => {
        setVisiblePageIds((prev) => {
          let changed = false;
          const next = new Set(prev);
          for (const entry of entries) {
            const pageId = (entry.target as HTMLElement).dataset.pageId;
            if (!pageId) continue;
            if (entry.isIntersecting) {
              if (!prev.has(pageId)) { next.add(pageId); changed = true; }
            } else {
              if (prev.has(pageId)) { next.delete(pageId); changed = true; }
            }
          }
          return changed ? next : prev;
        });
      },
      { root: observerRoot, rootMargin: "200px" },
    );
  }, [observerRoot]);

  // Lazily get-or-create the observer (used by ref callbacks that may fire
  // before the effect).
  const getObserver = useCallback(() => {
    if (!observerRef.current) {
      observerRef.current = createObserver();
    }
    return observerRef.current;
  }, [createObserver]);

  // Effect ensures the observer survives React StrictMode's effect
  // cleanup/remount cycle: if the cleanup disconnected the previous observer
  // we create a fresh one and re-observe every tracked element.
  useEffect(() => {
    const existing = observerRef.current;
    if (existing) {
      if (existing.root === observerRoot) return;
      existing.disconnect();
      observerRef.current = null;
    }

    const obs = createObserver();
    observerRef.current = obs;
    for (const [, el] of elementMapRef.current) {
      obs.observe(el);
    }
    return () => {
      obs.disconnect();
      if (observerRef.current === obs) {
        observerRef.current = null;
      }
    };
  }, [createObserver, observerRoot]);

  const observeRef = useCallback((pageId: string) => {
    let cb = refCallbackMapRef.current.get(pageId);
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        const observer = getObserver();

        const prev = elementMapRef.current.get(pageId);
        if (prev) observer.unobserve(prev);

        if (el) {
          el.dataset.pageId = pageId;
          observer.observe(el);
          elementMapRef.current.set(pageId, el);
        } else {
          elementMapRef.current.delete(pageId);
        }
      };
      refCallbackMapRef.current.set(pageId, cb);
    }
    return cb;
  }, [getObserver]);

  return { visiblePageIds, observeRef };
}
