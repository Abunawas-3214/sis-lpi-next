"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "@/lib/leaflet-safe";
import {
  PenLine,
  Trash2,
  Navigation,
  Maximize2,
  Minimize2,
  RotateCcw,
  Info,
  Move,
  Scissors,
  Hand,
  AlertTriangle,
  Wand2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  InstitutionPolygon,
  ChildPointItem,
  calculateAreaM2,
  toLeafletLatLngs,
  CHILD_CATEGORY_COLORS,
} from "@/lib/geometry";

// ─── Types ───────────────────────────────────────────────────────────────────
type EditorMode = "pan" | "draw" | "move" | "insert" | "delete";

interface SinglePolygonEditorProps {
  initialCenter: [number, number] | null;
  polygon: InstitutionPolygon;
  otherPolygons?: InstitutionPolygon[];
  childPoints?: ChildPointItem[];
  onPolygonChange: (updated: InstitutionPolygon) => void;
  isPickingChildPoint?: boolean;
  onPickChildPoint?: (lat: number, lng: number) => void;
  pickedCoords?: { lat: number; lng: number } | null;
  pickedLabel?: string;
  onPickedCoordsChange?: (lat: number, lng: number) => void;
  onSelectChildPoint?: (point: ChildPointItem) => void;
  selectedChildPointId?: number | string | null;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

const BASEMAP_TILES = {
  streets: {
    name: "Peta Jalan (OSM)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  },
  satellite: {
    name: "Satelit (Esri)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 18,
    attribution: "&copy; Esri World Imagery",
  },
};

// ─── Tool config ─────────────────────────────────────────────────────────────
const TOOLS: { mode: EditorMode; label: string; icon: React.ReactNode; hint: string }[] = [
  {
    mode: "pan",
    label: "Geser Peta",
    icon: <Hand className="w-4 h-4" />,
    hint: "Geser peta tanpa mengedit titik.",
  },
  {
    mode: "draw",
    label: "Tambah Titik",
    icon: <PenLine className="w-4 h-4" />,
    hint: "Klik pada peta untuk menambah titik sudut batas lahan.",
  },
  {
    mode: "move",
    label: "Pindah Titik",
    icon: <Move className="w-4 h-4" />,
    hint: "Klik & tahan titik lalu seret ke posisi baru.",
  },
  {
    mode: "insert",
    label: "Sisipkan Titik",
    icon: <Scissors className="w-4 h-4" />,
    hint: "Klik titik biru di tengah garis untuk menyisipkan titik baru.",
  },
  {
    mode: "delete",
    label: "Hapus Titik",
    icon: <Trash2 className="w-4 h-4" />,
    hint: "Klik pada titik (bulatan putih) untuk menghapusnya.",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
type LatLngTuple = [number, number];

/** Find the closest point on segment A→B to point P, returns {point, t} */
function closestPointOnSegment(
  p: L.LatLng,
  a: LatLngTuple,
  b: LatLngTuple
): { point: L.LatLng; t: number } {
  const [alat, alng] = a, [blat, blng] = b;
  const dx = blng - alng, dy = blat - alat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { point: L.latLng(alat, alng), t: 0 };
  const t = Math.max(0, Math.min(1, ((p.lng - alng) * dx + (p.lat - alat) * dy) / lenSq));
  return { point: L.latLng(alat + t * dy, alng + t * dx), t };
}

/** Distance in pixels between two L.LatLng on a given map */
function pixelDistToTuple(map: L.Map, p: L.LatLng, b: L.LatLng): number {
  const pa = map.latLngToContainerPoint(p);
  const pb = map.latLngToContainerPoint(b);
  return Math.sqrt((pa.x - pb.x) ** 2 + (pa.y - pb.y) ** 2);
}

/** Check if two segments (p1→p2) and (p3→p4) intersect (excluding shared endpoints) */
function segmentsIntersect(
  p1: [number, number], p2: [number, number],
  p3: [number, number], p4: [number, number]
): boolean {
  const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0], d2y = p4[1] - p3[1];
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return false;
  const dx = p3[0] - p1[0], dy = p3[1] - p1[1];
  const t = (dx * d2y - dy * d2x) / cross;
  const u = (dx * d1y - dy * d1x) / cross;
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}

/** Check if a polygon (GeoJSON [lng,lat][]) self-intersects */
function polygonSelfIntersects(coords: [number, number][]): boolean {
  const n = coords.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsIntersect(coords[i], coords[(i + 1) % n], coords[j], coords[(j + 1) % n])) {
        return true;
      }
    }
  }
  return false;
}

/** Returns true if adding a new point at `newPt` (GeoJSON [lng,lat]) would create a self-intersection */
function wouldSelfIntersect(coords: [number, number][], newPt: [number, number]): boolean {
  if (coords.length < 2) return false;
  const pts = [...coords, newPt];
  const n = pts.length;
  const newSeg1: [[number,number],[number,number]] = [pts[n - 2], pts[n - 1]];
  const newSeg2: [[number,number],[number,number]] = [pts[n - 1], pts[0]];

  for (let i = 0; i < n - 2; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    if (i < n - 3 && segmentsIntersect(newSeg1[0], newSeg1[1], a, b)) return true;
    if (i > 0 && i < n - 2 && segmentsIntersect(newSeg2[0], newSeg2[1], a, b)) return true;
  }
  return false;
}

/** Find the best insert position for newPt that avoids self-intersection */
function findBestInsertIndex(coords: [number, number][], newPt: [number, number]): number {
  if (coords.length < 2) return -1;
  let bestIdx = -1;
  let bestDist = Infinity;

  for (let i = 0; i < coords.length; i++) {
    const candidate = [...coords] as [number, number][];
    candidate.splice(i + 1, 0, newPt);
    if (!polygonSelfIntersects(candidate)) {
      const a = coords[i], b = coords[(i + 1) % coords.length];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const dist = (newPt[0] - mx) ** 2 + (newPt[1] - my) ** 2;
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    }
  }
  return bestIdx;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SinglePolygonEditor({
  initialCenter,
  polygon,
  otherPolygons = [],
  childPoints = [],
  onPolygonChange,
  isPickingChildPoint = false,
  onPickChildPoint,
  pickedCoords,
  pickedLabel,
  onPickedCoordsChange,
  onSelectChildPoint,
  selectedChildPointId,
  onToggleSidebar,
  isSidebarOpen = true,
}: SinglePolygonEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const polylineLayerRef = useRef<L.Polyline | null>(null);
  const midpointMarkersRef = useRef<L.CircleMarker[]>([]);
  const vertexMarkersRef = useRef<L.CircleMarker[]>([]);
  const otherLayersRef = useRef<L.LayerGroup | null>(null);
  const childMarkersRef = useRef<L.LayerGroup | null>(null);
  const pickedMarkerRef = useRef<L.Marker | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  // Drag state
  const draggingRef = useRef<{ vertexIdx: number } | null>(null);
  const isDraggingRef = useRef(false);

  const [activeBasemap, setActiveBasemap] = useState<keyof typeof BASEMAP_TILES>("satellite");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mode, setMode] = useState<EditorMode>("draw");
  const [hasSelfIntersect, setHasSelfIntersect] = useState(false);

  // Keep latest values in refs
  const onPolygonChangeRef = useRef(onPolygonChange);
  const onPickChildPointRef = useRef(onPickChildPoint);
  const onPickedCoordsChangeRef = useRef(onPickedCoordsChange);
  const onSelectChildPointRef = useRef(onSelectChildPoint);
  const polygonRef = useRef(polygon);
  const modeRef = useRef(mode);
  const isPickingRef = useRef(isPickingChildPoint);

  useEffect(() => { onPolygonChangeRef.current = onPolygonChange; });
  useEffect(() => { onPickChildPointRef.current = onPickChildPoint; });
  useEffect(() => { onPickedCoordsChangeRef.current = onPickedCoordsChange; });
  useEffect(() => { onSelectChildPointRef.current = onSelectChildPoint; });
  useEffect(() => { polygonRef.current = polygon; });
  useEffect(() => { modeRef.current = mode; });
  useEffect(() => { isPickingRef.current = isPickingChildPoint; });

  // Check self-intersection on polygon change
  useEffect(() => {
    setHasSelfIntersect(polygonSelfIntersects(polygon.coordinates ?? []));
  }, [polygon.coordinates]);

  // Invalidate map size when sidebar opens/closes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.invalidateSize({ animate: false });
        } catch {}
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [isSidebarOpen]);

  // Emit polygon change helper
  const emitChange = useCallback((coords: [number, number][]) => {
    const area = calculateAreaM2(toLeafletLatLngs(coords));
    onPolygonChangeRef.current({
      ...polygonRef.current,
      coordinates: coords,
      area_m2: area,
    });
  }, []);

  // ── Fullscreen ──────────────────────────────────────────────────────────────
  const handleFullscreenToggle = () => {
    const container = mapContainerRef.current?.closest(".single-editor-wrapper") as HTMLElement | null;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.warn);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.warn);
    }
  };
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ── Map cursor: reflect current mode ───────────────────────────────────────
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    const cursors: Record<EditorMode, string> = {
      pan: "grab",
      draw: "crosshair",
      move: "default",
      insert: "cell",
      delete: "not-allowed",
    };
    container.style.cursor = isPickingChildPoint ? "crosshair" : cursors[mode];
  }, [mode, isPickingChildPoint]);

  // ── 1. Init Map (once) ─────────────────────────────────────────────────────
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if (mapInstanceRef.current) {
      try { mapInstanceRef.current.stop(); mapInstanceRef.current.remove(); } catch {}
      mapInstanceRef.current = null;
    }
    if ((container as any)._leaflet_id) delete (container as any)._leaflet_id;

    let center: [number, number] = initialCenter || [-7.95156, 112.60742];
    if (polygon.coordinates?.length > 0) {
      const first = polygon.coordinates[0];
      center = [first[1], first[0]];
    }

    let map: L.Map | null = null;
    try {
      // Note: zoomControl: false disables default top-left control to avoid overlapping top mode bar!
      map = L.map(container, {
        center,
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
      });

      // Move zoom control to bottomright!
      L.control.zoom({ position: "bottomright" }).addTo(map);

      const tileConfig = BASEMAP_TILES[activeBasemap];
      tileLayerRef.current = L.tileLayer(tileConfig.url, {
        maxZoom: tileConfig.maxZoom,
        attribution: tileConfig.attribution,
      }).addTo(map);

      otherLayersRef.current = L.layerGroup().addTo(map);
      childMarkersRef.current = L.layerGroup().addTo(map);

      if (initialCenter && !isNaN(initialCenter[0]) && !isNaN(initialCenter[1])) {
        centerMarkerRef.current = L.marker(initialCenter, {
          icon: L.divIcon({
            className: "custom-center-pin",
            html: `<div style="background-color:#2563eb;width:14px;height:14px;border-radius:50%;border:2.5px solid white;box-shadow:0 0 5px rgba(0,0,0,.4);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          }),
        }).addTo(map);
        centerMarkerRef.current.bindTooltip("Titik Pusat Lembaga (GPS)", { sticky: true });
      }

      mapInstanceRef.current = map;

      const safeInvalidate = () => {
        if (!mapInstanceRef.current) return;
        try {
          const c = mapInstanceRef.current.getContainer();
          if (c && c.offsetParent !== null && (c as any)._leaflet_id) {
            mapInstanceRef.current.invalidateSize({ animate: false });
          }
        } catch {}
      };
      const t1 = setTimeout(safeInvalidate, 80);
      const t2 = setTimeout(safeInvalidate, 350);
      timersRef.current.push(t1, t2);
    } catch (e) {
      console.error("SinglePolygonEditor init error:", e);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!mapInstanceRef.current) return;
      try {
        const c = mapInstanceRef.current.getContainer();
        if (c && c.offsetParent !== null && (c as any)._leaflet_id) {
          mapInstanceRef.current.invalidateSize({ animate: false });
        }
      } catch {}
    });
    resizeObserver.observe(container);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.stop(); mapInstanceRef.current.remove(); } catch {}
        mapInstanceRef.current = null;
      }
      polygonLayerRef.current = null;
      polylineLayerRef.current = null;
      vertexMarkersRef.current = [];
      midpointMarkersRef.current = [];
      otherLayersRef.current = null;
      childMarkersRef.current = null;
      pickedMarkerRef.current = null;
      centerMarkerRef.current = null;
      if (container && (container as any)._leaflet_id) delete (container as any)._leaflet_id;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Basemap Switcher ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (tileLayerRef.current) { try { map.removeLayer(tileLayerRef.current); } catch {} }
    const tileConfig = BASEMAP_TILES[activeBasemap];
    tileLayerRef.current = L.tileLayer(tileConfig.url, {
      maxZoom: tileConfig.maxZoom,
      attribution: tileConfig.attribution,
    }).addTo(map);
  }, [activeBasemap]);

  // ── 3. Other Polygons (ghost reference) ───────────────────────────────────
  useEffect(() => {
    const group = otherLayersRef.current;
    if (!group) return;
    group.clearLayers();
    otherPolygons.forEach((other) => {
      if (other.id === polygon.id) return;
      const latLngs = toLeafletLatLngs(other.coordinates);
      if (latLngs.length >= 3) {
        L.polygon(latLngs, {
          color: "#94a3b8", weight: 1.5, dashArray: "4, 4",
          fillColor: "#94a3b8", fillOpacity: 0.12,
        }).bindTooltip(`<b>${other.name}</b> (Bidang Lain)`, { sticky: true })
          .addTo(group);
      }
    });
  }, [otherPolygons, polygon.id]);

  // ── 4. Render Main Polygon + Vertices + Midpoints + ChildPoints ───────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing polygon/vertices
    if (polygonLayerRef.current) { try { map.removeLayer(polygonLayerRef.current); } catch {} polygonLayerRef.current = null; }
    if (polylineLayerRef.current) { try { map.removeLayer(polylineLayerRef.current); } catch {} polylineLayerRef.current = null; }
    vertexMarkersRef.current.forEach((m) => { try { map.removeLayer(m); } catch {} });
    vertexMarkersRef.current = [];
    midpointMarkersRef.current.forEach((m) => { try { map.removeLayer(m); } catch {} });
    midpointMarkersRef.current = [];

    const coords = polygon.coordinates ?? [];
    const latLngs = toLeafletLatLngs(coords);

    // ── Draw polygon or polyline ─────────────────────────────────────────────
    if (latLngs.length >= 3) {
      const polyLayer = L.polygon(latLngs, {
        color: hasSelfIntersect ? "#dc2626" : "#059669",
        weight: hasSelfIntersect ? 2.5 : 3,
        dashArray: hasSelfIntersect ? "6, 4" : undefined,
        fillColor: hasSelfIntersect ? "#fca5a5" : "#10b981",
        fillOpacity: 0.35,
      }).addTo(map);

      const areaStr = polygon.area_m2 ? `${polygon.area_m2.toLocaleString("id-ID")} m²` : "";
      polyLayer.bindTooltip(
        `<strong>${polygon.name}</strong>${areaStr ? `<br/><span style="color:#047857;font-weight:bold;">Luas: ${areaStr}</span>` : ""}`,
        { sticky: true }
      );

      polyLayer.on("click", (e) => {
        if (isPickingRef.current) {
          L.DomEvent.stopPropagation(e);
          onPickChildPointRef.current?.(e.latlng.lat, e.latlng.lng);
        }
      });

      polygonLayerRef.current = polyLayer;
    } else if (latLngs.length > 0) {
      const polyline = L.polyline(latLngs, {
        color: "#059669", weight: 2.5, dashArray: "5, 5",
      }).addTo(map);
      polylineLayerRef.current = polyline;
    }

    // ── Vertex markers ───────────────────────────────────────────────────────
    latLngs.forEach((pt, vIdx) => {
      const vertex = L.circleMarker(pt, {
        radius: 7,
        color: "#047857", weight: 2.5,
        fillColor: "#ffffff", fillOpacity: 1,
        bubblingMouseEvents: false,
      }).addTo(map);

      const updateVertexTooltip = () => {
        const m = modeRef.current;
        const tip =
          m === "delete"
            ? `<b>Titik #${vIdx + 1}</b><br/><span style="color:#dc2626">Klik untuk hapus</span>`
            : m === "move"
            ? `<b>Titik #${vIdx + 1}</b><br/><span style="color:#2563eb">Seret untuk pindah</span>`
            : `Titik #${vIdx + 1}`;
        vertex.bindTooltip(tip, { sticky: true });
      };
      updateVertexTooltip();

      // Delete mode
      vertex.on("click", (e) => {
        if (modeRef.current !== "delete") return;
        L.DomEvent.stopPropagation(e);
        const current = polygonRef.current;
        const newCoords = current.coordinates.filter((_, i) => i !== vIdx);
        emitChange(newCoords);
      });

      // Move mode: drag vertex
      vertex.on("mousedown", (e) => {
        if (modeRef.current !== "move") return;
        L.DomEvent.stopPropagation(e);
        if (e.originalEvent) e.originalEvent.preventDefault();

        draggingRef.current = { vertexIdx: vIdx };
        isDraggingRef.current = false;
        map.dragging.disable();

        const onMove = (me: L.LeafletMouseEvent) => {
          if (!draggingRef.current) return;
          isDraggingRef.current = true;
          const { vertexIdx } = draggingRef.current;
          const current = polygonRef.current;
          const newCoords = [...current.coordinates] as [number, number][];
          newCoords[vertexIdx] = [me.latlng.lng, me.latlng.lat];
          emitChange(newCoords);
        };

        const onUp = () => {
          draggingRef.current = null;
          isDraggingRef.current = false;
          map.dragging.enable();
          map.off("mousemove", onMove);
          map.off("mouseup", onUp);
        };

        map.on("mousemove", onMove);
        map.on("mouseup", onUp);
      });

      vertexMarkersRef.current.push(vertex);
    });

    // ── Midpoint markers (INSERT mode only) ──────────────────────────────────
    if (coords.length >= 2 && mode === "insert") {
      for (let i = 0; i < latLngs.length; i++) {
        const a = latLngs[i];
        const b = latLngs[(i + 1) % latLngs.length];
        const mid = L.latLng((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        const midMarker = L.circleMarker(mid, {
          radius: 5,
          color: "#2563eb", weight: 2,
          fillColor: "#93c5fd", fillOpacity: 0.9,
          bubblingMouseEvents: false,
        }).addTo(map);

        midMarker.bindTooltip(`Sisipkan titik antara #${i + 1} & #${(i + 1) % latLngs.length + 1}`, { sticky: true });

        const segIdx = i;
        midMarker.on("click", (e) => {
          if (modeRef.current !== "insert") return;
          L.DomEvent.stopPropagation(e);
          const current = polygonRef.current;
          const newCoords = [...current.coordinates] as [number, number][];
          newCoords.splice(segIdx + 1, 0, [e.latlng.lng, e.latlng.lat]);
          emitChange(newCoords);
        });

        midpointMarkersRef.current.push(midMarker);
      }
    }

    // ── Child point markers with Rich Popup (Matching ID: 01375) ─────────────
    if (childMarkersRef.current) {
      childMarkersRef.current.clearLayers();
      childPoints.forEach((cp) => {
        if (!cp.latitude || !cp.longitude) return;
        const catColor = CHILD_CATEGORY_COLORS[cp.category?.toLowerCase()] || "#6366f1";
        const isSelected = selectedChildPointId != null && String(selectedChildPointId) === String(cp.id);

        const childIcon = L.divIcon({
          className: "child-point-editor-pin",
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;">
              ${isSelected ? `<div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background-color: ${catColor}; opacity: 0.35; animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ""}
              <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                background-color: ${catColor};
                color: white;
                border: 2.5px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 6px rgba(0,0,0,0.35);
                font-size: 11px;
                font-weight: bold;
                ${isSelected ? "transform: scale(1.15); box-shadow: 0 0 0 3px #fbbf24;" : ""}
              ">
                📍
              </div>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const m = L.marker([cp.latitude, cp.longitude], { icon: childIcon });

        // Build rich popup like institution 01375
        const rawVars = cp.customVariables || (cp as any).custom_variables;
        const polygonLabel = cp.polygonName || (cp as any).polygon_name;
        let varsHtml = "";
        if (rawVars) {
          if (Array.isArray(rawVars)) {
            varsHtml = rawVars
              .map(
                (v: any) =>
                  `<div style="font-size: 11px; margin-top: 2.5px; color: #374151;">• <b>${v.label || v.key}:</b> ${v.value}</div>`
              )
              .join("");
          } else if (typeof rawVars === "object") {
            varsHtml = Object.entries(rawVars)
              .map(
                ([k, val]) =>
                  `<div style="font-size: 11px; margin-top: 2.5px; color: #374151;">• <b>${k.replace(/_/g, " ")}:</b> ${val}</div>`
              )
              .join("");
          }
        }

        const popupContent = `
          <div style="min-width: 210px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span style="display: inline-block; font-size: 10px; font-weight: 800; background: ${catColor}1a; color: ${catColor}; padding: 2.5px 7px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                ${cp.category || "Fasilitas"}
              </span>
            </div>
            <div style="font-size: 14px; font-weight: 800; margin-top: 5px; color: #111827; line-height: 1.25;">
              ${cp.name}
            </div>
            ${polygonLabel ? `<div style="font-size: 11px; color: #6b7280; margin-top: 3px;">Lokasi: <i>${polygonLabel}</i></div>` : ""}
            ${varsHtml ? `<div style="margin-top: 6px; padding-top: 5px; border-top: 1px solid #f3f4f6;">${varsHtml}</div>` : ""}
            ${cp.notes ? `<div style="font-size: 11px; color: #4b5563; margin-top: 6px; font-style: italic; background: #f9fafb; padding: 4px 7px; border-radius: 6px; border: 1px solid #f3f4f6;">${cp.notes}</div>` : ""}
            <div style="margin-top: 9px; padding-top: 7px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end;">
              <button id="btn-edit-cp-${cp.id}" style="font-size: 11px; font-weight: 700; background: #2563eb; color: white; border: none; padding: 4px 10px; border-radius: 7px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                ✏️ Edit Fasilitas
              </button>
            </div>
          </div>
        `;

        m.bindPopup(popupContent, { minWidth: 210, className: "custom-child-popup" });
        m.bindTooltip(cp.name, { direction: "top", offset: [0, -12] });

        m.on("popupopen", () => {
          const btn = document.getElementById(`btn-edit-cp-${cp.id}`);
          if (btn) {
            btn.onclick = () => {
              onSelectChildPointRef.current?.(cp);
              map.closePopup();
            };
          }
        });

        m.on("click", () => {
          onSelectChildPointRef.current?.(cp);
        });

        childMarkersRef.current?.addLayer(m);
      });
    }
  }, [polygon, childPoints, mode, emitChange, hasSelfIntersect, selectedChildPointId]);

  // ── 5. Render Picked Temporary Point Marker ────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (pickedMarkerRef.current) {
      try { map.removeLayer(pickedMarkerRef.current); } catch {}
      pickedMarkerRef.current = null;
    }

    if (pickedCoords && !isNaN(pickedCoords.lat) && !isNaN(pickedCoords.lng)) {
      const pickedIcon = L.divIcon({
        className: "picked-child-point-pin",
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
            <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background-color: rgba(239, 68, 68, 0.35); animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: relative; width: 28px; height: 28px; border-radius: 50%; background-color: #ef4444; color: white; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.45); font-size: 13px; font-weight: bold; cursor: grab;">
              📍
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const m = L.marker([pickedCoords.lat, pickedCoords.lng], {
        icon: pickedIcon,
        draggable: true,
        zIndexOffset: 1000,
      }).addTo(map);

      const displayName =
        pickedLabel && pickedLabel.trim() ? pickedLabel.trim() : "Titik Fasilitas Baru";

      m.bindTooltip(
        `<b>${displayName}</b><br/><span style='font-size: 10px; color: #dc2626;'>Geser pin untuk sesuaikan posisi</span>`,
        {
          permanent: true,
          direction: "top",
          offset: [0, -18],
        }
      );

      m.on("dragend", (e: any) => {
        const ll = e.target.getLatLng();
        onPickedCoordsChangeRef.current?.(ll.lat, ll.lng);
      });

      pickedMarkerRef.current = m;
    }
  }, [pickedCoords, pickedLabel]);

  // ── 6. Map Click Handler ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      // Child point picking mode
      if (isPickingRef.current) {
        onPickChildPointRef.current?.(e.latlng.lat, e.latlng.lng);
        return;
      }

      const m = modeRef.current;

      if (m === "draw") {
        const newPt: [number, number] = [e.latlng.lng, e.latlng.lat];
        const currentCoords = polygonRef.current.coordinates;

        let newCoords: [number, number][];
        if (currentCoords.length >= 3 && wouldSelfIntersect(currentCoords, newPt)) {
          const bestIdx = findBestInsertIndex(currentCoords, newPt);
          if (bestIdx >= 0) {
            newCoords = [...currentCoords] as [number, number][];
            newCoords.splice(bestIdx + 1, 0, newPt);
          } else {
            newCoords = [...currentCoords, newPt];
          }
        } else {
          newCoords = [...currentCoords, newPt];
        }

        emitChange(newCoords);
        return;
      }

      if (m === "insert") {
        const coords = polygonRef.current.coordinates;
        if (coords.length < 2) return;
        const latLngs = toLeafletLatLngs(coords);

        let bestDist = Infinity;
        let bestSegIdx = -1;

        for (let i = 0; i < latLngs.length; i++) {
          const a = latLngs[i];
          const b = latLngs[(i + 1) % latLngs.length];
          const { point } = closestPointOnSegment(e.latlng, a, b);
          const dist = pixelDistToTuple(map, e.latlng, point);
          if (dist < bestDist) {
            bestDist = dist;
            bestSegIdx = i;
          }
        }

        if (bestSegIdx >= 0 && bestDist < 30) {
          const newCoords = [...coords] as [number, number][];
          newCoords.splice(bestSegIdx + 1, 0, [e.latlng.lng, e.latlng.lat]);
          emitChange(newCoords);
        }
      }
    };

    map.on("click", handleMapClick);
    return () => { map.off("click", handleMapClick); };
  }, [emitChange]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const latLngs = toLeafletLatLngs(polygon.coordinates);
    if (latLngs.length >= 2) {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [60, 60], maxZoom: 18, animate: false });
    } else if (initialCenter) {
      map.setView(initialCenter, 17, { animate: false });
    }
  };

  const handleUndoLastPoint = () => {
    if (polygon.coordinates.length === 0) return;
    emitChange(polygon.coordinates.slice(0, -1));
  };

  const handleClearAll = () => {
    if (confirm("Kosongkan seluruh titik vertex pada bidang ini?")) {
      emitChange([]);
    }
  };

  const handleFixPolygon = () => {
    const coords = polygon.coordinates;
    if (coords.length < 3) return;
    const cx = coords.reduce((s, p) => s + p[0], 0) / coords.length;
    const cy = coords.reduce((s, p) => s + p[1], 0) / coords.length;
    const sorted = [...coords].sort((a, b) => {
      const angleA = Math.atan2(a[1] - cy, a[0] - cx);
      const angleB = Math.atan2(b[1] - cy, b[0] - cx);
      return angleA - angleB;
    });
    emitChange(sorted);
  };

  const vertexCount = polygon.coordinates?.length ?? 0;
  const currentArea = polygon.area_m2 || calculateAreaM2(toLeafletLatLngs(polygon.coordinates));
  const currentTool = TOOLS.find((t) => t.mode === mode);
  const currentHint = isPickingChildPoint
    ? "Klik di dalam batas polygon untuk menandai titik fasilitas (pin merah akan muncul)."
    : currentTool?.hint ?? "";

  return (
    <div
      className={`single-editor-wrapper relative w-full h-full overflow-hidden group bg-zinc-100 isolate ${
        isFullscreen ? "fullscreen-map !z-[9999]" : ""
      }`}
    >
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* ── Top Left: Mode & Status Bar ────────────────────────────────────── */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 pointer-events-auto">
        {/* Drawer Toggle Button: Buka dan Tutup Panel di sini */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`px-3 py-1.5 rounded-xl shadow-md text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 border ${
              isSidebarOpen
                ? "bg-white/95 backdrop-blur-md hover:bg-zinc-100 text-zinc-700 border-zinc-200"
                : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-emerald-600/20"
            }`}
            title={isSidebarOpen ? "Sembunyikan Panel (Peta Lebih Luas)" : "Tampilkan Panel Menu"}
          >
            {isSidebarOpen ? (
              <>
                <PanelLeftClose className="w-4 h-4 text-zinc-500" />
                <span>Tutup Panel</span>
              </>
            ) : (
              <>
                <PanelLeftOpen className="w-4 h-4 text-white" />
                <span>Buka Panel</span>
              </>
            )}
          </button>
        )}

        <div className="bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl shadow-md border border-zinc-200 flex items-center gap-2 text-xs">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
          </span>
          <span className="font-semibold text-zinc-900">
            {isPickingChildPoint ? "Mode: Pilih Titik Fasilitas" : `Mode: ${currentTool?.label ?? ""}`}
          </span>
          <span className="text-zinc-300">|</span>
          <span className="text-zinc-600 font-mono text-[11px]">{vertexCount} Titik</span>
          <span className="text-zinc-300">|</span>
          <span className="text-emerald-700 font-bold font-mono text-[11px]">
            {currentArea.toLocaleString("id-ID")} m² ({(currentArea / 10000).toFixed(2)} Ha)
          </span>
        </div>

        {vertexCount > 0 && !isPickingChildPoint && (
          <div className="flex items-center gap-1.5">
            {hasSelfIntersect && (
              <div className="flex items-center gap-1">
                <div className="px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Polygon Berpotongan!</span>
                </div>
                <button
                  type="button"
                  onClick={handleFixPolygon}
                  title="Perbaiki otomatis urutan titik"
                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl border border-amber-600 text-xs font-bold shadow-md transition-all flex items-center gap-1 active:scale-95"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Auto-Fix</span>
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleUndoLastPoint}
              title="Hapus Titik Terakhir"
              className="px-2.5 py-1.5 bg-white/95 backdrop-blur-md hover:bg-zinc-100 text-zinc-700 rounded-xl border border-zinc-200 text-xs font-semibold shadow-md transition-all flex items-center gap-1 active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              title="Reset Semua Titik"
              className="p-1.5 bg-white/95 backdrop-blur-md hover:bg-red-50 text-zinc-500 hover:text-red-600 rounded-xl border border-zinc-200 text-xs shadow-md transition-all active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Left Side: Vertical Toolbar ─────────────────────────────────────── */}
      {!isPickingChildPoint && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1.5 pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-md border border-zinc-200 rounded-2xl shadow-lg p-1.5 flex flex-col gap-1">
            {TOOLS.map((tool) => {
              const active = mode === tool.mode;
              return (
                <button
                  key={tool.mode}
                  type="button"
                  onClick={() => setMode(tool.mode)}
                  title={tool.label}
                  className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all text-sm font-medium ${
                    active
                      ? "bg-emerald-600 text-white shadow-md"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                  }`}
                >
                  {tool.icon}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Top Right: Basemap Switcher + Recenter + Fullscreen ─────────────── */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 pointer-events-auto">
        <div className="flex bg-white/95 backdrop-blur-md shadow-md border border-zinc-200 rounded-xl p-1 gap-1">
          {(Object.keys(BASEMAP_TILES) as Array<keyof typeof BASEMAP_TILES>).map((key) => {
            const active = activeBasemap === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveBasemap(key)}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all ${
                  active
                    ? "bg-zinc-900 text-white shadow-xs font-semibold"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                {BASEMAP_TILES[key].name}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleRecenter}
          title="Pusatkan Peta ke Bidang Ini"
          className="p-2 bg-white/95 backdrop-blur-md border border-zinc-200 rounded-xl shadow-md text-zinc-700 hover:text-emerald-600 hover:bg-zinc-50 transition-all active:scale-95"
        >
          <Navigation className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleFullscreenToggle}
          title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
          className="p-2 bg-white/95 backdrop-blur-md border border-zinc-200 rounded-xl shadow-md text-zinc-700 hover:text-indigo-600 hover:bg-zinc-50 transition-all active:scale-95"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ── Bottom Left: Clean Compact Hint Pill (Right on the bottom edge) ── */}
      <div className="absolute bottom-2.5 left-3 z-10 pointer-events-auto">
        <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-zinc-200 text-[11px] text-zinc-600 flex items-center gap-2 max-w-md">
          <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="leading-tight">{currentHint}</span>
        </div>
      </div>
    </div>
  );
}
