import '@testing-library/jest-dom/vitest';

/**
 * jsdom has no IntersectionObserver, and Framer Motion's `useInView` and
 * `whileInView` both reach for it the moment a component mounts. Without
 * this every animated tile and panel throws on render.
 *
 * The stub reports the element as visible straight away, which is what
 * the browser does for the panels these tests render — they are all in
 * the viewport. It deliberately does not claim to `implement` the DOM
 * interface: that would tie the file to whichever optional members the
 * current lib.dom happens to declare, and the observer is only ever
 * reached through the constructor and `observe`.
 */
class ImmediateIntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element): void {
    this.callback(
      [{ isIntersecting: true, target, intersectionRatio: 1 } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }

  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

if (!('IntersectionObserver' in globalThis)) {
  globalThis.IntersectionObserver =
    ImmediateIntersectionObserver as unknown as typeof IntersectionObserver;
}
