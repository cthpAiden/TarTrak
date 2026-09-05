import L from "leaflet";
import type { Pin } from "../state/app.svelte";

/** Private markers: my own colour on the map, so they read as mine at a glance. */
export const PRIVATE_PIN_COLOR = "#f0b429";

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** 8 random characters; two clients in a room picking the same one is not a realistic collision. */
export function newPinId(rand: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += ID_ALPHABET[Math.min(ID_ALPHABET.length - 1, Math.floor(rand() * ID_ALPHABET.length))];
  return out;
}

/** Teardrop map pin in the pin's colour; a shared pin gets a white dot, a private one a hollow ring. */
export function pinIcon(pin: Pin): L.DivIcon {
  const dot = pin.shared
    ? `<circle cx="12" cy="11" r="4" fill="#fff"/>`
    : `<circle cx="12" cy="11" r="4" fill="none" stroke="#fff" stroke-width="2"/>`;
  return L.divIcon({
    className: `pin-icon${pin.shared ? " shared" : ""}`,
    html: `<svg viewBox="0 0 24 32" width="24" height="32" aria-hidden="true"><path d="M12 31C12 31 2 19 2 11a10 10 0 0 1 20 0c0 8-10 20-10 20z" fill="${pin.color}" stroke="#000" stroke-width="1.5"/>${dot}</svg>`,
    iconSize: [24, 32],
    iconAnchor: [12, 31],
    popupAnchor: [0, -30],
    tooltipAnchor: [0, -30],
  });
}

/** Popup body built from DOM nodes (no HTML strings: the label is user text) with a Remove button. */
export function pinPopup(pin: Pin, placedBy: string | null, onRemove: () => void): HTMLElement {
  const el = document.createElement("div");
  el.className = "pin-popup";
  const title = document.createElement("b");
  title.textContent = pin.label || "Marker";
  const sub = document.createElement("small");
  sub.textContent = pin.shared ? (placedBy ? `Shared · placed by ${placedBy}` : "Shared with the squad") : "Only you can see this";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Remove";
  btn.onclick = onRemove;
  el.append(title, document.createElement("br"), sub, document.createElement("br"), btn);
  return el;
}
