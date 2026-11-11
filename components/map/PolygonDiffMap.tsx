"use client";

import { useEffect, useRef, useState } from "react";
import L from "@/lib/leaflet-safe";
import { Layers, Maximize2, Minimize2, Eye, GitCompare, Info } from "lucide-react";
import { toLeafletLatLngs } from "@/lib/geometry";
import type { InstitutionPolygon } from "@/lib/geometry";

export interface PolygonDiffMapProps {
  coordinates: [number, number];
  institutionName: string;
  previousPolygons?: InstitutionPolygon[];
  newPolygons?: InstitutionPolygon[];
  diff?: {
    added?: any[];
    modified?: any[];
    deleted?: any[];
  } | null;
  focusPolygonId?: string | null;
  initialMode?: "overlay" | "before" | "after";
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

export default function PolygonDiffMap({
  coordinates,
  institutionName,
  previousPolygons = [],
  newPolygons = [],
  diff = null,
  focusPolygonId = null,
  initialMode = "overlay",
}: PolygonDiffMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  const [activeBasemap, setActiveBasemap] = useState<keyof typeof BASEMAP_TILES>("satellite");
  const [viewMode, setViewMode] = useState<"overlay" | "before" | "after">(initialMode);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen support
  const handleFullscreenToggle = () => {
    const container = mapContainerRef.current?.closest(".diffmap-wrapper") as HTMLElement | null;
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

  // 1. Initialize Leaflet Map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch {}
      mapInstanceRef.current = null;
    }

    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    const initialCenter: [number, number] =
      coordinates && Array.isArray(coordinates) && coordinates.length === 2 && !isNaN(coordinates[0]) && !isNaN(coordinates[1])
        ? coordinates
        : [-7.95156, 112.60742];

    const map = L.map(container, {
      center: initialCenter,
      zoom: 17,
      zoomControl: true,
      attributionControl: false,
    });

    const tileConfig = BASEMAP_TILES[activeBasemap];
    const tileLayer = L.tileLayer(tileConfig.url, {
      maxZoom: tileConfig.maxZoom,
      attribution: tileConfig.attribution,
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    const layersGroup = L.layerGroup().addTo(map);
    layersGroupRef.current = layersGroup;
    mapInstanceRef.current = map;

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    return () => {
      try {
        map.remove();
      } catch {}
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Switch Basemap Tiles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileConfig = BASEMAP_TILES[activeBasemap];
    const newTile = L.tileLayer(tileConfig.url, {
      maxZoom: tileConfig.maxZoom,
      attribution: tileConfig.attribution,
    }).addTo(map);
    tileLayerRef.current = newTile;
  }, [activeBasemap]);

  // 3. Render Polygons (Before, After, or Overlay Comparison)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layersGroup = layersGroupRef.current;
    if (!map || !layersGroup) return;

    layersGroup.clearLayers();

    const addedIds = new Set((diff?.added || []).map((p: any) => p.id));
    const modifiedIds = new Set((diff?.modified || []).map((p: any) => p.id));
    const deletedIds = new Set((diff?.deleted || []).map((p: any) => p.id));

    const allBounds = L.latLngBounds([]);

    // A. Render BEFORE Polygons
    if (viewMode === "overlay" || viewMode === "before") {
      previousPolygons.forEach((poly) => {
        if (!poly.coordinates || poly.coordinates.length < 3) return;
        if (focusPolygonId && poly.id !== focusPolygonId) return;

        const latLngs = toLeafletLatLngs(poly.coordinates);
        if (latLngs.length < 3) return;

        latLngs.forEach((pt) => allBounds.extend(pt));

        const isDeleted = deletedIds.has(poly.id);
        const isModified = modifiedIds.has(poly.id);

        const style: L.PolylineOptions = isDeleted
          ? {
              color: "#e11d48", // Rose Red
              weight: 3,
              dashArray: "8, 6",
              fillColor: "#f43f5e",
              fillOpacity: 0.35,
            }
          : isModified
          ? {
              color: "#ef4444", // Red dashed for modified previous
              weight: 2.5,
              dashArray: "6, 6",
              fillColor: "#ef4444",
              fillOpacity: 0.15,
            }
          : {
              color: "#dc2626", // Neutral red before
              weight: 2,
              dashArray: "5, 5",
              fillColor: "#f87171",
              fillOpacity: 0.12,
            };

        const polygonLayer = L.polygon(latLngs, style);

        const badgeLabel = isDeleted
          ? '<span class="bg-rose-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">Dihapus</span>'
          : '<span class="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded text-[10px] font-bold">Sebelum (Awal)</span>';

        polygonLayer.bindTooltip(
          `<div class="p-1">
            <div class="flex items-center gap-1.5 mb-1">${badgeLabel} <strong>${poly.name}</strong></div>
            <div class="text-[11px] text-zinc-600">Luas: <b>${Number(poly.area_m2 || 0).toLocaleString("id-ID")} m²</b> (${poly.coordinates.length} titik)</div>
          </div>`,
          { sticky: true, direction: "top" }
        );

        layersGroup.addLayer(polygonLayer);
      });
    }

    // B. Render AFTER / NEW Polygons
    if (viewMode === "overlay" || viewMode === "after") {
      newPolygons.forEach((poly) => {
        if (!poly.coordinates || poly.coordinates.length < 3) return;
        if (focusPolygonId && poly.id !== focusPolygonId) return;

        const latLngs = toLeafletLatLngs(poly.coordinates);
        if (latLngs.length < 3) return;

        latLngs.forEach((pt) => allBounds.extend(pt));

        const isAdded = addedIds.has(poly.id);
        const isModified = modifiedIds.has(poly.id);

        const style: L.PolylineOptions = isAdded
          ? {
              color: "#2563eb", // Blue for newly added
              weight: 3,
              fillColor: "#3b82f6",
              fillOpacity: 0.35,
            }
          : isModified
          ? {
              color: "#059669", // Emerald solid for modified new
              weight: 3,
              fillColor: "#10b981",
              fillOpacity: 0.28,
            }
          : {
              color: "#059669", // Standard emerald
              weight: 2.5,
              fillColor: "#10b981",
              fillOpacity: 0.22,
            };

        const polygonLayer = L.polygon(latLngs, style);

        const badgeLabel = isAdded
          ? '<span class="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">+ Baru Ditambah</span>'
          : isModified
          ? '<span class="bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">✓ Usulan Baru</span>'
          : '<span class="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">Usulan (Baru)</span>';

        polygonLayer.bindTooltip(
          `<div class="p-1">
            <div class="flex items-center gap-1.5 mb-1">${badgeLabel} <strong>${poly.name}</strong></div>
            <div class="text-[11px] text-zinc-600">Luas: <b>${Number(poly.area_m2 || 0).toLocaleString("id-ID")} m²</b> (${poly.coordinates.length} titik)</div>
          </div>`,
          { sticky: true, direction: "top" }
        );

        layersGroup.addLayer(polygonLayer);
      });
    }

    // Auto-fit bounds if polygons are present
    if (allBounds.isValid()) {
      map.fitBounds(allBounds, { padding: [35, 35], maxZoom: 18 });
    } else if (coordinates && coordinates.length === 2 && !isNaN(coordinates[0])) {
      map.setView(coordinates, 17);
    }
  }, [viewMode, previousPolygons, newPolygons, diff, focusPolygonId]);

  return (
    <div className={`diffmap-wrapper relative w-full h-full select-none ${isFullscreen ? "fixed inset-0 z-9999 bg-black" : ""}`}>
      {/* Map DOM Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Controls: Mode Switcher & Basemap */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none flex-wrap">
        {/* Mode Switcher Tabs */}
        <div className="flex bg-white/95 backdrop-blur-md p-1 rounded-2xl border border-zinc-200/90 shadow-md text-xs font-semibold pointer-events-auto">
          <button
            type="button"
            onClick={() => setViewMode("overlay")}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              viewMode === "overlay"
                ? "bg-zinc-900 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Overlay Komparasi</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("before")}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              viewMode === "before"
                ? "bg-rose-700 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
            <span>Sebelum (Awal)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("after")}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              viewMode === "after"
                ? "bg-emerald-700 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Usulan (Sesudah)</span>
          </button>
        </div>

        {/* Basemap & Fullscreen Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => setActiveBasemap(activeBasemap === "satellite" ? "streets" : "satellite")}
            className="px-3 py-1.5 bg-white/95 backdrop-blur-md hover:bg-white text-zinc-700 rounded-xl border border-zinc-200 shadow-md text-xs font-bold transition-all flex items-center gap-1.5"
            title="Ganti Lapisan Peta"
          >
            <Layers className="w-3.5 h-3.5 text-zinc-500" />
            <span>{BASEMAP_TILES[activeBasemap].name}</span>
          </button>

          <button
            type="button"
            onClick={handleFullscreenToggle}
            className="p-2 bg-white/95 backdrop-blur-md hover:bg-white text-zinc-700 rounded-xl border border-zinc-200 shadow-md transition-all"
            title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Bottom Legend Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none flex justify-center">
        <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-zinc-200/90 shadow-md text-[11px] font-semibold text-zinc-700 flex items-center gap-4 pointer-events-auto flex-wrap justify-center">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1 border-b-2 border-dashed border-rose-600 inline-block" />
            <span>Merah Putus-putus: Bentuk Awal (Sebelum)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-2 rounded-xs bg-emerald-500 border border-emerald-700 inline-block" />
            <span>Hijau Solid: Usulan Baru (Sesudah)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-2 rounded-xs bg-blue-500 border border-blue-700 inline-block" />
            <span>Biru: Bidang Baru Ditambah</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-2 rounded-xs bg-rose-500 border border-rose-700 inline-block" />
            <span>Merah: Bidang Dihapus</span>
          </div>
        </div>
      </div>
    </div>
  );
}
