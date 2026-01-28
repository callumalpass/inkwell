import { useState, useEffect, useCallback, type RefObject } from "react";
import { getColumnsForWidth } from "./utils";

export interface UseKeyboardNavigationOptions {
  /** Total number of items in the grid. */
  itemCount: number;
  /** Reference to the grid element for calculating columns. */
  gridRef: RefObject<HTMLDivElement | null>;
  /** Whether keyboard navigation is disabled (e.g., dialog is open). */
  disabled: boolean;
  /** Callback when Enter is pressed on focused item. */
  onEnter: (index: number) => void;
  /** Callback when Space is pressed on focused item. */
  onSpace: (index: number) => void;
}

export interface UseKeyboardNavigationResult {
  /** Currently focused item index (-1 if none). */
  focusedIndex: number;
  /** Set the focused index directly. */
  setFocusedIndex: (index: number) => void;
  /** Handle container focus to initialize focus. */
  handleContainerFocus: () => void;
  /** Keyboard event handler to attach to container. */
  handleKeyDown: (e: KeyboardEvent) => void;
}

export function useKeyboardNavigation({
  itemCount,
  gridRef,
  disabled,
  onEnter,
  onSpace,
}: UseKeyboardNavigationOptions): UseKeyboardNavigationResult {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Reset focus when item count changes
  useEffect(() => {
    if (focusedIndex >= itemCount) {
      setFocusedIndex(itemCount > 0 ? itemCount - 1 : -1);
    }
  }, [itemCount, focusedIndex]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex < 0) return;
    const gridEl = gridRef.current;
    if (!gridEl) return;
    const focusedEl = gridEl.children[focusedIndex] as HTMLElement | undefined;
    focusedEl?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [focusedIndex, gridRef]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        return;
      }

      const gridEl = gridRef.current;
      if (!gridEl || itemCount === 0) return;

      const columns = getColumnsForWidth(gridEl.clientWidth);

      switch (e.key) {
        case "ArrowRight": {
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, itemCount - 1));
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + columns, itemCount - 1));
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - columns, 0));
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < itemCount) {
            onEnter(focusedIndex);
          }
          break;
        }
        case " ": {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < itemCount) {
            onSpace(focusedIndex);
          }
          break;
        }
        case "Home": {
          e.preventDefault();
          setFocusedIndex(0);
          break;
        }
        case "End": {
          e.preventDefault();
          setFocusedIndex(itemCount - 1);
          break;
        }
      }
    },
    [disabled, gridRef, itemCount, focusedIndex, onEnter, onSpace],
  );

  const handleContainerFocus = useCallback(() => {
    if (focusedIndex < 0 && itemCount > 0) {
      setFocusedIndex(0);
    }
  }, [focusedIndex, itemCount]);

  return {
    focusedIndex,
    setFocusedIndex,
    handleContainerFocus,
    handleKeyDown,
  };
}
