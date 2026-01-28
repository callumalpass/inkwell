import "@testing-library/jest-dom/vitest";

// Mock ResizeObserver which is not available in JSDOM
global.ResizeObserver = class ResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};
