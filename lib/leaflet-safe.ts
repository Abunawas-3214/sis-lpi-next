import L from "leaflet";

/**
 * Defensive monkey-patch for Leaflet DomUtil methods to prevent
 * "Cannot read properties of undefined (reading '_leaflet_pos')"
 * and "Cannot set properties of undefined (setting '_leaflet_pos')"
 * errors when React unmounts or rapidly re-renders map containers.
 */
if (typeof window !== "undefined" && L && L.DomUtil) {
  const domUtil = L.DomUtil as any;
  if (!domUtil._safeLeafletPosPatched) {
    domUtil._safeLeafletPosPatched = true;

    const originalGetPosition = L.DomUtil.getPosition;
    L.DomUtil.getPosition = function (el: HTMLElement) {
      if (!el) {
        return new L.Point(0, 0);
      }
      try {
        if (originalGetPosition) {
          return originalGetPosition.call(this, el) || new L.Point(0, 0);
        }
        return (el as any)._leaflet_pos || new L.Point(0, 0);
      } catch {
        return (el as any)?._leaflet_pos || new L.Point(0, 0);
      }
    };

    const originalSetPosition = L.DomUtil.setPosition;
    L.DomUtil.setPosition = function (el: HTMLElement, point: L.Point) {
      if (!el) return;
      try {
        if (originalSetPosition) {
          originalSetPosition.call(this, el, point);
        } else {
          (el as any)._leaflet_pos = point;
        }
      } catch {
        if (el) {
          try {
            (el as any)._leaflet_pos = point;
          } catch {}
        }
      }
    };
  }
}

export default L;
