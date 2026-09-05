/**
 * Leaflet only listens to the window's resize event. The map section also changes size when the
 * sidebar or the top bar comes and goes (overlay mode), and without invalidateSize() Leaflet keeps
 * the old size: its vector layers are then clipped at the old right and bottom edges, which showed
 * as heading lines and view cones cut off by an invisible box.
 */
export function watchSize(el: Element, onResize: () => void): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  let first = true;
  const ro = new ResizeObserver(() => {
    // The observer fires once on observe(); the map was just built at that size, nothing to fix.
    if (first) {
      first = false;
      return;
    }
    onResize();
  });
  ro.observe(el);
  return () => ro.disconnect();
}
