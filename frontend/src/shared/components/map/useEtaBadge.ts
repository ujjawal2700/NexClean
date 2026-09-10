/**
 * The dark "ETA · 12 min" pill that rides above the agent's marker.
 *
 * Built as a Maps `OverlayView` rather than a marker label because the pill has
 * to be real DOM: it carries two type sizes, a tail, and a shadow, none of
 * which a label or a baked SVG icon can render without going to fixed text
 * metrics. The class is created lazily inside a factory — `OverlayView` only
 * exists once the API has loaded, so a module-level `class extends` would throw
 * on import.
 */

type BadgeHandle = {
  setPosition: (pos: { lat: number; lng: number } | null) => void;
  setText: (title: string, subtitle: string) => void;
  destroy: () => void;
};

export function createEtaBadge(map: any, google: any): BadgeHandle {
  class EtaOverlay extends google.maps.OverlayView {
    position: any = null;
    el: HTMLDivElement | null = null;
    titleEl: HTMLSpanElement | null = null;
    subtitleEl: HTMLSpanElement | null = null;

    onAdd() {
      const el = document.createElement("div");
      el.style.cssText = [
        "position:absolute",
        "transform:translate(-50%,-100%)",
        "pointer-events:none",
        "white-space:nowrap",
        "z-index:5",
      ].join(";");

      const pill = document.createElement("div");
      pill.style.cssText = [
        "display:flex",
        "align-items:baseline",
        "gap:6px",
        "background:#1a1f36",
        "color:#ffffff",
        "padding:7px 12px",
        "border-radius:10px",
        "font-family:'Satoshi',ui-sans-serif,system-ui,sans-serif",
        "box-shadow:0 10px 24px -10px rgba(26,31,54,0.7)",
      ].join(";");

      const title = document.createElement("span");
      title.style.cssText = "font-size:11px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.66";
      const subtitle = document.createElement("span");
      subtitle.style.cssText = "font-size:14px;font-weight:700;letter-spacing:0.01em";

      pill.append(title, subtitle);

      // The little downward tail that ties the pill to the marker beneath it.
      const tail = document.createElement("div");
      tail.style.cssText = [
        "width:0",
        "height:0",
        "margin:0 auto",
        "border-left:6px solid transparent",
        "border-right:6px solid transparent",
        "border-top:6px solid #1a1f36",
      ].join(";");

      el.append(pill, tail);
      this.el = el;
      this.titleEl = title;
      this.subtitleEl = subtitle;
      this.getPanes().floatPane.appendChild(el);
    }

    draw() {
      if (!this.el) return;
      if (!this.position) {
        this.el.style.display = "none";
        return;
      }
      const point = this.getProjection()?.fromLatLngToDivPixel(this.position);
      if (!point) return;
      this.el.style.display = "block";
      this.el.style.left = `${point.x}px`;
      // Lifted clear of the 56px marker so the tail lands on its top edge.
      this.el.style.top = `${point.y - 34}px`;
    }

    onRemove() {
      this.el?.parentNode?.removeChild(this.el);
      this.el = null;
    }
  }

  const overlay = new EtaOverlay();
  overlay.setMap(map);

  return {
    setPosition(pos) {
      overlay.position = pos ? new google.maps.LatLng(pos.lat, pos.lng) : null;
      overlay.draw();
    },
    setText(title, subtitle) {
      if (overlay.titleEl) overlay.titleEl.textContent = title;
      if (overlay.subtitleEl) overlay.subtitleEl.textContent = subtitle;
    },
    destroy() {
      overlay.setMap(null);
    },
  };
}
