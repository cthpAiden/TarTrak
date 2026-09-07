import L from "leaflet";

/**
 * Leaflet positions every marker with translate3d(). Chromium turns each element with a 3D transform
 * into a compositor layer of its own, about 20 KB per marker on top of the 14 KB the element itself
 * costs: a map with three thousand loot spots spent 100 MB on that alone. A 2D translate() lands on the
 * same integer pixel and animates the same way (zoom animations are CSS transitions on transform),
 * while every marker shares the marker pane's layer. Panes and overlays keep Leaflet's 3D transforms,
 * so panning stays composited.
 */
interface MarkerInternals {
  _icon?: HTMLElement & { _leaflet_pos?: L.Point };
  _shadow?: HTMLElement & { _leaflet_pos?: L.Point };
  _zIndex: number;
  options: L.MarkerOptions;
  _resetZIndex(): void;
}

let installed = false;

/** Patches the prototype, so existing markers pick it up on their next move; a second call is a no-op. */
export function installFlatMarkers(): void {
  if (installed) return;
  installed = true;
  L.Marker.include({
    _setPos(this: MarkerInternals, pos: L.Point) {
      for (const el of [this._icon, this._shadow]) {
        if (!el) continue;
        el.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        // What L.DomUtil.getPosition reads; Leaflet's own code relies on it.
        el._leaflet_pos = pos;
      }
      this._zIndex = pos.y + (this.options.zIndexOffset ?? 0);
      this._resetZIndex();
    },
  });
}
