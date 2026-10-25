"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Navigation, Layers, MapPin, Building, Info, Maximize2, Minimize2 } from "lucide-react";
import { normalizePolygons, toLeafletLatLngs, ChildPointItem } from "@/lib/geometry";

import type { InstitutionPolygon } from "@/lib/geometry";

interface MiniMapProps {
  coordinates: [number, number];
  name: string;
  type?: string;
  landGeometry?: any;
  landParcels?: any[];
  /** Pre-normalized polygons from API (preferred over landGeometry) */
  polygons?: InstitutionPolygon[];
  childPoints?: ChildPointItem[];
}

const BASEMAP_TILES = {
  satellite: {
    name: "Satelit (Esri)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri World Imagery",
    maxZoom: 18,
  },
  streets: {
    name: "Peta Jalan (OSM)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    maxZoom: 19,
  },
};

const POLYGON_PALETTE = [
  "#059669", // Emerald
  "#2563eb", // Blue
  "#7c3aed", // Purple
  "#ea580c", // Orange
  "#0891b2", // Cyan
  "#d97706", // Amber
];

const CHILD_CATEGORY_COLORS: Record<string, string> = {
  perkantoran: "#6366f1",
  pendidikan: "#059669",
  ibadah: "#7c3aed",
  asrama: "#be185d",
  olahraga: "#0891b2",
  laboratorium: "#0284c7",
  umum: "#4b5563",
};

export default function MiniMap({
  coordinates,
  name,
  type = "pesantren",
  landGeometry,
  landParcels,
  polygons: propPolygons,
  childPoints = [],
}: MiniMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const [activeBasemap, setActiveBasemap] = useState<keyof typeof BASEMAP_TILES>("streets");
  const [mapReady, setMapReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleFullscreenToggle = () => {
    const container = mapContainerRef.current?.closest(".minimap-wrapper") as HTMLElement | null;
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

  const effectivePolygons =
    propPolygons && propPolygons.length > 0
      ? propPolygons
      : normalizePolygons(landGeometry, name);

  // Initialize Map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) return;

    // Clean up any existing leaflet instance or lingering id
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (err) {
        console.warn("Cleanup warning:", err);
      }
      mapInstanceRef.current = null;
    }

    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    let map: L.Map | null = null;
    try {
      map = L.map(container, {
        center: coordinates,
        zoom: 16,
        zoomControl: true,
        attributionControl: false,
      });

      const tileConfig = BASEMAP_TILES[activeBasemap];
      const initialTile = L.tileLayer(tileConfig.url, {
        maxZoom: tileConfig.maxZoom,
        attribution: tileConfig.attribution,
      }).addTo(map);

      currentTileLayerRef.current = initialTile;

      // Add Main Location Marker
      const pinColor = type === "madrasah" ? "#eab308" : type === "universitas_islam" ? "#dc2626" : "#2563eb";
      L.circleMarker(coordinates, {
        radius: 9,
        fillColor: pinColor,
        color: "#ffffff",
        weight: 3,
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-size: 12px; font-weight: bold; padding: 2px;">${name}</div><div style="font-size: 10px; color: #666;">Titik Koordinat Utama</div>`
        );

      let hasSpatialBounds = false;
      const bounds = L.latLngBounds([coordinates, coordinates]);

      // 1. Render ALL Land Polygons (Supports Multiple Polygons)
      if (effectivePolygons.length > 0) {
        effectivePolygons.forEach((polyItem, idx) => {
          const latLngs = toLeafletLatLngs(polyItem.coordinates);
          if (latLngs.length >= 3) {
            const color = POLYGON_PALETTE[idx % POLYGON_PALETTE.length];
            const poly = L.polygon(latLngs, {
              color,
              weight: 2.5,
              fillColor: color,
              fillOpacity: 0.3,
            }).addTo(map!);

            const areaInfo = polyItem.area_m2
              ? `<br/><span style="font-size: 11px; color: #047857;">Luas: <b>${polyItem.area_m2.toLocaleString(
                  "id-ID"
                )} m²</b> (${(polyItem.area_m2 / 10000).toFixed(2)} Ha)</span>`
              : "";

            poly.bindTooltip(
              `<strong style="font-size: 12px;">${polyItem.name}</strong>${areaInfo}`,
              { sticky: true }
            );

            bounds.extend(poly.getBounds());
            hasSpatialBounds = true;
          }
        });
      }

      // 2. Render Sub-Parcels if exists
      if (landParcels && Array.isArray(landParcels) && landParcels.length > 0) {
        landParcels.forEach((parcel: any) => {
          if (parcel.geometry && Array.isArray(parcel.geometry) && parcel.geometry.length > 2) {
            const latLngs = parcel.geometry.map((pt: any) => [pt[1], pt[0]]);
            const poly = L.polygon(latLngs, {
              color: "#6366f1",
              weight: 1.5,
              fillColor: "#6366f1",
              fillOpacity: 0.5,
            }).addTo(map!);

            poly.bindTooltip(
              `<b>${parcel.name || "Sub-Parcel"}</b><br/>${parcel.category || ""}`,
              { sticky: true }
            );
            bounds.extend(poly.getBounds());
            hasSpatialBounds = true;
          }
        });
      }

      // 3. Render Child Points (Titik Anak di dalam Polygon)
      if (childPoints && Array.isArray(childPoints) && childPoints.length > 0) {
        childPoints.forEach((cp) => {
          if (!cp.latitude || !cp.longitude) return;

          const catColor = CHILD_CATEGORY_COLORS[cp.category?.toLowerCase()] || "#4b5563";

          // Custom pin icon for child points
          const childIcon = L.divIcon({
            className: "child-point-pin",
            html: `
              <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                width: 22px;
                height: 22px;
                background-color: ${catColor};
                color: white;
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                font-size: 10px;
                font-weight: bold;
              ">
                📍
              </div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });

          const childMarker = L.marker([cp.latitude, cp.longitude], {
            icon: childIcon,
          }).addTo(map!);

          // Build dynamic custom variables list HTML
          const rawVars = cp.customVariables || (cp as any).custom_variables;
          const polygonLabel = cp.polygonName || (cp as any).polygon_name;
          let varsHtml = "";
          if (rawVars) {
            if (Array.isArray(rawVars)) {
              varsHtml = rawVars
                .map(
                  (v: any) =>
                    `<div style="font-size: 11px; margin-top: 2px;">• <b>${v.label || v.key}:</b> ${v.value}</div>`
                )
                .join("");
            } else if (typeof rawVars === "object") {
              varsHtml = Object.entries(rawVars)
                .map(
                  ([k, val]) =>
                    `<div style="font-size: 11px; margin-top: 2px;">• <b>${k.replace(/_/g, " ")}:</b> ${val}</div>`
                )
                .join("");
            }
          }

          const popupContent = `
            <div style="min-width: 180px; font-family: sans-serif; padding: 4px;">
              <span style="display: inline-block; font-size: 10px; font-weight: bold; background: ${catColor}20; color: ${catColor}; padding: 2px 6px; border-radius: 6px; text-transform: uppercase;">
                ${cp.category || "Fasilitas"}
              </span>
              <div style="font-size: 13px; font-weight: bold; margin-top: 4px; color: #111;">
                ${cp.name}
              </div>
              ${polygonLabel ? `<div style="font-size: 11px; color: #666; margin-top: 2px;">Lokasi: <i>${polygonLabel}</i></div>` : ""}
              ${varsHtml ? `<div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #eee;">${varsHtml}</div>` : ""}
              ${cp.notes ? `<div style="font-size: 10px; color: #777; margin-top: 4px; font-style: italic;">${cp.notes}</div>` : ""}
            </div>
          `;

          childMarker.bindPopup(popupContent);
          childMarker.bindTooltip(cp.name, { direction: "top", offset: [0, -10] });

          bounds.extend([cp.latitude, cp.longitude]);
          hasSpatialBounds = true;
        });
      }

      if (hasSpatialBounds) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
      } else {
        map.setView(coordinates, 16);
      }

      mapInstanceRef.current = map;
      setMapReady(true);

      // Safe multi-timer invalidate size for seamless rendering
      const safeInvalidate = () => {
        if (!map) return;
        try {
          const container = map.getContainer();
          if (container && container.offsetParent !== null && (container as any)._leaflet_id) {
            map.invalidateSize();
          }
        } catch {}
      };

      setTimeout(safeInvalidate, 50);
      setTimeout(safeInvalidate, 200);
      setTimeout(safeInvalidate, 600);
    } catch (e) {
      console.error("Leaflet map initialization error:", e);
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
      if (container && (container as any)._leaflet_id) {
        delete (container as any)._leaflet_id;
      }
    };
  }, [coordinates, name, type, landGeometry, landParcels, propPolygons, childPoints]);

  // Update Basemap when user toggles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    const tileConfig = BASEMAP_TILES[activeBasemap];
    const newTile = L.tileLayer(tileConfig.url, {
      maxZoom: tileConfig.maxZoom,
      attribution: tileConfig.attribution,
    }).addTo(map);

    currentTileLayerRef.current = newTile;
  }, [activeBasemap]);

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map || !coordinates) return;

    if (effectivePolygons.length > 0) {
      const bounds = L.latLngBounds([coordinates, coordinates]);
      effectivePolygons.forEach((p) => {
        const latLngs = toLeafletLatLngs(p.coordinates);
        if (latLngs.length >= 3) {
          bounds.extend(L.latLngBounds(latLngs));
        }
      });
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    } else {
      map.flyTo(coordinates, 16, { duration: 0.8 });
    }
  };

  const polygonsList = effectivePolygons;

  return (
    <div className={`minimap-wrapper relative w-full overflow-hidden border-y border-zinc-200 group bg-zinc-100 ${isFullscreen ? "fullscreen-map" : ""}`}>
      {/* Map Canvas */}
      <div
        ref={mapContainerRef}
        style={{ height: "480px", width: "100%", minHeight: "480px" }}
        className="w-full h-full z-0"
      />

      {/* Floating Basemap Switcher & Reset Button (Top Right) */}
      <div className="absolute top-4 right-4 z-400 flex items-center gap-2">
        <div className="flex bg-white/95 backdrop-blur-md shadow-md border border-zinc-200 rounded-xl p-1 gap-1">
          {(Object.keys(BASEMAP_TILES) as Array<keyof typeof BASEMAP_TILES>).map((key) => {
            const active = activeBasemap === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveBasemap(key)}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                  active
                    ? "bg-zinc-900 text-white shadow-sm"
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
          title="Pusatkan Peta"
          className="p-2.5 bg-white/95 backdrop-blur-md border border-zinc-200 rounded-xl shadow-md text-zinc-700 hover:text-emerald-600 hover:bg-zinc-50 transition-all active:scale-95"
        >
          <Navigation className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleFullscreenToggle}
          title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
          className="p-2.5 bg-white/95 backdrop-blur-md border border-zinc-200 rounded-xl shadow-md text-zinc-700 hover:text-indigo-600 hover:bg-zinc-50 transition-all active:scale-95"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Spatial Legend Overlay (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-400 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-md border border-zinc-200 text-xs space-y-1.5 max-w-xs">
        <div className="font-semibold text-zinc-800 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5 text-emerald-600" />
          <span>Informasi Spasial ({polygonsList.length} Bidang Polygon)</span>
        </div>

        {polygonsList.length > 0 ? (
          <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
            {polygonsList.map((poly, idx) => {
              const color = POLYGON_PALETTE[idx % POLYGON_PALETTE.length];
              return (
                <div key={poly.id || idx} className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                    <span className="truncate font-medium text-zinc-800">{poly.name}</span>
                  </div>
                  {poly.area_m2 ? (
                    <span className="text-zinc-500 font-mono text-[10px] shrink-0">
                      {poly.area_m2.toLocaleString("id-ID")} m²
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[11px] text-zinc-400 italic">
            Belum ada polygon bidang tanah terdaftar.
          </div>
        )}

        {childPoints.length > 0 && (
          <div className="pt-1 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-600">
            <span>Titik Fasilitas (Child):</span>
            <span className="font-bold text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded">
              {childPoints.length} titik
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
