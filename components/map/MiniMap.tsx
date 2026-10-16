"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Navigation, Layers } from "lucide-react";

interface MiniMapProps {
  coordinates: [number, number];
  name: string;
  type?: string;
  landGeometry?: any;
  landParcels?: any[];
}

const BASEMAP_TILES = {
  streets: {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    maxZoom: 19,
  },
  satellite: {
    name: "Satelit",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri World Imagery",
    maxZoom: 18,
  },
  light: {
    name: "Carto Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; CARTO",
    maxZoom: 19,
  },
  dark: {
    name: "Carto Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; CARTO",
    maxZoom: 19,
  },
};

const PARCEL_COLORS: Record<string, string> = {
  pendidikan: "#059669",
  ibadah: "#7c3aed",
  olahraga: "#0891b2",
  perkantoran: "#6366f1",
  infrastruktur: "#78716c",
  ekonomi: "#d97706",
  asrama: "#be185d",
  pertanian: "#65a30d",
  kesehatan: "#dc2626",
  akomodasi: "#ea580c",
  kebudayaan: "#9333ea",
  lahan_kosong: "#a8a29e",
  lainnya: "#a8a29e",
};

const TYPE_MARKER_COLORS: Record<string, string> = {
  pesantren: "#2563eb",        // Biru
  madrasah: "#eab308",         // Kuning
  universitas_islam: "#dc2626", // Merah
};

export default function MiniMap({
  coordinates,
  name,
  type = "pesantren",
  landGeometry,
  landParcels,
}: MiniMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const [activeBasemap, setActiveBasemap] = useState<keyof typeof BASEMAP_TILES>("streets");

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: coordinates,
      zoom: 15,
      zoomControl: true,
      attributionControl: false,
    });

    // Initial tile layer
    const tileConfig = BASEMAP_TILES[activeBasemap];
    const initialTile = L.tileLayer(tileConfig.url, {
      maxZoom: tileConfig.maxZoom,
      attribution: tileConfig.attribution,
    }).addTo(map);

    currentTileLayerRef.current = initialTile;

    // Marker color based on institution category
    const pinColor = TYPE_MARKER_COLORS[type] || "#2563eb";

    // Add point marker
    L.circleMarker(coordinates, {
      radius: 9,
      fillColor: pinColor,
      color: "#ffffff",
      weight: 2.5,
      fillOpacity: 1,
    })
      .addTo(map)
      .bindPopup(`<strong class="text-xs font-semibold">${name}</strong>`)
      .openPopup();

    let hasPolygonData = false;
    const bounds = L.latLngBounds([coordinates, coordinates]);

    // Add Land Polygon if exists
    if (landGeometry && Array.isArray(landGeometry) && landGeometry.length > 2) {
      const latLngs = landGeometry.map((pt: any) => {
        if (Array.isArray(pt) && pt.length >= 2) {
          return [pt[1], pt[0]] as [number, number];
        }
        return pt;
      });

      const poly = L.polygon(latLngs, {
        color: "#059669",
        weight: 2.5,
        fillColor: "#059669",
        fillOpacity: 0.35,
      }).addTo(map);

      poly.bindTooltip("Batas Bidang Tanah", { sticky: true });
      bounds.extend(poly.getBounds());
      hasPolygonData = true;
    }

    // Add Parcels if exists
    if (landParcels && Array.isArray(landParcels) && landParcels.length > 0) {
      landParcels.forEach((parcel: any) => {
        if (parcel.geometry && Array.isArray(parcel.geometry) && parcel.geometry.length > 2) {
          const latLngs = parcel.geometry.map((pt: any) => [pt[1], pt[0]]);
          const color = PARCEL_COLORS[parcel.category] || "#a8a29e";
          const poly = L.polygon(latLngs, {
            color,
            weight: 1.5,
            fillColor: color,
            fillOpacity: 0.6,
          }).addTo(map);

          poly.bindTooltip(
            `<b>${parcel.name || "Sub-Parcel"}</b><br/>${parcel.category || ""}`,
            { sticky: true }
          );
          bounds.extend(poly.getBounds());
          hasPolygonData = true;
        }
      });
    }

    // Fit bounds if polygon exists, otherwise setView with zoom 15
    if (hasPolygonData) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    } else {
      map.setView(coordinates, 15);
    }

    mapInstanceRef.current = map;

    // Invalidate size across multiple delays for smooth rendering
    const timer1 = setTimeout(() => map.invalidateSize(), 50);
    const timer2 = setTimeout(() => map.invalidateSize(), 200);
    const timer3 = setTimeout(() => map.invalidateSize(), 500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [coordinates, name, type, landGeometry, landParcels]);

  // Update Basemap tile layer when user switches
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

  // Recenter helper
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (landGeometry && Array.isArray(landGeometry) && landGeometry.length > 2) {
      const latLngs = landGeometry.map((pt: any) => [pt[1], pt[0]]);
      const poly = L.polygon(latLngs);
      map.fitBounds(poly.getBounds(), { padding: [40, 40], maxZoom: 17 });
    } else {
      map.flyTo(coordinates, 16, { duration: 1 });
    }
  };

  return (
    <div className="relative w-full overflow-hidden border-y border-zinc-200 group">
      {/* Map Canvas - Enriched height 480px */}
      <div
        ref={mapContainerRef}
        style={{ height: "480px", width: "100%" }}
        className="z-0"
      />

      {/* Floating Basemap Switcher & Reset Button (Top Right) */}
      <div className="absolute top-4 right-4 z-400 flex items-center gap-2">
        <div className="flex bg-white/95 backdrop-blur-md shadow-lg border border-zinc-200/90 rounded-xl p-1 gap-1">
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

        {/* Recenter Button */}
        <button
          type="button"
          onClick={handleRecenter}
          title="Pusatkan ke Lokasi Lembaga"
          className="p-2.5 bg-white/95 backdrop-blur-md border border-zinc-200/90 rounded-xl shadow-lg text-zinc-700 hover:text-emerald-600 hover:bg-zinc-50 transition-all active:scale-95"
        >
          <Navigation className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
