import { useEffect, useRef, useState } from "react";

export function useVisiblePages(pageIds: string[]) {
  const [visiblePageIds, setVisiblePageIds] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementMapRef = useRef<Map<string, Element>>(new Map());

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        setVisiblePageIds((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const pageId = (entry.target as HTMLElement).dataset.pageId;
            if (!pageId) continue;
            if (entry.isIntersecting) {
              next.add(pageId);
            } else {
              next.delete(pageId);
            }
          }
          return next;
        });
      },
      { rootMargin: "200px" },
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const observeRef = (pageId: string) => (el: HTMLElement | null) => {
    const observer = observerRef.current;
    if (!observer) return;

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

  return { visiblePageIds, observeRef };
}
